/* Credit-card comparison UI. Registers PORTAL_PAGES for compare-cards, or appends to cards.html. */
(function () {
  'use strict';
  var PAGE = 'compare-cards';
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
  function pct(v) { return v == null || !Number.isFinite(v) ? '—' : (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }
  function ensureCss() {
    if (document.querySelector('link[href="compare.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'compare.css'; document.head.appendChild(l);
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }

  function render(main, data) {
    ensureCss();
    var wrap = h('div', { class: 'cmp-page', id: 'card-compare' });
    var spend = { supermarket: 3000, fuel: 800, dining: 1200, online: 1000, abroad: 500, other: 1500 };
    var year = 2, profile = 'general';
    var form = h('div', { class: 'fields' });
    var cats = (data.categories || []);
    cats.forEach(function (c) {
      var id = uid('sp-' + c.id);
      var inp = h('input', { type: 'number', id: id, min: '0', step: '50', value: String(spend[c.id] || 0), 'aria-describedby': 'spend-help' });
      inp.addEventListener('input', function () { spend[c.id] = Number(inp.value) || 0; draw(); });
      form.appendChild(h('div', { class: 'field' }, [h('label', { for: id, text: c.he + ' (לחודש, ₪)' }), inp]));
    });
    var yid = uid('year'), pid = uid('prof');
    var ysel = h('select', { id: yid }, [
      h('option', { value: '2', text: 'שנה שנייה ואילך (שוטף)', selected: true }),
      h('option', { value: '1', text: 'שנה ראשונה (כולל פטור והטבות הצטרפות)' })
    ]);
    ysel.addEventListener('change', function () { year = Number(ysel.value); draw(); });
    var psel = h('select', { id: pid });
    (data.profiles || []).forEach(function (p) { psel.appendChild(h('option', { value: p.id, text: p.he })); });
    psel.addEventListener('change', function () { profile = psel.value; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: yid, text: 'שנת חישוב' }), ysel]));
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: pid, text: 'התאמה להעדפה' }), psel]));

    var out = h('div');
    var src = h('div', { class: 'src-line' });
    wrap.appendChild(h('div', { class: 'notice amber', text: (data.disclaimer || 'מידע בלבד, לא ייעוץ.') + ' החישוב הוא הערכה בלבד.' }));
    wrap.appendChild(h('p', { class: 'help', id: 'spend-help', text: 'הזינו הוצאה חודשית משוערת בכל קטגוריה. ההחזר מחושב לפי השיעור שפורסם, בניכוי דמי כרטיס ועמלת המרה על הוצאות בחוץ לארץ.' }));
    wrap.appendChild(form);
    wrap.appendChild(out);
    wrap.appendChild(src);

    if (data.gaps && data.gaps.length) {
      var g = h('ul');
      data.gaps.forEach(function (t) { g.appendChild(h('li', { text: t })); });
      wrap.appendChild(h('div', { class: 'card' }, [h('h3', { class: 'card-title', text: 'מה חסר בנתונים' }), g]));
    }

    function draw() {
      var Lib = window.CompareLib;
      var ranked = Lib.rankCards(data.cards, spend, { year: year, profile: profile });
      out.innerHTML = '';
      if (profile === 'crypto') {
        out.appendChild(h('div', { class: 'notice amber', text: 'לא נמצא כרטיס עם החזר בקריפטו ותנאים פומביים שאומתו לישראל. מוצג הדירוג הכללי, בלי כרטיס קריפטו.' }));
      }
      var tbl = document.createElement('table');
      tbl.className = 'cmp data';
      var cap = document.createElement('caption');
      cap.className = 'sr-only';
      cap.textContent = 'דירוג כרטיסים לפי ערך שנתי מוערך';
      tbl.appendChild(cap);
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      ['דירוג', 'כרטיס', 'החזר שנתי מוערך', 'דמי כרטיס', 'עמלת המרה', 'ערך נטו שנתי', 'עמלת מט״ח'].forEach(function (label) {
        var th = document.createElement('th'); th.scope = 'col'; th.textContent = label; hr.appendChild(th);
      });
      thead.appendChild(hr); tbl.appendChild(thead);
      var tb = document.createElement('tbody');
      ranked.forEach(function (row, i) {
        var tr = document.createElement('tr');
        if (i === 0) tr.className = 'mine';
        function td(text, num) { var e = document.createElement('td'); if (num) e.className = 'num'; e.textContent = text; tr.appendChild(e); }
        td(String(i + 1), true);
        var name = document.createElement('td');
        name.appendChild(document.createTextNode(row.card.issuerHe + ' · ' + row.card.nameHe));
        if (row.feeUnknown) {
          var w = document.createElement('div'); w.className = 'warn-fee'; w.textContent = 'חסרים דמי כרטיס לאחר שנת הפטור'; name.appendChild(w);
        }
        if (row.rewardsUnknown) {
          var w2 = document.createElement('div'); w2.className = 'help'; w2.textContent = 'אין החזר כספי מחושב (נקודות או מועדון בלי ערך שקלי)'; name.appendChild(w2);
        }
        tr.appendChild(name);
        td(money(row.rewards), true);
        td(money(-row.fees), true);
        td(money(-row.fxCost), true);
        var net = document.createElement('td'); net.className = 'num ' + (row.net >= 0 ? 'pos' : 'neg'); net.textContent = money(row.net); tr.appendChild(net);
        td(pct(row.card.fxFeePct), true);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      var box = h('div', { class: 'tbl-wrap' }, [tbl]);
      out.appendChild(box);
      out.appendChild(h('p', { class: 'help', text: 'הערכה בלבד. בשנה הראשונה נספר פטור מדמי כרטיס אם פורסם. עמלת המרה מחושבת על סכום הקטגוריה "חוץ לארץ" לפי תעריף המנפיק, בלי מבצעים לזמן מוגבל.' }));

      /* detail cards */
      ranked.forEach(function (row) {
        var c = row.card;
        var bits = (c.benefitsHe || []).map(function (t) { return h('li', { text: t }); });
        var srcs = (c.sources || []).map(function (s) {
          return h('div', { class: 'src-line' }, [
            h('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label }),
            h('span', { class: 'stamp', text: 'עודכן ב־' + s.asOf })
          ]);
        });
        out.appendChild(h('div', { class: 'card' }, [
          h('h3', { class: 'card-title', text: c.issuerHe + ' · ' + c.nameHe }),
          h('p', { class: 'help', text: (c.feeNoteHe || '') + (c.fxPromoHe ? ' ' + c.fxPromoHe : '') }),
          bits.length ? h('ul', null, bits) : null
        ].concat(srcs)));
      });

      src.innerHTML = '';
      src.appendChild(h('span', { text: 'נתונים שנבדקו ב־' + (data.checkedOn || '') + '.' }));
    }
    draw();
    main.appendChild(wrap);
  }

  function boot(main) { load().then(function (data) { render(main, data); }).catch(function (err) {
    main.appendChild(h('div', { class: 'notice red', text: 'לא ניתן לטעון את נתוני הכרטיסים כרגע.' }));
    console.warn(err);
  }); }
  function load() {
    return fetch('data/cards.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('cards');
      return r.json();
    });
  }

  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES[PAGE] = { title: ['compare_cards_title', 'compare_cards_sub'], render: function (main) { boot(main); } };

  function hook() {
    var page = document.body && document.body.getAttribute('data-page');
    if (page === PAGE) return;
    if (page !== 'cards') return;
    var main = document.querySelector('#portal main') || document.querySelector('main');
    if (!main) { setTimeout(hook, 40); return; }
    if (document.getElementById('card-compare')) return;
    main.appendChild(h('h2', { class: 'sec-h', text: 'השוואת כרטיסים בשוק' }));
    boot(main);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
})();
