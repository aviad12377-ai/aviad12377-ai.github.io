// Service worker: offline shell. Network-first so updates show up.
// Never caches prices.json / funds.json, cross-origin requests (Supabase, quotes) or anything but GET.
const CACHE = 'options-calc-v8.7';
const SHELL = ['./', './index.html', './options.html', './wealth.html', './savings.html', './pension.html', './hishtalmut.html', './portfolio.html',
  './mortgage.html', './loans.html', './cards.html', './budget.html', './me.html', './privacy.html', './support.html', './news.html', './scanner.html', './compare-cards.html', './compare-savings.html', './compare-funds.html', './compare-mortgage.html', './networth.html', './assets.html', './goals.html', './subscriptions.html', './debts-planner.html', './actions.html', './feedback.html',
  './cashflow.html', './retirement.html', './js/cashflow.js', './js/retirement.js', './portal-insights.js', './tax.html', './report.html', './js/tax.js', './js/report.js',
  './portal.css', './compare.css', './css/t13.css', './compare-lib.js', './portal-compare-i18n.js', './portal-compare-cards.js', './portal-compare-savings.js', './portal-loans-compare.js', './portal-compare-funds.js', './portal-compare-mortgage.js', './compare-ux.js', './avatar.html', './js/avatar.js', './css/avatar.css', './briefs.html', './alerts.html', './css/t16.css', './js/t16-common.js', './js/news-hub.js', './js/briefs.js', './js/alerts.js', './js/latest-brief.js', './heatmap.html', './js/heatmap.js', './css/heatmap.css', './data/cards.json', './data/savings.json', './data/loan-rates.json', './data/scanner.json', './js/t13-core.js', './js/networth.js', './js/assets.js', './js/goals.js', './js/subscriptions.js', './js/debts.js', './js/actions.js', './js/feedback.js', './news.css', './scanner.css', './portal-tools-nav.js', './scripts/news.js', './scripts/scanner.js', './portal-nav.js', './portal-avatar.js', './portal-esop.js', './portal.js', './portal-i18n.js', './portal-i18n-extra.js', './portal-cloud.js', './portal-maslaka.js', './portal-support.js', './auth-config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/^\/(next|v2)(\/|$)/.test(url.pathname)) return; // /next/ and /v2/ have their own service worker / no offline copy here
  if (/\/(prices|funds)\.json$/.test(url.pathname)) return; // always live from network
  if (/\/data\/(news-hub|breaking|heatmap)\.json$|\/data\/briefs\//.test(url.pathname)) return; // news and briefs always live
  if (/\/admin\.html$/.test(url.pathname)) return;           // never keep the admin page offline
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});

// Web Push (T-16): market briefs and breaking news. Payload: { title, body, url, tag }.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'מבזק שוק';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', tag: d.tag || 'brief', renotify: false, lang: 'he', dir: 'rtl',
    icon: './icon-192.png', badge: './icon-192.png', data: { url: d.url || './briefs.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './briefs.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
