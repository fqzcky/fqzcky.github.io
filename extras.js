/* extras.js: loads AFTER script.js and does not change it.
   1) Mobile menu   2) Hero terminal (typing + tilt)   3) Draggable lanyard badge
   Each part runs on its own, so a problem in one never breaks the others. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn('[extras]', name, e); } };

  // runs fn once the intro loader is gone (with a failsafe)
  const afterLoader = fn => {
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    if (!document.body.classList.contains('is-loading')) return go();
    const mo = new MutationObserver(() => { if (!document.body.classList.contains('is-loading')) { mo.disconnect(); go(); } });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { mo.disconnect(); go(); }, 7000);
  };

  // ---------- 1) Mobile menu ----------
  safe('menu', () => {
    const btn = $('.nav__burger'), menu = $('#menu');
    if (!btn || !menu) return;
    const set = open => {
      root.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
    };
    btn.addEventListener('click', () => set(!root.classList.contains('menu-open')));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { set(false); btn.focus(); } });
    // if the screen grows past the phone layout while the menu is open, close it
    window.matchMedia('(min-width: 821px)').addEventListener?.('change', e => { if (e.matches) set(false); });
  });

  // ---------- 2) Hero terminal ----------
  safe('terminal', () => {
    const body = $('.term__body[data-type]');
    if (!body) return;
    const lines = $$('p', body);
    const cursor = $('.term__cursor', body);

    // Tilt toward the pointer (desktop mouse only)
    const win = $('.term__win');
    if (win && window.gsap && fine.matches && !reduce) {
      const rx = gsap.quickTo(win, 'rotationX', { duration: .9, ease: 'power3' });
      const ry = gsap.quickTo(win, 'rotationY', { duration: .9, ease: 'power3' });
      const hero = $('.hero');
      hero.addEventListener('mousemove', e => {
        ry((e.clientX / window.innerWidth - .5) * 9);
        rx(-(e.clientY / window.innerHeight - .5) * 7);
      }, { passive: true });
      hero.addEventListener('mouseleave', () => { rx(0); ry(0); });
    }

    if (reduce) return; // the full text is already in the page

    // Split every line into "typed" + "rest" (rest stays invisible but keeps the layout from jumping)
    const items = lines.filter(p => !p.classList.contains('t-last')).map(p => {
      const text = p.textContent;
      p.textContent = '';
      const done = document.createElement('span'), rest = document.createElement('span');
      rest.className = 'rest'; rest.textContent = text;
      p.append(done, rest);
      return { p, done, rest, text, cmd: p.classList.contains('t-cmd') };
    });
    const last = lines.find(p => p.classList.contains('t-last'));
    if (last) last.style.visibility = 'hidden';

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const run = async () => {
      await sleep(350);
      for (const it of items) {
        if (it.cmd) {
          for (let i = 1; i <= it.text.length; i++) {
            it.done.textContent = it.text.slice(0, i);
            it.rest.textContent = it.text.slice(i);
            await sleep(34 + Math.random() * 40);
          }
          await sleep(260);
        } else {
          it.done.textContent = it.text; it.rest.textContent = '';
          await sleep(320);
        }
      }
      if (last) last.style.visibility = '';
    };
    // start when visible and after the loader
    afterLoader(() => {
      if (!('IntersectionObserver' in window)) { run(); return; }
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); run(); } });
      io.observe(body);
    });
  });

  // ---------- 3) Lanyard badge: small verlet physics, drag with mouse or finger ----------
  // The rope is a reel: while you pull, it pays out more rope; after you let go the clip slides along a rail
  // so the badge hangs straight where you left it (so you can park it away from the text). Double-tap resets.
  safe('lanyard', () => {
    const box = $('#lanyard');
    if (!box) return;
    const canvas = $('.lanyard__canvas', box), badge = $('.badge', box), shine = $('.badge__shine', box);
    const hint = $('.lanyard__hint', box), slot = $('.lanyard__slot');
    const layout = box.parentElement;
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx || !badge) { box.classList.add('is-static'); return; }

    const N = 12;                          // rope segments
    const GRAV = 2300, STEP = 1 / 60;
    const AY = 18;                         // y of the rail
    let W = 0, H = 0, dpr = 1, cardW = 0, cardH = 0, clipH = 34, rodLen = 0;
    let ax = 0, restAx = 0, ropeLen = 0, ropeRest = 0, ropeMax = 0, segLen = 0;
    let pts = [];                          // 0..N rope (N = hook A), N+1 = B (bottom of the badge)
    let running = false, visible = false, raf = 0, last = 0, acc = 0, calm = 0;
    let drag = null, resetting = false, firstShow = true, tap = { t: 0, x: 0, y: 0 };

    const css = n => (getComputedStyle(root).getPropertyValue(n) || '').trim();
    const accent = css('--accent') || '#ff5a36', fg = css('--fg') || '#f1ebe1';
    const mk = (x, y, w) => ({ x, y, px: x, py: y, w });
    const isPhone = () => window.matchMedia('(max-width: 820px)').matches;

    const build = () => {
      W = box.clientWidth; H = box.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const br = box.getBoundingClientRect();
      const phone = isPhone() || !slot || slot.offsetParent === null;
      const sr = phone ? null : slot.getBoundingClientRect();
      restAx = sr ? sr.left + sr.width / 2 - br.left : W / 2;
      const colW = sr ? sr.width : W;
      cardW = Math.round(phone ? Math.min(colW * .9, 330) : Math.min(250, colW * .74)); cardH = Math.round(cardW * 1.5);
      badge.style.width = cardW + 'px'; badge.style.height = cardH + 'px';
      rodLen = clipH + cardH;

      const off = layout.getBoundingClientRect().top - br.top;        // how far the box reaches above the text
      const restTop = off + (phone ? -4 : 16);                          // desktop: beside the first lines; phone: over the text
      ropeRest = Math.max(40, restTop - clipH - AY);
      ropeMax = H + W;
      ropeLen = ropeRest; segLen = ropeLen / N; ax = restAx;

      pts = [];
      for (let i = 0; i <= N; i++) pts.push(mk(ax, AY + i * segLen, i === 0 ? 0 : 1));
      pts[N].w = .8;
      pts.push(mk(ax, AY + ropeLen + rodLen, .35));
      if (firstShow) { const sw = Math.max(0, Math.min(70, W - ax - cardW / 2 - 8)); for (let i = 1; i < pts.length; i++) { const k = i / pts.length; pts[i].x += sw * k; pts[i].px = pts[i].x - sw * .1 * k; } }

      if (hint) { hint.style.left = restAx + 'px'; hint.style.top = (restTop + cardH + clipH + 10) + 'px'; }
    };

    const A = () => pts[N], B = () => pts[N + 1];
    const satisfy = (a, b, len) => {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, diff = (d - len) / d, ws = a.w + b.w;
      if (!ws) return;
      a.x += dx * diff * (a.w / ws); a.y += dy * diff * (a.w / ws);
      b.x -= dx * diff * (b.w / ws); b.y -= dy * diff * (b.w / ws);
    };

    let moving = false;
    const step = () => {
      moving = false;
      // reel: pay out rope while pulling
      if (drag) {
        const need = Math.hypot(drag.tx - ax, drag.ty - AY) - drag.t * rodLen;
        if (need > ropeLen) { ropeLen = Math.min(ropeMax, ropeLen + (need - ropeLen) * .3); moving = true; }
      } else if (resetting) {
        ropeLen += (ropeRest - ropeLen) * .07; ax += (restAx - ax) * .07;
        if (Math.abs(ropeLen - ropeRest) < 1 && Math.abs(ax - restAx) < 1) resetting = false;
        moving = true;
      } else {
        const a = A(); const dx = a.x - ax;                           // clip slides along the rail to stay above the badge
        if (Math.abs(dx) > .5) { ax += dx * .05; moving = true; }
        const d = Math.hypot(a.x - ax, a.y - AY);                      // and the reel takes in slack, so the badge stays where it was left
        if (ropeLen > d + 2) { ropeLen += (d + 2 - ropeLen) * .1; moving = true; }
      }
      ax = Math.min(W - 20, Math.max(20, ax));
      segLen = ropeLen / N;

      const g = GRAV * STEP * STEP;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        let vx = (p.x - p.px) * .995, vy = (p.y - p.py) * .995;
        const sp = Math.hypot(vx, vy); if (sp > 42) { vx *= 42 / sp; vy *= 42 / sp; }
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + g * (i === pts.length - 1 ? 1.15 : 1);
      }
      for (let it = 0; it < 14; it++) {
        pts[0].x = ax; pts[0].y = AY;
        for (let i = 0; i < N; i++) satisfy(pts[i], pts[i + 1], segLen);
        satisfy(A(), B(), rodLen);
        if (drag) {
          const a = A(), b = B(), t = drag.t;
          const gx = a.x + (b.x - a.x) * t, gy = a.y + (b.y - a.y) * t;
          let dx = drag.tx - gx, dy = drag.ty - gy;
          const m = Math.hypot(dx, dy); if (m > 70) { dx *= 70 / m; dy *= 70 / m; }
          const k = .48;
          a.x += dx * (1 - t) * k; a.y += dy * (1 - t) * k;
          b.x += dx * t * k;       b.y += dy * t * k;
        }
      }
      const m = cardW * .5;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], pad = i >= N ? m : 6;
        p.x = Math.min(W - pad, Math.max(pad, p.x));
        p.y = Math.min(H - 14, Math.max(0, p.y));
      }
    };

    let lastT = '';
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // rail
      ctx.strokeStyle = 'rgba(241,235,225,.14)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20, AY - 6); ctx.lineTo(W - 20, AY - 6); ctx.stroke();
      // strap
      const path = () => {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < N; i++) ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
        ctx.lineTo(pts[N].x, pts[N].y);
      };
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 15; path(); ctx.stroke();
      ctx.strokeStyle = accent; ctx.lineWidth = 12; path(); ctx.stroke();
      ctx.strokeStyle = 'rgba(20,14,10,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); path(); ctx.stroke(); ctx.setLineDash([]);
      // slider on the rail
      ctx.fillStyle = fg; ctx.globalAlpha = .92;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ax - 22, AY - 10, 44, 8, 4) : ctx.rect(ax - 22, AY - 10, 44, 8); ctx.fill();
      ctx.globalAlpha = 1;

      const a = A(), b = B();
      const ang = Math.atan2(-(b.x - a.x), b.y - a.y);
      const t = `translate(${a.x.toFixed(2)}px, ${a.y.toFixed(2)}px) rotate(${ang.toFixed(4)}rad) translate(${(-cardW / 2).toFixed(2)}px, ${clipH}px)`;
      if (t !== lastT) { badge.style.transform = t; lastT = t; }
      if (shine) shine.style.transform = `translateX(${(ang * 420).toFixed(1)}%)`;
    };

    const energy = () => {
      let m = 0;
      for (let i = 1; i < pts.length; i++) m = Math.max(m, Math.abs(pts[i].x - pts[i].px) + Math.abs(pts[i].y - pts[i].py));
      return m;
    };
    const loop = now => {
      raf = 0;
      if (!running) return;
      const dt = Math.min(.05, (now - last) / 1000 || STEP); last = now;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 4) { step(); acc -= STEP; n++; }
      if (acc > STEP) acc = 0;
      draw();
      if (!drag && !moving && energy() < .03) { if (++calm > 60) { running = false; return; } } else calm = 0;
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      calm = 0;
      if (running || !visible) return;
      running = true; last = performance.now(); acc = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    // ----- pointer: grab the badge anywhere on its body -----
    const toLocal = e => { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const cursorEl = $('.cursor');
    badge.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { badge.setPointerCapture(e.pointerId); } catch (_) {}
      const p = toLocal(e), a = A(), b = B();
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(.15, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      resetting = false;
      drag = { t, tx: p.x, ty: p.y, sx: p.x, sy: p.y, moved: false };
      badge.classList.add('is-grabbing');
      wake();
    });
    badge.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = toLocal(e);
      if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) { drag.moved = true; box.classList.add('is-used'); }
      drag.tx = Math.min(W - 6, Math.max(6, p.x)); drag.ty = Math.min(H - 6, Math.max(6, p.y));
    });
    const release = e => {
      if (!drag) return;
      const wasTap = !drag.moved; drag = null; badge.classList.remove('is-grabbing');
      if (wasTap && e && e.type === 'pointerup') {                     // double-tap / double-click: hang it back
        const now = performance.now(), p = toLocal(e);
        if (now - tap.t < 380 && Math.hypot(p.x - tap.x, p.y - tap.y) < 24) { resetting = true; tap.t = 0; }
        else tap = { t: now, x: p.x, y: p.y };
      }
      wake();
    };
    badge.addEventListener('pointerup', release);
    badge.addEventListener('pointercancel', release);
    badge.addEventListener('lostpointercapture', () => release());
    badge.addEventListener('dragstart', e => e.preventDefault());
    if (cursorEl) {
      badge.addEventListener('mouseenter', () => cursorEl.classList.add('is-link'));
      badge.addEventListener('mouseleave', () => cursorEl.classList.remove('is-link'));
    }
    badge.tabIndex = 0;
    badge.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'Enter') { resetting = true; wake(); return; }
      const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key]; if (!k) return;
      e.preventDefault(); const b = B(); b.px = b.x - k * 14; wake();
    });

    // ----- lifecycle -----
    if (reduce) firstShow = false;
    build();
    draw();
    box.classList.add('is-ready');

    if (reduce) {                       // reduced motion: hang still, no physics
      box.classList.add('is-static');
      badge.style.pointerEvents = 'none';
      return;
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        visible = es[0].isIntersecting;
        if (visible) { firstShow = false; wake(); } else running = false;
      }, { rootMargin: '120px 0px' }).observe(layout);
    } else { visible = true; wake(); }

    document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else wake(); });

    let lastW = W, tid = 0;
    const onSize = () => {
    clearTimeout(tid);
    tid = setTimeout(() => {
        if (box.clientWidth === lastW) return;
        lastW = box.clientWidth; build(); draw(); wake();
    }, 120);
    };
    if ('ResizeObserver' in window) new ResizeObserver(onSize).observe(box);
    window.addEventListener('resize', onSize);
    window.addEventListener('load', () => { if (!drag) { build(); draw(); wake(); } }); // fonts/images can move the text
  });

  // ---------- 4) Dither veil: 1-bit photo, burned back to colour by the pointer, knitting shut cell by cell ----------
  safe('veil', () => {
    const sec = $('.veil');
    if (!sec) return;
    const stage = $('.veil__stage', sec), img = $('.veil__img', sec), cv = $('.veil__canvas', sec);
    const hint = $('.js-veil-hint', sec);
    const ctx = cv && cv.getContext && cv.getContext('2d');
    if (!ctx || !img) return;                         // plain photo stays visible
    const phone = () => window.matchMedia('(max-width: 820px)').matches;
    if (hint) hint.textContent = fine.matches ? 'hover' : 'drag your finger over';
    if (reduce) return;                               // reduced motion: just the normal colour photo

    const DARK = '#100d0b', LIGHT = '#f1ebe1';
    const BAYER = (() => {                            // 8 x 8 ordered-dither matrix, values 0..63
      let m = [[0, 2], [3, 1]];
      for (let n = 2; n < 8; n *= 2) {
        const o = Array.from({ length: n * 2 }, () => new Array(n * 2));
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const v = m[y][x] * 4;
          o[y][x] = v; o[y][x + n] = v + 2; o[y + n][x] = v + 3; o[y + n][x + n] = v + 1;
        }
        m = o;
      }
      return m;
    })();

    let W = 0, H = 0, dpr = 1, cell = 0, cols = 0, rows = 0, cpx = 0;
    let colorC, ditherC, reveal, thr, spd, showing, active = new Set();
    let raf = 0, last = 0, visible = false, ready = false, lastW = 0, sweep = null, seen = false;
    // Desktop: foto setinggi blok teks, dari atas "(Portrait)" sampai bawah hint
    const textBox = $('.veil__text', sec);
    const fit = () => {
    if (phone() || !textBox) { stage.style.width = ''; stage.style.height = ''; return; }
    const h = Math.round(textBox.getBoundingClientRect().height);
    stage.style.height = h + 'px'; stage.style.width = Math.round(h * .8) + 'px';
    };
    fit();

    const build = () => {
    fit();
      W = stage.clientWidth; H = stage.clientHeight;
      if (!W || !H || !img.naturalWidth) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cell = Math.max(5, Math.round(W / (phone() ? 56 : 78)));
      cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
      cpx = cell * dpr;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);

      // cover-fit source rectangle (keep the face near the top, like the CSS object-position)
      const iw = img.naturalWidth, ih = img.naturalHeight, ar = W / H;
      let sw = iw, sh = iw / ar;
      if (sh > ih) { sh = ih; sw = ih * ar; }
      const sx = (iw - sw) / 2, sy = Math.max(0, Math.min(ih - sh, (ih - sh) * .2));

      colorC = document.createElement('canvas'); colorC.width = cv.width; colorC.height = cv.height;
      colorC.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);

      const small = document.createElement('canvas'); small.width = cols; small.height = rows;
      const sctx = small.getContext('2d', { willReadFrequently: true });
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
      const px = sctx.getImageData(0, 0, cols, rows).data;

      ditherC = document.createElement('canvas'); ditherC.width = cv.width; ditherC.height = cv.height;
      const d = ditherC.getContext('2d');
      d.fillStyle = DARK; d.fillRect(0, 0, ditherC.width, ditherC.height);
      d.fillStyle = LIGHT;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        let l = (px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114) / 255;
        l = Math.min(1, Math.max(0, (l - .5) * 1.35 + .52));          // a bit more contrast so the face reads in 1-bit
        if (l > (BAYER[y & 7][x & 7] + .5) / 64) d.fillRect(Math.floor(x * cpx), Math.floor(y * cpx), Math.ceil(cpx), Math.ceil(cpx));
      }

      const n = cols * rows;
      reveal = new Float32Array(n); showing = new Uint8Array(n);
      thr = new Float32Array(n); spd = new Float32Array(n);
      for (let i = 0; i < n; i++) { thr[i] = .05 + Math.random() * .8; spd[i] = .28 + Math.random() * .6; }
      active.clear();
      ctx.drawImage(ditherC, 0, 0);
      lastW = W; ready = true;
      return true;
    };

    const paint = (i, color) => {
      const x = (i % cols) * cpx, y = Math.floor(i / cols) * cpx;
      const X = Math.floor(x), Y = Math.floor(y), w = Math.ceil(cpx), h = Math.ceil(cpx);
      ctx.drawImage(color ? colorC : ditherC, X, Y, w, h, X, Y, w, h);
    };

    const burn = (cx, cy, R) => {                     // cx, cy in cell units
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(cols - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(rows - 1, Math.ceil(cy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dd = Math.hypot(x + .5 - cx, y + .5 - cy);
        if (dd > R) continue;
        const v = 1.15 - (dd / R) * .55;
        const i = y * cols + x;
        if (v > reveal[i]) { reveal[i] = Math.min(1, v); active.add(i); }
      }
    };

    const frame = now => {
      raf = 0;
      if (!visible || !ready) return;
      const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
      if (sweep) {                                     // one automatic pass so visitors see what it does
        sweep.t += dt / 2.4;
        const t = sweep.t;
        if (t >= 1) sweep = null;
        else burn(cols * (.15 + .7 * t), rows * (.28 + .22 * Math.sin(t * Math.PI * 2.2) + .3 * t), Math.max(4, cols / 9));
      }
      active.forEach(i => {
        reveal[i] -= dt * spd[i];
        if (reveal[i] <= 0) { reveal[i] = 0; active.delete(i); if (showing[i]) { showing[i] = 0; paint(i, false); } return; }
        const want = reveal[i] > thr[i] ? 1 : 0;
        if (want !== showing[i]) { showing[i] = want; paint(i, want === 1); }
      });
      // newly burned cells above threshold show colour immediately
      if (active.size || sweep) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible && ready) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    // pointer: mouse hover, finger drag (vertical swipes still scroll the page)
    let prev = null;
    const toCell = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / cell, y: (e.clientY - r.top) / cell }; };
    const R = () => (phone() ? 5.5 : 7);
    const move = e => {
      if (!ready) return;
      const p = toCell(e);
      if (prev) {                                      // fill the gaps when the pointer moves fast
        const d = Math.hypot(p.x - prev.x, p.y - prev.y), n = Math.max(1, Math.ceil(d / 2));
        for (let k = 1; k <= n; k++) burn(prev.x + (p.x - prev.x) * k / n, prev.y + (p.y - prev.y) * k / n, R());
      } else burn(p.x, p.y, R());
      prev = p; kick();
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', e => { prev = null; move(e); });
    cv.addEventListener('pointerleave', () => { prev = null; });
    cv.addEventListener('pointerup', () => { prev = null; });
    cv.addEventListener('pointercancel', () => { prev = null; });
    const cursorEl = $('.cursor');
    if (cursorEl) {
      cv.addEventListener('mouseenter', () => cursorEl.classList.add('is-link'));
      cv.addEventListener('mouseleave', () => cursorEl.classList.remove('is-link'));
    }

    const start = () => {
      if (!build()) return;
      sec.classList.add('is-live');
    };
    const whenReady = () => {
      if (img.complete && img.naturalWidth) start();
      else img.addEventListener('load', start, { once: true });
    };
    whenReady();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        visible = es[0].isIntersecting;
        if (visible) { if (!ready) start(); if (ready && !seen) { seen = true; sweep = { t: 0 }; } kick(); }
      }, { threshold: .25 }).observe(stage);
    } else { visible = true; }

    let tid = 0;
    window.addEventListener('resize', () => {
      clearTimeout(tid);
      tid = setTimeout(() => { fit(); if (stage.clientWidth !== lastW) { build(); kick(); } }, 200);
    });
  });
})();