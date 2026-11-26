/* Shared helpers for the planning pages: per-section storage (this device + the user's account), money display, small form builders.
   Sections live in their own localStorage keys and sync to portal_docs rows of the same section name when signed in. */
(function () {
  'use strict';
  var SECTIONS = { goals: 'portal-goals-v1', subscriptions: 'portal-subs-v1', debts: 'portal-debts-v1', actions: 'portal-actions-v1', networth_history: 'portal-networth-v1', cashflow: 'portal-cashflow-v1', retirement: 'portal-retirement-v1', tax: 'portal-tax-v1' };
  var META = 'portal-plan-sync-v1';
  var CUR_SIGN = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
  var CURS = ['ILS', 'USD', 'EUR', 'GBP'];
  var listeners = [];

  /* ---------- nav entries for these pages (shown in the "עוד" sheet) ---------- */
  var NAV = [
    { id: 'networth', href: 'networth.html', label: { he: 'הון לאורך זמן', en: 'Net worth history', es: 'Patrimonio' }, icon: 'chart', group: 'wealth', parent: 'wealth' },
    { id: 'assets', href: 'assets.html', label: { he: 'נכסים: דירה, רכב, קרקע', en: 'Property & car', es: 'Bienes' }, icon: 'house', group: 'wealth', parent: 'wealth' },
    { id: 'goals', href: 'goals.html', label: { he: 'קרן חירום ויעדים', en: 'Goals', es: 'Metas' }, icon: 'piggy', group: 'tools', parent: 'budget' },
    { id: 'subscriptions', href: 'subscriptions.html', label: { he: 'מנויים וחיובים', en: 'Subscriptions', es: 'Suscripciones' }, icon: 'card', group: 'tools', parent: 'budget' },
    { id: 'debts-planner', href: 'debts-planner.html', label: { he: 'תכנון החזר חובות', en: 'Debt payoff', es: 'Pago de deudas' }, icon: 'swap', group: 'debts', parent: 'loans' },
    { id: 'actions', href: 'actions.html', label: { he: 'צעדים לחיסכון בדמי ניהול', en: 'Fee actions', es: 'Comisiones' }, icon: 'bulb', group: 'tools', parent: 'wealth' },
    { id: 'cashflow', href: 'cashflow.html', label: { he: 'תחזית תזרים ל־12 חודשים', en: 'Cash-flow forecast', es: 'Flujo de caja' }, icon: 'pie', group: 'tools', parent: 'budget' },
    { id: 'retirement', href: 'retirement.html', label: { he: 'תחזית פרישה', en: 'Retirement', es: 'Jubilación' }, icon: 'umbrella', group: 'wealth', parent: 'wealth' },
    { id: 'tax', href: 'tax.html', label: { he: 'מס הכנסה: נקודות זיכוי והחזר', en: 'Income tax helper', es: 'Impuestos' }, icon: 'shield', group: 'tools', parent: 'budget' },
    { id: 'report', href: 'report.html', label: { he: 'דוח כספי להדפסה', en: 'Printable report', es: 'Informe' }, icon: 'chart', group: 'tools', parent: 'home' },
    { id: 'feedback', href: 'feedback.html', label: { he: 'משוב ודיווח על תקלה', en: 'Feedback', es: 'Comentarios' }, icon: 'chat', group: 'account', parent: 'me' }
  ];
  var nav = window.PORTAL_NAV = window.PORTAL_NAV || [];
  NAV.forEach(function (e) { if (!nav.some(function (x) { return x.id === e.id; })) nav.push(e); });

  /* ---------- storage ---------- */
  function read(sec, def) {
    try { var raw = localStorage.getItem(SECTIONS[sec]); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') return Object.assign(def || {}, o); } } catch (e) {}
    return def || {};
  }
  var pushTimer = null;
  function write(sec, obj) {
    obj._ts = Date.now();
    try { localStorage.setItem(SECTIONS[sec], JSON.stringify(obj)); } catch (e) { return false; }
    clearTimeout(pushTimer); pushTimer = setTimeout(function () { sync(false); }, 1500);
    return true;
  }
  function hash(str) { var x = 5381; str = str || ''; for (var i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0; return String(x >>> 0) + ':' + str.length; }
  function readMeta() { try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch (e) { return {}; } }
  function writeMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) {} }
  function hasContent(o) {
    var found = false;
    (function walk(v, k) { if (found || k === '_ts') return; if (Array.isArray(v)) { if (v.length) found = true; return; } if (v && typeof v === 'object') { Object.keys(v).forEach(function (kk) { walk(v[kk], kk); }); return; } if (v !== null && v !== undefined && v !== '' && v !== false) found = true; })(o, '');
    return found;
  }
  function device() { var d = localStorage.getItem('portal-device-id'); return d || 'web'; }
  var syncing = null;
  function sync(manual) {
    var C = window.PortalCloud;
    if (!C || !C.client || !C.user) return Promise.resolve(false);
    if (syncing) return syncing;
    var client = C.client, uid = C.user.id, meta = readMeta();
    if (meta.uid !== uid) meta = { uid: uid, s: {} };
    var secs = Object.keys(SECTIONS), pulled = false;
    syncing = client.from('portal_docs').select('section,doc,version').in('section', secs).then(function (r) {
      if (r.error) throw r.error;
      var cloud = {}; (r.data || []).forEach(function (row) { cloud[row.section] = row; });
      return secs.reduce(function (p, sec) {
        return p.then(function () {
          var raw = localStorage.getItem(SECTIONS[sec]), c = cloud[sec], m = meta.s[sec] || {};
          var local = null; try { local = raw ? JSON.parse(raw) : null; } catch (e) {}
          var localHas = !!(local && hasContent(local));
          function push(base) {
            return client.rpc('save_doc', { p_section: sec, p_doc: local, p_base_version: base, p_device: device() }).then(function (res) {
              if (res.error) throw res.error; var x = Array.isArray(res.data) ? res.data[0] : res.data;
              if (x && !x.conflict) meta.s[sec] = { v: x.version, h: hash(raw) };
            });
          }
          function pull() { var cr = JSON.stringify(c.doc); localStorage.setItem(SECTIONS[sec], cr); meta.s[sec] = { v: c.version, h: hash(cr) }; pulled = true; }
          if (!c) return localHas ? push(null) : null;
          var cloudRaw = JSON.stringify(c.doc);
          if (raw && hash(raw) === hash(cloudRaw)) { meta.s[sec] = { v: c.version, h: hash(raw) }; return; }
          var localChanged = !!raw && hash(raw) !== m.h, cloudChanged = c.version !== m.v;
          if (!localHas) return pull();
          if (!localChanged) return pull();
          if (!cloudChanged) return push(c.version);
          // both changed: the most recent save wins
          if ((local._ts || 0) >= ((c.doc && c.doc._ts) || 0)) return push(c.version);
          return pull();
        });
      }, Promise.resolve());
    }).then(function () { writeMeta(meta); syncing = null; if (pulled) listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); return true; },
      function (e) { syncing = null; if (manual) toast('לא הצלחנו לשמור בחשבון כרגע. הנתונים נשמרו במכשיר הזה.'); return false; });
    return syncing;
  }
  function onRemote(fn) { listeners.push(fn); }
  function startSync() {
    var C = window.PortalCloud;
    if (!C || !C.configured) return;
    (C.ready || Promise.resolve()).then(function () { sync(false); });
    window.addEventListener('portal-cloud', function () { sync(false); });
    window.addEventListener('pagehide', function () { sync(false); });
  }

  /* ---------- money ---------- */
  function settings() { try { return JSON.parse(localStorage.getItem('portal-settings-v1') || '{}'); } catch (e) { return {}; } }
  function dispCur() { var c = settings().currency; return CUR_SIGN[c] ? c : 'ILS'; }
  function num(v) { var x = typeof v === 'number' ? v : parseFloat(String(v === undefined || v === null ? '' : v).replace(/,/g, '')); return Number.isFinite(x) ? x : 0; }
  function numOrNull(v) { if (v === '' || v === null || v === undefined) return null; var x = num(v); return Number.isFinite(x) ? x : null; }
  function toILS(v, cur) { if (!cur || cur === 'ILS') return num(v); var P = window.Portal; var r = P && P.rateILS ? P.rateILS(cur) : null; return r ? num(v) * r : null; }
  function fromILS(v) { var c = dispCur(); if (c === 'ILS') return v; var P = window.Portal; var r = P && P.rateILS ? P.rateILS(c) : null; return r ? v / r : null; }
  function fmt(v, d) { return Number(v).toLocaleString('he-IL', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function money(v, cur, d) { if (v === null || v === undefined || !Number.isFinite(v)) return '—'; cur = cur || dispCur(); return (v < 0 ? '-' : '') + (CUR_SIGN[cur] || '') + fmt(Math.abs(v), d); }
  function disp(ils, d) { var x = ils === null ? null : fromILS(ils); return x === null ? 'חסר שער מטבע' : money(x, dispCur(), d); }

  /* ---------- tiny DOM helpers ---------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var seq = 0;
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function card(title, kids, badge) { return h('section', { class: 'card' }, [h('h2', { class: 'card-title' }, [h('span', { text: title }), badge || null])].concat(kids)); }
  /* field(label, type, value, onChange, opts) -> wrapper with a real <label for> */
  function field(label, type, value, onChange, o) {
    o = o || {}; var id = 't13f' + (++seq), inp;
    if (type === 'select') {
      inp = h('select', { id: id }, o.options.map(function (x) { return h('option', { value: x[0], text: x[1] }); }));
      inp.value = value === undefined || value === null ? o.options[0][0] : value;
      inp.addEventListener('change', function () { onChange(inp.value); });
    } else if (type === 'check') {
      inp = h('input', { id: id, type: 'checkbox' }); inp.checked = !!value;
      inp.addEventListener('change', function () { onChange(inp.checked); });
      return h('div', { class: 'field check' + (o.wide || label.length > 26 ? ' wide' : '') }, [inp, h('label', { for: id, text: label })]);
    } else if (type === 'textarea') {
      inp = h('textarea', { id: id, rows: o.rows || 6, readonly: o.readonly || null }); inp.value = value || '';
    } else {
      inp = h('input', { id: id, type: type, inputmode: type === 'number' ? 'decimal' : null, step: type === 'number' ? (o.step || 'any') : null, min: o.min === undefined ? null : o.min, max: o.max === undefined ? null : o.max, placeholder: o.placeholder || null, autocomplete: 'off' });
      inp.value = value === undefined || value === null ? '' : value;
      inp.addEventListener('input', function () { onChange(type === 'number' ? numOrNull(inp.value) : inp.value); });
    }
    var w = h('div', { class: 'field' + (o.wide || label.length > 26 ? ' wide' : '') }, [h('label', { for: id, text: label }), inp]);
    if (o.help) { var hid = id + 'h'; inp.setAttribute('aria-describedby', hid); w.appendChild(h('p', { class: 'help', id: hid, text: o.help })); }
    return w;
  }
  function curOptions() { return CURS.map(function (c) { return [c, c]; }); }
  function tot(k, v, cls) { return h('div', { class: 'tot' + (cls ? ' ' + cls : '') }, [h('span', { class: 'k', text: k }), h('span', { class: 'v num', text: v })]); }
  function live() { return h('div', { class: 't13-sr', 'aria-live': 'polite', 'aria-atomic': 'true' }); }
  function toast(msg) { var P = window.Portal; if (P && P.ui && P.ui.toast) P.ui.toast(msg); }
  function bar(ratio, cls, label) {
    var pctv = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    return h('div', { class: 't13-bar' + (cls ? ' ' + cls : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pctv), 'aria-label': label || 'התקדמות' }, [h('span', { style: 'width:' + pctv + '%' })]);
  }
  /* list editor: rows array, fields [{k,label,type,options,step}], onChange */
  function listEditor(rows, fields, onChange, o) {
    o = o || {}; var box = h('div');
    function draw() {
      box.innerHTML = '';
      if (!rows.length) box.appendChild(h('p', { class: 'empty', text: o.empty || 'עדיין אין שורות. אפשר להוסיף למטה.' }));
      rows.forEach(function (r, i) {
        var title = (r.name || '').trim() || (o.rowTitle || 'שורה') + ' ' + (i + 1);
        var del = h('button', { type: 'button', class: 'btn btn-danger', text: 'מחיקה', 'aria-label': 'מחיקת ' + title });
        del.addEventListener('click', function () { if (!confirm('למחוק את "' + title + '"?')) return; rows.splice(i, 1); onChange(); draw(); });
        var fs = h('div', { class: 'fields' }, fields.map(function (f) {
          return field(f.label, f.type, r[f.k] === undefined ? f.def : r[f.k], function (v) { r[f.k] = v; onChange(r); }, f);
        }));
        var extra = o.extra ? o.extra(r) : null;
        box.appendChild(h('div', { class: 'row-card', role: 'group', 'aria-label': title }, [fs, extra, h('div', { class: 'row-actions' }, [del])]));
      });
      var add = h('button', { type: 'button', class: 'btn btn-soft', text: o.addLabel || 'הוספה' });
      add.addEventListener('click', function () {
        var r = { id: uid() }; fields.forEach(function (f) { if (f.def !== undefined) r[f.k] = f.def; }); rows.push(r); onChange(); draw();
        var last = box.querySelectorAll('.row-card'); last = last[last.length - 1]; if (last) { var x = last.querySelector('input,select'); if (x) x.focus(); }
      });
      box.appendChild(h('div', { class: 'toolbar' }, [add]));
    }
    draw();
    return { el: box, redraw: draw };
  }
  function parseDate(s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDate(d) { return d ? d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() : '—'; }
  function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0); }
  function addMonths(d, m) { var x = new Date(d); x.setMonth(x.getMonth() + m); return x; }

  /* Register a page with portal.js (title + render). Wrap the body in .t13 for the type/touch sizes. */
  function page(id, title, sub, render) {
    window.PORTAL_PAGES = window.PORTAL_PAGES || {};
    window.PORTAL_PAGES[id] = { title: [title, sub], render: function (main) {
      main.classList.add('t13');
      try { render(main); } catch (e) { console.error(e); main.appendChild(h('p', { class: 'notice red', text: 'משהו השתבש בטעינת הדף. נסה לרענן.' })); }
    } };
  }
  function portalData() { var P = window.Portal; return P && P.data ? P.data : null; }
  function saveData() { var P = window.Portal; if (P && P.saveNow) P.saveNow(); }

  window.T13 = { read: read, write: write, sync: sync, onRemote: onRemote, h: h, card: card, field: field, tot: tot, live: live, bar: bar, toast: toast, listEditor: listEditor,
    money: money, disp: disp, toILS: toILS, fromILS: fromILS, num: num, numOrNull: numOrNull, fmt: fmt, dispCur: dispCur, curOptions: curOptions, uid: uid,
    parseDate: parseDate, today: today, ymd: ymd, fmtDate: fmtDate, monthsBetween: monthsBetween, addMonths: addMonths, page: page, portalData: portalData, saveData: saveData, hasContent: hasContent, NAV: NAV };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSync); else startSync();
})();
