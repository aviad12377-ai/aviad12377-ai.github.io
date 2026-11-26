/* Pension clearinghouse (המסלקה הפנסיונית) report reader. Runs in the browser only: the file is never uploaded anywhere.
   Formats:
   - XML "ממשק אחזקות" (Mimshak / YeshutYatzran / Mutzarim / Mutzar / HeshbonotOPolisot / HeshbonOPolisa), per the official
     XSD v009 published by the clearinghouse (swiftness.co.il, holdings XSD schema 009, 10.3.2025).
   - ZIP from the clearinghouse (often password protected), containing XML per institution + XLS/XLSX + PDF. Read with zip.js.
   - Excel summary ("פרטי המוצרים שלי" sheet), read with SheetJS. Column names matched loosely.
   - PDF: not supported (friendly message).
   Privacy: ID numbers are never read; policy/account numbers are masked to the last 4 digits at parse time. */
(function () {
  'use strict';
  // SUG-MUTZAR, from the official XSD documentation (holdings v009).
  var SUG = { '1': 'insurance', '2': 'pension', '3': 'gemel', '4': 'hishtalmut', '5': 'savings_policy', '6': 'risk', '7': 'mortgage_ins', '8': 'risk', '9': 'gemel_inv', '10': 'child' };
  // STATUS-POLISA-O-CHESHBON: 1 active, 2 frozen/inactive, 3 cancelled, 4 temporary risk, 6 blocked for deposits, 7 end of term, 8/9 coverage kept, 10 n/a.
  var STATUS = { '1': 'active', '2': 'inactive', '3': 'cancelled', '4': 'risk_temp', '6': 'blocked', '7': 'ended', '8': 'risk_temp', '9': 'coverage', '10': 'na' };

  function ln(el) { return (el.localName || el.nodeName || '').toUpperCase(); }
  function all(el, name) { var out = [], N = name.toUpperCase(), l = el.getElementsByTagName('*'); for (var i = 0; i < l.length; i++) if (ln(l[i]) === N) out.push(l[i]); return out; }
  function first(el, names) {
    names = [].concat(names);
    for (var k = 0; k < names.length; k++) { var a = all(el, names[k]); for (var i = 0; i < a.length; i++) { var v = (a[i].textContent || '').trim(); if (v) return v; } }
    return '';
  }
  function num(s) { if (s === null || s === undefined || s === '') return null; if (typeof s === 'number') return isFinite(s) ? s : null; var x = parseFloat(String(s).replace(/[,\s₪%]/g, '')); return isFinite(x) ? x : null; }
  function child(el, name) { var N = name.toUpperCase(); for (var i = 0; i < el.children.length; i++) if (ln(el.children[i]) === N) return el.children[i]; return null; }
  function ancestor(el, name) { var N = name.toUpperCase(); while (el && el.nodeType === 1) { if (ln(el) === N) return el; el = el.parentNode; } return null; }
  function ymd(s) { s = String(s || '').trim(); var m = /^(\d{4})(\d{2})(\d{2})/.exec(s); if (m) return m[1] + '-' + m[2] + '-' + m[3]; m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(s); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[0] : ''; }
  function mask(s) { s = String(s || '').replace(/\s/g, ''); return s ? '••••' + s.slice(-4) : ''; }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function typeFromText(s) {
    s = String(s || '');
    if (/השתלמ/.test(s)) return 'hishtalmut';
    if (/גמל\s*להשקעה|להשקעה/.test(s)) return 'gemel_inv';
    if (/לכל\s*ילד/.test(s)) return 'child';
    if (/ריסק|סיכון/.test(s)) return 'risk';
    if (/ביטוח\s*מנהלים|ביטוח\s*חיים|פוליס/.test(s)) return 'insurance';
    if (/פנסי|מקיפה|מקפת/.test(s)) return 'pension';
    if (/גמל|תגמולים/.test(s)) return 'gemel';
    return null;
  }

  function decode(buf) {
    var u = new Uint8Array(buf);
    if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(u);
    if (u[0] === 0xFE && u[1] === 0xFF) return new TextDecoder('utf-16be').decode(u);
    var head = ''; for (var i = 0; i < Math.min(200, u.length); i++) head += String.fromCharCode(u[i]);
    var m = /encoding=["']([\w\-]+)["']/i.exec(head), enc = m ? m[1].toLowerCase() : 'utf-8';
    if (enc === 'iso-8859-8-i') enc = 'iso-8859-8';
    try { return new TextDecoder(enc).decode(u); } catch (e) { return new TextDecoder('utf-8').decode(u); }
  }

  /* ---------- XML (ממשק אחזקות) ---------- */
  function balanceOf(acc) {
    // Sum PerutYitrot/TOTAL-CHISACHON-MTZBR for the latest valuation date (Yitrot/TAARICH-ERECH-TZVIROT).
    var byDate = {};
    all(acc, 'Yitrot').forEach(function (y) {
      var d = ymd(first(y, 'TAARICH-ERECH-TZVIROT')) || '0';
      all(y, 'TOTAL-CHISACHON-MTZBR').forEach(function (e) { var v = num(e.textContent); if (v !== null) byDate[d] = (byDate[d] || 0) + v; });
    });
    var ds = Object.keys(byDate).sort();
    if (ds.length) return { value: Math.round(byDate[ds[ds.length - 1]] * 100) / 100, date: ds[ds.length - 1] === '0' ? '' : ds[ds.length - 1] };
    var s = null; all(acc, 'TOTAL-CHISACHON-MTZBR').forEach(function (e) { var v = num(e.textContent); if (v !== null) s = (s || 0) + v; });
    return { value: s, date: '' };
  }
  function fees(acc) {
    // 1) PerutMasluleiHashkaa: SHEUR-DMEI-NIHUL-HISACHON (annual %, per account terms) and SHEUR-DMEI-NIHUL-HAFKADA (%).
    // 2) Fallback PerutHotzaot/HotzaotBafoalLehodeshDivoach: HAFKADA (%), TZVIRA = monthly % actually charged -> x12 for annual.
    var tracks = all(acc, 'PerutMasluleiHashkaa'), dep = null, bal = null, derived = false, names = [];
    tracks.forEach(function (tr) {
      var nm = first(tr, 'SHEM-MASLUL-HASHKAA'); if (nm && names.indexOf(nm) < 0) names.push(nm);
      if (dep === null) dep = num(first(tr, 'SHEUR-DMEI-NIHUL-HAFKADA'));
      if (bal === null) bal = num(first(tr, 'SHEUR-DMEI-NIHUL-HISACHON'));
    });
    var act = all(acc, 'HotzaotBafoalLehodeshDivoach')[0];
    if (act) {
      if (dep === null) dep = num(first(act, 'SHEUR-DMEI-NIHUL-HAFKADA'));
      if (bal === null) { var m = num(first(act, 'SHEUR-DMEI-NIHUL-TZVIRA')); if (m !== null) { bal = Math.round(m * 12 * 10000) / 10000; derived = true; } }
    }
    if (!names.length) { var n2 = first(acc, ['SHEM-MASLUL-HASHKAA']); if (n2) names.push(n2); }
    return { feeDep: dep, feeAcc: bal, feeAccDerived: derived, track: names.join(' + ') };
  }
  function parseXML(text, fileName) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw err('BAD_XML');
    var root = doc.documentElement, accounts = all(root, 'HeshbonOPolisa');
    if (ln(root) !== 'MIMSHAK' && !accounts.length) throw err('NOT_MASLAKA');
    var fileDate = ymd(first(root, 'TAARICH-BITZUA'));
    return accounts.map(function (acc, i) {
      var yeshut = ancestor(acc, 'YeshutYatzran') || root, mutzar = ancestor(acc, 'Mutzar') || acc;
      var provider = first(yeshut, 'SHEM-YATZRAN') || first(root, 'SHEM-SHOLEACH') || '';
      var netunei = child(mutzar, 'NetuneiMutzar') || mutzar, code = String(parseInt(first(netunei, 'SUG-MUTZAR'), 10) || '');
      var plan = first(acc, 'SHEM-TOCHNIT');
      var type = SUG[code] || typeFromText(plan) || 'unknown';
      var st = String(parseInt(first(acc, 'STATUS-POLISA-O-CHESHBON'), 10) || '');
      var b = balanceOf(acc), f = fees(acc);
      return {
        source: 'xml', file: fileName, provider: provider, providerId: first(yeshut, 'KOD-MEZAHE-YATZRAN'), type: type, typeCode: code, plan: plan,
        account: mask(first(acc, 'MISPAR-POLISA-O-HESHBON')), status: STATUS[st] || (st ? 'other' : ''), statusCode: st, active: st ? st === '1' : null,
        balance: b.value, balanceDate: b.date, updated: ymd(first(acc, 'TAARICH-NECHONUT')) || fileDate, joined: ymd(first(acc, 'TAARICH-HITZTARFUT-MUTZAR')),
        feeDep: f.feeDep, feeAcc: f.feeAcc, feeAccDerived: f.feeAccDerived, track: f.track
      };
    });
  }

  /* ---------- Excel ("פרטי המוצרים שלי") ---------- */
  var COLS = [
    ['provider', /שם\s*(ה)?(חברה|גוף|יצרן)|חברה\s*מנהלת/], ['plan', /שם\s*(ה)?(מוצר|תכנית|תוכנית|קופה|קרן)/], ['type', /סוג\s*(ה)?מוצר/],
    ['account', /מספר\s*(ה)?(פוליסה|חשבון)|מס['׳]?\s*פוליסה/], ['status', /סטטוס/],
    ['balance', /סך\s*(ה)?כל\s*(ה)?חיסכון|סה["״]?כ\s*(חיסכון|צביר|יתר)|יתרה\s*צבורה/],
    ['feeDep', /דמי\s*ניהול.*הפקד/], ['feeAcc', /דמי\s*ניהול.*(צבור|צביר|חיסכון|חסכון)/], ['track', /מסלול/], ['updated', /תאריך\s*נכונות|נכון\s*לתאריך/]
  ];
  function cellDate(v) { if (typeof v === 'number' && v > 20000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); } return ymd(v); }
  function parseWorkbook(wb, fileName) {
    var out = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
      var shown = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' });
      // find header row: first row (within 10) matching provider + balance
      for (var hr = 0; hr < Math.min(10, rows.length); hr++) {
        var map = {}, hdr = rows[hr].map(function (x) { return String(x || '').trim(); });
        COLS.forEach(function (c) { for (var j = 0; j < hdr.length; j++) if (map[c[0]] === undefined && c[1].test(hdr[j]) && !(c[0] === 'balance' && /צפוי|פרישה/.test(hdr[j]))) map[c[0]] = j; });
        if (map.provider === undefined || map.balance === undefined) continue;
        for (var r = hr + 1; r < rows.length; r++) {
          var row = rows[r]; if (!row || !row.some(function (x) { return String(x).trim(); })) continue;
          var g = function (k) { return map[k] === undefined ? '' : row[map[k]]; };
          // a percent-formatted cell holds a fraction (0.0025 shown as 0.25%): convert to percent
          var fee = function (k) { if (map[k] === undefined) return null; var raw = row[map[k]], txt = String((shown[r] || [])[map[k]] || ''); var v = num(raw); return v !== null && typeof raw === 'number' && /%/.test(txt) && v < 1 ? Math.round(v * 1e6) / 1e4 : v; };
          if (!String(g('provider')).trim()) continue;
          var plan = String(g('plan') || '').trim(), typeTxt = String(g('type') || '').trim(), st = String(g('status') || '').trim();
          out.push({
            source: 'excel', file: fileName, provider: String(g('provider')).trim(), providerId: '', type: typeFromText(typeTxt) || typeFromText(plan) || 'unknown', typeCode: '', plan: plan,
            account: mask(g('account')), status: /לא\s*פעיל|מוקפא|מסולק/.test(st) ? 'inactive' : /פעיל/.test(st) ? 'active' : '', statusCode: '', active: /לא\s*פעיל|מוקפא|מסולק/.test(st) ? false : /פעיל/.test(st) ? true : null,
            balance: num(g('balance')), balanceDate: cellDate(g('updated')), updated: cellDate(g('updated')), joined: '',
            feeDep: fee('feeDep'), feeAcc: fee('feeAcc'), feeAccDerived: false, track: String(g('track') || '').trim()
          });
        }
        break;
      }
    });
    if (!out.length) throw err('NOT_MASLAKA');
    return out;
  }

  /* ---------- lazy vendor loading ---------- */
  var loaded = {};
  function load(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!loaded[src]) loaded[src] = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = function () { window[globalName] ? res(window[globalName]) : rej(err('LIB')); }; s.onerror = function () { delete loaded[src]; rej(err('LIB')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function readExcel(buf, name) { return load('vendor/xlsx.full.min.js', 'XLSX').then(function (X) { return parseWorkbook(X.read(new Uint8Array(buf), { type: 'array', cellDates: false }), name); }); }

  function kindOf(name, buf) {
    var u = new Uint8Array(buf.slice(0, 8)), lower = String(name || '').toLowerCase();
    if (u[0] === 0x50 && u[1] === 0x4B) return /\.xlsx$/.test(lower) ? 'excel' : 'zip-or-xlsx';
    if (u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46) return 'pdf';
    if (u[0] === 0xD0 && u[1] === 0xCF) return 'excel';
    if (/\.pdf$/.test(lower)) return 'pdf';
    if (/\.(xls|xlsx|csv)$/.test(lower)) return 'excel';
    return 'xml';
  }
  // askPassword: function() -> Promise<string|null>
  function readZip(buf, name, askPassword) {
    return load('vendor/zip.min.js', 'zip').then(function (zip) {
      var reader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(buf)));
      return reader.getEntries().then(function (entries) {
        var files = entries.filter(function (e) { return !e.directory; });
        var names = files.map(function (e) { return e.filename.toLowerCase(); });
        if (names.some(function (n) { return /^xl\/|\[content_types\]\.xml$/.test(n); })) { reader.close(); return readExcel(buf, name); }
        var xmls = files.filter(function (e) { return /\.xml$/i.test(e.filename); });
        var excels = files.filter(function (e) { return /\.xlsx?$/i.test(e.filename); });
        var pick = xmls.length ? xmls : excels;
        if (!pick.length) { reader.close(); throw err(files.some(function (e) { return /\.pdf$/i.test(e.filename); }) ? 'PDF_ONLY' : 'NOT_MASLAKA'); }
        var encrypted = pick.some(function (e) { return e.encrypted; });
        function extract(pw, tries) {
          var opts = pw ? { password: pw } : {};
          return Promise.all(pick.map(function (e) { return e.getData(new zip.Uint8ArrayWriter(), opts).then(function (d) { return { name: e.filename, data: d }; }); }))
            .catch(function (e) {
              if (!/password|encrypt/i.test(String(e && e.message))) throw e;
              if (tries >= 3) throw err('BAD_PASSWORD');
              return askPassword(tries > 0).then(function (p) { if (!p) throw err('CANCELLED'); return extract(p, tries + 1); });
            });
        }
        var start = encrypted ? askPassword(false).then(function (p) { if (!p) throw err('CANCELLED'); return extract(p, 1); }) : extract(null, 0);
        return start.then(function (parts) {
          reader.close();
          var jobs = parts.map(function (p) { return /\.xml$/i.test(p.name) ? Promise.resolve(parseXML(decode(p.data.buffer), p.name.split('/').pop())) : readExcel(p.data.buffer, p.name.split('/').pop()); });
          return Promise.all(jobs.map(function (j) { return j.catch(function () { return []; }); })).then(function (lists) { var o = [].concat.apply([], lists); if (!o.length) throw err('NOT_MASLAKA'); return o; });
        });
      });
    });
  }
  function dedupe(list) {
    var seen = {}, out = [];
    list.forEach(function (p) { var k = [p.provider, p.type, p.account, p.plan].join('|'); if (p.account && seen[k]) return; seen[k] = 1; out.push(p); });
    return out;
  }
  // files: FileList/array of File. Returns Promise<{products, files, reportDate}>
  function readFiles(files, askPassword) {
    askPassword = askPassword || function () { return Promise.resolve(window.prompt('Password') || null); };
    var arr = Array.prototype.slice.call(files);
    var seq = Promise.resolve([]);
    arr.forEach(function (f) {
      seq = seq.then(function (acc) {
        return f.arrayBuffer().then(function (buf) {
          var k = kindOf(f.name, buf);
          if (k === 'pdf') throw err('PDF');
          if (k === 'excel') return readExcel(buf, f.name);
          if (k === 'zip-or-xlsx') return readZip(buf, f.name, askPassword);
          return parseXML(decode(buf), f.name);
        }).then(function (list) { return acc.concat(list); });
      });
    });
    return seq.then(function (list) {
      list = dedupe(list).map(function (p, i) { p.id = 'm' + i + '-' + Math.random().toString(36).slice(2, 7); return p; });
      var dates = list.map(function (p) { return p.updated || p.balanceDate; }).filter(Boolean).sort();
      return { products: list, files: arr.map(function (f) { return f.name; }), reportDate: dates.length ? dates[dates.length - 1] : '' };
    });
  }
  window.PortalMaslaka = { readFiles: readFiles, parseXML: parseXML, parseWorkbook: parseWorkbook, SUG: SUG, typeFromText: typeFromText };
})();
