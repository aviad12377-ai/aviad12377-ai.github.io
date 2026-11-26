/* Shared helpers for the news hub, market briefs and alerts pages (T-16).
   Registers the pages in the "עוד" sheet (load BEFORE portal-nav.js). No personal data. */
(function () {
  window.PORTAL_ICONS = Object.assign(window.PORTAL_ICONS || {}, {
    news: 'M4 4h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2zM8 8h8M8 12h8M8 16h5',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4'
  });
  window.PORTAL_NAV = window.PORTAL_NAV || [];
  window.PORTAL_NAV.push(
    { id: 'news', href: 'news.html', label: { he: 'חדשות', en: 'News', es: 'Noticias' }, icon: 'news', group: 'tools', parent: 'home' },
    { id: 'briefs', href: 'briefs.html', label: { he: 'מבזקי שוק', en: 'Market briefs', es: 'Resúmenes' }, icon: 'bolt', group: 'tools', parent: 'home' },
    { id: 'alerts', href: 'alerts.html', label: { he: 'התראות', en: 'Alerts', es: 'Alertas' }, icon: 'bell', group: 'account', parent: 'home' }
  );

  var T16 = window.T16 = {
    VAPID_PUBLIC_KEY: 'BONTRcHKR4sn2esCcvEiawrnOGsgAUYT8hg_JkxQ-LciTENWQ_nu1MMhXDl2rUBwriWvRhjYJWvCgcxd-XJbeiw',
    TOPICS: [
      { id: 'morning', name: 'מבזק בוקר', when: 'ימים א׳–ה׳ ב־08:00', hint: 'אסיה, החוזים ונעילת וול סטריט' },
      { id: 'open', name: 'פתיחת המסחר בתל אביב', when: 'ב־10:15', hint: 'הדקות הראשונות בבורסה' },
      { id: 'midday', name: 'סיכום צהריים', when: 'ב־13:00', hint: 'סגירת הבוקר בתל אביב ואירופה', def: true },
      { id: 'us_open', name: 'פתיחת וול סטריט', when: 'ב־16:45', hint: 'הפתיחה בארה״ב והמסחר בתל אביב' },
      { id: 'evening', name: 'מבזק ערב', when: 'ב־19:45', hint: 'נעילת תל אביב ואמצע המסחר בארה״ב', def: true },
      { id: 'close', name: 'סגירת המסחר', when: 'ב־23:20', hint: 'נעילת וול סטריט וסיכום היום', def: true },
      { id: 'week', name: 'סיכום שבועי', when: 'שישי בלילה, ותחזית לשבוע בראשון ב־09:00', hint: 'מה היה השבוע ומה מחכה בשבוע הבא', def: true },
      { id: 'month', name: 'סיכום חודשי', when: 'בסוף כל חודש', hint: 'ביצועים, סטטיסטיקות וגרפים', def: true },
      { id: 'breaking', name: 'חדשות חמות', when: 'בכל שעה שקורה משהו גדול', hint: 'ריבית, אינפלציה, תנועות חדות ואירועים גדולים', def: true }
    ],
    CATS: [['all', 'הכל'], ['il', 'ישראל'], ['us', 'ארה״ב'], ['macro', 'מאקרו'], ['stocks', 'מניות'], ['crypto', 'קריפטו'], ['world', 'עולם']],
    el: function (tag, attrs, kids) {
      var n = document.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
      });
      (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      return n;
    },
    safeUrl: function (u) { return /^https?:\/\//i.test(u || '') ? u : null; },
    getJSON: function (path) {
      return fetch(path + (path.indexOf('?') < 0 ? '?' : '&') + 'v=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    },
    ago: function (iso) {
      var t = Date.parse(iso); if (!t) return '';
      var m = Math.round((Date.now() - t) / 60000);
      if (m < 1) return 'עכשיו';
      if (m < 60) return m === 1 ? 'לפני דקה' : 'לפני ' + m + ' דקות';
      var h = Math.round(m / 60);
      if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
      return T16.clock(iso, true);
    },
    clock: function (iso, withDate) {
      var d = new Date(iso); if (isNaN(d)) return '';
      var o = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false };
      if (withDate) { o.day = 'numeric'; o.month = 'numeric'; }
      return d.toLocaleString('he-IL', o);
    },
    prefs: function (v) {
      try {
        if (v) { localStorage.setItem('t16.alerts', JSON.stringify(v)); return v; }
        return JSON.parse(localStorage.getItem('t16.alerts') || 'null');
      } catch (e) { return v || null; }
    },
    supa: function (path, body) {
      var c = window.PORTAL_AUTH_CONFIG || {};
      if (!c.supabaseUrl || !c.supabaseAnonKey) return Promise.reject(new Error('not configured'));
      return fetch(c.supabaseUrl + '/rest/v1/' + path, {
        method: 'POST', headers: { apikey: c.supabaseAnonKey, Authorization: 'Bearer ' + c.supabaseAnonKey, 'Content-Type': 'application/json', Prefer: /^rpc\//.test(path) ? 'return=representation' : 'return=minimal' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; } return { ok: r.ok, status: r.status, data: j }; }); });
    },
    mountNav: function (id) { if (window.PortalNav && window.PortalNav.mount) window.PortalNav.mount(id); }
  };
})();
