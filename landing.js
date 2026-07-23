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

    // Naslov v heroju: beseda-za-besedo animacija (čisti CSS + zamik prek JS)
    var title = document.getElementById('lHeroTitle');
    if (title) {
        var words = title.querySelectorAll('.word');
        words.forEach(function (w, i) {
            w.style.animationDelay = (i * 0.12) + 's';
        });
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
