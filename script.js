(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const hasGsap = typeof window.gsap !== 'undefined';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;


  // ---------- White electric arcs around the Faiq wordmark ----------
  const electricLogo = $('.electric-logo');
  const electricCanvas = electricLogo ? $('.electric-logo__canvas', electricLogo) : null;
  if (electricLogo && electricCanvas && !reduce) {
    const ctx = electricCanvas.getContext('2d');
    let electricFrame = 0;
    let electricWidth = 0;
    let electricHeight = 0;
    let electricDpr = 1;
    const resizeElectricLogo = () => {
      const rect = electricCanvas.getBoundingClientRect();
      electricDpr = Math.min(window.devicePixelRatio || 1, 2);
      electricWidth = rect.width;
      electricHeight = rect.height;
      electricCanvas.width = Math.round(electricWidth * electricDpr);
      electricCanvas.height = Math.round(electricHeight * electricDpr);
      ctx.setTransform(electricDpr, 0, 0, electricDpr, 0, 0);
    };
    const drawElectricArc = () => {
      const pad = 5;
      const side = Math.floor(Math.random() * 4);
      const start = side === 0 ? [Math.random() * electricWidth, pad]
        : side === 1 ? [electricWidth - pad, Math.random() * electricHeight]
        : side === 2 ? [Math.random() * electricWidth, electricHeight - pad]
        : [pad, Math.random() * electricHeight];
      const end = side === 0 ? [Math.min(electricWidth, start[0] + 8 + Math.random() * 26), pad + 2]
        : side === 1 ? [electricWidth - pad - 2, Math.min(electricHeight, start[1] + 8 + Math.random() * 20)]
        : side === 2 ? [Math.max(0, start[0] - 8 - Math.random() * 26), electricHeight - pad - 2]
        : [pad + 2, Math.max(0, start[1] - 8 - Math.random() * 20)];
      const dx = end[0] - start[0], dy = end[1] - start[1];
      const steps = 5 + Math.floor(Math.random() * 4);
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        ctx.lineTo(start[0] + dx * t + (Math.random() - .5) * 8, start[1] + dy * t + (Math.random() - .5) * 8);
      }
      ctx.lineTo(end[0], end[1]);
      ctx.strokeStyle = 'rgba(255,255,255,' + (.45 + Math.random() * .5) + ')';
      ctx.lineWidth = .7 + Math.random() * .8;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 7 + Math.random() * 8;
      ctx.stroke();
      if (Math.random() > .55) {
        const bx = start[0] + dx * (.35 + Math.random() * .35);
        const by = start[1] + dy * (.35 + Math.random() * .35);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (Math.random() - .5) * 12, by + (Math.random() - .5) * 12);
        ctx.lineWidth = .6;
        ctx.stroke();
      }
    };
    const animateElectricLogo = () => {
      ctx.clearRect(0, 0, electricWidth, electricHeight);
      if (Math.random() > .28) {
        const count = 1 + (Math.random() > .72 ? 1 : 0);
        for (let i = 0; i < count; i++) drawElectricArc();
      }
      electricFrame = requestAnimationFrame(animateElectricLogo);
    };
    resizeElectricLogo();
    animateElectricLogo();
    window.addEventListener('resize', resizeElectricLogo, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(electricFrame);
      else animateElectricLogo();
    });
  }

  // ---------- Clock (Asia/Jakarta) ----------
  const clock = $('#clock');
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    });
  };
  tick(); setInterval(tick, 15000);
  $('#year').textContent = new Date().getFullYear();

  // ---------- Marquee: duplicate the set so the loop is seamless ----------
  const marqueeTrack = $('.marquee__track');
  marqueeTrack.innerHTML += marqueeTrack.innerHTML;

  // Duplicate the complete technology set once for a seamless 50% marquee loop.
  const techLoopTrack = $('.tech-loop__track');
  if (techLoopTrack) techLoopTrack.innerHTML += techLoopTrack.innerHTML;

  // ---------- Split "about" text into words ----------
  const about = $('#aboutText');
  about.innerHTML = about.textContent.trim().split(/\s+/)
    .map(w => `<span class="w">${w}</span>`).join(' ');
  const words = $$('.w', about);

  // ---------- Project rows: tap to open on touch devices ----------
  // On desktop a row opens on hover / keyboard focus via CSS. On touch there is no hover,
  // so a tap toggles .is-open instead. Touch is detected at tap time (not once at page load),
  // so it also works in DevTools mobile emulation and on tablets/laptops with both touch and mouse.
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  let lastPointer = 'mouse';
  document.addEventListener('pointerdown', e => { lastPointer = e.pointerType; }, true);

  $$('.project').forEach(p => {
    $('.project__row', p).addEventListener('click', () => {
      if (lastPointer === 'mouse' && hoverQuery.matches) return; // mouse users already get hover
      const wasOpen = p.classList.contains('is-open');
      $$('.project.is-open').forEach(o => o.classList.remove('is-open'));
      if (!wasOpen) p.classList.add('is-open');
    });
  });

  // Hint text follows the device: "hover" on mouse, "tap" on touch
  const hint = $('.section-head .mono');
  const projectCount = String($$('.project').length).padStart(2, '0');
  const updateHint = () => {
    hint.textContent = `(${projectCount}) · ${hoverQuery.matches ? 'hover' : 'tap'} to read more`;
  };
  updateHint();
  if (hoverQuery.addEventListener) hoverQuery.addEventListener('change', updateHint);
  else if (hoverQuery.addListener) hoverQuery.addListener(updateHint);

  // If GSAP / CDN is unavailable, show everything and stop here.
  if (!hasGsap || reduce) {
    $('.loader').remove();
    document.body.classList.remove('is-loading');
    words.forEach(w => w.classList.add('on'));
    return;
  }

  document.documentElement.classList.add('gsap-ready');
  gsap.registerPlugin(ScrollTrigger);

  // ---------- Smooth scroll ----------
  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target !== null) { e.preventDefault(); lenis.scrollTo(target, { duration: 1.4 }); }
    }));
  }

  // ---------- Loader -> intro ----------
  document.body.classList.add('is-loading');
  const count = $('#count');
  const state = { n: 0 };
  gsap.set('.hero__title .line > span', { yPercent: 110 });

  const intro = gsap.timeline();
  intro
    .to(state, {
      n: 100, duration: 1.8, ease: 'power2.inOut',
      onUpdate: () => { count.textContent = Math.round(state.n); }
    })
    .to('.loader__bar i', { scaleX: 1, duration: 1.8, ease: 'power2.inOut' }, 0)
    .to('.loader', { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '+=.15')
    .add(() => document.body.classList.remove('is-loading'), '-=.6')
    .to('.hero__title .line > span', { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .1 }, '-=.5')
    .to('.hero .reveal', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: .1 }, '-=.8')
    .from('.nav', { yPercent: -100, duration: .9, ease: 'power3.out' }, '-=.9');

  gsap.set('.hero .reveal', { y: 20 });

  // ---------- Scroll animations ----------
  // About: words light up as you scroll
  ScrollTrigger.create({
    trigger: about, start: 'top 80%', end: 'bottom 55%', scrub: true,
    onUpdate: self => {
      const upTo = Math.round(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < upTo));
    }
  });

  gsap.from('.fact', {
    y: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: .12,
    scrollTrigger: { trigger: '.facts', start: 'top 85%' }
  });

  gsap.from('.tool-group', {
    y: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: .1,
    scrollTrigger: { trigger: '.toolbox', start: 'top 85%' }
  });

  gsap.from('.section-title', {
    y: 60, opacity: 0, duration: 1.1, ease: 'expo.out',
    scrollTrigger: { trigger: '.section-title', start: 'top 85%' }
  });

  $$('.project').forEach(p => {
    gsap.from(p, {
      y: 50, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: p, start: 'top 92%' }
    });
  });

  // Marquee speeds up with scroll velocity
  const anim = $('.marquee__track').getAnimations()[0];
  if (anim) {
    let rate = 1;
    ScrollTrigger.create({
      onUpdate: self => {
        const target = 1 + Math.min(Math.abs(self.getVelocity()) / 500, 5);
        if (target > rate) rate = target;
      }
    });
    gsap.ticker.add(() => {
      rate += (1 - rate) * 0.05; // ease back to normal speed
      anim.playbackRate = rate;
    });
  }

  gsap.from('.contact__title', {
    y: 80, opacity: 0, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact', start: 'top 70%' }
  });

  // ---------- Cursor and magnetic buttons ----------
  if (finePointer) {
    const cursor = $('.cursor');

    const cx = gsap.quickTo(cursor, 'x', { duration: .25, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: .25, ease: 'power3' });

    window.addEventListener('mousemove', e => {
      cx(e.clientX); cy(e.clientY);
    });

    $$('a, [data-magnetic]').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-link'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-link'));
    });

    $$('[data-magnetic]').forEach(el => {
      const mx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * .3);
        my((e.clientY - (r.top + r.height / 2)) * .3);
      });
      el.addEventListener('mouseleave', () => { mx(0); my(0); });
    });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();