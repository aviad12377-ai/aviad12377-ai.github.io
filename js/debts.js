/* Debt payoff planner: avalanche (highest rate first) vs snowball (smallest balance first). Uses the loans already entered plus extra debts added here. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  function imported() {
    var d = T.portalData(), out = [], P = window.Portal;
    if (!d) return out;
    ((d.home && d.home.loans) || []).forEach(function (r, i) {
      var bal = T.num(r.balance); if (!(bal > 0)) return;
      var pmt = T.numOrNull(r.payment); if (pmt === null && P && P.calc && P.calc.mortgage) { try { pmt = P.calc.mortgage(r).pmt; } catch (e) {} }
      out.push({ id: 'loan:' + (r.id || i), name: [r.lender, r.name].filter(Boolean).join(' · ') || 'הלוואה ' + (i + 1), balance: bal, rate: T.num(r.rate), min: T.num(pmt), src: 'הלוואות' });
    });
    ((d.mortgage && d.mortgage.tracks) || []).forEach(function (r, i) {
      var bal = T.num(r.balance); if (!(bal > 0)) return;
      var pmt = T.numOrNull(r.payment); if (pmt === null && P && P.calc && P.calc.mortgage) { try { pmt = P.calc.mortgage(r).pmt; } catch (e) {} }
      out.push({ id: 'mtg:' + (r.id || i), name: r.name || 'מסלול משכנתא ' + (i + 1), balance: bal, rate: T.num(r.rate), min: T.num(pmt), src: 'משכנתא', mortgage: true });
    });
    return out;
  }
  /* month-by-month simulation; order: 'avalanche' | 'snowball' */
  function simulate(debts, extra, order) {
    var ds = debts.map(function (x) { return { id: x.id, name: x.name, bal: x.balance, r: x.rate / 1200, min: x.min }; });
    var paidOrder = [], interest = 0, m = 0, stuck = false;
    function pick() {
      var open = ds.filter(function (x) { return x.bal > 0.005; });
      open.sort(order === 'avalanche' ? function (a, b) { return b.r - a.r || a.bal - b.bal; } : function (a, b) { return a.bal - b.bal || b.r - a.r; });
      return open[0];
    }
    var budget = ds.reduce(function (s, x) { return s + x.min; }, 0) + extra;
    while (ds.some(function (x) { return x.bal > 0.005; }) && m < 600) {
      m++;
      ds.forEach(function (x) { if (x.bal > 0.005) { var i = x.bal * x.r; interest += i; x.bal += i; } });
      var left = budget;
      ds.forEach(function (x) { if (x.bal > 0.005) { var p = Math.min(x.min, x.bal); x.bal -= p; left -= p; } });
      while (left > 0.005) { var t = pick(); if (!t) break; var p2 = Math.min(left, t.bal); t.bal -= p2; left -= p2; }
      ds.forEach(function (x) { if (x.bal <= 0.005 && paidOrder.indexOf(x.id) < 0) { x.bal = 0; paidOrder.push(x.id); } });
    }
    if (m >= 600) stuck = true;
    return { months: m, interest: interest, order: paidOrder, stuck: stuck };
  }
  function render(main) {
    var st = T.read('debts', { extra: [], include: {}, budgetExtra: null }); if (!Array.isArray(st.extra)) st.extra = []; if (!st.include) st.include = {};
    function save() { T.write('debts', st); }
    var imp = imported(), impBox = h('div'), out = h('div'), status = T.live();
    function debts() {
      var list = [];
      imp.forEach(function (x) { var on = st.include[x.id]; if (on === undefined) on = !x.mortgage; if (on) list.push(x); });
      st.extra.forEach(function (r, i) { var b = T.toILS(r.balance, r.currency || 'ILS'), mn = T.toILS(r.min, r.currency || 'ILS'); if (b > 0) list.push({ id: 'x:' + (r.id || i), name: r.name || 'חוב ' + (i + 1), balance: b, rate: T.num(r.rate), min: mn || 0 }); });
      return list;
    }
    function draw() {
      out.innerHTML = '';
      var list = debts(), extra = T.num(st.budgetExtra);
      if (!list.length) { out.appendChild(h('p', { class: 'empty', text: 'אין חובות לחישוב. מסמנים הלוואה קיימת או מוסיפים חוב למטה.' })); status.textContent = ''; return; }
      var bad = list.filter(function (x) { return x.min <= x.balance * x.rate / 1200 && extra <= 0; });
      var A = simulate(list, extra, 'avalanche'), S = simulate(list, extra, 'snowball'), base = simulate(list, 0, 'avalanche');
      var names = {}; list.forEach(function (x) { names[x.id] = x.name; });
      function when(m) { return T.fmtDate(T.addMonths(T.today(), m)).replace(/^\d+\./, ''); }
      function col(title, r, win, help) {
        return h('div', { class: 'tot' + (win ? ' win' : '') }, [h('span', { class: 'k', text: title + (win ? ' · זול יותר' : '') }),
          h('span', { class: 'v num', text: r.stuck ? 'מעל 50 שנה' : r.months + ' חודשים' }),
          h('span', { class: 'k', text: 'ריבית כוללת: ' + T.disp(r.interest) }), h('span', { class: 'k', text: r.stuck ? '' : 'סיום בערך ב־' + when(r.months) }), h('span', { class: 'k', text: help })]);
      }
      if (bad.length) out.appendChild(h('p', { class: 'notice amber', text: 'בחלק מהחובות התשלום החודשי לא מכסה את הריבית (' + bad.map(function (x) { return x.name; }).join(', ') + '). כדאי לבדוק את התשלום שהוזן.' }));
      var aWin = A.interest <= S.interest + 0.5;
      out.appendChild(h('div', { class: 't13-cmp' }, [col('קודם הריבית הגבוהה', A, aWin, 'שיטת "מפולת"'), col('קודם החוב הקטן', S, !aWin && S.interest < A.interest, 'שיטת "כדור שלג"')]));
      var saved = base.interest - Math.min(A.interest, S.interest);
      if (extra > 0 && !base.stuck) out.appendChild(h('p', { class: 't13-note', text: 'עם תוספת של ' + T.disp(extra) + ' בחודש החובות ייסגרו ' + (base.months - Math.min(A.months, S.months)) + ' חודשים מוקדם יותר, וחוסכים בערך ' + T.disp(saved) + ' ריבית לעומת תשלום המינימום בלבד.' }));
      function orderList(title, r) { return h('div', null, [h('h3', { text: title }), h('ol', { class: 'steps' }, r.order.map(function (id) { return h('li', { text: names[id] }); }))]); }
      out.appendChild(h('details', null, [h('summary', { text: 'סדר הסגירה בכל שיטה' }), orderList('קודם הריבית הגבוהה', A), orderList('קודם החוב הקטן', S)]));
      status.textContent = 'קודם הריבית הגבוהה: ' + A.months + ' חודשים, ריבית ' + T.disp(A.interest) + '. קודם החוב הקטן: ' + S.months + ' חודשים, ריבית ' + T.disp(S.interest) + '.';
    }
    if (imp.length) {
      imp.forEach(function (x) {
        var on = st.include[x.id]; if (on === undefined) on = !x.mortgage;
        impBox.appendChild(h('div', { class: 'row-card' }, [T.field(x.name + ' (' + x.src + ')', 'check', on, function (v) { st.include[x.id] = v; save(); draw(); }),
          h('p', { class: 'help', text: 'יתרה ' + T.disp(x.balance) + ' · ריבית ' + T.fmt(x.rate, 2) + '% · תשלום ' + T.disp(x.min) })]));
      });
      impBox.appendChild(h('p', { class: 't13-note' }, ['את הפרטים משנים בדף ', h('a', { href: 'loans.html', text: 'הלוואות' }), ' או ', h('a', { href: 'mortgage.html', text: 'משכנתא' }), '. המשכנתא לא מסומנת מראש, כי בדרך כלל לא מקדימים אותה לפני חובות יקרים.']));
    } else impBox.appendChild(h('p', { class: 'empty' }, ['עדיין לא הוזנו הלוואות. אפשר להזין בדף ', h('a', { href: 'loans.html', text: 'הלוואות' }), ' או להוסיף חוב כאן למטה.']));
    var list = T.listEditor(st.extra, [
      { k: 'name', label: 'שם החוב', type: 'text', placeholder: 'למשל: מינוס בבנק' },
      { k: 'balance', label: 'יתרה', type: 'number' },
      { k: 'rate', label: 'ריבית שנתית (%)', type: 'number' },
      { k: 'min', label: 'תשלום חודשי מינימלי', type: 'number' },
      { k: 'currency', label: 'מטבע', type: 'select', options: T.curOptions(), def: 'ILS' }
    ], function () { save(); draw(); }, { addLabel: 'הוספת חוב', rowTitle: 'חוב', empty: 'אין חובות נוספים.' });
    var budget = h('div', { class: 'fields' }, [T.field('כמה אפשר להוסיף בכל חודש מעבר לתשלומים (₪)', 'number', st.budgetExtra, function (v) { st.budgetExtra = v; save(); draw(); }, { help: 'התוספת הולכת לחוב אחד בכל פעם. כשחוב נסגר, התשלום שלו עובר לחוב הבא.' })]);
    draw();
    main.appendChild(T.card('השוואת שיטות', [budget, status, out, h('p', { class: 't13-note', text: 'חישוב משוער לפי ריבית קבועה, בלי הצמדה ועמלות פירעון מוקדם. לפני פירעון מוקדם כדאי לבדוק את העמלה מול המלווה.' })]));
    main.appendChild(T.card('הלוואות שכבר הזנתי', [impBox]));
    main.appendChild(T.card('חובות נוספים', [list.el]));
    T.onRemote(function () { location.reload(); });
  }
  window.T13Debts = { simulate: simulate };
  T.page('debts-planner', 'תכנון החזר חובות', 'מה לסגור קודם וכמה ריבית זה חוסך', render);
})();
