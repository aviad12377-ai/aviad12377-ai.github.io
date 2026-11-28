/* /next/ staged port: v2 shell + real portal modules (Portal, PortalCloud, PortalEsop, PortalInsights).
   Signed-out: demo values labeled נתוני דוגמה. Signed-in: portal_docs via portal-cloud (anon+RLS). No personal data in repo. */
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


  /* ---------- real vs demo snapshot ---------- */
  function signedIn() { return !!(window.PortalCloud && PortalCloud.user); }
  function hasLocalData() {
    try {
      var d = window.Portal && Portal.data, s = d && Portal.calc.summary();
      return !!(s && (s.assets > 0 || s.liabs > 0 || (d.pension && d.pension.funds && d.pension.funds.length) || (d.savings && d.savings.cash && d.savings.cash.length)));
    } catch (e) { return false; }
  }
  function greetName() {
    if (!signedIn()) return '';
    var u = PortalCloud.user, n = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '';
    if (n) return String(n).trim().split(/\s+/)[0];
    var em = (u.email || '').split('@')[0];
    return em || '';
  }
  function greetTitle() {
    var hr = new Date().getHours();
    var g = hr < 5 ? 'לילה טוב' : hr < 12 ? 'בוקר טוב' : hr < 18 ? 'צהריים טובים' : 'ערב טוב';
    var n = greetName();
    return n ? g + ', ' + n : g;
  }
  function ext(href) {
    if (!href) return '#/';
    if (/^(https?:|#|mailto:)/.test(href)) return href;
    if (href.indexOf('../') === 0) return href;
    return '../' + href.replace(/^\.\//, '');
  }
  function recordHistory(net, missing) {
    if (!window.Portal || missing || !Number.isFinite(net)) return;
    var hist = Portal.data.history;
    if (!Array.isArray(hist)) Portal.data.history = hist = [];
    var day = new Date().toISOString().slice(0, 10), last = hist[hist.length - 1];
    if (!last || last[0] !== day) { hist.push([day, Math.round(net)]); if (hist.length > 400) hist.splice(0, hist.length - 400); Portal.saveNow(); }
    else if (Math.abs(last[1] - net) > Math.max(1, Math.abs(net) * 0.001)) { last[1] = Math.round(net); Portal.saveNow(); }
  }
  function demoSnap() {
    var nw = netWorth(), s = series(nw), nextT = D.options.tranches.filter(function (t) { return new Date(t.vest) > TODAY; })[0];
    var days = nextT ? Math.ceil((new Date(nextT.vest) - TODAY) / 864e5) : 0;
    var totOpt = optTotal();
    return {
      demo: true, net: nw, hist: s.map(function (v, i) { var d = new Date(TODAY.getFullYear(), TODAY.getMonth() - (s.length - 1 - i), 1); return [d.toISOString().slice(0, 10), v]; }),
      accounts: D.accounts, holdings: D.holdings.map(function (h) { var q = PX && PX[h.sym], p = px(h.sym), ch = q && q.previousClose ? (p / q.previousClose - 1) * 100 : 0; return { sym: h.sym, name: h.name, qty: h.qty, price: p, cur: 'USD', valueILS: h.qty * p * usd(), ch: ch }; }),
      portfolioVal: portfolioVal(), portfolioCost: portfolioCost(),
      options: { company: D.options.company, price: D.options.price, strike: D.options.strike, tax: 25, vested: optVested(), total: totOpt, valVested: optIntrinsic(false), valAll: optIntrinsic(true), tranches: D.options.tranches, editable: true },
      standing: (function () { var st = ST(); return [{ name: 'הוראת קבע לתיק', amt: st.amt, when: 'ב־' + st.day + ' לחודש', split: st.split.map(function (x) { return x[0] + ' ' + x[1] + '%'; }).join(' · '), projected: fv(st.amt, 0.06, 10) }]; })(),
      realEstate: D.realEstate, debts: D.debts, goals: D.goals,
      steps: [
        { t: 'דמי הניהול בהשתלמות גבוהים', s: 'משלם 0.70% מצבירה. הממוצע בשוק נמוך יותר. בדוק חלופות ב־2 דקות.', href: '#/compare/funds?type=hishtalmut', tone: 'loss' },
        { t: 'מנת אופציות מבשילה בעוד ' + days + ' ימים', s: n(nextT ? nextT.n : 0).replace(/<\/?span[^>]*>/g, '') + ' אופציות נוספות יהיו ניתנות למימוש.', href: '#/invest/options', tone: 'pri' },
        { t: 'קרן החירום כמעט מלאה', s: 'חסרים ' + '₪15,000' + ' ליעד. הוראת הקבע תשלים אותו בעוד כ־15 חודשים.', href: '#/savings', tone: 'gain' }
      ]
    };
  }
  function realSnap() {
    var P = window.Portal, d = P.data, s = P.calc.summary(), C = { pension: 'var(--c1)', hishtalmut: 'var(--c2)', gemel: 'var(--c3)', deposits: 'var(--c5)' };
    var accounts = [];
    function pushFund(group, name, sub, bal, feeAcc, feeDep, icn, flag) {
      var fee = [];
      if (feeAcc != null) fee.push((Number(feeAcc).toFixed(2).replace(/\.00$/, '')) + '% מצבירה');
      if (feeDep != null) fee.push((Number(feeDep).toFixed(2).replace(/\.00$/, '')) + '% מהפקדה');
      accounts.push({ id: group + '-' + accounts.length, group: group, name: name, sub: sub || '', bal: bal || 0, m: 0, fee: fee.join(' · ') || '—', color: C[group] || 'var(--c1)', ic: icn, flag: !!flag });
    }
    (d.pension.funds || []).forEach(function (r) {
      var typ = r.kind === 'k_gemel' || r.kind === 'k_gemel_inv' ? 'gemel' : 'pension';
      var cap = typ === 'pension' ? 0.3 : 0.7;
      pushFund(typ, r.name || (typ === 'gemel' ? 'קופת גמל' : 'קרן פנסיה'), r.track || '', Number(r.balance) || 0, r.feeBal, r.feeDep, typ === 'gemel' ? 'piggy' : 'umbrella', Number(r.feeBal) > cap);
    });
    (d.hishtalmut.funds || []).forEach(function (r) {
      pushFund('hishtalmut', r.name || 'קרן השתלמות', r.track || '', Number(r.balance) || 0, r.feeBal, r.feeDep, 'grad', Number(r.feeBal) > 0.7);
    });
    if (d.maslaka && d.maslaka.include !== false) (d.maslaka.products || []).forEach(function (p) {
      if (!(Number(p.balance) > 0)) return;
      var typ = p.type === 'hishtalmut' ? 'hishtalmut' : (p.type === 'gemel' || p.type === 'gemel_inv' ? 'gemel' : 'pension');
      var cap = typ === 'pension' ? 0.3 : 0.7;
      pushFund(typ, [p.provider, p.plan].filter(Boolean).join(' · ') || 'חיסכון פנסיוני', p.track || '', Number(p.balance) || 0, p.feeAcc, p.feeDep, typ === 'hishtalmut' ? 'grad' : typ === 'gemel' ? 'piggy' : 'umbrella', Number(p.feeAcc) > cap);
    });
    (d.savings.cash || []).forEach(function (r) {
      var v = P.toILS(r.balance, r.currency); if (v == null) v = Number(r.balance) || 0;
      accounts.push({ id: 'cash-' + accounts.length, group: 'deposits', name: r.name || 'פיקדון', sub: (r.kind === 'c_checking' ? 'עו״ש' : 'פיקדון') + (r.rate ? ' · ' + Number(r.rate).toFixed(2) + '%' : ''), bal: v, m: 0, fee: '—', color: C.deposits, ic: 'bank', flag: false });
    });
    var holdings = [];
    (d.savings.portfolios || []).forEach(function (pf) {
      (pf.rows || []).forEach(function (r) {
        var x = P.calc.portfolioRow(r), ch = 0, q = x.quote;
        if (q && q.previousClose && x.price) ch = (x.price / q.previousClose - 1) * 100;
        holdings.push({ sym: r.ticker || '', name: (r.ticker || '') + (pf.name ? ' · ' + pf.name : ''), qty: Number(r.qty) || 0, price: x.price, cur: r.currency || 'ILS', valueILS: x.valueILS || 0, ch: ch });
      });
    });
    (P.calc.positions() || []).forEach(function (p) {
      if (!(p.qty > 0)) return;
      holdings.push({ sym: p.symbol, name: p.symbol, qty: p.qty, price: p.price, cur: p.currency || 'ILS', valueILS: p.valueILS || 0, ch: 0 });
    });
    var pv = holdings.reduce(function (a, h) { return a + (h.valueILS || 0); }, 0);
    var pc = 0; (d.savings.portfolios || []).forEach(function (pf) { pc += P.calc.portfolio(pf).costILS || 0; });
    var options = null;
    try {
      var rawEs = JSON.parse(localStorage.getItem('options-calc-v5-private') || 'null');
      if (window.PortalEsop && PortalEsop.hasEsop(rawEs)) {
        var e = PortalEsop.compute();
        if (e && e.qty > 0) {
          var tranches = [];
          e.grants.forEach(function (g) {
            var vest = (g.g.vest || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
            if (!vest.length) tranches.push({ n: g.qty, vest: g.g.date || '', exp: g.g.expire || g.g.expiry || '', done: g.vested >= g.qty, value: (g.intr || 0) * Math.max(0, g.exer) });
            vest.forEach(function (v) { tranches.push({ n: Number(v.qty) || 0, vest: v.date || '', exp: g.g.expire || g.g.expiry || '', done: !!(v.date && v.date <= new Date().toISOString().slice(0, 10)), value: (g.intr || 0) * (Number(v.qty) || 0) }); });
          });
          var es = rawEs.esop || {};
          options = { company: es.symbol || (e.grants[0] && e.grants[0].g && e.grants[0].g.name) || 'אופציות עובדים', price: e.price && e.price.price, strike: e.grants[0] ? e.grants[0].adj : null, tax: es.tax != null ? es.tax : 25, vested: e.exercisable, total: e.left, valVested: e.valV, valAll: (e.valV || 0) + (e.valU || 0), tranches: tranches, editable: false, net: e.net };
        }
      }
    } catch (err) { console.warn(err); }
        var standing = (d.savings.standing || []).map(function (r) {
      var x = P.calc.standing(r);
      return { name: r.name || 'הוראת קבע', amt: Number(r.monthly) || 0, when: (r.freq === 'yearly' ? 'שנתית' : r.freq === 'quarterly' ? 'רבעונית' : 'חודשית'), split: (r.instruments || []).map(function (x) { return (x.name || x.sym) + ' ' + (Number(x.pct) || 0) + '%'; }).join(' · ') || (r.dest === 'portfolio' ? 'לתיק ההשקעות' : 'לחיסכון'), projected: x.projected, valueToday: x.valueToday, dest: r.dest };
    });
    var re = (d.home.assets || []).filter(function (a) { return a && a.type === 'a_realestate'; }).map(function (a) { return { name: a.name || (a.sub === 'home' ? 'דירה' : 'נדל״ן'), val: P.toILS(a.value, a.currency) || 0 }; });
    var goals = [];
    try {
      var gdoc = JSON.parse(localStorage.getItem('portal-goals-v1') || 'null') || {};
      (gdoc.goals || []).forEach(function (g) { goals.push({ name: g.name || 'יעד', cur: Number(g.current || g.cur) || 0, tgt: Number(g.target || g.tgt || g.amount) || 0 }); });
      if (gdoc.emergency && Number(gdoc.emergency.target || 0) + Number(gdoc.emergency.months || 0)) {
        /* skip if already represented */
      }
    } catch (e) {}
    if (!goals.length && d.home.goal && d.home.goal.amount) goals.push({ name: 'יעד', cur: s.net, tgt: Number(d.home.goal.amount) });
    var steps = [];
    if (window.PortalInsights) {
      try {
        PortalInsights.list().slice(0, 3).forEach(function (it) {
          steps.push({ t: it.title, s: it.text, href: ext(it.href), tone: it.score >= 70 ? 'loss' : it.score >= 40 ? 'pri' : 'gain' });
        });
      } catch (e) {}
    }
    recordHistory(s.net, s.missing);
    var hist = (d.history || []).slice();
    return {
      demo: false, net: s.net, hist: hist, summary: s,
      accounts: accounts, holdings: holdings, portfolioVal: pv + (s.cats.cat_trades || 0), portfolioCost: pc,
      options: options, standing: standing, realEstate: re[0] || null, realEstateList: re, debts: s.liabs, goals: goals, steps: steps, cats: s.cats
    };
  }
  function snap() { return (signedIn() || hasLocalData()) ? realSnap() : demoSnap(); }
  function demoBadge(sn) { return sn.demo ? DEMO : ''; }
  function localBanner() {
    if (signedIn() || !hasLocalData()) return '';
    try { if (sessionStorage.getItem('next-local-note') === '1') return ''; } catch (e) {}
    return '<div class="banner" role="status"><span>הנתונים שלך שמורים במכשיר הזה בלבד. כניסה לחשבון שומרת אותם גם בענן.</span><span class="banner-acts"><button type="button" id="banner-signin">כניסה</button><button type="button" id="banner-hide" aria-label="סגירת ההודעה">סגירה</button></span></div>';
  }
  function bindBanner() {
    var b = $('#banner-signin'); if (b && window.PortalCloud) b.addEventListener('click', function () { PortalCloud.openDialog(); });
    var x = $('#banner-hide'); if (x) x.addEventListener('click', function () { try { sessionStorage.setItem('next-local-note', '1'); } catch (e) {} var el = x.closest('.banner'); if (el) el.remove(); });
  }
  function welcome(S) {
    if (!S.demo) return '';
    return '<section class="welcome" aria-labelledby="wl-h"><h2 id="wl-h">כל הכסף שלך במקום אחד</h2>' +
      '<p>פנסיה, חסכונות, השקעות, משכנתא והלוואות בתמונה אחת, עם השוואה לנתונים הרשמיים.</p>' +
      '<ul class="wl-points"><li>' + ic('shield') + '<span>בלי סיסמאות לבנק. מזינים יתרה ביד או טוענים את קובץ המסלקה הפנסיונית.</span></li>' +
      '<li>' + ic('key') + '<span>הנתונים נשמרים במכשיר שלך. חשבון הוא רשות, לגיבוי ולמעבר בין מכשירים.</span></li>' +
      '<li>' + ic('bank') + '<span>מקורות רשמיים: בנק ישראל ורשות שוק ההון, עם תאריך העדכון ליד כל נתון.</span></li></ul>' +
      '<div class="wl-acts"><a class="btn pri" href="../me.html#maslaka">הזנת הנתונים שלי</a><a class="btn sec" href="#/compare">השוואות בלי הרשמה</a></div>' +
      '<p class="help">מידע בלבד, לא ייעוץ. <a href="#/about">איך זה עובד ומאיפה הנתונים</a></p></section>' +
      '<h2 class="sec">כך זה נראה, עם נתוני דוגמה</h2>';
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
    var initial = (function () {
      var u = window.PortalCloud && PortalCloud.user, n = u && ((u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || '').split('@')[0]);
      return n ? esc(String(n).trim().charAt(0).toUpperCase()) : 'כ';
    })();
    $('#appbar').innerHTML = (back ? '<button class="iconbtn" data-back aria-label="חזרה">' + ic('back') + '</button>' : '') +
      '<h1 id="page-title">' + esc(title) + '</h1>' +
      '<span id="account-slot"></span>' +
      '<a class="iconbtn" href="#/news/alerts" aria-label="התראות">' + ic('bell') + '</a>' +
      '<a class="iconbtn" href="#/me" aria-label="האזור האישי"><span class="avatar" aria-hidden="true">' + initial + '</span></a>';
    document.title = (current() === '/' ? '' : title + ' · ') + 'הכסף שלי';
    try { window.dispatchEvent(new Event('portal-chrome')); } catch (e) {}
    requestAnimationFrame(paintAvatar);
  }
  function paintAvatar() {
    try {
      if (window.NextAvatar && typeof NextAvatar.mount === 'function') {
        NextAvatar.mount({ header: document.querySelector('.appbar .avatar'), profile: document.getElementById('me-avatar') });
      }
    } catch (e) {}
  }
  addEventListener('scroll', function () { $('#appbar').classList.toggle('scrolled', scrollY > 4); }, { passive: true });

  /* ---------- router ---------- */
  var routes = [];
  function route(re, tab, fn) { routes.push({ re: re, tab: tab, fn: fn }); }
  var hist = [], scrollMem = {};
  function current() {
    var h = location.hash.replace(/^#/, '');
    if (/^(access_token|error|token_type|expires_in)=/.test(h)) return /me\.html$/.test(location.pathname) ? '/me' : '/';
    if (h) return h;
    return /me\.html$/.test(location.pathname) ? '/me' : '/';
  }
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
      var vt = document.startViewTransition(swap); vt.ready.catch(function () {}); vt.finished.then(focusTitle, focusTitle);
    } else { swap(); if (prev != null) focusTitle(); }
  }
  function focusTitle() { var h = $('#main'); if (h) h.focus({ preventScroll: true }); }
  addEventListener('hashchange', go);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-back]'); if (b) { e.preventDefault(); if (history.length > 1 && hist.length) history.back(); else location.hash = '#/' + (current().split('/')[1] || ''); }
  });
  addEventListener('hashchange', function () { hist.push(1); });
  var main = function () { return $('#main'); };
  function replaceRoute(re, tab, fn) {
    var key = String(re);
    for (var i = 0; i < routes.length; i++) {
      if (String(routes[i].re) === key) { routes[i] = { re: re, tab: tab, fn: fn }; return; }
    }
    routes.push({ re: re, tab: tab, fn: fn });
  }

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
    drawBar(greetTitle());
    var S = snap(), nw = S.net;
    var hist = (S.hist && S.hist.length) ? S.hist.slice() : [[new Date().toISOString().slice(0, 10), nw]];
    if (hist.length === 1) hist = [hist[0], hist[0]];
    var vals = hist.map(function (pt) { return Array.isArray(pt) ? pt[1] : pt; });
    var dates = hist.map(function (pt) { return Array.isArray(pt) ? pt[0] : ''; });
    var tones = { loss: ['var(--loss-soft)', 'var(--loss)'], pri: ['var(--primary-soft)', 'var(--primary)'], gain: ['var(--gain-soft)', 'var(--gain)'] };
    var stepsHtml = (S.steps || []).slice(0, 3).map(function (it, i) {
      var tn = tones[it.tone] || tones.pri;
      return step(String(i + 1), tn[0], tn[1], it.t, it.s, it.href);
    }).join('') || '<p class="muted">אין כרגע צעדים דחופים.</p>';
    main().innerHTML =
      localBanner() + welcome(S) +
      '<div class="grid2"><div class="stack">' +
      '<section class="hero" aria-labelledby="nw-l"><div class="lbl" id="nw-l">שווי נקי ' + demoBadge(S) + '</div>' +
      '<div class="big" id="nw">' + ils(nw) + '</div><div class="chg" id="nwchg"></div>' +
      '<div class="chart" id="nwc"></div>' +
      '<div class="periods" role="group" aria-label="תקופה">' + [['1', 'חודש'], ['6', '6 חודשים'], ['12', 'שנה'], ['36', '3 שנים']].map(function (pt, i) { return '<button class="chip" data-p="' + pt[0] + '" aria-pressed="' + (i === 2) + '">' + pt[1] + '</button>'; }).join('') + '</div></section>' +
      '<section class="card" aria-labelledby="al-h"><div class="card-h"><h2 id="al-h">איפה הכסף שלך</h2><a class="more" href="#/savings">הכול ‹</a></div>' + allocBlock(S) + '</section>' +
      '</div><div class="stack">' +
      '<section class="card" aria-labelledby="st-h"><div class="card-h"><h2 id="st-h">הצעדים הבאים</h2>' + demoBadge(S) + '</div>' + stepsHtml + '</section>' +
      '<section aria-labelledby="br-h"><h2 class="sec" id="br-h">הסקירה האחרונה של הדסק</h2><div id="brief"><div class="card"><div class="skel h"></div><div class="skel l"></div><div class="skel l" style="width:80%"></div></div></div></section>' +
      '<section aria-labelledby="mk-h"><h2 class="sec" id="mk-h">שווקים</h2><div class="mkts" id="mkts" tabindex="0" role="group" aria-label="מדדים ושערים">' + Array(4).join('<div class="mkt"><div class="skel l" style="width:60%"></div><div class="skel h"></div></div>') + '</div></section>' +
      '</div></div>';
    bindBanner();
    var cur = Math.min(12, Math.max(1, vals.length - 1));
    function setP(pr) {
      cur = +pr; var npts = Math.min(vals.length, cur + 1); var data = vals.slice(-npts), d0 = data[0], d1 = data[data.length - 1], ch = d1 - d0;
      var base = d0 || 1;
      var label = { 1: 'בחודש האחרון', 6: 'בחצי שנה', 12: 'בשנה האחרונה', 36: 'ב־3 שנים' }[cur] || '';
      $('#nwchg').innerHTML = '<span class="' + cls(ch) + '">' + arrow(ch) + ' ' + ils(ch) + ' (' + pct(ch / base * 100, true) + ')</span> <span class="muted">' + label + '</span>';
      chart($('#nwc'), data, { label: 'שווי נקי לאורך זמן', onScrub: function (i) {
        if (i < 0) { $('#nw').innerHTML = ils(nw); setP(cur); return; }
        var idx = vals.length - data.length + i;
        $('#nw').innerHTML = ils(data[i]);
        $('#nwchg').innerHTML = '<span class="muted">' + (dates[idx] ? new Date(dates[idx]).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : '') + '</span>';
      } });
    }
    setP(cur >= 12 ? 12 : cur);
    $$('.periods .chip').forEach(function (b) { b.addEventListener('click', function () { $$('.periods .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); setP(b.dataset.p); }); });
    var brief = $('#brief');
    if (window.NextNews && typeof NextNews.homeBrief === 'function') {
      NextNews.homeBrief(brief, window.NextApp);
    } else {
      load('../data/news.json').then(function (j) {
        var d = (j.items || []).filter(function (i) { return i.kind === 'digest'; })[0]; if (!d || !brief) return;
        brief.innerHTML = '<a class="card cardlink brief fadein" href="#/news/' + encodeURIComponent(d.id) + '"><div class="ed"><span class="badge pri">' + esc(d.edition || 'סקירה') + '</span><span class="muted" style="font-size:14px">' + rel(d.time) + '</span></div><h3>' + esc(d.title) + '</h3><p>' + esc(d.summary) + '</p></a>';
      }).catch(function () { if (brief) brief.innerHTML = '<div class="card empty"><b>הסקירה לא נטענה</b>נסה לרענן בעוד רגע.</div>'; });
    }
    loadPrices().then(drawMkts, drawMkts);
  });

  function step(nm, bg, fg, t, s, href) { return '<a class="step" href="' + href + '"><span class="dot" style="background:' + bg + ';color:' + fg + '">' + nm + '</span><span><span class="t">' + t + '</span><span class="s">' + s + '</span></span></a>'; }
  function allocBlock(S) {
    S = S || snap();
    var parts;
    if (S.demo) {
      parts = [['חסכונות פנסיוניים', D.accounts[0].bal + D.accounts[1].bal + D.accounts[2].bal, 'var(--c1)'], ['תיק השקעות', portfolioVal(), 'var(--c2)'], ['אופציות (הבשילו)', optIntrinsic(false), 'var(--c3)'], ['נדל״ן', D.realEstate.val, 'var(--c4)'], ['נזיל', D.accounts[3].bal, 'var(--c5)']];
    } else {
      var c = S.cats || {}, re = (S.realEstateList || []).reduce(function (a, x) { return a + (x.val || 0); }, 0) || (S.realEstate && S.realEstate.val) || 0;
      parts = [
        ['חסכונות פנסיוניים', (c.cat_pension || 0) + (c.cat_hish || 0), 'var(--c1)'],
        ['תיק השקעות', (c.cat_portfolio || 0) + (c.cat_trades || 0), 'var(--c2)'],
        ['אופציות', c.cat_options || 0, 'var(--c3)'],
        ['נדל״ן ונכסים', (c.cat_other || 0) || re, 'var(--c4)'],
        ['נזיל', (c.cat_cash || 0) + (c.cat_bank || 0) + (c.cat_standing || 0), 'var(--c5)']
      ].filter(function (pt) { return pt[1] > 0; });
    }
    var tot = parts.reduce(function (s, pt) { return s + pt[1]; }, 0);
    if (!tot) return '<p class="muted">עוד אין נכסים רשומים. אחרי הכניסה יופיעו החשבונות שלך.</p>';
    return '<div class="alloc" role="img" aria-label="חלוקת נכסים">' + parts.map(function (pt, i) { return '<i style="width:' + (pt[1] / tot * 100).toFixed(1) + '%;background:' + pt[2] + ';animation-delay:' + i * 60 + 'ms"></i>'; }).join('') + '</div>' +
      '<div class="legend">' + parts.map(function (pt) { return '<span><i style="background:' + pt[2] + '"></i>' + pt[0] + ' <span class="num">' + Math.round(pt[1] / tot * 100) + '%</span></span>'; }).join('') + '</div>';
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
    var S = snap(), accounts = S.accounts || [], tot = accounts.reduce(function (s, a) { return s + (a.bal || 0); }, 0);
    var mgain = accounts.reduce(function (s, a) { return s + (a.bal || 0) * (a.m || 0) / 100; }, 0);
    main().innerHTML =
      localBanner() +
      '<section class="hero"><div class="lbl">כל החסכונות ' + demoBadge(S) + '</div><div class="big">' + ils(tot) + '</div>' +
      (mgain ? '<div class="chg"><span class="gain">▲ ' + ils(mgain) + '</span> <span class="muted">החודש</span></div>' : '<div class="chg muted">' + (signedIn() ? 'יתרות שנשמרו בחשבון' : 'יתרות שנשמרו במכשיר') + '</div>') +
      feeLine(accounts) + '</section>' +
      (accounts.length ? ('<section class="card" style="margin-top:12px"><div class="alloc" role="img" aria-label="חלוקת החסכונות">' + accounts.map(function (a, i) { return '<i style="width:' + (tot ? (a.bal / tot * 100).toFixed(1) : 0) + '%;background:' + a.color + ';animation-delay:' + i * 60 + 'ms"></i>'; }).join('') + '</div>' +
      '<div class="list">' + accounts.map(function (a) {
        return '<button class="row" data-acc="' + a.id + '"><span class="ic" style="background:color-mix(in srgb,' + a.color + ' 15%,transparent);color:' + a.color + '">' + ic(a.ic) + '</span><span class="tx"><span class="t">' + esc(a.name) + '</span><span class="s">' + esc(a.sub) + (a.flag ? ' · <b class="loss">דמי ניהול גבוהים</b>' : '') + '</span></span><span class="v"><b>' + ils(a.bal) + '</b>' + (a.m ? '<small class="' + cls(a.m) + '">' + pct(a.m, true) + '</small>' : '') + '</span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</button>';
      }).join('') + '</div></section>') : '<section class="card empty" style="margin-top:12px"><b>עוד אין חסכונות רשומים</b>אחרי הכניסה יופיעו הקרנות והפיקדונות שלך.</section>') +
      '<h2 class="sec">יעדים</h2><section class="card">' + ((S.goals && S.goals.length) ? S.goals.map(function (g) { var pr = g.tgt ? Math.min(100, g.cur / g.tgt * 100) : 0; return '<div style="padding:6px 0"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc(g.name) + '</b><span class="muted">' + ils(g.cur) + ' מתוך ' + ils(g.tgt) + '</span></div><div class="prog" role="img" aria-label="' + Math.round(pr) + ' אחוז"><i style="width:' + pr + '%"></i></div></div>'; }).join('') : '<p class="muted">עדיין אין יעדים. אפשר להוסיף ב<a href="../goals.html">עמוד היעדים</a>.</p>') + '</section>' +
      '<h2 class="sec">כלים</h2><div class="tiles">' +
        tile('#/compare/funds?type=pension', 'השוואת קרנות', 'מצא מסלול זול יותר') +
        tile('../retirement.html', 'תחזית פנסיה', 'כמה תקבל בפרישה') +
        tile('../goals.html', 'יעדים', 'הוסף או ערוך יעד') +
        tile('../cashflow.html', 'תחזית ל־12 חודשים', 'כמה יישאר לחיסכון') + '</div>';
    bindBanner();
    $$('[data-acc]').forEach(function (b) { b.addEventListener('click', function () { accSheet(accounts.filter(function (a) { return a.id === b.dataset.acc; })[0], S.demo); }); });
  });
  /* v2b merge: fees in shekels (percent is hard to feel; shekels are not) */
  function feeLine(accounts) {
    accounts = accounts || (snap().accounts || []);
    if (window.NextExtras && typeof NextExtras.feeLine === 'function') return NextExtras.feeLine(accounts, window.NextApp);
    var y = accounts.reduce(function (s, a) { var m = /([\d.]+)%\s*מצבירה/.exec(a.fee || ''); return s + (m ? a.bal * parseFloat(m[1]) / 100 : 0); }, 0);
    return y ? '<p class="help">דמי ניהול מהצבירה: כ־' + ils(y) + ' בשנה (' + ils(y / 12) + ' בחודש)</p>' : '';
  }
  function tile(href, k, d) { return '<a class="tile" href="' + href + '"><span class="k">' + k + '</span><span class="d muted" style="font-weight:500">' + d + '</span></a>'; }
  function accSheet(a, isDemo) {
    if (!a) return;
    var type = a.group === 'pension' ? 'pension' : a.group === 'gemel' ? 'gemel' : 'hishtalmut';
    openSheet('<h2 id="sheet-title">' + esc(a.name) + '</h2><div class="muted">' + esc(a.sub) + ' ' + (isDemo ? DEMO : '') + '</div>' +
      '<div class="kv"><div><span>יתרה</span><b>' + ils(a.bal) + '</b></div><div><span>החודש</span><b class="' + cls(a.m) + '">' + pct(a.m, true) + '</b></div><div style="grid-column:1/-1"><span>דמי ניהול</span><b style="font-size:16px">' + a.fee + '</b></div></div>' +
      (a.group !== 'deposits' ? '<a class="btn pri block" href="#/compare/funds?type=' + type + '" data-close>השווה למסלולים אחרים</a>' : '<a class="btn pri block" href="#/compare/savings" data-close>השווה ריביות פיקדונות</a>') +
      '<button class="btn sec block" style="margin-top:8px" data-close>סגור</button>');
  }

  /* --- INVEST --- */
  route(/^\/invest$/, 'invest', function () {
    drawBar('השקעות');
    main().innerHTML = localBanner() + '<div id="inv"></div>';
    bindBanner();
    function draw() {
      var S = snap(), pv = S.portfolioVal, pc = S.portfolioCost, g = pv - pc;
      var opt = S.options, oi = opt ? opt.valVested : 0, oa = opt ? opt.valAll : 0;
      var holdHtml = (S.holdings && S.holdings.length) ? S.holdings.map(function (h) {
        var pxv = h.price, cur = h.cur === 'USD' ? '$' : '₪';
        return '<div class="row" style="cursor:default"><span class="ic">' + ic('chart') + '</span><span class="tx"><span class="t">' + esc(h.name) + '</span><span class="s">' + n(h.qty) + ' יח׳ · <span class="num">' + (pxv == null ? '—' : cur + NF2.format(pxv)) + '</span></span></span><span class="v"><b>' + ils(h.valueILS || 0) + '</b>' + (h.ch ? '<small class="' + cls(h.ch) + '">' + pct(h.ch, true) + ' היום</small>' : '') + '</span></div>';
      }).join('') : '<p class="muted">עדיין אין אחזקות. אפשר להוסיף אותן ב<a href="../portfolio.html">עמוד התיק</a>.</p>';
      var st = S.standing && S.standing[0];
      var stBlock = st ? ('<div class="card-h" style="margin-top:20px"><h2 class="sec" style="margin:0">הוראת קבע להשקעה</h2>' + (S.demo ? '<button class="more" id="so-edit" style="border:0;background:none;cursor:pointer">עריכה</button>' : '<a class="more" href="../portfolio.html">ניהול ‹</a>') + '</div><section class="card"><div style="display:flex;align-items:center;gap:12px"><span class="ic" style="width:40px;height:40px;border-radius:999px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary)">' + ic('repeat') + '</span><div style="flex:1"><b>' + ils(st.amt) + ' בחודש</b><div class="muted" style="font-size:15px">' + esc(st.when || '') + (st.split ? ' · ' + esc(st.split) : '') + '</div></div>' + demoBadge(S) + '</div>' +
        (st.projected ? '<p class="help">הערכה לעתיד לפי ההנחה שנשמרה: כ־' + ils(st.projected) + '</p>' : '') + '</section>') : ('<h2 class="sec">הוראת קבע להשקעה</h2><section class="card"><p class="muted">אין הוראת קבע עדיין. <a href="../portfolio.html">להוספה</a></p></section>');
      var assets = (S.realEstateList && S.realEstateList.length) ? S.realEstateList : (S.realEstate ? [S.realEstate] : []);
      var assetRows = assets.map(function (a) { return '<div class="row" style="cursor:default"><span class="ic">' + ic('house') + '</span><span class="tx"><span class="t">' + esc(a.name) + '</span><span class="s">שווי</span></span><span class="v"><b>' + ils(a.val) + '</b></span></div>'; }).join('') || '<div class="row" style="cursor:default"><span class="tx"><span class="t muted">אין נכסי נדל״ן רשומים</span></span></div>';
      var optCard = opt ? ('<a class="card cardlink" href="#/invest/options" style="margin-top:12px;display:block"><div class="card-h"><h2>אופציות עובדים</h2>' + ic('chev').replace('<svg', '<svg class="chev" style="width:20px;height:20px;color:var(--muted)"') + '</div>' +
          '<div class="kv"><div><span>שווי הבשילו</span><b>' + ils(oi) + '</b></div><div><span>שווי כל המנות</span><b>' + ils(oa) + '</b></div></div><div class="prog"><i style="width:' + (opt.total ? (opt.vested / opt.total * 100) : 0) + '%"></i></div><div class="muted" style="font-size:14px">' + n(opt.vested) + ' מתוך ' + n(opt.total) + ' ניתנות למימוש ' + demoBadge(S) + '</div></a>') : '<a class="card cardlink" href="#/invest/options" style="margin-top:12px;display:block"><div class="card-h"><h2>אופציות עובדים</h2>' + ic('chev').replace('<svg', '<svg class="chev" style="width:20px;height:20px;color:var(--muted)"') + '</div><p class="muted" style="margin:0">אין מענקים רשומים עדיין.</p></a>';
      $('#inv').innerHTML =
        '<section class="hero"><div class="lbl">תיק ההשקעות ' + demoBadge(S) + '</div><div class="big">' + ils(pv) + '</div><div class="chg">' + (pc ? '<span class="' + cls(g) + '">' + arrow(g) + ' ' + ils(g) + ' (' + pct(g / pc * 100, true) + ')</span> <span class="muted">מאז הקנייה</span>' : '<span class="muted">שערים מתעדכנים מהשוק</span>') + '</div>' + (S.demo ? '<p class="help">מחירים אמיתיים מהשוק · כמויות לדוגמה</p>' : '') + '</section>' +
        '<section class="card" style="margin-top:12px"><div class="card-h"><h2>אחזקות</h2><a class="more" href="../portfolio.html">ניהול ‹</a></div><div class="list">' + holdHtml + '</div></section>' +
        optCard + stBlock +
        '<h2 class="sec">נכסים נוספים</h2><section class="card"><div class="list">' + assetRows +
        (S.debts ? '<div class="row" style="cursor:default"><span class="ic" style="background:var(--loss-soft);color:var(--loss)">' + ic('bank') + '</span><span class="tx"><span class="t">הלוואות וחובות</span><span class="s">יתרה לסילוק</span></span><span class="v"><b class="loss">' + ils(-S.debts) + '</b></span></div>' : '') + '</div></section>';
    }
    draw(); loadPrices().then(draw, function () {});
    $('#inv').addEventListener('click', function (e) { if (e.target.closest('#so-edit') && snap().demo) soSheet(draw); });
  });
  /* v2b merge: standing order into the portfolio, edited in a bottom sheet (amount stepper, day, split, assumption shown) */
  function ST() { try { var s = JSON.parse(localStorage.getItem('next-standing-demo') || localStorage.getItem('v2-standing') || 'null'); if (s && s.amt) return s; } catch (e) {} return D.standing; }
  function soSheet(redraw) {
    if (window.NextExtras && typeof NextExtras.soSheet === 'function') return NextExtras.soSheet(redraw, window.NextApp);
    var s = JSON.parse(JSON.stringify(ST())), syms = D.holdings.map(function (h) { return h.sym; });
    function body() {
      return '<h2 id="sheet-title">הוראת קבע לתיק</h2><p class="muted" style="margin:0 0 12px">' + DEMO.replace('נתוני דוגמה', 'אב־טיפוס: נשמר במכשיר בלבד, לא נשלח לבנק') + '</p>' +
        '<div class="field"><label for="so-amt">סכום חודשי</label><div class="stepper" data-step="100"><button type="button" data-k="-1" aria-label="פחות 100">−</button><input id="so-amt" inputmode="numeric" value="' + s.amt + '"><button type="button" data-k="1" aria-label="יותר 100">+</button></div></div>' +
        '<div class="field"><span class="lbl">יום בחודש</span><div class="chips" id="so-day" style="margin:0;padding:0">' + [1, 10, 15, 25].map(function (d) { return '<button type="button" class="chip" data-v="' + d + '" aria-pressed="' + (d === s.day) + '">' + d + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">חלוקה</span><div id="so-split">' + s.split.map(function (x, i) { return '<div class="splitrow"><label for="sp' + i + '">' + esc(x[0]) + '</label><input type="range" id="sp' + i + '" min="0" max="100" step="5" value="' + x[1] + '"><span class="num" id="spv' + i + '">' + x[1] + '%</span></div>'; }).join('') + '</div>' +
        '<p class="help">בישראל הוראת קבע אפשרית בעיקר לקרנות סל ולקרנות נאמנות.</p></div>' +
        '<p class="help" id="so-proj"></p><button class="btn pri block" id="so-save" style="margin-top:12px">שמירה</button><button class="btn sec block" style="margin-top:8px" data-close>ביטול</button>';
    }
    openSheet(body());
    function proj() { $('#so-proj').innerHTML = 'בעוד 10 שנים: כ־' + ils(fv(+$('#so-amt').value || 0, 0.06, 10)) + ', בהנחת תשואה של 6% בשנה. הנחה בלבד, לא תחזית ולא ייעוץ.'; }
    proj();
    $('#so-amt').addEventListener('input', proj);
    $$('.stepper button').forEach(function (b) {
      var t, iv, k = +b.dataset.k;
      function bump() { var i = $('#so-amt'); i.value = Math.max(100, (Math.round((+i.value || 0) / 100) + k) * 100); proj(); }
      b.addEventListener('pointerdown', function () { bump(); t = setTimeout(function () { iv = setInterval(bump, 70); }, 400); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(t); clearInterval(iv); }); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bump(); } });
    });
    $$('#so-day .chip').forEach(function (c) { c.addEventListener('click', function () { $$('#so-day .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c); }); s.day = +c.dataset.v; }); });
    $$('#so-split input').forEach(function (r, i) { r.addEventListener('input', function () { var v = +r.value; s.split[i][1] = v; if (s.split.length === 2) { s.split[1 - i][1] = 100 - v; $('#sp' + (1 - i)).value = 100 - v; $('#spv' + (1 - i)).textContent = (100 - v) + '%'; } $('#spv' + i).textContent = v + '%'; }); });
    $('#so-save').addEventListener('click', function () { s.amt = +$('#so-amt').value || s.amt; localStorage.setItem('v2-standing', JSON.stringify(s)); closeSheet(); redraw(); toast('הוראת הקבע עודכנה'); });
  }
  function fv(m, r, y) { var i = r / 12, k = y * 12; return m * ((Math.pow(1 + i, k) - 1) / i); }

  /* --- OPTIONS --- */
  route(/^\/invest\/options$/, 'invest', function () {
    drawBar('אופציות עובדים', true);
    var S = snap(), o = S.options;
    if (!o) {
      main().innerHTML = localBanner() + '<section class="card empty"><b>אין עדיין מענקי אופציות</b>אפשר לרשום אותם ב<a href="../options.html">יומן האופציות</a>. ' + (signedIn() ? 'הנתונים נשמרים בחשבון שלך.' : 'הנתונים נשמרים במכשיר שלך.') + '</section>';
      bindBanner();
      return;
    }
    main().innerHTML =
      localBanner() +
      '<section class="hero"><div class="lbl">' + esc(o.company) + ' ' + demoBadge(S) + '</div><div class="big" id="ov">' + ils(o.valVested) + '</div><div class="chg muted">שווי פנימי של המנות שניתנות למימוש</div></section>' +
      (o.editable ? ('<section class="card" style="margin-top:12px"><div class="fields"><div class="field"><label for="op-p">מחיר מניה</label><div class="inp"><input id="op-p" inputmode="decimal" value="' + Number(o.price).toFixed(2) + '"><span class="u">₪</span></div></div>' +
      '<div class="field"><label for="op-k">מחיר מימוש</label><div class="inp"><input id="op-k" inputmode="decimal" value="' + Number(o.strike).toFixed(2) + '"><span class="u">₪</span></div></div></div>' +
      '<div class="kv" id="okv"></div><p class="help">מימוש נטו: לא משלמים את מחיר המימוש, ומקבלים מניות בשווי הרווח בלבד. מס לפי סעיף 102 במסלול רווח הון (' + (o.tax || 25) + '%) — הערכה בלבד, לא ייעוץ.</p></section>') : ('<section class="card" style="margin-top:12px"><div class="kv"><div><span>מחיר מניה</span><b>' + (o.price != null ? ils(o.price, true) : '—') + '</b></div><div><span>מחיר מימוש מתואם</span><b>' + (o.strike != null ? ils(o.strike, true) : '—') + '</b></div><div><span>הבשילו וניתנות למימוש</span><b>' + n(o.vested) + ' מתוך ' + n(o.total) + '</b></div><div><span>אחרי מס משוער</span><b>' + ils(o.net != null ? o.net : o.valAll * (1 - (o.tax || 25) / 100)) + '</b></div></div><p class="help">המס בפועל תלוי במסלול המענק (למשל סעיף 102) ובמצב האישי. הערכה בלבד, לא ייעוץ.</p><a class="btn sec block" href="../options.html">לפתיחת היומן המלא</a></section>')) +
      '<h2 class="sec">מנות הבשלה</h2><section class="card"><div class="tl" id="otl"></div></section>' +
      '<p class="help" style="text-align:center"><a href="../options.html">למחשבון וליומן האופציות ‹</a></p>';
    bindBanner();
    function calc() {
      var price = o.editable ? (parseFloat($('#op-p').value) || 0) : (o.price || 0);
      var k = o.editable ? (parseFloat($('#op-k').value) || 0) : (o.strike || 0);
      var gain = Math.max(0, price - k);
      var vested = o.vested, all = o.total, gross = o.editable ? gain * vested : o.valVested;
      var tax = gross * ((o.tax || 25) / 100);
      var netShares = price > 0 ? Math.floor(vested * gain / price) : 0;
      $('#ov').innerHTML = ils(gross);
      if (o.editable && $('#okv')) $('#okv').innerHTML = '<div><span>הבשילו</span><b>' + n(vested) + ' מתוך ' + n(all) + '</b></div><div><span>רווח לאופציה</span><b>' + ils(gain, true) + '</b></div><div><span>מניות במימוש נטו</span><b>' + n(netShares) + '</b></div><div><span>אחרי מס משוער</span><b>' + ils(gross - tax) + '</b></div>';
      if ($('#otl')) $('#otl').innerHTML = (o.tranches || []).map(function (t, i) {
        var done = t.done || (t.vest && new Date(t.vest) <= TODAY);
        var prev = o.tranches[i - 1];
        var next = !done && (i === 0 || (prev && (prev.done || (prev.vest && new Date(prev.vest) <= TODAY))));
        var dd = function (x) { return x ? new Date(x).toLocaleDateString('he-IL') : ''; };
        var val = t.value != null ? t.value : gain * t.n;
        return '<div class="it ' + (done ? 'done' : next ? 'next' : '') + '"><span class="b"></span><div style="flex:1"><div class="tt">' + n(t.n) + ' אופציות · ' + (done ? 'הבשילו' : 'מבשילות') + (t.vest ? ' ' + dd(t.vest) : '') + '</div><div class="muted" style="font-size:15px">' + (t.exp ? 'פוקעות ' + dd(t.exp) + ' · ' : '') + 'שווי ' + ils(val) + '</div></div></div>';
      }).join('');
    }
    calc();
    if (o.editable) $$('#op-p,#op-k').forEach(function (el) { el.addEventListener('input', calc); });
  });

  route(/^\/fund\/(pensianet|gemelnet)\/(\d+)$/, 'compare', function (m) {
    if (window.NextExtras && typeof NextExtras.fundDetail === 'function') { drawBar('פרטי מסלול', true); return NextExtras.fundDetail(main(), m[1], m[2], window.NextApp); }
    var set = m[1], id = m[2];
    drawBar('פרטי מסלול', true);
    main().innerHTML = '<section class="hero"><div class="skel l" style="width:40%"></div><div class="skel h"></div><div class="skel" style="height:44px;width:35%;margin:8px 0"></div><div class="chart" style="height:168px"><div class="skel" style="height:168px"></div></div></section>' +
      '<section class="card" style="margin-top:12px"><div class="skel r"></div><div class="skel r"></div></section>';
    load('../funds.json').then(function (F) {
      var S = F.sets[set], f = S && S.funds.filter(function (x) { return String(x.id) === id; })[0];
      if (!f) { main().innerHTML = '<div class="card empty"><b>לא מצאנו את המסלול</b>ייתכן שהוא נסגר. <a href="#/compare">להשוואות</a></div>'; return; }
      $('#page-title').textContent = f.cls === 'קרנות השתלמות' ? 'קרן השתלמות' : set === 'pensianet' ? 'קרן פנסיה' : 'קופת גמל';
      var peers = S.funds.filter(function (x) { return x.cls === f.cls && trackOf(x) === trackOf(f) && x.ytd != null && x.assets >= 20; });
      function med(k) { var a = peers.map(function (x) { return x[k]; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; }); return a.length ? a[Math.floor(a.length / 2)] : null; }
      var mo = S.monthly && S.monthly[String(f.id)], keys = mo ? Object.keys(mo).sort() : [], ser = [100], v = 100;
      keys.forEach(function (k) { v *= 1 + mo[k] / 100; ser.push(v); });
      var HM = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
      var per = function (p) { return HM[+String(p).slice(4, 6) - 1] + ' ' + String(p).slice(0, 4); };
      var dv = f.ytd - (med('ytd') || 0);
      main().innerHTML =
        '<section class="hero"><div class="lbl">' + esc(f.mgr || f.parent || '') + '</div><h2 style="font-size:20px;margin:4px 0 0">' + esc(f.name) + '</h2>' +
        '<div class="big" id="fv">' + pct(f.ytd, true) + '</div><div class="chg" id="fvl"><span class="' + cls(dv) + '">' + arrow(dv) + ' ' + pct(dv, true) + '</span> <span class="muted">מול חציון המסלול · תשואה מתחילת השנה</span></div>' +
        (ser.length > 2 ? '<div class="chart" id="fc"></div><p class="help" style="text-align:center">שווי של 100 ₪ מ' + per(keys[0]) + ' עד ' + per(keys[keys.length - 1]) + ' · גרור על הגרף</p>' : '') + '</section>' +
        '<section class="card" style="margin-top:12px"><div class="kv">' + [['דמי ניהול מצבירה', pct(f.feeAcc)], ['דמי ניהול מהפקדה', f.feeDep != null ? pct(f.feeDep) : '—'], ['תשואה 5 שנים (מצטבר)', f.c5 != null ? pct(f.c5, true) : '—'], ['תשואה 3 שנים (מצטבר)', f.c3 != null ? pct(f.c3, true) : '—'], ['סטיית תקן', f.sd != null ? pct(f.sd) : '—'], ['גודל', n(f.assets / 1000, true) + ' מיליארד ₪']].map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div></section>' +
        '<h2 class="sec">מול ' + n(peers.length) + ' מסלולים דומים</h2><section class="card"><div class="mbars">' + [['מתחילת השנה', 'ytd'], ['3 שנים (שנתי)', 'y3'], ['5 שנים (שנתי)', 'y5']].map(function (r) {
          var a = f[r[1]], b = med(r[1]), mx = Math.max(Math.abs(a || 0), Math.abs(b || 0)) || 1;
          return '<div class="mb-h">' + r[0] + '</div><div class="mb"><span>המסלול</span><i><b class="me" style="width:' + Math.max(2, Math.abs(a || 0) / mx * 100) + '%"></b></i>' + (a == null ? '—' : pct(a)) + '</div><div class="mb"><span>חציון</span><i><b style="width:' + Math.max(2, Math.abs(b || 0) / mx * 100) + '%"></b></i>' + (b == null ? '—' : pct(b)) + '</div>';
        }).join('') + '</div></section>' +
        '<h2 class="sec">אותו מסלול, דמי ניהול נמוכים יותר</h2><section class="card" style="padding:8px 16px"><div class="list" id="alts"></div></section>' +
        '<p class="help" style="text-align:center">מקור: רשות שוק ההון · נתוני ' + per(S.period) + ' · מידע בלבד, לא ייעוץ. תשואות עבר אינן מבטיחות תשואות בעתיד.</p>';
      var alts = peers.filter(function (x) { return x.id !== f.id && x.feeAcc < f.feeAcc && x.y5 != null; }).sort(function (a, b) { return b.y5 - a.y5; }).slice(0, 5);
      $('#alts').innerHTML = alts.length ? alts.map(function (x) { return '<a class="row" href="#/fund/' + set + '/' + x.id + '"><span class="tx"><span class="t wrap">' + esc(x.name) + '</span><span class="s">דמי ניהול ' + pct(x.feeAcc) + '</span></span><span class="v"><b class="' + cls(x.y5) + '">' + pct(x.y5, true) + '</b><small class="muted">לשנה, 5 שנים</small></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</a>'; }).join('') : '<div class="empty"><b>דמי הניהול כאן כבר מהנמוכים</b>אין במסלול הזה מסלול זול יותר עם נתוני 5 שנים.</div>';
      if (ser.length > 2) chart($('#fc'), ser, { label: 'תשואה מצטברת', onScrub: function (i) {
        if (i < 0) { $('#fv').innerHTML = pct(f.ytd, true); $('#fvl').innerHTML = '<span class="' + cls(dv) + '">' + arrow(dv) + ' ' + pct(dv, true) + '</span> <span class="muted">מול חציון המסלול · תשואה מתחילת השנה</span>'; return; }
        $('#fv').innerHTML = pct(ser[i] - 100, true); $('#fvl').innerHTML = '<span class="muted">' + (i ? 'מצטבר עד סוף ' + per(keys[i - 1]) : 'נקודת ההתחלה') + '</span>';
      } });
    }).catch(function () { main().innerHTML = '<div class="card empty"><b>הנתונים לא נטענו</b>בדוק חיבור ונסה שוב.</div>'; });
  });

  /* --- COMPARE hub --- */
  route(/^\/compare$/, 'compare', function () {
    drawBar('השוואות');
    var items = [
      ['#/compare/funds?type=pension', 'umbrella', 'קרנות פנסיה', 'דמי ניהול ותשואות של כל הקרנות'],
      ['#/compare/funds?type=hishtalmut', 'grad', 'קרנות השתלמות', 'לפי מסלול, תשואה ודמי ניהול'],
      ['#/compare/funds?type=gemel', 'piggy', 'קופות גמל להשקעה', 'כולל מסלולי S&P 500'],
      ['#/compare/savings', 'bank', 'פיקדונות וריביות', 'ריבית ממוצעת בכל בנק'],
      ['#/compare/mortgage', 'house', 'מחזור משכנתא', 'האם כדאי למחזר ובכמה תחסוך'],
      ['#/compare/cards', 'key', 'כרטיסי אשראי', 'עמלות והטבות'],
      ['#/compare/loans', 'bank', 'הלוואות', 'ריביות ממוצעות והשוואה']
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
  function comparePlaceholder(title, href) {
    return function () {
      drawBar(title, true);
      main().innerHTML = '<section class="card"><h2 style="margin-top:0">' + title + '</h2><p class="muted">עמוד ההשוואה המלא בגרסה החדשה יופיע כאן. בינתיים אפשר לפתוח את העמוד הקיים, עם אותם נתונים רשמיים.</p><a class="btn pri block" href="' + href + '">לפתיחת ההשוואה</a></section>';
    };
  }
  route(/^\/compare\/savings$/, 'compare', function () {
    if (window.NextCompare && NextCompare.savings) { drawBar('פיקדונות', true); return NextCompare.savings(main(), window.NextApp); }
    comparePlaceholder('פיקדונות וריביות', '../compare-savings.html')();
  });
  route(/^\/compare\/cards$/, 'compare', function () {
    if (window.NextCompare && NextCompare.cards) { drawBar('כרטיסי אשראי', true); return NextCompare.cards(main(), window.NextApp); }
    comparePlaceholder('כרטיסי אשראי', '../compare-cards.html')();
  });
  route(/^\/compare\/mortgage$/, 'compare', function () {
    if (window.NextCompare && NextCompare.mortgage) { drawBar('מחזור משכנתא', true); return NextCompare.mortgage(main(), window.NextApp); }
    comparePlaceholder('מחזור משכנתא', '../compare-mortgage.html')();
  });
  route(/^\/compare\/loans$/, 'compare', function () {
    if (window.NextCompare && NextCompare.loans) { drawBar('הלוואות', true); return NextCompare.loans(main(), window.NextApp); }
    comparePlaceholder('הלוואות', '../loans.html')();
  });

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
        return '<div class="row" style="cursor:default"><span class="tx"><a class="t wrap fundlink" href="#/fund/' + (type === 'pension' ? 'pensianet' : 'gemelnet') + '/' + f.id + '">' + esc(f.name) + '</a><span class="s">דמי ניהול ' + pct(f.feeAcc) + '</span></span>' +
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
    if (window.NextNews && typeof NextNews.list === 'function') { drawBar('חדשות'); return NextNews.list(main(), q, window.NextApp); }
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
  route(/^\/news\/week$/, 'news', function () {
    drawBar('סיכום שבועי', true);
    if (window.NextNews && typeof NextNews.week === 'function') return NextNews.week(main(), window.NextApp);
    main().innerHTML = '<section class="card empty"><b>סיכום השבוע יופיע כאן</b>המסך בבנייה.</section>';
  });
  route(/^\/news\/month$/, 'news', function () {
    drawBar('סיכום חודשי', true);
    if (window.NextNews && typeof NextNews.month === 'function') return NextNews.month(main(), window.NextApp);
    main().innerHTML = '<section class="card empty"><b>סיכום החודש יופיע כאן</b>המסך בבנייה, עם סטטיסטיקות וגרפים.</section>';
  });
  route(/^\/news\/heatmap$/, 'news', function () {
    drawBar('מפת שוק', true);
    if (window.NextNews && typeof NextNews.heatmap === 'function') return NextNews.heatmap(main(), window.NextApp);
    main().innerHTML = '<section class="card empty"><b>מפת השוק תופיע כאן</b>המסך בבנייה.</section>';
  });
  route(/^\/news\/alerts$/, 'news', function () {
    if (window.NextNews && typeof NextNews.alerts === 'function') { drawBar('התראות', true); return NextNews.alerts(main(), window.NextApp); }
    drawBar('התראות', true);
    var prefs = JSON.parse(localStorage.getItem('v2-alerts') || '{"open":true,"mid":false,"close":true,"week":true,"month":true,"break":false}');
    var opts = [['open', 'סקירת פתיחה', 'בוקר: ישראל, אסיה ואירופה'], ['mid', 'סקירת אמצע יום', 'פתיחת וול סטריט'], ['close', 'סקירת נעילה', 'ערב: סיכום יום המסחר'], ['week', 'סיכום שבועי', 'מה היה השבוע ומה צפוי'], ['month', 'סיכום חודשי', 'סטטיסטיקות וגרפים לסוף החודש'], ['break', 'חדשות מתפרצות', 'רק אירועים משמעותיים']];
    main().innerHTML = '<p class="muted" style="margin:4px 4px 12px">בחר מה לקבל. הכול בחינם. ' + DEMO.replace('נתוני דוגמה', 'אב־טיפוס: נשמר במכשיר בלבד') + '</p><section class="card"><div class="list">' + opts.map(function (o) {
      return '<label class="row" for="a-' + o[0] + '"><span class="tx"><span class="t">' + o[1] + '</span><span class="s">' + o[2] + '</span></span><input type="checkbox" id="a-' + o[0] + '" data-k="' + o[0] + '"' + (prefs[o[0]] ? ' checked' : '') + ' style="width:28px;height:28px;accent-color:var(--primary)"></label>';
    }).join('') + '</div></section>';
    $$('[data-k]').forEach(function (c) { c.addEventListener('change', function () { prefs[c.dataset.k] = c.checked; localStorage.setItem('v2-alerts', JSON.stringify(prefs)); toast(c.checked ? 'נרשמת: ' + c.closest('.row').querySelector('.t').textContent : 'בוטל'); }); });
  });
  route(/^\/news\/(.+)$/, 'news', function (m) {
    if (window.NextNews && typeof NextNews.brief === 'function') { drawBar('סקירה', true); return NextNews.brief(main(), decodeURIComponent(m[1]), window.NextApp); }
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
    var in_ = signedIn(), u = in_ && PortalCloud.user;
    var name = greetName() || (u && u.email) || 'אורח';
    var sub = in_ ? ((u && u.email) || 'מחובר') : (hasLocalData() ? 'הנתונים שמורים במכשיר הזה בלבד' : 'עוד אין נתונים. עד שמזינים, מוצגים נתוני דוגמה');
    var initial = String(name).trim().charAt(0).toUpperCase();
    main().innerHTML =
      '<section class="card" style="display:flex;align-items:center;gap:14px"><span id="me-avatar"><span class="avatar" style="width:56px;height:56px;font-size:24px">' + esc(initial) + '</span></span><div style="flex:1;min-width:0"><b style="font-size:18px">' + esc(name) + '</b><div class="muted" style="font-size:15px">' + esc(sub) + '</div></div>' +
      (in_ ? '<button type="button" class="btn sec" id="me-account">החשבון</button>' : '<button type="button" class="btn pri" id="me-signin">כניסה</button>') + '</section>' +
      '<h2 class="sec">כלים</h2><section class="card"><div class="list">' +
      [['../report.html', 'doc', 'דוח פיננסי אישי', 'עמוד אחד להדפסה או PDF'], ['../tax.html', 'calc', 'עוזר מס', 'נקודות זיכוי, החזר ומס על אופציות'], ['../retirement.html', 'umbrella', 'תחזית פנסיה', 'גבוה, בינוני ונמוך'], ['../avatar.html', 'target', 'האווטאר שלי', 'מותאם לפי סלפי, בדפדפן בלבד'], ['#/tools', 'plus', 'כל הכלים', 'הזנת נתונים, תכנון ומחשבונים']].map(rowLink).join('') + '</div></section>' +
      '<h2 class="sec">תצוגה</h2><section class="card"><div class="seg" id="th" role="group" aria-label="ערכת צבעים"><button data-v="auto" aria-pressed="' + (theme === 'auto') + '">לפי המכשיר</button><button data-v="light" aria-pressed="' + (theme === 'light') + '">בהיר</button><button data-v="dark" aria-pressed="' + (theme === 'dark') + '">כהה</button></div></section>' +
      '<h2 class="sec">עזרה</h2><section class="card"><div class="list">' + [['../feedback.html', 'chat', 'שלח משוב', 'מה לשפר'], ['#/about', 'info', 'איך זה עובד ומאיפה הנתונים', 'מקורות רשמיים ותאריכי עדכון'], ['../privacy.html', 'shield', 'פרטיות', 'מה נשמר ואיפה'], ['#/terms', 'doc', 'תנאי שימוש', ''], ['#/accessibility', 'check', 'הצהרת נגישות', ''], ['../index.html?classic=1', 'home', 'לתצוגה הקודמת של האתר', '']].map(rowLink).join('') + '</div></section>' +
      '<p class="help soon" style="text-align:center">בקרוב: מעקב הוצאות ומינויים</p>';
    segmented($('#th'), function (v) { localStorage.setItem('v2-theme', v); applyTheme(); });
    var si = $('#me-signin') || $('#me-account');
    if (si && window.PortalCloud) si.addEventListener('click', function () { PortalCloud.openDialog(); });
    paintAvatar();
  });
  function rowLink(r) { return '<a class="row" href="' + r[0] + '"><span class="ic">' + ic(r[1]) + '</span><span class="tx"><span class="t">' + r[2] + '</span>' + (r[3] ? '<span class="s">' + r[3] + '</span>' : '') + '</span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</a>'; }
  function applyTheme() { var t = localStorage.getItem('v2-theme') || 'auto'; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }

  /* ---------- public hooks for sibling workers (news, avatar, compare, extras) ---------- */
  window.NextApp = {
    route: route, replaceRoute: replaceRoute, go: go, drawBar: drawBar, drawTabs: drawTabs, main: main,
    $: $, $$: $$, ic: ic, esc: esc, ils: ils, pct: pct, n: n, cls: cls, arrow: arrow, rel: rel, load: load,
    toast: toast, openSheet: openSheet, closeSheet: closeSheet, signedIn: signedIn, snap: snap, ext: ext,
    DEMO: DEMO, greetTitle: greetTitle, paintAvatar: paintAvatar, chart: chart, segmented: segmented, rowLink: rowLink, hasLocalData: hasLocalData
  };

  /* boot: wait for cloud session; defer siblings (news.js, avatar-next.js, extras.js) run before DOMContentLoaded */
  applyTheme();
  function boot() {
    var start = function () { go(); };
    if (window.PortalCloud && PortalCloud.ready) PortalCloud.ready.then(start, start);
    else start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('portal-cloud', function () { lastPath = null; go(); });
  (window.requestIdleCallback || setTimeout)(function () { load('../data/news.json').catch(function () {}); loadPrices().catch(function () {}); });
})();
