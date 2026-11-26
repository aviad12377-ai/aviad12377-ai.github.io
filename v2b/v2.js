/* Portal UX v2 shared runtime: tab bar, prefetch, page transitions, charts, sheets, data. No dependencies. */
(function () {
  'use strict';
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    piggy: '<path d="M19 9.5c.9.4 1.6 1.2 2 2.2M5 11a7 6 0 0 1 12.5-3.2L20 7l-.6 3.3A6 6 0 0 1 19 16l-1 4h-3l-.4-1.6a8 8 0 0 1-3.2 0L11 20H8l-.8-3A6 6 0 0 1 5 13H3v-2z"/><circle cx="15" cy="11" r=".8" fill="currentColor"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    back: '<path d="m9 6 6 6-6 6"/>'
  };
  function icon(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 24) + '" height="' + (size || 24) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  var TABS = [
    { id: 'home', href: 'index.html', label: 'בית', icon: 'home' },
    { id: 'savings', href: 'savings.html', label: 'חסכונות', icon: 'piggy' },
    { id: 'invest', href: 'invest.html', label: 'השקעות', icon: 'chart' },
    { id: 'compare', href: 'compare.html', label: 'השוואות', icon: 'swap' },
    { id: 'more', href: 'more.html', label: 'עוד', icon: 'more' }
  ];
  // depth: 0 = tab root, 1 = detail page (used for transition direction)
  var DEPTH = { 'index.html': 0, '': 0, 'savings.html': 0, 'invest.html': 0, 'compare.html': 0, 'more.html': 0, 'options.html': 0, 'fund.html': 1, 'news.html': 1 };
  function pageOf(url) { var p = new URL(url, location.href).pathname.split('/').pop(); return p; }
  function depthOf(url) { var p = pageOf(url); return p in DEPTH ? DEPTH[p] : 1; }
  function tabOf(url) {
    var p = pageOf(url);
    if (p === 'options.html') return 'invest';
    if (p === 'fund.html') return 'savings';
    if (p === 'news.html') return 'more';
    if (/^compare/.test(p)) return 'compare';
    var t = TABS.filter(function (x) { return x.href === p; })[0];
    return t ? t.id : (p === '' ? 'home' : null);
  }

  // ---------- tab bar ----------
  function mountTabbar() {
    if (document.querySelector('.tabbar')) return; // pages ship a static tab bar (no flash); this is a fallback
    var cur = document.body.getAttribute('data-tab') || 'home';
    var nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', 'ניווט ראשי');
    nav.innerHTML = '<a class="rail-brand" href="index.html" aria-hidden="true" tabindex="-1"><i></i>פורטל החיסכון</a>' + TABS.map(function (t) {
      return '<a href="' + t.href + '"' + (t.id === cur ? ' aria-current="page"' : '') + '>' + icon(t.icon) + '<span>' + t.label + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  }

  // ---------- prefetch fallback (browsers without speculation rules) ----------
  var prefetched = {};
  function prefetch(href) {
    if (!href || prefetched[href]) return;
    var u = new URL(href, location.href);
    if (u.origin !== location.origin || u.pathname === location.pathname) return;
    prefetched[href] = 1;
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = u.href; document.head.appendChild(l);
  }
  var hasSpec = HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules');
  function onIntent(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (!hasSpec || e.type === 'touchstart') prefetch(a.getAttribute('href'));
    if (e.type !== 'mouseover') { a.classList.add('is-pressed'); setTimeout(function () { a.classList.remove('is-pressed'); }, 300); }
  }

  // ---------- transitions direction ----------
  function setTypes(vt, fromUrl, toUrl) {
    if (!vt || !vt.types) return;
    var a = depthOf(fromUrl), b = depthOf(toUrl);
    if (b === a && tabOf(fromUrl) !== tabOf(toUrl)) vt.types.add('tab');
    else if (b < a) vt.types.add('back');
    else vt.types.add('forward');
  }
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    setTypes(e.viewTransition, navigation.activation.from.url, navigation.activation.entry.url);
  });
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    setTypes(e.viewTransition, location.href, e.activation.entry.url);
  });

  // ---------- app bar shadow on scroll (no scroll listener) ----------
  function watchScroll() {
    var bar = document.querySelector('.appbar'); if (!bar || !('IntersectionObserver' in window)) return;
    var s = document.createElement('div'); s.style.cssText = 'position:absolute;top:0;height:8px;width:1px;pointer-events:none';
    document.body.prepend(s);
    new IntersectionObserver(function (en) { bar.classList.toggle('is-scrolled', !en[0].isIntersecting); }).observe(s);
  }

  // ---------- formatting ----------
  var nf0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  function ils(v, dec) { if (v == null || isNaN(v)) return '—'; var s = (v < 0 ? '−' : '') + '₪' + (dec ? nf2 : nf0).format(Math.abs(v)); return '<span class="num">' + s + '</span>'; }
  function pct(v, signed) { if (v == null || isNaN(v)) return '—'; var s = (signed && v > 0 ? '+' : v < 0 ? '−' : '') + nf2.format(Math.abs(v)) + '%'; return '<span class="num">' + s + '</span>'; }
  function num(v, dec) { if (v == null || isNaN(v)) return '—'; return '<span class="num">' + (dec ? nf2 : nf0).format(v) + '</span>'; }
  function cls(v) { return v > 0 ? 'up' : v < 0 ? 'down' : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var HM = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  function period(p) { p = String(p); return HM[+p.slice(4, 6) - 1] + ' ' + p.slice(0, 4); }
  function when(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var now = new Date(), t = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    var dd = d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }), nd = now.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    if (dd === nd) return 'היום ' + t;
    var y = new Date(now - 864e5).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    if (dd === y) return 'אתמול ' + t;
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' }) + ' ' + t;
  }

  // ---------- data ----------
  var cache = {};
  function data(url) { if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); return cache[url]; }

  // ---------- seeded demo series ----------
  function series(seed, n, start, drift, vol) {
    var x = seed, out = [], v = start;
    function rnd() { x = (x * 9301 + 49297) % 233280; return x / 233280; }
    for (var i = 0; i < n; i++) { v = v * (1 + drift + (rnd() - 0.5) * vol); out.push(v); }
    return out;
  }

  // ---------- chart with scrub ----------
  function chart(el, values, opt) {
    opt = opt || {};
    var n = values.length; if (n < 2) { el.innerHTML = ''; return; }
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values), pad = (max - min) * 0.12 || 1;
    min -= pad; max += pad;
    var up = values[n - 1] >= values[0], color = opt.color || (up ? 'var(--gain)' : 'var(--loss)');
    var id = 'g' + Math.random().toString(36).slice(2, 7);
    function X(i) { return (i / (n - 1)) * 100; } // time flows left → right, as in every finance chart (also in Hebrew apps)
    function Y(v) { return 100 - ((v - min) / (max - min)) * 100; }
    var d = values.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(v).toFixed(2); }).join('');
    el.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="' + esc(opt.label || 'גרף') + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".22"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + d + 'L100 100L0 100Z" fill="url(#' + id + ')"/><path class="ln" d="' + d + '" stroke="' + color + '"/>' +
      '<line class="cursor" x1="0" x2="0" y1="0" y2="100"/></svg><span class="dot"></span><span class="chart-tip"></span>';
    if (opt.noScrub) return;
    var svg = el.querySelector('svg'), cur = el.querySelector('.cursor'), dot = el.querySelector('.dot'), tip = el.querySelector('.chart-tip');
    function at(clientX) {
      var r = el.getBoundingClientRect(), fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      var i = Math.round(fx * (n - 1)), xp = X(i);
      cur.setAttribute('x1', xp); cur.setAttribute('x2', xp);
      var px = (xp / 100) * r.width, py = (Y(values[i]) / 100) * r.height;
      dot.style.transform = 'translate(' + px + 'px,' + py + 'px) translate(-50%,-50%)';
      tip.style.left = Math.min(r.width - 40, Math.max(40, px)) + 'px';
      tip.textContent = opt.tip ? opt.tip(i) : '';
      el.classList.add('scrub');
      if (opt.onScrub) opt.onScrub(i);
    }
    function end() { el.classList.remove('scrub'); if (opt.onScrub) opt.onScrub(null); }
    el.addEventListener('pointerdown', function (e) { at(e.clientX); });
    el.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || el.classList.contains('scrub')) at(e.clientX); });
    el.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') end(); });
    el.addEventListener('pointerleave', end);
    el.addEventListener('pointercancel', end);
  }

  // ---------- sheet ----------
  function sheet(id) {
    var d = document.getElementById(id); if (!d) return;
    if (!d._wired) {
      d._wired = 1;
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
      d.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
      // drag down to close
      var grip = d.querySelector('.sheet-grip'), y0 = null;
      if (grip) {
        grip.style.touchAction = 'none'; grip.style.cursor = 'grab'; grip.style.padding = '8px 0'; grip.style.backgroundClip = 'content-box';
        grip.addEventListener('pointerdown', function (e) { y0 = e.clientY; d.style.transition = 'none'; grip.setPointerCapture(e.pointerId); });
        grip.addEventListener('pointermove', function (e) { if (y0 == null) return; var dy = Math.max(0, e.clientY - y0); d.style.transform = 'translateY(' + dy + 'px)'; });
        grip.addEventListener('pointerup', function (e) { var dy = e.clientY - y0; y0 = null; d.style.transition = ''; d.style.transform = ''; if (dy > 80) d.close(); });
      }
    }
    d.showModal();
    var f = d.querySelector('input,select,button.btn-primary'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 50);
    return d;
  }

  // ---------- stepper ----------
  function wireSteppers(root) {
    (root || document).querySelectorAll('.stepper').forEach(function (s) {
      if (s._w) return; s._w = 1;
      var inp = s.querySelector('input'), step = +s.getAttribute('data-step') || 1, min = +(s.getAttribute('data-min') || 0);
      function bump(k) { var v = (parseFloat(String(inp.value).replace(/[^\d.\-]/g, '')) || 0) + k * step; v = Math.max(min, Math.round(v / step) * step); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      s.querySelectorAll('button').forEach(function (b) {
        var k = b.getAttribute('data-k') === '+' ? 1 : -1, t, iv;
        b.addEventListener('pointerdown', function () { bump(k); t = setTimeout(function () { iv = setInterval(function () { bump(k); }, 70); }, 400); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(t); clearInterval(iv); }); });
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bump(k); } });
      });
    });
  }

  // ---------- toast ----------
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
  }

  // ---------- seg/chips helpers ----------
  function chips(container, onChange) {
    container.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      container.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
      onChange(b.getAttribute('data-v'));
    });
  }
  function swap(el, html) {
    // replace skeleton with content; same box size means no layout shift
    el.innerHTML = html; el.classList.remove('sk'); el.classList.add('fade-in');
  }

  // ---------- demo profile (clearly labeled 'נתוני הדגמה' in UI; not anyone's real data) ----------
  var DEMO = {
    funds: [
      { set: 'pensianet', id: 2009, kind: 'pension', label: 'פנסיה', balance: 412300, monthly: 3150 },
      { set: 'gemelnet', id: 880, kind: 'hishtalmut', label: 'השתלמות', balance: 138900, monthly: 1580 },
      { set: 'gemelnet', id: 13250, kind: 'gemel', label: 'גמל להשקעה', balance: 54200, monthly: 500 }
    ],
    holdings: [
      { sym: 'SPY', name: 'קרן סל S&P 500', qty: 40 },
      { sym: 'QQQ', name: 'קרן סל נאסד״ק 100', qty: 20 },
      { sym: 'AAPL', name: 'אפל', qty: 30 },
      { sym: '1143700', name: 'קרן סל ישראלית (דוגמה)', qty: 900 }
    ],
    standing: { amount: 1500, day: 10, split: [{ sym: 'SPY', pct: 60 }, { sym: '1143700', pct: 40 }] },
    options: { sym: 'ESLT.TA', qty: 600, strikeRatio: 0.72 }
  };
  function fx(q, cur) { if (cur === 'ILS') return 1; var r = q['ILS=X']; return r ? r.price : 3.3; }
  function holdingsValue(quotes) {
    var tot = 0, prev = 0, rows = DEMO.holdings.map(function (h) {
      var q = quotes[h.sym] || {}, rate = fx(quotes, q.currency), v = (q.price || 0) * h.qty * rate;
      var pv = q.previousClose ? q.previousClose * h.qty * rate : v;
      tot += v; prev += pv;
      return { h: h, q: q, value: v, dayPct: q.previousClose ? (q.price / q.previousClose - 1) * 100 : null };
    });
    return { rows: rows, total: tot, dayPct: prev ? (tot / prev - 1) * 100 : 0 };
  }
  function optionsValue(quotes, o) {
    o = o || DEMO.options; var q = quotes[o.sym] || {}, price = q.price || 0, strike = o.strike != null ? o.strike : Math.round(price * o.strikeRatio * 100) / 100;
    var gross = Math.max(0, price - strike) * o.qty, tax = gross * ((o.taxPct != null ? o.taxPct : 25) / 100);
    return { price: price, strike: strike, gross: gross, tax: tax, net: gross - tax, shares: price ? (gross - tax) / price : 0 };
  }

  window.V2 = { icon: icon, ils: ils, pct: pct, num: num, cls: cls, esc: esc, period: period, when: when, data: data, series: series, chart: chart, sheet: sheet, toast: toast, chips: chips, swap: swap, wireSteppers: wireSteppers, prefetch: prefetch, DEMO: DEMO, holdingsValue: holdingsValue, optionsValue: optionsValue };

  function init() {
    mountTabbar(); watchScroll(); wireSteppers();
    document.addEventListener('touchstart', onIntent, { passive: true });
    document.addEventListener('pointerdown', onIntent, { passive: true });
    document.addEventListener('mouseover', onIntent, { passive: true });
    document.dispatchEvent(new Event('v2:ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
