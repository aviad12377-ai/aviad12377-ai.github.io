/* Site navigation registry (v8). Every page loads this before portal.js.
   To add a page: push one entry below (or, from your own script loaded before portal.js:
   (window.PORTAL_NAV = window.PORTAL_NAV || []).push({...})).
   Fields: id (page id = <body data-page> / file stem), href, label {he,en,es}, icon (key of PORTAL_ICONS or raw SVG path data),
   tab: true = one of the 5 bottom-bar slots (keep it at 5), group: 'wealth' | 'debts' | 'tools' | 'account' for the "עוד" sheet,
   parent: id of the tab that should light up while on this page. */
(function () {
  window.PORTAL_ICONS = Object.assign({
    home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    wallet: 'M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4v4M16.5 14h.01',
    pie: 'M12 3v9h9M21 12a9 9 0 1 1-9-9',
    swap: 'M7 7h12l-3-3M17 17H5l3 3',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    umbrella: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v7a2 2 0 0 0 4 0',
    grad: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
    piggy: 'M5 11a7 6 0 0 1 13-2l2-1v4l-1 1v3h-3v2h-2v-2H9v2H7v-3a6 6 0 0 1-2-4zM14 9h.01',
    chart: 'M3 20h18M5 16l4-5 4 3 6-8',
    key: 'M15 7a4 4 0 1 1-4 4L3 19v2h3l1-1v-2h2v-2h2l2-2',
    house: 'M3 11l9-8 9 8M5 10v10h14V10M9 17l6-6M9.5 11.5h.01M14.5 16.5h.01',
    card: 'M3 6h18v12H3zM3 10h18M7 15h3',
    chat: 'M4 5h16v11H8l-4 4z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.3 4 8l-1 3 2 1v0l-2 1 1 3 2-.3 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z'
  }, window.PORTAL_ICONS || {});
  var base = [
    { id: 'home', href: 'index.html', label: { he: 'בית', en: 'Home', es: 'Inicio' }, icon: 'home', tab: true },
    { id: 'wealth', href: 'wealth.html', label: { he: 'נכסים', en: 'Assets', es: 'Activos' }, icon: 'wallet', tab: true },
    { id: 'budget', href: 'budget.html', label: { he: 'תקציב', en: 'Budget', es: 'Presupuesto' }, icon: 'pie', tab: true },
    { id: 'loans', href: 'loans.html', label: { he: 'חובות', en: 'Debts', es: 'Deudas' }, icon: 'swap', tab: true },
    { id: 'me', href: 'me.html', label: { he: 'פרופיל', en: 'Profile', es: 'Perfil' }, icon: 'user', tab: true },
    { id: 'pension', href: 'pension.html', label: { he: 'פנסיה וגמל', en: 'Pension', es: 'Pensión' }, icon: 'umbrella', group: 'wealth', parent: 'wealth' },
    { id: 'hishtalmut', href: 'hishtalmut.html', label: { he: 'קרן השתלמות', en: 'Study fund', es: 'Fondo de estudios' }, icon: 'grad', group: 'wealth', parent: 'wealth' },
    { id: 'savings', href: 'savings.html', label: { he: 'חסכונות', en: 'Savings', es: 'Ahorros' }, icon: 'piggy', group: 'wealth', parent: 'wealth' },
    { id: 'portfolio', href: 'portfolio.html', label: { he: 'תיק השקעות', en: 'Portfolio', es: 'Cartera' }, icon: 'chart', group: 'wealth', parent: 'wealth' },
    { id: 'options', href: 'options.html', label: { he: 'אופציות', en: 'Options', es: 'Opciones' }, icon: 'key', group: 'wealth', parent: 'wealth' },
    { id: 'mortgage', href: 'mortgage.html', label: { he: 'משכנתא', en: 'Mortgage', es: 'Hipoteca' }, icon: 'house', group: 'debts', parent: 'loans' },
    { id: 'cards', href: 'cards.html', label: { he: 'כרטיסי אשראי', en: 'Credit cards', es: 'Tarjetas' }, icon: 'card', group: 'debts', parent: 'loans' },
    { id: 'support', href: 'support.html', label: { he: 'בקשות ותמיכה', en: 'Support', es: 'Soporte' }, icon: 'chat', group: 'account', parent: 'me' },
    { id: 'privacy', href: 'privacy.html', label: { he: 'פרטיות', en: 'Privacy', es: 'Privacidad' }, icon: 'shield', group: 'account', parent: 'me' }
  ];
  var extra = window.PORTAL_NAV || [];
  var seen = {}; window.PORTAL_NAV = base.concat(extra).filter(function (e) { if (!e || !e.id || seen[e.id]) return false; seen[e.id] = 1; return true; });
  window.PORTAL_NAV_GROUPS = { wealth: { he: 'נכסים', en: 'Assets', es: 'Activos' }, debts: { he: 'חובות', en: 'Debts', es: 'Deudas' }, tools: { he: 'כלים', en: 'Tools', es: 'Herramientas' }, account: { he: 'חשבון', en: 'Account', es: 'Cuenta' } };

  /* ---------- bottom tab bar + "more" sheet, usable by any page (with or without portal.js) ---------- */
  var UI = { he: { more: 'עוד', main: 'ניווט ראשי', lang: 'שפה' }, en: { more: 'More', main: 'Main navigation', lang: 'Language' }, es: { more: 'Más', main: 'Navegación principal', lang: 'Idioma' } };
  function lang() { try { var l = JSON.parse(localStorage.getItem('portal-settings-v1') || '{}').lang; return UI[l] ? l : 'he'; } catch (e) { return 'he'; } }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'text') e.textContent = v; else if (k === 'onclick') e.addEventListener('click', v); else e.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); }); return e;
  }
  function icon(key) {
    var d = window.PORTAL_ICONS[key] || key || '';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); svg.appendChild(path); return svg;
  }
  function label(e) { var l = lang(); return (e.label && (e.label[l] || e.label.he)) || e.id; }
  function moreSheet(page, btn) {
    var l = lang(), groups = window.PORTAL_NAV_GROUPS;
    var wrap = el('div', { class: 'more-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': UI[l].more }), sheet = el('div', { class: 'sheet' });
    Object.keys(groups).forEach(function (g) {
      var items = window.PORTAL_NAV.filter(function (e) { return !e.tab && (e.group || 'tools') === g; });
      if (!items.length) return;
      sheet.appendChild(el('h2', { text: groups[g][l] || groups[g].he }));
      items.forEach(function (e) { sheet.appendChild(el('a', { href: e.href, class: e.id === page ? 'on' : null, 'aria-current': e.id === page ? 'page' : null }, [icon(e.icon), el('span', { text: label(e) })])); });
    });
    var sel = el('select', { id: 'more-lang' }, [['he', 'עברית'], ['en', 'English'], ['es', 'Español']].map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    sel.value = l;
    sel.addEventListener('change', function () { try { var s = JSON.parse(localStorage.getItem('portal-settings-v1') || '{}'); s.lang = sel.value; localStorage.setItem('portal-settings-v1', JSON.stringify(s)); } catch (e) {} location.reload(); });
    sheet.appendChild(el('div', { class: 'field', style: 'grid-column:1/-1;margin-top:6px' }, [el('label', { for: 'more-lang', text: UI[l].lang }), sel]));
    wrap.appendChild(sheet);
    function close() { wrap.remove(); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(wrap);
    var f = sheet.querySelector('a'); if (f) f.focus();
  }
  function mount(page) {
    if (document.querySelector('.tabbar')) return;
    page = page || (document.body && document.body.getAttribute('data-page')) || '';
    var me = window.PORTAL_NAV.filter(function (e) { return e.id === page; })[0], lit = me ? (me.tab ? me.id : me.parent) : null;
    var bar = el('nav', { class: 'tabbar', 'aria-label': UI[lang()].main }, window.PORTAL_NAV.filter(function (e) { return e.tab; }).slice(0, 5).map(function (e) {
      return el('a', { href: e.href, class: e.id === lit ? 'on' : null, 'aria-current': e.id === page ? 'page' : null }, [icon(e.icon), el('span', { text: label(e) })]);
    }));
    var more = el('button', { type: 'button', id: 'tab-more', class: lit ? null : 'on', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, [icon('more'), el('span', { text: UI[lang()].more })]);
    more.addEventListener('click', function () { more.setAttribute('aria-expanded', 'true'); moreSheet(page, more); });
    bar.appendChild(more);
    document.body.appendChild(bar);
  }
  window.PortalNav = { mount: mount, icon: icon, label: label };
})();
