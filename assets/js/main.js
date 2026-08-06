/* ============================================================
   RASWANTH CB — PORTFOLIO / INTERACTION LAYER
   GSAP + ScrollTrigger + Lenis. No build step.

   Restraint is the rule: motion here exists to establish
   hierarchy and continuity, never decoration. No cursor
   hijacking, no floating particles, no magnetic buttons.
   Everything degrades to static under prefers-reduced-motion.
   ============================================================ */
(() => {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE    = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const MOTION  = hasGSAP && !REDUCED;

  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // The intro overlay plus a pinned section means a browser-restored scroll
  // position would have ScrollTrigger measure everything against the wrong
  // origin. Measure from the top, then restore any deep link afterwards so
  // shared URLs like /#work still land in the right place.
  const deepLink = (location.hash && location.hash.length > 1 &&
                    document.querySelector(location.hash)) ? location.hash : null;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  $('#year').textContent = new Date().getFullYear();

  /* ══════════════ 1. SMOOTH SCROLL ══════════════ */
  let lenis = null;

  function initSmoothScroll() {
    if (REDUCED || typeof window.Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo.out
      smoothWheel: true,
      touchMultiplier: 1.5
    });

    if (window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollTo(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -10, duration: 1.2 });
    else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2 || !$(id)) return;
      e.preventDefault();
      closeDrawer();
      scrollTo(id);
    });
  });

  /* ══════════════ 2. TEXT SPLITTING ══════════════ */
  // Lightweight stand-in for the paid SplitText plugin. Keeps the original
  // string on aria-label and hides the generated spans from assistive tech.
  function splitChars(el) {
    if (el.dataset.splitDone) return $$('.char', el);

    const original = el.textContent;
    el.setAttribute('aria-label', original);
    el.textContent = '';

    const chars = [];
    original.split(/(\s+)/).forEach((chunk) => {
      if (/^\s+$/.test(chunk)) { el.appendChild(document.createTextNode(' ')); return; }
      const word = document.createElement('span');
      word.className = 'word';
      word.setAttribute('aria-hidden', 'true');
      for (const ch of chunk) {
        const c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        word.appendChild(c);
        chars.push(c);
      }
      el.appendChild(word);
    });

    el.dataset.splitDone = '1';
    el.classList.add('is-ready');
    return chars;
  }

  // A split gradient headline is many separate elements, so each character
  // has to paint its own slice of one shared gradient or the ramp restarts
  // per glyph. Recomputed on resize because the line width changes.
  function paintGradientChars() {
    $$('.split--accent[data-split-done]').forEach((el) => {
      const w = el.getBoundingClientRect().width;
      if (!w) return;
      const left = el.getBoundingClientRect().left;
      $$('.char', el).forEach((c) => {
        c.style.backgroundSize = w + 'px 100%';
        c.style.backgroundPositionX = -(c.getBoundingClientRect().left - left) + 'px';
      });
    });
  }

  /* ══════════════ 3. INTRO ══════════════ */
  function initLoader(onDone) {
    const loader  = $('#loader');
    const count   = $('#loaderCount');
    const bar     = $('#loaderBar');
    const letters = $$('.loader__name span');

    if (!MOTION || !loader) {
      if (loader) loader.remove();
      onDone();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(bail);
      loader.remove();
      onDone();
    };

    // rAF is throttled in background tabs and can stall on slow devices.
    // Never let the intro hold the page hostage.
    const bail = setTimeout(() => { if (tl) tl.kill(); finish(); }, 5000);

    const state = { v: 0 };
    const tl = gsap.timeline({ onComplete: finish });

    tl.to(letters, { y: 0, opacity: 1, duration: .6, stagger: .03, ease: 'expo.out' })
      .to(state, {
        v: 100, duration: 1.05, ease: 'power2.inOut',
        onUpdate() {
          const v = Math.round(state.v);
          count.textContent = String(v).padStart(3, '0');
          bar.style.width = v + '%';
        }
      }, '-=.3')
      .to(loader, { yPercent: -100, duration: .85, ease: 'expo.inOut' }, '+=.1');
  }

  /* ══════════════ 4. AMBIENT LAYER ══════════════ */
  // Decorative background only, and only on scroll. It never tracks the
  // pointer — ambient light that chases the mouse reads as noise.
  function initAmbient() {
    if (!MOTION || !window.ScrollTrigger) return;
    $$('.aurora__blob').forEach((b, i) => {
      gsap.to(b, {
        yPercent: (i + 1) * -6,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.2 }
      });
    });
  }

  /* ══════════════ 5. HOVER SURFACES ══════════════ */
  // Contained to the element under the pointer. Nothing follows the cursor
  // around the page.
  function initSurfaces() {
    if (!FINE) return;
    $$('.pillar').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ══════════════ 6. REVEALS ══════════════ */
  function initReveals() {
    const reveals = $$('[data-reveal]');
    const splits  = $$('[data-split]');

    if (!MOTION) {
      reveals.forEach((el) => (el.style.opacity = '1'));
      splits.forEach((el) => el.classList.add('is-ready'));
      return;
    }

    // Character reveal is reserved for short display headings only.
    splits.forEach((el) => {
      const chars = splitChars(el);
      gsap.set(chars, { yPercent: 106, opacity: 0 });
      gsap.to(chars, {
        yPercent: 0, opacity: 1,
        duration: .85, ease: 'expo.out', stagger: .014,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    paintGradientChars();
    if (document.fonts) document.fonts.ready.then(paintGradientChars);

    let rz;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(paintGradientChars, 150);
    });

    // Everything else: a fade with a short lift. Reads as a fade, not a slide.
    reveals.forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .7, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true } }
      );
    });
  }

  /* ══════════════ 7. COUNTERS ══════════════ */
  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const pre    = el.dataset.prefix || '';
      const suf    = el.dataset.suffix || '';

      if (!MOTION) { el.textContent = pre + target + suf; return; }

      const o = { v: 0 };
      gsap.to(o, {
        v: target, duration: 1.6, ease: 'expo.out',
        onUpdate: () => { el.textContent = pre + Math.round(o.v) + suf; },
        scrollTrigger: { trigger: el, start: 'top 92%', once: true }
      });
    });
  }

  /* ══════════════ 8. HEADER + NAV ══════════════ */
  function initHeader() {
    const header = $('#header');
    const nav    = $('#nav');
    const pill   = $('#navPill');
    const links  = $$('#nav a');
    let last = 0;

    function movePill(el) {
      if (!el || !pill) return;
      pill.style.opacity   = '1';
      pill.style.width     = el.offsetWidth + 'px';
      pill.style.transform = `translateX(${el.offsetLeft - 5}px)`;
    }
    function resetPill() {
      const active = $('#nav a.is-active');
      if (active) movePill(active);
      else if (pill) pill.style.opacity = '0';
    }
    links.forEach((a) => a.addEventListener('pointerenter', () => movePill(a)));
    if (nav) nav.addEventListener('pointerleave', resetPill);

    function onScroll(y) {
      header.classList.toggle('is-stuck', y > 40);
      if (!$('#drawer').classList.contains('is-open')) {
        header.classList.toggle('is-hidden', y > last && y > 460);
      }
      last = y;
    }

    if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
    else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

    if (!window.ScrollTrigger) return;

    const rail = $('#rail');
    $$('[data-section]').forEach((sec) => {
      const id = sec.dataset.section;
      ScrollTrigger.create({
        trigger: sec, start: 'top 45%', end: 'bottom 45%',
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
          $$('.rail__list li').forEach((li) => li.classList.toggle('is-active', li.dataset.rail === id));
          resetPill();
          if (rail) rail.classList.toggle('is-visible', id !== 'hero');
        }
      });
    });

    const fill = $('#railFill');
    if (fill) {
      ScrollTrigger.create({
        trigger: document.body, start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => { fill.style.height = (self.progress * 100) + '%'; }
      });
    }
  }

  /* ══════════════ 9. MOBILE DRAWER ══════════════ */
  const drawer = $('#drawer');
  const burger = $('#burger');

  function openDrawer() {
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();

    const items = $$('.drawer__nav a');
    if (MOTION) gsap.to(items, { opacity: 1, y: 0, duration: .5, stagger: .045, ease: 'expo.out', delay: .06 });
    else items.forEach((i) => { i.style.opacity = '1'; i.style.transform = 'none'; });
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
    $$('.drawer__nav a').forEach((i) => { i.style.opacity = ''; i.style.transform = ''; });
    setTimeout(() => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 600);
  }

  function initDrawer() {
    burger.addEventListener('click', () => {
      drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  }

  /* ══════════════ 10. METHOD — PINNED HORIZONTAL ══════════════ */
  // The one pinned section on the page. Four sequential steps are the rare
  // case where horizontal travel actually carries meaning.
  function initMethod() {
    const pin   = $('#methodPin');
    const track = $('#methodTrack');
    const fill  = $('#methodFill');
    if (!pin || !track) return;

    if (!MOTION || !window.ScrollTrigger) { if (fill) fill.style.width = '100%'; return; }

    // Measured lazily so invalidateOnRefresh picks up new values on every
    // resize / refresh instead of baking in the first measurement.
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    // gsap.matchMedia owns the setup/teardown across breakpoints. Below
    // desktop the CSS turns the track into a plain vertical stack, so the
    // pin must not exist at all there.
    gsap.matchMedia().add('(min-width: 1025px)', () => {
      if (distance() <= 0) return;

      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => '+=' + (distance() + window.innerHeight * 0.4),
          scrub: 1,
          pin: true,
          // Transform pinning rather than position:fixed — it stays in sync
          // with Lenis's interpolated scroll instead of fighting it.
          pinType: 'transform',
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => { if (fill) fill.style.width = (self.progress * 100) + '%'; }
        }
      });

      return () => {
        gsap.set(track, { x: 0 });
        if (fill) fill.style.width = '100%';
      };
    });
  }

  /* ══════════════ 10b. MEASUREMENT SETTLING ══════════════ */
  // Pinned sections need recalculating once fonts and images have settled.
  // `load` and `fonts.ready` may both have fired before the intro finished,
  // so re-check rather than only listening.
  function refreshWhenSettled() {
    if (!window.ScrollTrigger) return;
    const refresh = () => ScrollTrigger.refresh();

    requestAnimationFrame(refresh);
    if (document.readyState === 'complete') setTimeout(refresh, 0);
    else window.addEventListener('load', refresh, { once: true });
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(refresh);
    }
  }

  /* ══════════════ 11. MARQUEE ══════════════ */
  // Constant, slow, ignorable. Deliberately not coupled to scroll velocity.
  function initMarquee() {
    const row = $('#marquee');
    if (!row || !MOTION) return;

    const set = $('.marquee__set', row);
    let x = 0;

    const tick = () => {
      requestAnimationFrame(tick);
      const w = set.getBoundingClientRect().width;
      if (!w) return;
      x -= 0.42;
      if (x <= -w) x += w;
      row.style.transform = `translate3d(${x}px,0,0)`;
    };
    requestAnimationFrame(tick);
  }

  /* ══════════════ 12. WORK FILTERS ══════════════ */
  function initFilters() {
    const buttons = $$('.filter');
    const cards   = $$('#workGrid .card');
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.filter;

        buttons.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });

        cards.forEach((card) => {
          const match = f === 'all' || card.dataset.tags.split(' ').includes(f);
          card.classList.toggle('is-dim', !match);
          card.setAttribute('aria-hidden', String(!match));
        });

        if (MOTION) {
          const shown = cards.filter((c) => !c.classList.contains('is-dim'));
          gsap.fromTo(shown,
            { opacity: .4, y: 8 },
            { opacity: 1, y: 0, duration: .4, stagger: .04, ease: 'power2.out', overwrite: true }
          );
        }
      });
    });
  }

  /* ══════════════ 13. BOOT ══════════════ */
  function start() {
    initSmoothScroll();
    initSurfaces();
    initAmbient();
    initReveals();
    initCounters();
    initHeader();
    initDrawer();
    initMethod();
    initMarquee();
    initFilters();
    refreshWhenSettled();

    if (deepLink) {
      // Two frames: one for the refresh above to land, one for the pinned
      // section's spacer to be measured before we jump past it.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (window.ScrollTrigger) ScrollTrigger.refresh();
        scrollTo(deepLink);
      }));
    }
  }

  initLoader(start);
})();
