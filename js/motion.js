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
})();
