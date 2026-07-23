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
            rot.style.transform = 'translateY(10px)';
            setTimeout(function () {
                ri = (ri + 1) % slogani.length;
                rot.textContent = slogani[ri];
                rot.style.opacity = '1';
                rot.style.transform = 'translateY(0)';
            }, 350);
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
        { rank: 'Iron',     varc: '--rang-iron',     ovr: 32, obseg: 'OVR 0–39',  foto: 5, name: 'Rok Zajc' },
        { rank: 'Bronze',   varc: '--rang-bronze',   ovr: 45, obseg: 'OVR 40–49', foto: 6, name: 'Miha Kos' },
        { rank: 'Silver',   varc: '--rang-silver',   ovr: 55, obseg: 'OVR 50–59', foto: 2, name: 'Lan Perko' },
        { rank: 'Gold',     varc: '--rang-gold',     ovr: 64, obseg: 'OVR 60–69', foto: 3, name: 'Žan Novak' },
        { rank: 'Platinum', varc: '--rang-platinum', ovr: 74, obseg: 'OVR 70–79', foto: 4, name: 'Mark Horvat' },
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
        { name: 'Mark Horvat',    rank: 'Platinum', varc: '--rang-platinum', ovr: 76, foto: 5 },
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
            });
        });
        cardOvoj.addEventListener('pointerleave', function () {
            if (tarca) { tarca.style.setProperty('--tilt-x', '0deg'); tarca.style.setProperty('--tilt-y', '0deg'); }
        });
    }
})();
