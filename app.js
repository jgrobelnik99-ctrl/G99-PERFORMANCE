import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, doc, setDoc, query, where, documentId, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

    const fC = { apiKey: "AIzaSyDgI1smJUAQ6gq_6JXsBnPW6N7YOJJm8Us", authDomain: "g99-performance.firebaseapp.com", projectId: "g99-performance", storageBucket: "g99-performance.firebasestorage.app", messagingSenderId: "429668391851", appId: "1:429668391851:web:ccff51272394a8cb2690ee" };
    const app = initializeApp(fC); 
    const db = getFirestore(app); 
    const auth = getAuth(app); window.auth = auth;

    window.db = db; window.doc = doc; window.setDoc = setDoc; window.addDoc = addDoc; window.collection = collection; window.deleteDoc = deleteDoc; window.getDocs = getDocs; window.getDoc = getDoc; window.onSnapshot = onSnapshot; window.query = query; window.where = where; window.documentId = documentId;
    window.ADMIN_EMAIL = "admin@g99.com"; 
    // ⚠️ VARNOSTNO OPOZORILO: window.isAdm spodaj je SAMO frontend zastavica za skrivanje UI gumbov.
    // Kdorkoli odpre konzolo (F12) lahko ročno pokliče window.shraniAtleta(), window.brisiAtleta(),
    // window.uvoziCSV() itd. tudi če ni admin, ker so vse funkcije javno dostopne na window objektu.
    // To NI zaščiteno, razen če imaš v Firebase Console -> Firestore -> Rules nastavljeno:
    //   match /atleti/{id} {
    //     allow read: if true; // ali samo prijavljeni: request.auth != null
    //     allow write: if request.auth != null && request.auth.token.email == "admin@g99.com";
    //   }
    // Brez tega lahko vsak prijavljen (ali celo neprijavljen, če so pravila "allow read, write: if true")
    // uporabnik briše/piše celotno bazo športnikov mimo UI.

    window.gSlika = ""; window.aBaza = []; window.tZgodovina = []; window.mInd = 0; window.mZgodovina = []; window.modInd = 0;
    window.dMode = false; window.dIzbrani = [];
    window.isAdm = false; window.tEmail = ""; window.cMode = false; window.cIzbrani = []; window.tJezik = 'sl'; window.pRadar = null; window.radarGraf = null; window.radarGrafVnos = null; window.compareChart = null; window.ratingMode = 'GLOBAL';

    // ==========================================================================
    // KONFIGURACIJSKA TABELA TESTOV  ← EDINO MESTO ZA SPREMEMBO TESTOV
    // ==========================================================================
    // Če boš kdaj zamenjal test (npr. beep test → Yo-Yo, 40 yardov → 30 m sprint),
    // spremeni SAMO vrstico tukaj + pripadajoče meje v window.normativi spodaj.
    // Vse ostalo (kartica, radar, poročilo, CSV, značke, lestvica) se prilagodi samo.
    //
    // Pomen polj:
    //   kljuc         - ime polja v bazi IN v normativih (NE spreminjaj brez migracije podatkov!)
    //   vnosId        - id vnosnega polja v obrazcu
    //   labelKljuc    - ključ prevoda za kratko ime (ttHit, ttMoc, ...)
    //   labelVnosa    - ključ prevoda za oznako nad vnosnim poljem (inHit, ...)
    //   enota         - enota, ki se izpiše ob vrednosti
    //   nizjeJeBolje  - true pri časih (manj = bolje), false pri sili/stopnjah
    //   deliSTezo     - true, če se meritev pred oceno deli s telesno težo (relativna moč)
    //   decimalke     - koliko decimalk pri prikazu surove vrednosti
    //   ikona, barva  - videz na kartici in v grafih
    window.TESTI = [
        { kljuc: 'hitrost',       vnosId: 'hitrostVal',       labelKljuc: 'ttHit', labelVnosa: 'inHit', enota: 's',   nizjeJeBolje: true,  deliSTezo: false, decimalke: 2, ikona: 'fa-bolt',        barva: '#f1c40f' },
        { kljuc: 'moc',           vnosId: 'mocVal',           labelKljuc: 'ttMoc', labelVnosa: 'inMoc', enota: 'N',   nizjeJeBolje: false, deliSTezo: true,  decimalke: 0, ikona: 'fa-dumbbell',    barva: '#ff7675' },
        { kljuc: 'vzdrzljivost',  vnosId: 'vzdrzljivostVal',  labelKljuc: 'ttVzd', labelVnosa: 'inVzd', enota: 'lvl', nizjeJeBolje: false, deliSTezo: false, decimalke: 1, ikona: 'fa-heart-pulse', barva: '#a29bfe' },
        { kljuc: 'eksplozivnost', vnosId: 'eksplozivnostVal', labelKljuc: 'ttEks', labelVnosa: 'inEks', enota: 'N',   nizjeJeBolje: false, deliSTezo: true,  decimalke: 0, ikona: 'fa-gauge-high',  barva: '#fdcb6e' },
        { kljuc: 'agilnost',      vnosId: 'agilnostVal',      labelKljuc: 'ttAgi', labelVnosa: 'inAgi', enota: 's',   nizjeJeBolje: true,  deliSTezo: false, decimalke: 2, ikona: 'fa-wave-square', barva: '#00cec9' }
    ];

    // Lestvica generacij od najmlajše do najstarejše. Uporablja jo starostni preskok.
    window.GEN_LESTEV = ['U15', 'U17', 'U19', 'PRO'];

    // OVR, KI BI GA ŠPORTNIK IMEL, ČE BI GA MERILI PO NORMATIVIH DRUGE GENERACIJE.
    // Namenoma bere iz window.normativi in NE iz getLimits: trditev "na ravni U19" mora
    // biti absolutna, ne odvisna od tega, kdo je slučajno v tvoji bazi (lokalni način).
    window.ovrProtiGeneraciji = function(a, gen) {
        let spol = a.spol || 'M';
        let d = (window.normativi[spol] && window.normativi[spol][gen]) ? window.normativi[spol][gen] : null;
        if(!d) return null;
        let teza = parseFloat(a.teza) || 70;
        let vsota = 0;
        for(let t of window.TESTI) {
            let raw = parseFloat(a[t.kljuc]) || 0;
            if(raw <= 0) return null;   // brez vseh petih meritev primerjava ni poštena
            let vhod = t.deliSTezo ? (raw / teza) : raw;
            vsota += window.preračunaj(vhod, d[t.kljuc], t.nizjeJeBolje);
        }
        return Math.round(vsota / window.TESTI.length);
    };

    // Prag: 80 = DIAMOND. Torej "tudi med generacijo nad sabo bi bil še vedno elita".
    window.STAROST_PRAG = 80;

    // Vrne { visja, ovr } ali null. PRO nima generacije nad sabo, zato zanj znaka ni.
    window.starostniPreskok = function(a) {
        if(!a) return null;
        let i = window.GEN_LESTEV.indexOf(a.generacija || 'U17');
        if(i < 0 || i >= window.GEN_LESTEV.length - 1) return null;
        let visja = window.GEN_LESTEV[i + 1];
        let o = window.ovrProtiGeneraciji(a, visja);
        if(o === null || o < window.STAROST_PRAG) return null;
        return { visja: visja, ovr: o };
    };

    // HTML znaka. mini = manjša različica za kartice v Bazi in Lestvici.
    window.starostniZnakHTML = function(a, mini) {
        let p = window.starostniPreskok(a);
        if(!p) return '';
        let lng = window.prevodi[window.tJezik] || {};
        // Uporabi ISTI sistem namigov kot ocene in značke (data-namig-*), ne navadnega
        // title - ta se na dotik sploh ne prikaže in izgleda tuje.
        let opis = (lng.starostNamig || '').replace(/\{g\}/g, p.visja);
        let vred = (lng.starostVrednost || '').replace('{o}', p.ovr).replace('{g}', p.visja);
        return `<div class="starost-znak${mini ? ' starost-znak-mini' : ''}"` +
               ` data-namig-ime="${window.escapeHtml(lng.starostIme || '')}"` +
               ` data-namig-vrednost="${window.escapeHtml(vred)}"` +
               ` data-namig-opis="${window.escapeHtml(opis)}"` +
               ` data-namig-ikona="⭐" data-namig-barva="#2ecc71">` +
               `<i class="fa-solid fa-star"></i><span>${p.visja}</span></div>`;
    };

    // Osrednji izračun ocen iz zapisa športnika - EDINA pot do ocen in OVR.
    // Vse (kartica, baza, lestvica, poročilo, značke, primerjava) naj kliče to funkcijo,
    // da se ocene nikjer ne morejo razhajati.
    window.izracunajOcene = function(a) {
        let spol = a.spol || 'M';
        let gen = a.generacija || 'U17';
        let lim = window.getLimits(spol, gen);
        let teza = parseFloat(a.teza) || 70;

        let ocene = {};   // { hitrost: 91, moc: 87, ... }
        let surove = {};  // { hitrost: 4.60, ... }
        let seznam = [];  // urejeno po TESTI, za izris

        window.TESTI.forEach(t => {
            let raw = parseFloat(a[t.kljuc]) || 0;
            let vhod = t.deliSTezo ? (raw / teza) : raw;
            let ocena = window.preračunaj(vhod, lim[t.kljuc], t.nizjeJeBolje);
            ocene[t.kljuc] = ocena;
            surove[t.kljuc] = raw;
            seznam.push({ ...t, raw, ocena });
        });

        let ovr = Math.round(window.TESTI.reduce((v, t) => v + ocene[t.kljuc], 0) / window.TESTI.length);
        return { ocene, surove, seznam, ovr, teza, spol, gen };
    };

    // Kratka pot do polja ocen v vrstnem redu TESTI (za radar in ikone na kartici)
    window.oceneVVrsti = function(a) { return window.izracunajOcene(a).seznam.map(x => x.ocena); };

    // Imena in razlage okvirjev (ločeno od ostalih prevodov zaradi preglednosti).
    // {o}=OVR, {d}=razlika, {n}=število, {g}=generacija, {t}=test
    window.prevodiOkvirjev = {
        sl: {
            vFormi: "V formi",            vFormiOpis: "Največji napredek v bazi (+{d} OVR od zadnje sezone)",
            preporod: "Preporod",         preporodOpis: "Po upadu spet nad prejšnjim vrhom ({v} → {o} OVR)",
            popolnaSez: "Popolna sezona", popolnaSezOpis: "Vseh 5 ocen zraslo hkrati glede na prejšnjo sezono",
            preboj: "Preboj",             prebojOpis: "+{d} OVR od prejšnje sezone",
            zagon: "Zagon",               zagonOpis: "OVR raste dve sezoni zapored ({d1}, {d2})",
            konstanta: "Konstanta",       konstantaOpis: "{n} sezon brez enega samega upada OVR",
            preobrazba: "Preobrazba",     preobrazbaOpis: "FFMI zrasel za {d} - pridobivanje kakovostne mase",
            ravnovesje: "Ravnovesje",     ravnovesjeOpis: "Razlika med najmočnejšo in najšibkejšo oceno se je zmanjšala za {d} (zdaj {r})",
            veteran: "Veteran",           veteranOpis: "{n} sezone v sistemu",
            novinec: "Novinec",           novinecOpis: "Prva sezona in že OVR {o}",
            vFormiPogoj: "Največji napredek OVR v bazi med zadnjima sezonama (vsaj +3).",
            preporodPogoj: "OVR je enkrat upadel, nato pa presegel prejšnji vrh.",
            popolnaSezPogoj: "Vseh pet ocen zraslo glede na prejšnjo sezono - ne le OVR.",
            prebojPogoj: "OVR zrasel za 5 ali več od prejšnje sezone.",
            zagonPogoj: "OVR raste dve sezoni zapored.",
            konstantaPogoj: "Tri sezone ali več brez enega samega upada OVR.",
            preobrazbaPogoj: "FFMI zrasel za vsaj 1.0 - torej pridobivanje kakovostne (puste) mase, ne izgubljanje maščobe.",
            ravnovesjePogoj: "Razlika med najmočnejšo in najšibkejšo oceno se je zmanjšala za vsaj 10 - delo na šibki točki.",
            veteranPogoj: "Prisoten v sistemu štiri sezone ali več.",
            novinecPogoj: "Prva sezona in že OVR 75 ali več.",
            naslovLegenda: "Znaki časti",
            legendaUvod: "Značke povedo, KDO SI (ena sezona). Znaki časti povedo, KAKO SE PREMIKAŠ (skozi sezone). Kartica prikaže največ EN znak - tistega z najvišjo prioriteto."
        },
        en: {
            vFormi: "In Form",            vFormiOpis: "Biggest improvement in the database (+{d} OVR since last season)",
            preporod: "Resurgence",       preporodOpis: "Back above the previous peak after a decline ({v} → {o} OVR)",
            popolnaSez: "Perfect Season", popolnaSezOpis: "All 5 scores improved at once versus last season",
            preboj: "Breakthrough",       prebojOpis: "+{d} OVR since last season",
            zagon: "Momentum",            zagonOpis: "OVR rising two seasons in a row ({d1}, {d2})",
            konstanta: "Constant",        konstantaOpis: "{n} seasons without a single OVR drop",
            preobrazba: "Transformation", preobrazbaOpis: "FFMI up by {d} - building quality mass",
            ravnovesje: "Balance",        ravnovesjeOpis: "Gap between strongest and weakest score narrowed by {d} (now {r})",
            veteran: "Veteran",           veteranOpis: "{n} seasons in the system",
            novinec: "Rookie",            novinecOpis: "First season and already OVR {o}",
            vFormiPogoj: "Biggest OVR improvement in the database between the last two seasons (at least +3).",
            preporodPogoj: "OVR declined once, then climbed back above the previous peak.",
            popolnaSezPogoj: "All five scores improved versus the previous season - not just OVR.",
            prebojPogoj: "OVR up by 5 or more since the previous season.",
            zagonPogoj: "OVR rising two seasons in a row.",
            konstantaPogoj: "Three or more seasons without a single OVR drop.",
            preobrazbaPogoj: "FFMI up by at least 1.0 - i.e. building quality (lean) mass, not losing fat.",
            ravnovesjePogoj: "Gap between strongest and weakest score narrowed by at least 10 - work on the weak spot.",
            veteranPogoj: "Four or more seasons in the system.",
            novinecPogoj: "First season and already OVR 75 or higher.",
            naslovLegenda: "Marks of Honour",
            legendaUvod: "Badges tell you WHO YOU ARE (one season). Marks of honour tell you HOW YOU ARE MOVING (across seasons). A card shows at most ONE mark - the highest-priority one."
        }
    };

    window.normativi = {
        M: { U15: { hitrost: { min: 6.20, max: 4.80 }, moc: { min: 3.0, max: 10.0 }, eksplozivnost: { min: 12.0, max: 32.0 }, agilnost: { min: 5.50, max: 4.30 }, vzdrzljivost: { min: 4, max: 12 } }, U17: { hitrost: { min: 5.80, max: 4.50 }, moc: { min: 4.0, max: 12.0 }, eksplozivnost: { min: 15.0, max: 38.0 }, agilnost: { min: 5.20, max: 4.10 }, vzdrzljivost: { min: 5, max: 14 } }, U19: { hitrost: { min: 5.50, max: 4.35 }, moc: { min: 5.0, max: 14.0 }, eksplozivnost: { min: 18.0, max: 45.0 }, agilnost: { min: 4.90, max: 3.95 }, vzdrzljivost: { min: 6, max: 15 } }, PRO: { hitrost: { min: 5.30, max: 4.22 }, moc: { min: 6.0, max: 16.0 }, eksplozivnost: { min: 20.0, max: 50.0 }, agilnost: { min: 4.70, max: 3.80 }, vzdrzljivost: { min: 7, max: 17 } } },
        Z: { U15: { hitrost: { min: 6.80, max: 5.20 }, moc: { min: 2.0, max: 7.0 }, eksplozivnost: { min: 10.0, max: 26.0 }, agilnost: { min: 6.00, max: 4.60 }, vzdrzljivost: { min: 3, max: 10 } }, U17: { hitrost: { min: 6.40, max: 4.90 }, moc: { min: 2.5, max: 8.5 }, eksplozivnost: { min: 12.0, max: 30.0 }, agilnost: { min: 5.70, max: 4.40 }, vzdrzljivost: { min: 4, max: 11 } }, U19: { hitrost: { min: 6.00, max: 4.75 }, moc: { min: 3.0, max: 10.0 }, eksplozivnost: { min: 14.0, max: 35.0 }, agilnost: { min: 5.40, max: 4.25 }, vzdrzljivost: { min: 5, max: 12 } }, PRO: { hitrost: { min: 5.80, max: 4.60 }, moc: { min: 4.0, max: 11.5 }, eksplozivnost: { min: 16.0, max: 40.0 }, agilnost: { min: 5.10, max: 4.10 }, vzdrzljivost: { min: 5, max: 14 } } }
    };

    window.prevodi = {
        sl: { ratingGlobal: "GLOBALNO", ratingLocal: "LOKALNO", btnVnos: "Vnos", btnKartica: "Moja Kartica", btnBaza: "Baza", btnLestvica: "Lestvica", btnSlava: "Hall of Fame", btnIzzivi: "Izzivi", btnIG: "Deli na IG Story", labelIme: "Ime Atleta", labelTeza: "Teža (kg)", labelVisina: "Višina (cm)", labelSpol: "Spol", labelGen: "Gen", labelStarost: "Leto rojstva", inHit: "Hitrost (s)", inMoc: "Moč (N)", inEks: "Eksplozivnost (N)", inAgi: "Agilnost (s)", inVzd: "Vzdržljivost (Beep)", leta: "LET", cm: "cm", kg: "kg", gumbSliko: "Dodaj Sliko", gumbPrenos: "Prenesi Kartico", btnIzvozi: "Izvozi (CSV)", gumbBaza: "V Bazo", rNames: ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "PRIME", "ELITE", "G99 TIER"], grafLabele: ['Hitrost', 'Moč', 'Vzdržljivost', 'Eksplozivnost', 'Agilnost'], modalTitle: "Normativi", thTest: "Test", thMin: "Min", thAvg: "Avg", thMax: "Max", ttHit: "Hitrost", ttMoc: "Moč", ttVzd: "Vzdržljivost", ttEks: "Eksplozivnost", ttAgi: "Agilnost", bazaPrazna: "Baza je prazna.", btnUredi: "Uredi", btnBrisi: "Izbriši", optVsiSpol: "Vsi Spoli", optVsiGen: "Vse Generacije", optOvrDesc: "OVR Najvišji", optOvrAsc: "OVR Najnižji", isci: "Išči po imenu...", potrdiIzbris: "Zares izbrišem športnika?", shranjeno: "Shranjeno v Bazo!", neznan: "KARTICA ŠE NI USTVARJENA", odjava: "Odjava", lblEmail: "E-pošta", lblGeslo: "Geslo", btnLogin: "Prijava", btnReg: "Registracija", napakaPrijava: "Napačen email ali geslo!", lblVnosEmail: "Email športnika", btnPoglej: "Poglej", dosezeneZnacke: "Dosežki (PlayStyles)", addPhoto: "+ DODAJ SLIKO", optFilterM: "Moški", optFilterZ: "Ženske", optSpolM: "M", optSpolZ: "Ž", compToggleOn: "Vklopi Primerjavo", compToggleOff: "Prekliči Primerjavo", compSelectMore: "Izberi še", compRun: "Poženi Primerjavo", compMax: "Izbereš lahko največ 2 igralca!", compModalTitle: "PRIMERJAVA ŠPORTNIKOV", topOVR: "Najvišji OVR", topHit: "Najhitrejši (s)", topMoc: "Najmočnejši (N)", topVzd: "Vzdržljivost", topEks: "Eksplozivnost (N)", topAgi: "Agilnost (s)", btnPrikazNormativi: "Normativi", btnPrikazZnacke: "Legenda Značk", naslovVseZnacke: "VSE ZNAČKE (PLAYSTYLES)", lblSezona: "Sezona", vseSezone: "Vse Sezone (Najnovejše)", sez1: "Sezona 1", sez2: "Sezona 2", sez3: "Sezona 3", sez4: "Sezona 4", sez5: "Sezona 5", tabKar: "KARTICA", tabAna: "ANALITIKA & ZNAČKE", btnZapri: "✖ ZAPRI / CLOSE", potrdiMail: "Najprej potrdite svoj email (preverite nabiralnik)!", regUspesna: "Registracija uspešna! Preverite email in kliknite na povezavo za potrditev.", regNapaka: "Napaka (email morda že obstaja ali geslo ni vsaj 6 znakov).", errGesliMismatch: "Gesli se ne ujemata!", naslovRegModal: "Ustvari račun", lblRegPotrdi: "Potrdi geslo", btnRegPotrdi: "Registriraj se",
        porociloNaslov: "Uradno Scouting Poročilo", porociloPercentili: "Analiza Percentilov", porociloNapredek: "Napredek Skozi Sezone", porociloAiNaslov: "Strokovna Analiza", porociloLegGen: "= znotraj generacije", porociloLegGlob: "bela črtica = globalno (celotna baza)", porociloFooter: "Avtomatsko generirano poročilo · G99 Performance Analytics", btnGenerirajPorocilo: "Ustvari Poročilo", btnPrenesiPorocilo: "Prenesi Poročilo (PNG)", porociloNiPodatkov: "Ni podatkov o športniku za ustvarjanje poročila.", porociloStatistike: "Ključne Statistike", porociloPredogled: "Predogled Poročila", porociloProfil: "Profil Sposobnosti", delToggleOn: "Način Brisanja", delToggleOff: "Prekliči Brisanje", delRun: "Izbriši Izbrane", delPotrdi: "Ali res želiš izbrisati {n} športnikov? Tega dejanja ni mogoče razveljaviti.", btnMetodologija: "Kako se računa OVR?", opozoriloGlobalnaRazvrstitev: "🌍 Prikazane so vse generacije skupaj, zato je razvrstitev po OVR prikazana GLOBALNO (LOCAL ni primerljiv med generacijami).", opombaPreklopnikOnemogocen: "🔒 Preklop ni na voljo - prikazane so vse generacije skupaj, zato velja skupno (GLOBAL) merilo.", porociloZanimivosti: "Zanimivosti", inFormOznaka: "V formi", novRang: "Nov rang", mkPregled: "Pregled", mkAnalitika: "Analitika", mkDosezki: "Dosežki", izrezNaslov: "Prilagodi sliko", izrezPodnaslov: "Povleci sliko in nastavi približek, da bo lepo v okvirju kartice.", izrezPreklici: "Prekliči", izrezPotrdi: "✓ Uporabi sliko", ruNaslov: "Napredovanje", klikniZaObrat: "Klikni za obrat", serija: "Serija", lblSekcijaSestava: "🧬 Telesna sestava (neobvezno)", lblInMascoba: "Maščoba (%)", lblInMisicna: "Mišična masa (kg)", porociloLegendaEnostavna: "Barvni del črte prikazuje, kolikšen delež vrstnikov iz iste generacije je športnik prehitel. Bela navpična črtica označuje isto primerjavo s celotno bazo (vse generacije).",
        // --- HALL OF FAME ---
        slavaPodnaslov: "Rekorderji vseh časov", slavaPrazno: "Ni še nobene meritve.",
        slavaKraljOznaka: "Najvišji OVR vseh časov", slavaPoglej: "Poglej kartico",
        slavaNoga: "Rekordi iz {n} meritev · G99 Combine",
        rekHitrost: "Najhitrejši", rekMoc: "Najmočnejši", rekEksploz: "Najeksplozivnejši",
        rekAgilnost: "Najagilnejši", rekVzdrzljivost: "Najvzdržljivejši",
        // --- IZZIVI ---
        izzNaslov: "IZZIVI", izzPodnaslov: "Dvoboji pred dogodkom",
        izzOpozorilo: "Za ustvarjanje izziva se prijavi z e-naslovom, s katerim si bil izmerjen.",
        izzUstvariNaslov: "Izzovi kolega", izzNiDrugih: "Ni drugih športnikov", izzPoslji: "Pošlji izziv",
        izzNamig: "Izziv posname trenutni vrednosti obeh. Po naslednji meritvi se razsodi samodejno.",
        izzPrazno: "Ni še izzivov. Izzovi kolega in dvoboj se bo razsodil po naslednji meritvi.",
        izzSkupniOvr: "Skupni OVR", izzIzhodisce: "izhodišče", izzCaka: "čaka na novo meritev",
        izzIzenaceno: "izenačeno", izzVodi: "vodi", izzBrisiNamig: "Izbriši izziv", izzTi: "ti",
        izzNeodloceno: "Neodločeno", izzZmagovalec: "Zmagovalec dvoboja", izzKategorije: "kategorije",
        izzNapPrijava: "Za izziv se moraš prijaviti.", izzNapDrugega: "Izbrati moraš drugega športnika.",
        izzNapJaz: "Nimaš še svoje meritve - izziv ni mogoč.", izzNapOn: "Izbrani športnik nima meritve.",
        izzNapUstvari: "Izziva ni bilo mogoče ustvariti. Preveri, ali si prijavljen.",
        izzPotrdiBrisanje: "Res želiš izbrisati ta izziv?", izzNapBrisanje: "Brisanje ni uspelo.",
        // --- JAVNI PROFIL ---
        profBazaPrazna: "Baza je prazna.", profNiNajden: "Profil ni najden.",
        profNapaka: "Napaka pri nalaganju profila.", profOdpriApp: "ODPRI APP",
        profSlogan: "Izmeri se. Dobi svojo kartico.", profCtaRacun: "USTVARI SVOJ RAČUN",
        profCtaLestvica: "Poglej lestvico vseh", profOpomba: "Kartica je nastala na G99 Combine meritvah.",
        profOdpri: "Odpri G99 Performance",
        // --- UVOZ CSV / SLIKA ---
        csvPrazen: "CSV je prazen ali brez podatkov.", csvUvazam: "⏳ Uvažam...",
        csvUvozeno: "Uvoženih / posodobljenih športnikov: ", csvNapake: "Napake: ",
        csvNeprepoznani: "Neprepoznani stolpci (preskočeni): ",
        slikaShranjeno: "✅ SHRANJENO!", slikaShrani: "💾 Shrani Mojo Sliko v Bazo",
        javniCombine: "Javni Combine", namigDotik: "Dotakni se kartice za obrat",
        qrNamig: "Skeniraj za celoten profil",
        tvCakanje: "Čakam na naslednji rezultat", tvZazeni: "Zaženi zaslon",
        tvNamig: "Zvok in celozaslonski način se vklopita ob zagonu",
        tvStOznake: ["Na štartu", "Na vrsti", "Zdaj gre", "V akciji", "Na progi"],
        tvStPrvic: "Prva meritev", tvStZadnji: "Zadnji OVR",
        tvNovRekord: "Nov rekord", tvRekordOvr: "Najvišji OVR",
        tvNapaka: "Povezave z bazo ni bilo mogoče vzpostaviti",
        tvPodlogo: "Uradne meritve", tvStatMeritev: "Meritev v bazi", tvStatVodi: "Vodi",
        tvMeritveNaslov: "Izmerjeno na dogodku", tvIzBaze: "Iz baze", tvRekordiNaslov: "Absolutni rekordi baze · ★ postavljen danes",
        sezonaBeseda: "Sezona",
        btnSkener: "Skeniraj zapestnico", skenerNaslov: "Skeniraj zapestnico",
        skenerPodnaslov: "Kodo drži v okvirju", skenerZapri: "Zapri", skenerPovezi: "Poveži",
        skenerIscem: "Iščem kodo ...", skenerNiPovezana: "Ta koda še ni povezana s športnikom.",
        skenerManjka: "Vpiši e-naslov in ime.", skenerNapaka: "Napaka pri branju iz baze.",
        skenerNiKamere: "Do kamere ni dostopa. Preveri dovoljenje v brskalniku.",
        skenerNiKnjiznice: "Bralnik QR se ni naložil. Preveri povezavo.",
        skenerNalozen: "Naložen športnik:", skenerNalagam: "nalagam ...",
        skenerDrugi: "Poveži z drugim", skenerVpisiNovega: "Vpiši novega športnika za to kodo.",
        skenerPotekla: "Povezava je potekla. Koda je spet prosta.",
        btnTiskKod: "Natisni kode za zapestnice", btnNaStartu: "Napovej na štartu",
        tiskKoliko: "Koliko kod naj pripravim?", tiskOd: "Od katere številke naprej?",
        tiskBlokirano: "Brskalnik je blokiral novo okno. Dovoli pojavna okna in poskusi znova.",
        tiskPrenesi: "Prenesi vse kot sliko", tiskNatisni: "Natisni",
        vnosSumljivo: "Te vrednosti izstopajo iz pričakovanega razpona:",
        vnosPricakovano: "pričakovano", vnosVseeno: "Res shranim tako?",
        gumbSobe: "Sobe", sobeNaslov: "ZASEBNE SOBE", sobePodnaslov: "Lestvica samo za tvojo ekipo",
        sobePrazno: "Nisi še v nobeni sobi. Ustvari svojo ali vstopi s kodo.",
        sobaImeNamig: "Ime sobe", sobaUstvari: "Ustvari sobo", sobaPridruzi: "Vstopi",
        sobaClanov: "članov", sobaKopiraj: "Kopiraj kodo", sobaKopirano: "Koda kopirana:",
        sobaOdidi: "Zapusti sobo", sobaRekordi: "Rekordi sobe", sobaBrisi: "Izbriši sobo",
        sobaPotrdiBrisanje: "Soba bo trajno izbrisana. Nadaljujem?",
        sobaNapBrisi: "Sobo lahko izbriše lastnik, in samo kadar je v njej sam.",
        sobaNapBrisanje: "Brisanje ni uspelo.",
        sobaBrezMeritev: "Nihče od članov še nima meritve.",
        sobaCakaMeritev: "čaka na meritev", sobaJaz: "Ti", sobaNeznan: "Član sobe",
        sobaPotrdiOdhod: "Res želiš zapustiti to sobo?",
        sobaNapPrijava: "Za sobe se prijavi z e-naslovom, s katerim si bil izmerjen.",
        sobaNapIme: "Ime sobe mora imeti vsaj dva znaka.",
        sobaNapUstvari: "Sobe ni bilo mogoče ustvariti.",
        sobaNapNiKode: "Sobe s to kodo ni.", sobaNapPolna: "Soba je polna.",
        sobaNapPridruzi: "Vstop ni uspel.", sobaNapOdhod: "Odhod ni uspel.",
        btnTvZaslon: "Odpri TV zaslon za dogodek",
        starostIme: "Starostni preskok",
        starostVrednost: "OVR {o} po normativih {g}",
        starostNamig: "Rezultati bi tudi med generacijo {g} zdržali med najboljšimi. Znak dobiš, če je tvoj OVR, preračunan po normativih generacije nad tabo, vsaj 80.",
        legStarostNaslov: "Starostni preskok",
        legStarostUvod: "Ta znak ni odvisen od baze - normativi so fiksni, zato ga ni mogoče dobiti ali izgubiti zaradi tega, kdo je vpisan v bazo.",
        legStarostPogoj: "Meritve se preračunajo po normativih generacije NAD tabo (U15→U17, U17→U19, U19→PRO). Če je tako izračunan OVR vsaj 80, dobiš zeleno zvezdo z oznako te generacije. Potrebnih je vseh pet meritev. Generacija PRO znaka nima, ker nad njo ni ničesar." },
        en: { ratingGlobal: "GLOBAL", ratingLocal: "LOCAL", btnVnos: "Input", btnKartica: "My Card", btnBaza: "Database", btnLestvica: "Leaderboard", btnIzzivi: "Challenges", btnSlava: "Hall of Fame", btnIG: "Share to IG Story", labelIme: "Athlete Name", labelTeza: "Weight (kg)", labelVisina: "Height (cm)", labelSpol: "Gender", labelGen: "Gen", labelStarost: "Birth Year", inHit: "Speed (s)", inMoc: "Power (N)", inEks: "Explosiveness (N)", inAgi: "Agility (s)", inVzd: "Endurance (Beep)", leta: "YRS", cm: "cm", kg: "kg", gumbSliko: "Add Image", gumbPrenos: "Download Card", btnIzvozi: "Export (CSV)", gumbBaza: "To DB", rNames: ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "PRIME", "ELITE", "G99 TIER"], grafLabele: ['Speed', 'Power', 'Endurance', 'Explosiveness', 'Agility'], modalTitle: "Standards", thTest: "Test", thMin: "Min", thAvg: "Avg", thMax: "Max", ttHit: "Speed", ttMoc: "Power", ttVzd: "Endurance", ttEks: "Explosiveness", ttAgi: "Agility", bazaPrazna: "Database is empty.", btnUredi: "Edit", btnBrisi: "Delete", optVsiSpol: "All Genders", optVsiGen: "All Generations", optOvrDesc: "OVR Highest", optOvrAsc: "OVR Lowest", isci: "Search by name...", potrdiIzbris: "Delete athlete?", shranjeno: "Saved to DB!", neznan: "CARD NOT CREATED", odjava: "Logout", lblEmail: "Email", lblGeslo: "Password", btnLogin: "Login", btnReg: "Register", napakaPrijava: "Invalid email/password!", lblVnosEmail: "Athlete Email", btnPoglej: "View", dosezeneZnacke: "Earned Badges", addPhoto: "+ ADD PHOTO", optFilterM: "Male", optFilterZ: "Female", optSpolM: "M", optSpolZ: "F", compToggleOn: "Compare Mode", compToggleOff: "Cancel Compare", compSelectMore: "Select", compRun: "Run Compare", compMax: "Max 2 players!", compModalTitle: "PLAYER COMPARISON", topOVR: "Top OVR", topHit: "Fastest (s)", topMoc: "Strongest (N)", topVzd: "Endurance (Beep)", topEks: "Explosiveness (N)", topAgi: "Agility (s)", btnPrikazNormativi: "Standards", btnPrikazZnacke: "Badges Glossary", naslovVseZnacke: "ALL BADGES", lblSezona: "Season", vseSezone: "All Seasons (Latest)", sez1: "Season 1", sez2: "Season 2", sez3: "Season 3", sez4: "Season 4", sez5: "Season 5", tabKar: "CARD", tabAna: "ANALYTICS & BADGES", btnZapri: "✖ ZAPRI / CLOSE", potrdiMail: "Please verify your email first (check inbox)!", regUspesna: "Registration successful! Verification link sent to your email.", regNapaka: "Error (email might exist or password under 6 chars).", errGesliMismatch: "Passwords do not match!", naslovRegModal: "Create new account", lblRegPotrdi: "Confirm Password", btnRegPotrdi: "Sign Up",
        porociloNaslov: "Official Scouting Report", porociloPercentili: "Percentile Analysis", porociloNapredek: "Progress Across Seasons", porociloAiNaslov: "Professional Analysis", porociloLegGen: "= within generation", porociloLegGlob: "white tick = global (entire database)", porociloFooter: "Automatically generated report · G99 Performance Analytics", btnGenerirajPorocilo: "Generate Report", btnPrenesiPorocilo: "Download Report (PNG)", porociloNiPodatkov: "No athlete data available to generate a report.", porociloStatistike: "Key Statistics", porociloPredogled: "Report Preview", porociloProfil: "Ability Profile", delToggleOn: "Delete Mode", delToggleOff: "Cancel Delete", delRun: "Delete Selected", delPotrdi: "Are you sure you want to delete {n} athletes? This action cannot be undone.", btnMetodologija: "How is OVR calculated?", opozoriloGlobalnaRazvrstitev: "🌍 All generations are shown together, so OVR ranking is displayed as GLOBAL (LOCAL isn't comparable across generations).", opombaPreklopnikOnemogocen: "🔒 Toggle unavailable - all generations are shown together, so the shared (GLOBAL) standard applies.", porociloZanimivosti: "Highlights", inFormOznaka: "In Form", novRang: "Rank up", mkPregled: "Overview", mkAnalitika: "Analytics", mkDosezki: "Achievements", izrezNaslov: "Adjust photo", izrezPodnaslov: "Drag the image and set the zoom so it sits nicely in the card frame.", izrezPreklici: "Cancel", izrezPotrdi: "✓ Use photo", ruNaslov: "Rank Up", klikniZaObrat: "Click to flip", serija: "Serial", lblSekcijaSestava: "🧬 Body composition (optional)", lblInMascoba: "Body fat (%)", lblInMisicna: "Muscle mass (kg)", porociloLegendaEnostavna: "The colored part of each bar shows the share of same-generation peers the athlete outperforms. The white vertical tick marks the same comparison against the entire database (all generations).",
        // --- HALL OF FAME ---
        slavaPodnaslov: "All-time record holders", slavaPrazno: "No measurements yet.",
        slavaKraljOznaka: "Highest OVR of all time", slavaPoglej: "View card",
        slavaNoga: "Records from {n} measurements · G99 Combine",
        rekHitrost: "Fastest", rekMoc: "Strongest", rekEksploz: "Most explosive",
        rekAgilnost: "Most agile", rekVzdrzljivost: "Best endurance",
        // --- CHALLENGES ---
        izzNaslov: "CHALLENGES", izzPodnaslov: "Duels before the event",
        izzOpozorilo: "To create a challenge, sign in with the e-mail address you were measured with.",
        izzUstvariNaslov: "Challenge a teammate", izzNiDrugih: "No other athletes", izzPoslji: "Send challenge",
        izzNamig: "The challenge records both current values. It is settled automatically after the next measurement.",
        izzPrazno: "No challenges yet. Challenge a teammate and the duel will be settled after the next measurement.",
        izzSkupniOvr: "Overall OVR", izzIzhodisce: "baseline", izzCaka: "waiting for a new measurement",
        izzIzenaceno: "tied", izzVodi: "leads", izzBrisiNamig: "Delete challenge", izzTi: "you",
        izzNeodloceno: "Draw", izzZmagovalec: "Duel winner", izzKategorije: "categories",
        izzNapPrijava: "You need to sign in to send a challenge.", izzNapDrugega: "You must pick a different athlete.",
        izzNapJaz: "You have no measurement yet - a challenge isn't possible.", izzNapOn: "The selected athlete has no measurement.",
        izzNapUstvari: "The challenge could not be created. Check that you are signed in.",
        izzPotrdiBrisanje: "Do you really want to delete this challenge?", izzNapBrisanje: "Delete failed.",
        // --- PUBLIC PROFILE ---
        profBazaPrazna: "The database is empty.", profNiNajden: "Profile not found.",
        profNapaka: "Error loading the profile.", profOdpriApp: "OPEN APP",
        profSlogan: "Get measured. Get your card.", profCtaRacun: "CREATE YOUR ACCOUNT",
        profCtaLestvica: "View the full leaderboard", profOpomba: "This card was created at a G99 Combine.",
        profOdpri: "Open G99 Performance",
        // --- CSV IMPORT / PHOTO ---
        csvPrazen: "The CSV is empty or has no data.", csvUvazam: "⏳ Importing...",
        csvUvozeno: "Athletes imported / updated: ", csvNapake: "Errors: ",
        csvNeprepoznani: "Unrecognized columns (skipped): ",
        slikaShranjeno: "✅ SAVED!", slikaShrani: "💾 Save My Photo to Database",
        javniCombine: "Public Combine", namigDotik: "Tap a card to flip it",
        qrNamig: "Scan for the full profile",
        tvCakanje: "Waiting for the next result", tvZazeni: "Start screen",
        tvNamig: "Sound and fullscreen turn on when you start",
        tvStOznake: ["On the start line", "Up next", "Going now", "In action", "On the track"],
        tvStPrvic: "First measurement", tvStZadnji: "Last OVR",
        tvNovRekord: "New record", tvRekordOvr: "Highest OVR",
        tvNapaka: "Could not connect to the database",
        tvPodlogo: "Official testing", tvStatMeritev: "Measurements", tvStatVodi: "Leader",
        tvMeritveNaslov: "Measured at the event", tvIzBaze: "From the database", tvRekordiNaslov: "All-time database records · ★ set today",
        sezonaBeseda: "Season",
        btnSkener: "Scan wristband", skenerNaslov: "Scan wristband",
        skenerPodnaslov: "Hold the code inside the frame", skenerZapri: "Close", skenerPovezi: "Link",
        skenerIscem: "Looking for a code ...", skenerNiPovezana: "This code is not linked to an athlete yet.",
        skenerManjka: "Enter an e-mail and a name.", skenerNapaka: "Error reading from the database.",
        skenerNiKamere: "No access to the camera. Check the browser permission.",
        skenerNiKnjiznice: "The QR reader did not load. Check your connection.",
        skenerNalozen: "Athlete loaded:", skenerNalagam: "loading ...",
        skenerDrugi: "Link to someone else", skenerVpisiNovega: "Enter a new athlete for this code.",
        skenerPotekla: "The link has expired. The code is free again.",
        btnTiskKod: "Print wristband codes", btnNaStartu: "Announce on the line",
        tiskKoliko: "How many codes should I prepare?", tiskOd: "Starting from which number?",
        tiskBlokirano: "The browser blocked the new window. Allow pop-ups and try again.",
        tiskPrenesi: "Download all as image", tiskNatisni: "Print",
        vnosSumljivo: "These values fall outside the expected range:",
        vnosPricakovano: "expected", vnosVseeno: "Save anyway?",
        gumbSobe: "Rooms", sobeNaslov: "PRIVATE ROOMS", sobePodnaslov: "A leaderboard just for your crew",
        sobePrazno: "You are not in any room yet. Create one or join with a code.",
        sobaImeNamig: "Room name", sobaUstvari: "Create room", sobaPridruzi: "Join",
        sobaClanov: "members", sobaKopiraj: "Copy code", sobaKopirano: "Code copied:",
        sobaOdidi: "Leave room", sobaRekordi: "Room records", sobaBrisi: "Delete room",
        sobaPotrdiBrisanje: "This room will be permanently deleted. Continue?",
        sobaNapBrisi: "Only the owner can delete a room, and only when alone in it.",
        sobaNapBrisanje: "Delete failed.",
        sobaBrezMeritev: "No member has a measurement yet.",
        sobaCakaMeritev: "awaiting measurement", sobaJaz: "You", sobaNeznan: "Room member",
        sobaPotrdiOdhod: "Do you really want to leave this room?",
        sobaNapPrijava: "Sign in with the e-mail you were measured with to use rooms.",
        sobaNapIme: "The room name needs at least two characters.",
        sobaNapUstvari: "The room could not be created.",
        sobaNapNiKode: "No room with that code.", sobaNapPolna: "The room is full.",
        sobaNapPridruzi: "Could not join.", sobaNapOdhod: "Could not leave.",
        btnTvZaslon: "Open the event TV screen",
        starostIme: "Age jump",
        starostVrednost: "OVR {o} against {g} norms",
        starostNamig: "These results would hold up among the {g} generation too. You get this mark if your OVR, recalculated against the norms of the generation above you, is at least 80.",
        legStarostNaslov: "Age jump",
        legStarostUvod: "This mark does not depend on the database - the norms are fixed, so it cannot be gained or lost because of who happens to be entered.",
        legStarostPogoj: "Your measurements are recalculated against the norms of the generation ABOVE you (U15→U17, U17→U19, U19→PRO). If that OVR is at least 80, you get a green star with that generation's label. All five measurements are required. The PRO generation has no mark, as there is nothing above it." }
    };

    const z_ic = ["fa-skull","fa-crown","fa-bolt-lightning","fa-mountain","fa-battery-full","fa-jet-fighter-up","fa-staff-snake","fa-bug","fa-certificate","fa-user-astronaut","fa-fire-flame-curved","fa-cloud-bolt","fa-trophy","fa-fire","fa-hand-fist","fa-screwdriver-wrench","fa-dragon","fa-paw","fa-spider","fa-plane-up","fa-crosshairs","fa-gem","fa-eye-slash","fa-hourglass-half","fa-star","fa-user-ninja","fa-truck","fa-dog","fa-shield-halved","fa-anchor","fa-truck-monster","fa-bomb","fa-mask","fa-robot","fa-wind","fa-feather-pointed","fa-forward-fast","fa-weight-hanging","fa-rocket","fa-heart-pulse","fa-hurricane","fa-arrows-to-circle","fa-scale-balanced","fa-horse-head","fa-fire-flame-simple","fa-hammer","fa-frog","fa-battery-half","fa-shoe-prints","fa-seedling","fa-arrow-trend-up","fa-cube","fa-hand-peace","fa-star-of-life"];
    const z_t = [5,3,5,5,5,5,5,5,4,4,4,4,4,4,3,3,3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0];
    const z_sl_t = [["The One","Absolutno najvišji OVR v bazi"],["G99 Klub","Top 99 igralcev po OVR"],["Svetlobna Hitrost","Najboljši čas šprinta v bazi"],["Gora","Največja proizvedena moč v bazi"],["Neskončni Motor","Najboljši rezultat vzdržljivosti"],["Antigravitacija","Največja eksplozivnost v bazi"],["Kobra","Najboljši čas agilnosti v bazi"],["Mravlja","Najvišja relativna moč v bazi"],["Gen. Talent","Najvišji OVR v svoji generaciji"],["Nezemljan","Vseh 5 ocen nad 90"],["Polbog","Vsaj 3 ocene nad 95"],["Grom in Strela","Hitrost in Moč nad 90"],["G.O.A.T.","OVR 98 ali 99"],["Limit Breaker","Vsaj ena ocena 99"],["Goljat","Višina >190, Teža >90, Moč 85+"],["Švicarski Nož","Vseh 5 ocen nad 85"],["Stari Zmaj","Starost 35+ in OVR 80+"],["Gepard","Hitrost in Eksplozivnost 90+"],["Pajek","Agilnost in Eksplozivnost 90+"],["Gospodar Zraka","Višina >185, Eksplozivnost 90+"],["Kirurg","Hitrost in Agilnost nad 90"],["Zlati Rez","Vse ocene 80+, manjša razlika"],["Fantom","Teža pod 75kg, Eksplozivnost 95+"],["Veteran","Starost nad 30 in OVR > 85"],["Wonderkid","OVR 85+ (U15 ali U17)"],["Nindža","Teža <70kg, Agilnost in Hitrost 85+"],["Dizel","Vzdržljivost 90+, Moč 85+"],["Pitbul","Teža pod 80kg, Moč nad 85"],["Trdnjava","Teža >90kg ali višina >190cm, Agilnost 85+"],["Sidro","Teža nad 90kg, Moč 90+"],["Bager","85+ Moč in Hitrost"],["Dinamit","85+ Moč in Eksploz."],["Senca","85+ Hitrost in Agilnost"],["Kiborg","85+ Moč in Vzdržljiv."],["Gazela","85+ Hitrost in Vzdržljiv."],["Akrobat","85+ Eksploz. in Agilnost"],["Speed Demon","90+ Hitrost"],["Juggernaut","90+ Moč"],["Raketa","90+ Eksplozivnost"],["Železna pljuča","90+ Vzdržljivost"],["Tornado","90+ Agilnost"],["Popoln Stroj","80+ Vse ocene"],["Uravnotežen","Najmanjše razlike v ocenah"],["Delovna Žival","80+ Agi, Vzd, Hitrost"],["Iskra","Hitrost 75+"],["Kladivo","Moč 75+"],["Vzmet","Eksplozivnost 75+"],["Baterija","Vzdržljivost 75+"],["Spretnež","Agilnost 75+"],["Sveža Kri","OVR 65-79"],["Na Dobri Poti","OVR 75-84"],["Stabilen","Vse ocene 60+"],["Dvojna Grožnja","Dve oceni 80+"],["Specialist","Ena ocena elitna, ostale <80"]];
    const z_en_t = [["The One","Absolute highest OVR in the DB"],["The G99 Club","Top 99 players by OVR"],["Light Speed","Best sprint time in database"],["The Mountain","Highest raw power in DB"],["Infinite Engine","Best endurance score in DB"],["Anti-Gravity","Highest explosiveness in DB"],["The Viper","Best agility time in DB"],["The Ant","Highest relative power"],["Prodigy","Highest OVR in own gen"],["The Alien","All 5 stats over 90"],["Demigod","At least 3 stats over 95"],["Thunder & Lightning","Speed and Power over 90"],["G.O.A.T.","OVR 98 or 99"],["Limit Breaker","At least one 99 stat"],["Goliath","Height >190, Weight >90, Pwr 85+"],["Swiss Army Knife","All 5 stats over 85"],["Old Dragon","Age 35+ and OVR 80+"],["Cheetah","Speed and Exp 90+"],["Spider","Agility and Exp 90+"],["Skywalker","Height >185, Exp 90+"],["The Surgeon","Speed & Agility > 90"],["Golden Ratio","All stats 80+, gap < 4"],["The Phantom","Weight < 75kg, Exp 95+"],["Veteran","Age > 30 and OVR > 85"],["Wonderkid","OVR 85+ (U15 or U17)"],["Featherweight","Weight <70, Agi & Spd 85+"],["Diesel Motor","Endurance 90+, Power 85+"],["Pitbull","Weight <80kg, Power 85+"],["The Fortress","Weight >90 (or H>190), Agi 85+"],["The Anchor","Weight > 90kg, Power 90+"],["Bulldozer","85+ Power & Speed"],["Wrecking Ball","85+ Power & Exp"],["The Ghost","85+ Speed & Agility"],["The Machine","85+ Power & Endurance"],["Relentless","85+ Speed & Endurance"],["Gravity Defier","85+ Exp & Agility"],["Speed Demon","90+ Speed"],["Juggernaut","90+ Power"],["Airwalker","90+ Exp"],["Iron Lungs","90+ Endurance"],["Ankle Breaker","90+ Agility"],["All-Rounder","80+ All Stats"],["Harmony","Smallest stat gap"],["Workhorse","80+ Agi, End, Speed"],["The Spark","Speed 75+"],["The Hammer","Power 75+"],["The Pogo","Exp 75+"],["The Battery","Endurance 75+"],["Slick","Agility 75+"],["Rookie","OVR 65-79"],["Rising Star","OVR 75-84"],["Solid Core","All stats 60+"],["Dual Threat","Two stats 80+"],["Specialist","One elite stat, rest <80"]];
    
    window.prevodiZnack = { sl: {}, en: {} };
    for(let i=0; i<54; i++) {
        window.prevodiZnack.sl['z'+(i+1)] = { ime: z_sl_t[i][0], opis: z_sl_t[i][1], ikona: z_ic[i], t: z_t[i] };
        window.prevodiZnack.en['z'+(i+1)] = { ime: z_en_t[i][0], opis: z_en_t[i][1], ikona: z_ic[i], t: z_t[i] };
    }

    window.chartOptions = { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: '#333' }, grid: { color: '#333' }, pointLabels: { color: '#fff', font: { size: 10, weight: 'bold' } }, ticks: { display: false }, min: 0, max: 100 } }, plugins: { legend: { display: false } } };

    // ==========================================
    // FUNKCIJE
    // ==========================================
    window.setT = function(id, text) { let el = document.getElementById(id); if(el) el.innerText = text; };

    // FIFA-pack razkritje OVR: številka se animirano "odšteje" navzgor do končne vrednosti,
    // z rahlim pospeškom na koncu in kratkim pulzom+sijem, ko doseže cilj. Naredi kartico
    // vredno snemanja/deljenja. Med izvozom (html2canvas) animacije NE poganjamo.
    window.animirajOVR = function(id, ciljnaVrednost, trajanje = 1100) {
        let el = document.getElementById(id);
        if(!el) return;
        let cilj = parseInt(ciljnaVrednost);
        if(isNaN(cilj)) { el.innerText = ciljnaVrednost; return; }

        // Če smo v izvozu ali uporabnik želi manj animacij, samo nastavi vrednost.
        if(document.body.classList.contains('exporting') ||
           window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.innerText = cilj; return;
        }

        // Prepreči prekrivanje več animacij na istem elementu.
        if(el._ovrAnim) cancelAnimationFrame(el._ovrAnim);

        let zacetek = Math.max(0, cilj - 40); // začni ~40 pod ciljem za občuten "vzpon"
        let t0 = null;
        let easeOut = t => 1 - Math.pow(1 - t, 3); // hitro na začetku, umiri se na koncu

        let korak = (ts) => {
            if(t0 === null) t0 = ts;
            let p = Math.min(1, (ts - t0) / trajanje);
            let trenutna = Math.round(zacetek + (cilj - zacetek) * easeOut(p));
            el.innerText = trenutna;
            if(p < 1) {
                el._ovrAnim = requestAnimationFrame(korak);
            } else {
                el.innerText = cilj;
                el._ovrAnim = null;
                // Pulz + blisk ob dosegu cilja
                el.classList.remove('ovr-pulz');
                void el.offsetWidth; // ponovni zagon animacije
                el.classList.add('ovr-pulz');
            }
        };
        el.innerText = zacetek;
        el._ovrAnim = requestAnimationFrame(korak);
    };
    window.setH = function(id, html) { let el = document.getElementById(id); if(el) el.innerHTML = html; };

    // Osnovna zaščita pred XSS: podatki iz baze (npr. ime športnika) gredo na več mestih
    // direktno v innerHTML (zaradi html2canvas izvoza kartic). To pobegne posebne znake,
    // da vnos kot npr. ime = "<img src=x onerror=...>" ne izvede kode v brskalniku.
    window.escapeHtml = function(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
    };

    // FFMI (Fat-Free Mass Index) = pusta telesna masa / višina(m)^2, z normalizacijo na 1.8 m.
    // Pove, koliko "čiste" (nemaščobne) mase ima športnik glede na svojo višino - za trenerja
    // pogosto bolj uporabno kot sam ITM/BMI, ki ne loči mišic od maščobe.
    // POMEMBNO: FFMI je odvisen od meritve % maščobe, ta pa se med metodami (kaliper,
    // bioimpedanca, DEXA) precej razlikuje - zato je smiselno primerjati le meritve,
    // opravljene z ISTO metodo. To je zapisano tudi v prikazu za uporabnika.
    window.izracunajFFMI = function(tezaKg, visinaCm, odstotekMascobe, misicnaMasaKg) {
        let t = parseFloat(tezaKg) || 0;
        let vM = (parseFloat(visinaCm) || 0) / 100;
        let bf = parseFloat(odstotekMascobe);
        let mm = parseFloat(misicnaMasaKg);
        if(vM <= 0) return null;

        let pustaMasa = null;
        if(!isNaN(bf) && bf > 0 && bf < 70 && t > 0) {
            pustaMasa = t * (1 - bf / 100);
        } else if(!isNaN(mm) && mm > 0) {
            // Rezerva: če % maščobe ni vnesen, uporabimo vneseno mišično maso kot približek
            // puste mase (ni identično - pusta masa vključuje tudi kosti in organe - zato to
            // označimo kot oceno).
            pustaMasa = mm;
        }
        if(pustaMasa === null || pustaMasa <= 0) return null;

        let ffmi = pustaMasa / (vM * vM);
        let ffmiNorm = ffmi + 6.1 * (1.8 - vM); // normalizacija na 180 cm
        return {
            ffmi: ffmi,
            ffmiNorm: ffmiNorm,
            pustaMasa: pustaMasa,
            izPovrsine: !isNaN(bf) && bf > 0 ? 'mascoba' : 'misicna'
        };
    };

    // Skupni izris telesne sestave (FFMI) - uporabljen na hrbtni strani kartice v Bazi,
    // v "Moja Kartica" in v "Poglej" oknu, da je prikaz povsod enak in se vzdržuje na enem mestu.
    // Vrne prazen niz, če športnik nima vnesenih podatkov o sestavi (polji sta neobvezni).
    window.dobiSestavaHTML = function(a, kompakt = false) {
        // Sestava telesa je zasebna. Pokažemo jo le, če jo je športnik dal javno,
        // ALI če jo gleda trener/admin, ALI lastnik svoje kartice.
        let smemVideti = a.javnaSestava === true || window.jeTrener || a._lastnikGleda === true ||
                         ((a.emailSportnika || '').toLowerCase() === window.tEmail && window.tEmail);
        if(!smemVideti) return '';
        let ff = window.izracunajFFMI(a.teza, a.visina, a.odstotekMascobe, a.misicnaMasa);
        if(!ff) return '';
        let sl = window.tJezik === 'sl';
        let bf = parseFloat(a.odstotekMascobe);
        let velikost = kompakt ? 'sestava-kompakt' : '';
        return `<div class="sestava-chip ${velikost}">
            <div class="sestava-chip-naslov">🧬 ${sl ? 'Telesna sestava' : 'Body composition'}</div>
            <div class="sestava-chip-vrstica">
                <div class="sestava-chip-item"><span>FFMI</span><b>${ff.ffmiNorm.toFixed(1)}</b></div>
                <div class="sestava-chip-item"><span>${sl ? 'Pusta' : 'Lean'}</span><b>${ff.pustaMasa.toFixed(1)} kg</b></div>
                ${!isNaN(bf) && bf > 0 ? `<div class="sestava-chip-item"><span>${sl ? 'Maščoba' : 'Fat'}</span><b>${bf.toFixed(1)}%</b></div>` : ''}
            </div>
        </div>`;
    };

    // Zgradi ENOTEN podatkovni panel (meritve + telesna sestava) - uporabljen v "Moja Kartica"
    // in v "Poglej" oknu, da sta prikaza povsod enaka in se vzdržujeta na enem mestu.
    window.dobiPodatkovniPanel = function(meritve, aObj) {
        let lng = window.prevodi[window.tJezik];
        let statBoxi = meritve.map(st => `<div class="raw-stat-box">
            <div class="raw-stat-top"><i class="fa-solid ${st.i}"></i> ${st.n}</div>
            <div class="raw-stat-val">${st.v} <span>${st.u}</span></div>
            <div class="raw-bar-bg"><div class="raw-bar-fill" style="width:${st.s}%; background:${window.getColorForOvr(st.s)};"></div></div>
        </div>`).join('');

        let sestava = window.dobiSestavaHTML(aObj);
        return `<div class="podatki-panel">
            <div class="podatki-panel-naslov">📋 ${window.tJezik === 'sl' ? 'Meritve' : 'Measurements'}</div>
            <div class="raw-stats-grid">${statBoxi}</div>
            ${sestava ? `<div class="podatki-panel-locnica"></div>${sestava}` : ''}
        </div>`;
    };

    // Hex -> rgba. Namenoma NE uporabljam color-mix(): Chrome ga izračuna v color(srgb ...),
    // česar html2canvas ne razume, in izvoz slike pade. Ta past nas je stala že enkrat.
    window.barvaProsojno = function(hex, alfa) {
        let h = (hex || '#4facfe').replace('#', '');
        if(h.length === 3) h = h.split('').map(z => z + z).join('');
        let n = parseInt(h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
    };

    // V bazi je sezona shranjena kot besedilo "Sezona 1" - to je PODATEK, ne vmesnik,
    // zato se ni prevajal in je na angleški kartici pisalo "Sezona". Ta funkcija ga
    // prevede šele ob prikazu; v bazi ostane nespremenjen, da grupiranje po sezonah dela.
    window.prikaziSezono = function(s) {
        if(!s) return '';
        let lng = window.prevodi[window.tJezik] || {};
        return String(s).replace(/^\s*Sezona\b/i, lng.sezonaBeseda || 'Sezona');
    };

    window.getColorForOvr = function(ovr) { 
        if (ovr>=98) return "#00f2fe"; if (ovr>=94) return "#ff7675"; if (ovr>=89) return "#a29bfe"; 
        if (ovr>=80) return "#74b9ff"; if (ovr>=70) return "#00cec9"; if (ovr>=60) return "#f1c40f"; 
        if (ovr>=50) return "#bdc3c7"; if (ovr>=40) return "#cd7f32"; return "#707b82"; 
    };
    
    // Napredek do naslednjega ranga - psihološko močan motivator ("še +2 do DIAMOND").
    // Vrne null, če je športnik že na najvišjem rangu (G99 Tier).
    window.RANK_PRAGOVI = [
        { min: 0,  idx: 0 }, { min: 40, idx: 1 }, { min: 50, idx: 2 }, { min: 60, idx: 3 },
        { min: 70, idx: 4 }, { min: 80, idx: 5 }, { min: 89, idx: 6 }, { min: 94, idx: 7 }, { min: 98, idx: 8 }
    ];
    // Stopnja foila glede na rang - vsaka kartica ima lesk, a redkejši rang = močnejši lesk.
    // Datum meritve v strnjeni številčni obliki (npr. 26061999) - služi kot identifikacija
    // kartice, podobno serijski številki na zbirateljskih karticah.
    // Hrbtna stran kartice - ena sama definicija, uporabljena v "Poglej" oknu IN v
    // prelevitvenem oknu, da sta videza vedno usklajena.
    window.dobiHrbtnoStranHTML = function(a, o) {
        let lng = window.prevodi[window.tJezik];
        let ri = window.getRankClassAndName(o, lng);
        let col = window.getColorForOvr(o);
        return `<div class="poglej-face poglej-back ${ri.c}" style="border-color:${col}; box-shadow: 0 0 30px ${col}; --rang-barva:${col};">
                    <div class="notranji-rob"></div>
                    <div class="kb-vzorec"></div>
                    <div class="kb-monogram-ovoj"><div class="kb-monogram">G99</div></div>
                    <div class="kb-navpicni">Performance</div>
                    <div class="foil-plast foil-plast-back"></div>

                    <div class="kb-glava">
                        <div class="kb-rang" style="color:${col};">${ri.n}</div>
                        <div class="kb-ovr" style="color:${col};">${o}</div>
                    </div>

                    <div class="kb-noga">
                        <div class="kb-znamka">G99 <span>PERFORMANCE</span></div>
                        <div class="kb-datum">${window.dobiDatumMeritve(a)}</div>
                    </div>
                </div>`;
    };

    window.dobiDatumMeritve = function(a) {
        let t = a && a.timestamp ? new Date(a.timestamp) : null;
        if(!t || isNaN(t.getTime())) return '—';
        let dd = String(t.getDate()).padStart(2, '0');
        let mm = String(t.getMonth() + 1).padStart(2, '0');
        return `${dd}${mm}${t.getFullYear()}`;
    };

    // Znak časti - ena sama definicija, uporabljena v Bazi IN v "Poglej" oknu.
    // velik = true za velike kartice (Poglej), false za male kartice v mreži.
    // ==========================================
    // ENOTEN SISTEM NAMIGOV
    // ==========================================
    // En sam element na vrhu strani (fixed), ki ga poganja delegiran poslušalec.
    // Prednost pred namigi znotraj kartice: rob kartice ga ne more odrezati, in ne
    // potrebujemo poslušalca na vsakem od stotin elementov.

    // IN-FORM: ali ima ta zapis trenutno status "V formi"?
    // Pomembno: In-Form NE spremeni ranga. Rang (do 99) meri absolutno raven, In-Form pa
    // trenutni zagon - to sta dve različni osi. Zato je In-Form vedno le DODATNA plast čez
    // obstoječi okvir; BRONZE ostane bronast, G99 TIER ostane G99 TIER.
    // Kombinacija G99 TIER + In-Form je zato najredkejše, kar sistem premore.
    window.jeVFormi = function(atletId) {
        if(!atletId || !window.okvirjiPoAtletu) return false;
        let okv = window.okvirjiPoAtletu[atletId];
        return !!(okv && okv.kljuc === 'vFormi');
    };

    // Razred, ki ga pripnemo kartici (in trak, ki ga vstavimo vanjo).
    window.inFormRazred = function(atletId) {
        return window.jeVFormi(atletId) ? ' je-in-form' : '';
    };
    // Sij za kartice, ki se OBRAČAJO (baza), gre na ovoj, ne na ploskev - sicer ob obratu izgine.
    window.inFormOvojRazred = function(atletId) {
        return window.jeVFormi(atletId) ? ' in-form-ovoj' : '';
    };
    // Oznaka na kartici je ukinjena - In-Form sporoča samo ognjen okvir + znak časti
    // "V FORMI" nad kartico. Funkcija ostaja (kliče se na več mestih), a vrne prazno.
    window.inFormTrakHTML = function() { return ''; };

    window.dobiZnakCastiHTML = function(atletId, velik) {
        if(!atletId || !window.okvirjiPoAtletu) return '';
        let okv = window.okvirjiPoAtletu[atletId];
        if(!okv) return '';
        let def = window.OKVIRJI[okv.kljuc];
        if(!def) return '';
        let razredi = 'cast-okvircek' + (velik ? ' cast-velik' : '') + (def.glasen ? ' cast-glasen' : '');
        // BREZ ikone - niti na kartici niti v namigu. Simboli so v celoti pridržani značkam.
        return `<div class="${razredi}" style="--cast-barva:${def.barva};"
                     data-namig-ime="${window.escapeHtml(okv.ime)}"
                     data-namig-opis="${window.escapeHtml(okv.opis)}"
                     data-namig-barva="${def.barva}">
            <span>${window.escapeHtml(okv.ime)}</span>
        </div>`;
    };







    // Cache limitov po (mode|spol|gen), da se getDynamicLimits (ki sprehodi celo bazo)
    // ne kliče znova za isto kombinacijo znotraj iste "seje" izrisovanja.
    // Invalidira se ob vsakem osveziGalerijo() in ob preklopu ratingMode.
    window.limitiCache = {};

    // Preklopnik GLOBAL/LOCAL nima učinka, kadar so prikazane VEČ generacij hkrati
    // (Lestvica vedno, Baza pri "Vse Generacije") - v teh primerih ga vizualno in
    // funkcionalno onemogočimo, namesto da bi uporabnik klikal stikalo, ki navidez
    // "ne dela ničesar".




    // Predračuna rekorde (najvišji OVR, najhitrejši, najmočnejši ...) EN krat za celo bazo,
    // namesto da vsak klic izracunajZnacke() sam sprehodi celoten aBaza (prej O(n) na kartico,
    // torej O(n^2) za celo galerijo). Kliče se iz osveziGalerijo() in ob preklopu ratingMode.

    // ==========================================================================
    // POSEBNI OKVIRJI
    // ==========================================================================
    // Pravila proti "cirkusu":
    //  1) Vsaka kartica prikaže NAJVEČ EN okvir (najvišja prioriteta zmaga).
    //  2) Samo najredkejši okvirji so animirani ("glasni") - teh je po definiciji po eden
    //     v celotni bazi. Vsi ostali so tihi: statičen barvni rob, brez animacije.
    //  3) Pragovi so strogi. Če bi okvir dobila polovica baze, ni okvir - je ozadje.
    //
    // Okvir se veže na ZADNJO sezono športnika (tisto, ki se prikazuje kot aktualna).
    // NAČELO: značke povedo KDO SI (posnetek ene sezone), znaki časti pa KAKO SE PREMIKAŠ
    // (trajektorija skozi sezone). Zato so bili odstranjeni "Kralj baze", "Kralj generacije"
    // in "Specialist" - vsi trije so podvajali obstoječe značke (The One, Gen. Talent,
    // Specialist). Vsak znak spodaj meri nekaj, česar značke NE morejo izraziti.
    window.OKVIRJI = {
        vFormi:       { prio: 100, glasen: true,  ikona: '🔥', barva: '#ff9f43' },
        preporod:     { prio: 90,  glasen: false, ikona: '🦅', barva: '#fd79a8' },
        popolnaSez:   { prio: 80,  glasen: false, ikona: '⭐', barva: '#ffd369' },
        preboj:       { prio: 70,  glasen: false, ikona: '🚀', barva: '#2ecc71' },
        zagon:        { prio: 60,  glasen: false, ikona: '⚡', barva: '#00cec9' },
        konstanta:    { prio: 50,  glasen: false, ikona: '💎', barva: '#74b9ff' },
        preobrazba:   { prio: 45,  glasen: false, ikona: '🧬', barva: '#55efc4' },
        ravnovesje:   { prio: 40,  glasen: false, ikona: '⚖️', barva: '#a29bfe' },
        veteran:      { prio: 30,  glasen: false, ikona: '🛡️', barva: '#b2915f' },
        novinec:      { prio: 20,  glasen: false, ikona: '🌱', barva: '#4facfe' }
    };

    window.okvirjiPoAtletu = {};   // { zapisId: { kljuc, ime, opis } }


    window.MAX_NAGIB = 11; // stopinj

    // 3D NAGIB + FOIL - EN SAM delegiran poslušalec na dokumentu.
    // Prej smo poslušalce pripenjali na vsak ovoj posebej in si zapomnili, kje smo že bili
    // (data-tilt-pripet). To je bilo krhko: pri statičnih elementih (Moja Kartica) se je
    // zastavica ohranila čez ponovne izrise, pri dinamičnih pa smo pripenjali znova in znova.
    // Delegiran poslušalec deluje za VSAK ovoj, kadarkoli se pojavi - brez knjigovodstva.

    // Ohranjeno ime, da ostanejo obstoječi klici veljavni - zdaj samo poskrbi za namestitev.

    // ==========================================
    // ENOTEN SISTEM NAMIGOV
    // ==========================================
    // En sam element na vrhu strani (fixed), ki ga poganja delegiran poslušalec.
    // Prednost pred namigi znotraj kartice: rob kartice ga ne more odrezati, in ne
    // potrebujemo poslušalca na vsakem od stotin elementov.
    window.pripraviNamige = function() {
        if(document.getElementById('g99Namig')) return;
        let el = document.createElement('div');
        el.id = 'g99Namig';
        document.body.appendChild(el);

        let pokazi = (cilj) => {
            let ime = cilj.getAttribute('data-namig-ime') || '';
            let opis = cilj.getAttribute('data-namig-opis') || '';
            let ikona = cilj.getAttribute('data-namig-ikona') || '';
            let barva = cilj.getAttribute('data-namig-barva') || '#4facfe';
            let vrednost = cilj.getAttribute('data-namig-vrednost') || '';
            if(!ime && !opis) return;

            el.style.setProperty('--namig-barva', barva);
            el.innerHTML =
                (ime ? `<div class="namig-glava">${ikona ? `<span class="namig-ikona">${ikona}</span>` : ''}<span class="namig-ime">${ime}</span></div>` : '') +
                (vrednost ? `<div class="namig-vrednost">${vrednost}</div>` : '') +
                (opis ? `<div class="namig-opis">${opis}</div>` : '');

            el.classList.add('viden');
            let r = cilj.getBoundingClientRect();
            let n = el.getBoundingClientRect();
            // Privzeto nad elementom; če ni prostora, pod njim.
            let vrh = r.top - n.height - 10;
            if(vrh < 8) vrh = r.bottom + 10;
            let levo = r.left + r.width / 2 - n.width / 2;
            levo = Math.max(8, Math.min(levo, window.innerWidth - n.width - 8));
            el.style.top = vrh + 'px';
            el.style.left = levo + 'px';
        };

        document.addEventListener('pointerover', (e) => {
            let cilj = e.target.closest('[data-namig-ime], [data-namig-opis]');
            if(cilj) pokazi(cilj);
        });
        document.addEventListener('pointerout', (e) => {
            if(e.target.closest('[data-namig-ime], [data-namig-opis]')) el.classList.remove('viden');
        });
        window.addEventListener('scroll', () => el.classList.remove('viden'), true);
    };

    window.dobiFoilTier = function(o) {
        if(o >= 94) return 'foil-t4';  // Elite / G99
        if(o >= 80) return 'foil-t3';  // Diamond / Prime
        if(o >= 60) return 'foil-t2';  // Gold / Platinum
        return 'foil-t1';              // Iron / Bronze / Silver
    };

    window.dobiNapredekDoRanga = function(o) {
        let lng = window.prevodi[window.tJezik];
        let trenutni = null, naslednji = null;
        for(let i = 0; i < window.RANK_PRAGOVI.length; i++) {
            if(o >= window.RANK_PRAGOVI[i].min) { trenutni = window.RANK_PRAGOVI[i]; naslednji = window.RANK_PRAGOVI[i+1] || null; }
        }
        if(!naslednji) return null; // že najvišji rang
        let razpon = naslednji.min - trenutni.min;
        let napredek = o - trenutni.min;
        let pct = razpon > 0 ? Math.max(0, Math.min(100, Math.round((napredek / razpon) * 100))) : 0;
        return {
            manjka: naslednji.min - o,
            imeNaslednjega: lng.rNames[naslednji.idx],
            pct: pct
        };
    };

    window.getRankClassAndName = function(o, lng) {
        if (o>=98) return {c: "rank-g99", n: lng.rNames[8]};
        if (o>=94) return {c: "rank-elite", n: lng.rNames[7]};
        if (o>=89) return {c: "rank-prime", n: lng.rNames[6]};
        if (o>=80) return {c: "rank-diamond", n: lng.rNames[5]};
        if (o>=70) return {c: "rank-platinum", n: lng.rNames[4]};
        if (o>=60) return {c: "rank-gold", n: lng.rNames[3]};
        if (o>=50) return {c: "rank-silver", n: lng.rNames[2]};
        if (o>=40) return {c: "rank-bronze", n: lng.rNames[1]};
        return {c: "rank-iron", n: lng.rNames[0]};
    };

    window.preračunaj = function(val, obj, nizjeJeBolje = false) { 
        if(!obj) return 50;
        if (window.ratingMode === 'LOCAL' && obj.mean !== undefined && obj.mean !== null) {
            if (obj.std === 0 || isNaN(obj.std)) return 50; 
            let z = (val - obj.mean) / obj.std;
            if(nizjeJeBolje) z = -z;
            // LOCAL izhodišče je namenoma "radodarno" (povprečen igralec v tvoji bazi = 70),
            // ker so GLOBAL meje postavljene na (skoraj) svetovno raven in bi bila neposredna
            // primerjava z njimi za večino amaterskih/mladinskih športnikov nerealna in demotivacijska.
            // Da pa nadpovprečni igralci ne "obtičijo" na stropu (99) prehitro, je razpon navzgor
            // in navzdol umerjen simetrično: v OBE smeri je za skrajno oceno (99 ali 1) potrebnih
            // enako standardnih odklonov (3σ = statistično res redko, ~0.1% populacije).
            let baseline = 70; let sigma = 3;
            let spread = z >= 0 ? (99 - baseline) / sigma : (baseline - 1) / sigma;
            let score = Math.round(baseline + (z * spread));
            if(score > 99) return 99; 
            if(score < 1) return 1; 
            return score;
        } else {
            let min = obj.min; let max = obj.max; let score; 
            if(min === undefined || max === undefined) return 50;
            if (nizjeJeBolje) { 
                if (val >= min) return 1; if (val <= max) return 99; 
                score = ((min - val) / (min - max)) * 98 + 1; 
            } else { 
                if (val <= min) return 1; if (val >= max) return 99; 
                score = ((val - min) / (max - min)) * 98 + 1; 
            } 
            return Math.round(score); 
        }
    };

    window.getDiffsHTML = function(currScore, prevScore, isOvr = false) {
        if(prevScore == null || prevScore === undefined || isNaN(prevScore)) return '';
        let diff = currScore - prevScore;
        if(diff === 0) return '';
        let displayDiff = Math.abs(diff);
        let znak = diff > 0 ? '▲' : '▼'; 
        let colorClass = diff > 0 ? 'positive' : 'negative';
        let cName = isOvr ? 'ovr-diff' : 'stat-diff';
        return `<div class="${cName} ${colorClass}">${znak} ${displayDiff}</div>`;
    };

    // ==========================================
    // PREVERJANJE SMISELNOSTI VNOSA
    // ==========================================
    // Meje niso izmišljene: izpeljane so iz globalnih normativov za vse spole in generacije,
    // razširjene z velikodušnim faktorjem. Namen ni ocenjevati športnika, ampak ujeti
    // tipkarske napake - odvečno ničlo, vejico na napačnem mestu, prazno polje.
    window.RAZPON_FAKTOR = 2.5;

    window.dovoljenRazpon = function(kljuc, nizjeJeBolje) {
        let najboljsi = null, najslabsi = null;
        Object.keys(window.normativi).forEach(s => {
            Object.keys(window.normativi[s]).forEach(g => {
                let d = window.normativi[s][g][kljuc]; if(!d) return;
                // min = slabši rob normativa, max = boljši rob (tudi pri časih).
                let sl = d.min, db = d.max;
                najslabsi = najslabsi === null ? sl : (nizjeJeBolje ? Math.max(najslabsi, sl) : Math.min(najslabsi, sl));
                najboljsi = najboljsi === null ? db : (nizjeJeBolje ? Math.min(najboljsi, db) : Math.max(najboljsi, db));
            });
        });
        if(najboljsi === null) return null;
        return nizjeJeBolje
            ? { od: najboljsi / 1.5, do: najslabsi * window.RAZPON_FAKTOR }   // časi
            : { od: najslabsi / 4,   do: najboljsi * window.RAZPON_FAKTOR };  // sile, ravni
    };

    // Vrne seznam opisov sumljivih vrednosti. Prazen seznam pomeni, da je vse v redu.
    window.preveriMeritve = function(vrednosti, teza) {
        let lng = window.prevodi[window.tJezik];
        let t = parseFloat(teza) || 70;
        let opozorila = [];
        window.TESTI.forEach(test => {
            let raw = parseFloat(vrednosti[test.kljuc]);
            if(!raw || raw <= 0) return;                 // manjkajoča meritev ni napaka vnosa
            let vhod = test.deliSTezo ? (raw / t) : raw;
            let r = window.dovoljenRazpon(test.kljuc, test.nizjeJeBolje); if(!r) return;
            if(vhod < r.od || vhod > r.do) {
                let ime = lng[test.labelKljuc] || test.kljuc;
                let prikazOd = test.deliSTezo ? (r.od * t) : r.od;
                let prikazDo = test.deliSTezo ? (r.do * t) : r.do;
                opozorila.push(`${ime}: ${raw} ${test.enota} (${lng.vnosPricakovano} ` +
                               `${prikazOd.toFixed(test.decimalke)}–${prikazDo.toFixed(test.decimalke)} ${test.enota})`);
            }
        });
        return opozorila;
    };

    window.getDynamicLimits = function(spol, gen) {
        let hit = [], moc = [], vzd = [], eks = [], agi = [];
        window.aBaza.forEach(a => {
            if(a.spol === spol && a.generacija === gen) {
                let tz = parseFloat(a.teza) || 70;
                if(parseFloat(a.hitrost) > 0) hit.push(parseFloat(a.hitrost));
                if(parseFloat(a.moc) > 0) moc.push(parseFloat(a.moc)/tz);
                if(parseFloat(a.vzdrzljivost) > 0) vzd.push(parseFloat(a.vzdrzljivost));
                if(parseFloat(a.eksplozivnost) > 0) eks.push(parseFloat(a.eksplozivnost)/tz);
                if(parseFloat(a.agilnost) > 0) agi.push(parseFloat(a.agilnost));
            }
        });
        
        let d = window.normativi[spol] && window.normativi[spol][gen] ? window.normativi[spol][gen] : window.normativi['M']['U17'];
        
        let mediana = (u) => {
            let n = u.length, s = Math.floor(n / 2);
            return n % 2 ? u[s] : (u[s - 1] + u[s]) / 2;
        };

        // PREJ: povprečje ± 2 standardna odklona.
        // Ena sama napačna meritev (npr. 4.000.000 N namesto 4.000) je povprečje in odklon
        // odnesla v nebo, vsi ostali pa so padli na nekaj deset točk.
        //
        // ZDAJ: mediana in MAD (mediana absolutnih odklonov). Oba sta odporna na skrajne
        // vrednosti - polovica meritev bi morala biti napačnih, da bi se lestvica premaknila.
        // Faktor 1.4826 poskrbi, da je MAD pri normalni porazdelitvi enak standardnemu
        // odklonu, zato ostaja pomen "±2 odklona" isti kot prej.
        //
        // Percentilov nisem uporabil: pri desetih meritvah 95. percentil pristane tik ob
        // najvišji vrednosti, torej tik ob napaki, in problem ostane.
        let getStat = (arr, lB, dMin, dMax, minS) => {
            // Pod petimi meritvami je vsaka statistika naključje - takrat globalni normativ.
            if(arr.length < 5) return { min: dMin, max: dMax, mean: null, std: null };
            let u = [...arr].sort((x, y) => x - y);
            let med = mediana(u);
            let odkloni = u.map(v => Math.abs(v - med)).sort((x, y) => x - y);
            let raztros = mediana(odkloni) * 1.4826;
            if(!(raztros > 0) || raztros < minS) raztros = minS;   // izenačena skupina
            let slab = lB ? med + (2 * raztros) : med - (2 * raztros);
            let dob  = lB ? med - (2 * raztros) : med + (2 * raztros);
            return { min: slab, max: dob, mean: med, std: raztros };
        };
        
        return {
            hitrost: getStat(hit, true, d.hitrost.min, d.hitrost.max, 0.15),
            moc: getStat(moc, false, d.moc.min, d.moc.max, 1.0),
            vzdrzljivost: getStat(vzd, false, d.vzdrzljivost.min, d.vzdrzljivost.max, 1.0),
            eksplozivnost: getStat(eks, false, d.eksplozivnost.min, d.eksplozivnost.max, 2.5),
            agilnost: getStat(agi, true, d.agilnost.min, d.agilnost.max, 0.15)
        };
    };

    // Cache limitov po (mode|spol|gen), da se getDynamicLimits (ki sprehodi celo bazo)
    // ne kliče znova za isto kombinacijo znotraj iste "seje" izrisovanja.
    // Invalidira se ob vsakem osveziGalerijo() in ob preklopu ratingMode.
    window.limitiCache = {};
    window.invalidirajLimitCache = function() { window.limitiCache = {}; };

    // Preklopnik GLOBAL/LOCAL nima učinka, kadar so prikazane VEČ generacij hkrati
    // (Lestvica vedno, Baza pri "Vse Generacije") - v teh primerih ga vizualno in
    // funkcionalno onemogočimo, namesto da bi uporabnik klikal stikalo, ki navidez
    // "ne dela ničesar".
    window.posodobiStanjeModePreklopnika = function(onemogoceno) {
        let chk = document.getElementById('chkRatingToggle');
        let wrap = document.querySelector('.mode-switch-wrapper');
        let opomba = document.getElementById('modePreklopnikOpomba');
        if(!chk || !wrap) return;
        chk.disabled = onemogoceno;
        wrap.style.opacity = onemogoceno ? '0.4' : '1';
        wrap.style.pointerEvents = onemogoceno ? 'none' : 'auto';
        wrap.style.transition = 'opacity 0.3s';
        if(opomba) {
            opomba.style.display = onemogoceno ? 'block' : 'none';
            opomba.innerText = onemogoceno ? window.prevodi[window.tJezik].opombaPreklopnikOnemogocen : '';
        }
    };

    window.getLimits = function(spol, gen) {
        let s = spol || 'M'; let g = gen || 'U17';
        if(!window.normativi[s] || !window.normativi[s][g]) { s='M'; g='U17'; }
        let key = window.ratingMode + '|' + s + '|' + g;
        if(window.limitiCache[key]) return window.limitiCache[key];
        let result = (window.ratingMode === 'LOCAL') ? window.getDynamicLimits(s, g) : window.normativi[s][g];
        window.limitiCache[key] = result;
        return result;
    };

    window.toggleRatingMode = function(fromModal = false) {
        let chk = document.getElementById('chkRatingToggle');
        if(!fromModal && chk) { window.ratingMode = chk.checked ? 'LOCAL' : 'GLOBAL'; }
        else { window.ratingMode = window.ratingMode === 'GLOBAL' ? 'LOCAL' : 'GLOBAL'; }
        if(chk) chk.checked = (window.ratingMode === 'LOCAL');
        window.invalidirajLimitCache();
        window.izracunajBadgeRekorde();

        if(fromModal) { window.izrisiModalKartico(); }
        else { window.spremeniJezik(window.tJezik); }
    };

    window.prikaziPraznoKartico = function() {
        let lng = window.prevodi[window.tJezik];
        window.setT('karticaIme', lng.neznan); window.setT('karticaDetajli', ""); window.setT('karticaOvr', "0"); window.setT('karticaRank', "IRON"); window.setT('mHit', "0"); window.setT('mMoc', "0"); window.setT('mVzd', "0"); window.setT('mSko', "0"); window.setT('mAgi', "0");
        let k = document.getElementById('kartica'); if(k) k.className = "fifa-kartica rank-iron";
        let sO = document.getElementById('slikaOkvir'); if(sO) sO.style.backgroundImage = "";
        if(window.radarGraf) { window.radarGraf.data.datasets[0].data = [0,0,0,0,0]; window.radarGraf.update(); }
        window.setH('karticaZnacke', ""); let leg = document.getElementById('legendaZnack'); if(leg) leg.style.display = 'none';
        document.querySelectorAll('.stat-diff, .ovr-diff').forEach(el => el.style.display = 'none');
        let hNav = document.getElementById('mainHistoryNav'); if(hNav) hNav.style.display = 'none';
        let bge = document.getElementById('kModeBadge'); if(bge) bge.style.display = 'none';
        window.setH('prikazPodatkiPanel', '');
        window.setH('karticaCast', '');
        window.setH('mojaHrbet', '');
    };

    // Predračuna rekorde (najvišji OVR, najhitrejši, najmočnejši ...) EN krat za celo bazo,
    // namesto da vsak klic izracunajZnacke() sam sprehodi celoten aBaza (prej O(n) na kartico,
    // torej O(n^2) za celo galerijo). Kliče se iz osveziGalerijo() in ob preklopu ratingMode.
    // ===== HALL OF FAME: muzej rekordov =====
    // Poišče DRŽALCE rekordov (ne le vrednosti, kot badgeRekordi). Vsak rekord pripada
    // konkretni meritvi - torej konkretni sezoni konkretnega športnika.
    window.izracunajSlavo = function() {
        let baza = window.aBaza || [];
        if(baza.length === 0) return null;

        // Kategorije: ključ v podatkih, ali je nižje bolje, oznaka in enota.
        // Naslovi rekordov gredo skozi prevode - polje 'naslovKljuc' kaže v window.prevodi.
        let kategorije = [
            { kljuc: 'hitrost',       nizjeBolje: true,  naslovKljuc: 'rekHitrost',      ikona: 'fa-bolt',         enota: 's', barva: '#4facfe' },
            { kljuc: 'moc',           nizjeBolje: false, naslovKljuc: 'rekMoc',          ikona: 'fa-dumbbell',     enota: 'N', barva: '#ff7675' },
            { kljuc: 'eksplozivnost', nizjeBolje: false, naslovKljuc: 'rekEksploz',      ikona: 'fa-gauge-high',   enota: 'N', barva: '#fdcb6e' },
            { kljuc: 'agilnost',      nizjeBolje: true,  naslovKljuc: 'rekAgilnost',     ikona: 'fa-wave-square',  enota: 's', barva: '#00cec9' },
            { kljuc: 'vzdrzljivost',  nizjeBolje: false, naslovKljuc: 'rekVzdrzljivost', ikona: 'fa-heart-pulse',  enota: 'lvl', barva: '#a29bfe' }
        ];

        let rekordi = kategorije.map(k => {
            let najboljsi = null, najVrednost = k.nizjeBolje ? Infinity : -Infinity;
            baza.forEach(a => {
                let v = parseFloat(a[k.kljuc]);
                if(!v || v <= 0) return; // manjkajoča meritev se ne šteje
                if(k.nizjeBolje ? (v < najVrednost) : (v > najVrednost)) { najVrednost = v; najboljsi = a; }
            });
            return najboljsi ? { ...k, atlet: najboljsi, vrednost: najVrednost } : null;
        }).filter(Boolean);

        // Kralj: najvišji OVR vseh časov.
        let kralj = null, najOvr = -1;
        baza.forEach(a => {
            let o = window.izracunajOcene(a).ovr;
            if(o > najOvr) { najOvr = o; kralj = a; }
        });

        return { rekordi, kralj, kraljOvr: najOvr, stMeritev: baza.length };
    };

    window.izrisiSlavo = function() {
        let vsebina = document.getElementById('slavaVsebina');
        if(!vsebina) return;
        let lng = window.prevodi[window.tJezik];
        let s = window.izracunajSlavo();
        if(!s) { vsebina.innerHTML = '<div class="slava-prazno">' + lng.slavaPrazno + '</div>'; return; }

        let esc = window.escapeHtml;
        let kraljBarva = window.getColorForOvr(s.kraljOvr);

        // Ploščice rekordov - vsaka vsebuje MINI KARTICO rekorderja (fotografija + OVR),
        // da je rekord povezan z osebo, ne le s številko.
        let plosce = s.rekordi.map((r, i) => {
            let a = r.atlet;
            let vred = r.enota === 's' ? r.vrednost.toFixed(2) : Math.round(r.vrednost);
            let ovr = window.izracunajOcene(a).ovr;
            let ovrBarva = window.getColorForOvr(ovr);
            return `
            <div class="slava-plosca" style="--slava-barva:${r.barva}; animation-delay:${0.12 * i + 0.35}s;"
                 onclick="window.poglejKartico('${a.id}')" title="${lng.slavaPoglej}">
                <div class="slava-plosca-naslov"><i class="fa-solid ${r.ikona}"></i> ${lng[r.naslovKljuc] || r.kljuc}</div>

                <div class="slava-mini-kartica" style="--mk-barva:${ovrBarva};">
                    <div class="slava-mini-slika" id="slavaSlika_${a.id}_${r.kljuc}"></div>
                    <div class="slava-mini-ovr">${ovr}</div>
                </div>

                <div class="slava-plosca-vrednost">${vred}<span>${r.enota}</span></div>
                <div class="slava-plosca-ime">${esc(a.ime || '—')}</div>
                <div class="slava-plosca-sezona">${esc(window.prikaziSezono(a.sezona))}${a.generacija ? ' · ' + esc(a.generacija) : ''}</div>
            </div>`;
        }).join('');

        vsebina.innerHTML = `
            <div class="slava-ovoj">
                <div class="slava-glava">
                    <div class="slava-naslov">HALL OF FAME</div>
                    <div class="slava-podnaslov">${lng.slavaPodnaslov}</div>
                    <div class="slava-crta"></div>
                </div>

                <div class="slava-kralj" style="--kralj-barva:${kraljBarva};">
                    <div class="slava-kralj-oznaka">${lng.slavaKraljOznaka}</div>
                    <div class="slava-kralj-kartica">
                        <div class="slava-kralj-slika" id="slavaSlika_kralj"></div>
                        <div class="slava-kralj-ovr">${s.kraljOvr}</div>
                    </div>
                    <div class="slava-kralj-ime">${esc(s.kralj.ime || '—')}</div>
                    <div class="slava-kralj-detajl">${esc(window.prikaziSezono(s.kralj.sezona))}${s.kralj.generacija ? ' · ' + esc(s.kralj.generacija) : ''}</div>
                    <button class="slava-kralj-gumb" onclick="window.poglejKartico('${s.kralj.id}')">${lng.slavaPoglej}</button>
                </div>

                <div class="slava-mreza">${plosce}</div>

                <div class="slava-noga">${lng.slavaNoga.replace('{n}', s.stMeritev)}</div>
            </div>`;

        // Fotografije naložimo PO izrisu (asinhrono), da se muzej pokaže takoj.
        let naloziSliko = async (atletId, elId) => {
            try {
                let url = await window.pridobiSliko(atletId);
                let el = document.getElementById(elId);
                if(el && url) { el.style.backgroundImage = `url('${url}')`; el.classList.add('ima-sliko'); }
            } catch(e) { /* brez slike ostane privzeti videz */ }
        };
        naloziSliko(s.kralj.id, 'slavaSlika_kralj');
        s.rekordi.forEach(r => naloziSliko(r.atlet.id, `slavaSlika_${r.atlet.id}_${r.kljuc}`));
    };

    window.izracunajBadgeRekorde = function() {
        let mO = -1, mRM = -1, mH = 999, mM = -1, mV = -1, mE = -1, mA = 999;
        let perGenMax = {}; let t99 = [];
        window.aBaza.forEach(a => {
            let ocR = window.izracunajOcene(a);
            let vT = ocR.teza;
            let aH = ocR.ocene.hitrost, aM = ocR.ocene.moc, aV = ocR.ocene.vzdrzljivost, aE = ocR.ocene.eksplozivnost, aA = ocR.ocene.agilnost;
            let o = Math.round((aH + aM + aV + aE + aA)/5);

            t99.push(o); if(o > mO) mO = o;
            let gen = a.generacija || 'U17'; if(!perGenMax[gen] || o > perGenMax[gen]) perGenMax[gen] = o;
            let rm = (parseFloat(a.moc) || 0) / vT; if(rm > mRM) mRM = rm;
            let h = parseFloat(a.hitrost) || 999; if(h < mH && h > 0) mH = h;
            let m = parseFloat(a.moc) || -1; if(m > mM) mM = m;
            let v = parseFloat(a.vzdrzljivost) || -1; if(v > mV) mV = v;
            let e = parseFloat(a.eksplozivnost) || -1; if(e > mE) mE = e;
            let ag = parseFloat(a.agilnost) || 999; if(ag < mA && ag > 0) mA = ag;
        });

        // "IN-FORM": športnik z največjim skokom OVR med zaporednima sezonama.
        // Računa se tu, ker ta funkcija tako ali tako enkrat prehodi celotno bazo.
        // Zahteva vsaj 2 sezoni - pri športnikih z eno meritvijo se (pravilno) ne aktivira.
        let ovrZa = (a) => window.izracunajOcene(a).ovr;
        let stSez = (a) => parseInt((a.sezona || '').replace(/\D/g, '')) || 0;
        let skupine = {};
        window.aBaza.forEach(a => {
            let k = a.atletKljuc || (a.emailSportnika ? window.anonKljuc(a.emailSportnika) : null) || a.id;
            (skupine[k] = skupine[k] || []).push(a);
        });
        let inFormId = null, inFormDelta = 0;
        Object.values(skupine).forEach(sez => {
            if(sez.length < 2) return;
            let urejeno = [...sez].sort((x, y) => stSez(x) - stSez(y));
            let zadnji = urejeno[urejeno.length - 1];
            let prejsnji = urejeno[urejeno.length - 2];
            let d = ovrZa(zadnji) - ovrZa(prejsnji);
            if(d > inFormDelta) { inFormDelta = d; inFormId = zadnji.id; }
        });

        window.badgeRekordi = { mO, perGenMax, mRM, mH, mM, mV, mE, mA, t99, inFormId, inFormDelta };
        window.izracunajOkvirje(skupine, stSez);
    };

    // ==========================================================================
    // POSEBNI OKVIRJI
    // ==========================================================================
    // Pravila proti "cirkusu":
    //  1) Vsaka kartica prikaže NAJVEČ EN okvir (najvišja prioriteta zmaga).
    //  2) Samo najredkejši okvirji so animirani ("glasni") - teh je po definiciji po eden
    //     v celotni bazi. Vsi ostali so tihi: statičen barvni rob, brez animacije.
    //  3) Pragovi so strogi. Če bi okvir dobila polovica baze, ni okvir - je ozadje.
    //
    // Okvir se veže na ZADNJO sezono športnika (tisto, ki se prikazuje kot aktualna).
    // NAČELO: značke povedo KDO SI (posnetek ene sezone), znaki časti pa KAKO SE PREMIKAŠ
    // (trajektorija skozi sezone). Zato so bili odstranjeni "Kralj baze", "Kralj generacije"
    // in "Specialist" - vsi trije so podvajali obstoječe značke (The One, Gen. Talent,
    // Specialist). Vsak znak spodaj meri nekaj, česar značke NE morejo izraziti.
    window.OKVIRJI = {
        vFormi:       { prio: 100, glasen: true,  ikona: '🔥', barva: '#ff9f43' },
        preporod:     { prio: 90,  glasen: false, ikona: '🦅', barva: '#fd79a8' },
        popolnaSez:   { prio: 80,  glasen: false, ikona: '⭐', barva: '#ffd369' },
        preboj:       { prio: 70,  glasen: false, ikona: '🚀', barva: '#2ecc71' },
        zagon:        { prio: 60,  glasen: false, ikona: '⚡', barva: '#00cec9' },
        konstanta:    { prio: 50,  glasen: false, ikona: '💎', barva: '#74b9ff' },
        preobrazba:   { prio: 45,  glasen: false, ikona: '🧬', barva: '#55efc4' },
        ravnovesje:   { prio: 40,  glasen: false, ikona: '⚖️', barva: '#a29bfe' },
        veteran:      { prio: 30,  glasen: false, ikona: '🛡️', barva: '#b2915f' },
        novinec:      { prio: 20,  glasen: false, ikona: '🌱', barva: '#4facfe' }
    };

    window.okvirjiPoAtletu = {};   // { zapisId: { kljuc, ime, opis } }

    window.izracunajOkvirje = function(skupine, stSez) {
        let lng = window.prevodiOkvirjev[window.tJezik];
        window.okvirjiPoAtletu = {};
        let rek = window.badgeRekordi || {};

        // Vsak športnik: aktualni zapis (zadnja sezona) + celotna zgodovina, urejena NARAŠČAJOČE.
        // Vsi znaki časti merijo TRAJEKTORIJO, zato potrebujejo zgodovino, ne le posnetka.
        let ovrOf = (a) => window.izracunajOcene(a).ovr;

        Object.values(skupine).forEach(sez => {
            let zgod = [...sez].sort((x, y) => stSez(x) - stSez(y)); // naraščajoče po sezoni
            let zapis = zgod[zgod.length - 1];
            let o = ovrOf(zapis);
            let ovrji = zgod.map(ovrOf);
            let n = zgod.length;
            let kandidati = [];

            // --- 1) V FORMI: največji napredek v celotni bazi (edini "glasen" znak) ---
            if(rek.inFormId === zapis.id && rek.inFormDelta >= 3) {
                kandidati.push({ kljuc: 'vFormi', opis: lng.vFormiOpis.replace('{d}', rek.inFormDelta) });
            }

            // --- 2) PREPOROD: OVR je enkrat upadel, nato presegel prejšnji vrh ---
            // Značke tega ne morejo izraziti - ne vedo, da si padel in se pobral.
            if(n >= 3) {
                let bilUpad = false, vrhPredUpadom = 0;
                for(let i = 1; i < ovrji.length; i++) {
                    if(ovrji[i] < ovrji[i-1]) { bilUpad = true; vrhPredUpadom = Math.max(vrhPredUpadom, ...ovrji.slice(0, i)); }
                }
                if(bilUpad && o > vrhPredUpadom) {
                    kandidati.push({ kljuc: 'preporod', opis: lng.preporodOpis.replace('{v}', vrhPredUpadom).replace('{o}', o) });
                }
            }

            // --- 3) POPOLNA SEZONA: VSEH 5 ocen zraslo glede na prejšnjo sezono ---
            if(n >= 2) {
                let zdaj = window.izracunajOcene(zapis).ocene;
                let prej = window.izracunajOcene(zgod[n - 2]).ocene;
                let vseZrasle = window.TESTI.every(t => zdaj[t.kljuc] > prej[t.kljuc]);
                if(vseZrasle) kandidati.push({ kljuc: 'popolnaSez', opis: lng.popolnaSezOpis });
            }

            // --- 4) PREBOJ: +5 OVR ali več od prejšnje sezone ---
            if(n >= 2) {
                let d = o - ovrji[n - 2];
                if(d >= 5) kandidati.push({ kljuc: 'preboj', opis: lng.prebojOpis.replace('{d}', d) });
            }

            // --- 5) ZAGON: OVR raste dve sezoni zapored ---
            if(n >= 3) {
                let d1 = ovrji[n - 2] - ovrji[n - 3];
                let d2 = o - ovrji[n - 2];
                if(d1 > 0 && d2 > 0) {
                    kandidati.push({ kljuc: 'zagon', opis: lng.zagonOpis.replace('{d1}', '+' + d1).replace('{d2}', '+' + d2) });
                }
            }

            // --- 6) KONSTANTA: 3+ sezone brez enega samega upada ---
            if(n >= 3) {
                let brezUpada = ovrji.every((v, i) => i === 0 || v >= ovrji[i - 1]);
                if(brezUpada) kandidati.push({ kljuc: 'konstanta', opis: lng.konstantaOpis.replace('{n}', n) });
            }

            // --- 7) PREOBRAZBA: FFMI zrasel za >= 1.0 (rast puste mase, NE padec maščobe) ---
            if(n >= 2) {
                let fNov = window.izracunajFFMI(zapis.teza, zapis.visina, zapis.odstotekMascobe, zapis.misicnaMasa);
                let fStar = window.izracunajFFMI(zgod[n-2].teza, zgod[n-2].visina, zgod[n-2].odstotekMascobe, zgod[n-2].misicnaMasa);
                if(fNov && fStar) {
                    let d = fNov.ffmiNorm - fStar.ffmiNorm;
                    if(d >= 1.0) kandidati.push({ kljuc: 'preobrazba', opis: lng.preobrazbaOpis.replace('{d}', '+' + d.toFixed(1)) });
                }
            }

            // --- 8) RAVNOVESJE: razlika med najmočnejšo in najšibkejšo oceno se je zmanjšala za >= 10 ---
            // Nagradi delo na ŠIBKI točki - protiutež znački "Specialist", ki meri razliko.
            if(n >= 2) {
                let razp = (obj) => { let v = window.TESTI.map(t => obj[t.kljuc]); return Math.max(...v) - Math.min(...v); };
                let rZdaj = razp(window.izracunajOcene(zapis).ocene);
                let rPrej = razp(window.izracunajOcene(zgod[n - 2]).ocene);
                let zmanjsanje = rPrej - rZdaj;
                if(zmanjsanje >= 10) kandidati.push({ kljuc: 'ravnovesje', opis: lng.ravnovesjeOpis.replace('{d}', zmanjsanje).replace('{r}', rZdaj) });
            }

            // --- 9) VETERAN: 4+ sezone v sistemu ---
            if(n >= 4) kandidati.push({ kljuc: 'veteran', opis: lng.veteranOpis.replace('{n}', n) });

            // --- 10) NOVINEC: prva sezona IN OVR >= 75 ---
            if(n === 1 && o >= 75) kandidati.push({ kljuc: 'novinec', opis: lng.novinecOpis.replace('{o}', o) });

            if(kandidati.length === 0) return;
            // Samo NAJVIŠJI po prioriteti - nikoli dva znaka na eni kartici.
            kandidati.sort((x, y) => window.OKVIRJI[y.kljuc].prio - window.OKVIRJI[x.kljuc].prio);
            let zmagovalec = kandidati[0];
            window.okvirjiPoAtletu[zapis.id] = { kljuc: zmagovalec.kljuc, ime: lng[zmagovalec.kljuc], opis: zmagovalec.opis };
        });
    };

    window.MAX_NAGIB = 9; // stopinj
    window.pripniTiltInFoil = function(koren) {
        let cilji = (koren || document).querySelectorAll('.efekt-ovoj, .tilt-ovoj');
        cilji.forEach(ovoj => {
            if(ovoj.dataset.tiltPripet === '1') return; // ne podvajaj poslušalcev
            ovoj.dataset.tiltPripet = '1';

            let tarca = ovoj.querySelector('.tilt-tarca');   // lahko je null (kartice v Bazi)
            let foili = ovoj.querySelectorAll('.foil-plast'); // vsi foili (sprednji + hrbtni)
            if(!tarca && foili.length === 0) return;
            let cakaNaSlicico = false;

            ovoj.addEventListener('pointermove', (e) => {
                if(window.cMode || window.dMode) return; // med izbiranjem kartic naj bo mirno
                if(cakaNaSlicico) return;
                cakaNaSlicico = true;
                requestAnimationFrame(() => {
                    cakaNaSlicico = false;
                    let r = ovoj.getBoundingClientRect();
                    if(!r.width || !r.height) return;
                    let px = (e.clientX - r.left) / r.width;   // 0..1
                    let py = (e.clientY - r.top) / r.height;   // 0..1
                    if(tarca) {
                        tarca.style.setProperty('--tilt-x', (-(py - 0.5) * 2 * window.MAX_NAGIB).toFixed(2) + 'deg');
                        tarca.style.setProperty('--tilt-y', ((px - 0.5) * 2 * window.MAX_NAGIB).toFixed(2) + 'deg');
                    }
                    foili.forEach(f => {
                        // Hrbtna stran je zrcaljena (rotateY 180deg), zato na njej obrnemo X,
                        // da svetloba sledi miški v pravilno smer.
                        let mx = f.classList.contains('foil-plast-back') ? (100 - px * 100) : (px * 100);
                        f.style.setProperty('--mx', mx.toFixed(1) + '%');
                        f.style.setProperty('--my', (py * 100).toFixed(1) + '%');
                    });
                });
            });

            ovoj.addEventListener('pointerleave', () => {
                if(tarca) { tarca.style.setProperty('--tilt-x', '0deg'); tarca.style.setProperty('--tilt-y', '0deg'); }
            });
        });
    };

    // ==========================================
    // PRELEVITEV RANGA (rank up)
    // ==========================================
    // POZOR: izracunajVse() se kliče ob VSAKI tipki v vnosnem obrazcu, zato animacije ne
    // smemo sprožiti od tam brez varovala - sicer bi se sprožila ob vsakem znaku.
    // Varovalo: proslavimo največ enkrat na (športnik + sezona) in samo v čistem pogledu
    // "Moja Kartica" (ne med admin urejanjem).
    window.zeProslavljeno = {};

    window.dobiRangIndex = function(o) {
        let idx = 0;
        for(let i = 0; i < window.RANK_PRAGOVI.length; i++) if(o >= window.RANK_PRAGOVI[i].min) idx = window.RANK_PRAGOVI[i].idx;
        return idx;
    };

    // Zgradi POLNO veliko kartico za prelevitveno okno.
    // Prej je bila to poenostavljena različica (brez fotografije in brez vrstice statistik),
    // zato je kartica v oknu izgledala nedokončano - zdaj vsebuje vse elemente kot prava.
    window.zgradiKarticoZaPrelevitev = function(a, slika) {
        let lng = window.prevodi[window.tJezik];
        let oc = window.izracunajOcene(a);
        let aS = oc.spol; let aG = oc.gen; let vT = oc.teza;
        let sH = oc.ocene.hitrost, sM = oc.ocene.moc, sV = oc.ocene.vzdrzljivost, sE = oc.ocene.eksplozivnost, sA = oc.ocene.agilnost;
        let o = oc.ovr;

        let ri = window.getRankClassAndName(o, lng);
        let col = window.getColorForOvr(o);
        let bg = slika ? `url('${slika}')` : '';

        let cY = new Date().getFullYear();
        let roj = parseInt(a.letorojstva); if(isNaN(roj)) roj = cY - 16;
        let starost = cY - roj;
        let zObjs = window.izracunajZnacke(sH, sM, sV, sE, sA, o, aG, vT, starost,
            parseFloat(a.hitrost)||0, parseFloat(a.moc)||0, parseFloat(a.vzdrzljivost)||0,
            parseFloat(a.eksplozivnost)||0, parseFloat(a.agilnost)||0);
        let znackeHTML = (zObjs || []).slice(0, 5).map(z => {
            let bC = (z.t===5)?"#ff9f43":(z.t===4)?"#00f2fe":(z.t===3)?"#a29bfe":(z.t===2)?"#ff7675":(z.t===1)?"#f1c40f":"#2ecc71";
            return `<div class="znacka-wrap tier-${z.t}" style="color:${bC};"><div class="znacka-krog" style="border-color:${bC};"><i class="fa-solid ${z.ikona}"></i></div></div>`;
        }).join('');

        return `<div class="fifa-kartica ${ri.c}" style="margin:0; box-shadow: 0 0 34px ${col};">
            <div class="notranji-rob"></div>
            ${o >= 98 ? '<div class="g99-pulsing-glow"></div>' : ''}
            <div class="slika-atleta-bg" style="background-image:${bg};"></div>
            <div class="kartica-ovr-wrapper" style="--rang-barva:${col};"><div class="kartica-ovr-label"><div class="ovr-stevilka">${o}</div></div></div>
            <div class="znacke-kontejner">${znackeHTML}</div>
            <div class="kartica-bottom">
                <div class="kartica-bottom-ime">${window.escapeHtml(a.ime) || lng.neznan}</div>
                <div class="kartica-bottom-rank" style="color:${col};">${ri.n}</div>
                <div class="kartica-bottom-detajli">${starost} ${lng.leta} | ${aS} | ${aG} | ${a.visina||'-'} ${lng.cm} | ${vT} ${lng.kg} | ${window.prikaziSezono(a.sezona)}</div>
                <div class="stat-panel-ikone">
                    <div class="ikona-box"><i class="fa-solid fa-bolt ikona-img"></i><div class="ikona-val">${sH}</div></div>
                    <div class="ikona-box"><i class="fa-solid fa-dumbbell ikona-img"></i><div class="ikona-val">${sM}</div></div>
                    <div class="ikona-box"><i class="fa-solid fa-heart-pulse ikona-img"></i><div class="ikona-val">${sV}</div></div>
                    <div class="ikona-box"><i class="fa-solid fa-gauge-high ikona-img"></i><div class="ikona-val">${sE}</div></div>
                    <div class="ikona-box"><i class="fa-solid fa-wave-square ikona-img"></i><div class="ikona-val">${sA}</div></div>
                </div>
            </div>
        </div>`;
    };

    window.proslaviNapredek = function(kljuc, novOvr, starOvr) {
        if(!kljuc || window.zeProslavljeno[kljuc]) return;
        let panelV = document.getElementById('panelVnos');
        if(panelV && panelV.style.display !== 'none') return; // ne med admin urejanjem
        window.zeProslavljeno[kljuc] = true;

        let barva = window.getColorForOvr(novOvr);
        let jeNapredovanje = window.dobiRangIndex(novOvr) > window.dobiRangIndex(starOvr);

        if(!jeNapredovanje) {
            // Napredek BREZ spremembe ranga: samo nežen utrip ocene - polna prelevitev mora
            // ostati redek, pomenljiv dogodek, sicer izgubi učinek.
            let kartica = document.getElementById('kartica');
            let ovrEl = kartica ? kartica.querySelector('.kartica-ovr-label') : null;
            if(ovrEl) {
                ovrEl.style.setProperty('--rang-barva', barva);
                ovrEl.classList.remove('napredek-utrip'); void ovrEl.offsetWidth;
                ovrEl.classList.add('napredek-utrip');
                setTimeout(() => ovrEl.classList.remove('napredek-utrip'), 1200);
            }
            return;
        }

        window.odpriRankUp(novOvr, starOvr);
    };

    // Pop-up prelevitve: stara kartica se pred tabo dobesedno prelevi v novo (kot v igrah).
    window.odpriRankUp = async function(novOvr, starOvr) {
        let z = window.tZgodovina; if(!z || !z[window.mInd]) return;
        let novA = z[window.mInd];
        let starA = z[window.mInd + 1] || novA;
        let lng = window.prevodi[window.tJezik];
        let barva = window.getColorForOvr(novOvr);
        // Slika je v ločeni kolekciji, zato je ob hitri prelevitvi morda še ni v spominu -
        // brez tega bi se kartica v oknu izrisala brez fotografije.
        let slika = window.gSlika || novA.slika || window.slikeCache[novA.id] || '';
        if(!slika && novA.id) { try { slika = await window.pridobiSliko(novA.id); } catch(e) { slika = ''; } }

        let modal = document.getElementById('rankUpModal');
        let oder = document.getElementById('ruOder');
        if(!modal || !oder) return;

        modal.style.setProperty('--rang-barva', barva);
        oder.style.setProperty('--rang-barva', barva);

        oder.innerHTML = `
            <div class="ru-blisk"></div>
            <div class="ru-kartica ru-stara">${window.zgradiKarticoZaPrelevitev(starA, slika)}</div>
            <div class="ru-kartica ru-nova efekt-ovoj ima-foil ${window.dobiFoilTier(novOvr)}">
                <div class="poglej-flip" id="ruFlip" onclick="window.obrniRankUpKartico()">
                    <div class="poglej-face poglej-front">${window.zgradiKarticoZaPrelevitev(novA, slika)}</div>
                    ${window.dobiHrbtnoStranHTML(novA, novOvr)}
                </div>
            </div>
            <div class="ru-obroc"></div><div class="ru-obroc z2"></div><div class="ru-obroc z3"></div>
        `;

        let ime = window.getRankClassAndName(novOvr, lng).n;
        let ri = document.getElementById('ruRangIme');
        ri.innerText = ime; ri.style.setProperty('--rang-barva', barva);
        window.setT('ruNaslov', lng.ruNaslov);
        window.setT('ruNamig', '↻ ' + lng.klikniZaObrat);
        window.setT('ruPodnapis', `${starOvr} → ${novOvr} OVR · ${window.getRankClassAndName(starOvr, lng).n} → ${ime}`);

        document.getElementById('rankUpOverlay').style.display = 'block';
        modal.style.display = 'flex';
        window.pripniTiltInFoil(oder); // foil sledi miški tudi v prelevitvenem oknu
    };

    window.zapriRankUp = function() {
        document.getElementById('rankUpOverlay').style.display = 'none';
        document.getElementById('rankUpModal').style.display = 'none';
        document.getElementById('ruOder').innerHTML = '';
    };

    // Klik na kartico v "Poglej" oknu jo obrne (fizični občutek prave kartice).
    // Obrat kartice v "Moja Kartica". Klik na fotografijo je izvzet (stopPropagation v HTML),
    // ker tam ostane nalaganje slike - sicer bi obračanje ukradlo to funkcijo.
    // Zavihki v "Moja Kartica" - vsebina se izbira, ne kopiči
    window.mkZavihek = function(kateri) {
        let zavihki = { pregled: 'mkPanelPregled', analitika: 'mkPanelAnalitika', dosezki: 'mkPanelDosezki' };
        let gumbi = { pregled: 'mkTabPregled', analitika: 'mkTabAnalitika', dosezki: 'mkTabDosezki' };
        Object.keys(zavihki).forEach(k => {
            let p = document.getElementById(zavihki[k]);
            let g = document.getElementById(gumbi[k]);
            if(p) p.style.display = (k === kateri) ? 'flex' : 'none';
            if(g) g.classList.toggle('active', k === kateri);
        });
        // Radar se izriše šele, ko je zavihek viden - Chart.js na skritem elementu dobi
        // velikost 0 in graf ostane prazen.
        if(kateri === 'analitika') setTimeout(() => { if(window.izracunajVse) window.izracunajVse(); }, 30);
    };

    window.obrniMojoKartico = function(e) {
        let f = document.getElementById('mojaFlip');
        if(f) f.classList.toggle('obrnjena');
    };

    window.obrniPoglejKartico = function() {
        let f = document.getElementById('poglejFlip');
        if(f) f.classList.toggle('obrnjena');
    };

    // Tudi novo kartico v prelevitvenem oknu je mogoče obrniti (enako kot v "Poglej").
    window.obrniRankUpKartico = function() {
        let f = document.getElementById('ruFlip');
        if(f) f.classList.toggle('obrnjena');
    };

    window.izracunajZnacke = function(sH, sM, sV, sE, sA, ovr, gen, teza, starost, rawH, rawM, rawV, rawE, rawA) {
        let b = []; let lng = window.prevodiZnack[window.tJezik];
        if(!window.badgeRekordi) window.izracunajBadgeRekorde();
        let rek = window.badgeRekordi;
        let mO = rek.mO, mRM = rek.mRM, mH = rek.mH, mM = rek.mM, mV = rek.mV, mE = rek.mE, mA = rek.mA;
        let mGO = (rek.perGenMax[gen] !== undefined) ? rek.perGenMax[gen] : -1;
        let t99 = rek.t99.slice();

        if(ovr>mO) mO=ovr; if(rawH<mH && rawH>0) mH=rawH; if(rawM>mM) mM=rawM; if(rawV>mV) mV=rawV; if(rawE>mE) mE=rawE; if(rawA<mA && rawA>0) mA=rawA; if(ovr>mGO) mGO=ovr;
        let cRM = rawM / (parseFloat(teza) || 70); t99.push(ovr); t99.sort((x,y) => y - x);
        // "G99 Klub" (top 99 po OVR) ima smisel samo, če baza dejansko ima vsaj 99 zapisov -
        // prej je pri manjši bazi prag padel na najslabšo oceno v bazi, zato jo je dobil vsak.
        let dovoljVelikaBazaZaG99Klub = t99.length >= 99;
        let tG = dovoljVelikaBazaZaG99Klub ? t99[98] : Infinity;

        if (ovr >= mO && ovr > 0) b.push(lng.z1); if (rawH <= mH && rawH > 0) b.push(lng.z3); if (rawM >= mM && rawM > 0) b.push(lng.z4); if (rawV >= mV && rawV > 0) b.push(lng.z5); if (rawE >= mE && rawE > 0) b.push(lng.z6); if (rawA <= mA && rawA > 0) b.push(lng.z7); if (cRM >= mRM && cRM > 0) b.push(lng.z8);
        if (ovr >= tG && ovr > 0) b.push(lng.z2); if (ovr >= 98) b.push(lng.z13); if (sH==99||sM==99||sE==99||sV==99||sA==99) b.push(lng.z14); if (ovr >= mGO && ovr > 0) b.push(lng.z9); if (sH >= 90 && sM >= 90 && sV >= 90 && sE >= 90 && sA >= 90) b.push(lng.z10); let c95 = [sH, sM, sV, sE, sA].filter(v => v >= 95).length; if (c95 >= 3) b.push(lng.z11); if (sH >= 90 && sM >= 90) b.push(lng.z12);
        if (sH>=90 && sA>=90) b.push(lng.z21); let maxS = Math.max(sH,sM,sE,sV,sA); let minS = Math.min(sH,sM,sE,sV,sA); if (maxS - minS < 4 && minS >= 80) b.push(lng.z22); if (parseFloat(teza) < 75 && sE >= 95) b.push(lng.z23); if (parseInt(starost) >= 30 && ovr>=85) b.push(lng.z24); if ((gen==='U15'||gen==='U17') && ovr>=85) b.push(lng.z25); let vVis = parseFloat(document.getElementById('visina') ? document.getElementById('visina').value : 0) || 0; if (vVis > 190 && parseFloat(teza) > 90 && sM >= 85) b.push(lng.z15); if (sH >= 85 && sM >= 85 && sV >= 85 && sE >= 85 && sA >= 85) b.push(lng.z16); if (parseInt(starost) >= 35 && ovr >= 80) b.push(lng.z17); if (sH >= 90 && sE >= 90) b.push(lng.z18); if (sA >= 90 && sE >= 90) b.push(lng.z19); if (vVis > 185 && sE >= 90) b.push(lng.z20);
        if (parseFloat(teza) > 90 && sM >= 90) b.push(lng.z30); if (sM>=85 && sH>=85) b.push(lng.z31); if (sM>=85 && sE>=85) b.push(lng.z32); if (sH>=85 && sA>=85) b.push(lng.z33); if (sM>=85 && sV>=85) b.push(lng.z34); if (sH>=85 && sV>=85) b.push(lng.z35); if (sE>=85 && sA>=85) b.push(lng.z36); if (parseFloat(teza) < 70 && sA >= 85 && sH >= 85) b.push(lng.z26); if (sV >= 90 && sM >= 85) b.push(lng.z27); if (parseFloat(teza) < 80 && sM >= 85) b.push(lng.z28); if ((parseFloat(teza) > 90 || vVis > 190) && sA >= 85) b.push(lng.z29);
        if (sH>=90 && sH<99) b.push(lng.z37); if (sM>=90 && sM<99) b.push(lng.z38); if (sE>=90 && sE<99) b.push(lng.z39); if (sV>=90 && sV<99) b.push(lng.z40); if (sA>=90 && sA<99) b.push(lng.z41); if (sH >= 80 && sV >= 80 && sA >= 80) b.push(lng.z44); if (sH >= 80 && sM >= 80 && sV >= 80 && sE >= 80 && sA >= 80) b.push(lng.z42);
        if (ovr >= 75 && ovr < 85) b.push(lng.z51); if (ovr >= 65 && ovr < 75) b.push(lng.z50); if (sH >= 60 && sM >= 60 && sV >= 60 && sE >= 60 && sA >= 60) b.push(lng.z52); let c80 = [sH, sM, sV, sE, sA].filter(v => v >= 80).length; if (c80 >= 2) b.push(lng.z53); let c85 = [sH, sM, sV, sE, sA].filter(v => v >= 85).length; let c8b = [sH, sM, sV, sE, sA].filter(v => v < 80).length; if (c85 === 1 && c8b >= 3) b.push(lng.z54);
        if (sH >= 75 && sH < 90) b.push(lng.z45); if (sM >= 75 && sM < 90) b.push(lng.z46); if (sE >= 75 && sE < 90) b.push(lng.z47); if (sV >= 75 && sV < 90) b.push(lng.z48); if (sA >= 75 && sA < 90) b.push(lng.z49);

        let u = []; let idS = new Set();
        for(let z of b) { if(!idS.has(z.ime)) { u.push(z); idS.add(z.ime); } }
        u.sort((a,b) => b.t - a.t); return u.slice(0, 5); 
    };

    window.izracunajVse = function() {
        let tZ = parseFloat(document.getElementById('teza').value) || 70; 
        let sp = document.getElementById('spol').value; 
        let gn = document.getElementById('generacija').value; 
        let lim = window.getLimits(sp, gn);
        
        let iR = document.getElementById('letorojstva'); 
        let rV = parseInt(iR ? iR.value : "2008") || 2008; 
        let cY = new Date().getFullYear(); 
        let vS = cY - rV; 
        let vi = document.getElementById('visina').value || ""; 
        let lng = window.prevodi[window.tJezik];
        
        let rH = parseFloat(document.getElementById('hitrostVal').value) || 0; 
        let rM = parseFloat(document.getElementById('mocVal').value) || 0; 
        let rVz = parseFloat(document.getElementById('vzdrzljivostVal').value) || 0; 
        let rE = parseFloat(document.getElementById('eksplozivnostVal').value) || 0; 
        let rA = parseFloat(document.getElementById('agilnostVal').value) || 0;
        
        let sH = window.preračunaj(rH, lim.hitrost, true);
        let sM = window.preračunaj(rM / tZ, lim.moc, false);
        let sV = window.preračunaj(rVz, lim.vzdrzljivost, false);
        let sE = window.preračunaj(rE / tZ, lim.eksplozivnost, false);
        let sA = window.preračunaj(rA, lim.agilnost, true);
        
        let o = Math.round((sH + sM + sV + sE + sA) / 5); 
        let iT = document.getElementById('ime').value; 
        window.setT('karticaIme', iT ? iT : lng.neznan);
        
        let sT = sp === 'M' ? (window.tJezik === 'sl' ? 'M' : 'M') : (window.tJezik === 'sl' ? 'Ž' : 'F'); 
        let viS = vi ? ` | ${vi} ${lng.cm}` : ""; 
        let s_val = document.getElementById('sezona').value; 
        let seS = s_val ? ` | <span style="white-space: nowrap;">${s_val}</span>` : "";
        
        let rankInfo = window.getRankClassAndName(o, lng);
        window.setH('karticaDetajli', `${vS} ${lng.leta} | ${sT} | ${gn}${viS} | ${tZ} ${lng.kg}${seS}`); 
        // IN-FORM na Moji Kartici: samo ognjen okvir. Rang ostane nedotaknjen.
        (function(){
            let k = document.getElementById('kartica');
            if(!k) return;
            let aktivenId = (window.tZgodovina && window.tZgodovina[window.mInd]) ? window.tZgodovina[window.mInd].id : null;
            k.classList.toggle('je-in-form', aktivenId ? window.jeVFormi(aktivenId) : false);
            let star = k.querySelector('.in-form-trak'); if(star) star.remove();  // počisti stare kartice
        })();
        window.animirajOVR('karticaOvr', o); 
        window.setT('mHit', sH); 
        window.setT('mMoc', sM); 
        window.setT('mVzd', sV); 
        window.setT('mSko', sE); 
        window.setT('mAgi', sA);
        window.setT('karticaRank', rankInfo.n);

        let pI = window.mInd + 1;

        // BUG FIX: napis sezone se je posodabljal SAMO, kadar je obstajala prejšnja sezona.
        // Ko je bil uporabnik na najstarejši sezoni, je napis obtičal na prejšnji vrednosti -
        // kartica je kazala "Sezona 1", glava pa še vedno "Sezona 2". Zato napis in vidnost
        // navigacije zdaj nastavimo VEDNO, neodvisno od tega, ali je s čim primerjati.
        if(window.tZgodovina && window.tZgodovina.length > 0) {
            let navEl = document.getElementById('mainHistoryNav');
            if(navEl) navEl.style.display = (window.tZgodovina.length > 1) ? 'flex' : 'none';
            window.setT('mainHistoryLabel', document.getElementById('sezona').value || "Neznano");
            let bp = document.getElementById('mainBtnPrev'); if(bp) bp.style.opacity = (window.mInd < window.tZgodovina.length - 1) ? "1" : "0.3";
            let bn = document.getElementById('mainBtnNext'); if(bn) bn.style.opacity = (window.mInd > 0) ? "1" : "0.3";
        }

        if(window.tZgodovina && pI < window.tZgodovina.length) {
            document.getElementById('mainBtnPrev').style.opacity = (window.mInd < window.tZgodovina.length - 1) ? "1" : "0.3"; 
            document.getElementById('mainBtnNext').style.opacity = (window.mInd > 0) ? "1" : "0.3";

            let ocPrej = window.izracunajOcene(window.tZgodovina[pI]);
            let pSH = ocPrej.ocene.hitrost, pSM = ocPrej.ocene.moc, pSV = ocPrej.ocene.vzdrzljivost, pSE = ocPrej.ocene.eksplozivnost, pSA = ocPrej.ocene.agilnost;
            let prO = ocPrej.ovr;

            let elOvr = document.getElementById('dOvrContainer'); if(elOvr) { elOvr.innerHTML = window.getDiffsHTML(o, prO, true); elOvr.style.display = elOvr.innerHTML === '' ? 'none' : 'block'; }

            // Proslavi napredek (enkrat na športnika+sezono, glej varovalo v proslaviNapredek)
            if(o > prO) {
                let trenutni = window.tZgodovina[window.mInd];
                window.proslaviNapredek((trenutni.id || '') + '|' + (trenutni.sezona || ''), o, prO);
            }
            let elHit = document.getElementById('dHitContainer'); if(elHit) { elHit.innerHTML = window.getDiffsHTML(sH, pSH); elHit.style.display = elHit.innerHTML === '' ? 'none' : 'inline-block'; }
            let elMoc = document.getElementById('dMocContainer'); if(elMoc) { elMoc.innerHTML = window.getDiffsHTML(sM, pSM); elMoc.style.display = elMoc.innerHTML === '' ? 'none' : 'inline-block'; }
            let elVzd = document.getElementById('dVzdContainer'); if(elVzd) { elVzd.innerHTML = window.getDiffsHTML(sV, pSV); elVzd.style.display = elVzd.innerHTML === '' ? 'none' : 'inline-block'; }
            let elSko = document.getElementById('dSkoContainer'); if(elSko) { elSko.innerHTML = window.getDiffsHTML(sE, pSE); elSko.style.display = elSko.innerHTML === '' ? 'none' : 'inline-block'; }
            let elAgi = document.getElementById('dAgiContainer'); if(elAgi) { elAgi.innerHTML = window.getDiffsHTML(sA, pSA); elAgi.style.display = elAgi.innerHTML === '' ? 'none' : 'inline-block'; }
        } else {
            let hm = document.getElementById('mainHistoryNav'); if(hm) hm.style.display = (window.tZgodovina && window.tZgodovina.length > 1) ? 'flex' : 'none';
            let e1 = document.getElementById('dOvrContainer'); if(e1) e1.style.display = "none"; 
            let e2 = document.getElementById('dHitContainer'); if(e2) e2.style.display = "none"; 
            let e3 = document.getElementById('dMocContainer'); if(e3) e3.style.display = "none"; 
            let e4 = document.getElementById('dVzdContainer'); if(e4) e4.style.display = "none"; 
            let e5 = document.getElementById('dSkoContainer'); if(e5) e5.style.display = "none"; 
            let e6 = document.getElementById('dAgiContainer'); if(e6) e6.style.display = "none";
        }

        let k = document.getElementById('kartica'); 
        let c = window.getColorForOvr(o); 
        let rC = rankInfo.c; 
        
        // POZOR: className tu prepiše VSE razrede. Nagib (tilt) je zdaj na ZUNANJEM ovoju,
        // obračanje na vmesnem elementu - kartica sama nosi le svoj rang.
        if(k) k.className = "fifa-kartica " + rC; 
        let glo = document.getElementById('karticaGlow'); 
        if(glo) glo.style.display = (o >= 98) ? 'block' : 'none';

        // Foil (holografski lesk) dobita samo najvišja ranga - redkost mora biti vidna.
        let tOvoj = document.getElementById('karticaTiltOvoj');
        if(tOvoj) {
            tOvoj.classList.add('ima-foil');
            tOvoj.classList.remove('foil-t1','foil-t2','foil-t3','foil-t4');
            tOvoj.classList.add(window.dobiFoilTier(o));
        }
        window.pripniTiltInFoil(document.getElementById('panelPrikaz'));

        // Namigi na ikonah statične kartice ("Moja Kartica"). Ta kartica je v HTML trdno
        // zapisana (ni predloga), zato je imela še stare title="" - sivi brskalnikov oblaček.
        let namigi = [
            { id: 'mHit', ime: lng.ttHit, v: sH }, { id: 'mMoc', ime: lng.ttMoc, v: sM },
            { id: 'mVzd', ime: lng.ttVzd, v: sV }, { id: 'mSko', ime: lng.ttEks, v: sE },
            { id: 'mAgi', ime: lng.ttAgi, v: sA }
        ];
        namigi.forEach(n => {
            let box = document.querySelector(`.ikona-box[data-stat="${n.id}"]`);
            if(box) {
                box.setAttribute('data-namig-ime', n.ime);
                box.setAttribute('data-namig-vrednost', n.v + ' / 99');
                box.setAttribute('data-namig-barva', window.getColorForOvr(n.v));
            }
        });

        // Številka OVR se barva po rangu (prej je bila vedno enaka, ne glede na kartico)
        let ovrW = document.querySelector('#panelPrikaz .kartica-ovr-wrapper');
        if(ovrW) {
            ovrW.style.setProperty('--rang-barva', window.getColorForOvr(o));
            // Znak starostnega preskoka pod OVR (ista logika kot v Bazi in "Poglej").
            let star = ovrW.querySelector('.starost-znak'); if(star) star.remove();
            let aZaStarost = (window.tZgodovina && window.tZgodovina[window.mInd]) ? window.tZgodovina[window.mInd] : {
                spol: document.getElementById('spol').value,
                generacija: document.getElementById('generacija').value,
                teza: document.getElementById('teza').value,
                hitrost: document.getElementById('hitrostVal').value,
                moc: document.getElementById('mocVal').value,
                vzdrzljivost: document.getElementById('vzdrzljivostVal').value,
                eksplozivnost: document.getElementById('eksplozivnostVal').value,
                agilnost: document.getElementById('agilnostVal').value
            };
            ovrW.insertAdjacentHTML('beforeend', window.starostniZnakHTML(aZaStarost, false));
        }

        // Znak časti pod OVR (ista funkcija kot v Bazi in "Poglej")
        let aCast = (window.tZgodovina && window.tZgodovina[window.mInd]) ? window.tZgodovina[window.mInd] : null;
        window.setH('karticaCast', aCast ? window.dobiZnakCastiHTML(aCast.id, true) : '');

        // Hrbtna stran kartice (ista funkcija kot v "Poglej" in prelevitvenem oknu)
        let aZaHrbet = (window.tZgodovina && window.tZgodovina[window.mInd]) ? window.tZgodovina[window.mInd] : null;
        window.setH('mojaHrbet', window.dobiHrbtnoStranHTML(aZaHrbet || {
            ime: document.getElementById('ime').value,
            sezona: document.getElementById('sezona').value,
            timestamp: Date.now()
        }, o));

        // Napredek do naslednjega ranga
        let barvaRanga = window.getColorForOvr(o);
        let np = window.dobiNapredekDoRanga(o);
        let lokalnaOpomba = window.ratingMode === 'LOCAL'
            ? `<div class="napredek-opomba-local">${window.tJezik === 'sl' ? 'V lokalnem načinu se merilo premika z rastjo baze.' : 'In local mode the benchmark shifts as the database grows.'}</div>`
            : '';
        if(np) {
            window.setH('napredekRang', `<div class="napredek-rang">
                <div class="napredek-rang-txt">${window.tJezik === 'sl' ? 'Še' : 'Only'} <b>+${np.manjka} OVR</b> ${window.tJezik === 'sl' ? 'do ranga' : 'to'} <b style="color:${barvaRanga};">${np.imeNaslednjega}</b></div>
                <div class="napredek-rang-bg"><div class="napredek-rang-fill" style="width:${np.pct}%; background:${barvaRanga};"></div></div>
                ${lokalnaOpomba}
            </div>`);
        } else {
            window.setH('napredekRang', `<div class="napredek-rang"><div class="napredek-rang-max">🏆 ${window.tJezik === 'sl' ? 'Najvišji možni rang dosežen' : 'Highest possible rank achieved'}</div></div>`);
        }
        
        let mTxt = window.ratingMode === 'LOCAL' ? '📍 LOC' : '🌍 WRLD';
        let bge = document.getElementById('kModeBadge'); 
        if(bge) { bge.innerHTML = mTxt; bge.style.display = 'block'; }

        if(o<98) { document.querySelectorAll('.ikona-img').forEach(el=>el.style.color=c); document.getElementById('karticaRank').style.color=c; } else { document.querySelectorAll('.ikona-img').forEach(el=>el.style.color=''); document.getElementById('karticaRank').style.color=''; }
        if(window.radarGraf && window.radarGrafVnos) { window.radarGraf.data.datasets[0].data = [sH, sM, sV, sE, sA]; window.radarGraf.data.datasets[0].borderColor = c; window.radarGraf.data.datasets[0].backgroundColor = c + '44'; window.radarGraf.options.scales.r.pointLabels.color = c; window.radarGraf.update(); window.radarGrafVnos.data.datasets[0].data = [sH, sM, sV, sE, sA]; window.radarGrafVnos.data.datasets[0].borderColor = c; window.radarGrafVnos.data.datasets[0].backgroundColor = c + '44'; window.radarGrafVnos.options.scales.r.pointLabels.color = c; window.radarGrafVnos.update(); }
        
        let zL = window.izracunajZnacke(sH, sM, sV, sE, sA, o, gn, tZ, vS, rH, rM, rVz, rE, rA);
        let zObjs = window.genZnacke(zL);


        
        if(zObjs.zH !== "") { 
            document.getElementById('legendaZnack').style.display = 'flex'; 
            window.setH('legendaZnack', `<h3 style="margin: 0 0 10px 0; color: #4facfe; font-size: 13px; text-transform: uppercase; text-align: center;">🏆 ${lng.dosezeneZnacke}</h3>` + zObjs.lH); 
        } else { document.getElementById('legendaZnack').style.display = 'none'; } 
        window.setH('karticaZnacke', zObjs.zH);

        // Enoten podatkovni panel pod kartico (meritve + telesna sestava)
        let elMascP = document.getElementById('odstotekMascobe');
        let elMisP = document.getElementById('misicnaMasa');
        window.setH('prikazPodatkiPanel', window.dobiPodatkovniPanel([
            {i:'fa-bolt', n:lng.ttHit, v:rH.toFixed(2), u:'s', s:sH},
            {i:'fa-dumbbell', n:lng.ttMoc, v:rM.toFixed(0), u:'N', s:sM},
            {i:'fa-heart-pulse', n:lng.ttVzd, v:rVz.toFixed(1), u:'lvl', s:sV},
            {i:'fa-gauge-high', n:lng.ttEks, v:rE.toFixed(0), u:'N', s:sE},
            {i:'fa-wave-square', n:lng.ttAgi, v:rA.toFixed(2), u:'s', s:sA}
        ], {
            teza: tZ, visina: vi,
            odstotekMascobe: elMascP ? elMascP.value : '',
            misicnaMasa: elMisP ? elMisP.value : '',
            _lastnikGleda: true   // v Moji Kartici gledaš SVOJO kartico - sestavo vedno vidiš
        }));

        // Živi prikaz FFMI v vnosnem obrazcu
        let ffmiBox = document.getElementById('ffmiPrikaz');
        if(ffmiBox) {
            let elMasc = document.getElementById('odstotekMascobe');
            let elMis = document.getElementById('misicnaMasa');
            let ff = window.izracunajFFMI(tZ, vi, elMasc ? elMasc.value : '', elMis ? elMis.value : '');
            if(ff) {
                let opozorilo = ff.izPovrsine === 'misicna'
                    ? (window.tJezik === 'sl' ? 'Ocena iz mišične mase (natančneje je vnesti % maščobe).' : 'Estimated from muscle mass (entering body fat % is more accurate).')
                    : (window.tJezik === 'sl' ? 'Primerjaj le meritve, opravljene z isto metodo (kaliper / bioimpedanca / DEXA).' : 'Only compare measurements taken with the same method (caliper / bioimpedance / DEXA).');
                ffmiBox.style.display = 'block';
                ffmiBox.innerHTML = `<b style="color:#4facfe; font-size:13px;">FFMI ${ff.ffmiNorm.toFixed(1)}</b> &nbsp;·&nbsp; ${window.tJezik === 'sl' ? 'pusta masa' : 'lean mass'}: <b style="color:#fff;">${ff.pustaMasa.toFixed(1)} kg</b><br><span style="font-size:10px; color:#5a6a85;">${opozorilo}</span>`;
            } else {
                ffmiBox.style.display = 'none';
            }
        }
        
        document.querySelectorAll('.roll-in, .stat-diff, .ovr-diff').forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = null; });
    };

    // KURIRANJE ZNAČK
    // Načelo: uporabnik lahko izbere, KATERE od svojih PRISLUŽENIH značk prikaže na kartici,
    // ne more pa si pripeti značke, ki si je ni prislužil - sicer bi kartica prenehala biti
    // meritev in postala kostum. Rang, znak časti in ocene ostajajo neizbirni.
    window.genZnacke = function(zL) {
        let zH = ""; let lH = "";
        if(!zL || !zL.forEach) return {zH: "", lH: ""};
        zL.forEach(z => { 
            let bC = (z.t===5)?"#ff9f43":(z.t===4)?"#00f2fe":(z.t===3)?"#a29bfe":(z.t===2)?"#ff7675":(z.t===1)?"#f1c40f":"#2ecc71"; 
            zH += `<div class="znacka-wrap tier-${z.t}" style="color:${bC}; filter: drop-shadow(0 0 6px ${bC});" data-namig-ime="${window.escapeHtml(z.ime)}" data-namig-opis="${window.escapeHtml(z.opis || '')}" data-namig-barva="${bC}"><div class="znacka-krog" style="border-color:${bC}; box-shadow: 0 0 6px ${bC};"><i class="fa-solid ${z.ikona}"></i></div></div>`; 
            lH += `<div class="legenda-item" style="border-left-color: ${bC};"><div class="legenda-ikona-box"><div class="znacka-wrap tier-${z.t}" style="color:${bC}; filter: none;"><div class="znacka-krog" style="border-color:${bC}; box-shadow: none;"><i class="fa-solid ${z.ikona}"></i></div></div></div><div class="legenda-teksti"><span class="legenda-naslov">${z.ime}</span><span class="legenda-opis">${z.opis}</span></div></div>`; 
        });
        return {zH: zH, lH: lH};
    };

    window.pokaziVseZnacke = function() {
        try {
            let lng = window.prevodiZnack[window.tJezik]; let html = "";
            // Razvrsti po TIERJU (najredkejše najprej), ne po vrstnem redu indeksov v polju -
            // sicer se npr. "G99 Klub" (tier 3) pojavi takoj za "The One" (tier 5) samo zato,
            // ker ima nizek indeks, kar daje vtis, da je bolj prestižna, kot v resnici je.
            let vse = [];
            for (let i = 1; i <= 54; i++) { let p = lng['z' + i]; if(p) vse.push(p); }
            vse.sort((a, b) => b.t - a.t);
            vse.forEach(p => {
                let bC = (p.t===5)?"#ff9f43":(p.t===4)?"#00f2fe":(p.t===3)?"#a29bfe":(p.t===2)?"#ff7675":(p.t===1)?"#f1c40f":"#2ecc71"; 
                html += `<div class="legenda-item" style="border-left-color: ${bC}; background: rgba(0,0,0,0.3); margin-bottom: 5px;"><div class="legenda-ikona-box"><div class="znacka-wrap tier-${p.t}" style="color:${bC}; filter: none;"><div class="znacka-krog" style="border-color:${bC}; box-shadow: none;"><i class="fa-solid ${p.ikona}"></i></div></div></div><div class="legenda-teksti"><span class="legenda-naslov" style="font-size: 14px;">${p.ime}</span><span class="legenda-opis" style="font-size: 12px;">${p.opis}</span></div></div>`; 
            });

            // LEGENDA OKVIRJEV - v ISTEM oknu kot značke (uporabnik ta gumb že pozna,
            // zato ne dodajamo novega). Brez tega bi bili okvirji le naključne barve.
            let lo = window.prevodiOkvirjev[window.tJezik];
            let okvHtml = `<div style="margin-top:26px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:15px; font-weight:900; color:#4facfe; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${lo.naslovLegenda}</div>
                <div style="font-size:11px; color:#a0aec0; font-weight:600; line-height:1.5; margin-bottom:14px;">${lo.legendaUvod}</div>`;
            Object.keys(window.OKVIRJI)
                .sort((x, y) => window.OKVIRJI[y].prio - window.OKVIRJI[x].prio)
                .forEach(k => {
                    let d = window.OKVIRJI[k];
                    okvHtml += `<div class="legenda-okvir-vrstica" style="--okvir-barva:${d.barva};">
                        <div class="legenda-okvir-ikona">${d.ikona}</div>
                        <div>
                            <div class="legenda-okvir-ime">${lo[k]}${d.glasen ? ' ✨' : ''}</div>
                            <div class="legenda-okvir-pogoj">${lo[k + 'Pogoj']}</div>
                        </div>
                    </div>`;
                });
            okvHtml += '</div>';
            html += okvHtml;

            // STAROSTNI PRESKOK - tretji razdelek v istem oknu, da so vsa pravila na enem mestu.
            let lz = window.prevodi[window.tJezik];
            html += `<div style="margin-top:26px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:15px; font-weight:900; color:#2ecc71; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">${lz.legStarostNaslov}</div>
                <div style="font-size:11px; color:#a0aec0; font-weight:600; line-height:1.5; margin-bottom:14px;">${lz.legStarostUvod}</div>
                <div class="legenda-okvir-vrstica" style="--okvir-barva:#2ecc71;">
                    <div class="legenda-okvir-ikona">⭐</div>
                    <div>
                        <div class="legenda-okvir-ime">${lz.starostIme}</div>
                        <div class="legenda-okvir-pogoj">${lz.legStarostPogoj}</div>
                    </div>
                </div>
            </div>`;

            window.setH('vseZnackeTelo', html); 
            document.getElementById('vseZnackeOverlay').style.display = 'block'; 
            document.getElementById('vseZnackeModal').style.display = 'block';
        } catch(e) { console.error(e); }
    };

    window.zapriVseZnacke = function() { document.getElementById('vseZnackeOverlay').style.display = 'none'; document.getElementById('vseZnackeModal').style.display = 'none'; };

    // Statična razlaga metodologije - namenoma NI prevodni objekt (window.prevodi), ker gre
    // za daljše strukturirano besedilo z odstavki/tabelo, ki bi bilo v enovrstičnem objektu
    // nepregledno za vzdrževanje. Preklaplja se glede na window.tJezik ob vsakem odprtju.
    window.pokaziMetodologijo = function() {
        let sl = window.tJezik === 'sl';
        window.setT('naslovMetodologija', sl ? 'KAKO SE RAČUNA OVR?' : 'HOW IS OVR CALCULATED?');
        window.setT('btnZapriMetodologija', window.prevodi[window.tJezik].btnZapri);

        // Tabela rangov se zgradi iz istih barv kot kartice (getColorForOvr), da razlaga
        // in kartica nikoli ne moreta povedati različnih stvari.
        let rangi = [
            [0, 39, 'IRON'], [40, 49, 'BRONZE'], [50, 59, 'SILVER'], [60, 69, 'GOLD'],
            [70, 79, 'PLATINUM'], [80, 88, 'DIAMOND'], [89, 93, 'PRIME'],
            [94, 97, 'ELITE'], [98, 99, 'G99 TIER']
        ];
        let tabela = rangi.map(r => {
            let barva = window.getColorForOvr(r[1]);
            return `<div class="met-rang" style="--rb:${barva}">
                        <span class="met-rang-pas"></span>
                        <span class="met-rang-obseg">${r[0]}–${r[1]}</span>
                        <span class="met-rang-ime">${r[2]}</span>
                    </div>`;
        }).join('');

        let html = sl ? `
            <h3>Na kratko</h3>
            <p>Vsaka od petih meritev dobi oceno od <b>1 do 99</b>. Povprečje teh petih ocen je tvoj <b>OVR</b>, OVR pa določi rang na kartici.</p>

            <h3>1. Kako meritev postane ocena</h3>
            <p>Tvoj rezultat se primerja z <b>razponom za tvoj spol in generacijo</b> (U15, U17, U19, PRO). Spodnji rob razpona pomeni oceno 1, zgornji oceno 99, vmes gre ocena enakomerno.</p>
            <p>Pri <b>moči</b> in <b>eksplozivnosti</b> se sila najprej deli s tvojo težo. Tako lažji in težji športniki tekmujejo pošteno - šteje moč <i>na kilogram</i>, ne skupna sila.</p>
            <p>Razpone si lahko ogledaš v gumbu <b>Normativi</b>.</p>

            <h3>2. Dva načina primerjave</h3>
            <p>🌍 <b>GLOBALNO</b> - primerjaš se s <b>stalnimi normativi</b>, ki veljajo povsod in se nikoli ne premaknejo. Tvoja ocena je odvisna samo od tebe.</p>
            <p>📍 <b>LOKALNO</b> - primerjaš se z <b>ljudmi v tej bazi</b>, ki so istega spola in generacije. Sredina skupine dobi oceno <b>70</b>, ne 50 - namenoma radodarno, ker so globalne meje postavljene na skoraj svetovno raven. Za 99 moraš biti izrazito nad sredino skupine. Ker skupina raste, se ta ocena s časom spreminja, tudi če ti ostaneš isti.</p>
            <p>Če je v skupini <b>manj kot pet</b> športnikov, se uporabijo globalni normativi - iz štirih ljudi se ne da izračunati ničesar zanesljivega.</p>

            <h3>3. Skupna ocena (OVR)</h3>
            <p><b>OVR = povprečje vseh petih ocen</b> - hitrost, moč, vzdržljivost, eksplozivnost, agilnost - zaokroženo na celo število. Vseh pet šteje enako, zato ena šibka točka poteguje rang navzdol.</p>

            <h3>4. Rangi</h3>
            <div class="met-rangi">${tabela}</div>

            <h3>5. Značke</h3>
            <p>Poleg OVR dobiš do pet značk. Nekatere pridejo iz kombinacije ocen, druge iz telesnih mer, tretje iz primerjave z ostalimi - na primer rekord ali napredek med sezonami. Celoten seznam je v gumbu <b>Legenda značk</b>.</p>
        ` : `
            <h3>In short</h3>
            <p>Each of the five measurements gets a score from <b>1 to 99</b>. The average of those five is your <b>OVR</b>, and the OVR sets the rank on your card.</p>

            <h3>1. How a measurement becomes a score</h3>
            <p>Your result is compared against the <b>range for your gender and generation</b> (U15, U17, U19, PRO). The bottom of the range is a score of 1, the top is 99, and everything in between is spread evenly.</p>
            <p>For <b>power</b> and <b>explosiveness</b>, force is first divided by your body weight. That way lighter and heavier athletes compete fairly - what counts is force <i>per kilogram</i>, not total force.</p>
            <p>You can view the ranges under <b>Standards</b>.</p>

            <h3>2. Two comparison modes</h3>
            <p>🌍 <b>GLOBAL</b> - you are measured against <b>fixed standards</b> that never move. Your score depends only on you.</p>
            <p>📍 <b>LOCAL</b> - you are measured against <b>the people in this database</b> of the same gender and generation. The middle of the group scores <b>70</b>, not 50 - deliberately generous, because the global standards sit at near world-class level. Reaching 99 means being clearly above the middle of your group. As the group grows, this score changes even if you do not.</p>
            <p>With <b>fewer than five</b> athletes in a group, the global standards are used instead - four people are not enough to calculate anything reliable.</p>

            <h3>3. Overall rating (OVR)</h3>
            <p><b>OVR = the average of all five scores</b> - speed, power, endurance, explosiveness, agility - rounded to a whole number. All five count equally, so one weak area pulls the rank down.</p>

            <h3>4. Ranks</h3>
            <div class="met-rangi">${tabela}</div>

            <h3>5. Badges</h3>
            <p>Besides OVR you can earn up to five badges. Some come from combinations of scores, some from body measurements, others from comparison with the rest - a record, or progress between seasons. The full list is under <b>Badge legend</b>.</p>
        `;
        window.setH('metodologijaTelo', html);
        document.getElementById('metodologijaOverlay').style.display = 'block';
        document.getElementById('metodologijaModal').style.display = 'block';
    };
    window.zapriMetodologijo = function() { document.getElementById('metodologijaOverlay').style.display = 'none'; document.getElementById('metodologijaModal').style.display = 'none'; };


    window.pokaziNormative = function() { 
        try {
            let sp = 'M'; let gn = 'U17';
            if (window.tZgodovina && window.tZgodovina.length > 0 && document.getElementById('panelPrikaz').style.display !== 'none') { sp = window.tZgodovina[window.mInd].spol || 'M'; gn = window.tZgodovina[window.mInd].generacija || 'U17'; } 
            else if (document.getElementById('viewCardOverlay').style.display === 'block' && window.mZgodovina && window.mZgodovina.length > 0) { sp = window.mZgodovina[window.modInd].spol || 'M'; gn = window.mZgodovina[window.modInd].generacija || 'U17'; } 
            else { sp = document.getElementById('spol').value || 'M'; gn = document.getElementById('generacija').value || 'U17'; }
            
            let lm = window.getLimits(sp, gn); let lng = window.prevodi[window.tJezik]; let mTxt = window.ratingMode === 'LOCAL' ? '📍 LOC' : '🌍 WRLD';
            window.setT('modalNaslov', lng.modalTitle + " " + mTxt + " - " + gn + " " + sp); 
            
            let avgHit = (window.ratingMode === 'LOCAL' && lm.hitrost.mean) ? lm.hitrost.mean.toFixed(2) + 's (±' + lm.hitrost.std.toFixed(2) + ')' : ((lm.hitrost.min+lm.hitrost.max)/2).toFixed(2) + 's';
            let avgMoc = (window.ratingMode === 'LOCAL' && lm.moc.mean) ? lm.moc.mean.toFixed(2) + ' (±' + lm.moc.std.toFixed(2) + ')' : ((lm.moc.min+lm.moc.max)/2).toFixed(1);
            let avgVzd = (window.ratingMode === 'LOCAL' && lm.vzdrzljivost.mean) ? lm.vzdrzljivost.mean.toFixed(2) + ' (±' + lm.vzdrzljivost.std.toFixed(2) + ')' : ((lm.vzdrzljivost.min+lm.vzdrzljivost.max)/2).toFixed(0);
            let avgEks = (window.ratingMode === 'LOCAL' && lm.eksplozivnost.mean) ? lm.eksplozivnost.mean.toFixed(2) + ' (±' + lm.eksplozivnost.std.toFixed(2) + ')' : ((lm.eksplozivnost.min+lm.eksplozivnost.max)/2).toFixed(1);
            let avgAgi = (window.ratingMode === 'LOCAL' && lm.agilnost.mean) ? lm.agilnost.mean.toFixed(2) + 's (±' + lm.agilnost.std.toFixed(2) + ')' : ((lm.agilnost.min+lm.agilnost.max)/2).toFixed(2) + 's';

            window.setH('modalTelo', `<tr><td>${lng.ttHit}</td><td>${lm.hitrost.min.toFixed(2)}s</td><td>${avgHit}</td><td>${lm.hitrost.max.toFixed(2)}s</td></tr><tr><td>${lng.ttMoc}</td><td>${lm.moc.min.toFixed(1)}</td><td>${avgMoc}</td><td>${lm.moc.max.toFixed(1)}</td></tr><tr><td>${lng.ttVzd}</td><td>${lm.vzdrzljivost.min.toFixed(1)}</td><td>${avgVzd}</td><td>${lm.vzdrzljivost.max.toFixed(1)}</td></tr><tr><td>${lng.ttEks}</td><td>${lm.eksplozivnost.min.toFixed(1)}</td><td>${avgEks}</td><td>${lm.eksplozivnost.max.toFixed(1)}</td></tr><tr><td>${lng.ttAgi}</td><td>${lm.agilnost.min.toFixed(2)}s</td><td>${avgAgi}</td><td>${lm.agilnost.max.toFixed(2)}s</td></tr>`); 
            document.getElementById('modalOverlay').style.display = 'block'; document.getElementById('modalNormativi').style.display = 'block'; 
        } catch(e) { console.error(e); }
    };
    window.zapriNormative = function() { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('modalNormativi').style.display = 'none'; };

    // ==========================================
    // UI IN FIREBASE FUNKCIJE
    // ==========================================
    window.odpriRegistracijo = function() { document.getElementById('regOverlay').style.display = 'block'; document.getElementById('regModal').style.display = 'block'; };
    window.zapriRegistracijo = function() { document.getElementById('regOverlay').style.display = 'none'; document.getElementById('regModal').style.display = 'none'; document.getElementById('regEmail').value = ''; document.getElementById('regGeslo').value = ''; document.getElementById('regPotrdiGeslo').value = ''; document.getElementById('regNapaka').style.display = 'none'; };

    window.prijaviUporabnika = async function() { 
        let e = document.getElementById('prijavaEmail').value; let g = document.getElementById('prijavaGeslo').value; let err = document.getElementById('prijavaNapaka'); err.style.display = 'none'; 
        try { 
            let c = await signInWithEmailAndPassword(auth, e, g); 
            if(!c.user.emailVerified && c.user.email.toLowerCase() !== window.ADMIN_EMAIL.toLowerCase()) { 
                await signOut(auth); err.innerText = window.prevodi[window.tJezik].potrdiMail; err.style.color = "#ff7675"; err.style.display = 'block'; 
            } 
        } 
        catch(error) { err.innerText = window.prevodi[window.tJezik].napakaPrijava; err.style.color = "#ff7675"; err.style.display = 'block'; } 
    };
    
    window.registrirajUporabnika = async function() { 
        let e = document.getElementById('regEmail').value; let g1 = document.getElementById('regGeslo').value; let g2 = document.getElementById('regPotrdiGeslo').value; let err = document.getElementById('regNapaka'); err.style.display = 'none'; let lng = window.prevodi[window.tJezik];
        if(!e || g1.length < 6) { err.innerText = lng.regNapaka; err.style.color = "#ff7675"; err.style.display = 'block'; return; }
        if(g1 !== g2) { err.innerText = lng.errGesliMismatch; err.style.color = "#ff7675"; err.style.display = 'block'; return; }
        try { let c = await createUserWithEmailAndPassword(auth, e, g1); await sendEmailVerification(c.user); await signOut(auth); err.style.color = "#2ecc71"; err.innerText = lng.regUspesna; err.style.display = 'block'; setTimeout(() => { window.zapriRegistracijo(); }, 4000); } 
        catch(error) { err.style.color = "#ff7675"; err.innerText = lng.regNapaka; err.style.display = 'block'; } 
    };

    window.odjaviUporabnika = function() { signOut(auth); };

    // ==========================================
    // SLIKE V LOČENI FIRESTORE KOLEKCIJI
    // ==========================================
    // Firebase Cloud Storage od 3.2.2026 zahteva plačljiv Blaze plan, zato slik NE hranimo tam.
    // Prav tako jih ne hranimo več v samem dokumentu športnika (kolekcija "atleti") - to je bil
    // glavni vzrok počasnosti: ob VSAKEM branju baze so se prenesle vse slike hkrati (100 KB+
    // na športnika), tudi kadar jih sploh nismo potrebovali.
    //
    // Zdaj: dokument športnika je majhen (samo podatki), slika pa je svoj dokument v kolekciji
    // "slike/{atletId}". Slike se preberejo LENO (lazy) - šele ko je kartica dejansko vidna na
    // zaslonu - in se predpomnijo, zato se vsaka prenese kvečjemu enkrat na sejo.
    // Ostane 100% na brezplačnem Spark planu.
    //
    // ZDRUŽLJIVOST NAZAJ: stari zapisi, ki imajo base64 sliko še vedno vgrajeno v polju "slika"
    // znotraj dokumenta športnika, delujejo naprej (uporabijo se neposredno). Admin jih lahko
    // preseli z gumbom "Preseli slike".

    window.slikeCache = {};      // atletId -> dataURL (ali "" če je ni)
    window.slikeVTeku = {};      // atletId -> Promise (prepreči podvojene hkratne poizvedbe)

    // znovaCePrazna: če je v predpomnilniku zapisano "slike ni", jo vseeno poskusi znova.
    // Brez tega prazen rezultat obtiči za vedno - tudi če fotografija pride sekundo kasneje.
    // Koliko časa velja zapomnjen PRAZEN rezultat. Slika se shrani v ločeno kolekcijo
    // šele po tem, ko je športnik že zapisan - kdor sliko prebere v tem trenutku, dobi
    // prazno. Prej se je ta praznina zapomnila za vedno in kartica je ostala brez slike
    // do ponovnega nalaganja strani.
    window.SLIKA_PRAZNA_TTL = 30000;
    window.slikePrazneCas = window.slikePrazneCas || {};

    window.pridobiSliko = async function(atletId, znovaCePrazna) {
        if(!atletId) return "";
        let v = window.slikeCache[atletId];
        // Prazen zapis po izteku roka zavržemo in poskusimo znova.
        if(v === "" && (Date.now() - (window.slikePrazneCas[atletId] || 0)) > window.SLIKA_PRAZNA_TTL) {
            delete window.slikeCache[atletId]; delete window.slikePrazneCas[atletId]; v = undefined;
        }
        if(v !== undefined && !(znovaCePrazna && v === "")) return v;
        if(znovaCePrazna) { delete window.slikeCache[atletId]; delete window.slikePrazneCas[atletId]; }

        // Stari zapisi: slika je še vedno vgrajena v dokumentu športnika
        let a = window.aBaza.find(x => x.id === atletId);
        if(a && a.slika) { window.slikeCache[atletId] = a.slika; return a.slika; }

        if(window.slikeVTeku[atletId]) return window.slikeVTeku[atletId];

        window.slikeVTeku[atletId] = (async () => {
            try {
                let snap = await window.getDoc(window.doc(window.db, "slike", atletId));
                let val = (snap.exists() && snap.data().slika) ? snap.data().slika : "";
                window.slikeCache[atletId] = val;
                if(val === "") window.slikePrazneCas[atletId] = Date.now();
                return val;
            } catch(e) {
                console.warn('[G99] Slike ni bilo mogoče naložiti:', atletId, e);
                window.slikeCache[atletId] = "";
                window.slikePrazneCas[atletId] = Date.now();
                return "";
            } finally {
                delete window.slikeVTeku[atletId];
            }
        })();
        return window.slikeVTeku[atletId];
    };

    window.shraniSlikoVBazo = async function(atletId, dataUrl) {
        if(!atletId) return;
        if(dataUrl) {
            await window.setDoc(window.doc(window.db, "slike", atletId), { slika: dataUrl });
            window.slikeCache[atletId] = dataUrl;
        }
    };

    window.brisiSlikoIzBaze = async function(atletId) {
        if(!atletId) return;
        try { await window.deleteDoc(window.doc(window.db, "slike", atletId)); } catch(e) { /* morda je ni - ni napaka */ }
        delete window.slikeCache[atletId];
    };

    // Leno nalaganje slik za kartice, ki pridejo v vidno polje (IntersectionObserver).
    // POMEMBNO za hitrost: slik NE beremo eno po eno (to bi pri 20 vidnih karticah pomenilo
    // 20 ločenih poizvedb na strežnik in vidno počasno "pojavljanje" slik). Namesto tega jih
    // zberemo v čakalnico in preberemo PAKETNO - Firestore dovoli do 30 dokumentov na
    // poizvedbo prek documentId() 'in', torej 20 slik = 1 poizvedba namesto 20.
    window.slikaObserver = null;
    window.slikeCakalnica = [];   // [{id, el}]
    window.slikeCasovnik = null;

    // Označi element kot naložen (ustavi skeleton utrip in sproži mehak vstop slike).
    window.oznaciSlikoNalozeno = function(el, url) {
        if(!el) return;
        if(url) el.style.backgroundImage = `url('${url}')`;
        el.classList.add('slika-nalozena');
    };

    // Prednaloži slike za VSE prikazane športnike v ozadju (ne le za tiste na zaslonu).
    // Brez tega bi se ob drsenju slike šele takrat začele nalagati - kar deluje kot "štekanje".
    // Pri 100 športnikih so to ~4 poizvedbe, ki tečejo tiho v ozadju; ko uporabnik pridrsa do
    // kartice, je slika praviloma že v predpomnilniku in se prikaže takoj.
    window.prednalozRunning = false;
    window.prednaloziVseSlike = async function(idji) {
        if(window.prednalozRunning) return;
        let manjkajo = idji.filter(id => id && window.slikeCache[id] === undefined);
        if(manjkajo.length === 0) return;
        window.prednalozRunning = true;
        try {
            for(let i = 0; i < manjkajo.length; i += 30) {
                let kos = manjkajo.slice(i, i + 30).filter(id => window.slikeCache[id] === undefined);
                if(kos.length === 0) continue;
                try {
                    let q = window.query(window.collection(window.db, "slike"), window.where(window.documentId(), 'in', kos));
                    let snap = await window.getDocs(q);
                    snap.forEach(d => {
                        let val = d.data().slika || "";
                        window.slikeCache[d.id] = val;
                        document.querySelectorAll(`[data-slika-atlet="${d.id}"]`).forEach(el => window.oznaciSlikoNalozeno(el, val));
                    });
                    kos.forEach(id => {
                        if(window.slikeCache[id] === undefined) window.slikeCache[id] = "";
                        if(window.slikeCache[id] === "") document.querySelectorAll(`[data-slika-atlet="${id}"]`).forEach(el => window.oznaciSlikoNalozeno(el, null));
                    });
                } catch(e) { console.warn('[G99] Prednalaganje slik ni uspelo za paket.', e); }
            }
        } finally { window.prednalozRunning = false; }
    };

    window.izprazniCakalnicoSlik = async function() {
        let paket = window.slikeCakalnica;
        window.slikeCakalnica = [];
        if(paket.length === 0) return;

        // Poveži elemente po ID-ju (isti športnik je lahko na več mestih)
        let poId = {};
        paket.forEach(({id, el}) => { (poId[id] = poId[id] || []).push(el); });
        let idji = Object.keys(poId).filter(id => window.slikeCache[id] === undefined);

        // Kar je že v predpomnilniku, nastavimo takoj
        paket.forEach(({id, el}) => { if(window.slikeCache[id] !== undefined) window.oznaciSlikoNalozeno(el, window.slikeCache[id]); });
        if(idji.length === 0) return;

        for(let i = 0; i < idji.length; i += 30) {
            let kos = idji.slice(i, i + 30);
            try {
                let q = window.query(window.collection(window.db, "slike"), window.where(window.documentId(), 'in', kos));
                let snap = await window.getDocs(q);
                snap.forEach(d => {
                    let val = d.data().slika || "";
                    window.slikeCache[d.id] = val;
                    if(poId[d.id]) poId[d.id].forEach(el => window.oznaciSlikoNalozeno(el, val));
                });
                // Kar ni prišlo nazaj, označimo kot "ni slike", da ne poizvedujemo znova
                kos.forEach(id => {
                    if(window.slikeCache[id] === undefined) window.slikeCache[id] = "";
                    if(poId[id]) poId[id].forEach(el => window.oznaciSlikoNalozeno(el, window.slikeCache[id]));
                });
            } catch(e) {
                console.warn('[G99] Paketno branje slik ni uspelo, poskušam posamično.', e);
                for(let id of kos) {
                    let s = await window.pridobiSliko(id);
                    if(poId[id]) poId[id].forEach(el => window.oznaciSlikoNalozeno(el, s));
                }
            }
        }
    };

    window.zazeniLenoNalaganjeSlik = function(koren) {
        if(window.slikaObserver) { window.slikaObserver.disconnect(); }
        if(typeof IntersectionObserver === 'undefined') {
            (koren || document).querySelectorAll('[data-slika-atlet]').forEach(el => {
                window.slikeCakalnica.push({ id: el.getAttribute('data-slika-atlet'), el });
            });
            window.izprazniCakalnicoSlik();
            return;
        }
        window.slikaObserver = new IntersectionObserver((vnosi, obs) => {
            vnosi.forEach(v => {
                if(!v.isIntersecting) return;
                obs.unobserve(v.target);
                window.slikeCakalnica.push({ id: v.target.getAttribute('data-slika-atlet'), el: v.target });
            });
            // Kratek zamik, da se ob hitrem drsenju nabere cel paket in gre v ENO poizvedbo.
            clearTimeout(window.slikeCasovnik);
            window.slikeCasovnik = setTimeout(() => window.izprazniCakalnicoSlik(), 60);
        }, { rootMargin: '400px' }); // začni nalagati precej preden kartica pride na zaslon
        (koren || document).querySelectorAll('[data-slika-atlet]').forEach(el => window.slikaObserver.observe(el));
    };

    // ==========================================
    // NALAGANJE SLIKE + IZREZ
    // ==========================================
    // Prej se je slika samo pomanjšala in vstavila - uporabnik ni imel nadzora nad tem, kako
    // jo bo kartica odrezala (fotografsko polje je 320x264, torej skoraj vedno pride do izreza,
    // in glava športnika je pogosto pristala izven okvirja). Zdaj dobi predogled v ISTEM
    // razmerju kot kartica, ki ga lahko premika in približa.
    window.IZREZ_W = 640;   // ciljna ločljivost izreza (2x fotografsko polje kartice)
    window.IZREZ_H = 528;
    window.izrez = { img: null, zoom: 1, x: 0, y: 0, vlecem: false, zx: 0, zy: 0 };

    window.naloziSliko = function(e) {
        let file = e.target.files[0]; if(!file) return;
        let reader = new FileReader();
        reader.onload = function(ev) {
            let img = new Image();
            img.onload = function() { window.odpriIzrez(img); };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';   // da lahko isto datoteko izbereš znova
    };

    window.odpriIzrez = function(img) {
        window.izrez.img = img;
        window.izrez.zoom = 1;
        window.izrez.x = 0;
        window.izrez.y = 0;
        document.getElementById('izrezOverlay').style.display = 'block';
        document.getElementById('izrezModal').style.display = 'flex';
        let s = document.getElementById('izrezZoom'); if(s) s.value = 1;
        window.namestiIzrezVlecenje();
        window.izrisiIzrez();
    };

    window.nastaviZoom = function(v) {
        window.izrez.zoom = parseFloat(v) || 1;
        window.izrisiIzrez();
    };

    // Vlečenje slike znotraj okvirja (miška + dotik)
    window.namestiIzrezVlecenje = function() {
        let okvir = document.getElementById('izrezOkvir');
        if(!okvir || okvir.dataset.namescen === '1') return;
        okvir.dataset.namescen = '1';

        let zacetek = (e) => {
            window.izrez.vlecem = true;
            let t = e.touches ? e.touches[0] : e;
            window.izrez.zx = t.clientX; window.izrez.zy = t.clientY;
        };
        let premik = (e) => {
            if(!window.izrez.vlecem) return;
            let t = e.touches ? e.touches[0] : e;
            window.izrez.x += (t.clientX - window.izrez.zx);
            window.izrez.y += (t.clientY - window.izrez.zy);
            window.izrez.zx = t.clientX; window.izrez.zy = t.clientY;
            window.izrisiIzrez();
            if(e.cancelable) e.preventDefault();
        };
        let konec = () => { window.izrez.vlecem = false; };

        okvir.addEventListener('mousedown', zacetek);
        window.addEventListener('mousemove', premik);
        window.addEventListener('mouseup', konec);
        okvir.addEventListener('touchstart', zacetek, { passive: true });
        okvir.addEventListener('touchmove', premik, { passive: false });
        okvir.addEventListener('touchend', konec);
        // Kolešček miške = približevanje
        okvir.addEventListener('wheel', (e) => {
            e.preventDefault();
            let z = window.izrez.zoom + (e.deltaY < 0 ? 0.08 : -0.08);
            window.izrez.zoom = Math.max(1, Math.min(3, z));
            let s = document.getElementById('izrezZoom'); if(s) s.value = window.izrez.zoom;
            window.izrisiIzrez();
        }, { passive: false });
    };

    window.zapriIzrez = function() {
        document.getElementById('izrezOverlay').style.display = 'none';
        document.getElementById('izrezModal').style.display = 'none';
        window.izrez.img = null;
    };

    // Izračuna, kako je slika položena v okvir: privzeto pokrije okvir (cover), zoom in
    // premik pa sta uporabnikova prilagoditev. Vrne mere v koordinatah PLATNA.
    window.izrezPostavitev = function(sirina, visina) {
        let img = window.izrez.img;
        if(!img) return null;
        let osnovna = Math.max(sirina / img.width, visina / img.height); // "cover"
        let m = osnovna * window.izrez.zoom;
        let w = img.width * m, h = img.height * m;
        // Omeji premik, da ne nastanejo prazni robovi
        let maxX = Math.max(0, (w - sirina) / 2);
        let maxY = Math.max(0, (h - visina) / 2);
        let x = Math.max(-maxX, Math.min(maxX, window.izrez.x * (m / osnovna)));
        let y = Math.max(-maxY, Math.min(maxY, window.izrez.y * (m / osnovna)));
        return { w, h, left: (sirina - w) / 2 + x, top: (visina - h) / 2 + y };
    };

    window.izrisiIzrez = function() {
        let cv = document.getElementById('izrezPlatno');
        if(!cv || !window.izrez.img) return;
        let ctx = cv.getContext('2d');
        let p = window.izrezPostavitev(cv.width, cv.height);
        if(!p) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(window.izrez.img, p.left, p.top, p.w, p.h);
    };

    window.potrdiIzrez = function() {
        let cv = document.createElement('canvas');
        cv.width = window.IZREZ_W; cv.height = window.IZREZ_H;
        let ctx = cv.getContext('2d');
        // Ponovi isto postavitev, le v ciljni ločljivosti
        let cvP = document.getElementById('izrezPlatno');
        let razmerje = window.IZREZ_W / cvP.width;
        let p = window.izrezPostavitev(cvP.width, cvP.height);
        ctx.drawImage(window.izrez.img, p.left * razmerje, p.top * razmerje, p.w * razmerje, p.h * razmerje);

        // JPEG namesto PNG: bistveno manjši zapis (slike gredo v Firestore).
        // Firestore ima trdo omejitev ~1 MB na dokument. Nekatere fotografije (veliko detajlov)
        // pri kakovosti 0.85 to presežejo, zato kakovost postopno nižamo, dokler ne pademo pod
        // varno mejo (~720 KB, da ostane prostor za ostala polja). Tako shranjevanje NIKOLI
        // ne pade zaradi velikosti.
        let kakovost = 0.85;
        let out = cv.toDataURL('image/jpeg', kakovost);
        while(out.length > 720 * 1024 && kakovost > 0.4) {
            kakovost -= 0.1;
            out = cv.toDataURL('image/jpeg', kakovost);
        }
        window.gSlika = out;
        document.getElementById('slikaOkvir').style.backgroundImage = `url('${window.gSlika}')`;
        let b = document.getElementById('btnSamoShraniSliko');
        if(b && !window.jeTrener) b.style.display = 'block';
        if(b && window.jeTrener && document.getElementById('atletId').value) b.style.display = 'block';
        window.zapriIzrez();
    };

    window.shraniSamoSliko = async function() {
        let aId = "";
        if (window.tZgodovina && window.tZgodovina.length > 0) { aId = window.tZgodovina[window.mInd].id; }
        if(!aId) return;
        let b = document.getElementById('btnSamoShraniSliko');
        b.innerText = "⏳..."; b.disabled = true;
        try {
            // Slika gre v LOČENO kolekcijo "slike", dokument športnika pa ostane majhen.
            // Če je zapis še star (base64 vgrajen v "atleti"), ga ob tej priložnosti počistimo.
            await window.shraniSlikoVBazo(aId, window.gSlika);
            // VARNOST: navadni uporabnik piše IZKLJUČNO v kolekcijo "slike". Dokumenta v
            // "atleti" (kjer so ocene) se NE dotakne - tako lahko Firestore pravila povsem
            // prepovejo navadnim uporabnikom pisanje v "atleti". Čiščenje starega base64
            // polja "slika" v dokumentu atleta prevzame admin ob naslednjem urejanju.
            if(window.jeTrener) {
                let aObj = window.aBaza.find(x => x.id === aId);
                let kol = (aObj && aObj._vir === 'klub') ? "klubatleti" : "atleti";
                await window.setDoc(window.doc(window.db, kol, aId), { slika: "" }, { merge: true });
            }
            window.vibriraj(25);
        b.innerText = window.prevodi[window.tJezik].slikaShranjeno;
            setTimeout(() => { b.style.display = 'none'; b.innerText = window.prevodi[window.tJezik].slikaShrani; b.disabled=false; }, 3000);
            window.osveziGalerijo(); 
        } catch(e) {
            // Sporočilo naj pove PRAVI vzrok, ne enotnega zavajajočega besedila.
            let sl = window.tJezik === 'sl';
            let sporocilo;
            if(e.code === 'permission-denied') {
                sporocilo = sl ? "Ni dovoljenja za shranjevanje te slike. Preveri, da si prijavljen." 
                               : "No permission to save this photo. Check that you are signed in.";
            } else if((e.message || '').toLowerCase().includes('longer than') || (e.message || '').includes('1048')) {
                sporocilo = sl ? "Slika je prevelika. Poskusi z manjšim izrezom ali drugo fotografijo."
                               : "The image is too large. Try a smaller crop or another photo.";
            } else {
                sporocilo = (sl ? "Napaka pri shranjevanju slike: " : "Error saving photo: ") + (e.message || e);
            }
            alert(sporocilo);
            b.innerText = window.prevodi[window.tJezik].slikaShrani; b.disabled=false;
        }
    };

    // Anonimni, obstojen ključ iz e-pošte: povezuje sezone istega športnika v JAVNEM
    // dokumentu, ne da bi razkril e-naslov. Enostaven hash je dovolj - ni varnostni mehanizem,
    // le stabilna oznaka (isti email -> isti ključ).
    window.anonKljuc = function(email) {
        let s = (email || '').toLowerCase().trim();
        if(!s) return null;
        let h = 0;
        for(let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
        return 'atl_' + (h >>> 0).toString(36);
    };

    window.groupAthletesByEmail = function() {
        // Klubski filter: če je vklopljen (samo trener), upoštevamo le športnike njegovega
        // kluba. Filter deluje na že naloženih podatkih - nič dodatnega branja iz Firebase.
        // Ker vsi pogledi (Baza, Lestvica, Nadzor) uporabljajo to funkcijo, en preklop
        // filtrira vse naenkrat.
        let vir = window.aBaza;
        if(window.klubskiFilter && window.trenerId) {
            // "Samo moj klub" pokaže trenerjeve KLUBSKE športnike (zasebna baza), ne javnih.
            vir = window.aBaza.filter(a => a._vir === 'klub' && a.trenerId === window.trenerId);
        }
        let g = {}; vir.forEach(a => { let e = a.atletKljuc || (a.emailSportnika ? window.anonKljuc(a.emailSportnika) : null) || a.id; if(!g[e]) g[e] = []; g[e].push(a); });
        // Razvrsti PRVO po sezoni (padajoče), šele nato po času vnosa.
        // Prej je bil vrstni red obraten (najprej timestamp), zato je kartica, ki si jo vnesel
        // nazadnje, veljala za "najnovejšo" - tudi če je bila to Sezona 1 in je Sezona 3 že obstajala.
        for (let k in g) {
            g[k].sort((a, b) => {
                let sA = parseInt((a.sezona || "").replace(/\D/g, '')) || 0;
                let sB = parseInt((b.sezona || "").replace(/\D/g, '')) || 0;
                if (sA !== sB) return sB - sA;
                return (b.timestamp || 0) - (a.timestamp || 0);
            });
        }
        return g;
    };

    window.naloziKarticoZaSportnika = async function(email) {
        // Igralec najde svoje kartice po ANONIMNEM ključu svojega e-naslova (ki ga pozna iz
        // prijave). Email ni več v javnem dokumentu, grupiranje pa teče po tem ključu.
        let g = window.groupAthletesByEmail();
        let kljuc = window.anonKljuc((email || "").toLowerCase().trim());
        let n = (kljuc && g[kljuc] && g[kljuc].length > 0) ? g[kljuc][0] : null;
        if(n) { window.tZgodovina = g[kljuc]; window.mInd = 0; window.osveziVnosnaPolja(n); } 
        else { window.tZgodovina = []; window.prikaziPraznoKartico(); }
    };

    window.osveziVnosnaPolja = function(a) {
        document.getElementById('ime').value = a.ime || ""; 
        let lR = a.letorojstva; if(!lR && a.starost) lR = new Date().getFullYear() - parseInt(a.starost); let iR = document.getElementById('letorojstva'); if(iR) iR.value = lR || (new Date().getFullYear() - 16); 
        document.getElementById('visina').value = a.visina || ""; document.getElementById('teza').value = a.teza || "80"; document.getElementById('spol').value = a.spol || "M"; document.getElementById('generacija').value = a.generacija || "U17"; document.getElementById('hitrostVal').value = a.hitrost || ""; document.getElementById('mocVal').value = a.moc || ""; document.getElementById('eksplozivnostVal').value = a.eksplozivnost || ""; document.getElementById('agilnostVal').value = a.agilnost || ""; document.getElementById('vzdrzljivostVal').value = a.vzdrzljivost || ""; document.getElementById('sezona').value = a.sezona || "Sezona 1";
        document.getElementById('odstotekMascobe').value = a.odstotekMascobe || ""; document.getElementById('misicnaMasa').value = a.misicnaMasa || "";
        window.gSlika = a.slika || window.slikeCache[a.id] || ""; 
        let sT = encodeURIComponent(window.prevodi[window.tJezik].addPhoto); let dBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect width='400' height='600' fill='transparent'/%3E%3Ctext x='50%25' y='50%25' fill='%234facfe' font-size='20' font-family='Arial' font-weight='bold' text-anchor='middle' dominant-baseline='middle'%3E${sT}%3C/text%3E%3C/svg%3E")`;
        document.getElementById('slikaOkvir').style.backgroundImage = window.gSlika ? `url('${window.gSlika}')` : dBg; 
        window.izracunajVse();

        // Če slike še nimamo v spominu, jo doberemo iz ločene kolekcije "slike".
        if(!window.gSlika && a.id) {
            window.pridobiSliko(a.id).then(s => {
                // Preveri, da uporabnik medtem ni preklopil na drugega športnika/sezono.
                let trenutni = (window.tZgodovina && window.tZgodovina[window.mInd]) ? window.tZgodovina[window.mInd].id : null;
                if(s && trenutni === a.id) {
                    window.gSlika = s;
                    document.getElementById('slikaOkvir').style.backgroundImage = `url('${s}')`;
                }
            });
        }
    };

    window.mainSpremeniZgodovino = function(dir) {
        if (!window.tZgodovina || window.tZgodovina.length <= 1) return;
        window.mInd += dir; if (window.mInd < 0) window.mInd = 0; if (window.mInd >= window.tZgodovina.length) window.mInd = window.tZgodovina.length - 1;
        window.osveziVnosnaPolja(window.tZgodovina[window.mInd]);
    };

    window.sproziSlikoKlik = function() { document.getElementById('slikaVnos').click(); };

    window.preklopiPogled = function(p) {
        // Klubski trener (ne glavni admin) nima "Moja Kartica" - če bi kdo tja preusmeril,
        // ga pošljemo na "Moj Klub".
        if(p === 'prikaz' && window.jeTrener && !window.isAdm) { window.odpriMojKlub(); return; }
        window.posodobiStanjeModePreklopnika(false);
        let gS = document.getElementById('gumbSlava'); if(gS) gS.classList.toggle('aktivno', p === 'slava');
        let gI = document.getElementById('gumbIzzivi'); if(gI) gI.classList.toggle('aktivno', p === 'izzivi');
        document.getElementById('gumbVnos').classList.toggle('aktivno', p === 'vnos'); document.getElementById('gumbPrikaz').classList.toggle('aktivno', p === 'prikaz'); document.getElementById('gumbBaza').classList.toggle('aktivno', p === 'baza'); document.getElementById('gumbLestvica').classList.toggle('aktivno', p === 'lestvica');
        document.getElementById('panelVnos').style.display = 'none'; document.getElementById('panelPrikaz').style.display = 'none'; document.getElementById('panelBaza').style.display = 'none'; document.getElementById('panelLestvica').style.display = 'none'; document.getElementById('panelNadzor').style.display = 'none'; document.getElementById('zajem-slike').classList.remove('prikaz-nacin');
        let pS = document.getElementById('panelSlava'); if(pS) pS.style.display = 'none';
        let pI = document.getElementById('panelIzzivi'); if(pI) pI.style.display = 'none';
        let pSo = document.getElementById('panelSobe'); if(pSo) pSo.style.display = 'none';
        if(p === 'vnos') { document.getElementById('panelVnos').style.display = 'block'; document.getElementById('panelPrikaz').style.display = 'flex'; document.getElementById('btnSamoShraniSliko').style.display = 'none'; }
        else if (p === 'prikaz') { 
            document.getElementById('panelPrikaz').style.display = 'flex'; document.getElementById('zajem-slike').classList.add('prikaz-nacin');
            // Če je admin pravkar urejal tujega športnika, ob vrnitvi na "Moja Kartica"
            // povrnemo NJEGOVO lastno kartico - sicer bi tu ostal urejani športnik.
            if(window.urejaniId) { window.urejaniId = null; window.naloziKarticoZaSportnika(window.tEmail); } 
            if (!window.jeTrener && (!window.tZgodovina || window.tZgodovina.length === 0)) { window.prikaziPraznoKartico(); } else { window.izracunajVse(); }
        }
        else if (p === 'baza') { document.getElementById('panelBaza').style.display = 'flex'; document.getElementById('zajem-slike').classList.add('prikaz-nacin'); window.osveziGalerijo(); }
        else if (p === 'lestvica') { document.getElementById('panelLestvica').style.display = 'flex'; document.getElementById('zajem-slike').classList.add('prikaz-nacin'); window.izrisiLestvice(); }
        else if (p === 'izzivi') {
            let pi = document.getElementById('panelIzzivi');
            if(pi) pi.style.display = 'flex';
            window.naloziIzzive().then(() => window.izrisiIzzive());
        }
        else if (p === 'sobe') {
            let ps = document.getElementById('panelSobe');
            if(ps) ps.style.display = 'flex';
            window.naloziSobe().then(() => window.izrisiSobe());
        }
        else if (p === 'slava') {
            let ps = document.getElementById('panelSlava');
            if(ps) ps.style.display = 'flex';
            window.izrisiSlavo();
        }
        else if (p === 'nadzor') { document.getElementById('panelNadzor').style.display = 'flex'; document.getElementById('zajem-slike').classList.add('prikaz-nacin'); window.izrisiNadzor(); }
    };

    window.switchModalTab = function(tab) {
        let bK = document.getElementById('tabBtnKartica'); let bA = document.getElementById('tabBtnAnalitika'); let dK = document.getElementById('modalTabKartica'); let dA = document.getElementById('modalTabAnalitika');
        if(!bK) return;
        // Videz zavihkov vodi CSS razred .active (prej so bili trdo kodirani inline stili).
        bK.classList.toggle('active', tab === 'kartica');
        bA.classList.toggle('active', tab !== 'kartica');
        dK.style.display = (tab === 'kartica') ? 'flex' : 'none';
        dA.style.display = (tab === 'kartica') ? 'none' : 'flex';
    };

    window.zapriPoglej = function() {
        // JAVNI PROFIL: zapiranje kartice bi pustilo prazno stran, zato uporabnika
        // raje peljemo v aplikacijo (registracija / lestvica) - profil ni slepa ulica.
        if(window.jeProfilNacin && window.jeProfilNacin()) { location.href = location.pathname; return; }
        document.getElementById('viewCardOverlay').style.display = 'none'; document.getElementById('viewCardModal').style.display = 'none'; if(window.pRadar) { window.pRadar.destroy(); window.pRadar = null; } };

    window.poglejKartico = function(id) {
        let a = window.aBaza.find(x => x.id === id); if(!a) return; let eK = a.atletKljuc || (a.emailSportnika ? window.anonKljuc(a.emailSportnika) : null) || a.id; let g = window.groupAthletesByEmail(); window.mZgodovina = g[eK] || [a]; window.modInd = window.mZgodovina.findIndex(x => x.id === id); if(window.modInd === -1) window.modInd = 0;
        window.izrisiModalKartico();
        // Takoj prednaloži slike VSEH sezon tega športnika (ne le prikazane) - sicer se ob
        // preklapljanju med sezonami v oknu vsaka slika šele takrat naloži in nalaganje je vidno.
        window.prednaloziSlikeZaSeznam(window.mZgodovina.map(x => x.id));
    };

    // Prednaloži podan seznam slik v ozadju (paketno, brez posega v prikaz).
    window.prednaloziSlikeZaSeznam = async function(idji) {
        let manjkajo = (idji || []).filter(id => id && window.slikeCache[id] === undefined);
        if(manjkajo.length === 0) return;
        for(let i = 0; i < manjkajo.length; i += 30) {
            let kos = manjkajo.slice(i, i + 30).filter(id => window.slikeCache[id] === undefined);
            if(kos.length === 0) continue;
            try {
                let q = window.query(window.collection(window.db, "slike"), window.where(window.documentId(), 'in', kos));
                let snap = await window.getDocs(q);
                snap.forEach(d => { window.slikeCache[d.id] = d.data().slika || ""; });
                kos.forEach(id => { if(window.slikeCache[id] === undefined) window.slikeCache[id] = ""; });
                // Če je okno odprto na kartici iz tega paketa, jo osveži
                let trenutni = (window.mZgodovina && window.mZgodovina[window.modInd]) ? window.mZgodovina[window.modInd].id : null;
                if(trenutni && kos.includes(trenutni) && document.getElementById('viewCardOverlay').style.display === 'block') window.izrisiModalKartico();
            } catch(e) { console.warn('[G99] Prednalaganje slik sezon ni uspelo.', e); }
        }
    };

    // Poskrbi, da ima TRENUTNO prikazana kartica v "Poglej" oknu svojo sliko.
    // Prej se je slika naložila samo za kartico, na katero si kliknil - ob preklopu sezone
    // znotraj okna se za novo sezono ni naložila nič (dokler je nisi videl še v Bazi).
    window.zagotoviSlikoZaModal = function() {
        let a = (window.mZgodovina && window.mZgodovina[window.modInd]) ? window.mZgodovina[window.modInd] : null;
        if(!a || !a.id) return;
        if(a.slika || window.slikeCache[a.id] !== undefined) return; // že imamo (ali vemo, da je ni)
        let ciljId = a.id;
        window.pridobiSliko(ciljId).then(s => {
            let trenutni = (window.mZgodovina && window.mZgodovina[window.modInd]) ? window.mZgodovina[window.modInd].id : null;
            // Osveži samo, če je uporabnik medtem še vedno na isti kartici in okno je odprto
            if(s && trenutni === ciljId && document.getElementById('viewCardOverlay').style.display === 'block') window.izrisiModalKartico();
        });
    };

    window.modalSpremeniZgodovino = function(dir) {
        if (!window.mZgodovina || window.mZgodovina.length <= 1) return;
        window.modInd += dir; if (window.modInd < 0) window.modInd = 0; if (window.modInd >= window.mZgodovina.length) window.modInd = window.mZgodovina.length - 1; window.izrisiModalKartico();
    };

    window.izrisiModalKartico = function() {
        let a = window.mZgodovina[window.modInd]; let pI = window.modInd + 1; let pA = pI < window.mZgodovina.length ? window.mZgodovina[pI] : null;
        let lng = window.prevodi[window.tJezik]; 
        
        let aS = a.spol || 'M'; let aG = a.generacija || 'U17'; let cY = new Date().getFullYear(); let roj = parseInt(a.letorojstva); if(isNaN(roj)) roj = cY - (parseInt(a.starost) || 16); let vS = cY - roj;
        let vT = a.teza || 70; let vV = a.visina || ""; if (!window.normativi[aS] || !window.normativi[aS][aG]) { aS = 'M'; aG = 'U17'; } let sT = aS === 'M' ? (window.tJezik === 'sl' ? 'M' : 'M') : (window.tJezik === 'sl' ? 'Ž' : 'F'); let lim = window.getLimits(aS, aG);
        
        let vH = parseFloat(a.hitrost) || 0; let vM = parseFloat(a.moc) || 0; let vVz = parseFloat(a.vzdrzljivost) || 0; let vE = parseFloat(a.eksplozivnost) || 0; let vAg = parseFloat(a.agilnost) || 0;
        let sH = window.preračunaj(vH, lim.hitrost, true); let sM = window.preračunaj(vM/parseFloat(vT), lim.moc, false); let sV = window.preračunaj(vVz, lim.vzdrzljivost, false); let sE = window.preračunaj(vE/parseFloat(vT), lim.eksplozivnost, false); let sA = window.preračunaj(vAg, lim.agilnost, true);
        
        let o = Math.round((sH + sM + sV + sE + sA)/5); 
        let rankInfo = window.getRankClassAndName(o, lng);
        let rC = rankInfo.c; let rNText = rankInfo.n; let col = window.getColorForOvr(o);
        
        let bgS = (a.slika || window.slikeCache[a.id]) ? `url('${a.slika || window.slikeCache[a.id]}')` : ""; 

        let dH = "", dM = "", dV = "", dE = "", dA = "", dO = "";
        if(pA) {
            let ocPa = window.izracunajOcene(pA);
            let pSH = ocPa.ocene.hitrost, pSM = ocPa.ocene.moc, pSV = ocPa.ocene.vzdrzljivost, pSE = ocPa.ocene.eksplozivnost, pSA = ocPa.ocene.agilnost; let pOvr = Math.round((pSH + pSM + pSV + pSE + pSA)/5);
            dH = window.getDiffsHTML(sH, pSH); dM = window.getDiffsHTML(sM, pSM); dV = window.getDiffsHTML(sV, pSV); dE = window.getDiffsHTML(sE, pSE); dA = window.getDiffsHTML(sA, pSA); dO = window.getDiffsHTML(o, pOvr, true);
        }

        let zL = window.izracunajZnacke(sH, sM, sV, sE, sA, o, aG, parseFloat(vT), vS, vH, vM, vVz, vE, vAg);
        let zObjs = window.genZnacke(zL);
        let zH = zObjs.zH; let lH = zObjs.lH;

        let dC = (o >= 98) ? '' : col; let viS = vV ? ` | ${vV} ${lng.cm}` : ""; let seS = a.sezona ? ` | <span style="white-space: nowrap;">${window.prikaziSezono(a.sezona)}</span>` : ""; let nH = "";
        if(window.mZgodovina.length > 1) { let oP = (window.modInd < window.mZgodovina.length - 1) ? "1" : "0.3"; let oN = (window.modInd > 0) ? "1" : "0.3"; nH = `<div class="history-nav" style="display:flex;"><button onclick="window.modalSpremeniZgodovino(1)" style="opacity:${oP};"><i class="fa-solid fa-chevron-left"></i></button><span>${a.sezona || "Neznano"}</span><button onclick="window.modalSpremeniZgodovino(-1)" style="opacity:${oN};"><i class="fa-solid fa-chevron-right"></i></button></div>`; }
        let modeTxt = window.ratingMode === 'LOCAL' ? '📍 LOC' : '🌍 WRLD';

        // Enoten panel (meritve + telesna sestava) - ista funkcija kot v "Moja Kartica",
        // zato sta prikaza usklajena in mreža je enakomerna (prej so bili inline stili z
        // flex:1 1 30%, ki so zadnji dve škatli raztegnili v drugačno širino).
        let rawStatsHTML = window.dobiPodatkovniPanel([
            {i:'fa-bolt', n:lng.ttHit, v:vH.toFixed(2), u:'s', s:sH},
            {i:'fa-dumbbell', n:lng.ttMoc, v:vM.toFixed(0), u:'N', s:sM},
            {i:'fa-heart-pulse', n:lng.ttVzd, v:vVz.toFixed(1), u:'lvl', s:sV},
            {i:'fa-gauge-high', n:lng.ttEks, v:vE.toFixed(0), u:'N', s:sE},
            {i:'fa-wave-square', n:lng.ttAgi, v:vAg.toFixed(2), u:'s', s:sA}
        ], a);

        let h = `<div id="modalScaleWrapper" style="display:flex; flex-direction:column; align-items:center; width:100%;">
            ${nH}
            <div style="display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; margin-bottom:22px;">
                <div id="modalTabs" class="modal-tabs-bar">
                    <button onclick="window.switchModalTab('kartica')" id="tabBtnKartica" class="modal-tab-btn active">${lng.tabKar}</button>
                    <button onclick="window.switchModalTab('analitika')" id="tabBtnAnalitika" class="modal-tab-btn">${lng.tabAna}</button>
                </div>
                <div class="modal-utility-row">
                    <button onclick="window.toggleRatingMode(true)" id="btnToggleRatingModal" class="modal-chip" style="color:${window.ratingMode === 'LOCAL' ? '#4facfe' : '#f1c40f'}; border:1px solid ${window.ratingMode === 'LOCAL' ? '#4facfe' : '#f1c40f'};">${window.ratingMode === 'LOCAL' ? '📍 ' + lng.ratingLocal : '🌍 ' + lng.ratingGlobal}</button>
                    <button onclick="window.zapriPoglej(); window.odpriPorocilo('${a.id}');" id="btnOdpriPorociloIzPogleda" class="modal-chip modal-chip-porocilo">📄 ${lng.btnGenerirajPorocilo}</button>
                </div>
            </div>
            <div id="modalTabKartica" style="display:flex; flex-direction: column; align-items: center; width: 100%;">
                <div class="tilt-ovoj efekt-ovoj ima-foil ${window.dobiFoilTier(o)}" style="margin:0;"><div class="tilt-tarca" style="width:320px; height:480px;"><div class="poglej-flip" id="poglejFlip" onclick="window.obrniPoglejKartico()"><div class="poglej-face poglej-front${window.inFormRazred(a.id)}">${window.inFormTrakHTML(a.id)}<div class="fifa-kartica ${rC}" style="margin:0; box-shadow: 0 0 30px ${col};"><div class="foil-plast"></div>
                    <div class="notranji-rob"></div>
                    ${o >= 98 ? '<div class="g99-pulsing-glow" style="display:block;"></div>' : ''}
                    <div class="slika-atleta-bg" style="background-image: ${bgS}; border-bottom-color: ${col};"></div>
                    <div class="kartica-ovr-wrapper" style="--rang-barva:${col};">
                        <div class="kartica-ovr-label">${dO}<div class="ovr-stevilka">${o}</div><div class="kartica-mode-text">${modeTxt}</div></div>
                        ${window.starostniZnakHTML(a, false)}
                    </div>
                    ${window.dobiZnakCastiHTML(a.id, true)}
                    <div class="znacke-kontejner">${zH}</div>
                    <div class="kartica-bottom" style="backface-visibility: hidden;">
                        <div class="kartica-bottom-ime">${window.escapeHtml(a.ime) || lng.neznan}</div>
                        <div class="kartica-bottom-rank" style="color:${col};">${rNText}</div>
                        <div class="kartica-bottom-detajli">${vS} ${lng.leta} | ${sT} | ${aG}${viS} | ${vT} ${lng.kg}${seS}</div>
                        <div class="stat-panel-ikone">
                            <div class="ikona-box" data-namig-ime="${lng.ttHit}" data-namig-vrednost="${sH} / 99" data-namig-barva="${col}"><i class="fa-solid fa-bolt ikona-img" style="color:${dC}"></i><div class="ikona-val">${dH}<span class="roll-in">${sH}</span></div></div>
                            <div class="ikona-box" data-namig-ime="${lng.ttMoc}" data-namig-vrednost="${sM} / 99" data-namig-barva="${col}"><i class="fa-solid fa-dumbbell ikona-img" style="color:${dC}"></i><div class="ikona-val">${dM}<span class="roll-in">${sM}</span></div></div>
                            <div class="ikona-box" data-namig-ime="${lng.ttVzd}" data-namig-vrednost="${sV} / 99" data-namig-barva="${col}"><i class="fa-solid fa-heart-pulse ikona-img" style="color:${dC}"></i><div class="ikona-val">${dV}<span class="roll-in">${sV}</span></div></div>
                            <div class="ikona-box" data-namig-ime="${lng.ttEks}" data-namig-vrednost="${sE} / 99" data-namig-barva="${col}"><i class="fa-solid fa-gauge-high ikona-img" style="color:${dC}"></i><div class="ikona-val">${dE}<span class="roll-in">${sE}</span></div></div>
                            <div class="ikona-box" data-namig-ime="${lng.ttAgi}" data-namig-vrednost="${sA} / 99" data-namig-barva="${col}"><i class="fa-solid fa-wave-square ikona-img" style="color:${dC}"></i><div class="ikona-val">${dA}<span class="roll-in">${sA}</span></div></div>
                        </div>
                    </div>
                </div></div>
                ${window.dobiHrbtnoStranHTML(a, o)}
                </div></div></div>
                <div class="poglej-namig">↻ ${lng.klikniZaObrat}</div>
                <div style="margin-top:16px; width:100%; display:flex; justify-content:center;">${rawStatsHTML}</div>
            </div>
            <div id="modalTabAnalitika" style="display:none; flex-direction:column; align-items:center; width: 100%; gap: 20px;">
                <div style="width: 320px; height: 320px; background: rgba(0,0,0,0.8); border-radius: 50%; padding: 15px; border: 2px solid ${col}; box-shadow: 0 0 20px ${col}44;"><canvas id="viewRadarChart"></canvas></div>
                ${zL.length > 0 ? `<div class="legenda-sekcija" style="display: flex; width: 320px; background: rgba(0,0,0,0.8); border-radius: 15px; border: 2px solid ${col}; padding: 15px; flex-direction: column; gap: 8px; box-shadow: 0 0 20px ${col}44;"><h3 style="margin: 0 0 10px 0; color: #4facfe; font-size: 13px; text-transform: uppercase; text-align: center;">🏆 ${lng.dosezeneZnacke}</h3>${lH}</div>` : ''}
            </div>
        </div>`;
        window.setH('viewCardContent', h); document.getElementById('viewCardOverlay').style.display = 'block'; document.getElementById('viewCardModal').style.display = 'flex';
        window.pripniTiltInFoil(document.getElementById('viewCardContent'));
        window.zagotoviSlikoZaModal();

        if(window.pRadar) { window.pRadar.destroy(); window.pRadar = null; }
        setTimeout(() => {
            let cx = document.getElementById('viewRadarChart'); if(cx) { if(window.pRadar) { try { window.pRadar.destroy(); } catch(e){} window.pRadar = null; } window.pRadar = new Chart(cx.getContext('2d'), { type: 'radar', data: { labels: lng.grafLabele, datasets: [{ data: [sH, sM, sV, sE, sA], backgroundColor: col + '44', borderColor: col, borderWidth: 3, pointBackgroundColor: col }] }, options: window.chartOptions }); }
        }, 50);
        document.querySelectorAll('.roll-in, .stat-diff, .ovr-diff').forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = null; });
    };

    // ==========================================
    // AI SCOUTING POROČILO
    // ==========================================
    // "AI analiza" spodaj NI klic pravega LLM API-ja (GPT/Claude ipd.) - ker gre za čisto
    // frontend aplikacijo, bi bil API ključ viden vsakomur v izvorni kodi brskalnika, kar je
    // varnostno tveganje. Namesto tega gre za mehanizem, ki iz resničnih percentilov,
    // zgodovine sezon in doseženih značk sestavi naravno berljivo analitično besedilo -
    // deluje in je videti kot "AI scouting report", brez potrebe po zunanjem servisu.

    window.percentil = function(val, arr) {
        let cl = (arr||[]).filter(v => v !== null && v !== undefined && !isNaN(v));
        if(cl.length === 0) return 50;
        let below = cl.filter(v => v <= val).length;
        return Math.max(1, Math.min(99, Math.round((below/cl.length)*100)));
    };

    // Za vsakega športnika v bazi vzame NAJNOVEJŠI zapis (po sezoni) in izračuna njegove
    // ocene, da lahko primerjamo trenutnega igralca z ostalimi (znotraj generacije in globalno).
    window.izracunajPopulacijoZaPorocilo = function() {
        let g = window.groupAthletesByEmail();
        let out = [];
        for(let e in g) {
            let a = g[e][0];
            let ocPop = window.izracunajOcene(a);
            let aS = ocPop.spol; let aG = ocPop.gen;
            let sH = ocPop.ocene.hitrost, sM = ocPop.ocene.moc, sV = ocPop.ocene.vzdrzljivost, sE = ocPop.ocene.eksplozivnost, sA = ocPop.ocene.agilnost;
            let ovr = Math.round((sH+sM+sV+sE+sA)/5);
            out.push({ gen: aG, spol: aS, ovr, sH, sM, sV, sE, sA });
        }
        return out;
    };

    // "AI Evalvacija" NI klic pravega LLM API-ja (GPT/Claude ipd.) - ker gre za čisto frontend
    // aplikacijo, bi bil API ključ viden vsakomur v izvorni kodi brskalnika (varnostno tveganje).
    // Gre za mehanizem, ki iz resničnih percentilov, trenda skozi sezone in doseženih značk
    // sestavi eno strnjeno, strokovno berljivo analitično besedilo.
    // Iz podatkov izlušči 3-4 RESNIČNO individualne zanimivosti - kandidatov je veliko
    // (rekordi baze, položaj v generaciji, redke kombinacije ocen, fizični kontekst,
    // trend med sezonami), prikažejo se najbolj "posebni" za tega konkretnega športnika,
    // zato se seznam med športniki dejansko razlikuje.
    window.generirajZanimivosti = function(a, ovr, sH, sM, sV, sE, sA, pOvr, statPerc, deltaOvr, zL, genPop, pop) {
        let sl = window.tJezik === 'sl';
        let z = (a.spol || 'M') === 'Z';
        let kandidati = []; // { prio: višje = bolj zanimivo, txt }
        let rek = window.badgeRekordi || {};

        // Če ima športnik poseben okvir, ga omeni z njegovim konkretnim pogojem -
        // sicer bi bil okvir na kartici le barva brez pojasnila.
        let okvA = window.okvirjiPoAtletu ? window.okvirjiPoAtletu[a.id] : null;
        if(okvA && window.OKVIRJI[okvA.kljuc]) {
            kandidati.push({ prio: 98, txt: `${window.OKVIRJI[okvA.kljuc].ikona} <b>${okvA.ime}</b> — ${okvA.opis}` });
        }
        let vH = parseFloat(a.hitrost)||0, vM = parseFloat(a.moc)||0, vVz = parseFloat(a.vzdrzljivost)||0, vE = parseFloat(a.eksplozivnost)||0, vAg = parseFloat(a.agilnost)||0;
        let vT = parseFloat(a.teza)||70; let vVis = parseFloat(a.visina)||0;

        // Rekordi celotne baze - najmočnejše zanimivosti
        if(vH > 0 && vH <= rek.mH) kandidati.push({prio: 10, txt: sl ? `⚡ Trenutno drži <b>najboljši čas šprinta v celotni bazi</b> (${vH.toFixed(2)} s).` : `⚡ Currently holds the <b>fastest sprint time in the entire database</b> (${vH.toFixed(2)} s).`});
        if(vM > 0 && vM >= rek.mM) kandidati.push({prio: 10, txt: sl ? `🏔️ Z ${vM.toFixed(0)} N je <b>najmočnejši${z?'a':''} v celotni bazi</b>.` : `🏔️ At ${vM.toFixed(0)} N, the <b>strongest in the entire database</b>.`});
        if(vVz > 0 && vVz >= rek.mV) kandidati.push({prio: 10, txt: sl ? `🔋 Dosega <b>najboljši rezultat vzdržljivosti v bazi</b> (stopnja ${vVz.toFixed(1)}).` : `🔋 Holds the <b>best endurance score in the database</b> (level ${vVz.toFixed(1)}).`});
        if(vE > 0 && vE >= rek.mE) kandidati.push({prio: 10, txt: sl ? `🚀 Z ${vE.toFixed(0)} N ima <b>najvišjo izmerjeno eksplozivnost v bazi</b>.` : `🚀 At ${vE.toFixed(0)} N, the <b>highest measured explosiveness in the database</b>.`});
        if(vAg > 0 && vAg <= rek.mA) kandidati.push({prio: 10, txt: sl ? `🐍 Drži <b>najboljši čas agilnosti v celotni bazi</b> (${vAg.toFixed(2)} s).` : `🐍 Holds the <b>best agility time in the entire database</b> (${vAg.toFixed(2)} s).`});

        // Položaj v generaciji
        if(genPop.length >= 3) {
            let boljsi = genPop.filter(p => p.ovr > ovr).length;
            if(boljsi === 0) kandidati.push({prio: 9, txt: sl ? `👑 Trenutno <b>najvišje ocenjen${z?'a':''} v generaciji ${a.generacija||'U17'}</b> (od ${genPop.length} športnikov).` : `👑 Currently the <b>highest-rated in the ${a.generacija||'U17'} generation</b> (out of ${genPop.length} athletes).`});
            else if(boljsi <= 2) kandidati.push({prio: 8, txt: sl ? `🥇 Med <b>top 3 v generaciji ${a.generacija||'U17'}</b> po skupni oceni.` : `🥇 Among the <b>top 3 in the ${a.generacija||'U17'} generation</b> by overall rating.`});
        }

        // Redke kombinacije / profil
        let stats = {[lng_ttHit()]: sH, [lng_ttMoc()]: sM, [lng_ttVzd()]: sV, [lng_ttEks()]: sE, [lng_ttAgi()]: sA};
        function lng_ttHit(){ return window.prevodi[window.tJezik].ttHit; } function lng_ttMoc(){ return window.prevodi[window.tJezik].ttMoc; } function lng_ttVzd(){ return window.prevodi[window.tJezik].ttVzd; } function lng_ttEks(){ return window.prevodi[window.tJezik].ttEks; } function lng_ttAgi(){ return window.prevodi[window.tJezik].ttAgi; }
        let vrednosti = [sH, sM, sV, sE, sA];
        let maxS = Math.max(...vrednosti); let minS = Math.min(...vrednosti);
        if(maxS - minS <= 5 && minS >= 70) kandidati.push({prio: 7, txt: sl ? `⚖️ Izjemno <b>uravnotežen profil</b> - razlika med najboljšo in najšibkejšo oceno je le ${maxS - minS} točk.` : `⚖️ Remarkably <b>balanced profile</b> - only ${maxS - minS} points separate the strongest and weakest scores.`});
        if(maxS - minS >= 30) {
            let topIme = Object.entries(stats).sort((x,y)=>y[1]-x[1])[0][0];
            kandidati.push({prio: 7, txt: sl ? `🎯 Izrazit <b>specialist</b> - področje "${topIme}" izrazito odstopa od preostalega profila (+${maxS - minS} točk nad najšibkejšim).` : `🎯 A clear <b>specialist</b> - "${topIme}" stands far above the rest of the profile (+${maxS - minS} points over the weakest area).`});
        }
        if(sH >= 85 && sM >= 85) kandidati.push({prio: 6, txt: sl ? `⚡💪 Redka kombinacija <b>hitrosti in moči</b> hkrati (obe nad 85) - profil, značilen za eksplozivne šprinterske tipe.` : `⚡💪 A rare combination of <b>speed and power</b> at once (both above 85) - a profile typical of explosive sprinter types.`});
        if(vT > 0 && vM/vT >= 20) kandidati.push({prio: 6, txt: sl ? `🐜 Izjemna <b>relativna moč</b>: ${(vM/vT).toFixed(1)} N na kilogram telesne teže.` : `🐜 Outstanding <b>relative strength</b>: ${(vM/vT).toFixed(1)} N per kilogram of body weight.`});
        if(vVis > 190 && sA >= 80) kandidati.push({prio: 6, txt: sl ? `🏰 Kljub višini ${vVis} cm ohranja <b>nadpovprečno agilnost</b> - redka kombinacija.` : `🏰 Despite standing ${vVis} cm tall, maintains <b>above-average agility</b> - a rare combination.`});

        // Trend
        if(deltaOvr !== null && deltaOvr !== undefined && deltaOvr >= 5) kandidati.push({prio: 8, txt: sl ? `📈 <b>+${deltaOvr} točk OVR</b> od prejšnje meritve - eden izmed izrazitejših napredkov v bazi.` : `📈 <b>+${deltaOvr} OVR points</b> since the last measurement - one of the more notable improvements in the database.`});

        // Rezerva, če ni dovolj "posebnosti" - vedno resnične, a splošnejše
        let topStat = Object.entries(stats).sort((x,y)=>y[1]-x[1])[0];
        kandidati.push({prio: 2, txt: sl ? `⭐ Najvišja posamična ocena: <b>${topStat[1]}</b> (${topStat[0]}).` : `⭐ Highest single score: <b>${topStat[1]}</b> (${topStat[0]}).`});
        if(pop.length >= 5) kandidati.push({prio: 1, txt: sl ? `📊 Skupna ocena ga uvršča pred <b>${pOvr.global}%</b> vseh ${pop.length} športnikov v bazi.` : `📊 The overall rating places them ahead of <b>${pOvr.global}%</b> of all ${pop.length} athletes in the database.`});

        kandidati.sort((x,y) => y.prio - x.prio);
        return kandidati.slice(0, 4).map(k => k.txt);
    };

    window.generirajNarativo = function(ime, spol, gen, ovr, pOvr, statPerc, deltaOvr, badgeNames) {
        let sl = window.tJezik === 'sl';
        let z = spol === 'Z'; // slovnični spol - da poročilo zveni naravno za vsakega posameznika
        let entries = Object.entries(statPerc);
        entries.sort((a,b) => b[1].gen - a[1].gen);
        let top = entries[0];
        let slabsi = entries.slice(-2).map(e => e[0]);

        let deloi = [];

        // Kratka razlaga, kaj "percentil" pomeni v praksi - samo enkrat, na začetku, v oklepaju,
        // da poročilo razume tudi nekdo brez statističnega predznanja.
        let pojasnilo = sl
            ? ` (med 100 naključnimi vrstniki iz iste generacije bi jih ${ime} prehitel${z?'a':''} približno ${pOvr.gen})`
            : ` (out of 100 random peers from the same generation, ${ime} would outperform roughly ${pOvr.gen} of them)`;

        // Uvodni ton se prilagodi glede na raven igralca - poročilo za "elitnega" in
        // "začetniškega" igralca ne zveni po istem kopirnem kalupu.
        let uvod;
        if(ovr >= 89) {
            uvod = sl
                ? `<b>${ime}</b> že danes spada med najbolje ocenjene igralce v bazi, s skupno oceno <b>${ovr} OVR</b> - bolj${z?'a':'ši'} od ${pOvr.gen}% vrstnikov v generaciji ${gen}${pojasnilo} in od ${pOvr.global}% v celotni G99 bazi.`
                : `<b>${ime}</b> already ranks among the top-rated players in the database, with an overall rating of <b>${ovr} OVR</b> - ahead of ${pOvr.gen}% of peers in the ${gen} generation${pojasnilo} and ${pOvr.global}% across the full G99 database.`;
        } else if(ovr >= 70) {
            uvod = sl
                ? `<b>${ime}</b> kaže nadpovprečne sposobnosti s skupno oceno <b>${ovr} OVR</b>, kar je bolj${z?'e':'je'} od ${pOvr.gen}% vrstnikov v generaciji ${gen}${pojasnilo} in od ${pOvr.global}% v celotni G99 bazi.`
                : `<b>${ime}</b> shows above-average ability with an overall rating of <b>${ovr} OVR</b>, ahead of ${pOvr.gen}% of peers in the ${gen} generation${pojasnilo} and ${pOvr.global}% across the full G99 database.`;
        } else if(ovr >= 50) {
            uvod = sl
                ? `<b>${ime}</b> ima trdne temelje s skupno oceno <b>${ovr} OVR</b>, kar pomeni, da je bolj${z?'a':'ši'} od ${pOvr.gen}% vrstnikov v generaciji ${gen}${pojasnilo} in od ${pOvr.global}% v celotni G99 bazi - z jasnim prostorom za napredek.`
                : `<b>${ime}</b> has a solid foundation with an overall rating of <b>${ovr} OVR</b>, ahead of ${pOvr.gen}% of peers in the ${gen} generation${pojasnilo} and ${pOvr.global}% across the full G99 database - with clear room to grow.`;
        } else {
            uvod = sl
                ? `<b>${ime}</b> je na začetku razvojne poti, s skupno oceno <b>${ovr} OVR</b> (bolj${z?'a':'ši'} od ${pOvr.gen}% vrstnikov v generaciji ${gen}${pojasnilo}). To ni razlog za skrb - gre za izhodiščno točko, od koder se bo meril napredek naprej.`
                : `<b>${ime}</b> is early in the development journey, with an overall rating of <b>${ovr} OVR</b> (ahead of ${pOvr.gen}% of peers in the ${gen} generation${pojasnilo}). This isn't a cause for concern - it's simply the starting point from which progress will be measured.`;
        }
        deloi.push(uvod);

        deloi.push(sl
            ? `Najmočnejše področje je trenutno "<b>${top[0]}</b>" (bolj${z?'a':'ši'} od ${top[1].gen}% vrstnikov) - lastnost, na kateri velja graditi tudi v prihodnje.`
            : `The strongest area right now is "<b>${top[0]}</b>" (ahead of ${top[1].gen}% of peers) - a quality worth continuing to build on.`);

        deloi.push(sl
            ? `Za nadaljnji napredek priporočamo osredotočen trening na ${slabsi.join(' in ')}, kjer je prostor za izboljšanje trenutno največji.`
            : `For continued progress, focused training on ${slabsi.join(' and ')} is recommended, as this is currently where the biggest room for improvement lies.`);

        if(badgeNames && badgeNames.length > 0) {
            let names = badgeNames.slice(0, 2).join(sl ? ' in ' : ' and ');
            deloi.push(sl
                ? `Doseženi značk${badgeNames.length > 1 ? 'i' : 'a'} "<b>${names}</b>" potrjuje${badgeNames.length > 1 ? 'ta' : ''} to usmerjenost.`
                : `The earned badge${badgeNames.length > 1 ? 's' : ''} "<b>${names}</b>" confirm${badgeNames.length > 1 ? '' : 's'} this profile.`);
        }

        if(deltaOvr !== null && deltaOvr !== undefined) {
            if(deltaOvr > 0) deloi.push(sl ? `Od prejšnje meritve je skupna ocena narasla za <b>${deltaOvr}</b> točk - jasen znak, da trening obrodi sadove.` : `Since the last measurement, the overall rating has risen by <b>${deltaOvr}</b> points - a clear sign that training is paying off.`);
            else if(deltaOvr < 0) deloi.push(sl ? `Od prejšnje meritve je skupna ocena upadla za <b>${Math.abs(deltaOvr)}</b> točk. To se lahko zgodi zaradi rasti, poškodbe ali spremembe treninga - priporočamo pogovor s trenerjem o vzroku.` : `Since the last measurement, the overall rating has dropped by <b>${Math.abs(deltaOvr)}</b> points. This can happen due to growth spurts, injury, or training changes - a conversation with the coach about the cause is recommended.`);
            else deloi.push(sl ? `Skupna ocena je od prejšnje meritve ostala enaka.` : `The overall rating is unchanged since the last measurement.`);
        } else {
            deloi.push(sl ? `To je prva zabeležena meritev - naslednje sezone bodo pokazale, v katero smer gre razvoj.` : `This is the first recorded measurement - future seasons will show the direction of development.`);
        }
        return deloi.join(' ');
    };

    // Ločeno stanje za poročilo (namenoma NE window.tZgodovina/window.mInd, ker ta služita
    // prikazu "Moja Kartica" za prijavljenega/urejanega športnika - poročilo pa je treba
    // znati odpreti za KATEREGA KOLI športnika iz Baze, ne glede na to, kdo je prijavljen).
    window.porociloZgodovina = [];
    window.porociloIdx = 0;

    window.odpriPorocilo = function(id) {
        let a = id ? window.aBaza.find(x => x.id === id) : null;
        if(!a && window.tZgodovina && window.tZgodovina.length > 0) { a = window.tZgodovina[window.mInd]; }
        if(!a) { alert(window.prevodi[window.tJezik].porociloNiPodatkov); return; }
        let eK = a.atletKljuc || (a.emailSportnika ? window.anonKljuc(a.emailSportnika) : null) || a.id;
        let g = window.groupAthletesByEmail();
        window.porociloZgodovina = g[eK] || [a];
        window.porociloIdx = window.porociloZgodovina.findIndex(x => x.id === a.id);
        if(window.porociloIdx === -1) window.porociloIdx = 0;
        window.izrisiPorocilo();
        document.getElementById('reportOverlay').style.display = 'block';
        document.getElementById('reportModal').style.display = 'block';
        if(!a.slika && window.slikeCache[a.id] === undefined) {
            window.pridobiSliko(a.id).then(s => {
                let trenutni = (window.porociloZgodovina && window.porociloZgodovina[window.porociloIdx]) ? window.porociloZgodovina[window.porociloIdx].id : null;
                if(s && trenutni === a.id && document.getElementById('reportOverlay').style.display === 'block') window.izrisiPorocilo();
            });
        }
    };

    window.porociloSpremeniZgodovino = function(dir) {
        if(!window.porociloZgodovina || window.porociloZgodovina.length <= 1) return;
        window.porociloIdx += dir;
        if(window.porociloIdx < 0) window.porociloIdx = 0;
        if(window.porociloIdx >= window.porociloZgodovina.length) window.porociloIdx = window.porociloZgodovina.length - 1;
        window.izrisiPorocilo();
    };

    window.zapriPorocilo = function() {
        document.getElementById('reportOverlay').style.display = 'none';
        document.getElementById('reportModal').style.display = 'none';
        if(window.porociloChart) { window.porociloChart.destroy(); window.porociloChart = null; }
        if(window.porociloRadar) { window.porociloRadar.destroy(); window.porociloRadar = null; }
    };

    window.izrisiPorocilo = function() {
        let idx = window.porociloIdx; let zgod = window.porociloZgodovina; let a = zgod[idx];
        let lng = window.prevodi[window.tJezik];

        let ocP = window.izracunajOcene(a);
        let aS = ocP.spol; let aG = ocP.gen; let vT = ocP.teza;
        let vH = ocP.surove.hitrost, vM = ocP.surove.moc, vVz = ocP.surove.vzdrzljivost, vE = ocP.surove.eksplozivnost, vAg = ocP.surove.agilnost;
        let sH = ocP.ocene.hitrost, sM = ocP.ocene.moc, sV = ocP.ocene.vzdrzljivost, sE = ocP.ocene.eksplozivnost, sA = ocP.ocene.agilnost;
        let ovr = ocP.ovr;
        let rankInfo = window.getRankClassAndName(ovr, lng);
        let col = window.getColorForOvr(ovr);

        let cY = new Date().getFullYear(); let roj = parseInt(a.letorojstva); if(isNaN(roj)) roj = cY - 16; let starost = cY - roj;

        let pop = window.izracunajPopulacijoZaPorocilo();
        let genPop = pop.filter(p => p.gen === aG && p.spol === aS);
        let pct = (key, val) => ({ gen: window.percentil(val, genPop.map(p=>p[key])), global: window.percentil(val, pop.map(p=>p[key])) });
        let pOvr = pct('ovr', ovr), pH = pct('sH', sH), pM = pct('sM', sM), pV = pct('sV', sV), pE = pct('sE', sE), pA = pct('sA', sA);

        let pIdx = idx + 1; let deltaOvr = null;
        if(pIdx < zgod.length) {
            deltaOvr = ovr - window.izracunajOcene(zgod[pIdx]).ovr;
        }

        let statPerc = { [lng.ttHit]: pH, [lng.ttMoc]: pM, [lng.ttVzd]: pV, [lng.ttEks]: pE, [lng.ttAgi]: pA };
        let zL = window.izracunajZnacke(sH, sM, sV, sE, sA, ovr, aG, vT, starost, vH, vM, vVz, vE, vAg);
        let narativ = window.generirajNarativo(window.escapeHtml(a.ime)||lng.neznan, aS, aG, ovr, pOvr, statPerc, deltaOvr, zL.map(z=>z.ime));
        let zanimivosti = window.generirajZanimivosti(a, ovr, sH, sM, sV, sE, sA, pOvr, statPerc, deltaOvr, zL, genPop, pop);

        // Značke z RAZLAGO (ime + opis pogoja) namesto golih ikon - da bralec poročila
        // takoj razume, kaj je športnik dosegel in zakaj.
        let badgeChipsHTML = zL.map(z => {
            let bC = (z.t===5)?"#ff9f43":(z.t===4)?"#00f2fe":(z.t===3)?"#a29bfe":(z.t===2)?"#ff7675":(z.t===1)?"#f1c40f":"#2ecc71";
            return `<div class="porocilo-badge-vrstica" style="border-left-color:${bC};">
                <i class="fa-solid ${z.ikona}" style="color:${bC};"></i>
                <div><div class="porocilo-badge-ime" style="color:${bC};">${z.ime}</div><div class="porocilo-badge-opis">${z.opis}</div></div>
            </div>`;
        }).join('');

        // ENA vrstica na statistiko: ikona + naziv + surova vrednost + ENA percentilna vrstica.
        // (Prej sta bili raw vrednosti in percentili v dveh ločenih sekcijah - podvajanje istih
        // 5 statistik je oteževalo hitro branje poročila, zato sta zdaj združeni.)
        let sl_ = window.tJezik === 'sl';
        let statRowsHTML = [
            {i:'fa-bolt', label: lng.ttHit, val: vH.toFixed(2)+' s', p: pH, color:'#f1c40f'},
            {i:'fa-dumbbell', label: lng.ttMoc, val: vM.toFixed(0)+' N', p: pM, color:'#ff7675'},
            {i:'fa-heart-pulse', label: lng.ttVzd, val: vVz.toFixed(1)+' lvl', p: pV, color:'#a29bfe'},
            {i:'fa-gauge-high', label: lng.ttEks, val: vE.toFixed(0)+' N', p: pE, color:'#fdcb6e'},
            {i:'fa-wave-square', label: lng.ttAgi, val: vAg.toFixed(2)+' s', p: pA, color:'#00cec9'},
        ].map(s => {
            let opis = sl_
                ? `Boljši od <b style="color:${s.color};">${s.p.gen}%</b> vrstnikov v generaciji in <b>${s.p.global}%</b> vseh v bazi`
                : `Better than <b style="color:${s.color};">${s.p.gen}%</b> of generation peers and <b>${s.p.global}%</b> of everyone in the database`;
            return `<div class="stat-kartica">
                <div class="stat-kartica-vrh">
                    <div class="stat-kartica-naziv"><i class="fa-solid ${s.i}" style="color:${s.color};"></i> ${s.label}</div>
                    <div class="stat-kartica-vrednost">${s.val}</div>
                </div>
                <div class="percentile-track" style="margin: 7px 0 6px 0;"><div class="percentile-fill" style="width:${s.p.gen}%; background:${s.color};"></div><div class="percentile-marker" style="left:${s.p.global}%;" title="${sl_ ? 'globalno' : 'global'}"></div></div>
                <div class="stat-kartica-opis">${opis}</div>
            </div>`;
        }).join('');

        let bgS = (a.slika || window.slikeCache[a.id]) ? `url('${a.slika || window.slikeCache[a.id]}')` : '';
        let now = new Date(); let dateStr = now.toLocaleDateString(window.tJezik === 'sl' ? 'sl-SI' : 'en-GB');

        // Telesna sestava (FFMI) - prikaže se samo, če so podatki na voljo
        let sl2 = window.tJezik === 'sl';
        let ff = window.izracunajFFMI(vT, a.visina, a.odstotekMascobe, a.misicnaMasa);
        let ffmiHTML = '';
        if(ff) {
            let bf = parseFloat(a.odstotekMascobe);
            let opomba = ff.izPovrsine === 'misicna'
                ? (sl2 ? 'Ocenjeno iz vnesene mišične mase - vnos % maščobe da natančnejši rezultat.' : 'Estimated from entered muscle mass - entering body fat % gives a more accurate result.')
                : (sl2 ? 'FFMI je odvisen od metode merjenja % maščobe (kaliper, bioimpedanca, DEXA) - smiselno je primerjati le meritve, opravljene z isto metodo.' : 'FFMI depends on the body-fat measurement method (caliper, bioimpedance, DEXA) - only compare measurements taken with the same method.');
            ffmiHTML = `<div class="porocilo-sekcija">
                <div class="porocilo-sekcija-title">🧬 ${sl2 ? 'Telesna sestava' : 'Body Composition'}</div>
                <div class="sestava-grid">
                    <div class="sestava-box"><div class="sestava-label">FFMI</div><div class="sestava-val">${ff.ffmiNorm.toFixed(1)}</div></div>
                    <div class="sestava-box"><div class="sestava-label">${sl2 ? 'Pusta masa' : 'Lean mass'}</div><div class="sestava-val">${ff.pustaMasa.toFixed(1)} <span>kg</span></div></div>
                    ${!isNaN(bf) && bf > 0 ? `<div class="sestava-box"><div class="sestava-label">${sl2 ? 'Maščoba' : 'Body fat'}</div><div class="sestava-val">${bf.toFixed(1)} <span>%</span></div></div>` : ''}
                </div>
                <div class="sestava-opis">${sl2 ? '<b>FFMI</b> (Fat-Free Mass Index) pove, koliko nemaščobne (puste) mase ima športnik glede na svojo višino - za oceno mišičnega razvoja je uporabnejši od ITM, ki ne loči mišic od maščobe.' : '<b>FFMI</b> (Fat-Free Mass Index) indicates how much fat-free (lean) mass an athlete carries relative to their height - more useful than BMI for judging muscular development, as BMI cannot separate muscle from fat.'}<br><span style="color:#5a6a85;">${opomba}</span></div>
            </div>`;
        }

        let navHTML = zgod.length > 1 ? `<div class="history-nav" style="margin-bottom: 18px;">
            <button onclick="window.porociloSpremeniZgodovino(1)" style="opacity:${idx < zgod.length-1 ? '1':'0.3'};"><i class="fa-solid fa-chevron-left"></i></button>
            <span>${window.prikaziSezono(a.sezona)}</span>
            <button onclick="window.porociloSpremeniZgodovino(-1)" style="opacity:${idx > 0 ? '1':'0.3'};"><i class="fa-solid fa-chevron-right"></i></button>
        </div>` : '';

        let html = `<div class="porocilo-wrap" id="porociloExportArea">
            <div class="porocilo-header">
                <div><div class="porocilo-brand-name">G99 <span>PERFORMANCE</span></div><div class="porocilo-brand-sub">${lng.porociloNaslov}</div></div>
                <div class="porocilo-meta">${dateStr}<br>${window.prikaziSezono(a.sezona)}</div>
            </div>
            <div class="porocilo-body">
                ${navHTML}

                <div class="porocilo-bio">
                    <div class="porocilo-foto" style="background-image:${bgS};"></div>
                    <div class="porocilo-bio-info">
                        <h2>${window.escapeHtml(a.ime)||lng.neznan}</h2>
                        <div class="porocilo-bio-tags">${starost} ${lng.leta} • ${aG} • ${a.visina||'-'} ${lng.cm} • ${vT} ${lng.kg}</div>
                    </div>
                    <div class="porocilo-ovr-block">
                        <div class="porocilo-ovr-num" style="color:${col};">${ovr}</div>
                        <div class="porocilo-ovr-rank" style="color:${col};">${rankInfo.n}</div>
                    </div>
                </div>

                <div class="porocilo-sekcija">
                    <div class="ai-box-v2">
                        <div class="ai-box-v2-title">🛡️ ${lng.porociloAiNaslov}</div>
                        <p>${narativ}</p>
                    </div>
                </div>

                <div class="porocilo-sekcija">
                    <div class="porocilo-sekcija-title">✨ ${lng.porociloZanimivosti}</div>
                    <div class="zanimivosti-box"><ul>${zanimivosti.map(t=>`<li>${t}</li>`).join('')}</ul></div>
                </div>

                <div class="porocilo-sekcija">
                    <div class="porocilo-sekcija-title">📊 ${lng.porociloStatistike}</div>
                    ${statRowsHTML}
                    <div class="percentile-legenda">${lng.porociloLegendaEnostavna}</div>
                </div>

                ${ffmiHTML}

                <div class="porocilo-sekcija">
                    <div class="porocilo-sekcija-title">🕸️ ${lng.porociloProfil}</div>
                    <div class="porocilo-radar-box"><canvas id="porociloRadarChart"></canvas></div>
                </div>

                <div class="porocilo-sekcija">
                    <div class="porocilo-sekcija-title">📈 ${lng.porociloNapredek}</div>
                    <div class="porocilo-graf-box"><canvas id="porociloLineChart"></canvas></div>
                </div>

                ${zL.length > 0 ? `<div class="porocilo-sekcija"><div class="porocilo-sekcija-title">🏆 ${lng.dosezeneZnacke}</div>${badgeChipsHTML}</div>` : ''}
            </div>
            <div class="porocilo-footer">${lng.porociloFooter}</div>
        </div>`;

        window.setH('porociloVsebina', html);
        window.setT('btnPrenesiPorociloTxt', lng.btnPrenesiPorocilo);

        setTimeout(() => {
            if(window.porociloRadar) { window.porociloRadar.destroy(); window.porociloRadar = null; }
            let rx = document.getElementById('porociloRadarChart');
            if(rx) { window.porociloRadar = new Chart(rx.getContext('2d'), { type: 'radar', data: { labels: [...lng.grafLabele], datasets: [{ data: [sH,sM,sV,sE,sA], backgroundColor: col + '44', borderColor: col, borderWidth: 3, pointBackgroundColor: col }] }, options: window.chartOptions }); }

            window.izrisiGrafNapredka(zgod, col);
        }, 50);
    };

    // Uredi meritve po sezoni naraščajoče in vrne { labele, ovr }.
    window.sezonskiNiz = function(seznam) {
        let h = [...seznam].sort((x, y) => {
            let sx = parseInt((x.sezona || '').replace(/\D/g, '')) || 0;
            let sy = parseInt((y.sezona || '').replace(/\D/g, '')) || 0;
            return sx - sy;
        });
        return { labele: h.map(z => window.prikaziSezono(z.sezona)), ovr: h.map(z => window.izracunajOcene(z).ovr) };
    };

    window.izrisiGrafNapredka = function(zgod, col) {
        if(window.porociloChart) { try { window.porociloChart.destroy(); } catch(e){} window.porociloChart = null; }
        let cx = document.getElementById('porociloLineChart'); if(!cx) return;
        let jaz = window.sezonskiNiz(zgod);
        window.porociloChart = new Chart(cx.getContext('2d'), {
            type: 'line',
            data: { labels: jaz.labele, datasets: [{ label: 'OVR', data: jaz.ovr, borderColor: col,
                    backgroundColor: col + '33', borderWidth: 3, fill: true, tension: 0.35,
                    pointBackgroundColor: col, pointRadius: 5 }] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { y: { min: 0, max: 99, ticks: { color: '#888' }, grid: { color: '#222' } },
                          x: { ticks: { color: '#888' }, grid: { color: '#222' } } },
                plugins: { legend: { display: false } } }
        });
    };

    // ==========================================
    // LIVE DRAFT DAY - TV NAČIN (?tv=1)
    // ==========================================
    // Skriti pogled za projektor na dogodku. Bere JAVNO kolekcijo "atleti" prek onSnapshot,
    // zato prijava ni potrebna in nič ne piše v bazo - zaslon je samo gledalec.
    window.tvVrsta = [];          // čakalna vrsta kartic za prikaz
    window.tvTece = false;        // ali je prikaz trenutno v teku
    window.tvPrviSnapshot = true; // prvi odziv vrne CELO bazo - tega ne smemo predvajati
    window.tvRekordi = null;      // najboljše vrednosti PRED novo kartico
    window.tvZvokCtx = null;

    // Napisi v mirovanju. Vrtijo se naključno, brez ponovitve zapored, da zaslon med
    // čakanjem ni mrtev. Držijo se jezika kartic - govorijo o meritvi, ne o motivaciji nasploh.
    window.TV_NAPISI = {
        sl: ['Številka ne laže', 'Kartica se ne pogaja', 'Sekunda je sekunda',
             'Nihče te ne bo izmeril namesto tebe', 'Rang si prislužiš, ne izprosiš',
             'Danes postavljaš izhodišče', 'Naslednja sezona te bo primerjala s tem',
             'Vsak lahko govori. Merilec ne', 'Devetindevetdeset je meja. Ne cilj',
             'Kdor se ne izmeri, ne ve',
             'Meritev je iskrena tudi takrat, ko ti ni prav',
             'Talent te pripelje do vrat. Delo te spravi skoznje',
             'Napredek se ne zgodi. Napredek se izmeri',
             'Tvoj rekord je nekomu drugemu cilj',
             'Ni slabih rezultatov. So samo izhodišča',
             'Trening odloči. Meritev samo prizna',
             'Kdor šteje izgovore, ne šteje sekund',
             'Lani je bila to tvoja meja',
             'Nihče se ne spominja, kako si se počutil. Številka ostane',
             'Enkrat na leto izveš resnico o sebi',
             'Tekmuj s prejšnjo sezono, ne s sosedom',
             'Bolečina na treningu je cena za tisto številko',
             'Kartica pove, kje si. Ti odločiš, kam greš',
             'Vsi hočejo rezultat. Malokdo hoče ponovitev'],
        en: ['Numbers do not lie', 'The card does not negotiate', 'A second is a second',
             'Nobody gets measured for you', 'You earn your rank, you do not ask for it',
             'Today you set the baseline', 'Next season will compare you to this',
             'Anyone can talk. The timer cannot', 'Ninety-nine is the limit, not the goal',
             'If you are not measured, you do not know',
             'The measurement is honest even when you are not ready for it',
             'Talent gets you to the door. Work gets you through it',
             'Progress does not happen. Progress gets measured',
             'Your record is somebody else\'s goal',
             'There are no bad results. Only starting points',
             'Training decides. The measurement only confirms',
             'Whoever counts excuses does not count seconds',
             'Last year this was your limit',
             'Nobody remembers how you felt. The number stays',
             'Once a year you find out the truth about yourself',
             'Compete with last season, not with the guy next to you',
             'The pain in training is the price of that number',
             'The card says where you are. You decide where you go',
             'Everyone wants the result. Few want the repetition']
    };

    // CITATI: IZKLJUČNO športniki - noben trener, lastnik ali funkcionar.
    // Kratki in dobro dokumentirani. Če katerega ne želiš prikazovati, ga preprosto
    // pobriši iz tega polja - drugje se ne uporablja.
    window.TV_CITATI = [
        { sl: 'Zgrešiš 100 % strelov, ki jih ne poskusiš.', en: 'You miss 100% of the shots you don\'t take.', kdo: 'Wayne Gretzky' },
        { sl: 'Ne štej dni. Poskrbi, da dnevi štejejo.', en: 'Don\'t count the days. Make the days count.', kdo: 'Muhammad Ali' },
        { sl: 'Uspeh ni naključje.', en: 'Success is no accident.', kdo: 'Pelé' },
        { sl: 'Sprejmem poraz. Ne sprejmem, da ne bi poskusil.', en: 'I can accept failure. I can\'t accept not trying.', kdo: 'Michael Jordan' },
        { sl: 'Noben človek ni omejen.', en: 'No human is limited.', kdo: 'Eliud Kipchoge' },
        { sl: 'Bitke, ki štejejo, niso tiste za medalje.', en: 'The battles that count aren\'t the ones for medals.', kdo: 'Jesse Owens' },
        { sl: 'Talent brez trdega dela ni nič.', en: 'Talent without working hard is nothing.', kdo: 'Cristiano Ronaldo' },
        { sl: 'Poraz ni moj sovražnik. Strah pred porazom je.', en: 'Losing is not my enemy. Fear of losing is my enemy.', kdo: 'Rafael Nadal' },
        { sl: 'Če se bojiš neuspeha, ti verjetno ne bo uspelo.', en: 'If you\'re afraid to fail, then you\'re probably going to fail.', kdo: 'Kobe Bryant' },
        { sl: 'Bolje je gledati naprej in se pripraviti kot nazaj in obžalovati.', en: 'It\'s better to look ahead and prepare than to look back and regret.', kdo: 'Jackie Joyner-Kersee' },
        { sl: 'Nikoli ne podcenjuj moči sanj.', en: 'Never underestimate the power of dreams.', kdo: 'Wilma Rudolph' },
        { sl: 'Če ne verjameš vase, zakaj bi kdo drug?', en: 'If you don\'t believe in yourself, why is anyone else going to?', kdo: 'Tom Brady' }
    ];

    window.tvNapisIdx = -1;
    window.tvNapisTimer = null;

    // Meša lastne napise in citate. Citat dobi še vrstico z avtorjem.
    window.tvSestaviNapise = function() {
        let j = window.tJezik;
        let lastni = (window.TV_NAPISI[j] || window.TV_NAPISI.sl).map(t => ({ t: t, kdo: null }));
        let citati = window.TV_CITATI.map(c => ({ t: '\u201C' + (c[j] || c.sl) + '\u201D', kdo: c.kdo }));
        return lastni.concat(citati);
    };

    // Takoj postavi novo besedilo (brez lastnega bledenja) - uporablja se, ko je celoten
    // citatni blok tako ali tako neviden in bo prišel s prelivom.
    window.tvPostaviNapis = function() {
        let el = document.getElementById('tvMotiv'); if(!el) return;
        let sez = window.tvSestaviNapise();
        let i;
        do { i = Math.floor(Math.random() * sez.length); } while(sez.length > 1 && i === window.tvNapisIdx);
        window.tvNapisIdx = i;
        let n = sez[i];
        el.innerHTML = '<div><div>' + window.escapeHtml(n.t) + '</div>' +
            (n.kdo ? '<div class="tv-motiv-avtor">' + window.escapeHtml(n.kdo) + '</div>' : '') + '</div>';
        el.classList.add('viden');
    };

    // Zamenjava besedila znotraj VIDNEGA bloka - z lastnim bledenjem.
    window.tvNaslednjiNapis = function() {
        let el = document.getElementById('tvMotiv'); if(!el) return;
        el.classList.remove('viden');
        setTimeout(window.tvPostaviNapis, 850);
    };

    // ===== CIKEL MIROVANJA =====
    // Izmenjava: citat 7 s, nato kartica iz baze 8 s. Kartic NE postavljam za besedilo -
    // da bi bile dovolj tihe, bi morale biti tako zatemnjene, da nihče ne prepozna, čigave
    // so, hkrati pa bi citat postal slabše berljiv. Ena stvar naenkrat, obe v polni moči.
    window.TV_CITAT_MS = 7000;
    window.TV_KARTICA_MS = 8000;
    window.tvCikelTimer = null;
    window.tvFaza = 'citat';
    window.tvZadnjiArhiv = null;

    // Naključna kartica iz baze, brez ponovitve zapored.
    window.tvNakljucnaIzBaze = function() {
        let baza = (window.aBaza || []).filter(a => (parseInt(a.ovr) || 0) > 0 && a.ime);
        if(baza.length === 0) return null;
        if(baza.length === 1) return baza[0];
        let a, obr = 0;
        do { a = baza[Math.floor(Math.random() * baza.length)]; obr++; }
        while(window.tvZadnjiArhiv && a.id === window.tvZadnjiArhiv && obr < 12);
        window.tvZadnjiArhiv = a.id;
        return a;
    };

    // Kompaktne meritve ob arhivski kartici (5 vrstic).
    window.tvArhivMeritveHTML = function(a) {
        let lng = window.prevodi[window.tJezik];
        let oc = window.izracunajOcene(a);
        return window.TESTI.map(t => {
            let raw = oc.surove[t.kljuc] || 0, ocena = oc.ocene[t.kljuc] || 0;
            let barva = window.getColorForOvr(ocena);
            return `<div class="tv-am">
                <div class="tv-am-ikona"><i class="fa-solid ${t.ikona}" style="color:${barva}"></i></div>
                <div class="tv-am-ime">${lng[t.labelKljuc] || t.kljuc}</div>
                <div class="tv-am-val">${raw.toFixed(t.decimalke)}<span>${t.enota}</span></div>
                <div class="tv-am-crta"><i style="width:${ocena}%; background:${barva};"></i></div>
                <div class="tv-am-ocena" style="color:${barva}">${ocena}</div>
            </div>`;
        }).join('');
    };

    // Preliv med slojema: najprej zbledi obstoječi, šele nato se pokaže novi.
    // Zamik 520 ms se ujema s trajanjem prehoda v CSS.
    // Objava "kdo je na štartu" na TV zaslon. Uporabljata jo skener zapestnice in
    // ročni gumb v Vnosu. Anonimni ključ pošljemo zraven, da TV lahko poišče zadnji OVR,
    // ne da bi kdaj videl e-naslov. Pisanje je zavarovano s catch: če admin ni prijavljen,
    // pravila zapis zavrnejo, in to ne sme prekiniti vnosa meritve.
    window.objaviNaStartu = function(ime, email) {
        ime = (ime || '').trim();
        if(!ime) return false;
        let kljuc = email ? window.anonKljuc(email) : null;
        try {
            window.setDoc(window.doc(window.db, "stanje", "naslednji"),
                          { ime: ime, kljuc: kljuc, cas: Date.now() }).catch(() => {});
        } catch(e) {}
        return true;
    };

    // Ročna napoved iz Vnosa - za primere, ko zapestnice ni (pozabljena, prvi obisk).
    window.napovejNaStartu = function() {
        let ime = (document.getElementById('ime') || {}).value || '';
        let email = (document.getElementById('emailSportnika') || {}).value || '';
        let g = document.getElementById('btnNaStartu');
        if(!window.objaviNaStartu(ime, email.toLowerCase().trim())) return;
        if(g) {
            let orig = g.innerHTML;
            g.innerHTML = '📣 ' + window.escapeHtml(ime.trim());
            setTimeout(() => { g.innerHTML = orig; }, 2200);
        }
    };

    // ===== TRETJI ZASLON: ATLET NA ŠTARTU =====
    // Skener zapestnice ve, kdo je prišel na vrsto, precej prej kot je meritev vnesena.
    // Ta zaslon ima PREDNOST pred citatom in kartico iz baze - prekine cikel, se pokaže
    // TV_START_MS, nato se cikel nadaljuje tam, kjer bi bil sicer.
    // Oznaka se menja ("Na štartu", "Na vrsti", ...), da napis ne postane tapeta.
    window.TV_START_MS = 11000;
    window._tvStTimer = null;
    window._tvStOznakaIdx = -1;

    window.tvStNaslednjaOznaka = function() {
        let sez = (window.prevodi[window.tJezik] || {}).tvStOznake || ['Na štartu'];
        let i;
        do { i = Math.floor(Math.random() * sez.length); }
        while(sez.length > 1 && i === window._tvStOznakaIdx);
        window._tvStOznakaIdx = i;
        return sez[i];
    };

    // Podnapis: če je športnik že v bazi, pokažemo njegov zadnji OVR - gledalci takoj
    // vedo, koliko mora podreti. Če ga ni, je to njegova prva meritev in to je svoja zgodba.
    window.tvStPodnapis = function(kljuc) {
        let lng = window.prevodi[window.tJezik];
        if(!kljuc) return '';
        let g = window.groupAthletesByEmail();
        let sez = g[kljuc];
        if(!sez || !sez.length) return lng.tvStPrvic;
        let zadnja = sez[0];
        let ovr = window.izracunajOcene(zadnja).ovr;
        return `${lng.tvStZadnji} <b>${ovr}</b>`;
    };

    window.tvPokaziNaStartu = function(ime, kljuc) {
        let el = document.getElementById('tvNaStartu');
        if(!el || !ime) return;
        if(window.tvTece) return;   // med prikazom prave kartice ne prekinjamo - ta ima prednost

        window.setT('tvStOznaka', window.tvStNaslednjaOznaka());
        window.setT('tvStIme', ime);
        window.setH('tvStPod', window.tvStPodnapis(kljuc));

        // Cikel ustavimo, da nam citat ali kartica ne skoči čez napoved.
        if(window.tvCikelTimer) { clearTimeout(window.tvCikelTimer); window.tvCikelTimer = null; }
        let citat = document.getElementById('tvCitatBlok');
        let arhiv = document.getElementById('tvArhiv');
        if(arhiv) arhiv.classList.remove('viden');
        window.tvPreklopiSloj(el, (arhiv && arhiv.style.display !== 'none') ? arhiv : citat,
                              () => el.classList.add('viden'));
        window.vibriraj([25, 60, 25]);

        if(window._tvStTimer) clearTimeout(window._tvStTimer);
        window._tvStTimer = setTimeout(window.tvSkrijNaStartu, window.TV_START_MS);
    };

    window.tvSkrijNaStartu = function() {
        if(window._tvStTimer) { clearTimeout(window._tvStTimer); window._tvStTimer = null; }
        let el = document.getElementById('tvNaStartu');
        if(!el || !el.classList.contains('viden')) return;
        el.classList.remove('viden');
        // Vrnemo se na citat in cikel poženemo od začetka - le če je bil zaslon že zagnan.
        window.tvFaza = 'citat';
        window.tvPostaviNapis();
        window.tvPreklopiSloj(document.getElementById('tvCitatBlok'), el);
        if(document.getElementById('tvStart').style.display === 'none') {
            if(window.tvCikelTimer) clearTimeout(window.tvCikelTimer);
            window.tvCikelTimer = setTimeout(window.tvCikelKorak, window.TV_CITAT_MS);
        }
    };

    window.tvPreklopiSloj = function(vklopi, izklopi, priprava) {
        if(izklopi) izklopi.classList.add('tv-sloj-skrit');
        setTimeout(() => {
            if(izklopi) { izklopi.style.display = 'none'; izklopi.classList.remove('tv-sloj-skrit'); }
            if(priprava) priprava();
            if(vklopi) {
                vklopi.style.display = 'flex';
                vklopi.classList.add('tv-sloj-skrit');
                void vklopi.offsetWidth;                 // izsili preračun, sicer prehoda ni
                vklopi.classList.remove('tv-sloj-skrit');
            }
        }, 520);
    };

    // ===== SAMODEJNA VELIKOST KARTIC =====
    // Namesto ugibanja po stopnjah izmerimo, koliko višine zares zasedejo ime, podnapis,
    // meritve in pas z rekordom, ter kartici damo natanko toliko, kolikor ostane.
    // Kliče se pred vsakim prikazom in ob spremembi velikosti okna.
    window.tvPrilagodiVelikost = function() {
        let visina = window.innerHeight || 900;
        let v = (sel) => { let e = document.querySelector(sel); return e ? e.offsetHeight : 0; };

        // ---- ŽIVA KARTICA: pod njo so ime, podnapis in meritve, ob dnu pas z rekordom ----
        let podKartico = v('.tv-ime') + v('.tv-podnapis') + v('#tvMeritve');
        let pas = 0;
        let rek = document.getElementById('tvRekord');
        if(rek && rek.classList.contains('viden')) pas = rek.offsetHeight + 40;
        else pas = 92;   // rezerva: rekord se lahko pojavi kadarkoli, postavitev se ne sme premakniti
        let naVoljo = visina - podKartico - pas - 70;      // 70 = zrak zgoraj in spodaj
        let f = Math.max(0.55, Math.min(1.45, naVoljo / 480));
        document.documentElement.style.setProperty('--tv-f', f.toFixed(3));

        // ---- ARHIVSKA KARTICA: nad njo oznaka, pod njo ime in podnapis ----
        let okoli = v('.tv-arhiv-oznaka') + v('.tv-arhiv-ime') + v('.tv-arhiv-pod');
        let naVoljoA = visina - okoli - 90;
        let fa = Math.max(0.5, Math.min(1.25, naVoljoA / 480));
        document.documentElement.style.setProperty('--tv-fa', fa.toFixed(3));
    };

    // Dokument športnika se zapiše PRED sliko (ID slike je ID športnika, zato drugače ne gre).
    // onSnapshot torej sproži prikaz, ko fotografije v kolekciji "slike" še NI.
    // Zato jo nekajkrat počakamo, namesto da bi kartico pokazali prazno.
    window.tvPocakajNaSliko = async function(atletId, poskusi, razmik) {
        let n = poskusi || 6, r = razmik || 600;
        for(let i = 0; i < n; i++) {
            let s = await window.pridobiSliko(atletId, true);
            if(s) return s;
            if(i < n - 1) await new Promise(res => setTimeout(res, r));
        }
        return "";
    };

    window.tvPokaziArhiv = async function() {
        let a = window.tvNakljucnaIzBaze();
        let el = document.getElementById('tvArhiv');
        if(!a || !el) { window.tvFaza = 'citat'; return; }
        // Fotografijo naložimo PRED prelivom. Če bi kartico prižgali in šele nato čakali
        // na sliko, bi se sredi prehoda pojavil prazen okvir - to je tisti "preskok".
        if(!a.slika) { try { await window.pridobiSliko(a.id); } catch(e) {} }
        if(window.tvTece) return;   // medtem je prišla nova meritev - ta ima prednost
        window.tvVstaviVelikoKartico(a, 'tvArhivKartica');
        window.setT('tvArhivIme', a.ime || '');
        let oc = window.izracunajOcene(a);
        window.setT('tvArhivPod', (a.generacija || '') + ' · OVR ' + oc.ovr + ' · ' + window.prikaziSezono(a.sezona));
        window.setH('tvArhivMeritve', window.tvArhivMeritveHTML(a));
        window.tvPrilagodiVelikost();
        window.tvPreklopiSloj(el, document.getElementById('tvCitatBlok'), () => el.classList.add('viden'));
    };

    window.tvSkrijArhiv = function() {
        let el = document.getElementById('tvArhiv');
        let cb = document.getElementById('tvCitatBlok');
        // Če arhiv sploh ni prižgan, ne sprožamo preliva - sicer bi citat po nepotrebnem utripnil.
        if(!el || !el.classList.contains('viden')) {
            if(el) el.style.display = 'none';
            if(cb) { cb.style.display = 'flex'; cb.classList.remove('tv-sloj-skrit'); }
            return;
        }
        window.tvPreklopiSloj(cb, el, () => el.classList.remove('viden'));
    };

    window.tvCikelKorak = function() {
        if(window.tvTece) return;   // med prikazom nove meritve cikel počiva
        if(window.tvFaza === 'citat') {
            window.tvFaza = 'kartica';
            window.tvPokaziArhiv();
            window.tvCikelTimer = setTimeout(window.tvCikelKorak, window.TV_KARTICA_MS);
        } else {
            window.tvFaza = 'citat';
            // Besedilo zamenjamo, DOKLER je blok še neviden, in ga šele nato prižgemo -
            // tako se menjava črk nikoli ne vidi.
            window.tvPostaviNapis();
            window.tvSkrijArhiv();
            window.tvCikelTimer = setTimeout(window.tvCikelKorak, window.TV_CITAT_MS);
        }
    };

    window.tvZazeniCikel = function() {
        if(window.tvCikelTimer) clearTimeout(window.tvCikelTimer);
        window.tvFaza = 'citat';
        window.tvSkrijArhiv();
        window.tvNaslednjiNapis();
        window.tvCikelTimer = setTimeout(window.tvCikelKorak, window.TV_CITAT_MS);
    };

    // Pred klikom na "Zaženi zaslon" se menjajo samo citati; cikel s karticami
    // prevzame šele po kliku.
    window.tvZazeniNapise = function() {
        if(window.tvNapisTimer) clearInterval(window.tvNapisTimer);
        window.tvNaslednjiNapis();
        window.tvNapisTimer = setInterval(() => {
            if(!window.tvCikelTimer && !window.tvTece) window.tvNaslednjiNapis();
        }, window.TV_CITAT_MS);
    };

    // PAS REKORDOV v mirovanju: najboljša vrednost po kategoriji IN kdo jo drži.
    // Med čakanjem je to najbolj zanimiva vsebina na zaslonu - ljudje iščejo svoje ime.
    // Kdo je bil izmerjen med to sejo zaslona - potrebno, da ločimo današnje rekorde
    // od tistih, ki so v bazi že od prej.
    window.tvDanes = new Set();

    window.tvIzrisiRekorde = function() {
        let el = document.getElementById('tvRekordiPas'); if(!el) return;
        let lng = window.prevodi[window.tJezik];
        // POZOR: rekordi so iz CELOTNE baze, ne le iz današnjega dogodka. Tako mora biti -
        // vrednost rekorda je merilo šele, ko drži proti vsem, ki so bili kdaj izmerjeni.
        let baza = (window.aBaza || []).filter(a => (parseInt(a.ovr) || 0) > 0);
        if(baza.length === 0) { el.innerHTML = ''; return; }

        let kosi = window.TESTI.map(t => {
            let najA = null, najV = t.nizjeJeBolje ? Infinity : 0;
            baza.forEach(a => {
                let v = parseFloat(a[t.kljuc]); if(!v || v <= 0) return;
                if(t.nizjeJeBolje ? v < najV : v > najV) { najV = v; najA = a; }
            });
            if(!najA) return '';
            let danes = window.tvDanes.has(najA.id);
            let barva = window.getColorForOvr(window.izracunajOcene(najA).ocene[t.kljuc] || 0);
            return `<div class="tv-rek${danes ? ' danes' : ''}">
                <div class="tv-rek-ime"><i class="fa-solid ${t.ikona}" style="color:${barva}"></i>${lng[t.labelKljuc] || t.kljuc}</div>
                <div class="tv-rek-val">${najV.toFixed(t.decimalke)}<span>${t.enota}</span></div>
                <div class="tv-rek-kdo">${danes ? '★ ' : ''}${window.escapeHtml(najA.ime || '')}</div>
            </div>`;
        }).join('');
        el.innerHTML = `<div class="tv-rek-naslov">${lng.tvRekordiNaslov}</div>` + kosi;
    };

    // Živa vrstica ob dnu: koliko meritev je v bazi in kdo trenutno vodi.
    window.tvOsveziStatus = function() {
        let el = document.getElementById('tvStatus'); if(!el) return;
        let lng = window.prevodi[window.tJezik];
        let baza = window.aBaza || [];
        let naj = null, najO = -1;
        baza.forEach(a => { let o = parseInt(a.ovr) || window.izracunajOcene(a).ovr;
                            if(o > najO) { najO = o; naj = a; } });
        el.innerHTML = `<div>${lng.tvStatMeritev} <b>${baza.length}</b></div>` +
            (naj ? `<div>${lng.tvStatVodi} <b>${window.escapeHtml(naj.ime || '')} · ${najO}</b></div>` : '');
    };

    // Odpre projektorski zaslon v novem zavihku. Naslov sestavi sam iz trenutne domene,
    // zato deluje na Netlify, na Live Serverju in na katerikoli prihodnji domeni.
    window.odpriTVZaslon = function() {
        window.open(location.origin + location.pathname + '?tv=1', '_blank');
    };

    // VELIKA KARTICA ZA TV. Namesto podvojenega izrisa ponovno uporabimo "Poglej":
    // izrisiModalKartico() sestavi kartico v skrito okno, mi pa iz njega PRESTAVIMO
    // vozlišče .tilt-ovoj na TV oder. Tako je kartica na projektorju zagotovo enaka
    // tisti v aplikaciji - tudi ko jo bova v prihodnje spreminjala.
    window.tvVstaviVelikoKartico = function(a, ciljId) {
        let cilj = document.getElementById(ciljId || 'tvKartica'); if(!cilj) return;
        cilj.innerHTML = '';
        try {
            window.mZgodovina = [a]; window.modInd = 0;
            window.izrisiModalKartico();
            // Okno samo je v TV načinu skrito; zanima nas le kartica v njem.
            ['viewCardOverlay','viewCardModal'].forEach(id => {
                let e = document.getElementById(id); if(e) e.style.display = 'none';
            });
            if(window.pRadar) { try { window.pRadar.destroy(); } catch(e){} window.pRadar = null; }
            let vsebina = document.getElementById('viewCardContent');
            let kartica = vsebina ? vsebina.querySelector('.tilt-ovoj') : null;
            if(kartica) {
                // Klik za obrat na projektorju nima smisla - kartica se vrti sama.
                let flip = kartica.querySelector('.poglej-flip');
                if(flip) { flip.removeAttribute('onclick'); flip.style.cursor = 'default'; }
                cilj.appendChild(kartica);
            }
            if(vsebina) vsebina.innerHTML = '';
        } catch(e) {
            console.error('TV kartica:', e);
            // Zasilno: mala kartica, da zaslon nikoli ne ostane prazen.
            cilj.innerHTML = window.dobiHTMLMaleKartice(a);
        }
    };

    // Panel s pravimi izmerjenimi vrednostmi ob kartici - na dogodku ljudi zanima
    // številka, ne le ocena.
    window.tvMeritveHTML = function(a) {
        let lng = window.prevodi[window.tJezik];
        let oc = window.izracunajOcene(a);
        let vrstice = window.TESTI.map(t => {
            let raw = oc.surove[t.kljuc] || 0;
            let ocena = oc.ocene[t.kljuc] || 0;
            let barva = window.getColorForOvr(ocena);
            return `<div class="tv-meritev">
                <div class="tv-m-ime"><i class="fa-solid ${t.ikona}" style="color:${barva}"></i>${lng[t.labelKljuc] || t.kljuc}</div>
                <div class="tv-m-raw">${raw.toFixed(t.decimalke)}<span>${t.enota}</span></div>
                <div class="tv-m-crta"><i style="width:${ocena}%; background:${barva};"></i></div>
                <div class="tv-m-ocena" style="color:${barva}">${ocena}</div>
            </div>`;
        }).join('');
        return vrstice;
    };

    window.jeTVNacin = function() {
        return new URLSearchParams(location.search).get('tv') === '1';
    };

    // Zvok delamo z WebAudio, da ni zunanjih datotek. Brskalnik ga dovoli šele po kliku,
    // zato ga odklene gumb "Zaženi zaslon".
    window.tvZvok = function(rekord) {
        try {
            if(!window.tvZvokCtx) return;
            let ctx = window.tvZvokCtx, t = ctx.currentTime;
            let udar = (frek, zamik, trajanje, glasnost, tip) => {
                let o = ctx.createOscillator(), g = ctx.createGain();
                o.type = tip || 'sine'; o.frequency.setValueAtTime(frek, t + zamik);
                g.gain.setValueAtTime(0.0001, t + zamik);
                g.gain.exponentialRampToValueAtTime(glasnost, t + zamik + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + zamik + trajanje);
                o.connect(g); g.connect(ctx.destination);
                o.start(t + zamik); o.stop(t + zamik + trajanje + 0.05);
            };
            udar(55, 0, 0.9, 0.55, 'sine');       // basovski udarec
            udar(110, 0.02, 0.5, 0.25, 'triangle');
            if(rekord) { udar(880, 0.18, 0.5, 0.18, 'square'); udar(1320, 0.30, 0.6, 0.14, 'square'); }
        } catch(e) { console.warn('TV zvok:', e); }
    };

    // Najboljše vrednosti v bazi. nizjeBolje: hitrost in agilnost sta časa.
    window.tvIzracunajRekorde = function() {
        let r = { ovr: 0 };
        window.TESTI.forEach(t => { r[t.kljuc] = t.nizjeJeBolje ? Infinity : 0; });
        (window.aBaza || []).forEach(a => {
            let o = parseInt(a.ovr) || window.izracunajOcene(a).ovr;
            if(o > r.ovr) r.ovr = o;
            window.TESTI.forEach(t => {
                let v = parseFloat(a[t.kljuc]); if(!v || v <= 0) return;
                if(t.nizjeJeBolje ? v < r[t.kljuc] : v > r[t.kljuc]) r[t.kljuc] = v;
            });
        });
        return r;
    };

    // Vrne seznam podrtih rekordov za novo kartico (primerja s stanjem PRED njo).
    window.tvPodrtiRekordi = function(a, prej) {
        let lng = window.prevodi[window.tJezik];
        let podrti = [];
        if(!prej) return podrti;
        let o = window.izracunajOcene(a).ovr;
        if(o > prej.ovr) podrti.push(lng.tvRekordOvr);
        window.TESTI.forEach(t => {
            let v = parseFloat(a[t.kljuc]); if(!v || v <= 0) return;
            let boljsi = t.nizjeJeBolje ? v < prej[t.kljuc] : v > prej[t.kljuc];
            if(boljsi) podrti.push(lng[t.labelKljuc] || t.kljuc);
        });
        return podrti;
    };

    window.tvStart = function() {
        try {
            let AC = window.AudioContext || window.webkitAudioContext;
            if(AC && !window.tvZvokCtx) window.tvZvokCtx = new AC();
            if(window.tvZvokCtx && window.tvZvokCtx.state === 'suspended') window.tvZvokCtx.resume();
        } catch(e) { console.warn('TV zvok ni na voljo:', e); }
        let el = document.getElementById('tvZaslon');
        if(el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
        let b = document.getElementById('tvStart'); if(b) b.style.display = 'none';
        let n = document.getElementById('tvNamig'); if(n) n.style.display = 'none';
        // Šele zdaj začnemo izmenjavati citate in kartice: prej mora biti gumb ves čas dosegljiv.
        window.tvZazeniCikel();
    };

    // Prikaz ENE kartice. Vrsta se predvaja po vrsti, da se dve shranjeni zaporedoma
    // ne prekrijeta - na dogodku se to zgodi pogosto.
    window.tvPrikaziNaslednjo = async function() {
        if(window.tvTece) return;
        let a = window.tvVrsta.shift();
        if(!a) return;
        window.tvTece = true;
        try {
            let lng = window.prevodi[window.tJezik];
            let prej = window.tvRekordi;
            let podrti = window.tvPodrtiRekordi(a, prej);

            // Fotografija je v ločeni kolekciji in se zapiše nekaj trenutkov za športnikom.
            if(!a.slika) { try { await window.tvPocakajNaSliko(a.id); } catch(e) {} }

            window.tvZvok(podrti.length > 0);

            if(window.tvCikelTimer) { clearTimeout(window.tvCikelTimer); window.tvCikelTimer = null; }
            window.tvSkrijArhiv();
            document.body.classList.add('tv-igra');
            document.getElementById('tvMirovanje').style.display = 'none';
            window.tvVstaviVelikoKartico(a);
            window.setH('tvMeritve', window.tvMeritveHTML(a));
            window.tvPrilagodiVelikost();
            window.setT('tvIme', a.ime || '');
            let oc = window.izracunajOcene(a);
            window.setT('tvPodnapis', (a.generacija || '') + ' · OVR ' + oc.ovr + ' · ' + window.prikaziSezono(a.sezona));
            let rk = document.getElementById('tvRekord');
            if(podrti.length > 0) {
                // Dve vrstici: razglas zgoraj, kategorije spodaj. Enovrstični napis se je
                // na zaslonu bral kot oznaka, ne kot dogodek.
                rk.innerHTML = '<b>' + window.escapeHtml(lng.tvNovRekord) + '</b>' +
                               '<i class="fa-solid fa-trophy"></i>' +
                               window.escapeHtml(podrti.join(' · '));
                rk.classList.add('viden');
                window.vibriraj([25, 60, 25]);
            } else { rk.innerHTML = ''; rk.classList.remove('viden'); }
            document.getElementById('tvOder').classList.add('viden');
            window.tvSkrijNaStartu();

            // Šele ZDAJ kartica postane del baze in novo merilo za naslednjo.
            window.tvDanes.add(a.id);
            let obst = window.aBaza.findIndex(x => x.id === a.id);
            if(obst >= 0) window.aBaza[obst] = a; else window.aBaza.push(a);
            window.tvRekordi = window.tvIzracunajRekorde();

            window.tvOsveziStatus();
            window.tvIzrisiRekorde();

            await new Promise(r => setTimeout(r, 12000));
            document.getElementById('tvOder').classList.remove('viden');
            document.body.classList.remove('tv-igra');
            document.getElementById('tvMirovanje').style.display = 'block';
            // Cikel nadaljujemo samo, če je bil zaslon že zagnan (sicer še čaka na klik).
            if(document.getElementById('tvStart').style.display === 'none') window.tvZazeniCikel();
            else window.tvNaslednjiNapis();
        } catch(e) { console.error('TV prikaz:', e); }
        window.tvTece = false;
        if(window.tvVrsta.length > 0) window.tvPrikaziNaslednjo();
    };

    window.zazeniTVNacin = async function() {
        // Pravilo "body.tv-nacin > *:not(#tvZaslon)" skrije NEPOSREDNE otroke telesa.
        // #tvZaslon pa v razčlenjeni strani ni neposreden otrok - leži znotraj ovoja,
        // ki ga je isto pravilo skrilo skupaj z njim. Rezultat: čisto črn zaslon brez napake.
        // Zato element najprej PRESTAVIMO neposredno v <body>; tako je vseeno, kje v
        // datoteki je zapisan, in pravilo ga ne more več pokopati.
        let tvEl = document.getElementById('tvZaslon');
        if(tvEl && tvEl.parentNode !== document.body) document.body.appendChild(tvEl);
        document.body.classList.add('tv-nacin');
        let lng = window.prevodi[window.tJezik];
        window.setT('tvCakanje', lng.tvCakanje);
        window.setT('tvNamig', lng.tvNamig);
        window.setT('tvPodlogo', lng.tvPodlogo);
        window.setT('tvArhivOznaka', lng.tvIzBaze);
        let b = document.getElementById('tvStart'); if(b) b.innerText = lng.tvZazeni;
        window.tvZazeniNapise();
        window.tvPrilagodiVelikost();
        window.addEventListener('resize', window.tvPrilagodiVelikost);
        try {
            const qS = await window.getDocs(window.collection(window.db, "atleti"));
            window.aBaza = []; qS.forEach(d => window.aBaza.push({ id: d.id, ...d.data(), _vir: 'javno' }));
            window.aBazaVse = window.aBaza;
            window.tvRekordi = window.tvIzracunajRekorde();
            window.tvOsveziStatus();
            window.tvIzrisiRekorde();

            window.onSnapshot(window.collection(window.db, "atleti"), (snap) => {
                // Prvi odziv vsebuje celotno bazo kot "added" - to je začetno stanje, ne dogodek.
                if(window.tvPrviSnapshot) { window.tvPrviSnapshot = false; return; }
                snap.docChanges().forEach(ch => {
                    if(ch.type !== 'added' && ch.type !== 'modified') return;
                    let a = { id: ch.doc.id, ...ch.doc.data(), _vir: 'javno' };
                    // Isti športnik lahko sproži več sprememb zapored (zapis, nato slika,
                    // nato popravek). V vrsti ga zato ZAMENJAMO, ne dodamo znova - sicer
                    // bi se ista kartica na projektorju predvajala dvakrat.
                    let obst = window.tvVrsta.findIndex(x => x.id === a.id);
                    if(obst >= 0) window.tvVrsta[obst] = a; else window.tvVrsta.push(a);
                });
                // Bazo in rekorde osvežimo ŠELE po tem, ko smo iz vrste prebrali novosti,
                // sicer bi nova kartica podrla rekord sama sebi in bi bil vsak vnos "rekord".
                if(window.tvVrsta.length > 0) window.tvPrikaziNaslednjo();
            }, (e) => console.error('TV onSnapshot:', e));

            // Tretji zaslon ("Na štartu: Jaka"). Prvi odziv je obstoječe stanje ob zagonu
            // TV, ne nov dogodek - zato ga (kot pri glavni bazi zgoraj) preskočimo, sicer
            // bi ob vsakem zagonu zaslona zavpil ime nekoga, ki je bil na vrsti včeraj.
            let tvPrviNaStartu = true;
            window.onSnapshot(window.doc(window.db, "stanje", "naslednji"), (snap) => {
                if(tvPrviNaStartu) { tvPrviNaStartu = false; return; }
                if(!snap.exists()) return;
                let d = snap.data();
                if(d && d.ime) window.tvPokaziNaStartu(d.ime, d.kljuc || null);
            }, (e) => console.error('TV na startu:', e));
        } catch(e) {
            console.error('TV način:', e);
            window.setT('tvCakanje', lng.tvNapaka);
        }
    };

    window.prenesiPorocilo = function() {
        let el = document.getElementById('porociloExportArea'); if(!el) return;
        let btn = document.getElementById('btnPrenesiPorocilo'); let orig = btn.innerHTML;
        btn.innerHTML = '⏳ ...'; btn.disabled = true;
        document.body.classList.add('exporting');
        html2canvas(el, { onclone: window.ocistiZaIzvoz, backgroundColor: '#050a18', scale: 2.5, useCORS: true, logging: false }).then(c => {
            document.body.classList.remove('exporting');
            let a = window.porociloZgodovina[window.porociloIdx];
            let imeAtl = a && a.ime ? a.ime : 'Atlet';
            let el2 = document.createElement('a'); el2.download = 'G99_Porocilo_' + imeAtl + '.png'; el2.href = c.toDataURL('image/png'); el2.click();
            btn.innerHTML = orig; btn.disabled = false;
        }).catch(() => { document.body.classList.remove('exporting'); btn.innerHTML = orig; btn.disabled = false; });
    };

    window.dobiHTMLMaleKartice = function(a, isL = false, iN = 0, lB = "#f1c40f", fC = false) {
        let lng = window.prevodi[window.tJezik]; 
        let aS = a.spol || 'M'; let aG = a.generacija || 'U17'; let cY = new Date().getFullYear(); let roj = parseInt(a.letorojstva); if(isNaN(roj)) roj = cY - (parseInt(a.starost) || 16); let vS = cY - roj; let vT = a.teza || 70; let vV = a.visina || ""; 
        if (!window.normativi[aS] || !window.normativi[aS][aG]) { aS = 'M'; aG = 'U17'; } let sT = aS === 'M' ? (window.tJezik === 'sl' ? 'M' : 'M') : (window.tJezik === 'sl' ? 'Ž' : 'F'); let lim = window.getLimits(aS, aG); let vH = parseFloat(a.hitrost) || 0; let vM = parseFloat(a.moc) || 0; let vVz = parseFloat(a.vzdrzljivost) || 0; let vE = parseFloat(a.eksplozivnost) || 0; let vAg = parseFloat(a.agilnost) || 0; 
        
        let sH = window.preračunaj(vH, lim.hitrost, true); let sM = window.preračunaj(vM/parseFloat(vT), lim.moc, false); let sV = window.preračunaj(vVz, lim.vzdrzljivost, false); let sE = window.preračunaj(vE/parseFloat(vT), lim.eksplozivnost, false); let sA = window.preračunaj(vAg, lim.agilnost, true); 
        let o = Math.round((sH + sM + sV + sE + sA)/5);
        
        let rankInfo = window.getRankClassAndName(o, lng);
        let rC = rankInfo.c; let rNText = rankInfo.n; let col = window.getColorForOvr(o);

        // Stara vgrajena slika ali že predpomnjena; sicer prazno - dopolni jo leno nalaganje.
        let sCache = a.slika || window.slikeCache[a.id] || "";
        let bgS = sCache ? `url('${sCache}')` : ""; 
        let cI = `mini-graf-${a.id}-${Date.now()}-${Math.floor(Math.random()*1000)}`; let iS = !fC && ((window.cMode && window.cIzbrani.includes(a.id)) || (window.dMode && window.dIzbrani.includes(a.id))); let iK = iS ? (window.dMode ? "kartica-za-brisanje" : "kartica-izbrana") : ""; 
        
        let zL = window.izracunajZnacke(sH, sM, sV, sE, sA, o, aG, parseFloat(vT), vS, vH, vM, vVz, vE, vAg);
        let mZH = ""; 
        if(zL && zL.slice) {
            zL.slice(0, 3).forEach(z => { 
                let bC = (z.t===5)?"#ff9f43":(z.t===4)?"#00f2fe":(z.t===3)?"#a29bfe":(z.t===2)?"#ff7675":(z.t===1)?"#f1c40f":"#2ecc71"; 
                mZH += `<div class="mini-znacka-krog" style="color: ${bC}; border-color: ${bC}; box-shadow: 0 0 3px ${bC};" data-namig-ime="${window.escapeHtml(z.ime)}" data-namig-opis="${window.escapeHtml(z.opis || '')}" data-namig-barva="${bC}"><i class="fa-solid ${z.ikona}"></i></div>`; 
            });
        }

        let aGumb = window.jeTrener && !isL && !fC ? `<button class="btn-mali btn-uredi" onclick="window.urediAtleta('${a.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-mali btn-brisi" onclick="window.brisiAtleta('${a.id}', this)"><i class="fa-solid fa-trash"></i></button>` : ""; let oCC = window.cMode && !fC ? `onclick="window.izberiIgralcaZaCompare('${a.id}')"` : (window.dMode && window.isAdm && !fC ? `onclick="window.izberiZaBrisanje('${a.id}')"` : ""); let rBH = isL ? `<div style="position:absolute; top:-12px; left:-12px; background:${lB}; color:#000; font-weight:900; font-size:20px; width:40px; height:40px; border-radius:50%; display:flex; justify-content:center; align-items:center; border:3px solid #0b1120; z-index:100; box-shadow: 0 0 10px ${lB};">#${iN}</div>` : ""; let viS = vV ? ` | ${vV} ${lng.cm}` : ""; let modeTxt = window.ratingMode === 'LOCAL' ? '📍 LOC' : '🌍 WRLD';
        // Foil ima VSAKA kartica, a stopnjevano po rangu (nižji rang = nežnejši lesk).
        let foilTier = window.dobiFoilTier(o);
        let lngG = window.prevodi[window.tJezik];

        // ZNAK ČASTI: največ EDEN na kartico (glej izracunajOkvirje). Rob in sij kartice
        // ostaneta v barvi RANGA - čast ima svoj kanal (emblem), da si barvi ne konkurirata.
        // V primerjalnem pogledu (fC) ga ne prikazujemo, da ne moti primerjave.
        let okvHTML = window.dobiZnakCastiHTML(fC ? null : a.id, false);

        return `<div class="atlet-vrstica-container efekt-ovoj ${iK} ima-foil ${foilTier}${window.inFormOvojRazred(a.id)}" data-canvas-id="${cI}" data-stats="${sH},${sM},${sV},${sE},${sA}" data-rank-color="${col}" style="position: relative;">${rBH}<div class="atlet-vrstica-flipper" ${oCC}><div class="atlet-vrstica-front ${rC}">${window.inFormTrakHTML(a.id)}<div class="notranji-rob"></div><div class="foil-plast"></div><div class="atlet-mini-slika" data-slika-atlet="${a.id}" style="background-image: ${bgS}; border-bottom-color: ${col};"><div class="mini-ovr-ovoj" style="--rang-barva:${col};"><div class="mini-ovr-box"><div class="mini-ovr-val">${o}</div><div class="mini-mode-text">${modeTxt}</div></div>${window.starostniZnakHTML(a, true)}</div>${okvHTML}<div class="mini-znacke-kontejner">${mZH}</div></div><div class="atlet-vrstica-info"><div class="atlet-vrstica-ime">${window.escapeHtml(a.ime) || lng.neznan}</div><div class="atlet-vrstica-rank" style="color: ${col};">${rNText}</div><div class="atlet-vrstica-detajli">${vS} ${lng.leta} | ${sT} | ${aG}${viS} | ${vT} ${lng.kg}</div><div class="mini-stat-panel"><div class="mini-ikona-box" data-namig-ime="${lng.ttHit}" data-namig-vrednost="${sH} / 99" data-namig-barva="${col}"><i class="fa-solid fa-bolt mini-ikona-img" style="color:${col};"></i><span class="mini-ikona-val">${sH}</span></div><div class="mini-ikona-box" data-namig-ime="${lng.ttMoc}" data-namig-vrednost="${sM} / 99" data-namig-barva="${col}"><i class="fa-solid fa-dumbbell mini-ikona-img" style="color:${col};"></i><span class="mini-ikona-val">${sM}</span></div><div class="mini-ikona-box" data-namig-ime="${lng.ttVzd}" data-namig-vrednost="${sV} / 99" data-namig-barva="${col}"><i class="fa-solid fa-heart-pulse mini-ikona-img" style="color:${col};"></i><span class="mini-ikona-val">${sV}</span></div><div class="mini-ikona-box" data-namig-ime="${lng.ttEks}" data-namig-vrednost="${sE} / 99" data-namig-barva="${col}"><i class="fa-solid fa-gauge-high mini-ikona-img" style="color:${col};"></i><span class="mini-ikona-val">${sE}</span></div><div class="mini-ikona-box" data-namig-ime="${lng.ttAgi}" data-namig-vrednost="${sA} / 99" data-namig-barva="${col}"><i class="fa-solid fa-wave-square mini-ikona-img" style="color:${col};"></i><span class="mini-ikona-val">${sA}</span></div></div></div></div>${!fC ? `<div class="atlet-vrstica-back ${rC}"><div class="mini-chart-container"><canvas id="${cI}" style="width: 100%; height: 100%;"></canvas></div>${window.dobiSestavaHTML(a, true)}<div class="atlet-vrstica-akcije"><div style="display: flex; width: 100%; gap: 8px;"><button class="btn-mali btn-poglej" onclick="window.poglejKartico('${a.id}')">${lng.btnPoglej}</button>${aGumb}</div></div></div>` : ''}</div></div>`;
    };

    // Sledi vsem mini-radar Chart.js instancam iz hover-predogleda, da jih lahko
    // uničimo pred vsakim ponovnim izrisom galerije/lestvice (prej memory leak,
    // ker so stare instance ostajale v spominu tudi ko so bili njihovi canvas-i odstranjeni iz DOM-a).
    window.miniCharts = window.miniCharts || [];
    window.ocistiMiniCharts = function() {
        window.miniCharts.forEach(ch => { try { ch.destroy(); } catch(e) {} });
        window.miniCharts = [];
    };

    window.izrisiGalerijo = function() {
        window.ocistiMiniCharts();
        let k = document.getElementById('galerijaKontejner'); k.innerHTML = ''; let lng = window.prevodi[window.tJezik];
        let fSpol = document.getElementById('filterSpol').value; let fGen = document.getElementById('filterGen').value; let fSort = document.getElementById('sortOvr').value; let qT = (document.getElementById('iskalnik').value || "").toLowerCase(); let fSez = document.getElementById('filterSezona').value;
        let g = window.groupAthletesByEmail(); let vA = [];
        for (let e in g) { let i = g[e]; if(fSez === "VSE") vA.push(i[0]); else { let sS = i.find(x => x.sezona === fSez); if(sS) vA.push(sS); } }
        let f = vA.filter(a => (fSpol === 'VSI' || a.spol === fSpol) && (fGen === 'VSI' || a.generacija === fGen) && (a.ime.toLowerCase().includes(qT)));
        if(f.length === 0) { k.innerHTML = `<div class="prazna-baza">${lng.bazaPrazna}</div>`; return; }
        
        // LOCAL ocena je relativna ZNOTRAJ ene generacije - U17 in PRO se ne moreta
        // "pošteno" primerjati na isti razvrstitvi, ker vsak tekmuje v svoji skupini.
        // Ko so torej prikazane VSE generacije skupaj, za razvrstitev in prikaz OVR
        // začasno prisilimo GLOBAL (edino skupno, univerzalno merilo), ne glede na
        // preklopnik - sicer bi lahko npr. izstopajoč U17 kadet v majhni skupini
        // pristal višje od resnično boljšega PRO igralca.
        let prisiljenGlobal = (fGen === 'VSI') && window.ratingMode === 'LOCAL';
        let prejsnjiMode = window.ratingMode;
        if(prisiljenGlobal) window.ratingMode = 'GLOBAL';
        window.posodobiStanjeModePreklopnika(fGen === 'VSI');

        f.forEach(a => { a.dynamicOvr = window.izracunajOcene(a).ovr; });

        f.sort((a,b) => { if(fSort === 'desc') return b.dynamicOvr - a.dynamicOvr; else return a.dynamicOvr - b.dynamicOvr; }).forEach((a) => {
            let hK = window.dobiHTMLMaleKartice(a, false); let oW = document.createElement('div'); oW.innerHTML = hK; let d = oW.firstElementChild; k.appendChild(d);
            d.addEventListener('mouseenter', () => {
                if(window.cMode) return; let cI = d.getAttribute('data-canvas-id'); let rC = d.getAttribute('data-rank-color'); let sR = d.getAttribute('data-stats'); if(!sR) return; let s = sR.split(',').map(Number); let mC = document.getElementById(cI);
                if(mC && !mC.classList.contains('narisan')) { mC.classList.add('narisan'); window.miniCharts.push(new Chart(mC.getContext('2d'), { type: 'radar', data: { labels: ['SPD', 'PWR', 'END', 'EXP', 'AGI'], datasets: [{ data: s, backgroundColor: rC + '33', borderColor: rC, borderWidth: 1.5, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display:false }, grid: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#888', font:{size:8} }, ticks: { display: false }, min: 0, max: 100 } }, plugins: { legend: { display: false } } } })); }
            });
        });

        // Šele zdaj, ko so vse kartice dejansko zgrajene (prikazana številka mora ujemati
        // z vrstnim redom), povrnemo prvotni preklopnik.
        if(prisiljenGlobal) window.ratingMode = prejsnjiMode;

        window.zazeniLenoNalaganjeSlik(k);
        window.pripniTiltInFoil(k);
        // Tiho prednaloži slike VSEH prikazanih športnikov, da drsenje nikoli ne čaka na omrežje.
        window.prednaloziVseSlike(f.map(x => x.id));
    };

    // ==========================================
    // NADZORNA PLOŠČA ZA TRENERJA
    // ==========================================
    // Ne bere ničesar novega iz Firebase - le drugače prikaže window.aBaza, ki je že naložen.
    // Pokaže sliko CELE ekipe: povprečja, kdo napreduje, kdo nazaduje, kdo ni bil testiran.
    window.izrisiNadzor = function() {
        let el = document.getElementById('nadzorVsebina');
        if(!el) return;
        let sl = window.tJezik === 'sl';
        let fSez = document.getElementById('nadzorSezona').value;

        let skupine = window.groupAthletesByEmail();
        let kljuci = Object.keys(skupine);
        if(kljuci.length === 0) {
            el.innerHTML = `<div class="nadzor-prazno">${sl ? 'V bazi še ni športnikov.' : 'No athletes yet.'}</div>`;
            return;
        }

        // Za vsakega športnika izberi zapis ustrezne sezone (ali najnovejšega pri "VSE").
        let vrstice = [];
        let netestiran = [];
        kljuci.forEach(k => {
            let zgod = skupine[k];
            let zapis;
            if(fSez === 'VSE') zapis = zgod[0];
            else zapis = zgod.find(z => z.sezona === fSez);
            if(!zapis) { netestiran.push(zgod[0]); return; }   // v tej sezoni ni bil testiran

            let oc = window.izracunajOcene(zapis);
            // Najdi prejšnjo sezono ISTEGA športnika za napredek
            let idx = zgod.indexOf(zapis);
            let prej = zgod[idx + 1];
            let delta = prej ? (oc.ovr - window.izracunajOcene(prej).ovr) : null;
            vrstice.push({ zapis, oc, delta, ime: zapis.ime || '—' });
        });

        if(vrstice.length === 0) {
            el.innerHTML = `<div class="nadzor-prazno">${sl ? 'V izbrani sezoni ni podatkov.' : 'No data for the selected season.'}</div>`;
            return;
        }

        // --- KPI-ji ekipe ---
        let stEkipa = vrstice.length;
        let povpOvr = Math.round(vrstice.reduce((s, v) => s + v.oc.ovr, 0) / stEkipa);
        let najboljsi = vrstice.reduce((a, b) => b.oc.ovr > a.oc.ovr ? b : a);
        let zDelto = vrstice.filter(v => v.delta !== null);
        let vVzponu = zDelto.filter(v => v.delta > 0).length;
        let vUpadu = zDelto.filter(v => v.delta < 0).length;

        // --- Povprečja po kategorijah (kje je ekipa močna/šibka) ---
        let katPovp = window.TESTI.map(t => {
            let lng = window.prevodi[window.tJezik];
            let vsota = vrstice.reduce((s, v) => s + v.oc.ocene[t.kljuc], 0);
            return { ime: lng[t.labelKljuc] || t.kljuc, barva: t.barva, povp: Math.round(vsota / stEkipa) };
        });
        let najmocnejsa = katPovp.reduce((a, b) => b.povp > a.povp ? b : a);
        let najsibkejsa = katPovp.reduce((a, b) => b.povp < a.povp ? b : a);

        // --- Napredovali / nazadovali (top 5 vsak) ---
        let gor = [...zDelto].filter(v => v.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
        let dol = [...zDelto].filter(v => v.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

        let kpiKartica = (naslov, vrednost, podnaslov, barva) =>
            `<div class="nadzor-kpi"><div class="nadzor-kpi-naslov">${naslov}</div>
             <div class="nadzor-kpi-vrednost" style="color:${barva || '#4facfe'};">${vrednost}</div>
             <div class="nadzor-kpi-pod">${podnaslov}</div></div>`;

        let html = '';

        // KPI vrstica
        html += `<div class="nadzor-kpi-vrsta">
            ${kpiKartica(sl ? 'Športnikov' : 'Athletes', stEkipa, sl ? 'v ekipi' : 'in team')}
            ${kpiKartica(sl ? 'Povprečni OVR' : 'Average OVR', povpOvr, sl ? 'cele ekipe' : 'whole team', window.getColorForOvr(povpOvr))}
            ${kpiKartica(sl ? 'Najboljši' : 'Top', najboljsi.oc.ovr, window.escapeHtml(najboljsi.ime), window.getColorForOvr(najboljsi.oc.ovr))}
            ${kpiKartica((sl ? 'V vzponu' : 'Improving'), vVzponu, sl ? `od ${zDelto.length}` : `of ${zDelto.length}`, '#2ecc71')}
            ${kpiKartica((sl ? 'V upadu' : 'Declining'), vUpadu, sl ? `od ${zDelto.length}` : `of ${zDelto.length}`, '#ff7675')}
        </div>`;

        // Povprečja po kategorijah
        html += `<div class="nadzor-blok"><div class="nadzor-blok-naslov">${sl ? 'Povprečja po kategorijah' : 'Category averages'}</div>
            <div class="nadzor-kat-mreza">`;
        katPovp.forEach(kk => {
            let oznaka = kk === najmocnejsa ? ` ${sl ? '· najmočnejša' : '· strongest'}` : (kk === najsibkejsa ? ` ${sl ? '· najšibkejša' : '· weakest'}` : '');
            html += `<div class="nadzor-kat">
                <div class="nadzor-kat-glava"><span>${kk.ime}</span><b style="color:${kk.barva};">${kk.povp}</b></div>
                <div class="nadzor-kat-crta"><div style="width:${kk.povp}%; background:${kk.barva};"></div></div>
                <div class="nadzor-kat-oznaka">${oznaka}</div>
            </div>`;
        });
        html += `</div></div>`;

        // Napredovali / nazadovali
        let seznam = (naslov, arr, barva, znak) => {
            if(arr.length === 0) return `<div class="nadzor-blok"><div class="nadzor-blok-naslov">${naslov}</div><div class="nadzor-prazno-mini">${sl ? 'Ni podatkov (potrebni sta vsaj 2 sezoni).' : 'No data (needs at least 2 seasons).'}</div></div>`;
            let vr = arr.map(v => `<div class="nadzor-mover">
                <span class="nadzor-mover-ime">${window.escapeHtml(v.ime)}</span>
                <span class="nadzor-mover-ovr">${v.oc.ovr} OVR</span>
                <span class="nadzor-mover-delta" style="color:${barva};">${znak}${Math.abs(v.delta)}</span>
            </div>`).join('');
            return `<div class="nadzor-blok"><div class="nadzor-blok-naslov">${naslov}</div>${vr}</div>`;
        };
        html += `<div class="nadzor-dvojni">
            ${seznam((sl ? 'Največji napredek' : 'Biggest gains'), gor, '#2ecc71', '+')}
            ${seznam((sl ? 'Največji upad' : 'Biggest drops'), dol, '#ff7675', '−')}
        </div>`;

        // Netestirani v tej sezoni
        if(fSez !== 'VSE' && netestiran.length > 0) {
            let imena = netestiran.map(a => window.escapeHtml(a.ime || '—')).join(', ');
            html += `<div class="nadzor-blok nadzor-opozorilo">
                <div class="nadzor-blok-naslov">${sl ? 'Ni testiran v tej sezoni' : 'Not tested this season'} (${netestiran.length})</div>
                <div class="nadzor-netestirani">${imena}</div>
            </div>`;
        }

        el.innerHTML = html;
    };

    window.izrisiLestvice = function() {
        window.ocistiMiniCharts();
        let c = document.getElementById('lestvicaVsebina'); c.innerHTML = ''; let lng = window.prevodi[window.tJezik]; 
        let fSez = document.getElementById('filterLestvicaSezona').value;
        let fSpol = document.getElementById('filterLestvicaSpol').value;

        let g = window.groupAthletesByEmail(); let vA = []; 
        for (let e in g) { 
            let i = g[e]; 
            let sS = fSez === "VSE" ? i[0] : i.find(x => x.sezona === fSez); 
            if(sS && (fSpol === "VSI" || sS.spol === fSpol)) {
                vA.push(sS); 
            }
        }
        
        // Lestvica NIKOLI ne filtrira po generaciji (vedno združuje vse skupaj), zato bi bil
        // LOCAL način tu vedno zavajajoč (glej opombo v izrisiGalerijo) - zato tu VEDNO
        // prisilimo GLOBAL, ne glede na preklopnik.
        let prejsnjiModeLestvica = window.ratingMode;
        window.ratingMode = 'GLOBAL';
        window.posodobiStanjeModePreklopnika(true);

        vA.forEach(a => { a.dynamicOvr = window.izracunajOcene(a).ovr; });

        function vF(v, nB) { let f = parseFloat(v); if (isNaN(f) || f <= 0) return nB ? 999 : 0; return f; }
                // Ena kategorija lestvice. Znak z mestom je od 4. mesta naprej v barvi RANGA
        // športnika, ne v barvi kategorije - tako lestvica na prvi pogled pove isto kot
        // kartica. Prva tri mesta obdržijo zlato, srebro in bron, ker je stopničke treba
        // ločiti od ranga.
        function uB(n, i, sF, b) {
            let iG = [...vA].sort(sF).filter(a => parseInt(a.ovr) > 0).slice(0, 10);
            if(iG.length === 0) return '';
            let h = `<div class="lestvica-sekcija" style="--lb:${b}; --lb-mehko:${window.barvaProsojno(b, 0.16)}; --lb-rob:${window.barvaProsojno(b, 0.45)}">
                <div class="lestvica-glava">
                    <div class="lestvica-ikona"><i class="fa-solid ${i}"></i></div>
                    <div class="lestvica-naslov">${n}</div>
                    <div class="lestvica-stevec">${iG.length}</div>
                </div>
                <div class="lestvica-crta"></div>
                <div class="galerija-grid">`;
            iG.forEach((ig, inx) => {
                let medalja = ['#f1c40f', '#bdc3c7', '#cd7f32'][inx];
                let bC = medalja || window.getColorForOvr(parseInt(ig.ovr) || 0);
                h += `<div class="lestvica-mesto${inx < 3 ? ' stopnicke m' + (inx + 1) : ''}">`
                   + window.dobiHTMLMaleKartice(ig, true, inx + 1, bC) + `</div>`;
            });
            h += `</div></div>`;
            return h;
        }
        
        c.innerHTML += uB(lng.topOVR, 'fa-skull', (a,b)=>b.dynamicOvr - a.dynamicOvr, '#ff9f43'); 
        c.innerHTML += uB(lng.topHit, 'fa-bolt-lightning', (a,b)=>vF(a.hitrost, true) - vF(b.hitrost, true), '#f1c40f'); 
        c.innerHTML += uB(lng.topMoc, 'fa-mountain', (a,b)=>vF(b.moc, false) - vF(a.moc, false), '#ff7675'); 
        c.innerHTML += uB(lng.topVzd, 'fa-battery-full', (a,b)=>vF(b.vzdrzljivost, false) - vF(a.vzdrzljivost, false), '#a29bfe'); 
        c.innerHTML += uB(lng.topEks, 'fa-meteor', (a,b)=>vF(b.eksplozivnost, false) - vF(a.eksplozivnost, false), '#fdcb6e'); 
        c.innerHTML += uB(lng.topAgi, 'fa-staff-snake', (a,b)=>vF(a.agilnost, true) - vF(b.agilnost, true), '#00cec9');

        window.ratingMode = prejsnjiModeLestvica;

        window.zazeniLenoNalaganjeSlik(c);
        window.pripniTiltInFoil(c);
        window.prednaloziVseSlike(vA.map(x => x.id));

        setTimeout(() => { document.querySelectorAll('#panelLestvica .atlet-vrstica-container').forEach(el => { el.addEventListener('mouseenter', () => { let cI = el.getAttribute('data-canvas-id'); let rC = el.getAttribute('data-rank-color'); let sR = el.getAttribute('data-stats'); if(!sR) return; let s = sR.split(',').map(Number); let mC = document.getElementById(cI); if(mC && !mC.classList.contains('narisan')) { mC.classList.add('narisan'); window.miniCharts.push(new Chart(mC.getContext('2d'), { type: 'radar', data: { labels: ['SPD', 'PWR', 'END', 'EXP', 'AGI'], datasets: [{ data: s, backgroundColor: rC + '33', borderColor: rC, borderWidth: 1.5, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { display:false }, grid: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#888', font:{size:8} }, ticks: { display: false }, min: 0, max: 100 } }, plugins: { legend: { display: false } } } })); } }); }); }, 100);
    };

    window.osveziGalerijo = async function() {
        try { 
            // 1) JAVNI COMBINE - vsi (tudi neprijavljeni) berejo javno kolekcijo "atleti".
            const qS = await window.getDocs(window.collection(window.db, "atleti")); 
            let javni = [];
            qS.forEach((d) => { javni.push({ id: d.id, ...d.data(), _vir: 'javno' }); });

            window.aBazaVse = javni;
            window.aBaza = window.aBazaVse;

            // Zasebni podatki (e-pošta, sestava) - le admin (ekipa).
            if(window.isAdm) {
                try {
                    const zS = await window.getDocs(window.collection(window.db, "zasebno"));
                    let zMap = {};
                    zS.forEach(d => { zMap[d.id] = d.data(); });
                    window.aBaza.forEach(a => {
                        let z = zMap[a.id];
                        if(z) { a.emailSportnika = z.emailSportnika || ""; a.odstotekMascobe = z.odstotekMascobe || ""; a.misicnaMasa = z.misicnaMasa || ""; }
                    });
                } catch(e) { console.warn('Branje zasebnih podatkov ni uspelo:', e); }
            }

            window.invalidirajLimitCache();
            window.izracunajBadgeRekorde();
            if (document.getElementById('panelBaza').style.display === 'flex' || document.getElementById('panelBaza').style.display === 'block') window.izrisiGalerijo();
            if (document.getElementById('panelLestvica').style.display === 'flex' || document.getElementById('panelLestvica').style.display === 'block') window.izrisiLestvice();
        } catch (e) { console.error(e); }
    };

    // Klubski filter: preklop "vse / samo moj klub". Deluje na naloženih podatkih.
    window.klubskiFilter = false;

    // "Moj Klub" (za trenerja): odpre Bazo s prisilno vklopljenim klubskim filtrom.
    window.odpriMojKlub = function() {
        window.klubskiFilter = true;
        let b = document.getElementById('btnKlubFilter');
        if(b) b.classList.add('aktivno');
        let t = document.getElementById('btnKlubFilterTxt');
        if(t) t.innerText = window.tJezik === 'sl' ? 'Cel bazen' : 'Full pool';
        window.izracunajBadgeRekorde();
        window.preklopiPogled('baza');
    };
    window.preklopiKlubskiFilter = function() {
        window.klubskiFilter = !window.klubskiFilter;
        let b = document.getElementById('btnKlubFilter');
        if(b) b.classList.toggle('aktivno', window.klubskiFilter);
        let t = document.getElementById('btnKlubFilterTxt');
        if(t) {
            let sl = window.tJezik === 'sl';
            t.innerText = window.klubskiFilter ? (sl ? 'Cel bazen' : 'Full pool') : (sl ? 'Samo moj klub' : 'My club only');
        }
        // Osveži trenutni pogled
        window.izracunajBadgeRekorde();
        if(document.getElementById('panelBaza').style.display !== 'none') window.izrisiGalerijo();
        if(document.getElementById('panelLestvica').style.display !== 'none') window.izrisiLestvice();
        if(document.getElementById('panelNadzor').style.display !== 'none') window.izrisiNadzor();
    };

    window.toggleCompareMode = function() { if(window.dMode) window.toggleDeleteMode(); window.cMode = !window.cMode; let b = document.body; let bT = document.getElementById('btnToggleCompare'); let bR = document.getElementById('btnRunCompare'); let lng = window.prevodi[window.tJezik]; if(window.cMode) { b.classList.add('compare-mode'); bT.classList.add('active'); bT.innerText = lng.compToggleOff; window.cIzbrani = []; bR.style.display = 'inline-flex'; bR.innerText = `▶ ${lng.compSelectMore} 2 (0/2)`; bR.style.background = "#334155"; bR.style.color = "#a0aec0"; bR.style.boxShadow = "none"; bR.disabled = true; } else { b.classList.remove('compare-mode'); bT.classList.remove('active'); bT.innerText = lng.compToggleOn; window.cIzbrani = []; bR.style.display = 'none'; } window.izrisiGalerijo(); };

    window.izberiIgralcaZaCompare = function(id) { if(!window.cMode) return; let lng = window.prevodi[window.tJezik]; if(window.cIzbrani.includes(id)) { window.cIzbrani = window.cIzbrani.filter(i => i !== id); } else { if(window.cIzbrani.length >= 2) { alert(lng.compMax); return; } window.cIzbrani.push(id); } let bR = document.getElementById('btnRunCompare'); if(window.cIzbrani.length === 2) { bR.disabled = false; bR.style.background = "linear-gradient(45deg, #00f2fe, #4facfe)"; bR.style.color = "#000"; bR.style.boxShadow = "0 0 15px rgba(0,242,254,0.6)"; bR.innerText = `▶ ${lng.compRun} (2/2)`; } else { bR.disabled = true; bR.style.background = "#334155"; bR.style.color = "#a0aec0"; bR.style.boxShadow = "none"; bR.innerText = `▶ ${lng.compSelectMore} ${2 - window.cIzbrani.length} (${window.cIzbrani.length}/2)`; } window.izrisiGalerijo(); };

    window.odpriPrimerjavo = function() { if(window.cIzbrani.length !== 2) return; let p1 = window.aBaza.find(a => a.id === window.cIzbrani[0]); let p2 = window.aBaza.find(a => a.id === window.cIzbrani[1]); if(!p1 || !p2) return; let dP = (p) => window.oceneVVrsti(p); let s1 = dP(p1); let s2 = dP(p2); window.setH('compareCard1Container', window.dobiHTMLMaleKartice(p1, false, 0, "", true)); window.setH('compareCard2Container', window.dobiHTMLMaleKartice(p2, false, 0, "", true)); document.getElementById('compareOverlay').style.display = 'block'; document.getElementById('compareModal').style.display = 'block'; let cx = document.getElementById('compareRadarChart'); if(!cx) return; if (window.compareChart) window.compareChart.destroy(); window.compareChart = new Chart(cx.getContext('2d'), { type: 'radar', data: { labels: window.prevodi[window.tJezik].grafLabele, datasets: [ { label: p1.ime, data: s1, backgroundColor: 'rgba(79, 172, 254, 0.3)', borderColor: '#4facfe', borderWidth: 3, pointBackgroundColor: '#4facfe' }, { label: p2.ime, data: s2, backgroundColor: 'rgba(255, 118, 117, 0.3)', borderColor: '#ff7675', borderWidth: 3, pointBackgroundColor: '#ff7675' } ] }, options: window.chartOptions }); window.izrisiRazsodbo(p1, p2); };
    // ===== IZZOVI KOLEGA: razsodba po kategorijah =====
    // Primerjava ni le prikaz dveh kartic - aplikacija RAZSODI, kdo zmaga v vsaki
    // kategoriji in skupno. Primerjamo OCENE (ne surovih vrednosti), ker so ocene
    // usklajene glede na spol in generacijo - le tako je dvoboj pošten.
    window.izrisiRazsodbo = function(p1, p2) {
        let el = document.getElementById('izzivRazsodba');
        if(!el) return;
        let esc = window.escapeHtml;
        let lngI = window.prevodi[window.tJezik];
        let r1 = window.izracunajOcene(p1), r2 = window.izracunajOcene(p2);

        let vrstice = window.TESTI.map(t => {
            let o1 = r1.ocene[t.kljuc], o2 = r2.ocene[t.kljuc];
            let zmaga = o1 > o2 ? 1 : (o2 > o1 ? 2 : 0);  // 0 = izenačeno
            let raz = Math.abs(o1 - o2);
            // Surove vrednosti pokažemo kot dokaz (npr. 4.55 s proti 4.70 s).
            let sur = (v) => {
                let x = parseFloat(v); if(!x) return '—';
                return t.decimalke ? x.toFixed(t.decimalke) + ' ' + t.enota : Math.round(x) + ' ' + t.enota;
            };
            let ime = (window.prevodi[window.tJezik][t.labelKljuc] || t.kljuc).toUpperCase();
            return `
            <div class="izziv-vrstica">
                <div class="izziv-stran ${zmaga===1?'zmaga':''}">
                    <div class="izziv-ocena">${o1}</div>
                    <div class="izziv-surovo">${sur(p1[t.kljuc])}</div>
                </div>
                <div class="izziv-sredina">
                    <div class="izziv-kategorija"><i class="fa-solid ${t.ikona}" style="color:${t.barva}"></i> ${esc(ime)}</div>
                    <div class="izziv-razlika">${zmaga===0 ? lngI.izzIzenaceno : '+' + raz}</div>
                </div>
                <div class="izziv-stran ${zmaga===2?'zmaga':''}">
                    <div class="izziv-ocena">${o2}</div>
                    <div class="izziv-surovo">${sur(p2[t.kljuc])}</div>
                </div>
            </div>`;
        }).join('');

        // Skupni izid: kdo je zmagal v več kategorijah (ob izenačenju odloči OVR).
        let t1 = 0, t2 = 0;
        window.TESTI.forEach(t => {
            if(r1.ocene[t.kljuc] > r2.ocene[t.kljuc]) t1++;
            else if(r2.ocene[t.kljuc] > r1.ocene[t.kljuc]) t2++;
        });
        let zmagovalec = t1 > t2 ? p1 : (t2 > t1 ? p2 : (r1.ovr >= r2.ovr ? p1 : p2));
        let neodloceno = (t1 === t2 && r1.ovr === r2.ovr);
        let barvaZ = window.getColorForOvr(zmagovalec === p1 ? r1.ovr : r2.ovr);

        el.innerHTML = `
            <div class="izziv-ovoj">
                <div class="izziv-glava">
                    <div class="izziv-igralec" style="--iz-barva:#4facfe;">
                        <div class="izziv-ime">${esc(p1.ime || '—')}</div>
                        <div class="izziv-ovr">${r1.ovr}</div>
                    </div>
                    <div class="izziv-izid">
                        <div class="izziv-izid-stevilke">${t1} <span>:</span> ${t2}</div>
                        <div class="izziv-izid-oznaka">${lngI.izzKategorije}</div>
                    </div>
                    <div class="izziv-igralec" style="--iz-barva:#ff7675;">
                        <div class="izziv-ime">${esc(p2.ime || '—')}</div>
                        <div class="izziv-ovr">${r2.ovr}</div>
                    </div>
                </div>

                <div class="izziv-tabela">${vrstice}</div>

                <div class="izziv-zmagovalec" style="--zm-barva:${barvaZ};">
                    ${neodloceno
                        ? `<div class="izziv-zmagovalec-oznaka">${lngI.izzNeodloceno}</div>`
                        : `<div class="izziv-zmagovalec-oznaka">${lngI.izzZmagovalec}</div>
                           <div class="izziv-zmagovalec-ime">${esc(zmagovalec.ime || '—')}</div>`}
                </div>
            </div>`;
    };

    // ===== IZZIVI: pravi dvoboji pred dogodkom =====
    // Športnik izzove kolega v določeni kategoriji ali za cel OVR. Izziv se SHRANI v bazo
    // (kolekcija "izzivi") skupaj z izhodiščnima vrednostma. Po naslednji meritvi se
    // razsodi samodejno: primerjajo se TRENUTNE vrednosti obeh.
    // Identiteta teče prek anonimnega ključa e-naslova - isti mehanizem kot pri karticah,
    // zato v izzivih NI e-naslovov (zasebnost ostane nedotaknjena).

    window.mojAtletKljuc = function() {
        if(!window.tEmail) return null;
        return window.anonKljuc(window.tEmail.toLowerCase().trim());
    };

    // Trenutna (najnovejša) meritev športnika po ključu.
    window.zadnjaMeritev = function(kljuc) {
        let g = window.groupAthletesByEmail();
        let sez = g[kljuc];
        if(!sez || sez.length === 0) return null;
        return sez[0]; // groupAthletesByEmail vrača najnovejšo sezono prvo
    };

    // Vrednost, po kateri se meri izziv. Za 'ovr' vrne OVR, sicer surovo meritev.
    window.vrednostZaIzziv = function(atlet, kategorija) {
        if(!atlet) return null;
        if(kategorija === 'ovr') return window.izracunajOcene(atlet).ovr;
        let v = parseFloat(atlet[kategorija]);
        return (v && v > 0) ? v : null;
    };

    // Ali je pri tej kategoriji nižja vrednost boljša (časi) ali višja (sile, OVR)?
    window.nizjeBoljseZaIzziv = function(kategorija) {
        if(kategorija === 'ovr') return false;
        let t = window.TESTI.find(x => x.kljuc === kategorija);
        return t ? !!t.nizjeJeBolje : false;
    };

    window.ustvariIzziv = async function(doKljuc, kategorija) {
        let lng = window.prevodi[window.tJezik];
        let mojKljuc = window.mojAtletKljuc();
        if(!mojKljuc) { alert(lng.izzNapPrijava); return; }
        if(!doKljuc || doKljuc === mojKljuc) { alert(lng.izzNapDrugega); return; }

        let jaz = window.zadnjaMeritev(mojKljuc);
        let on  = window.zadnjaMeritev(doKljuc);
        if(!jaz) { alert(lng.izzNapJaz); return; }
        if(!on)  { alert(lng.izzNapOn); return; }

        try {
            await window.addDoc(window.collection(window.db, "izzivi"), {
                odKljuc: mojKljuc,
                odIme: jaz.ime || '',
                doKljuc: doKljuc,
                doIme: on.ime || '',
                kategorija: kategorija,
                odIzhodisce: window.vrednostZaIzziv(jaz, kategorija),
                doIzhodisce: window.vrednostZaIzziv(on, kategorija),
                ustvarjen: new Date().toISOString(),
                stanje: 'odprt'
            });
            await window.naloziIzzive();
            window.izrisiIzzive();
        } catch(e) {
            console.error('Izziv:', e);
            alert(lng.izzNapUstvari);
        }
    };

    window.izbrisiIzziv = async function(id) {
        let lng = window.prevodi[window.tJezik];
        if(!confirm(lng.izzPotrdiBrisanje)) return;
        try {
            await window.deleteDoc(window.doc(window.db, "izzivi", id));
            await window.naloziIzzive();
            window.izrisiIzzive();
        } catch(e) { console.error(e); alert(lng.izzNapBrisanje); }
    };

    window.izzivi = [];
    window.naloziIzzive = async function() {
        try {
            let s = await window.getDocs(window.collection(window.db, "izzivi"));
            window.izzivi = [];
            s.forEach(d => window.izzivi.push({ id: d.id, ...d.data() }));
        } catch(e) { console.warn('Izzivov ni bilo mogoče naložiti:', e); window.izzivi = []; }
    };

    // Razsodba enega izziva na podlagi TRENUTNIH meritev.
    window.razsodiIzziv = function(iz) {
        let a1 = window.zadnjaMeritev(iz.odKljuc);
        let a2 = window.zadnjaMeritev(iz.doKljuc);
        let v1 = window.vrednostZaIzziv(a1, iz.kategorija);
        let v2 = window.vrednostZaIzziv(a2, iz.kategorija);
        let nizje = window.nizjeBoljseZaIzziv(iz.kategorija);

        // Napredek glede na izhodišče (pozitiven = izboljšanje).
        let nap = (zdaj, izh) => {
            if(zdaj == null || izh == null) return null;
            return nizje ? (izh - zdaj) : (zdaj - izh);
        };
        let zmagovalec = null;
        if(v1 != null && v2 != null && v1 !== v2) zmagovalec = (nizje ? (v1 < v2) : (v1 > v2)) ? 'od' : 'do';

        return {
            v1, v2, zmagovalec,
            nap1: nap(v1, iz.odIzhodisce), nap2: nap(v2, iz.doIzhodisce),
            // Izziv je "razsojen", ko je vsaj eden po ustvarjanju dobil novo meritev.
            spremenjen: (v1 !== iz.odIzhodisce) || (v2 !== iz.doIzhodisce)
        };
    };

    // ==========================================
    // ZAPESTNICE S QR KODO
    // ==========================================
    // Zapestnica nosi SAMO kodo (npr. G99-0042) in nič drugega - če jo kdo najde,
    // iz nje ne dobi ničesar. Povezava koda -> športnik živi v kolekciji "zapestnice",
    // ki jo bere in piše izključno admin, ker vsebuje e-naslov.
    // Branje QR gre prek kamere in knjižnice jsQR; to za razliko od NFC deluje tudi
    // na iPhonu, kjer spletna stran do NFC nima dostopa.
    // Povezava velja 24 ur. Po tem je zapestnica spet prazna, tudi če je nihče ne pobriše -
    // tako se serija sama pripravi za naslednji dogodek in stara povezava ne more
    // pomotoma naložiti napačnega športnika.
    window.ZAPESTNICA_VELJA_MS = 24 * 60 * 60 * 1000;
    window.skenerTok = null;      // MediaStream, da ga lahko ob zapiranju ugasnemo
    window.skenerTece = false;
    window.skenerKoda = null;     // zadnja prebrana koda, ki še ni povezana

    // Sestavi vse kode na eno platno in jo prenese kot ENO sliko PNG. Tiskarne raje
    // dobijo eno datoteko kot trideset, list pa se da natisniti tudi doma.
    window.prenesiKodeSlika = async function(zacetek, n) {
        if(typeof qrcode !== 'function') return;
        let stolpcev = 5, celica = 240, qrVel = 180, podpis = 46, rob = 40;
        let vrstic = Math.ceil(n / stolpcev);
        let pl = document.createElement('canvas');
        pl.width = rob * 2 + stolpcev * celica;
        pl.height = rob * 2 + 60 + vrstic * (celica + podpis - 40);
        let x = pl.getContext('2d');
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, pl.width, pl.height);
        x.fillStyle = '#111111';
        x.font = 'bold 26px Arial'; x.textAlign = 'left';
        x.fillText('G99 ZAPESTNICE', rob, rob + 26);

        let naloge = [];
        for(let i = 0; i < n; i++) {
            let koda = 'G99-' + String(zacetek + i).padStart(4, '0');
            let q = qrcode(0, 'M'); q.addData(koda); q.make();
            let sl = new Image(); sl.src = q.createDataURL(8, 0);
            naloge.push(new Promise(res => {
                sl.onload = () => res({ sl, koda, i });
                sl.onerror = () => res(null);
            }));
        }
        let kosi = await Promise.all(naloge);
        x.imageSmoothingEnabled = false;   // QR mora ostati oster, sicer se slabše bere
        kosi.forEach(k => {
            if(!k) return;
            let st = k.i % stolpcev, vr = Math.floor(k.i / stolpcev);
            let cx = rob + st * celica, cy = rob + 60 + vr * (celica + podpis - 40);
            x.drawImage(k.sl, cx + (celica - qrVel) / 2, cy, qrVel, qrVel);
            x.fillStyle = '#111111'; x.font = 'bold 20px Arial'; x.textAlign = 'center';
            x.fillText(k.koda, cx + celica / 2, cy + qrVel + 28);
        });

        let a = document.createElement('a');
        a.href = pl.toDataURL('image/png');
        a.download = `G99_zapestnice_${zacetek}-${zacetek + n - 1}.png`;
        document.body.appendChild(a); a.click(); a.remove();
    };

    // Pripravi list kod za tisk. Odpre se novo okno z mrežo QR kod in besedilom pod
    // vsako - besedilo je nujno, ker se ob poškodovani kodi da vpisati ročno.
    window.natisniZapestnice = function() {
        let lng = window.prevodi[window.tJezik];
        let odgovor = prompt(lng.tiskKoliko, '30');
        if(!odgovor) return;
        let n = Math.max(1, Math.min(300, parseInt(odgovor) || 0));
        let zacetek = parseInt(prompt(lng.tiskOd, '1') || '1') || 1;
        if(typeof qrcode !== 'function') { alert(lng.skenerNiKnjiznice); return; }

        let polja = '';
        for(let i = 0; i < n; i++) {
            let koda = 'G99-' + String(zacetek + i).padStart(4, '0');
            let q = qrcode(0, 'M'); q.addData(koda); q.make();
            polja += `<div class="k"><img src="${q.createDataURL(6, 0)}"><div>${koda}</div></div>`;
        }
        let w = window.open('', '_blank');
        if(!w) { alert(lng.tiskBlokirano); return; }
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>G99 zapestnice</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 12mm; }
          h1 { font-size: 14pt; letter-spacing: 2px; margin: 0 0 4mm; }
          .orodja { display: flex; gap: 8px; margin-bottom: 8mm; }
          .orodja button { padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer;
                           font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
          .prim { background: #4facfe; color: #03060f; }
          .drug { background: #eee; color: #333; }
          .mreza { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6mm; }
          .k { text-align: center; border: 1px dashed #999; border-radius: 3mm; padding: 3mm; break-inside: avoid; }
          .k img { width: 100%; image-rendering: pixelated; }
          .k div { font-size: 8pt; font-weight: bold; letter-spacing: 1px; margin-top: 2mm; }
          @media print { h1, .orodja { display: none; } }
        </style></head><body>
        <h1>G99 ZAPESTNICE</h1>
        <div class="orodja">
          <button class="prim" onclick="window.opener.prenesiKodeSlika(${zacetek}, ${n})">${lng.tiskPrenesi}</button>
          <button class="drug" onclick="window.print()">${lng.tiskNatisni}</button>
        </div>
        <div class="mreza">${polja}</div></body></html>`);
        w.document.close();
    };

    window.odpriSkener = async function() {
        let lng = window.prevodi[window.tJezik];
        let oz = document.getElementById('skenerOzadje');
        window.setT('skenerNaslov', lng.skenerNaslov);
        window.setT('skenerPodnaslov', lng.skenerPodnaslov);
        window.setT('skenerZapriGumb', lng.skenerZapri);
        window.setT('skenerPoveziGumb', lng.skenerPovezi);
        window.setT('skenerDrugi', lng.skenerDrugi);
        window.setH('skenerStanje', lng.skenerIscem);
        document.getElementById('skenerPovezi').classList.remove('viden');
        window.skenerKoda = null;
        oz.classList.add('viden');

        if(typeof jsQR !== 'function') { window.setH('skenerStanje', lng.skenerNiKnjiznice); return; }
        try {
            // facingMode 'environment' izbere zadnjo kamero na tablici; na prenosniku
            // brskalnik samodejno pade na edino, ki jo ima.
            window.skenerTok = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } }, audio: false });
        } catch(e) {
            console.error('kamera:', e);
            window.setH('skenerStanje', lng.skenerNiKamere);
            return;
        }
        let v = document.getElementById('skenerVideo');
        v.srcObject = window.skenerTok;
        await v.play().catch(() => {});
        window.skenerTece = true;
        window.skenerZanka();
    };

    window.zapriSkener = function() {
        window.skenerTece = false;
        if(window._skenerCakanje) { clearTimeout(window._skenerCakanje); window._skenerCakanje = null; }
        let gd = document.getElementById('skenerDrugi'); if(gd) gd.style.display = 'none';
        if(window.skenerTok) { window.skenerTok.getTracks().forEach(t => t.stop()); window.skenerTok = null; }
        let v = document.getElementById('skenerVideo'); if(v) v.srcObject = null;
        document.getElementById('skenerOzadje').classList.remove('viden');
    };

    // Zanka branja. Slika se prerisuje na platno v pomanjšani ločljivosti - jsQR na
    // polni ločljivosti tablice porabi preveč časa in kamera zamrzne.
    window.skenerZanka = function() {
        if(!window.skenerTece) return;
        let v = document.getElementById('skenerVideo');
        if(v && v.readyState === v.HAVE_ENOUGH_DATA) {
            let s = 400;
            let pl = window._skenerPlatno || (window._skenerPlatno = document.createElement('canvas'));
            pl.width = s; pl.height = s;
            let ctx = pl.getContext('2d', { willReadFrequently: true });
            // Izrežemo sredinski kvadrat, da se ujema z okvirjem na zaslonu.
            let m = Math.min(v.videoWidth, v.videoHeight);
            ctx.drawImage(v, (v.videoWidth - m) / 2, (v.videoHeight - m) / 2, m, m, 0, 0, s, s);
            try {
                let d = ctx.getImageData(0, 0, s, s);
                let r = jsQR(d.data, s, s, { inversionAttempts: 'dontInvert' });
                if(r && r.data) { window.skenerNasel(r.data.trim()); return; }
            } catch(e) {}
        }
        requestAnimationFrame(window.skenerZanka);
    };

    window.skenerNasel = async function(koda) {
        let lng = window.prevodi[window.tJezik];
        window.skenerTece = false;                 // ustavimo branje, da ne sproži večkrat
        window.vibriraj(25);
        koda = koda.toUpperCase();
        window.setH('skenerStanje', `<b>${window.escapeHtml(koda)}</b>`);
        try {
            let s = await window.getDoc(window.doc(window.db, "zapestnice", koda));
            let z = s.exists() ? s.data() : null;
            let potekla = z && (Date.now() - (z.cas || 0)) > window.ZAPESTNICA_VELJA_MS;
            if(potekla) {
                // Potekle povezave sproti pobrišemo, da baza ne raste čez dogodke.
                try { await window.deleteDoc(window.doc(window.db, "zapestnice", koda)); } catch(e) {}
                z = null;
            }
            if(z && z.email) {
                window.zapestnicaPotrdi(koda, z);
            } else {
                // Neznana koda: ponudimo povezavo. Zapestnica je do takrat prazna.
                window.skenerKoda = koda;
                window.setH('skenerStanje', `<b>${window.escapeHtml(koda)}</b><br>` +
                    (potekla ? lng.skenerPotekla : lng.skenerNiPovezana));
                document.getElementById('skenerPovezi').classList.add('viden');
                document.getElementById('skenerEmail').focus();
            }
        } catch(e) {
            console.error(e);
            window.setH('skenerStanje', lng.skenerNapaka);
            setTimeout(() => { window.skenerTece = true; window.skenerZanka(); }, 1500);
        }
    };

    // Znana koda: naloži se sama po kratkem premoru. Premor obstaja zato, da je mogoče
    // zapestnico prevezati na drugega športnika - med dogodkom se to zgodi.
    window.zapestnicaPotrdi = function(koda, z) {
        let lng = window.prevodi[window.tJezik];
        window.skenerKoda = koda;
        window.setH('skenerStanje',
            `<b>${window.escapeHtml(koda)}</b><br>${window.escapeHtml(z.ime || '')}` +
            `<br><span style="font-size:10px; color:#5a6a85">${lng.skenerNalagam}</span>`);
        let g = document.getElementById('skenerDrugi');
        g.style.display = 'block';
        window._skenerCakanje = setTimeout(() => {
            g.style.display = 'none';
            window.zapestnicaUporabi(koda, z);
        }, 1400);
    };

    // Prekine samodejno nalaganje in ponudi vpis drugega športnika.
    window.zapestnicaPrevezi = function() {
        let lng = window.prevodi[window.tJezik];
        if(window._skenerCakanje) { clearTimeout(window._skenerCakanje); window._skenerCakanje = null; }
        document.getElementById('skenerDrugi').style.display = 'none';
        window.setH('skenerStanje', `<b>${window.escapeHtml(window.skenerKoda || '')}</b><br>${lng.skenerVpisiNovega}`);
        document.getElementById('skenerPovezi').classList.add('viden');
        document.getElementById('skenerEmail').value = '';
        document.getElementById('skenerIme').value = '';
        document.getElementById('skenerEmail').focus();
    };

    window.zapestnicaPovezi = async function() {
        let lng = window.prevodi[window.tJezik];
        let email = (document.getElementById('skenerEmail').value || '').toLowerCase().trim();
        let ime = (document.getElementById('skenerIme').value || '').trim();
        if(!email || !ime || !window.skenerKoda) { alert(lng.skenerManjka); return; }
        try {
            await window.setDoc(window.doc(window.db, "zapestnice", window.skenerKoda),
                                { email: email, ime: ime, cas: Date.now() });
            window.zapestnicaUporabi(window.skenerKoda, { email: email, ime: ime });
        } catch(e) { console.error(e); alert(lng.skenerNapaka); }
    };

    // Napolni obrazec za vnos. NAMENOMA ne odpre urejanja obstoječe kartice - vnaša se
    // nova meritev, zato se prepišejo samo podatki o osebi, meritve pa ostanejo prazne.
    window.zapestnicaUporabi = function(koda, z) {
        let lng = window.prevodi[window.tJezik];
        // Popolno počiščenje PRED izpolnjevanjem - glej razlago pri window.pripraviNovVnos.
        // Brez tega bi morebiten ID prejšnjega urejanja tiho prepisal tujo kartico.
        window.pripraviNovVnos();
        let nast = (id, v) => { let e = document.getElementById(id); if(e && v !== undefined && v !== null && v !== '') e.value = v; };
        nast('emailSportnika', z.email);
        nast('ime', z.ime);

        // Skener že tu ve, kdo je prišel na vrsto - precej prej, kot je meritev vnesena.
        // Objavimo TAKOJ, da TV pokaže zaslon "Na štartu: <ime>".
        window.objaviNaStartu(z.ime, z.email);

        // Če športnik v bazi že ima kartico, prevzamemo še telesne podatke iz zadnje.
        let kljuc = window.anonKljuc(z.email);
        let g = window.groupAthletesByEmail();
        let zadnja = (g[kljuc] && g[kljuc].length) ? g[kljuc][0] : null;
        if(zadnja) {
            nast('letorojstva', zadnja.letorojstva);
            nast('spol', zadnja.spol);
            nast('generacija', zadnja.generacija);
            nast('visina', zadnja.visina);
            nast('teza', zadnja.teza);
        }
        if(window.izracunajVse) window.izracunajVse();
        window.zapriSkener();
        window.preklopiPogled('vnos');
        let obv = document.getElementById('obvestiloShranjeno');
        if(obv) {
            obv.innerText = lng.skenerNalozen + ' ' + z.ime + ' (' + koda + ')';
            obv.style.display = 'block';
            setTimeout(() => { obv.style.display = 'none'; }, 4000);
        }
    };

    // ==========================================
    // ZASEBNE SOBE (mikro-lestvice)
    // ==========================================
    // Soba hrani SAMO anonimne ključe, nikoli e-naslovov. Lestvica in rekordi se
    // računajo sproti iz "atleti", zato jih ni mogoče ponarediti.
    //
    // ZAKAJ KOLEKCIJA "clanstvo": pravila Firestore ne morejo izračunati anonimnega
    // ključa iz e-naslova - e-naslova sploh ne vidijo. Brez tega ne bi mogla ločiti
    // "odstranjujem sebe" od "odstranjujem tebe", zato odhod iz sobe ne bi bil varen.
    // Zato vsak uporabnik ob prvem obisku zapiše clanstvo/{uid} = { kljuc }, ta zapis
    // pa lahko bere in piše SAMO on. Pravila ga nato preberejo z get() in preverijo,
    // da se s seznama briše natanko njegov ključ.
    window.SOBA_MAX = 20;          // največ članov na sobo
    window.mojeSobe = [];
    window.izbranaSoba = null;

    window.sobaKoda = function() {
        let z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // brez I, O, 0, 1 - da se ne bere narobe
        let k = '';
        for(let i = 0; i < 4; i++) k += z[Math.floor(Math.random() * z.length)];
        return 'G99-' + k;
    };

    // Zapiše povezavo uid -> anonimni ključ. Brez e-naslova.
    window.zagotoviClanstvo = async function() {
        let u = window.auth && window.auth.currentUser;
        let k = window.mojAtletKljuc();
        if(!u || !k) return null;
        try {
            await window.setDoc(window.doc(window.db, "clanstvo", u.uid), { kljuc: k }, { merge: true });
        } catch(e) { console.warn('clanstvo:', e); }
        return k;
    };

    window.naloziSobe = async function() {
        window.mojeSobe = [];
        let k = window.mojAtletKljuc();
        if(!k) return;
        try {
            await window.zagotoviClanstvo();
            const qs = await window.getDocs(window.query(window.collection(window.db, "sobe"),
                                            window.where("clani", "array-contains", k)));
            qs.forEach(d => window.mojeSobe.push({ id: d.id, ...d.data() }));
            window.mojeSobe.sort((a, b) => (a.ime || '').localeCompare(b.ime || ''));
            if(!window.izbranaSoba || !window.mojeSobe.some(s => s.id === window.izbranaSoba)) {
                window.izbranaSoba = window.mojeSobe.length ? window.mojeSobe[0].id : null;
            }
        } catch(e) { console.error('naloziSobe:', e); }
    };

    window.ustvariSobo = async function() {
        let lng = window.prevodi[window.tJezik];
        let k = window.mojAtletKljuc();
        if(!k) { alert(lng.sobaNapPrijava); return; }
        let ime = (document.getElementById('sobaNovoIme') || {}).value || '';
        ime = ime.trim();
        if(ime.length < 2) { alert(lng.sobaNapIme); return; }
        try {
            await window.zagotoviClanstvo();
            await window.addDoc(window.collection(window.db, "sobe"), {
                koda: window.sobaKoda(), ime: ime, lastnik: k, clani: [k], ustvarjena: Date.now()
            });
            await window.naloziSobe(); window.izrisiSobe();
        } catch(e) { console.error(e); alert(lng.sobaNapUstvari); }
    };

    window.pridruziSobi = async function() {
        let lng = window.prevodi[window.tJezik];
        let k = window.mojAtletKljuc();
        if(!k) { alert(lng.sobaNapPrijava); return; }
        let koda = ((document.getElementById('sobaKoda') || {}).value || '').trim().toUpperCase();
        if(!koda) return;
        if(!koda.startsWith('G99-')) koda = 'G99-' + koda;
        try {
            await window.zagotoviClanstvo();
            const qs = await window.getDocs(window.query(window.collection(window.db, "sobe"),
                                            window.where("koda", "==", koda)));
            if(qs.empty) { alert(lng.sobaNapNiKode); return; }
            let d = qs.docs[0], s = d.data();
            if((s.clani || []).includes(k)) { window.izbranaSoba = d.id; window.izrisiSobe(); return; }
            if((s.clani || []).length >= window.SOBA_MAX) { alert(lng.sobaNapPolna); return; }
            await window.setDoc(window.doc(window.db, "sobe", d.id),
                                { clani: [...(s.clani || []), k] }, { merge: true });
            await window.naloziSobe(); window.izbranaSoba = d.id; window.izrisiSobe();
        } catch(e) { console.error(e); alert(lng.sobaNapPridruzi); }
    };

    // Lastnik lahko sobo izbriše SAMO, kadar je v njej sam. Tako ne more nikomur uničiti
    // lestvice, svojo prazno ali pomotoma ustvarjeno sobo pa lahko pospravi.
    window.izbrisiSobo = async function(id) {
        let lng = window.prevodi[window.tJezik];
        let k = window.mojAtletKljuc(); if(!k) return;
        let s = window.mojeSobe.find(x => x.id === id); if(!s) return;
        if(s.lastnik !== k || (s.clani || []).length > 1) { alert(lng.sobaNapBrisi); return; }
        if(!confirm(lng.sobaPotrdiBrisanje)) return;
        try {
            await window.deleteDoc(window.doc(window.db, "sobe", id));
            window.izbranaSoba = null;
            await window.naloziSobe(); window.izrisiSobe();
        } catch(e) { console.error(e); alert(lng.sobaNapBrisanje); }
    };

    window.zapustiSobo = async function(id) {
        let lng = window.prevodi[window.tJezik];
        let k = window.mojAtletKljuc(); if(!k) return;
        if(!confirm(lng.sobaPotrdiOdhod)) return;
        let s = window.mojeSobe.find(x => x.id === id); if(!s) return;
        try {
            await window.setDoc(window.doc(window.db, "sobe", id),
                                { clani: (s.clani || []).filter(x => x !== k) }, { merge: true });
            window.izbranaSoba = null;
            await window.naloziSobe(); window.izrisiSobe();
        } catch(e) { console.error(e); alert(lng.sobaNapOdhod); }
    };

    // Člani sobe. Vrne VSE ključe, tudi tiste brez meritve - prej so takšni tiho izpadli
    // in števec je kazal 2/20, na lestvici pa je bil en sam človek. Član brez meritve
    // dobi svojo vrstico z opombo; tako je jasno, da je notri, le izmerjen še ni.
    window.sobaClani = function(s) {
        let g = window.groupAthletesByEmail();
        let zMeritvijo = [], brezMeritve = [];
        (s.clani || []).forEach(k => {
            let sez = g[k];
            let zadnja = (sez && sez.length) ? sez[0] : null;   // groupAthletes že uredi po sezoni
            if(zadnja && (parseInt(zadnja.ovr) || 0) > 0) zMeritvijo.push({ kljuc: k, a: zadnja });
            else brezMeritve.push({ kljuc: k, a: null });
        });
        zMeritvijo.sort((x, y) => (parseInt(y.a.ovr) || 0) - (parseInt(x.a.ovr) || 0));
        return zMeritvijo.concat(brezMeritve);
    };

    window.izrisiSobe = function() {
        let el = document.getElementById('sobeVsebina'); if(!el) return;
        let lng = window.prevodi[window.tJezik];
        let esc = window.escapeHtml;
        let k = window.mojAtletKljuc();

        let obrazec = `<div class="sobe-orodja">
            <div class="sobe-polje">
                <input id="sobaNovoIme" placeholder="${lng.sobaImeNamig}" maxlength="28">
                <button class="btn-soba" onclick="window.ustvariSobo()">${lng.sobaUstvari}</button>
            </div>
            <div class="sobe-polje">
                <input id="sobaKoda" placeholder="G99-XXXX" maxlength="12">
                <button class="btn-soba btn-soba-drugotni" onclick="window.pridruziSobi()">${lng.sobaPridruzi}</button>
            </div>
        </div>`;

        if(!k) {
            el.innerHTML = `<div class="sobe-naslov">${lng.sobeNaslov}</div>
                            <div class="sobe-podnaslov">${lng.sobePodnaslov}</div>
                            <div class="izzivi-opozorilo">${lng.sobaNapPrijava}</div>`;
            return;
        }

        if(window.mojeSobe.length === 0) {
            el.innerHTML = `<div class="sobe-naslov">${lng.sobeNaslov}</div>
                            <div class="sobe-podnaslov">${lng.sobePodnaslov}</div>` + obrazec +
                           `<div class="izzivi-prazno">${lng.sobePrazno}</div>`;
            return;
        }

        let zavihki = window.mojeSobe.map(s =>
            `<button class="soba-zavihek${s.id === window.izbranaSoba ? ' aktiven' : ''}"
                     onclick="window.izbranaSoba='${s.id}'; window.izrisiSobe();">${esc(s.ime || '')}
             <span>${(s.clani || []).length}</span></button>`).join('');

        let s = window.mojeSobe.find(x => x.id === window.izbranaSoba) || window.mojeSobe[0];
        let clani = window.sobaClani(s);

        let mesto = 0;
        let vrstice = clani.map(cl => {
            let jaz = cl.kljuc === k;
            if(!cl.a) {
                // Član brez meritve: brez mesta, brez OVR - a viden, da se števec ujema.
                return `<div class="soba-vrstica brez${jaz ? ' jaz' : ''}">
                    <div class="soba-mesto">—</div>
                    <div class="soba-ime">${jaz ? esc(lng.sobaJaz) : esc(lng.sobaNeznan)}${jaz ? ` <b>(${lng.izzTi})</b>` : ''}</div>
                    <div class="soba-gen">${esc(lng.sobaCakaMeritev)}</div>
                    <div class="soba-ovr" style="color:#5a6a85">—</div>
                </div>`;
            }
            let a = cl.a; mesto++;
            let ovr = parseInt(a.ovr) || 0;
            let col = window.getColorForOvr(ovr);
            return `<div class="soba-vrstica${jaz ? ' jaz' : ''}" onclick="window.poglejKartico('${a.id}')">
                <div class="soba-mesto">${mesto}</div>
                <div class="soba-ime">${esc(a.ime || '')}${jaz ? ` <b>(${lng.izzTi})</b>` : ''}</div>
                <div class="soba-gen">${esc(a.generacija || '')}</div>
                <div class="soba-ovr" style="color:${col}">${ovr}</div>
            </div>`;
        }).join('');

        // REKORDI SOBE - ista logika kot Hall of Fame, samo znotraj sobe.
        let rekordi = window.TESTI.map(t => {
            let najA = null, najV = t.nizjeJeBolje ? Infinity : 0;
            clani.forEach(cl => {
                let a = cl.a; if(!a) return;
                let v = parseFloat(a[t.kljuc]); if(!v || v <= 0) return;
                if(t.nizjeJeBolje ? v < najV : v > najV) { najV = v; najA = a; }
            });
            if(!najA) return '';
            let barva = window.getColorForOvr(window.izracunajOcene(najA).ocene[t.kljuc] || 0);
            return `<div class="soba-rek">
                <div class="soba-rek-ime"><i class="fa-solid ${t.ikona}" style="color:${barva}"></i>${lng[t.labelKljuc] || t.kljuc}</div>
                <div class="soba-rek-val">${najV.toFixed(t.decimalke)}<span>${t.enota}</span></div>
                <div class="soba-rek-kdo">${esc(najA.ime || '')}</div>
            </div>`;
        }).join('');

        el.innerHTML = `<div class="sobe-naslov">${lng.sobeNaslov}</div>
            <div class="sobe-podnaslov">${lng.sobePodnaslov}</div>
            ${obrazec}
            <div class="soba-zavihki">${zavihki}</div>
            <div class="soba-glava">
                <div>
                    <div class="soba-naslov-ime">${esc(s.ime || '')}</div>
                    <div class="soba-koda">${esc(s.koda || '')} · ${(s.clani || []).length}/${window.SOBA_MAX} ${lng.sobaClanov}</div>
                </div>
                <div class="soba-glava-gumbi">
                    <button class="btn-soba btn-soba-drugotni" onclick="window.kopirajKodo('${esc(s.koda || '')}')">${lng.sobaKopiraj}</button>
                    ${(s.lastnik === k && (s.clani || []).length <= 1)
                        ? `<button class="btn-soba btn-soba-odhod" onclick="window.izbrisiSobo('${s.id}')">${lng.sobaBrisi}</button>`
                        : `<button class="btn-soba btn-soba-odhod" onclick="window.zapustiSobo('${s.id}')">${lng.sobaOdidi}</button>`}
                </div>
            </div>
            ${clani.length ? `<div class="soba-lestvica">${vrstice}</div>` : `<div class="izzivi-prazno">${lng.sobaBrezMeritev}</div>`}
            ${rekordi ? `<div class="soba-rek-naslov">${lng.sobaRekordi}</div><div class="soba-rek-pas">${rekordi}</div>` : ''}`;
    };

    window.kopirajKodo = function(koda) {
        let lng = window.prevodi[window.tJezik];
        try { navigator.clipboard.writeText(koda); alert(lng.sobaKopirano + ' ' + koda); }
        catch(e) { prompt(lng.sobaKopiraj, koda); }
    };

    window.izrisiIzzive = function() {
        let el = document.getElementById('izziviVsebina');
        if(!el) return;
        let esc = window.escapeHtml;
        let lngZ = window.prevodi[window.tJezik];
        let mojKljuc = window.mojAtletKljuc();

        // Brez prijave ali brez lastne meritve izzivov ni mogoče ustvarjati.
        let jaz = mojKljuc ? window.zadnjaMeritev(mojKljuc) : null;

        // Seznam možnih nasprotnikov (vsi razen mene, po eden na športnika).
        let g = window.groupAthletesByEmail();
        let nasprotniki = Object.keys(g)
            .filter(k => k !== mojKljuc)
            .map(k => ({ kljuc: k, atlet: g[k][0] }))
            .filter(x => x.atlet && x.atlet.ime)
            .sort((a, b) => (a.atlet.ime || '').localeCompare(b.atlet.ime || ''));

        let moznosti = nasprotniki.map(n =>
            `<option value="${esc(n.kljuc)}">${esc(n.atlet.ime)}</option>`).join('');

        // Kategorije: cel OVR ali posamezen test.
        let katOpcije = `<option value="ovr">${lngZ.izzSkupniOvr}</option>` + window.TESTI.map(t =>
            `<option value="${t.kljuc}">${esc((window.prevodi[window.tJezik][t.labelKljuc] || t.kljuc))}</option>`).join('');

        let ustvarjanje = !jaz
            ? `<div class="izzivi-opozorilo">${lngZ.izzOpozorilo}</div>`
            : `<div class="izzivi-ustvari">
                   <div class="izzivi-ustvari-naslov">${lngZ.izzUstvariNaslov}</div>
                   <div class="izzivi-ustvari-vrstica">
                       <select id="izzivNasprotnik" class="izzivi-select">${moznosti || `<option value="">${lngZ.izzNiDrugih}</option>`}</select>
                       <select id="izzivKategorija" class="izzivi-select">${katOpcije}</select>
                       <button class="izzivi-gumb" onclick="window.ustvariIzziv(document.getElementById('izzivNasprotnik').value, document.getElementById('izzivKategorija').value)">${lngZ.izzPoslji}</button>
                   </div>
                   <div class="izzivi-namig">${lngZ.izzNamig}</div>
               </div>`;

        // Moji izzivi (poslani ali prejeti).
        let moji = (window.izzivi || []).filter(i => i.odKljuc === mojKljuc || i.doKljuc === mojKljuc);
        moji.sort((a, b) => (b.ustvarjen || '').localeCompare(a.ustvarjen || ''));

        let kartice = moji.map(iz => {
            let r = window.razsodiIzziv(iz);
            let jazSemOd = iz.odKljuc === mojKljuc;
            let katIme = iz.kategorija === 'ovr' ? lngZ.izzSkupniOvr
                : (window.prevodi[window.tJezik][(window.TESTI.find(t => t.kljuc === iz.kategorija) || {}).labelKljuc] || iz.kategorija);
            let enota = iz.kategorija === 'ovr' ? '' :
                ((window.TESTI.find(t => t.kljuc === iz.kategorija) || {}).enota || '');
            let dec = iz.kategorija === 'ovr' ? 0 :
                ((window.TESTI.find(t => t.kljuc === iz.kategorija) || {}).decimalke || 0);
            let fmt = v => v == null ? '—' : (dec ? parseFloat(v).toFixed(dec) : Math.round(v)) + (enota ? ' ' + enota : '');

            let stanje = !r.spremenjen ? lngZ.izzCaka
                : (r.zmagovalec === null ? lngZ.izzIzenaceno
                   : (r.zmagovalec === 'od' ? esc(iz.odIme) + ' ' + lngZ.izzVodi : esc(iz.doIme) + ' ' + lngZ.izzVodi));

            let zmagaOd = r.zmagovalec === 'od', zmagaDo = r.zmagovalec === 'do';
            let napis = n => n == null ? '' : (n > 0 ? `<span class="izz-napredek boljse">+${dec ? n.toFixed(dec) : Math.round(n)}</span>`
                                                    : (n < 0 ? `<span class="izz-napredek slabse">${dec ? n.toFixed(dec) : Math.round(n)}</span>` : ''));

            return `
            <div class="izz-kartica ${r.spremenjen ? 'razsojen' : ''}">
                <div class="izz-glava">
                    <span class="izz-kategorija">${esc(katIme)}</span>
                    ${jazSemOd ? `<button class="izz-brisi" onclick="window.izbrisiIzziv('${iz.id}')" title="${lngZ.izzBrisiNamig}">✕</button>` : ''}
                </div>
                <div class="izz-telo">
                    <div class="izz-stran ${zmagaOd ? 'vodi' : ''}">
                        <div class="izz-ime">${esc(iz.odIme || '—')}${jazSemOd ? ` <b>(${lngZ.izzTi})</b>` : ''}</div>
                        <div class="izz-vrednost">${fmt(r.v1)}</div>
                        <div class="izz-izhodisce">${lngZ.izzIzhodisce} ${fmt(iz.odIzhodisce)} ${napis(r.nap1)}</div>
                    </div>
                    <div class="izz-proti">VS</div>
                    <div class="izz-stran ${zmagaDo ? 'vodi' : ''}">
                        <div class="izz-ime">${esc(iz.doIme || '—')}${!jazSemOd ? ` <b>(${lngZ.izzTi})</b>` : ''}</div>
                        <div class="izz-vrednost">${fmt(r.v2)}</div>
                        <div class="izz-izhodisce">${lngZ.izzIzhodisce} ${fmt(iz.doIzhodisce)} ${napis(r.nap2)}</div>
                    </div>
                </div>
                <div class="izz-stanje">${stanje}</div>
            </div>`;
        }).join('');

        el.innerHTML = `
            <div class="izzivi-ovoj">
                <div class="izzivi-naslov">${lngZ.izzNaslov}</div>
                <div class="izzivi-podnaslov">${lngZ.izzPodnaslov}</div>
                ${ustvarjanje}
                <div class="izzivi-seznam">
                    ${kartice || `<div class="izzivi-prazno">${lngZ.izzPrazno}</div>`}
                </div>
            </div>`;
    };

    window.zapriPrimerjavo = function() { let rz = document.getElementById('izzivRazsodba'); if(rz) rz.innerHTML = ''; document.getElementById('compareOverlay').style.display = 'none'; document.getElementById('compareModal').style.display = 'none'; };

    // ==========================================
    // MNOŽIČNO BRISANJE (samo admin)
    // ==========================================
    window.toggleDeleteMode = function() {
        if(!window.jeTrener) return;
        if(window.cMode) window.toggleCompareMode(); // primerjava in brisanje se izključujeta
        window.dMode = !window.dMode;
        let b = document.body; let bT = document.getElementById('btnToggleDelete'); let bR = document.getElementById('btnRunDelete'); let lng = window.prevodi[window.tJezik];
        if(window.dMode) {
            b.classList.add('delete-mode'); bT.classList.add('active'); bT.innerText = lng.delToggleOff;
            window.dIzbrani = []; bR.style.display = 'inline-flex'; bR.innerText = `🗑️ ${lng.delRun} (0)`; bR.disabled = true; bR.style.opacity = '0.5';
        } else {
            b.classList.remove('delete-mode'); bT.classList.remove('active'); bT.innerText = lng.delToggleOn;
            window.dIzbrani = []; bR.style.display = 'none';
        }
        window.izrisiGalerijo();
    };

    window.izberiZaBrisanje = function(id) {
        if(!window.dMode || !window.jeTrener) return;
        let lng = window.prevodi[window.tJezik];
        if(window.dIzbrani.includes(id)) { window.dIzbrani = window.dIzbrani.filter(i => i !== id); }
        else { window.dIzbrani.push(id); }
        let bR = document.getElementById('btnRunDelete');
        bR.innerText = `🗑️ ${lng.delRun} (${window.dIzbrani.length})`;
        bR.disabled = window.dIzbrani.length === 0; bR.style.opacity = window.dIzbrani.length === 0 ? '0.5' : '1';
        window.izrisiGalerijo();
    };

    window.izbrisiIzbrane = async function() {
        if(!window.jeTrener || window.dIzbrani.length === 0) return;
        let lng = window.prevodi[window.tJezik];
        if(!confirm(lng.delPotrdi.replace('{n}', window.dIzbrani.length))) return;
        let bR = document.getElementById('btnRunDelete'); bR.disabled = true; bR.innerText = '⏳...';
        for(let id of window.dIzbrani) {
            try {
                let a = window.aBaza.find(x => x.id === id);
                let kol = (a && a._vir === 'klub') ? "klubatleti" : "atleti";
                await window.deleteDoc(window.doc(window.db, kol, id));
                try { await window.deleteDoc(window.doc(window.db, "zasebno", id)); } catch(e2) {}
                await window.brisiSlikoIzBaze(id);
            } catch(e) { console.error(e); }
        }
        window.dIzbrani = [];
        window.toggleDeleteMode(); // izklopi način brisanja
        await window.osveziGalerijo();
    };


    // ==========================================
    // LOGIKA ZA UVOZ CSV (EXCEL) - VARNA VERZIJA
    // ==========================================
    // CSV uvoz bere stolpce PO IMENU GLAVE, ne po poziciji.
    // Prej je bral cols[8], cols[9]... kar pomeni, da bi vsak nov stolpec (npr. telesna
    // sestava) premaknil vse naslednje in tiho pokvaril uvoz starih predlog. Zdaj je
    // vrstni red stolpcev poljuben, manjkajoči stolpci pa preprosto ostanejo prazni.
    window.CSV_ALIASI = {
        ime: ['ime', 'name', 'imeatleta', 'athlete', 'athletename'],
        letorojstva: ['letorojstva', 'letorojstvo', 'birthyear', 'yob', 'leto'],
        visina: ['visina', 'height', 'visinacm'],
        teza: ['teza', 'weight', 'tezakg'],
        emailSportnika: ['email', 'emailsportnika', 'mail', 'eposta'],
        spol: ['spol', 'gender', 'sex'],
        generacija: ['generacija', 'generation', 'gen', 'kategorija'],
        sezona: ['sezona', 'season'],
        hitrost: ['hitrost', 'speed', 'sprint', 'hitrosts', 'speeds'],
        moc: ['moc', 'moč', 'power', 'strength', 'mocn', 'powern'],
        eksplozivnost: ['eksplozivnost', 'explosiveness', 'explosive', 'power2', 'eksplozivnostn', 'explosivenessn'],
        agilnost: ['agilnost', 'agility', 'agilnosts', 'agilitys'],
        vzdrzljivost: ['vzdrzljivost', 'vzdržljivost', 'endurance', 'beep', 'beeptest', 'vzdrzljivostbeep', 'endurancebeep'],
        odstotekMascobe: ['odstotekmascobe', 'mascoba', 'maščoba', 'bodyfat', 'bf', 'fat', 'mascobapercent'],
        misicnaMasa: ['misicnamasa', 'mišičnamasa', 'musclemass', 'muscle', 'mm']
    };

    window.normalizirajGlavo = function(s) {
        return (s || '').toString().trim().toLowerCase()
            .replace(/^\ufeff/, '')
            .replace(/[\s_\-().%\/]/g, '')
            .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z');
    };

    window.razdeliCSVVrstico = function(vrstica) {
        // Zazna ločilo (podpičje / vejica / tabulator) glede na to, katerega je največ.
        let kandidati = [';', '\t', ','];
        let najboljse = ';'; let najvec = -1;
        kandidati.forEach(k => { let n = vrstica.split(k).length; if(n > najvec) { najvec = n; najboljse = k; } });
        return vrstica.split(najboljse).map(x => x.trim().replace(/^"|"$/g, ''));
    };

    window.uvoziCSV = function(e) {
        if(!window.jeTrener) return;
        let file = e.target.files[0];
        if(!file) return;
        let reader = new FileReader();
        reader.onload = async function(ev) {
            let text = ev.target.result;
            let rows = text.split(/\r?\n/).filter(r => r.trim());
            if(rows.length < 2) { alert(window.prevodi[window.tJezik].csvPrazen); return; }

            let btn = document.getElementById('btnUvozi');
            btn.innerText = window.prevodi[window.tJezik].csvUvazam; btn.disabled = true;

            // 1) Preberi glavo in zgradi zemljevid: ime polja -> indeks stolpca
            let glava = window.razdeliCSVVrstico(rows[0]).map(window.normalizirajGlavo);
            let mapa = {};
            for(let polje in window.CSV_ALIASI) {
                let idx = glava.findIndex(h => window.CSV_ALIASI[polje].includes(h));
                if(idx !== -1) mapa[polje] = idx;
            }

            if(mapa.ime === undefined || mapa.emailSportnika === undefined) {
                alert("V CSV glavi manjka obvezen stolpec 'Ime' in/ali 'Email'.\n\nPrepoznana glava: " + glava.join(', '));
                btn.innerText = "📥 Uvozi (CSV)"; btn.disabled = false;
                return;
            }

            let neprepoznani = glava.filter(h => h && !Object.values(window.CSV_ALIASI).some(al => al.includes(h)));

            let vzemi = (cols, polje) => (mapa[polje] !== undefined ? (cols[mapa[polje]] || '').trim() : '');
            let vzemiSt = (cols, polje) => parseFloat(vzemi(cols, polje).replace(',', '.')) || 0;

            let successCount = 0; let napake = 0;

            for(let i = 1; i < rows.length; i++) {
                let cols = window.razdeliCSVVrstico(rows[i]);
                let ime = vzemi(cols, 'ime');
                let email = vzemi(cols, 'emailSportnika').toLowerCase();
                if(!ime || !email) continue;

                let spol = (vzemi(cols, 'spol') || 'M').toUpperCase();
                let gen = (vzemi(cols, 'generacija') || 'U17').toUpperCase();
                let sez = vzemi(cols, 'sezona') || 'Sezona 1';
                let teza = vzemi(cols, 'teza') || '70';
                let hit = vzemiSt(cols, 'hitrost'); let moc = vzemiSt(cols, 'moc');
                let eks = vzemiSt(cols, 'eksplozivnost'); let agi = vzemiSt(cols, 'agilnost');
                let vzd = vzemiSt(cols, 'vzdrzljivost');

                let lim = (window.normativi[spol] && window.normativi[spol][gen]) ? window.normativi[spol][gen] : window.normativi['M']['U17'];
                let tZ = parseFloat(teza.replace(',', '.')) || 70;
                let sH = window.preračunaj(hit, lim.hitrost, true);
                let sM = window.preračunaj(moc / tZ, lim.moc, false);
                let sV = window.preračunaj(vzd, lim.vzdrzljivost, false);
                let sE = window.preračunaj(eks / tZ, lim.eksplozivnost, false);
                let sA = window.preračunaj(agi, lim.agilnost, true);
                let o = Math.round((sH + sM + sV + sE + sA) / 5);
                let rankInfo = window.getRankClassAndName(o, window.prevodi['sl']);

                // JAVNI dokument - brez e-poste in sestave telesa (isti model kot rocni vnos).
                let atletData = {
                    ime: ime,
                    letorojstva: vzemi(cols, 'letorojstva'),
                    visina: vzemi(cols, 'visina'),
                    teza: teza,
                    spol: spol,
                    generacija: gen,
                    sezona: sez,
                    hitrost: hit, moc: moc, eksplozivnost: eks, agilnost: agi, vzdrzljivost: vzd,
                    ovr: o, rank: rankInfo.n, slika: "", timestamp: Date.now(),
                    trenerId: window.trenerId || null,
                    javnaSestava: false,
                    atletKljuc: email ? window.anonKljuc(email) : null
                };
                let zasebnoData = {
                    emailSportnika: email,
                    odstotekMascobe: vzemi(cols, 'odstotekMascobe'),
                    misicnaMasa: vzemi(cols, 'misicnaMasa'),
                    trenerId: window.trenerId || null
                };
                // KAM: admin -> javni "atleti"; trener -> zasebni "klubatleti".
                let kol = window.isAdm ? "atleti" : "klubatleti";
                let duplicate = window.aBaza.find(a => a.atletKljuc && a.atletKljuc === atletData.atletKljuc && a.sezona === sez);
                try {
                    let shId;
                    if (duplicate) {
                        atletData.slika = duplicate.slika || "";
                        await window.setDoc(window.doc(window.db, kol, duplicate.id), atletData, { merge: true });
                        shId = duplicate.id;
                    } else {
                        let ref = await window.addDoc(window.collection(window.db, kol), atletData);
                        shId = ref.id;
                    }
                    if(shId) await window.setDoc(window.doc(window.db, "zasebno", shId), zasebnoData, { merge: true });
                    successCount++;
                } catch(err) { console.error("Firestore Error:", err); napake++; }
            }

            let lngC = window.prevodi[window.tJezik];
            let sporocilo = lngC.csvUvozeno + successCount;
            if(napake > 0) sporocilo += "\n" + lngC.csvNapake + napake;
            if(neprepoznani.length > 0) sporocilo += "\n\n" + lngC.csvNeprepoznani + neprepoznani.join(', ');
            alert(sporocilo);
            btn.innerText = "📥 Uvozi (CSV)"; btn.disabled = false;
            window.osveziGalerijo();
        };
        reader.readAsText(file);
    };

    // NOV VNOS: obrazec vrne v enako stanje, kot bi bilo ob prvem nalaganju strani.
    // NUJNO se pokliče vsakič, ko admin NAMENOMA začne nov vnos - drugače lahko ID
    // prejšnjega urejanja ostane v skritem polju "atletId" in shranjevanje NAMESTO
    // nove kartice tiho PREPIŠE tujo. To je resnični hrošč, ki so ga opazili v praksi:
    // admin uredi/pogleda athleta A, nato skenira zapestnico athleta B (novega, brez
    // kartice) - "atletId" ostane A-jev, shranjevanje pa prepiše A-jevo kartico z
    // B-jevimi podatki, B pa nikoli ne dobi svoje.
    window.pripraviNovVnos = function() {
        window.urejaniId = null;
        document.getElementById('atletId').value = '';
        document.getElementById('emailSportnika').value = '';
        document.getElementById('ime').value = '';
        document.getElementById('letorojstva').value = '';
        document.getElementById('visina').value = '';
        document.getElementById('teza').value = '';
        document.getElementById('spol').value = 'M';
        document.getElementById('hitrostVal').value = '';
        document.getElementById('mocVal').value = '';
        document.getElementById('eksplozivnostVal').value = '';
        document.getElementById('agilnostVal').value = '';
        document.getElementById('vzdrzljivostVal').value = '';
        document.getElementById('odstotekMascobe').value = '';
        document.getElementById('misicnaMasa').value = '';
        let chk = document.getElementById('chkJavnaSestava'); if(chk) chk.checked = false;
        window.gSlika = '';
        let lng = window.prevodi[window.tJezik];
        let sT = encodeURIComponent(lng.addPhoto);
        let dB = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect width='400' height='600' fill='transparent'/%3E%3Ctext x='50%25' y='50%25' fill='%234facfe' font-size='20' font-family='Arial' font-weight='bold' text-anchor='middle' dominant-baseline='middle'%3E${sT}%3C/text%3E%3C/svg%3E")`;
        let okvir = document.getElementById('slikaOkvir'); if(okvir) okvir.style.backgroundImage = dB;
        let bSlika = document.getElementById('btnSamoShraniSliko'); if(bSlika) bSlika.style.display = 'none';
        if(window.izracunajVse) window.izracunajVse();
    };

    window.urediAtleta = function(id) {
        if(!window.jeTrener) return; let a = window.aBaza.find(x => x.id === id); if(!a) return;
        document.getElementById('atletId').value = a.id; 
        document.getElementById('emailSportnika').value = a.emailSportnika || ""; 
        document.getElementById('ime').value = a.ime; 
        document.getElementById('letorojstva').value = a.letorojstva || (new Date().getFullYear() - (parseInt(a.starost) || 16)); 
        document.getElementById('visina').value = a.visina || ""; 
        document.getElementById('teza').value = a.teza || "80"; 
        document.getElementById('spol').value = a.spol; 
        document.getElementById('sezona').value = a.sezona || "Sezona 1"; 
        document.getElementById('generacija').value = a.generacija; 
        document.getElementById('hitrostVal').value = a.hitrost; 
        document.getElementById('mocVal').value = a.moc; 
        document.getElementById('eksplozivnostVal').value = a.eksplozivnost; 
        document.getElementById('agilnostVal').value = a.agilnost; 
        document.getElementById('vzdrzljivostVal').value = a.vzdrzljivost; 
        document.getElementById('odstotekMascobe').value = a.odstotekMascobe || ""; 
        document.getElementById('misicnaMasa').value = a.misicnaMasa || ""; 
        { let chk = document.getElementById('chkJavnaSestava'); if(chk) chk.checked = a.javnaSestava === true; }
        window.gSlika = a.slika || ""; 
        
        let lng = window.prevodi[window.tJezik]; 
        let sT = encodeURIComponent(lng.addPhoto); 
        let dB = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect width='400' height='600' fill='transparent'/%3E%3Ctext x='50%25' y='50%25' fill='%234facfe' font-size='20' font-family='Arial' font-weight='bold' text-anchor='middle' dominant-baseline='middle'%3E${sT}%3C/text%3E%3C/svg%3E")`; 
        document.getElementById('slikaOkvir').style.backgroundImage = window.gSlika ? `url('${window.gSlika}')` : dB; 
        
        // BUG FIX: window.tZgodovina je do zdaj vedno pripadala PRIJAVLJENEMU uporabniku.
        // Ko je admin urejal drugega športnika, so puščice za sezone (in nova hrbtna stran
        // kartice) še vedno kazale njegovo lastno zgodovino - zato je predogled vedno
        // "skočil" nazaj na prijavljenega športnika. Med urejanjem zato prevzamemo kontekst
        // UREJANEGA športnika.
        window.urejaniId = a.id;
        let gU = window.groupAthletesByEmail();
        let eU = a.atletKljuc || (a.emailSportnika ? window.anonKljuc(a.emailSportnika) : null) || a.id;
        window.tZgodovina = gU[eU] || [a];
        window.mInd = window.tZgodovina.findIndex(x => x.id === a.id);
        if(window.mInd === -1) window.mInd = 0;

        window.izracunajVse(); 
        window.preklopiPogled('vnos'); 
        window.scrollTo(0, 0);
    };

    // Brisanje: namesto takojšnjega izbrisa odpremo okno, kjer uporabnik izbere,
    // ali izbriše CELEGA športnika ali samo določene sezone.
    window.brisiCiljId = null;
    window.brisiAtleta = function(id, gumb) {
        if(!window.jeTrener) return;
        window.brisiCiljId = id;
        let a = window.aBaza.find(x => x.id === id);
        if(!a) return;

        // Poišči vse sezone tega športnika (isti anonimni ključ).
        let g = window.groupAthletesByEmail();
        let kljuc = a.atletKljuc || (a.emailSportnika ? window.anonKljuc(a.emailSportnika) : null) || a.id;
        let sezone = g[kljuc] || [a];
        window.brisiSezone = sezone;

        let sl = window.tJezik === 'sl';
        document.getElementById('brisiNaslov').innerText = (sl ? 'Brisanje: ' : 'Delete: ') + (a.ime || '—');
        document.getElementById('brisiPodnaslov').innerText = sl
            ? 'Odkljukaj sezone za izbris ali izberi celega športnika.'
            : 'Tick the seasons to delete, or remove the whole athlete.';

        let vrstice = sezone.map(s => `
            <label class="brisi-vrstica">
                <input type="checkbox" class="brisi-chk" value="${s.id}">
                <span class="brisi-sezona">${window.escapeHtml(s.sezona || '—')}</span>
                <span class="brisi-ovr">${s.ovr || '?'} OVR</span>
            </label>`).join('');

        document.getElementById('brisiSeznam').innerHTML = `
            <label class="brisi-vrstica brisi-vse">
                <input type="checkbox" id="brisiVseChk" onchange="window.brisiOznaciVse(this.checked)">
                <span class="brisi-sezona">${sl ? 'Cel športnik (vse sezone)' : 'Whole athlete (all seasons)'}</span>
            </label>
            <div class="brisi-locnica"></div>
            ${vrstice}`;

        document.getElementById('brisiOverlay').style.display = 'block';
        document.getElementById('brisiModal').style.display = 'flex';
    };

    window.brisiOznaciVse = function(vklop) {
        document.querySelectorAll('#brisiSeznam .brisi-chk').forEach(c => { c.checked = vklop; });
    };

    window.zapriBrisiModal = function() {
        document.getElementById('brisiOverlay').style.display = 'none';
        document.getElementById('brisiModal').style.display = 'none';
        window.brisiCiljId = null; window.brisiSezone = null;
    };

    window.potrdiBrisanje = async function() {
        let izbrani = [...document.querySelectorAll('#brisiSeznam .brisi-chk:checked')].map(c => c.value);
        if(izbrani.length === 0) { alert(window.tJezik === 'sl' ? 'Ni izbrane nobene sezone.' : 'No season selected.'); return; }

        let sl = window.tJezik === 'sl';
        let vse = izbrani.length === (window.brisiSezone ? window.brisiSezone.length : 0);
        let sporocilo = vse
            ? (sl ? 'Izbrisati CELEGA športnika (vse sezone)?' : 'Delete the WHOLE athlete (all seasons)?')
            : (sl ? `Izbrisati ${izbrani.length} sezon?` : `Delete ${izbrani.length} season(s)?`);
        if(!confirm(sporocilo)) return;

        let btn = document.getElementById('brisiPotrdiTxt');
        btn.innerText = '⏳...'; btn.disabled = true;
        try {
            for(let id of izbrani) {
                let a = window.aBaza.find(x => x.id === id);
                let kol = (a && a._vir === 'klub') ? "klubatleti" : "atleti";
                await window.deleteDoc(window.doc(window.db, kol, id));
                try { await window.deleteDoc(window.doc(window.db, "zasebno", id)); } catch(e) {}
                await window.brisiSlikoIzBaze(id);
            }
        } catch(e) { console.error(e); alert((sl ? 'Napaka pri brisanju: ' : 'Delete error: ') + (e.message || e)); }
        btn.innerText = sl ? '🗑️ Izbriši izbrano' : '🗑️ Delete selected'; btn.disabled = false;
        window.zapriBrisiModal();
        window.osveziGalerijo();
    };

    window.shraniAtleta = async function() {
        if(!window.jeTrener) return;

        // Preverjanje pred shranjevanjem. Namenoma je vprašanje in ne prepoved: na dogodku
        // se lahko pojavi resničen izjemen rezultat, tipkarska napaka pa ne sme mimo tiho.
        {
            let lngV = window.prevodi[window.tJezik];
            let v = {};
            window.TESTI.forEach(t => {
                let el = document.getElementById(t.kljuc + 'Val') || document.getElementById(t.kljuc);
                v[t.kljuc] = el ? el.value : '';
            });
            let opozorila = window.preveriMeritve(v, document.getElementById('teza').value);
            if(opozorila.length > 0 &&
               !confirm(lngV.vnosSumljivo + '\n\n' + opozorila.join('\n') + '\n\n' + lngV.vnosVseeno)) return;
        }

        let bS = document.getElementById('btnShraniBazo'); 
        bS.innerText = "⏳ ..."; bS.disabled = true;
        
        let sU = document.getElementById('slikaOkvir').style.backgroundImage; 
        if(sU && sU.includes('data:image/svg')) sU = ""; 
        
        let iR = document.getElementById('letorojstva'); 
        let vR = iR ? iR.value : "2008";

        try {
        // JAVNI dokument - to vidi vsak (lestvica, kartica). BREZ e-pošte in sestave telesa.
        let atletData = { 
            ime: document.getElementById('ime').value || "", 
            letorojstva: vR, 
            visina: document.getElementById('visina').value || "", 
            teza: document.getElementById('teza').value || "80", 
            spol: document.getElementById('spol').value, 
            generacija: document.getElementById('generacija').value, 
            hitrost: document.getElementById('hitrostVal').value, 
            moc: document.getElementById('mocVal').value, 
            eksplozivnost: document.getElementById('eksplozivnostVal').value, 
            agilnost: document.getElementById('agilnostVal').value, 
            vzdrzljivost: document.getElementById('vzdrzljivostVal').value, 
            ovr: document.getElementById('karticaOvr').innerText, 
            rank: document.getElementById('karticaRank').innerText, 
            slika: "", // slika NE gre več v ta dokument - hrani se v kolekciji "slike"
            sezona: document.getElementById('sezona').value || "Sezona 1", 
            timestamp: Date.now(),
            // Ali športnik dovoli, da je sestava telesa (FFMI) vidna javno. Privzeto NE.
            javnaSestava: document.getElementById('chkJavnaSestava') ? document.getElementById('chkJavnaSestava').checked : false
        };
        // ZASEBNI dokument - samo trener/admin. E-pošta + sestava telesa (občutljivo pri mladoletnikih).
        let zasebnoData = {
            emailSportnika: document.getElementById('emailSportnika').value.toLowerCase().trim(),
            odstotekMascobe: document.getElementById('odstotekMascobe').value || "",
            misicnaMasa: document.getElementById('misicnaMasa').value || ""
        };
        // Za grupiranje sezon istega športnika potrebujemo obstojen ključ. E-pošta je zasebna,
        // zato v JAVNI dokument shranimo le njen anonimni odtis (hash) - povezuje sezone, a ne
        // razkriva naslova.
        atletData.atletKljuc = zasebnoData.emailSportnika ? window.anonKljuc(zasebnoData.emailSportnika) : null;
        
            let targetId = document.getElementById('atletId').value; 
            let isNewSeason = false;
            
            if(targetId) {
                let existingAtlet = window.aBaza.find(a => a.id === targetId);
                if(existingAtlet && existingAtlet.sezona !== atletData.sezona) { 
                    targetId = ""; 
                    isNewSeason = true; 
                }
            }
            if(!targetId) {
                // Dvojnik prepoznamo po anonimnem ključu + sezoni (email ni več v javnem
                // dokumentu). Brez tega bi vsako shranjevanje ustvarilo NOV zapis.
                let duplicate = window.aBaza.find(a => a.atletKljuc && a.atletKljuc === atletData.atletKljuc && a.sezona === atletData.sezona);
                if(duplicate) targetId = duplicate.id;
            }
            
            let shranjenId = targetId;
            // KAM se shrani, je odvisno od vloge:
            // - GLAVNI ADMIN (ti/ekipa): pise v JAVNO kolekcijo "atleti" (combine).
            // - TRENER: pise IZKLJUCNO v svojo zasebno kolekcijo "klubatleti".
            let kolekcija = window.isAdm ? "atleti" : "klubatleti";
            if (targetId) { 
                // UREJANJE: trenerId ohranimo takega, kot je (ne prepišemo lastništva).
                let obst = window.aBaza.find(a => a.id === targetId);
                if(obst && obst.trenerId) atletData.trenerId = obst.trenerId;
                else atletData.trenerId = window.trenerId || null;
                await window.setDoc(window.doc(window.db, kolekcija, targetId), atletData, { merge: true });
            } else { 
                atletData.trenerId = window.trenerId || null;
                let ref = await window.addDoc(window.collection(window.db, kolekcija), atletData);
                shranjenId = ref.id; // ID novega dokumenta rabimo, da nanj vežemo sliko
            } 

            // Zasebni podatki (e-pošta, sestava telesa) v LOČENO kolekcijo "zasebno",
            // pod istim ID-jem. To kolekcijo berejo samo trenerji/admin (Firestore pravila).
            if(shranjenId) {
                zasebnoData.trenerId = atletData.trenerId || null;
                try { await window.setDoc(window.doc(window.db, "zasebno", shranjenId), zasebnoData, { merge: true }); }
                catch(e) { console.warn('Zasebni zapis ni uspel:', e); }
            }

            // Sliko shranimo ločeno, pod ISTIM ID-jem kot športnika.
            if(window.gSlika && shranjenId) {
                bS.innerText = "⏳ Shranjujem sliko...";
                await window.shraniSlikoVBazo(shranjenId, window.gSlika);
            }
            
            window.vibriraj(25);   // kratek fizicni odziv ob uspesnem shranjevanju
            let obv = document.getElementById('obvestiloShranjeno'); 
            obv.innerText = window.prevodi[window.tJezik].shranjeno; 
            obv.style.display = 'block'; 
            setTimeout(() => obv.style.display = 'none', 2000); 
            
            // POMEMBNO: gSlika je globalna in je po shranjevanju NIHČE ni počistil.
            // Naslednji športnik, vnesen brez fotografije, bi zato podedoval prejšnjo.
            // Sliko obdržimo samo v predpomnilniku (vezana je na ID), iz obrazca pa jo umaknemo.
            window.gSlika = "";
            let okvir = document.getElementById('slikaOkvir');
            if(okvir) okvir.style.backgroundImage = '';
            let bSlika = document.getElementById('btnSamoShraniSliko');
            if(bSlika) bSlika.style.display = 'none';

            document.getElementById('atletId').value = ""; 
            window.osveziGalerijo(); 
        } catch(e) { 
            alert("Napaka: " + e.message); 
        } finally { 
            bS.innerText = "💾 " + (window.prevodi[window.tJezik].gumbBaza || "V Bazo"); 
            bS.disabled = false; 
        }
    };

    window.izvoziCSV = function() { 
        if(!window.jeTrener) return; let csv = "Ime;LetoRojstva;Visina;Email;Spol;Generacija;Sezona;Teza;Hitrost;Moc;Eksplozivnost;Agilnost;Vzdrzljivost;Mascoba;MisicnaMasa;OVR;Rank\r\n"; 
        window.aBaza.forEach(a => { 
            let hit = (a.hitrost||"0").toString().replace('.', ',');
            let moc = (a.moc||"0").toString().replace('.', ',');
            let eks = (a.eksplozivnost||"0").toString().replace('.', ',');
            let agi = (a.agilnost||"0").toString().replace('.', ',');
            let vzd = (a.vzdrzljivost||"0").toString().replace('.', ',');
            let masc = (a.odstotekMascobe||"").toString().replace('.', ',');
            let mis = (a.misicnaMasa||"").toString().replace('.', ',');
            csv += `${a.ime};${a.letorojstva||a.starost||"/"};${a.visina||"/"};${a.emailSportnika || ""};${a.spol};${a.generacija};${a.sezona||"Sezona 1"};${a.teza};${hit};${moc};${eks};${agi};${vzd};${masc};${mis};${a.ovr};${a.rank}\r\n`; 
        }); 
        let blob = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' }); let url = URL.createObjectURL(blob); let a = document.createElement('a'); a.href = url; a.download = 'G99_Database.csv'; a.click(); URL.revokeObjectURL(url);
    };

    window.spremeniJezik = function(j) {
        window.tJezik = j; let lng = window.prevodi[j];
        
        let slGumb = document.getElementById('slGumb'); let enGumb = document.getElementById('enGumb');
        if (slGumb) slGumb.classList.toggle('aktivno', j === 'sl'); if (enGumb) enGumb.classList.toggle('aktivno', j === 'en');
        
        window.setT('naslovPrijava', lng.btnLogin === "Login" ? "G99 LOGIN" : "G99 PRIJAVA"); window.setT('lblPrijavaEmail', lng.lblEmail); window.setT('lblPrijavaGeslo', lng.lblGeslo); window.setT('btnPrijavaGumb', lng.btnLogin); window.setT('btnOdpriReg', lng.btnReg); window.setT('btnOdjavaTekst', lng.odjava); 
        window.setH('gumbVnos', `⚙️ ${lng.btnVnos}`); window.setH('gumbPrikaz', `👤 ${lng.btnKartica}`); window.setH('gumbBaza', `🗂️ ${lng.btnBaza}`); window.setH('gumbLestvica', `🏆 ${lng.btnLestvica}`); window.setH('gumbSlava', `🏛️ ${lng.btnSlava || 'Hall of Fame'}`); window.setH('gumbIzzivi', `⚔️ ${lng.btnIzzivi || 'Izzivi'}`); window.setH('gumbSobe', `🔒 ${lng.gumbSobe}`); 
        window.setT('lblVnosEmail', lng.lblVnosEmail); window.setT('labelIme', lng.labelIme); window.setT('labelStarost', lng.labelStarost); window.setT('labelTeza', lng.labelTeza); window.setT('labelVisina', lng.labelVisina); window.setT('labelSpol', lng.labelSpol); window.setT('labelGen', lng.labelGen); window.setT('lblInHit', lng.inHit); window.setT('lblInMoc', lng.inMoc); window.setT('lblInEks', lng.inEks); window.setT('lblInAgi', lng.inAgi); window.setT('lblInVzd', lng.inVzd); window.setT('labelSezona', lng.lblSezona); window.setT('tabBtnKartica', lng.tabKar); window.setT('tabBtnAnalitika', lng.tabAna);
        window.setH('btnSlikoVnos', `📸 ${lng.gumbSliko}`); window.setT('btnShraniSliko2Txt', lng.gumbPrenos); window.setT('btnShraniIGTxt', lng.btnIG); window.setH('btnShraniBazo', `💾 ${lng.gumbBaza}`); window.setH('btnIzvozi', `📤 ${lng.btnIzvozi}`); window.setH('btnUvozi', `📥 Uvozi (CSV)`);
        window.setT('btnGenerirajPorociloTxt', lng.btnGenerirajPorocilo); window.setT('btnPrenesiPorociloTxt', lng.btnPrenesiPorocilo);
        window.setT('btnPrikazNormativiTxt', lng.btnPrikazNormativi); window.setT('btnPrikazZnackeTxt', lng.btnPrikazZnacke); window.setT('naslovVseZnacke', lng.naslovVseZnacke); window.setT('btnPrikazMetodologijaTxt', lng.btnMetodologija);
        window.setT('lblSekcijaSestava', lng.lblSekcijaSestava); window.setT('lblInMascoba', lng.lblInMascoba); window.setT('lblInMisicna', lng.lblInMisicna); window.setT('lblProfilSposobnosti', lng.porociloProfil); window.setT('gumbNadzorTxt', window.tJezik === 'sl' ? 'Nadzorna plošča' : 'Dashboard');
        window.setT('gumbMojKlubTxt', window.tJezik === 'sl' ? 'Moj Klub' : 'My Club');
        window.setT('prijavaPodnaslov', lng.javniCombine); window.setT('oznakaCombine', lng.javniCombine);
        window.setT('namigDotik', lng.namigDotik);
        window.setT('btnTvZaslonTxt', lng.btnTvZaslon);
        window.setT('btnSkenerTxt', lng.btnSkener);
        window.setT('btnTiskKodTxt', lng.btnTiskKod);
        window.setT('btnNaStartuTxt', lng.btnNaStartu);
        window.setT('btnSamoShraniSliko', lng.slikaShrani);
        // Vsi pogledi, ki se izrisujejo iz JavaScripta, se ob menjavi jezika NE prevedejo sami -
        // besedilo je vgrajeno v že izrisan HTML. Zato jih znova izrišemo, a samo tistega,
        // ki je trenutno viden; ponovni izris vseh bi bil na veliki bazi opazno počasen.
        (function() {
            let viden = (id) => { let e = document.getElementById(id); return e && e.style.display !== 'none'; };
            if(viden('panelSlava') && window.izrisiSlavo) window.izrisiSlavo();
            if(viden('panelIzzivi') && window.izrisiIzzive) window.izrisiIzzive();
            if(viden('panelSobe') && window.izrisiSobe) window.izrisiSobe();
            if(viden('panelBaza') && window.izrisiGalerijo) window.izrisiGalerijo();
            if(viden('panelLestvica') && window.izrisiLestvice) window.izrisiLestvice();
            if(viden('panelPrikaz') && window.izracunajVse) window.izracunajVse();
        })();
        { let slB = window.tJezik === 'sl';
          window.setT('brisiPrekliciTxt', slB ? 'Prekliči' : 'Cancel');
          window.setT('brisiPotrdiTxt', slB ? '🗑️ Izbriši izbrano' : '🗑️ Delete selected'); }
        { let slK = window.tJezik === 'sl';
          window.setT('btnKlubFilterTxt', window.klubskiFilter ? (slK ? 'Cel bazen' : 'Full pool') : (slK ? 'Samo moj klub' : 'My club only')); }
        window.setT('lblJavnaSestava', window.tJezik === 'sl' ? 'Sestavo telesa (FFMI) pokaži javno na kartici' : 'Show body composition (FFMI) publicly on card');
        { let slN = window.tJezik === 'sl';
          window.setT('optNadzorVse', slN ? 'Vse sezone (najnovejše)' : 'All seasons (latest)');
          for(let i=1;i<=5;i++) window.setT('optNadzorS'+i, (slN ? 'Sezona ' : 'Season ')+i); } window.setT('mkTabPregledTxt', lng.mkPregled); window.setT('mkTabAnalitikaTxt', lng.mkAnalitika); window.setT('mkTabDosezkiTxt', lng.mkDosezki); window.setT('izrezNaslov', lng.izrezNaslov); window.setT('izrezPodnaslov', lng.izrezPodnaslov); window.setT('izrezPrekliciTxt', lng.izrezPreklici); window.setT('izrezPotrdiTxt', lng.izrezPotrdi);
        
        window.setT('thTest', lng.thTest); window.setT('thMin', lng.thMin); window.setT('thAvg', lng.thAvg); window.setT('thMax', lng.thMax); window.setT('optVsiSpol', lng.optVsiSpol); window.setT('optVsiGen', lng.optVsiGen); window.setT('optOvrDesc', lng.optOvrDesc); window.setT('optOvrAsc', lng.optOvrAsc); 
        window.setT('btnZapriNormative', lng.btnZapri); window.setT('btnZapriZnacke', lng.btnZapri); window.setT('btnZapriPrimerjavo', lng.btnZapri); window.setT('btnZapriPoglej', lng.btnZapri); window.setT('btnZapriReg', lng.btnZapri); window.setT('naslovRegModal', lng.naslovRegModal); window.setT('lblRegPotrdi', lng.lblRegPotrdi); window.setT('btnRegPotrdi', lng.btnRegPotrdi);
        
        let eI = document.getElementById('iskalnik'); if(eI) eI.placeholder = lng.isci;
        if(window.radarGraf && window.radarGrafVnos) { window.radarGraf.data.labels = [...lng.grafLabele]; window.radarGraf.update(); window.radarGrafVnos.data.labels = [...lng.grafLabele]; window.radarGrafVnos.update(); }
        window.setT('optSpolM', lng.optSpolM); window.setT('optSpolZ', lng.optSpolZ); window.setT('optFilterM', lng.optFilterM); window.setT('optFilterZ', lng.optFilterZ); window.setT('optVsiSpol', lng.optVsiSpol);
        window.setT('optLestSpolM', lng.optFilterM); window.setT('optLestSpolZ', lng.optFilterZ); window.setT('optLestSpolVsi', lng.optVsiSpol);
        window.setT('vnosSez1', lng.sez1); window.setT('vnosSez2', lng.sez2); window.setT('vnosSez3', lng.sez3); window.setT('vnosSez4', lng.sez4); window.setT('vnosSez5', lng.sez5); window.setT('optSezVse', lng.vseSezone); window.setT('optSez1', lng.sez1); window.setT('optSez2', lng.sez2); window.setT('optSez3', lng.sez3); window.setT('optSez4', lng.sez4); window.setT('optSez5', lng.sez5); window.setT('optLestSezVse2', lng.vseSezone); window.setT('optLestSez1_2', lng.sez1); window.setT('optLestSez2_2', lng.sez2); window.setT('optLestSez3_2', lng.sez3); window.setT('optLestSez4_2', lng.sez4); window.setT('optLestSez5_2', lng.sez5);
        
        let bT = document.getElementById('btnToggleCompare'); if(bT) bT.innerText = window.cMode ? lng.compToggleOff : lng.compToggleOn; window.setT('compareModalNaslov', lng.compModalTitle);
        let bTd = document.getElementById('btnToggleDelete'); if(bTd) bTd.innerText = window.dMode ? lng.delToggleOff : lng.delToggleOn;
        let bRd = document.getElementById('btnRunDelete'); if(bRd && window.dMode) bRd.innerText = `🗑️ ${lng.delRun} (${window.dIzbrani.length})`;
        let bR = document.getElementById('btnRunCompare'); if (bR && window.cMode) { if(window.cIzbrani.length === 2) { bR.innerText = `▶ ${lng.compRun} (2/2)`; } else { bR.innerText = `▶ ${lng.compSelectMore} ${2 - window.cIzbrani.length} (${window.cIzbrani.length}/2)`; } }
        
        let sT = encodeURIComponent(lng.addPhoto); let dB = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect width='400' height='600' fill='transparent'/%3E%3Ctext x='50%25' y='50%25' fill='%234facfe' font-size='20' font-family='Arial' font-weight='bold' text-anchor='middle' dominant-baseline='middle'%3E${sT}%3C/text%3E%3C/svg%3E")`; let cB = document.getElementById('slikaOkvir') ? document.getElementById('slikaOkvir').style.backgroundImage : ""; 
        if(cB.includes('data:image/svg+xml') || cB === "" || cB === "none") { if(document.getElementById('slikaOkvir')) document.getElementById('slikaOkvir').style.backgroundImage = dB; }
        
        let tLbl1 = document.getElementById('lblGlobal'); let tLbl2 = document.getElementById('lblLocal');
        let chk = document.getElementById('chkRatingToggle');
        if(chk) { chk.checked = (window.ratingMode === 'LOCAL'); }
        if(tLbl1 && tLbl2) {
            tLbl1.innerText = '🌍 ' + lng.ratingGlobal; tLbl2.innerText = '📍 ' + lng.ratingLocal;
            if(window.ratingMode === 'LOCAL') { tLbl1.classList.remove('active'); tLbl2.classList.add('active'); }
            else { tLbl1.classList.add('active'); tLbl2.classList.remove('active'); }
        }

        if (document.getElementById('panelPrikaz').style.display !== 'none') {
            if (!window.jeTrener && (!window.tZgodovina || window.tZgodovina.length === 0)) { window.prikaziPraznoKartico(); } else { window.izracunajVse(); }
        }
        
        let vO = document.getElementById('viewCardOverlay'); if(vO && vO.style.display === 'block') { window.izrisiModalKartico(); } 
        let pB = document.getElementById('panelBaza'); if(pB && (pB.style.display === 'flex' || pB.style.display === 'block')) { window.izrisiGalerijo(); } 
        let pL = document.getElementById('panelLestvica'); if(pL && (pL.style.display === 'flex' || pL.style.display === 'block')) { window.izrisiLestvice(); }
    };

    // Pri izvozu slike je najpogostejši vzrok napake odpiranje strani prek file://
    // (brskalnik "onesnaži" platno in prepove branje slike). Sporočilo to razloži.
    // Ustvari deljivo povezavo do JAVNEGA profila športnika (ločena lahka stran G99_Profil.html).
    // Za Instagram bio: link je hiter in ima social preview. Uporabi ime kot lep URL (#ime-priimek).
    // Slug je bil prej vgrajen v deliProfil. Izluscen je zato, ker ga zdaj rabi tudi QR.
    window.slugIz = function(ime) {
        return (ime || '').toLowerCase().trim().replace(/\s+/g, '-')
                 .replace(/č/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/ć/g,'c').replace(/đ/g,'d');
    };
    // Kratka oblika /p/ime-priimek (prek _redirects) - krajsi URL pomeni redkejso in
    // s tem bolje skenljivo QR kodo kot dolga oblika ?profil=...
    window.profilURL = function(ime) {
        return location.origin + '/p/' + window.slugIz(ime);
    };
    // Vrne skatlico .qr-noga z QR kodo ali null, ce knjiznica ni nalozena (CDN nedosegljiv).
    window.qrElement = function(besedilo, dok) {
        if(typeof qrcode !== 'function') return null;
        try {
            let d = dok || document;
            let q = qrcode(0, 'M'); q.addData(besedilo); q.make();
            let o = d.createElement('div');
            o.className = 'qr-noga';
            let i = d.createElement('img');
            i.src = q.createDataURL(6, 0); i.alt = '';
            o.appendChild(i);
            return o;
        } catch(e) { console.warn('QR:', e); return null; }
    };
    // Noga izvozene slike: QR + oznaka profila. Stoji POD kartico, ne na njej.
    window.izvoznaNoga = function(ime, dok) {
        let d = dok || document;
        let lngN = window.prevodi[window.tJezik] || {};
        let noga = d.createElement('div');
        noga.className = 'izvoz-noga';
        let q = ime ? window.qrElement(window.profilURL(ime), d) : null;
        if(q) noga.appendChild(q);
        let t = d.createElement('div');
        t.className = 'izvoz-noga-tekst';
        t.innerHTML = '<b>@g99performance</b>' + (q ? '<span>' + (lngN.qrNamig || '') + '</span>' : '');
        noga.appendChild(t);
        return noga;
    };
    // OBRAT NA DOTIK za male kartice (Baza, Lestvica).
    // Poslušalec je en sam na dokumentu, ker se kartice ves čas na novo izrisujejo -
    // pripenjanje na vsako posebej bi puščalo mrtve poslušalce.
    // Dotik ločimo od drsenja po premiku prsta in trajanju: če se je prst premaknil
    // več kot 12 px ali je držal dlje kot 700 ms, to ni bil dotik in kartice ne obrnemo.
    window.namestiObratNaDotik = function() {
        if(window._obratDotikPripet) return;
        window._obratDotikPripet = true;
        let cilj = null, zX = 0, zY = 0, zT = 0;

        document.addEventListener('pointerdown', (e) => {
            cilj = null;
            if(e.pointerType === 'mouse') return;     // miška ima hover, ne rabi dotika
            let f = e.target.closest ? e.target.closest('.atlet-vrstica-flipper') : null;
            if(!f) return;
            cilj = f; zX = e.clientX; zY = e.clientY; zT = Date.now();
        }, true);

        document.addEventListener('pointerup', (e) => {
            let f = cilj; cilj = null;
            if(!f || e.pointerType === 'mouse') return;
            if(window.cMode || window.dMode) return;  // izbiranje za primerjavo/brisanje ima prednost
            if(e.target.closest && e.target.closest('button, a, input, select, textarea')) return;
            if(Math.abs(e.clientX - zX) > 12 || Math.abs(e.clientY - zY) > 12) return;
            if(Date.now() - zT > 700) return;
            f.classList.toggle('obrnjena');
            window.vibriraj(12);
        }, true);

        // Ob prehodu v način izbiranja vse obrnjene kartice vrnemo na sprednjo stran.
        window.vrniObrnjene = function() {
            document.querySelectorAll('.atlet-vrstica-flipper.obrnjena').forEach(f => f.classList.remove('obrnjena'));
        };
    };

    // Kratka vibracija ob dogodku. Deluje na Androidu; iOS Safari jo ignorira.
    window.vibriraj = function(vzorec) {
        try { if(navigator.vibrate) navigator.vibrate(vzorec); } catch(e) {}
    };

    window.deliProfil = function() {
        let ime = document.getElementById('ime').value || '';
        if(!ime) { alert(window.tJezik === 'sl' ? 'Najprej izberi športnika.' : 'Select an athlete first.'); return; }
        let slug = window.slugIz(ime);
        // Povezava kaže na APLIKACIJO v profil načinu (?profil=...), zato je kartica
        // popolnoma identična tisti v aplikaciji - znaki časti, značke, foil, hrbtna stran.
        let osnova = location.href.split('?')[0].split('#')[0];
        let link = osnova + '?profil=' + slug;

        let sl = window.tJezik === 'sl';
        // Če brskalnik podpira Web Share (mobilni), ponudi deljenje; sicer kopiraj v odložišče.
        if(navigator.share) {
            navigator.share({ title: ime + ' - G99 Performance', text: sl ? 'Poglej mojo G99 kartico!' : 'Check out my G99 card!', url: link })
                .catch(()=>{});
        } else if(navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                alert((sl ? 'Povezava kopirana:\n\n' : 'Link copied:\n\n') + link);
            }).catch(() => { prompt(sl ? 'Kopiraj povezavo:' : 'Copy link:', link); });
        } else {
            prompt(sl ? 'Kopiraj povezavo:' : 'Copy link:', link);
        }
    };

    window.izvozNapakaSporocilo = function() {
        let sl = window.tJezik === 'sl';
        if(location.protocol === 'file:') {
            return sl
                ? 'Izvoz slike ne deluje, ker je stran odprta neposredno z datoteko (file://).\n\nOdpri jo prek strežnika (npr. VS Code Live Server, http://127.0.0.1:5500), pa bo prenos deloval.'
                : 'Image export does not work when the page is opened directly from a file (file://).\n\nOpen it via a server (e.g. VS Code Live Server, http://127.0.0.1:5500) and export will work.';
        }
        return sl ? 'Izvoz slike ni uspel. Poskusi znova.' : 'Image export failed. Try again.';
    };

    // html2canvas 1.4.1 pade na color-mix()/color(). Ta funkcija se pokliče na KLONIRANEM
    // DOM-u tik pred izrisom in odstrani/nadomesti problematične barvne funkcije, da izvoz uspe.
    window.ocistiZaIzvoz = function(clonedDoc) {
        try {
            let vsi = clonedDoc.querySelectorAll('*');
            let okno = clonedDoc.defaultView || window;
            // Lastnosti, v katerih se lahko pojavi barvna funkcija, ki je html2canvas ne pozna.
            let riziko = ['textShadow','boxShadow','background','backgroundImage','border','borderColor',
                          'webkitTextStroke','webkitTextStrokeColor','filter','color','outlineColor',
                          'textDecorationColor','caretColor','columnRuleColor'];
            // Nadomestne vrednosti so nevtralne - raje brez efekta kot padec izvoza.
            let nadomestek = { color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)',
                               webkitTextStrokeColor: 'rgba(255,255,255,0.2)' };
            let sporno = (v) => !!v && (v.indexOf('color-mix') !== -1 || v.indexOf('color(') !== -1);

            vsi.forEach(el => {
                let s = el.style;
                riziko.forEach(prop => { if(sporno(s[prop])) s[prop] = ''; });

                // Inline čiščenje ne zadošča: vrednost pogosto pride iz stilne datoteke.
                // Chrome color-mix() izračuna v color(srgb ...), česar html2canvas 1.4.1 ne
                // razčleni - zato preverimo IZRAČUNANO vrednost in jo inline povozimo.
                let iz;
                try { iz = okno.getComputedStyle(el); } catch(e) { return; }
                if(!iz) return;
                riziko.forEach(prop => {
                    if(sporno(iz[prop])) s[prop] = nadomestek[prop] || 'none';
                });
            });
            // Za ključne elemente nastavimo preprost nadomestni videz.
            clonedDoc.querySelectorAll('.cast-okvircek').forEach(el => {
                let b = getComputedStyle(el).getPropertyValue('--cast-barva') || '#4facfe';
                el.style.border = '1px solid ' + b;
                el.style.textShadow = '0 0 7px ' + b;
                el.style.background = 'rgba(10,15,28,0.55)';
            });
        } catch(e) { console.warn('Čiščenje za izvoz:', e); }
    };

    window.prenesiSliko = function() { 
        // Če je kartica obrnjena, jo pred izvozom vrnemo na sprednjo stran.
        let mf = document.getElementById('mojaFlip'); if(mf) mf.classList.remove('obrnjena');
        document.body.classList.add('exporting'); let k = document.getElementById('kartica'); if(k) k.style.transform = 'translateZ(0)'; document.getElementById('prikazAkcije').style.display = 'none';
        setTimeout(() => {
            let pocisti = () => {
                document.body.classList.remove('exporting');
                if(k) k.style.transform = '';
                document.getElementById('prikazAkcije').style.display = 'flex';
            };
            let imeZaQR = document.getElementById('ime').value || '';
            html2canvas(document.getElementById("zajem-slike"), { backgroundColor: "#050a18", scale: 3, useCORS: true, logging: false,
                onclone: (d) => { window.ocistiZaIzvoz(d);
                    let z = d.getElementById('zajem-slike'); if(z) z.appendChild(window.izvoznaNoga(imeZaQR, d)); } })
                .then(c => { let a = document.createElement('a'); a.download = 'G99_' + document.getElementById('ime').value + '.png'; a.href = c.toDataURL("image/png"); a.click(); })
                .catch(e => { console.error('Izvoz slike ni uspel:', e); alert(window.izvozNapakaSporocilo()); })
                .finally(pocisti);
        }, 300); 
    };

    window.prenesiIGStory = function() {
        document.body.classList.add('exporting'); let oK = document.getElementById('kartica'); if(oK) oK.style.transform = 'translateZ(0)'; document.getElementById('prikazAkcije').style.display = 'none'; let hNav = document.getElementById('mainHistoryNav'); if(hNav) hNav.style.display = 'none'; document.querySelector('.pogled-preklopnik').style.display = 'none'; document.querySelector('.jezikovni-meni').style.display = 'none'; document.querySelector('.mode-switch-wrapper').style.display = 'none'; document.getElementById('btnOdjavaTekst').style.display = 'none'; document.getElementById('btnSamoShraniSliko').style.display = 'none';
        let w = document.createElement('div'); w.style.position = 'fixed'; w.style.top = '0'; w.style.left = '-9999px'; w.style.width = '432px'; w.style.height = '768px'; w.style.background = 'radial-gradient(circle at center, #111d35 0%, #050a18 100%)'; w.style.display = 'flex'; w.style.flexDirection = 'column'; w.style.justifyContent = 'center'; w.style.alignItems = 'center'; w.style.zIndex = '-50'; 
        let t = document.createElement('div'); t.innerHTML = 'G99 ULTIMATE'; t.style.color = '#fff'; t.style.fontSize = '35px'; t.style.fontWeight = '900'; t.style.marginBottom = '40px'; t.style.letterSpacing = '5px'; t.style.textShadow = '0 0 15px rgba(0,242,254,0.6)'; t.style.fontFamily = "'Montserrat', sans-serif";
        let cC = oK.cloneNode(true); cC.style.transform = 'none'; cC.style.margin = '0'; cC.style.boxShadow = '0 0 80px rgba(0, 242, 254, 0.2)';
        // KLON ima podvojene ID-je (npr. karticaOvr) - to zmede animacije in DOM. Odstranimo
        // vse id-je v klonu in v njem ustavimo morebitno tekočo OVR animacijo (zamrznemo končno
        // vrednost), da se izvozi čista kartica.
        let origOvr = oK.querySelector('#karticaOvr'); let koncniOvr = origOvr ? origOvr.innerText : '';
        cC.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
        cC.querySelectorAll('.ovr-pulz').forEach(e => e.classList.remove('ovr-pulz'));
        // Noga IG zgodbe: QR + @g99performance. Klon je že zunaj zaslona, zato brez utripanja.
        let f = window.izvoznaNoga(document.getElementById('ime').value || '', document);
        f.style.marginTop = '40px'; f.style.fontFamily = "'Montserrat', sans-serif";
        w.appendChild(t); w.appendChild(cC); w.appendChild(f); document.body.appendChild(w);
        setTimeout(() => {
            let pocisti = () => {
                document.body.classList.remove('exporting');
                if(oK) oK.style.transform = '';
                if(w.parentNode) document.body.removeChild(w);
                document.getElementById('prikazAkcije').style.display = 'flex';
                if(window.tZgodovina && window.tZgodovina.length > 1) { if(hNav) hNav.style.display = 'flex'; }
                document.querySelector('.pogled-preklopnik').style.display = 'flex';
                document.querySelector('.jezikovni-meni').style.display = 'flex';
                document.querySelector('.mode-switch-wrapper').style.display = 'flex';
                document.getElementById('btnOdjavaTekst').style.display = 'block';
            };
            html2canvas(w, { backgroundColor: "#050a18", scale: 2.5, useCORS: true, logging: false, onclone: window.ocistiZaIzvoz })
                .then(c => {
                    let a = document.createElement('a');
                    a.download = 'G99_IG_Story_' + document.getElementById('ime').value + '.png';
                    a.href = c.toDataURL("image/png"); a.click();
                })
                .catch(e => { console.error('Izvoz IG story ni uspel:', e); alert(window.izvozNapakaSporocilo()); })
                .finally(pocisti);
        }, 500); 
    };

    // ===== JAVNI PROFIL NAČIN =====
    // Ko je aplikacija odprta kot ?profil=ime-priimek, deluje kot JAVNA vizitka:
    // preskoči prijavo, naloži javno bazo, poišče športnika in pokaže njegovo POLNO
    // kartico (iste znake časti, značke, foil, hrbtno stran kot v aplikaciji).
    // Tako je kartica vedno identična - ni podvojene kode.
    window.jeProfilNacin = function() {
        try {
            if(typeof location === 'undefined' || !location.search) return null;
            let p = new URLSearchParams(location.search).get('profil');
            return p ? decodeURIComponent(p).toLowerCase().trim() : null;
        } catch(e) { return null; }
    };

    window.zazeniProfilNacin = async function(slug) {
        // V profilnem načinu je jezikovni meni skrit, zato jezik določi naslov:
        // ?profil=ime-priimek&lang=en. Brez parametra ostane privzeta slovenščina.
        try {
            let lp = new URLSearchParams(location.search).get('lang');
            if(lp === 'en' || lp === 'sl') window.tJezik = lp;
            let lngP = window.prevodi[window.tJezik];
            // Skrij vse, kar ni kartica (navigacija, prijava, vnos, filtri).
            document.getElementById('panelPrijava').style.display = 'none';
            document.getElementById('g99-aplikacija').style.display = 'block';
            ['pogled-preklopnik','mode-switch-wrapper','jezikovni-meni'].forEach(c => {
                let e = document.querySelector('.' + c); if(e) e.style.display = 'none';
            });
            let bo = document.getElementById('btnOdjavaTekst'); if(bo) bo.style.display = 'none';
            let ao = document.querySelector('.app-oznaka'); if(ao) ao.style.display = 'none';
            ['panelVnos','panelBaza','panelLestvica','panelNadzor','panelPrikaz'].forEach(id => {
                let e = document.getElementById(id); if(e) e.style.display = 'none';
            });

            // Javno branje baze (pravila dovolijo branje brez prijave).
            window.jeTrener = false; window.isAdm = false; window.tEmail = '';
            const qS = await window.getDocs(window.collection(window.db, "atleti"));
            window.aBazaVse = []; 
            qS.forEach(d => window.aBazaVse.push({ id: d.id, ...d.data(), _vir: 'javno' }));
            window.aBaza = window.aBazaVse;
            if(window.aBaza.length === 0) { window.profilNapaka(lngP.profBazaPrazna); return; }

            window.invalidirajLimitCache();
            window.izracunajBadgeRekorde();

            // Poišči športnika po imenu (slug: ime-priimek).
            let skupine = window.groupAthletesByEmail();
            let najden = null;
            for(let k in skupine) {
                let a = skupine[k][0];
                let s = (a.ime || '').toLowerCase().trim()
                        .replace(/č/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/ć/g,'c')
                        .replace(/\s+/g,'-');
                if(s === slug) { najden = a; break; }
            }
            if(!najden) { window.profilNapaka(lngP.profNiNajden); return; }

            // Prednaloži sliko in pokaži POLNO kartico prek obstoječega "Poglej" okna.
            await window.poglejKartico(najden.id);

            // V profil načinu naj bo okno vedno odprto in brez gumba za zapiranje.
            let ov = document.getElementById('viewCardOverlay');
            if(ov) { ov.onclick = null; ov.style.background = 'transparent'; }
            // Vedno viden zgornji pas z logom - klik pelje v aplikacijo. Tako navigacija
            // ni odvisna od pomikanja do dna strani.
            if(!document.getElementById('profilPas')) {
                let pas = document.createElement('a');
                pas.id = 'profilPas';
                pas.href = location.pathname;
                pas.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:5000; display:flex; align-items:center; justify-content:center; gap:10px; padding:11px; text-decoration:none; background:rgba(5,10,24,0.85); backdrop-filter:blur(10px); border-bottom:1px solid rgba(0,242,254,0.25);';
                pas.innerHTML = `
                    <span style="font-size:15px; font-weight:900; letter-spacing:2.5px; color:#00f2fe; text-transform:uppercase;">G99 <span style="color:#fff;">Performance</span></span>
                    <span style="font-size:10px; font-weight:800; color:#04121f; background:linear-gradient(90deg,#00f2fe,#4facfe); padding:5px 12px; border-radius:20px; letter-spacing:0.5px;">${lngP.profOdpriApp}</span>`;
                document.body.appendChild(pas);
                // Prostor pod fiksnim pasom, da ne prekrije vsebine.
                // POPRAVEK: prej je bilo 'viewCardWrapper', tak element pa ne obstaja -
                // odmik se torej ni nikoli nastavil in fiksni pas je lahko prekril kartico.
                let vw = document.getElementById('viewCardContent');
                if(vw) vw.style.paddingTop = '78px';
            }

            // Ozadje in razkritje v barvi ranga - vsak profil je vizualno unikaten.
            try {
                let r = window.izracunajOcene(najden);
                let bc = window.getColorForOvr(r.ovr);
                document.body.style.setProperty('--profil-barva', bc);
                document.body.style.background = 'linear-gradient(180deg, #0a1120 0%, #050a18 100%)';
                document.body.style.backgroundAttachment = 'fixed';
                document.body.classList.add('profil-vstop');

                // Plavajoče ozadje (tri mehke lise v barvi ranga) - globina, ne monotonost.
                if(!document.querySelector('.profil-ozadje')) {
                    let oz = document.createElement('div');
                    oz.className = 'profil-ozadje';
                    oz.innerHTML = '<span></span><span></span><span></span>';
                    document.body.insertBefore(oz, document.body.firstChild);
                }
                // Blisk in obroč se ustvarita šele ob razkritju (spodaj), da ne tečeta
                // med nalaganjem, ko ju obiskovalec niti ne vidi.
            } catch(e) { /* barva ni kritična */ }

            // Kartica je na zaslonu. Preden razkrijemo, POČAKAMO, da se slika športnika
            // dejansko dekodira - sicer animacija teče, medtem ko brskalnik še obdeluje
            // sliko, in to se pozna kot zatikanje.
            let pocakajNaSliko = () => new Promise(res => {
                try {
                    let el = document.querySelector('#viewCardModal .slika-atleta-bg');
                    let bg = el ? getComputedStyle(el).backgroundImage : '';
                    let m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
                    if(!m || !m[1] || m[1] === 'none') { res(); return; }
                    let img = new Image();
                    img.onload = img.onerror = () => res();
                    img.src = m[1];
                    // Varovalo: ne čakamo v nedogled.
                    setTimeout(res, 1200);
                } catch(e) { res(); }
            });
            await pocakajNaSliko();
            // Še ena sličica, da brskalnik dokonča postavitev, preden se sproži animacija.
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            let nal = document.getElementById('profilNalaganje');
            if(nal) { nal.classList.add('koncano'); setTimeout(() => nal.remove(), 750); }

            // ZDAJ sprožimo razkritje - vse je pripravljeno, zato teče gladko.
            document.body.classList.add('profil-razkrij');
            try {
                let blisk = document.createElement('div'); blisk.className = 'profil-blisk';
                let obroc = document.createElement('div'); obroc.className = 'profil-obroc';
                document.body.appendChild(blisk); document.body.appendChild(obroc);
                setTimeout(() => { blisk.remove(); obroc.remove(); }, 2800);
            } catch(e) {}

            let zapri = document.getElementById('btnZapriPoglej');
            if(zapri) zapri.style.display = 'none';

            // Poskrbi, da je stran normalno pomikljiva in se ne konča v prazno.
            document.body.style.overflowY = 'auto';
            let wrap = document.getElementById('viewCardModal');
            if(wrap) { wrap.style.maxHeight = 'none'; wrap.style.height = 'auto'; wrap.style.paddingBottom = '10px'; }

            // CTA pod kartico: profil NE sme biti slepa ulica - ponudimo naslednji korak.
            let vc = document.getElementById('viewCardContent');
            if(vc && !document.getElementById('profilCta')) {
                let cta = document.createElement('div');
                cta.id = 'profilCta';
                cta.style.cssText = 'margin:26px auto 10px; text-align:center; max-width:340px; width:100%;';
                cta.innerHTML = `
                    <div style="height:1px; background:linear-gradient(90deg,transparent,#1e3a5f,transparent); margin-bottom:20px;"></div>
                    <div style="font-size:19px; font-weight:900; letter-spacing:3px; color:#00f2fe; text-transform:uppercase;">G99 <span style="color:#fff;">Performance</span></div>
                    <div style="font-size:9.5px; font-weight:700; letter-spacing:3px; color:#6b7c94; text-transform:uppercase; margin:5px 0 16px;">${lngP.profSlogan}</div>
                    <a href="?" style="display:block; padding:14px; border-radius:12px; background:linear-gradient(90deg,#00f2fe,#4facfe); color:#04121f; font-weight:900; text-decoration:none; letter-spacing:0.5px; margin-bottom:10px;">${lngP.profCtaRacun}</a>
                    <a href="?" style="display:block; padding:12px; border-radius:12px; background:rgba(255,255,255,0.04); border:1px solid #1e3a5f; color:#a0aec0; font-weight:800; text-decoration:none; font-size:12px;">${lngP.profCtaLestvica}</a>
                    <div style="font-size:10px; color:#4a5568; font-weight:600; margin-top:16px; line-height:1.6;">${lngP.profOpomba}</div>`;
                vc.appendChild(cta);
            }
        } catch(e) {
            console.error('Profil način:', e);
            window.profilNapaka((window.prevodi[window.tJezik] || {}).profNapaka || 'Error loading the profile.');
        }
    };

    window.profilNapaka = function(msg) {
        let nal = document.getElementById('profilNalaganje'); if(nal) nal.remove();
        document.body.innerHTML = `<div style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 0%, #111d35 0%, #050a18 60%); color:#ff7675; font-family:Montserrat,sans-serif; font-weight:800; text-align:center; padding:24px;">
            <div style="font-size:22px; letter-spacing:3px; color:#00f2fe; margin-bottom:8px;">G99 <span style="color:#fff;">PERFORMANCE</span></div>
            <div style="margin-top:16px;">${msg}</div>
            <a href="?" style="margin-top:24px; color:#4facfe; font-size:13px;">${(window.prevodi[window.tJezik] || {}).profOdpri || 'Open G99 Performance'}</a>
        </div>`;
    };

    window.initApp = function() {
        window.radarGraf = new Chart(document.getElementById('radarChart').getContext('2d'), { type: 'radar', data: { labels: window.prevodi[window.tJezik].grafLabele, datasets: [{ data: [0, 0, 0, 0, 0], backgroundColor: 'rgba(79, 172, 254, 0.2)', borderColor: '#4facfe', borderWidth: 3 }] }, options: window.chartOptions });
        window.radarGrafVnos = new Chart(document.getElementById('radarChartVnos').getContext('2d'), { type: 'radar', data: { labels: window.prevodi[window.tJezik].grafLabele, datasets: [{ data: [50, 50, 50, 50, 50], backgroundColor: 'rgba(79, 172, 254, 0.2)', borderColor: '#4facfe', borderWidth: 3 }] }, options: window.chartOptions });
        window.spremeniJezik(window.tJezik); 
    window.pripraviNamige();
    window.namestiObratNaDotik();

        // TV NAČIN (?tv=1): projektorski zaslon za dogodek. Bere javno bazo, zato brez prijave.
        if(window.jeTVNacin()) { window.zazeniTVNacin(); return; }

        // JAVNI PROFIL: če je ?profil=..., preskočimo prijavo in pokažemo samo kartico.
        let profilSlug = window.jeProfilNacin();
        if(profilSlug) { window.zazeniProfilNacin(profilSlug); return; }

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                window.tEmail = user.email.toLowerCase();
                window.isAdm = (window.tEmail === window.ADMIN_EMAIL.toLowerCase());

                // ===== VLOGE (temelj za multi-tenancy) =====
                // Vsak uporabnik ima dokument v kolekciji "uporabniki" s poljem "vloga".
                // - "trener": ima svojo zasebno bazo športnikov (trenerId = njegov uid)
                // - sicer: navaden športnik, ki vidi samo svojo kartico
                // Glavni admin (ADMIN_EMAIL) je vedno trener in vidi vse.
                // TRENERJA ZA ZDAJ ODOBRIŠ ROČNO: v Firestore konzoli nastaviš
                // uporabniki/{uid}.vloga = "trener". Pozneje to samodejno naredi Stripe.
                window.tUid = user.uid;
                // COMBINE: ni vlog trenerja. Vnaša SAMO glavni admin (ekipa na dogodku).
                window.jeTrener = window.isAdm;
                window.trenerId = null;
                window.klubskiFilter = false;
                // (Combine ne bere vlog - ni klubov.)


                // COMBINE: klubskih gumbov ni. Skrijemo nadzorno ploščo, Moj Klub in klubski filter.
                ['gumbNadzor','gumbMojKlub','btnKlubFilter'].forEach(id => { let e = document.getElementById(id); if(e) e.style.display = 'none'; });
                // TV zaslon je orodje ekipe na dogodku, zato gumb vidi samo admin.
                let bTv = document.getElementById('btnTvZaslon');
                if(bTv) bTv.style.display = window.isAdm ? 'block' : 'none';
                let bSk = document.getElementById('btnSkener');
                if(bSk) bSk.style.display = window.isAdm ? 'block' : 'none';
                let bTk = document.getElementById('btnTiskKod');
                if(bTk) bTk.style.display = window.isAdm ? 'block' : 'none';
                let bNs = document.getElementById('btnNaStartu');
                if(bNs) bNs.style.display = window.isAdm ? 'block' : 'none';
                let gPrikaz = document.getElementById('gumbPrikaz'); if(gPrikaz) gPrikaz.style.display = 'inline-flex';
                
                if (!user.emailVerified && !window.isAdm) {
                    document.getElementById('panelPrijava').style.display = 'block'; 
                    document.getElementById('g99-aplikacija').style.display = 'none';
                    let errDiv = document.getElementById('prijavaNapaka');
                    errDiv.innerText = window.prevodi[window.tJezik].potrdiMail; 
                    errDiv.style.color = "#ff7675"; errDiv.style.display = 'block';
                    signOut(auth);
                    return;
                }

                document.getElementById('panelPrijava').style.display = 'none'; document.getElementById('g99-aplikacija').style.display = 'flex';
                // Varovalo: prisilno skrije VSE modale/overlaye ob prijavi, ne glede na
                // morebiten "osiroteli" inline stil, ki bi privzeti CSS "display:none" premagal.
                document.querySelectorAll('.modal, .modal-overlay').forEach(el => { el.style.display = 'none'; });
                
                await window.osveziGalerijo(); 

                if (window.jeTrener) { 
                    document.getElementById('gumbVnos').style.display = 'block'; document.getElementById('gumbBaza').style.display = 'block'; document.getElementById('btnIzvozi').style.display = 'inline-block'; document.getElementById('btnUvozi').style.display = 'inline-block'; document.getElementById('btnToggleDelete').style.display = 'inline-block'; window.dMode = false; document.body.classList.remove('delete-mode'); window.preklopiPogled('vnos'); 
                } else { 
                    document.getElementById('gumbVnos').style.display = 'none'; document.getElementById('gumbBaza').style.display = 'block'; document.getElementById('btnIzvozi').style.display = 'none'; document.getElementById('btnUvozi').style.display = 'none'; document.getElementById('btnToggleDelete').style.display = 'none'; document.getElementById('btnRunDelete').style.display = 'none'; window.dMode = false; document.body.classList.remove('delete-mode'); window.preklopiPogled('prikaz'); window.naloziKarticoZaSportnika(window.tEmail); 
                }
            } else { document.getElementById('panelPrijava').style.display = 'block'; document.getElementById('g99-aplikacija').style.display = 'none'; }
        });
    };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', window.initApp); } else { window.initApp(); }
