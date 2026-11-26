/* 12-month cash-flow forecast: one total monthly income and expense, plus loan and mortgage payments (until each loan ends).
   Household expense tracking is paused: subscriptions and one-off items stay saved but are not shown or counted. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  function sum(list, k) { return (list || []).reduce(function (s, r) { return s + T.num(r[k]); }, 0); }
  /* Builds the forecast. Exported for the insights widget. */
  function forecast(st) {
    var d = T.portalData(), P = window.Portal; st = st || T.read('cashflow', {});
    if (!d || !d.home) return null;
    var B = T.basics(), income = T.num(B.income), expenses = T.num(B.expense);
    var mPmt = 0; ((d.mortgage && d.mortgage.tracks) || []).forEach(function (r) { var p = T.numOrNull(r.payment); if (p === null && P && P.calc && P.calc.mortgage) { try { p = P.calc.mortgage(r).pmt; } catch (e) {} } mPmt += T.num(p); });
    if (d.home.includeMortgagePmt === false) mPmt = 0;
    var start = st.start === null || st.start === undefined || st.start === '' ? null : T.num(st.start);
    if (start === null) { start = 0; ((d.savings && d.savings.cash) || []).forEach(function (r) { if (r.kind === 'c_deposit') return; var v = T.toILS(r.balance, r.currency); if (v !== null) start += v; }); }
    var subs = [], useSubs = false;
    var loans = ((d.home && d.home.loans) || []).map(function (r) {
      var p = T.numOrNull(r.payment); if (p === null && P && P.calc && P.calc.mortgage) { try { p = P.calc.mortgage(r).pmt; } catch (e) {} }
      var end = T.parseDate(r.endDate); var left = end ? T.monthsBetween(T.today(), end) + 1 : (T.num(r.months) > 0 ? Math.round(T.num(r.months)) : 999);
      return { pmt: T.num(p), left: left };
    });
    var t0 = T.today(), rows = [], bal = start;
    for (var i = 0; i < 12; i++) {
      var md = new Date(t0.getFullYear(), t0.getMonth() + i, 1), m = md.getMonth();
      var s = 0;
      if (useSubs) subs.forEach(function (r) { var v = T.toILS(r.amount, r.currency); if (v === null || !(v > 0)) return; if (r.cycle === 'yearly') { if ((Math.round(T.num(r.month) || 1) - 1) === m) s += v; } else s += v; });
      var l = loans.reduce(function (a, x) { return a + (i < x.left ? x.pmt : 0); }, 0);
      var once = (T.FROZEN.once ? [] : (st.once || [])).reduce(function (a, r) { var dt = T.parseDate(r.date); if (!dt || dt.getFullYear() !== md.getFullYear() || dt.getMonth() !== m) return a; return a + (r.dir === 'in' ? 1 : -1) * T.num(r.amount); }, 0);
      var net = income - expenses - mPmt - l - s + once; bal += net;
      rows.push({ date: md, label: MONTHS[m] + ' ' + md.getFullYear(), income: income, expenses: expenses + mPmt, loans: l, subs: s, once: once, net: net, bal: bal });
    }
    return { start: start, rows: rows, negMonths: rows.filter(function (r) { return r.bal < 0; }), lossMonths: rows.filter(function (r) { return r.net < 0; }), hasBudget: income > 0 || expenses > 0, hasIncome: income > 0, hasExpense: expenses > 0 };
  }
  function chart(rows) {
    var NS = 'http://www.w3.org/2000/svg', W = 340, H = 190, B = 24, Tp = 10;
    function s(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
    var vals = rows.map(function (r) { var v = T.fromILS(r.bal); return v === null ? r.bal : v; });
    var max = Math.max(0, Math.max.apply(null, vals)), min = Math.min(0, Math.min.apply(null, vals)); if (max === min) max = min + 1;
    function Y(v) { return Tp + (max - v) / (max - min) * (H - Tp - B); }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 't13-chart', direction: 'ltr', role: 'img', 'aria-label': 'יתרה צפויה בסוף כל חודש, מ־' + T.money(vals[0]) + ' ב' + rows[0].label + ' עד ' + T.money(vals[11]) + ' ב' + rows[11].label });
    var bw = (W - 16) / 12;
    svg.appendChild(s('line', { x1: 4, x2: W - 4, y1: Y(0), y2: Y(0), class: 'zero' }));
    vals.forEach(function (v, i) {
      var x = W - 8 - (i + 1) * bw + 3, y = Math.min(Y(v), Y(0)), hgt = Math.max(1, Math.abs(Y(v) - Y(0)));
      svg.appendChild(s('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (bw - 6).toFixed(1), height: hgt.toFixed(1), rx: 3, class: v < 0 ? 'neg-bar' : 'pos-bar' }));
      if (i % 3 === 0) { var t = s('text', { x: (x + (bw - 6) / 2).toFixed(1), y: H - 6, 'text-anchor': 'middle' }); t.textContent = (rows[i].date.getMonth() + 1) + '/' + String(rows[i].date.getFullYear()).slice(2); svg.appendChild(t); }
    });
    return svg;
  }
  function render(main) {
    var st = T.read('cashflow', { start: null, subs: true, once: [] }); if (!Array.isArray(st.once)) st.once = [];
    function save() { st.basics = T.read('cashflow', {}).basics || st.basics; T.write('cashflow', st); }
    var out = h('div'), status = T.live(), nextBox = h('div'), tblBox = h('div'), tblMore = T.more('פירוט לפי חודשים', [tblBox]);
    function draw() {
      out.innerHTML = '';
      var f = forecast(st);
      if (!f) { out.appendChild(h('p', { class: 'notice amber', text: 'לא הצלחנו לטעון את הנתונים. נסה לרענן.' })); return; }
      drawNext(f);
      var hasAny = f.hasBudget || f.start !== 0 || f.rows.some(function (r) { return r.net !== 0; });
      if (!hasAny) { out.appendChild(T.empty('עדיין אין נתונים לתחזית', 'מזינים למעלה הכנסה חודשית והוצאה חודשית כוללת. החזרי הלוואות נלקחים מדף ההלוואות.', 'הכנסה 14,000 ₪ והוצאות 11,000 ₪ בחודש, כך שנשארים 3,000 ₪ בכל חודש.')); status.textContent = ''; tblMore.hidden = true; return; }
      tblMore.hidden = false;
      if (!f.hasIncome || !f.hasExpense) out.appendChild(h('p', { class: 'notice amber', text: (!f.hasIncome ? 'חסרה הכנסה חודשית' : 'חסרה הוצאה חודשית כוללת') + ', אז התחזית חלקית. מזינים אותה למעלה.' }));
      var last = f.rows[11], neg = f.negMonths;
      out.appendChild(h('div', { class: 't13-kpi' }, [h('span', { class: 'v num' + (last.bal < 0 ? ' neg' : ''), text: T.disp(last.bal) }), h('span', { class: 'k', text: 'יתרה צפויה בעוד 12 חודשים' })]));
      out.appendChild(h('div', { class: 'totals' }, [T.tot('יתרת פתיחה', T.disp(f.start)), T.tot('נשאר בחודש רגיל', T.disp(f.rows[0].income - f.rows[0].expenses - f.rows[0].loans - f.rows[0].subs), (f.rows[0].income - f.rows[0].expenses - f.rows[0].loans - f.rows[0].subs) < 0 ? 'neg' : 'pos'), T.tot('חודשים במינוס', String(neg.length), neg.length ? 'neg' : '')]));
      if (neg.length) out.appendChild(h('p', { class: 'notice red', text: 'היתרה צפויה לרדת מתחת לאפס ב' + neg[0].label + (neg.length > 1 ? ' (ובעוד ' + (neg.length - 1) + ' חודשים)' : '') + '. כדאי לבדוק הוצאות או לתכנן מקור כסף לחודשים האלה.' }));
      else if (f.lossMonths.length) out.appendChild(h('p', { class: 'notice amber', text: 'ב־' + f.lossMonths.length + ' חודשים יוצא יותר ממה שנכנס, אבל היתרה נשארת חיובית.' }));
      else out.appendChild(h('p', { class: 'notice blue', text: 'בכל 12 החודשים הקרובים היתרה צפויה להישאר חיובית.' }));
      out.appendChild(chart(f.rows));
      var rows = f.rows.map(function (r) { return h('tr', { class: r.bal < 0 ? 'neg-row' : null }, [h('th', { scope: 'row', text: r.label }), h('td', { class: 'num', text: T.disp(r.net) }), h('td', { class: 'num', text: T.disp(r.bal) }), h('td', { class: 'num', text: T.disp(r.loans) })]); });
      tblBox.innerHTML = '';
      tblBox.appendChild(h('div', { class: 'tbl-wrap', tabindex: '0', role: 'region', 'aria-label': 'טבלת תחזית לפי חודשים' }, [h('table', { class: 'cmp' }, [h('thead', null, [h('tr', null, [h('th', { scope: 'col', text: 'חודש' }), h('th', { scope: 'col', text: 'נכנס פחות יוצא' }), h('th', { scope: 'col', text: 'יתרה בסוף החודש' }), h('th', { scope: 'col', text: 'מזה הלוואות' })])]), h('tbody', null, rows)])]));
      status.textContent = 'יתרה צפויה בעוד 12 חודשים: ' + T.disp(last.bal) + '. חודשים במינוס: ' + neg.length + '.';
    }
    var d = T.portalData(), cashHint = 0; ((d && d.savings && d.savings.cash) || []).forEach(function (r) { if (r.kind !== 'c_deposit') { var v = T.toILS(r.balance, r.currency); if (v) cashHint += v; } });
    var opts = h('div', { class: 'fields' }, [
      T.field('יתרת פתיחה בעו"ש ובחיסכון נזיל (₪)', 'number', st.start, function (v) { st.start = v; save(); draw(); }, { neg: true, placeholder: String(Math.round(cashHint)), help: 'ריק = לפי החשבונות שהזנת בדף החסכונות, בלי פיקדונות.' })
    ]);
    function onceSum(r) { var n = (r.name || '').trim() || 'תנועה חדשה'; var d = T.parseDate(r.date); return n + (T.num(r.amount) > 0 ? ' · ' + (r.dir === 'in' ? '+' : '-') + T.disp(T.num(r.amount)) : '') + (d ? ' · ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''); }
    function inYear(v) { var dt = T.parseDate(v); if (!dt) return ''; var t0 = T.today(), from = new Date(t0.getFullYear(), t0.getMonth(), 1), to = new Date(t0.getFullYear(), t0.getMonth() + 12, 1); return dt < from || dt >= to ? 'התאריך מחוץ ל־12 החודשים של התחזית, ולכן לא ייכלל.' : ''; }
    var once = T.listEditor(st.once, [
      { k: 'name', label: 'שם', type: 'text', placeholder: 'למשל: ביטוח רכב שנתי, בונוס' },
      { k: 'amount', label: 'סכום (₪)', type: 'number', placeholder: 'למשל 3500' },
      { k: 'dir', label: 'כיוון', type: 'select', options: [['out', 'הוצאה'], ['in', 'הכנסה']], def: 'out' },
      { k: 'date', label: 'מתי', type: 'date', check: inYear }
    ], function () { save(); draw(); }, { addLabel: 'הוספת תנועה חד־פעמית', rowTitle: 'תנועה', summary: onceSum, empty: 'אין תנועות חד־פעמיות. למשל ביטוח רכב שנתי, בונוס או החזר מס.' });
    function drawNext(f) {
      nextBox.innerHTML = '';
      if (!f.hasIncome) nextBox.appendChild(T.next('מזינים כמה נכנס בחודש וכמה יוצא בסך הכול, ונראה מה יקרה ליתרה בשנה הקרובה.', { label: 'הזנת הכנסה', onclick: function () { T.focusFirst(basicsBox.fieldsBy.income); } }));
      else if (!f.hasExpense) nextBox.appendChild(T.next('חסרה הוצאה חודשית כוללת. הערכה כללית מספיקה.', { label: 'הזנת הוצאה', onclick: function () { T.focusFirst(basicsBox.fieldsBy.expense); } }));
      else if (f.negMonths.length) nextBox.appendChild(T.next('היתרה צפויה לרדת מתחת לאפס ב' + f.negMonths[0].label + '. כדאי לבדוק את ההוצאה החודשית או לתכנן מקור כסף.', { label: 'עדכון ההוצאה', onclick: function () { T.focusFirst(basicsBox.fieldsBy.expense); } }));
      else nextBox.appendChild(T.next('התחזית נראית יציבה. אם נשאר כסף בכל חודש, כדאי להגדיר לו יעד.', { label: 'ליעדי חיסכון', href: 'goals.html' }));
    }
    var basicsBox = T.basicsFields(['income', 'expense'], function () { draw(); });
    draw();
    main.appendChild(nextBox);
    main.appendChild(T.card('תחזית ל־12 חודשים', [basicsBox, status, out, tblMore]));
    main.appendChild(h('section', { class: 'card t13-card-more' }, [T.more('יתרת פתיחה', [opts])]));
    main.appendChild(h('section', { class: 'card t13-card-more' }, [T.more('מאיפה מגיעים הנתונים', [h('div', { class: 't13-hub' }, [h('a', { href: 'loans.html', text: 'הלוואות' }), h('a', { href: 'mortgage.html', text: 'משכנתא' }), h('a', { href: 'savings.html', text: 'חסכונות' })])])]));
    main.appendChild(T.disc('התחזית מניחה שההכנסה וההוצאה החודשית יישארו קבועות.'));
    T.onRemote(function () { location.reload(); });
  }
  window.T13Cashflow = { forecast: forecast };
  if (document.body && document.body.getAttribute('data-page') === 'cashflow') T.page('cashflow', 'תחזית תזרים', 'מה צפוי לקרות ליתרה בעו"ש ב־12 החודשים הקרובים, לפי ההכנסה, ההוצאה החודשית וההלוואות.', render);
})();
