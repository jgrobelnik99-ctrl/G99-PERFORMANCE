# G99 Performance — Firestore pravila (z IZZIVI in ZASEBNIMI SOBAMI)

Kopiraj spodnja pravila v Firebase konzolo:
**Firestore Database → Rules → prilepi → Publish**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function jeAdmin() {
      return request.auth != null && request.auth.token.email == 'admin@g99.com';
    }
    function jePotrjen() {
      return request.auth != null && request.auth.token.email_verified == true;
    }
    // Anonimni kljuc prijavljenega uporabnika. Pravila e-naslova ne vidijo, zato ga
    // preberejo iz njegovega zasebnega zapisa v kolekciji "clanstvo".
    function mojKljuc() {
      return get(/databases/$(database)/documents/clanstvo/$(request.auth.uid)).data.kljuc;
    }
    function imamClanstvo() {
      return request.auth != null
             && exists(/databases/$(database)/documents/clanstvo/$(request.auth.uid));
    }

    // JAVNE KARTICE: bere vsak, pise samo admin.
    match /atleti/{doc} {
      allow read: if true;
      allow write: if jeAdmin();
    }

    // ZASEBNI PODATKI (e-naslov, mascoba, misicna masa): samo admin.
    match /zasebno/{doc} {
      allow read, write: if jeAdmin();
    }

    // SLIKE: javno branje. Pise admin ALI sportnik za SVOJO kartico.
    // Dokument slike ima isti id kot kartica v "atleti", zato lahko pravilo preveri,
    // ali anonimni kljuc te kartice ustreza kljucu prijavljenega uporabnika.
    // Brez tega preverjanja bi lahko kdorkoli zamenjal fotografijo tujemu sportniku.
    match /slike/{atletId} {
      allow read: if true;
      allow write: if jeAdmin()
                   || (jePotrjen() && imamClanstvo()
                       && exists(/databases/$(database)/documents/atleti/$(atletId))
                       && get(/databases/$(database)/documents/atleti/$(atletId)).data.atletKljuc == mojKljuc());
    }

    // IZZIVI: dvoboji med sportniki.
    match /izzivi/{doc} {
      allow read: if true;
      allow create: if jePotrjen()
                    && request.resource.data.keys().hasAll(['odKljuc','doKljuc','kategorija','ustvarjen'])
                    && request.resource.data.odKljuc is string
                    && request.resource.data.doKljuc is string
                    && request.resource.data.odKljuc != request.resource.data.doKljuc;
      allow delete: if jeAdmin() || request.auth != null;
      allow update: if false;
    }

    // ZAPESTNICE: koda -> sportnik. Vsebuje e-naslov, zato SAMO admin.
    // Zapestnica sama nosi le kodo; brez tega zapisa ne pomeni nicesar.
    match /zapestnice/{koda} {
      allow read, write: if jeAdmin();
    }

    // STANJE/NASLEDNJI: "Pripravi se: <ime>" na TV. Pise ga skener zapestnice (admin),
    // bere ga TV zaslon brez prijave - zato je branje javno, pisanje samo admin.
    match /stanje/{doc} {
      allow read: if true;
      allow write: if jeAdmin();
    }

    // POVEZAVA uid -> anonimni kljuc. Vsebuje SAMO kljuc, nikoli e-naslova.
    // Bere in pise ga lahko izkljucno lastnik racuna (in admin).
    match /clanstvo/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if jeAdmin();
    }

    // ZASEBNE SOBE (mikro-lestvice)
    match /sobe/{doc} {
      // Branje: vsak prijavljen. Sobe ni mogoce najti brez kode.
      allow read: if request.auth != null;

      // Ustvarjanje: potrjen uporabnik, sam sebe zapise kot edinega clana in lastnika.
      allow create: if jePotrjen() && imamClanstvo()
                    && request.resource.data.keys().hasAll(['koda','ime','lastnik','clani','ustvarjena'])
                    && request.resource.data.lastnik == mojKljuc()
                    && request.resource.data.clani == [mojKljuc()]
                    && request.resource.data.ime is string
                    && request.resource.data.ime.size() >= 2
                    && request.resource.data.ime.size() <= 40;

      // Spreminjanje: SAMO seznam clanov. Ime, koda, lastnik in datum so nespremenljivi.
      // Dovoljena sta natanko dva primera: vpisem SEBE ali izbrisem SEBE.
      allow update: if jePotrjen() && imamClanstvo()
                    && request.resource.data.koda == resource.data.koda
                    && request.resource.data.ime == resource.data.ime
                    && request.resource.data.lastnik == resource.data.lastnik
                    && request.resource.data.ustvarjena == resource.data.ustvarjena
                    && request.resource.data.clani.size() <= 20
                    && (
                      // VSTOP: seznam zraste za ena, novi element sem jaz
                      (request.resource.data.clani.size() == resource.data.clani.size() + 1
                       && request.resource.data.clani.hasAll(resource.data.clani)
                       && !(mojKljuc() in resource.data.clani)
                       && (mojKljuc() in request.resource.data.clani))
                      ||
                      // ODHOD: seznam se skrajsa za ena, manjkajoci element sem jaz
                      (request.resource.data.clani.size() == resource.data.clani.size() - 1
                       && resource.data.clani.hasAll(request.resource.data.clani)
                       && (mojKljuc() in resource.data.clani)
                       && !(mojKljuc() in request.resource.data.clani))
                    );

      // Brisanje: admin, ali lastnik TAKRAT, KO JE V SOBI SAM.
      // Tako nihce ne more nikomur unicit lestvice, lastnik pa lahko pospravi
      // svojo prazno ali pomotoma ustvarjeno sobo.
      allow delete: if jeAdmin()
                    || (jePotrjen() && imamClanstvo()
                        && resource.data.lastnik == mojKljuc()
                        && resource.data.clani.size() <= 1);
    }

    // Vse ostalo je zaprto.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Kaj je zascteno

