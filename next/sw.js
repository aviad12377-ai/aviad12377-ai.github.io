/* Scope: /next/ only. Network-first so a stale cache cannot break the live root site. */
var CACHE = 'next-v1';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('next-') === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.indexOf('/next') !== 0) return; // never intercept the main site
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    if (res && res.ok && (u.pathname.indexOf('/next/app.') !== -1 || u.pathname.indexOf('/next/index') !== -1 || u.pathname === '/next/' || u.pathname === '/next')) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    }
    return res;
  }).catch(function () { return caches.match(e.request); }));
});
