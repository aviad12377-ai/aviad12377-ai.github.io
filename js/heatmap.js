/* TA-35 / S&P 100 heatmap. Day change prefers live prices.json; week/month from data/heatmap.json. */
(function () {
  'use strict';
  if (window.PortalNav) window.PortalNav.mount('heatmap');

  var root = document.getElementById('hm-app');
  var state = { market: 'ta35', period: 'day', items: [], generatedAt: '', pricesAt: '' };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function fmtPct(x) {
    if (x == null || !isFinite(x)) return '—';
    var sign = x > 0 ? '+' : x < 0 ? '−' : '';
    return sign + Math.abs(x).toFixed(2) + '%';
  }
  function shade(x) {
    if (x == null || !isFinite(x)) return 'flat';
    var mag = Math.min(1, Math.abs(x) / 6);
    var t = 0.28 + mag * 0.62;
    // opaque tint (hue mixed into white) so the dark tile text keeps its contrast in the light and the dark scheme
    var c = x >= 0 ? [74, 222, 128] : [248, 113, 113];
    return 'background:rgb(' + c.map(function (v) { return Math.round(255 + (v - 255) * t); }).join(',') + ')';
  }
  function clock(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    try {
      return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(d);
    } catch (e) { return iso; }
  }

  function quoteOf(quotes, symbol) {
    if (!quotes) return null;
    return quotes[symbol] || quotes[symbol.replace(/\.TA$/, '')] || quotes[symbol + '.TA'] || null;
  }
  function mergePrices(items, prices) {
    if (!prices || !prices.quotes) return items;
    return items.map(function (it) {
      var q = quoteOf(prices.quotes, it.symbol);
      if (!q || q.price == null || q.previousClose == null || !q.previousClose) return it;
      var day = (q.price / q.previousClose - 1) * 100;
      return Object.assign({}, it, { price: q.price, day: day, live: true });
    });
  }

  function chips(group, options, current, onPick) {
    return el('div', { class: 'hm-chips', role: 'group', 'aria-label': group }, options.map(function (o) {
      return el('button', {
        type: 'button', class: 'hm-chip', 'aria-pressed': o.id === current ? 'true' : 'false',
        text: o.label, onclick: function () { onPick(o.id); }
      });
    }));
  }

  function render() {
    root.textContent = '';
    var toolbar = el('div', { class: 'hm-toolbar' }, [
      chips('מדד', [
        { id: 'ta35', label: 'ת״א 35' },
        { id: 'sp100', label: 'S&P 100' }
      ], state.market, function (id) { state.market = id; render(); }),
      chips('תקופה', [
        { id: 'day', label: 'יום' },
        { id: 'week', label: 'שבוע' },
        { id: 'month', label: 'חודש' }
      ], state.period, function (id) { state.period = id; render(); })
    ]);
    var rows = state.items.filter(function (it) { return it.market === state.market; }).slice();
    rows.sort(function (a, b) {
      var av = a[state.period], bv = b[state.period];
      var an = av == null || !isFinite(av), bn = bv == null || !isFinite(bv);
      if (an && bn) return a.name.localeCompare(b.name, 'he');
      if (an) return 1;
      if (bn) return -1;
      return bv - av;
    });
    var updated = [];
    if (state.pricesAt) updated.push('שער יומי מ־prices.json, ' + clock(state.pricesAt));
    if (state.generatedAt) updated.push('שבוע/חודש מ־Yahoo, ' + clock(state.generatedAt));
    root.appendChild(toolbar);
    root.appendChild(el('p', { class: 'hm-meta', text: updated.join(' · ') }));
    if (!rows.length) {
      root.appendChild(el('p', { class: 'hm-empty', text: 'אין נתונים להצגה כרגע.' }));
      return;
    }
    var grid = el('div', { class: 'hm-grid' }, rows.map(function (it) {
      var chg = it[state.period];
      var tile = el('div', { class: 'hm-tile' + (chg == null || !isFinite(chg) ? ' flat' : ''), style: shade(chg) }, [
        el('div', {}, [el('div', { class: 'nm', text: it.name }), el('div', { class: 'sym', text: it.symbol })]),
        el('div', { class: 'chg', text: fmtPct(chg) })
      ]);
      return tile;
    }));
    root.appendChild(grid);
  }

  function get(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  if (root) {
    root.appendChild(el('p', { class: 'hm-empty', text: 'טוענים את מפת החום…' }));
    Promise.all([get('data/heatmap.json'), get('prices.json')]).then(function (pair) {
      var heat = pair[0] || { items: [] };
      var prices = pair[1];
      state.generatedAt = heat.generatedAt || '';
      state.pricesAt = prices && prices.generatedAt || '';
      state.items = mergePrices(heat.items || [], prices);
      render();
    });
  }
})();
