/* Rewrites relative URLs used by root modules (portal.js, portal-cloud.js) so they resolve
   from /next/ to the live site root. Also registers the empty page renderer so portal.js
   does not paint the old chrome (it mounts into a hidden #portal). */
(function () {
  'use strict';
  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES.next = { title: ['brand', 'home_sub'], render: function () {} };

  var ROOT_SCRIPTS = /^(vendor\/[^/?#]+)$/;
  var ROOT_JSON = /^(prices|funds|tase_securities)\.json(\?|$)/;
  var origCreate = document.createElement.bind(document);
  document.createElement = function (tag, opts) {
    var el = origCreate(tag, opts);
    if (String(tag).toLowerCase() === 'script') {
      var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src') ||
                 Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
      if (desc && desc.set) {
        Object.defineProperty(el, 'src', {
          configurable: true, enumerable: true,
          get: function () { return desc.get ? desc.get.call(this) : this.getAttribute('src'); },
          set: function (v) {
            var nv = (typeof v === 'string' && ROOT_SCRIPTS.test(v)) ? '../' + v : v;
            desc.set.call(this, nv);
          }
        });
      }
    }
    return el;
  };

  var ofetch = window.fetch.bind(window);
  function rewrite(u) {
    if (typeof u !== 'string') return u;
    if (ROOT_JSON.test(u)) return '../' + u;
    try {
      var url = new URL(u, location.href);
      if (url.origin === location.origin && /\/next\/(prices|funds|tase_securities)\.json/.test(url.pathname)) {
        url.pathname = url.pathname.replace('/next/', '/');
        return url.href;
      }
    } catch (e) {}
    return u;
  }
  window.fetch = function (input, init) {
    if (typeof input === 'string') return ofetch(rewrite(input), init);
    if (input && typeof input === 'object' && input.url) {
      var nu = rewrite(input.url);
      if (nu !== input.url) return ofetch(nu, init);
    }
    return ofetch(input, init);
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {});
    });
  }
})();
