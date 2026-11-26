/* Per-track mortgage refinance check versus official Bank of Israel averages. */
(function () {
  'use strict';
  var PAGE = 'compare-mortgage';
  var TYPES = [
    { v: 't_prime', t: 'פריים' },
    { v: 't_fixed_unlinked', t: 'קבועה לא צמודה' },
    { v: 't_fixed_linked', t: 'קבועה צמודה למדד' },
    { v: 't_var_unlinked', t: 'משתנה לא צמודה' },
    { v: 't_var_linked', t: 'משתנה צמודה למדד' },
    { v: 't_other', t: 'אחר' }
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
  function money(v) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    var sign = Number(v) < 0 ? '−' : '';
    return sign + '₪' + Math.abs(Math.round(Number(v))).toLocaleString('en-US');
  }
  function pct(v) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    return (Math.round(Number(v) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }
  function typeLabel(v) {
    var hit = TYPES.filter(function (t) { return t.v === v; })[0];
    return hit ? hit.t : v;
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }
  function ensureCss() {
    if (document.querySelector('link[href="compare.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'compare.css'; document.head.appendChild(l);
  }
  function blankTrack() {
    return { id: uid('tr'), name: '', type: 't_fixed_unlinked', balance: '', rate: '', months: '', yearsHeld: 3, monthsToReset: 60, originationAveragePct: '', source: 'manual' };
  }
  function copyTrack(t) {
    return {
      id: t.id || uid('tr'),
      name: t.name || '',
      type: t.type || 't_fixed_unlinked',
      balance: t.balance,
      rate: t.rate,
      months: t.months,
      yearsHeld: t.yearsHeld == null ? 3 : t.yearsHeld,
      monthsToReset: t.monthsToReset == null ? 60 : t.monthsToReset,
      originationAveragePct: t.originationAveragePct,
      source: t.source || 'manual'
    };
  }

  function render(main, loanRates) {
    ensureCss();
    var Lib = window.CompareLib;
    var wrap = h('div', { class: 'cmp-page', id: 'mortgage-compare' });
    var tracks = [];
    var noticeGiven = true;
    var extraCosts = 0;
    var savedLoaded = false;

    if (window.CompareUx && window.CompareUx.hero) {
      wrap.appendChild(window.CompareUx.hero({
        id: 'mortgage-hero', actionId: 'mortgage-primary',
        lead: 'הזינו יתרה, ריבית וחודשים שנותרו לכל מסלול. מיד תראו כמה אפשר לחסוך לפי הממוצע במשק, בניכוי אומדן עמלת יציאה.',
        action: 'הזן מסלול והשווה לריבית במשק',
        onAction: function () {
          var box = document.getElementById('mortgage-tracks');
          if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
          var first = box && box.querySelector('input, select');
          if (first && first.focus) first.focus();
        }
      }));
    }
    wrap.appendChild(h('div', { class: 'notice amber', text: (loanRates && loanRates.disclaimer) || 'מידע בלבד, לא ייעוץ. הממוצעים אינם הצעה אישית ואינם מחליפים בדיקה בבנק.' }));
    wrap.appendChild(h('details', { class: 'card' }, [
      h('summary', { class: 'card-title', text: 'איך מחשבים את האומדן' }),
      h('p', { class: 'help', text: 'כל מסלול מושווה לממוצע בנק ישראל לפי הצמדה ולפי התקופה שנותרה. החיסכון המשוער הוא ההפרש בין יתרת התשלומים במסלול הנוכחי לבין יתרת התשלומים לפי הממוצע, בניכוי אומדן עמלת פירעון מוקדם לפי צו הבנקאות (עמלות פירעון מוקדם), תשס״ב־2002. זה אומדן בלבד: הריבית שתקבלו בפועל, עמלות נלוות ותנאי ההצמדה עשויים להיות שונים. במסלול פריים אין עמלת היוון. במסלול משתנה האומדן מחושב עד מועד השינוי הבא (ברירת מחדל: 60 חודשים) אם לא הוזן מועד אחר.' })
    ]));

    var src = h('div', { class: 'src-line' });
    var un = loanRates && loanRates.mortgageEarlyRepaymentAverages && loanRates.mortgageEarlyRepaymentAverages.unlinked;
    var cpi = loanRates && loanRates.mortgageEarlyRepaymentAverages && loanRates.mortgageEarlyRepaymentAverages.cpiIndexed;
    var pol = loanRates && loanRates.policyRate;
    if (un && un.source) src.appendChild(h('a', { href: un.source.file || un.source.url, target: '_blank', rel: 'noopener', text: un.source.label }));
    if (cpi && cpi.source) src.appendChild(h('a', { href: cpi.source.file || cpi.source.url, target: '_blank', rel: 'noopener', text: cpi.source.label }));
    if (pol && pol.source) src.appendChild(h('a', { href: pol.source.url, target: '_blank', rel: 'noopener', text: pol.source.label }));
    if (pol && pol.primePage) src.appendChild(h('a', { href: pol.primePage, target: '_blank', rel: 'noopener', text: 'בנק ישראל, ריבית הפריים' }));
    var stamps = [];
    if (un) stamps.push('לא צמוד: תקופה ' + (un.period || '') + (un.effectiveFrom ? ', בתוקף מ־' + un.effectiveFrom : ''));
    if (cpi) stamps.push('צמוד מדד: תקופה ' + (cpi.period || '') + (cpi.effectiveFrom ? ', בתוקף מ־' + cpi.effectiveFrom : ''));
    if (pol && pol.asOf) stamps.push('ריבית בנק ישראל ' + pct(pol.boiPolicyRatePct) + ' ליום ' + pol.asOf + (pol.typicalPrimePct != null ? ', פריים טיפוסי ' + pct(pol.typicalPrimePct) : ''));
    src.appendChild(h('span', { class: 'stamp', text: stamps.join(' · ') }));
    wrap.appendChild(src);

    var mineBox = h('div', { class: 'mine-box', id: 'mortgage-mine' });
    wrap.appendChild(mineBox);

    var form = h('div', { class: 'fields' });
    var noticeId = 'mortgage-notice';
    var noticeSel = h('select', { id: noticeId });
    noticeSel.appendChild(h('option', { value: 'yes', text: 'כן, ניתנה הודעה של 10 ימים' }));
    noticeSel.appendChild(h('option', { value: 'no', text: 'לא ניתנה הודעה' }));
    noticeSel.value = 'yes';
    noticeSel.addEventListener('change', function () { noticeGiven = noticeSel.value !== 'no'; drawResults(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: noticeId, text: 'הודעה מוקדמת' }), noticeSel]));
    var extraId = 'mortgage-extra';
    var extraInp = h('input', { type: 'number', id: extraId, min: '0', step: '100', value: '0' });
    extraInp.addEventListener('input', function () { extraCosts = Number(extraInp.value) || 0; drawResults(); });
    form.appendChild(h('div', { class: 'field' }, [h('label', { for: extraId, text: 'עלויות נוספות ידועות (₪), אם יש' }), extraInp]));
    if (window.CompareUx && window.CompareUx.filters) {
      var filt = window.CompareUx.filters({ id: 'mortgage-filters', buttonId: 'mortgage-filters-btn', label: 'הודעה מוקדמת ועלויות נוספות', form: form, open: !window.CompareUx.isNarrow() });
      filt.setAttribute('data-collapse', 'mobile');
      wrap.appendChild(filt);
    } else {
      wrap.appendChild(form);
    }

    var tracksWrap = h('div', { id: 'mortgage-tracks' });
    wrap.appendChild(tracksWrap);
    var out = h('div', { id: 'mortgage-results' });
    wrap.appendChild(out);
    main.appendChild(wrap);

    function loadSaved(replace) {
      var saved = Lib.readSavedMortgageTracks();
      if (replace) tracks = saved.map(copyTrack);
      else {
        saved.forEach(function (s) {
          var exists = tracks.some(function (t) { return t.source === 'saved' && t.name === s.name && Number(t.balance) === Number(s.balance); });
          if (!exists) tracks.push(copyTrack(s));
        });
      }
      savedLoaded = saved.length > 0;
      return saved;
    }

    function drawMine() {
      var saved = Lib.readSavedMortgageTracks();
      mineBox.innerHTML = '';
      mineBox.appendChild(h('h3', { text: 'המסלולים השמורים' }));
      var loadBtn = h('button', { type: 'button', class: 'cmp-toggle', id: 'mortgage-load-saved', text: 'טען מחדש את המסלולים השמורים' });
      loadBtn.addEventListener('click', function () { loadSaved(true); if (!tracks.length) tracks.push(blankTrack()); drawMine(); drawTracks(); drawResults(); });
      if (!saved.length) {
        mineBox.appendChild(h('p', { class: 'help', text: 'לא נשמרו מסלולי משכנתא בפורטל. אפשר להזין מסלולים ידנית למטה, או לשמור אותם בעמוד המשכנתא ואז לחזור לכאן. הנתונים נשמרים במכשיר בלבד.' }));
        mineBox.appendChild(h('p', { class: 'src-line' }, [h('a', { href: 'mortgage.html', text: 'לעמוד המשכנתא' })]));
      } else {
        mineBox.appendChild(h('p', { class: 'help', text: 'נמצאו ' + saved.length + ' מסלולים שמורים בפורטל.' }));
      }
      mineBox.appendChild(loadBtn);
    }

    function numField(tr, key, label, attrs) {
      var id = uid(key);
      var inp = h('input', Object.assign({ type: 'number', id: id }, attrs || {}));
      if (tr[key] != null && tr[key] !== '') inp.value = String(tr[key]);
      inp.addEventListener('input', function () {
        var v = inp.value;
        tr[key] = v === '' ? '' : Number(v);
        drawResults();
      });
      return h('div', { class: 'field' }, [h('label', { for: id, text: label }), inp]);
    }

    function drawTracks() {
      tracksWrap.innerHTML = '';
      tracks.forEach(function (tr, idx) {
        var box = h('div', { class: 'track-card' });
        box.appendChild(h('h3', { text: tr.name || ('מסלול ' + (idx + 1)) }));
        var fields = h('div', { class: 'fields' });
        var nid = uid('name');
        var nin = h('input', { type: 'text', id: nid, value: tr.name || '' });
        nin.addEventListener('input', function () { tr.name = nin.value; });
        fields.appendChild(h('div', { class: 'field' }, [h('label', { for: nid, text: 'שם המסלול' }), nin]));
        var tid = uid('type');
        var sel = h('select', { id: tid });
        TYPES.forEach(function (t) { sel.appendChild(h('option', { value: t.v, text: t.t })); });
        sel.value = tr.type;
        sel.addEventListener('change', function () { tr.type = sel.value; drawTracks(); drawResults(); });
        fields.appendChild(h('div', { class: 'field' }, [h('label', { for: tid, text: 'סוג מסלול' }), sel]));
        fields.appendChild(numField(tr, 'balance', 'יתרה (₪)', { min: '0', step: '1000' }));
        fields.appendChild(numField(tr, 'rate', 'ריבית נומינלית שנתית (%)', { min: '0', step: '0.01' }));
        fields.appendChild(numField(tr, 'months', 'חודשים שנותרו', { min: '1', step: '1' }));
        fields.appendChild(numField(tr, 'yearsHeld', 'שנים מאז לקיחת המסלול', { min: '0', step: '0.5' }));
        if (tr.type === 't_var_linked' || tr.type === 't_var_unlinked') {
          fields.appendChild(numField(tr, 'monthsToReset', 'חודשים עד שינוי הריבית הבא', { min: '1', step: '1' }));
        }
        var del = h('button', { type: 'button', class: 'cmp-toggle', text: 'הסר מסלול' });
        del.addEventListener('click', function () {
          tracks = tracks.filter(function (x) { return x.id !== tr.id; });
          drawTracks();
          drawResults();
        });
        box.appendChild(fields);
        box.appendChild(del);
        tracksWrap.appendChild(box);
      });
      var add = h('button', { type: 'button', class: 'cmp-toggle', id: 'mortgage-add-track', text: 'הוסף מסלול' });
      add.addEventListener('click', function () { tracks.push(blankTrack()); drawTracks(); drawResults(); });
      tracksWrap.appendChild(add);
    }

    function drawResults() {
      out.innerHTML = '';
      var ready = tracks.filter(function (t) { return Number(t.balance) > 0 && Number(t.months) > 0 && t.rate !== '' && t.rate != null; });
      if (!ready.length) {
        out.appendChild(h('div', { class: 'cmp-empty card', id: 'mortgage-empty' }, [
          h('p', { class: 'empty', text: tracks.length ? 'יש להזין יתרה, ריבית וחודשים שנותרו כדי לחשב אומדן לכל מסלול.' : 'אין מסלולים להשוואה. הוסיפו מסלול ידנית או טענו מסלולים שמורים.' }),
          h('button', { type: 'button', class: 'btn btn-primary', id: 'mortgage-empty-action', text: 'הוסיפו מסלול', onclick: function () {
            if (!tracks.length) { tracks.push(blankTrack()); drawTracks(); }
            var box = document.getElementById('mortgage-tracks');
            if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var first = box && box.querySelector('input[type=number], input[type=text]');
            if (first && first.focus) first.focus();
          } })
        ]));
        return;
      }
      var summaries = [];
      var tbl = document.createElement('table');
      tbl.className = 'cmp data';
      var cap = document.createElement('caption');
      cap.className = 'sr-only';
      cap.textContent = 'השוואת מסלולי משכנתא לממוצעי בנק ישראל';
      tbl.appendChild(cap);
      var thead = document.createElement('thead'), hr = document.createElement('tr');
      ['מסלול', 'סוג', 'יתרה', 'הריבית שלכם', 'חודשים שנותרו', 'ריבית ממוצעת במשק', 'תשלום היום', 'תשלום לפי הממוצע', 'כמה חוסכים בחודש', 'עמלת יציאה משוערת', 'כמה נשאר אחרי עמלה'].forEach(function (label) {
        var th = document.createElement('th'); th.scope = 'col'; th.textContent = label; hr.appendChild(th);
      });
      thead.appendChild(hr); tbl.appendChild(thead);
      var tb = document.createElement('tbody');
      var cards = h('div', { class: 'track-grid', id: 'mortgage-cards' });
      ready.forEach(function (tr, idx) {
        var cmp = Lib.refinanceTrack({
          name: tr.name,
          type: tr.type,
          balance: Number(tr.balance),
          rate: Number(tr.rate),
          months: Number(tr.months),
          yearsHeld: tr.yearsHeld === '' || tr.yearsHeld == null ? 0 : Number(tr.yearsHeld),
          monthsToReset: tr.monthsToReset === '' ? null : tr.monthsToReset,
          originationAveragePct: tr.originationAveragePct === '' ? null : tr.originationAveragePct
        }, loanRates, { noticeGiven: noticeGiven, extraCosts: extraCosts });
        var row = document.createElement('tr');
        function td(text, cls) {
          var d = document.createElement('td');
          if (cls) d.className = cls;
          d.textContent = text;
          row.appendChild(d);
        }
        var name = tr.name || ('מסלול ' + (idx + 1));
        td(name);
        td(typeLabel(tr.type));
        td(money(Number(tr.balance)), 'num');
        td(pct(Number(tr.rate)), 'num');
        td(String(Math.round(Number(tr.months))), 'num');
        if (!cmp || cmp.marketPct == null) {
          td('לא פורסם ממוצע מתאים');
          td(cmp && cmp.current ? money(cmp.current.pmt) : '—', 'num');
          td('—', 'num'); td('—', 'num'); td('—', 'num'); td('—', 'num');
        } else {
          var monthlySave = cmp.current.pmt - cmp.newPmt;
          td((cmp.marketLabel || '') + ' · ' + pct(cmp.marketPct), 'num');
          td(money(cmp.current.pmt), 'num');
          td(money(cmp.newPmt), 'num');
          td(money(monthlySave), 'num');
          td(cmp.fee ? money(cmp.fee.total) : '—', 'num');
          td(money(cmp.netSaving), 'num ' + (cmp.netSaving >= 0 ? 'saving-pos' : 'saving-neg'));
        }
        tb.appendChild(row);
        summaries.push({
          name: name,
          type: typeLabel(tr.type),
          cmp: cmp,
          monthly: (cmp && cmp.marketPct != null) ? (cmp.current.pmt - cmp.newPmt) : null,
          net: cmp && cmp.netSaving
        });

        var card = h('div', { class: 'track-card' });
        card.appendChild(h('h3', { text: name + ' · ' + typeLabel(tr.type) }));
        var kv = h('div', { class: 'kv' });
        function addkv(k, v) { kv.appendChild(h('span', { text: k })); kv.appendChild(h('span', { text: v })); }
        addkv('יתרה', money(Number(tr.balance)));
        addkv('ריבית נוכחית (נומינלית)', pct(Number(tr.rate)));
        if (cmp && cmp.marketPct != null) {
          addkv('ממוצע להשוואה', pct(cmp.marketPct));
          kv.appendChild(h('span', { text: 'בסיס הממוצע' }));
          kv.appendChild(h('span', { text: cmp.marketLabel || '—' }));
          addkv('תשלום נוכחי משוער', money(cmp.current.pmt));
          addkv('תשלום לפי הממוצע', money(cmp.newPmt));
          addkv('חיסכון חודשי משוער', money(cmp.current.pmt - cmp.newPmt));
          addkv('עמלת היוון משוערת', cmp.fee ? money(cmp.fee.capitalization) : '—');
          addkv('עמלה תפעולית', cmp.fee ? money(cmp.fee.operational) : '—');
          addkv('תוספת בהיעדר הודעה', cmp.fee ? money(cmp.fee.noNotice) : '—');
          addkv('סה״כ עמלת פירעון מוקדם', cmp.fee ? money(cmp.fee.total) : '—');
          if (extraCosts) addkv('עלויות נוספות שהוזנו', money(extraCosts));
          addkv('חיסכון ברוטו ליתרת התקופה', money(cmp.grossSaving));
          addkv('חיסכון נטו משוער', money(cmp.netSaving));
        } else {
          kv.appendChild(h('span', { text: 'ממוצע' }));
          kv.appendChild(h('span', { text: 'לא פורסם ממוצע מתאים למסלול זה' }));
        }
        card.appendChild(kv);
        if (cmp && cmp.fee && cmp.fee.notes && cmp.fee.notes.length) {
          cmp.fee.notes.forEach(function (n) { card.appendChild(h('p', { class: 'help', text: n })); });
        }
        if (cmp && cmp.marketNote) card.appendChild(h('p', { class: 'help', text: cmp.marketNote }));
        if (cmp && cmp.estimate) card.appendChild(h('p', { class: 'help', text: 'אומדן בלבד, מידע בלבד, לא ייעוץ.' }));
        cards.appendChild(card);
      });
      tbl.appendChild(tb);
      var ranked = summaries.slice().sort(function (a, b) {
        var na = a.net == null ? -Infinity : a.net, nb = b.net == null ? -Infinity : b.net;
        return nb - na;
      }).slice(0, 3);
      if (window.CompareUx && window.CompareUx.top3) {
        out.appendChild(window.CompareUx.top3(ranked.map(function (s) {
          return {
            title: s.name + ' · ' + s.type,
            value: s.net == null ? 'אין ממוצע מתאים' : money(s.net),
            valueClass: s.net == null ? '' : (s.net >= 0 ? 'pos' : 'neg'),
            sub: s.monthly == null ? 'לא פורסם ממוצע מתאים למסלול זה.' : ('חיסכון חודשי משוער: ' + money(s.monthly)),
            note: 'חיסכון נטו משוער ליתרת התקופה, אחרי אומדן עמלת יציאה.'
          };
        }), { id: 'mortgage-top3', title: 'המסלולים עם החיסכון המשוער הגבוה ביותר' }));
      }
      var tw = h('div', { class: 'tbl-wrap' }, [tbl, h('p', { class: 'cmp-scroll-hint help', text: 'אפשר לגלול את הטבלה הצידה כדי לראות את כל העמודות.' })]);
      out.appendChild(tw);
      out.appendChild(cards);
    }

    var saved = loadSaved(true);
    if (!tracks.length) tracks.push(blankTrack());
    drawMine();
    drawTracks();
    drawResults();
  }

  function boot(main) {
    if (!main) return;
    if (document.getElementById('mortgage-compare')) return;
    ensureCss();
    var shell = h('div', { class: 'cmp-page', id: 'mortgage-compare' });
    if (window.CompareUx && window.CompareUx.hero) {
      shell.appendChild(window.CompareUx.hero({ lead: 'הזינו מסלול והשוו לריבית הממוצעת במשק, כולל אומדן עמלת יציאה.', action: 'טוענים…', actionId: 'mortgage-primary' }));
      shell.appendChild(window.CompareUx.skeleton('טוענים את ממוצעי בנק ישראל…'));
    }
    main.appendChild(shell);
    function go() {
      var load = (window.CompareUx && window.CompareUx.fetchJson)
        ? window.CompareUx.fetchJson('data/loan-rates.json')
        : fetch('data/loan-rates.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('loan-rates'); return r.json(); });
      load.then(function (data) {
        if (shell.parentNode) shell.parentNode.removeChild(shell);
        render(main, data);
      }).catch(function (err) {
        shell.innerHTML = '';
        shell.appendChild(h('div', { class: 'notice amber', text: 'מידע בלבד, לא ייעוץ.' }));
        shell.appendChild(h('p', { class: 'help', text: 'לא ניתן לטעון את ממוצעי בנק ישראל כרגע. הנתונים לא הומצאו.' }));
        console.warn(err);
      });
    }
    if (window.CompareUx && window.CompareUx.afterPaint) window.CompareUx.afterPaint(go);
    else go();
  }

  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES[PAGE] = { title: ['compare_mortgage_title', 'compare_mortgage_sub'], render: function (main) { boot(main); } };
})();
