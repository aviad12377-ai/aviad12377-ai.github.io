/* Pension, gemel, hishtalmut and policy comparison from official CMA funds.json. */
(function () {
  'use strict';
  var PAGE = 'compare-funds';
  var LIMIT = 20;
  var TYPE_LABELS = {
    pension: 'פנסיה מקיפה',
    pension_general: 'פנסיה כללית',
    gemel: 'גמל / תגמולים',
    gemel_invest: 'גמל להשקעה',
    gemel_child: 'חיסכון לכל ילד',
    hishtalmut: 'השתלמות',
    policy: 'פוליסת חיסכון',
    gemel_other: 'גמל, אחר',
    other: 'אחר'
  };
  var TRACK_LABELS = {
    sp500: 'S&P 500',
    halacha: 'הלכה',
    cash: 'כספי / שקלי',
    age: 'לפי גיל',
    bonds: 'אג"ח',
    equity: 'מניות',
    general: 'כללי',
    index: 'מדד',
    other: 'אחר'
  };
  var KIND_TO_TYPES = {
    pension: ['pension', 'pension_general'],
    hishtalmut: ['hishtalmut'],
    gemel: ['gemel', 'gemel_invest', 'gemel_child', 'gemel_other'],
    policy: ['policy']
  };
  var SOURCE_LINKS = [
    { href: 'https://gemelnet.cma.gov.il/', text: 'גמלנט, רשות שוק ההון' },
    { href: 'https://pensyanet.cma.gov.il/', text: 'פנסיהנט, רשות שוק ההון' },
    { href: 'https://bituachnet.cma.gov.il/', text: 'ביטוחנט, רשות שוק ההון' },
    { href: 'https://data.gov.il/dataset/a30dcbea-a1d2-482c-ae29-8f781f5025fb', text: 'data.gov.il, גמלנט (משאב רשמי)' },
    { href: 'https://data.gov.il/dataset/6d47d6b5-cb08-488b-b333-f1e717b1e1bd', text: 'data.gov.il, פנסיהנט (משאב רשמי)' },
    { href: 'https://data.gov.il/dataset/c6c62cc7-fe02-4b18-8f3e-813abfbb4647', text: 'data.gov.il, ביטוחנט (משאב רשמי)' }
  ];

  function h(tag, attrs, kids) {
    if (window.Portal && window.Portal.ui && window.Portal.ui.h) return window.Portal.ui.h(tag, attrs, kids);
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function pct(v, digits) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    var d = digits == null ? 2 : digits;
    return (Math.round(Number(v) * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  }
  function israelStamp(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    function g(t) { var p = parts.find(function (x) { return x.type === t; }); return p ? p.value : ''; }
    return g('day') + '.' + g('month') + '.' + g('year') + ' ' + g('hour') + ':' + g('minute') + ' (שעון ישראל)';
  }
  function periodHe(p) {
    var s = String(p || '');
    if (/^\d{6}$/.test(s)) {
      var months = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
      var m = Number(s.slice(4, 6));
      return (months[m] || s.slice(4, 6)) + ' ' + s.slice(0, 4);
    }
    return s;
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }
  function ensureCss() {
    if (document.querySelector('link[href="compare.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'compare.css'; document.head.appendChild(l);
  }
  function typeLabel(k) { return TYPE_LABELS[k] || k; }
  function trackLabel(k) { return TRACK_LABELS[k] || k; }

  function render(main, payload) {
    ensureCss();
    var Lib = window.CompareLib;
    var wrap = h('div', { class: 'cmp-page', id: 'funds-compare' });
    var rows = Lib.flattenFunds(payload);
    var filters = { productType: '', track: '', q: '' };
    var sortKey = 'y5';
    var sortDir = -1;
    var showAll = false;
    var onlyMine = false;

    wrap.appendChild(h('div', { class: 'notice amber', text: 'מידע בלבד, לא ייעוץ. התשואות ודמי הניהול הם נתונים רשמיים שפורסמו, לא תחזית ולא הצעה אישית.' }));
    wrap.appendChild(h('p', { class: 'help', text: 'עמודת 12 החודשים היא חיבור של 12 תשואות חודשיות רשמיות רצופות שפורסמו לאחרונה, ולא תשואה שנתית מפורסמת כשלעצמה. כשאין 12 חודשים רצופים מוצג מקף. תשואות 3 ו־5 שנים, דמי הניהול, שארפ וסטיית התקן לקוחים מהפרסום הרשמי כפי שהם. תשואה מתחילת שנה היא השדה הרשמי (YTD), ולא תשואה ל־12 חודשים.' }));

    var src = h('div', { class: 'src-line' });
    SOURCE_LINKS.forEach(function (s) {
      src.appendChild(h('a', { href: s.href, target: '_blank', rel: 'noopener', text: s.text }));
    });
    var period = (payload.sets && payload.sets.pensianet && payload.sets.pensianet.period) ||
      (payload.sets && payload.sets.gemelnet && payload.sets.gemelnet.period) || '';
    src.appendChild(h('span', { class: 'stamp', text: 'תקופה: ' + periodHe(period) + (payload.generatedAt ? ' · עודכן במקור ב־' + israelStamp(payload.generatedAt) : '') }));
    wrap.appendChild(src);

    var mineBox = h('div', { class: 'mine-box', id: 'fund-mine' });
    wrap.appendChild(mineBox);

    var form = h('div', { class: 'fields' });
    var typeId = uid('type'), trackId = uid('track'), qId = uid('q');
    var typeSel = h('select', { id: 'fund-type' });
    typeSel.appendChild(h('option', { value: '', text: 'הכול' }));
    ['pension', 'pension_general', 'gemel', 'gemel_invest', 'gemel_child', 'hishtalmut', 'policy', 'gemel_other'].forEach(function (k) {
      typeSel.appendChild(h('option', { value: k, text: typeLabel(k) }));
    });
    typeSel.addEventListener('change', function () { filters.productType = typeSel.value; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: 'fund-type', text: 'סוג מוצר' }), typeSel]));

    var trackSel = h('select', { id: 'fund-track' });
    trackSel.appendChild(h('option', { value: '', text: 'הכול' }));
    ['equity', 'sp500', 'general', 'bonds', 'halacha', 'age', 'cash', 'index', 'other'].forEach(function (k) {
      trackSel.appendChild(h('option', { value: k, text: trackLabel(k) }));
    });
    trackSel.addEventListener('change', function () { filters.track = trackSel.value; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: 'fund-track', text: 'מסלול' }), trackSel]));

    var qInp = h('input', { type: 'search', id: 'fund-q', placeholder: 'שם מסלול או בית השקעות' });
    qInp.addEventListener('input', function () { filters.q = qInp.value; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: 'fund-q', text: 'חיפוש' }), qInp]));
    wrap.appendChild(form);

    var out = h('div');
    wrap.appendChild(out);
    main.appendChild(wrap);

    function mineMatches(saved) {
      return (saved || []).map(function (s) { return { saved: s, row: Lib.matchSavedFund(s, rows) }; });
    }

    function draw() {
      var saved = Lib.readSavedFunds();
      var matches = mineMatches(saved);
      var mineIds = {};
      matches.forEach(function (m) { if (m.row) mineIds[String(m.row.id) + ':' + m.row.setName] = true; });

      mineBox.innerHTML = '';
      mineBox.appendChild(h('h3', { text: 'השוואה למסלולים שלי' }));
      var loadBtn = h('button', { type: 'button', class: 'cmp-toggle', id: 'fund-load-saved', text: 'טען מחדש את המסלולים השמורים' });
      loadBtn.addEventListener('click', function () { draw(); });
      if (!saved.length) {
        mineBox.appendChild(h('p', { class: 'help', text: 'לא נשמרו מסלולי פנסיה או השתלמות בפורטל. אפשר לבחור מסלול בעמוד הפרופיל ולהשוות אחר כך. הנתונים נשמרים במכשיר בלבד.' }));
        mineBox.appendChild(h('p', { class: 'src-line' }, [h('a', { href: 'me.html', text: 'לעמוד הפרופיל' })]));
        mineBox.appendChild(loadBtn);
      } else {
        mineBox.appendChild(loadBtn);
        matches.forEach(function (m) {
          var item = h('div', { class: 'mine-item' });
          var title = (m.saved.name || m.saved.trackName || 'מסלול שמור') + (m.saved.kind === 'hishtalmut' ? ' (השתלמות)' : m.saved.kind === 'pension' ? ' (פנסיה)' : '');
          item.appendChild(h('strong', { text: title }));
          if (m.row) {
            item.appendChild(document.createTextNode(' — התאמה בנתונים הרשמיים: ' + m.row.name + '. '));
            item.appendChild(document.createTextNode('12 חודשים ' + pct(m.row.y1) + ', 3 שנים ' + pct(m.row.y3) + ', 5 שנים ' + pct(m.row.y5) + ', דמי ניהול מנכסים ' + pct(m.row.feeAcc) + ', מהפקדות ' + pct(m.row.feeDep) + '.'));
          } else {
            item.appendChild(document.createTextNode(' — לא נמצאה התאמה בנתונים הרשמיים לפי השם או המזהה שנשמרו.'));
          }
          mineBox.appendChild(item);
        });
      }

      var list = Lib.filterFunds(rows, filters);
      if (onlyMine) {
        list = list.filter(function (r) { return mineIds[String(r.id) + ':' + r.setName]; });
      }
      var sorted = Lib.sortFunds(list, sortKey, sortDir);
      var total = sorted.length;
      var limited = !showAll && total > LIMIT;
      var shown = limited ? sorted.slice(0, LIMIT) : sorted;

      out.innerHTML = '';
      var bar = h('div', { class: 'cmp-toolbar' });
      var status = total === 0
        ? 'אין תוצאות לפי הסינון.'
        : (limited
          ? ('מוצגים ' + LIMIT + ' המסלולים לפי המיון הנוכחי, מתוך ' + total + ' לפי הסינון.')
          : ('מוצגים ' + shown.length + ' מסלולים' + (showAll && total > LIMIT ? ' (כל התוצאות לפי הסינון)' : '') + '.'));
      bar.appendChild(h('p', { class: 'help', id: 'fund-count', text: status }));
      if (saved.length) {
        var mineBtn = h('button', {
          type: 'button', class: 'cmp-toggle', id: 'fund-only-mine',
          'aria-pressed': onlyMine ? 'true' : 'false',
          text: onlyMine ? 'הצג את כל המסלולים בסינון' : 'הצג רק את המסלולים שלי'
        });
        mineBtn.addEventListener('click', function () { onlyMine = !onlyMine; draw(); });
        bar.appendChild(mineBtn);
      }
      if (total > LIMIT) {
        var btn = h('button', {
          type: 'button', class: 'cmp-toggle', id: 'fund-show-all',
          'aria-pressed': showAll ? 'true' : 'false',
          text: showAll ? 'הצג ' + LIMIT + ' מובילים' : 'הצג את כל המסלולים'
        });
        btn.addEventListener('click', function () { showAll = !showAll; draw(); });
        bar.appendChild(btn);
      }
      out.appendChild(bar);

      var cols = [
        { key: 'name', label: 'מסלול' },
        { key: 'productType', label: 'סוג' },
        { key: 'provider', label: 'גוף' },
        { key: 'track', label: 'אפיק' },
        { key: 'feeAcc', label: 'דמי ניהול מנכסים' },
        { key: 'feeDep', label: 'דמי ניהול מהפקדות' },
        { key: 'y1', label: '12 חודשים' },
        { key: 'ytd', label: 'מתחילת שנה' },
        { key: 'y3', label: '3 שנים' },
        { key: 'y5', label: '5 שנים' },
        { key: 'sharpe', label: 'שארפ' },
        { key: 'sd', label: 'סטיית תקן' }
      ];
      var tbl = document.createElement('table');
      tbl.className = 'cmp data';
      var cap = document.createElement('caption');
      cap.className = 'sr-only';
      cap.textContent = 'השוואת מסלולי פנסיה, גמל, השתלמות ופוליסות';
      tbl.appendChild(cap);
      var thead = document.createElement('thead'), hr = document.createElement('tr');
      cols.forEach(function (c) {
        var th = document.createElement('th');
        th.scope = 'col';
        th.className = 'sortable';
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = c.label;
        if (sortKey === c.key) b.setAttribute('aria-sort', sortDir === -1 ? 'descending' : 'ascending');
        b.addEventListener('click', function () {
          if (sortKey === c.key) sortDir = -sortDir;
          else { sortKey = c.key; sortDir = (c.key === 'name' || c.key === 'provider' || c.key === 'productType' || c.key === 'track') ? 1 : -1; }
          draw();
        });
        th.appendChild(b);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      tbl.appendChild(thead);
      var tb = document.createElement('tbody');
      if (!shown.length) {
        var er = document.createElement('tr');
        var ed = document.createElement('td');
        ed.colSpan = cols.length;
        ed.textContent = 'אין תוצאות לפי הסינון.';
        er.appendChild(ed);
        tb.appendChild(er);
      }
      shown.forEach(function (r) {
        var tr = document.createElement('tr');
        if (mineIds[String(r.id) + ':' + r.setName]) {
          tr.className = 'mine';
          tr.setAttribute('data-mine', '1');
        }
        function td(text, cls) {
          var d = document.createElement('td');
          if (cls) d.className = cls;
          d.textContent = text;
          tr.appendChild(d);
        }
        td(r.name || '—');
        td(typeLabel(r.productType));
        td(r.provider || '—');
        td(trackLabel(r.track));
        td(pct(r.feeAcc), 'num');
        td(pct(r.feeDep), 'num');
        td(pct(r.y1), 'num');
        td(pct(r.ytd), 'num');
        td(pct(r.y3), 'num');
        td(pct(r.y5), 'num');
        td(pct(r.sharpe), 'num');
        td(pct(r.sd), 'num');
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      out.appendChild(tbl);
    }
    draw();
  }

  function boot(main) {
    if (!main) return;
    if (document.getElementById('funds-compare')) return;
    fetch('funds.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('funds.json HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      render(main, data);
    }).catch(function (err) {
      main.appendChild(h('div', { class: 'cmp-page', id: 'funds-compare' }, [
        h('div', { class: 'notice amber', text: 'מידע בלבד, לא ייעוץ.' }),
        h('p', { class: 'help', text: 'לא ניתן לטעון את קובץ הקרנות הרשמי כרגע. הנתונים לא הומצאו.' })
      ]));
      console.warn(err);
    });
  }

  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES[PAGE] = { title: ['compare_funds_title', 'compare_funds_sub'], render: function (main) { boot(main); } };
})();
