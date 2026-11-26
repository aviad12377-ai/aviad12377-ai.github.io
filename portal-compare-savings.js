/* Deposit comparison UI. Registers PORTAL_PAGES for compare-savings, or appends to savings.html. */
(function () {
  'use strict';
  var PAGE = 'compare-savings';
  function h(tag, attrs, kids) {
    if (window.Portal && window.Portal.ui && window.Portal.ui.h) return window.Portal.ui.h(tag, attrs, kids);
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function money(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    var sign = v < 0 ? '−' : '';
    return sign + '₪' + Math.abs(Math.round(v)).toLocaleString('en-US');
  }
  function pct(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    return (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }
  function ensureCss() {
    if (document.querySelector('link[href="compare.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'compare.css'; document.head.appendChild(l);
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }

  function render(main, data) {
    ensureCss();
    var wrap = h('div', { class: 'cmp-page', id: 'savings-compare' });
    var products = (data.deposits && data.deposits.products) || [];
    var filters = { rateType: '', termId: '', liquidity: '', providerId: '', minAmount: null, maxAmount: null };
    var amount = 100000;

    var form = h('div', { class: 'fields' });
    function addSelect(label, key, options, extra) {
      var id = uid(key);
      var sel = h('select', { id: id });
      sel.appendChild(h('option', { value: '', text: 'הכול' }));
      options.forEach(function (o) { sel.appendChild(h('option', { value: o.v, text: o.t })); });
      sel.addEventListener('change', function () { filters[key] = sel.value; draw(); });
      form.appendChild(h('div', { class: 'field' }, [h('label', { for: id, text: label }), sel]));
      return sel;
    }
    var types = {}, terms = {}, liqs = {}, provs = {};
    products.forEach(function (p) {
      types[p.rateType] = p.rateTypeHe;
      terms[p.termId] = p.termHe;
      liqs[p.liquidity] = p.liquidity === 'high' ? 'נזיל יותר' : p.liquidity === 'medium' ? 'בינוני' : 'עד סוף התקופה';
      provs[p.providerId] = p.providerHe;
    });
    addSelect('סוג ריבית', 'rateType', Object.keys(types).map(function (k) { return { v: k, t: types[k] }; }));
    addSelect('תקופה', 'termId', Object.keys(terms).map(function (k) { return { v: k, t: terms[k] }; }));
    addSelect('נזילות', 'liquidity', Object.keys(liqs).map(function (k) { return { v: k, t: liqs[k] }; }));
    addSelect('בנק', 'providerId', Object.keys(provs).map(function (k) { return { v: k, t: provs[k] }; }));
    var aid = uid('amt'), minid = uid('min'), maxid = uid('max');
    var ainp = h('input', { type: 'number', id: aid, min: '0', step: '1000', value: '100000' });
    ainp.addEventListener('input', function () { amount = Number(ainp.value) || 0; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: aid, text: 'סכום להערכה (₪)' }), ainp]));
    var mininp = h('input', { type: 'number', id: minid, min: '0', step: '1000', placeholder: 'ללא' });
    var maxinp = h('input', { type: 'number', id: maxid, min: '0', step: '1000', placeholder: 'ללא' });
    mininp.addEventListener('input', function () { filters.minAmount = mininp.value ? Number(mininp.value) : null; draw(); });
    maxinp.addEventListener('input', function () { filters.maxAmount = maxinp.value ? Number(maxinp.value) : null; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: minid, text: 'סכום מינימום לסינון (₪)' }), mininp]));
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: maxid, text: 'סכום מקסימום לסינון (₪)' }), maxinp]));

    var out = h('div');
    var dep = data.deposits || {};
    wrap.appendChild(h('div', { class: 'notice amber', text: (data.disclaimer || 'מידע בלבד, לא ייעוץ.') }));
    wrap.appendChild(h('p', { class: 'help', text: 'הריביות הן ממוצעים ששולמו בפועל בחודש הדיווח, לא הצעה שתקבלו היום. אין בנתונים סכום מינימום או מקסימום רשמי, לכן סינון לפי סכום משמש רק להערכת הריבית על הסכום שהוזן.' }));
    wrap.appendChild(h('div', { class: 'src-line' }, [
      h('a', { href: dep.source && dep.source.url, target: '_blank', rel: 'noopener', text: dep.source ? dep.source.label : 'בנק ישראל, קו המשווה' }),
      h('span', { class: 'stamp', text: 'חודש הדיווח: ' + (dep.period || '') + (dep.workbookDate ? ' · קובץ מ־' + dep.workbookDate : '') })
    ]));
    wrap.appendChild(form);
    wrap.appendChild(out);

    var mm = data.moneyMarketFunds;
    if (mm) {
      wrap.appendChild(h('div', { class: 'card' }, [
        h('h3', { class: 'card-title', text: 'קרנות כספיות' }),
        h('p', { class: 'help', text: mm.note }),
        h('div', { class: 'src-line' }, [h('a', { href: mm.source.url, target: '_blank', rel: 'noopener', text: mm.source.label })])
      ]));
    }
    if (data.gaps && data.gaps.length) {
      var g = h('ul'); data.gaps.forEach(function (t) { g.appendChild(h('li', { text: t })); });
      wrap.appendChild(h('div', { class: 'card' }, [h('h3', { class: 'card-title', text: 'מה חסר בנתונים' }), g]));
    }

    function draw() {
      var Lib = window.CompareLib;
      var list = Lib.filterDeposits(products, filters).slice();
      list.sort(function (a, b) { return (b.ratePct || 0) - (a.ratePct || 0); });
      out.innerHTML = '';
      var tbl = document.createElement('table');
      tbl.className = 'cmp data';
      var cap = document.createElement('caption'); cap.className = 'sr-only'; cap.textContent = 'פיקדונות לפי ריבית ממוצעת';
      tbl.appendChild(cap);
      var thead = document.createElement('thead'), hr = document.createElement('tr');
      ['בנק', 'סוג', 'תקופה', 'נזילות', 'ריבית ממוצעת', 'ממוצע מערכת', 'ריבית מוערכת על הסכום'].forEach(function (label) {
        var th = document.createElement('th'); th.scope = 'col'; th.textContent = label; hr.appendChild(th);
      });
      thead.appendChild(hr); tbl.appendChild(thead);
      var tb = document.createElement('tbody');
      if (!list.length) {
        var tr0 = document.createElement('tr'); var td0 = document.createElement('td'); td0.colSpan = 7; td0.textContent = 'אין תוצאות לפי הסינון.'; tr0.appendChild(td0); tb.appendChild(tr0);
      }
      list.forEach(function (p, i) {
        var tr = document.createElement('tr');
        if (i === 0) tr.className = 'mine';
        function td(text, num) { var e = document.createElement('td'); if (num) e.className = 'num'; e.textContent = text; tr.appendChild(e); }
        td(p.providerHe);
        td(p.rateTypeHe);
        td(p.termHe);
        td(p.liquidity === 'high' ? 'נזיל יותר' : p.liquidity === 'medium' ? 'בינוני' : 'עד סוף התקופה');
        td(pct(p.ratePct), true);
        td(pct(p.systemAvgPct), true);
        var mid = (p.termMinDays + p.termMaxDays) / 2;
        td(money(Lib.depositInterest(amount, p.ratePct, mid)), true);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      out.appendChild(h('div', { class: 'tbl-wrap' }, [tbl]));
      out.appendChild(h('p', { class: 'help', text: 'מוצגים ' + list.length + ' מסלולים. הריבית המוערכת היא סכום × שיעור × אמצע התקופה / 365, בלי מס ובלי פירעון מוקדם. הערכה בלבד.' }));
    }
    draw();
    main.appendChild(wrap);
  }

  function load() { return fetch('data/savings.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('savings'); return r.json(); }); }
  function boot(main) {
    load().then(function (data) { render(main, data); }).catch(function (err) {
      main.appendChild(h('div', { class: 'notice red', text: 'לא ניתן לטעון את נתוני הפיקדונות כרגע.' }));
      console.warn(err);
    });
  }

  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES[PAGE] = { title: ['compare_savings_title', 'compare_savings_sub'], render: function (main) { boot(main); } };

  function hook() {
    var page = document.body && document.body.getAttribute('data-page');
    if (page === PAGE) return;
    if (page !== 'savings') return;
    var main = document.querySelector('#portal main') || document.querySelector('main');
    if (!main) { setTimeout(hook, 40); return; }
    if (document.getElementById('savings-compare')) return;
    main.appendChild(h('h2', { class: 'sec-h', text: 'השוואת פיקדונות בשוק' }));
    boot(main);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
})();
