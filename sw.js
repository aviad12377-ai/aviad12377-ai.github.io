// Service worker: offline shell. Network-first so updates show up. Never caches prices.json or cross-origin price requests.
const CACHE = 'options-calc-v6.2';
const SHELL = ['./', './index.html', './options.html', './savings.html', './pension.html', './hishtalmut.html', './mortgage.html', './cards.html',
  './portal.css', './portal.js', './portal-i18n.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\/prices\.json$/.test(url.pathname)) return; // always live from network
  e.respondWith(fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
