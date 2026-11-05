/* polish.js: load AFTER extras.js (with defer). Only adds new elements/classes;
   it never touches the animations in script.js or extras.js. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[polish]', name, e); } };

  // Skip link for keyboard users
  safe('skip', () => {
    const main = $('main');
    if (!main || $('.skip')) return;
    main.tabIndex = -1;
    const a = document.createElement('a');
    a.className = 'skip'; a.href = '#top'; a.textContent = 'Skip to content';
    document.body.prepend(a);
  });

  // Reading progress hairline
  safe('progress', () => {
    const bar = document.createElement('div');
    bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.append(bar);
    let t = 0;
    const update = () => {
      t = 0;
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0);
    };
    addEventListener('scroll', () => { t = t || requestAnimationFrame(update); }, { passive: true });
    addEventListener('resize', update);
    update();
  });

  // Highlight the nav link of the section in view
  safe('spy', () => {
    if (!('IntersectionObserver' in window)) return;
    const links = $$('.nav__links a[href^="#"]');
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const clear = () => links.forEach(a => { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      clear();
      const a = map.get(e.target.id);
      if (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    [...map.keys()].map(id => document.getElementById(id)).filter(Boolean).forEach(s => io.observe(s));
    const hero = $('.hero');
    if (hero) new IntersectionObserver(es => { if (es[0].isIntersecting) clear(); }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);
  });

  // "hover" makes no sense on touch screens, where a tap opens the row
  safe('touch hint', () => {
    if (!matchMedia('(hover: none)').matches) return;
    const hint = $('.section-head .mono');
    if (hint) hint.textContent = hint.textContent.replace('hover to read more', 'tap to read more');
  });

  // Copy-email button + live-region toast.
  // Prefers the button that is already in index.html (id="copy-email", so script.js can give it the
  // target cursor); creates one only as a fallback.
  safe('copy email', () => {
    const mail = $('.contact__mail');
    if (!mail || !navigator.clipboard) return;
    const addr = mail.textContent.trim();
    let btn = $('#copy-email');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'copy-email'; btn.className = 'contact__copy mono'; btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy email address'); btn.setAttribute('data-magnetic', '');
      mail.after(btn);
    }

    // Safety net: if script.js did not switch the reticle to target mode, do it here.
    const cursor = $('.cursor');
    if (cursor) {
      btn.addEventListener('mouseenter', () => setTimeout(() => { if (!cursor.classList.contains('is-target')) { cursor.classList.add('is-target'); btn._forced = true; } }, 60));
      btn.addEventListener('mouseleave', () => { if (btn._forced) { cursor.classList.remove('is-target'); btn._forced = false; } });
    }

    const toast = document.createElement('div');
    toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
    let tid = 0;
    const say = msg => {
      toast.textContent = msg; toast.classList.add('is-on');
      clearTimeout(tid); tid = setTimeout(() => toast.classList.remove('is-on'), 2200);
    };
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(addr); say('Email copied'); }
      catch (_) { say('Could not copy. Select the address instead.'); }
    });
  });

  // Tell the CSS when the globe is on screen (used to freeze the grain overlay)
  safe('globe perf', () => {
    const host = $('#contact-globe');
    if (!host || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(es => {
      document.documentElement.classList.toggle('globe-on', es[0].isIntersecting);
    }, { rootMargin: '80px 0px' }).observe(host);
  });
})();