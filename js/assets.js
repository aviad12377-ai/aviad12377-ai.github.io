/* Real assets (home, car, land, other) with manual values and currency. Stored in the main data doc (home.assets), so they count in net worth everywhere. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var KINDS = [['home', 'דירה או בית', 'a_realestate'], ['land', 'קרקע או מגרש', 'a_realestate'], ['car', 'רכב', 'a_car'], ['business', 'עסק', 'a_business'], ['crypto', 'מטבעות דיגיטליים', 'a_crypto'], ['other', 'אחר', 'a_other']];
  function kindOf(r) { if (r.sub) return r.sub; return ({ a_realestate: 'home', a_car: 'car', a_business: 'business', a_crypto: 'crypto', a_other: 'other' })[r.type] || 'other'; }
  function render(main) {
    var d = T.portalData();
    if (!d || !d.home || !Array.isArray(d.home.assets)) { main.appendChild(T.card('נכסים', [h('p', { class: 'notice amber', text: 'לא הצלחנו לטעון את הנתונים. נסה לרענן את הדף.' })])); return; }
    var rows = d.home.assets, sumBox = h('div'), status = T.live();
    function drawSum() {
      sumBox.innerHTML = '';
      var by = {}, total = 0, missing = 0;
      rows.forEach(function (r) { var v = T.toILS(r.value, r.currency || 'ILS'); if (v === null) { missing++; return; } var k = kindOf(r); by[k] = (by[k] || 0) + v; total += v; });
      var items = [T.tot('שווי כל הנכסים', T.disp(total), 'big')];
      KINDS.forEach(function (k) { if (by[k[0]]) items.push(T.tot(k[1], T.disp(by[k[0]]))); });
      sumBox.appendChild(h('div', { class: 'totals' }, items));
      var P = window.Portal, s = null; try { s = P.calc.summary(); } catch (e) {}
      if (s && Number.isFinite(s.net)) sumBox.appendChild(h('p', { class: 't13-note', text: 'ההון נטו שלך כולל את הנכסים האלה: ' + T.disp(s.net) + (total && s.assets > 0 ? '. הנכסים כאן הם ' + Math.round(total / s.assets * 100) + '% מכלל הנכסים.' : '.') }));
      if (missing) sumBox.appendChild(h('p', { class: 'help', text: 'ל־' + missing + ' נכסים חסר שער מטבע, והם לא נכללו.' }));
      status.textContent = rows.length ? 'שווי הנכסים: ' + T.disp(total) + '.' : '';
    }
    function changed() { T.saveData(); drawSum(); }
    rows.forEach(function (r) { if (!r.kind13) r.kind13 = kindOf(r); });
    var list = T.listEditor(rows, [
      { k: 'name', label: 'שם', type: 'text', placeholder: 'למשל: הדירה, הרכב' },
      { k: 'kind13', label: 'סוג', type: 'select', options: KINDS.map(function (k) { return [k[0], k[1]]; }), def: 'home' },
      { k: 'value', label: 'שווי משוער', type: 'number' },
      { k: 'currency', label: 'מטבע', type: 'select', options: T.curOptions(), def: 'ILS' },
      { k: 'valuedAt', label: 'נכון לתאריך', type: 'date' },
      { k: 'liquid', label: 'אפשר למכור מהר (נזיל)', type: 'check', def: false }
    ], function () {
      rows.forEach(function (r) { var k = KINDS.filter(function (x) { return x[0] === r.kind13; })[0] || KINDS[0]; r.kind13 = k[0]; r.type = k[2]; if (k[2] === 'a_realestate') r.sub = k[0]; else delete r.sub; if (!r.currency) r.currency = 'ILS'; });
      changed();
    }, { addLabel: 'הוספת נכס', rowTitle: 'נכס', empty: 'עדיין אין נכסים. מוסיפים דירה, רכב, קרקע או כל נכס אחר עם שווי משוער.' });
    drawSum();
    main.appendChild(T.card('סיכום', [status, sumBox]));
    main.appendChild(T.card('הנכסים שלי', [list.el, h('p', { class: 't13-note', text: 'השווי הוא הערכה שלך. כדאי לעדכן פעם בכמה חודשים, למשל לפי מחירון רכב או עסקאות דומות באזור.' })]));
    main.appendChild(T.card('גם חשוב', [h('div', { class: 't13-hub' }, [h('a', { href: 'mortgage.html', text: 'משכנתא על הדירה' }), h('a', { href: 'loans.html', text: 'הלוואת רכב והלוואות אחרות' }), h('a', { href: 'networth.html', text: 'ההון לאורך זמן' })])]));
  }
  T.page('assets', 'נכסים: דירה, רכב וקרקע', 'שווי משוער שנכנס לחישוב ההון נטו', render);
})();
