/* Progressive motion layer: Lenis smooth scroll + GSAP/ScrollTrigger, plus
   vanilla ports of react-bits patterns (SplitText, SpotlightCard, Magnet).
   Everything is optional — if a library fails to load or the visitor prefers
   reduced motion, the page stays fully usable. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Spotlight cards: cursor-tracked glow (CSS does the painting)
  if (finePointer && !reduce) {
    $('.rule-card, .feature-row, .badge').forEach(function (el) {
      el.classList.add('spotlight');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  }

  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  // Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync
  if (window.Lenis) {
    var lenis = new window.Lenis({ lerp: 0.1, anchors: { offset: -72 } });
    lenis.on('scroll', window.ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // Scroll progress bar
  var bar = document.querySelector('.scroll-progress');
  if (bar) {
    gsap.to(bar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.2 }
    });
  }

  // Hero headline: line-by-line mask reveal (SplitText-style)
  var h1 = document.querySelector('.hero h1');
  if (h1) {
    var lines = h1.innerHTML.split(/<br\s*\/?>/i);
    h1.innerHTML = lines.map(function (l) {
      return '<span class="split-line"><span>' + l.trim() + '</span></span>';
    }).join(' ');
    var splitLines = h1.querySelectorAll('.split-line');
    splitLines[splitLines.length - 1].classList.add('shimmer-line');
    gsap.from('.split-line > span', { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.12, delay: 0.1 });
    gsap.from('.hero-sub, .hero-cta-row', { y: 18, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12, delay: 0.55 });
  }

  // Hero board: tiles pop in, stage drifts slower than the page
  var tiles = $('.board .tile');
  if (tiles.length) {
    gsap.from(tiles, { scale: 0.6, opacity: 0, duration: 0.5, ease: 'back.out(1.7)', stagger: { each: 0.025, from: 'random' }, delay: 0.35 });
  }
  gsap.to('.board-stage', {
    yPercent: -6, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  });

  // Mascots rise gently as the closing section arrives
  gsap.from('.mascot-duo img', {
    y: 40, rotate: function (i) { return i ? 6 : -6; }, duration: 0.9, ease: 'back.out(1.5)', stagger: 0.12,
    scrollTrigger: { trigger: '.mascot-duo', start: 'top 90%', once: true }
  });

  // Magnetic primary CTAs (Magnet-style), fine pointers only
  if (finePointer) {
    $('.btn-hero, .closing-cta .btn-primary').forEach(function (btn) {
      btn.classList.add('magnet');
      var x = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
      var y = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.25);
        y((e.clientY - (r.top + r.height / 2)) * 0.25);
      });
      btn.addEventListener('pointerleave', function () { x(0); y(0); });
    });
  }

  // 3D tilt on the hero board (react-bits TiltedCard-style), fine pointers only
  var board = document.querySelector('.board');
  if (board && finePointer) {
    var rx = gsap.quickTo(board, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    var ry = gsap.quickTo(board, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    var stage = document.querySelector('.board-stage');
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 16);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 16);
    });
    stage.addEventListener('pointerleave', function () { rx(0); ry(0); });
  }

  // Section headings slide up; feature cards drift at different speeds
  $('section h2').forEach(function (h) {
    if (h.closest('.hero')) return;
    gsap.from(h, { y: 36, opacity: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });
  $('.feature-row').forEach(function (row) {
    row.style.transition = 'opacity 0.7s cubic-bezier(.16,1,.3,1)'; // keep .reveal's transform transition from lagging the scrub
    gsap.fromTo(row, { y: 40 }, { y: -20, ease: 'none',
      scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  });

  // Vanta fog behind the hero: lazy-loaded after load, desktop pointers only (three.js is ~600 KB).
  // The effect is destroyed while the hero is off-screen (Vanta has no pause) and rebuilt when it returns,
  // and is re-evaluated when the viewport width or colour scheme changes.
  var hero = document.querySelector('.hero');
  var wideMq = window.matchMedia('(min-width: 900px)');
  var darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  if (hero && finePointer) {
    var fog = null, layer = null, heroVisible = true, loading = null;
    var load = function (src) {
      return new Promise(function (ok, fail) {
        var el = document.createElement('script');
        el.src = src; el.onload = ok; el.onerror = fail; document.head.appendChild(el);
      });
    };
    var ensureLibs = function () {
      if (window.VANTA && window.VANTA.FOG) return Promise.resolve();
      if (!loading) {
        loading = load('js/vendor/three.min.js').then(function () { return load('js/vendor/vanta.fog.min.js'); })
          .catch(function () { loading = null; throw new Error('vanta'); });
      }
      return loading;
    };
    var stopFog = function () {
      if (fog) { fog.destroy(); fog = null; }
      if (layer) { layer.remove(); layer = null; }
    };
    var startFog = function () {
      if (fog || !heroVisible || !wideMq.matches) return;
      ensureLibs().then(function () {
        if (fog || !heroVisible || !wideMq.matches) return;
        var dark = darkMq.matches;
        layer = document.createElement('div');
        layer.className = 'hero-vanta';
        hero.insertBefore(layer, hero.firstChild);
        fog = window.VANTA.FOG({
          el: layer, mouseControls: true, touchControls: false, minHeight: 200, minWidth: 200,
          highlightColor: dark ? 0x7a3f52 : 0xffb3c1,
          midtoneColor: dark ? 0x5e3a26 : 0xffd9b0,
          lowlightColor: dark ? 0x284463 : 0xcfe6ff,
          baseColor: dark ? 0x1b1512 : 0xfff8f0,
          blurFactor: 0.7, speed: 1.2, zoom: 1.1
        });
        var l = layer;
        requestAnimationFrame(function () { l.classList.add('is-on'); });
      }).catch(function () {});
    };
    var refresh = function () { stopFog(); startFog(); };
    var begin = function () {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) startFog(); else stopFog();
      }).observe(hero);
      [wideMq, darkMq].forEach(function (mq) {
        if (mq.addEventListener) mq.addEventListener('change', refresh); else mq.addListener(refresh);
      });
      startFog();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(begin, { timeout: 2500 }); else setTimeout(begin, 1200);
  }
})();
