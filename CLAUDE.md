# G99 Performance — CLAUDE.md (kontekst za nadaljnje pogovore)

> Ta dokument prilepi/priloži na začetku novega pogovora, da Claude ne rabi
> ponovno raziskovati kode od začetka. Posodabljaj ga po vsakem večjem koraku.

---

## 1. Kaj je G99 Performance

Aplikacija za merjenje in gamifikacijo športnih rezultatov (combine-style
dogodki). Športniki dobijo digitalno kartico s FIFA-card-like OVR oceno
(0-99), rangom (Iron → Bronze → Silver → Gold → Platinum → Diamond → Prime →
Elite → G99) in petimi meritvami: hitrost, moč, eksplozivnost, agilnost,
vzdržljivost. Del širšega G99 ekosistema (Trening Lab, MyClub - ločeni
projekti, niso predmet tega dokumenta).

Lastnik/edini razvijalec: JG — trener, ne programer. Claude piše VSO kodo;
JG jo prenese v VS Code, potrdi (Source Control panel) in pošlje naprej.

---

## 2. Infrastruktura in deployment

- **Repozitorij:** GitHub, `jgrobelnik99-ctrl/G99-PERFORMANCE`, veja `main`
- **Hosting:** Cloudflare Pages, projekt `g99-performance`
  (`g99-performance.pages.dev`), povezan neposredno na GitHub repo
  - Build command: (prazno) — ni build koraka, čist HTML/CSS/JS
  - Framework preset: `None`
  - **Avtomatski deploy ob vsakem `git push` na `main`**
- **NETLIFY SE NE UPORABLJA VEČ** — opuščen zaradi novega kreditnega sistema
  (300 kreditov/mesec, ~20 deployov). Če se kdaj omenja Netlify v starih
  datotekah/navodilih, je zastarelo.
- **Baza:** Firebase Firestore + Auth (Spark/free plan), projekt `g99-gym`
  (isti Firebase projekt je souporabljen z G99 Trening Lab)
- **Git delovni tok (JG ni programer, zato NE uporablja terminala):**
  1. Claude odda posodobljene datoteke (`app.js`, `app.css`, `index.html`)
  2. JG jih prekopira čez stare v mapi projekta na svojem računalniku
  3. VS Code → ikona razcepa (Source Control) → Stage all (+) → napiše
     sporočilo → Commit (✓) → Sync/Push (↑)
  4. Cloudflare avtomatsko zazna push in deploy (traja ~30-60s)
  - Git Bash se je uporabil SAMO enkrat, na začetku, za `git init` in prvi
    `git push -u origin main`. Za tekoče delo se ne uporablja.

---

## 3. Struktura datotek (razdeljeno iz enega HTML-ja v 4 dele)

```
index.html    (~530 vrstic)  — ogrodje, CDN <script> tagi, ena majhna inline
                                skripta ki mora ostati inline (profil način)
app.css       (~1780 vrstic) — vsi slogi
app.js        (~5800 vrstic) — vsa logika, en modul (<script type="module">)
_redirects    — Cloudflare Pages routing (/p/*, /tv, /* → index.html)
```

Prvotno vse eno v `G99_Performance.html` (~7900 vrstic) — razdeljeno zaradi
tokenov v klepetu. Validacija po vsaki spremembi: `node --check app.js` +
preverjanje ravnovesja `<div>`/`</div>` v `index.html`.

**Referenca za Firestore pravila:** `PERFORMANCE_PRAVILA.md` — NI del
delujoče aplikacije (Cloudflare je ne strežе), je le dokument, ki ga JG
ročno prilepi v Firebase konzolo (Firestore Database → Rules → Publish),
kadar se pravila spremenijo. **Ni samodejno sinhroniziran** — če Claude
doda/spremeni Firestore pravilo, mora IZRECNO opozoriti JG, da ga mora
ročno objaviti, drugače nova funkcija ne bo delovala.

---

## 4. Ključne funkcije v `app.js` (orientacija za hitro iskanje)

