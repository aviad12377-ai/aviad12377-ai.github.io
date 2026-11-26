/* Market briefs page: the latest brief in full, period reviews with charts, and the archive. */
(function () {
  var T = window.T16, el = T.el;
  T.mountNav('briefs');
  var COLORS = ['#a78bfa', '#60a5fa', '#4ade80', '#fbbf24', '#f87171'];
  var view = document.getElementById('t16-view'), arch = document.getElementById('t16-arch');
  var params = new URLSearchParams(location.search);

  function signCls(t) { return /^\+/.test(t) ? 'pos' : /^[−-]/.test(t) ? 'neg' : ''; }
  function pctTxt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + '%'; }

  function lineChart(c) {
    var series = (c.series || []).filter(function (s) { return s && s.points && s.points.length > 1; });
    if (!series.length) return null;
    var W = 360, H = 220, L = 40, R = 8, TP = 10, B = 26;
    var labels = c.labels || series[0].points.map(function (p) { return p[0]; });
    var vals = []; series.forEach(function (s) { s.points.forEach(function (p) { vals.push(p[1]); }); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi - lo < 0.5) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var n = Math.max(2, labels.length);
    var x = function (i) { return L + (i / (n - 1)) * (W - L - R); }; // time runs left to right, like market charts
    var y = function (v) { return TP + (hi - v) / (hi - lo) * (H - TP - B); };
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 't16-chart'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', c.title + ': ' + series.map(function (s) { var l = s.points[s.points.length - 1][1]; return s.name + ' ' + pctTxt(l - 100); }).join(', '));
    svg.setAttribute('direction', 'ltr');
    function add(tag, a, txt) { var e = document.createElementNS(ns, tag); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; }
    for (var g = 0; g <= 4; g++) {
      var v = lo + (hi - lo) * g / 4, yy = y(v);
      add('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: 'rgba(255,255,255,.1)' });
      add('text', { x: L - 6, y: yy + 4, 'text-anchor': 'end' }, v.toFixed(1));
    }
    if (lo < 100 && hi > 100) add('line', { x1: L, x2: W - R, y1: y(100), y2: y(100), stroke: 'rgba(255,255,255,.35)', 'stroke-dasharray': '4 4' });
    var step = Math.ceil(labels.length / 4);
    labels.forEach(function (lb, i) { var last = i === labels.length - 1; if (i % step === 0 || last) { if (!last && labels.length - 1 - i < step / 2) return; add('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : last ? 'end' : 'middle' }, lb); } });
    series.forEach(function (s, si) {
      add('polyline', { points: s.points.map(function (p, i) { return x(p[2] != null ? p[2] : i).toFixed(1) + ',' + y(p[1]).toFixed(1); }).join(' '), fill: 'none', stroke: COLORS[si % COLORS.length], 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    });
    var legend = el('div', { class: 't16-legend' }, series.map(function (s, si) {
      var last = s.points[s.points.length - 1][1] - 100;
      var i = el('i'); i.style.background = COLORS[si % COLORS.length];
      return el('span', {}, [i, s.name + ' ', el('b', { class: 'num ' + (last >= 0 ? 'pos' : 'neg'), text: pctTxt(last) })]);
    }));
    return el('figure', { style: 'margin:0' }, [el('figcaption', { class: 'small muted', text: c.title }), svg, legend]);
  }

  function barChart(c) {
    var bars = c.bars || []; if (!bars.length) return null;
    var max = Math.max.apply(null, bars.map(function (b) { return Math.abs(b[1]); })) || 1;
    var list = el('div', { class: 't16-bars', role: 'list' }, bars.map(function (b) {
      var pos = b[1] >= 0, fill = el('i', { class: pos ? 'up' : 'down' });
      fill.style.width = Math.max(2, Math.abs(b[1]) / max * 100) + '%';
      return el('div', { class: 'r', role: 'listitem' }, [el('span', { class: 'nm', text: b[0] }), el('span', { class: 'tr', 'aria-hidden': 'true' }, [fill]), el('b', { class: 'num ' + (pos ? 'pos' : 'neg'), text: pctTxt(b[1]) })]);
    }));
    return el('figure', { style: 'margin:12px 0 0' }, [el('figcaption', { class: 'small muted', text: c.title }), list]);
  }

  function moversBox(m, label) {
    if (!m || (!m.up.length && !m.down.length)) return null;
    function list(rows, cls) { return el('ul', {}, rows.map(function (r) { return el('li', {}, [el('span', { text: r.name }), el('b', { class: 'num ' + cls, text: pctTxt(r.chg) })]); })); }
    return el('div', {}, [el('h3', { text: label }), el('div', { class: 't16-movers' }, [
      el('div', {}, [el('p', { class: 'small muted', text: 'עליות' }), list(m.up, 'pos')]),
      el('div', {}, [el('p', { class: 'small muted', text: 'ירידות' }), list(m.down, 'neg')])
    ])]);
  }

  function render(b) {
    view.textContent = '';
    var head = el('div', { class: 't16-brief-head' }, [
      el('span', { class: 't16-badge ed', text: b.edition }),
      el('time', { class: 'small muted', datetime: b.time, text: (b.day ? 'יום ' + b.day + ', ' : '') + T.clock(b.time, true) })
    ]);
    var card = el('article', { class: 'card', 'aria-labelledby': 'b-title' }, [head, el('h2', { id: 'b-title', text: b.title })]);
    if (b.verdict) card.appendChild(el('p', { class: 't16-verdict', text: b.verdict }));
    if (b.indices && b.indices.length) {
      var groups = {};
      b.indices.forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });
      Object.keys(groups).forEach(function (g) {
        card.appendChild(el('p', { class: 't16-grp', text: g }));
        card.appendChild(el('div', { class: 't16-idx' }, groups[g].map(function (r) {
          return el('div', { class: 'c' }, [el('span', { class: 'k', text: r.name }), el('span', { class: 'v num', text: r.display }),
            el('span', { class: 'd num ' + (r.dir === 'up' ? 'pos' : r.dir === 'down' ? 'neg' : ''), text: r.change_text }),
            el('span', { class: 'n', text: r.live ? 'במסחר · ' + r.note : 'נעילה · ' + r.note })]);
        })));
      });
    }
    (b.stories || []).forEach(function (s) { if (s.text) card.appendChild(el('section', { class: 't16-story' }, [el('h3', { text: s.title }), el('p', { text: s.text })])); });
    view.appendChild(card);

    if (b.charts && b.charts.length) {
      var cc = el('section', { class: 'card', 'aria-label': 'גרפים' }, [el('h2', { text: 'בגרפים' })]);
      b.charts.forEach(function (c) { var n = c.type === 'bar' ? barChart(c) : lineChart(c); if (n) cc.appendChild(n); });
      view.appendChild(cc);
    }
    if (b.table && b.table.rows && b.table.rows.length) {
      var tbl = el('table', {}, [el('thead', {}, [el('tr', {}, b.table.columns.map(function (c) { return el('th', { scope: 'col', text: c }); }))]),
        el('tbody', {}, b.table.rows.map(function (r) { return el('tr', {}, r.map(function (v, i) { return el(i ? 'td' : 'th', { scope: i ? null : 'row', class: i ? 'num ' + signCls(v) : null, text: v }); })); }))]);
      view.appendChild(el('section', { class: 'card' }, [el('h2', { text: 'טבלת ביצועים' }), el('div', { class: 't16-tbl', tabindex: '0', role: 'region', 'aria-label': 'טבלת ביצועים, אפשר לגלול לצדדים' }, [tbl])]));
    }
    if (b.stats && b.stats.length) {
      view.appendChild(el('section', { class: 'card' }, [el('h2', { text: 'סטטיסטיקות' })].concat(b.stats.map(function (s) {
        return el('div', { class: 't16-story' }, [el('h3', { text: s.name }), el('div', { class: 't16-idx' }, [
          ['שינוי', pctTxt(s.change)], ['ימי עלייה', s.up_days + ' מתוך ' + s.days], ['ירידה מקסימלית', pctTxt(s.max_drawdown)], ['תנודתיות שנתית', s.vol_annual + '%'],
          ['היום הטוב', s.best.date + ' ' + pctTxt(s.best.chg)], ['היום החלש', s.worst.date + ' ' + pctTxt(s.worst.chg)]
        ].map(function (p) { return el('div', { class: 'c' }, [el('span', { class: 'k', text: p[0] }), el('span', { class: 'v num', text: p[1] })]); }))]);
      }))));
    }
    var mv = [moversBox(b.movers && b.movers.il, 'ת״א 35: הבולטות'), moversBox(b.movers && b.movers.us, 'S&P 100: הבולטות')].filter(Boolean);
    if (mv.length) view.appendChild(el('section', { class: 'card' }, [el('h2', { text: 'המניות שזזו' })].concat(mv)));
    if (b.calendar && b.calendar.length) {
      view.appendChild(el('section', { class: 'card' }, [el('h2', { text: 'לוח אירועים' }), el('ul', { class: 't16-list' }, b.calendar.map(function (e) {
        return el('li', { class: 't16-item' }, [el('div', { class: 't16-meta' }, [el('span', { class: 't16-src', text: 'יום ' + e.day + ' ' + e.hm }), el('span', { text: e.country }), el('span', { class: 't16-tag', text: 'חשיבות ' + e.impact })]),
          el('b', { text: e.title }), (e.forecast || e.previous) ? el('p', { class: 'small muted', text: (e.forecast ? 'תחזית ' + e.forecast : '') + (e.forecast && e.previous ? ' · ' : '') + (e.previous ? 'קודם ' + e.previous : '') }) : null]);
      }))]));
    }
    if (b.earnings && b.earnings.length) {
      view.appendChild(el('section', { class: 'card' }, [el('h2', { text: 'דוחות כספיים צפויים' }), el('ul', { class: 't16-list' }, b.earnings.map(function (e) {
        return el('li', { class: 't16-item' }, [el('div', { class: 't16-meta' }, [el('span', { class: 't16-src', text: 'יום ' + e.day + ' ' + e.date }), e.when ? el('span', { text: e.when }) : null]), el('b', { lang: 'en', dir: 'ltr', text: e.name + ' (' + e.symbol + ')' })]);
      }))]));
    }
    if (b.headlines && b.headlines.length) {
      view.appendChild(el('section', { class: 'card' }, [el('h2', { text: 'הכותרות המרכזיות' }), el('ul', { class: 't16-list' }, b.headlines.map(function (h) {
        var u = T.safeUrl(h.url);
        return el('li', { class: 't16-item', lang: h.lang === 'en' ? 'en' : 'he' }, [el('div', { class: 't16-meta' }, [el('span', { class: 't16-src', text: h.source })]),
          u ? el('a', { class: 't', href: u, target: '_blank', rel: 'noopener', text: h.title }) : el('span', { text: h.title })]);
      })), el('a', { class: 'btn btn-soft btn-block', href: 'news.html', text: 'לכל החדשות' })]));
    }
    view.appendChild(el('p', { class: 't16-disc', text: (b.source_note ? b.source_note + ' ' : '') + (b.disclaimer || 'מידע כללי בלבד, לא ייעוץ.') }));
    document.title = b.edition + ' · מבזקי שוק';
  }

  function archive(idx, currentId) {
    var filter = 'all';
    var chipsBox = document.getElementById('t16-arch-f');
    [['all', 'הכל'], ['daily', 'יומיים'], ['week', 'שבועיים'], ['month', 'חודשיים']].forEach(function (f) {
      var b = el('button', { type: 'button', class: 't16-chip', 'aria-pressed': String(f[0] === filter), text: f[1], onclick: function () {
        filter = f[0]; [].forEach.call(chipsBox.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw();
      } });
      chipsBox.appendChild(b);
    });
    function draw() {
      arch.textContent = '';
      var rows = (idx.items || []).filter(function (i) { return filter === 'all' || (filter === 'week' ? (i.kind === 'week' || i.kind === 'week_ahead') : i.kind === filter); }).slice(0, 60);
      if (!rows.length) arch.appendChild(el('li', { class: 'empty', text: 'עוד אין מבזקים בקטגוריה הזו.' }));
      rows.forEach(function (i) {
        arch.appendChild(el('li', {}, [el('a', { href: 'briefs.html?id=' + encodeURIComponent(i.id), 'aria-current': i.id === currentId ? 'page' : null }, [
          el('span', { class: 't16-meta' }, [el('span', { class: 't16-badge ed', text: i.edition }), el('span', { text: T.clock(i.time, true) })]), el('b', { text: i.title })])]));
      });
    }
    draw();
  }

  var id = params.get('id');
  var want = id && /^[0-9a-z_-]+$/i.test(id) ? 'data/briefs/' + id + '.json' : 'data/briefs/latest.json';
  Promise.all([T.getJSON(want).catch(function () { return null; }), T.getJSON('data/briefs/index.json').catch(function () { return { items: [] }; })]).then(function (r) {
    if (r[0]) render(r[0]); else view.appendChild(el('p', { class: 'card empty', text: 'המבזק הראשון יתפרסם במועד הקרוב. בינתיים אפשר לקרוא את החדשות.' }));
    archive(r[1], r[0] && r[0].id);
    document.getElementById('t16-briefs').setAttribute('aria-busy', 'false');
  });
})();
