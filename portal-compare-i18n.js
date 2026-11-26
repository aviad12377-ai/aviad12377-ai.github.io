/* i18n keys and nav entries for comparison pages. Load after portal-i18n.js, before portal-nav.js / portal.js. */
(function () {
  'use strict';
  var HE = {
    compare_cards_title: 'השוואת כרטיסי אשראי',
    compare_cards_sub: 'דמי כרטיס, החזרים ועמלת המרה לפי הוצאה חודשית',
    compare_savings_title: 'השוואת פיקדונות וחסכונות',
    compare_savings_sub: 'ממוצעי ריבית ששולמו בפועל, לפי בנק ישראל',
    compare_loans_extra: 'לוח סילוקין והשוואה לשוק',
    compare_funds_title: 'השוואת קרנות פנסיה, גמל והשתלמות',
    compare_funds_sub: 'תשואות ודמי ניהול לפי מסלול, מנתוני רשות שוק ההון',
    compare_mortgage_title: 'בדיקת מחזור משכנתא',
    compare_mortgage_sub: 'השוואה לממוצעי בנק ישראל לפי הצמדה ותקופה',
    not_advice_short: 'מידע בלבד, לא ייעוץ'
  };
  var EN = {
    compare_cards_title: 'Credit card comparison',
    compare_cards_sub: 'Fees, cashback and FX fees by monthly spend',
    compare_savings_title: 'Deposit and savings comparison',
    compare_savings_sub: 'Average rates actually paid, per the Bank of Israel',
    compare_loans_extra: 'Amortization schedule and market comparison',
    compare_funds_title: 'Pension, gemel and study-fund comparison',
    compare_funds_sub: 'Returns and fees by track, from the Capital Market Authority',
    compare_mortgage_title: 'Mortgage refinance check',
    compare_mortgage_sub: 'Compare tracks to Bank of Israel averages by linkage and term',
    not_advice_short: 'Information only, not advice'
  };
  var ES = {
    compare_cards_title: 'Comparación de tarjetas',
    compare_cards_sub: 'Comisiones, devoluciones y tipo de cambio según el gasto mensual',
    compare_savings_title: 'Comparación de depósitos y ahorros',
    compare_savings_sub: 'Tipos medios realmente pagados, según el Banco de Israel',
    compare_loans_extra: 'Cuadro de amortización y comparación de mercado',
    compare_funds_title: 'Comparación de fondos de pensión y previsión',
    compare_funds_sub: 'Rentabilidades y comisiones por trayectoria, de la Autoridad del Mercado de Capitales',
    compare_mortgage_title: 'Comprobación de refinanciación hipotecaria',
    compare_mortgage_sub: 'Comparar tramos con promedios del Banco de Israel según indexación y plazo',
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
  add({ id: 'compare-funds', href: 'compare-funds.html', label: { he: 'השוואת קרנות', en: 'Compare funds', es: 'Comparar fondos' }, icon: 'umbrella', group: 'wealth', parent: 'wealth' });
  add({ id: 'compare-mortgage', href: 'compare-mortgage.html', label: { he: 'בדיקת מחזור משכנתא', en: 'Refinance check', es: 'Revisión de refinanciación' }, icon: 'house', group: 'debts', parent: 'loans' });
})();
