/* "Next steps" widget: reads the data already on this device and lists the 3-5 most useful actions.
   Self-contained (no other planning files needed). Usage on any page that loads portal.js:
     <div id="insights-slot"></div> + <script src="portal-insights.js"></script>
   It mounts itself into #insights-slot, or call PortalInsights.mount(element, { max: 5, heading: false }). PortalInsights.list() returns the items. */
(function () {
  'use strict';
  var SIGN = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function num(v) { var x = typeof v === 'number' ? v : parseFloat(String(v === undefined || v === null ? '' : v).replace(/,/g, '')); return Number.isFinite(x) ? x : 0; }
  function data() { var P = window.Portal; return (P && P.data) || read('portal-data-v1') || {}; }
  function cur() { var s = read('portal-settings-v1') || {}; return SIGN[s.currency] ? s.currency : 'ILS'; }
  function rate(c) { if (!c || c === 'ILS') return 1; var P = window.Portal; var r = P && P.rateILS ? P.rateILS(c) : null; return r || null; }
  function ils(v, c) { var r = rate(c); return r === null ? null : num(v) * r; }
  function money(vILS) { var c = cur(), r = rate(c); var v = r ? vILS / r : vILS; c = r ? c : 'ILS'; return (v < 0 ? '-' : '') + SIGN[c] + Math.round(Math.abs(v)).toLocaleString('he-IL'); }
  function sum(list, k) { return (list || []).reduce(function (s, r) { return s + num(r[k]); }, 0); }
  function pmt(r) { var p = r.payment; if (p !== '' && p !== null && p !== undefined) return num(p); var P = window.Portal; try { return P.calc.mortgage(r).pmt || 0; } catch (e) { return 0; } }

  function list() {
    var d = data(), out = [], home = d.home || {}, sav = d.savings || {};
    var mPmt = home.includeMortgagePmt === false ? 0 : ((d.mortgage && d.mortgage.tracks) || []).reduce(function (s, r) { return s + pmt(r); }, 0);
    var income = sum(home.income, 'amount'), expenses = sum(home.expenses, 'amount') + mPmt;
    var loanPmt = (home.loans || []).reduce(function (s, r) { return s + pmt(r); }, 0);
    var subs = ((read('portal-subs-v1') || {}).items || []).filter(function (r) { return num(r.amount) > 0; });
    var subsM = subs.reduce(function (s, r) { var v = ils(r.amount, r.currency); return v === null ? s : s + (r.cycle === 'yearly' ? v / 12 : v); }, 0);

    /* 1. spending more than earning */
    if (income > 0 && income - expenses - loanPmt < 0) out.push({ id: 'cashflow', score: 95, icon: 'pie', href: 'cashflow.html', title: 'יוצא יותר ממה שנכנס', text: 'בערך ' + money(expenses + loanPmt - income) + ' בחודש. בתחזית התזרים רואים מתי היתרה יורדת למינוס.' });

    /* 2. emergency fund gap */
    var g = read('portal-goals-v1') || {}, e = g.emergency || {}, months = num(e.months) || 6;
    var monthly = num(e.monthly) || expenses;
    var liquid = e.useCash || e.current === null || e.current === undefined || e.current === '' ? (sav.cash || []).reduce(function (s, r) { var v = ils(r.balance, r.currency); return v === null ? s : s + v; }, 0) : num(e.current);
    if (monthly > 0) {
      var target = monthly * months, gap = target - liquid;
      if (gap > monthly * 0.25) out.push({ id: 'emergency', score: 60 + Math.min(30, gap / target * 30), icon: 'shield', href: 'goals.html', title: 'קרן חירום: חסרים ' + money(gap), text: 'היעד הוא ' + months + ' חודשי הוצאות (' + money(target) + '). היום יש בערך ' + (liquid / monthly).toFixed(1) + ' חודשים.' });
    } else out.push({ id: 'budget', score: 40, icon: 'pie', href: 'budget.html', title: 'למלא הכנסות והוצאות', text: 'בלי תקציב אי אפשר לחשב קרן חירום ותזרים.' });

    /* 3. high-rate debt */
    var debts = (home.loans || []).filter(function (r) { return num(r.balance) > 0 && num(r.rate) >= 7; }).sort(function (a, b) { return num(b.rate) - num(a.rate); });
    var extra = ((read('portal-debts-v1') || {}).extra || []).filter(function (r) { return num(r.balance) > 0 && num(r.rate) >= 7; });
    var all = debts.map(function (r) { return { name: [r.lender, r.name].filter(Boolean).join(' · ') || 'הלוואה', rate: num(r.rate), bal: num(r.balance) }; })
      .concat(extra.map(function (r) { return { name: r.name || 'חוב', rate: num(r.rate), bal: ils(r.balance, r.currency) || 0 }; })).sort(function (a, b) { return b.rate - a.rate; });
    if (all.length) { var top = all[0], yearly = all.reduce(function (s, x) { return s + x.bal * x.rate / 100; }, 0); out.push({ id: 'debt', score: 70 + Math.min(20, top.rate), icon: 'swap', href: 'debts-planner.html', title: 'חוב בריבית ' + (Math.round(top.rate * 10) / 10) + '%: ' + top.name, text: 'חובות בריבית גבוהה עולים בערך ' + money(yearly) + ' ריבית בשנה. בתכנון ההחזר רואים מה לסגור קודם.' }); }

    /* 4. fees + several accounts of the same kind */
    var funds = [];
    ((d.pension && d.pension.funds) || []).forEach(function (r) { funds.push({ t: r.kind === 'k_gemel' || r.kind === 'k_gemel_inv' ? 'gemel' : 'pension', bal: num(r.balance), fa: num(r.feeBal), fd: num(r.feeDep) }); });
    ((d.hishtalmut && d.hishtalmut.funds) || []).forEach(function (r) { funds.push({ t: 'hish', bal: num(r.balance), fa: num(r.feeBal), fd: num(r.feeDep) }); });
    if (d.maslaka && d.maslaka.include !== false) (d.maslaka.products || []).forEach(function (p) { if (num(p.balance) > 0) funds.push({ t: p.type === 'hishtalmut' ? 'hish' : p.type === 'gemel' || p.type === 'gemel_inv' ? 'gemel' : 'pension', bal: num(p.balance), fa: num(p.feeAcc), fd: num(p.feeDep) }); });
    var high = funds.filter(function (f) { return f.bal > 0 && (f.t === 'pension' ? f.fa > 0.3 || f.fd > 1.5 : f.fa > 0.7); });
    if (high.length) { var yr = high.reduce(function (s, f) { return s + f.bal * Math.max(0, f.fa - (f.t === 'pension' ? 0.22 : 0.6)) / 100; }, 0); out.push({ id: 'fees', score: 55 + Math.min(25, yr / 200), icon: 'bulb', href: 'actions.html', title: 'דמי ניהול גבוהים ב־' + high.length + (high.length === 1 ? ' חשבון' : ' חשבונות'), text: 'הפער מול דמי ניהול מקובלים הוא בערך ' + money(yr) + ' בשנה, והוא מצטבר עד הפרישה. יש נוסח מוכן לבקשה.' }); }
    var by = {}; funds.forEach(function (f) { if (f.bal > 0) by[f.t] = (by[f.t] || 0) + 1; });
    var multi = Object.keys(by).filter(function (k) { return by[k] > 1; });
    if (multi.length) out.push({ id: 'consolidate', score: 50, icon: 'umbrella', href: 'actions.html', title: 'יש כמה חשבונות מאותו סוג', text: 'איחוד לחשבון אחד עם דמי ניהול נמוכים יכול לחסוך. לפני כן כדאי לבדוק כיסוי ביטוחי ותאריכי נזילות.' });

    /* 5. subscriptions */
    if (subs.length) out.push({ id: 'subs', score: 30 + Math.min(25, subsM / 40), icon: 'card', href: 'subscriptions.html', title: 'מנויים: ' + money(subsM) + ' בחודש', text: subs.length + ' חיובים קבועים, ' + money(subsM * 12) + ' בשנה. שווה לעבור ולבדוק מה לא בשימוש.' });
    else out.push({ id: 'subs-add', score: 20, icon: 'card', href: 'subscriptions.html', title: 'לרשום את המנויים והחיובים הקבועים', text: 'רואים כמה יוצא כל חודש ומה יורד בקרוב.' });

    if (funds.length) out.push({ id: 'retire', score: 18, icon: 'chart', href: 'retirement.html', title: 'תחזית פרישה', text: 'טווח הקצבה החודשית הצפויה לפי הקופות שהזנת.' });
    else out.push({ id: 'pension-add', score: 25, icon: 'umbrella', href: 'pension.html', title: 'להוסיף פנסיה וקרן השתלמות', text: 'אפשר גם להעלות את הדוח מהמסלקה הפנסיונית.' });

    return out.sort(function (a, b) { return b.score - a.score; });
  }

  function icon(key) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', (window.PORTAL_ICONS && window.PORTAL_ICONS[key]) || 'M12 3v18M3 12h18'); s.appendChild(p); return s;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function mount(target, opts) {
    if (!target) return null; opts = opts || {};
    var max = Math.max(3, Math.min(5, opts.max || 5)), items = list().slice(0, max);
    target.innerHTML = '';
    var sec = el('section', 'insights'); if (opts.heading !== false) sec.setAttribute('aria-labelledby', 'insights-h');
    if (opts.heading !== false) { var hd = el('h2', 'sec-h', opts.title || 'הצעדים הבאים'); hd.id = 'insights-h'; sec.appendChild(hd); } else sec.setAttribute('aria-label', opts.title || 'הצעדים הבאים');
    items.forEach(function (it) {
      var a = el('a', 'action'); a.href = it.href;
      var ai = el('span', 'ai'); ai.setAttribute('aria-hidden', 'true'); ai.appendChild(icon(it.icon));
      var at = el('span', 'at'); at.appendChild(el('strong', null, it.title)); at.appendChild(el('span', null, it.text));
      var ch = el('span', 'chev', document.documentElement.dir === 'ltr' ? '›' : '‹'); ch.setAttribute('aria-hidden', 'true');
      a.appendChild(ai); a.appendChild(at); a.appendChild(ch); sec.appendChild(a);
    });
    sec.appendChild(el('p', 'help', 'מידע בלבד, לא ייעוץ. לפי הנתונים שהזנת באתר.'));
    target.appendChild(sec);
    return items;
  }
  window.PortalInsights = { list: list, mount: mount };
  function auto() { var s = document.getElementById('insights-slot'); if (s) mount(s); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(auto, 0); }); else setTimeout(auto, 0);
  window.addEventListener('portal-cloud', function () { setTimeout(auto, 300); });
})();
