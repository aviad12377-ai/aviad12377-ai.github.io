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
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .3-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.3 4 8l-1 3 2 1v0l-2 1 1 3 2-.3 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z',
    news: 'M4 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5',
    scan: 'M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 2h2M20 7V5a1 1 0 0 0-1-1h-2M20 17v2a1 1 0 0 1-1 2h-2M7 12h10M12 8v8'
  }, window.PORTAL_ICONS || {});
  var base = [
    { id: 'home', href: 'index.html', label: { he: 'בית', en: 'Home', es: 'Inicio' }, icon: 'home', tab: true },
    { id: 'wealth', href: 'wealth.html', label: { he: 'נכסים', en: 'Assets', es: 'Activos' }, icon: 'wallet', tab: true },
    { id: 'loans', href: 'loans.html', label: { he: 'חובות', en: 'Debts', es: 'Deudas' }, icon: 'swap', tab: true },
    { id: 'me', href: 'me.html', label: { he: 'פרופיל', en: 'Profile', es: 'Perfil' }, icon: 'user', tab: true },
    { id: 'avatar', href: 'avatar.html', label: { he: 'אווטאר', en: 'Avatar', es: 'Avatar' }, icon: 'user', group: 'account', parent: 'me' },
    { id: 'pension', href: 'pension.html', label: { he: 'פנסיה וגמל', en: 'Pension', es: 'Pensión' }, icon: 'umbrella', group: 'wealth', parent: 'wealth' },
    { id: 'hishtalmut', href: 'hishtalmut.html', label: { he: 'קרן השתלמות', en: 'Study fund', es: 'Fondo de estudios' }, icon: 'grad', group: 'wealth', parent: 'wealth' },
    { id: 'savings', href: 'savings.html', label: { he: 'חסכונות', en: 'Savings', es: 'Ahorros' }, icon: 'piggy', group: 'wealth', parent: 'wealth' },
    { id: 'portfolio', href: 'portfolio.html', label: { he: 'השקעות', en: 'Investments', es: 'Inversiones' }, icon: 'chart', tab: true, tabOrder: 3 },
    // t463: household expense tracking is frozen; the pages stay reachable and show a coming-soon banner, data is kept
    { id: 'budget', href: 'budget.html', label: { he: 'תקציב והוצאות', en: 'Budget', es: 'Presupuesto' }, icon: 'pie', group: 'tools', parent: 'home', soon: true },
    { id: 'options', href: 'options.html', label: { he: 'אופציות', en: 'Options', es: 'Opciones' }, icon: 'key', group: 'wealth', parent: 'wealth' },
    { id: 'mortgage', href: 'mortgage.html', label: { he: 'משכנתא', en: 'Mortgage', es: 'Hipoteca' }, icon: 'house', group: 'debts', parent: 'loans' },
    { id: 'cards', href: 'cards.html', label: { he: 'כרטיסי אשראי', en: 'Credit cards', es: 'Tarjetas' }, icon: 'card', group: 'debts', parent: 'loans' },
    { id: 'support', href: 'support.html', label: { he: 'בקשות ותמיכה', en: 'Support', es: 'Soporte' }, icon: 'chat', group: 'account', parent: 'me' },
    { id: 'privacy', href: 'privacy.html', label: { he: 'פרטיות', en: 'Privacy', es: 'Privacidad' }, icon: 'shield', group: 'account', parent: 'me' },
    { id: 'news', href: 'news.html', label: { he: 'חדשות', en: 'News', es: 'Noticias' }, icon: 'news', group: 'tools', parent: 'home' },
    { id: 'briefs', href: 'briefs.html', label: { he: 'מבזקי שוק', en: 'Market briefs', es: 'Resúmenes' }, icon: 'M13 2 4 14h7l-1 8 9-12h-7z', group: 'tools', parent: 'home' },
    { id: 'alerts', href: 'alerts.html', label: { he: 'התראות', en: 'Alerts', es: 'Alertas' }, icon: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4', group: 'account', parent: 'home' },
    { id: 'scanner', href: 'scanner.html', label: { he: 'סורק', en: 'Scanner', es: 'Escáner' }, icon: 'scan', group: 'tools', parent: 'home' },
    // pages owned by other workers, listed here too so every page's "עוד" sheet shows them
    { id: 'networth', href: 'networth.html', label: { he: 'הון לאורך זמן', en: 'Net worth history', es: 'Patrimonio' }, icon: 'chart', group: 'wealth', parent: 'wealth' },
    { id: 'assets', href: 'assets.html', label: { he: 'נכסים: דירה, רכב, קרקע', en: 'Property & car', es: 'Bienes' }, icon: 'house', group: 'wealth', parent: 'wealth' },
    { id: 'goals', href: 'goals.html', label: { he: 'קרן חירום ויעדים', en: 'Goals', es: 'Metas' }, icon: 'piggy', group: 'tools', parent: 'home' },
    { id: 'subscriptions', href: 'subscriptions.html', label: { he: 'מנויים וחיובים', en: 'Subscriptions', es: 'Suscripciones' }, icon: 'card', group: 'tools', parent: 'home', soon: true },
    { id: 'debts-planner', href: 'debts-planner.html', label: { he: 'תכנון החזר חובות', en: 'Debt payoff', es: 'Pago de deudas' }, icon: 'swap', group: 'debts', parent: 'loans' },
    { id: 'actions', href: 'actions.html', label: { he: 'צעדים לחיסכון בדמי ניהול', en: 'Fee actions', es: 'Comisiones' }, icon: 'bulb', group: 'tools', parent: 'wealth' },
    { id: 'cashflow', href: 'cashflow.html', label: { he: 'תחזית תזרים ל־12 חודשים', en: 'Cash-flow forecast', es: 'Flujo de caja' }, icon: 'pie', group: 'tools', parent: 'home' },
    { id: 'retirement', href: 'retirement.html', label: { he: 'תחזית פרישה', en: 'Retirement', es: 'Jubilación' }, icon: 'umbrella', group: 'wealth', parent: 'wealth' },
    { id: 'tax', href: 'tax.html', label: { he: 'מס הכנסה: נקודות זיכוי והחזר', en: 'Income tax helper', es: 'Impuestos' }, icon: 'shield', group: 'tools', parent: 'home' },
    { id: 'report', href: 'report.html', label: { he: 'דוח כספי להדפסה', en: 'Printable report', es: 'Informe' }, icon: 'chart', group: 'tools', parent: 'home' },
    { id: 'feedback', href: 'feedback.html', label: { he: 'משוב ודיווח על תקלה', en: 'Feedback', es: 'Comentarios' }, icon: 'chat', group: 'account', parent: 'me' },
    { id: 'compare-cards', href: 'compare-cards.html', label: { he: 'השוואת כרטיסים', en: 'Compare cards', es: 'Comparar tarjetas' }, icon: 'card', group: 'debts', parent: 'loans' },
    { id: 'compare-savings', href: 'compare-savings.html', label: { he: 'השוואת פיקדונות', en: 'Compare deposits', es: 'Comparar depósitos' }, icon: 'piggy', group: 'wealth', parent: 'wealth' },
    { id: 'compare-funds', href: 'compare-funds.html', label: { he: 'השוואת קרנות', en: 'Compare funds', es: 'Comparar fondos' }, icon: 'umbrella', group: 'wealth', parent: 'wealth' },
    { id: 'compare-mortgage', href: 'compare-mortgage.html', label: { he: 'בדיקת מחזור משכנתא', en: 'Refinance check', es: 'Revisión de refinanciación' }, icon: 'house', group: 'debts', parent: 'loans' }
  ];
  var extra = window.PORTAL_NAV || [];
  var seen = {}; window.PORTAL_NAV = base.concat(extra).filter(function (e) { if (!e || !e.id || seen[e.id]) return false; seen[e.id] = 1; return true; });
  window.PORTAL_NAV_GROUPS = { wealth: { he: 'נכסים', en: 'Assets', es: 'Activos' }, debts: { he: 'חובות', en: 'Debts', es: 'Deudas' }, tools: { he: 'כלים', en: 'Tools', es: 'Herramientas' }, account: { he: 'חשבון', en: 'Account', es: 'Cuenta' } };

  /* ---------- bottom tab bar + "more" sheet, usable by any page (with or without portal.js) ---------- */
  var UI = { he: { more: 'עוד', main: 'ניווט ראשי', lang: 'שפה', soon: 'בקרוב' }, en: { more: 'More', main: 'Main navigation', lang: 'Language', soon: 'Soon' }, es: { more: 'Más', main: 'Navegación principal', lang: 'Idioma', soon: 'Pronto' } };
  var TAB_ORDER = ['home', 'wealth', 'portfolio', 'loans', 'me'];
  function tabs() { return window.PORTAL_NAV.filter(function (e) { return e.tab; }).sort(function (a, b) { var x = TAB_ORDER.indexOf(a.id), y = TAB_ORDER.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }); }
  function fixParents() { window.PORTAL_NAV.forEach(function (e) { if (e && (e.parent === 'budget' || e.parent === 'subscriptions')) e.parent = 'home'; if (e && (e.id === 'budget' || e.id === 'subscriptions')) { e.soon = true; e.tab = false; e.group = 'tools'; } }); }
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
      items.sort(function (a, b) { return (a.soon ? 1 : 0) - (b.soon ? 1 : 0); }).forEach(function (e) {
        if (e.soon) sheet.appendChild(el('span', { class: 'soon', 'aria-disabled': 'true' }, [icon(e.icon), el('span', { text: label(e) }), el('em', { class: 'soon-badge', text: UI[l].soon })]));
        else sheet.appendChild(el('a', { href: e.href, class: e.id === page ? 'on' : null, 'aria-current': e.id === page ? 'page' : null }, [icon(e.icon), el('span', { text: label(e) })]));
      });
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
    fixParents();
    var me = window.PORTAL_NAV.filter(function (e) { return e.id === page; })[0], lit = me ? (me.tab ? me.id : me.parent) : null;
    var bar = el('nav', { class: 'tabbar', 'aria-label': UI[lang()].main }, tabs().slice(0, 5).map(function (e) {
      return el('a', { href: e.href, class: e.id === lit ? 'on' : null, 'aria-current': e.id === page ? 'page' : null }, [icon(e.icon), el('span', { text: label(e) })]);
    }));
    var more = el('button', { type: 'button', id: 'tab-more', class: lit ? null : 'on', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, [icon('more'), el('span', { text: UI[lang()].more })]);
    more.addEventListener('click', function () { more.setAttribute('aria-expanded', 'true'); moreSheet(page, more); });
    bar.appendChild(more);
    document.body.appendChild(bar);
    prefetchSetup();
  }
  // instant navigation: the browser prefetches a page when the finger/mouse is on its link (Speculation Rules, with a <link rel=prefetch> fallback)
  function prefetchSetup() {
    try {
      if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
        var s = document.createElement('script'); s.type = 'speculationrules';
        s.textContent = JSON.stringify({ prefetch: [{ source: 'document', where: { href_matches: '*.html' }, eagerness: 'moderate' }] });
        document.head.appendChild(s); return;
      }
    } catch (e) {}
    var done = {};
    function pf(e) { var a = e.target && e.target.closest && e.target.closest('a[href$=".html"]'); if (!a || done[a.href] || a.origin !== location.origin) return; done[a.href] = 1; var l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.href; document.head.appendChild(l); }
    document.addEventListener('pointerover', pf, { passive: true }); document.addEventListener('touchstart', pf, { passive: true });
  }
  window.PortalNav = { mount: mount, icon: icon, label: label };
})();
