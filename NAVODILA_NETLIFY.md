# G99 — Test javnega profila na Netlify (brezplačna domena)

Ta mapa je pripravljena za nalaganje na Netlify. Dobiš JAVNI link, ki ga lahko daš
v Instagram bio — brez plačljive domene.

## Kaj je v mapi
- `index.html` — začetna stran (gumb za aplikacijo + primer profila)
- `G99_Performance.html` — glavna aplikacija (javni combine)
- `_redirects` — omogoči lep URL `/p/ime-priimek` (profil način v aplikaciji)

## Korak za korakom

### 1. Prijava na Netlify
Pojdi na https://app.netlify.com in se prijavi (ali registriraj, brezplačno).

### 2. Naloži mapo (drag & drop)
- Na Netlify dashboardu poišči polje **"Want to deploy a new site without connecting to Git?
  Drag and drop your site output folder here"** (običajno na dnu strani "Sites" ali "Add new site" → "Deploy manually").
- Povleci **celotno mapo `G99_NETLIFY_TEST`** v to polje.
- Netlify v nekaj sekundah objavi stran in ti da naslov, npr. `bright-cupcake-123.netlify.app`.

### 3. Preizkusi
Odpri naslov, ki si ga dobil:
- Začetna stran: `https://TVOJE-IME.netlify.app`
- Aplikacija: `https://TVOJE-IME.netlify.app/G99_Performance.html`
- Profil (primer): `https://TVOJE-IME.netlify.app/p/luka-ljubljana`

Zamenjaj `luka-ljubljana` z imenom kateregakoli športnika v bazi (presledke nadomesti z vezaji).

### 4. Za Instagram bio
Kopiraj link profila (npr. `https://TVOJE-IME.netlify.app/p/jaka-grobelnik`) in ga
prilepi v Instagram bio. Vsak, ki ga tapne, vidi kartico — brez prijave, takoj.

## Preimenovanje naslova (neobvezno, brezplačno)
Netlify ti da naključno ime. Lahko ga spremeniš v lepšega:
Netlify → Site settings → **Change site name** → npr. `g99-performance` →
naslov postane `g99-performance.netlify.app`.

## Ko boš imel plačljivo domeno g99.com
Netlify → Domain settings → **Add custom domain** → vpišeš g99.com in slediš navodilom.
Datoteka `_redirects` že poskrbi, da `g99.com/p/jaka` pokaže profil.

## Pomembno
- Firebase pravila morajo biti objavljena (javno branje `atleti`), da profil deluje za vse.
- Profil deluje samo za športnike, ki so v javni bazi `atleti`.