| Funkcija | Kaj počne |
|---|---|
| `window.getColorForOvr(ovr)` | **EDINI VIR RESNICE** za barve rangov (hex). Uporabljena za `--rang-barva` inline stil na karticah. |
| `window.getRankClassAndName(o, lng)` | OVR → ime ranga + CSS razred (`rank-iron` … `rank-g99`) |
| `window.preračunaj(val, obj, nizjeJeBolje)` | Meritev → ocena 1-99 (LOCAL z-score ali GLOBAL min/max lestvica) |
| `window.pripraviNovVnos()` | **Popolno počiščenje obrazca za vnos** — ključno za preprečitev buga (glej §6.1) |
| `window.urediAtleta(id)` | Odpre obstoječo kartico za urejanje, nastavi `#atletId` |
| `window.zapestnicaUporabi(koda, z)` | Skener zapestnice izpolni obrazec; kliče `pripraviNovVnos()` PRED izpolnjevanjem |
| `window.shraniAtleta()` | Shrani meritev; `targetId = document.getElementById('atletId').value` odloča ali gre za NOV zapis ali PREPIS obstoječega |
| `window.objaviNaStartu(ime, email)` / `napovejNaStartu()` | Piše v `stanje/naslednji` (TV napoved) |
| `window.tvPokaziNaStartu()` / `tvSkrijNaStartu()` | TV zaslon "Na štartu" — glej §7.1 |
| `window.sprostiVseKode()` | Izbriše VSE zapise iz `zapestnice` takoj (ne čaka 24h) |

**Skrito polje `#atletId`** je edino mesto, ki odloča, ali `shraniAtleta()`
ustvari nov zapis ali prepiše obstoječega. Kdorkoli dodaja novo pot za "nov
vnos" (skener, gumb, ipd.) MORA poklicati `pripraviNovVnos()` prej, sicer
tvega prepis tuje kartice.

---

## 5. Firestore zbirke

| Zbirka | Namen | Pravila |
|---|---|---|
| `atleti` | Glavni podatki o meritvah/karticah | (obstoječa, ni bila spremenjena v tem pogovoru) |
| `zapestnice` | koda → športnik (vsebuje e-mail) | `read, write: if jeAdmin()` — SAMO admin |
| `stanje/naslednji` | TV napoved "Na štartu: <ime>" `{ime, kljuc, cas}` | `read: true` (TV brez prijave), `write: if jeAdmin()` |

---

## 6. Popravljeni bugi (kronološko, z vzrokom — pomembno za prihodnost)

### 6.1 Prepisovanje tuje kartice (resen, data-loss bug)
**Vzrok:** `#atletId` (skrito polje) se je nastavilo SAMO ob urejanju
obstoječe kartice (`urediAtleta`) in počistilo SAMO po uspešnem shranjevanju.
Noben drug tok (skener, glavni gumb "Vnos" v meniju) ga ni počistil. Če je
admin uredil/odprl Ano, si premislil, nato skeniral Jako (novega, brez
kartice) — `#atletId` je OSTAL Anin. Shranjevanje je prepisalo Anino kartico
z Jakinimi podatki; Jaka nikoli ni dobil svoje.

**Popravek:** `window.pripraviNovVnos()` — počisti VSA polja obrazca
(vključno `#atletId`). Kliče se iz:
- `zapestnicaUporabi()` (skener) — pred izpolnjevanjem
- glavnega gumba "⚙️ Vnos" v meniju (`onclick="window.pripraviNovVnos();
  window.preklopiPogled('vnos')"`)

Urejanje obstoječe kartice (`urediAtleta`) ostaja nespremenjeno — tam mora
`atletId` ostati nastavljen.

### 6.2 Trdo vpisane demo vrednosti v HTML-ju
**Vzrok:** Polja v obrazcu za vnos (`ime`, `letorojstva`, `visina`, `teza`,
`hitrostVal`, `mocVal`, `eksplozivnostVal`, `agilnostVal`, `vzdrzljivostVal`)
so imela v `index.html` trdo vpisan atribut `value="..."` z demo podatki
("Jaka Grobelnik", 2008, 180, 80, 4.80, 950, 3000, 4.40, 11). Ni šlo za
predpomnjenje brskalnika — vsak sveži naloga strani je pokazal te podatke.
Tveganje: admin bi lahko v naglici pomotoma shranil izmišljenega športnika.

**Popravek:** `value="..."` → `placeholder="npr. ..."` (enak vzorec kot že
obstoječe polje za e-mail). Obrazec je zdaj resnično prazen. `preveriMeritve()`
(sanity-check pred shranjevanjem) prazno/0 vrednost NE šteje za napako —
namenoma dopušča delne meritve (npr. samo 3 od 5 kategorij).

