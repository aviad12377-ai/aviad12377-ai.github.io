/* Pension, gemel, hishtalmut and policy comparison from official CMA funds.json. */
(function () {
  'use strict';
  var PAGE = 'compare-funds';
  var LIMIT = 20;
  var TYPE_LABELS = {
    pension: 'פנסיה מקיפה', pension_general: 'פנסיה כללית', gemel: 'גמל / תגמולים',
    gemel_invest: 'גמל להשקעה', gemel_child: 'חיסכון לכל ילד', hishtalmut: 'השתלמות',
    policy: 'פוליסת חיסכון', gemel_other: 'גמל, אחר', other: 'אחר'
  };
  var TRACK_LABELS = {
    sp500: 'S&P 500', halacha: 'הלכה', cash: 'כספי / שקלי', age: 'לפי גיל',
    bonds: 'אג"ח', equity: 'מניות', general: 'כללי', index: 'מדד', other: 'אחר'
  };
  var SOURCE_LINKS = [
    { href: 'https://gemelnet.cma.gov.il/', text: 'גמלנט, רשות שוק ההון' },
    { href: 'https://pensyanet.cma.gov.il/', text: 'פנסיהנט, רשות שוק ההון' },
    { href: 'https://bituachnet.cma.gov.il/', text: 'ביטוחנט, רשות שוק ההון' },
    { href: 'https://data.gov.il/dataset/a30dcbea-a1d2-482c-ae29-8f781f5025fb', text: 'data.gov.il, גמלנט (משאב רשמי)' },
    { href: 'https://data.gov.il/dataset/6d47d6b5-cb08-488b-b333-f1e717b1e1bd', text: 'data.gov.il, פנסיהנט (משאב רשמי)' },
    { href: 'https://data.gov.il/dataset/c6c62cc7-fe02-4b18-8f3e-813abfbb4647', text: 'data.gov.il, ביטוחנט (משאב רשמי)' }
  ];
  function U() { return window.CompareUx; }
  function h(tag, attrs, kids) { return U().h(tag, attrs, kids); }
  function typeLabel(k) { return TYPE_LABELS[k] || k; }
  function trackLabel(k) { return TRACK_LABELS[k] || k; }
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

  function fill(wrap, payload) {
    var Lib = window.CompareLib;
    var rows = Lib.flattenFunds(payload);
    var filters = { productType: '', track: '', q: '' };
    var sortKey = 'y5', sortDir = -1, showAll = false, onlyMine = false;

    wrap.appendChild(h('div', { class: 'notice amber', text: 'מידע בלבד, לא ייעוץ. התשואות ודמי הניהול הם נתונים רשמיים שפורסמו, לא תחזית ולא הצעה אישית.' }));

    var src = h('div', { class: 'src-line' });
    SOURCE_LINKS.forEach(function (s) { src.appendChild(h('a', { href: s.href, target: '_blank', rel: 'noopener', text: s.text })); });
    var period = (payload.sets && payload.sets.pensianet && payload.sets.pensianet.period) ||
      (payload.sets && payload.sets.gemelnet && payload.sets.gemelnet.period) || '';
    src.appendChild(h('span', { class: 'stamp', text: 'תקופה: ' + periodHe(period) + (payload.generatedAt ? ' · עודכן במקור ב־' + israelStamp(payload.generatedAt) : '') }));
    wrap.appendChild(src);

    var mineBox = h('div', { class: 'mine-box', id: 'fund-mine' });
    wrap.appendChild(mineBox);

    var form = h('div', { class: 'fields' });
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
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: 'fund-track', text: 'מסלול השקעה' }), trackSel]));
    var qInp = h('input', { type: 'search', id: 'fund-q', placeholder: 'לדוגמה: מיטב או S&P' });
    qInp.addEventListener('input', function () { filters.q = qInp.value; draw(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: 'fund-q', text: 'חיפוש לפי שם או חברה' }), qInp]));

    var filt = U().filters({ id: 'fund-filters', buttonId: 'fund-filters-btn', label: 'סינון לפי סוג ומסלול', form: form, open: !U().isNarrow() });
    filt.setAttribute('data-collapse', 'mobile');

    var hero = wrap.querySelector('.cmp-hero');
    if (!hero) {
      hero = U().hero({
        id: 'fund-hero', actionId: 'fund-primary',
        lead: 'בחרו סוג מוצר ומסלול כדי לראות את שלוש הקרנות עם התשואה הגבוהה ביותר ל־5 שנים. עמודת 12 החודשים היא חיבור תשואות חודשיות רשמיות, לא תשואה שנתית מפורסמת.',
        action: 'סנן לפי סוג ומסלול וקבל את 3 המובילים',
        onAction: function () { U().openFilters(filt); U().scrollTo('fund-top3'); }
      });
      wrap.insertBefore(hero, wrap.firstChild);
    } else {
      var btn = hero.querySelector('#fund-primary');
      if (btn) {
        btn.textContent = 'סנן לפי סוג ומסלול וקבל את 3 המובילים';
        btn.addEventListener('click', function () { U().openFilters(filt); U().scrollTo('fund-top3'); });
      }
    }
    wrap.appendChild(filt);
    wrap.appendChild(h('p', { class: 'help', text: 'עמודת 12 החודשים היא חיבור של 12 תשואות חודשיות רשמיות רצופות שפורסמו לאחרונה. כשאין 12 חודשים רצופים מוצג מקף. תשואות 3 ו־5 שנים, דמי הניהול, שארפ ותנודתיות לקוחים מהפרסום הרשמי. תשואה מתחילת שנה היא השדה הרשמי, ולא תשואה ל־12 חודשים.' }));
    var out = h('div');
    wrap.appendChild(out);

    var cols = [
      { key: 'name', label: 'שם המסלול', sortable: true },
      { key: 'productType', label: 'סוג מוצר', sortable: true },
      { key: 'provider', label: 'החברה', sortable: true },
      { key: 'track', label: 'אפיק השקעה', sortable: true },
      { key: 'feeAcc', label: 'דמי ניהול מהחיסכון', num: true, sortable: true, tip: 'דמי ניהול שנתיים מהיתרה, כפי שפורסמו. מקף אם לא פורסם.' },
      { key: 'feeDep', label: 'דמי ניהול מההפקדה', num: true, sortable: true, tip: 'דמי ניהול מההפקדות. בחלק מפוליסות החיסכון הנתון לא מפורסם.' },
      { key: 'y1', label: '12 חודשים', num: true, sortable: true, tip: 'חיבור 12 תשואות חודשיות רשמיות רצופות. לא תשואה שנתית מפורסמת כשלעצמה.' },
      { key: 'ytd', label: 'מתחילת השנה', num: true, sortable: true, tip: 'התשואה הרשמית מתחילת השנה (YTD), לא תשואה ל־12 חודשים.' },
      { key: 'y3', label: 'ממוצע 3 שנים', num: true, sortable: true, tip: 'תשואה שנתית ממוצעת ל־3 שנים, כפי שפורסמה.' },
      { key: 'y5', label: 'ממוצע 5 שנים', num: true, sortable: true, tip: 'תשואה שנתית ממוצעת ל־5 שנים, כפי שפורסמה. זה המיון כברירת מחדל.' },
      { key: 'sharpe', label: 'מדד שארפ', num: true, sortable: true, tip: 'מדד תשואה מול סיכון כפי שפורסם. מספר גבוה יותר פירושו תשואה טובה יותר ביחס לתנודתיות, בנתונים שפורסמו בלבד.' },
      { key: 'sd', label: 'תנודתיות', num: true, sortable: true, tip: 'סטיית תקן שפורסמה. מספר גבוה יותר פירושו תנודות חזקות יותר.' }
    ];

    function mineMatches(saved) {
      return (saved || []).map(function (s) { return { saved: s, row: Lib.matchSavedFund(s, rows) }; });
    }
    function onSort(key) {
      if (sortKey === key) sortDir = -sortDir;
      else { sortKey = key; sortDir = (key === 'name' || key === 'provider' || key === 'productType' || key === 'track') ? 1 : -1; }
      draw();
    }

    function toRow(r, mineIds) {
      return {
        title: r.name || '—',
        value: U().pct(r.y5),
        mine: !!mineIds[String(r.id) + ':' + r.setName],
        fields: [
          { k: 'סוג מוצר', v: typeLabel(r.productType) },
          { k: 'החברה', v: r.provider || '—' },
          { k: 'אפיק השקעה', v: trackLabel(r.track) },
          { k: 'דמי ניהול מהחיסכון', v: U().pct(r.feeAcc) },
          { k: 'דמי ניהול מההפקדה', v: U().pct(r.feeDep) },
          { k: '12 חודשים', v: U().pct(r.y1) },
          { k: 'מתחילת השנה', v: U().pct(r.ytd) },
          { k: 'ממוצע 3 שנים', v: U().pct(r.y3) },
          { k: 'מדד שארפ', v: U().pct(r.sharpe) },
          { k: 'תנודתיות', v: U().pct(r.sd) }
        ],
        cells: [
          r.name || '—', typeLabel(r.productType), r.provider || '—', trackLabel(r.track),
          { text: U().pct(r.feeAcc), num: true }, { text: U().pct(r.feeDep), num: true },
          { text: U().pct(r.y1), num: true }, { text: U().pct(r.ytd), num: true },
          { text: U().pct(r.y3), num: true }, { text: U().pct(r.y5), num: true },
          { text: U().pct(r.sharpe), num: true }, { text: U().pct(r.sd), num: true }
        ]
      };
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
      } else {
        matches.forEach(function (m) {
          var item = h('div', { class: 'mine-item' });
          var title = (m.saved.name || m.saved.trackName || 'מסלול שמור') + (m.saved.kind === 'hishtalmut' ? ' (השתלמות)' : m.saved.kind === 'pension' ? ' (פנסיה)' : '');
          item.appendChild(h('strong', { text: title }));
          if (m.row) {
            item.appendChild(document.createTextNode(' — התאמה בנתונים הרשמיים: ' + m.row.name + '. '));
            item.appendChild(document.createTextNode('12 חודשים ' + U().pct(m.row.y1) + ', ממוצע 3 שנים ' + U().pct(m.row.y3) + ', ממוצע 5 שנים ' + U().pct(m.row.y5) + ', דמי ניהול מהחיסכון ' + U().pct(m.row.feeAcc) + ', מההפקדה ' + U().pct(m.row.feeDep) + '.'));
          } else {
            item.appendChild(document.createTextNode(' — לא נמצאה התאמה בנתונים הרשמיים לפי השם או המזהה שנשמרו.'));
          }
          mineBox.appendChild(item);
        });
      }
      mineBox.appendChild(loadBtn);

      var list = Lib.filterFunds(rows, filters);
      if (onlyMine) list = list.filter(function (r) { return mineIds[String(r.id) + ':' + r.setName]; });
      var sorted = Lib.sortFunds(list, sortKey, sortDir);
      var total = sorted.length;
      var limited = !showAll && total > LIMIT;
      var shown = limited ? sorted.slice(0, LIMIT) : sorted;

      out.innerHTML = '';
      var topItems = shown.slice(0, 3).map(function (r) {
        return {
          title: r.name,
          value: U().pct(r[sortKey] != null && (sortKey === 'y5' || sortKey === 'y3' || sortKey === 'y1' || sortKey === 'ytd') ? r[sortKey] : r.y5),
          sub: (r.provider || '') + ' · ' + typeLabel(r.productType) + ' · ' + trackLabel(r.track) + ' · ממוצע 5 שנים ' + U().pct(r.y5),
          note: 'דמי ניהול מהחיסכון ' + U().pct(r.feeAcc),
          mine: !!mineIds[String(r.id) + ':' + r.setName]
        };
      });
      out.appendChild(U().top3(topItems, { id: 'fund-top3', title: 'שלושת המסלולים המובילים עבורכם', empty: 'אין מסלולים לפי הסינון שנבחר.' }));

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
      if (!shown.length) {
        out.appendChild(U().empty('אין תוצאות לפי הסינון. נסו סוג או מסלול אחר.', 'שנו את הסינון', function () { U().openFilters(filt); }, 'fund-empty-action'));
        return;
      }
      out.appendChild(U().results(cols, shown.map(function (r) { return toRow(r, mineIds); }), {
        caption: 'השוואת מסלולי פנסיה, גמל, השתלמות ופוליסות',
        empty: 'אין תוצאות לפי הסינון.',
        sortKey: sortKey, sortDir: sortDir, onSort: onSort
      }));
    }
    draw();
  }

  function boot(main) {
    if (!main) return;
    if (document.getElementById('funds-compare')) return;
    U().ensureCss();
    var wrap = h('div', { class: 'cmp-page', id: 'funds-compare' });
    wrap.appendChild(U().hero({
      id: 'fund-hero', actionId: 'fund-primary',
      lead: 'בחרו סוג מוצר ומסלול כדי לראות את שלוש הקרנות עם התשואה הגבוהה ביותר ל־5 שנים.',
      action: 'טוענים את הנתונים הרשמיים…'
    }));
    var skel = U().skeleton('טוענים את נתוני הקרנות הרשמיים. הקובץ גדול, זה עשוי לקחת רגע.');
    skel.id = 'funds-skel';
    wrap.appendChild(skel);
    main.appendChild(wrap);
    U().afterPaint(function () {
      U().fetchJson('funds.json').then(function (data) {
        if (skel.parentNode) skel.parentNode.removeChild(skel);
        fill(wrap, data);
      }).catch(function (err) {
        if (skel.parentNode) skel.parentNode.removeChild(skel);
        wrap.appendChild(h('div', { class: 'notice amber', text: 'מידע בלבד, לא ייעוץ.' }));
        wrap.appendChild(h('p', { class: 'help', text: 'לא ניתן לטעון את קובץ הקרנות הרשמי כרגע. הנתונים לא הומצאו.' }));
        console.warn(err);
      });
    });
  }

  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES[PAGE] = { title: ['compare_funds_title', 'compare_funds_sub'], render: function (main) { boot(main); } };
})();
