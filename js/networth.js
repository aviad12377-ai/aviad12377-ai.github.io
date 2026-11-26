/* Net worth over time: one snapshot a day of the total net worth, drawn as an inline SVG line. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  function series() {
    var own = T.read('networth_history', { points: [] }), pts = {};
    var d = T.portalData();
    if (d && Array.isArray(d.history)) d.history.forEach(function (p) { if (p && p[0]) pts[p[0]] = p[1]; });
    (own.points || []).forEach(function (p) { if (p && p[0]) pts[p[0]] = p[1]; });
    return Object.keys(pts).sort().map(function (k) { return [k, pts[k]]; });
  }
  /* Called on every page that loads this file: store today's value (one point per day, latest value wins). */
  function snapshot() {
    var P = window.Portal; if (!P || !P.calc || !P.calc.summary) return null;
    var s; try { s = P.calc.summary(); } catch (e) { return null; }
    if (!s || s.missing || !Number.isFinite(s.net)) return s || null;
    var own = T.read('networth_history', { points: [] }); if (!Array.isArray(own.points)) own.points = [];
    if (s.net === 0 && !own.points.length) return s;
    var day = T.ymd(T.today()), last = own.points[own.points.length - 1], v = Math.round(s.net);
    if (last && last[0] === day) { if (last[1] === v) return s; last[1] = v; }
    else { own.points.push([day, v]); if (own.points.length > 1200) own.points.splice(0, own.points.length - 1200); }
    T.write('networth_history', own);
    return s;
  }
  function chart(pts) {
    var W = 340, H = 200, L = 8, R = 8, Tp = 14, B = 28;
    var NS = 'http://www.w3.org/2000/svg';
    function s(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
    var vals = pts.map(function (p) { return T.fromILS(p[1]); }).filter(function (v) { return v !== null; });
    if (vals.length !== pts.length) vals = pts.map(function (p) { return p[1]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals); if (min === max) { min -= Math.abs(min) * 0.05 || 1; max += Math.abs(max) * 0.05 || 1; }
    var t0 = T.parseDate(pts[0][0]).getTime(), t1 = T.parseDate(pts[pts.length - 1][0]).getTime(); if (t1 === t0) t1 = t0 + 864e5;
    function X(i) { return W - R - (T.parseDate(pts[i][0]).getTime() - t0) / (t1 - t0) * (W - L - R); } // RTL: time runs right to left
    function Y(v) { return Tp + (1 - (v - min) / (max - min)) * (H - Tp - B); }
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 't13-chart', direction: 'ltr', role: 'img', 'aria-label': 'גרף ההון נטו מ־' + T.fmtDate(T.parseDate(pts[0][0])) + ' עד ' + T.fmtDate(T.parseDate(pts[pts.length - 1][0])) + ': מ־' + T.money(vals[0]) + ' ל־' + T.money(vals[vals.length - 1]) });
    var defs = s('defs');
    var g = s('linearGradient', { id: 't13-grad', x1: '0', x2: '1', y1: '0', y2: '0' }); g.appendChild(s('stop', { offset: '0', 'stop-color': '#8b5cf6' })); g.appendChild(s('stop', { offset: '1', 'stop-color': '#3b82f6' }));
    var f = s('linearGradient', { id: 't13-fill', x1: '0', x2: '0', y1: '0', y2: '1' }); f.appendChild(s('stop', { offset: '0', 'stop-color': '#6366f1', 'stop-opacity': '.35' })); f.appendChild(s('stop', { offset: '1', 'stop-color': '#6366f1', 'stop-opacity': '0' }));
    defs.appendChild(g); defs.appendChild(f); svg.appendChild(defs);
    [0, 0.5, 1].forEach(function (q) { var y = Tp + q * (H - Tp - B); svg.appendChild(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid' })); });
    var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    if (vals.length > 1) svg.appendChild(s('path', { d: d + ' L' + X(vals.length - 1).toFixed(1) + ' ' + (H - B) + ' L' + X(0).toFixed(1) + ' ' + (H - B) + ' Z', class: 'area' }));
    svg.appendChild(s('path', { d: d, class: 'line' }));
    var li = vals.length - 1; svg.appendChild(s('circle', { cx: X(li), cy: Y(vals[li]), r: 5, class: 'dot' }));
    var a = s('text', { x: W - R, y: H - 8, 'text-anchor': 'end' }); a.textContent = T.fmtDate(T.parseDate(pts[0][0])); svg.appendChild(a);
    var b = s('text', { x: L, y: H - 8, 'text-anchor': 'start' }); b.textContent = T.fmtDate(T.parseDate(pts[li][0])); svg.appendChild(b);
    return svg;
  }
  function render(main) {
    var s = snapshot(), range = 'all', box = h('div'), status = T.live();
    var seg = h('div', { class: 't13-seg', role: 'group', 'aria-label': 'טווח זמן' });
    [['3m', '3 חודשים'], ['1y', 'שנה'], ['all', 'הכול']].forEach(function (r) {
      var b = h('button', { type: 'button', class: 'btn', 'aria-pressed': String(r[0] === range), text: r[1] });
      b.addEventListener('click', function () { range = r[0]; Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(); });
      seg.appendChild(b);
    });
    function draw() {
      box.innerHTML = '';
      var all = series(), from = null;
      if (range === '3m') from = T.ymd(T.addMonths(T.today(), -3)); else if (range === '1y') from = T.ymd(T.addMonths(T.today(), -12));
      var pts = from ? all.filter(function (p) { return p[0] >= from; }) : all;
      if (!pts.length) { box.appendChild(h('p', { class: 'empty', text: 'עדיין אין נקודות. ברגע שיהיו נתונים בדף הבית, ההון יישמר כאן פעם ביום.' })); status.textContent = ''; return; }
      var first = pts[0][1], last = pts[pts.length - 1][1], diff = last - first;
      box.appendChild(h('div', { class: 'totals' }, [T.tot('הון נטו עכשיו', T.disp(last), 'big'), T.tot('שינוי בטווח', (diff >= 0 ? '+' : '') + T.disp(diff), diff >= 0 ? 'pos' : 'neg'), T.tot('מספר נקודות', String(pts.length))]));
      if (pts.length >= 2) box.appendChild(chart(pts));
      else box.appendChild(h('p', { class: 'help', text: 'הגרף יופיע מהיום השני. בכל יום שבו נכנסים לאתר נשמרת נקודה אחת.' }));
      var rows = pts.slice(-12).reverse().map(function (p) { return h('tr', null, [h('td', { text: T.fmtDate(T.parseDate(p[0])) }), h('td', { class: 'num', text: T.disp(p[1]) })]); });
      box.appendChild(h('details', null, [h('summary', { text: 'טבלת הנקודות האחרונות' }), h('div', { class: 'tbl-wrap' }, [h('table', { class: 'cmp' }, [h('thead', null, [h('tr', null, [h('th', { text: 'תאריך' }), h('th', { text: 'הון נטו' })])]), h('tbody', null, rows)])])]));
      status.textContent = 'מוצג טווח ' + ({ '3m': 'של 3 חודשים', '1y': 'של שנה', all: 'מלא' })[range] + '. הון נטו אחרון: ' + T.disp(last) + '.';
    }
    draw();
    T.onRemote(draw);
    var note = s && s.missing ? h('p', { class: 'notice amber', text: 'חסרים כמה שערים או מחירים, ולכן הנקודה של היום לא נשמרה. היא תישמר אחרי שהמחירים יתעדכנו.' }) : null;
    main.appendChild(T.card('ההון נטו לאורך זמן', [note, seg, status, box, h('p', { class: 't13-note', text: 'נכסים פחות התחייבויות, לפי הנתונים שהזנת באתר. נשמרת נקודה אחת ביום, בפעם הראשונה שנכנסים.' })]));
    main.appendChild(T.card('מה נכנס לחישוב', [h('div', { class: 't13-hub' }, [h('a', { href: 'wealth.html', text: 'חסכונות והשקעות' }), h('a', { href: 'assets.html', text: 'דירה, רכב וקרקע' }), h('a', { href: 'loans.html', text: 'הלוואות ומשכנתא' })])]));
  }
  window.T13Networth = { snapshot: snapshot, series: series };
  if (document.body && document.body.getAttribute('data-page') === 'networth') T.page('networth', 'ההון לאורך זמן', 'גרף של ההון נטו, נקודה אחת ביום', render);
  else document.addEventListener('DOMContentLoaded', function () { if (document.body.getAttribute('data-page') === 'networth') return; setTimeout(snapshot, 1500); });
})();
