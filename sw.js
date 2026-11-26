// Service worker: offline shell. Network-first so updates show up.
// Never caches prices.json / funds.json, cross-origin requests (Supabase, quotes) or anything but GET.
const CACHE = 'options-calc-v8.1';
const SHELL = ['./', './index.html', './options.html', './wealth.html', './savings.html', './pension.html', './hishtalmut.html', './portfolio.html',
  './mortgage.html', './loans.html', './cards.html', './budget.html', './me.html', './privacy.html', './support.html', './news.html', './scanner.html',
  './portal.css', './news.css', './scanner.css', './portal-tools-nav.js', './scripts/news.js', './scripts/scanner.js', './portal-nav.js', './portal-avatar.js', './portal.js', './portal-i18n.js', './portal-i18n-extra.js', './portal-cloud.js', './portal-maslaka.js', './portal-support.js', './auth-config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\/(prices|funds)\.json$/.test(url.pathname)) return; // always live from network
  if (/\/admin\.html$/.test(url.pathname)) return;           // never keep the admin page offline
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
