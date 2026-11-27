/* Comparison screens inside /next/. Implements window.NextCompare, which app.js already calls.
   Math and parsers stay in ../compare-lib.js. Official figures come from ../data/*.json.
   Nothing here is written to the repo, and typed balances stay in the page. */
(function () {
  'use strict';

  var CSS = [
    '.nc{display:flex;flex-direction:column;gap:12px}',
    '.nc .fields{grid-template-columns:1fr}',
    '@media (min-width:720px){.nc .fields.two{grid-template-columns:1fr 1fr}}',
    '.nc input,.nc select,.nc textarea{width:100%;min-height:52px;border-radius:14px;border:1.5px solid var(--line);background:var(--surface);padding:0 14px;font-size:16px}',
    '.nc textarea{min-height:96px;padding:12px 14px;resize:vertical}',
    '.nc input:focus,.nc select:focus,.nc textarea:focus{border-color:var(--primary);outline:none;box-shadow:0 0 0 3px var(--primary-soft)}',
    '.nc-top{display:grid;gap:8px}',
    '@media (min-width:720px){.nc-top{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '.nc-pick{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px;min-height:44px;box-shadow:var(--shadow)}',
    '.nc-pick.best{border-color:var(--primary);background:var(--primary-soft)}',
    '.nc-pick .k{font-size:14px;color:var(--muted);font-weight:600}',
    '.nc-pick b{display:block;font-size:20px;margin:2px 0;font-variant-numeric:tabular-nums}',
    '.nc-pick .s{font-size:14px;color:var(--muted);line-height:1.4}',
    '.nc-item{padding:12px 0;border-bottom:1px solid var(--line)}',
    '.nc-item:last-child{border-bottom:0}',
    '.nc-item .hd{display:flex;justify-content:space-between;gap:12px;align-items:baseline}',
    '.nc-item .hd b{font-size:16px}',
    '.nc-kv{display:grid;grid-template-columns:1fr auto;gap:4px 12px;margin-top:8px;font-size:15px}',
    '.nc-kv span:nth-child(odd){color:var(--muted)}',
    '.nc details{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:4px 14px}',
    '.nc summary{min-height:44px;display:flex;align-items:center;font-weight:700;cursor:pointer}',
    '.nc .src a{font-weight:600}',
    '.nc .track{border:1px solid var(--line);border-radius:16px;padding:12px;background:var(--surface-2)}',
    '.nc .row-actions{display:flex;gap:8px;margin-top:8px}'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'compare-next';
  st.textContent = CSS;
  document.head.appendChild(st);

  var jsonCache = {};
  function loadJson(url) {
    if (!jsonCache[url]) {
      jsonCache[url] = fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(url);
        return r.json();
      });
    }
    return jsonCache[url];
  }
  function Lib() { return window.CompareLib; }
  function safeUrl(u) {
    return typeof u === 'string' && /^https:\/\//.test(u) ? u : '';
  }
  function money(api, v) {
    if (v == null || !isFinite(+v)) return '—';
    return api.ils(+v);
  }
  function rate(api, v) {
    if (v == null || !isFinite(+v)) return '—';
    return api.pct(+v);
  }
  function link(url, label, esc) {
    var u = safeUrl(url);
    if (!u) return '';
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(label || u) + '</a>';
  }
  function loading(el) {
    el.innerHTML = '<div class="nc"><div class="skel h"></div><div class="skel r"></div><div class="skel r"></div></div>';
  }
  function failed(el, text) {
    el.innerHTML = '<div class="nc"><div class="note">' + text + '</div></div>';
  }
  function top3(items) {
    if (!items.length) return '';
    return '<div class="nc-top" id="nc-top">' + items.map(function (it, i) {
      return '<div class="nc-pick' + (i === 0 ? ' best' : '') + '"><div class="k">' + (i === 0 ? 'המוביל' : 'מקום ' + (i + 1)) + '</div><b>' + it.value + '</b><div class="s"><b style="font-size:15px;color:var(--ink)">' + it.title + '</b><br>' + it.sub + '</div></div>';
    }).join('') + '</div>';
  }
  function kv(pairs) {
    return '<div class="nc-kv">' + pairs.map(function (p) { return '<span>' + p[0] + '</span><span>' + p[1] + '</span>'; }).join('') + '</div>';
  }
  function scrollTop() {
    var box = document.getElementById('nc-top') || document.getElementById('nc-focus');
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var MORTGAGE_TYPES = [
    { v: 't_prime', t: 'פריים' },
    { v: 't_fixed_unlinked', t: 'קבועה לא צמודה' },
    { v: 't_fixed_linked', t: 'קבועה צמודה למדד' },
    { v: 't_var_unlinked', t: 'משתנה לא צמודה' },
    { v: 't_var_linked', t: 'משתנה צמודה למדד' },
    { v: 't_other', t: 'אחר' }
  ];
  var LOAN_TYPES = [{ v: 't_consumer', t: 'הלוואה שאינה לדיור' }].concat(MORTGAGE_TYPES);
  function typeLabel(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].v === v) return list[i].t;
    return v;
  }

  function savings(el, api) {
    loading(el);
    if (!Lib()) { failed(el, 'מחשבון ההשוואה לא נטען. רעננו את העמוד.'); return; }
    loadJson('../data/savings.json').then(function (data) {
      var products = (data.deposits && data.deposits.products) || [];
      var dep = data.deposits || {};
      var filters = { rateType: '', termId: '', linkage: '', liquidity: '', providerId: '' };
      var amount = 100000;
      var sampleAmount = true;
      var showAll = false;
      var types = {}, terms = {}, provs = {};
      products.forEach(function (p) {
        types[p.rateType] = p.rateTypeHe;
        terms[p.termId] = p.termHe;
        provs[p.providerId] = p.providerHe;
      });
      function opts(map) {
        return '<option value="">הכול</option>' + Object.keys(map).map(function (k) {
          return '<option value="' + api.esc(k) + '">' + api.esc(map[k]) + '</option>';
        }).join('');
      }
      function liq(p) { return p.liquidity === 'high' ? 'נזיל יותר' : p.liquidity === 'medium' ? 'בינוני' : 'עד סוף התקופה'; }
      function linked(p) { return p.linkage === 'cpi' ? 'צמוד מדד' : 'לא צמוד'; }
      el.innerHTML =
        '<div class="nc" id="savings-compare">' +
        '<p class="muted" style="margin:0">הריביות הן ממוצעים ששולמו בפועל בחודש הדיווח, לא הצעה שתקבלו היום.</p>' +
        '<button type="button" class="btn pri block" id="nc-go">הציגו את שלושת המובילים</button>' +
        '<div class="note" id="nc-sample">סכום לדוגמה: 100,000 ₪. שנו אותו כדי לראות הערכה על הסכום שלכם. המידע לא נשמר.</div>' +
        '<div class="note">' + api.esc(data.disclaimer || 'מידע בלבד, לא ייעוץ.') + '</div>' +
        '<p class="help src">מקור: ' + link(dep.source && dep.source.url, dep.source ? dep.source.label : 'בנק ישראל', api.esc) +
        '<br><span class="muted">חודש הדיווח: ' + api.esc(dep.period || '') + (dep.workbookDate ? ' · הקובץ מ־' + api.esc(dep.workbookDate) : '') + '</span></p>' +
        '<div class="card" id="nc-focus"><div class="fields two">' +
        '<div class="field"><label for="sv-type">סוג ריבית</label><select id="sv-type">' + opts(types) + '</select></div>' +
        '<div class="field"><label for="sv-term">תקופה</label><select id="sv-term">' + opts(terms) + '</select></div>' +
        '<div class="field"><label for="sv-link">הצמדה</label><select id="sv-link"><option value="">הכול</option><option value="unlinked">לא צמוד</option><option value="cpi">צמוד מדד</option></select></div>' +
        '<div class="field"><label for="sv-bank">בנק</label><select id="sv-bank">' + opts(provs) + '</select></div>' +
        '<div class="field"><label for="sv-amt">סכום להערכה (₪)</label><input id="sv-amt" inputmode="numeric" value="100000"></div>' +
        '</div></div>' +
        '<div id="nc-out"></div>' +
        (data.moneyMarketFunds ? '<div class="card"><h2 class="card-h" style="margin:0">קרנות כספיות</h2><p class="help">' + api.esc(data.moneyMarketFunds.note || '') + '</p><p class="help src">' + link(data.moneyMarketFunds.source && data.moneyMarketFunds.source.url, data.moneyMarketFunds.source && data.moneyMarketFunds.source.label, api.esc) + '</p></div>' : '') +
        (data.gaps && data.gaps.length ? '<details><summary>מה חסר בנתונים</summary><ul>' + data.gaps.map(function (t) { return '<li>' + api.esc(t) + '</li>'; }).join('') + '</ul></details>' : '') +
        '</div>';
      function draw() {
        var vis = Lib().visibleDeposits(products, filters, { limit: 20, showAll: showAll });
        var list = vis.list;
        var picks = list.slice(0, 3).map(function (p) {
          var mid = (p.termMinDays + p.termMaxDays) / 2;
          return {
            title: api.esc(p.providerHe + ' · ' + p.termHe),
            value: rate(api, p.ratePct),
            sub: api.esc(linked(p) + ' · ' + p.rateTypeHe) + '<br>ריבית מוערכת על הסכום: ' + money(api, Lib().depositInterest(amount, p.ratePct, mid))
          };
        });
        var status = vis.total === 0
          ? 'אין תוצאות לפי הסינון.'
          : (vis.limited ? ('מוצגים 20 המסלולים עם הריבית הממוצעת הגבוהה ביותר, מתוך ' + vis.total + '.') : ('מוצגים ' + list.length + ' מסלולים.'));
        var body = '<h2 class="sec" style="margin-top:4px">שלושת הפיקדונות המובילים</h2>' + (picks.length ? top3(picks) : '<div class="card empty"><b>אין פיקדונות לפי הסינון</b>הרחיבו את הבחירה.</div>');
        if (list.length) {
          body += '<p class="help">' + status + '</p>';
          if (vis.total > 20) body += '<button type="button" class="btn sec block" id="sv-all">' + (showAll ? 'הצג 20 המובילים' : 'הצג את כל המסלולים') + '</button>';
          body += '<section class="card">' + list.map(function (p) {
            var mid = (p.termMinDays + p.termMaxDays) / 2;
            return '<div class="nc-item"><div class="hd"><b>' + api.esc(p.providerHe) + '</b><span>' + rate(api, p.ratePct) + '</span></div>' +
              kv([
                ['סוג', api.esc(p.rateTypeHe)],
                ['הצמדה', linked(p)],
                ['תקופה', api.esc(p.termHe)],
                ['נזילות', liq(p)],
                ['ממוצע במערכת', rate(api, p.systemAvgPct)],
                ['ריבית מוערכת על הסכום', money(api, Lib().depositInterest(amount, p.ratePct, mid))]
              ]) + '</div>';
          }).join('') + '</section>' +
            '<p class="help">ברירת המחדל היא 20 המסלולים עם הריבית הממוצעת הגבוהה ביותר. אין בנתונים סכום מינימום רשמי, ולכן הסכום משמש רק להערכת הריבית. הערכה בלבד, לא ייעוץ.</p>';
        }
        document.getElementById('nc-out').innerHTML = body;
        var all = document.getElementById('sv-all');
        if (all) all.addEventListener('click', function () { showAll = !showAll; draw(); });
      }
      function bind(id, key) {
        document.getElementById(id).addEventListener('change', function (e) { filters[key] = e.target.value; draw(); });
      }
      bind('sv-type', 'rateType');
      bind('sv-term', 'termId');
      bind('sv-link', 'linkage');
      bind('sv-bank', 'providerId');
      document.getElementById('sv-amt').addEventListener('input', function (e) {
        amount = Number(String(e.target.value).replace(/[^\d.]/g, '')) || 0;
        if (e.isTrusted && sampleAmount) {
          sampleAmount = false;
          var badge = document.getElementById('nc-sample');
          if (badge) badge.remove();
        }
        draw();
      });
      document.getElementById('nc-go').addEventListener('click', function () { draw(); scrollTop(); });
      draw();
    }).catch(function () { failed(el, 'לא ניתן לטעון את נתוני הפיקדונות כרגע. הנתונים לא הומצאו.'); });
  }

  function cards(el, api) {
    loading(el);
    if (!Lib()) { failed(el, 'מחשבון ההשוואה לא נטען. רעננו את העמוד.'); return; }
    loadJson('../data/cards.json').then(function (data) {
      var spend = { supermarket: 3000, fuel: 800, dining: 1200, online: 1000, abroad: 500, other: 1500 };
      var year = 2, profile = 'general', sample = true;
      function title(c) {
        return (c.bankHe && c.bankHe !== c.issuerHe) ? (c.bankHe + ' · ' + c.issuerHe + ' · ' + c.nameHe) : (c.issuerHe + ' · ' + c.nameHe);
      }
      el.innerHTML =
        '<div class="nc" id="card-compare">' +
        '<p class="muted" style="margin:0">לפי סל הוצאות לדוגמה אפשר לראות שלושה כרטיסים מובילים. התאימו את הסכומים כדי לדייק.</p>' +
        '<button type="button" class="btn pri block" id="nc-go">הזינו סכום וקבלו את 3 הטובים</button>' +
        '<div class="note" id="nc-sample">סל הוצאות לדוגמה. שנו סכום כדי לחשב לפי ההוצאה שלכם. המספרים נשארים בעמוד הזה.</div>' +
        '<div class="note">' + api.esc((data.disclaimer || 'מידע בלבד, לא ייעוץ.') + ' החישוב הוא הערכה בלבד.') + '</div>' +
        '<div class="card" id="nc-focus"><div class="fields two">' +
        (data.categories || []).map(function (c) {
          return '<div class="field"><label for="cd-' + api.esc(c.id) + '">' + api.esc(c.he) + ' (לחודש, ₪)</label><input id="cd-' + api.esc(c.id) + '" inputmode="numeric" value="' + (spend[c.id] || 0) + '"></div>';
        }).join('') +
        '<div class="field"><label for="cd-year">שנת חישוב</label><select id="cd-year"><option value="2" selected>שנה שנייה ואילך</option><option value="1">שנה ראשונה (כולל פטור)</option></select></div>' +
        '<div class="field"><label for="cd-prof">מה חשוב לכם</label><select id="cd-prof">' +
        (data.profiles || []).map(function (p) { return '<option value="' + api.esc(p.id) + '">' + api.esc(p.he) + '</option>'; }).join('') +
        '</select></div></div><p class="help">ההחזר מחושב לפי השיעור שפורסם, בניכוי דמי כרטיס ועמלת המרה על הוצאות בחוץ לארץ.</p></div>' +
        '<div id="nc-out"></div>' +
        '<p class="help">הנתונים נבדקו ב־' + api.esc(data.checkedOn || '') + '.</p>' +
        (data.gaps && data.gaps.length ? '<details><summary>מה חסר בנתונים</summary><ul>' + data.gaps.map(function (t) { return '<li>' + api.esc(t) + '</li>'; }).join('') + '</ul></details>' : '') +
        '</div>';
      function notes(row) {
        var bits = [];
        if (row.feeUnknown) bits.push('חסרים דמי כרטיס לאחר שנת הפטור.');
        if (row.rewardsUnknown) bits.push('אין החזר כספי מחושב.');
        if (row.fxUnknown) bits.push('עמלת מט״ח לא פורסמה, ולכן אינה נכללת.');
        return bits.join(' ');
      }
      function draw() {
        var ranked = Lib().rankCards(data.cards, spend, { year: year, profile: profile });
        var picks = ranked.slice(0, 3).map(function (row) {
          return { title: api.esc(title(row.card)), value: money(api, row.net), sub: 'נשאר ביד לשנה, אחרי דמי כרטיס והמרת מט״ח.' };
        });
        var html = '';
        if (profile === 'crypto') html += '<div class="note">לא נמצא כרטיס עם החזר בקריפטו ותנאים פומביים שאומתו לישראל. מוצג הדירוג הכללי.</div>';
        html += '<h2 class="sec" style="margin-top:4px">שלושת הכרטיסים המובילים</h2>' + (picks.length ? top3(picks) : '<div class="card empty"><b>אין כרטיסים להצגה</b>לפי הבחירה הזו.</div>');
        if (ranked.length) {
          html += '<section class="card">' + ranked.map(function (row, i) {
            var c0 = row.card;
            var srcs = (c0.sources || []).map(function (s) {
              return '<p class="help src">' + link(s.url, s.label, api.esc) + (s.asOf ? ' <span class="muted">עודכן ב־' + api.esc(s.asOf) + '</span>' : '') + '</p>';
            }).join('');
            return '<div class="nc-item"><div class="hd"><b>' + (i + 1) + '. ' + api.esc(title(c0)) + '</b><span class="' + (row.net >= 0 ? 'gain' : 'loss') + '">' + money(api, row.net) + '</span></div>' +
              (notes(row) ? '<p class="help">' + api.esc(notes(row)) + '</p>' : '') +
              kv([
                ['החזר לשנה', money(api, row.rewards)],
                ['דמי כרטיס', money(api, -row.fees)],
                ['עלות המרת מט״ח', money(api, -row.fxCost)],
                ['עמלת המרה', rate(api, c0.fxFeePct)]
              ]) + srcs + '</div>';
          }).join('') + '</section>' +
            '<p class="help">הערכה בלבד. בשנה הראשונה נספר פטור מדמי כרטיס אם פורסם. עמלת המרה מחושבת על סכום «חוץ לארץ» לפי התעריף שפורסם.</p>';
        }
        document.getElementById('nc-out').innerHTML = html;
      }
      (data.categories || []).forEach(function (c) {
        document.getElementById('cd-' + c.id).addEventListener('input', function (e) {
          spend[c.id] = Number(String(e.target.value).replace(/[^\d.]/g, '')) || 0;
          if (e.isTrusted && sample) { sample = false; var b = document.getElementById('nc-sample'); if (b) b.remove(); }
          draw();
        });
      });
      document.getElementById('cd-year').addEventListener('change', function (e) { year = Number(e.target.value); draw(); });
      document.getElementById('cd-prof').addEventListener('change', function (e) { profile = e.target.value; draw(); });
      document.getElementById('nc-go').addEventListener('click', function () {
        var first = document.querySelector('#nc-focus input');
        if (first) first.focus();
        scrollTop();
      });
      draw();
    }).catch(function () { failed(el, 'לא ניתן לטעון את נתוני הכרטיסים כרגע. הנתונים לא הומצאו.'); });
  }

  function sourcesBlock(api, rates) {
    var un = rates.mortgageEarlyRepaymentAverages && rates.mortgageEarlyRepaymentAverages.unlinked;
    var cpi = rates.mortgageEarlyRepaymentAverages && rates.mortgageEarlyRepaymentAverages.cpiIndexed;
    var pol = rates.policyRate || {};
    var bits = [];
    if (un && un.source) bits.push(link(un.source.file || un.source.url, un.source.label, api.esc));
    if (cpi && cpi.source) bits.push(link(cpi.source.file || cpi.source.url, cpi.source.label, api.esc));
    if (pol.source) bits.push(link(pol.source.url, pol.source.label, api.esc));
    if (pol.primePage) bits.push(link(pol.primePage, 'בנק ישראל, ריבית הפריים', api.esc));
    var stamps = [];
    if (un) stamps.push('לא צמוד: ' + (un.period || '') + (un.effectiveFrom ? ', בתוקף מ־' + un.effectiveFrom : ''));
    if (cpi) stamps.push('צמוד מדד: ' + (cpi.period || '') + (cpi.effectiveFrom ? ', בתוקף מ־' + cpi.effectiveFrom : ''));
    if (pol.asOf) stamps.push('ריבית בנק ישראל ' + (pol.boiPolicyRatePct != null ? pol.boiPolicyRatePct + '%' : '—') + ' ליום ' + pol.asOf + (pol.typicalPrimePct != null ? ', פריים טיפוסי ' + pol.typicalPrimePct + '%' : ''));
    return '<p class="help src">' + bits.filter(Boolean).join('<br>') + (stamps.length ? '<br><span class="muted">' + api.esc(stamps.join(' · ')) + '</span>' : '') + '</p>';
  }

  function blankTrack(kind) {
    return {
      id: 't' + Math.random().toString(36).slice(2, 7),
      name: '',
      type: kind === 'loan' ? 't_consumer' : 't_fixed_unlinked',
      balance: '',
      rate: '',
      months: '',
      payment: '',
      yearsHeld: 3,
      monthsToReset: 60,
      sample: false
    };
  }
  function sampleTrack(kind) {
    var t = blankTrack(kind);
    t.sample = true;
    t.name = 'מסלול לדוגמה';
    if (kind === 'loan') {
      t.balance = 30000; t.rate = 8; t.months = 36; t.payment = '';
    } else {
      t.balance = 500000; t.rate = 4.9; t.months = 240;
    }
    return t;
  }

  function finance(el, api, kind, rates) {
    var types = kind === 'loan' ? LOAN_TYPES : MORTGAGE_TYPES;
    var saved = [];
    try { saved = Lib().readSavedMortgageTracks() || []; } catch (e) { saved = []; }
    var tracks = saved.map(function (t) {
      return {
        id: t.id, name: t.name || '', type: t.type || 't_fixed_unlinked',
        balance: t.balance, rate: t.rate, months: t.months, payment: t.payment || '',
        yearsHeld: t.yearsHeld == null ? 3 : t.yearsHeld, monthsToReset: t.monthsToReset == null ? 60 : t.monthsToReset,
        sample: false, saved: true
      };
    });
    var noticeGiven = true;
    var extraCosts = 0;
    var expectedCpi = 0;
    var lead = kind === 'loan'
      ? 'הזינו יתרה, ריבית וחודשים שנותרו. ההשוואה היא לממוצע הרשמי, בניכוי אומדן עמלת יציאה.'
      : 'הזינו כל מסלול משכנתא. החיסכון המשוער הוא מול ממוצע בנק ישראל, אחרי אומדן עמלת פירעון מוקדם.';
    el.innerHTML =
      '<div class="nc" id="' + (kind === 'loan' ? 'loans-compare' : 'mortgage-compare') + '">' +
      '<p class="muted" style="margin:0">' + lead + '</p>' +
      '<button type="button" class="btn pri block" id="nc-go">' + (tracks.length ? 'למסלולים שנשמרו במכשיר' : 'הזינו מסלול והשוו לריבית במשק') + '</button>' +
      (tracks.length ? '<div class="note">המסלולים נטענו מהנתונים שבמכשיר הזה. העמוד לא שולח אותם לשרת.</div>' : '') +
      '<div class="note">' + api.esc(rates.disclaimer || 'מידע בלבד, לא ייעוץ. הממוצעים אינם הצעה אישית.') + '</div>' +
      sourcesBlock(api, rates) +
      '<details><summary>איך מחשבים את האומדן</summary><p class="help">כל מסלול מושווה לממוצע בנק ישראל לפי הצמדה ולפי התקופה שנותרה. החיסכון המשוער הוא ההפרש בין יתרת התשלומים במסלול הנוכחי לבין יתרת התשלומים לפי הממוצע, בניכוי אומדן עמלת פירעון מוקדם. במסלול פריים אין עמלת היוון. במסלול משתנה האומדן מחושב עד מועד השינוי הבא. זה אומדן בלבד, לא ייעוץ.</p></details>' +
      '<div id="nc-tracks"></div>' +
      '<div class="row-actions"><button type="button" class="btn sec" id="nc-add">הוספת מסלול</button><button type="button" class="btn sec" id="nc-sample">מסלול לדוגמה</button></div>' +
      '<div class="card"><div class="fields">' +
      '<div class="field"><label for="fn-notice">הודעה מוקדמת</label><select id="fn-notice"><option value="yes">כן, ניתנה הודעה של 10 ימים</option><option value="no">לא ניתנה הודעה</option></select></div>' +
      '<div class="field"><label for="fn-extra">עלויות נוספות למחזור (₪)</label><input id="fn-extra" inputmode="numeric" value="0"></div>' +
      (kind === 'loan' ? '<div class="field"><label for="fn-cpi">אינפלציה שנתית צפויה למסלול צמוד (%)</label><input id="fn-cpi" inputmode="decimal" value="0"></div><p class="help">הזנת אינפלציה היא הנחה שלכם, לא תחזית של האתר.</p>' : '') +
      '</div></div>' +
      (kind === 'loan' ? '<details><summary>הדבקת לוח סילוקין</summary><p class="help">הקובץ נקרא רק בדפדפן. אפשר להדביק טבלה עם עמודות יתרה, תשלום וריבית.</p><textarea id="fn-paste" aria-label="לוח סילוקין להדבקה" placeholder="יתרה, תשלום, ריבית"></textarea><button type="button" class="btn sec block" id="fn-parse" style="margin-top:8px">פענוח הטבלה</button><p class="help" id="fn-parse-msg"></p></details>' : '') +
      '<div id="nc-out"></div>' +
      (kind === 'loan' ? equator(api, rates) : '') +
      '</div>';

    function drawTracks() {
      var box = document.getElementById('nc-tracks');
      if (!tracks.length) {
        box.innerHTML = '<div class="card empty" id="nc-focus"><b>אין מסלולים להשוואה</b>הוסיפו מסלול, או פתחו מסלול לדוגמה כדי לראות איך האומדן נראה.<button type="button" class="btn pri block" id="nc-empty" style="margin-top:12px">הוספת מסלול</button></div>';
        document.getElementById('nc-empty').addEventListener('click', function () { tracks.push(blankTrack(kind)); drawTracks(); drawResults(); });
        return;
      }
      box.innerHTML = tracks.map(function (tr, i) {
        return '<div class="track" id="' + (i === 0 ? 'nc-focus' : 'tr-' + i) + '">' +
          (tr.sample ? '<span class="badge demo">נתוני דוגמה</span>' : '') +
          '<div class="fields two">' +
          '<div class="field"><label for="nm' + i + '">שם</label><input id="nm' + i + '" value="' + api.esc(tr.name) + '"></div>' +
          '<div class="field"><label for="tp' + i + '">סוג</label><select id="tp' + i + '">' + types.map(function (o) {
            return '<option value="' + o.v + '"' + (o.v === tr.type ? ' selected' : '') + '>' + o.t + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field"><label for="bal' + i + '">יתרה (₪)</label><input id="bal' + i + '" inputmode="decimal" value="' + api.esc(tr.balance) + '"></div>' +
          '<div class="field"><label for="rt' + i + '">ריבית שנתית נומינלית (%)</label><input id="rt' + i + '" inputmode="decimal" value="' + api.esc(tr.rate) + '"></div>' +
          '<div class="field"><label for="mo' + i + '">חודשים שנותרו</label><input id="mo' + i + '" inputmode="numeric" value="' + api.esc(tr.months) + '"></div>' +
          (kind === 'loan' ? '<div class="field"><label for="pay' + i + '">החזר חודשי, אם ידוע (₪)</label><input id="pay' + i + '" inputmode="decimal" value="' + api.esc(tr.payment) + '"></div>' : '') +
          '<div class="field"><label for="yh' + i + '">שנים מאז לקיחת המסלול</label><input id="yh' + i + '" inputmode="decimal" value="' + api.esc(tr.yearsHeld) + '"></div>' +
          '<div class="field"><label for="mr' + i + '">חודשים עד שינוי הריבית</label><input id="mr' + i + '" inputmode="numeric" value="' + api.esc(tr.monthsToReset) + '"></div>' +
          '</div><div class="row-actions"><button type="button" class="btn sec" data-del="' + i + '">הסרת המסלול</button></div></div>';
      }).join('');
      tracks.forEach(function (tr, i) {
        function on(id, fn) {
          var node = document.getElementById(id);
          if (!node) return;
          node.addEventListener('input', fn);
          node.addEventListener('change', fn);
        }
        function touch(e) {
          if (!e.isTrusted || !tr.sample) return;
          tr.sample = false;
          var badge = e.target.closest('.track') && e.target.closest('.track').querySelector('.badge.demo');
          if (badge) badge.remove();
        }
        on('nm' + i, function (e) { tr.name = e.target.value; touch(e); });
        on('tp' + i, function (e) { tr.type = e.target.value; touch(e); drawResults(); });
        on('bal' + i, function (e) { tr.balance = e.target.value; touch(e); drawResults(); });
        on('rt' + i, function (e) { tr.rate = e.target.value; touch(e); drawResults(); });
        on('mo' + i, function (e) { tr.months = e.target.value; touch(e); drawResults(); });
        on('pay' + i, function (e) { tr.payment = e.target.value; touch(e); drawResults(); });
        on('yh' + i, function (e) { tr.yearsHeld = e.target.value; touch(e); drawResults(); });
        on('mr' + i, function (e) { tr.monthsToReset = e.target.value; touch(e); drawResults(); });
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-del]'), function (btn) {
        btn.addEventListener('click', function () {
          tracks.splice(Number(btn.getAttribute('data-del')), 1);
          drawTracks();
          drawResults();
        });
      });
    }

    function numOrNull(v) { return v === '' || v == null || !isFinite(+v) ? null : +v; }

    function summarize(tr) {
      var P = Number(tr.balance) || 0, N = Math.round(Number(tr.months) || 0), r = Number(tr.rate) || 0;
      var pay = tr.payment !== '' && Number(tr.payment) > 0 ? Number(tr.payment) : Lib().pmt(P, r, N, false);
      var cost = Lib().remainingCost(P, r, N, false);
      if (tr.payment !== '' && Number(tr.payment) > 0) cost = { pmt: pay, totalPaid: pay * N, interest: pay * N - P };
      var implied = (tr.payment !== '' && Number(tr.payment) > 0 && P && N) ? Lib().impliedNominalRate(P, Number(tr.payment), N) : r;
      var cpiSched = null;
      if (kind === 'loan' && (tr.type === 't_fixed_linked' || tr.type === 't_var_linked') && expectedCpi) {
        cpiSched = Lib().spitzerSchedule(P, r, N, { cpiAnnualPct: expectedCpi });
      }
      return { pmt: pay, totalPaid: cost.totalPaid, interest: cost.interest, implied: implied, cpiSched: cpiSched };
    }

    function oneResult(tr, idx) {
      var ready = Number(tr.balance) > 0 && Number(tr.months) > 0 && tr.rate !== '' && tr.rate != null;
      var name = api.esc(tr.name || ('מסלול ' + (idx + 1)));
      var label = api.esc(typeLabel(types, tr.type));
      if (!ready) {
        return { html: '<div class="nc-item"><b>' + name + ' · ' + label + '</b><p class="help">יש להזין יתרה, ריבית וחודשים שנותרו.</p></div>', net: null, title: name, value: '—', sub: 'חסרים נתונים' };
      }
      var sum = summarize(tr);
      var marketTxt = '—', newPmt = null, feeTxt = '—', net = null, note = '';
      if (tr.type === 't_consumer') {
        var cm = Lib().consumerMarketRate(rates, tr.months);
        if (cm && cm.averagePct != null) {
          var neu = Lib().remainingCost(tr.balance, cm.averagePct, tr.months, true);
          marketTxt = rate(api, cm.averagePct);
          newPmt = neu.pmt;
          var fee = 60 + extraCosts;
          feeTxt = money(api, fee);
          net = sum.totalPaid - neu.totalPaid - fee;
          note = 'אשראי לא לדיור. בלי עמלת היוון מחושבת, רק עמלה תפעולית של 60 ₪.';
        }
      } else {
        var ref = Lib().refinanceTrack({
          name: tr.name, type: tr.type, balance: Number(tr.balance), rate: Number(tr.rate), months: Number(tr.months),
          yearsHeld: numOrNull(tr.yearsHeld) || 0, monthsToReset: numOrNull(tr.monthsToReset)
        }, rates, { noticeGiven: noticeGiven, extraCosts: extraCosts });
        if (ref && ref.marketPct != null) {
          marketTxt = rate(api, ref.marketPct);
          newPmt = ref.newPmt;
          feeTxt = ref.fee ? money(api, ref.fee.total) : '—';
          net = ref.netSaving;
          note = (ref.marketLabel || '') + (ref.fee && ref.fee.notes && ref.fee.notes.length ? ' ' + ref.fee.notes.join(' ') : '');
        } else note = 'לא פורסם ממוצע מתאים למסלול הזה.';
      }
      var pairs = [
        ['הריבית שלכם', rate(api, Number(tr.rate))],
        ['תשלום היום', money(api, sum.pmt)],
        ['ריבית ממוצעת בשוק', marketTxt],
        ['תשלום לפי הממוצע', money(api, newPmt)],
        ['עמלת יציאה משוערת', feeTxt],
        ['חיסכון נטו משוער', net == null ? '—' : money(api, net)]
      ];
      if (sum.cpiSched) pairs.push(['עלות עם האינפלציה שהוזנה', money(api, sum.cpiSched.totalPaid)]);
      if (kind === 'loan' && sum.implied != null) pairs.splice(1, 0, ['ריבית מחושבת מההחזר', rate(api, sum.implied)]);
      return {
        net: net,
        title: name + ' · ' + label,
        value: net == null ? '—' : money(api, net),
        sub: 'חיסכון נטו משוער ליתרת התקופה, אחרי אומדן עמלת יציאה.',
        html: '<div class="nc-item"><div class="hd"><b>' + name + ' · ' + label + (tr.sample ? ' <span class="badge demo">נתוני דוגמה</span>' : '') + '</b><span class="' + (net == null ? '' : net >= 0 ? 'gain' : 'loss') + '">' + (net == null ? '—' : money(api, net)) + '</span></div>' + kv(pairs) + (note ? '<p class="help">' + api.esc(note) + '</p>' : '') + '</div>'
      };
    }

    function drawResults() {
      var out = document.getElementById('nc-out');
      if (!tracks.length) { out.innerHTML = ''; return; }
      var rows = tracks.map(oneResult);
      var ranked = rows.filter(function (r) { return r.net != null; }).slice().sort(function (a, b) { return b.net - a.net; }).slice(0, 3);
      out.innerHTML =
        '<h2 class="sec" style="margin-top:4px">המסלולים עם החיסכון המשוער הגבוה ביותר</h2>' +
        (ranked.length ? top3(ranked) : '<div class="card empty"><b>עדיין אין אומדן</b>השלימו יתרה, ריבית וחודשים שנותרו.</div>') +
        '<section class="card">' + rows.map(function (r) { return r.html; }).join('') + '</section>' +
        '<p class="help">החיסכון הנטו הוא הערכה: עלות נותרת נוכחית פחות עלות בממוצע השוק, פחות עמלת פירעון מוקדם מוערכת ועלויות נוספות. הממוצע אינו הצעה אישית.</p>';
    }

    document.getElementById('nc-add').addEventListener('click', function () {
      tracks.push(blankTrack(kind));
      drawTracks();
      drawResults();
    });
    document.getElementById('nc-sample').addEventListener('click', function () {
      tracks.push(sampleTrack(kind));
      drawTracks();
      drawResults();
      scrollTop();
    });
    document.getElementById('fn-notice').addEventListener('change', function (e) { noticeGiven = e.target.value !== 'no'; drawResults(); });
    document.getElementById('fn-extra').addEventListener('input', function (e) { extraCosts = Number(e.target.value) || 0; drawResults(); });
    var cpi = document.getElementById('fn-cpi');
    if (cpi) cpi.addEventListener('input', function (e) { expectedCpi = Number(e.target.value) || 0; drawResults(); });
    document.getElementById('nc-go').addEventListener('click', function () {
      if (!tracks.length) { tracks.push(blankTrack(kind)); drawTracks(); }
      var box = document.getElementById('nc-focus');
      if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = box && box.querySelector('input, select');
      if (first && first.focus) first.focus();
    });
    var parseBtn = document.getElementById('fn-parse');
    if (parseBtn) parseBtn.addEventListener('click', function () {
      var msg = document.getElementById('fn-parse-msg');
      var res = Lib().parseAmortizationMatrixOrText(document.getElementById('fn-paste').value);
      if (!res || !res.rows || !res.rows.length || !(res.remainingBalance > 0)) {
        msg.textContent = 'לא זיהינו יתרה בטבלה. צריך עמודת יתרה, ואפשר גם תשלום וריבית.';
        return;
      }
      var lastPay = null;
      for (var i = res.rows.length - 1; i >= 0; i--) { if (res.rows[i].payment > 0) { lastPay = res.rows[i].payment; break; } }
      tracks.push({
        id: 'paste', name: 'מלוח הסילוקין', type: 't_consumer', balance: res.remainingBalance,
        rate: '', months: res.paymentsCount || '', payment: lastPay || '', yearsHeld: 3, monthsToReset: 60, sample: false
      });
      msg.textContent = 'נוספה יתרה של ' + Math.round(res.remainingBalance).toLocaleString('en-US') + ' ₪ מהטבלה. הריבית לא נשלחת לשום מקום.';
      drawTracks();
      drawResults();
    });
    drawTracks();
    drawResults();
  }

  function equator(api, rates) {
    var block = rates.equatorHouseholdCredit;
    if (!block || !block.byLenderMean) return '';
    var rows = block.byLenderMean.slice().sort(function (a, b) { return a.averagePct - b.averagePct; });
    return '<section class="card"><h2 style="margin:0 0 8px;font-size:17px">ריבית ממוצעת על אשראי למשקי בית</h2><p class="help">ממוצע מערכת ' + rate(api, block.systemAveragePct) + ' · חודש דיווח ' + api.esc(block.period || '') + '. מידע בלבד.</p>' +
      rows.map(function (r) {
        return '<div class="nc-item"><div class="hd"><b>' + api.esc(r.providerHe) + '</b><span>' + rate(api, r.averagePct) + '</span></div></div>';
      }).join('') +
      '<p class="help src">' + link('https://www.boi.org.il/information/bank-paymnts/financial-education/campaigns/boi-equator/loans/', 'בנק ישראל, קו המשווה — אשראי למשקי בית', api.esc) + '</p></section>';
  }

  function mortgage(el, api) {
    loading(el);
    if (!Lib()) { failed(el, 'מחשבון ההשוואה לא נטען. רעננו את העמוד.'); return; }
    loadJson('../data/loan-rates.json').then(function (rates) { finance(el, api, 'mortgage', rates); })
      .catch(function () { failed(el, 'לא ניתן לטעון את ממוצעי בנק ישראל כרגע. הנתונים לא הומצאו.'); });
  }
  function loans(el, api) {
    loading(el);
    if (!Lib()) { failed(el, 'מחשבון ההשוואה לא נטען. רעננו את העמוד.'); return; }
    loadJson('../data/loan-rates.json').then(function (rates) { finance(el, api, 'loan', rates); })
      .catch(function () { failed(el, 'לא ניתן לטעון את ממוצעי בנק ישראל כרגע. הנתונים לא הומצאו.'); });
  }

  window.NextCompare = { savings: savings, cards: cards, mortgage: mortgage, loans: loans };
})();
