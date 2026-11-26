/* Requests & support, admin control centre and privacy pages. Registers renderers in window.PORTAL_PAGES (used by portal.js). */
(function () {
  'use strict';
  var S = {
    he: {
      support_title: 'בקשות ותמיכה', support_sub: 'בקשה להוספת נייר ערך, דיווח על תקלה או רעיון לשיפור',
      sp_form: 'בקשה חדשה', sp_type: 'סוג הבקשה', sp_t_ticker: 'הוספת נייר ערך / טיקר', sp_t_bug: 'דיווח על תקלה', sp_t_feature: 'בקשה לפיצ\'ר', sp_t_other: 'אחר',
      sp_title: 'כותרת קצרה', sp_symbol: 'סימול או שם הנייר (למשל VOO, או מספר נייר בבורסה בתל אביב)', sp_body: 'פרטים', sp_email: 'אימייל לתשובה (לא חובה)', sp_shot: 'צילום מסך (לא חובה)',
      sp_shot_help: 'התמונה מוקטנת במכשיר לפני השליחה. כדאי להסתיר מספרים אישיים לפני הצילום.', sp_send: 'שליחת הבקשה', sp_sent: 'הבקשה נשלחה. אפשר לעקוב אחריה למטה.',
      sp_need: 'צריך לכתוב כותרת, סימול או פרטים.', sp_rate: 'נשלחו יותר מדי בקשות בזמן קצר. נסה/י שוב מאוחר יותר.', sp_mine: 'הבקשות שלי', sp_none: 'אין עדיין בקשות מהמכשיר או מהחשבון הזה.', sp_reply: 'תשובה',
      sp_backend: 'שליחת בקשות תהיה זמינה אחרי חיבור השרת (ראו מדריך ההתקנה).', sp_shot_bad: 'לא הצלחנו לקרוא את התמונה.',
      st_new: 'חדש', st_in_progress: 'בטיפול', st_done: 'בוצע', st_rejected: 'נדחה', st_contacted: 'נוצר קשר', st_closed: 'סגור',
      admin_title: 'מרכז ניהול', admin_sub: 'בקשות משתמשים ולידים (גלוי רק למנהלים)', ad_signin: 'כדי להיכנס למרכז הניהול צריך להתחבר עם חשבון מנהל.', ad_denied: 'אין לחשבון הזה הרשאת ניהול.',
      ad_requests: 'בקשות', ad_leads: 'לידים (בקשות לשיחה עם בעל רישיון)', ad_all: 'הכול', ad_filter_type: 'סוג', ad_filter_status: 'סטטוס', ad_refresh: 'רענון',
      ad_internal: 'הערה פנימית (רק למנהלים)', ad_reply: 'תשובה למשתמש (המשתמש רואה אותה)', ad_save: 'שמירה', ad_saved: 'נשמר', ad_from: 'מאת', ad_anon: 'אנונימי', ad_page: 'דף', ad_count: '{n} פריטים',
      ad_contact: 'פרטי קשר', ad_topic: 'נושא', ad_consent: 'הסכמה',
      privacy_title: 'פרטיות', privacy_sub: 'איזה מידע נשמר, איפה, ואיך מוחקים אותו',
      pv_h1: 'בלי חשבון', pv_p1: 'כל הנתונים נשמרים רק בדפדפן במכשיר הזה (localStorage). הם לא נשלחים לשרת. מחיקת נתוני הדפדפן מוחקת אותם, ולכן כדאי לשמור גיבוי מהאזור האישי.',
      pv_h2: 'עם חשבון', pv_p2: 'אחרי התחברות (Google או אימייל וסיסמה), הנתונים נשמרים גם בחשבון שלך במסד נתונים של Supabase, כדי שתוכל/י לראות אותם בכל מכשיר. כל משתמש יכול לקרוא ולשנות רק את השורות שלו (הגבלה ברמת מסד הנתונים, Row Level Security). החיבור לשרת מוצפן (HTTPS). השרתים של Supabase נמצאים מחוץ לישראל, באזור שנבחר בהקמה.',
      pv_h3: 'דוח המסלקה וקבצים', pv_p3: 'קבצי המסלקה, הבנק והאשראי נקראים רק בדפדפן. הקובץ עצמו לא נשלח לשום מקום. מספר תעודת הזהות לא נקרא. מספרי פוליסות נשמרים מוסתרים (4 ספרות אחרונות). נשמר רק סיכום המוצרים.',
      pv_h4: 'מידע ציבורי', pv_p4: 'מחירי ניירות ערך ושערי מטבע נטענים ממקורות ציבוריים. נתוני ההשוואה לקופות ולקרנות הם נתונים ציבוריים של רשות שוק ההון (data.gov.il). בבקשות האלה לא נשלח מידע אישי.',
      pv_h5: 'השוואה אנונימית', pv_p5: 'רק אם בחרת להשתתף: נשלחים ערכים מעוגלים בלבד. אף אחד, כולל מנהל האתר דרך האתר, לא רואה ערכים של משתמש אחר. מוצגים רק אחוזונים של קבוצות עם 20 משתתפים לפחות. ביטול ההשתתפות מוחק את הערכים.',
      pv_h6: 'בקשות ולידים', pv_p6: 'בקשות תמיכה (כולל צילום מסך ואימייל אם צירפת) נשמרות כדי לטפל בהן, ורק מנהל האתר רואה אותן. פרטי קשר בטופס "שיחה עם בעל רישיון" נשמרים רק אם סימנת הסכמה, משמשים רק לתיאום השיחה שביקשת, ונמחקים לבקשתך. כתובת ה־IP לא נשמרת, רק טביעה מקוצרת (hash) שלה לצורך הגבלת הצפה.',
      pv_h7: 'מחיקת החשבון', pv_p7: 'מחיקת החשבון מוחקת את כל הנתונים שלך בשרת: מסמכי הנתונים, ההשתתפות בהשוואה, הבקשות והלידים שנשלחו מהחשבון. הנתונים במכשיר הזה נמחקים גם הם.', pv_delete: 'מחיקת החשבון וכל הנתונים', pv_delete_signin: 'כדי למחוק חשבון צריך להתחבר אליו.', pv_no_backend: 'האתר פועל כרגע בלי חשבונות, ולכן אין נתונים בשרת. מחיקת הנתונים במכשיר: האזור האישי ← גיבוי ונתונים ← מחיקת כל הנתונים.',
      pv_h8: 'לא ייעוץ', pv_p8: 'האתר הוא כלי מעקב, אומדן והשוואת מידע בלבד. הוא לא ייעוץ השקעות, ייעוץ פנסיוני או שיווק פנסיוני, ולא מחליף בעל רישיון. נתונים ציבוריים מוצגים כפי שפורסמו ועלולים להכיל טעויות או עיכובים.',
      pv_h9: 'שאלות', pv_p9: 'לשאלות ולבקשות מחיקה:', pv_status: 'הדף מתאר איך האתר עובד. הוא עדיין לא נבדק על ידי עורך דין.'
    },
    en: {
      support_title: 'Requests & support', support_sub: 'Ask for a security, report a bug or suggest an improvement',
      sp_form: 'New request', sp_type: 'Request type', sp_t_ticker: 'Add a security / ticker', sp_t_bug: 'Report a bug', sp_t_feature: 'Feature request', sp_t_other: 'Other',
      sp_title: 'Short title', sp_symbol: 'Symbol or name (e.g. VOO, or a TASE security number)', sp_body: 'Details', sp_email: 'Email for a reply (optional)', sp_shot: 'Screenshot (optional)',
      sp_shot_help: 'The image is downscaled on your device before sending. Hide personal numbers first.', sp_send: 'Send request', sp_sent: 'Request sent. Track it below.',
      sp_need: 'Please write a title, symbol or details.', sp_rate: 'Too many requests in a short time. Try again later.', sp_mine: 'My requests', sp_none: 'No requests from this device or account yet.', sp_reply: 'Reply',
      sp_backend: 'Sending requests will be available once the server is connected (see the setup guide).', sp_shot_bad: 'Could not read the image.',
      st_new: 'New', st_in_progress: 'In progress', st_done: 'Done', st_rejected: 'Rejected', st_contacted: 'Contacted', st_closed: 'Closed',
      admin_title: 'Control centre', admin_sub: 'User requests and leads (admins only)', ad_signin: 'Sign in with an admin account to open the control centre.', ad_denied: 'This account has no admin rights.',
      ad_requests: 'Requests', ad_leads: 'Leads (asked to talk to a licensed agent)', ad_all: 'All', ad_filter_type: 'Type', ad_filter_status: 'Status', ad_refresh: 'Refresh',
      ad_internal: 'Internal note (admins only)', ad_reply: 'Reply to user (visible to them)', ad_save: 'Save', ad_saved: 'Saved', ad_from: 'From', ad_anon: 'anonymous', ad_page: 'Page', ad_count: '{n} items',
      ad_contact: 'Contact', ad_topic: 'Topic', ad_consent: 'Consent',
      privacy_title: 'Privacy', privacy_sub: 'What is stored, where, and how to delete it',
      pv_h1: 'Without an account', pv_p1: 'All data stays in this browser on this device (localStorage) and is never sent to a server. Clearing browser data deletes it, so keep a backup from My area.',
      pv_h2: 'With an account', pv_p2: 'After signing in (Google or email and password), your data is also stored in your account in a Supabase database so you can see it on every device. Each user can read and change only their own rows (database-level Row Level Security). The connection is encrypted (HTTPS). Supabase servers are outside Israel, in the region chosen at setup.',
      pv_h3: 'Clearinghouse report and files', pv_p3: 'Clearinghouse, bank and card files are read only in your browser; the file itself is never sent. ID numbers are not read. Policy numbers are kept masked (last 4 digits). Only a product summary is kept.',
      pv_h4: 'Public data', pv_p4: 'Prices and FX rates are loaded from public sources. Fund comparison data is public Capital Market Authority data (data.gov.il). No personal data is sent with these requests.',
      pv_h5: 'Anonymous comparison', pv_p5: 'Only if you opt in: rounded values only. Nobody, including the site admin through the site, can see another user\'s values. Only percentiles of groups of 20+ are shown. Opting out deletes your values.',
      pv_h6: 'Requests and leads', pv_p6: 'Support requests (with a screenshot and email if you added them) are kept to handle them and only the site admin sees them. Contact details in the "licensed agent" form are kept only if you ticked consent, used only to arrange that conversation, and deleted on request. IP addresses are not stored, only a short hash for flood protection.',
      pv_h7: 'Deleting your account', pv_p7: 'Deleting your account removes all your data on the server: data documents, comparison participation, and requests and leads sent from the account. Data on this device is deleted too.', pv_delete: 'Delete my account and all data', pv_delete_signin: 'Sign in to delete your account.', pv_no_backend: 'The site currently runs without accounts, so there is no data on a server. To delete data on this device: My area → Backup & data → Delete all data.',
      pv_h8: 'Not advice', pv_p8: 'This site is a tracking, estimation and information comparison tool only. It is not investment advice, pension advice or pension marketing, and does not replace a licensed professional. Public data is shown as published and may contain errors or delays.',
      pv_h9: 'Questions', pv_p9: 'Questions and deletion requests:', pv_status: 'This page describes how the site works. It has not yet been reviewed by a lawyer.'
    },
    es: {
      support_title: 'Solicitudes y soporte', support_sub: 'Pide un valor, informa de un error o sugiere una mejora',
      sp_form: 'Nueva solicitud', sp_type: 'Tipo', sp_t_ticker: 'Añadir un valor / ticker', sp_t_bug: 'Informar de un error', sp_t_feature: 'Pedir una función', sp_t_other: 'Otro',
      sp_title: 'Título corto', sp_symbol: 'Símbolo o nombre (p. ej. VOO o número de valor de la TASE)', sp_body: 'Detalles', sp_email: 'Correo para responder (opcional)', sp_shot: 'Captura (opcional)',
      sp_shot_help: 'La imagen se reduce en tu dispositivo antes de enviarla. Oculta números personales.', sp_send: 'Enviar', sp_sent: 'Solicitud enviada. Síguela abajo.',
      sp_need: 'Escribe un título, símbolo o detalles.', sp_rate: 'Demasiadas solicitudes en poco tiempo. Inténtalo más tarde.', sp_mine: 'Mis solicitudes', sp_none: 'Aún no hay solicitudes desde este dispositivo o cuenta.', sp_reply: 'Respuesta',
      sp_backend: 'El envío estará disponible cuando se conecte el servidor (ver la guía).', sp_shot_bad: 'No se pudo leer la imagen.',
      st_new: 'Nueva', st_in_progress: 'En curso', st_done: 'Hecha', st_rejected: 'Rechazada', st_contacted: 'Contactado', st_closed: 'Cerrado',
      admin_title: 'Centro de control', admin_sub: 'Solicitudes y contactos (solo administradores)', ad_signin: 'Entra con una cuenta de administrador.', ad_denied: 'Esta cuenta no tiene permisos de administración.',
      ad_requests: 'Solicitudes', ad_leads: 'Contactos (quieren hablar con un agente con licencia)', ad_all: 'Todo', ad_filter_type: 'Tipo', ad_filter_status: 'Estado', ad_refresh: 'Actualizar',
      ad_internal: 'Nota interna (solo admins)', ad_reply: 'Respuesta al usuario (la ve)', ad_save: 'Guardar', ad_saved: 'Guardado', ad_from: 'De', ad_anon: 'anónimo', ad_page: 'Página', ad_count: '{n} elementos',
      ad_contact: 'Contacto', ad_topic: 'Tema', ad_consent: 'Consentimiento',
      privacy_title: 'Privacidad', privacy_sub: 'Qué se guarda, dónde y cómo borrarlo',
      pv_h1: 'Sin cuenta', pv_p1: 'Todos los datos quedan en este navegador (localStorage) y nunca se envían a un servidor. Borrar los datos del navegador los elimina; guarda una copia desde Mi área.',
      pv_h2: 'Con cuenta', pv_p2: 'Al iniciar sesión (Google o correo y contraseña), los datos también se guardan en tu cuenta en una base de datos Supabase. Cada usuario solo puede leer y cambiar sus propias filas (Row Level Security). La conexión va cifrada (HTTPS). Los servidores de Supabase están fuera de Israel.',
      pv_h3: 'Informe de la cámara y archivos', pv_p3: 'Los archivos se leen solo en tu navegador. No se lee el número de identidad. Las pólizas se guardan enmascaradas. Solo se guarda un resumen.',
      pv_h4: 'Datos públicos', pv_p4: 'Precios y tipos de cambio vienen de fuentes públicas. Los datos de fondos son públicos (data.gov.il). No se envían datos personales.',
      pv_h5: 'Comparación anónima', pv_p5: 'Solo si participas: valores redondeados. Nadie ve los valores de otro usuario. Solo percentiles de grupos de 20+. Retirarte borra tus valores.',
      pv_h6: 'Solicitudes y contactos', pv_p6: 'Las solicitudes de soporte solo las ve el administrador. Los datos del formulario de agente se guardan solo con tu consentimiento, solo para esa conversación, y se borran si lo pides. No se guarda la IP, solo un hash para limitar abusos.',
      pv_h7: 'Borrar la cuenta', pv_p7: 'Borrar la cuenta elimina todos tus datos del servidor y de este dispositivo.', pv_delete: 'Borrar mi cuenta y todos los datos', pv_delete_signin: 'Inicia sesión para borrar tu cuenta.', pv_no_backend: 'El sitio funciona ahora sin cuentas; no hay datos en un servidor. Para borrar los datos del dispositivo: Mi área → Copia de seguridad y datos → Borrar todo.',
      pv_h8: 'No es asesoramiento', pv_p8: 'Este sitio es solo una herramienta de seguimiento, estimación y comparación de información. No es asesoramiento de inversión ni de pensiones.',
      pv_h9: 'Preguntas', pv_p9: 'Preguntas y solicitudes de borrado:', pv_status: 'Esta página describe cómo funciona el sitio. Aún no la ha revisado un abogado.'
    }
  };
  var I = window.PORTAL_I18N = window.PORTAL_I18N || {};
  Object.keys(S).forEach(function (l) { I[l] = I[l] || {}; Object.keys(S[l]).forEach(function (k) { I[l][k] = S[l][k]; }); });

  function P() { return window.Portal; }
  function t(k) { return P().t(k); }
  function h() { return P().ui.h.apply(null, arguments); }
  function section(a, b, c) { return P().ui.section(a, b, c); }
  function toast(m) { P().ui.toast(m); }
  function C() { return window.PortalCloud; }
  function cloudOn() { return !!(C() && C().configured); }
  function dt(s) { if (!s) return '—'; var d = new Date(s); return isNaN(d) ? '—' : d.toLocaleDateString(P().lang() === 'he' ? 'he-IL' : P().lang()) + ' ' + d.toTimeString().slice(0, 5); }
  function field(label, input, help) { return h('label', { class: 'field' }, [h('span', { text: label }), input, help ? h('small', { class: 'help', text: help }) : null]); }
  var TYPES = ['ticker', 'bug', 'feature', 'other'], RSTAT = ['new', 'in_progress', 'done', 'rejected'], LSTAT = ['new', 'contacted', 'closed'];
  function statusChip(s) { return h('span', { class: 'chip st-' + s, text: t('st_' + s) }); }

  /* downscale an image file to a JPEG data URL under ~400 KB */
  function shrinkImage(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type)) return rej(new Error('type'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1280, q = 0.72, out = null;
        for (var i = 0; i < 6; i++) {
          var sc = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length < 400000) break;
          max = Math.round(max * 0.75); q = Math.max(0.5, q - 0.06);
        }
        URL.revokeObjectURL(url); out && out.length < 590000 ? res(out) : rej(new Error('size'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }

  /* ---------- support.html ---------- */
  function renderSupport(main) {
    var started = Date.now(), shot = null;
    var typeSel = h('select', { id: 'req-type' }, TYPES.map(function (x) { return h('option', { value: x, text: t('sp_t_' + x) }); }));
    var ref = (document.referrer || '').replace(/^.*\//, '').replace(/[?#].*$/, '');
    try { var q = new URLSearchParams(location.search); if (q.get('type') && TYPES.indexOf(q.get('type')) >= 0) typeSel.value = q.get('type'); } catch (e) {}
    var title = h('input', { id: 'req-title', maxlength: '200' }), symbol = h('input', { id: 'req-symbol', maxlength: '100', dir: 'ltr' }), body = h('textarea', { id: 'req-body', rows: '5', maxlength: '5000' });
    var email = h('input', { id: 'req-email', type: 'email', maxlength: '200', dir: 'ltr', autocomplete: 'email' });
    var hp = h('input', { id: 'req-website', name: 'website', tabindex: '-1', autocomplete: 'off' });
    var file = h('input', { id: 'req-shot', type: 'file', accept: 'image/*' }), prev = h('div', { class: 'shot-prev' });
    var symWrap = field(t('sp_symbol'), symbol);
    function syncType() { symWrap.style.display = typeSel.value === 'ticker' ? '' : 'none'; }
    typeSel.addEventListener('change', syncType); syncType();
    file.addEventListener('change', function () {
      shot = null; prev.innerHTML = '';
      if (!file.files[0]) return;
      shrinkImage(file.files[0]).then(function (d) { shot = d; prev.appendChild(h('img', { src: d, alt: '' })); }, function () { toast(t('sp_shot_bad')); file.value = ''; });
    });
    var btn = h('button', { type: 'submit', class: 'btn btn-primary', id: 'req-send', text: t('sp_send') });
    var form = h('form', { class: 'form-grid', id: 'req-form' }, [field(t('sp_type'), typeSel), field(t('sp_title'), title), symWrap, field(t('sp_body'), body), field(t('sp_email'), email),
      field(t('sp_shot'), file, t('sp_shot_help')), prev, h('div', { class: 'hp', 'aria-hidden': 'true' }, [h('label', null, ['Website', hp])]), h('div', { class: 'toolbar' }, [btn])]);
    var notice = cloudOn() ? null : h('div', { class: 'notice amber', id: 'backend-missing', text: t('sp_backend') });
    if (!cloudOn()) btn.disabled = true;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!cloudOn()) { toast(t('sp_backend')); return; }
      if ((title.value + body.value + symbol.value).trim().length < 3) { toast(t('sp_need')); return; }
      btn.disabled = true;
      C().submitRequest({ type: typeSel.value, title: title.value.trim(), body: body.value.trim(), symbol: typeSel.value === 'ticker' ? symbol.value.trim() : '', email: email.value.trim(), screenshot: shot, page: ref, hp: hp.value, elapsed: Date.now() - started })
        .then(function () { toast(t('sp_sent')); form.reset(); shot = null; prev.innerHTML = ''; syncType(); loadMine(); },
          function (e) { toast(/rate/.test(e.message) ? t('sp_rate') : t('send_fail') + ': ' + e.message); })
        .then(function () { btn.disabled = false; });
    });
    main.appendChild(section(t('sp_form'), [notice, form]));
    var mine = h('div', { id: 'my-requests' });
    main.appendChild(section(t('sp_mine'), [mine]));
    function loadMine() {
      if (!cloudOn()) { mine.textContent = t('sp_none'); return; }
      mine.textContent = t('loading');
      C().ready.then(function () { return C().myRequests(); }).then(function (rows) {
        mine.innerHTML = '';
        if (!rows || !rows.length) { mine.appendChild(h('div', { class: 'empty', text: t('sp_none') })); return; }
        rows.forEach(function (r) {
          mine.appendChild(h('div', { class: 'req-item' }, [h('div', { class: 'req-head' }, [h('strong', { text: r.title || r.symbol || t('sp_t_' + r.type) }), statusChip(r.status)]),
            h('div', { class: 'help', text: t('sp_t_' + r.type) + ' · ' + dt(r.created_at) }), r.reply_note ? h('p', { class: 'req-reply' }, [h('strong', { text: t('sp_reply') + ': ' }), r.reply_note]) : null]));
        });
      }, function () { mine.textContent = t('sp_none'); });
    }
    loadMine();
  }

  /* ---------- admin.html ---------- */
  function renderAdmin(main) {
    var box = h('div', { id: 'admin-root' }); main.appendChild(box);
    if (!cloudOn()) { box.appendChild(h('div', { class: 'notice amber', id: 'backend-missing', text: t('backend_missing') })); return; }
    box.appendChild(h('div', { class: 'empty', text: t('loading') }));
    function gate() {
      box.innerHTML = '';
      if (!C().user) { box.appendChild(section(t('admin_title'), [h('p', { text: t('ad_signin') }), h('button', { type: 'button', class: 'btn btn-primary', id: 'admin-signin', text: t('sign_in'), onclick: function () { C().openDialog(); } })])); return; }
      C().isAdmin().then(function (ok) { if (!ok) { box.innerHTML = ''; box.appendChild(h('div', { class: 'notice amber', id: 'admin-denied', text: t('ad_denied') })); return; } build(); },
        function () { box.innerHTML = ''; box.appendChild(h('div', { class: 'notice amber', id: 'admin-denied', text: t('ad_denied') })); });
    }
    function build() {
      box.innerHTML = '';
      var fType = h('select', { id: 'f-type' }, [h('option', { value: '', text: t('ad_all') })].concat(TYPES.map(function (x) { return h('option', { value: x, text: t('sp_t_' + x) }); })));
      var fStat = h('select', { id: 'f-status' }, [h('option', { value: '', text: t('ad_all') })].concat(RSTAT.map(function (x) { return h('option', { value: x, text: t('st_' + x) }); })));
      var list = h('div', { id: 'admin-requests' }), count = h('span', { class: 'help' });
      var bar = h('div', { class: 'toolbar filters' }, [field(t('ad_filter_type'), fType), field(t('ad_filter_status'), fStat), h('button', { type: 'button', class: 'btn btn-sm', text: t('ad_refresh'), onclick: load }), count]);
      fType.addEventListener('change', load); fStat.addEventListener('change', load);
      box.appendChild(section(t('ad_requests'), [bar, list]));
      var leads = h('div', { id: 'admin-leads' });
      box.appendChild(section(t('ad_leads'), [leads]));
      function load() {
        list.textContent = t('loading');
        C().admin.listRequests({ p_type: fType.value || null, p_status: fStat.value || null }).then(function (rows) {
          list.innerHTML = ''; rows = rows || [];
          count.textContent = t('ad_count').replace('{n}', rows.length);
          if (!rows.length) list.appendChild(h('div', { class: 'empty', text: t('none') }));
          rows.forEach(function (r) { list.appendChild(reqCard(r)); });
        }, function (e) { list.textContent = t('send_fail') + ': ' + e.message; });
      }
      function reqCard(r) {
        var st = h('select', { 'aria-label': t('status') }, RSTAT.map(function (x) { return h('option', { value: x, text: t('st_' + x) }); })); st.value = r.status;
        var internal = h('textarea', { rows: '2' }); internal.value = r.internal_note || '';
        var reply = h('textarea', { rows: '2' }); reply.value = r.reply_note || '';
        var save = h('button', { type: 'button', class: 'btn btn-primary btn-sm', text: t('ad_save'), onclick: function () {
          save.disabled = true;
          C().admin.updateRequest(r.id, { status: st.value, internal: internal.value, reply: reply.value }).then(function () { toast(t('ad_saved')); }, function (e) { toast(t('send_fail') + ': ' + e.message); }).then(function () { save.disabled = false; });
        } });
        var img = r.screenshot && /^data:image\/(jpeg|png|webp);base64,/.test(r.screenshot) ? h('img', { src: r.screenshot, alt: '', class: 'shot' }) : null;
        return h('details', { class: 'req-item admin' }, [
          h('summary', null, [h('strong', { text: r.title || r.symbol || '—' }), ' ', statusChip(r.status), h('span', { class: 'help', text: ' · ' + t('sp_t_' + r.type) + ' · ' + dt(r.created_at) })]),
          r.symbol ? h('p', { dir: 'ltr', text: r.symbol }) : null,
          r.body ? h('p', { class: 'pre', text: r.body }) : null,
          h('p', { class: 'help', text: t('ad_from') + ': ' + (r.email || (r.user_id ? 'user ' + String(r.user_id).slice(0, 8) : t('ad_anon'))) + (r.page ? ' · ' + t('ad_page') + ': ' + r.page : '') }),
          img, field(t('status'), st), field(t('ad_internal'), internal), field(t('ad_reply'), reply), h('div', { class: 'toolbar' }, [save])]);
      }
      function loadLeads() {
        leads.textContent = t('loading');
        C().admin.listLeads().then(function (rows) {
          leads.innerHTML = ''; rows = rows || [];
          leads.appendChild(P().ui.table([[t('lead_name'), function (r) { return r.name; }], [t('ad_contact'), function (r) { return h('span', { dir: 'ltr', text: r.contact }); }], [t('ad_topic'), function (r) { return r.topic; }],
            [t('date'), function (r) { return dt(r.created_at); }], [t('status'), function (r) {
              var s = h('select', null, LSTAT.map(function (x) { return h('option', { value: x, text: t('st_' + x) }); })); s.value = r.status;
              s.addEventListener('change', function () { C().admin.updateLead(r.id, s.value).then(function () { toast(t('ad_saved')); }, function (e) { toast(e.message); }); });
              return s; }]], rows));
        }, function (e) { leads.textContent = t('send_fail') + ': ' + e.message; });
      }
      load(); loadLeads();
    }
    C().ready.then(gate, gate);
    window.addEventListener('portal-cloud', function () { if (!box.querySelector('#admin-requests') || !C().user) gate(); });
  }

  /* ---------- privacy.html ---------- */
  function renderPrivacy(main) {
    for (var i = 1; i <= 8; i++) {
      var kids = [h('p', { text: t('pv_p' + i) })];
      if (i === 7) {
        var slot = h('div', { id: 'privacy-delete' }); kids.push(slot);
        (function (slot) {
          function draw() {
            slot.innerHTML = '';
            if (!cloudOn()) { slot.appendChild(h('p', { class: 'help', text: t('pv_no_backend') })); return; }
            if (!C().user) { slot.appendChild(h('p', { class: 'help', text: t('pv_delete_signin') })); slot.appendChild(h('button', { type: 'button', class: 'btn', text: t('sign_in'), onclick: function () { C().openDialog(); } })); return; }
            slot.appendChild(h('button', { type: 'button', class: 'btn btn-danger', id: 'privacy-delete-btn', text: t('pv_delete'), onclick: function () { C().deleteAccount(); } }));
          }
          draw(); if (cloudOn()) { C().ready.then(draw, draw); window.addEventListener('portal-cloud', draw); }
        })(slot);
      }
      main.appendChild(section(t('pv_h' + i), kids));
    }
    var contact = (window.PORTAL_AUTH_CONFIG && window.PORTAL_AUTH_CONFIG.contactEmail) || '';
    main.appendChild(section(t('pv_h9'), [h('p', null, [t('pv_p9') + ' ', contact ? h('a', { href: 'mailto:' + contact, dir: 'ltr', text: contact }) : h('a', { href: 'support.html', text: t('support_link') })]), h('p', { class: 'help', text: t('pv_status') })]));
  }

  window.PORTAL_PAGES = window.PORTAL_PAGES || {};
  window.PORTAL_PAGES.support = { title: ['support_title', 'support_sub'], render: renderSupport };
  window.PORTAL_PAGES.admin = { title: ['admin_title', 'admin_sub'], render: renderAdmin };
  window.PORTAL_PAGES.privacy = { title: ['privacy_title', 'privacy_sub'], render: renderPrivacy };
})();
