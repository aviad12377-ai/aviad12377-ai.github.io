/* Retirement projection from the pension / study-fund balances already entered: range of monthly pension and lump sums, and the effect of lower fees. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var TARGET = { acc: 0.22, dep: 1.0 };
  function fv(bal, dep, years, gross, feeAcc, feeDep) {
    var n = Math.max(0, Math.round(years * 12)), r = Math.pow(1 + (gross - feeAcc) / 100, 1 / 12) - 1, d = dep * (1 - feeDep / 100);
    if (!n) return bal; var g = Math.pow(1 + r, n); return bal * g + (r ? d * (g - 1) / r : d * n);
  }
  function accounts() {
    var d = T.portalData(), out = [];
    if (!d) return out;
    var kindMap = { k_pension: 'annuity', k_insurance: 'annuity', k_gemel: 'lump', k_gemel_inv: 'lump' };
    ((d.pension && d.pension.funds) || []).forEach(function (r) { if (T.num(r.balance) > 0 || T.num(r.deposit) > 0) out.push({ name: r.name || 'קרן פנסיה', kind: kindMap[r.kind] || 'annuity', bal: T.num(r.balance), dep: T.num(r.deposit), fa: T.num(r.feeBal), fd: T.num(r.feeDep) }); });
    ((d.hishtalmut && d.hishtalmut.funds) || []).forEach(function (r) { if (T.num(r.balance) > 0 || T.num(r.deposit) > 0) out.push({ name: r.name || 'קרן השתלמות', kind: 'lump', bal: T.num(r.balance), dep: T.num(r.deposit), fa: T.num(r.feeBal), fd: T.num(r.feeDep), hish: true }); });
    if (d.maslaka && d.maslaka.include !== false) (d.maslaka.products || []).forEach(function (p) {
      if (!(T.num(p.balance) > 0)) return;
      var kind = p.type === 'hishtalmut' || p.type === 'gemel' || p.type === 'gemel_inv' ? 'lump' : 'annuity';
      out.push({ name: [p.provider, p.plan].filter(Boolean).join(' · ') || 'חשבון', kind: kind, bal: T.num(p.balance), dep: 0, fa: T.num(p.feeAcc), fd: T.num(p.feeDep), hish: p.type === 'hishtalmut', fromReport: true });
    });
    return out;
  }
  function project(st, accs, overrideFees) {
    var years = Math.max(0, T.num(st.retireAge) - T.num(st.age)), res = {};
    ['low', 'base', 'high'].forEach(function (k) {
      var g = T.num(st['r_' + k]), ann = 0, lump = 0;
      accs.forEach(function (a) {
        var fa = overrideFees && a.kind === 'annuity' ? Math.min(a.fa, TARGET.acc) : a.fa, fd = overrideFees && a.kind === 'annuity' ? Math.min(a.fd, TARGET.dep) : a.fd;
        var dep = a.dep + (a.kind === 'annuity' && st.extraDep ? T.num(st.extraDep) : 0) * (a === accs.filter(function (x) { return x.kind === 'annuity'; })[0] ? 1 : 0);
        var v = fv(a.bal, dep, years, g, fa, fd);
        if (a.kind === 'annuity') ann += v; else lump += v;
      });
      var factor = T.num(st.factor) || 200, real = Math.pow(1 + T.num(st.inflation) / 100, years);
      res[k] = { ann: ann, lump: lump, monthly: ann / factor, monthlyReal: ann / factor / real, lumpReal: lump / real };
    });
    res.years = years; return res;
  }
  function render(main) {
    var st = T.read('retirement', { age: null, retireAge: 67, r_low: 2, r_base: 4, r_high: 6, factor: 200, inflation: 2, extraDep: null });
    function save() { T.write('retirement', st); }
    var out = h('div'), status = T.live(), accs = accounts();
    function draw() {
      out.innerHTML = '';
      drawNext();
      if (!accs.length) { out.appendChild(T.empty('עדיין אין קופות פנסיה או השתלמות', 'התחזית נבנית מהקופות שמוזנות באתר. אפשר להזין ידנית או להעלות את הדוח מהמסלקה הפנסיונית.', 'קרן פנסיה עם יתרה של 250,000 ₪ והפקדה של 2,500 ₪ בחודש.', { label: 'להזנת פנסיה וגמל', href: 'pension.html' })); status.textContent = ''; return; }
      if (!(T.num(st.age) > 0)) { out.appendChild(T.empty('מה הגיל שלך?', 'עם הגיל הנוכחי וגיל הפרישה נחשב כמה שנים הכסף יצבור.', 'גיל 40 ופרישה בגיל 67, כלומר 27 שנות חיסכון.')); status.textContent = ''; return; }
      var p = project(st, accs, false), q = project(st, accs, true);
      if (p.years <= 0) { out.appendChild(h('p', { class: 'notice amber', text: 'גיל הפרישה צריך להיות גבוה מהגיל הנוכחי.' })); return; }
      var real = st.inflation > 0;
      function m(x) { return T.disp(real ? x.monthlyReal : x.monthly); }
      function l(x) { return T.disp(real ? x.lumpReal : x.lump); }
      out.appendChild(h('p', { class: 'help', text: 'בעוד ' + p.years + ' שנה' + (real ? ', בכסף של היום (אחרי אינפלציה של ' + T.fmt(T.num(st.inflation), 1) + '% בשנה)' : '') + ':' }));
      out.appendChild(h('div', { class: 'totals' }, [T.tot('קצבה חודשית משוערת', m(p.low) + ' עד ' + m(p.high), 'big'), T.tot('בתרחיש האמצעי', m(p.base)), T.tot('סכומים חד־פעמיים (השתלמות וגמל)', l(p.low) + ' עד ' + l(p.high))]));
      var B = T.basics(), baseM = real ? p.base.monthlyReal : p.base.monthly;
      if (B.expense > 0) { var cov = baseM / B.expense; out.appendChild(h('p', { class: 'notice ' + (cov >= 0.7 ? 'blue' : 'amber'), text: 'בתרחיש האמצעי הקצבה מכסה בערך ' + Math.round(cov * 100) + '% מההוצאה החודשית שהזנת (' + T.disp(B.expense) + (real ? ', בכסף של היום' : '') + ').' + (cov < 0.7 ? ' לעיתים קרובות משתמשים ב־70% כנקודת ייחוס.' : '') })); }
      else out.appendChild(h('p', { class: 'help' }, ['כדי לראות כמה מההוצאות הקצבה תכסה, מזינים הוצאה חודשית כוללת ב', h('a', { href: 'cashflow.html', text: 'תחזית התזרים' }), '.']));
      var rows = [['תשואה נמוכה', T.num(st.r_low), p.low], ['תשואה אמצעית', T.num(st.r_base), p.base], ['תשואה גבוהה', T.num(st.r_high), p.high]].map(function (r) {
        return h('tr', null, [h('th', { scope: 'row', text: r[0] + ' (' + T.fmt(r[1], 1) + '%)' }), h('td', { class: 'num', text: m(r[2]) }), h('td', { class: 'num', text: l(r[2]) })]);
      });
      out.appendChild(h('div', { class: 'tbl-wrap', tabindex: '0', role: 'region', 'aria-label': 'תרחישים' }, [h('table', { class: 'cmp' }, [h('thead', null, [h('tr', null, [h('th', { scope: 'col', text: 'תרחיש' }), h('th', { scope: 'col', text: 'קצבה בחודש' }), h('th', { scope: 'col', text: 'חד־פעמי' })])]), h('tbody', null, rows)])]));
      var gain = (real ? q.base.monthlyReal - p.base.monthlyReal : q.base.monthly - p.base.monthly);
      var feeCard = gain > 1 ? h('a', { class: 'action', href: 'actions.html' }, [h('span', { class: 'at' }, [h('strong', { text: 'דמי ניהול נמוכים יותר: בערך ' + T.disp(gain) + ' יותר בכל חודש' }), h('span', { text: 'אם דמי הניהול בקרן הפנסיה יירדו ל־' + T.fmt(TARGET.acc, 2) + '% מהצבירה ו־' + T.fmt(TARGET.dep, 1) + '% מההפקדות, בתרחיש האמצעי. לפירוט ולנוסח בקשה.' })]), h('span', { class: 'chev', 'aria-hidden': 'true', text: '‹' })])
        : h('p', { class: 'help', text: 'דמי הניהול שהוזנו כבר נמוכים, או שלא הוזנו דמי ניהול.' });
      out.appendChild(h('h3', { text: 'השפעת דמי הניהול' })); out.appendChild(feeCard);
      if (accs.some(function (a) { return a.fromReport && !a.dep; })) out.appendChild(h('p', { class: 'help', text: 'בחשבונות שיובאו מדוח המסלקה אין הפקדה חודשית, ולכן החישוב מניח שלא מפקידים אליהם. אפשר להוסיף הפקדה למטה.' }));
      status.textContent = 'קצבה חודשית משוערת: ' + m(p.low) + ' עד ' + m(p.high) + '.';
    }
    var nextBox = h('div');
    var ageField = T.field('גיל נוכחי', 'number', st.age, function (v) { st.age = v; save(); draw(); }, { step: '1', min: 16, max: 80, placeholder: 'למשל 40' });
    var retField = T.field('גיל פרישה', 'number', st.retireAge, function (v) { st.retireAge = v; save(); draw(); }, { step: '1', min: 40, max: 80, check: function (v) { return v !== null && T.num(st.age) > 0 && v <= T.num(st.age) ? 'גיל הפרישה צריך להיות גבוה מהגיל הנוכחי.' : ''; }, help: 'בישראל: 67 לגברים, ולנשים עולה בהדרגה ל־65.' });
    var fsMain = h('div', { class: 'fields' }, [ageField, retField]);
    var fs = h('div', { class: 'fields' }, [
      T.field('תשואה נמוכה (%)', 'number', st.r_low, function (v) { st.r_low = v; save(); draw(); }, { max: 15 }),
      T.field('תשואה אמצעית (%)', 'number', st.r_base, function (v) { st.r_base = v; save(); draw(); }, { max: 15 }),
      T.field('תשואה גבוהה (%)', 'number', st.r_high, function (v) { st.r_high = v; save(); draw(); }, { max: 15 }),
      T.field('אינפלציה שנתית (%)', 'number', st.inflation, function (v) { st.inflation = v; save(); draw(); }, { max: 15, help: '0 = בלי התאמה לאינפלציה' }),
      T.field('מקדם המרה לקצבה', 'number', st.factor, function (v) { st.factor = v; save(); draw(); }, { min: 100, max: 400, help: 'כמה צבירה צריך לכל שקל קצבה. מופיע בדוח השנתי של הקרן, בדרך כלל סביב 200.' }),
      T.field('הפקדה חודשית נוספת לפנסיה (₪)', 'number', st.extraDep, function (v) { st.extraDep = v; save(); draw(); }, { help: 'למשל לחשבון שיובא מדוח בלי הפקדה.' })
    ]);
    function drawNext() {
      nextBox.innerHTML = '';
      if (!accs.length) nextBox.appendChild(T.next('מזינים את קרן הפנסיה וקרן ההשתלמות, ונעריך את הקצבה בפרישה.', { label: 'להזנת פנסיה', href: 'pension.html' }));
      else if (!(T.num(st.age) > 0)) nextBox.appendChild(T.next('מזינים גיל נוכחי, ונראה את טווח הקצבה החודשית הצפויה.', { label: 'הזנת גיל', onclick: function () { T.focusFirst(ageField); } }));
      else nextBox.appendChild(T.next('דמי ניהול נמוכים יותר מגדילים את הקצבה. בודקים כמה אפשר לחסוך ואיך מבקשים.', { label: 'לצעדים לחיסכון', href: 'actions.html' }));
    }
    var list = h('ul', { class: 't13-list' }, accs.map(function (a) { return h('li', null, [h('span', { text: a.name + (a.kind === 'annuity' ? ' · קצבה' : ' · חד־פעמי') }), h('span', { class: 'num', text: T.disp(a.bal) + (a.dep ? ' · ' + T.disp(a.dep) + ' בחודש' : '') })]); }));
    draw();
    main.appendChild(nextBox);
    main.appendChild(T.card('תחזית פרישה', [fsMain, status, out, T.more('הנחות: תשואה, אינפלציה ומקדם המרה', [fs])]));
    if (accs.length) main.appendChild(h('section', { class: 'card t13-card-more' }, [T.more('הקופות שנכללו (' + accs.length + ')', [list, h('div', { class: 't13-hub' }, [h('a', { href: 'pension.html', text: 'עדכון פנסיה וגמל' }), h('a', { href: 'hishtalmut.html', text: 'עדכון קרן השתלמות' })])])]));
    main.appendChild(T.disc('זו הערכה פשוטה לפי הנתונים שהזנת ותשואה קבועה. הקצבה בפועל תלויה בקרן, במסלול, בגיל ובמצב המשפחתי.'));
    T.onRemote(function () { location.reload(); });
  }
  window.T13Retirement = { project: project, accounts: accounts };
  T.page('retirement', 'תחזית פרישה', 'כמה קצבה חודשית צפויה בפרישה לפי הקופות שהזנת, ואיך דמי הניהול משפיעים עליה.', render);
})();
