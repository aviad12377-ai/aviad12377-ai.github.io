/* Alerts page: pick which market updates to get, and how (browser notifications first, email optional).
   Choices are kept on this device; a browser subscription or an email address is stored only when the visitor asks. */
(function () {
  var T = window.T16, el = T.el;
  T.mountNav('alerts');
  var params = new URLSearchParams(location.search);
  var saved = T.prefs() || { topics: T.TOPICS.filter(function (t) { return t.def; }).map(function (t) { return t.id; }), push: false, email: '' };
  var box = document.getElementById('t16-topics');
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function say(id, cls, text) { var n = document.getElementById(id); n.className = 't16-status notice ' + cls; n.textContent = text; n.hidden = false; }

  // token links from emails
  var tok = params.get('confirm') || params.get('unsub');
  if (tok) {
    var isConfirm = !!params.get('confirm');
    var top = document.getElementById('t16-token');
    top.hidden = false;
    if (!UUID.test(tok)) say('t16-token', 'red', 'הקישור לא תקין. אפשר להעתיק אותו שוב מהמייל.');
    else {
      say('t16-token', 'blue', isConfirm ? 'מאשרים את הכתובת…' : 'מבטלים את ההרשמה…');
      T.supa('rpc/' + (isConfirm ? 'portal_confirm_subscription' : 'portal_unsubscribe'), { p_token: tok }).then(function (r) {
        if (r.ok && r.data === true) say('t16-token', 'blue', isConfirm ? 'הכתובת אושרה. מעכשיו המבזקים שבחרת יגיעו למייל.' : 'ההרשמה בוטלה. לא יישלחו אליך יותר מיילים מאיתנו.');
        else say('t16-token', 'amber', 'לא מצאנו הרשמה שמתאימה לקישור הזה. ייתכן שכבר טופלה.');
      }).catch(function () { say('t16-token', 'red', 'לא הצלחנו להתחבר כרגע. נסה שוב בעוד דקה.'); });
    }
  }

  T.TOPICS.forEach(function (t) {
    var id = 'tp-' + t.id;
    var cb = el('input', { type: 'checkbox', id: id, value: t.id });
    cb.checked = saved.topics.indexOf(t.id) >= 0;
    cb.addEventListener('change', function () {
      saved.topics = [].filter.call(box.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return x.value; });
      T.prefs(saved);
      document.getElementById('t16-saved').textContent = saved.topics.length ? 'הבחירה נשמרה במכשיר הזה (' + saved.topics.length + ' סוגים).' : 'לא נבחר אף סוג התראה.';
      if (saved.push) document.getElementById('t16-push-note').textContent = 'שינית את הבחירה. כדי שההתראות בדפדפן יתעדכנו, לוחצים שוב על "הפעלת התראות בדפדפן".';
    });
    box.appendChild(el('label', { class: 't16-opt', for: id }, [cb, el('span', { class: 'tx' }, [el('b', { text: t.name }), el('span', { text: t.when + ' · ' + t.hint })])]));
  });

  function chosen() { return saved.topics.length ? saved.topics : ['close']; }

  // ---- browser push ----
  var pushBtn = document.getElementById('t16-push'), offBtn = document.getElementById('t16-push-off');
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function b64(u) { var p = '='.repeat((4 - u.length % 4) % 4), s = atob((u + p).replace(/-/g, '+').replace(/_/g, '/')); var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function reg() { return navigator.serviceWorker.getRegistration().then(function (r) { return r || navigator.serviceWorker.register('sw.js'); }).then(function () { return navigator.serviceWorker.ready; }); }
  function refreshPush() {
    if (!supported) {
      pushBtn.disabled = true;
      say('t16-push-st', 'amber', ios && !standalone ? 'באייפון, התראות עובדות רק מהאתר שנוסף למסך הבית: לוחצים על כפתור השיתוף ואז "הוספה למסך הבית", ופותחים את האתר משם.' : 'הדפדפן הזה לא תומך בהתראות. אפשר להירשם במייל למטה.');
      return;
    }
    if (Notification.permission === 'denied') { say('t16-push-st', 'amber', 'ההתראות חסומות בדפדפן. אפשר לאשר אותן בהגדרות האתר בדפדפן ואז לחזור לכאן.'); }
    reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
      saved.push = !!s; T.prefs(saved);
      offBtn.hidden = !s;
      pushBtn.textContent = s ? 'עדכון ההתראות בדפדפן' : 'הפעלת התראות בדפדפן';
      if (s) say('t16-push-st', 'blue', 'ההתראות בדפדפן פעילות במכשיר הזה.');
    }).catch(function () {});
  }
  pushBtn.addEventListener('click', function () {
    if (!saved.topics.length) { say('t16-push-st', 'amber', 'קודם בוחרים לפחות סוג התראה אחד.'); return; }
    pushBtn.disabled = true;
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('perm');
      return reg();
    }).then(function (r) {
      return r.pushManager.getSubscription().then(function (old) { return old ? old.unsubscribe() : null; })
        .then(function () { return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(T.VAPID_PUBLIC_KEY) }); });
    }).then(function (sub) {
      var j = sub.toJSON();
      return T.supa('portal_push_subs', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, topics: chosen() });
    }).then(function (res) {
      if (!res.ok && res.status !== 409) throw new Error('save');
      saved.push = true; T.prefs(saved);
      say('t16-push-st', 'blue', 'מעולה. ההתראות בדפדפן הופעלו במכשיר הזה, לפי מה שבחרת.');
      document.getElementById('t16-push-note').textContent = '';
      refreshPush();
    }).catch(function (e) {
      say('t16-push-st', 'red', e && e.message === 'perm' ? 'לא התקבל אישור להתראות. אפשר לנסות שוב, ולבחור "אישור" בחלון שהדפדפן מציג.' : 'לא הצלחנו להפעיל את ההתראות כרגע. נסה שוב בעוד דקה.');
    }).then(function () { pushBtn.disabled = false; });
  });
  offBtn.addEventListener('click', function () {
    reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { return s && s.unsubscribe(); }).then(function () {
      saved.push = false; T.prefs(saved); say('t16-push-st', 'blue', 'ההתראות בדפדפן כובו במכשיר הזה.'); refreshPush();
    });
  });
  refreshPush();

  // ---- email ----
  var form = document.getElementById('t16-mail');
  var mail = document.getElementById('t16-email');
  if (saved.email) mail.value = saved.email;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = mail.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { say('t16-mail-st', 'red', 'כתובת המייל לא נראית תקינה. לדוגמה: name@gmail.com'); mail.focus(); return; }
    if (!document.getElementById('t16-consent').checked) { say('t16-mail-st', 'red', 'כדי להירשם צריך לסמן את האישור לקבלת מיילים.'); return; }
    var btn = form.querySelector('button'); btn.disabled = true;
    T.supa('portal_subscribers', { email: v.slice(0, 200), topics: chosen() }).then(function (r) {
      if (!r.ok && r.status !== 409) throw new Error(r.status);
      saved.email = v; T.prefs(saved);
      say('t16-mail-st', 'blue', 'ההרשמה נקלטה. לפני המייל הראשון יישלח אליך מייל קצר לאישור הכתובת. בכל מייל יש קישור לביטול.');
    }).catch(function () { say('t16-mail-st', 'red', 'לא הצלחנו לשמור כרגע. נסה שוב בעוד דקה.'); }).then(function () { btn.disabled = false; });
  });
  document.getElementById('t16-alerts').setAttribute('aria-busy', 'false');
})();
