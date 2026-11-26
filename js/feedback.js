/* Feedback / bug report form. Writes one row to portal_feedback (insert-only for visitors; nobody can read it from the site). */
(function () {
  'use strict';
  var T = window.T13, h = T.h;
  var PAGES = [['', 'כללי / לא בטוח'], ['home', 'בית'], ['wealth', 'נכסים וחסכונות'], ['pension', 'פנסיה וגמל'], ['hishtalmut', 'קרן השתלמות'], ['savings', 'חסכונות'], ['portfolio', 'תיק השקעות'], ['options', 'אופציות'], ['budget', 'תקציב'], ['loans', 'הלוואות'], ['mortgage', 'משכנתא'], ['cards', 'כרטיסי אשראי'], ['me', 'פרופיל וחשבון'],
    ['networth', 'הון לאורך זמן'], ['assets', 'נכסים: דירה, רכב, קרקע'], ['goals', 'קרן חירום ויעדים'], ['subscriptions', 'מנויים וחיובים'], ['debts-planner', 'תכנון החזר חובות'], ['actions', 'צעדים לחיסכון בדמי ניהול']];
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
    var form = h('form', { novalidate: true }, [kinds,
      h('div', { class: 'fields' }, [T.field('באיזה דף', 'select', f.page, function (v) { f.page = v; }, { options: PAGES })]),
      body,
      h('div', { class: 'fields' }, [T.field('אימייל לתשובה (לא חובה)', 'email', f.email, function (v) { f.email = v; }, { help: 'רק אם רוצים שנחזור אליך.' })]),
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
      C2.client.from('portal_feedback').insert({ kind: f.kind, page: f.page || '', body: text.slice(0, 4000), email: mail || null }).then(function (r) {
        btn.disabled = false; btn.textContent = 'שליחה';
        if (r.error) { msg.className = 'notice red'; msg.textContent = 'השליחה נכשלה. נסה שוב בעוד רגע.'; return; }
        ta.value = ''; f.body = ''; msg.className = 'notice blue'; msg.textContent = 'תודה! הפנייה נשלחה.'; msg.setAttribute('tabindex', '-1'); msg.focus();
      }, function () { btn.disabled = false; btn.textContent = 'שליחה'; msg.className = 'notice red'; msg.textContent = 'השליחה נכשלה. נסה שוב בעוד רגע.'; });
    });
    main.appendChild(T.card('דיווח על תקלה או רעיון', [form]));
  }
  T.page('feedback', 'משוב ודיווח על תקלה', 'ספרו לנו מה לא עובד או מה כדאי להוסיף', render);
})();
