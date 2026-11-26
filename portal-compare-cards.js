/* Credit-card comparison UI. Registers PORTAL_PAGES for compare-cards, or appends to cards.html. */
(function () {
  'use strict';
  var PAGE = 'compare-cards';
  function U() { return window.CompareUx; }
  function h(tag, attrs, kids) { return U().h(tag, attrs, kids); }

  function cardTitle(c) {
    return (c.bankHe && c.bankHe !== c.issuerHe) ? (c.bankHe + ' · ' + c.issuerHe + ' · ' + c.nameHe) : (c.issuerHe + ' · ' + c.nameHe);
  }
  function notesFor(row) {
    var notes = [];
    if (row.feeUnknown) notes.push('חסרים דמי כרטיס לאחר שנת הפטור.');
    if (row.rewardsUnknown) notes.push('אין החזר כספי מחושב (נקודות או מועדון בלי ערך בשקלים).');
    if (row.fxUnknown) notes.push('עמלת מט״ח לא פורסמה במקור הרשמי שנבדק, ולכן אינה נכללת בחישוב.');
    return notes.join(' ');
  }

  function render(main, data) {
    U().ensureCss();
    var wrap = h('div', { class: 'cmp-page', id: 'card-compare' });
    var spend = { supermarket: 3000, fuel: 800, dining: 1200, online: 1000, abroad: 500, other: 1500 };
    var year = 2, profile = 'general';
    var form = h('div', { class: 'fields' });
    (data.categories || []).forEach(function (c) {
      var id = U().uid('sp-' + c.id);
      var inp = h('input', { type: 'number', id: id, min: '0', step: '50', value: String(spend[c.id] || 0), 'aria-describedby': 'spend-help' });
      inp.addEventListener('input', function () { spend[c.id] = Number(inp.value) || 0; draw(); });
      form.appendChild(h('div', { class: 'field' }, [h('label', { for: id, text: c.he + ' (לחודש, ₪)' }), inp]));
    });
    var yid = U().uid('year'), pid = U().uid('prof');
    var ysel = h('select', { id: yid }, [
      h('option', { value: '2', text: 'שנה שנייה ואילך (שוטף)', selected: true }),
      h('option', { value: '1', text: 'שנה ראשונה (כולל פטור והטבות הצטרפות)' })
    ]);
    ysel.addEventListener('change', function () { year = Number(ysel.value); draw(); });
    var psel = h('select', { id: pid });
    (data.profiles || []).forEach(function (p) { psel.appendChild(h('option', { value: p.id, text: p.he })); });
    psel.addEventListener('change', function () { profile = psel.value; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: yid, text: 'שנת חישוב' }), ysel]));
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: pid, text: 'מה חשוב לכם' }), psel]));
    form.appendChild(h('p', { class: 'help', id: 'spend-help', text: 'ההחזר מחושב לפי השיעור שפורסם, בניכוי דמי כרטיס ועמלת המרה על הוצאות בחוץ לארץ.' }));

    var filt = U().filters({ id: 'card-filters', buttonId: 'card-filters-btn', label: 'התאמת ההוצאה החודשית', form: form, open: !U().isNarrow() });
    filt.setAttribute('data-collapse', 'mobile');

    wrap.appendChild(U().hero({
      id: 'card-hero',
      actionId: 'card-primary',
      lead: 'לפי סל הוצאות לדוגמה כבר אפשר לראות שלושה כרטיסים מובילים. התאימו את הסכומים שלכם כדי לדייק.',
      action: 'הזן סכום וקבל את 3 הטובים',
      onAction: function () {
        U().openFilters(filt);
        U().scrollTo('card-top3');
      }
    }));
    wrap.appendChild(h('div', { class: 'notice amber', text: (data.disclaimer || 'מידע בלבד, לא ייעוץ.') + ' החישוב הוא הערכה בלבד.' }));
    wrap.appendChild(filt);
    var out = h('div', { id: 'card-out' });
    wrap.appendChild(out);
    var src = h('div', { class: 'src-line' });
    wrap.appendChild(src);
    if (data.gaps && data.gaps.length) {
      var g = h('ul');
      data.gaps.forEach(function (t) { g.appendChild(h('li', { text: t })); });
      var details = h('details', { class: 'card' }, [h('summary', { class: 'card-title', text: 'מה חסר בנתונים' }), g]);
      wrap.appendChild(details);
    }
    main.appendChild(wrap);

    var cols = [
      { key: 'rank', label: 'מקום', num: true },
      { key: 'name', label: 'כרטיס' },
      { key: 'rewards', label: 'החזר לשנה', num: true, tip: 'החזר כספי מוערך לפי ההוצאה שהוזנה והשיעור שפורסם. לא כולל מבצעים לזמן מוגבל.' },
      { key: 'fees', label: 'דמי כרטיס', num: true, tip: 'העלות השנתית של הכרטיס בשנת החישוב שנבחרה. אם חסר נתון רשמי מוצג אזהרה.' },
      { key: 'fx', label: 'עלות המרת מט״ח', num: true, tip: 'רק על הוצאות בקטגוריה "חוץ לארץ", לפי העמלה שפורסמה. אם לא פורסמה — לא נכללת.' },
      { key: 'net', label: 'נשאר ביד לשנה', num: true, tip: 'ההחזר פחות דמי הכרטיס ופחות עלות המרת המט״ח. הערכה בלבד, לא ייעוץ.' },
      { key: 'fxpct', label: 'עמלת המרה', num: true, tip: 'אחוז העמלה שפורסם על עסקאות במטבע חוץ. מקף פירושו שהנתון לא פורסם.' }
    ];

    function toRow(row, i) {
      var c0 = row.card;
      var title = cardTitle(c0);
      var note = notesFor(row);
      var extra = null;
      var srcs = (c0.sources || []);
      if (srcs.length || (c0.benefitsHe && c0.benefitsHe.length) || c0.feeNoteHe) {
        var kids = [];
        if (c0.feeNoteHe || c0.fxPromoHe) kids.push(h('p', { class: 'help', text: (c0.feeNoteHe || '') + (c0.fxPromoHe ? ' ' + c0.fxPromoHe : '') }));
        if (c0.benefitsHe && c0.benefitsHe.length) {
          var ul = h('ul');
          c0.benefitsHe.forEach(function (t) { ul.appendChild(h('li', { text: t })); });
          kids.push(ul);
        }
        srcs.forEach(function (s) {
          kids.push(h('div', { class: 'src-line' }, [
            h('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.label }),
            h('span', { class: 'stamp', text: 'עודכן ב־' + s.asOf })
          ]));
        });
        extra = h('details', { class: 'cmp-more' }, [h('summary', { text: 'פרטים ומקור' })].concat(kids));
      }
      return {
        title: title,
        value: U().money(row.net),
        valueClass: row.net >= 0 ? 'pos' : 'neg',
        fields: [
          { k: 'החזר לשנה', v: U().money(row.rewards) },
          { k: 'דמי כרטיס', v: U().money(-row.fees) },
          { k: 'עלות המרת מט״ח', v: U().money(-row.fxCost) },
          { k: 'עמלת המרה', v: U().pct(row.card.fxFeePct) }
        ],
        note: note,
        extra: extra,
        mine: i === 0,
        cells: [
          { text: String(i + 1), num: true },
          { text: title + (note ? ' · ' + note : '') },
          { text: U().money(row.rewards), num: true },
          { text: U().money(-row.fees), num: true },
          { text: U().money(-row.fxCost), num: true },
          { text: U().money(row.net), num: true, valueClass: row.net >= 0 ? 'pos' : 'neg' },
          { text: U().pct(row.card.fxFeePct), num: true }
        ]
      };
    }

    function draw() {
      var ranked = window.CompareLib.rankCards(data.cards, spend, { year: year, profile: profile });
      out.innerHTML = '';
      if (profile === 'crypto') {
        out.appendChild(h('div', { class: 'notice amber', text: 'לא נמצא כרטיס עם החזר בקריפטו ותנאים פומביים שאומתו לישראל. מוצג הדירוג הכללי, בלי כרטיס קריפטו.' }));
      }
      var topItems = ranked.slice(0, 3).map(function (row, i) {
        return {
          title: cardTitle(row.card),
          value: U().money(row.net),
          valueClass: row.net >= 0 ? 'pos' : 'neg',
          sub: 'נשאר ביד לשנה, אחרי דמי כרטיס והמרת מט״ח.',
          note: notesFor(row),
          mine: i === 0
        };
      });
      out.appendChild(U().top3(topItems, { id: 'card-top3', title: 'שלושת הכרטיסים המובילים עבורכם', empty: 'אין כרטיסים להצגה לפי הבחירה.' }));
      if (!ranked.length) {
        out.appendChild(U().empty('אין כרטיסים להשוואה בנתונים שפורסמו.'));
        return;
      }
      out.appendChild(h('h2', { class: 'sec-h', text: 'כל הכרטיסים בהשוואה' }));
      out.appendChild(U().results(cols, ranked.map(toRow), { caption: 'דירוג כרטיסים לפי ערך שנתי מוערך', empty: 'אין כרטיסים להצגה.' }));
      out.appendChild(h('p', { class: 'help', text: 'הערכה בלבד. בשנה הראשונה נספר פטור מדמי כרטיס אם פורסם. עמלת המרה מחושבת על סכום "חוץ לארץ" לפי התעריף שפורסם, בלי מבצעים לזמן מוגבל.' }));
      src.innerHTML = '';
      src.appendChild(h('span', { text: 'הנתונים נבדקו ב־' + (data.checkedOn || '') + '.' }));
    }
    draw();
  }

  function boot(main) {
    if (!main) return;
    if (document.getElementById('card-compare')) return;
    U().ensureCss();
    var shell = h('div', { class: 'cmp-page', id: 'card-compare' });
    shell.appendChild(U().hero({ lead: 'משווים דמי כרטיס, החזרים ועמלת המרה לפי ההוצאה שלכם.', action: 'טוענים…', actionId: 'card-primary' }));
    var skel = U().skeleton('טוענים את נתוני הכרטיסים…');
    shell.appendChild(skel);
    main.appendChild(shell);
    U().afterPaint(function () {
      U().fetchJson('data/cards.json').then(function (data) {
        shell.parentNode && shell.parentNode.removeChild(shell);
        render(main, data);
      }).catch(function (err) {
        skel.parentNode && skel.parentNode.replaceChild(h('div', { class: 'notice red', text: 'לא ניתן לטעון את נתוני הכרטיסים כרגע. הנתונים לא הומצאו.' }), skel);
        console.warn(err);
      });
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
  function start() {
    if (window.CompareUx && window.CompareUx.hero) hook();
    else if (window.CompareUx && window.CompareUx.ensureUx) window.CompareUx.ensureUx(hook);
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
