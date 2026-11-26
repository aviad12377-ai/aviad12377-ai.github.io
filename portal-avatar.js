/* Avatar (v8): a stylized cartoon drawn as SVG from a few feature params.
   Privacy: a selfie is read only inside this browser (canvas), used to sample skin / hair colours, and discarded.
   The photo is never uploaded and never stored; only the small params object is kept in localStorage (this device). */
(function () {
  var KEY = 'portal-avatar-v1';
  var SKIN = ['#f9dcc4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
  var HAIR = ['#1b1b1f', '#4a3022', '#7b4a2b', '#b07a45', '#d9b26f', '#a8a8b0', '#c2462f'];
  var STYLES = ['short', 'side', 'long', 'curly', 'bald'], BEARDS = ['none', 'stubble', 'full'], GLASSES = ['none', 'round', 'square'];
  var T = {
    he: { title: 'האווטאר שלי', selfie: 'צילום סלפי / בחירת תמונה', privacy: 'התמונה מעובדת רק בדפדפן שלך כדי לזהות גוון עור ושיער. היא לא נשלחת לשום שרת, לא נשמרת ולא נכנסת לחשבון. נשמרות רק הבחירות (צבעים וסגנון) במכשיר הזה.', hair: 'תסרוקת', hairColor: 'צבע שיער', skin: 'גוון עור', beard: 'זקן', glasses: 'משקפיים', reset: 'איפוס', tier: 'דרגה', next: 'לדרגה הבאה', done: 'הצבעים עודכנו מהתמונה. התמונה עצמה נמחקה.', fail: 'לא הצלחנו לקרוא את התמונה.',
      styles: { short: 'קצר', side: 'צד', long: 'ארוך', curly: 'מתולתל', bald: 'קירח' }, beards: { none: 'בלי', stubble: 'זיפים', full: 'מלא' }, glassesN: { none: 'בלי', round: 'עגולים', square: 'מרובעים' },
      tiers: ['מתחיל/ה', 'חוסך/ת', 'משקיע/ה', 'עצמאי/ת כלכלית', 'טייקון'], tierHint: 'הבגדים והרקע משתדרגים לפי השווי הנקי' },
    en: { title: 'My avatar', selfie: 'Take a selfie / choose a photo', privacy: 'The photo is processed only in your browser to pick skin and hair colours. It is never uploaded, never stored and never added to your account. Only your choices (colours, style) are kept on this device.', hair: 'Hair style', hairColor: 'Hair colour', skin: 'Skin tone', beard: 'Beard', glasses: 'Glasses', reset: 'Reset', tier: 'Tier', next: 'Next tier at', done: 'Colours updated from the photo. The photo itself was discarded.', fail: 'Could not read the photo.',
      styles: { short: 'Short', side: 'Side', long: 'Long', curly: 'Curly', bald: 'Bald' }, beards: { none: 'None', stubble: 'Stubble', full: 'Full' }, glassesN: { none: 'None', round: 'Round', square: 'Square' },
      tiers: ['Starter', 'Saver', 'Investor', 'Independent', 'Tycoon'], tierHint: 'Outfit and background upgrade with your net worth' },
    es: { title: 'Mi avatar', selfie: 'Hacer selfie / elegir foto', privacy: 'La foto se procesa solo en tu navegador para elegir los colores de piel y pelo. Nunca se sube, no se guarda y no se añade a tu cuenta. Solo se guardan tus elecciones en este dispositivo.', hair: 'Peinado', hairColor: 'Color de pelo', skin: 'Tono de piel', beard: 'Barba', glasses: 'Gafas', reset: 'Restablecer', tier: 'Nivel', next: 'Siguiente nivel en', done: 'Colores actualizados desde la foto. La foto se descartó.', fail: 'No se pudo leer la foto.',
      styles: { short: 'Corto', side: 'Lado', long: 'Largo', curly: 'Rizado', bald: 'Calvo' }, beards: { none: 'Sin', stubble: 'Barba corta', full: 'Completa' }, glassesN: { none: 'Sin', round: 'Redondas', square: 'Cuadradas' },
      tiers: ['Principiante', 'Ahorrador', 'Inversor', 'Independiente', 'Magnate'], tierHint: 'La ropa y el fondo mejoran con tu patrimonio neto' }
  };
  var TIERS = [0, 50000, 250000, 1000000, 5000000];
  function lang() { try { var l = JSON.parse(localStorage.getItem('portal-settings-v1') || '{}').lang; return T[l] ? l : 'he'; } catch (e) { return 'he'; } }
  function tr() { return T[lang()]; }
  function load() { try { return Object.assign({ skin: SKIN[1], hair: HAIR[0], style: 'short', beard: 'none', glasses: 'none' }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { skin: SKIN[1], hair: HAIR[0], style: 'short', beard: 'none', glasses: 'none' }; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify({ skin: p.skin, hair: p.hair, style: p.style, beard: p.beard, glasses: p.glasses })); } catch (e) {} }
  function netWorth() { try { return window.Portal.calc.summary().net || 0; } catch (e) { return 0; } }
  function tierOf(nw) { var i = 0; TIERS.forEach(function (x, k) { if (nw >= x) i = k; }); return i; }
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; function c(x) { return Math.max(0, Math.min(255, Math.round(x * f))); } return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1); }
  var uidN = 0;
  function svg(p, tier) {
    var id = 'av' + (++uidN), sk = p.skin, hr = p.hair, skD = shade(sk, .86), hrD = shade(hr, .8);
    var BG = [['#2a2a35', '#1b1b22'], ['#4338ca', '#1e1b4b'], ['#7c3aed', '#312e81'], ['#0ea5e9', '#6d28d9'], ['#f59e0b', '#7c2d12']][tier];
    var OUT = [
      '<path d="M18 120c2-20 18-30 42-30s40 10 42 30z" fill="#64748b"/><path d="M48 92l12 10 12-10" fill="none" stroke="#475569" stroke-width="3"/>',
      '<path d="M16 120c2-21 19-31 44-31s42 10 44 31z" fill="#334155"/><path d="M40 93c4 10 36 10 40 0" fill="none" stroke="#1e293b" stroke-width="5"/><path d="M54 104v12M66 104v12" stroke="#94a3b8" stroke-width="2"/>',
      '<path d="M16 120c2-21 19-31 44-31s42 10 44 31z" fill="#f8fafc"/><path d="M60 92l-6 6 6 22 6-22z" fill="#7c3aed"/><path d="M44 90l16 8 16-8" fill="none" stroke="#cbd5e1" stroke-width="3"/>',
      '<path d="M16 120c2-21 19-31 44-31s42 10 44 31z" fill="#1e293b"/><path d="M48 90l12 30 12-30z" fill="#f8fafc"/><path d="M60 94l-4 5 4 16 4-16z" fill="#0ea5e9"/><path d="M48 90l12 30M72 90l-12 30" stroke="#0f172a" stroke-width="3"/><circle cx="82" cy="106" r="2.5" fill="#facc15"/>',
      '<path d="M16 120c2-21 19-31 44-31s42 10 44 31z" fill="#0b0b0f"/><path d="M48 90l12 30 12-30z" fill="#f8fafc"/><path d="M53 96l7 4 7-4-7 4z" fill="#111" stroke="#111" stroke-width="4"/><path d="M48 90l12 30M72 90l-12 30" stroke="#facc15" stroke-width="2"/><path d="M30 106h10" stroke="#facc15" stroke-width="3"/>'
    ][tier];
    var HAIRS = {
      short: '<path d="M34 50c0-18 12-28 26-28s26 10 26 28c-6-8-14-11-26-11s-20 3-26 11z" fill="' + hr + '"/>',
      side: '<path d="M33 52c-2-20 12-31 28-31 16 0 27 11 26 29-10-2-22-10-30-18-4 10-14 16-24 20z" fill="' + hr + '"/>',
      long: '<path d="M32 54c0-21 12-32 28-32s28 11 28 32v30c-4 0-6-4-6-10V52c-6-8-12-12-22-12s-16 4-22 12v22c0 6-2 10-6 10z" fill="' + hr + '"/>',
      curly: '<g fill="' + hr + '"><circle cx="40" cy="40" r="9"/><circle cx="52" cy="32" r="10"/><circle cx="66" cy="31" r="10"/><circle cx="79" cy="39" r="9"/><circle cx="35" cy="51" r="6"/><circle cx="85" cy="51" r="6"/></g>',
      bald: '<path d="M40 38c6-6 14-8 20-8s14 2 20 8" fill="none" stroke="' + shade(sk, .8) + '" stroke-width="2" opacity=".5"/>'
    };
    var BEARD = { none: '', stubble: '<path d="M40 64c2 16 12 22 20 22s18-6 20-22c-4 8-10 10-20 10s-16-2-20-10z" fill="' + hr + '" opacity=".35"/>', full: '<path d="M38 60c0 20 10 30 22 30s22-10 22-30c-4 10-10 13-22 13s-18-3-22-13z" fill="' + hrD + '"/><path d="M52 74c4 2 12 2 16 0" stroke="' + skD + '" stroke-width="2" fill="none"/>' };
    var GL = { none: '', round: '<g fill="none" stroke="#e5e7eb" stroke-width="2.4"><circle cx="50" cy="59" r="7"/><circle cx="70" cy="59" r="7"/><path d="M57 59h6"/></g>', square: '<g fill="none" stroke="#111827" stroke-width="3"><rect x="42" y="53" width="15" height="11" rx="3"/><rect x="63" y="53" width="15" height="11" rx="3"/><path d="M57 58h6"/></g>' };
    var EXTRA = ['', '', '<g fill="#fff" opacity=".7"><circle cx="20" cy="28" r="1.6"/><circle cx="100" cy="22" r="1.3"/><circle cx="96" cy="44" r="1"/></g>',
      '<g fill="#fde68a" opacity=".9"><path d="M18 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M100 30l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/></g>',
      '<path d="M42 26l6 8 12-12 12 12 6-8-3 16H45z" fill="#facc15" stroke="#b45309" stroke-width="1.5"/><circle cx="60" cy="22" r="2.4" fill="#ef4444"/>'][tier];
    return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="avatar"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + BG[0] + '"/><stop offset="1" stop-color="' + BG[1] + '"/></linearGradient><clipPath id="' + id + 'c"><circle cx="60" cy="60" r="60"/></clipPath></defs>' +
      '<g clip-path="url(#' + id + 'c)"><rect width="120" height="120" fill="url(#' + id + ')"/>' + EXTRA.replace(/^<path d="M42 26.*$/, '') +
      '<rect x="52" y="78" width="16" height="16" rx="6" fill="' + skD + '"/>' + OUT +
      '<ellipse cx="35" cy="60" rx="4" ry="6" fill="' + skD + '"/><ellipse cx="85" cy="60" rx="4" ry="6" fill="' + skD + '"/><ellipse cx="60" cy="58" rx="25" ry="28" fill="' + sk + '"/>' +
      (p.style === 'long' ? '' : '') + HAIRS[p.style] +
      '<circle cx="50" cy="59" r="2.6" fill="#1f2937"/><circle cx="70" cy="59" r="2.6" fill="#1f2937"/><path d="M45 52q5-3 10 0M65 52q5-3 10 0" stroke="' + hrD + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M52 72q8 6 16 0" stroke="#7f1d1d" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + BEARD[p.beard] + GL[p.glasses] + (tier === 4 ? EXTRA : '') + '</g></svg>';
  }
  function mount(slot) { if (!slot) return; var nw = netWorth(), tier = tierOf(nw); slot.innerHTML = svg(load(), tier); slot.title = tr().tiers[tier]; }
  function nearest(rgb, list) {
    var best = list[0], bd = 1e9;
    list.forEach(function (hex) { var n = parseInt(hex.slice(1), 16), d = Math.pow((n >> 16) - rgb[0], 2) + Math.pow(((n >> 8) & 255) - rgb[1], 2) + Math.pow((n & 255) - rgb[2], 2); if (d < bd) { bd = d; best = hex; } });
    return best;
  }
  function avg(ctx, x, y, w, h) { var d = ctx.getImageData(x, y, w, h).data, r = 0, g = 0, b = 0, c = d.length / 4; for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } return [r / c, g / c, b / c]; }
  function fromPhoto(file, done) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var S = 96, cv = document.createElement('canvas'); cv.width = S; cv.height = S; var ctx = cv.getContext('2d', { willReadFrequently: true });
      var m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2 * 0.6; // centre crop, a little higher (faces sit above centre)
      ctx.drawImage(img, sx, sy, m, m, 0, 0, S, S);
      var skin = avg(ctx, 38, 46, 20, 16), hair = avg(ctx, 34, 6, 28, 10);
      URL.revokeObjectURL(url); ctx.clearRect(0, 0, S, S); cv.width = 1; img.src = '';
      done(null, { skin: nearest(skin, SKIN), hair: nearest(hair, HAIR) });
    };
    img.onerror = function () { URL.revokeObjectURL(url); done(new Error('read')); };
    img.src = url;
  }
  function el(tag, attrs, kids) { var e = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'text') e.textContent = v; else if (k === 'onclick') e.addEventListener('click', v); else e.setAttribute(k, v); }); (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  function studio(fmtMoney) {
    var L = tr(), p = load(), wrap = el('div', { class: 'av-studio' }), prev = el('div', { class: 'av-preview' }), info = el('div'), msg = el('div', { 'aria-live': 'polite' });
    function redraw() {
      var nw = netWorth(), tier = tierOf(nw);
      prev.innerHTML = svg(p, tier); save(p);
      info.innerHTML = ''; info.appendChild(el('span', { class: 'tier-badge', text: L.tier + ': ' + L.tiers[tier] }));
      info.appendChild(el('p', { class: 'help', text: L.tierHint + (tier < 4 ? ' · ' + L.next + ' ' + (fmtMoney ? fmtMoney(TIERS[tier + 1]) : TIERS[tier + 1]) : '') }));
      var slot = document.getElementById('avatar-slot'); if (slot) mount(slot);
    }
    function group(label, kids) { var id = 'avg-' + (++uidN); return el('div', { class: 'field', role: 'group', 'aria-labelledby': id }, [el('span', { id: id, style: 'font-size:14px;color:var(--muted);font-weight:700', text: label }), el('div', { class: 'swatches' }, kids)]); }
    function sw(key, list) { return list.map(function (c) { var b = el('button', { type: 'button', class: 'swatch', style: 'background:' + c, 'aria-label': c, 'aria-pressed': p[key] === c ? 'true' : 'false' }); b.addEventListener('click', function () { p[key] = c; [].forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); redraw(); }); return b; }); }
    function sel(key, list, names, label) { var id = 'av-' + key, s = el('select', { id: id }, list.map(function (v) { return el('option', { value: v, text: names[v] }); })); s.value = p[key]; s.addEventListener('change', function () { p[key] = s.value; redraw(); }); return el('div', { class: 'field' }, [el('label', { for: id, text: label }), s]); }
    var file = el('input', { type: 'file', accept: 'image/*', capture: 'user', id: 'av-file', class: 'sr-only' });
    file.addEventListener('change', function () { var f = file.files && file.files[0]; if (!f) return; fromPhoto(f, function (err, r) { file.value = ''; msg.innerHTML = ''; if (err) { msg.appendChild(el('div', { class: 'notice red', text: L.fail })); return; } p.skin = r.skin; p.hair = r.hair; msg.appendChild(el('div', { class: 'notice blue', text: L.done })); var n = studio(fmtMoney); wrap.replaceWith(n); }); });
    wrap.appendChild(prev); wrap.appendChild(info);
    wrap.appendChild(el('div', { class: 'toolbar' }, [el('label', { for: 'av-file', class: 'btn btn-primary', role: 'button', tabindex: '0', text: L.selfie }), file,
      el('button', { type: 'button', class: 'btn', text: L.reset, onclick: function () { localStorage.removeItem(KEY); var n = studio(fmtMoney); wrap.replaceWith(n); } })]));
    wrap.lastChild.firstChild.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    wrap.appendChild(msg);
    wrap.appendChild(el('p', { class: 'help', text: L.privacy }));
    wrap.appendChild(group(L.skin, sw('skin', SKIN))); wrap.appendChild(group(L.hairColor, sw('hair', HAIR)));
    wrap.appendChild(el('div', { class: 'fields' }, [sel('style', STYLES, L.styles, L.hair), sel('beard', BEARDS, L.beards, L.beard), sel('glasses', GLASSES, L.glassesN, L.glasses)]));
    redraw();
    return wrap;
  }
  window.PortalAvatar = { mount: mount, studio: studio, title: function () { return tr().title; }, tierOf: tierOf, TIERS: TIERS };
})();
