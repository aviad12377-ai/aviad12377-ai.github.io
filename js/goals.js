/* Emergency fund + savings goals: target, deadline, current amount, monthly need, on-track status. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var DEF = function () { return { emergency: { months: 6, monthly: null, current: null, useCash: false }, goals: [] }; };
  function cashILS() {
    var d = T.portalData(); if (!d || !d.savings) return null;
    var s = 0, ok = true;
    (d.savings.cash || []).forEach(function (r) { var v = T.toILS(r.balance, r.currency); if (v === null) ok = false; else s += v; });
    return ok ? s : null;
  }
  function expensesILS() {
    var P = window.Portal; try { var s = P.calc.summary(); return s && s.expenses > 0 ? s.expenses : null; } catch (e) { return null; }
  }
  function goalCalc(g) {
    var target = T.toILS(g.target, g.currency), cur = T.toILS(g.current, g.currency), plan = T.toILS(g.monthly, g.currency);
    if (!(target > 0)) return null;
    cur = cur || 0; plan = plan || 0;
    var D = T.parseDate(g.date), left = target - cur;
    if (left <= 0) return { done: true, target: target, cur: cur, ratio: 1 };
    var months = D ? Math.max(0, T.monthsBetween(T.today(), D)) : null;
    var need = months === null ? null : months > 0 ? left / months : left;
    var onTrack = need === null ? null : plan >= need - 0.5;
    var eta = plan > 0 ? Math.ceil(left / plan) : null;
    return { done: false, target: target, cur: cur, left: left, months: months, need: need, plan: plan, onTrack: onTrack, eta: eta, ratio: cur / target };
  }
  function status(c) {
    if (!c) return h('span', { class: 't13-status bad', text: 'חסר סכום יעד' });
    if (c.done) return h('span', { class: 't13-status done', text: 'היעד הושג' });
    if (c.onTrack === null) return h('span', { class: 't13-status bad', text: 'אין תאריך יעד' });
    return c.onTrack ? h('span', { class: 't13-status ok', text: 'בדרך ליעד' }) : h('span', { class: 't13-status bad', text: 'מאחורי הקצב' });
  }
  function render(main) {
    var st = T.read('goals', DEF()); if (!st.emergency) st.emergency = DEF().emergency; if (!Array.isArray(st.goals)) st.goals = [];
    function save() { T.write('goals', st); }

    /* emergency fund */
    var e = st.emergency, eOut = h('div', { 'aria-live': 'polite' }), eBox = h('div');
    function drawE() {
      eOut.innerHTML = '';
      var monthly = e.monthly !== null && e.monthly !== undefined && e.monthly !== '' ? T.num(e.monthly) : expensesILS();
      var cur = e.useCash ? cashILS() : T.numOrNull(e.current);
      if (!(monthly > 0)) { eOut.appendChild(h('p', { class: 'empty', text: 'כדי לחשב, צריך הוצאה חודשית. אפשר להזין אותה כאן או בדף התקציב.' })); return; }
      var target = monthly * (T.num(e.months) || 6), c = cur || 0, ratio = c / target, monthsCovered = c / monthly;
      eOut.appendChild(h('div', { class: 'totals' }, [T.tot('יעד קרן החירום', T.disp(target), 'big'), T.tot('יש היום', T.disp(c)), T.tot('מכסה', T.fmt(monthsCovered, 1) + ' חודשים'), T.tot(c >= target ? 'מעל היעד' : 'חסר', T.disp(Math.abs(target - c)))]));
      eOut.appendChild(T.bar(ratio, ratio >= 1 ? 'ok' : 'bad', 'קרן החירום: ' + Math.round(Math.min(1, ratio) * 100) + ' אחוז מהיעד'));
      eOut.appendChild(h('p', null, [ratio >= 1 ? h('span', { class: 't13-status done', text: 'קרן החירום מלאה' }) : h('span', { class: 't13-status bad', text: 'עוד ' + Math.round((1 - ratio) * 100) + '% ליעד' })]));
    }
    var expHint = expensesILS();
    eBox.appendChild(h('div', { class: 'fields' }, [
      T.field('כמה חודשי הוצאות', 'number', e.months, function (v) { e.months = v; save(); drawE(); }, { step: '1', min: 1, max: 24 }),
      T.field('הוצאה חודשית (₪)', 'number', e.monthly, function (v) { e.monthly = v; save(); drawE(); }, { placeholder: expHint ? String(Math.round(expHint)) : '', help: expHint ? 'ריק = לפי דף התקציב' : null }),
      T.field('כמה יש בצד היום (₪)', 'number', e.current, function (v) { e.current = v; save(); drawE(); }),
      T.field('לחשב לפי העו"ש והחסכונות הנזילים שהזנתי', 'check', e.useCash, function (v) { e.useCash = v; save(); drawE(); })
    ]));
    drawE();
    main.appendChild(T.card('קרן חירום', [h('p', { class: 'help', text: 'כסף נזיל לתקופה בלי הכנסה או להוצאה לא צפויה. מקובל לשמור 3 עד 6 חודשי הוצאות.' }), eBox, eOut]));

    /* goals */
    var gOut = T.live(), sumBox = h('div');
    function extra(r) {
      var box = h('div', { class: 'outputs' });
      function d() {
        box.innerHTML = ''; var c = goalCalc(r);
        box.appendChild(h('div', { style: 'grid-column:1/-1' }, [status(c)]));
        if (!c) return;
        box.appendChild(h('div', { style: 'grid-column:1/-1' }, [T.bar(c.ratio, c.done ? 'ok' : c.onTrack ? 'ok' : 'bad', (r.name || 'יעד') + ': ' + Math.round(Math.min(1, c.ratio) * 100) + ' אחוז')]));
        if (c.done) return;
        [['נשאר לחסוך', T.disp(c.left)], ['צריך בחודש', c.need === null ? '—' : T.disp(c.need)], ['חודשים עד היעד', c.months === null ? '—' : String(c.months)], ['בקצב הנוכחי', c.eta === null ? 'אין הפקדה חודשית' : c.eta + ' חודשים']].forEach(function (x) {
          box.appendChild(h('div', { class: 'out' }, [h('span', { class: 'k', text: x[0] }), h('span', { class: 'v num', text: x[1] })]));
        });
      }
      d(); r._d = d; return box;
    }
    function drawSum() {
      sumBox.innerHTML = '';
      var need = 0, plan = 0, on = 0, n = 0;
      st.goals.forEach(function (g) { var c = goalCalc(g); if (!c || c.done) return; n++; need += c.need || 0; plan += c.plan || 0; if (c.onTrack) on++; });
      if (!st.goals.length) { gOut.textContent = ''; return; }
      sumBox.appendChild(h('div', { class: 'totals' }, [T.tot('צריך בחודש לכל היעדים', T.disp(need)), T.tot('מתוכנן בחודש', T.disp(plan)), T.tot('יעדים בדרך', on + ' מתוך ' + n)]));
      gOut.textContent = on + ' מתוך ' + n + ' יעדים פתוחים בדרך ליעד.';
    }
    var list = T.listEditor(st.goals, [
      { k: 'name', label: 'שם היעד', type: 'text', placeholder: 'למשל: רכב, חופשה' },
      { k: 'target', label: 'סכום יעד', type: 'number' },
      { k: 'current', label: 'נחסך עד עכשיו', type: 'number' },
      { k: 'monthly', label: 'הפקדה חודשית מתוכננת', type: 'number' },
      { k: 'date', label: 'תאריך יעד', type: 'date' },
      { k: 'currency', label: 'מטבע', type: 'select', options: T.curOptions(), def: 'ILS' }
    ], function (r) { save(); if (r && r._d) r._d(); drawSum(); }, { addLabel: 'הוספת יעד', rowTitle: 'יעד', empty: 'עדיין אין יעדים. מוסיפים יעד, סכום ותאריך, ורואים כמה צריך לחסוך בכל חודש.', extra: extra });
    drawSum();
    main.appendChild(T.card('יעדי חיסכון', [list.el, gOut, sumBox]));
    T.onRemote(function () { location.reload(); });
  }
  T.page('goals', 'קרן חירום ויעדים', 'כמה צריך לחסוך בכל חודש כדי להגיע ליעד בזמן', render);
})();
