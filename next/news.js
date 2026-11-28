/* next/ news screens. Owned by the news+avatar worker.
   Implements window.NextNews as documented in ux/coordination.md.
   Reuses root data files (briefs, news.json, news-hub.json, heatmap.json, prices.json). */
(function () {
  'use strict';

  function ensureCss() {
    if (document.querySelector('link[data-next-news]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'news.css';
    l.setAttribute('data-next-news', '1');
    document.head.appendChild(l);
  }
  ensureCss();

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var cache = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache[url];
  }
  function rel(t) {
    if (!t) return '';
    var d = new Date(t), n = Date.now();
    if (isNaN(d.getTime())) return String(t);
    var m = Math.round((n - d.getTime()) / 60000);
    if (m < 1) return 'עכשיו';
    if (m < 60) return 'לפני ' + m + ' דק׳';
    var h = Math.round(m / 60);
    if (h < 24) return 'לפני ' + h + ' שע׳';
    var days = Math.round(h / 24);
    if (days < 7) return 'לפני ' + days + ' ימים';
    try { return new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(d); }
    catch (e) { return t; }
  }
  var IC = { bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0' };
  function ic(k, A) {
    if (A && A.ic) return A.ic(k);
    if (!IC[k]) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[k] + '"/></svg>';
  }
  function toast(msg, A) { if (A && A.toast) A.toast(msg); }
  function apiOf(A) {
    A = A || window.NextApp || {};
    return {
      esc: A.esc || esc, rel: A.rel || rel, load: A.load || load, ic: function (k) { return ic(k, A); },
      toast: function (m) { toast(m, A); }, $: A.$ || $, $$: A.$$ || $$,
      DEMO: A.DEMO || '<span class="badge demo">נתוני דוגמה</span>'
    };
  }
  function segmented(root, onPick) {
    if (!root) return;
    var buttons = $$('button[data-v]', root);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-v');
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onPick(v);
      });
    });
  }
  function safeId(id) { return id && /^[0-9A-Za-z._-]+$/.test(id) ? id : ''; }
  function isBriefFileId(id) { return /^[0-9]{4}-[0-9]{2}-[0-9]{2}[0-9A-Za-z._-]*$/.test(id || ''); }
  function safeUrl(u) {
    if (!u || typeof u !== 'string') return '';
    try { var x = new URL(u, location.href); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; }
    catch (e) { return ''; }
  }
  function itemUrl(i) {
    return safeUrl((i.links && i.links[0] && (i.links[0].url || i.links[0])) || i.url || '');
  }
  function deskGroup(i) {
    if (i.kind === 'week' || i.kind === 'week_ahead' || i.period === 'week' || /שבוע/.test(i.edition || i.period_label || i.title || '')) return 'week';
    if (i.kind === 'month' || i.kind === 'funds' || i.period === 'month' || /חודש/.test(i.edition || i.period_label || '')) return 'month';
    if (i.kind === 'rss') return 'rss';
    return 'daily';
  }
  function badgeOf(i) {
    return i.edition || i.period_label || (deskGroup(i) === 'month' ? 'סיכום חודשי' : deskGroup(i) === 'week' ? 'סיכום שבועי' : 'סקירה');
  }
  function mergeDesk(br, nw) {
    var items = [], seen = {};
    function add(i) {
      if (!i || !i.id || seen[i.id]) return;
      seen[i.id] = 1;
      items.push(i);
    }
    (br && br.items || []).forEach(add);
    (nw && nw.items || []).filter(function (i) { return i.kind === 'digest' || i.kind === 'funds'; }).forEach(add);
    items.sort(function (a, b) { return String(b.time || '').localeCompare(String(a.time || '')); });
    return items;
  }
  function loadDesk(A) {
    return Promise.all([
      A.load('../data/briefs/index.json').catch(function () { return { items: [] }; }),
      A.load('../data/news.json').catch(function () { return { items: [] }; })
    ]).then(function (pair) { return mergeDesk(pair[0], pair[1]); });
  }
  function skel(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<div class="card" style="margin-bottom:12px"><div class="skel l" style="width:30%"></div><div class="skel h"></div><div class="skel l"></div></div>';
    return s;
  }
  function briefCard(i, A) {
    return '<a class="card cardlink brief fadein" href="#/news/' + encodeURIComponent(i.id) + '"><div class="ed"><span class="badge pri">' + A.esc(badgeOf(i)) + '</span><span class="muted" style="font-size:14px">' + A.esc(A.rel(i.time)) + '</span></div><h3>' + A.esc(i.title) + '</h3><p>' + A.esc(i.summary || '') + '</p></a>';
  }
  function empty(title, text, href, label) {
    return '<div class="card empty"><b>' + esc(title) + '</b>' + esc(text) + (href ? '<a href="' + esc(href) + '">' + esc(label) + '</a>' : '') + '</div>';
  }

  var COLORS = ['#4F46E5', '#0EA5A4', '#16A34A', '#D97706', '#DC2626'];
  function pctTxt(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + '%'; }

  function lineChartSvg(c) {
    var series = (c.series || []).filter(function (s) { return s && s.points && s.points.length > 1; });
    if (!series.length) return '';
    var W = 360, H = 200, L = 40, R = 8, TP = 10, B = 26;
    var labels = c.labels || series[0].points.map(function (p) { return p[0]; });
    var vals = []; series.forEach(function (s) { s.points.forEach(function (p) { vals.push(p[1]); }); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); if (hi - lo < 0.5) { hi += 0.5; lo -= 0.5; }
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var n = Math.max(2, labels.length);
    var x = function (i) { return L + (i / (n - 1)) * (W - L - R); };
    var y = function (v) { return TP + (hi - v) / (hi - lo) * (H - TP - B); };
    var parts = ['<svg class="nw-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(c.title || 'גרף') + '" direction="ltr">'];
    var g;
    for (g = 0; g <= 4; g++) {
      var v = lo + (hi - lo) * g / 4, yy = y(v);
      parts.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="nw-grid"/>');
      parts.push('<text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + v.toFixed(1) + '</text>');
    }
    if (lo < 100 && hi > 100) parts.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(100) + '" y2="' + y(100) + '" class="nw-base"/>');
    var step = Math.ceil(labels.length / 4);
    labels.forEach(function (lb, i) {
      var last = i === labels.length - 1;
      if (i % step === 0 || last) {
        if (!last && labels.length - 1 - i < step / 2) return;
        parts.push('<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? 'start' : last ? 'end' : 'middle') + '">' + esc(lb) + '</text>');
      }
    });
    series.forEach(function (s, si) {
      var pts = s.points.map(function (p, i) { return x(p[2] != null ? p[2] : i).toFixed(1) + ',' + y(p[1]).toFixed(1); }).join(' ');
      parts.push('<polyline points="' + pts + '" fill="none" stroke="' + COLORS[si % COLORS.length] + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
    });
    parts.push('</svg>');
    var legend = '<div class="nw-legend">' + series.map(function (s, si) {
      var last = s.points[s.points.length - 1][1] - 100;
      var cls = last >= 0 ? 'gain' : 'loss';
      return '<span><i style="background:' + COLORS[si % COLORS.length] + '"></i>' + esc(s.name) + ' <b class="num ' + cls + '">' + pctTxt(last) + '</b></span>';
    }).join('') + '</div>';
    return '<figure class="nw-fig"><figcaption>' + esc(c.title || '') + '</figcaption>' + parts.join('') + legend + '</figure>';
  }
  function barChartHtml(c) {
    var bars = c.bars || []; if (!bars.length) return '';
    var max = Math.max.apply(null, bars.map(function (b) { return Math.abs(b[1]); })) || 1;
    return '<figure class="nw-fig"><figcaption>' + esc(c.title || '') + '</figcaption><div class="nw-bars" role="list">' + bars.map(function (b) {
      var pos = b[1] >= 0;
      return '<div class="r" role="listitem"><span class="nm">' + esc(b[0]) + '</span><span class="tr" aria-hidden="true"><i class="' + (pos ? 'up' : 'down') + '" style="width:' + (Math.max(2, Math.abs(b[1]) / max * 100)) + '%"></i></span><b class="num ' + (pos ? 'gain' : 'loss') + '">' + pctTxt(b[1]) + '</b></div>';
    }).join('') + '</div></figure>';
  }

  function renderArticle(i, A) {
    var secs = i.stories || i.sections || [];
    var html = '<article class="card article fadein"><div class="ed" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="badge pri">' + A.esc(badgeOf(i)) + '</span><span class="muted" style="font-size:14px">' + A.esc(A.rel(i.time)) + (i.source ? ' · ' + A.esc(i.source) : '') + '</span></div><h2>' + A.esc(i.title) + '</h2>';
    if (i.verdict) html += '<p class="nw-verdict">' + A.esc(i.verdict) + '</p>';
    if (i.summary) html += '<p class="lead muted">' + A.esc(i.summary) + '</p>';
    if (i.indices && i.indices.length) {
      var groups = {}, order = [];
      i.indices.forEach(function (r) { var g = r.group || 'שווקים'; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r); });
      order.forEach(function (g) {
        html += '<p class="nw-grp">' + A.esc(g) + '</p><div class="nw-idx">';
        groups[g].forEach(function (r) {
          var dir = r.dir === 'up' ? 'gain' : r.dir === 'down' ? 'loss' : '';
          html += '<div class="c"><span class="k">' + A.esc(r.name) + '</span><span class="v num">' + A.esc(r.display || '') + '</span><span class="d num ' + dir + '">' + A.esc(r.change_text || '') + '</span><span class="n">' + A.esc((r.live ? 'במסחר' : 'נעילה') + (r.note ? ' · ' + r.note : '')) + '</span></div>';
        });
        html += '</div>';
      });
    }
    html += secs.map(function (s) {
      var body = s.text || s.body || (Array.isArray(s.items) ? s.items.map(function (x) { return typeof x === 'string' ? x : (x.name || '') + ' ' + (x.value || ''); }).join(' · ') : '');
      if (!s.title && !body) return '';
      return '<section class="story"><h3>' + A.esc(s.title || s.heading || '') + '</h3><p>' + A.esc(body) + '</p></section>';
    }).join('');
    if (!secs.length && i.body) html += '<p>' + A.esc(i.body) + '</p>';
    html += '</article>';
    if (i.charts && i.charts.length) {
      html += '<section class="card nw-charts" aria-label="גרפים"><h2>בגרפים</h2>' + i.charts.map(function (c) { return c.type === 'bar' ? barChartHtml(c) : lineChartSvg(c); }).join('') + '</section>';
    }
    if (i.table && i.table.rows && i.table.rows.length) {
      html += '<section class="card"><h2>טבלת ביצועים</h2><div class="nw-tbl" tabindex="0" role="region" aria-label="טבלת ביצועים, אפשר לגלול לצדדים"><table><thead><tr>' + (i.table.columns || []).map(function (c) { return '<th scope="col">' + A.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + i.table.rows.map(function (r) {
        return '<tr>' + r.map(function (v, ix) { return (ix ? '<td class="num">' : '<th scope="row">') + A.esc(v) + (ix ? '</td>' : '</th>'); }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></section>';
    }
    if (i.stats && i.stats.length) {
      html += '<section class="card"><h2>סטטיסטיקות</h2>' + i.stats.map(function (s) {
        return '<div class="story"><h3>' + A.esc(s.name) + '</h3><div class="nw-idx">' + [
          ['שינוי', pctTxt(s.change)],
          ['ימי עלייה', (s.up_days != null ? s.up_days + ' מתוך ' + s.days : '')],
          ['ירידה מקסימלית', s.max_drawdown != null ? pctTxt(s.max_drawdown) : ''],
          ['תנודתיות שנתית', s.vol_annual != null ? s.vol_annual + '%' : '']
        ].filter(function (p) { return p[1]; }).map(function (p) { return '<div class="c"><span class="k">' + A.esc(p[0]) + '</span><span class="v num">' + A.esc(p[1]) + '</span></div>'; }).join('') + '</div></div>';
      }).join('') + '</section>';
    }
    function movers(m, label) {
      if (!m || (!(m.up && m.up.length) && !(m.down && m.down.length))) return '';
      function lis(rows, cls) { return '<ul>' + (rows || []).map(function (r) { return '<li><span>' + A.esc(r.name) + '</span><b class="num ' + cls + '">' + A.esc(pctTxt(r.chg)) + '</b></li>'; }).join('') + '</ul>'; }
      return '<div><h3>' + A.esc(label) + '</h3><div class="nw-movers"><div><p class="muted">עליות</p>' + lis(m.up, 'gain') + '</div><div><p class="muted">ירידות</p>' + lis(m.down, 'loss') + '</div></div></div>';
    }
    var mv = movers(i.movers && i.movers.il, 'ת״א 35: הבולטות') + movers(i.movers && i.movers.us, 'S&P 100: הבולטות');
    if (mv) html += '<section class="card"><h2>המניות שזזו</h2>' + mv + '</section>';
    if (i.headlines && i.headlines.length) {
      html += '<section class="card"><h2>הכותרות המרכזיות</h2><div class="list">' + i.headlines.map(function (h) {
        var u = safeUrl(h.url);
        var t = A.esc(h.title);
        return '<a class="row" ' + (u ? 'href="' + A.esc(u) + '" target="_blank" rel="noopener"' : '') + '><span class="tx"><span class="t" dir="auto">' + t + '</span><span class="s">' + A.esc(h.source || '') + '</span></span></a>';
      }).join('') + '</div></section>';
    }
    html += '<p class="help">' + A.esc((i.source_note ? i.source_note + ' ' : '') + (i.disclaimer || 'מידע בלבד, לא ייעוץ.')) + '</p>';
    return html;
  }

  function list(el, q, api) {
    var A = apiOf(api);
    var tab = (q && q.get && q.get('t')) || 'desk';
    var deskFilter = 'all';
    el.innerHTML = '<div class="seg" id="nt" role="group" aria-label="סוג חדשות"><button type="button" data-v="desk" aria-pressed="' + (tab === 'desk') + '">סקירות הדסק</button><button type="button" data-v="all" aria-pressed="' + (tab === 'all') + '">כל החדשות</button></div>' +
      '<div class="nw-tools">' +
        '<a class="card cardlink nw-tool" href="#/news/alerts"><span class="ic">' + A.ic('bell') + '</span><span class="tx"><b>התראות</b><span class="muted">פתיחה, נעילה, שבוע וחודש</span></span></a>' +
        '<a class="card cardlink nw-tool" href="#/news/heatmap"><span class="tx"><b>מפת חום</b><span class="muted">ת״א 35 ו־S&amp;P 100</span></span></a>' +
        '<a class="card cardlink nw-tool" href="#/news/week"><span class="tx"><b>סיכום שבועי</b><span class="muted">סקירת השבוע בגרפים</span></span></a>' +
        '<a class="card cardlink nw-tool" href="#/news/month"><span class="tx"><b>סיכום חודשי</b><span class="muted">סטטיסטיקות ותשואות</span></span></a>' +
      '</div>' +
      '<div id="nw-desk-f" class="chips" hidden role="group" aria-label="סוג סקירה"></div>' +
      '<div id="nl" style="margin-top:12px">' + skel(5) + '</div>';
    var deskItems = null, hub = null;
    function filters() {
      var box = $('#nw-desk-f', el);
      if (!box || box.dataset.ready) return;
      box.dataset.ready = '1';
      [['all', 'הכל'], ['daily', 'יומיים'], ['week', 'שבועיים'], ['month', 'חודשיים']].forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', f[0] === deskFilter ? 'true' : 'false'); b.textContent = f[1];
        b.addEventListener('click', function () {
          deskFilter = f[0];
          $$('.chip', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          draw();
        });
        box.appendChild(b);
      });
    }
    function draw() {
      var nl = $('#nl', el), ff = $('#nw-desk-f', el);
      if (!nl) return;
      if (tab === 'desk') {
        if (ff) ff.hidden = false;
        if (!deskItems) return;
        var rows = deskItems.filter(function (i) { return deskFilter === 'all' || deskGroup(i) === deskFilter; }).slice(0, 40);
        nl.innerHTML = rows.length ? '<div class="stack">' + rows.map(function (i) { return briefCard(i, A); }).join('') + '</div>' : empty('אין סקירות בקטגוריה הזו', 'אפשר לראות את כל סקירות הדסק, או לחכות לסיכום הבא.', '#/news?t=desk', 'לכל הסקירות');
      } else {
        if (ff) ff.hidden = true;
        if (!hub) return;
        var items = hub.items || [];
        if (!items.length) { nl.innerHTML = empty('החדשות לא נטענו', 'נסו שוב בעוד רגע.'); return; }
        nl.innerHTML = '<section class="card" style="padding:8px 16px"><div class="list">' + items.slice(0, 80).map(function (i) {
          var url = itemUrl(i) || safeUrl(i.url);
          return '<a class="row fadein" ' + (url ? 'href="' + A.esc(url) + '" target="_blank" rel="noopener"' : '') + '><span class="tx"><span class="t" dir="auto"' + (i.lang ? ' lang="' + A.esc(i.lang) + '"' : '') + ' style="white-space:normal;line-height:1.4;text-align:start">' + A.esc(i.title) + '</span><span class="s">' + A.esc(i.source || '') + (i.time ? ' · ' + A.esc(A.rel(i.time)) : '') + '</span></span></a>';
        }).join('') + '</div></section><p class="help">מקורות חיצוניים נפתחים בלשונית חדשה. מידע בלבד, לא ייעוץ.</p>';
      }
    }
    filters();
    segmented($('#nt', el), function (v) { tab = v; history.replaceState(null, '', '#/news?t=' + v); draw(); });
    loadDesk(A).then(function (items) { deskItems = items; draw(); }).catch(function () { if (tab === 'desk') $('#nl', el).innerHTML = empty('הסקירות לא נטענו', 'נסו שוב בעוד רגע.'); });
    A.load('../data/news-hub.json').catch(function () { return A.load('../data/news.json'); }).then(function (j) { hub = j; if (tab === 'all') draw(); }).catch(function () { if (tab === 'all') $('#nl', el).innerHTML = empty('החדשות לא נטענו', 'נסו שוב בעוד רגע.'); });
  }

  function periodList(el, api, kind, title, emptyTitle) {
    var A = apiOf(api);
    el.innerHTML = '<p class="muted" style="margin:0 0 12px">סקירות ' + esc(title) + ' של הדסק, עם גרפים כשיש נתונים.</p><div id="nl">' + skel(3) + '</div>';
    loadDesk(A).then(function (items) {
      var rows = items.filter(function (i) { return deskGroup(i) === kind; });
      var nl = $('#nl', el);
      if (!rows.length) {
        nl.innerHTML = empty(emptyTitle, 'ברגע שתתפרסם סקירה היא תופיע כאן. בינתיים אפשר לקרוא את הסקירות היומיות.', '#/news', 'לסקירות הדסק');
        return;
      }
      nl.innerHTML = '<div class="stack">' + rows.map(function (i) { return briefCard(i, A); }).join('') + '</div>';
      var first = rows[0], sid = safeId(first.id);
      if (!isBriefFileId(sid)) return;
      A.load('../data/briefs/' + sid + '.json').then(function (b) {
        if (b && (b.charts || b.indices)) {
          var extra = document.createElement('div');
          extra.innerHTML = renderArticle(b, A);
          nl.insertBefore(extra, nl.firstChild);
        }
      }).catch(function () {});
    }).catch(function () { $('#nl', el).innerHTML = empty('הסקירות לא נטענו', 'נסו שוב בעוד רגע.'); });
  }

  function brief(el, id, api) {
    var A = apiOf(api);
    el.innerHTML = '<div class="card"><div class="skel l" style="width:30%"></div><div class="skel h"></div><div class="skel l"></div><div class="skel l"></div></div>';
    var sid = safeId(id);
    function fail() { el.innerHTML = empty('הסקירה לא נמצאה', 'ייתכן שהקישור ישן.', '#/news', 'לכל הסקירות'); }
    function fromNews() {
      return A.load('../data/news.json').then(function (j) {
        var i = (j.items || []).filter(function (x) { return x.id === id; })[0];
        if (!i) return fail();
        el.innerHTML = renderArticle(i, A);
      }).catch(fail);
    }
    if (isBriefFileId(sid)) {
      A.load('../data/briefs/' + sid + '.json').then(function (b) {
        if (b && b.id) el.innerHTML = renderArticle(b, A);
        else fromNews();
      }).catch(fromNews);
    } else fromNews();
  }

  function alerts(el, api) {
    var A = apiOf(api);
    var prefs = {};
    try { prefs = JSON.parse(localStorage.getItem('v2-alerts') || '{}'); } catch (e) { prefs = {}; }
    var defaults = { open: true, mid: false, close: true, week: true, month: true, break: false };
    Object.keys(defaults).forEach(function (k) { if (prefs[k] == null) prefs[k] = defaults[k]; });
    var opts = [
      ['open', 'סקירת פתיחה', 'בוקר: ישראל, אסיה ואירופה'],
      ['mid', 'סקירת אמצע יום', 'פתיחת וול סטריט'],
      ['close', 'סקירת נעילה', 'ערב: סיכום יום המסחר'],
      ['week', 'סיכום שבועי', 'מה היה השבוע ומה צפוי'],
      ['month', 'סיכום חודשי', 'סטטיסטיקות וגרפים לסוף החודש'],
      ['break', 'חדשות מתפרצות', 'רק אירועים משמעותיים']
    ];
    el.innerHTML = '<p class="muted" style="margin:4px 4px 12px">בחרו מה לקבל. הבחירה נשמרת במכשיר הזה. הרשמה להתראות בדפדפן או במייל — בעמוד ההתראות של האתר.</p>' +
      '<section class="card"><div class="list">' + opts.map(function (o) {
        return '<label class="row" for="a-' + o[0] + '"><span class="tx"><span class="t">' + o[1] + '</span><span class="s">' + o[2] + '</span></span><input type="checkbox" id="a-' + o[0] + '" data-k="' + o[0] + '"' + (prefs[o[0]] ? ' checked' : '') + ' style="width:28px;height:28px;accent-color:var(--primary)"></label>';
      }).join('') + '</div></section>' +
      '<p class="help" style="margin-top:12px"><a href="../alerts.html">להפעלת התראות בדפדפן או במייל</a> · הבחירה כאן היא העדפה מקומית בלבד.</p>';
    $$('[data-k]', el).forEach(function (c) {
      c.addEventListener('change', function () {
        prefs[c.dataset.k] = c.checked;
        localStorage.setItem('v2-alerts', JSON.stringify(prefs));
        var label = c.closest('.row') && c.closest('.row').querySelector('.t');
        A.toast(c.checked ? 'נשמר: ' + (label ? label.textContent : '') : 'בוטל');
      });
    });
  }

  function heatmap(el, api) {
    var A = apiOf(api);
    var state = { market: 'ta35', period: 'day', items: [], generatedAt: '', pricesAt: '' };
    el.innerHTML = '<p class="help" role="note">מידע בלבד, לא ייעוץ.</p><div id="hm-app" class="nw-hm"><p class="muted">טוענים את מפת החום…</p></div>';
    var root = $('#hm-app', el);
    function fmtPct(x) {
      if (x == null || !isFinite(x)) return '—';
      return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + '%';
    }
    function shade(x) {
      if (x == null || !isFinite(x)) return '';
      var mag = Math.min(1, Math.abs(x) / 6);
      var t = 0.22 + mag * 0.55;
      var c = x >= 0 ? [22, 163, 74] : [220, 38, 38];
      return 'color:#12151C;background:rgb(' + c.map(function (v) { return Math.round(255 + (v - 255) * t); }).join(',') + ')';
    }
    function clock(iso) {
      if (!iso) return '';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      try { return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(d); }
      catch (e) { return iso; }
    }
    function quoteOf(quotes, symbol) {
      if (!quotes) return null;
      return quotes[symbol] || quotes[symbol.replace(/\.TA$/, '')] || quotes[symbol + '.TA'] || null;
    }
    function draw() {
      var rows = state.items.filter(function (it) { return it.market === state.market; }).slice();
      rows.sort(function (a, b) {
        var av = a[state.period], bv = b[state.period];
        var an = av == null || !isFinite(av), bn = bv == null || !isFinite(bv);
        if (an && bn) return String(a.name).localeCompare(String(b.name), 'he');
        if (an) return 1; if (bn) return -1; return bv - av;
      });
      var meta = [];
      if (state.pricesAt) meta.push('שער יומי עדכני, ' + clock(state.pricesAt));
      if (state.generatedAt) meta.push('שבוע/חודש מ־Yahoo, ' + clock(state.generatedAt));
      function chips(label, opts, cur, key) {
        return '<div class="chips" role="group" aria-label="' + esc(label) + '">' + opts.map(function (o) {
          return '<button type="button" class="chip" data-k="' + key + '" data-v="' + o.id + '" aria-pressed="' + (o.id === cur) + '">' + esc(o.label) + '</button>';
        }).join('') + '</div>';
      }
      root.innerHTML = chips('מדד', [{ id: 'ta35', label: 'ת״א 35' }, { id: 'sp100', label: 'S&P 100' }], state.market, 'market') +
        chips('תקופה', [{ id: 'day', label: 'יום' }, { id: 'week', label: 'שבוע' }, { id: 'month', label: 'חודש' }], state.period, 'period') +
        '<p class="help">' + esc(meta.join(' · ')) + '</p>' +
        (rows.length ? '<div class="nw-hm-grid">' + rows.map(function (it) {
          var chg = it[state.period];
          return '<div class="nw-hm-tile" style="' + shade(chg) + '"><div class="nm">' + A.esc(it.name) + '</div><div class="sym">' + A.esc(it.symbol) + '</div><div class="chg num">' + fmtPct(chg) + '</div></div>';
        }).join('') + '</div>' : empty('אין נתונים להצגה כרגע', ''));
      $$('.chip', root).forEach(function (b) {
        b.addEventListener('click', function () {
          state[b.getAttribute('data-k')] = b.getAttribute('data-v');
          draw();
        });
      });
    }
    Promise.all([
      A.load('../data/heatmap.json').catch(function () { return { items: [] }; }),
      fetch('../prices.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (pair) {
      var heat = pair[0] || { items: [] }, prices = pair[1];
      state.generatedAt = heat.generatedAt || '';
      state.pricesAt = (prices && prices.generatedAt) || '';
      var items = heat.items || [];
      if (prices && prices.quotes) {
        items = items.map(function (it) {
          var q = quoteOf(prices.quotes, it.symbol);
          if (!q || q.price == null || !q.previousClose) return it;
          return Object.assign({}, it, { price: q.price, day: (q.price / q.previousClose - 1) * 100, live: true });
        });
      }
      state.items = items;
      draw();
    }).catch(function () { root.innerHTML = empty('מפת החום לא נטענה', 'נסו לרענן בעוד רגע.'); });
  }

  function homeBrief(el, api) {
    if (!el) return;
    var A = apiOf(api);
    A.load('../data/briefs/latest.json').then(function (d) {
      if (!d || !d.id) throw new Error('empty');
      el.innerHTML = briefCard(d, A);
    }).catch(function () {
      A.load('../data/news.json').then(function (j) {
        var d = (j.items || []).filter(function (i) { return i.kind === 'digest'; })[0];
        if (!d) { el.innerHTML = empty('הסקירה לא נטענה', 'נסו לרענן בעוד רגע.'); return; }
        el.innerHTML = briefCard(d, A);
      }).catch(function () { el.innerHTML = empty('הסקירה לא נטענה', 'נסו לרענן בעוד רגע.'); });
    });
  }

  window.NextNews = {
    list: list,
    brief: brief,
    alerts: alerts,
    week: function (el, api) { return periodList(el, api, 'week', 'השבוע', 'עוד אין סיכום שבועי'); },
    month: function (el, api) { return periodList(el, api, 'month', 'החודש', 'עוד אין סיכום חודשי חדש'); },
    heatmap: heatmap,
    homeBrief: homeBrief
  };
  // app.js calls go() before this deferred file runs; re-render news/home once hooks exist.
  var h = (location.hash || '#/').replace(/^#/, '') || '/';
  if (h === '/' || h === '/me' || h.indexOf('/news') === 0) {
    if (window.NextApp && typeof NextApp.go === 'function') NextApp.go();
    else window.dispatchEvent(new Event('hashchange'));
  }
})();
