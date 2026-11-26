/* next/ header + profile avatar. Owned by the news+avatar worker.
   Implements window.NextAvatar.mount({ header, profile }) — see ux/coordination.md.
   Reuses ../js/avatar.js (PortalAvatar). The selfie never leaves the device. */
(function () {
  'use strict';

  function ensureCss() {
    if (!document.querySelector('link[data-next-news]')) {
      var n = document.createElement('link');
      n.rel = 'stylesheet'; n.href = 'news.css'; n.setAttribute('data-next-news', '1');
      document.head.appendChild(n);
    }
  }
  ensureCss();

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.PortalAvatar) return res(window.PortalAvatar);
      var existing = document.querySelector('script[data-portal-avatar]');
      if (existing) { existing.addEventListener('load', function () { res(window.PortalAvatar); }); existing.addEventListener('error', rej); return; }
      var s = document.createElement('script');
      s.src = src; s.setAttribute('data-portal-avatar', '1');
      s.onload = function () { res(window.PortalAvatar); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function findSlots(given) {
    var header = (given && given.header) || document.querySelector('.appbar .avatar');
    var profile = (given && given.profile) || document.getElementById('me-avatar');
    if (!profile) {
      var cand = document.querySelector('#main section.card > .avatar, #main .card > .avatar');
      if (cand) { cand.id = 'me-avatar'; profile = cand; }
    }
    return { header: header, profile: profile };
  }

  function paint(el) {
    if (!el || !window.PortalAvatar || typeof PortalAvatar.render !== 'function') return;
    var sig = '1';
    try { sig = JSON.stringify(PortalAvatar.getParams ? PortalAvatar.getParams() : '1'); } catch (e) {}
    if (el.getAttribute('data-av') === sig && el.querySelector('svg')) return;
    try {
      PortalAvatar.render(el);
      el.setAttribute('data-av', sig);
    } catch (e) {}
  }

  function mount(slots) {
    var s = findSlots(slots || {});
    paint(s.header);
    paint(s.profile);
    if (s.profile && s.profile.tagName !== 'A') {
      s.profile.setAttribute('role', 'img');
      s.profile.setAttribute('aria-label', 'האווטאר שלי');
    }
  }

  window.NextAvatar = { mount: mount };

  loadScript('../js/avatar.js').then(function () { mount(findSlots()); }).catch(function () {});

  function watch(el) {
    if (!el || el.getAttribute('data-av-watch')) return;
    el.setAttribute('data-av-watch', '1');
    new MutationObserver(function () { mount(findSlots()); }).observe(el, { childList: true, subtree: true });
  }
  function bind() {
    watch(document.getElementById('appbar'));
    watch(document.getElementById('main'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
