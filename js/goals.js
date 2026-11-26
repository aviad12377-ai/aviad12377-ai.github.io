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
    var nextBox = h('div');
    var e = st.emergency, eOut = h('div', { 'aria-live': 'polite' }), eBox = h('div'), list;
    function monthlyNow() { return T.basics().expense; }
    /* the next step depends on what is filled in */
    function drawNext() {
      nextBox.innerHTML = '';
      if (!(monthlyNow() > 0)) nextBox.appendChild(T.next('מזינים כמה מוציאים בחודש בסך הכול, ונראה כמה כסף כדאי לשמור לחירום.', { label: 'הזנת הוצאה חודשית', onclick: function () { T.focusFirst(monthlyField); } }));
      else if (!st.goals.length) nextBox.appendChild(T.next('מוסיפים יעד חיסכון, למשל רכב או חופשה, ורואים כמה לחסוך בכל חודש.', { label: 'הוספת יעד ראשון', onclick: function () { list.add(); } }));
      else {
        var behind = st.goals.filter(function (g) { var c = goalCalc(g); return c && !c.done && c.onTrack === false; });
        nextBox.appendChild(behind.length ? T.next(behind.length + ' יעדים מאחורי הקצב. אפשר להגדיל את ההפקדה או לדחות את התאריך.', { label: 'לעדכון היעדים', onclick: function () { T.focusFirst(goalsCard); } })
          : T.next('כל היעדים בדרך. כדאי לעדכן את הסכום שנחסך פעם בחודש.', { label: 'הוספת יעד', onclick: function () { list.add(); } }));
      }
    }
    function drawE() {
      eOut.innerHTML = '';
      var monthly = monthlyNow(), cur = e.useCash ? cashILS() : T.numOrNull(e.current);
      if (!(monthly > 0)) { eOut.appendChild(T.empty('כמה מוציאים בחודש?', null, 'הוצאה של 12,000 ₪ בחודש, כפול 6 חודשים, היא קרן חירום של 72,000 ₪.')); drawNext(); return; }
      var target = monthly * (T.num(e.months) || 6), c = cur || 0, ratio = c / target, monthsCovered = c / monthly;
      eOut.appendChild(h('div', { class: 't13-kpi' }, [h('span', { class: 'v num', text: T.disp(target) }), h('span', { class: 'k', text: 'יעד קרן החירום (' + (T.num(e.months) || 6) + ' חודשי הוצאות)' })]));
      eOut.appendChild(T.bar(ratio, ratio >= 1 ? 'ok' : 'bad', 'קרן החירום: ' + Math.round(Math.min(1, ratio) * 100) + ' אחוז מהיעד'));
      eOut.appendChild(h('div', { class: 'totals' }, [T.tot('יש היום', T.disp(c)), T.tot('מכסה', T.fmt(monthsCovered, 1) + ' חודשים'), T.tot(c >= target ? 'מעל היעד' : 'חסר', T.disp(Math.abs(target - c)), c >= target ? 'pos' : '')]));
      eOut.appendChild(h('p', null, [ratio >= 1 ? h('span', { class: 't13-status done', text: 'קרן החירום מלאה' }) : h('span', { class: 't13-status bad', text: 'עוד ' + Math.round((1 - ratio) * 100) + '% ליעד' })]));
      drawNext();
    }
    var monthlyField = T.basicsFields(['expense'], function () { drawE(); }).fieldsBy.expense;
    var curField = T.field('כמה יש בצד היום (₪)', 'number', e.current, function (v) { e.current = v; save(); drawE(); }, { placeholder: 'למשל 30000' });
    eBox.appendChild(h('div', { class: 'fields' }, [monthlyField, curField]));
    eBox.appendChild(T.more('הגדרות נוספות', [h('div', { class: 'fields' }, [
      T.field('כמה חודשי הוצאות לשמור', 'number', e.months, function (v) { e.months = v; save(); drawE(); }, { step: '1', min: 1, max: 24, help: 'מקובל 3 עד 6. ברירת המחדל 6.' }),
      T.field('לחשב לפי העו"ש והחסכונות הנזילים שהזנתי', 'check', e.useCash, function (v) { e.useCash = v; save(); drawE(); })
    ])]));

    /* goals */
    var gOut = T.live(), sumBox = h('div');
    function extra(r) {
      var box = h('div', { class: 'outputs' });
      function d() {
        box.innerHTML = ''; var c = goalCalc(r);
        if (!c) { box.appendChild(h('p', { class: 'help', style: 'grid-column:1/-1', text: 'מזינים סכום יעד ותאריך, ונראה כמה לחסוך בכל חודש.' })); return; }
        box.appendChild(h('div', { style: 'grid-column:1/-1' }, [status(c)]));
        box.appendChild(h('div', { style: 'grid-column:1/-1' }, [T.bar(c.ratio, c.done ? 'ok' : c.onTrack ? 'ok' : 'bad', (r.name || 'יעד') + ': ' + Math.round(Math.min(1, c.ratio) * 100) + ' אחוז')]));
        if (c.done) return;
        [['צריך בחודש', c.need === null ? 'חסר תאריך' : T.disp(c.need)], ['נשאר לחסוך', T.disp(c.left)], ['חודשים עד היעד', c.months === null ? '—' : String(c.months)], ['בקצב הנוכחי', c.eta === null ? 'אין הפקדה חודשית' : c.eta + ' חודשים']].forEach(function (x) {
          box.appendChild(h('div', { class: 'out' }, [h('span', { class: 'k', text: x[0] }), h('span', { class: 'v num', text: x[1] })]));
        });
      }
      d(); r._d = d; return box;
    }
    function summary(r) {
      var c = goalCalc(r), n = (r.name || '').trim() || 'יעד חדש';
      if (!c) return n;
      if (c.done) return n + ' · הושג';
      return n + ' · ' + Math.round(Math.min(1, c.ratio) * 100) + '%' + (c.need !== null ? ' · ' + T.disp(c.need) + ' בחודש' : '');
    }
    function drawSum() {
      sumBox.innerHTML = '';
      var need = 0, plan = 0, on = 0, n = 0;
      st.goals.forEach(function (g) { var c = goalCalc(g); if (!c || c.done) return; n++; need += c.need || 0; plan += c.plan || 0; if (c.onTrack) on++; });
      if (!n) { gOut.textContent = ''; return; }
      sumBox.appendChild(h('div', { class: 'totals' }, [T.tot('צריך בחודש לכל היעדים', T.disp(need), 'big'), T.tot('מתוכנן בחודש', T.disp(plan)), T.tot('יעדים בדרך', on + ' מתוך ' + n)]));
      gOut.textContent = on + ' מתוך ' + n + ' יעדים פתוחים בדרך ליעד.';
    }
    function future(v) { var d = T.parseDate(v); return d && d < T.today() ? 'התאריך כבר עבר. בוחרים תאריך עתידי.' : ''; }
    list = T.listEditor(st.goals, [
      { k: 'name', label: 'שם היעד', type: 'text', placeholder: 'למשל: רכב, חופשה' },
      { k: 'target', label: 'סכום יעד', type: 'number', placeholder: 'למשל 60000' },
      { k: 'date', label: 'עד מתי', type: 'date', check: future },
      { k: 'current', label: 'נחסך עד עכשיו', type: 'number', placeholder: '0' },
      { k: 'monthly', label: 'הפקדה חודשית מתוכננת', type: 'number', adv: true },
      { k: 'currency', label: 'מטבע', type: 'select', options: T.curOptions(), def: 'ILS', adv: true }
    ], function (r) { save(); if (r && r._d) r._d(); drawSum(); drawNext(); }, { addLabel: 'הוספת יעד', rowTitle: 'יעד', summary: summary, extra: extra,
      empty: { title: 'עדיין אין יעדים', text: 'מוסיפים שם, סכום ותאריך, ונחשב כמה לחסוך בכל חודש.', example: 'רכב, 60,000 ₪, עד דצמבר 2027, כבר נחסכו 10,000 ₪.' } });
    drawSum(); drawE();
    var goalsCard = T.card('יעדי חיסכון', [sumBox, gOut, list.el]);
    main.appendChild(nextBox);
    main.appendChild(T.card('קרן חירום', [eOut, eBox]));
    main.appendChild(goalsCard);
    main.appendChild(T.disc('קרן חירום היא כסף נזיל לתקופה בלי הכנסה או להוצאה לא צפויה.'));
    T.onRemote(function () { location.reload(); });
  }
  T.page('goals', 'קרן חירום ויעדים', 'כמה כסף לשמור לחירום, וכמה לחסוך בכל חודש כדי להגיע ליעדים בזמן.', render);
})();
