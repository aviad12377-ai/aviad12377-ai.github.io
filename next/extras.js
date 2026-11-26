/* site/next/extras.js — owned by worker 08313575 (v2b → next port). Implements window.NextExtras (contract in ux/coordination.md).
   - feeLine(accounts, api): management fees in shekels, only from fee data that exists; nothing when there is none.
   - soSheet(redraw, api): standing-order editor (demo only, saved on this device only).
   - fundDetail(el, set, id, api): #/fund/pensianet|gemelnet/:id with cumulative chart from ../funds.json.
   No personal data here. CSS for these screens is injected below (does not edit app.css). */
(function () {
  'use strict';
  var CSS = [
    '.fundlink{color:var(--ink);text-decoration:none;min-height:44px;align-content:center}',
    '.fundlink:hover,.fundlink:focus-visible{text-decoration:underline;color:var(--primary)}',
    '.mbars{display:grid;gap:6px}',
    '.mb-h{font-size:14px;font-weight:600;color:var(--muted);margin-top:6px}',
    '.mb{display:grid;grid-template-columns:64px 1fr 64px;align-items:center;gap:8px;font-size:14px}',
    '.mb i{display:block;height:10px;border-radius:5px;background:var(--surface-2);overflow:hidden}',
    '.mb i b{display:block;height:100%;border-radius:5px;background:var(--primary);transform-origin:right;animation:x-mbgrow 260ms cubic-bezier(.2,.8,.2,1) both}',
    '.mb i b.me{background:var(--gain)}',
    '@keyframes x-mbgrow{from{transform:scaleX(0)}}',
    '.field .lbl{display:block;font-size:14px;font-weight:600;color:var(--muted);margin-bottom:6px}',
    '.stepper{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:var(--r-sm,12px);background:var(--surface);min-height:52px}',
    '.stepper button{width:52px;min-height:50px;border:0;background:none;font-size:24px;color:var(--primary);cursor:pointer;border-radius:var(--r-sm,12px);touch-action:manipulation}',
    '.stepper button:active{background:var(--surface-2)}',
    '.stepper input{flex:1;min-width:0;border:0;background:none;text-align:center;font-size:18px;font-weight:700;min-height:50px;font-variant-numeric:tabular-nums;color:var(--ink)}',
    '.stepper input:focus{outline:none}.stepper:focus-within{outline:2px solid var(--primary);outline-offset:2px}',
    '#so-day{display:flex;gap:8px;flex-wrap:wrap}#so-day .chip{min-width:48px;justify-content:center}',
    '.splitrow{display:flex;align-items:center;gap:12px;min-height:44px}',
    '.splitrow label{flex:1;font-size:15px}',
    '.splitrow input{flex:1.4;accent-color:var(--primary);min-height:44px}',
    '.splitrow .num{width:44px;text-align:left}',
    '.x-fee{display:block}',
    '@media (prefers-reduced-motion:reduce){.mb i b{animation:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'extras-v2b'; st.textContent = CSS; document.head.appendChild(st);

  var KEY = 'next-standing-demo';
  var DEF = { amt: 1000, day: 10, split: [['SPY', 70], ['QQQ', 30]] }; // same as app.js demo
  function saved() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.amt > 0 && s.split) return s; } catch (e) {} return null; }
  function fv(m, r, y) { var i = r / 12, k = y * 12; return m * ((Math.pow(1 + i, k) - 1) / i); }
  function num(v) { return v != null && v !== '' && isFinite(+v); }

  /* 1. fees in shekels — from the accounts' own fee data; demo accounts carry the demo badge in the hero */
  function feeLine(accounts, api) {
    var y = 0, used = 0;
    (accounts || []).forEach(function (a) {
      var m = /([\d.]+)%\s*מצבירה/.exec(a && a.fee || '');
      var b = +a.bal;
      if (m && b > 0 && isFinite(+m[1])) { y += b * parseFloat(m[1]) / 100; used++; }
    });
    if (!(y > 0)) return '';
    return '<p class="help x-fee">דמי ניהול מהצבירה: כ־' + api.ils(y) + ' בשנה (' + api.ils(y / 12) + ' בחודש)' +
      (used < (accounts || []).filter(function (a) { return a.group !== 'deposits'; }).length ? ', לפי החשבונות שיש להם נתון דמי ניהול' : '') + '</p>';
  }

  /* 2. standing-order editor (demo). Saved on this device only, nothing is sent anywhere. */
  function standingText(s) { return 'ב־' + s.day + ' לחודש · ' + s.split.map(function (x) { return x[0] + ' ' + x[1] + '%'; }).join(' · '); }
  function patchStanding(api) {
    var s = saved(), inv = document.getElementById('inv'); if (!s || !inv || !api.snap().demo) return;
    var btn = inv.querySelector('#so-edit'); if (!btn) return;
    var card = btn.closest('.card-h') && btn.closest('.card-h').nextElementSibling; if (!card) return;
    var b = card.querySelector('b'), sub = b && b.nextElementSibling, help = card.querySelector('.help');
    if (card.dataset.x === JSON.stringify(s)) return; // already patched; avoids observer loops
    card.dataset.x = JSON.stringify(s);
    if (b) b.innerHTML = api.ils(s.amt) + ' בחודש';
    if (sub) sub.textContent = standingText(s);
    if (help) help.innerHTML = 'הערכה לעתיד לפי ההנחה שנשמרה: כ־' + api.ils(fv(s.amt, 0.06, 10)) + ' (הנחה, לא תחזית)';
  }
  function soSheet(redraw, api) {
    var $ = api.$, $$ = api.$$, esc = api.esc;
    var s = JSON.parse(JSON.stringify(saved() || DEF));
    api.openSheet('<h2 id="sheet-title">הוראת קבע לתיק</h2><p class="muted" style="margin:0 0 12px">' + api.DEMO.replace('נתוני דוגמה', 'אב־טיפוס: נשמר במכשיר בלבד, לא נשלח לבנק') + '</p>' +
      '<div class="field"><label for="so-amt">סכום חודשי (₪)</label><div class="stepper"><button type="button" data-k="-1" aria-label="פחות 100">−</button><input id="so-amt" inputmode="numeric" value="' + s.amt + '"><button type="button" data-k="1" aria-label="יותר 100">+</button></div></div>' +
      '<div class="field"><span class="lbl" id="so-day-l">יום בחודש</span><div class="chips" id="so-day" role="group" aria-labelledby="so-day-l" style="margin:0;padding:0">' + [1, 10, 15, 25].map(function (d) { return '<button type="button" class="chip" data-v="' + d + '" aria-pressed="' + (d === s.day) + '">' + d + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><span class="lbl">חלוקה</span><div id="so-split">' + s.split.map(function (x, i) { return '<div class="splitrow"><label for="sp' + i + '">' + esc(x[0]) + '</label><input type="range" id="sp' + i + '" min="0" max="100" step="5" value="' + x[1] + '"><span class="num" id="spv' + i + '">' + x[1] + '%</span></div>'; }).join('') + '</div>' +
      '<p class="help">בישראל הוראת קבע אפשרית בעיקר לקרנות סל ולקרנות נאמנות.</p></div>' +
      '<p class="help" id="so-proj" aria-live="polite"></p><button class="btn pri block" id="so-save" type="button" style="margin-top:12px">שמירה</button><button class="btn sec block" type="button" style="margin-top:8px" data-close>ביטול</button>');
    function amt() { var v = Math.round(+String($('#so-amt').value).replace(/[^\d]/g, '') || 0); return v; }
    function proj() { $('#so-proj').innerHTML = 'בעוד 10 שנים: כ־' + api.ils(fv(amt(), 0.06, 10)) + ', בהנחת תשואה של 6% בשנה. הנחה בלבד, לא תחזית ולא ייעוץ.'; }
    proj();
    $('#so-amt').addEventListener('input', proj);
    $$('.stepper button').forEach(function (b) {
      var t, iv, k = +b.dataset.k;
      function bump() { var i = $('#so-amt'); i.value = Math.max(100, (Math.round(amt() / 100) + k) * 100); proj(); }
      function stop() { clearTimeout(t); clearInterval(iv); }
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); bump(); stop(); t = setTimeout(function () { iv = setInterval(bump, 70); }, 400); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, stop); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bump(); } });
    });
    $$('#so-day .chip').forEach(function (c) { c.addEventListener('click', function () { $$('#so-day .chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); }); s.day = +c.dataset.v; }); });
    $$('#so-split input').forEach(function (r, i) { r.addEventListener('input', function () { var v = +r.value; s.split[i][1] = v; if (s.split.length === 2) { s.split[1 - i][1] = 100 - v; $('#sp' + (1 - i)).value = 100 - v; $('#spv' + (1 - i)).textContent = (100 - v) + '%'; } $('#spv' + i).textContent = v + '%'; }); });
    $('#so-save').addEventListener('click', function () {
      s.amt = Math.max(100, amt() || s.amt);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      api.closeSheet(); redraw(); patchStanding(api);
      api.toast('הוראת הקבע עודכנה בהדגמה (נשמר במכשיר בלבד, לא נשלח לבנק)');
    });
  }
  // keep the saved demo values visible whenever #/invest is drawn (app.js demo data does not read our key)
  function watchInvest() {
    var m = document.getElementById('main'); if (!m || !window.NextApp) return;
    var busy = false; new MutationObserver(function () { if (busy || !/^#\/invest\/?$/.test(location.hash) || !document.getElementById('so-edit')) return; busy = true; try { patchStanding(window.NextApp); } finally { busy = false; } }).observe(m, { childList: true, subtree: true });
  }

  /* 3. fund detail */
  var HM = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  function per(p) { p = String(p || ''); var mo = +p.slice(4, 6); return mo ? HM[mo - 1] + ' ' + p.slice(0, 4) : ''; }
  function trackOf(f) { // same rules as app.js trackOf (compare list), so peers match the list
    var s = (f.name || '') + ' ' + (f.spec || '');
    if (/S&P|500|אס אנד פי/i.test(s)) return 'sp';
    if (/הלכ/.test(s)) return 'halacha';
    if (/לבני|גיל|מדרגות/.test(s)) return 'age';
    if (/אג"ח|אג״ח|אשראי/.test(s)) return 'bonds';
    if (/עוקב|מחקה|מדד/.test(s)) return 'index';
    if (/מניות|מנייתי/.test(s)) return 'stocks';
    if (/כללי/.test(s)) return 'general';
    return 'other';
  }
  var SRC = '<p class="help" style="text-align:center">מקור: רשות שוק ההון (פנסיה נט וגמל נט)PERIOD · מידע בלבד, לא ייעוץ. תשואות עבר אינן מבטיחות תשואות בעתיד.</p>';
  function fundDetail(el, set, id, api) {
    var $ = api.$, esc = api.esc, pct = api.pct, n = api.n, cls = api.cls, arrow = api.arrow, ic = api.ic;
    function P(v, sign) { return num(v) ? pct(+v, sign) : '—'; }
    // skeleton with the same block sizes as the final screen
    el.innerHTML = '<div id="fd" style="min-height:calc(100vh - 140px)"><section class="hero"><div class="skel l" style="width:40%"></div><div class="skel h"></div><div class="skel" style="height:44px;width:35%;margin:8px 0"></div><div class="chart" style="height:168px"><div class="skel" style="height:168px"></div></div></section>' +
      '<section class="card" style="margin-top:12px"><div class="skel r"></div><div class="skel r"></div></section></div>';
    var box = $('#fd');
    api.load('../funds.json').then(function (F) {
      var S = F && F.sets && F.sets[set], f = S && (S.funds || []).filter(function (x) { return String(x.id) === String(id); })[0];
      var src = SRC.replace('PERIOD', S && S.period ? ' · נתוני ' + per(S.period) : '');
      if (!f) {
        box.innerHTML = '<section class="card empty"><b>לא מצאנו את המסלול</b>ייתכן שהוא נסגר או שהקישור ישן.<div style="margin-top:12px"><a class="btn sec" href="#/compare/funds">לכל הקרנות</a></div></section>' + src;
        return;
      }
      var t = document.getElementById('page-title'); if (t) t.textContent = f.cls === 'קרנות השתלמות' ? 'קרן השתלמות' : set === 'pensianet' ? 'קרן פנסיה' : 'קופת גמל';
      var peers = S.funds.filter(function (x) { return x.cls === f.cls && trackOf(x) === trackOf(f) && x.ytd != null && x.assets >= 20; });
      function med(k) { var a = peers.map(function (x) { return x[k]; }).filter(num).map(Number).sort(function (a, b) { return a - b; }); return a.length ? a[Math.floor(a.length / 2)] : null; }
      var mo = S.monthly && S.monthly[String(f.id)], keys = mo ? Object.keys(mo).filter(function (k) { return num(mo[k]); }).sort() : [], ser = [100], v = 100;
      keys.forEach(function (k) { v *= 1 + mo[k] / 100; ser.push(v); });
      var mYtd = med('ytd'), dv = num(f.ytd) && mYtd != null ? f.ytd - mYtd : null;
      function base() { return dv == null ? '<span class="muted">תשואה מתחילת השנה</span>' : '<span class="' + cls(dv) + '">' + arrow(dv) + ' ' + pct(dv, true) + '</span> <span class="muted">מול חציון המסלול · תשואה מתחילת השנה</span>'; }
      box.style.minHeight = '';
      box.innerHTML =
        '<section class="hero"><div class="lbl">' + esc(f.mgr || f.parent || '') + '</div><h2 style="font-size:20px;margin:4px 0 0">' + esc(f.name) + '</h2>' +
        '<div class="big" id="fv">' + P(f.ytd, true) + '</div><div class="chg" id="fvl">' + base() + '</div>' +
        (ser.length > 2 ? '<div class="chart" id="fc" style="height:168px"></div><p class="help" style="text-align:center">שווי של 100 ₪ מתחילת ' + per(keys[0]) + ' עד סוף ' + per(keys[keys.length - 1]) + ' · גרור על הגרף</p>'
          : '<div class="empty" style="padding:16px 0"><b>אין עדיין נתוני תשואה חודשיים למסלול הזה</b></div>') + '</section>' +
        '<section class="card" style="margin-top:12px"><div class="kv">' + [['דמי ניהול מצבירה', P(f.feeAcc)], ['דמי ניהול מהפקדה', P(f.feeDep)], ['תשואה 5 שנים (מצטבר)', P(f.c5, true)], ['תשואה 3 שנים (מצטבר)', P(f.c3, true)], ['סטיית תקן', P(f.sd)], ['גודל', num(f.assets) ? n(f.assets / 1000, true) + ' מיליארד ₪' : '—']].map(function (r) { return '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div></section>' +
        (peers.length > 1 ? '<h2 class="sec">מול ' + n(peers.length) + ' מסלולים דומים</h2><section class="card"><div class="mbars">' + [['מתחילת השנה', 'ytd'], ['3 שנים (שנתי)', 'y3'], ['5 שנים (שנתי)', 'y5']].map(function (r) {
          var a = num(f[r[1]]) ? +f[r[1]] : null, b = med(r[1]), mx = Math.max(Math.abs(a || 0), Math.abs(b || 0)) || 1;
          return '<div class="mb-h">' + r[0] + '</div><div class="mb"><span>המסלול</span><i><b class="me" style="width:' + Math.max(2, Math.abs(a || 0) / mx * 100) + '%"></b></i>' + P(a) + '</div><div class="mb"><span>חציון</span><i><b style="width:' + Math.max(2, Math.abs(b || 0) / mx * 100) + '%"></b></i>' + P(b) + '</div>';
        }).join('') + '</div></section>' : '') +
        '<h2 class="sec">אותו מסלול, דמי ניהול נמוכים יותר</h2><section class="card" style="padding:8px 16px"><div class="list" id="alts"></div></section>' + src;
      var alts = peers.filter(function (x) { return x.id !== f.id && num(x.feeAcc) && num(f.feeAcc) && +x.feeAcc < +f.feeAcc && num(x.y5); }).sort(function (a, b) { return b.y5 - a.y5; }).slice(0, 5);
      $('#alts').innerHTML = alts.length ? alts.map(function (x) { return '<a class="row" href="#/fund/' + set + '/' + x.id + '"><span class="tx"><span class="t wrap">' + esc(x.name) + '</span><span class="s">דמי ניהול ' + P(x.feeAcc) + '</span></span><span class="v"><b class="' + cls(x.y5) + '">' + pct(+x.y5, true) + '</b><small class="muted">לשנה, 5 שנים</small></span>' + ic('chev').replace('<svg', '<svg class="chev"') + '</a>'; }).join('')
        : '<div class="empty"><b>דמי הניהול כאן כבר מהנמוכים</b>אין במסלול הזה מסלול זול יותר עם נתוני 5 שנים.</div>';
      if (ser.length > 2 && api.chart) api.chart($('#fc'), ser, { label: 'שווי של 100 ₪ לאורך הזמן', onScrub: function (i) {
        if (i < 0) { $('#fv').innerHTML = P(f.ytd, true); $('#fvl').innerHTML = base(); return; }
        $('#fv').innerHTML = pct(ser[i] - 100, true); $('#fvl').innerHTML = '<span class="muted">' + (i ? 'מצטבר עד סוף ' + per(keys[i - 1]) : 'נקודת ההתחלה') + '</span>';
      } });
    }).catch(function () { box.innerHTML = '<section class="card empty"><b>הנתונים לא נטענו</b>בדוק חיבור ונסה שוב.</section>'; });
  }

  window.NextExtras = { feeLine: feeLine, soSheet: soSheet, fundDetail: fundDetail };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchInvest); else watchInvest();
})();
