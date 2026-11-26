/* Employee stock options on the personal page (me.html).
   Data lives only in the user's options doc (localStorage 'options-calc-v5-private', key "esop"),
   which portal-cloud.js syncs to Supabase portal_docs section 'options' when signed in. Nothing personal in this file.
   Model: grants (original strike + vesting tranches), dividends (each lowers the strike of grants made before it),
   sales/exercises (date, grant, quantity, sale price). */
(function () {
  'use strict';
  var KEY = 'options-calc-v5-private';
  var S = {
    title: 'אופציות עובדים', help: 'המענקים, ההבשלה, הדיבידנדים והמימושים שלך. כל דיבידנד מוריד את מחיר המימוש של המענקים שניתנו לפניו. הנתונים נשמרים בחשבון שלך (או רק במכשיר אם לא נכנסת), לא באתר.',
    symbol: 'נייר ערך', price: 'מחיר מניה עכשיו', manual: 'מחיר ידני (רק אם אין מחיר עדכני)', tax: 'מס משוער על הרווח (%)',
    grants: 'מענקים', grant: 'מענק', g_name: 'שם המענק', g_date: 'תאריך המענק', g_qty: 'כמות אופציות', g_strike: 'מחיר מימוש מקורי (₪)',
    vest: 'מנות הבשלה', v_date: 'תאריך הבשלה', v_qty: 'כמות', add_vest: 'הוספת מנה', add_grant: 'הוספת מענק', del: 'מחיקה',
    divs: 'דיבידנדים', d_date: 'תאריך אקס', d_amt: 'דיבידנד למניה (₪)', add_div: 'הוספת דיבידנד',
    sales: 'מימושים ומכירות', s_date: 'תאריך', s_grant: 'מענק', s_qty: 'כמות', s_price: 'מחיר מכירה (₪)', add_sale: 'הוספת מימוש',
    total: 'סה״כ אופציות', vested: 'הבשילו', unvested: 'טרם הבשילו', sold: 'מומשו', left: 'נשארו להבשלה ולמימוש', exercisable: 'אפשר לממש עכשיו',
    adj: 'מחיר מימוש מתואם', intrinsic: 'ערך פנימי לאופציה', val_vested: 'שווי מה שהבשיל (לפני מס)', val_unvested: 'שווי מה שטרם הבשיל (לפני מס)', val_net: 'שווי כולל אחרי מס משוער',
    hist: 'היסטוריית מחיר המימוש', h_orig: 'מחיר מקורי', h_before: 'לפני', h_after: 'אחרי',
    proceeds: 'תמורה', cost: 'עלות מימוש', gain: 'רווח', tax_est: 'מס משוער', net: 'נטו',
    no_price: 'אין עדיין מחיר עדכני. אפשר להזין מחיר ידני.', mismatch: 'סכום מנות ההבשלה ({v}) שונה מכמות המענק ({q}). כדאי לבדוק.',
    from_calc: 'יצירת מענק מנתוני מחשבון האופציות', from_calc_note: 'מחיר המימוש במחשבון הוא כנראה כבר אחרי דיבידנדים. כדאי להזין את המחיר המקורי ואת הדיבידנדים בנפרד.',
    no_vest: 'בלי מנות הבשלה, כל המענק נחשב כאילו הבשיל.', updated: 'עודכן ב־', empty: 'עדיין אין מענקים.', none: '—', estimate: 'הערכה בלבד, לא ייעוץ. המס בפועל תלוי במסלול המענק (למשל סעיף 102) ובמצב האישי.'
  };
  function n(v) { var x = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : 0; }
  function nn(v) { if (v === '' || v === null || v === undefined) return null; var x = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : null; }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function readDoc() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || null; } catch (e) { return null; } }
  function defaults(e) {
    e = e && typeof e === 'object' ? e : {};
    if (!e.symbol) e.symbol = 'LUMI.TA'; if (e.tax === undefined) e.tax = 25;
    ['grants', 'dividends', 'sales'].forEach(function (k) { if (!Array.isArray(e[k])) e[k] = []; });
    e.grants.forEach(function (g) { if (!Array.isArray(g.vest)) g.vest = []; });
    return e;
  }
  function load() { var d = readDoc(); return defaults(d && d.esop); }
  function hasEsop(d) { var e = d && d.esop; return !!(e && Array.isArray(e.grants) && e.grants.length); }
  var saveT = null;
  function save(e) {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var d = readDoc() || { v: 1, symbol: null, data: {} };
      if (!d.data || typeof d.data !== 'object') d.data = {};
      d.esop = e;
      try { localStorage.setItem(KEY, JSON.stringify(d)); window.dispatchEvent(new CustomEvent('portal-local-write', { detail: { key: KEY } })); } catch (x) {}
    }, 300);
  }
  // strike of grant g on date `on` (YYYY-MM-DD): original minus every dividend with ex-date after the grant date and not after `on`
  function divsFor(e, g, on) {
    return e.dividends.filter(function (d) { return d.date && n(d.amount) > 0 && (!g.date || d.date > g.date) && d.date <= on; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  function strikeOn(e, g, on) { var s = n(g.strike); divsFor(e, g, on).forEach(function (d) { s -= n(d.amount); }); return Math.max(0, s); }
  function priceOf(e) {
    var P = window.Portal, q = P && P.quotes && P.quotes[e.symbol];
    if (q && q.price > 0) return { price: q.price, live: true, q: q };
    if (nn(e.manual) > 0) return { price: n(e.manual), live: false };
    return null;
  }
  function compute(e) {
    var on = today(), pr = priceOf(e), price = pr ? pr.price : null, tax = n(e.tax) / 100;
    var tot = { qty: 0, vested: 0, unvested: 0, sold: 0, exercisable: 0, valV: 0, valU: 0, net: 0, price: pr, grants: [] };
    e.grants.forEach(function (g) {
      var qty = n(g.qty), vSum = g.vest.reduce(function (s, v) { return s + n(v.qty); }, 0);
      var vested = g.vest.length ? Math.min(qty, g.vest.reduce(function (s, v) { return s + (v.date && v.date <= on ? n(v.qty) : 0); }, 0)) : qty;
      var sold = e.sales.reduce(function (s, x) { return s + (x.grantId === g.id ? n(x.qty) : 0); }, 0);
      var adj = strikeOn(e, g, on), intr = price === null ? null : Math.max(0, price - adj);
      var exer = Math.max(0, vested - sold), unv = Math.max(0, qty - vested);
      var r = { g: g, qty: qty, vSum: vSum, vested: vested, sold: sold, exer: exer, unvested: unv, adj: adj, intr: intr };
      tot.grants.push(r); tot.qty += qty; tot.vested += vested; tot.sold += sold; tot.exercisable += exer; tot.unvested += unv;
      if (intr !== null) { tot.valV += exer * intr; tot.valU += unv * intr; }
    });
    tot.net = (tot.valV + tot.valU) * (1 - tax);
    tot.left = tot.exercisable + tot.unvested;
    return tot;
  }
  function saleCalc(e, s) {
    var g = e.grants.filter(function (x) { return x.id === s.grantId; })[0]; if (!g || !s.date) return null;
    var k = strikeOn(e, g, s.date), q = n(s.qty), p = n(s.price), gain = Math.max(0, q * (p - k)), tax = gain * n(e.tax) / 100;
    return { strike: k, proceeds: q * p, cost: q * k, gain: gain, tax: tax, net: gain - tax };
  }
  // for the home options card: one item per symbol, after-tax intrinsic value of what is left
  function summary() {
    var d = readDoc(); if (!hasEsop(d)) return null;
    var e = defaults(d.esop), c = compute(e);
    return [{ symbol: e.symbol, qty: c.left, net: c.price ? c.net : null, currency: /\.TA$/i.test(e.symbol) ? 'ILS' : 'USD', pending: !c.price }];
  }

  /* ---------- UI ---------- */
  function render(api) {
    var h = api.h, e = load(), wrap = h('div', { class: 'esop' });
    var ils = function (v, d) { return api.money(v, 'ILS', d === undefined ? 0 : d); };
    var sumBox = h('div', { 'aria-live': 'polite' }), warnBox = h('div'), editBox = h('div');
    function field(label, value, type, onv, extra) {
      var id = 'es-' + uid(), inp;
      if (type === 'select') { inp = h('select', { id: id }, extra.map(function (o) { return h('option', { value: o[0], text: o[1] }); })); inp.value = value || (extra[0] && extra[0][0]) || ''; inp.addEventListener('change', function () { onv(inp.value); }); }
      else { inp = h('input', { id: id, type: type, inputmode: type === 'number' ? 'decimal' : null, step: type === 'number' ? 'any' : null, min: type === 'number' ? '0' : null, autocomplete: 'off' }); inp.value = value === undefined || value === null ? '' : value; inp.addEventListener('input', function () { onv(type === 'number' ? nn(inp.value) : inp.value); }); }
      return h('div', { class: 'field' }, [h('label', { for: id, text: label }), inp]);
    }
    function changed() { save(e); drawSum(); }
    function out(k, v, cls) { return h('div', { class: 'tot' + (cls ? ' ' + cls : '') }, [h('span', { class: 'k', text: k }), h('span', { class: 'v num', text: v })]); }
    function drawSum() {
      var c = compute(e), pr = c.price;
      sumBox.innerHTML = ''; warnBox.innerHTML = '';
      var pl = pr ? ils(pr.price, 2) + (pr.live && pr.q && pr.q.regularMarketTime ? ' · ' + S.updated + api.fmtDate(new Date(pr.q.regularMarketTime)) : '') : S.none;
      sumBox.appendChild(h('div', { class: 'totals' }, [
        out(S.val_net, pr ? ils(c.net) : S.none, 'big'), out(S.price, pl),
        out(S.total, String(c.qty)), out(S.vested, String(c.vested)), out(S.unvested, String(c.unvested)), out(S.sold, String(c.sold)), out(S.exercisable, String(c.exercisable)),
        out(S.val_vested, pr ? ils(c.valV) : S.none), out(S.val_unvested, pr ? ils(c.valU) : S.none)
      ]));
      if (!pr) warnBox.appendChild(h('p', { class: 'notice amber', text: S.no_price }));
      c.grants.forEach(function (r) {
        if (r.g.vest.length && Math.abs(r.vSum - r.qty) > 1e-9) warnBox.appendChild(h('p', { class: 'notice amber', text: (r.g.name ? r.g.name + ': ' : '') + S.mismatch.replace('{v}', r.vSum).replace('{q}', r.qty) }));
      });
      // strike history per grant
      c.grants.forEach(function (r) {
        var rows = [[r.g.date || S.none, S.h_orig, '', ils(n(r.g.strike), 4)]], s = n(r.g.strike);
        divsFor(e, r.g, today()).forEach(function (d) { var b = s; s = Math.max(0, s - n(d.amount)); rows.push([d.date, ils(n(d.amount), 4), ils(b, 4), ils(s, 4)]); });
        sumBox.appendChild(h('h3', { text: S.hist + (r.g.name ? ' · ' + r.g.name : '') }));
        sumBox.appendChild(h('div', { class: 'tbl-wrap', tabindex: '0' }, [h('table', { class: 'cmp data' }, [
          h('caption', { class: 'sr-only', text: S.hist }),
          h('thead', null, [h('tr', null, [S.d_date, S.d_amt, S.h_before, S.h_after].map(function (x) { return h('th', { scope: 'col', text: x }); }))]),
          h('tbody', null, rows.map(function (x) { return h('tr', null, x.map(function (v, i) { return h('td', { class: i ? 'num' : null, text: v }); })); }))
        ])]));
        sumBox.appendChild(h('p', { class: 'help', text: S.adj + ': ' + ils(r.adj, 4) + (r.intr !== null ? ' · ' + S.intrinsic + ': ' + ils(r.intr, 2) : '') + (r.g.vest.length ? '' : ' · ' + S.no_vest) }));
      });
      // sales log with computed columns
      if (e.sales.length) {
        sumBox.appendChild(h('h3', { text: S.sales }));
        sumBox.appendChild(h('div', { class: 'tbl-wrap', tabindex: '0' }, [h('table', { class: 'cmp data' }, [
          h('caption', { class: 'sr-only', text: S.sales }),
          h('thead', null, [h('tr', null, [S.s_date, S.s_qty, S.s_price, S.adj, S.proceeds, S.gain, S.tax_est, S.net].map(function (x) { return h('th', { scope: 'col', text: x }); }))]),
          h('tbody', null, e.sales.slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); }).map(function (s) {
            var x = saleCalc(e, s);
            return h('tr', null, [s.date || S.none, String(n(s.qty)), ils(n(s.price), 2), x ? ils(x.strike, 4) : S.none, x ? ils(x.proceeds) : S.none, x ? ils(x.gain) : S.none, x ? ils(x.tax) : S.none, x ? ils(x.net) : S.none].map(function (v, i) { return h('td', { class: i ? 'num' : null, text: v }); }));
          }))
        ])]));
      }
    }
    function rowCard(kids, onDel) { return h('div', { class: 'row-card' }, [h('div', { class: 'fields' }, kids), h('div', { class: 'row-actions' }, [h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: S.del, onclick: onDel })])]); }
    function grantOpts() { return e.grants.map(function (g, i) { return [g.id, g.name || (S.grant + ' ' + (i + 1))]; }); }
    function drawEdit() {
      editBox.innerHTML = '';
      editBox.appendChild(h('div', { class: 'fields' }, [
        field(S.symbol, e.symbol, 'text', function (v) { e.symbol = String(v || '').trim().toUpperCase() || 'LUMI.TA'; changed(); if (window.Portal) window.Portal.refreshQuotes([e.symbol], true); }),
        field(S.manual, e.manual, 'number', function (v) { e.manual = v; changed(); }),
        field(S.tax, e.tax, 'number', function (v) { e.tax = v === null ? 0 : v; changed(); })
      ]));
      editBox.appendChild(h('h3', { text: S.grants }));
      if (!e.grants.length) {
        editBox.appendChild(h('p', { class: 'empty', text: S.empty }));
        var d = readDoc(), cd = d && d.data && (d.data[e.symbol] || d.data[d.symbol]);
        if (cd && n(cd.t1) + n(cd.t2) + n(cd.t3) > 0) editBox.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: S.from_calc, onclick: function () {
          var g = { id: uid(), name: '', date: '', qty: n(cd.t1) + n(cd.t2) + n(cd.t3), strike: nn(cd.strike), vest: [] };
          ['t1', 't2', 't3'].forEach(function (k) { if (n(cd[k]) > 0) g.vest.push({ id: uid(), date: '', qty: n(cd[k]) }); });
          e.grants.push(g); changed(); drawEdit(); api.toast(S.from_calc_note);
        } })]));
      }
      e.grants.forEach(function (g, gi) {
        var vbox = h('div');
        function drawV() {
          vbox.innerHTML = '';
          g.vest.forEach(function (v, vi) { vbox.appendChild(rowCard([field(S.v_date, v.date, 'date', function (x) { v.date = x; changed(); }), field(S.v_qty, v.qty, 'number', function (x) { v.qty = x; changed(); })], function () { g.vest.splice(vi, 1); changed(); drawV(); })); });
          vbox.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-sm', text: S.add_vest, onclick: function () { g.vest.push({ id: uid(), date: '', qty: null }); changed(); drawV(); } })]));
        }
        drawV();
        editBox.appendChild(h('div', { class: 'row-card' }, [
          h('div', { class: 'fields' }, [
            field(S.g_name, g.name, 'text', function (x) { g.name = x; changed(); }), field(S.g_date, g.date, 'date', function (x) { g.date = x; changed(); }),
            field(S.g_qty, g.qty, 'number', function (x) { g.qty = x; changed(); }), field(S.g_strike, g.strike, 'number', function (x) { g.strike = x; changed(); })
          ]),
          h('h4', { text: S.vest }), vbox,
          h('div', { class: 'row-actions' }, [h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: S.del + ' ' + S.grant, onclick: function () { if (!confirm(S.del + '?')) return; e.grants.splice(gi, 1); e.sales = e.sales.filter(function (s) { return s.grantId !== g.id; }); changed(); drawEdit(); } })])
        ]));
      });
      editBox.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: S.add_grant, onclick: function () { e.grants.push({ id: uid(), name: '', date: '', qty: null, strike: null, vest: [] }); changed(); drawEdit(); } })]));
      editBox.appendChild(h('h3', { text: S.divs }));
      e.dividends.forEach(function (d, i) { editBox.appendChild(rowCard([field(S.d_date, d.date, 'date', function (x) { d.date = x; changed(); }), field(S.d_amt, d.amount, 'number', function (x) { d.amount = x; changed(); })], function () { e.dividends.splice(i, 1); changed(); drawEdit(); })); });
      editBox.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: S.add_div, onclick: function () { e.dividends.push({ id: uid(), date: '', amount: null }); changed(); drawEdit(); } })]));
      editBox.appendChild(h('h3', { text: S.sales }));
      e.sales.forEach(function (s, i) {
        if (!s.grantId && e.grants[0]) s.grantId = e.grants[0].id;
        editBox.appendChild(rowCard([field(S.s_date, s.date, 'date', function (x) { s.date = x; changed(); }), field(S.s_grant, s.grantId, 'select', function (x) { s.grantId = x; changed(); }, grantOpts()),
          field(S.s_qty, s.qty, 'number', function (x) { s.qty = x; changed(); }), field(S.s_price, s.price, 'number', function (x) { s.price = x; changed(); })], function () { e.sales.splice(i, 1); changed(); drawEdit(); }));
      });
      if (e.grants.length) editBox.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: S.add_sale, onclick: function () { e.sales.push({ id: uid(), date: today(), grantId: e.grants[0].id, qty: null, price: null }); changed(); drawEdit(); } })]));
    }
    wrap.appendChild(h('p', { class: 'help', text: S.help }));
    wrap.appendChild(sumBox); wrap.appendChild(warnBox); wrap.appendChild(editBox);
    wrap.appendChild(h('p', { class: 'help', text: S.estimate }));
    drawSum(); drawEdit();
    if (window.Portal && !priceOf(e)) window.Portal.refreshQuotes([e.symbol], true);
    return { el: wrap, refresh: drawSum };
  }
  window.PortalEsop = { title: S.title, render: render, summary: summary, compute: function () { return compute(load()); }, strikeOn: strikeOn, hasEsop: hasEsop, _defaults: defaults };
})();
