/* Home-page card: the latest market brief (headline, short summary, link). Standalone; inserts itself
   after the home tiles once portal.js has drawn them, or into #latest-brief if the page provides one. */
(function () {
  function ago(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }); }
  function build(b) {
    var sec = document.createElement('section');
    sec.className = 'card t16-latest'; sec.id = 't16-latest'; sec.setAttribute('aria-labelledby', 't16-latest-h');
    var head = document.createElement('div'); head.className = 't16-brief-head';
    var badge = document.createElement('span'); badge.className = 't16-badge ed'; badge.textContent = 'מבזק שוק · ' + b.edition;
    var t = document.createElement('time'); t.className = 'small muted'; t.textContent = ago(b.time);
    head.appendChild(badge); head.appendChild(t);
    var h = document.createElement('h2'); h.id = 't16-latest-h'; h.textContent = b.title;
    var p = document.createElement('p'); p.className = 'sum'; p.textContent = b.summary || '';
    var a = document.createElement('a'); a.className = 'btn btn-soft btn-block'; a.href = 'briefs.html?id=' + encodeURIComponent(b.id); a.textContent = 'לקריאת המבזק המלא';
    [head, h, p, a].forEach(function (n) { sec.appendChild(n); });
    return sec;
  }
  function place(card) {
    var slot = document.getElementById('latest-brief');
    if (slot) { slot.appendChild(card); return true; }
    var tiles = document.querySelector('#portal .tiles');
    if (tiles && tiles.parentNode) { tiles.parentNode.insertBefore(card, tiles.nextSibling); return true; }
    return false;
  }
  if (!document.querySelector('link[href$="css/t16.css"]')) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/t16.css'; document.head.appendChild(l);
  }
  fetch('data/briefs/latest.json?v=' + Math.floor(Date.now() / 60000), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (b) {
    if (!b || !b.title || document.getElementById('t16-latest')) return;
    var card = build(b);
    if (place(card)) return;
    var mo = new MutationObserver(function () { if (document.getElementById('t16-latest')) { mo.disconnect(); return; } if (place(card)) mo.disconnect(); });
    mo.observe(document.getElementById('portal') || document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 15000);
  }).catch(function () {});
})();
