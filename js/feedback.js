/* Feedback / bug report form. Writes one row to portal_feedback (insert-only for visitors; nobody can read it from the site). */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var PAGES = [['', 'כללי / לא בטוח'], ['home', 'בית'], ['wealth', 'נכסים וחסכונות'], ['pension', 'פנסיה וגמל'], ['hishtalmut', 'קרן השתלמות'], ['savings', 'חסכונות'], ['portfolio', 'תיק השקעות'], ['options', 'אופציות'], ['budget', 'תקציב'], ['loans', 'הלוואות'], ['mortgage', 'משכנתא'], ['cards', 'כרטיסי אשראי'], ['me', 'פרופיל וחשבון'],
    ['networth', 'הון לאורך זמן'], ['assets', 'נכסים: דירה, רכב, קרקע'], ['goals', 'קרן חירום ויעדים'], ['debts-planner', 'תכנון החזר חובות'], ['actions', 'צעדים לחיסכון בדמי ניהול']];
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, max / Math.max(w, hh));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hh * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.8, d = c.toDataURL('image/jpeg', q); while (d.length > 650000 && q > 0.3) { q -= 0.15; d = c.toDataURL('image/jpeg', q); }
        d.length > 690000 ? rej() : res(d);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(); };
      img.src = url;
    });
  }
  function render(main) {
    var started = Date.now(), f = { kind: 'bug', page: '', body: '', email: '' };
    var q = /[?&]page=([\w-]+)/.exec(location.search); if (q && PAGES.some(function (p) { return p[0] === q[1]; })) f.page = q[1];
    var C = window.PortalCloud; if (C && C.user && C.user.email) f.email = C.user.email;
    var msg = h('div', { 'aria-live': 'polite', role: 'status' });
    var hp = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    var kinds = h('fieldset', { class: 'field', style: 'border:0;padding:0;margin:0' }, [h('legend', { class: 'help', style: 'font-weight:700;padding:0', text: 'סוג הפנייה' })].concat([['bug', 'תקלה'], ['idea', 'רעיון לשיפור'], ['question', 'שאלה']].map(function (k) {
      var id = 'fb-k-' + k[0], r = h('input', { type: 'radio', name: 'fb-kind', id: id, value: k[0] }); r.checked = f.kind === k[0];
      r.addEventListener('change', function () { if (r.checked) f.kind = k[0]; });
      return h('div', { class: 'field check' }, [r, h('label', { for: id, text: k[1] })]);
    })));
    var body = T.field('מה קרה, או מה הרעיון', 'textarea', '', function () {}, { rows: 6 });
    var ta = body.querySelector('textarea'); ta.setAttribute('maxlength', '4000'); ta.setAttribute('required', '');
    ta.addEventListener('input', function () { f.body = ta.value; });
    /* optional screenshot: hidden native input + Hebrew button label, image shrunk on the device */
    var shot = null, fileIn = h('input', { type: 'file', id: 'fb-shot', accept: 'image/*', class: 't13-file' });
    var fileName = h('span', { class: 't13-file-name', id: 'fb-shot-name', text: 'לא נבחר קובץ' });
    var clearBtn = h('button', { type: 'button', class: 'btn btn-soft', hidden: true, text: 'הסרת התמונה' });
    var prev = h('div', { class: 't13-shot-prev' });
    fileIn.setAttribute('aria-describedby', 'fb-shot-name fb-shot-help');
    function clearShot() { shot = null; fileIn.value = ''; fileName.textContent = 'לא נבחר קובץ'; prev.innerHTML = ''; clearBtn.hidden = true; }
    clearBtn.addEventListener('click', function () { clearShot(); fileIn.focus(); });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0]; if (!f) { clearShot(); return; }
      if (!/^image\//.test(f.type)) { clearShot(); fileName.textContent = 'אפשר לצרף רק תמונה.'; return; }
      fileName.textContent = 'מכין את התמונה…';
      shrink(f).then(function (d) { shot = d; fileName.textContent = 'נבחר: ' + f.name; prev.innerHTML = ''; prev.appendChild(h('img', { src: d, alt: 'התמונה שתצורף לפנייה' })); clearBtn.hidden = false; },
        function () { clearShot(); fileName.textContent = 'לא הצלחנו לקרוא את התמונה.'; });
    });
    var picker = h('div', { class: 'field wide' }, [h('span', { class: 't13-label', id: 'fb-shot-lbl', text: 'צילום מסך (לא חובה)' }),
      h('div', { class: 't13-file-row' }, [fileIn, h('label', { for: 'fb-shot', class: 'btn btn-soft t13-file-btn' }, ['בחירת קובץ']), fileName, clearBtn]),
      h('p', { class: 'help', id: 'fb-shot-help', text: 'התמונה מוקטנת במכשיר לפני השליחה. כדאי להסתיר מספרים אישיים לפני הצילום.' }), prev]);
    var form = h('form', { novalidate: true }, [kinds,
      h('div', { class: 'fields' }, [T.field('באיזה דף', 'select', f.page, function (v) { f.page = v; }, { options: PAGES })]),
      body,
      h('div', { class: 'fields' }, [T.field('אימייל לתשובה (לא חובה)', 'email', f.email, function (v) { f.email = v; }, { help: 'רק אם רוצים שנחזור אליך.' })]),
      picker,
      h('div', { class: 't13-sr' }, [h('label', { text: 'לא למלא' }), hp]),
      h('p', { class: 't13-note', text: 'לא לכתוב כאן מספר תעודת זהות, מספרי חשבון או סיסמאות.' }),
      h('div', { class: 'toolbar' }, [h('button', { type: 'submit', class: 'btn btn-primary', text: 'שליחה' })]), msg]);
    var em = form.querySelector('input[type=email]'); if (em) { em.setAttribute('autocomplete', 'email'); em.addEventListener('input', function () { f.email = em.value; }); }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); msg.className = ''; msg.textContent = '';
      var text = (f.body || '').trim(), mail = (f.email || '').trim();
      if (text.length < 3) { msg.className = 'notice amber'; msg.textContent = 'צריך לכתוב כמה מילים על מה שקרה.'; ta.focus(); return; }
      if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) { msg.className = 'notice amber'; msg.textContent = 'כתובת האימייל לא נראית תקינה.'; em.focus(); return; }
      if (hp.value || Date.now() - started < 1500) { msg.className = 'notice blue'; msg.textContent = 'תודה, קיבלנו.'; return; }
      var C2 = window.PortalCloud;
      if (!C2 || !C2.client) { msg.className = 'notice red'; msg.textContent = 'השליחה לא זמינה כרגע. אפשר לנסות שוב בעוד רגע.'; return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'שולח…';
      C2.client.from('portal_feedback').insert({ kind: f.kind, page: f.page || '', body: text.slice(0, 4000), email: mail || null, screenshot: shot }).then(function (r) {
        btn.disabled = false; btn.textContent = 'שליחה';
        if (r.error) { msg.className = 'notice red'; msg.textContent = 'השליחה נכשלה. נסה שוב בעוד רגע.'; return; }
        ta.value = ''; f.body = ''; clearShot(); msg.className = 'notice blue'; msg.textContent = 'תודה! הפנייה נשלחה.'; msg.setAttribute('tabindex', '-1'); msg.focus();
      }, function () { btn.disabled = false; btn.textContent = 'שליחה'; msg.className = 'notice red'; msg.textContent = 'השליחה נכשלה. נסה שוב בעוד רגע.'; });
    });
    main.appendChild(T.card('דיווח על תקלה או רעיון', [form]));
  }
  T.page('feedback', 'משוב ודיווח על תקלה', 'ספרו לנו מה לא עובד או מה כדאי להוסיף', render);
})();
