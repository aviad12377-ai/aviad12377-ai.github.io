/* v2 prototype — standalone SPA. Personal numbers are DEMO values (labeled). Public data from ../data/*.json, ../funds.json, ../prices.json */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var NF0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
  var NF2 = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function n(v, d) { return '<span class="num">' + (d ? NF2 : NF0).format(v) + '</span>'; }
  function ils(v, d) { var neg = v < 0; return '<span class="num">' + (neg ? '−' : '') + '₪' + (d ? NF2 : NF0).format(Math.abs(v)) + '</span>'; }
  function pct(v, sign) { var s = (sign && v > 0 ? '+' : '') + (v < 0 ? '−' : '') + NF2.format(Math.abs(v)) + '%'; return '<span class="num">' + s + '</span>'; }
  function cls(v) { return v > 0 ? 'gain' : v < 0 ? 'loss' : 'muted'; }
  function arrow(v) { return v > 0 ? '▲' : v < 0 ? '▼' : ''; }
  var DEMO = '<span class="badge demo" title="מספרים לדוגמה בלבד. אחרי התחברות יוצגו הנתונים שלך">נתוני דוגמה</span>';

  /* ---------- icons ---------- */
  var IC = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    piggy: 'M19 9.5c1 .6 2 1.6 2 3.5v2h-2l-1 3h-3l-.5-1.5h-4L10 18.5H7l-1-3c-1.6-1-3-2.6-3-5 0-3.5 3.5-6 8-6 1.4 0 2.7.2 3.8.6L18 4v4zM15.5 10h.01',
    chart: 'M4 19h16M6 15l4-4 3 3 5-6M18 8h-3M18 8v3',
    swap: 'M7 7h13l-3-3M17 17H4l3 3',
    news: 'M5 4h11v16H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM16 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3',
    back: 'M9 6l6 6-6 6',
    chev: 'M15 6l-6 6 6 6',
    plus: 'M12 5v14M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    umbrella: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 1-4 0',
    grad: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
    bank: 'M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
    key: 'M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM13 12l8 8M17 16l2-2M19 18l2-2',
    house: 'M4 11l8-6 8 6M6 10v10h12V10M10 20v-5h4v5',
    repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    calc: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h6',
    chat: 'M4 5h16v11H8l-4 4z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    radar: 'M12 12l6-6M12 21a9 9 0 1 1 9-9M12 17a5 5 0 1 1 5-5',
    close: 'M6 6l12 12M18 6L6 18',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01'
  };
  function ic(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[k] + '"/></svg>'; }

  /* ---------- demo personal data (NOT real) ---------- */
  var TODAY = new Date();
  var D = {
    accounts: [
      { id: 'pension', group: 'pension', name: 'קרן פנסיה מקיפה', sub: 'מסלול לבני 50 ומטה', bal: 412800, m: 0.9, fee: '0.22% מצבירה · 1.5% מהפקדה', color: 'var(--c1)', ic: 'umbrella' },
      { id: 'hish', group: 'hishtalmut', name: 'קרן השתלמות', sub: 'מסלול כללי', bal: 138400, m: 1.4, fee: '0.70% מצבירה', color: 'var(--c2)', ic: 'grad', flag: true },
      { id: 'gemel', group: 'gemel', name: 'קופת גמל להשקעה', sub: 'מסלול S&P 500', bal: 46250, m: 2.1, fee: '0.55% מצבירה', color: 'var(--c3)', ic: 'piggy' },
      { id: 'dep', group: 'deposits', name: 'פיקדון וקרן כספית', sub: 'נזיל · ריבית משתנה', bal: 60000, m: 0.3, fee: 'ללא דמי ניהול', color: 'var(--c5)', ic: 'bank' }
    ],
    holdings: [ { sym: 'SPY', name: 'S&P 500 (SPY)', qty: 40, cost: 520 }, { sym: 'QQQ', name: 'נאסד״ק 100 (QQQ)', qty: 25, cost: 470 }, { sym: 'MSFT', name: 'מיקרוסופט', qty: 30, cost: 400 } ],
    fallbackPx: { SPY: 716.7, QQQ: 633.93, MSFT: 480, 'ILS=X': 3.32 },
    options: { company: 'מניית המעסיק (דוגמה)', price: 65.0, strike: 50.0, tranches: [ { n: 1200, vest: '2026-06-01', exp: '2029-06-01' }, { n: 550, vest: '2027-06-01', exp: '2030-06-01' }, { n: 550, vest: '2028-06-01', exp: '2031-06-01' } ] },
    realEstate: { name: 'נדל״ן (דוגמה)', val: 650000 },
    debts: 121000,
    standing: { amt: 1000, day: 10, split: [ ['SPY', 70], ['QQQ', 30] ] },
    goals: [ { name: 'קרן חירום', cur: 60000, tgt: 75000 }, { name: 'דירה לילדים', cur: 46250, tgt: 250000 } ]
  };
  var PX = null; // prices.json quotes
  function px(sym) { var q = PX && PX[sym]; return q && q.price ? q.price : D.fallbackPx[sym]; }
  function usd() { return px('ILS=X'); }
  function portfolioVal() { return D.holdings.reduce(function (s, h) { return s + h.qty * px(h.sym) * usd(); }, 0); }
  function portfolioCost() { return D.holdings.reduce(function (s, h) { return s + h.qty * h.cost * D.fallbackPx['ILS=X']; }, 0); }
  function optVested() { var o = D.options; return o.tranches.filter(function (t) { return new Date(t.vest) <= TODAY; }).reduce(function (s, t) { return s + t.n; }, 0); }
  function optIntrinsic(all) { var o = D.options, k = Math.max(0, o.price - o.strike); return k * (all ? o.tranches.reduce(function (s, t) { return s + t.n; }, 0) : optVested()); }
  function optTotal() { return D.options.tranches.reduce(function (s, t) { return s + t.n; }, 0); }
  function savingsTotal() { return D.accounts.reduce(function (s, a) { return s + a.bal; }, 0); }
  function netWorth() { return savingsTotal() + portfolioVal() + optIntrinsic(false) + D.realEstate.val - D.debts; }
  // deterministic 36-month series ending at current net worth
  function series(end) {
    var pts = [], v = end * 0.71, seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 36; i++) { v *= 1 + (0.0105 + (rnd() - 0.47) * 0.035); pts.push(v); }
    var k = end / pts[pts.length - 1]; return pts.map(function (p) { return p * k; });
  }
  function monthLabel(i, len) { var d = new Date(TODAY.getFullYear(), TODAY.getMonth() - (len - 1 - i), 1); return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }); }

  /* ---------- data loading ---------- */
  var cache = {};
  function load(url) { if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); return cache[url]; }
  function loadPrices() { return load('../prices.json').then(function (j) { PX = j.quotes || {}; return PX; }); }
  function rel(t) {
    var d = new Date(t), m = Math.round((Date.now() - d) / 60000);
    if (isNaN(m)) return ''; if (m < 1) return 'עכשיו'; if (m < 60) return 'לפני ' + m + ' דק׳';
    var h = Math.round(m / 60); if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) + ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- shell ---------- */
  var TABS = [
    { id: 'home', href: '#/', label: 'בית', ic: 'home' },
    { id: 'savings', href: '#/savings', label: 'חסכונות', ic: 'piggy' },
    { id: 'invest', href: '#/invest', label: 'השקעות', ic: 'chart' },
    { id: 'compare', href: '#/compare', label: 'השוואות', ic: 'swap' },
    { id: 'news', href: '#/news', label: 'חדשות', ic: 'news' }
  ];
  function drawTabs(active) {
    $('#tabbar').innerHTML = '<div class="brand"><i></i>הכסף שלי</div>' + TABS.map(function (t) {
      return '<a class="tab" href="' + t.href + '"' + (t.id === active ? ' aria-current="page"' : '') + '>' + ic(t.ic) + '<span>' + t.label + '</span></a>';
    }).join('');
  }
  function drawBar(title, back) {
    $('#appbar').innerHTML = (back ? '<button class="iconbtn" data-back aria-label="חזרה">' + ic('back') + '</button>' : '') +
      '<h1 id="page-title">' + esc(title) + '</h1>' +
      '<a class="iconbtn" href="#/news/alerts" aria-label="התראות">' + ic('bell') + '</a>' +
      '<a class="iconbtn" href="#/me" aria-label="האזור האישי"><span class="avatar" aria-hidden="true">א</span></a>';
  }
  addEventListener('scroll', function () { $('#appbar').classList.toggle('scrolled', scrollY > 4); }, { passive: true });

  /* ---------- router ---------- */
  var routes = [];
  function route(re, tab, fn) { routes.push({ re: re, tab: tab, fn: fn }); }
  var hist = [], scrollMem = {};
  function current() { return location.hash.replace(/^#/, '') || '/'; }
  function depth(p) { return p.split('?')[0].split('/').filter(Boolean).length; }
  var lastPath = null;
  function render(path) {
    var p = path.split('?')[0], q = new URLSearchParams(path.split('?')[1] || '');
    for (var i = 0; i < routes.length; i++) {
      var m = p.match(routes[i].re);
      if (m) { drawTabs(routes[i].tab); routes[i].fn(m, q); return; }
    }
    location.replace('#/');
  }
  function go() {
    var path = current(), prev = lastPath;
    if (prev != null) scrollMem[prev] = scrollY;
    var kind = 'tab';
    if (prev != null) { var a = depth(prev), b = depth(path); var tabOf = function (x) { return x.split('/')[1] || ''; };
      if (tabOf(prev) === tabOf(path) || b > 1 || a > 1) kind = b > a ? 'fwd' : b < a ? 'back' : 'tab'; }
    document.documentElement.dataset.nav = kind;
    var swap = function () { render(path); window.scrollTo(0, kind === 'back' && scrollMem[path] ? scrollMem[path] : 0); };
    lastPath = path;
    if (prev != null && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var vt = document.startViewTransition(swap); vt.finished.then(focusTitle, focusTitle);
    } else { swap(); if (prev != null) focusTitle(); }
  }
  function focusTitle() { var h = $('#main'); if (h) h.focus({ preventScroll: true }); }
  addEventListener('hashchange', go);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-back]'); if (b) { e.preventDefault(); if (history.length > 1 && hist.length) history.back(); else location.hash = '#/' + (current().split('/')[1] || ''); }
  });
  addEventListener('hashchange', function () { hist.push(1); });
  var main = function () { return $('#main'); };

  /* ---------- chart ---------- */
  function chart(el, data, opts) {
    opts = opts || {};
    var W = 600, H = 168, pad = 8, min = Math.min.apply(null, data), max = Math.max.apply(null, data), r = (max - min) || 1;
    var X = function (i) { return W - (i / (data.length - 1)) * W; }; // RTL: time flows right→left? keep LTR time for charts
    X = function (i) { return (i / (data.length - 1)) * W; };
    var Y = function (v) { return pad + (H - 2 * pad) * (1 - (v - min) / r); };
    var d = data.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    var area = d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    var first = !el.querySelector('svg');
    if (first) {
      el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(opts.label || 'גרף') + '"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--chart)" stop-opacity=".22"/><stop offset="1" stop-color="var(--chart)" stop-opacity="0"/></linearGradient></defs>' +
        '<line class="base" x1="0" x2="' + W + '" y1="' + Y(data[0]) + '" y2="' + Y(data[0]) + '" vector-effect="non-scaling-stroke"/><path class="area"/><path class="line" vector-effect="non-scaling-stroke"/><line class="cursor" y1="0" y2="' + H + '" vector-effect="non-scaling-stroke"/></svg><div class="dotw" style="position:absolute;inset:0;pointer-events:none"><svg width="100%" height="100%" style="overflow:visible;position:absolute;inset:0"><circle class="dot" r="6"/></svg></div>';
    }
    var line = el.querySelector('.line'), ar = el.querySelector('.area'), base = el.querySelector('.base');
    line.setAttribute('d', d); ar.setAttribute('d', area); base.setAttribute('y1', Y(data[0])); base.setAttribute('y2', Y(data[0]));
    if (first && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var len = line.getTotalLength ? line.getTotalLength() : 1200; line.style.setProperty('--len', len * 1.2); line.classList.add('draw');
      setTimeout(function () { line.classList.remove('draw'); }, 800);
    }
    el._data = data; el._X = X; el._Y = Y; el._W = W; el._H = H;
    if (!el._bound) {
      el._bound = true;
      var cur = el.querySelector('.cursor'), dot = el.querySelector('.dot');
      var move = function (ev) {
        var rc = el.getBoundingClientRect(), x = (ev.clientX - rc.left) / rc.width, dd = el._data;
        var i = Math.max(0, Math.min(dd.length - 1, Math.round(x * (dd.length - 1))));
        var sx = el._X(i) / el._W * rc.width, sy = el._Y(dd[i]) / el._H * rc.height;
        cur.setAttribute('x1', el._X(i)); cur.setAttribute('x2', el._X(i)); dot.setAttribute('cx', sx); dot.setAttribute('cy', sy);
        el.classList.add('scrub'); if (opts.onScrub) opts.onScrub(i);
      };
      var end = function () { el.classList.remove('scrub'); if (opts.onScrub) opts.onScrub(-1); };
      el.addEventListener('pointerdown', function (e) { el.setPointerCapture && el.setPointerCapture(e.pointerId); move(e); });
      el.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || el.classList.contains('scrub')) move(e); });
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
    }
  }

  function segmented(el, onChange) {
    var btns = $$('button', el), ind = document.createElement('i'); ind.className = 'ind'; el.appendChild(ind);
    function place(b) { ind.style.width = b.offsetWidth + 'px'; ind.style.insetInlineStart = (el.offsetWidth - b.offsetLeft - b.offsetWidth) + 'px'; }
    btns.forEach(function (b) { b.addEventListener('click', function () { btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); place(b); onChange(b.dataset.v); }); });
    var on = btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || btns[0];
    requestAnimationFrame(function () { ind.style.transition = 'none'; place(on); requestAnimationFrame(function () { ind.style.transition = ''; }); });
    addEventListener('resize', function () { var o = btns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0]; if (o && el.isConnected) place(o); });
  }

  /* ---------- sheet & toast ---------- */
  var lastFocus = null;
  function openSheet(html) {
    var w = $('#sheet'); lastFocus = document.activeElement; $('#sheet-body').innerHTML = html; w.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('open'); var f = $('#sheet-body button, #sheet-body a, #sheet-body input'); if (f) f.focus({ preventScroll: true }); }); });
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    var w = $('#sheet'); if (w.hidden) return; w.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(function () { w.hidden = true; }, 300); if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $('#sheet').addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  (function () { // swipe down to close
    var s = $('.sheet'), y0 = null, dy = 0;
    s.addEventListener('touchstart', function (e) { if (s.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    s.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); s.style.transition = 'none'; s.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    s.addEventListener('touchend', function () { s.style.transition = ''; s.style.transform = ''; if (dy > 90) closeSheet(); y0 = null; });
  })();
  var tt; function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { el.classList.remove('on'); }, 2600); }

  /* ================= SCREENS ================= */

  /* --- HOME --- */
  route(/^\/$/, 'home', function () {
    var hr = new Date().getHours(); drawBar((hr < 5 ? 'לילה טוב' : hr < 12 ? 'בוקר טוב' : hr < 18 ? 'צהריים טובים' : 'ערב טוב') + ', אביעד');
    var nw = netWorth(), s = series(nw);
    var nextT = D.options.tranches.filter(function (t) { return new Date(t.vest) > TODAY; })[0];
    var days = nextT ? Math.ceil((new Date(nextT.vest) - TODAY) / 864e5) : 0;
    main().innerHTML =
      '<div class="grid2"><div class="stack">' +
      '<section class="hero" aria-labelledby="nw-l"><div class="lbl" id="nw-l">שווי נקי ' + DEMO + '</div>' +
      '<div class="big" id="nw">' + ils(nw) + '</div><div class="chg" id="nwchg"></div>' +
      '<div class="chart" id="nwc"></div>' +
      '<div class="periods" role="group" aria-label="תקופה">' + [['1', 'חודש'], ['6', '6 חודשים'], ['12', 'שנה'], ['36', '3 שנים']].map(function (p, i) { return '<button class="chip" data-p="' + p[0] + '" aria-pressed="' + (i === 2) + '">' + p[1] + '</button>'; }).join('') + '</div></section>' +
      '<section class="card" aria-labelledby="al-h"><div class="card-h"><h2 id="al-h">איפה הכסף שלך</h2><a class="more" href="#/savings">הכול ‹</a></div>' + allocBlock() + '</section>' +
      '</div><div class="stack">' +
      '<section class="card" aria-labelledby="st-h"><div class="card-h"><h2 id="st-h">הצעדים הבאים</h2>' + DEMO + '</div>' +
        step('1', 'var(--loss-soft)', 'var(--loss)', 'דמי הניהול בהשתלמות גבוהים', 'משלם 0.70% מצבירה. הממוצע בשוק נמוך יותר. בדוק חלופות ב־2 דקות.', '#/compare/funds?type=hishtalmut') +
        step('2', 'var(--primary-soft)', 'var(--primary)', 'מנת אופציות מבשילה בעוד ' + n(days) + ' ימים', n(nextT ? nextT.n : 0) + ' אופציות נוספות יהיו ניתנות למימוש.', '#/invest/options') +
        step('3', 'var(--gain-soft)', 'var(--gain)', 'קרן החירום כמעט מלאה', 'חסרים ' + ils(15000) + ' ליעד. הוראת הקבע תשלים אותו בעוד כ־15 חודשים.', '#/savings') +
      '</section>' +
      '<section aria-labelledby="br-h"><h2 class="sec" id="br-h">הסקירה האחרונה של הדסק</h2><div id="brief"><div class="card"><div class="skel h"></div><div class="skel l"></div><div class="skel l" style="width:80%"></div></div></div></section>' +
      '<section aria-labelledby="mk-h"><h2 class="sec" id="mk-h">שווקים</h2><div class="mkts" id="mkts">' + Array(4).join('<div class="mkt"><div class="skel l" style="width:60%"></div><div class="skel h"></div></div>') + '</div></section>' +
      '</div></div>';
    var cur = 12;
    function setP(p) {
      cur = +p; var data = s.slice(-(cur + 1)), d0 = data[0], d1 = data[data.length - 1], ch = d1 - d0;
      $('#nwchg').innerHTML = '<span class="' + cls(ch) + '">' + arrow(ch) + ' ' + ils(ch) + ' (' + pct(ch / d0 * 100, true) + ')</span> <span class="muted">' + { 1: 'בחודש האחרון', 6: 'בחצי שנה', 12: 'בשנה האחרונה', 36: 'ב־3 שנים' }[cur] + '</span>';
      chart($('#nwc'), data, { label: 'שווי נקי לאורך זמן', onScrub: function (i) {
        if (i < 0) { $('#nw').innerHTML = ils(nw); setP(cur); return; }
        $('#nw').innerHTML = ils(data[i]); $('#nwchg').innerHTML = '<span class="muted">' + monthLabel(36 - data.length + i, 36) + '</span>';
      } });
    }
    setP(12);
    $$('.periods .chip').forEach(function (b) { b.addEventListener('click', function () { $$('.periods .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); setP(b.dataset.p); }); });
    load('../data/news.json').then(function (j) {
      var d = (j.items || []).filter(function (i) { return i.kind === 'digest'; })[0]; if (!d) return;
      $('#brief').innerHTML = '<a class="card cardlink brief fadein" href="#/news/' + encodeURIComponent(d.id) + '"><div class="ed"><span class="badge pri">' + esc(d.edition || 'סקירה') + '</span><span class="muted" style="font-size:14px">' + rel(d.time) + '</span></div><h3>' + esc(d.title) + '</h3><p>' + esc(d.summary) + '</p></a>';
    }).catch(function () { $('#brief').innerHTML = '<div class="card empty"><b>הסקירה לא נטענה</b>נסה לרענן בעוד רגע.</div>'; });
    loadPrices().then(drawMkts, drawMkts);
  });
  function step(nm, bg, fg, t, s, href) { return '<a class="step" href="' + href + '"><span class="dot" style="background:' + bg + ';color:' + fg + '">' + nm + '</span><span><span class="t">' + t + '</span><span class="s">' + s + '</span></span></a>'; }
  function allocBlock() {
    var parts = [['חסכונות פנסיוניים', D.accounts[0].bal + D.accounts[1].bal + D.accounts[2].bal, 'var(--c1)'], ['תיק השקעות', portfolioVal(), 'var(--c2)'], ['אופציות (הבשילו)', optIntrinsic(false), 'var(--c3)'], ['נדל״ן', D.realEstate.val, 'var(--c4)'], ['נזיל', D.accounts[3].bal, 'var(--c5)']];
    var tot = parts.reduce(function (s, p) { return s + p[1]; }, 0);
    return '<div class="alloc" role="img" aria-label="חלוקת נכסים">' + parts.map(function (p, i) { return '<i style="width:' + (p[1] / tot * 100).toFixed(1) + '%;background:' + p[2] + ';animation-delay:' + i * 60 + 'ms"></i>'; }).join('') + '</div>' +
      '<div class="legend">' + parts.map(function (p) { return '<span><i style="background:' + p[2] + '"></i>' + p[0] + ' <span class="num">' + Math.round(p[1] / tot * 100) + '%</span>' + '</span>'; }).join('') + '</div>';
  }
  function drawMkts() {
    var el = $('#mkts'); if (!el) return;
    var list = [['S&P 500', 'SPY', '$'], ['נאסד״ק 100', 'QQQ', '$'], ['דולר/שקל', 'ILS=X', '₪'], ['אירו/שקל', 'EURILS=X', '₪'], ['ביטקוין', 'BTC-USD', '$']];
    el.innerHTML = list.map(function (m) {
      var q = PX && PX[m[1]]; if (!q || !q.price) return '';
      var ch = q.previousClose ? (q.price / q.previousClose - 1) * 100 : null;
      return '<div class="mkt fadein"><div class="n">' + m[0] + '</div><div class="p"><span class="num">' + (m[2] === '$' ? '$' : '₪') + (q.price > 1000 ? NF0.format(q.price) : NF2.format(q.price)) + '</span></div>' +
        (ch == null ? '<div class="c muted">—</div>' : '<div class="c ' + cls(ch) + '">' + arrow(ch) + ' ' + pct(ch, true) + '</div>') + '</div>';
    }).join('') || '<div class="muted">אין נתוני שוק כרגע.</div>';
  }

  /* --- SAVINGS --- */
  route(/^\/savings$/, 'savings', function () {
    drawBar('חסכונות');
    var tot = savingsTotal(), mgain = D.accounts.reduce(function (s, a) { return s + a.bal * a.m / 100; }, 0);
    main().innerHTML =
      '<section class="hero"><div class="lbl">כל החסכונות ' + DEMO + '</div><div class="big">' + ils(tot) + '</div><div class="chg"><span class="gain">▲ ' + ils(mgain) + '</span> <span class="muted">החודש</span></div></section>' +
      '<section class="card" style="margin-top:12px"><div class="alloc" role="img" aria-label="חלוקת החסכונות">' + D.accounts.map(function (a, i) { return '<i style="width:' + (a.bal / tot * 100).toFixed(1) + '%;background:' + a.color + ';animation-delay:' + i * 60 + 'ms"></i>'; }).join('') + '</div>' +
      '<div class="list">' + D.accounts.map(function (a) {
        return '<button class="row" data-acc="' + a.id + '"><span class="ic" style="background:color-mix(in srgb,' + a.color + ' 15%,transparent);color:' + a.color + '">' + ic(a.ic) + '</span><span class="tx"><span class="t">' + a.name + '</span><span class="s">' + a.sub + (a.flag ? ' · <b class="loss">דמי ניהול גבוהים</b>' : '') + '</span></span><span class="v"><b>' + ils(a.bal) + '</b><small class="' + cls(a.m) + '">' + pct(a.m, true) + '</small></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</button>';
      }).join('') + '</div></section>' +
      '<h2 class="sec">יעדים</h2><section class="card">' + D.goals.map(function (g) { var p = Math.min(100, g.cur / g.tgt * 100); return '<div style="padding:6px 0"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + g.name + '</b><span class="muted">' + ils(g.cur) + ' מתוך ' + ils(g.tgt) + '</span></div><div class="prog" aria-label="' + Math.round(p) + ' אחוז"><i style="width:' + p + '%"></i></div></div>'; }).join('') + '</section>' +
      '<h2 class="sec">כלים</h2><div class="tiles">' +
        tile('#/compare/funds?type=pension', 'השוואת קרנות', 'מצא מסלול זול יותר') +
        tile('../retirement.html', 'תחזית פנסיה', 'כמה תקבל בפרישה') +
        tile('../goals.html', 'יעדים', 'הוסף או ערוך יעד') +
        tile('../cashflow.html', 'תחזית ל־12 חודשים', 'כמה יישאר לחיסכון') + '</div>';
    $$('[data-acc]').forEach(function (b) { b.addEventListener('click', function () { accSheet(D.accounts.filter(function (a) { return a.id === b.dataset.acc; })[0]); }); });
  });
  function tile(href, k, d) { return '<a class="tile" href="' + href + '"><span class="k">' + k + '</span><span class="d muted" style="font-weight:500">' + d + '</span></a>'; }
  function accSheet(a) {
    var type = a.group === 'pension' ? 'pension' : a.group === 'gemel' ? 'gemel' : 'hishtalmut';
    openSheet('<h2 id="sheet-title">' + a.name + '</h2><div class="muted">' + a.sub + ' ' + DEMO + '</div>' +
      '<div class="kv"><div><span>יתרה</span><b>' + ils(a.bal) + '</b></div><div><span>החודש</span><b class="' + cls(a.m) + '">' + pct(a.m, true) + '</b></div><div style="grid-column:1/-1"><span>דמי ניהול</span><b style="font-size:16px">' + a.fee + '</b></div></div>' +
      (a.group !== 'deposits' ? '<a class="btn pri block" href="#/compare/funds?type=' + type + '" data-close>השווה למסלולים אחרים</a>' : '<a class="btn pri block" href="../compare-savings.html">השווה ריביות פיקדונות</a>') +
      '<button class="btn sec block" style="margin-top:8px" data-close>סגור</button>');
  }

  /* --- INVEST --- */
  route(/^\/invest$/, 'invest', function () {
    drawBar('השקעות');
    main().innerHTML = '<div id="inv"></div>';
    function draw() {
      var pv = portfolioVal(), pc = portfolioCost(), g = pv - pc, oi = optIntrinsic(false), oa = optIntrinsic(true);
      $('#inv').innerHTML =
        '<section class="hero"><div class="lbl">תיק ההשקעות ' + DEMO + '</div><div class="big">' + ils(pv) + '</div><div class="chg"><span class="' + cls(g) + '">' + arrow(g) + ' ' + ils(g) + ' (' + pct(g / pc * 100, true) + ')</span> <span class="muted">מאז הקנייה</span></div><p class="help">מחירים אמיתיים מהשוק · כמויות לדוגמה</p></section>' +
        '<section class="card" style="margin-top:12px"><div class="card-h"><h2>אחזקות</h2><a class="more" href="../portfolio.html">ניהול ‹</a></div><div class="list">' + D.holdings.map(function (h) {
          var q = PX && PX[h.sym], p = px(h.sym), ch = q && q.previousClose ? (p / q.previousClose - 1) * 100 : 0;
          return '<div class="row" style="cursor:default"><span class="ic">' + ic('chart') + '</span><span class="tx"><span class="t">' + h.name + '</span><span class="s">' + n(h.qty) + ' יח׳ · <span class="num">$' + NF2.format(p) + '</span></span></span><span class="v"><b>' + ils(h.qty * p * usd()) + '</b><small class="' + cls(ch) + '">' + pct(ch, true) + ' היום</small></span></div>';
        }).join('') + '</div></section>' +
        '<a class="card cardlink" href="#/invest/options" style="margin-top:12px;display:block"><div class="card-h"><h2>אופציות עובדים</h2>' + ic('chev').replace('<svg', '<svg class="chev" style="width:20px;height:20px;color:var(--muted)"') + '</div>' +
          '<div class="kv"><div><span>שווי הבשילו</span><b>' + ils(oi) + '</b></div><div><span>שווי כל המנות</span><b>' + ils(oa) + '</b></div></div><div class="prog"><i style="width:' + (optVested() / optTotal() * 100) + '%"></i></div><div class="muted" style="font-size:14px">' + n(optVested()) + ' מתוך ' + n(optTotal()) + ' הבשילו ' + DEMO + '</div></a>' +
        '<h2 class="sec">הוראת קבע להשקעה</h2><section class="card"><div style="display:flex;align-items:center;gap:12px"><span class="ic" style="width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary)">' + ic('repeat') + '</span><div style="flex:1"><b>' + ils(D.standing.amt) + ' בחודש</b><div class="muted" style="font-size:15px">ב־' + D.standing.day + ' לחודש · ' + D.standing.split.map(function (x) { return x[0] + ' ' + x[1] + '%'; }).join(' · ') + '</div></div>' + DEMO + '</div>' +
        '<p class="help">בעוד 10 שנים, בתשואה שנתית של 6%: כ־' + ils(fv(D.standing.amt, 0.06, 10)) + '</p></section>' +
        '<h2 class="sec">נכסים נוספים</h2><section class="card"><div class="list"><div class="row" style="cursor:default"><span class="ic">' + ic('house') + '</span><span class="tx"><span class="t">' + D.realEstate.name + '</span><span class="s">שווי משוער</span></span><span class="v"><b>' + ils(D.realEstate.val) + '</b></span></div>' +
        '<div class="row" style="cursor:default"><span class="ic" style="background:var(--loss-soft);color:var(--loss)">' + ic('bank') + '</span><span class="tx"><span class="t">הלוואות</span><span class="s">יתרה לסילוק</span></span><span class="v"><b class="loss">' + ils(-D.debts) + '</b></span></div></div></section>';
    }
    draw(); loadPrices().then(draw, function () {});
  });
  function fv(m, r, y) { var i = r / 12, k = y * 12; return m * ((Math.pow(1 + i, k) - 1) / i); }

  /* --- OPTIONS --- */
  route(/^\/invest\/options$/, 'invest', function () {
    drawBar('אופציות עובדים', true);
    var o = D.options;
    main().innerHTML =
      '<section class="hero"><div class="lbl">' + o.company + ' ' + DEMO + '</div><div class="big" id="ov">' + ils(optIntrinsic(false)) + '</div><div class="chg muted">שווי פנימי של המנות שהבשילו</div></section>' +
      '<section class="card" style="margin-top:12px"><div class="fields"><div class="field"><label for="op-p">מחיר מניה</label><div class="inp"><input id="op-p" inputmode="decimal" value="' + o.price.toFixed(2) + '"><span class="u">₪</span></div></div>' +
      '<div class="field"><label for="op-k">מחיר מימוש</label><div class="inp"><input id="op-k" inputmode="decimal" value="' + o.strike.toFixed(2) + '"><span class="u">₪</span></div></div></div>' +
      '<div class="kv" id="okv"></div><p class="help">מימוש נטו: לא משלמים את מחיר המימוש, ומקבלים מניות בשווי הרווח בלבד. מס לפי סעיף 102 במסלול רווח הון (25%) — הערכה בלבד, לא ייעוץ.</p></section>' +
      '<h2 class="sec">מנות הבשלה</h2><section class="card"><div class="tl" id="otl"></div></section>' +
      '<p class="help" style="text-align:center"><a href="../options.html">למחשבון האופציות המלא ‹</a></p>';
    function calc() {
      var p = parseFloat($('#op-p').value) || 0, k = parseFloat($('#op-k').value) || 0, gain = Math.max(0, p - k);
      var vested = optVested(), all = o.tranches.reduce(function (s, t) { return s + t.n; }, 0);
      var gross = gain * vested, netShares = p > 0 ? Math.floor(vested * gain / p) : 0, tax = gross * 0.25;
      $('#ov').innerHTML = ils(gross);
      $('#okv').innerHTML = '<div><span>הבשילו</span><b>' + n(vested) + ' / ' + n(all) + '</b></div><div><span>רווח לאופציה</span><b>' + ils(gain, true) + '</b></div><div><span>מניות במימוש נטו</span><b>' + n(netShares) + '</b></div><div><span>אחרי מס משוער</span><b>' + ils(gross - tax) + '</b></div>';
      $('#otl').innerHTML = o.tranches.map(function (t, i) {
        var done = new Date(t.vest) <= TODAY, next = !done && (i === 0 || new Date(o.tranches[i - 1].vest) <= TODAY);
        var dd = function (s) { return new Date(s).toLocaleDateString('he-IL'); };
        return '<div class="it ' + (done ? 'done' : next ? 'next' : '') + '"><span class="b"></span><div style="flex:1"><div class="tt">' + n(t.n) + ' אופציות · ' + (done ? 'הבשילו' : 'מבשילות') + ' ' + dd(t.vest) + '</div><div class="muted" style="font-size:15px">פוקעות ' + dd(t.exp) + ' · שווי ' + ils(gain * t.n) + '</div></div></div>';
      }).join('');
    }
    calc(); $$('#op-p,#op-k').forEach(function (i) { i.addEventListener('input', calc); });
  });

  /* --- COMPARE hub --- */
  route(/^\/compare$/, 'compare', function () {
    drawBar('השוואות');
    var items = [
      ['#/compare/funds?type=pension', 'umbrella', 'קרנות פנסיה', 'דמי ניהול ותשואות של כל הקרנות'],
      ['#/compare/funds?type=hishtalmut', 'grad', 'קרנות השתלמות', 'לפי מסלול, תשואה ודמי ניהול'],
      ['#/compare/funds?type=gemel', 'piggy', 'קופות גמל להשקעה', 'כולל מסלולי S&P 500'],
      ['../compare-savings.html', 'bank', 'פיקדונות וריביות', 'ריבית ממוצעת בכל בנק'],
      ['../compare-mortgage.html', 'house', 'מחזור משכנתא', 'האם כדאי למחזר ובכמה תחסוך'],
      ['../compare-cards.html', 'key', 'כרטיסי אשראי', 'עמלות והטבות']
    ];
    main().innerHTML = '<p class="muted" style="margin:4px 4px 12px">נתונים רשמיים, מתעדכנים אוטומטית. מידע בלבד, לא ייעוץ.</p><section class="card"><div class="list">' + items.map(function (it) {
      return '<a class="row" href="' + it[0] + '"><span class="ic">' + ic(it[1]) + '</span><span class="tx"><span class="t">' + it[2] + '</span><span class="s">' + it[3] + '</span></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</a>';
    }).join('') + '</div></section>';
  });

  /* --- COMPARE funds flow (real data) --- */
  var TRACKS = [['all', 'כל המסלולים'], ['general', 'כללי'], ['stocks', 'מניות'], ['sp', 'S&P 500'], ['index', 'עוקב מדדים'], ['bonds', 'אג״ח'], ['halacha', 'הלכה'], ['age', 'לפי גיל']];
  function trackOf(f) {
    var s = (f.name || '') + ' ' + (f.spec || '');
    if (/S&P|500|אס אנד פי/i.test(s)) return 'sp';
    if (/הלכ/.test(s)) return 'halacha';
    if (/לבני|גיל|מדרגות/.test(s)) return 'age';
    if (/אג"ח|אג״ח|אשראי/.test(s)) return 'bonds';
    if (/עוקב|מחקה|מדד/.test(s)) return 'index';
    if (/מניות|מנייתי/.test(s)) return 'stocks';
    if (/כללי/.test(s)) return 'general';
    return 'other';
  }
  var picked = [];
  route(/^\/compare\/funds$/, 'compare', function (m, q) {
    var type = q.get('type') || 'pension', track = q.get('track') || 'all', sort = q.get('sort') || 'y5';
    var T = { pension: 'קרנות פנסיה', hishtalmut: 'קרנות השתלמות', gemel: 'קופות גמל להשקעה' };
    drawBar(T[type] || 'השוואת קרנות', true);
    main().innerHTML =
      '<div class="seg" id="ty" role="group" aria-label="סוג מוצר">' + [['pension', 'פנסיה'], ['hishtalmut', 'השתלמות'], ['gemel', 'גמל להשקעה']].map(function (x) { return '<button data-v="' + x[0] + '" aria-pressed="' + (x[0] === type) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="chips" id="tr" role="group" aria-label="מסלול" style="margin-top:12px">' + TRACKS.map(function (t) { return '<button class="chip" data-v="' + t[0] + '" aria-pressed="' + (t[0] === track) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin:12px 4px 4px;gap:8px"><span class="muted" id="cnt" style="font-size:15px">טוען…</span>' +
      '<label class="sr" for="so">מיון</label><select id="so" style="min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface);padding:0 10px;font-size:15px;font-weight:600">' +
      [['y5', 'תשואה 5 שנים'], ['y3', 'תשואה 3 שנים'], ['ytd', 'מתחילת השנה'], ['fee', 'דמי ניהול נמוכים'], ['sharpe', 'שארפ (סיכון/תשואה)']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sort ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<section class="card" style="padding:8px 16px"><div class="list" id="fl">' + Array(7).join('<div class="skel r"></div>') + '</div></section>' +
      '<p class="help" id="src" style="margin:12px 4px"></p>' +
      '<div class="cmpbar" id="cb"><button class="btn pri" id="cbb"></button></div>';
    function nav(k, v) { var qq = new URLSearchParams({ type: type, track: track, sort: sort }); qq.set(k, v); if (k === 'type') { qq.set('track', 'all'); picked = []; } history.replaceState(null, '', '#/compare/funds?' + qq); limit = 40; type = qq.get('type'); track = qq.get('track'); sort = qq.get('sort'); $('#page-title').textContent = T[type]; draw(); }
    segmented($('#ty'), function (v) { nav('type', v); $$('#tr .chip').forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.v === 'all'); }); });
    $$('#tr .chip').forEach(function (c) { c.addEventListener('click', function () { $$('#tr .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c); }); nav('track', c.dataset.v); }); });
    $('#so').addEventListener('change', function () { nav('sort', this.value); });
    var DATA = null, limit = 40;
    function rows() {
      var sets = DATA.sets, list;
      if (type === 'pension') list = sets.pensianet.funds.filter(function (f) { return f.cls === 'קרנות חדשות'; });
      else list = sets.gemelnet.funds.filter(function (f) { return f.pop === 'כלל האוכלוסיה' && (type === 'hishtalmut' ? f.cls === 'קרנות השתלמות' : f.cls === 'קופת גמל להשקעה'); });
      list = list.filter(function (f) { return f.assets >= 20 && f.y5 != null; });
      if (track !== 'all') list = list.filter(function (f) { return trackOf(f) === track; });
      var key = sort;
      list.sort(function (a, b) { return key === 'fee' ? (a.feeAcc - b.feeAcc) : ((b[key] == null ? -99 : b[key]) - (a[key] == null ? -99 : a[key])); });
      return list;
    }
    function draw() {
      if (!DATA) return;
      var list = rows(), shown = list.slice(0, limit);
      var lbl = { y5: 'תשואה 5 שנים', y3: '3 שנים', ytd: 'מתחילת השנה', fee: 'דמי ניהול', sharpe: 'שארפ' }[sort];
      $('#cnt').textContent = list.length + ' מסלולים';
      $('#fl').innerHTML = shown.length ? shown.map(function (f) {
        var on = picked.some(function (p) { return p.id === f.id; });
        var main_ = sort === 'fee' ? pct(f.feeAcc) : sort === 'sharpe' ? '<span class="num">' + NF2.format(f.sharpe || 0) + '</span>' : pct(f[sort == 'y5' ? 'c5' : sort] != null ? f[sort == 'y5' ? 'c5' : sort] : 0, true);
        return '<div class="row" style="cursor:default"><span class="tx"><span class="t wrap">' + esc(f.name) + '</span><span class="s">דמי ניהול ' + pct(f.feeAcc) + ' · נכסים ' + n(f.assets >= 1000 ? f.assets / 1000 : f.assets) + (f.assets >= 1000 ? ' מיליארד ₪' : ' מיליון ₪') + '</span></span>' +
          '<span class="v"><b class="' + (sort === 'fee' ? '' : cls(f[sort] || 0)) + '">' + main_ + '</b><small class="muted">' + (sort === 'y5' ? 'מצטבר 5 שנים' : lbl) + '</small></span>' +
          '<button class="add" data-id="' + f.id + '" aria-pressed="' + on + '" aria-label="' + (on ? 'הסר מההשוואה: ' : 'הוסף להשוואה: ') + esc(f.name) + '">' + ic(on ? 'check' : 'plus') + '</button></div>';
      }).join('') + (list.length > limit ? '<button class="btn sec block" id="moreb" style="margin:8px 0">הצג עוד ' + Math.min(40, list.length - limit) + '</button>' : '') : '<div class="empty"><b>אין מסלולים מתאימים</b>נסה מסלול אחר או "כל המסלולים".</div>';
      var mb = $('#moreb'); if (mb) mb.addEventListener('click', function () { limit += 40; draw(); });
      $$('#fl .add').forEach(function (b) { b.addEventListener('click', function () {
        var id = +b.dataset.id, f = list.filter(function (x) { return x.id === id; })[0], i = picked.findIndex(function (p) { return p.id === id; });
        if (i >= 0) picked.splice(i, 1); else { if (picked.length >= 3) { toast('אפשר להשוות עד 3 מסלולים'); return; } picked.push(f); }
        var on = i < 0; b.setAttribute('aria-pressed', on); b.innerHTML = ic(on ? 'check' : 'plus'); bar();
      }); });
      bar();
    }
    function bar() { $('#cb').classList.toggle('on', picked.length > 0); $('#cbb').textContent = picked.length > 1 ? 'השווה ' + picked.length + ' מסלולים' : 'בחר עוד מסלול להשוואה'; $('#cbb').disabled = picked.length < 2; }
    $('#cbb').addEventListener('click', function () { if (picked.length > 1) cmpSheet(picked); });
    load('../funds.json').then(function (j) {
      DATA = j; var per = String((j.sets.gemelnet || {}).period || '');
      $('#src').textContent = 'מקור: רשות שוק ההון (פנסיה נט וגמל נט) · נתוני ' + (per ? per.slice(4) + '/' + per.slice(0, 4) : '') + ' · מידע בלבד, לא ייעוץ.';
      draw();
    }).catch(function () { $('#fl').innerHTML = '<div class="empty"><b>הנתונים לא נטענו</b>בדוק חיבור ונסה שוב.</div>'; });
  });
  function cmpSheet(fs) {
    var rowsDef = [['תשואה 5 שנים (מצטבר)', 'c5', 1, true], ['תשואה 3 שנים (מצטבר)', 'c3', 1, true], ['מתחילת השנה', 'ytd', 1, true], ['דמי ניהול מצבירה', 'feeAcc', -1], ['דמי ניהול מהפקדה', 'feeDep', -1], ['שארפ', 'sharpe', 1], ['סטיית תקן', 'sd', -1]];
    var body = rowsDef.map(function (r) {
      var vals = fs.map(function (f) { return f[r[1]]; }), ok = vals.filter(function (v) { return v != null; });
      if (!ok.length) return '';
      var best = ok.length ? (r[2] > 0 ? Math.max.apply(null, ok) : Math.min.apply(null, ok)) : null;
      return '<tr><th scope="row">' + r[0] + '</th>' + vals.map(function (v) { return '<td class="' + (v === best && ok.length > 1 ? 'best' : '') + '">' + (v == null ? '—' : r[1] === 'sharpe' ? '<span class="num">' + NF2.format(v) + '</span>' : pct(v, r[3])) + '</td>'; }).join('') + '</tr>';
    }).join('');
    openSheet('<h2 id="sheet-title">השוואה</h2><p class="muted" style="margin:0 0 8px">הערך הטוב בכל שורה מודגש בירוק.</p>' +
      '<div style="overflow-x:auto"><table class="ctab"><caption class="sr">השוואת מסלולים</caption><thead><tr><th scope="col"><span class="sr">מדד</span></th>' + fs.map(function (f) { return '<th scope="col">' + esc(f.name) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<h2 style="font-size:17px;margin:20px 0 8px">כמה זה שווה לך ב־20 שנה?</h2><div class="fields"><div class="field"><label for="w-b">יתרה היום</label><div class="inp"><input id="w-b" inputmode="numeric" value="140000"><span class="u">₪</span></div></div><div class="field"><label for="w-m">הפקדה חודשית</label><div class="inp"><input id="w-m" inputmode="numeric" value="1500"><span class="u">₪</span></div></div></div>' +
      '<div class="list" id="w-out" style="margin-top:8px"></div><p class="help">הנחה: התשואה השנתית הממוצעת של 5 השנים האחרונות לפני דמי ניהול, פחות דמי הניהול מצבירה. תשואת עבר אינה מבטיחה תשואה בעתיד. מידע בלבד, לא ייעוץ.</p>' +
      '<button class="btn sec block" style="margin-top:12px" data-close>סגור</button>');
    function proj() {
      var b = parseFloat($('#w-b').value) || 0, mm = parseFloat($('#w-m').value) || 0;
      var res = fs.map(function (f) { var gross = Math.pow(1 + (f.c5 || 0) / 100, 1 / 5) - 1 + (f.feeAcc || 0) / 100; var r = gross - (f.feeAcc || 0) / 100; var i = r / 12, k = 240; var v = b * Math.pow(1 + i, k) + (i ? mm * ((Math.pow(1 + i, k) - 1) / i) : mm * k); return { f: f, v: v }; });
      var mx = Math.max.apply(null, res.map(function (x) { return x.v; }));
      $('#w-out').innerHTML = res.sort(function (a, c) { return c.v - a.v; }).map(function (x, i) { return '<div class="row" style="cursor:default"><span class="tx"><span class="t">' + esc(x.f.name) + '</span><span class="s">' + (i === 0 ? 'הגבוה ביותר' : 'פחות ב־' + ils(mx - x.v)) + '</span></span><span class="v"><b>' + ils(x.v) + '</b></span></div>'; }).join('');
    }
    proj(); $$('#w-b,#w-m').forEach(function (i) { i.addEventListener('input', proj); });
  }

  /* --- NEWS --- */
  route(/^\/news$/, 'news', function (m, q) {
    drawBar('חדשות');
    var tab = q.get('t') || 'desk';
    main().innerHTML = '<div class="seg" id="nt" role="group" aria-label="סוג חדשות"><button data-v="desk" aria-pressed="' + (tab === 'desk') + '">סקירות הדסק</button><button data-v="all" aria-pressed="' + (tab === 'all') + '">כל החדשות</button></div>' +
      '<a class="card cardlink" href="#/news/alerts" style="margin-top:12px;display:flex;align-items:center;gap:12px"><span class="ic" style="width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary);flex:none">' + ic('bell') + '</span><span style="flex:1"><b style="display:block">קבל את הסקירות בהתראה</b><span class="muted" style="font-size:15px">פתיחה, אמצע יום ונעילה · בחינם</span></span>' + ic('chev').replace('<svg', '<svg style="width:20px;height:20px;color:var(--muted)"') + '</a>' +
      '<div id="nl" style="margin-top:12px">' + Array(5).join('<div class="card" style="margin-bottom:12px"><div class="skel l" style="width:30%"></div><div class="skel h"></div><div class="skel l"></div></div>') + '</div>';
    var J = null;
    function draw() {
      if (!J) return;
      var items = J.items || [];
      if (tab === 'desk') {
        var d = items.filter(function (i) { return i.kind === 'digest' || i.kind === 'funds'; }).slice(0, 30);
        $('#nl').innerHTML = '<div class="stack">' + d.map(function (i) { return '<a class="card cardlink brief fadein" href="#/news/' + encodeURIComponent(i.id) + '"><div class="ed"><span class="badge pri">' + esc(i.edition || (i.kind === 'funds' ? 'סיכום חודשי' : 'סקירה')) + '</span><span class="muted" style="font-size:14px">' + rel(i.time) + '</span></div><h3>' + esc(i.title) + '</h3><p>' + esc(i.summary) + '</p></a>'; }).join('') + '</div>';
      } else {
        var r = items.filter(function (i) { return i.kind === 'rss'; });
        $('#nl').innerHTML = '<section class="card" style="padding:8px 16px"><div class="list">' + r.map(function (i) {
          var url = (i.links && i.links[0] && (i.links[0].url || i.links[0])) || i.url || '#';
          return '<a class="row fadein" href="' + esc(url) + '" target="_blank" rel="noopener"><span class="tx"><span class="t" dir="auto"' + (i.lang ? ' lang="' + esc(i.lang) + '"' : '') + ' style="white-space:normal;line-height:1.4;text-align:start">' + esc(i.title) + '</span><span class="s">' + esc(i.source) + ' · ' + rel(i.time) + '</span></span>' + ic('ext').replace('<svg', '<svg class="chev"') + '</a>';
        }).join('') + '</div></section>';
      }
    }
    segmented($('#nt'), function (v) { tab = v; history.replaceState(null, '', '#/news?t=' + v); draw(); });
    load('../data/news.json').then(function (j) { J = j; draw(); }).catch(function () { $('#nl').innerHTML = '<div class="card empty"><b>החדשות לא נטענו</b>נסה שוב בעוד רגע.</div>'; });
  });
  route(/^\/news\/alerts$/, 'news', function () {
    drawBar('התראות', true);
    var prefs = JSON.parse(localStorage.getItem('v2-alerts') || '{"open":true,"mid":false,"close":true,"week":true,"month":true,"break":false}');
    var opts = [['open', 'סקירת פתיחה', 'בוקר: ישראל, אסיה ואירופה'], ['mid', 'סקירת אמצע יום', 'פתיחת וול סטריט'], ['close', 'סקירת נעילה', 'ערב: סיכום יום המסחר'], ['week', 'סיכום שבועי', 'מה היה השבוע ומה צפוי'], ['month', 'סיכום חודשי', 'סטטיסטיקות וגרפים לסוף החודש'], ['break', 'חדשות מתפרצות', 'רק אירועים משמעותיים']];
    main().innerHTML = '<p class="muted" style="margin:4px 4px 12px">בחר מה לקבל. הכול בחינם. ' + DEMO.replace('נתוני דוגמה', 'אב־טיפוס: נשמר במכשיר בלבד') + '</p><section class="card"><div class="list">' + opts.map(function (o) {
      return '<label class="row" for="a-' + o[0] + '"><span class="tx"><span class="t">' + o[1] + '</span><span class="s">' + o[2] + '</span></span><input type="checkbox" id="a-' + o[0] + '" data-k="' + o[0] + '"' + (prefs[o[0]] ? ' checked' : '') + ' style="width:28px;height:28px;accent-color:var(--primary)"></label>';
    }).join('') + '</div></section>';
    $$('[data-k]').forEach(function (c) { c.addEventListener('change', function () { prefs[c.dataset.k] = c.checked; localStorage.setItem('v2-alerts', JSON.stringify(prefs)); toast(c.checked ? 'נרשמת: ' + c.closest('.row').querySelector('.t').textContent : 'בוטל'); }); });
  });
  route(/^\/news\/(.+)$/, 'news', function (m) {
    drawBar('סקירה', true);
    main().innerHTML = '<div class="card"><div class="skel l" style="width:30%"></div><div class="skel h"></div><div class="skel l"></div><div class="skel l"></div></div>';
    load('../data/news.json').then(function (j) {
      var id = decodeURIComponent(m[1]), i = (j.items || []).filter(function (x) { return x.id === id; })[0];
      if (!i) { main().innerHTML = '<div class="card empty"><b>הסקירה לא נמצאה</b><a href="#/news">לכל הסקירות</a></div>'; return; }
      var secs = i.stories || i.sections || [];
      main().innerHTML = '<article class="card article fadein"><div class="ed" style="display:flex;gap:8px;align-items:center"><span class="badge pri">' + esc(i.edition || i.period_label || 'סקירה') + '</span><span class="muted" style="font-size:14px">' + rel(i.time) + ' · ' + esc(i.source || '') + '</span></div><h2>' + esc(i.title) + '</h2><p class="lead muted">' + esc(i.summary || '') + '</p>' +
        secs.map(function (s) { return '<section class="story"><h3>' + esc(s.title || s.heading || '') + '</h3><p>' + esc(s.text || s.body || (Array.isArray(s.items) ? s.items.map(function (x) { return typeof x === 'string' ? x : (x.name || '') + ' ' + (x.value || ''); }).join(' · ') : '')) + '</p></section>'; }).join('') +
        (secs.length ? '' : '<p>' + esc(i.body || '') + '</p>') + '<p class="help">מידע בלבד, לא ייעוץ.</p></article>';
    });
  });

  /* --- ME --- */
  route(/^\/me$/, '', function () {
    drawBar('האזור האישי', true);
    var theme = localStorage.getItem('v2-theme') || 'auto';
    main().innerHTML = '<section class="card" style="display:flex;align-items:center;gap:14px"><span class="avatar" style="width:56px;height:56px;font-size:24px">א</span><div><b style="font-size:18px">אביעד</b><div class="muted" style="font-size:15px">אב־טיפוס · הנתונים כאן לדוגמה</div></div></section>' +
      '<h2 class="sec">כלים</h2><section class="card"><div class="list">' +
      [['../report.html', 'doc', 'דוח פיננסי אישי', 'עמוד אחד להדפסה או PDF'], ['../tax.html', 'calc', 'עוזר מס', 'נקודות זיכוי, החזר ומס על אופציות'], ['../retirement.html', 'umbrella', 'תחזית פנסיה', 'גבוה, בינוני ונמוך'], ['../avatar.html', 'target', 'האווטאר שלי', 'מותאם לפי סלפי, בדפדפן בלבד']].map(rowLink).join('') + '</div></section>' +
      '<h2 class="sec">תצוגה</h2><section class="card"><div class="seg" id="th" role="group" aria-label="ערכת צבעים"><button data-v="auto" aria-pressed="' + (theme === 'auto') + '">לפי המכשיר</button><button data-v="light" aria-pressed="' + (theme === 'light') + '">בהיר</button><button data-v="dark" aria-pressed="' + (theme === 'dark') + '">כהה</button></div></section>' +
      '<h2 class="sec">עזרה</h2><section class="card"><div class="list">' + [['../feedback.html', 'chat', 'שלח משוב', 'מה לשפר'], ['../privacy.html', 'shield', 'פרטיות', 'מה נשמר ואיפה'], ['../index.html', 'home', 'לגרסה הנוכחית של האתר', '']].map(rowLink).join('') + '</div></section>' +
      '<p class="help" style="text-align:center">בקרוב: מעקב הוצאות ומינויים</p>';
    segmented($('#th'), function (v) { localStorage.setItem('v2-theme', v); applyTheme(); });
  });
  function rowLink(r) { return '<a class="row" href="' + r[0] + '"><span class="ic">' + ic(r[1]) + '</span><span class="tx"><span class="t">' + r[2] + '</span>' + (r[3] ? '<span class="s">' + r[3] + '</span>' : '') + '</span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</a>'; }
  function applyTheme() { var t = localStorage.getItem('v2-theme') || 'auto'; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }

  /* ---------- boot ---------- */
  applyTheme(); go();
  // warm caches after first paint
  (window.requestIdleCallback || setTimeout)(function () { load('../data/news.json').catch(function () {}); loadPrices().catch(function () {}); });
})();
