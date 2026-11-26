/* Israeli employee income-tax helper, tax year 2026: credit points, possible annual refund, and employee options (section 102). Estimates only. */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  /* Official figures, Israel Tax Authority deductions booklet for 2026 (updated April 2026, after the 31.3.2026 bracket change). */
  var Y = {
    year: 2026, asOf: 'אפריל 2026',
    src: 'https://www.gov.il/BlobFolder/generalpage/income-tax-monthly-deductions-booklet/he/generalInformation_income-tax-monthly-deductions-booklet_monthly-deductions-booklet-2026.pdf',
    brackets: [[84120, 10], [120720, 14], [228000, 20], [301200, 31], [560280, 35], [Infinity, 47]],
    point: 2904, // 242 a month
    surtaxFrom: 721560, surtax: 3,
    insuredCeilingMonth: 19400, // section 45A(e)(2): ceiling of income for the pension / life-insurance credit
    donationMin: 207, donationRate: 35
  };
  /* Child points by the age the child reaches in the tax year (mother / father). */
  var CHILD = [['0', 'שנת הלידה', 2.5, 2.5], ['1', 'גיל 1 או 2', 4.5, 4.5], ['3', 'גיל 3', 3.5, 3.5], ['4', 'גיל 4 או 5', 2.5, 2.5], ['6', 'גיל 6 עד 17', 2, 1], ['18', 'גיל 18', 0.5, 0]];
  function bracketTax(inc) { var t = 0, prev = 0; Y.brackets.forEach(function (b) { if (inc > prev) { t += (Math.min(inc, b[0]) - prev) * b[1] / 100; } prev = b[0]; }); return t; }
  function marginal(inc) { for (var i = 0; i < Y.brackets.length; i++) if (inc <= Y.brackets[i][0]) return Y.brackets[i][1]; return 47; }
  function points(st) {
    var p = 2.25, rows = [['תושב/ת ישראל', 2.25]];
    if (st.woman) { p += 0.5; rows.push(['אישה', 0.5]); }
    if (st.soldier === 'full') { p += 2; rows.push(['חייל/ת משוחרר/ת, שירות מלא', 2]); } else if (st.soldier === 'part') { p += 1; rows.push(['חייל/ת משוחרר/ת, שירות חלקי', 1]); }
    if (st.degree === 'ba') { p += 1; rows.push(['תואר ראשון', 1]); } else if (st.degree === 'ma') { p += 0.5; rows.push(['תואר שני', 0.5]); }
    if (st.single) { p += 1; rows.push(['הורה יחיד', 1]); }
    var kids = 0, col = st.parent === 'father' ? 3 : 2;
    CHILD.forEach(function (c) { var n = Math.max(0, Math.round(T.num((st.kids || {})[c[0]]))); if (!n) return; var v = n * c[col] * (st.single ? 2 : 1); kids += v; rows.push([n + ' ילדים, ' + c[1], v]); });
    p += kids;
    var ex = T.num(st.extraPoints); if (ex) { p += ex; rows.push(['נקודות נוספות שהזנת', ex]); }
    return { total: p, rows: rows };
  }
  function annual(st) {
    var gross = T.num(st.gross), months = Math.max(1, Math.min(12, T.num(st.months) || 12));
    var pts = points(st), base = bracketTax(gross) + Math.max(0, gross - Y.surtaxFrom) * Y.surtax / 100;
    var ptsCredit = pts.total * Y.point * months / 12;
    var cap = 0.07 * Math.min(gross, Y.insuredCeilingMonth * months);
    var pen = Math.min(T.num(st.pensionOwn), cap), life = Math.min(T.num(st.lifeIns), Math.max(0, cap - pen));
    var insCredit = pen * 0.35 + life * 0.25;
    var don = T.num(st.donations), donCredit = don >= Y.donationMin ? Math.min(don, gross * 0.3) * Y.donationRate / 100 : 0;
    var tax = Math.max(0, base - ptsCredit - insCredit - donCredit);
    var withheld = T.numOrNull(st.withheld);
    return { gross: gross, base: base, pts: pts, ptsCredit: ptsCredit, insCredit: insCredit, donCredit: donCredit, tax: tax, withheld: withheld, diff: withheld === null ? null : withheld - tax, marginal: marginal(gross) };
  }
  function optionItems() {
    var o = null; try { o = JSON.parse(localStorage.getItem('options-calc-v5-private') || 'null'); } catch (e) {}
    var quotes = {}; try { quotes = JSON.parse(localStorage.getItem('portal-quotes-v1') || '{}') || {}; } catch (e) {}
    var out = [];
    if (o && o.data) Object.keys(o.data).forEach(function (sym) {
      var d = o.data[sym]; if (!d) return; var q = T.num(d.t1) + T.num(d.t2) + T.num(d.t3); if (!(q > 0)) return;
      var sell = T.num(d.sell) > 0 ? T.num(d.sell) : (quotes[sym] && quotes[sym].price > 0 ? quotes[sym].price : null);
      var strike = Math.max(0, T.num(d.strike) - T.num(d.div) * T.num(d.years));
      out.push({ sym: sym, qty: q, strike: strike, sell: sell, cur: /\.TA$/i.test(sym) ? 'ILS' : 'USD' });
    });
    return out;
  }
  function render(main) {
    var st = T.read('tax', { woman: false, parent: 'mother', single: false, soldier: 'none', degree: 'none', kids: {}, extraPoints: null, gross: null, months: 12, withheld: null, pensionOwn: null, lifeIns: null, donations: null, opt: {} });
    if (!st.kids) st.kids = {}; if (!st.opt) st.opt = {};
    function save() { T.write('tax', st); }
    var ptsOut = h('div', { 'aria-live': 'polite' }), refOut = h('div', { 'aria-live': 'polite' }), optOut = h('div', { 'aria-live': 'polite' });
    function drawPts() {
      ptsOut.innerHTML = ''; var p = points(st);
      ptsOut.appendChild(h('div', { class: 'totals' }, [T.tot('נקודות זיכוי משוערות', T.fmt(p.total, 2), 'big'), T.tot('שווי בחודש', T.disp(p.total * Y.point / 12)), T.tot('שווי בשנה', T.disp(p.total * Y.point))]));
      ptsOut.appendChild(h('ul', { class: 't13-list' }, p.rows.map(function (r) { return h('li', null, [h('span', { text: r[0] }), h('span', { class: 'num', text: T.fmt(r[1], 2) })]); })));
    }
    function drawRef() {
      refOut.innerHTML = ''; var a = annual(st);
      if (!(a.gross > 0)) { refOut.appendChild(h('p', { class: 'empty', text: 'מזינים את ההכנסה החייבת השנתית ואת המס שנוכה, כפי שמופיעים בטופס 106 מהמעסיק.' })); return; }
      var items = [T.tot('מס משוער לשנה', T.disp(a.tax), 'big'), T.tot('מדרגת המס השולית', a.marginal + '%')];
      if (a.diff !== null) items.unshift(T.tot(a.diff >= 0 ? 'החזר אפשרי' : 'ייתכן חוב מס', T.disp(Math.abs(a.diff)), 'big ' + (a.diff >= 0 ? 'pos' : 'neg')));
      refOut.appendChild(h('div', { class: 'totals' }, items));
      refOut.appendChild(h('ul', { class: 't13-list' }, [['מס לפי המדרגות', a.base], ['פחות נקודות זיכוי', -a.ptsCredit], ['פחות זיכוי על פנסיה וביטוח חיים', -a.insCredit], ['פחות זיכוי על תרומות', -a.donCredit]].map(function (r) { return h('li', null, [h('span', { text: r[0] }), h('span', { class: 'num', text: T.disp(r[1]) })]); })));
      if (a.diff !== null && a.diff > 200) refOut.appendChild(h('p', { class: 'notice blue' }, ['אם ההערכה נכונה, אפשר לבדוק בסימולטור של רשות המסים ולהגיש בקשה להחזר מס (טופס 135), עד 6 שנים אחורה. ', h('a', { href: 'https://www.gov.il/he/service/itc135', target: '_blank', rel: 'noopener', text: 'בקשה להחזר מס' })]));
    }
    function drawOpt() {
      optOut.innerHTML = ''; var items = optionItems();
      if (!items.length) { optOut.appendChild(h('p', { class: 'empty' }, ['לא נמצאו אופציות שמורות. אפשר להזין אותן ב', h('a', { href: 'options.html', text: 'מחשבון האופציות' }), '.'])); return; }
      items.forEach(function (it) {
        var o = st.opt[it.sym] = st.opt[it.sym] || {};
        var box = h('div', { class: 'row-card' }), res = h('div', { 'aria-live': 'polite' });
        function calc() {
          res.innerHTML = '';
          var avg = T.numOrNull(o.avg30), sell = T.numOrNull(o.sell) !== null ? T.num(o.sell) : it.sell;
          if (avg === null || sell === null) { res.appendChild(h('p', { class: 'help', text: 'צריך את ממוצע 30 ימי המסחר שלפני ההענקה ומחיר מכירה.' })); return; }
          var ordUnit = Math.max(0, Math.min(avg, sell) - it.strike), capUnit = Math.max(0, sell - Math.max(avg, it.strike));
          var ordinary = ordUnit * it.qty, capital = capUnit * it.qty, conv = function (v) { var x = T.toILS(v, it.cur); return x === null ? v : x; };
          var g = T.num(st.gross), rate = T.num(o.marg) || marginal(g + conv(ordinary)), rateAll = T.num(o.marg) || marginal(g + conv(ordinary + capital));
          var taxCap = ordinary * rate / 100 + capital * 0.25, taxOrd = ordinary * rate / 100 + capital * rateAll / 100, d = conv(taxOrd - taxCap);
          res.appendChild(h('div', { class: 'totals' }, [T.tot('רווח לפני מס', T.disp(conv(ordinary + capital))), T.tot('מס במסלול ההוני', T.disp(conv(taxCap)), 'big'), T.tot('מס אם הכול כהכנסת עבודה', T.disp(conv(taxOrd))),
            d >= 0 ? T.tot('המסלול ההוני חוסך', T.disp(d), 'pos') : T.tot('בשיעור מס כזה המסלול ההוני יקר יותר ב־', T.disp(-d), 'neg')]));
          res.appendChild(h('p', { class: 'help', text: 'במסלול ההוני: ' + T.money(ordUnit, it.cur, 2) + ' לאופציה (עד ממוצע 30 הימים) ממוסים כהכנסת עבודה, כאן לפי ' + rate + '% (וגם ביטוח לאומי ומס בריאות), ו־' + T.money(capUnit, it.cur, 2) + ' לאופציה (מעל הממוצע) ב־25% מס רווח הון.' }));
        }
        box.appendChild(h('strong', { text: it.sym + ' · ' + T.fmt(it.qty) + ' אופציות · מחיר מימוש ' + T.money(it.strike, it.cur, 2) }));
        box.appendChild(h('div', { class: 'fields' }, [
          T.field('ממוצע 30 ימי מסחר לפני ההענקה (' + it.cur + ')', 'number', o.avg30, function (v) { o.avg30 = v; save(); calc(); }),
          T.field('מחיר מכירה (' + it.cur + ')', 'number', o.sell, function (v) { o.sell = v; save(); calc(); }, { placeholder: it.sell ? String(it.sell) : '', help: 'ריק = המחיר מהמחשבון או המחיר האחרון' }),
          T.field('מדרגת מס שולית (%)', 'number', o.marg, function (v) { o.marg = v; save(); calc(); }, { help: 'ריק = לפי השכר שהזנת למעלה ועוד הרווח מהאופציות' })
        ]));
        box.appendChild(res); calc(); optOut.appendChild(box);
      });
    }
    var kidsFields = CHILD.map(function (c) { return T.field(c[1], 'number', st.kids[c[0]], function (v) { st.kids[c[0]] = v; save(); drawPts(); drawRef(); }, { step: '1', min: 0, max: 15 }); });
    var ptsForm = h('div', { class: 'fields' }, [
      T.field('אני אישה', 'check', st.woman, function (v) { st.woman = v; save(); drawPts(); drawRef(); }),
      T.field('הורה יחיד', 'check', st.single, function (v) { st.single = v; save(); drawPts(); drawRef(); }),
      T.field('נקודות הילדים לפי', 'select', st.parent, function (v) { st.parent = v; save(); drawPts(); drawRef(); }, { options: [['mother', 'אם, או ההורה שהילדים אצלו'], ['father', 'אב, או ההורה השני']] }),
      T.field('שירות צבאי או לאומי', 'select', st.soldier, function (v) { st.soldier = v; save(); drawPts(); drawRef(); }, { options: [['none', 'לא, או עברו 3 שנים מהשחרור'], ['full', 'שירות מלא, ב־3 השנים האחרונות'], ['part', 'שירות חלקי (שנה לפחות), ב־3 השנים האחרונות']] }),
      T.field('סיום תואר', 'select', st.degree, function (v) { st.degree = v; save(); drawPts(); drawRef(); }, { options: [['none', 'לא בשנה הרלוונטית'], ['ba', 'תואר ראשון'], ['ma', 'תואר שני']] }),
      T.field('נקודות נוספות', 'number', st.extraPoints, function (v) { st.extraPoints = v; save(); drawPts(); drawRef(); }, { help: 'למשל מילואים כלוחם, יישוב מזכה, עולה חדש. לפי אישור או מחשבון רשות המסים.' })
    ].concat([h('p', { class: 'help wide', style: 'grid-column:1/-1;margin:6px 0 0', text: 'מספר ילדים לפי הגיל שהם מגיעים אליו בשנת 2026:' })]).concat(kidsFields));
    var refForm = h('div', { class: 'fields' }, [
      T.field('הכנסה חייבת בשנה (₪)', 'number', st.gross, function (v) { st.gross = v; save(); drawRef(); drawOpt(); }, { help: 'מטופס 106, משדה "הכנסה חייבת". אם עבדת בכמה מקומות, מחברים.' }),
      T.field('מס הכנסה שנוכה בשנה (₪)', 'number', st.withheld, function (v) { st.withheld = v; save(); drawRef(); }),
      T.field('חודשי עבודה בשנה', 'number', st.months, function (v) { st.months = v; save(); drawRef(); }, { step: '1', min: 1, max: 12 }),
      T.field('הפקדות שלך לפנסיה בשנה (₪)', 'number', st.pensionOwn, function (v) { st.pensionOwn = v; save(); drawRef(); }, { help: 'רק חלק העובד.' }),
      T.field('ביטוח חיים פרטי בשנה (₪)', 'number', st.lifeIns, function (v) { st.lifeIns = v; save(); drawRef(); }),
      T.field('תרומות למוסד מוכר בשנה (₪)', 'number', st.donations, function (v) { st.donations = v; save(); drawRef(); })
    ]);
    drawPts(); drawRef(); drawOpt();
    main.appendChild(h('p', { class: 'notice blue', text: 'מידע בלבד, לא ייעוץ. החישוב מפושט ומיועד להערכה. הזכאות והמס בפועל נקבעים לפי החוק והאישורים.' }));
    main.appendChild(T.card('נקודות זיכוי ' + Y.year, [ptsForm, ptsOut]));
    main.appendChild(T.card('הערכת החזר מס שנתי', [refForm, refOut]));
    main.appendChild(T.card('מיסוי אופציות לעובדים (סעיף 102, מסלול רווח הון)', [h('p', { class: 'help', text: 'בחברה נסחרת, במסלול ההוני עם נאמן: החלק שעד ממוצע 30 ימי המסחר שלפני ההענקה ממוסה כהכנסת עבודה, והרווח שמעליו ב־25%. המסלול מחייב החזקה אצל נאמן 24 חודשים לפחות מההענקה. ייתכן גם מס יסף על הכנסה גבוהה.' }), optOut, h('div', { class: 'toolbar' }, [h('a', { class: 'btn btn-soft', href: 'options.html', text: 'למחשבון האופציות' })])]));
    main.appendChild(T.card('מקורות', [h('ul', { class: 't13-list' }, [
      h('li', null, [h('a', { href: Y.src, target: '_blank', rel: 'noopener', text: 'רשות המסים: לוח ניכויים ' + Y.year }), h('span', { text: 'מעודכן ל' + Y.asOf })]),
      h('li', null, [h('a', { href: 'https://secapp.taxes.gov.il/srsimulatorNZ/', target: '_blank', rel: 'noopener', text: 'רשות המסים: מחשבון נקודות זיכוי' }), h('span', { text: 'לבדיקה מדויקת' })])
    ]), h('p', { class: 'help', text: 'מדרגות ' + Y.year + ': 10% עד 84,120 ₪, 14% עד 120,720, 20% עד 228,000, 31% עד 301,200, 35% עד 560,280, ו־47% מעל. נקודת זיכוי: 242 ₪ בחודש. מס יסף 3% מעל 721,560 ₪.' })]));
    T.onRemote(function () { location.reload(); });
  }
  window.T13Tax = { bracketTax: bracketTax, annual: annual, points: points };
  T.page('tax', 'מס הכנסה ' + Y.year, 'נקודות זיכוי, הערכת החזר מס ומיסוי אופציות', render);
})();
