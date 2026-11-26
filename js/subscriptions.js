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
    var nextBox = h('div'), list, emptyHide = [];
    function drawNext() {
      nextBox.innerHTML = '';
      var active = st.items.filter(function (r) { return T.num(r.amount) > 0; });
      if (!active.length) { nextBox.appendChild(T.next('רושמים מנוי או חיוב קבוע אחד, למשל טלפון או סטרימינג, עם הסכום והיום בחודש.', { label: 'הוספת חיוב', onclick: function () { list.add(); } })); return; }
      var m = 0; active.forEach(function (r) { var v = monthlyILS(r); if (v) m += v; });
      nextBox.appendChild(T.next('יוצאים ' + T.disp(m) + ' בחודש על ' + active.length + ' חיובים. כדאי לעבור עליהם ולבטל את מה שלא משתמשים בו.', { label: 'מעבר על החיובים', onclick: function () { T.focusFirst(listCard); } }));
    }
    function all() { drawSum(); drawCal(); drawUp(); drawNext(); var has = st.items.some(function (r) { return T.num(r.amount) > 0; }); emptyHide.forEach(function (el) { el.hidden = !has; }); }
    function summary(r) { var n = (r.name || '').trim() || 'חיוב חדש'; if (!(T.num(r.amount) > 0)) return n; return n + ' · ' + T.money(T.num(r.amount), r.currency) + (r.cycle === 'yearly' ? ' בשנה' : ' בחודש') + ' · ' + (r.cycle === 'yearly' ? MONTHS[(Math.round(T.num(r.month) || 1) - 1)] + ', ' : '') + 'ב־' + (Math.round(T.num(r.day)) || 1) + ' לחודש'; }
    list = T.listEditor(st.items, [
      { k: 'name', label: 'שם', type: 'text', placeholder: 'למשל: נטפליקס' },
      { k: 'amount', label: 'סכום', type: 'number', placeholder: 'למשל 55' },
      { k: 'cycle', label: 'תדירות', type: 'select', options: [['monthly', 'כל חודש'], ['yearly', 'פעם בשנה']], def: 'monthly' },
      { k: 'day', label: 'יום החיוב בחודש', type: 'number', step: '1', min: 1, max: 31, def: 1 },
      { k: 'month', label: 'חודש החיוב (לחיוב שנתי)', type: 'select', options: MONTHS.map(function (n, i) { return [String(i + 1), n]; }), def: '1', adv: true },
      { k: 'currency', label: 'מטבע', type: 'select', options: T.curOptions(), def: 'ILS', adv: true },
      { k: 'cat', label: 'קטגוריה', type: 'select', options: CATS, def: 'other', adv: true }
    ], function () { save(); all(); }, { addLabel: 'הוספת חיוב', rowTitle: 'חיוב', summary: summary, advLabel: 'חיוב שנתי, מטבע וקטגוריה',
      empty: { title: 'עדיין אין חיובים', text: 'מוסיפים כל מנוי או חיוב קבוע עם הסכום והיום בחודש, ונראה כמה יוצא כל חודש ומה יורד בקרוב.', example: 'נטפליקס, 55 ₪, כל חודש, ב־10 לחודש.' } });
    all();
    var sumCard = T.card('סיכום', [status, sumBox]), upCard = T.card('בחודש הקרוב', [upBox]);
    var listCard = T.card('המנויים והחיובים שלי', [list.el, h('p', { class: 't13-note', text: 'סכומים במטבע זר מומרים לפי השער האחרון באתר.' })]);
    var calMore = T.more('לוח חיובים חודשי', [calBox]), calCard = h('section', { class: 'card t13-card-more' }, [calMore]);
    emptyHide = [sumCard, upCard, calCard]; all();
    main.appendChild(nextBox);
    main.appendChild(sumCard);
    main.appendChild(upCard);
    main.appendChild(listCard);
    main.appendChild(calCard);
    main.appendChild(T.disc('הסכומים לפי מה שהזנת. את החיובים בפועל בודקים בפירוט כרטיס האשראי.'));
    T.onRemote(function () { location.reload(); });
  }
  /* Household expense tracking is paused (the site focuses on savings and investments). The page shows a "coming soon" notice; saved items are kept, not deleted. */
  function frozen(main) {
    var st = T.read('subscriptions', { items: [] }), n = (st.items || []).filter(function (r) { return T.num(r.amount) > 0; }).length;
    main.appendChild(h('section', { class: 'card' }, [h('h2', { class: 'card-title' }, [h('span', { text: 'מעקב מנויים וחיובים' }), h('span', { class: 'badge amber', text: 'בקרוב' })]),
      h('p', { text: 'מעקב אחרי הוצאות הבית מושהה כרגע. האתר מתמקד עכשיו בחיסכון ובהשקעות.' }),
      h('p', { class: 'help', text: n ? 'שמרנו את ' + n + ' החיובים שכבר הזנת. הם לא נמחקו ויחזרו כשהדף ייפתח מחדש.' : 'כשהדף ייפתח מחדש אפשר יהיה לרשום כאן מנויים וחיובים קבועים.' }),
      h('p', { class: 'help', text: 'בינתיים, לתכנון מספיק סכום אחד: הוצאה חודשית כוללת, בדף תחזית התזרים.' })]));
    main.appendChild(T.next('מזינים הוצאה חודשית כוללת אחת, ונראה את התחזית לשנה הקרובה.', { label: 'לתחזית התזרים', href: 'cashflow.html' }));
    main.appendChild(T.disc(''));
  }
  T.page('subscriptions', 'מנויים וחיובים', 'בקרוב. מעקב הוצאות הבית מושהה, והאתר מתמקד בחיסכון ובהשקעות.', T.FROZEN.subscriptions ? frozen : render);
})();
