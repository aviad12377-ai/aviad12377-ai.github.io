/* i18n keys and nav entries for comparison pages. Load after portal-i18n.js, before portal-nav.js / portal.js. */
(function () {
  'use strict';
  var HE = {
    compare_cards_title: 'השוואת כרטיסי אשראי',
    compare_cards_sub: 'דמי כרטיס, החזרים ועמלת המרה לפי הוצאה חודשית',
    compare_savings_title: 'השוואת פיקדונות וחסכונות',
    compare_savings_sub: 'ממוצעי ריבית ששולמו בפועל, לפי בנק ישראל',
    compare_loans_extra: 'לוח סילוקין והשוואה לשוק',
    not_advice_short: 'מידע בלבד, לא ייעוץ'
  };
  var EN = {
    compare_cards_title: 'Credit card comparison',
    compare_cards_sub: 'Fees, cashback and FX fees by monthly spend',
    compare_savings_title: 'Deposit and savings comparison',
    compare_savings_sub: 'Average rates actually paid, per the Bank of Israel',
    compare_loans_extra: 'Amortization schedule and market comparison',
    not_advice_short: 'Information only, not advice'
  };
  var ES = {
    compare_cards_title: 'Comparación de tarjetas',
    compare_cards_sub: 'Comisiones, devoluciones y tipo de cambio según el gasto mensual',
    compare_savings_title: 'Comparación de depósitos y ahorros',
    compare_savings_sub: 'Tipos medios realmente pagados, según el Banco de Israel',
    compare_loans_extra: 'Cuadro de amortización y comparación de mercado',
    not_advice_short: 'Solo información, no es asesoramiento'
  };
  var I = window.PORTAL_I18N;
  if (I) {
    if (I.he) Object.assign(I.he, HE);
    if (I.en) Object.assign(I.en, EN);
    if (I.es) Object.assign(I.es, ES);
  }
  window.COMPARE_I18N = { he: HE, en: EN, es: ES };
  var nav = window.PORTAL_NAV = window.PORTAL_NAV || [];
  function add(e) {
    for (var i = 0; i < nav.length; i++) if (nav[i] && nav[i].id === e.id) return;
    nav.push(e);
  }
  add({ id: 'compare-cards', href: 'compare-cards.html', label: { he: 'השוואת כרטיסים', en: 'Compare cards', es: 'Comparar tarjetas' }, icon: 'card', group: 'debts', parent: 'loans' });
  add({ id: 'compare-savings', href: 'compare-savings.html', label: { he: 'השוואת פיקדונות', en: 'Compare deposits', es: 'Comparar depósitos' }, icon: 'piggy', group: 'wealth', parent: 'wealth' });
})();
