/* Balances portal: shared logic (storage, i18n, nav, FX/quotes, list editor, calculations, pages). No backend, no tracking. */
(function () {
  'use strict';
  var DATA_KEY = 'portal-data-v1', SETTINGS_KEY = 'portal-settings-v1', QUOTES_KEY = 'portal-quotes-v1', OPTIONS_KEY = 'options-calc-v5-private';
  var I18N = window.PORTAL_I18N;
  var CUR = { ILS: '₪', USD: '$', EUR: '€' };
  var PAGES = [
    ['home', 'index.html', 'nav_home'], ['options', 'options.html', 'nav_options'], ['savings', 'savings.html', 'nav_savings'],
    ['pension', 'pension.html', 'nav_pension'], ['hishtalmut', 'hishtalmut.html', 'nav_hishtalmut'],
    ['mortgage', 'mortgage.html', 'nav_mortgage'], ['cards', 'cards.html', 'nav_cards']
  ];

  /* ---------- storage ---------- */
  function emptyData() {
    return {
      v: 1,
      savings: { cash: [], standing: [], portfolios: [] },
      pension: { funds: [] }, hishtalmut: { funds: [] }, mortgage: { tracks: [] }, cards: { cards: [] },
      home: { assets: [], loans: [], income: [], expenses: [], includeOptions: true, includeMortgagePmt: true, includeCards: true,
              goal: { amount: null, date: '', base: 'net', ret: 0 } },
      fx: { USD: null, EUR: null }
    };
  }
  function merge(base, src) {
    if (!src || typeof src !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (!(k in src)) return;
      if (Array.isArray(base[k])) { if (Array.isArray(src[k])) base[k] = src[k]; }
      else if (base[k] && typeof base[k] === 'object') base[k] = merge(base[k], src[k]);
      else base[k] = src[k];
    });
    return base;
  }
  function readJSON(key) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }
  var data = merge(emptyData(), readJSON(DATA_KEY));
  var settings = merge({ lang: 'he', currency: 'ILS' }, readJSON(SETTINGS_KEY));
  if (!I18N[settings.lang]) settings.lang = 'he';
  if (!CUR[settings.currency]) settings.currency = 'ILS';
  var quotes = readJSON(QUOTES_KEY) || {};
  var saveTimer = null;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { writeJSON(DATA_KEY, data); }, 150); }
  function saveNow() { clearTimeout(saveTimer); writeJSON(DATA_KEY, data); }
  window.addEventListener('pagehide', saveNow);
  function uid() { return Math.random().toString(36).slice(2, 10); }

  /* ---------- helpers ---------- */
  function t(k) { return (I18N[settings.lang] && I18N[settings.lang][k]) || I18N.he[k] || k; }
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function n(v) { var x = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : 0; }
  function nn(v) { var x = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : null; }
  function fmt(v, d) { return (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function money(v, cur, d) {
    if (v === null || !Number.isFinite(v)) return '—';
    cur = cur || settings.currency;
    return (v < 0 ? '-' : '') + (CUR[cur] || '') + fmt(Math.abs(v), d === undefined ? 0 : d);
  }
  function disp(ils, d) { var r = fromILS(ils); return r === null ? t('missing_rate') : money(r, settings.currency, d); }
  function pct(v, d) { return Number.isFinite(v) ? fmt(v, d === undefined ? 1 : d) + '%' : '—'; }
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function parseDate(s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0); }
  function addYears(d, y) { var x = new Date(d); x.setFullYear(x.getFullYear() + y); return x; }
  function fmtDate(d) { return d ? d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() : '—'; }

  /* ---------- FX and quotes ---------- */
  var FX_SYM = { USD: 'ILS=X', EUR: 'EURILS=X' };
  function rateILS(cur) {
    if (cur === 'ILS' || !cur) return 1;
    var m = nn(data.fx[cur]); if (m && m > 0) return m;
    var q = quotes[FX_SYM[cur]]; return q && q.price > 0 ? q.price : null;
  }
  function toILS(v, cur) { var r = rateILS(cur); return r === null ? null : n(v) * r; }
  function fromILS(v) { if (v === null) return null; var r = rateILS(settings.currency); return r === null ? null : v / r; }
  function normQuote(sym, o, src) {
    var price = nn(o.price !== undefined ? o.price : o.regularMarketPrice), cur = o.currency || 'USD';
    if (!(price > 0)) return null;
    if (cur === 'ILA' || cur === 'ILX') { price = price / 100; cur = 'ILS'; }
    if (cur === 'GBp') { price = price / 100; cur = 'GBP'; }
    var tp = o.currentTradingPeriod && o.currentTradingPeriod.regular;
    var state = o.state || o.marketState || null;
    var now = Date.now() / 1000, live;
    if (state) live = /^REGULAR$/i.test(state);
    else if (tp) live = now >= tp.start && now <= tp.end;
    else live = false;
    var time = o.regularMarketTime;
    if (typeof time === 'string') time = Date.parse(time) / 1000;
    return { price: price, currency: cur, time: Number.isFinite(time) ? time : null, live: !!live, source: src, fetchedAt: Date.now() };
  }
  function fetchJSON(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 20000);
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, function (e) { clearTimeout(tm); throw e; });
  }
  function anyOf(ps) {
    return new Promise(function (res, rej) { var left = ps.length; if (!left) rej(new Error('none')); ps.forEach(function (p) { p.then(res, function () { if (--left === 0) rej(new Error('all failed')); }); }); });
  }
  // 1) ./prices.json written by the site build (same origin, never cached). 2) Yahoo spark via public CORS routes. 3) manual.
  function fromPricesJson(symbols) {
    return fetchJSON('prices.json?t=' + Date.now(), 8000).then(function (j) {
      var table = j.symbols || j.quotes || j.prices || j;
      var out = {};
      symbols.forEach(function (s) { var o = table[s] || table[s.toUpperCase()]; if (o && typeof o === 'object') { var q = normQuote(s, o, 'prices.json'); if (q) { if (!o.regularMarketTime && j.generatedAt) q.time = Date.parse(j.generatedAt) / 1000; out[s] = q; } } });
      return out;
    });
  }
  function fromYahoo(symbols) {
    var path = '/v7/finance/spark?symbols=' + symbols.map(encodeURIComponent).join(',') + '&range=1d&interval=1d';
    var y1 = 'https://query1.finance.yahoo.com' + path, y2 = 'https://query2.finance.yahoo.com' + path;
    var routes = [
      ['Yahoo Finance', y1],
      ['Yahoo Finance / allorigins', 'https://api.allorigins.win/raw?url=' + encodeURIComponent(y1)],
      ['Yahoo Finance / allorigins', 'https://api.allorigins.win/raw?url=' + encodeURIComponent(y2)],
      ['Yahoo Finance / codetabs', 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(y1)]
    ];
    return anyOf(routes.map(function (r) {
      return fetchJSON(r[1], 20000).then(function (j) {
        var res = (j && j.spark && j.spark.result) || [], out = {};
        res.forEach(function (x) { var m = x.response && x.response[0] && x.response[0].meta; if (m) { var q = normQuote(x.symbol, m, r[0]); if (q) out[x.symbol] = q; } });
        if (!Object.keys(out).length) throw new Error('empty');
        return out;
      });
    }));
  }
  var fetching = false;
  function refreshQuotes(extra, silent) {
    var syms = ['ILS=X', 'EURILS=X'];
    data.savings.portfolios.forEach(function (p) { p.rows.forEach(function (r) { var s = (r.ticker || '').trim().toUpperCase(); if (s && syms.indexOf(s) < 0) syms.push(s); }); });
    (extra || []).forEach(function (s) { if (syms.indexOf(s) < 0) syms.push(s); });
    fetching = true; emit('quotes');
    function apply(found) { Object.keys(found).forEach(function (s) { quotes[s] = found[s]; }); writeJSON(QUOTES_KEY, quotes); }
    return fromPricesJson(syms).catch(function () { return {}; }).then(function (found) {
      apply(found);
      var missing = syms.filter(function (s) { return !found[s]; });
      if (!missing.length) return true;
      var attempt = function () { return fromYahoo(missing).then(function (f) { apply(f); return true; }); };
      return attempt().catch(function () { return new Promise(function (r) { setTimeout(r, 2000); }).then(attempt); })
        .catch(function () { return Object.keys(found).length > 0; });
    }).then(function (ok) {
      fetching = false; emit('quotes');
      if (!ok && !silent) toast(t('fetch_fail'));
      return ok;
    });
  }
  function quoteLabel(q) {
    if (!q) return '';
    var time = q.time ? new Date(q.time * 1000).toLocaleString(settings.lang === 'he' ? 'he-IL' : settings.lang === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return (q.live ? t('live') : t('last_close')) + (time ? ' · ' + time : '') + ' · ' + q.source;
  }

  /* ---------- events ---------- */
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev) { (listeners[ev] || []).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  function changed() { save(); emit('change'); }

  /* ---------- calculations ---------- */
  var calc = {
    fv: function (pv, pmt, r, nper) { if (nper <= 0) return pv; if (r === 0) return pv + pmt * nper; var g = Math.pow(1 + r, nper); return pv * g + pmt * (g - 1) / r; },
    standing: function (row) {
      var M = n(row.monthly), r = n(row.ret) / 1200, S = parseDate(row.start), T = today(), G = parseDate(row.target);
      var n0 = S && S <= T ? monthsBetween(S, T) + 1 : 0;
      var nG = S && G && S <= G ? monthsBetween(S, G) + 1 : null;
      return { invested: M * n0, valueToday: calc.fv(0, M, r, n0), investedTarget: nG === null ? null : M * nG, projected: nG === null ? null : calc.fv(0, M, r, nG) };
    },
    fund: function (row, kind) {
      var B = n(row.balance), D = n(row.deposit) * (1 - n(row.feeDep) / 100), r = (n(row.ret) - n(row.feeBal)) / 1200, months = null;
      if (kind === 'pension' && nn(row.age) !== null && nn(row.retireAge) !== null) months = Math.max(0, Math.round((n(row.retireAge) - n(row.age)) * 12));
      else { var G = parseDate(row.target); if (G) months = Math.max(0, monthsBetween(today(), G)); }
      var liquidFrom = null, liquid = null;
      if (kind === 'hishtalmut') { var O = parseDate(row.openDate); if (O) { liquidFrom = addYears(O, 6); liquid = today() >= liquidFrom; } }
      return { months: months, depositNet: D, projected: months === null ? null : calc.fv(B, D, r, months), liquidFrom: liquidFrom, liquid: liquid };
    },
    mortgage: function (row) {
      var P = n(row.balance), r = n(row.rate) / 1200, N = Math.round(n(row.months));
      if (!(P > 0) || !(N > 0)) return { pmt: 0, interest: 0 };
      var pmt = r ? P * r / (1 - Math.pow(1 + r, -N)) : P / N;
      return { pmt: pmt, interest: pmt * N - P };
    },
    portfolioRow: function (row) {
      var sym = (row.ticker || '').trim().toUpperCase(), q = quotes[sym], cur = row.currency || 'ILS', price = null, src = null, warn = null;
      if (q && q.price > 0) {
        if (q.currency === cur) price = q.price;
        else { var a = toILS(q.price, q.currency), b = rateILS(cur); price = (a !== null && b) ? a / b : null; warn = q.currency; }
        src = q;
      }
      if (price === null && nn(row.manual) !== null && n(row.manual) > 0) { price = n(row.manual); src = null; }
      var qty = n(row.qty), value = price === null ? null : qty * price, cost = qty * n(row.entry);
      var valueILS = value === null ? null : toILS(value, cur), costILS = toILS(cost, cur);
      var pl = valueILS === null || costILS === null ? null : valueILS - costILS;
      return { price: price, quote: src, manual: price !== null && !src, value: value, cost: cost, valueILS: valueILS, costILS: costILS, pl: pl, plPct: pl !== null && costILS ? pl / costILS * 100 : null, convertedFrom: warn };
    },
    portfolio: function (p) {
      var v = 0, c = 0, missing = 0;
      p.rows.forEach(function (r) { var x = calc.portfolioRow(r); if (x.valueILS === null) missing++; else v += x.valueILS; if (x.costILS !== null) c += x.costILS; });
      return { valueILS: v, costILS: c, pl: v - c, plPct: c ? (v - c) / c * 100 : null, missing: missing };
    },
    options: function () {
      var o = readJSON(OPTIONS_KEY); if (!o || !o.data) return null;
      var items = [];
      Object.keys(o.data).forEach(function (sym) {
        var d = o.data[sym]; if (!d) return;
        var q = n(d.t1) + n(d.t2) + n(d.t3); if (!(q > 0) || nn(d.strike) === null || !(n(d.sell) > 0)) return;
        var eff = Math.max(0, n(d.strike) - n(d.div) * n(d.years)), gross = q * Math.max(0, n(d.sell) - eff), net = gross * (1 - n(d.tax) / 100);
        var cur = /\.TA$/i.test(sym) ? 'ILS' : 'USD';
        items.push({ symbol: sym, qty: q, net: net, currency: cur, netILS: toILS(net, cur) });
      });
      return items;
    },
    summary: function () {
      var c = {}, liquid = 0, locked = 0, illiquid = 0, missing = 0;
      function add(k, v, bucket) { if (v === null) { missing++; return; } c[k] = (c[k] || 0) + v; if (bucket === 'liquid') liquid += v; else if (bucket === 'locked') locked += v; else if (bucket === 'illiquid') illiquid += v; }
      data.savings.portfolios.forEach(function (p) { var x = calc.portfolio(p); add('cat_portfolio', x.valueILS, 'liquid'); missing += x.missing; });
      data.savings.cash.forEach(function (r) { add('cat_cash', toILS(r.balance, r.currency), 'liquid'); });
      data.savings.standing.forEach(function (r) { if (r.include !== false) add('cat_standing', calc.standing(r).valueToday, 'liquid'); });
      data.pension.funds.forEach(function (r) { add('cat_pension', n(r.balance), 'locked'); });
      data.hishtalmut.funds.forEach(function (r) { var f = calc.fund(r, 'hishtalmut'); add('cat_hish', n(r.balance), f.liquid ? 'liquid' : 'locked'); });
      var opts = calc.options();
      if (data.home.includeOptions && opts) opts.forEach(function (o) { add('cat_options', o.netILS, 'illiquid'); });
      data.home.assets.forEach(function (r) { add('cat_other', toILS(r.value, r.currency), r.liquid ? 'liquid' : 'illiquid'); });
      var assets = 0; Object.keys(c).forEach(function (k) { assets += c[k]; });
      var liab = {};
      liab.cat_mortgage = data.mortgage.tracks.reduce(function (s, r) { return s + n(r.balance); }, 0);
      liab.cat_cards = data.home.includeCards ? data.cards.cards.reduce(function (s, r) { return s + n(r.charge); }, 0) : 0;
      liab.cat_loans = data.home.loans.reduce(function (s, r) { return s + n(r.balance); }, 0);
      var liabs = liab.cat_mortgage + liab.cat_cards + liab.cat_loans;
      var income = data.home.income.reduce(function (s, r) { return s + n(r.amount); }, 0);
      var mPmt = data.mortgage.tracks.reduce(function (s, r) { return s + calc.mortgage(r).pmt; }, 0);
      var loanPmt = data.home.loans.reduce(function (s, r) { return s + calc.mortgage(r).pmt; }, 0);
      var expenses = data.home.expenses.reduce(function (s, r) { return s + n(r.amount); }, 0) + (data.home.includeMortgagePmt ? mPmt : 0);
      var surplus = income - expenses;
      return { cats: c, liab: liab, assets: assets, liabs: liabs, net: assets - liabs, liquid: liquid, locked: locked, illiquid: illiquid,
               income: income, expenses: expenses, mortgagePmt: mPmt, loanPmt: loanPmt, surplus: surplus, savingsRate: income > 0 ? surplus / income * 100 : null, missing: missing, options: opts };
    },
    goal: function (s) {
      var g = data.home.goal, G = nn(g.amount), D = parseDate(g.date);
      if (G === null || !D) return null;
      var base = g.base === 'liquid' ? s.liquid : s.net, months = Math.max(0, monthsBetween(today(), D)), r = n(g.ret) / 1200;
      if (base >= G) return { reached: true, required: 0, months: months };
      if (months <= 0) return { reached: false, required: G - base, months: 0 };
      var grow = Math.pow(1 + r, months);
      var req = r ? (G - base * grow) * r / (grow - 1) : (G - base) / months;
      return { reached: false, required: Math.max(0, req), months: months, gap: Math.max(0, req) - s.surplus };
    }
  };

  /* ---------- list editor ---------- */
  function opts(list) { return list.map(function (k) { return [k, t(k)]; }); }
  function fieldInput(row, f, onInput) {
    var id = 'f-' + uid();
    var input;
    if (f.type === 'select') {
      input = h('select', { id: id }, (typeof f.options === 'function' ? f.options() : f.options).map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      input.value = row[f.k] !== undefined ? row[f.k] : f.options[0][0];
      if (row[f.k] === undefined) row[f.k] = input.value;
      input.addEventListener('change', function () { row[f.k] = input.value; onInput(); });
    } else if (f.type === 'check') {
      input = h('input', { id: id, type: 'checkbox' });
      input.checked = row[f.k] !== false && (row[f.k] !== undefined || f.def !== false);
      if (row[f.k] === undefined) row[f.k] = input.checked;
      input.addEventListener('change', function () { row[f.k] = input.checked; onInput(); });
      return h('div', { class: 'field check' }, [input, h('label', { for: id, text: t(f.label) })]);
    } else {
      input = h('input', { id: id, type: f.type === 'text' ? 'text' : f.type === 'date' ? 'date' : 'number', inputmode: f.type === 'number' ? 'decimal' : null, step: f.step || (f.type === 'number' ? 'any' : null), min: f.min, autocomplete: 'off', placeholder: f.ph || null });
      if (f.upper) { input.setAttribute('autocapitalize', 'characters'); input.style.direction = 'ltr'; }
      input.value = row[f.k] === undefined || row[f.k] === null ? '' : row[f.k];
      input.addEventListener('input', function () {
        var v = input.value;
        if (f.type === 'number') v = v === '' ? null : nn(v);
        if (f.upper && typeof v === 'string') v = v.toUpperCase();
        row[f.k] = v; onInput();
      });
    }
    return h('div', { class: 'field' }, [h('label', { for: id, text: t(f.label) }), input]);
  }
  function renderList(box, rows, schema) {
    box.innerHTML = '';
    var listEl = h('div');
    function outputs(row, el) {
      if (!schema.outputs) return;
      el.innerHTML = '';
      schema.outputs(row).forEach(function (o) {
        el.appendChild(h('div', { class: 'out' }, [h('span', { class: 'k', text: o[0] }), h('span', { class: 'v num ' + (o[2] || ''), text: o[1] }), o[3] ? h('span', { class: 'stamp', text: o[3] }) : null]));
      });
    }
    var outs = [];
    function refreshAll() { outs.forEach(function (x) { outputs(x[0], x[1]); }); if (schema.totals) schema.totals(); }
    function draw() {
      listEl.innerHTML = ''; outs = [];
      if (!rows.length) listEl.appendChild(h('div', { class: 'empty', text: t('none') }));
      rows.forEach(function (row, i) {
        var outEl = h('div', { class: 'outputs' });
        var card = h('div', { class: 'row-card' }, [
          h('div', { class: 'fields' }, schema.fields.map(function (f) { return fieldInput(row, f, function () { changed(); refreshAll(); }); })),
          schema.outputs ? outEl : null,
          h('div', { class: 'row-actions' }, [h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('del'), onclick: function () { rows.splice(i, 1); changed(); draw(); } })])
        ]);
        outs.push([row, outEl]); outputs(row, outEl);
        listEl.appendChild(card);
      });
      if (schema.totals) schema.totals();
    }
    box.appendChild(listEl);
    box.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: t('add_row'), onclick: function () {
      var r = { id: uid() }; (schema.fields).forEach(function (f) { if (f.def !== undefined) r[f.k] = f.def; }); rows.push(r); changed(); draw();
      var last = listEl.lastChild && listEl.lastChild.querySelector('input,select'); if (last) last.focus();
    } })]));
    draw();
    return { refresh: refreshAll, redraw: draw };
  }
  function section(title, kids, badge) {
    return h('section', { class: 'card' }, [h('h2', { class: 'card-title' }, [h('span', { text: title }), badge || null])].concat(kids));
  }
  function totalsBox(items) {
    return h('div', { class: 'totals' }, items.map(function (x) { return h('div', { class: 'tot' + (x[2] ? ' ' + x[2] : '') }, [h('span', { class: 'k', text: x[0] }), h('span', { class: 'v num', text: x[1] })]); }));
  }
  function comparison(cfg) {
    var head = h('tr', null, cfg.cols.map(function (c) { return h('th', { text: t(c) || c }); }));
    var body = [1, 2, 3].map(function (i) {
      return h('tr', { class: 'placeholder' }, cfg.cols.map(function (c, j) { return h('td', { text: j === 0 ? t('placeholder_row') + ' ' + i : '—' }); }));
    });
    return section(t('compare'), [
      h('div', { class: 'tbl-wrap' }, [h('table', { class: 'cmp' }, [h('thead', null, [head]), h('tbody', null, body)])]),
      h('p', { class: 'help', text: t('cmp_source') + ': ' + cfg.source })
    ], h('span', { class: 'badge amber', text: t('placeholder_badge') }));
  }
  function fxCard() {
    var box = h('div');
    function draw() {
      box.innerHTML = '';
      ['USD', 'EUR'].forEach(function (cur) {
        var q = quotes[FX_SYM[cur]], inp = h('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: q ? String(+q.price.toFixed(4)) : '', 'aria-label': t('fx_manual') + ' ' + cur });
        inp.value = data.fx[cur] === null || data.fx[cur] === undefined ? '' : data.fx[cur];
        inp.style.maxWidth = '120px';
        inp.addEventListener('input', function () { data.fx[cur] = inp.value === '' ? null : nn(inp.value); changed(); });
        box.appendChild(h('div', { class: 'row-card' }, [
          h('div', { class: 'fx-line' }, [h('strong', { class: 'num', text: cur + '/ILS: ' + (rateILS(cur) ? fmt(rateILS(cur), 4) : t('missing_rate')) }),
            h('span', { text: nn(data.fx[cur]) ? t('manual') : (q ? quoteLabel(q) : '') })]),
          h('div', { class: 'field', style: 'margin-top:6px' }, [h('label', { text: t('fx_manual') + ' (' + cur + '→ILS)' }), inp])
        ]));
      });
      box.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', disabled: fetching, text: fetching ? t('fetching') : t('refresh'), onclick: function () { refreshQuotes(null, false); } })]));
      box.appendChild(h('p', { class: 'help', text: t('fx_note') }));
    }
    on('quotes', draw); draw();
    return section(t('fx_rates'), [box]);
  }

  /* ---------- chrome: bar, nav, backup ---------- */
  function chrome(page) {
    var html = document.documentElement;
    html.lang = settings.lang; html.dir = settings.lang === 'he' ? 'rtl' : 'ltr';
    var langSel = h('select', { 'aria-label': t('lang') }, [['he', 'עברית'], ['en', 'English'], ['es', 'Español']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    langSel.value = settings.lang;
    langSel.addEventListener('change', function () { settings.lang = langSel.value; writeJSON(SETTINGS_KEY, settings); saveNow(); location.reload(); });
    var curSel = h('select', { 'aria-label': t('currency') }, ['ILS', 'USD', 'EUR'].map(function (c) { return h('option', { value: c, text: CUR[c] + ' ' + c }); }));
    curSel.value = settings.currency;
    curSel.addEventListener('change', function () { settings.currency = curSel.value; writeJSON(SETTINGS_KEY, settings); emit('change'); });
    var bar = h('div', { class: 'portal-bar' }, [h('a', { class: 'portal-brand', href: 'index.html', text: t('brand') }), h('div', { class: 'portal-settings' }, [langSel, curSel])]);
    var nav = h('nav', { class: 'portal-nav', 'aria-label': t('brand') }, PAGES.map(function (p) { return h('a', { href: p[1], class: p[0] === page ? 'active' : null, 'aria-current': p[0] === page ? 'page' : null, text: t(p[2]) }); }));
    return [bar, nav];
  }
  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportBackup() {
    saveNow();
    return JSON.stringify({ app: 'balances-portal', v: 1, exportedAt: new Date().toISOString(), data: data, settings: settings, options: readJSON(OPTIONS_KEY) }, null, 2);
  }
  function importBackup(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return false; }
    if (!o || o.app !== 'balances-portal' || !o.data) return false;
    data = merge(emptyData(), o.data); writeJSON(DATA_KEY, data);
    if (o.settings) { settings = merge({ lang: 'he', currency: 'ILS' }, o.settings); writeJSON(SETTINGS_KEY, settings); }
    if (o.options) writeJSON(OPTIONS_KEY, o.options);
    return true;
  }
  function exampleData() {
    var E = t('example_prefix') + ' – ', y = today().getFullYear();
    var d = emptyData();
    d.savings.cash = [{ id: uid(), name: E + 'עו"ש', kind: 'c_checking', balance: 15000, currency: 'ILS', rate: 0 }, { id: uid(), name: E + 'פיקדון', kind: 'c_deposit', balance: 50000, currency: 'ILS', rate: 4, maturity: (y + 1) + '-01-01' }];
    d.savings.standing = [{ id: uid(), name: E + 'S&P 500', monthly: 1000, start: (y - 1) + '-01-01', ret: 6, target: (y + 9) + '-01-01', include: true }];
    d.savings.portfolios = [{ id: uid(), name: E + 'תיק', rows: [{ id: uid(), ticker: 'NVDA', qty: 10, entry: 100, currency: 'USD', manual: null }, { id: uid(), ticker: 'LUMI.TA', qty: 100, entry: 60, currency: 'ILS', manual: null }] }];
    d.pension.funds = [{ id: uid(), name: E + 'קרן פנסיה', kind: 'k_pension', balance: 300000, deposit: 3000, feeBal: 0.2, feeDep: 1.5, ret: 4, age: 40, retireAge: 67 }];
    d.hishtalmut.funds = [{ id: uid(), name: E + 'השתלמות', balance: 120000, deposit: 1500, feeBal: 0.6, feeDep: 0, ret: 5, openDate: (y - 7) + '-03-01', target: (y + 5) + '-01-01' }];
    d.mortgage.tracks = [{ id: uid(), name: E + 'פריים', type: 't_prime', balance: 400000, rate: 5.5, months: 240 }];
    d.cards.cards = [{ id: uid(), name: E + 'כרטיס', charge: 6000, limit: 30000, billingDay: 10 }];
    d.home.income = [{ id: uid(), name: E + 'משכורת', amount: 20000 }];
    d.home.expenses = [{ id: uid(), category: 'e_food', name: E + 'סופר', amount: 3000 }, { id: uid(), category: 'e_car', name: E + 'דלק', amount: 800 }];
    d.home.assets = [{ id: uid(), name: E + 'דירה', type: 'a_realestate', value: 2000000, currency: 'ILS', liquid: false }];
    d.home.goal = { amount: 500000, date: (y + 5) + '-01-01', base: 'liquid', ret: 3 };
    return d;
  }
  function backupCard() {
    var file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (!confirm(t('confirm_import'))) { file.value = ''; return; }
      f.text().then(function (txt) { if (importBackup(txt)) { toast(t('imported')); setTimeout(function () { location.reload(); }, 400); } else toast(t('import_bad')); file.value = ''; });
    });
    return section(t('backup'), [
      h('p', { class: 'help', text: t('autosave') }),
      h('div', { class: 'backup-bar', style: 'margin-top:8px' }, [
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', text: t('export'), onclick: function () { download('balances-backup-' + new Date().toISOString().slice(0, 10) + '.json', exportBackup()); toast(t('exported')); } }),
        h('button', { type: 'button', class: 'btn btn-soft btn-sm', text: t('import'), onclick: function () { file.click(); } }), file,
        h('button', { type: 'button', class: 'btn btn-sm', text: t('example') + ' (' + t('example_prefix') + ')', onclick: function () { if (confirm(t('confirm_example'))) { data = exampleData(); saveNow(); toast(t('example_loaded')); setTimeout(function () { location.reload(); }, 400); } } }),
        h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('clear_all'), onclick: function () {
          if (!confirm(t('confirm_clear'))) return;
          [DATA_KEY, QUOTES_KEY, OPTIONS_KEY].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
          data = emptyData(); toast(t('cleared')); setTimeout(function () { location.reload(); }, 400);
        } })
      ]),
      h('p', { class: 'footer-note', text: t('disclaimer') })
    ]);
  }

  /* ---------- pages ---------- */
  var CUR_OPTS = [['ILS', '₪ ILS'], ['USD', '$ USD'], ['EUR', '€ EUR']];
  var pageRenderers = {
    pension: function (main) {
      var tot = h('div'), box = h('div'), rows = data.pension.funds;
      var r = renderList(box, rows, fundSchema('pension', rows, tot));
      main.appendChild(section(t('my_balances'), [box, tot]));
      main.appendChild(comparison({ cols: ['provider_track', 'kind', 'fee_dep', 'fee_bal', 'ret_1y', 'ret_3y', 'ret_5y'], source: 'TBD (e.g. Pensia-Net / Gemel-Net, Israel Capital Market Authority)' }));
      on('change', r.refresh);
    },
    hishtalmut: function (main) {
      var tot = h('div'), box = h('div'), rows = data.hishtalmut.funds;
      var r = renderList(box, rows, fundSchema('hishtalmut', rows, tot));
      main.appendChild(section(t('my_balances'), [box, tot, h('p', { class: 'help', text: t('hish_help') })]));
      main.appendChild(comparison({ cols: ['provider_track', 'fee_bal', 'ret_1y', 'ret_3y', 'ret_5y'], source: 'TBD (e.g. Gemel-Net, Israel Capital Market Authority)' }));
      on('change', r.refresh);
    },
    mortgage: function (main) {
      var tot = h('div'), box = h('div'), rows = data.mortgage.tracks;
      var r = renderList(box, rows, {
        fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'type', type: 'select', label: 'track_type', options: opts(['t_prime', 't_fixed_unlinked', 't_fixed_linked', 't_var_linked', 't_var_unlinked', 't_other']) },
                 { k: 'balance', type: 'number', label: 'balance' }, { k: 'rate', type: 'number', label: 'rate' }, { k: 'months', type: 'number', label: 'months', step: '1' }],
        outputs: function (row) { var m = calc.mortgage(row); return [[t('pmt'), disp(m.pmt), 'neg'], [t('interest_left'), disp(m.interest)]]; },
        totals: function () {
          var b = 0, p = 0, i = 0; rows.forEach(function (x) { var m = calc.mortgage(x); b += n(x.balance); p += m.pmt; i += m.interest; });
          tot.innerHTML = ''; tot.appendChild(totalsBox([[t('total') + ' ' + t('balance'), disp(b), 'big'], [t('pmt'), disp(p)], [t('interest_left'), disp(i)]]));
        }
      });
      main.appendChild(section(t('my_balances'), [box, tot, h('p', { class: 'help', text: t('mortgage_help') })]));
      main.appendChild(comparison({ cols: ['name', 'track_type', 'rate', 'months'], source: 'TBD (e.g. Bank of Israel average mortgage rates)' }));
      on('change', r.refresh);
    },
    cards: function (main) {
      var tot = h('div'), box = h('div'), rows = data.cards.cards;
      var r = renderList(box, rows, {
        fields: [{ k: 'name', type: 'text', label: 'card_name' }, { k: 'charge', type: 'number', label: 'charge' }, { k: 'limit', type: 'number', label: 'limit' }, { k: 'billingDay', type: 'number', label: 'billing_day', step: '1', min: '1' }],
        outputs: function (row) { var u = n(row.limit) > 0 ? n(row.charge) / n(row.limit) * 100 : null; return [[t('charge'), disp(n(row.charge)), 'neg'], [t('utilization'), pct(u, 0), u !== null && u > 70 ? 'neg' : '']]; },
        totals: function () {
          var c = 0, l = 0; rows.forEach(function (x) { c += n(x.charge); l += n(x.limit); });
          tot.innerHTML = ''; tot.appendChild(totalsBox([[t('total') + ' ' + t('charge'), disp(c), 'big'], [t('limit'), disp(l)], [t('utilization'), l ? pct(c / l * 100, 0) : '—']]));
        }
      });
      main.appendChild(section(t('my_balances'), [box, tot]));
      main.appendChild(comparison({ cols: ['card_name', 'annual_fee', 'fx_fee', 'benefits'], source: 'TBD' }));
      on('change', r.refresh);
    },
    savings: function (main) {
      // cash
      var cashTot = h('div'), cashBox = h('div'), cash = data.savings.cash;
      var rc = renderList(cashBox, cash, {
        fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'kind', type: 'select', label: 'kind', options: opts(['c_checking', 'c_savings', 'c_deposit', 'c_mmf']) },
                 { k: 'balance', type: 'number', label: 'balance' }, { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'rate', type: 'number', label: 'rate' }, { k: 'maturity', type: 'date', label: 'maturity' }],
        outputs: function (r) { var v = toILS(r.balance, r.currency); return [[t('value'), v === null ? t('missing_rate') : disp(v)], [t('annual_interest'), v === null ? '—' : disp(v * n(r.rate) / 100), 'pos']]; },
        totals: function () { var s = 0; cash.forEach(function (r) { s += n(toILS(r.balance, r.currency)); }); cashTot.innerHTML = ''; cashTot.appendChild(totalsBox([[t('total'), disp(s), 'big']])); }
      });
      main.appendChild(section(t('cash_title'), [cashBox, cashTot]));
      // standing orders
      var stTot = h('div'), stBox = h('div'), st = data.savings.standing;
      var rs = renderList(stBox, st, {
        fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'monthly', type: 'number', label: 'monthly_amount' }, { k: 'start', type: 'date', label: 'start_date' }, { k: 'ret', type: 'number', label: 'exp_ret' }, { k: 'target', type: 'date', label: 'target_date' }, { k: 'include', type: 'check', label: 'include_nw', def: true }],
        outputs: function (r) { var x = calc.standing(r); return [[t('invested_to_date'), disp(x.invested)], [t('value_today'), disp(x.valueToday), 'pos'], [t('invested_at_target'), x.investedTarget === null ? '—' : disp(x.investedTarget)], [t('projected'), x.projected === null ? '—' : disp(x.projected), 'pos']]; },
        totals: function () { var a = 0, b = 0, m = 0; st.forEach(function (r) { var x = calc.standing(r); a += x.invested; b += x.valueToday; m += n(r.monthly); }); stTot.innerHTML = ''; stTot.appendChild(totalsBox([[t('monthly_amount'), disp(m)], [t('invested_to_date'), disp(a)], [t('value_today'), disp(b), 'big']])); }
      });
      main.appendChild(section(t('standing_title'), [stBox, stTot, h('p', { class: 'help', text: t('standing_help') })]));
      // portfolios
      var pfWrap = h('div'), pfTot = h('div'), lists = [];
      function drawPortfolios() {
        pfWrap.innerHTML = ''; lists = [];
        data.savings.portfolios.forEach(function (p, pi) {
          var nameIn = h('input', { type: 'text', 'aria-label': t('portfolio_name'), placeholder: t('portfolio_name') }); nameIn.value = p.name || '';
          nameIn.addEventListener('input', function () { p.name = nameIn.value; changed(); });
          var tot = h('div'), box = h('div');
          var l = renderList(box, p.rows, {
            fields: [{ k: 'ticker', type: 'text', label: 'ticker', upper: true, ph: 'LUMI.TA' }, { k: 'qty', type: 'number', label: 'qty' }, { k: 'entry', type: 'number', label: 'entry' },
                     { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'manual', type: 'number', label: 'manual_price' }],
            outputs: function (r) {
              var x = calc.portfolioRow(r), cur = r.currency || 'ILS';
              return [[t('price'), x.price === null ? '—' : money(x.price, cur, 2), '', x.quote ? quoteLabel(x.quote) + (x.convertedFrom ? ' · ' + x.convertedFrom + '→' + cur : '') : (x.manual ? t('manual') : '')],
                      [t('value'), x.valueILS === null ? '—' : disp(x.valueILS)], [t('cost'), disp(x.costILS)],
                      [t('pl'), x.pl === null ? '—' : disp(x.pl) + ' (' + pct(x.plPct) + ')', x.pl === null ? '' : x.pl >= 0 ? 'pos' : 'neg']];
            },
            totals: function () { var s = calc.portfolio(p); tot.innerHTML = ''; tot.appendChild(totalsBox([[t('value'), disp(s.valueILS), 'big'], [t('cost'), disp(s.costILS)], [t('pl'), disp(s.pl) + ' (' + pct(s.plPct) + ')']])); grand(); }
          });
          lists.push(l);
          pfWrap.appendChild(h('div', { class: 'row-card', style: 'background:#fff' }, [
            h('div', { class: 'portfolio-head' }, [h('strong', { text: t('portfolio') + ':' }), nameIn,
              h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('del_portfolio'), onclick: function () { if (!p.rows.length || confirm(t('del_portfolio') + '?')) { data.savings.portfolios.splice(pi, 1); changed(); drawPortfolios(); } } })]),
            box, tot]));
        });
        grand();
      }
      function grand() {
        var v = 0, c = 0; data.savings.portfolios.forEach(function (p) { var s = calc.portfolio(p); v += s.valueILS; c += s.costILS; });
        pfTot.innerHTML = ''; if (data.savings.portfolios.length > 1) pfTot.appendChild(totalsBox([[t('total') + ' ' + t('value'), disp(v), 'big'], [t('total') + ' ' + t('pl'), disp(v - c) + ' (' + pct(c ? (v - c) / c * 100 : null) + ')']]));
      }
      main.appendChild(section(t('portfolios_title'), [pfWrap, pfTot,
        h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: t('add_portfolio'), onclick: function () { data.savings.portfolios.push({ id: uid(), name: '', rows: [] }); changed(); drawPortfolios(); } }),
          h('button', { type: 'button', class: 'btn btn-soft', text: t('refresh'), onclick: function () { refreshQuotes(null, false); } })]),
        h('p', { class: 'help', text: t('ticker_help') })]));
      main.appendChild(fxCard());
      main.appendChild(comparison({ cols: ['name', 'kind', 'rate', 'months'], source: 'TBD' }));
      drawPortfolios();
      var tick = null;
      on('change', function () { rc.refresh(); rs.refresh(); lists.forEach(function (l) { l.refresh(); }); });
      on('quotes', function () { clearTimeout(tick); tick = setTimeout(function () { lists.forEach(function (l) { l.refresh(); }); rc.refresh(); }, 0); });
      var stale = Object.keys(quotes).length === 0 || Object.keys(quotes).some(function (k) { return Date.now() - (quotes[k].fetchedAt || 0) > 10 * 60 * 1000; });
      if (stale) refreshQuotes(null, true);
    },
    home: function (main) {
      // old calculator links: forward to options page
      if (/(^|[#&])(s|strike|sell|spot|t1)=/.test(location.hash)) { location.replace('options.html' + location.hash); return; }
      var sumBox = h('div'), donutBox = h('div'), catBox = h('div'), goalOut = h('div'), cfTot = h('div');
      main.appendChild(section(t('net_worth'), [sumBox]));
      main.appendChild(section(t('breakdown'), [donutBox, catBox]));
      // options
      var optBox = h('div');
      var optChk = h('input', { type: 'checkbox', id: 'incl-opt' }); optChk.checked = data.home.includeOptions !== false;
      optChk.addEventListener('change', function () { data.home.includeOptions = optChk.checked; changed(); });
      main.appendChild(section(t('options_from_calc'), [optBox, h('div', { class: 'field check', style: 'margin-top:8px' }, [optChk, h('label', { for: 'incl-opt', text: t('include') })]),
        h('div', { class: 'toolbar' }, [h('a', { class: 'btn btn-soft btn-sm', href: 'options.html', text: t('open_page') + ': ' + t('nav_options') })])]));
      // other assets + loans
      var aBox = h('div'), lBox = h('div');
      var ra = renderList(aBox, data.home.assets, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'type', type: 'select', label: 'kind', options: opts(['a_realestate', 'a_crypto', 'a_car', 'a_business', 'a_other']) }, { k: 'value', type: 'number', label: 'value' }, { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'liquid', type: 'check', label: 'liquid_flag', def: false }] });
      main.appendChild(section(t('other_assets'), [aBox]));
      var rl = renderList(lBox, data.home.loans, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'balance', type: 'number', label: 'balance' }, { k: 'rate', type: 'number', label: 'rate' }, { k: 'months', type: 'number', label: 'months', step: '1' }],
        outputs: function (r) { return [[t('pmt'), disp(calc.mortgage(r).pmt), 'neg']]; } });
      main.appendChild(section(t('loans_title'), [lBox]));
      // cash flow
      var iBox = h('div'), eBox = h('div');
      var ri = renderList(iBox, data.home.income, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'amount', type: 'number', label: 'amount' }] });
      var re = renderList(eBox, data.home.expenses, { fields: [{ k: 'category', type: 'select', label: 'category', options: opts(['e_housing', 'e_food', 'e_car', 'e_insurance', 'e_telecom', 'e_leisure', 'e_other']) }, { k: 'name', type: 'text', label: 'name' }, { k: 'amount', type: 'number', label: 'amount' }] });
      var mChk = h('input', { type: 'checkbox', id: 'incl-mpmt' }); mChk.checked = data.home.includeMortgagePmt !== false;
      mChk.addEventListener('change', function () { data.home.includeMortgagePmt = mChk.checked; changed(); });
      var cChk = h('input', { type: 'checkbox', id: 'incl-cards' }); cChk.checked = data.home.includeCards !== false;
      cChk.addEventListener('change', function () { data.home.includeCards = cChk.checked; changed(); });
      main.appendChild(section(t('cashflow'), [h('h3', { class: 'card-title', style: 'font-size:14px', text: t('income') }), iBox, h('h3', { class: 'card-title', style: 'font-size:14px', text: t('expenses') }), eBox,
        h('div', { class: 'field check' }, [mChk, h('label', { for: 'incl-mpmt', text: t('incl_mortgage_pmt') })]),
        h('div', { class: 'field check', style: 'margin-top:6px' }, [cChk, h('label', { for: 'incl-cards', text: t('incl_cards') })]), cfTot]));
      // goal
      var g = data.home.goal;
      var gFields = h('div', { class: 'fields' }, [
        fieldInput(g, { k: 'amount', type: 'number', label: 'goal_amount' }, changed), fieldInput(g, { k: 'date', type: 'date', label: 'goal_date' }, changed),
        fieldInput(g, { k: 'base', type: 'select', label: 'goal_base', options: [['net', t('base_net')], ['liquid', t('base_liquid')]] }, changed),
        fieldInput(g, { k: 'ret', type: 'number', label: 'goal_ret' }, changed)]);
      main.appendChild(section(t('goal'), [gFields, goalOut]));
      main.appendChild(fxCard());

      function draw() {
        var s = calc.summary();
        sumBox.innerHTML = '';
        sumBox.appendChild(totalsBox([[t('net_worth'), disp(s.net), 'big'], [t('assets_total'), disp(s.assets)], [t('liab_total'), disp(-s.liabs)],
          [t('liquid'), disp(s.liquid)], [t('locked'), disp(s.locked)], [t('illiquid'), disp(s.illiquid)],
          [t('surplus'), disp(s.surplus)], [t('savings_rate'), pct(s.savingsRate)]]));
        if (s.missing) sumBox.appendChild(h('div', { class: 'notice amber', style: 'margin-top:8px', text: t('missing_rate') + ': ' + s.missing }));
        // donut
        var colors = ['#1d4ed8', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#64748b'];
        var cats = Object.keys(s.cats).filter(function (k) { return s.cats[k] > 0; }), total = cats.reduce(function (a, k) { return a + s.cats[k]; }, 0);
        donutBox.innerHTML = '';
        if (total > 0) {
          var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '140'); svg.setAttribute('height', '140'); svg.setAttribute('viewBox', '0 0 42 42'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('breakdown'));
          var off = 25;
          var bg = document.createElementNS(NS, 'circle'); bg.setAttribute('cx', 21); bg.setAttribute('cy', 21); bg.setAttribute('r', 15.9155); bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#e2e8f0'); bg.setAttribute('stroke-width', 6); svg.appendChild(bg);
          cats.forEach(function (k, i) {
            var share = s.cats[k] / total * 100, c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', 21); c.setAttribute('cy', 21); c.setAttribute('r', 15.9155); c.setAttribute('fill', 'none'); c.setAttribute('stroke', colors[i % colors.length]); c.setAttribute('stroke-width', 6);
            c.setAttribute('stroke-dasharray', share + ' ' + (100 - share)); c.setAttribute('stroke-dashoffset', off); off = (off - share + 100) % 100; svg.appendChild(c);
          });
          donutBox.appendChild(h('div', { class: 'donut-wrap' }, [svg, h('div', { class: 'legend' }, cats.map(function (k, i) {
            return h('div', null, [h('span', null, [h('i', { style: 'background:' + colors[i % colors.length] }), t(k)]), h('span', { class: 'num', text: pct(s.cats[k] / total * 100, 0) })]);
          }))]));
        } else donutBox.appendChild(h('div', { class: 'empty', text: t('none') }));
        // category table
        var links = { cat_portfolio: 'savings.html', cat_cash: 'savings.html', cat_standing: 'savings.html', cat_pension: 'pension.html', cat_hish: 'hishtalmut.html', cat_options: 'options.html', cat_other: '#', cat_mortgage: 'mortgage.html', cat_cards: 'cards.html', cat_loans: '#' };
        var rows = Object.keys(s.cats).map(function (k) { return [k, s.cats[k]]; }).concat(Object.keys(s.liab).filter(function (k) { return s.liab[k] > 0; }).map(function (k) { return [k, -s.liab[k]]; }));
        catBox.innerHTML = '';
        catBox.appendChild(h('table', { class: 'cat-table' }, [h('tbody', null, rows.map(function (r) {
          return h('tr', null, [h('td', null, [links[r[0]] && links[r[0]] !== '#' ? h('a', { href: links[r[0]], text: t(r[0]) }) : t(r[0])]), h('td', { class: 'num ' + (r[1] < 0 ? 'neg' : ''), text: disp(r[1]) })]);
        }))]));
        // options
        optBox.innerHTML = '';
        if (!s.options || !s.options.length) optBox.appendChild(h('div', { class: 'empty', text: t('options_none') }));
        else s.options.forEach(function (o) { optBox.appendChild(h('div', { class: 'fx-line' }, [h('strong', { class: 'num', text: o.symbol }), h('span', { text: t('options_net') + ': ' }), h('span', { class: 'num', text: o.netILS === null ? t('missing_rate') : disp(o.netILS) })])); });
        // cash flow totals
        cfTot.innerHTML = '';
        var items = [[t('income'), disp(s.income)], [t('expenses'), disp(-s.expenses)], [t('surplus'), disp(s.surplus), 'big'], [t('savings_rate'), pct(s.savingsRate)]];
        if (data.home.includeMortgagePmt && s.mortgagePmt > 0) items.splice(2, 0, [t('mortgage_pmt_line'), disp(-s.mortgagePmt)]);
        cfTot.appendChild(totalsBox(items));
        // goal
        var gr = calc.goal(s); goalOut.innerHTML = '';
        if (gr) {
          goalOut.appendChild(totalsBox([[t('required_monthly'), disp(gr.required), 'big'], [t('surplus'), disp(s.surplus)], [t('months_left'), fmt(gr.months)]]));
          goalOut.appendChild(h('div', { class: 'notice ' + (gr.reached || gr.gap <= 0 ? 'blue' : 'amber'), style: 'margin-top:8px', text: gr.reached ? t('goal_reached') : gr.gap <= 0 ? t('on_track') : t('gap') + ': ' + disp(gr.gap) }));
        }
      }
      on('change', draw); on('quotes', draw); draw();
      var stale = !quotes['ILS=X'] || Date.now() - (quotes['ILS=X'].fetchedAt || 0) > 10 * 60 * 1000;
      if (stale) refreshQuotes(null, true);
    }
  };
  function fundSchema(kind, rows, tot) {
    var fields = [{ k: 'name', type: 'text', label: 'provider_track' }];
    if (kind === 'pension') fields.push({ k: 'kind', type: 'select', label: 'kind', options: opts(['k_pension', 'k_gemel', 'k_gemel_inv', 'k_insurance']) });
    fields = fields.concat([{ k: 'balance', type: 'number', label: 'balance' }, { k: 'deposit', type: 'number', label: 'monthly_deposit' }, { k: 'feeBal', type: 'number', label: 'fee_bal' }, { k: 'feeDep', type: 'number', label: 'fee_dep' }, { k: 'ret', type: 'number', label: 'exp_ret' }]);
    if (kind === 'pension') fields.push({ k: 'age', type: 'number', label: 'age' }, { k: 'retireAge', type: 'number', label: 'retire_age' });
    else fields.push({ k: 'openDate', type: 'date', label: 'open_date' });
    fields.push({ k: 'target', type: 'date', label: 'target_date' });
    return {
      fields: fields,
      outputs: function (r) {
        var f = calc.fund(r, kind), o = [[t('deposit_net'), disp(f.depositNet)], [t('months_left'), f.months === null ? '—' : fmt(f.months)], [t('projected'), f.projected === null ? '—' : disp(f.projected), 'pos']];
        if (kind === 'hishtalmut') o.push([t('liquid_from'), f.liquidFrom ? fmtDate(f.liquidFrom) : '—', f.liquid ? 'pos' : '', f.liquid === null ? '' : (f.liquid ? t('liquid_yes') : t('liquid_no'))]);
        return o;
      },
      totals: function () {
        var b = 0, p = 0, d = 0; rows.forEach(function (r) { b += n(r.balance); d += n(r.deposit); var f = calc.fund(r, kind); if (f.projected !== null) p += f.projected; });
        tot.innerHTML = ''; tot.appendChild(totalsBox([[t('total') + ' ' + t('balance'), disp(b), 'big'], [t('monthly_deposit'), disp(d)], [t('projected'), disp(p)]]));
      }
    };
  }

  function init() {
    var page = document.body.getAttribute('data-page') || 'home';
    var root = $('portal');
    chrome(page).forEach(function (e) { root.appendChild(e); });
    var titles = { home: ['home_title', 'home_sub'], pension: ['pension_title', 'pension_sub'], hishtalmut: ['hish_title', 'hish_sub'], mortgage: ['mortgage_title', 'mortgage_sub'], cards: ['cards_title', 'cards_sub'], savings: ['savings_title', 'savings_sub'] };
    root.appendChild(h('header', { class: 'top-header' }, [h('h1', { text: t(titles[page][0]) }), h('p', { text: t(titles[page][1]) })]));
    document.title = t(titles[page][0]) + ' · ' + t('brand');
    var main = h('main'); root.appendChild(main);
    pageRenderers[page](main);
    root.appendChild(backupCard());
    if (!$('toast')) document.body.appendChild(h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }));
    try { if (window.self === window.top && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  }
  window.Portal = { calc: calc, get data() { return data; }, quotes: quotes, refreshQuotes: refreshQuotes, exportBackup: exportBackup, importBackup: importBackup, t: t, toILS: toILS, rateILS: rateILS, saveNow: saveNow };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
