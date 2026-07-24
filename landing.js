// ===== G99 Performance — landing.js =====
// Samo vizualne interakcije javne strani (nič prijave/baze - to ostane v app.js).
(function () {
    'use strict';

    // Nav ozadje ob scrollu
    var nav = document.getElementById('lNav');
    if (nav) {
        window.addEventListener('scroll', function () {
            nav.classList.toggle('scrolled', window.scrollY > 20);
        }, { passive: true });
    }

    // Mobilni meni (hamburger)
    var toggle = document.getElementById('lNavToggle');
    var links = document.getElementById('lNavLinks');
    if (toggle && links) {
        toggle.addEventListener('click', function () {
            links.classList.toggle('l-nav-links-odprto');
        });
        links.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () { links.classList.remove('l-nav-links-odprto'); });
        });
    }

    // Scroll-reveal: ko element vstopi v pogled, dobi razred "in"
    var reveals = document.querySelectorAll('.l-reveal');
    if ('IntersectionObserver' in window && reveals.length) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.15 });
        reveals.forEach(function (el) { io.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add('in'); });
    }

    // Prva vrstica naslova se vrti med slogani (druga vrstica "Samo tvoj OVR." ostane).
    // Vsi slogani se ujemajo s filozofijo: zasluga, ne sreča; dokaz, ne izgovori.
    var rot = document.getElementById('lHeroRot');
    if (rot) {
        var slogani = [
            'Ni ekip. Ni sreče.',
            'Ni izgovorov.',
            'Nič ni podarjeno.',
            'Brez bližnjic.',
            'Samo delo šteje.',
            'Dokaz, ne besede.'
        ];
        var ri = 0;
        setInterval(function () {
            rot.style.opacity = '0';
            setTimeout(function () {
                ri = (ri + 1) % slogani.length;
                rot.textContent = slogani[ri];
                rot.style.opacity = '1';
            }, 300);
        }, 3200);
    }

    // ===== Generiranje mini-kartic (l-vc) za rang-scroll in sneak-peek baze =====
    // Ena sama funkcija -> obe sekciji izgledata kot prave kartice iz baze.
    var IKONE = ['fa-bolt', 'fa-dumbbell', 'fa-heart-pulse', 'fa-gauge-high', 'fa-wave-square'];
    function statiOkoli(ovr) {
        // pet ocen razpršenih okoli OVR (kot pri pravem atletu), omejeno na 1..99
        var d = [1, -2, 0, 2, -1];
        return d.map(function (x) { return Math.max(1, Math.min(99, ovr + x)); });
    }
    function vcardHTML(a) {
        var s = a.stats || statiOkoli(a.ovr);
        var ikone = IKONE.map(function (ik, i) {
            return '<div><i class="fa-solid ' + ik + '"></i><b>' + s[i] + '</b></div>';
        }).join('');
        return '' +
            '<div class="l-vc" style="--rb:var(' + a.varc + ');">' +
                '<div class="l-vc-foto l-foto-' + a.foto + '"></div>' +
                '<div class="l-vc-ovr"><b>' + a.ovr + '</b><span>' + (a.mode || 'WRLD') + '</span></div>' +
                '<div class="l-vc-body">' +
                    '<div class="l-vc-ime">' + a.name + '</div>' +
                    '<div class="l-vc-rank">' + a.rank + '</div>' +
                    '<div class="l-vc-stats">' + ikone + '</div>' +
                '</div>' +
            '</div>';
    }

    // Rang lestvica: ista oseba napreduje - vsak rang je bolj epska kartica.
    var RANGI = [
        { rank: 'Iron',     varc: '--rang-iron',     ovr: 32, obseg: 'OVR 1–39',  foto: 5, name: 'Rok Zajc' },
        { rank: 'Bronze',   varc: '--rang-bronze',   ovr: 45, obseg: 'OVR 40–49', foto: 6, name: 'Miha Kos' },
        { rank: 'Silver',   varc: '--rang-silver',   ovr: 55, obseg: 'OVR 50–59', foto: 2, name: 'Lan Perko' },
        { rank: 'Gold',     varc: '--rang-gold',     ovr: 64, obseg: 'OVR 60–69', foto: 3, name: 'Žan Novak' },
        { rank: 'Emerald', varc: '--rang-emerald', ovr: 74, obseg: 'OVR 70–79', foto: 4, name: 'Mark Horvat' },
        { rank: 'Diamond',  varc: '--rang-diamond',  ovr: 84, obseg: 'OVR 80–88', foto: 1, name: 'Tim Zupan' },
        { rank: 'Prime',    varc: '--rang-prime',    ovr: 91, obseg: 'OVR 89–93', foto: 3, name: 'Nejc Kovač' },
        { rank: 'Elite',    varc: '--rang-elite',    ovr: 95, obseg: 'OVR 94–97', foto: 2, name: 'Luka Medved' },
        { rank: 'G99 Tier', varc: '--rang-g99',      ovr: 99, obseg: 'OVR 98–99', foto: 1, name: 'Jaka Grobelnik' }
    ];
    var rangScroll = document.getElementById('lRangScroll');
    if (rangScroll) {
        rangScroll.innerHTML = RANGI.map(function (r) {
            return '<div class="l-rang-tile">' +
                vcardHTML(r) +
                '<div class="l-rang-tile-ime" style="color:var(' + r.varc + ');">' + r.rank + '</div>' +
                '<div class="l-rang-tile-obseg">' + r.obseg + '</div>' +
            '</div>';
        }).join('');
    }

    // Baza: vrh lestvice kot mreža kartic.
    var BAZA = [
        { name: 'Jaka Grobelnik', rank: 'G99 Tier', varc: '--rang-g99',      ovr: 98, foto: 1 },
        { name: 'Luka Medved',    rank: 'Elite',    varc: '--rang-elite',    ovr: 95, foto: 2 },
        { name: 'Nejc Kovač',     rank: 'Prime',    varc: '--rang-prime',    ovr: 91, foto: 3 },
        { name: 'Tim Zupan',      rank: 'Diamond',  varc: '--rang-diamond',  ovr: 84, foto: 4 },
        { name: 'Mark Horvat',    rank: 'Emerald',  varc: '--rang-emerald',  ovr: 76, foto: 5 },
        { name: 'Žan Novak',      rank: 'Gold',     varc: '--rang-gold',     ovr: 68, foto: 6 }
    ];
    var bazaGrid = document.getElementById('lBazaGrid');
    if (bazaGrid) {
        bazaGrid.innerHTML = BAZA.map(vcardHTML).join('');
    }

    // ===== Gladek drsnik za rang-scroll (povleci z miško + kolešček + puščici) =====
    if (rangScroll) {
        var isDown = false, startX = 0, startScroll = 0, moved = false;
        rangScroll.addEventListener('pointerdown', function (e) {
            isDown = true; moved = false; startX = e.clientX; startScroll = rangScroll.scrollLeft;
            rangScroll.classList.add('l-dragging');
        });
        window.addEventListener('pointermove', function (e) {
            if (!isDown) return;
            var dx = e.clientX - startX;
            if (Math.abs(dx) > 4) moved = true;
            rangScroll.scrollLeft = startScroll - dx;
        }, { passive: true });
        window.addEventListener('pointerup', function () {
            if (!isDown) return;
            isDown = false; rangScroll.classList.remove('l-dragging');
        });
        // klik povlečene kartice ne sme sprožiti (ne odpira ničesar, a preventiva)
        rangScroll.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
        // puščici
        var korak = 220;
        var prev = document.getElementById('lRangPrev');
        var next = document.getElementById('lRangNext');
        if (prev) prev.addEventListener('click', function () { rangScroll.scrollBy({ left: -korak, behavior: 'smooth' }); });
        if (next) next.addEventListener('click', function () { rangScroll.scrollBy({ left: korak, behavior: 'smooth' }); });
    }

    // Hero kartica se samodejno obrača (front <-> back), da razkaže obe strani.
    // Klik ali dotik jo tudi ročno obrne in za trenutek zaustavi samodejni cikel.
    var flip = document.getElementById('lHeroFlip');
    if (flip) {
        var autoFlip = setInterval(function () { flip.classList.toggle('obrnjena'); }, 4500);
        var flipOvoj = document.getElementById('lHeroCardOvoj');
        if (flipOvoj) {
            flipOvoj.style.cursor = 'pointer';
            flipOvoj.addEventListener('click', function () {
                flip.classList.toggle('obrnjena');
                clearInterval(autoFlip);
                autoFlip = setInterval(function () { flip.classList.toggle('obrnjena'); }, 4500);
            });
        }
    }

    // 3D nagib hero kartice ob premiku miške - ista matematika kot pripniTiltInFoil()
    // v app.js (MAX_NAGIB = 9 stopinj), da se kartica na povsod v app-u obnaša enako.
    var cardOvoj = document.getElementById('lHeroCardOvoj');
    if (cardOvoj && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        var tarca = cardOvoj.querySelector('.tilt-tarca');
        var foil = cardOvoj.querySelector('.foil-plast');
        var holos = cardOvoj.querySelectorAll('.holo-live');
        var MAX_NAGIB = 9;
        var pending = false;
        cardOvoj.addEventListener('pointermove', function (e) {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
                pending = false;
                var r = cardOvoj.getBoundingClientRect();
                if (!r.width || !r.height) return;
                var px = (e.clientX - r.left) / r.width;
                var py = (e.clientY - r.top) / r.height;
                if (tarca) {
                    tarca.style.setProperty('--tilt-x', (-(py - 0.5) * 2 * MAX_NAGIB).toFixed(2) + 'deg');
                    tarca.style.setProperty('--tilt-y', ((px - 0.5) * 2 * MAX_NAGIB).toFixed(2) + 'deg');
                }
                if (foil) {
                    foil.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
                    foil.style.setProperty('--my', (py * 100).toFixed(1) + '%');
                }
                holos.forEach(function (h) {
                    var hmx = h.classList.contains('holo-back') ? (100 - px * 100) : (px * 100);
                    h.style.setProperty('--mx', hmx.toFixed(1) + '%');
                    h.style.setProperty('--my', (py * 100).toFixed(1) + '%');
                });
            });
        });
        cardOvoj.addEventListener('pointerleave', function () {
            if (tarca) { tarca.style.setProperty('--tilt-x', '0deg'); tarca.style.setProperty('--tilt-y', '0deg'); }
        });
    }

    // ===== Nav dropdown "Dogodki" =====
    // Na računalniku odpre hover (CSS), na dotik pa klik prek razreda .odprto.
    var dd = document.getElementById('lNavDD');
    var ddGumb = document.getElementById('lNavDDGumb');
    if (dd && ddGumb) {
        ddGumb.addEventListener('click', function (e) {
            e.stopPropagation();
            var odprt = dd.classList.toggle('odprto');
            ddGumb.setAttribute('aria-expanded', odprt ? 'true' : 'false');
        });
        document.addEventListener('click', function (e) {
            if (!dd.contains(e.target)) { dd.classList.remove('odprto'); ddGumb.setAttribute('aria-expanded', 'false'); }
        });
    }

    // ===== Modal G99 Event (podroben opis dogodkov) =====
    // Globalni funkciji, ker ju kličejo inline onclick v index.html.
    window.odpriDogodekModal = function (id) {
        var m = document.getElementById('lDogodekModal');
        if (!m) return;
        m.classList.add('odprto');
        m.setAttribute('aria-hidden', 'false');
        document.body.classList.add('l-modal-lock');
        // zapri odprta navigacijska menija (hamburger + dropdown)
        var lin = document.getElementById('lNavLinks'); if (lin) lin.classList.remove('l-nav-links-odprto');
        var d = document.getElementById('lNavDD'); if (d) d.classList.remove('odprto');
        var okno = m.querySelector('.l-modal-okno'); if (okno) okno.scrollTop = 0;
        // če je podan konkreten termin, ga označi in pripelji v pogled
        m.querySelectorAll('.l-md-dogodek').forEach(function (r) { r.classList.remove('poudarjen'); });
        if (id) {
            var row = m.querySelector('.l-md-dogodek[data-dog="' + id + '"]');
            if (row) {
                row.classList.add('poudarjen');
                setTimeout(function () { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 160);
            }
        }
    };
    window.zapriDogodekModal = function () {
        var m = document.getElementById('lDogodekModal');
        if (!m) return;
        m.classList.remove('odprto');
        m.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('l-modal-lock');
    };
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') window.zapriDogodekModal();
    });

    // ===== Radar / pajkova mreža (poročilo) =====
    // Petkotnik s pet osmi (Hitrost, Moč, Vzdržljivost, Eksplozivnost, Agilnost).
    // Enak vrstni red in barve kategorij kot ikone na kartici.
    var radarEl = document.getElementById('lRadar');
    if (radarEl) {
        var kat = [
            { ime: 'HITROST',       barva: '#f1c40f', val: 99 },
            { ime: 'MOČ',           barva: '#ff7675', val: 97 },
            { ime: 'VZDRŽLJIVOST',  barva: '#a29bfe', val: 98 },
            { ime: 'EKSPLOZIVNOST', barva: '#fdcb6e', val: 99 },
            { ime: 'AGILNOST',      barva: '#00cec9', val: 98 }
        ];
        var cx = 200, cy = 180, R = 120, n = kat.length;
        function tocka(i, r) {
            var a = -Math.PI / 2 + i * 2 * Math.PI / n;
            return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        }
        var svg = '<svg viewBox="0 0 400 384" class="l-radar-svg" role="img" aria-label="Radarski graf sposobnosti">';
        // koncentrični obroči (mreža)
        [0.25, 0.5, 0.75, 1].forEach(function (f) {
            var pts = kat.map(function (_, i) { var p = tocka(i, R * f); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
            svg += '<polygon points="' + pts + '" class="l-radar-ring"/>';
        });
        // radialne osi
        kat.forEach(function (_, i) {
            var p = tocka(i, R);
            svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" class="l-radar-spoke"/>';
        });
        // podatkovni petkotnik
        var dataPts = kat.map(function (k, i) { var p = tocka(i, R * k.val / 99); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
        svg += '<polygon points="' + dataPts + '" class="l-radar-data"/>';
        // pike na ogliščih + oznake
        kat.forEach(function (k, i) {
            var pd = tocka(i, R * k.val / 99);
            svg += '<circle cx="' + pd[0].toFixed(1) + '" cy="' + pd[1].toFixed(1) + '" r="4" fill="' + k.barva + '"/>';
            var pl = tocka(i, R + 22);
            var anchor = Math.abs(pl[0] - cx) < 6 ? 'middle' : (pl[0] > cx ? 'start' : 'end');
            var dy = pl[1] < cy - 20 ? -3 : (pl[1] > cy + 20 ? 11 : 4);
            svg += '<text x="' + pl[0].toFixed(1) + '" y="' + (pl[1] + dy).toFixed(1) + '" text-anchor="' + anchor + '" class="l-radar-label" fill="' + k.barva + '">' + k.ime + '</text>';
            svg += '<text x="' + pl[0].toFixed(1) + '" y="' + (pl[1] + dy + 13).toFixed(1) + '" text-anchor="' + anchor + '" class="l-radar-val">' + k.val + '</text>';
        });
        svg += '</svg>';
        radarEl.innerHTML = svg;
    }
})();
