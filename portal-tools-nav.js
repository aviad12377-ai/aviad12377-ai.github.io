/* Register the news and scanner pages in the shared "עוד" sheet.
   Load this file before portal-nav.js. Does not edit portal-nav.js. */
(function () {
  window.PORTAL_ICONS = Object.assign(window.PORTAL_ICONS || {}, {
    news: "M4 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5",
    scan: "M4 7V5a1 1 0 0 1 1-1h2M4 17v2a1 1 0 0 0 1 2h2M20 7V5a1 1 0 0 0-1-1h-2M20 17v2a1 1 0 0 1-1 2h-2M7 12h10M12 8v8"
  });
  window.PORTAL_NAV = window.PORTAL_NAV || [];
  window.PORTAL_NAV.push(
    { id: "news", href: "news.html", label: { he: "חדשות", en: "News", es: "Noticias" }, icon: "news", group: "tools", parent: "home" },
    { id: "scanner", href: "scanner.html", label: { he: "סורק", en: "Scanner", es: "Escáner" }, icon: "scan", group: "tools", parent: "home" }
  );
})();
