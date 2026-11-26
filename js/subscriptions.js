/* Monthly subscriptions and fixed charges: totals, a month calendar and what is due next. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var DOW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  var CATS = [['stream', 'סטרימינג ובידור'], ['phone', 'טלפון ואינטרנט'], ['insurance', 'ביטוח'], ['home', 'בית וחשבונות'], ['health', 'בריאות וכושר'], ['software', 'תוכנה ואפליקציות'], ['edu', 'לימודים וחוגים'], ['other', 'אחר']];
  function lastDay(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function monthlyILS(r) { var v = T.toILS(r.amount, r.currency); if (v === null) return null; return r.cycle === 'yearly' ? v / 12 : v; }
  /* next charge date on or after `from` */
  function nextDate(r, from) {
    var day = Math.max(1, Math.min(31, Math.round(T.num(r.day) || 1)));
    if (r.cycle === 'yearly') {
      var m = Math.max(1, Math.min(12, Math.round(T.num(r.month) || 1))) - 1;
      for (var y = from.getFullYear(); y <= from.getFullYear() + 1; y++) { var d = new Date(y, m, Math.min(day, lastDay(y, m))); if (d >= from) return d; }
      return null;
    }
    for (var k = 0; k < 2; k++) { var yy = from.getFullYear(), mm = from.getMonth() + k; var dd = new Date(yy, mm, 1); dd = new Date(dd.getFullYear(), dd.getMonth(), Math.min(day, lastDay(dd.getFullYear(), dd.getMonth()))); if (dd >= from) return dd; }
    return null;
  }
  function chargesIn(rows, y, m) {
    var out = {};
    rows.forEach(function (r) {
      if (!(T.num(r.amount) > 0)) return;
      if (r.cycle === 'yearly' && (Math.round(T.num(r.month) || 1) - 1) !== m) return;
      var d = Math.min(Math.max(1, Math.round(T.num(r.day) || 1)), lastDay(y, m));
      (out[d] = out[d] || []).push(r);
    });
    return out;
  }
  function render(main) {
    var st = T.read('subscriptions', { items: [] }); if (!Array.isArray(st.items)) st.items = [];
    var view = T.today(); view = new Date(view.getFullYear(), view.getMonth(), 1);
    var sumBox = h('div'), calBox = h('div'), upBox = h('div'), status = T.live();
    function save() { T.write('subscriptions', st); }
    function drawSum() {
      sumBox.innerHTML = '';
      var m = 0, missing = 0, active = 0;
      st.items.forEach(function (r) { if (!(T.num(r.amount) > 0)) return; var v = monthlyILS(r); if (v === null) missing++; else { m += v; active++; } });
      sumBox.appendChild(h('div', { class: 'totals' }, [T.tot('בחודש (ממוצע)', T.disp(m), 'big'), T.tot('בשנה', T.disp(m * 12)), T.tot('מספר חיובים', String(active))]));
      if (missing) sumBox.appendChild(h('p', { class: 'help', text: 'ל־' + missing + ' חיובים חסר שער מטבע, והם לא נכללו בסכום.' }));
      status.textContent = st.items.length ? 'סך החיובים: ' + T.disp(m) + ' בחודש, ' + T.disp(m * 12) + ' בשנה.' : '';
    }
    function drawCal() {
      calBox.innerHTML = '';
      var y = view.getFullYear(), m = view.getMonth(), map = chargesIn(st.items, y, m), td = T.today();
      var prev = h('button', { type: 'button', class: 'btn', 'aria-label': 'החודש הקודם', text: 'הקודם' });
      var next = h('button', { type: 'button', class: 'btn', 'aria-label': 'החודש הבא', text: 'הבא' });
      prev.addEventListener('click', function () { view = new Date(y, m - 1, 1); drawCal(); calBox.querySelector('button').focus(); });
      next.addEventListener('click', function () { view = new Date(y, m + 1, 1); drawCal(); calBox.querySelectorAll('button')[1].focus(); });
      var total = 0; Object.keys(map).forEach(function (d) { map[d].forEach(function (r) { var v = T.toILS(r.amount, r.currency); if (v !== null) total += v; }); });
      calBox.appendChild(h('div', { class: 'toolbar', style: 'justify-content:space-between;align-items:center' }, [prev, h('strong', { text: MONTHS[m] + ' ' + y + ' · ' + T.disp(total) }), next]));
      var grid = h('div', { class: 't13-cal', role: 'table', 'aria-label': 'לוח חיובים ' + MONTHS[m] + ' ' + y });
      DOW.forEach(function (d) { grid.appendChild(h('div', { class: 'dow', 'aria-hidden': 'true', text: d })); });
      var start = new Date(y, m, 1).getDay();
      for (var i = 0; i < start; i++) grid.appendChild(h('div', { 'aria-hidden': 'true' }));
      for (var d = 1; d <= lastDay(y, m); d++) {
        var list = map[d] || [], isToday = td.getFullYear() === y && td.getMonth() === m && td.getDate() === d;
        var lbl = d + ' ב' + MONTHS[m] + (list.length ? ': ' + list.map(function (r) { return (r.name || 'חיוב') + ' ' + T.money(T.num(r.amount), r.currency); }).join(', ') : ': אין חיובים');
        grid.appendChild(h('div', { class: 'd' + (list.length ? ' has' : '') + (isToday ? ' today' : ''), role: 'cell', 'aria-label': lbl, title: lbl }, [h('span', { text: String(d), 'aria-hidden': 'true' }), list.length ? h('span', { class: 'n', 'aria-hidden': 'true', text: '●'.repeat(Math.min(3, list.length)) }) : null]));
      }
      calBox.appendChild(grid);
    }
    function drawUp() {
      upBox.innerHTML = '';
      var td = T.today(), end = T.addMonths(td, 1), rows = [];
      st.items.forEach(function (r) { if (!(T.num(r.amount) > 0)) return; var d = nextDate(r, td); if (d && d <= end) rows.push([d, r]); });
      rows.sort(function (a, b) { return a[0] - b[0]; });
      if (!rows.length) { upBox.appendChild(h('p', { class: 'empty', text: 'אין חיובים בחודש הקרוב.' })); return; }
      upBox.appendChild(h('ul', { class: 't13-list' }, rows.map(function (x) {
        var days = Math.round((x[0] - td) / 864e5);
        return h('li', null, [h('span', null, [h('strong', { text: x[1].name || 'חיוב' }), ' · ' + T.fmtDate(x[0]) + (days === 0 ? ' (היום)' : days === 1 ? ' (מחר)' : ' (בעוד ' + days + ' ימים)')]), h('span', { class: 'num', text: T.money(T.num(x[1].amount), x[1].currency, 2) })]);
      })));
    }
    function all() { drawSum(); drawCal(); drawUp(); }
    var list = T.listEditor(st.items, [
      { k: 'name', label: 'שם', type: 'text', placeholder: 'למשל: נטפליקס' },
      { k: 'amount', label: 'סכום', type: 'number' },
      { k: 'currency', label: 'מטבע', type: 'select', options: T.curOptions(), def: 'ILS' },
      { k: 'cycle', label: 'תדירות', type: 'select', options: [['monthly', 'כל חודש'], ['yearly', 'פעם בשנה']], def: 'monthly' },
      { k: 'day', label: 'יום החיוב בחודש', type: 'number', step: '1', min: 1, max: 31, def: 1 },
      { k: 'month', label: 'חודש החיוב (לחיוב שנתי)', type: 'select', options: MONTHS.map(function (n, i) { return [String(i + 1), n]; }), def: '1' },
      { k: 'cat', label: 'קטגוריה', type: 'select', options: CATS, def: 'other' }
    ], function () { save(); all(); }, { addLabel: 'הוספת חיוב', rowTitle: 'חיוב', empty: 'עדיין אין חיובים. מוסיפים כל מנוי או חיוב קבוע עם הסכום והיום בחודש.' });
    all();
    main.appendChild(T.card('סיכום', [status, sumBox]));
    main.appendChild(T.card('בחודש הקרוב', [upBox]));
    main.appendChild(T.card('לוח חודשי', [calBox]));
    main.appendChild(T.card('המנויים והחיובים שלי', [list.el, h('p', { class: 't13-note', text: 'סכומים במטבע זר מומרים לפי השער האחרון באתר.' })]));
    T.onRemote(function () { location.reload(); });
  }
  T.page('subscriptions', 'מנויים וחיובים קבועים', 'כמה יוצא כל חודש ומה יורד בקרוב', render);
})();
