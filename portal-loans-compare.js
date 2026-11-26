/* Extends loans.html: amortization upload (client-side only) and refinance vs official market averages. */
(function () {
  'use strict';
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
    if (v == null || !Number.isFinite(v)) return '—';
    var sign = v < 0 ? '−' : '';
    return sign + '₪' + Math.abs(Math.round(v)).toLocaleString('en-US');
  }
  function pct(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    return (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }
  function ensureCss() {
    if (document.querySelector('link[href="compare.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'compare.css'; document.head.appendChild(l);
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'vendor/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  var TRACKS = [
    { v: 't_prime', t: 'פריים' },
    { v: 't_fixed_unlinked', t: 'קבועה לא צמודה' },
    { v: 't_fixed_linked', t: 'קבועה צמודה למדד' },
    { v: 't_var_unlinked', t: 'משתנה כל 5 שנים, לא צמודה' },
    { v: 't_var_linked', t: 'משתנה כל 5 שנים, צמודה למדד' },
    { v: 't_consumer', t: 'הלוואה שאינה לדיור' },
    { v: 't_other', t: 'אחר' }
  ];
  function trackLabel(v) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].v === v) return TRACKS[i].t; return v; }

  function emptyTrack() {
    return { id: uid('tr'), name: '', type: 't_fixed_unlinked', balance: 400000, rate: 5, months: 240, payment: null, yearsHeld: 3, monthsToReset: 60, originationAveragePct: null };
  }

  function render(main, rates) {
    ensureCss();
    var wrap = h('div', { class: 'cmp-page', id: 'loans-compare' });
    var tracks = [];
    var parsed = null;
    var noticeOk = true, extraCosts = 0, expectedCpi = 0;

    wrap.appendChild(h('div', { class: 'notice amber', text: 'מידע בלבד, לא ייעוץ. כל חישוב מחזור ועמלת פירעון מוקדם הוא הערכה לפי כללי בנק ישראל וממוצעים מפורסמים, לא אישור של הבנק.' }));

    /* ---- upload ---- */
    var fileId = uid('file'), pasteId = uid('paste');
    var fileInp = h('input', { type: 'file', id: fileId, accept: '.csv,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf' });
    var paste = h('textarea', { id: pasteId, rows: '6', 'aria-describedby': 'sched-help' });
    paste.placeholder = 'אפשר גם להדביק כאן טבלה מהלוח סילוקין';
    var parseMsg = h('p', { class: 'help', id: 'parse-msg' });
    wrap.appendChild(h('div', { class: 'card' }, [
      h('h3', { class: 'card-title', text: 'העלאת לוח סילוקין' }),
      h('p', { class: 'help', id: 'sched-help', text: 'הקובץ מעובד רק במכשיר שלכם ולא נשלח לשום שרת. מתאימים קבצי CSV, אקסל, טקסט, או PDF פשוט. אפשר גם קובץ דוגמה מסומן FAKE.' }),
      h('div', { class: 'field' }, [h('label', { for: fileId, text: 'בחירת קובץ לוח סילוקין' }), fileInp]),
      h('div', { class: 'field' }, [h('label', { for: pasteId, text: 'הדבקת טבלה' }), paste]),
      h('div', { class: 'toolbar' }, [
        h('button', { type: 'button', class: 'btn', text: 'פענוח הטבלה המוזנת', onclick: function () { ingestText(paste.value); } }),
        h('a', { class: 'btn btn-soft', href: 'samples/amortization-sample-FAKE.csv', download: 'amortization-sample-FAKE.csv', text: 'קובץ דוגמה' })
      ]),
      parseMsg
    ]));
    fileInp.addEventListener('change', function () {
      var f = fileInp.files && fileInp.files[0];
      if (!f) return;
      var name = (f.name || '').toLowerCase();
      if (name.indexOf('.xlsx') >= 0 || name.indexOf('.xls') >= 0) {
        loadXlsx().then(function () {
          var reader = new FileReader();
          reader.onload = function () {
            try {
              var wb = window.XLSX.read(new Uint8Array(reader.result), { type: 'array' });
              var sheet = wb.Sheets[wb.SheetNames[0]];
              var matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
              applyParsed(window.CompareLib.rowsToSchedule(matrix), f.name);
            } catch (e) { parseMsg.textContent = 'לא הצלחתי לקרוא את קובץ האקסל.'; }
          };
          reader.readAsArrayBuffer(f);
        }).catch(function () { parseMsg.textContent = 'לא ניתן לטעון את קורא האקסל.'; });
      } else if (name.indexOf('.pdf') >= 0) {
        var reader = new FileReader();
        reader.onload = function () {
          var got = window.CompareLib.extractPdfText(reader.result);
          if (got.error === 'compressed' || !got.text) {
            parseMsg.textContent = 'ה־PDF דחוס או לא ניתן לחילוץ במכשיר. העתיקו את הטבלה או השתמשו בקובץ CSV.';
            return;
          }
          ingestText(got.text);
        };
        reader.readAsArrayBuffer(f);
      } else {
        var reader = new FileReader();
        reader.onload = function () { ingestText(String(reader.result || '')); };
        reader.readAsText(f);
      }
    });

    function ingestText(text) {
      applyParsed(window.CompareLib.parseAmortizationMatrixOrText(text), 'טקסט');
    }
    function applyParsed(res, from) {
      parsed = res;
      if (!res || res.error === 'empty' || !res.rows.length) {
        parseMsg.textContent = 'לא נמצאו שורות בלוח. בדקו שיש כותרות כמו יתרת קרן, תשלום וריבית.';
        return;
      }
      var left = res.rows.filter(function (r) { return nPos(r.balance); });
      var remainingInterest = 0;
      left.forEach(function (r) { remainingInterest += Number(r.interest) || 0; });
      /* if the file is a full history, remaining interest should be from the current row onward — use last balance and future interest if present */
      var last = res.lastRow;
      parseMsg.textContent = 'נקראו ' + res.rows.length + ' שורות מ' + from + '. יתרה אחרונה: ' + money(res.remainingBalance) + '. הקובץ לא הועלה לשרת.';
      if (last && last.balance != null) {
        var t = emptyTrack();
        t.name = 'מלוח סילוקין';
        t.balance = last.balance;
        var future = [];
        var seen = false;
        res.rows.forEach(function (r) {
          if (r === last) seen = true;
          if (seen) future.push(r);
        });
        if (future.length > 1) t.months = future.length;
        if (last.payment) t.payment = last.payment;
        if (t.payment && t.balance && t.months) t.rate = window.CompareLib.round(window.CompareLib.impliedNominalRate(t.balance, t.payment, t.months), 3);
        tracks.push(t);
        drawTracks();
        drawCompare();
      }
    }
    function nPos(v) { return v != null && Number(v) > 0; }

    /* ---- manual tracks ---- */
    var trackBox = h('div');
    wrap.appendChild(h('div', { class: 'card' }, [
      h('h3', { class: 'card-title', text: 'מסלולים להשוואה' }),
      h('p', { class: 'help', text: 'אפשר להוסיף מסלול ידנית, כמו במשכנתא: פריים, קבועה לא צמודה, קבועה צמודה, משתנה כל חמש שנים, או הלוואה שאינה לדיור.' }),
      trackBox,
      h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-primary', text: 'הוספת מסלול', onclick: function () { tracks.push(emptyTrack()); drawTracks(); drawCompare(); } })])
    ]));

    /* pull existing mortgage / loans once */
    try {
      var data = window.Portal && window.Portal.data;
      if (data && data.mortgage && data.mortgage.tracks) {
        data.mortgage.tracks.forEach(function (r) {
          if (!(Number(r.balance) > 0)) return;
          tracks.push({
            id: uid('ex'), name: r.name || 'ממשכנתא', type: r.type || 't_prime',
            balance: Number(r.balance) || 0, rate: Number(r.rate) || 0, months: Number(r.months) || 0,
            payment: r.payment != null ? Number(r.payment) : null, yearsHeld: 3, monthsToReset: 60, originationAveragePct: null
          });
        });
      }
      if (data && data.home && data.home.loans) {
        data.home.loans.forEach(function (r) {
          if (!(Number(r.balance) > 0)) return;
          tracks.push({
            id: uid('ln'), name: r.name || 'הלוואה', type: 't_consumer',
            balance: Number(r.balance) || 0, rate: Number(r.rate) || 0, months: Number(r.months) || Number(r.term) || 0,
            payment: r.payment != null ? Number(r.payment) : null, yearsHeld: 2, monthsToReset: null, originationAveragePct: null
          });
        });
      }
    } catch (e) {}

    function fieldNum(obj, key, label, step) {
      var id = uid(key);
      var inp = h('input', { type: 'number', id: id, step: step || '0.01', value: obj[key] == null ? '' : String(obj[key]) });
      inp.addEventListener('input', function () { var v = inp.value; obj[key] = v === '' ? null : Number(v); drawCompare(); });
      return h('div', { class: 'field' }, [h('label', { for: id, text: label }), inp]);
    }
    function drawTracks() {
      trackBox.innerHTML = '';
      if (!tracks.length) trackBox.appendChild(h('p', { class: 'empty', text: 'אין עדיין מסלולים. הוסיפו מסלול או העלו לוח סילוקין.' }));
      tracks.forEach(function (tr, idx) {
        var idN = uid('nm'), idT = uid('tp');
        var name = h('input', { type: 'text', id: idN, value: tr.name || '' });
        name.addEventListener('input', function () { tr.name = name.value; });
        var sel = h('select', { id: idT });
        TRACKS.forEach(function (o) { sel.appendChild(h('option', { value: o.v, text: o.t, selected: o.v === tr.type })); });
        sel.addEventListener('change', function () { tr.type = sel.value; drawCompare(); });
        var del = h('button', { type: 'button', class: 'btn btn-danger', text: 'הסרה', onclick: function () { tracks.splice(idx, 1); drawTracks(); drawCompare(); } });
        trackBox.appendChild(h('div', { class: 'row-card' }, [
          h('div', { class: 'fields' }, [
            h('div', { class: 'field' }, [h('label', { for: idN, text: 'שם המסלול' }), name]),
            h('div', { class: 'field' }, [h('label', { for: idT, text: 'סוג מסלול' }), sel]),
            fieldNum(tr, 'balance', 'יתרה (₪)', '1000'),
            fieldNum(tr, 'rate', 'ריבית שנתית נומינלית (%)', '0.01'),
            fieldNum(tr, 'months', 'חודשים שנותרו', '1'),
            fieldNum(tr, 'payment', 'החזר חודשי (אם ידוע)', '1'),
            fieldNum(tr, 'yearsHeld', 'שנים מאז לקיחת המסלול', '0.1'),
            fieldNum(tr, 'monthsToReset', 'חודשים עד שינוי הריבית (אם רלוונטי)', '1'),
            fieldNum(tr, 'originationAveragePct', 'ממוצע בנק ישראל במועד לקיחת ההלוואה (%)', '0.01')
          ]),
          h('div', { class: 'row-actions' }, [del])
        ]));
      });
    }

    /* ---- options + results ---- */
    var resBox = h('div');
    var nid = uid('notice'), eid = uid('extra'), cid = uid('cpi');
    var nchk = h('input', { type: 'checkbox', id: nid, checked: true });
    nchk.addEventListener('change', function () { noticeOk = nchk.checked; drawCompare(); });
    var ex = h('input', { type: 'number', id: eid, min: '0', step: '100', value: '0' });
    ex.addEventListener('input', function () { extraCosts = Number(ex.value) || 0; drawCompare(); });
    var cpi = h('input', { type: 'number', id: cid, step: '0.1', value: '0' });
    cpi.addEventListener('input', function () { expectedCpi = Number(cpi.value) || 0; drawCompare(); });
    wrap.appendChild(h('div', { class: 'card' }, [
      h('h3', { class: 'card-title', text: 'הנחות לחישוב' }),
      h('div', { class: 'fields' }, [
        h('div', { class: 'field check' }, [nchk, h('label', { for: nid, text: 'ניתנה הודעה מוקדמת של לפחות 10 ימים (בלי עמלת אי-הודעה)' })]),
        h('div', { class: 'field' }, [h('label', { for: eid, text: 'עלויות נוספות למחזור (₪)' }), ex]),
        h('div', { class: 'field' }, [h('label', { for: cid, text: 'אינפלציה שנתית צפויה למסלול צמוד (%)' }), cpi])
      ]),
      h('p', { class: 'help', text: 'במסלול צמוד, בלי אינפלציה מוצגת עלות נומינלית בלבד. הזנת אינפלציה היא הנחה שלכם, לא תחזית של האתר.' })
    ]));
    wrap.appendChild(h('div', { class: 'card' }, [h('h3', { class: 'card-title', text: 'יתרה, עלות ומחזור — הערכה' }), resBox]));

    var policy = rates.policyRate || {};
    var srcs = h('div', { class: 'card' }, [
      h('h3', { class: 'card-title', text: 'מקורות' }),
      h('div', { class: 'src-line' }, [h('span', { text: 'ריבית בנק ישראל ' + (policy.boiPolicyRatePct != null ? policy.boiPolicyRatePct + '%' : '—') + ', פריים טיפוסי ' + (policy.typicalPrimePct != null ? policy.typicalPrimePct + '%' : '—') }), h('span', { class: 'stamp', text: 'עודכן ב־' + (policy.asOf || '') })]),
      h('div', { class: 'src-line' }, [
        h('a', { href: 'https://www.boi.org.il/information/interestrates/mortgage/', target: '_blank', rel: 'noopener', text: 'בנק ישראל, ריבית ממוצעת למשכנתאות ולעמלת פירעון מוקדם' }),
        h('span', { class: 'stamp', text: 'חודש דיווח ' + (((rates.mortgageEarlyRepaymentAverages || {}).unlinked || {}).period || '') + ', תוקף מ־' + (((rates.mortgageEarlyRepaymentAverages || {}).unlinked || {}).effectiveFrom || '') })
      ]),
      h('div', { class: 'src-line' }, [
        h('a', { href: 'https://www.boi.org.il/information/interestrates/not-residence/', target: '_blank', rel: 'noopener', text: 'בנק ישראל, ריבית ממוצעת אשראי לא לדיור' }),
        h('span', { class: 'stamp', text: 'חודש דיווח ' + (((rates.consumerLoanAverages || {}).unlinked || {}).period || '') })
      ]),
      h('div', { class: 'src-line' }, [
        h('a', { href: 'https://www.boi.org.il/information/bank-paymnts/financial-education/campaigns/boi-equator/loans/', target: '_blank', rel: 'noopener', text: 'בנק ישראל, קו המשווה — אשראי למשקי בית' }),
        h('span', { class: 'stamp', text: 'חודש דיווח ' + ((rates.equatorHouseholdCredit || {}).period || '') + (rates.equatorHouseholdCredit && rates.equatorHouseholdCredit.systemAveragePct != null ? ' · ממוצע מערכת ' + rates.equatorHouseholdCredit.systemAveragePct + '%' : '') })
      ]),
      h('p', { class: 'help', text: (rates.earlyRepaymentRules && 'עמלת ההיוון מחושבת לפי צו הבנקאות (פירעון מוקדם של הלוואה לדיור), התשס"ב–2002, כולל הפחתה של 20% אחרי שלוש שנים ו-30% אחרי חמש שנים, ועמלה תפעולית עד 60 ש״ח.') || '' })
    ]);
    wrap.appendChild(srcs);

    function summarize(tr) {
      var Lib = window.CompareLib;
      var P = Number(tr.balance) || 0, N = Math.round(Number(tr.months) || 0), r = Number(tr.rate) || 0;
      var pay = tr.payment != null && Number(tr.payment) > 0 ? Number(tr.payment) : Lib.pmt(P, r, N, false);
      var cost = Lib.remainingCost(P, r, N, false);
      if (tr.payment != null && Number(tr.payment) > 0) cost = { pmt: pay, totalPaid: pay * N, interest: pay * N - P };
      var implied = (tr.payment != null && Number(tr.payment) > 0 && P && N) ? Lib.impliedNominalRate(P, Number(tr.payment), N) : r;
      var cpiSched = null;
      if ((tr.type === 't_fixed_linked' || tr.type === 't_var_linked') && expectedCpi) {
        cpiSched = Lib.spitzerSchedule(P, r, N, { cpiAnnualPct: expectedCpi });
      }
      return { pmt: pay, totalPaid: cost.totalPaid, interest: cost.interest, implied: implied, cpiSched: cpiSched };
    }

    function drawCompare() {
      resBox.innerHTML = '';
      if (!tracks.length) { resBox.appendChild(h('p', { class: 'empty', text: 'הוסיפו מסלול כדי לראות יתרה, עלות והשוואה.' })); return; }
      var tbl = document.createElement('table'); tbl.className = 'cmp data';
      var cap = document.createElement('caption'); cap.className = 'sr-only'; cap.textContent = 'השוואת מחזור לפי מסלול, הערכה בלבד';
      tbl.appendChild(cap);
      var thead = document.createElement('thead'), hr = document.createElement('tr');
      ['מסלול', 'יתרה', 'ריבית נוכחית', 'ריבית אפקטיבית מחושבת', 'החזר נוכחי', 'עלות נותרת', 'ממוצע שוק', 'החזר חדש מוערך', 'עמלת פירעון מוקדם (הערכה)', 'חיסכון נטו (הערכה)'].forEach(function (label) {
        var th = document.createElement('th'); th.scope = 'col'; th.textContent = label; hr.appendChild(th);
      });
      thead.appendChild(hr); tbl.appendChild(thead);
      var tb = document.createElement('tbody');
      var Lib = window.CompareLib;
      tracks.forEach(function (tr) {
        var sum = summarize(tr);
        var row = document.createElement('tr');
        function td(text, num, cls) { var e = document.createElement('td'); e.className = (num ? 'num ' : '') + (cls || ''); e.textContent = text; row.appendChild(e); }
        td((tr.name || trackLabel(tr.type)) + ' · ' + trackLabel(tr.type));
        td(money(tr.balance), true);
        td(pct(tr.rate), true);
        td(pct(sum.implied), true);
        td(money(sum.pmt), true);
        var costTxt = money(sum.totalPaid);
        if (sum.cpiSched) costTxt += ' · עם אינפלציה ' + money(sum.cpiSched.totalPaid);
        td(costTxt, true);
        var marketTxt = '—', newPmt = '—', feeTxt = '—', saveTxt = '—', saveCls = '';
        if (tr.type === 't_consumer') {
          var cm = Lib.consumerMarketRate(rates, tr.months);
          if (cm && cm.averagePct != null) {
            var neu = Lib.remainingCost(tr.balance, cm.averagePct, tr.months, true);
            marketTxt = pct(cm.averagePct) + ' (לא לדיור, ' + cm.bucket + ')';
            newPmt = money(neu.pmt);
            var fee = 60 + extraCosts;
            feeTxt = money(fee) + ' (בלי היוון מחושב להלוואה שאינה לדיור)';
            var net = sum.totalPaid - neu.totalPaid - fee;
            saveTxt = money(net);
            saveCls = net >= 0 ? 'pos' : 'neg';
          }
        } else {
          var ref = Lib.refinanceTrack(tr, rates, { noticeGiven: noticeOk, extraCosts: extraCosts, operationalFeeIls: 60 });
          if (ref && ref.marketPct != null) {
            marketTxt = pct(ref.marketPct);
            newPmt = money(ref.newPmt);
            feeTxt = money(ref.fee.total);
            saveTxt = money(ref.netSaving);
            saveCls = ref.netSaving >= 0 ? 'pos' : 'neg';
          }
        }
        td(marketTxt, true);
        td(newPmt, true);
        td(feeTxt, true);
        td(saveTxt, true, saveCls);
        tb.appendChild(row);
      });
      tbl.appendChild(tb);
      resBox.appendChild(h('div', { class: 'tbl-wrap' }, [tbl]));
      resBox.appendChild(h('p', { class: 'help', text: 'החיסכון הנטו הוא הערכה: עלות נותרת נוכחית פחות עלות בממוצע השוק, פחות עמלת פירעון מוקדם מוערכת ועלויות נוספות. הממוצע אינו הצעה אישית, ובמסלול פריים אין עמלת היוון.' }));
      if (rates.equatorHouseholdCredit && rates.equatorHouseholdCredit.byLenderMean) {
        var t2 = document.createElement('table'); t2.className = 'cmp data';
        var c2 = document.createElement('caption'); c2.className = 'sr-only'; c2.textContent = 'ריבית ממוצעת על אשראי למשקי בית לפי גוף';
        t2.appendChild(c2);
        var th2 = document.createElement('thead'), r2 = document.createElement('tr');
        ['גוף', 'ממוצע', 'רבע זול', 'חציון', 'רבע יקר'].forEach(function (label) { var th = document.createElement('th'); th.scope = 'col'; th.textContent = label; r2.appendChild(th); });
        th2.appendChild(r2); t2.appendChild(th2);
        var b2 = document.createElement('tbody');
        var percs = {};
        (rates.equatorHouseholdCredit.byLenderPercentiles || []).forEach(function (p) { percs[p.providerId] = p; });
        rates.equatorHouseholdCredit.byLenderMean.forEach(function (m) {
          var tr = document.createElement('tr');
          function td(t) { var e = document.createElement('td'); e.className = 'num'; e.textContent = t; tr.appendChild(e); }
          var name = document.createElement('td'); name.textContent = m.providerHe; tr.appendChild(name);
          td(pct(m.averagePct));
          var p = percs[m.providerId] || {};
          td(pct(p.p25)); td(pct(p.median)); td(pct(p.p75));
          b2.appendChild(tr);
        });
        t2.appendChild(b2);
        resBox.appendChild(h('h3', { class: 'card-title', text: 'אשראי למשקי בית שניתן בפועל' }));
        resBox.appendChild(h('p', { class: 'help', text: 'ריבית משתנה לא צמודה, ממוצעים לחודש הדיווח בקו המשווה. לא הצעה.' }));
        resBox.appendChild(h('div', { class: 'tbl-wrap' }, [t2]));
      }
    }

    drawTracks();
    drawCompare();
    main.appendChild(wrap);
  }

  function boot(main) {
    fetch('data/loan-rates.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('rates');
      return r.json();
    }).then(function (rates) { render(main, rates); }).catch(function (err) {
      main.appendChild(h('div', { class: 'notice red', text: 'לא ניתן לטעון את נתוני הריביות הרשמיים כרגע.' }));
      console.warn(err);
    });
  }

  function hook() {
    var page = document.body && document.body.getAttribute('data-page');
    if (page !== 'loans') return;
    var main = document.querySelector('#portal main') || document.querySelector('main');
    if (!main) { setTimeout(hook, 40); return; }
    if (document.getElementById('loans-compare')) return;
    main.appendChild(h('h2', { class: 'sec-h', text: 'לוח סילוקין והשוואה לשוק' }));
    boot(main);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
})();
