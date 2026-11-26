/* Shared UX helpers for comparison pages. Uses design-system tokens via compare.css. */
(function (root) {
  'use strict';

  function h(tag, attrs, kids) {
    if (root.Portal && root.Portal.ui && root.Portal.ui.h) return root.Portal.ui.h(tag, attrs, kids);
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
  function pct(v, digits) {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    var d = digits == null ? 2 : digits;
    var n = Math.round(Number(v) * Math.pow(10, d)) / Math.pow(10, d);
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  }
  function uid(p) { return p + '-' + Math.random().toString(36).slice(2, 7); }
  function ensureCss() {
    if (document.querySelector('link[href="compare.css"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'compare.css'; document.head.appendChild(l);
  }
  function isNarrow() {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 699px)').matches;
  }
  function afterPaint(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { setTimeout(fn, 0); });
    } else setTimeout(fn, 0);
  }
  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
      return r.json();
    });
  }
  function ensureUx(cb) {
    if (root.CompareUx && root.CompareUx.hero) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'compare-ux.js';
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function hero(opts) {
    opts = opts || {};
    var btn = null;
    if (opts.action) {
      btn = h('button', {
        type: 'button',
        class: 'btn btn-primary primary-action',
        id: opts.actionId || 'cmp-primary',
        text: opts.action
      });
      if (opts.onAction) btn.addEventListener('click', opts.onAction);
    }
    return h('div', { class: 'start-card cmp-hero', id: opts.id || 'cmp-hero' }, [
      opts.lead ? h('p', { text: opts.lead }) : null,
      btn
    ]);
  }

  function filters(opts) {
    opts = opts || {};
    var bodyKids = opts.body || (opts.form ? [opts.form] : []);
    var body = h('div', { class: 'cmp-filters-body' }, bodyKids);
    var sum = h('summary', {
      class: 'cmp-filters-sum',
      id: opts.buttonId || 'cmp-filters-btn',
      text: opts.label || 'סינון והתאמה'
    });
    var det = h('details', { class: 'cmp-filters card', id: opts.id || 'cmp-filters' }, [sum, body]);
    if (opts.open === true || (opts.open == null && !isNarrow())) det.open = true;
    return det;
  }
  function openFilters(det) {
    if (!det) return;
    det.open = true;
    var first = det.querySelector('input, select, textarea, button:not(summary)');
    if (first && first.focus) first.focus();
    if (det.scrollIntoView) det.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function scrollTo(id) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function top3(items, opts) {
    opts = opts || {};
    var el = h('section', { class: 'cmp-top3', id: opts.id || 'cmp-top3', 'aria-live': 'polite' });
    el.appendChild(h('h2', { class: 'sec-h', text: opts.title || 'שלושת המובילים עבורכם' }));
    if (!items || !items.length) {
      el.appendChild(h('div', { class: 'empty', text: opts.empty || 'אין תוצאה להצגה לפי הבחירה הנוכחית.' }));
      return el;
    }
    items.slice(0, 3).forEach(function (it, i) {
      el.appendChild(h('article', { class: 'card cmp-top3-item' + (it.mine ? ' mine' : ''), 'data-place': String(i + 1) }, [
        h('div', { class: 'cmp-place', text: String(i + 1) }),
        h('h3', { class: 'card-title', text: it.title || '—' }),
        it.value != null ? h('p', { class: 'cmp-top3-value num ' + (it.valueClass || ''), text: it.value }) : null,
        it.sub ? h('p', { class: 'help', text: it.sub }) : null,
        it.note ? h('p', { class: 'help', text: it.note }) : null
      ]));
    });
    return el;
  }

  function empty(text, action, onAction, actionId) {
    var kids = [h('p', { class: 'empty', text: text || 'אין תוצאות להצגה.' })];
    if (action) {
      var b = h('button', { type: 'button', class: 'btn btn-primary', id: actionId, text: action });
      if (onAction) b.addEventListener('click', onAction);
      kids.push(b);
    }
    return h('div', { class: 'cmp-empty card' }, kids);
  }

  function tipButton(label, tip) {
    if (!tip) return null;
    var wrap = h('span', { class: 'cmp-th-tools' });
    var btn = h('button', { type: 'button', class: 'cmp-tip-btn', 'aria-label': 'הסבר על ' + label, text: '?' });
    var box = h('span', { class: 'cmp-tip', role: 'tooltip', hidden: true, text: tip });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = box.hidden;
      var page = btn.closest('.cmp-page') || document;
      page.querySelectorAll('.cmp-tip').forEach(function (t) { t.hidden = true; });
      box.hidden = !willOpen;
    });
    wrap.appendChild(btn);
    wrap.appendChild(box);
    return wrap;
  }

  function buildTable(cols, rows, opts) {
    opts = opts || {};
    var tbl = document.createElement('table');
    tbl.className = 'cmp data';
    var cap = document.createElement('caption');
    cap.className = 'sr-only';
    cap.textContent = opts.caption || 'טבלת השוואה';
    tbl.appendChild(cap);
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    cols.forEach(function (c) {
      var th = document.createElement('th');
      th.scope = 'col';
      if (c.num) th.className = 'num';
      if (c.sortable && opts.onSort) {
        th.className = (th.className ? th.className + ' ' : '') + 'sortable';
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = c.label;
        if (opts.sortKey === c.key) b.setAttribute('aria-sort', opts.sortDir === -1 ? 'descending' : 'ascending');
        b.addEventListener('click', function () { opts.onSort(c.key); });
        th.appendChild(b);
        if (c.tip) th.appendChild(tipButton(c.label, c.tip));
      } else {
        var lab = document.createElement('span');
        lab.textContent = c.label;
        th.appendChild(lab);
        if (c.tip) th.appendChild(tipButton(c.label, c.tip));
      }
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    tbl.appendChild(thead);
    var tb = document.createElement('tbody');
    if (!rows.length) {
      var er = document.createElement('tr');
      var ed = document.createElement('td');
      ed.colSpan = cols.length;
      ed.textContent = opts.empty || 'אין תוצאות לפי הסינון.';
      er.appendChild(ed);
      tb.appendChild(er);
    }
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-cmp-row', '1');
      if (r.mine) tr.className = 'mine';
      if (r.className) tr.className = (tr.className ? tr.className + ' ' : '') + r.className;
      (r.cells || []).forEach(function (cell, i) {
        var td = document.createElement('td');
        var col = cols[i] || {};
        if (col.num || (cell && cell.num)) td.className = 'num' + (cell && cell.valueClass ? ' ' + cell.valueClass : '');
        else if (cell && cell.valueClass) td.className = cell.valueClass;
        if (cell && cell.node) td.appendChild(cell.node);
        else td.textContent = (cell && cell.text != null) ? cell.text : (cell == null ? '—' : String(cell));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    return tbl;
  }

  function buildList(rows, opts) {
    opts = opts || {};
    var list = h('div', { class: 'cmp-list', id: opts.listId || 'cmp-list' });
    if (!rows.length) {
      list.appendChild(h('div', { class: 'empty', text: opts.empty || 'אין תוצאות לפי הסינון.' }));
      return list;
    }
    rows.forEach(function (r) {
      var art = h('article', { class: 'card cmp-result' + (r.mine ? ' mine' : ''), 'data-cmp-row': '1' });
      if (r.title) art.appendChild(h('h3', { class: 'card-title', text: r.title }));
      if (r.value != null) art.appendChild(h('p', { class: 'cmp-result-value num ' + (r.valueClass || ''), text: r.value }));
      if (r.fields && r.fields.length) {
        var kv = h('div', { class: 'kv' });
        r.fields.forEach(function (f) {
          kv.appendChild(h('span', { text: f.k }));
          kv.appendChild(h('span', { class: 'num', text: f.v }));
        });
        art.appendChild(kv);
      }
      if (r.note) art.appendChild(h('p', { class: 'help', text: r.note }));
      if (r.extra) art.appendChild(r.extra);
      list.appendChild(art);
    });
    return list;
  }

  function results(cols, rows, opts) {
    opts = opts || {};
    var wrap = h('div', { class: 'cmp-results' });
    wrap.appendChild(buildList(rows, opts));
    var tbl = buildTable(cols, rows, opts);
    var tw = h('div', { class: 'tbl-wrap' });
    tw.appendChild(tbl);
    var hint = h('p', { class: 'cmp-scroll-hint help', hidden: true, text: 'אפשר לגלול את הטבלה הצידה כדי לראות את כל העמודות.' });
    tw.appendChild(hint);
    wrap.appendChild(tw);
    afterPaint(function () {
      if (tw.scrollWidth > tw.clientWidth + 8) hint.hidden = false;
    });
    return wrap;
  }

  function skeleton(text) {
    return h('div', { class: 'cmp-skel', role: 'status', text: text || 'טוענים נתונים…' });
  }

  function loadScript(src, cb) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing && root.CompareUx && root.CompareUx.hero) { cb(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  root.CompareUx = {
    h: h, money: money, pct: pct, uid: uid, ensureCss: ensureCss,
    isNarrow: isNarrow, afterPaint: afterPaint, fetchJson: fetchJson, ensureUx: ensureUx,
    hero: hero, filters: filters, openFilters: openFilters, scrollTo: scrollTo,
    top3: top3, empty: empty, tipButton: tipButton,
    buildTable: buildTable, buildList: buildList, results: results,
    skeleton: skeleton, loadScript: loadScript
  };
})(typeof window !== 'undefined' ? window : globalThis);
