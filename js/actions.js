/* Action cards: consolidating several pension / study-fund accounts, and asking for lower management fees.
   Estimates only: future value with monthly compounding, net of the fees the user enters. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var TYPES = [['pension', 'קרן פנסיה'], ['hishtalmut', 'קרן השתלמות'], ['gemel', 'קופת גמל'], ['insurance', 'ביטוח מנהלים']];
  var TYPE_NAME = {}; TYPES.forEach(function (x) { TYPE_NAME[x[0]] = x[1]; });
  /* Typical negotiated fees used only as editable starting values for the "what if" */
  var TARGET = { pension: { acc: 0.22, dep: 1.0 }, hishtalmut: { acc: 0.6, dep: 0 }, gemel: { acc: 0.6, dep: 0 }, insurance: { acc: 0.8, dep: 2.0 } };
  function fv(bal, dep, years, gross, feeAcc, feeDep) {
    var n = Math.max(0, Math.round(years * 12)), r = Math.pow(1 + (gross - feeAcc) / 100, 1 / 12) - 1, d = dep * (1 - feeDep / 100);
    if (!n) return bal;
    var g = Math.pow(1 + r, n);
    return bal * g + (r ? d * (g - 1) / r : d * n);
  }
  function fromPortal() {
    var d = T.portalData(), out = [];
    if (!d) return out;
    var kindMap = { k_pension: 'pension', k_gemel: 'gemel', k_gemel_inv: 'gemel', k_insurance: 'insurance' };
    ((d.pension && d.pension.funds) || []).forEach(function (r) { out.push({ name: r.name || '', type: kindMap[r.kind] || 'pension', balance: T.numOrNull(r.balance), feeAcc: T.numOrNull(r.feeBal), feeDep: T.numOrNull(r.feeDep), deposit: T.numOrNull(r.deposit), active: true }); });
    ((d.hishtalmut && d.hishtalmut.funds) || []).forEach(function (r) { out.push({ name: r.name || '', type: 'hishtalmut', balance: T.numOrNull(r.balance), feeAcc: T.numOrNull(r.feeBal), feeDep: T.numOrNull(r.feeDep), deposit: T.numOrNull(r.deposit), active: true }); });
    if (d.maslaka && Array.isArray(d.maslaka.products)) d.maslaka.products.forEach(function (p) {
      if (!(T.num(p.balance) > 0)) return;
      var tp = p.type === 'hishtalmut' ? 'hishtalmut' : p.type === 'gemel' || p.type === 'gemel_inv' ? 'gemel' : p.type === 'insurance' ? 'insurance' : 'pension';
      out.push({ name: [p.provider, p.plan].filter(Boolean).join(' · '), type: tp, balance: T.numOrNull(p.balance), feeAcc: T.numOrNull(p.feeAcc), feeDep: T.numOrNull(p.feeDep), deposit: null, active: p.active !== false });
    });
    return out;
  }
  var TEMPLATE = 'שלום,\nאני עמית/ה אצלכם בחשבון [סוג המוצר].\nדמי הניהול שלי היום: [__]% מהצבירה ו־[__]% מההפקדות.\nאשמח לקבל הצעה להפחתת דמי הניהול ל־[__]% מהצבירה ו־[__]% מההפקדות, בהתאם למקובל בשוק.\nאם לא ניתן, אשקול להעביר את הכסף לגוף אחר.\nתודה,\n[שם]';
  function render(main) {
    var st = T.read('actions', { accounts: [], years: 25, gross: 4.5 }); if (!Array.isArray(st.accounts)) st.accounts = [];
    function save() { T.write('actions', st); }
    if (!st.accounts.length && !st.imported) { fromPortal().forEach(function (r) { r.id = T.uid(); st.accounts.push(r); }); if (st.accounts.length) { st.imported = true; save(); } }
    var res = h('div'), status = T.live();

    function draw() {
      res.innerHTML = '';
      var acc = st.accounts.filter(function (a) { return T.num(a.balance) > 0; }), years = T.num(st.years), gross = T.num(st.gross);
      if (!acc.length) { res.appendChild(h('p', { class: 'empty', text: 'כדי לראות הערכה, מוסיפים חשבונות עם יתרה ודמי ניהול (או מייבאים מהנתונים שכבר הזנת).' })); status.textContent = ''; return; }
      if (!(years > 0)) { res.appendChild(h('p', { class: 'empty', text: 'צריך מספר שנים עד הפרישה.' })); return; }
      /* fee reduction */
      var feeRows = [], feeTotal = 0;
      acc.forEach(function (a) {
        var t = TARGET[a.type] || TARGET.pension, fa = T.num(a.feeAcc), fd = T.num(a.feeDep);
        var ta = a.tAcc === null || a.tAcc === undefined || a.tAcc === '' ? Math.min(fa, t.acc) : T.num(a.tAcc), td = a.tDep === null || a.tDep === undefined || a.tDep === '' ? Math.min(fd, t.dep) : T.num(a.tDep);
        var dep = a.active === false ? 0 : T.num(a.deposit);
        var diff = fv(T.num(a.balance), dep, years, gross, ta, td) - fv(T.num(a.balance), dep, years, gross, fa, fd);
        if (diff > 0) { feeTotal += diff; feeRows.push([a, fa, fd, ta, td, diff]); }
      });
      /* consolidation: several accounts of the same type -> everything in the one with the lowest balance fee */
      var groups = {}, consRows = [], consTotal = 0;
      acc.forEach(function (a) { (groups[a.type] = groups[a.type] || []).push(a); });
      Object.keys(groups).forEach(function (tp) {
        var g = groups[tp]; if (g.length < 2) return;
        var best = g.slice().sort(function (x, y) { return T.num(x.feeAcc) - T.num(y.feeAcc); })[0];
        var sep = 0, bal = 0, dep = 0;
        g.forEach(function (a) { var d = a.active === false ? 0 : T.num(a.deposit); sep += fv(T.num(a.balance), d, years, gross, T.num(a.feeAcc), T.num(a.feeDep)); bal += T.num(a.balance); dep += d; });
        var one = fv(bal, dep, years, gross, T.num(best.feeAcc), T.num(best.feeDep));
        var diff = one - sep; consTotal += Math.max(0, diff);
        consRows.push([tp, g, best, Math.max(0, diff)]);
      });

      var cons = [];
      if (!consRows.length) cons.push(h('p', { class: 'empty', text: 'אין כמה חשבונות מאותו סוג, אז אין מה לאחד.' }));
      consRows.forEach(function (c) {
        cons.push(h('div', { class: 'row-card' }, [h('strong', { text: c[1].length + ' חשבונות ' + TYPE_NAME[c[0]] }),
          h('p', { text: 'אם הכול יהיה בחשבון עם דמי הניהול הנמוכים (' + (c[2].name || TYPE_NAME[c[0]]) + ', ' + T.fmt(T.num(c[2].feeAcc), 2) + '% מהצבירה), ההפרש המשוער בעוד ' + years + ' שנה: ' + T.disp(c[3]) + '.' })]));
      });
      cons.push(h('details', null, [h('summary', { text: 'איך עושים את זה' }), h('ol', { class: 'steps' }, [
        h('li', { text: 'בודקים בהר הכסף או במסלקה הפנסיונית אילו חשבונות פתוחים לך.' }),
        h('li', { text: 'בוחרים את החשבון שאליו מעבירים, ופונים לגוף שמנהל אותו בבקשה לניוד או לאיחוד.' }),
        h('li', { text: 'הניוד בדרך כלל בלי עלות, ונמשך כמה ימי עסקים.' }),
        h('li', { text: 'לפני שמאחדים כדאי לבדוק: כיסוי ביטוחי במוצרים ותיקים, מקדם קצבה מובטח, ותאריך נזילות בקרן השתלמות.' })
      ])]));
      res.appendChild(T.card('איחוד חשבונות', cons, consTotal > 0 ? h('span', { class: 'badge green', text: 'עד ' + T.disp(consTotal) }) : null));

      var fees = [];
      if (!feeRows.length) fees.push(h('p', { class: 'empty', text: 'דמי הניהול שהזנת כבר נמוכים מהערכים להשוואה, או שלא הוזנו דמי ניהול.' }));
      feeRows.forEach(function (r) {
        fees.push(h('div', { class: 'row-card' }, [h('strong', { text: (r[0].name || TYPE_NAME[r[0].type]) }),
          h('p', { text: 'היום ' + T.fmt(r[1], 2) + '% מהצבירה ו־' + T.fmt(r[2], 2) + '% מההפקדות. אם יירד ל־' + T.fmt(r[3], 2) + '% ו־' + T.fmt(r[4], 2) + '%, ההפרש המשוער: ' + T.disp(r[5]) + '.' })]));
      });
      var tpl = T.field('נוסח לדוגמה לבקשה', 'textarea', TEMPLATE, function () {}, { rows: 8 });
      var copy = h('button', { type: 'button', class: 'btn btn-soft', text: 'העתקת הנוסח' });
      copy.addEventListener('click', function () { var v = tpl.querySelector('textarea').value; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { T.toast('הנוסח הועתק'); }, function () { tpl.querySelector('textarea').select(); }); });
      fees.push(h('details', null, [h('summary', { text: 'איך מבקשים הורדה' }), h('ol', { class: 'steps' }, [
        h('li', { text: 'פונים לשירות הלקוחות של הגוף המנהל בטלפון, בצ׳אט או במייל.' }),
        h('li', { text: 'אומרים כמה משלמים היום ומבקשים הצעה נמוכה יותר. אפשר להציג הצעה מגוף אחר.' }),
        h('li', { text: 'שכירים יכולים לבדוק גם את ההסדר דרך מקום העבודה.' }),
        h('li', { text: 'מבקשים את ההצעה בכתב ובודקים בדוח הבא שהיא נכנסה לתוקף.' })
      ]), tpl, h('div', { class: 'toolbar' }, [copy])]));
      res.appendChild(T.card('בקשה להורדת דמי ניהול', fees, feeTotal > 0 ? h('span', { class: 'badge green', text: 'עד ' + T.disp(feeTotal) }) : null));
      status.textContent = 'הערכה ל־' + years + ' שנה: איחוד עד ' + T.disp(consTotal) + ', הורדת דמי ניהול עד ' + T.disp(feeTotal) + '.';
    }

    var accList = T.listEditor(st.accounts, [
      { k: 'name', label: 'שם הקופה', type: 'text' },
      { k: 'type', label: 'סוג', type: 'select', options: TYPES, def: 'pension' },
      { k: 'balance', label: 'יתרה (₪)', type: 'number' },
      { k: 'deposit', label: 'הפקדה חודשית (₪)', type: 'number' },
      { k: 'feeAcc', label: 'דמי ניהול מצבירה (%)', type: 'number' },
      { k: 'feeDep', label: 'דמי ניהול מהפקדה (%)', type: 'number' },
      { k: 'tAcc', label: 'מצבירה, לבקשה (%)', type: 'number', help: 'ריק = ערך להשוואה' },
      { k: 'tDep', label: 'מהפקדה, לבקשה (%)', type: 'number', help: 'ריק = ערך להשוואה' },
      { k: 'active', label: 'עדיין מפקידים לחשבון הזה', type: 'check', def: true }
    ], function () { save(); draw(); }, { addLabel: 'הוספת חשבון', rowTitle: 'חשבון', empty: 'עדיין אין חשבונות כאן.' });
    var imp = h('button', { type: 'button', class: 'btn btn-primary', text: 'ייבוא מהנתונים שהזנתי באתר' });
    imp.addEventListener('click', function () {
      var rows = fromPortal();
      if (!rows.length) { T.toast('לא מצאנו קופות בדפי הפנסיה וההשתלמות'); return; }
      if (st.accounts.length && !confirm('להחליף את הרשימה כאן ב־' + rows.length + ' החשבונות מהאתר?')) return;
      st.accounts.length = 0; rows.forEach(function (r) { r.id = T.uid(); st.accounts.push(r); }); save(); accList.redraw(); draw(); T.toast('יובאו ' + rows.length + ' חשבונות');
    });
    var params = h('div', { class: 'fields' }, [
      T.field('שנים עד הפרישה', 'number', st.years, function (v) { st.years = v; save(); draw(); }, { step: '1', min: 1, max: 50 }),
      T.field('תשואה שנתית לפני דמי ניהול (%)', 'number', st.gross, function (v) { st.gross = v; save(); draw(); }, { help: 'הנחה בלבד. ברירת המחדל 4.5%.' })
    ]);
    main.appendChild(h('p', { class: 'notice blue', text: 'הערכה כללית לפי הנתונים שהזנת, לא ייעוץ פנסיוני. התשואה ודמי הניהול בפועל יכולים להיות שונים.' }));
    main.appendChild(T.card('הנחות', [params]));
    main.appendChild(status); main.appendChild(res);
    main.appendChild(T.card('החשבונות שלי', [h('div', { class: 'toolbar' }, [imp]), accList.el]));
    draw();
    T.onRemote(function () { location.reload(); });
  }
  window.T13Actions = { fv: fv };
  T.page('actions', 'צעדים לחיסכון בדמי ניהול', 'איחוד קופות ובקשה להורדת דמי ניהול, עם הערכת ההפרש עד הפרישה', render);
})();