| Napad | Zakaj ne deluje |
|---|---|
| Brisanje tuje sobe | Lastnik lahko brise samo, kadar je v sobi sam; drugi sploh ne |
| Odstranjevanje drugih clanov | Odhod je dovoljen samo, ce manjkajoci kljuc pripada tebi |
| Preimenovanje sobe ali menjava kode | Polja `ime`, `koda`, `lastnik`, `ustvarjena` so po nastanku nespremenljiva |
| Prenapolnitev sobe | `clani.size() <= 20` |
| Ponarejanje rezultatov | Lestvica in rekordi se racunajo sproti iz `atleti`, ki jo pise samo admin |
| Zamenjava tuje fotografije | Sportnik lahko pise samo sliko kartice, katere `atletKljuc` je njegov |
| Branje zapestnic | Kolekcija `zapestnice` je dostopna samo adminu, ker vsebuje e-naslove |

## Kolekcija `clanstvo`

Brez nje odhod iz sobe ne bi mogel biti varen. Pravila ne vidijo e-naslova, zato ne morejo
izracunati anonimnega kljuca in ne bi mogla lociti "brisem sebe" od "brisem tebe".

Zapis vsebuje **samo anonimni kljuc**, nobenega e-naslova. Bere in pise ga lahko izkljucno
lastnik racuna. Aplikacija ga ustvari sama ob prvem obisku zavihka Sobe.

## Potreben indeks

Firestore bo ob prvem iskanju sobe po kodi morda zahteval sestavljen indeks.
V konzoli brskalnika se izpise povezava - klikni jo in indeks se ustvari sam.

| Kolekcija | Polje | Nacin |
|---|---|---|
| `sobe` | `clani` | array-contains |
| `sobe` | `koda` | ascending |

## Ce objava pravil ne uspe

Pravila uporabljajo `get()` in `exists()` znotraj funkcij, kar je veljavno, a Firebase
konzola je pri sintaksi obcutljiva. Ce javi napako, poslji njeno besedilo - v njej pise
tocna vrstica.
