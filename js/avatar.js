/* Portal selfie-to-avatar (t17).
   100% client-side: MediaPipe Face Landmarker + canvas colour sampling.
   The selfie is never uploaded, never stored, and never sent to Supabase.
   Only a small params object is written into localStorage portal-data-v1 (and
   optionally synced as part of the existing portal_docs "data" document). */
(function () {
  'use strict';
  var DATA_KEY = 'portal-data-v1';
  var LEGACY_KEY = 'portal-avatar-v1';
  var WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
  var MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  var SKIN = ['#f9dcc4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#3b2314'];
  var HAIR = ['#1b1b1f', '#2c1a10', '#4a3022', '#7b4a2b', '#b07a45', '#d9b26f', '#f3e5ab', '#a8a8b0', '#c2462f'];
  var STYLES = ['short', 'side', 'long', 'curly', 'bald'];
  var BEARDS = ['none', 'stubble', 'mustache', 'full'];
  var GLASSES = ['none', 'round', 'square'];
  var BROWS = ['thin', 'medium', 'thick'];
  var FACES = ['oval', 'round', 'long', 'wide'];

  var T = {
    he: {
      title: 'האווטאר שלי', cta: 'צלם סלפי', upload: 'העלאת תמונה', privacy: 'התמונה נשארת במכשיר שלך ולא נשלחת לשום מקום',
      camTitle: 'צילום סלפי', capture: 'צלם עכשיו', close: 'סגירה', camFail: 'לא הצלחנו לפתוח את המצלמה. אפשר להעלות תמונה במקום.',
      done: 'עדכנו את האווטאר לפי התמונה. התמונה עצמה נמחקה מהזיכרון.',
      noFace: 'לא זיהינו פנים ברורים. האווטאר עודכן בצבעים שדגמנו, ואפשר לתקן ידנית למטה.',
      fail: 'לא הצלחנו לקרוא את התמונה.', busy: 'מזהים תווי פנים…',
      hair: 'תסרוקת', hairColor: 'צבע שיער', skin: 'גוון עור', beard: 'זקן', glasses: 'משקפיים', brows: 'גבות', face: 'צורת פנים',
      reset: 'איפוס לברירת מחדל', hint: 'זיהוי אוטומטי ניסיוני — אפשר לתקן כל פרט ידנית',
      trial: 'זיהוי אוטומטי ניסיוני — אפשר לתקן כל פרט ידנית',
      styles: { short: 'קצר', side: 'צד', long: 'ארוך', curly: 'מתולתל', bald: 'קירח' },
      beards: { none: 'בלי', stubble: 'זיפים', mustache: 'שפם', full: 'מלא' },
      glassesN: { none: 'בלי', round: 'עגולים', square: 'מרובעים' },
      browsN: { thin: 'דקות', medium: 'בינוניות', thick: 'עבות' },
      faces: { oval: 'סגלגל', round: 'עגול', long: 'מאורך', wide: 'רחב' }
    },
    en: {
      title: 'My avatar', cta: 'Take a selfie', upload: 'Upload a photo', privacy: 'The photo stays on your device and is not sent anywhere',
      camTitle: 'Take a selfie', capture: 'Capture', close: 'Close', camFail: 'Could not open the camera. You can upload a photo instead.',
      done: 'The avatar was updated from the photo. The photo itself was discarded.',
      noFace: 'We could not clearly find a face. Colours were sampled and you can correct the features below.',
      fail: 'Could not read the photo.', busy: 'Reading facial features…',
      hair: 'Hair style', hairColor: 'Hair colour', skin: 'Skin tone', beard: 'Beard', glasses: 'Glasses', brows: 'Eyebrows', face: 'Face shape',
      reset: 'Reset', hint: 'Experimental auto-detect — you can fix every detail by hand',
      trial: 'Experimental auto-detect — you can fix every detail by hand',
      styles: { short: 'Short', side: 'Side', long: 'Long', curly: 'Curly', bald: 'Bald' },
      beards: { none: 'None', stubble: 'Stubble', mustache: 'Mustache', full: 'Full' },
      glassesN: { none: 'None', round: 'Round', square: 'Square' },
      browsN: { thin: 'Thin', medium: 'Medium', thick: 'Thick' },
      faces: { oval: 'Oval', round: 'Round', long: 'Long', wide: 'Wide' }
    }
  };

  function lang() {
    try { var l = JSON.parse(localStorage.getItem('portal-settings-v1') || '{}').lang; return T[l] ? l : 'he'; } catch (e) { return 'he'; }
  }
  function tr() { return T[lang()] || T.he; }
  function defaults() {
    return { v: 1, skin: SKIN[1], hairColor: HAIR[0], hairStyle: 'short', beard: 'none', glasses: 'none', brows: 'medium', face: 'oval', source: 'manual' };
  }
  function sanitize(p) {
    var d = defaults();
    p = p || {};
    d.skin = SKIN.indexOf(p.skin) >= 0 ? p.skin : (isHex(p.skin) ? p.skin : d.skin);
    d.hairColor = HAIR.indexOf(p.hairColor || p.hair) >= 0 ? (p.hairColor || p.hair) : (isHex(p.hairColor || p.hair) ? (p.hairColor || p.hair) : d.hairColor);
    d.hairStyle = STYLES.indexOf(p.hairStyle || p.style) >= 0 ? (p.hairStyle || p.style) : d.hairStyle;
    d.beard = BEARDS.indexOf(p.beard) >= 0 ? p.beard : d.beard;
    d.glasses = GLASSES.indexOf(p.glasses) >= 0 ? p.glasses : d.glasses;
    d.brows = BROWS.indexOf(p.brows) >= 0 ? p.brows : d.brows;
    d.face = FACES.indexOf(p.face) >= 0 ? p.face : d.face;
    d.source = p.source === 'selfie' ? 'selfie' : 'manual';
    d.updatedAt = p.updatedAt || Date.now();
    return d;
  }
  function isHex(s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); }

  var lastParams = null;
  var reentry = false;
  function readStore() {
    try { var o = JSON.parse(localStorage.getItem(DATA_KEY) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }
  function load() {
    var store = readStore();
    if (store.avatar) { lastParams = sanitize(store.avatar); return lastParams; }
    try {
      var legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (legacy && typeof legacy === 'object') {
        lastParams = sanitize({ skin: legacy.skin, hairColor: legacy.hair, hairStyle: legacy.style, beard: legacy.beard, glasses: legacy.glasses, source: 'manual' });
        save(lastParams);
        return lastParams;
      }
    } catch (e) {}
    lastParams = defaults();
    return lastParams;
  }
  function save(p) {
    lastParams = sanitize(p);
    lastParams.updatedAt = Date.now();
    var store = readStore();
    store.avatar = {
      v: 1,
      skin: lastParams.skin,
      hairColor: lastParams.hairColor,
      hairStyle: lastParams.hairStyle,
      beard: lastParams.beard,
      glasses: lastParams.glasses,
      brows: lastParams.brows,
      face: lastParams.face,
      source: lastParams.source,
      updatedAt: lastParams.updatedAt
    };
    try { localStorage.setItem(DATA_KEY, JSON.stringify(store)); } catch (e) {}
    if (window.Portal && window.Portal.data) window.Portal.data.avatar = store.avatar;
    try { window.dispatchEvent(new CustomEvent('portal-local-write', { detail: { key: DATA_KEY } })); } catch (e) {}
    refreshSlots();
    return lastParams;
  }
  // If portal.js re-saves portal-data-v1 without an avatar key (until emptyData is patched), put it back.
  window.addEventListener('portal-local-write', function (e) {
    if (reentry || !lastParams || !e || !e.detail || e.detail.key !== DATA_KEY) return;
    var store = readStore();
    if (store.avatar) return;
    reentry = true;
    try { store.avatar = lastParams; localStorage.setItem(DATA_KEY, JSON.stringify(store)); } catch (err) {}
    reentry = false;
  });

  function shade(hex, f) {
    var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(x) { return Math.max(0, Math.min(255, Math.round(x * f))); }
    return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
  }
  var uidN = 0;
  function svgString(p) {
    p = sanitize(p || load());
    var id = 'pav' + (++uidN), sk = p.skin, hr = p.hairColor, skD = shade(sk, .86), hrD = shade(hr, .78);
    var shape = {
      oval: { rx: 26, ry: 30 },
      round: { rx: 30, ry: 29 },
      long: { rx: 24, ry: 33 },
      wide: { rx: 32, ry: 28 }
    }[p.face] || { rx: 26, ry: 30 };
    var browW = { thin: 1.6, medium: 2.3, thick: 3.2 }[p.brows] || 2.3;
    var earY = 62, neckW = 16;
    var hairBack = '';
    if (p.hairStyle === 'long') {
      hairBack = '<path d="M32 58c-2 22-4 38 4 50h48c8-12 6-28 4-50" fill="' + hr + '"/>';
    } else if (p.hairStyle === 'curly') {
      hairBack = '<g fill="' + hr + '"><circle cx="34" cy="78" r="7"/><circle cx="86" cy="78" r="7"/></g>';
    }
    var hairs = {
      short: '<path d="M' + (60 - shape.rx - 2) + ' 52c0-20 12-32 ' + (shape.rx + 2) + '-32s' + (shape.rx + 2) + ' 12 ' + (shape.rx + 2) + ' 32c-7-10-16-14-' + (shape.rx + 2) + '-14s-19 4-' + (shape.rx + 2) + ' 14z" fill="' + hr + '"/>',
      side: '<path d="M32 54c-2-22 12-34 28-34 16 0 29 12 28 32-12-2-24-12-32-20-4 11-14 18-24 22z" fill="' + hr + '"/>',
      long: '<path d="M32 56c0-22 12-34 28-34s28 12 28 34v8c-6-10-14-16-28-16s-22 6-28 16z" fill="' + hr + '"/>',
      curly: '<g fill="' + hr + '"><circle cx="38" cy="38" r="10"/><circle cx="52" cy="28" r="11"/><circle cx="68" cy="27" r="11"/><circle cx="82" cy="37" r="10"/><circle cx="34" cy="52" r="7"/><circle cx="86" cy="52" r="7"/><circle cx="60" cy="24" r="9"/></g>',
      bald: '<path d="M40 36c6-6 14-8 20-8s14 2 20 8" fill="none" stroke="' + shade(sk, .8) + '" stroke-width="2" opacity=".45"/>'
    };
    var beard = {
      none: '',
      stubble: '<path d="M' + (60 - shape.rx + 6) + ' 70c2 18 12 26 ' + (shape.rx - 6) + ' 26s' + (shape.rx - 8) + '-8 ' + (shape.rx - 6) + '-26c-4 9-11 12-' + (shape.rx - 6) + ' 12s-18-3-' + (shape.rx - 6) + '-12z" fill="' + hr + '" opacity=".38"/>',
      mustache: '<path d="M44 72c5 7 9 8 16 2 7 6 11 5 16-2-6 9-11 12-16 12s-10-3-16-12z" fill="' + hrD + '"/>',
      full: '<path d="M' + (60 - shape.rx + 4) + ' 66c0 22 12 34 ' + (shape.rx - 4) + ' 34s' + (shape.rx - 4) + '-12 ' + (shape.rx - 4) + '-34c-4 12-12 16-' + (shape.rx - 4) + ' 16s-20-4-' + (shape.rx - 4) + '-16z" fill="' + hrD + '"/><path d="M52 80c4 2 12 2 16 0" stroke="' + skD + '" stroke-width="2" fill="none"/>'
    };
    var gl = {
      none: '',
      round: '<g fill="rgba(255,255,255,.12)" stroke="#e5e7eb" stroke-width="2.4"><circle cx="50" cy="60" r="8"/><circle cx="70" cy="60" r="8"/><path d="M58 60h4"/><path d="M42 60h-6M84 60h6" stroke="#d1d5db"/></g>',
      square: '<g fill="rgba(255,255,255,.1)" stroke="#111827" stroke-width="3"><rect x="41" y="54" width="17" height="13" rx="3"/><rect x="62" y="54" width="17" height="13" rx="3"/><path d="M58 60h4"/><path d="M41 60h-6M85 60h6"/></g>'
    };
    return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (lang() === 'he' ? 'אווטאר' : 'Avatar') + '">' +
      '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="60" cy="60" r="60"/></clipPath></defs>' +
      '<g clip-path="url(#' + id + 'c)"><rect width="120" height="120" fill="url(#' + id + 'g)"/>' +
      '<rect x="52" y="86" width="' + neckW + '" height="22" rx="6" fill="' + skD + '"/>' +
      '<ellipse cx="34" cy="' + earY + '" rx="5" ry="7" fill="' + skD + '"/><ellipse cx="86" cy="' + earY + '" rx="5" ry="7" fill="' + skD + '"/>' +
      hairBack +
      '<ellipse cx="60" cy="62" rx="' + shape.rx + '" ry="' + shape.ry + '" fill="' + sk + '"/>' +
      hairs[p.hairStyle] +
      '<path d="M45 53q5-3 10 0" stroke="' + hrD + '" stroke-width="' + browW + '" fill="none" stroke-linecap="round"/>' +
      '<path d="M65 53q5-3 10 0" stroke="' + hrD + '" stroke-width="' + browW + '" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="60" r="3" fill="#1f2937"/><circle cx="70" cy="60" r="3" fill="#1f2937"/>' +
      '<circle cx="51" cy="59" r="1" fill="#fff" opacity=".8"/><circle cx="71" cy="59" r="1" fill="#fff" opacity=".8"/>' +
      '<path d="M60 62l-3 7h6z" fill="' + skD + '"/>' +
      '<path d="M52 76q8 6 16 0" stroke="#7f1d1d" stroke-width="2.3" fill="none" stroke-linecap="round"/>' +
      beard[p.beard] + gl[p.glasses] +
      '</g></svg>';
  }

  function render(el, params) {
    if (!el) return;
    el.innerHTML = svgString(params || load());
  }
  function refreshSlots() {
    var nodes = document.querySelectorAll('#avatar-slot, .avatar-btn, [data-avatar-slot]');
    var p = lastParams || load();
    for (var i = 0; i < nodes.length; i++) render(nodes[i], p);
    try { window.dispatchEvent(new CustomEvent('portal-avatar-change', { detail: p })); } catch (e) {}
  }

  /* ---------- colour + geometry helpers ---------- */
  function nearest(rgb, list) {
    var best = list[0], bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var n = parseInt(list[i].slice(1), 16);
      var d = Math.pow((n >> 16) - rgb[0], 2) + Math.pow(((n >> 8) & 255) - rgb[1], 2) + Math.pow((n & 255) - rgb[2], 2);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }
  function lum(rgb) { return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255; }
  function sat(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  }
  function dist2(a, b) { return Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2); }
  function sampleBox(ctx, w, h, x, y, bw, bh) {
    x = Math.max(0, Math.min(w - 1, Math.round(x))); y = Math.max(0, Math.min(h - 1, Math.round(y)));
    bw = Math.max(1, Math.min(w - x, Math.round(bw))); bh = Math.max(1, Math.min(h - y, Math.round(bh)));
    var d = ctx.getImageData(x, y, bw, bh).data, r = 0, g = 0, b = 0, c = 0, vsum = 0;
    var prev = null;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; c++;
      if (prev) vsum += Math.abs(d[i] - prev[0]) + Math.abs(d[i + 1] - prev[1]) + Math.abs(d[i + 2] - prev[2]);
      prev = [d[i], d[i + 1], d[i + 2]];
    }
    if (!c) return { rgb: [128, 128, 128], n: 0, var: 0 };
    return { rgb: [r / c, g / c, b / c], n: c, var: vsum / c };
  }
  function sampleAround(ctx, w, h, lx, ly, rad) {
    return sampleBox(ctx, w, h, lx * w - rad, ly * h - rad, rad * 2, rad * 2);
  }
  function darkFraction(ctx, w, h, x, y, bw, bh, threshLum) {
    x = Math.max(0, Math.min(w - 1, Math.round(x))); y = Math.max(0, Math.min(h - 1, Math.round(y)));
    bw = Math.max(1, Math.min(w - x, Math.round(bw))); bh = Math.max(1, Math.min(h - y, Math.round(bh)));
    var d = ctx.getImageData(x, y, bw, bh).data, dark = 0, c = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      c++;
      if (lum([d[i], d[i + 1], d[i + 2]]) < threshLum) dark++;
    }
    return c ? dark / c : 0;
  }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function lm(face, i) { return face[i] || { x: 0.5, y: 0.5 }; }

  function clipBox(w, h, x, y, bw, bh) {
    x = Math.max(0, Math.min(w - 1, Math.round(x))); y = Math.max(0, Math.min(h - 1, Math.round(y)));
    bw = Math.max(1, Math.min(w - x, Math.round(bw))); bh = Math.max(1, Math.min(h - y, Math.round(bh)));
    return { x: x, y: y, bw: bw, bh: bh };
  }
  function edgeDensity(ctx, w, h, x, y, bw, bh) {
    var b = clipBox(w, h, x, y, bw, bh);
    var d = ctx.getImageData(b.x, b.y, b.bw, b.bh).data, iw = b.bw, sum = 0, n = 0;
    function Lp(xx, yy) { var i = (yy * iw + xx) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; }
    for (var yy = 1; yy < b.bh - 1; yy++) {
      for (var xx = 1; xx < b.bw - 1; xx++) {
        sum += Math.abs(Lp(xx + 1, yy) - Lp(xx - 1, yy)) + Math.abs(Lp(xx, yy + 1) - Lp(xx, yy - 1));
        n++;
      }
    }
    return n ? sum / n : 0;
  }
  function regionScan(ctx, w, h, x, y, bw, bh, keep) {
    var b = clipBox(w, h, x, y, bw, bh);
    var d = ctx.getImageData(b.x, b.y, b.bw, b.bh).data;
    var r = 0, g = 0, bl = 0, c = 0, k = 0, vsum = 0, prev = null;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      var rgb = [d[i], d[i + 1], d[i + 2]];
      c++;
      if (!keep(rgb)) continue;
      k++;
      r += rgb[0]; g += rgb[1]; bl += rgb[2];
      if (prev) vsum += Math.abs(rgb[0] - prev[0]) + Math.abs(rgb[1] - prev[1]) + Math.abs(rgb[2] - prev[2]);
      prev = rgb;
    }
    return { rgb: k ? [r / k, g / k, bl / k] : [128, 128, 128], n: c, hits: k, frac: c ? k / c : 0, var: k > 1 ? vsum / k : 0 };
  }
  function nearestHair(rgb) {
    var L = lum(rgb), S = sat(rgb);
    var dark = ['#1b1b1f', '#2c1a10', '#4a3022'];
    var brown = ['#7b4a2b', '#b07a45'];
    var blond = ['#d9b26f', '#f3e5ab'];
    var grey = ['#a8a8b0'];
    var red = ['#c2462f'];
    var pool;
    // Dark hair must stay in the dark/brown set — never snap to the grey swatch.
    if (L < 0.30) pool = dark;
    else if (S < 0.14 && L >= 0.40) pool = L > 0.72 ? blond.concat(grey) : grey;
    else if (S > 0.35 && rgb[0] > rgb[1] + 20 && rgb[0] > rgb[2] + 20) pool = red.concat(brown);
    else if (L < 0.46) pool = dark.concat(brown);
    else pool = brown.concat(blond);
    return nearest(rgb, pool);
  }

  /* MediaPipe Face Mesh useful indices */
  var I = {
    forehead: 10, chin: 152, lCheek: 234, rCheek: 454, lTemple: 127, rTemple: 356,
    lEar: 93, rEar: 323, nose: 1, lMouth: 61, rMouth: 291, upLip: 13, loLip: 14,
    lBrowIn: 55, lBrowOut: 46, rBrowIn: 285, rBrowOut: 276,
    lEyeOut: 33, rEyeOut: 263, lEyeIn: 133, rEyeIn: 362, lEyeUp: 159, rEyeUp: 386,
    lJaw: 172, rJaw: 397, philtrum: 164, noseBase: 94, mustacheL: 36, mustacheR: 266
  };

  function detectFromLandmarks(ctx, w, h, face) {
    var notes = {};
    var cheekL = sampleAround(ctx, w, h, lm(face, I.lCheek).x, lm(face, I.lCheek).y, 8);
    var cheekR = sampleAround(ctx, w, h, lm(face, I.rCheek).x, lm(face, I.rCheek).y, 8);
    var skinRgb = [(cheekL.rgb[0] + cheekR.rgb[0]) / 2, (cheekL.rgb[1] + cheekR.rgb[1]) / 2, (cheekL.rgb[2] + cheekR.rgb[2]) / 2];
    var skinL = lum(skinRgb);

    var fh = lm(face, I.forehead);
    var chin = lm(face, I.chin);
    var faceW = Math.max(0.12, Math.abs(lm(face, I.rCheek).x - lm(face, I.lCheek).x));
    var faceH = Math.max(0.16, Math.abs(chin.y - fh.y));
    var lEar = lm(face, I.lEar), rEar = lm(face, I.rEar);

    // Backdrop from corners and mid-sides, so a dark studio wall is not counted as hair.
    var bgSamples = [
      sampleBox(ctx, w, h, 0, 0, Math.max(8, 0.12 * w), Math.max(8, 0.12 * h)),
      sampleBox(ctx, w, h, w * 0.88, 0, Math.max(8, 0.12 * w), Math.max(8, 0.12 * h)),
      sampleBox(ctx, w, h, 0, h * 0.40, Math.max(8, 0.10 * w), Math.max(8, 0.12 * h)),
      sampleBox(ctx, w, h, w * 0.88, h * 0.40, Math.max(8, 0.10 * w), Math.max(8, 0.12 * h))
    ];
    var bgRgb = [(bgSamples[0].rgb[0] + bgSamples[1].rgb[0]) / 2, (bgSamples[0].rgb[1] + bgSamples[1].rgb[1]) / 2, (bgSamples[0].rgb[2] + bgSamples[1].rgb[2]) / 2];
    function nearBg(rgb) {
      for (var bi = 0; bi < bgSamples.length; bi++) {
        if (Math.sqrt(dist2(rgb, bgSamples[bi].rgb)) <= 36) return true;
      }
      return false;
    }

    function isHairPx(rgb) {
      var vsSkin = Math.sqrt(dist2(rgb, skinRgb));
      if (vsSkin <= 30) return false;
      if (nearBg(rgb) && vsSkin > 30) return false;
      var L = lum(rgb), S = sat(rgb);
      if (L < skinL - 0.07) return true;
      if (S < 0.22 && Math.abs(L - skinL) > 0.10) return true;
      return false;
    }

    // Hair colour: pixels in a scalp band just above the forehead and at the temples, excluding skin and backdrop.
    var scalp = regionScan(ctx, w, h, (fh.x - 0.55 * faceW) * w, Math.max(0, (fh.y - 0.28 * faceH) * h), 1.1 * faceW * w, 0.24 * faceH * h, isHairPx);
    var templeL = regionScan(ctx, w, h, (lm(face, I.lTemple).x - 0.22 * faceW) * w, (lm(face, I.lTemple).y - 0.16 * faceH) * h, 0.22 * faceW * w, 0.28 * faceH * h, isHairPx);
    var templeR = regionScan(ctx, w, h, lm(face, I.rTemple).x * w, (lm(face, I.rTemple).y - 0.16 * faceH) * h, 0.22 * faceW * w, 0.28 * faceH * h, isHairPx);
    var hairHits = scalp.hits + templeL.hits + templeR.hits;
    var hairRgb = scalp.hits ? scalp.rgb : (templeL.hits ? templeL.rgb : (templeR.hits ? templeR.rgb : scalp.rgb));
    if (hairHits) {
      var wr = scalp.hits + templeL.hits + templeR.hits;
      hairRgb = [
        (scalp.rgb[0] * scalp.hits + templeL.rgb[0] * templeL.hits + templeR.rgb[0] * templeR.hits) / wr,
        (scalp.rgb[1] * scalp.hits + templeL.rgb[1] * templeL.hits + templeR.rgb[1] * templeR.hits) / wr,
        (scalp.rgb[2] * scalp.hits + templeL.rgb[2] * templeL.hits + templeR.rgb[2] * templeR.hits) / wr
      ];
    }
    // If a darker hair cluster exists (typical pigmented hair), ignore bright window/backdrop pixels that would pull the colour to grey.
    var darkScalp = regionScan(ctx, w, h, (fh.x - 0.55 * faceW) * w, Math.max(0, (fh.y - 0.28 * faceH) * h), 1.1 * faceW * w, 0.24 * faceH * h, function (rgb) { return isHairPx(rgb) && lum(rgb) < 0.34; });
    var darkT = regionScan(ctx, w, h, (lm(face, I.lTemple).x - 0.22 * faceW) * w, (lm(face, I.lTemple).y - 0.16 * faceH) * h, 0.22 * faceW * w, 0.28 * faceH * h, function (rgb) { return isHairPx(rgb) && lum(rgb) < 0.34; });
    var darkU = regionScan(ctx, w, h, lm(face, I.rTemple).x * w, (lm(face, I.rTemple).y - 0.16 * faceH) * h, 0.22 * faceW * w, 0.28 * faceH * h, function (rgb) { return isHairPx(rgb) && lum(rgb) < 0.34; });
    var darkHits = darkScalp.hits + darkT.hits + darkU.hits;
    if ((darkT.hits + darkU.hits) >= 12 || (darkHits >= 24 && darkHits >= hairHits * 0.35)) {
      var dw = darkHits;
      hairRgb = [
        (darkScalp.rgb[0] * darkScalp.hits + darkT.rgb[0] * darkT.hits + darkU.rgb[0] * darkU.hits) / dw,
        (darkScalp.rgb[1] * darkScalp.hits + darkT.rgb[1] * darkT.hits + darkU.rgb[1] * darkU.hits) / dw,
        (darkScalp.rgb[2] * darkScalp.hits + darkT.rgb[2] * darkT.hits + darkU.rgb[2] * darkU.hits) / dw
      ];
    }
    var hairVsSkin = Math.sqrt(dist2(hairRgb, skinRgb));
    var vsBgHair = Math.sqrt(dist2(hairRgb, bgRgb));
    var baldScore = hairHits < 18 || (scalp.frac < 0.12 && templeL.frac + templeR.frac < 0.12) || vsBgHair < 28;
    notes.hairVsSkin = Math.round(hairVsSkin);
    notes.hairHits = hairHits;
    notes.darkHits = darkHits;
    notes.scalpFrac = Math.round(scalp.frac * 100) / 100;

    // Length: hair-coloured mask just below the ears (neck), not the jacket/torso.
    function isLengthHair(rgb) { return isHairPx(rgb) && Math.sqrt(dist2(rgb, hairRgb)) < 36 && Math.abs(lum(rgb) - lum(hairRgb)) < 0.14; }
    var belowH = 0.42 * faceH * h;
    var belowW = 0.22 * faceW * w;
    var belowL = regionScan(ctx, w, h, (lEar.x - 0.20 * faceW) * w, lEar.y * h + 2, belowW, belowH, baldScore ? function () { return false; } : isLengthHair);
    var belowR = regionScan(ctx, w, h, rEar.x * w, rEar.y * h + 2, belowW, belowH, baldScore ? function () { return false; } : isLengthHair);
    var longFrac = (belowL.frac + belowR.frac) / 2;
    var hairStyle = 'short';
    if (baldScore) hairStyle = 'bald';
    else if (longFrac >= 0.24 && belowL.frac >= 0.16 && belowR.frac >= 0.16) hairStyle = 'long';
    else if (Math.abs(templeL.frac - templeR.frac) > 0.22 && Math.max(templeL.frac, templeR.frac) > 0.28) hairStyle = 'side';
    notes.longFrac = Math.round(longFrac * 100) / 100;
    notes.belowL = Math.round(belowL.frac * 100) / 100;
    notes.belowR = Math.round(belowR.frac * 100) / 100;

    // Beard / mustache: coverage + texture variance on the philtrum vs chin and jaws.
    // Include grey/white whiskers (desaturated, not merely darker than skin).
    var hairIsGrey = sat(hairRgb) < 0.18 && lum(hairRgb) > 0.35;
    function isBeardPx(rgb) {
      var L = lum(rgb);
      if (L < skinL - 0.16) return true;
      if (hairIsGrey && sat(rgb) < 0.22 && Math.sqrt(dist2(rgb, skinRgb)) > 28 && Math.abs(L - skinL) > 0.06) return true;
      return false;
    }
    var upLip = lm(face, I.upLip), loLip = lm(face, I.loLip);
    var noseB = lm(face, I.noseBase);
    var mY0 = Math.min(noseB.y, lm(face, I.philtrum).y);
    var mBox = regionScan(ctx, w, h, (lm(face, I.lMouth).x) * w, mY0 * h, Math.max(8, (lm(face, I.rMouth).x - lm(face, I.lMouth).x) * w), Math.max(6, (upLip.y - mY0) * h), isBeardPx);
    var beardY = loLip.y + (chin.y - loLip.y) * 0.40;
    var chinBox = regionScan(ctx, w, h, (chin.x - 0.32 * faceW) * w, beardY * h, 0.64 * faceW * w, Math.max(6, (chin.y - beardY) * h), isBeardPx);
    var lJaw = lm(face, I.lJaw), rJaw = lm(face, I.rJaw);
    var jawL = regionScan(ctx, w, h, lJaw.x * w, lJaw.y * h, Math.max(6, (chin.x - lJaw.x) * 0.55 * w), Math.max(6, (chin.y - lJaw.y) * 0.75 * h), isBeardPx);
    var jawR = regionScan(ctx, w, h, (rJaw.x - (rJaw.x - chin.x) * 0.55) * w, rJaw.y * h, Math.max(6, (rJaw.x - chin.x) * 0.55 * w), Math.max(6, (chin.y - rJaw.y) * 0.75 * h), isBeardPx);
    var jawFrac = (jawL.frac + jawR.frac) / 2;
    var chinVar = chinBox.var;
    var beard = 'none';
    if (chinBox.frac > 0.48 && jawFrac > 0.40 && chinVar >= 14) beard = 'full';
    else if (mBox.frac > 0.35 && mBox.frac + 0.02 >= chinBox.frac && chinBox.frac < 0.36) beard = 'mustache';
    else if (chinBox.frac > 0.28 && jawFrac > 0.28 && chinVar > 16) beard = 'stubble';
    notes.beardChin = Math.round(chinBox.frac * 100) / 100;
    notes.beardJaw = Math.round(jawFrac * 100) / 100;
    notes.mustache = Math.round(mBox.frac * 100) / 100;
    notes.chinVar = Math.round(chinVar);

    // Glasses: edge density in both eye regions plus a nose-bridge band, vs cheek baseline.
    var lOut = lm(face, I.lEyeOut), rOut = lm(face, I.rEyeOut);
    var lIn = lm(face, I.lEyeIn), rIn = lm(face, I.rEyeIn);
    var lUp = lm(face, I.lEyeUp), rUp = lm(face, I.rEyeUp);
    var padX = 0.16 * faceW, padY = 0.12 * faceH;
    var eL = edgeDensity(ctx, w, h, (Math.min(lOut.x, lIn.x) - padX) * w, (lUp.y - padY) * h, (Math.abs(lOut.x - lIn.x) + 2 * padX) * w, (padY + 0.18 * faceH) * h);
    var eR = edgeDensity(ctx, w, h, (Math.min(rOut.x, rIn.x) - padX) * w, (rUp.y - padY) * h, (Math.abs(rOut.x - rIn.x) + 2 * padX) * w, (padY + 0.18 * faceH) * h);
    var brX0 = Math.min(lIn.x, rIn.x);
    var brX1 = Math.max(lIn.x, rIn.x);
    var brY = (lIn.y + rIn.y) / 2;
    var eBr = edgeDensity(ctx, w, h, brX0 * w, (brY - 0.08 * faceH) * h, Math.max(6, (brX1 - brX0) * w), 0.16 * faceH * h);
    var eCheek = (edgeDensity(ctx, w, h, (lm(face, I.lCheek).x - 0.08 * faceW) * w, (lm(face, I.lCheek).y - 0.08 * faceH) * h, 0.18 * faceW * w, 0.18 * faceH * h)
      + edgeDensity(ctx, w, h, (lm(face, I.rCheek).x - 0.10 * faceW) * w, (lm(face, I.rCheek).y - 0.08 * faceH) * h, 0.18 * faceW * w, 0.18 * faceH * h)) / 2;
    var base = Math.max(6, eCheek);
    var bothEyes = eL > base * 1.55 && eR > base * 1.55;
    var oneStrong = Math.max(eL, eR) > base * 1.80 && Math.min(eL, eR) > base * 1.05;
    var bridgeHit = eBr > base * 1.50;
    var glasses = 'none';
    if ((bothEyes && bridgeHit) || (oneStrong && bridgeHit)) {
      var bandRatio = ((rOut.x - lOut.x) * w) / Math.max(8, 0.28 * faceH * h);
      glasses = bandRatio > 3.6 ? 'square' : 'round';
    }
    notes.eL = Math.round(eL);
    notes.eR = Math.round(eR);
    notes.eBr = Math.round(eBr);
    notes.eCheek = Math.round(eCheek);

            // Brows thickness: distance brow-to-eye and darkness
    var browL = sampleAround(ctx, w, h, mid(lm(face, I.lBrowIn), lm(face, I.lBrowOut)).x, mid(lm(face, I.lBrowIn), lm(face, I.lBrowOut)).y, 5);
    var browGap = Math.abs(lm(face, I.lBrowIn).y - lm(face, I.lEyeUp).y);
    var brows = 'medium';
    if (browGap < 0.022 || lum(browL.rgb) > skinL - 0.04) brows = 'thin';
    else if (browGap > 0.045 && lum(browL.rgb) < skinL - 0.12) brows = 'thick';

    // Face shape from width/height
    var width = Math.hypot((lm(face, I.lCheek).x - lm(face, I.rCheek).x) * w, (lm(face, I.lCheek).y - lm(face, I.rCheek).y) * h);
    var height = Math.hypot((fh.x - chin.x) * w, (fh.y - chin.y) * h);
    var ratio = width / Math.max(1, height);
    var jawW = Math.hypot((lm(face, I.lJaw).x - lm(face, I.rJaw).x) * w, (lm(face, I.lJaw).y - lm(face, I.rJaw).y) * h);
    var face = 'oval';
    if (ratio > 0.95) face = jawW / width > 0.9 ? 'round' : 'wide';
    else if (ratio < 0.72) face = 'long';
    notes.ratio = Math.round(ratio * 100) / 100;

    var hairColor = baldScore ? nearestHair(hairHits ? hairRgb : [40, 30, 24]) : nearestHair(hairRgb);

    return {
      params: {
        skin: nearest(skinRgb, SKIN),
        hairColor: hairColor,
        hairStyle: hairStyle,
        beard: beard,
        glasses: glasses,
        brows: brows,
        face: face,
        source: 'selfie'
      },
      notes: notes,
      faceFound: true
    };
  }

  function detectFallback(ctx, w, h) {
    var skin = sampleBox(ctx, w, h, w * 0.38, h * 0.42, w * 0.24, h * 0.18);
    var hair = sampleBox(ctx, w, h, w * 0.32, h * 0.06, w * 0.36, h * 0.14);
    var chin = sampleBox(ctx, w, h, w * 0.38, h * 0.68, w * 0.24, h * 0.14);
    var beardDark = lum(skin.rgb) - lum(chin.rgb);
    return {
      params: {
        skin: nearest(skin.rgb, SKIN),
        hairColor: nearest(hair.rgb, HAIR),
        hairStyle: (Math.abs(lum(hair.rgb) - lum(skin.rgb)) < 0.08 ? 'bald' : 'short'),
        beard: beardDark > 0.16 ? 'full' : (beardDark > 0.07 ? 'stubble' : 'none'),
        glasses: 'none',
        brows: 'medium',
        face: 'oval',
        source: 'selfie'
      },
      notes: { fallback: true, beardDark: Math.round(beardDark * 100) / 100 },
      faceFound: false
    };
  }

  var landmarkerPromise = null;
  function getLandmarker() {
    if (landmarkerPromise) return landmarkerPromise;
    landmarkerPromise = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/+esm').then(function (mod) {
      return mod.FilesetResolver.forVisionTasks(WASM).then(function (files) {
        function make(delegate) {
          return mod.FaceLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: MODEL, delegate: delegate },
            runningMode: 'IMAGE',
            numFaces: 1
          });
        }
        return make('GPU').catch(function () { return make('CPU'); });
      });
    }).catch(function (err) {
      landmarkerPromise = null;
      throw err;
    });
    return landmarkerPromise;
  }

  function imageToCanvas(img) {
    // Keep aspect ratio so hair above the forehead is not cropped away before sampling.
    var MAX = 384;
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var scale = Math.min(MAX / Math.max(1, iw), MAX / Math.max(1, ih), 1);
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(iw * scale));
    cv.height = Math.max(1, Math.round(ih * scale));
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return { canvas: cv, ctx: ctx, w: cv.width, h: cv.height };
  }

  function detectImage(img) {
    var pack = imageToCanvas(img);
    return getLandmarker().then(function (lmkr) {
      var res = lmkr.detect(pack.canvas);
      var face = res && res.faceLandmarks && res.faceLandmarks[0];
      var out = face ? detectFromLandmarks(pack.ctx, pack.w, pack.h, face) : detectFallback(pack.ctx, pack.w, pack.h);
      wipe(pack);
      return out;
    }).catch(function () {
      var out = detectFallback(pack.ctx, pack.w, pack.h);
      wipe(pack);
      return out;
    });
  }
  function wipe(pack) {
    try { pack.ctx.clearRect(0, 0, pack.w, pack.h); pack.canvas.width = 1; pack.canvas.height = 1; } catch (e) {}
  }
  function loadFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !String(file.type || '').startsWith('image/')) { reject(new Error('type')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('read')); };
      img.src = url;
    });
  }

  var lastDetection = null;
  function applyDetection(result) {
    lastDetection = result;
    var p = Object.assign(load(), result.params);
    p.source = 'selfie';
    save(p);
    return p;
  }

  /* ---------- UI ---------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function openCamera(onFile, onStatus) {
    var L = tr();
    var stream = null;
    var sheet = el('div', { class: 'av-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'av-cam-title' });
    var video = el('video', { class: 'av-cam', autoplay: 'autoplay', playsinline: 'true', muted: 'muted' });
    function close() {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
      sheet.remove();
    }
    var captureBtn = el('button', { type: 'button', class: 'btn btn-primary', text: L.capture, onclick: function () {
      if (!video.videoWidth) return;
      var cv = document.createElement('canvas'); cv.width = video.videoWidth; cv.height = video.videoHeight;
      cv.getContext('2d').drawImage(video, 0, 0);
      cv.toBlob(function (blob) {
        close();
        if (blob) onFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    } });
    sheet.appendChild(el('div', { class: 'av-sheet-card' }, [
      el('div', { class: 'av-sheet-top' }, [el('h2', { id: 'av-cam-title', text: L.camTitle }), el('button', { type: 'button', class: 'btn av-sheet-close', text: L.close, onclick: close })]),
      video,
      el('p', { class: 'av-privacy', text: L.privacy }),
      el('div', { class: 'av-sheet-actions' }, [captureBtn])
    ]));
    document.body.appendChild(sheet);
    var faced = { video: { facingMode: 'user' }, audio: false };
    var getCam = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      ? navigator.mediaDevices.getUserMedia(faced)
      : Promise.reject(new Error('no cam'));
    getCam.then(function (s) { stream = s; video.srcObject = s; return video.play(); }).catch(function () {
      close();
      if (onStatus) onStatus('err', L.camFail);
    });
    return close;
  }

  function mountStudio(root, fmtMoney) {
    if (!root) return root;
    var L = tr();
    var p = load();
    root.innerHTML = '';
    root.classList.add('av-studio');
    var preview = el('div', { class: 'av-preview', 'aria-hidden': 'false' });
    var status = el('p', { class: 'av-status', role: 'status', 'aria-live': 'polite' });
    var file = el('input', { type: 'file', accept: 'image/*', capture: 'user', class: 'av-hidden', id: 'av-file-input', 'aria-label': 'בחירת תמונה' });

    function setStatus(kind, text) { status.className = 'av-status' + (kind ? ' ' + kind : ''); status.textContent = text || ''; }
    function redraw() { preview.innerHTML = svgString(p); }

    function openPickers() {
      wrap.classList.add('is-open');
      controls.classList.add('is-open');
      wrap.open = true;
      try { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { try { wrap.scrollIntoView(true); } catch (e2) {} }
      var first = controls.querySelector('button');
      if (first) try { first.focus(); } catch (e3) {}
    }
    function onDetected(result) {
      p = Object.assign(p, result.params);
      p = save(p);
      redraw();
      paintControls();
      setStatus(result.faceFound ? 'ok' : 'err', result.faceFound ? (L.done + ' ' + (L.trial || L.hint)) : L.noFace);
      if (wrap.parentNode === root) root.insertBefore(wrap, root.querySelector('.av-privacy') || wrap);
      openPickers();
    }
    function handleFile(f) {
      if (!f) return;
      setStatus('', L.busy);
      loadFile(f).then(function (img) {
        return detectImage(img).then(function (result) {
          try { img.src = ''; } catch (e) {}
          applyDetection(result);
          p = lastParams;
          onDetected(result);
        });
      }).catch(function () { setStatus('err', L.fail); });
    }
    file.addEventListener('change', function () { var f = file.files && file.files[0]; file.value = ''; handleFile(f); });

    var cta = el('button', { type: 'button', class: 'btn btn-primary', text: L.cta, onclick: function () {
      openCamera(handleFile, setStatus);
    } });
    var uploadBtn = el('button', { type: 'button', class: 'btn btn-secondary', text: L.upload, onclick: function () { file.click(); } });

    var wrap = el('details', { class: 'av-controls-wrap', id: 'av-manual' });
    var summary = el('summary', { class: 'av-controls-sum', text: L.hint });
    var controls = el('div', { class: 'av-controls' });
    wrap.appendChild(summary);
    wrap.appendChild(controls);
    function swatches(key, list) {
      return list.map(function (c) {
        var b = el('button', { type: 'button', class: 'av-swatch', style: 'background:' + c, 'aria-label': c, 'aria-pressed': p[key] === c ? 'true' : 'false' });
        b.addEventListener('click', function () { p[key] = c; p.source = 'manual'; save(p); redraw(); paintControls(); });
        return b;
      });
    }
    function picker(key, list, names) {
      return list.map(function (v) {
        var b = el('button', { type: 'button', 'aria-pressed': p[key] === v ? 'true' : 'false', text: names[v] });
        b.addEventListener('click', function () { p[key] = v; p.source = 'manual'; save(p); redraw(); paintControls(); });
        return b;
      });
    }
    function group(label, kids, cls) {
      return el('div', { class: 'av-group' }, [el('div', { class: 'av-label', text: label }), el('div', { class: cls }, kids)]);
    }
    function paintControls() {
      controls.innerHTML = '';
      controls.appendChild(el('p', { class: 'av-label', text: L.hint }));
      controls.appendChild(group(L.skin, swatches('skin', SKIN), 'av-swatches'));
      controls.appendChild(group(L.hairColor, swatches('hairColor', HAIR), 'av-swatches'));
      controls.appendChild(group(L.hair, picker('hairStyle', STYLES, L.styles), 'av-picker'));
      controls.appendChild(group(L.beard, picker('beard', BEARDS, L.beards), 'av-picker'));
      controls.appendChild(group(L.glasses, picker('glasses', GLASSES, L.glassesN), 'av-picker'));
      controls.appendChild(group(L.brows, picker('brows', BROWS, L.browsN), 'av-picker'));
      controls.appendChild(group(L.face, picker('face', FACES, L.faces), 'av-picker'));
    }

    var reset = el('button', { type: 'button', class: 'btn', text: L.reset, onclick: function () {
      p = save(defaults()); redraw(); paintControls(); setStatus('', '');
    } });

    root.appendChild(el('div', { class: 'av-preview-wrap' }, [preview, status]));
    root.appendChild(el('p', { class: 'av-privacy', role: 'note', text: L.privacy }));
    root.appendChild(el('div', { class: 'av-cta' }, [cta, uploadBtn, file]));
    root.appendChild(wrap);
    root.appendChild(el('div', { class: 'av-actions' }, [reset]));
    paintControls();
    redraw();
    wrap.open = true;
    return root;
  }

  function studio(elOrFmt) {
    if (elOrFmt && typeof elOrFmt !== 'function' && elOrFmt.nodeType === 1) {
      return mountStudio(elOrFmt);
    }
    var wrap = document.createElement('div');
    mountStudio(wrap, typeof elOrFmt === 'function' ? elOrFmt : null);
    return wrap;
  }

  // Optional nav entry so this page can highlight itself even before the redesign patch lands.
  var nav = window.PORTAL_NAV = window.PORTAL_NAV || [];
  if (!nav.some(function (x) { return x && x.id === 'avatar'; })) {
    nav.push({ id: 'avatar', href: 'avatar.html', label: { he: 'אווטאר', en: 'Avatar', es: 'Avatar' }, icon: 'user', group: 'account', parent: 'me' });
  }

  window.PortalAvatar = {
    render: render,
    mount: render,
    studio: studio,
    title: function () { return tr().title; },
    getParams: function () { return sanitize(lastParams || load()); },
    setParams: function (p) { return save(p); },
    detectImage: detectImage,
    detectFile: function (file) { return loadFile(file).then(detectImage); },
    lastDetection: function () { return lastDetection; },
    defaults: defaults,
    svg: svgString
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { lastParams = load(); refreshSlots(); });
  } else { lastParams = load(); refreshSlots(); }
})();