**Znana, še NE popravljena podrobnost:** `teza` (telesna teža) ima tih
privzetek, če je puščena prazna — `shraniAtleta()` uporabi `|| "80"`,
`izracunajOcene()` pa `|| 70`. Dva RAZLIČNA privzetka na dveh mestih. Ne
vpliva na §6.1/§6.2 popravek, a če bo kdaj relativna moč/eksplozivnost
izgledala nenavadno, je to prvo mesto za pregled.

---

## 7. Nove funkcionalnosti (dodane v tem pogovoru)

### 7.1 TV zaslon "Na štartu" (tretja varianta cikla mirovanja)
Namesto prvotne ideje "Pripravi se: Jaka" (zavrnjeno — zvenelo je kot
navodilo osebi, ki je že na dogodku, ne kot napoved gledalcem) je
implementiran **cel tretji zaslon** v TV ciklu (poleg: citat+rekordi, kartica
iz baze):
- Sproži ga skener zapestnice (`zapestnicaUporabi`) ALI ročni admin gumb
  "📣 Napovej na štartu" v Vnosu (za primere brez zapestnice)
- Piše `{ime, kljuc, cas}` v `stanje/naslednji`; TV posluša prek `onSnapshot`
  (prvi/obstoječi snapshot ob zagonu TV se PRESKOČI, da ne prikaže "starega"
  imena ob vsakem odprtju zaslona)
