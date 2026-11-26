/* Printable one-page personal financial report, built on the device from the saved data. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  function pointAtOrBefore(series, day) { var p = null; series.forEach(function (x) { if (x[0] <= day) p = x; }); return p; }
  function render(main) {
    var P = window.Portal, period = 'month', body = h('div', { class: 't13-report', 'aria-live': 'polite' });
    var seg = h('div', { class: 't13-seg no-print', role: 'group', 'aria-label': 'תקופת הדוח' });
    [['month', 'חודשי'], ['year', 'שנתי']].forEach(function (r) {
      var b = h('button', { type: 'button', class: 'btn', 'aria-pressed': String(r[0] === period), text: r[1] });
      b.addEventListener('click', function () { period = r[0]; Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(); });
      seg.appendChild(b);
    });
    var printBtn = h('button', { type: 'button', class: 'btn btn-soft', text: 'הדפסה' });
    printBtn.addEventListener('click', function () { window.print(); });
    function section(title, kids) { return h('section', { class: 'card t13-rsec' }, [h('h2', { class: 'card-title', text: title })].concat(kids)); }
    function row(k, v, cls) { return h('li', null, [h('span', { text: k }), h('span', { class: 'num' + (cls ? ' ' + cls : ''), text: v })]); }
    function draw() {
      body.innerHTML = '';
      var s = null; try { s = P.calc.summary(); } catch (e) {}
      var td = T.today(), from = period === 'month' ? T.addMonths(td, -1) : T.addMonths(td, -12);
      var title = period === 'month' ? 'דוח חודשי · ' + MONTHS[td.getMonth()] + ' ' + td.getFullYear() : 'דוח שנתי · ' + T.fmtDate(from) + ' עד ' + T.fmtDate(td);
      body.appendChild(h('div', { class: 't13-rhead' }, [h('h2', { class: 't13-rtitle', text: title }), h('p', { class: 'help', text: 'הופק ב־' + T.fmtDate(td) + ', לפי הנתונים שהוזנו באתר. מידע בלבד, לא ייעוץ.' })]));
      if (!s) { body.appendChild(h('p', { class: 'notice amber', text: 'לא הצלחנו לטעון את הנתונים.' })); return; }
      /* net worth */
      var series = window.T13Networth ? window.T13Networth.series() : [], startP = pointAtOrBefore(series, T.ymd(from)) || series[0], change = startP ? s.net - startP[1] : null;
      var nw = [row('הון נטו', T.disp(s.net)), row('נכסים', T.disp(s.assets)), row('התחייבויות', T.disp(-s.liabs), 'neg')];
      if (change !== null) nw.push(row('שינוי מ־' + T.fmtDate(T.parseDate(startP[0])), (change >= 0 ? '+' : '') + T.disp(change), change >= 0 ? 'pos' : 'neg'));
      var cats = Object.keys(s.cats || {}).filter(function (k) { return s.cats[k]; }).sort(function (a, b) { return s.cats[b] - s.cats[a]; }).slice(0, 6);
      var catList = cats.map(function (k) { return row(P.t(k), T.disp(s.cats[k])); });
      body.appendChild(h('div', { class: 't13-rgrid' }, [section('הון', [h('ul', { class: 't13-list' }, nw)]), section('הנכסים הגדולים', [cats.length ? h('ul', { class: 't13-list' }, catList) : h('p', { class: 'empty', text: 'אין נכסים.' })])]));
      /* cash flow */
      var B = T.basics(), inc = T.num(B.income), exp = T.num(B.expense);
      var m = period === 'month' ? 1 : 12, cf = [row('הכנסה', T.disp(inc * m)), row('הוצאות', T.disp(-exp * m), 'neg'), row('הלוואות', T.disp(-s.loanPmt * m), 'neg')];
      var net = (inc - exp - s.loanPmt) * m; cf.push(row('נשאר', T.disp(net), net >= 0 ? 'pos' : 'neg'));
      if (inc > 0) cf.push(row('שיעור חיסכון', T.fmt((inc - exp - s.loanPmt) / inc * 100, 1) + '%'));
      var fc = window.T13Cashflow ? window.T13Cashflow.forecast() : null, fcList = [];
      if (fc) { fcList.push(row('יתרה צפויה בעוד 12 חודשים', T.disp(fc.rows[11].bal), fc.rows[11].bal < 0 ? 'neg' : null)); fcList.push(row('חודשים במינוס', String(fc.negMonths.length), fc.negMonths.length ? 'neg' : null)); }
      body.appendChild(h('div', { class: 't13-rgrid' }, [section(period === 'month' ? 'תזרים בחודש' : 'תזרים בשנה', [h('ul', { class: 't13-list' }, cf)]), section('תחזית', [fcList.length ? h('ul', { class: 't13-list' }, fcList) : h('p', { class: 'empty', text: 'אין נתונים.' })])]));
      /* goals */
      var g = T.read('goals', {}), gl = [];
      var e = g.emergency || {}, monthly = T.num(T.basics().expense);
      if (monthly > 0) { var cash = 0; ((P.data.savings && P.data.savings.cash) || []).forEach(function (r) { var v = T.toILS(r.balance, r.currency); if (v) cash += v; }); var cur = e.useCash || e.current === null || e.current === undefined || e.current === '' ? cash : T.num(e.current), tgt = monthly * (T.num(e.months) || 6); gl.push(h('li', null, [h('span', { text: 'קרן חירום' }), h('span', { class: 'num', text: Math.round(Math.min(1, cur / tgt) * 100) + '% · ' + T.disp(cur) + ' מתוך ' + T.disp(tgt) })])); }
      (g.goals || []).forEach(function (x) { var t = T.toILS(x.target, x.currency), c = T.toILS(x.current, x.currency) || 0; if (!(t > 0)) return; gl.push(h('li', null, [h('span', { text: x.name || 'יעד' }), h('span', { class: 'num', text: Math.round(Math.min(1, c / t) * 100) + '% · ' + T.disp(c) + ' מתוך ' + T.disp(t) })])); });
      /* next steps */
      var steps = window.PortalInsights ? window.PortalInsights.list().slice(0, 3) : [];
      body.appendChild(h('div', { class: 't13-rgrid' }, [section('יעדים', [gl.length ? h('ul', { class: 't13-list' }, gl) : h('p', { class: 'empty' }, ['לא הוגדרו יעדים. ', h('a', { class: 'no-print', href: 'goals.html', text: 'להגדרת יעד' })])]),
        section('3 הצעדים הבאים', [steps.length ? h('ol', { class: 'steps' }, steps.map(function (x) { return h('li', null, [h('strong', { text: x.title }), h('br'), h('span', { class: 'help', text: x.text })]); })) : h('p', { class: 'empty', text: 'אין צעדים דחופים כרגע.' })])]));
    }
    draw();
    var s0 = null; try { s0 = P.calc.summary(); } catch (e) {}
    var emptyData = !s0 || (!(s0.assets > 0) && !(T.basics().income > 0) && !(s0.liabs > 0));
    var nx = emptyData ? T.next('הדוח עוד ריק. מזינים חסכונות, השקעות והכנסה חודשית, והוא יתמלא לבד.', { label: 'להזנת חסכונות', href: 'wealth.html' })
      : T.next('הדוח מוכן. מדפיסים או שומרים כ־PDF, למשל פעם בחודש לתיעוד.', { label: 'הדפסה או שמירה כ־PDF', onclick: function () { window.print(); } });
    nx.classList.add('no-print');
    main.appendChild(nx);
    main.appendChild(h('div', { class: 'toolbar no-print', style: 'justify-content:space-between;align-items:center' }, [seg, emptyData ? null : printBtn]));
    main.appendChild(body);
    main.appendChild(h('p', { class: 'help no-print', text: 'ההדפסה כוללת רק את הדוח, בלי התפריטים. בחלון ההדפסה אפשר לבחור "שמירה כ־PDF".' }));
  }
  T.page('report', 'דוח כספי', 'סיכום של עמוד אחד על המצב הכספי: הון, תזרים, יעדים והצעדים הבאים. להדפסה או לשמירה כ־PDF.', render);
})();
