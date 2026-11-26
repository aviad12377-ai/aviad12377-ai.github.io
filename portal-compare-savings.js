/* Deposit comparison UI. Registers PORTAL_PAGES for compare-savings, or appends to savings.html. */
(function () {
  'use strict';
  var PAGE = 'compare-savings';
  function U() { return window.CompareUx; }
  function h(tag, attrs, kids) { return U().h(tag, attrs, kids); }

  function stripBoiPlaceholder(main) {
    if (!main) return;
    var cards = main.querySelectorAll('section.card');
    Array.prototype.forEach.call(cards, function (sec) {
      if (sec.id === 'savings-compare' || (sec.querySelector && sec.querySelector('#savings-compare'))) return;
      var text = sec.textContent || '';
      if (/ממתין לנתוני ריביות הפיקדונות של בנק ישראל|גוף לדוגמה|Waiting for Bank of Israel deposit rates|Sample provider|Pendiente de tipos de depósito del Banco de Israel|Entidad de ejemplo/.test(text)) {
        sec.parentNode && sec.parentNode.removeChild(sec);
      }
    });
  }

  function liqHe(p) {
    return p.liquidity === 'high' ? 'נזיל יותר' : p.liquidity === 'medium' ? 'בינוני' : 'עד סוף התקופה';
  }
  function linkHe(p) { return p.linkage === 'cpi' ? 'צמוד מדד' : 'לא צמוד'; }

  function render(main, data) {
    U().ensureCss();
    var wrap = h('div', { class: 'cmp-page', id: 'savings-compare' });
    var products = (data.deposits && data.deposits.products) || [];
    var filters = { rateType: '', termId: '', linkage: '', liquidity: '', providerId: '', minAmount: null, maxAmount: null };
    var showAll = false;
    var amount = 100000;

    var form = h('div', { class: 'fields' });
    function addSelect(label, key, options) {
      var id = U().uid(key);
      var sel = h('select', { id: id });
      sel.appendChild(h('option', { value: '', text: 'הכול' }));
      options.forEach(function (o) { sel.appendChild(h('option', { value: o.v, text: o.t })); });
      sel.addEventListener('change', function () { filters[key] = sel.value; draw(); });
      form.appendChild(h('div', { class: 'field' }, [h('label', { for: id, text: label }), sel]));
    }
    var types = {}, terms = {}, liqs = {}, provs = {};
    products.forEach(function (p) {
      types[p.rateType] = p.rateTypeHe;
      terms[p.termId] = p.termHe;
      liqs[p.liquidity] = liqHe(p);
      provs[p.providerId] = p.providerHe;
    });
    addSelect('סוג ריבית', 'rateType', Object.keys(types).map(function (k) { return { v: k, t: types[k] }; }));
    addSelect('תקופה', 'termId', Object.keys(terms).map(function (k) { return { v: k, t: terms[k] }; }));
    addSelect('הצמדה', 'linkage', [{ v: 'unlinked', t: 'לא צמוד' }, { v: 'cpi', t: 'צמוד מדד' }]);
    addSelect('כמה נזיל', 'liquidity', Object.keys(liqs).map(function (k) { return { v: k, t: liqs[k] }; }));
    addSelect('בנק', 'providerId', Object.keys(provs).map(function (k) { return { v: k, t: provs[k] }; }));
    var aid = U().uid('amt'), minid = U().uid('min'), maxid = U().uid('max');
    var ainp = h('input', { type: 'number', id: aid, min: '0', step: '1000', value: '100000' });
    ainp.addEventListener('input', function () { amount = Number(ainp.value) || 0; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: aid, text: 'סכום להערכה (₪)' }), ainp]));
    var mininp = h('input', { type: 'number', id: minid, min: '0', step: '1000', placeholder: 'ללא' });
    var maxinp = h('input', { type: 'number', id: maxid, min: '0', step: '1000', placeholder: 'ללא' });
    mininp.addEventListener('input', function () { filters.minAmount = mininp.value ? Number(mininp.value) : null; draw(); });
    maxinp.addEventListener('input', function () { filters.maxAmount = maxinp.value ? Number(maxinp.value) : null; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: minid, text: 'סכום מינימום לסינון (₪)' }), mininp]));
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: maxid, text: 'סכום מקסימום לסינון (₪)' }), maxinp]));

    var dep = data.deposits || {};
    var filt = U().filters({ id: 'deposit-filters', buttonId: 'deposit-filters-btn', label: 'סינון לפי תקופה, בנק וסכום', form: form, open: !U().isNarrow() });
    filt.setAttribute('data-collapse', 'mobile');

    wrap.appendChild(U().hero({
      id: 'deposit-hero',
      actionId: 'deposit-primary',
      lead: 'הריביות הן ממוצעים ששולמו בפועל בחודש הדיווח, לא הצעה שתקבלו היום. שלושת המובילים מוצגים מיד; אפשר לסנן לפי תקופה ובנק.',
      action: 'סנן לפי תקופה וקבל את 3 המובילים',
      onAction: function () { U().openFilters(filt); U().scrollTo('deposit-top3'); }
    }));
    wrap.appendChild(h('div', { class: 'notice amber', text: (data.disclaimer || 'מידע בלבד, לא ייעוץ.') }));
    wrap.appendChild(h('div', { class: 'src-line' }, [
      h('a', { href: dep.source && dep.source.url, target: '_blank', rel: 'noopener', text: dep.source ? dep.source.label : 'בנק ישראל' }),
      h('span', { class: 'stamp', text: 'חודש הדיווח: ' + (dep.period || '') + (dep.workbookDate ? ' · הקובץ מ־' + dep.workbookDate : '') })
    ]));
    wrap.appendChild(filt);
    var out = h('div');
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
      wrap.appendChild(h('details', { class: 'card' }, [h('summary', { class: 'card-title', text: 'מה חסר בנתונים' }), g]));
    }
    main.appendChild(wrap);

    var cols = [
      { key: 'bank', label: 'בנק' },
      { key: 'type', label: 'סוג ריבית', tip: 'ריבית קבועה או משתנה, כפי שסווג בקובץ הרשמי.' },
      { key: 'link', label: 'הצמדה' },
      { key: 'term', label: 'תקופה' },
      { key: 'liq', label: 'כמה נזיל', tip: 'האם אפשר למשוך לפני סוף התקופה, לפי הסיווג בקובץ.' },
      { key: 'rate', label: 'ריבית ממוצעת ששולמה', num: true, tip: 'ממוצע הריבית ששולמה בפועל בחודש הדיווח, לא הצעה אישית.' },
      { key: 'sys', label: 'ממוצע במערכת', num: true, tip: 'הממוצע לכלל הבנקים באותה קבוצה, אם פורסם.' },
      { key: 'est', label: 'ריבית מוערכת על הסכום', num: true, tip: 'סכום × שיעור × אמצע התקופה ÷ 365. בלי מס ובלי פירעון מוקדם. הערכה בלבד.' }
    ];

    function draw() {
      var Lib = window.CompareLib;
      var vis = Lib.visibleDeposits(products, filters, { limit: 20, showAll: showAll });
      var list = vis.list;
      out.innerHTML = '';
      var topItems = list.slice(0, 3).map(function (p, i) {
        var mid = (p.termMinDays + p.termMaxDays) / 2;
        return {
          title: p.providerHe + ' · ' + p.termHe,
          value: U().pct(p.ratePct),
          sub: linkHe(p) + ' · ' + p.rateTypeHe + ' · ריבית מוערכת על הסכום: ' + U().money(Lib.depositInterest(amount, p.ratePct, mid)),
          mine: i === 0
        };
      });
      out.appendChild(U().top3(topItems, { id: 'deposit-top3', title: 'שלושת הפיקדונות המובילים עבורכם', empty: 'אין פיקדונות לפי הסינון שנבחר.' }));

      var bar = h('div', { class: 'cmp-toolbar' });
      var status = vis.total === 0
        ? 'אין תוצאות לפי הסינון.'
        : (vis.limited
          ? ('מוצגים 20 המסלולים עם הריבית הממוצעת הגבוהה ביותר, מתוך ' + vis.total + ' לפי הסינון.')
          : ('מוצגים ' + list.length + ' מסלולים' + (showAll && vis.total > 20 ? ' (כל התוצאות לפי הסינון)' : '') + '.'));
      bar.appendChild(h('p', { class: 'help', id: 'deposit-count', text: status }));
      if (vis.total > 20) {
        var btn = h('button', {
          type: 'button', class: 'cmp-toggle', id: 'deposit-show-all',
          'aria-pressed': showAll ? 'true' : 'false',
          text: showAll ? 'הצג 20 המובילים' : 'הצג את כל המסלולים'
        });
        btn.addEventListener('click', function () { showAll = !showAll; draw(); });
        bar.appendChild(btn);
      }
      out.appendChild(bar);
      if (!list.length) {
        out.appendChild(U().empty('אין תוצאות לפי הסינון. נסו להרחיב את הבחירה.', 'נסו סינון אחר', function () { U().openFilters(filt); }, 'deposit-empty-action'));
        return;
      }
      var rows = list.map(function (p, i) {
        var mid = (p.termMinDays + p.termMaxDays) / 2;
        var est = U().money(Lib.depositInterest(amount, p.ratePct, mid));
        return {
          title: p.providerHe,
          value: U().pct(p.ratePct),
          mine: i === 0,
          fields: [
            { k: 'סוג ריבית', v: p.rateTypeHe },
            { k: 'הצמדה', v: linkHe(p) },
            { k: 'תקופה', v: p.termHe },
            { k: 'כמה נזיל', v: liqHe(p) },
            { k: 'ממוצע במערכת', v: U().pct(p.systemAvgPct) },
            { k: 'ריבית מוערכת על הסכום', v: est }
          ],
          cells: [
            p.providerHe, p.rateTypeHe, linkHe(p), p.termHe, liqHe(p),
            { text: U().pct(p.ratePct), num: true },
            { text: U().pct(p.systemAvgPct), num: true },
            { text: est, num: true }
          ]
        };
      });
      out.appendChild(U().results(cols, rows, { caption: 'פיקדונות לפי ריבית ממוצעת ששולמה', empty: 'אין תוצאות לפי הסינון.' }));
      out.appendChild(h('p', { class: 'help', text: 'ברירת המחדל היא 20 המסלולים עם הריבית הממוצעת הגבוהה ביותר לפי הסינון. אין בנתונים סכום מינימום או מקסימום רשמי, לכן סינון לפי סכום משמש רק להערכת הריבית. הערכה בלבד.' }));
    }
    draw();
  }

  function boot(main) {
    if (!main) return;
    if (document.getElementById('savings-compare')) return;
    U().ensureCss();
    var shell = h('div', { class: 'cmp-page', id: 'savings-compare' });
    shell.appendChild(U().hero({ lead: 'משווים ממוצעי ריבית ששולמו בפועל, לפי בנק ישראל.', action: 'טוענים…', actionId: 'deposit-primary' }));
    var skel = U().skeleton('טוענים את נתוני הפיקדונות…');
    shell.appendChild(skel);
    main.appendChild(shell);
    U().afterPaint(function () {
      U().fetchJson('data/savings.json').then(function (data) {
        shell.parentNode && shell.parentNode.removeChild(shell);
        render(main, data);
      }).catch(function (err) {
        skel.parentNode && skel.parentNode.replaceChild(h('div', { class: 'notice red', text: 'לא ניתן לטעון את נתוני הפיקדונות כרגע. הנתונים לא הומצאו.' }), skel);
        console.warn(err);
      });
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
    stripBoiPlaceholder(main);
    if (document.getElementById('savings-compare')) return;
    main.appendChild(h('h2', { class: 'sec-h', text: 'השוואת פיקדונות בשוק' }));
    boot(main);
    var n = 0;
    var id = setInterval(function () {
      stripBoiPlaceholder(main);
      if (++n > 24) clearInterval(id);
    }, 50);
  }
  function start() {
    if (window.CompareUx && window.CompareUx.hero) hook();
    else {
      var s = document.createElement('script');
      s.src = 'compare-ux.js';
      s.onload = hook;
      document.head.appendChild(s);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