- Napis se NAKLJUČNO menja med 5 variantami ("Na štartu", "Na vrsti", "Zdaj
  gre", "V akciji", "Na progi") — ne ponavlja vedno istega
- Podnapis: če športnik že obstaja v bazi → zadnji OVR ("Zadnji OVR **74**"),
  če ne → "Prva meritev"
- Ima PREDNOST pred citatom/kartico — prekine cikel, prikaže se 11s
  (`TV_START_MS`), nato nadaljuje cikel; skrije se TAKOJ, ko se prava kartica
  dvigne na oder (`tvSkrijNaStartu()` klican iz istega mesta kot
  `#tvOder.classList.add('viden')`)

### 7.2 Gumb "Sprosti vse kode"
Zapestnice se prej sprostile SAMO lenobno (ob naslednjem skeniranju ISTE
kode, če je bila starejša od 24h) — ne aktivno. Nov rdeč gumb v Vnosu
(admin-only) zbriše VSE zapise v `zapestnice` takoj, z potrditvenim dialogom.
Uporabno ob koncu dogodka za ponovno uporabo istih fizičnih zapestnic.

---

## 8. Design prenova (Claude Design → app.css) — STANJE: 1. korak končan

JG dela vizualno prenovo v Claude Design (ločeno orodje, ustvarja SAMO
izgled/mockup, NE delujočo kodo — lasten templating runtime `support.js`,
izmišljeni/statični podatki). Pristop: **"reskin", ne zamenjava** — vizualni
jezik (barve, fonti, senčenje) se prenaša v obstoječi `app.css`, HTML `id`-ji
in `onclick` vezave se NE dotikamo (nanje je vezana vsa funkcionalnost).

### Design tokeni iz mockupa (`G99_Performance_design_konzultacija.zip`)
- Ozadje: `#020306` (skoraj črno)
- Panel: `linear-gradient(160deg, rgba(255,255,255,.045), rgba(255,255,255,.012))`,
  rob `rgba(255,255,255,.08)`
- Fonta: Montserrat (naslovi/OVR, krepko/poševno) + Chakra Petch (nalepke,
  na široko razmaknjeno) — **oba sta bila že v uporabi** pred prenovo
  (dobra novica, arhitektura je bila že usklajena z designom)
- Rang barve (6 stopenj v designu; app ima 9 — dodatne so ostale kot so):
  Iron `#8794a6`, Bronze `#cd7f32`, Silver `#c7d0dc`, Gold `#f1c40f`,
  Platinum `#5ad1e0`, G99 `#7ee8fa`
- **Gender tema** (cyan/modra za fante, pink/lila za dekleta) — v designu
  prisotna, v app-u ŠE NE implementirana (glej spodaj, zavestno odloženo)

### Korak 1 — narejeno
- `:root` spremenljivke v `app.css` (`--g99-ozadje`, `--g99-plast-bg`,
  `--g99-plast-rob`, `--g99-tekst-*`, `--rang-*`)
- `body`, `.glavni-kontejner`, `.prijava-kontejner` → nov "glassy" videz
- **Poenoteni rang barve** med `app.js` (`getColorForOvr` — edini vir
  resnice) in `app.css` (`.rank-*` razredi) — bila sta PREJ rahlo
  neusklajena med sabo (npr. platinum: en `#00cec9`, drug drugje drugačen)
- Razširjen nabor tež pisave v Google Fonts uvozu (Montserrat 600/800,
  Chakra Petch 500)

**Opažanje uporabnika:** spremembe so komaj vidne — to je PRIČAKOVANO in
NAMERNO (konzervativen, "varen" prvi korak: samo osnovni toni, ne
dramatičen redesign). Preverjeno, da so datoteke pravilno posodobljene
(Cloudflare/browser cache je bil vzrok navidezne "brez sprememb" — rešeno s
hard-refresh / brisanjem cache-ja).

### Zavestno ODLOŽENO (ni pozabljeno, je odločitev, ne napaka)
1. **Gender tema (cyan/modra vs pink/lila)** — ni le barvni ton, je NOVA
   FUNKCIJA (kdaj se preklopi? glede na spol prikazanega športnika? glede
   na prijavljenega uporabnika? cela app ali samo kartica?). Zahteva
   odločitev pred implementacijo.
2. **Osnovna "brend" cyan barva** (`#00f2fe`/`#4facfe`) — uporabljena na
   DESETINAH mest po celi app (gumbi, CTA, logotip, compare mode, itd.),
   ločeno od rang-barv. Menjava bi bila širša odločitev o identiteti
   celotne app, ne osnovni token — NI spremenjena v koraku 1.

### Naslednji korak (2. korak — ŠE NI ZAČET)
**Kartica atleta** — glavni vizualni fokus designa: flip 3D efekt, "sheen"
svetlobna animacija čez kartico (5.5s loop), izpiljen pulsirajoč sij v barvi
ranga, dodelana hrbtna stran. To bo prva OPAZNA sprememba (korak 1 je bil
namenoma subtilen).

---

## 9. Pravila dela (konvencije, ki naj se nadaljujejo)

1. **Validacija pred vsako oddajo:** `node --check app.js`, preverjanje
   ravnovesja `<div>` v `index.html`, preverjanje `{`/`}` v `app.css`
2. **En vir resnice** — kadar obstaja ista vrednost na več mestih (npr.
   rang barve), poišči/ustvari EN centralni izvor in nanj veži vse ostalo,
   ne podvajaj trdo vpisanih vrednosti
3. **Komentarji v kodi v slovenščini**, razlagajo ZAKAJ (ne kaj) — posebej
   pri popravkih bugov, naj razlaga vzrok ostane v kodi za prihodnost
4. **Firestore pravila niso samodejno objavljena** — če se `PERFORMANCE_PRAVILA.md`
   spremeni, IZRECNO opozoriti JG na ročni korak (Firebase konzola → Rules →
   Publish), sicer nova funkcija tiho odpove (permission denied, ne crash)
5. **JG ni programer** — nikoli ne predlagaj terminalskih ukazov za tekoče
   delo; vedno vodi skozi VS Code Source Control gumbe (Stage/Commit/Sync)
6. **Design prenova gre po korakih**, ne vse naenkrat — vsak korak se
   potrdi/preizkusi, preden se širi na naslednji del app-a
7. Vsa vsebina v app-u (UI besedilo) je v slovenščini; obstaja `en`
   prevodni objekt zraven `sl` za vsak nov niz besedila — vedno dodaj OBA

---

## 10. Odprto / za prihodnje pogovore

- [ ] 2. korak design prenove: kartica atleta (flip, sheen, hrbtna stran)
- [ ] Odločitev o gender temi (cyan/modra vs pink/lila) — kdaj/kje se sproži
- [ ] Odločitev o osnovni brend barvi (menjava `#00f2fe`/`#4facfe`?)
- [ ] Morebitni popravek dvojnega privzetka za `teza` (80 vs 70) — ni nujno,
      a vredno pregledati
- [ ] Nadaljnji koraki prenove: Baza, Lestvica, Hall of Fame, Izzivi, Sobe
      zasloni (§8 govori le o osnovnih tonih, ne o vsakem zaslonu posebej)
