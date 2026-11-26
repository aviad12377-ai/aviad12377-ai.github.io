/* Optional cloud accounts + per-user sync (Supabase). Loaded on every page after auth-config.js.
   Not configured -> does nothing (the site keeps working on this device only).
   Synced localStorage keys: portal-data-v1 (section 'data'), portal-settings-v1 ('settings'), options-calc-v5-private ('options'). */
(function () {
  'use strict';
  var CFG = window.PORTAL_AUTH_CONFIG || {};
  var configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && /^https:\/\//.test(CFG.supabaseUrl));
  var KEYS = { data: 'portal-data-v1', settings: 'portal-settings-v1', options: 'options-calc-v5-private' };
  var META_KEY = 'portal-sync-v1', DEVICE_KEY = 'portal-device-id', TOKENS_KEY = 'portal-request-tokens';
  var S = {
    he: { otp_title: 'כניסה עם קישור במייל (בלי סיסמה)', otp_send: 'שלחו לי קישור כניסה', otp_sent: 'שלחנו קישור כניסה למייל. פותחים אותו בדפדפן הזה (באותו מכשיר). אם במייל יש קוד בן 6 ספרות, אפשר להזין אותו כאן:', otp_code: 'קוד מהמייל', otp_verify: 'אישור הקוד', otp_bad_email: 'צריך כתובת אימייל תקינה.', pw_section: 'כניסה עם סיסמה', sign_in: 'כניסה', account: 'החשבון שלי', google: 'כניסה עם Google', email: 'אימייל', password: 'סיסמה', login: 'כניסה', signup: 'הרשמה', forgot: 'שכחתי סיסמה', or: 'או',
      signed_as: 'מחובר כ־', synced: 'נשמר בענן', syncing: 'שומר בענן…', offline: 'לא נשמר בענן (אין חיבור). ננסה שוב.', sync_now: 'סנכרון עכשיו', sign_out: 'יציאה', clear_local: 'למחוק גם את העותק במכשיר הזה',
      delete_acc: 'מחיקת החשבון וכל הנתונים', delete_confirm: 'למחוק לצמיתות את החשבון ואת כל הנתונים השמורים בענן? אי אפשר לבטל. כדי לאשר הקלד/י: מחק', delete_word: 'מחק', deleted: 'החשבון והנתונים נמחקו',
      close: 'סגירה', conflict_title: 'יש נתונים שונים בענן ובמכשיר', conflict_text: 'הנתונים בחשבון שלך שונים מהנתונים שנשמרו במכשיר הזה. איזו גרסה לשמור? הגרסה השנייה תוחלף.',
      reload_hint: 'הנתונים עודכנו מהחשבון. רענן/י את הדף כדי לראות אותם.', keep_cloud: 'לשמור את הנתונים מהענן', keep_device: 'לשמור את הנתונים מהמכשיר', check_email: 'שלחנו אליך אימייל לאישור. אחרי האישור אפשר להיכנס.', reset_sent: 'שלחנו קישור לאיפוס סיסמה.',
      new_password: 'סיסמה חדשה (לפחות 8 תווים)', pw_updated: 'הסיסמה עודכנה', err: 'שגיאה', admin: 'ניהול', privacy: 'פרטיות ומחיקה', pw_short: 'הסיסמה קצרה מדי (לפחות 8 תווים)', local_note: 'בלי חשבון הנתונים נשמרים רק במכשיר הזה.' },
    en: { otp_title: 'Sign in with an email link (no password)', otp_send: 'Email me a sign-in link', otp_sent: 'We sent a sign-in link. Open it in this browser on this device. If the email shows a 6-digit code, you can enter it here:', otp_code: 'Code from email', otp_verify: 'Verify code', otp_bad_email: 'Please enter a valid email.', pw_section: 'Sign in with a password', sign_in: 'Sign in', account: 'My account', google: 'Continue with Google', email: 'Email', password: 'Password', login: 'Sign in', signup: 'Sign up', forgot: 'Forgot password', or: 'or',
      signed_as: 'Signed in as ', synced: 'Saved to cloud', syncing: 'Saving…', offline: 'Not saved to cloud (offline). Will retry.', sync_now: 'Sync now', sign_out: 'Sign out', clear_local: 'Also delete the copy on this device',
      delete_acc: 'Delete my account and data', delete_confirm: 'Permanently delete your account and all cloud data? This cannot be undone. Type DELETE to confirm', delete_word: 'DELETE', deleted: 'Account and data deleted',
      close: 'Close', conflict_title: 'Cloud and device data differ', conflict_text: 'Your account data differs from the data saved on this device. Which version should be kept? The other will be replaced.',
      reload_hint: 'Data updated from your account. Reload the page to see it.', keep_cloud: 'Keep cloud data', keep_device: 'Keep device data', check_email: 'Check your email to confirm, then sign in.', reset_sent: 'Password reset link sent.',
      new_password: 'New password (8+ characters)', pw_updated: 'Password updated', err: 'Error', admin: 'Admin', privacy: 'Privacy & deletion', pw_short: 'Password too short (8+ characters)', local_note: 'Without an account, data stays on this device only.' },
    es: { otp_title: 'Entrar con un enlace por correo (sin contraseña)', otp_send: 'Enviarme un enlace', otp_sent: 'Te enviamos un enlace. Ábrelo en este navegador y dispositivo. Si el correo trae un código de 6 dígitos, introdúcelo aquí:', otp_code: 'Código del correo', otp_verify: 'Verificar código', otp_bad_email: 'Introduce un correo válido.', pw_section: 'Entrar con contraseña', sign_in: 'Entrar', account: 'Mi cuenta', google: 'Continuar con Google', email: 'Correo', password: 'Contraseña', login: 'Entrar', signup: 'Registrarse', forgot: 'Olvidé la contraseña', or: 'o',
      signed_as: 'Conectado como ', synced: 'Guardado en la nube', syncing: 'Guardando…', offline: 'No guardado en la nube (sin conexión). Se reintentará.', sync_now: 'Sincronizar', sign_out: 'Salir', clear_local: 'Borrar también la copia en este dispositivo',
      delete_acc: 'Eliminar mi cuenta y datos', delete_confirm: '¿Eliminar para siempre la cuenta y todos los datos en la nube? No se puede deshacer. Escribe BORRAR para confirmar', delete_word: 'BORRAR', deleted: 'Cuenta y datos eliminados',
      close: 'Cerrar', conflict_title: 'Los datos de la nube y del dispositivo difieren', conflict_text: 'Los datos de tu cuenta difieren de los guardados en este dispositivo. ¿Qué versión conservar? La otra se reemplazará.',
      reload_hint: 'Datos actualizados desde tu cuenta. Recarga la página.', keep_cloud: 'Conservar la nube', keep_device: 'Conservar el dispositivo', check_email: 'Revisa tu correo para confirmar y luego entra.', reset_sent: 'Enlace de restablecimiento enviado.',
      new_password: 'Nueva contraseña (8+ caracteres)', pw_updated: 'Contraseña actualizada', err: 'Error', admin: 'Administración', privacy: 'Privacidad y borrado', pw_short: 'Contraseña demasiado corta (8+)', local_note: 'Sin cuenta, los datos quedan solo en este dispositivo.' }
  };
  function lang() { try { var s = JSON.parse(localStorage.getItem('portal-settings-v1') || '{}'); return S[s.lang] ? s.lang : 'he'; } catch (e) { return 'he'; } }
  function tr(k) { return S[lang()][k] || S.he[k] || k; }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function readMeta() { try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch (e) { return {}; } }
  function writeMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }
  function hash(str) { var x = 5381; str = str || ''; for (var i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0; return String(x >>> 0) + ':' + str.length; }
  function device() { var d = localStorage.getItem(DEVICE_KEY); if (!d) { d = Math.random().toString(36).slice(2, 12); localStorage.setItem(DEVICE_KEY, d); } return d; }
  // key-order independent JSON (Postgres jsonb re-orders keys, so raw strings cannot be compared)
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
  }
  function canon(v) { return v === null || v === undefined ? null : stable(v); }
  function chash(raw) { var o; try { o = JSON.parse(raw); } catch (e) { return hash(raw); } return hash(stable(o)); }
  function hasContent(section, obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (section === 'settings') return false;
    if (section === 'options') return !!(obj.data && Object.keys(obj.data).length);
    var found = false;
    (function walk(o) { if (found || !o || typeof o !== 'object') return; if (Array.isArray(o)) { if (o.length) found = true; return; } Object.keys(o).forEach(function (k) { walk(o[k]); }); })(obj);
    return found;
  }
  function emit() { try { window.dispatchEvent(new CustomEvent('portal-cloud')); } catch (e) {} renderSlot(); }

  var client = null, API = {
    configured: configured, user: null, isAdminHint: false, status: 'idle', ready: null,
    openDialog: openDialog, signOut: signOut, deleteAccount: function () { return deleteAccount(); }, syncNow: function () { return syncAll(true); },
    submitRequest: submitRequest, myRequests: myRequests, submitLead: submitLead,
    isAdmin: function () { return rpc('is_admin', {}).then(function (r) { return !!r; }); },
    admin: { listRequests: function (f) { return rpc('admin_list_requests', f || {}); }, updateRequest: function (id, fields) { return rpc('admin_update_request', { p_id: id, p_status: fields.status || null, p_internal: fields.internal === undefined ? null : fields.internal, p_reply: fields.reply === undefined ? null : fields.reply }); }, listLeads: function () { return rpc('admin_list_leads', {}); }, updateLead: function (id, status) { return rpc('admin_update_lead', { p_id: id, p_status: status }); } },
    peerSubmit: function (st) { return rpc('peer_submit', { p_age_band: st.age_band || '', p_net_worth: st.net_worth, p_savings_rate: st.savings_rate, p_pension_fee_acc: st.pension_fee_acc }).catch(function () {}); },
    peerWithdraw: function () { return rpc('peer_withdraw', {}).catch(function () {}); },
    peerCompare: function () { return rpc('peer_compare', {}); },
    get client() { return client; }
  };
  window.PortalCloud = API;

  function rpc(name, args) {
    if (!client) return Promise.reject(new Error('not configured'));
    return client.rpc(name, args).then(function (r) { if (r.error) throw new Error(r.error.message || 'rpc'); return r.data; });
  }

  /* ---------- requests / leads (anonymous allowed) ---------- */
  function submitRequest(req) {
    return rpc('submit_request', { p_type: req.type, p_title: req.title || '', p_body: req.body || '', p_symbol: req.symbol || '', p_email: req.email || '', p_screenshot: req.screenshot || null, p_page: req.page || '', p_hp: req.hp || '', p_elapsed_ms: req.elapsed || 0 })
      .then(function (row) { row = Array.isArray(row) ? row[0] : row; if (row && row.token) { var tk = readTokens(); tk.unshift(row.token); localStorage.setItem(TOKENS_KEY, JSON.stringify(tk.slice(0, 50))); } return row; });
  }
  function readTokens() { try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]'); } catch (e) { return []; } }
  function myRequests() { return rpc('my_requests', { p_tokens: readTokens() }); }
  function submitLead(l) { return rpc('submit_lead', { p_name: l.name, p_contact: l.contact, p_topic: l.topic || '', p_consent: !!l.consent, p_hp: l.hp || '', p_elapsed_ms: l.elapsed || 0 }); }

  /* ---------- sync ---------- */
  var pushTimer = null, pollTimer = null, pending = false;
  function fetchCloud() {
    return client.from('portal_docs').select('section,doc,version,updated_at').then(function (r) { if (r.error) throw r.error; var o = {}; (r.data || []).forEach(function (row) { o[row.section] = row; }); return o; });
  }
  function save(section, raw, baseVersion) {
    var doc; try { doc = JSON.parse(raw); } catch (e) { return Promise.resolve(); }
    return rpc('save_doc', { p_section: section, p_doc: doc, p_base_version: baseVersion === undefined ? null : baseVersion, p_device: device() }).then(function (res) {
      res = Array.isArray(res) ? res[0] : res; return res;
    });
  }
  function applyCloud(updates) {
    // replace local copies and reload once so every page re-reads its data
    var last = +sessionStorage.getItem('portal-cloud-reloaded') || 0;
    if (window.Portal && window.Portal.freeze) window.Portal.freeze();
    Object.keys(updates).forEach(function (sec) { try { localStorage.setItem(KEYS[sec], updates[sec]); } catch (e) {} });
    if (Date.now() - last < 8000) { toast(tr('reload_hint')); return; } // safety net against reload loops: ask instead of reloading again
    sessionStorage.setItem('portal-cloud-reloaded', String(Date.now()));
    location.reload();
  }
  function conflictDialog() {
    return new Promise(function (resolve) {
      var dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', id: 'sync-conflict' });
      function done(v) { dlg.remove(); resolve(v); }
      dlg.appendChild(h('div', { class: 'modal-card' }, [h('h2', { class: 'card-title', text: tr('conflict_title') }), h('p', { text: tr('conflict_text') }),
        h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-primary', id: 'keep-cloud', text: tr('keep_cloud'), onclick: function () { done('cloud'); } }), h('button', { type: 'button', class: 'btn', id: 'keep-device', text: tr('keep_device'), onclick: function () { done('device'); } })])]));
      document.body.appendChild(dlg);
    });
  }
  function syncAll(manual) {
    if (!client || !API.user) return Promise.resolve();
    var uid = API.user.id, meta = readMeta();
    if (meta.uid !== uid) meta = { uid: uid, sections: {} };
    API.status = 'syncing'; renderSlot();
    return fetchCloud().then(function (cloud) {
      var pulls = {}, pushes = [], conflicts = [];
      Object.keys(KEYS).forEach(function (sec) {
        var raw = localStorage.getItem(KEYS[sec]), c = cloud[sec], m = meta.sections[sec] || {};
        var localObj = null; try { localObj = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (!c) { if (raw) pushes.push([sec, raw, null]); return; }
        var cloudRaw = JSON.stringify(c.doc), cloudCanon = canon(c.doc);
        if (raw && canon(localObj) === cloudCanon) { meta.sections[sec] = { version: c.version, hash: chash(raw) }; return; }
        var localChanged = !!raw && chash(raw) !== m.hash, cloudChanged = c.version !== m.version;
        if (!raw || !hasContent(sec, localObj)) { pulls[sec] = cloudRaw; meta.sections[sec] = { version: c.version, hash: chash(cloudRaw) }; }
        else if (!localChanged) { pulls[sec] = cloudRaw; meta.sections[sec] = { version: c.version, hash: chash(cloudRaw) }; }
        else if (!cloudChanged) pushes.push([sec, raw, c.version]);
        else if (!hasContent(sec, c.doc)) pushes.push([sec, raw, c.version]);
        else conflicts.push([sec, raw, c]);
      });
      var step = Promise.resolve();
      if (conflicts.length) step = conflictDialog().then(function (choice) {
        conflicts.forEach(function (x) {
          if (choice === 'cloud') { var cr = JSON.stringify(x[2].doc); pulls[x[0]] = cr; meta.sections[x[0]] = { version: x[2].version, hash: chash(cr) }; }
          else pushes.push([x[0], x[1], x[2].version]);
        });
      });
      return step.then(function () {
        return pushes.reduce(function (p, x) {
          return p.then(function () { return save(x[0], x[1], x[2]).then(function (res) { if (res && !res.conflict) meta.sections[x[0]] = { version: res.version, hash: chash(x[1]) }; }); });
        }, Promise.resolve());
      }).then(function () {
        writeMeta(meta); API.status = 'synced'; renderSlot();
        if (Object.keys(pulls).length) {
          var changed = Object.keys(pulls).some(function (sec) { var cur = localStorage.getItem(KEYS[sec]); return !cur || chash(cur) !== chash(pulls[sec]); });
          if (changed) applyCloud(pulls);
        }
      });
    }).catch(function (e) { API.status = 'offline'; renderSlot(); if (manual) toast(tr('err') + ': ' + (e && e.message || e)); });
  }
  function pushChanged() {
    if (!client || !API.user || pending) return;
    var meta = readMeta(); if (meta.uid !== API.user.id) return;
    var todo = Object.keys(KEYS).filter(function (sec) { var raw = localStorage.getItem(KEYS[sec]); return raw && chash(raw) !== (meta.sections[sec] || {}).hash; });
    if (!todo.length) return;
    pending = true; API.status = 'syncing'; renderSlot();
    todo.reduce(function (p, sec) {
      return p.then(function () {
        var raw = localStorage.getItem(KEYS[sec]), base = (meta.sections[sec] || {}).version;
        return save(sec, raw, base === undefined ? null : base).then(function (res) {
          if (res && res.conflict) throw { conflict: true };
          meta.sections[sec] = { version: res.version, hash: chash(raw) };
        });
      });
    }, Promise.resolve()).then(function () { writeMeta(meta); API.status = 'synced'; }, function (e) {
      API.status = 'offline';
      if (e && e.conflict) return syncAll(false); // another device saved meanwhile: re-run full merge (asks on conflict)
    }).then(function () { pending = false; renderSlot(); });
  }
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushChanged, 1500); }

  /* ---------- auth ---------- */
  function signOut(clearLocal) {
    if (!client) return Promise.resolve();
    return pushChangedNow().then(function () { return client.auth.signOut(); }).then(function () {
      if (clearLocal) { if (window.Portal && window.Portal.freeze) window.Portal.freeze(); Object.keys(KEYS).forEach(function (s) { localStorage.removeItem(KEYS[s]); }); localStorage.removeItem('portal-quotes-v1'); }
      localStorage.removeItem(META_KEY); location.reload();
    });
  }
  function pushChangedNow() { clearTimeout(pushTimer); return new Promise(function (r) { pushChanged(); setTimeout(r, 400); }); }
  function deleteAccount() {
    var w = prompt(tr('delete_confirm'));
    if (!w || w.trim() !== tr('delete_word')) return;
    rpc('delete_my_account', {}).then(function () {
      if (window.Portal && window.Portal.freeze) window.Portal.freeze();
      Object.keys(KEYS).forEach(function (s) { localStorage.removeItem(KEYS[s]); }); localStorage.removeItem(META_KEY); localStorage.removeItem(TOKENS_KEY);
      return client.auth.signOut().catch(function () {});
    }).then(function () { alert(tr('deleted')); location.href = 'index.html'; }, function (e) { alert(tr('err') + ': ' + e.message); });
  }
  function redirectUrl() { return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'me.html'; }

  /* ---------- UI ---------- */
  function toast(msg) { var el = document.getElementById('toast'); if (!el) { alert(msg); return; } el.textContent = msg; el.classList.add('show'); setTimeout(function () { el.classList.remove('show'); }, 3000); }
  function ensureStyle() {
    if (document.querySelector('link[href*="portal.css"]') || document.getElementById('pc-style')) return;
    var st = document.createElement('style'); st.id = 'pc-style';
    st.textContent = '.modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 10px;z-index:50;overflow-y:auto}.modal-card{background:#fff;border-radius:14px;padding:16px;width:100%;max-width:420px;box-shadow:0 10px 30px rgba(15,23,42,.25)}.modal-card .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.modal-card .field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}.modal-card input{padding:9px 10px;border:1.5px solid #cbd5e1;border-radius:9px;font:inherit}.modal-card .help{font-size:12.5px;color:#475569}.modal-card .notice{padding:8px 10px;border-radius:9px;background:#eff6ff;font-size:13px}.acct-btn.on{background:#ecfdf5;color:#059669}';
    document.head.appendChild(st);
  }
  function slot() {
    var s = document.getElementById('account-slot');
    if (!s) { var bar = document.querySelector('.portal-bar'); if (!bar) return null; s = h('span', { id: 'account-slot' }); var set = bar.querySelector('.portal-settings'); (set || bar).insertBefore(s, (set || bar).firstChild); }
    return s;
  }
  function renderSlot() {
    if (!configured) return;
    ensureStyle();
    var s = slot(); if (!s) return;
    s.innerHTML = '';
    var label = API.user ? (API.status === 'syncing' ? tr('syncing') : API.status === 'offline' ? '!' : '✓') + ' ' + tr('account') : tr('sign_in');
    s.appendChild(h('button', { type: 'button', class: 'btn btn-sm acct-btn' + (API.user ? ' on' : ''), id: 'acct-btn', title: API.user ? tr('signed_as') + (API.user.email || '') : '', text: label, onclick: openDialog }));
  }
  function openDialog() {
    if (!configured) return;
    var old = document.getElementById('acct-dialog'); if (old) old.remove();
    var dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', id: 'acct-dialog' }), card = h('div', { class: 'modal-card' }), msg = h('div');
    dlg.appendChild(card); dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.remove(); });
    function close() { dlg.remove(); }
    if (API.user) {
      var clr = h('input', { type: 'checkbox', id: 'clear-local' });
      card.appendChild(h('h2', { class: 'card-title', text: tr('account') }));
      card.appendChild(h('p', { text: tr('signed_as') + (API.user.email || '') }));
      card.appendChild(h('p', { class: 'help', id: 'sync-status', text: API.status === 'offline' ? tr('offline') : API.status === 'syncing' ? tr('syncing') : tr('synced') }));
      card.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft btn-sm', text: tr('sync_now'), onclick: function () { syncAll(true).then(close); } }),
        API.isAdminHint ? h('a', { class: 'btn btn-sm', href: 'admin.html', text: tr('admin') }) : null, h('a', { class: 'btn btn-sm', href: 'privacy.html', text: tr('privacy') })]));
      card.appendChild(h('div', { class: 'field check', style: 'margin-top:10px' }, [clr, h('label', { for: 'clear-local', text: tr('clear_local') })]));
      card.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'sign-out', text: tr('sign_out'), onclick: function () { signOut(clr.checked); } }),
        h('button', { type: 'button', class: 'btn btn-danger btn-sm', id: 'delete-account', text: tr('delete_acc'), onclick: deleteAccount })]));
    } else {
      card.appendChild(h('h2', { class: 'card-title', text: tr('sign_in') }));
      card.appendChild(h('button', { type: 'button', class: 'btn btn-primary', id: 'google-signin', style: 'width:100%', text: tr('google'), onclick: function () {
        client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } }).then(function (r) { if (r && r.error) msg.textContent = r.error.message; });
      } }));
      var em = h('input', { type: 'text', id: 'otp-email', inputmode: 'email', autocomplete: 'email', dir: 'ltr', 'aria-label': tr('email'), placeholder: tr('email') });
      var show = function (t, kids) { msg.innerHTML = ''; msg.appendChild(h('div', { class: 'notice blue', text: t })); (kids || []).forEach(function (k) { msg.appendChild(k); }); };
      var validEmail = function () { var v = em.value.trim(); return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : null; };
      card.appendChild(h('p', { class: 'help', style: 'text-align:center', text: tr('or') }));
      card.appendChild(h('p', { style: 'margin:0 0 6px;font-weight:700', text: tr('otp_title') }));
      card.appendChild(h('div', { class: 'fields', style: 'grid-template-columns:1fr' }, [em]));
      card.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'email-otp', text: tr('otp_send'), onclick: function () {
        var v = validEmail(); if (!v) return show(tr('otp_bad_email'));
        var b = this; b.disabled = true;
        client.auth.signInWithOtp({ email: v, options: { emailRedirectTo: location.href.split('#')[0], shouldCreateUser: true } }).then(function (r) {
          b.disabled = false;
          if (r && r.error) return show(r.error.message);
          var code = h('input', { type: 'text', id: 'otp-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '10', dir: 'ltr', 'aria-label': tr('otp_code'), placeholder: tr('otp_code') });
          show(tr('otp_sent'), [h('div', { class: 'fields', style: 'grid-template-columns:1fr;margin-top:6px' }, [code]), h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-sm', id: 'otp-verify', text: tr('otp_verify'), onclick: function () {
            client.auth.verifyOtp({ email: v, token: code.value.trim(), type: 'email' }).then(function (r2) { if (r2 && r2.error) { var e = h('div', { class: 'notice red', text: r2.error.message }); msg.appendChild(e); } else close(); });
          } })])]);
        }, function (e) { b.disabled = false; show(e.message || String(e)); });
      } })]));
      if (CFG.enableEmailPassword !== false) {
        var pw = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr', 'aria-label': tr('password'), placeholder: tr('password') });
        var det = h('details', { id: 'pw-section', style: 'margin-top:10px' }, [h('summary', { style: 'cursor:pointer;font-size:13.5px', text: tr('pw_section') }),
          h('div', { class: 'fields', style: 'grid-template-columns:1fr' }, [pw]),
          h('div', { class: 'toolbar' }, [
            h('button', { type: 'button', class: 'btn btn-soft btn-sm', id: 'email-login', text: tr('login'), onclick: function () { client.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) { if (r.error) show(r.error.message); else close(); }); } }),
            h('button', { type: 'button', class: 'btn btn-sm', id: 'email-signup', text: tr('signup'), onclick: function () { if (pw.value.length < 8) return show(tr('pw_short')); client.auth.signUp({ email: em.value.trim(), password: pw.value, options: { emailRedirectTo: redirectUrl() } }).then(function (r) { show(r.error ? r.error.message : tr('check_email')); }); } }),
            h('button', { type: 'button', class: 'btn btn-sm', text: tr('forgot'), onclick: function () { client.auth.resetPasswordForEmail(em.value.trim(), { redirectTo: redirectUrl() }).then(function (r) { show(r.error ? r.error.message : tr('reset_sent')); }); } })])]);
        card.appendChild(det);
      }
      card.appendChild(h('p', { class: 'help', text: tr('local_note') }));
    }
    card.appendChild(msg);
    card.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-sm', text: tr('close'), onclick: close })]));
    document.body.appendChild(dlg);
  }

  var syncedFor = null;
  function maybeSync() { var id = API.user && API.user.id; if (id && id !== syncedFor) { syncedFor = id; syncAll(false); } if (!id) syncedFor = null; }
  function start() {
    var s = document.createElement('script');
    s.src = 'vendor/supabase.js';
    API.ready = new Promise(function (resolve) {
      s.onload = function () {
        try {
          client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
        } catch (e) { console.warn('cloud init failed', e); resolve(); return; }
        client.auth.onAuthStateChange(function (event, session) {
          API.user = session ? session.user : null;
          API.isAdminHint = !!(API.user && (CFG.adminEmails || []).map(function (x) { return String(x).toLowerCase(); }).indexOf(String(API.user.email || '').toLowerCase()) >= 0);
          if (event === 'PASSWORD_RECOVERY') { var np = prompt(tr('new_password')); if (np && np.length >= 8) client.auth.updateUser({ password: np }).then(function () { toast(tr('pw_updated')); }); }
          maybeSync();
          emit();
        });
        client.auth.getSession().then(function (r) {
          var session = r && r.data && r.data.session; API.user = session ? session.user : null;
          API.isAdminHint = !!(API.user && (CFG.adminEmails || []).map(function (x) { return String(x).toLowerCase(); }).indexOf(String(API.user.email || '').toLowerCase()) >= 0);
          maybeSync(); resolve(); emit();
        }, function () { resolve(); });
      };
      s.onerror = function () { console.warn('cloud library failed to load'); resolve(); };
    });
    document.head.appendChild(s);
    window.addEventListener('portal-local-write', schedulePush);
    pollTimer = setInterval(function () { if (API.user) pushChanged(); }, 4000); // catches pages that write localStorage directly (options calculator)
    window.addEventListener('pagehide', function () { if (API.user) pushChanged(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderSlot); else renderSlot();
  }
  if (configured) start();
  else API.ready = Promise.resolve();
})();
