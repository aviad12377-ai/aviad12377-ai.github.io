/* Shared comparison math and parsers. Browser + Node. No personal data. */
(function (root) {
  'use strict';

  function n(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (v == null) return 0;
    var s = String(v).replace(/[\s\u00a0]/g, '').replace(/,/g, '');
    s = s.replace(/[^\d.\-]/g, '');
    var x = parseFloat(s);
    return Number.isFinite(x) ? x : 0;
  }
  function nn(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    var s = String(v).replace(/[\s\u00a0]/g, '').replace(/,/g, '');
    s = s.replace(/[^\d.\-]/g, '');
    var x = parseFloat(s);
    return Number.isFinite(x) ? x : null;
  }
  function round(v, d) {
    if (!Number.isFinite(v)) return v;
    var p = Math.pow(10, d == null ? 2 : d);
    return Math.round(v * p) / p;
  }

  /* Nominal annual % -> monthly rate (portal convention). */
  function monthlyNominal(annualPct) {
    return n(annualPct) / 1200;
  }
  /* Effective annual % (Bank of Israel) -> monthly equivalent. */
  function monthlyEffective(annualPct) {
    var a = n(annualPct) / 100;
    if (a <= -1) return 0;
    return Math.pow(1 + a, 1 / 12) - 1;
  }
  function effectiveFromNominal(annualPct) {
    var r = monthlyNominal(annualPct);
    return (Math.pow(1 + r, 12) - 1) * 100;
  }

  /* Spitzer / French PMT. rateIsEffective: treat annualPct as BOI-style effective. */
  function pmt(principal, annualPct, months, rateIsEffective) {
    var P = n(principal), N = Math.round(n(months));
    if (!(P > 0) || !(N > 0)) return 0;
    var r = rateIsEffective ? monthlyEffective(annualPct) : monthlyNominal(annualPct);
    if (Math.abs(r) < 1e-12) return P / N;
    return P * r / (1 - Math.pow(1 + r, -N));
  }

  function remainingCost(principal, annualPct, months, rateIsEffective) {
    var P = n(principal), N = Math.round(n(months));
    var pay = pmt(P, annualPct, N, rateIsEffective);
    return { pmt: pay, totalPaid: pay * N, interest: pay * N - P };
  }

  /* Build a Spitzer schedule. Optional monthly CPI (as annual expected inflation %). */
  function spitzerSchedule(principal, annualPct, months, opts) {
    opts = opts || {};
    var P = n(principal), N = Math.round(n(months));
    var r = opts.rateIsEffective ? monthlyEffective(annualPct) : monthlyNominal(annualPct);
    var cpiM = opts.cpiAnnualPct != null && n(opts.cpiAnnualPct) !== 0
      ? Math.pow(1 + n(opts.cpiAnnualPct) / 100, 1 / 12) - 1
      : 0;
    var rows = [], bal = P, pay0 = r && !cpiM ? P * r / (1 - Math.pow(1 + r, -N)) : (N ? P / N : 0);
    if (!r && !cpiM) pay0 = P / N;
    for (var i = 1; i <= N; i++) {
      if (cpiM) bal = bal * (1 + cpiM);
      var interest = bal * r;
      var remainMonths = N - i + 1;
      var pay = cpiM && r ? bal * r / (1 - Math.pow(1 + r, -remainMonths)) : (r ? pay0 : (remainMonths ? bal / remainMonths : 0));
      if (!r) pay = remainMonths ? bal / remainMonths : 0;
      var princ = pay - interest;
      if (princ > bal) { princ = bal; pay = princ + interest; }
      bal = Math.max(0, bal - princ);
      if (i === N) { princ += bal; pay = princ + interest; bal = 0; }
      rows.push({ month: i, payment: pay, principal: princ, interest: interest, balance: bal, indexation: cpiM ? (rows.length ? null : null) : 0 });
    }
    var totP = 0, totI = 0, totPay = 0;
    rows.forEach(function (row) { totP += row.principal; totI += row.interest; totPay += row.payment; });
    return { rows: rows, totalPrincipal: totP, totalInterest: totI, totalPaid: totPay, finalBalance: bal };
  }

  /* Solve unknown annual nominal rate given P, pmt, N (Newton). */
  function impliedNominalRate(principal, payment, months) {
    var P = n(principal), A = n(payment), N = Math.round(n(months));
    if (!(P > 0) || !(A > 0) || !(N > 0)) return null;
    if (A * N < P) return 0;
    var r = 0.005, i, f, df, pr;
    for (i = 0; i < 40; i++) {
      if (Math.abs(r) < 1e-14) {
        f = P / N - A;
        df = 0;
        r = 0.001;
        continue;
      }
      pr = Math.pow(1 + r, -N);
      f = P * r / (1 - pr) - A;
      df = P * ((1 - pr) - r * N * pr / (1 + r)) / Math.pow(1 - pr, 2);
      if (Math.abs(df) < 1e-16) break;
      r = r - f / df;
      if (r <= -0.99) r = -0.5;
    }
    return r * 1200;
  }

  function pickEarlyRepaymentAverage(loanRates, linkage, monthsLeft) {
    var block = loanRates && loanRates.mortgageEarlyRepaymentAverages;
    if (!block) return null;
    var pack = linkage === 'cpi' || linkage === 't_fixed_linked' || linkage === 't_var_linked' ? block.cpiIndexed : block.unlinked;
    if (!pack || !pack.ratesByRemainingTerm) return null;
    var years = n(monthsLeft) / 12;
    var key, rates = pack.ratesByRemainingTerm;
    if (pack.linkage === 'cpi') {
      if (years <= 5) key = 'up_to_5y';
      else if (years <= 10) key = '5_to_10y';
      else if (years <= 15) key = '10_to_15y';
      else if (years <= 20) key = '15_to_20y';
      else if (years <= 25) key = '20_to_25y';
      else key = 'over_25y';
    } else {
      if (years <= 1) key = 'up_to_1y';
      else if (years <= 5) key = '1_to_5y';
      else if (years <= 10) key = '5_to_10y';
      else if (years <= 15) key = '10_to_15y';
      else if (years <= 20) key = '15_to_20y';
      else if (years <= 25) key = '20_to_25y';
      else key = 'over_25y';
    }
    var avg = rates[key];
    if (avg == null) avg = rates.average;
    return { averagePct: avg, bucket: key, pack: pack };
  }

  function holdingDiscountPct(yearsHeld) {
    var y = n(yearsHeld);
    if (y >= 5) return 30;
    if (y >= 3) return 20;
    return 0;
  }

  /* Estimate עמלת פירעון מוקדם (capitalization) per BOI housing-loan order, clearly an estimate.
     loanAnnualPct is treated as nominal unless loanRateIsEffective.
     marketAnnualPct is BOI effective average.
     For prime / variable-at-least-yearly: capitalization = 0.
     For 5-year variable: horizon = months until next reset (remaining principal as balloon). */
  function earlyRepaymentFee(opts) {
    opts = opts || {};
    var P = n(opts.balance), N = Math.round(n(opts.monthsLeft));
    var op = opts.operationalFeeIls != null ? n(opts.operationalFeeIls) : 60;
    var noticeOk = opts.noticeGiven !== false;
    var noNotice = noticeOk ? 0 : n(P) * 0.001;
    var track = opts.track || 't_fixed_unlinked';
    var yearsHeld = n(opts.yearsHeld);
    var result = {
      operational: op,
      noNotice: noNotice,
      capitalization: 0,
      discountPct: holdingDiscountPct(yearsHeld),
      grossCapitalization: 0,
      total: op + noNotice,
      applies: true,
      method: 'estimate',
      notes: []
    };
    if (track === 't_prime' || opts.rateChangesYearly) {
      result.applies = false;
      result.notes.push('במסלול פריים, או כשמועד שינוי הריבית אינו ידוע או שהוא לפחות אחת לשנה, אין עמלת היוון.');
      return result;
    }
    if (!(P > 0) || !(N > 0)) return result;
    var horizon = N;
    if (opts.monthsToReset != null && n(opts.monthsToReset) > 0 && n(opts.monthsToReset) < N) {
      horizon = Math.round(n(opts.monthsToReset));
      result.notes.push('במסלול משתנה, העמלה מחושבת רק עד מועד השינוי הבא, ויתרת הקרן באותו מועד נחשבת לתשלום אחרון.');
    }
    var R = opts.loanRateIsEffective ? monthlyEffective(opts.loanAnnualPct) : monthlyNominal(opts.loanAnnualPct);
    var A = monthlyEffective(opts.marketAnnualPct);
    var pay = pmt(P, opts.loanAnnualPct, N, opts.loanRateIsEffective);
    function pv(rate, periods, balloonAtEnd) {
      var s = 0, i;
      for (i = 1; i <= periods; i++) s += pay / Math.pow(1 + rate, i);
      if (balloonAtEnd > 0) s += balloonAtEnd / Math.pow(1 + rate, periods);
      return s;
    }
    var balloon = 0;
    if (horizon < N) {
      /* remaining principal after `horizon` payments on the original loan */
      var bal = P, i, interest, princ;
      for (i = 1; i <= horizon; i++) {
        interest = bal * R;
        princ = pay - interest;
        if (princ > bal) princ = bal;
        bal = Math.max(0, bal - princ);
      }
      balloon = bal;
    }
    var pvA = pv(A, horizon, balloon);
    var pvR = pv(R, horizon, balloon);
    /* When A < R, pvA > pvR and the difference is the economic loss (fee). */
    var cap = pvA - pvR;
    if (cap < 0) cap = 0;
    result.grossCapitalization = cap;
    result.capitalization = cap * (1 - result.discountPct / 100);
    result.total = result.operational + result.noNotice + result.capitalization;
    if (opts.originationAveragePct != null && nn(opts.originationAveragePct) != null) {
      var A0 = monthlyEffective(opts.originationAveragePct);
      var pvA0 = pv(A0, horizon, balloon);
      var cap0 = pvA - pvA0;
      if (cap0 < 0) cap0 = 0;
      var cap0net = cap0 * (1 - result.discountPct / 100);
      if (cap0net < result.capitalization) {
        result.notes.push('נלקח הנמוך מבין החישוב מול הממוצע היום ומול הממוצע במועד העמדת ההלוואה.');
        result.capitalization = cap0net;
        result.grossCapitalization = cap0;
        result.total = result.operational + result.noNotice + result.capitalization;
      }
    } else {
      result.notes.push('לא הוזן ממוצע במועד העמדת ההלוואה, לכן חושב רק מול הממוצע הנוכחי. הבנק רשאי לגבות את הנמוך מבין שני החישובים.');
    }
    return result;
  }

  function refinanceTrack(track, loanRates, opts) {
    opts = opts || {};
    var P = n(track.balance), N = Math.round(n(track.months != null ? track.months : track.monthsLeft));
    var rate = n(track.rate);
    if (!(P > 0) || !(N > 0)) return null;
    var type = track.type || track.track || 't_other';
    var current = remainingCost(P, rate, N, false);
    var market = null, marketLabel = '', marketNote = '';
    var linkage = (type === 't_fixed_linked' || type === 't_var_linked') ? 'cpi' : 'unlinked';
    var er = pickEarlyRepaymentAverage(loanRates, linkage, N);
    if (type === 't_prime' && loanRates && loanRates.policyRate && loanRates.policyRate.typicalPrimePct != null) {
      market = loanRates.policyRate.typicalPrimePct;
      marketLabel = 'פריים טיפוסי (ריבית בנק ישראל + 1.5%)';
      marketNote = loanRates.trackNotes && loanRates.trackNotes.t_prime;
    } else if (er && er.averagePct != null) {
      market = er.averagePct;
      marketLabel = 'ממוצע בנק ישראל לפי תקופה שנותרה (' + er.bucket + ')';
      marketNote = (loanRates.trackNotes && loanRates.trackNotes[type]) || (er.pack && er.pack.note) || '';
    }
    if (market == null) return {
      track: track, current: current, marketPct: null, marketIsEffective: true,
      fee: null, saving: null, estimate: true
    };
    var neu = remainingCost(P, market, N, true);
    var fee = earlyRepaymentFee({
      balance: P,
      monthsLeft: N,
      loanAnnualPct: rate,
      loanRateIsEffective: false,
      marketAnnualPct: er ? er.averagePct : market,
      track: type,
      rateChangesYearly: type === 't_prime',
      monthsToReset: type === 't_var_linked' || type === 't_var_unlinked' ? (track.monthsToReset != null ? track.monthsToReset : 60) : null,
      yearsHeld: track.yearsHeld,
      originationAveragePct: track.originationAveragePct,
      noticeGiven: opts.noticeGiven,
      operationalFeeIls: opts.operationalFeeIls
    });
    var currentCost = current.totalPaid;
    var newCost = neu.totalPaid + fee.total + n(opts.extraCosts);
    return {
      track: track,
      current: current,
      newPmt: neu.pmt,
      newInterest: neu.interest,
      marketPct: market,
      marketIsEffective: type !== 't_prime' || true,
      marketLabel: marketLabel,
      marketNote: marketNote,
      marketSource: er && er.pack ? er.pack.source : (loanRates.policyRate && loanRates.policyRate.source),
      marketAsOf: er && er.pack ? er.pack.reportMonth : (loanRates.policyRate && loanRates.policyRate.asOf),
      fee: fee,
      extraCosts: n(opts.extraCosts),
      grossSaving: currentCost - neu.totalPaid,
      netSaving: currentCost - newCost,
      estimate: true
    };
  }

  function consumerMarketRate(loanRates, monthsLeft) {
    var pack = loanRates && loanRates.consumerLoanAverages && loanRates.consumerLoanAverages.unlinked;
    if (!pack) return null;
    var y = n(monthsLeft) / 12;
    var key = y <= 0.25 ? 'up_to_3m' : y <= 1 ? '3m_to_1y' : y <= 2 ? '1_to_2y' : y <= 5 ? '2_to_5y' : 'over_5y';
    return { averagePct: pack.ratesByRemainingTerm[key] || pack.ratesByRemainingTerm.average, bucket: key, pack: pack };
  }

  /* ---- amortization file parsing (client-side only) ---- */
  var HEADER_MAP = [
    [/יתרת\s*קרן|יתרה\s*לתשלום|יתרה$|remaining\s*bal|balance|outstanding/i, 'balance'],
    [/תשלום\s*מספר|מספר\s*תשלום|תקופה|payment\s*no|installment|month/i, 'month'],
    [/תאריך|date/i, 'date'],
    [/תשלום$|החזר|סכום\s*לתשלום|payment(?!\s*no)|total\s*pmt/i, 'payment'],
    [/^קרן$|רכיב\s*קרן|principal/i, 'principal'],
    [/ריבית|interest/i, 'interest'],
    [/הצמד|מדד|index/i, 'indexation']
  ];

  function normalizeHeader(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }
  function mapHeader(s) {
    var t = normalizeHeader(s);
    for (var i = 0; i < HEADER_MAP.length; i++) if (HEADER_MAP[i][0].test(t)) return HEADER_MAP[i][1];
    return null;
  }

  function parseCsvText(text) {
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    var rows = [];
    lines.forEach(function (line) {
      if (!line.trim()) return;
      var cells = [], cur = '', q = false, i, c;
      for (i = 0; i < line.length; i++) {
        c = line[i];
        if (c === '"') { q = !q; continue; }
        if ((c === ',' || c === '\t' || c === ';') && !q) { cells.push(cur); cur = ''; }
        else cur += c;
      }
      cells.push(cur);
      rows.push(cells.map(function (x) { return x.trim(); }));
    });
    return rows;
  }

  function rowsToSchedule(matrix) {
    if (!matrix || !matrix.length) return { rows: [], error: 'empty' };
    var start = 0, map = [], c, r, scored, best = -1;
    for (r = 0; r < Math.min(matrix.length, 20); r++) {
      scored = 0;
      var trial = [];
      for (c = 0; c < matrix[r].length; c++) {
        var k = mapHeader(matrix[r][c]);
        trial[c] = k;
        if (k) scored++;
      }
      if (scored > best) { best = scored; map = trial; start = r + 1; }
    }
    if (best < 1) return { rows: [], error: 'no-headers', raw: matrix };
    var out = [];
    for (r = start; r < matrix.length; r++) {
      var rec = {}, has = false;
      for (c = 0; c < map.length; c++) {
        if (!map[c] || matrix[r][c] == null || matrix[r][c] === '') continue;
        if (map[c] === 'date') rec.date = String(matrix[r][c]).trim();
        else rec[map[c]] = nn(matrix[r][c]);
        has = true;
      }
      if (has) out.push(rec);
    }
    var last = null;
    for (r = out.length - 1; r >= 0; r--) {
      if (out[r].balance != null) { last = out[r]; break; }
    }
    var first = out[0] || {};
    var interestSum = 0, paySum = 0;
    out.forEach(function (row) { interestSum += n(row.interest); paySum += n(row.payment); });
    return {
      rows: out,
      remainingBalance: last ? last.balance : null,
      lastRow: last,
      firstRow: first,
      interestRemaining: null,
      paymentsCount: out.length,
      totals: { interest: interestSum, payments: paySum },
      error: null
    };
  }

  function extractPdfText(buf) {
    /* Best-effort extraction of literal strings from a simple PDF. Not a full PDF parser. */
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var s = '';
    try { s = new TextDecoder('latin1').decode(u8); } catch (e) {
      var i, arr = [];
      for (i = 0; i < u8.length; i++) arr.push(String.fromCharCode(u8[i]));
      s = arr.join('');
    }
    if (s.indexOf('FAKE') === -1 && /FlateDecode/.test(s) && s.indexOf('BT') === -1) {
      return { text: '', error: 'compressed' };
    }
    var texts = [], m, re = /\((?:\\.|[^\\)])*\)/g;
    while ((m = re.exec(s))) {
      var t = m[0].slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '\t').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
      if (t.trim()) texts.push(t);
    }
    /* also PDF hex strings */
    var hx = /<([0-9A-Fa-f\s]+)>/g;
    while ((m = hx.exec(s))) {
      var hex = m[1].replace(/\s/g, '');
      if (hex.length >= 4 && hex.length % 2 === 0) {
        var chars = [], j;
        for (j = 0; j < hex.length; j += 2) {
          var code = parseInt(hex.slice(j, j + 2), 16);
          if (code) chars.push(String.fromCharCode(code));
        }
        var hs = chars.join('');
        if (/[\u0590-\u05FF0-9]/.test(hs)) texts.push(hs);
      }
    }
    return { text: texts.join('\n'), error: null };
  }

  function parseAmortizationMatrixOrText(input) {
    if (Array.isArray(input)) return rowsToSchedule(input);
    var text = String(input || '');
    if (text.indexOf(',') >= 0 || text.indexOf('\t') >= 0 || text.indexOf(';') >= 0) {
      return rowsToSchedule(parseCsvText(text));
    }
    /* whitespace table */
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var matrix = lines.map(function (l) { return l.split(/\s{2,}|\t/); });
    return rowsToSchedule(matrix);
  }

  /* ---- card ranking ---- */
  function rewardPctFor(card, year, spendMonthly) {
    var rw = card.rewards;
    if (!rw) return 0;
    var y1 = year === 1;
    var high = y1 ? rw.year1HighPct : rw.year2HighPct;
    var thr = y1 ? rw.year1HighThresholdMonthly : rw.year2HighThresholdMonthly;
    if (high != null && thr != null && n(spendMonthly) >= n(thr)) return n(high);
    return n(y1 ? rw.year1DefaultPct : rw.year2DefaultPct);
  }

  function cardAnnualValue(card, spend, opts) {
    opts = opts || {};
    var year = opts.year === 1 ? 1 : 2;
    var cats = ['supermarket', 'fuel', 'dining', 'online', 'abroad', 'other'];
    var total = 0, abroad = n(spend.abroad);
    cats.forEach(function (k) { total += n(spend[k]); });
    var pct = rewardPctFor(card, year, total);
    var rewards = total * (pct / 100) * 12;
    var rw = card.rewards;
    if (rw && rw.monthlyCapIls != null) rewards = Math.min(rewards, n(rw.monthlyCapIls) * 12);
    if (rw && rw.annualCapIls != null) rewards = Math.min(rewards, n(rw.annualCapIls));
    var feeMonthly = year === 1 && card.year1MonthlyFee != null ? n(card.year1MonthlyFee)
      : (card.monthlyFee != null ? n(card.monthlyFee) : 0);
    var fees = feeMonthly * 12;
    var fx = abroad * 12 * n(card.fxFeePct) / 100;
    var net = rewards - fees - fx;
    return {
      card: card,
      year: year,
      spendAnnual: total * 12,
      rewardPct: pct,
      rewards: rewards,
      fees: fees,
      fxCost: fx,
      net: net,
      feeUnknown: year !== 1 && card.monthlyFee == null,
      rewardsUnknown: !rw,
      estimate: true
    };
  }

  function rankCards(cards, spend, opts) {
    opts = opts || {};
    var list = (cards || []).map(function (c) { return cardAnnualValue(c, spend, opts); });
    var profile = opts.profile;
    if (profile === 'abroad') list.sort(function (a, b) { return (n(a.card.fxFeePct) - n(b.card.fxFeePct)) || (b.net - a.net); });
    else if (profile === 'cashback') list.sort(function (a, b) { return ((b.card.kind === 'cashback') - (a.card.kind === 'cashback')) || (b.net - a.net); });
    else list.sort(function (a, b) { return b.net - a.net; });
    return list;
  }

  function filterDeposits(products, f) {
    f = f || {};
    return (products || []).filter(function (p) {
      if (f.rateType && p.rateType !== f.rateType) return false;
      if (f.linkage && p.linkage !== f.linkage) return false;
      if (f.liquidity && p.liquidity !== f.liquidity) return false;
      if (f.termId && p.termId !== f.termId) return false;
      if (f.providerId && p.providerId !== f.providerId) return false;
      if (f.maxTermDays != null && p.termMinDays > n(f.maxTermDays)) return false;
      if (f.minTermDays != null && p.termMaxDays < n(f.minTermDays)) return false;
      if (f.minAmount != null && p.maxAmount != null && n(f.minAmount) > n(p.maxAmount)) return false;
      if (f.maxAmount != null && p.minAmount != null && n(f.maxAmount) < n(p.minAmount)) return false;
      return true;
    });
  }

  function depositInterest(amount, ratePct, termDays) {
    var a = n(amount), r = n(ratePct) / 100, d = n(termDays);
    if (!(a > 0) || !(d > 0)) return 0;
    return a * r * (d / 365);
  }

  var api = {
    n: n, nn: nn, round: round,
    monthlyNominal: monthlyNominal, monthlyEffective: monthlyEffective, effectiveFromNominal: effectiveFromNominal,
    pmt: pmt, remainingCost: remainingCost, spitzerSchedule: spitzerSchedule, impliedNominalRate: impliedNominalRate,
    pickEarlyRepaymentAverage: pickEarlyRepaymentAverage, holdingDiscountPct: holdingDiscountPct,
    earlyRepaymentFee: earlyRepaymentFee, refinanceTrack: refinanceTrack, consumerMarketRate: consumerMarketRate,
    parseCsvText: parseCsvText, rowsToSchedule: rowsToSchedule, parseAmortizationMatrixOrText: parseAmortizationMatrixOrText,
    extractPdfText: extractPdfText,
    rewardPctFor: rewardPctFor, cardAnnualValue: cardAnnualValue, rankCards: rankCards,
    filterDeposits: filterDeposits, depositInterest: depositInterest
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CompareLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
