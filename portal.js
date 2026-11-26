/* Balances portal: shared logic (storage, i18n, nav, FX/quotes, list editor, calculations, pages). No backend, no tracking. */
(function () {
  'use strict';
  var DATA_KEY = 'portal-data-v1', SETTINGS_KEY = 'portal-settings-v1', QUOTES_KEY = 'portal-quotes-v1', OPTIONS_KEY = 'options-calc-v5-private';
  var I18N = window.PORTAL_I18N;
  var CUR = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
  // Main nav. 'wealth' is a category hub with its own sub-pages (pension, hishtalmut, savings, portfolio, options).
  var NAV = [
    ['home', 'index.html', 'nav_home'], ['wealth', 'wealth.html', 'nav_wealth'], ['mortgage', 'mortgage.html', 'nav_mortgage'],
    ['loans', 'loans.html', 'nav_loans'], ['cards', 'cards.html', 'nav_cards'], ['budget', 'budget.html', 'nav_budget'], ['me', 'me.html', 'nav_me']
  ];
  var WEALTH_SUB = [['pension', 'pension.html', 'nav_pension'], ['hishtalmut', 'hishtalmut.html', 'nav_hishtalmut'], ['savings', 'savings.html', 'nav_savings'], ['portfolio', 'portfolio.html', 'nav_portfolio'], ['options', 'options.html', 'nav_options']];
  var MASLAKA_URL = 'https://auth.swiftness.co.il/login', MASLAKA_REG_URL = 'https://auth.swiftness.co.il/registration', MASLAKA_INFO_URL = 'https://www.swiftness.co.il/services/%d7%9e%d7%99%d7%93%d7%a2-%d7%a4%d7%a0%d7%a1%d7%99%d7%95%d7%a0%d7%99-%d7%9e%d7%9b%d7%9c-%d7%94%d7%92%d7%95%d7%a4%d7%99%d7%9d/';

  /* ---------- storage ---------- */
  function emptyData() {
    return {
      v: 1,
      savings: { cash: [], standing: [], portfolios: [] },
      pension: { funds: [] }, hishtalmut: { funds: [] }, mortgage: { tracks: [] }, cards: { cards: [] },
      home: { assets: [], loans: [], income: [], expenses: [], includeOptions: true, includeMortgagePmt: true, includeCards: true,
              goal: { amount: null, date: '', base: 'net', ret: 0 } },
      fx: { USD: null, EUR: null, GBP: null },
      maslaka: { products: [], files: [], reportDate: '', importedAt: '', include: true },
      journals: { bank: [], trades: [], cardTx: [], includeBank: true, includeTrades: true },
      // Bank of Israel average mortgage rates by track, Oct 2026 (TamInt010 as quoted by hosech.co.il, checked 26.11.2026). User-editable.
      insights: { boi: { t_prime: 4.18, t_fixed_unlinked: 4.81, t_var_unlinked: 4.53, t_var_linked: 3.35, t_fixed_linked: 3.33, t_other: null }, boiDate: '2026-10', refiFee: null, refiCost: null, consolidationRate: null },
      prefs: { peerOptIn: false, ageBand: '' },
      history: [] // [[YYYY-MM-DD, net worth ILS]] one point per day, for the home sparkline
    };
  }
  function merge(base, src) {
    if (!src || typeof src !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (!(k in src)) return;
      if (Array.isArray(base[k])) { if (Array.isArray(src[k])) base[k] = src[k]; }
      else if (base[k] && typeof base[k] === 'object') base[k] = merge(base[k], src[k]);
      else base[k] = src[k];
    });
    return base;
  }
  function readJSON(key) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function writeJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { return false; }
    try { window.dispatchEvent(new CustomEvent('portal-local-write', { detail: { key: key } })); } catch (e) {}
    return true;
  }
  var data = merge(emptyData(), readJSON(DATA_KEY));
  var settings = merge({ lang: 'he', currency: 'ILS' }, readJSON(SETTINGS_KEY));
  if (!I18N[settings.lang]) settings.lang = 'he';
  if (!CUR[settings.currency]) settings.currency = 'ILS';
  var quotes = readJSON(QUOTES_KEY) || {};
  var saveTimer = null;
  var frozen = false; // set by the cloud sync before it replaces local data and reloads
  function save() { if (frozen) return; clearTimeout(saveTimer); saveTimer = setTimeout(function () { if (!frozen) writeJSON(DATA_KEY, data); }, 150); }
  function saveNow() { if (frozen) return; clearTimeout(saveTimer); writeJSON(DATA_KEY, data); }
  window.addEventListener('pagehide', saveNow);
  function uid() { return Math.random().toString(36).slice(2, 10); }

  /* ---------- helpers ---------- */
  function t(k) { return (I18N[settings.lang] && I18N[settings.lang][k]) || I18N.he[k] || k; }
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function n(v) { var x = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : 0; }
  function nn(v) { var x = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(x) ? x : null; }
  function fmt(v, d) { return (Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function money(v, cur, d) {
    if (v === null || !Number.isFinite(v)) return '—';
    cur = cur || settings.currency;
    return (v < 0 ? '-' : '') + (CUR[cur] || '') + fmt(Math.abs(v), d === undefined ? 0 : d);
  }
  function disp(ils, d) { var r = fromILS(ils); return r === null ? t('missing_rate') : money(r, settings.currency, d); }
  function pct(v, d) { return Number.isFinite(v) ? fmt(v, d === undefined ? 1 : d) + '%' : '—'; }
  function toast(msg) {
    var el = $('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function parseDate(s) { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0); }
  function addYears(d, y) { var x = new Date(d); x.setFullYear(x.getFullYear() + y); return x; }
  function fmtDate(d) { return d ? d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() : '—'; }

  /* ---------- FX and quotes ---------- */
  var FX_SYM = { USD: 'ILS=X', EUR: 'EURILS=X', GBP: 'GBPILS=X' };
  var PENDING_KEY = 'portal-pending-tickers-v1';
  var CRYPTO_COINS = [
    { code: 'BTC', symbol: 'BTC-USD', gecko: 'bitcoin', binance: 'BTCUSDT', he: 'ביטקוין', en: 'Bitcoin', es: 'Bitcoin' },
    { code: 'ETH', symbol: 'ETH-USD', gecko: 'ethereum', binance: 'ETHUSDT', he: 'אתריום', en: 'Ethereum', es: 'Ethereum' },
    { code: 'SOL', symbol: 'SOL-USD', gecko: 'solana', binance: 'SOLUSDT', he: 'סולנה', en: 'Solana', es: 'Solana' },
    { code: 'XRP', symbol: 'XRP-USD', gecko: 'ripple', binance: 'XRPUSDT', he: 'ריפל', en: 'XRP', es: 'XRP' },
    { code: 'BNB', symbol: 'BNB-USD', gecko: 'binancecoin', binance: 'BNBUSDT', he: 'BNB', en: 'BNB', es: 'BNB' },
    { code: 'DOGE', symbol: 'DOGE-USD', gecko: 'dogecoin', binance: 'DOGEUSDT', he: 'דוג׳קוין', en: 'Dogecoin', es: 'Dogecoin' },
    { code: 'ADA', symbol: 'ADA-USD', gecko: 'cardano', binance: 'ADAUSDT', he: 'קרדנו', en: 'Cardano', es: 'Cardano' },
    { code: 'AVAX', symbol: 'AVAX-USD', gecko: 'avalanche-2', binance: 'AVAXUSDT', he: 'אוולאנש', en: 'Avalanche', es: 'Avalanche' },
    { code: 'DOT', symbol: 'DOT-USD', gecko: 'polkadot', binance: 'DOTUSDT', he: 'פולקאדוט', en: 'Polkadot', es: 'Polkadot' },
    { code: 'LINK', symbol: 'LINK-USD', gecko: 'chainlink', binance: 'LINKUSDT', he: 'צ׳ייןלינק', en: 'Chainlink', es: 'Chainlink' },
    { code: 'TON', symbol: 'TON-USD', gecko: 'the-open-network', binance: 'TONUSDT', he: 'טון', en: 'Toncoin', es: 'Toncoin' },
    { code: 'TRX', symbol: 'TRX-USD', gecko: 'tron', binance: 'TRXUSDT', he: 'טרון', en: 'TRON', es: 'TRON' },
    { code: 'LTC', symbol: 'LTC-USD', gecko: 'litecoin', binance: 'LTCUSDT', he: 'לייטקוין', en: 'Litecoin', es: 'Litecoin' },
    { code: 'BCH', symbol: 'BCH-USD', gecko: 'bitcoin-cash', binance: 'BCHUSDT', he: 'ביטקוין קאש', en: 'Bitcoin Cash', es: 'Bitcoin Cash' },
    { code: 'SHIB', symbol: 'SHIB-USD', gecko: 'shiba-inu', binance: 'SHIBUSDT', he: 'שיבה אינו', en: 'Shiba Inu', es: 'Shiba Inu' },
    { code: 'XLM', symbol: 'XLM-USD', gecko: 'stellar', binance: 'XLMUSDT', he: 'סטלר', en: 'Stellar', es: 'Stellar' },
    { code: 'NEAR', symbol: 'NEAR-USD', gecko: 'near', binance: 'NEARUSDT', he: 'ניר', en: 'NEAR', es: 'NEAR' },
    { code: 'APT', symbol: 'APT-USD', gecko: 'aptos', binance: 'APTUSDT', he: 'אפטוס', en: 'Aptos', es: 'Aptos' },
    { code: 'SUI', symbol: 'SUI-USD', gecko: 'sui', binance: 'SUIUSDT', he: 'סוי', en: 'Sui', es: 'Sui' },
    { code: 'UNI', symbol: 'UNI-USD', gecko: 'uniswap', binance: 'UNIUSDT', he: 'יוניסוואפ', en: 'Uniswap', es: 'Uniswap' },
    { code: 'ATOM', symbol: 'ATOM-USD', gecko: 'cosmos', binance: 'ATOMUSDT', he: 'קוסמוס', en: 'Cosmos', es: 'Cosmos' },
    { code: 'POL', symbol: 'POL-USD', gecko: 'polygon-ecosystem-token', binance: 'POLUSDT', he: 'פוליגון', en: 'Polygon', es: 'Polygon' },
    { code: 'MATIC', symbol: 'MATIC-USD', gecko: 'matic-network', binance: 'MATICUSDT', he: 'פוליגון (MATIC)', en: 'Polygon (MATIC)', es: 'Polygon (MATIC)' },
    { code: 'PEPE', symbol: 'PEPE-USD', gecko: 'pepe', binance: 'PEPEUSDT', he: 'פפה', en: 'Pepe', es: 'Pepe' }
  ];
  var taseSecurities = [];
  function priceProxyBase() { return String(window.PORTAL_PRICE_PROXY || '').replace(/\/+$/, ''); }
  function rateILS(cur) {
    if (cur === 'ILS' || !cur) return 1;
    var m = nn(data.fx[cur]); if (m && m > 0) return m;
    var q = quotes[FX_SYM[cur]]; return q && q.price > 0 ? q.price : null;
  }
  function toILS(v, cur) { var r = rateILS(cur); return r === null ? null : n(v) * r; }
  function fromILS(v) { if (v === null) return null; var r = rateILS(settings.currency); return r === null ? null : v / r; }
  function normQuote(sym, o, src) {
    var price = nn(o.price !== undefined ? o.price : o.regularMarketPrice), cur = o.currency || 'USD';
    if (!(price > 0)) return null;
    if (cur === 'ILA' || cur === 'ILX') { price = price / 100; cur = 'ILS'; }
    if (cur === 'GBp' || cur === 'GBX') { price = price / 100; cur = 'GBP'; }
    var tp = o.currentTradingPeriod && o.currentTradingPeriod.regular;
    var state = o.state || o.marketState || null;
    var now = Date.now() / 1000, live;
    if (state) live = /^(REGULAR|open)$/i.test(state);
    else if (tp) live = now >= tp.start && now <= tp.end;
    else live = false;
    var time = o.regularMarketTime || o.last_updated_at;
    if (typeof time === 'string') time = Date.parse(time) / 1000;
    return { price: price, currency: cur, time: Number.isFinite(time) ? time : null, live: !!live, source: src, fetchedAt: Date.now() };
  }
  function fetchJSON(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 20000);
    return fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(tm); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }, function (e) { clearTimeout(tm); throw e; });
  }
  function anyOf(ps) {
    return new Promise(function (res, rej) { var left = ps.length; if (!left) rej(new Error('none')); ps.forEach(function (p) { p.then(res, function () { if (--left === 0) rej(new Error('all failed')); }); }); });
  }
  function coinLangName(c) { return (settings.lang === 'he' ? c.he : settings.lang === 'es' ? c.es : c.en) || c.en || c.code; }
  function findCrypto(q) {
    if (!q) return null;
    var u = String(q).trim().toUpperCase().replace(/^CRYPTO:\s*/, '');
    var raw = String(q).trim();
    for (var i = 0; i < CRYPTO_COINS.length; i++) {
      var c = CRYPTO_COINS[i];
      if (c.code === u || c.symbol === u || c.gecko === raw.toLowerCase()) return c;
      if (c.he === raw || c.en.toLowerCase() === raw.toLowerCase() || (c.es && c.es.toLowerCase() === raw.toLowerCase())) return c;
    }
    return null;
  }
  function foldSearch(s) {
    s = String(s || '').toLowerCase();
    s = s.replace(/[״""׳'']/g, '"');
    s = s.replace(/נאסד"?ק|נסדק/g, 'nasdaq');
    s = s.replace(/s\s*&\s*p/g, 'sp');
    s = s.replace(/ת["\"]א/g, 'ta');
    s = s.replace(/([א-ת])([a-z0-9])/gi, '$1 $2');
    s = s.replace(/([a-z0-9])([א-ת])/gi, '$1 $2');
    s = s.replace(/[^\u0590-\u05ffa-z0-9]+/gi, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  function searchTokens(s) {
    return foldSearch(s).split(' ').filter(Boolean);
  }
  function taseHaystack(r) {
    return foldSearch([r.id, r.he, r.en, r.ticker, r.symbol, r.manager].filter(Boolean).join(' '));
  }
  function tokenMatches(tok, hay, hayTokens, id) {
    if (/^\d+$/.test(tok)) {
      if (id && String(id).indexOf(tok) === 0) return true;
      return hayTokens.indexOf(tok) >= 0;
    }
    if (hayTokens.some(function (ht) { return ht === tok || (tok.length >= 2 && ht.indexOf(tok) === 0); })) return true;
    return hay.indexOf(tok) >= 0;
  }
  function findTase(q) {
    if (!q || !taseSecurities.length) return null;
    var raw = String(q).trim(), u = raw.toUpperCase(), digits = raw.replace(/\s+/g, '');
    var i, r, exact = [];
    for (i = 0; i < taseSecurities.length; i++) {
      r = taseSecurities[i];
      if (r.id && (r.id === digits || ('0' + r.id) === digits)) exact.push(r);
      else if (r.ticker && r.ticker.toUpperCase() === u) exact.push(r);
      else if (r.symbol && r.symbol.toUpperCase() === u) exact.push(r);
    }
    if (exact.length) {
      for (i = 0; i < exact.length; i++) if (exact[i].symbol) return exact[i];
      return exact[0];
    }
    var folded = foldSearch(raw);
    var nameHits = searchTase(raw, 8).filter(function (x) {
      return foldSearch(x.he || '') === folded || foldSearch(x.en || '') === folded;
    });
    if (nameHits.length === 1) return nameHits[0];
    var hits = searchTase(raw, 4);
    if (hits.length === 1) return hits[0];
    return null;
  }
  function searchTase(q, limit) {
    var tokens = searchTokens(q); if (!tokens.length) return [];
    var raw = String(q || '').trim();
    var out = [], scored = [];
    taseSecurities.forEach(function (r) {
      if (!r) return;
      var id = r.id || '', hay = taseHaystack(r), hayTokens = hay ? hay.split(' ') : [];
      if (!tokens.every(function (tok) { return tokenMatches(tok, hay, hayTokens, id); })) return;
      var score = 0;
      if (id && id === raw) score = 100;
      else if (id && /^\d+$/.test(raw) && id.indexOf(raw) === 0) score = 95;
      else if (foldSearch(r.he || '') === foldSearch(raw) || foldSearch(r.en || '') === foldSearch(raw)) score = 90;
      else {
        score = 50;
        tokens.forEach(function (tok) {
          if (id && id.indexOf(tok) === 0) score += 20;
          else if (hayTokens.indexOf(tok) === 0) score += 12;
          else if (hayTokens.indexOf(tok) >= 0) score += 8;
          else score += 3;
        });
        if ((r.type === 'fund' || r.type === 'etf') && tokens.length > 1) score += 5;
      }
      scored.push({ score: score, row: r, hasSym: !!r.symbol, len: (r.he || r.en || '').length });
    });
    scored.sort(function (a, b) { return b.score - a.score || a.len - b.len || (b.hasSym ? 1 : 0) - (a.hasSym ? 1 : 0); });
    for (var i = 0; i < scored.length && out.length < (limit || 8); i++) out.push(scored[i].row);
    return out;
  }
  function searchCrypto(q, limit) {
    var raw = String(q || '').trim(); if (!raw) return CRYPTO_COINS.slice(0, limit || 8);
    var u = raw.toUpperCase(), out = [];
    CRYPTO_COINS.forEach(function (c) {
      if (c.code.indexOf(u) === 0 || c.symbol.indexOf(u) === 0 || (c.en && c.en.toLowerCase().indexOf(raw.toLowerCase()) >= 0) || (c.he && c.he.indexOf(raw) >= 0) || (c.es && c.es.toLowerCase().indexOf(raw.toLowerCase()) >= 0)) out.push(c);
    });
    return out.slice(0, limit || 8);
  }
  function resolveHolding(row) {
    var raw = ((row && row.ticker) || '').trim(), kind = (row && row.kind) || 'auto';
    var coin = findCrypto(raw);
    if (kind === 'crypto' || (kind === 'auto' && coin)) {
      if (!coin && raw) {
        var code = raw.toUpperCase().replace(/-USD$/, '').replace(/^CRYPTO:\s*/, '');
        if (/^[A-Z0-9]{2,10}$/.test(code)) coin = { code: code, symbol: code + '-USD', gecko: null, binance: code + 'USDT', he: code, en: code, es: code };
      }
      if (coin) return { symbol: coin.symbol, kind: 'crypto', name: coinLangName(coin), coin: coin, currency: 'USD' };
    }
    var ts = findTase(raw);
    if (ts) {
      var sym = ts.symbol || ts.id || raw.toUpperCase();
      var alts = [];
      if (ts.id && ts.id !== sym) alts.push(ts.id);
      if (ts.id) alts.push(ts.id + '.TA');
      if (ts.symbol && ts.symbol !== sym) alts.push(ts.symbol);
      return { symbol: sym, altSymbols: alts, kind: ts.type || 'stock', name: ts.he || ts.en || ts.symbol, securityNo: ts.id, currency: 'ILS', tase: ts };
    }
    if (/^\d{4,9}$/.test(raw)) {
      return { symbol: raw, altSymbols: [raw + '.TA'], kind: kind === 'fund' ? 'fund' : (kind === 'auto' ? 'fund' : kind), securityNo: raw, currency: 'ILS' };
    }
    var sym = raw.toUpperCase();
    if (kind === 'fund') return { symbol: sym, kind: 'fund', currency: /\.TA$/.test(sym) ? 'ILS' : null };
    return { symbol: sym, kind: kind === 'auto' ? 'stock' : kind, currency: /\.TA$/.test(sym) ? 'ILS' : (/-USD$/.test(sym) ? 'USD' : null) };
  }
  function fromPricesJson(symbols) {
    return fetchJSON('prices.json?t=' + Date.now(), 8000).then(function (j) {
      var table = j.symbols || j.quotes || j.prices || j;
      var out = {};
      symbols.forEach(function (s) {
        var o = table[s] || table[s.toUpperCase()];
        if (o && typeof o === 'object') {
          var q = normQuote(s, o, 'prices.json');
          if (q) { if (!o.regularMarketTime && j.generatedAt) q.time = Date.parse(j.generatedAt) / 1000; out[s] = q; }
        }
      });
      return out;
    });
  }
  function fromCrypto(symbols) {
    var wanted = [];
    symbols.forEach(function (s) {
      var c = findCrypto(s) || (/^[A-Z0-9]{2,10}-USD$/.test(s) ? { symbol: s, gecko: null, binance: s.replace(/-USD$/, '') + 'USDT', code: s.replace(/-USD$/, '') } : null);
      if (c) wanted.push(c);
    });
    if (!wanted.length) return Promise.reject(new Error('no crypto'));
    var byGecko = {};
    wanted.forEach(function (c) { if (c.gecko) byGecko[c.gecko] = c; });
    var ids = Object.keys(byGecko);
    var gecko = ids.length
      ? fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=' + ids.map(encodeURIComponent).join(',') + '&vs_currencies=usd&include_last_updated_at=true', 8000).then(function (j) {
          var out = {};
          ids.forEach(function (id) {
            var row = j[id], c = byGecko[id];
            if (row && row.usd > 0) out[c.symbol] = normQuote(c.symbol, { price: row.usd, currency: 'USD', regularMarketTime: row.last_updated_at, state: 'REGULAR' }, 'CoinGecko');
          });
          if (!Object.keys(out).length) throw new Error('empty');
          return out;
        })
      : Promise.reject(new Error('no gecko ids'));
    function binanceOne(c) {
      if (!c.binance) return Promise.reject(new Error('no binance'));
      return fetchJSON('https://api.binance.com/api/v3/ticker/price?symbol=' + encodeURIComponent(c.binance), 6000).then(function (j) {
        var px = parseFloat(j && j.price);
        if (!(px > 0)) throw new Error('empty');
        var out = {}; out[c.symbol] = normQuote(c.symbol, { price: px, currency: 'USD', regularMarketTime: Date.now() / 1000, state: 'REGULAR' }, 'Binance');
        return out;
      });
    }
    function coinbaseOne(c) {
      var pair = c.code ? c.code + '-USD' : c.symbol;
      return fetchJSON('https://api.coinbase.com/v2/prices/' + encodeURIComponent(pair) + '/spot', 6000).then(function (j) {
        var px = parseFloat(j && j.data && j.data.amount);
        if (!(px > 0)) throw new Error('empty');
        var out = {}; out[c.symbol] = normQuote(c.symbol, { price: px, currency: 'USD', regularMarketTime: Date.now() / 1000, state: 'REGULAR' }, 'Coinbase');
        return out;
      });
    }
    return gecko.catch(function () { return {}; }).then(function (found) {
      var missing = wanted.filter(function (c) { return !found[c.symbol]; });
      if (!missing.length) return found;
      return Promise.all(missing.map(function (c) {
        return binanceOne(c).catch(function () { return coinbaseOne(c); }).catch(function () { return {}; });
      })).then(function (parts) {
        parts.forEach(function (p) { Object.keys(p).forEach(function (k) { found[k] = p[k]; }); });
        if (!Object.keys(found).length) throw new Error('empty');
        return found;
      });
    });
  }
  function fromFx(symbols) {
    var need = symbols.filter(function (s) { return s === 'ILS=X' || s === 'EURILS=X' || s === 'GBPILS=X'; });
    if (!need.length) return Promise.reject(new Error('no fx'));
    var routes = [
      need.indexOf('ILS=X') >= 0 ? fetchJSON('https://api.frankfurter.dev/v1/latest?from=USD&to=ILS', 6000).then(function (j) {
        var px = j && j.rates && j.rates.ILS, out = {};
        if (!(px > 0)) throw new Error('empty');
        out['ILS=X'] = normQuote('ILS=X', { price: px, currency: 'ILS', regularMarketTime: j.date ? Date.parse(j.date + 'T00:00:00Z') / 1000 : null }, 'Frankfurter');
        return out;
      }) : Promise.reject(),
      need.indexOf('EURILS=X') >= 0 ? fetchJSON('https://api.frankfurter.dev/v1/latest?from=EUR&to=ILS', 6000).then(function (j) {
        var px = j && j.rates && j.rates.ILS, out = {};
        if (!(px > 0)) throw new Error('empty');
        out['EURILS=X'] = normQuote('EURILS=X', { price: px, currency: 'ILS', regularMarketTime: j.date ? Date.parse(j.date + 'T00:00:00Z') / 1000 : null }, 'Frankfurter');
        return out;
      }) : Promise.reject(),
      need.indexOf('GBPILS=X') >= 0 ? fetchJSON('https://api.frankfurter.dev/v1/latest?from=GBP&to=ILS', 6000).then(function (j) {
        var px = j && j.rates && j.rates.ILS, out = {};
        if (!(px > 0)) throw new Error('empty');
        out['GBPILS=X'] = normQuote('GBPILS=X', { price: px, currency: 'ILS', regularMarketTime: j.date ? Date.parse(j.date + 'T00:00:00Z') / 1000 : null }, 'Frankfurter');
        return out;
      }) : Promise.reject()
    ];
    return Promise.all(routes.map(function (p) { return p.catch(function () { return {}; }); })).then(function (parts) {
      var out = {};
      parts.forEach(function (p) { Object.keys(p).forEach(function (k) { out[k] = p[k]; }); });
      if (!Object.keys(out).length) throw new Error('empty');
      return out;
    });
  }
  function fromProxy(symbols) {
    var base = priceProxyBase();
    if (!base || !symbols.length) return Promise.reject(new Error('no proxy'));
    return fetchJSON(base + '/quote?symbols=' + symbols.map(encodeURIComponent).join(','), 12000).then(function (j) {
      var table = (j && j.quotes) || j || {}, out = {};
      symbols.forEach(function (s) {
        var o = table[s] || table[s.toUpperCase()];
        if (o && typeof o === 'object') { var q = normQuote(s, o, 'Yahoo'); if (q) out[s] = q; }
      });
      if (!Object.keys(out).length) throw new Error('empty');
      return out;
    });
  }
  var taseReady = fetchJSON('tase_securities.json?t=' + Date.now(), 8000).then(function (j) {
    taseSecurities = j.securities || (Array.isArray(j) ? j : []);
    return taseSecurities;
  }).catch(function () { taseSecurities = taseSecurities || []; return taseSecurities; });
  function pendingList() { return readJSON(PENDING_KEY) || []; }
  function queuePending(syms) {
    var cur = pendingList();
    (syms || []).forEach(function (s) { if (s && cur.indexOf(s) < 0) cur.push(s); });
    writeJSON(PENDING_KEY, cur);
  }
  function clearPending(syms) {
    var drop = {};
    (syms || []).forEach(function (s) { drop[s] = true; });
    writeJSON(PENDING_KEY, pendingList().filter(function (s) { return !drop[s]; }));
  }
  var fetching = false;
  function collectHoldingSymbols(extra) {
    var syms = ['ILS=X', 'EURILS=X', 'GBPILS=X'];
    try { var oc = readJSON(OPTIONS_KEY); if (oc && oc.data) Object.keys(oc.data).forEach(function (k) { if (k && k !== '__none' && syms.indexOf(k) < 0) syms.push(k); }); } catch (e) {}
    data.savings.portfolios.forEach(function (p) {
      (p.rows || []).forEach(function (r) {
        var res = resolveHolding(r);
        [res && res.symbol].concat((res && res.altSymbols) || []).forEach(function (s) {
          if (s && syms.indexOf(s) < 0) syms.push(s);
        });
      });
    });
    if (data.journals && data.journals.trades) {
      data.journals.trades.forEach(function (r) {
        var res = resolveHolding(r);
        [res && res.symbol].concat((res && res.altSymbols) || []).forEach(function (s) {
          if (s && typeof s === 'string' && syms.indexOf(s) < 0) syms.push(s);
        });
      });
    }
    (extra || []).forEach(function (s) { if (s && syms.indexOf(s) < 0) syms.push(s); });
    return syms;
  }
  function refreshQuotes(extra, silent) {
    fetching = true; emit('quotes');
    function apply(found) { Object.keys(found || {}).forEach(function (s) { quotes[s] = found[s]; }); writeJSON(QUOTES_KEY, quotes); }
    function mergeFill(found, missing) {
      apply(found);
      return missing.filter(function (s) { return !quotes[s] || !(quotes[s].price > 0); });
    }
    return taseReady.then(function () {
      var syms = collectHoldingSymbols(extra);
      return fromPricesJson(syms).catch(function () { return {}; }).then(function (found) {
        var missing = mergeFill(found, syms);
        if (!missing.length) return true;
        var chain = Promise.resolve(missing);
        function next(fn) {
          return function (left) {
            if (!left.length) return left;
            return fn(left).then(function (f) { return mergeFill(f, left); }, function () { return left; });
          };
        }
        return chain
          .then(next(fromCrypto))
          .then(next(fromFx))
          .then(next(fromProxy))
          .then(function (left) {
            if (left.length) queuePending(left);
            var got = syms.filter(function (s) { return quotes[s] && quotes[s].price > 0; });
            if (got.length) clearPending(got);
            return got.length > 0 || missing.length < syms.length;
          });
      });
    }).then(function (ok) {
      fetching = false; emit('quotes');
      if (!ok && !silent) toast(t('fetch_fail'));
      return ok;
    }).catch(function () {
      fetching = false; emit('quotes');
      if (!silent) toast(t('fetch_fail'));
      return false;
    });
  }
  var refreshedMissing = false;
  function quotesStale() {
    if (!quotes['ILS=X'] || Date.now() - (quotes['ILS=X'].fetchedAt || 0) > 10 * 60 * 1000) return true;
    if (refreshedMissing) return false; // a holding without any quote yet: fetch once per page load
    var miss = collectHoldingSymbols(null).some(function (s) { return !/=X$/.test(s) && !/\.TA$/.test(s) && !quotes[s] && !quotes[s + '.TA']; });
    if (miss) refreshedMissing = true;
    return miss;
  }
  function quoteLabel(q) {
    if (!q) return '';
    var time = q.time ? new Date(q.time * 1000).toLocaleString(settings.lang === 'he' ? 'he-IL' : settings.lang === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return (q.live ? t('live') : t('last_close')) + (time ? ' · ' + t('updated_on') + time : '');
  }
  function priceDecimals(px) { return px >= 100 ? 2 : px >= 1 ? 4 : px >= 0.01 ? 6 : 8; }

  /* ---------- events ---------- */
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev) { (listeners[ev] || []).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  function changed() { save(); emit('change'); }

  /* ---------- calculations ---------- */
  var calc = {
    fv: function (pv, pmt, r, nper) { if (nper <= 0) return pv; if (r === 0) return pv + pmt * nper; var g = Math.pow(1 + r, nper); return pv * g + pmt * (g - 1) / r; },
    standing: function (row) {
      var M = n(row.monthly), r = n(row.ret) / 1200, S = parseDate(row.start), T = today(), G = parseDate(row.target);
      var n0 = S && S <= T ? monthsBetween(S, T) + 1 : 0;
      var nG = S && G && S <= G ? monthsBetween(S, G) + 1 : null;
      return { invested: M * n0, valueToday: calc.fv(0, M, r, n0), investedTarget: nG === null ? null : M * nG, projected: nG === null ? null : calc.fv(0, M, r, nG) };
    },
    fund: function (row, kind) {
      var B = n(row.balance), D = n(row.deposit) * (1 - n(row.feeDep) / 100), r = (n(row.ret) - n(row.feeBal)) / 1200, months = null;
      if (kind === 'pension' && nn(row.age) !== null && nn(row.retireAge) !== null) months = Math.max(0, Math.round((n(row.retireAge) - n(row.age)) * 12));
      else { var G = parseDate(row.target); if (G) months = Math.max(0, monthsBetween(today(), G)); }
      var liquidFrom = null, liquid = null;
      if (kind === 'hishtalmut') { var O = parseDate(row.openDate); if (O) { liquidFrom = addYears(O, 6); liquid = today() >= liquidFrom; } }
      return { months: months, depositNet: D, projected: months === null ? null : calc.fv(B, D, r, months), liquidFrom: liquidFrom, liquid: liquid };
    },
    mortgage: function (row) {
      var P = n(row.balance), r = n(row.rate) / 1200, N = Math.round(n(row.months));
      if (!(P > 0) || !(N > 0)) return { pmt: 0, interest: 0 };
      var pmt = r ? P * r / (1 - Math.pow(1 + r, -N)) : P / N;
      return { pmt: pmt, interest: pmt * N - P };
    },
    portfolioRow: function (row) {
      var res = resolveHolding(row), sym = res.symbol, q = (sym && quotes[sym]) || null, cur = row.currency || res.currency || 'ILS', price = null, src = null, warn = null, ai;
      if (!q && res.altSymbols) {
        for (ai = 0; ai < res.altSymbols.length; ai++) { if (quotes[res.altSymbols[ai]] && quotes[res.altSymbols[ai]].price > 0) { q = quotes[res.altSymbols[ai]]; break; } }
      }
      if (!q) q = quotes[((row.ticker || '').trim().toUpperCase())];
      if (res.kind === 'crypto' && !row.currency) cur = 'USD';
      if (q && q.price > 0) {
        if (q.currency === cur) price = q.price;
        else { var a = toILS(q.price, q.currency), b = rateILS(cur); price = (a !== null && b) ? a / b : null; warn = q.currency; }
        src = q;
      }
      if (price === null && nn(row.manual) !== null && n(row.manual) > 0) { price = n(row.manual); src = null; } // live / daily NAV wins; manual price is only a fallback
      var qty = n(row.qty), value = price === null ? null : qty * price, cost = qty * n(row.entry);
      var valueILS = value === null ? null : toILS(value, cur), costILS = toILS(cost, cur);
      var pl = valueILS === null || costILS === null ? null : valueILS - costILS;
      return { price: price, quote: src, manual: price !== null && !src, value: value, cost: cost, valueILS: valueILS, costILS: costILS, pl: pl, plPct: pl !== null && costILS ? pl / costILS * 100 : null, convertedFrom: warn, pending: price === null, resolved: res, needsManual: res.kind === 'fund' && price === null };
    },
    portfolio: function (p) {
      var v = 0, c = 0, missing = 0;
      p.rows.forEach(function (r) { var x = calc.portfolioRow(r); if (x.valueILS === null) missing++; else v += x.valueILS; if (x.costILS !== null) c += x.costILS; });
      return { valueILS: v, costILS: c, pl: v - c, plPct: c ? (v - c) / c * 100 : null, missing: missing };
    },
    options: function () {
      var o = readJSON(OPTIONS_KEY); if (!o || !o.data) return null;
      var items = [];
      Object.keys(o.data).forEach(function (sym) {
        var d = o.data[sym]; if (!d) return;
        var q = n(d.t1) + n(d.t2) + n(d.t3); if (!(q > 0) || nn(d.strike) === null) return;
        var sell = n(d.sell) > 0 ? n(d.sell) : (quotes[sym] && quotes[sym].price > 0 ? quotes[sym].price : null);
        if (sell === null) { items.push({ symbol: sym, qty: q, net: null, currency: /\.TA$/i.test(sym) ? 'ILS' : 'USD', netILS: null, pending: true }); return; }
        var eff = Math.max(0, n(d.strike) - n(d.div) * n(d.years)), gross = q * Math.max(0, sell - eff), net = gross * (1 - n(d.tax) / 100);
        var cur = /\.TA$/i.test(sym) ? 'ILS' : 'USD';
        items.push({ symbol: sym, qty: q, net: net, currency: cur, netILS: toILS(net, cur) });
      });
      return items;
    },
    // Pension clearinghouse products, filtered by page
    maslaka: function (kind) {
      return data.maslaka.products.filter(function (p) { return kind === 'hishtalmut' ? p.type === 'hishtalmut' : p.type !== 'hishtalmut'; });
    },
    // Bank journal: latest 'balance' entry per account plus transactions dated after it.
    bankAccounts: function () {
      var acc = {};
      data.journals.bank.slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); }).forEach(function (r) {
        var k = (r.account || '—').trim(); var a = acc[k] = acc[k] || { account: k, balance: 0, currency: r.currency || 'ILS', lastDate: '', txCount: 0, hasBalance: false, balDate: '' };
        if (r.kind === 'balance') { a.balance = n(r.amount); a.hasBalance = true; a.balDate = r.date || ''; }
        else { a.txCount++; if (!a.hasBalance || String(r.date || '') > a.balDate) a.balance += n(r.amount); }
        if (r.currency) a.currency = r.currency; if (r.date) a.lastDate = r.date;
      });
      return Object.keys(acc).map(function (k) { return acc[k]; });
    },
    // Trades journal: moving-average cost per ticker, realized P/L on sells; valued with live quote or last trade price.
    positions: function () {
      var pos = {};
      data.journals.trades.slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); }).forEach(function (r) {
        var sym = (r.ticker || '').trim().toUpperCase(); if (!sym) return;
        var p = pos[sym] = pos[sym] || { symbol: sym, qty: 0, cost: 0, realized: 0, fees: 0, currency: r.currency || 'ILS', lastPrice: null, trades: 0 };
        var q = n(r.qty), pr = n(r.price), fee = n(r.fee); p.trades++; p.fees += fee; if (pr > 0) p.lastPrice = pr; if (r.currency) p.currency = r.currency;
        if (r.side === 'sell') { var avg = p.qty > 0 ? p.cost / p.qty : 0, sq = Math.min(q, p.qty); p.realized += sq * (pr - avg) - fee; p.cost -= sq * avg; p.qty -= sq; }
        else { p.qty += q; p.cost += q * pr + fee; }
      });
      return Object.keys(pos).map(function (k) {
        var p = pos[k], q = quotes[k], price = null, live = null;
        if (q && q.price > 0) { var a = toILS(q.price, q.currency), b = rateILS(p.currency); price = a !== null && b ? a / b : null; live = q; }
        if (price === null) price = p.lastPrice;
        p.price = price; p.quote = live; p.value = price === null ? null : p.qty * price;
        p.valueILS = p.value === null ? null : toILS(p.value, p.currency); p.costILS = toILS(p.cost, p.currency);
        p.pl = p.valueILS === null || p.costILS === null ? null : p.valueILS - p.costILS;
        return p;
      });
    },
    summary: function () {
      var c = {}, liquid = 0, locked = 0, illiquid = 0, missing = 0;
      function add(k, v, bucket) { if (v === null) { missing++; return; } c[k] = (c[k] || 0) + v; if (bucket === 'liquid') liquid += v; else if (bucket === 'locked') locked += v; else if (bucket === 'illiquid') illiquid += v; }
      data.savings.portfolios.forEach(function (p) { var x = calc.portfolio(p); add('cat_portfolio', x.valueILS, 'liquid'); missing += x.missing; });
      data.savings.cash.forEach(function (r) { add('cat_cash', toILS(r.balance, r.currency), 'liquid'); });
      data.savings.standing.forEach(function (r) { if (r.include !== false) add('cat_standing', calc.standing(r).valueToday, 'liquid'); });
      data.pension.funds.forEach(function (r) { add('cat_pension', n(r.balance), 'locked'); });
      data.hishtalmut.funds.forEach(function (r) { var f = calc.fund(r, 'hishtalmut'); add('cat_hish', n(r.balance), f.liquid ? 'liquid' : 'locked'); });
      if (data.maslaka.include !== false) data.maslaka.products.forEach(function (p) {
        if (!(n(p.balance) > 0)) return;
        if (p.type === 'hishtalmut') add('cat_hish', n(p.balance), 'locked');
        else if (p.type === 'gemel_inv') add('cat_pension', n(p.balance), 'liquid');
        else add('cat_pension', n(p.balance), 'locked');
      });
      if (data.journals.includeBank !== false) calc.bankAccounts().forEach(function (a) { add('cat_bank', toILS(a.balance, a.currency), 'liquid'); });
      if (data.journals.includeTrades !== false) calc.positions().forEach(function (p) { if (p.qty > 0) add('cat_trades', p.valueILS, 'liquid'); });
      var opts = calc.options();
      if (data.home.includeOptions && opts) opts.forEach(function (o) { add('cat_options', o.netILS, 'illiquid'); });
      data.home.assets.forEach(function (r) { add('cat_other', toILS(r.value, r.currency), r.liquid ? 'liquid' : 'illiquid'); });
      var assets = 0; Object.keys(c).forEach(function (k) { assets += c[k]; });
      var liab = {};
      liab.cat_mortgage = data.mortgage.tracks.reduce(function (s, r) { return s + n(r.balance); }, 0);
      liab.cat_cards = data.home.includeCards ? data.cards.cards.reduce(function (s, r) { return s + n(r.charge); }, 0) : 0;
      liab.cat_loans = data.home.loans.reduce(function (s, r) { return s + n(r.balance); }, 0);
      var liabs = liab.cat_mortgage + liab.cat_cards + liab.cat_loans;
      var income = data.home.income.reduce(function (s, r) { return s + n(r.amount); }, 0);
      var mPmt = data.mortgage.tracks.reduce(function (s, r) { return s + calc.mortgage(r).pmt; }, 0);
      var loanPmt = data.home.loans.reduce(function (s, r) { return s + (nn(r.payment) !== null ? n(r.payment) : calc.mortgage(r).pmt); }, 0);
      var expenses = data.home.expenses.reduce(function (s, r) { return s + n(r.amount); }, 0) + (data.home.includeMortgagePmt ? mPmt : 0);
      var surplus = income - expenses;
      return { cats: c, liab: liab, assets: assets, liabs: liabs, net: assets - liabs, liquid: liquid, locked: locked, illiquid: illiquid,
               income: income, expenses: expenses, mortgagePmt: mPmt, loanPmt: loanPmt, surplus: surplus, savingsRate: income > 0 ? surplus / income * 100 : null, missing: missing, options: opts };
    },
    goal: function (s) {
      var g = data.home.goal, G = nn(g.amount), D = parseDate(g.date);
      if (G === null || !D) return null;
      var base = g.base === 'liquid' ? s.liquid : s.net, months = Math.max(0, monthsBetween(today(), D)), r = n(g.ret) / 1200;
      if (base >= G) return { reached: true, required: 0, months: months };
      if (months <= 0) return { reached: false, required: G - base, months: 0 };
      var grow = Math.pow(1 + r, months);
      var req = r ? (G - base * grow) * r / (grow - 1) : (G - base) / months;
      return { reached: false, required: Math.max(0, req), months: months, gap: Math.max(0, req) - s.surplus };
    }
  };

  /* ---------- list editor ---------- */
  function opts(list) { return list.map(function (k) { return [k, t(k)]; }); }
  function applySecurityChoice(row, item, onInput) {
    if (item.kind === 'crypto' || item.coin) {
      var c = item.coin || item;
      row.ticker = c.symbol;
      row.kind = 'crypto';
      row.currency = 'USD';
      row.securityNo = null;
    } else {
      var r = item.tase || item;
      row.ticker = r.symbol || r.id || row.ticker;
      row.kind = r.type || item.kind || 'stock';
      if (r.id) row.securityNo = r.id;
      if (row.kind === 'crypto') row.currency = 'USD';
      else if (/\.TA$/i.test(String(row.ticker || '')) || /^\d{4,9}$/.test(String(row.ticker || '')) || row.kind === 'fund') row.currency = row.currency && row.currency !== 'USD' ? row.currency : 'ILS';
    }
    onInput();
    refreshQuotes([row.ticker].concat(row.securityNo ? [row.securityNo, row.securityNo + '.TA'] : []), true);
  }
  function securityField(row, f, onInput) {
    var id = 'f-' + uid();
    var input = h('input', { id: id, type: 'text', autocomplete: 'off', 'aria-autocomplete': 'list', 'data-k': f.k, placeholder: f.ph || t('security_ph') });
    input.value = row[f.k] === undefined || row[f.k] === null ? '' : row[f.k];
    input.style.direction = 'ltr';
    var list = h('div', { class: 'ac-list hidden', role: 'listbox' });
    var wrap = h('div', { class: 'ac-wrap field' }, [h('label', { for: id, text: t(f.label) }), input, list]);
    var blurTimer = null;
    function hide() { list.classList.add('hidden'); list.innerHTML = ''; }
    function showItems(items) {
      list.innerHTML = '';
      if (!items.length) { hide(); return; }
      items.forEach(function (it) {
        var title, meta, apply;
        if (it.coin || it.code) {
          var c = it.coin || it;
          title = coinLangName(c) + ' (' + c.code + ')';
          meta = c.symbol;
          apply = function () { applySecurityChoice(row, { kind: 'crypto', coin: c }, function () { input.value = row.ticker; onInput(); }); hide(); };
        } else {
          var r = it.tase || it;
          title = r.he || r.en || r.symbol || r.id;
          meta = [r.id, r.symbol || r.ticker, r.type ? t('hk_' + r.type) : ''].filter(Boolean).join(' · ');
          apply = function () { applySecurityChoice(row, { tase: r, kind: r.type }, function () { input.value = row.ticker; onInput(); }); hide(); };
        }
        var btn = h('button', { type: 'button', class: 'ac-item', role: 'option' }, [
          h('span', { class: 'ac-title', text: title }),
          meta ? h('span', { class: 'ac-meta', text: meta }) : null
        ]);
        btn.addEventListener('mousedown', function (e) { e.preventDefault(); apply(); });
        list.appendChild(btn);
      });
      list.classList.remove('hidden');
    }
    function suggest(q) {
      var kind = row.kind || 'auto';
      var items = [];
      if (kind === 'crypto' || kind === 'auto') {
        searchCrypto(q, kind === 'crypto' ? 24 : 6).forEach(function (c) { items.push({ coin: c }); });
      }
      if (kind !== 'crypto') {
        searchTase(q, 8).forEach(function (r) { items.push({ tase: r }); });
      }
      showItems(items);
    }
    input.addEventListener('input', function () {
      row[f.k] = input.value;
      onInput();
      suggest(input.value);
    });
    input.addEventListener('focus', function () { suggest(input.value); });
    input.addEventListener('blur', function () {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(function () {
        hide();
        var raw = input.value.trim();
        if (!raw) return;
        var res = resolveHolding(row);
        if (res && res.symbol) {
          row.ticker = res.symbol;
          if (res.kind) row.kind = res.kind;
          if (res.securityNo) row.securityNo = res.securityNo;
          if (res.kind === 'crypto') row.currency = 'USD';
          else if (res.currency && (row.currency === undefined || row.currency === null || row.currency === '')) row.currency = res.currency;
          input.value = row.ticker;
          var card = input.closest('.row-card');
          if (card && row.currency) {
            var curSel = card.querySelector('[data-k="currency"]');
            if (curSel) curSel.value = row.currency;
          }
          if (card && row.kind) {
            var kindSel = card.querySelector('[data-k="kind"]');
            if (kindSel) kindSel.value = row.kind;
          }
          onInput();
        }
        refreshQuotes([resolveHolding(row).symbol].concat((resolveHolding(row).altSymbols) || []), true);
      }, 150);
    });
    return wrap;
  }

  function fieldInput(row, f, onInput) {
    var id = 'f-' + uid();
    var input;
    if (f.type === 'select') {
      input = h('select', { id: id }, (typeof f.options === 'function' ? f.options() : f.options).map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      input.value = row[f.k] !== undefined ? row[f.k] : f.options[0][0];
      if (row[f.k] === undefined) row[f.k] = input.value;
      input.setAttribute('data-k', f.k);
      input.addEventListener('change', function () {
        row[f.k] = input.value;
        if (f.onChange) f.onChange(row, input.value);
        if (f.k === 'kind' && input.value === 'crypto') {
          row.currency = 'USD';
          var card = input.closest('.row-card');
          if (card) { var curSel = card.querySelector('[data-k="currency"]'); if (curSel) curSel.value = 'USD'; }
        }
        onInput();
      });
    } else if (f.type === 'check') {
      input = h('input', { id: id, type: 'checkbox' });
      input.checked = row[f.k] !== false && (row[f.k] !== undefined || f.def !== false);
      if (row[f.k] === undefined) row[f.k] = input.checked;
      input.addEventListener('change', function () { row[f.k] = input.checked; onInput(); });
      return h('div', { class: 'field check' }, [input, h('label', { for: id, text: t(f.label) })]);
    } else if (f.type === 'track') {
      return trackField(row, f, onInput);
    } else if (f.type === 'security') {
      return securityField(row, f, onInput);
    } else {
      input = h('input', { id: id, type: f.type === 'text' ? 'text' : f.type === 'date' ? 'date' : 'number', inputmode: f.type === 'number' ? 'decimal' : null, step: f.step || (f.type === 'number' ? 'any' : null), min: f.min, autocomplete: 'off', placeholder: f.ph || null, 'data-k': f.k });
      if (f.upper) { input.setAttribute('autocapitalize', 'characters'); input.style.direction = 'ltr'; }
      input.value = row[f.k] === undefined || row[f.k] === null ? '' : row[f.k];
      input.addEventListener('input', function () {
        var v = input.value;
        if (f.type === 'number') v = v === '' ? null : nn(v);
        if (f.upper && typeof v === 'string') v = v.toUpperCase();
        row[f.k] = v; onInput();
      });
    }
    return h('div', { class: 'field' }, [h('label', { for: id, text: t(f.label) }), input]);
  }
  function renderList(box, rows, schema) {
    box.innerHTML = '';
    var listEl = h('div');
    function outputs(row, el) {
      if (!schema.outputs) return;
      el.innerHTML = '';
      schema.outputs(row).forEach(function (o) {
        el.appendChild(h('div', { class: 'out' }, [h('span', { class: 'k', text: o[0] }), h('span', { class: 'v num ' + (o[2] || ''), text: o[1] }), o[3] ? h('span', { class: 'stamp', text: o[3] }) : null]));
      });
    }
    var outs = [];
    function refreshAll() { outs.forEach(function (x) { outputs(x[0], x[1]); }); if (schema.totals) schema.totals(); }
    function draw() {
      listEl.innerHTML = ''; outs = [];
      if (!rows.length) listEl.appendChild(h('div', { class: 'empty', text: t('none') }));
      rows.forEach(function (row, i) {
        var outEl = h('div', { class: 'outputs' });
        var card = h('div', { class: 'row-card' }, [
          h('div', { class: 'fields' }, schema.fields.map(function (f) { return fieldInput(row, f, function () { changed(); refreshAll(); }); })),
          schema.outputs ? outEl : null,
          h('div', { class: 'row-actions' }, [h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('del'), onclick: function () { rows.splice(i, 1); changed(); draw(); } })])
        ]);
        outs.push([row, outEl]); outputs(row, outEl);
        listEl.appendChild(card);
      });
      if (schema.totals) schema.totals();
    }
    box.appendChild(listEl);
    box.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: t('add_row'), onclick: function () {
      var r = { id: uid() }; (schema.fields).forEach(function (f) { if (f.def !== undefined) r[f.k] = f.def; }); rows.push(r); changed(); draw();
      var last = listEl.lastChild && listEl.lastChild.querySelector('input,select'); if (last) last.focus();
    } })]));
    draw();
    return { refresh: refreshAll, redraw: draw };
  }
  function section(title, kids, badge) {
    return h('section', { class: 'card' }, [h('h2', { class: 'card-title' }, [h('span', { text: title }), badge || null])].concat(kids));
  }
  function totalsBox(items) {
    return h('div', { class: 'totals' }, items.map(function (x) { return h('div', { class: 'tot' + (x[2] ? ' ' + x[2] : '') }, [h('span', { class: 'k', text: x[0] }), h('span', { class: 'v num', text: x[1] })]); }));
  }
  function comparison(cfg) {
    var head = h('tr', null, cfg.cols.map(function (c) { return h('th', { scope: 'col', text: t(c) || c }); }));
    var body = [1, 2, 3].map(function (i) {
      return h('tr', { class: 'placeholder' }, cfg.cols.map(function (c, j) { return h('td', { text: j === 0 ? t('placeholder_row') + ' ' + i : '—' }); }));
    });
    return section(t('compare'), [
      h('div', { class: 'tbl-wrap' }, [h('table', { class: 'cmp' }, [h('thead', null, [head]), h('tbody', null, body)])]),
      h('p', { class: 'help', text: t('cmp_source') + ': ' + cfg.source })
    ], h('span', { class: 'badge amber', text: t('placeholder_badge') }));
  }
  function fxCard() {
    var box = h('div');
    function draw() {
      box.innerHTML = '';
      ['USD', 'EUR', 'GBP'].forEach(function (cur) {
        var q = quotes[FX_SYM[cur]], inp = h('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: q ? String(+q.price.toFixed(4)) : '', 'aria-label': t('fx_manual') + ' ' + cur });
        inp.value = data.fx[cur] === null || data.fx[cur] === undefined ? '' : data.fx[cur];
        inp.style.maxWidth = '120px';
        inp.addEventListener('input', function () { data.fx[cur] = inp.value === '' ? null : nn(inp.value); changed(); });
        box.appendChild(h('div', { class: 'row-card' }, [
          h('div', { class: 'fx-line' }, [h('strong', { class: 'num', text: cur + '/ILS: ' + (rateILS(cur) ? fmt(rateILS(cur), 4) : t('missing_rate')) }),
            h('span', { text: nn(data.fx[cur]) ? t('manual') : (q ? quoteLabel(q) : '') })]),
          h('div', { class: 'field', style: 'margin-top:6px' }, [h('label', { text: t('fx_manual') + ' (' + cur + '→ILS)' }), inp])
        ]));
      });
      box.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', disabled: fetching, text: fetching ? t('fetching') : t('refresh'), onclick: function () { refreshQuotes(null, false); } })]));
      box.appendChild(h('p', { class: 'help', text: t('fx_note') }));
    }
    on('quotes', draw); draw();
    return section(t('fx_rates'), [box]);
  }

  /* ---------- chrome: bar, nav, backup ---------- */
  function svgIcon(key) { return window.PortalNav ? window.PortalNav.icon(key) : document.createElement('span'); }
  function greeting() { var hr = new Date().getHours(); return t(hr < 5 ? 'greet_night' : hr < 12 ? 'greet_morning' : hr < 17 ? 'greet_noon' : hr < 21 ? 'greet_evening' : 'greet_night'); }
  function coinFor(c, cls) { return h('span', { class: 'coin' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', text: CUR[c] || c }); }
  function currencyPicker(btn) {
    var pop = h('div', { class: 'coin-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('currency') });
    function close() { pop.remove(); btn.focus(); }
    var sheet = h('div', { class: 'sheet', role: 'radiogroup', 'aria-label': t('currency') }, ['ILS', 'USD', 'EUR', 'GBP'].map(function (c) {
      return h('button', { type: 'button', class: 'opt', role: 'radio', 'aria-checked': settings.currency === c ? 'true' : 'false', 'aria-label': c, onclick: function () {
        settings.currency = c; writeJSON(SETTINGS_KEY, settings); btn.textContent = CUR[c]; btn.setAttribute('aria-label', t('currency') + ': ' + c); close(); emit('change'); refreshQuotes(null, true);
      } }, [coinFor(c, 'small'), h('span', { text: c })]);
    }));
    pop.appendChild(sheet);
    pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
    pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(pop);
    var cur = sheet.querySelector('[aria-checked=true]') || sheet.firstChild; cur.focus();
  }
  function chrome(page) {
    var html = document.documentElement;
    html.lang = settings.lang; html.dir = settings.lang === 'he' ? 'rtl' : 'ltr';
    var langSel = h('select', { 'aria-label': t('lang'), class: 'lang-sel' }, [['he', 'עב'], ['en', 'EN'], ['es', 'ES']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    langSel.value = settings.lang;
    langSel.addEventListener('change', function () { settings.lang = langSel.value; writeJSON(SETTINGS_KEY, settings); saveNow(); location.reload(); });
    var coin = h('button', { type: 'button', class: 'coin', id: 'cur-coin', 'aria-haspopup': 'dialog', 'aria-label': t('currency') + ': ' + settings.currency, text: CUR[settings.currency] || '₪' });
    coin.addEventListener('click', function () { currencyPicker(coin); });
    var av = h('a', { class: 'who', href: 'me.html#avatar', 'aria-label': t('avatar_open') }, [h('span', { class: 'avatar-btn', id: 'avatar-slot' }), h('span', { class: 'greet', text: greeting() })]);
    var bar = h('div', { class: 'portal-bar topbar' }, [av, h('div', { class: 'portal-settings tools' }, [h('span', { id: 'account-slot' }), langSel, coin])]);
    var out = [bar];
    var inWealth = page === 'wealth' || WEALTH_SUB.some(function (x) { return x[0] === page; });
    if (inWealth) out.push(h('nav', { class: 'portal-subnav', 'aria-label': t('nav_wealth') }, WEALTH_SUB.map(function (p) {
      return h('a', { href: p[1], class: p[0] === page ? 'active' : null, 'aria-current': p[0] === page ? 'page' : null, text: t(p[2]) });
    })));
    if (window.PortalNav) window.PortalNav.mount(page);
    var mountAv = function () { if (window.PortalAvatar) window.PortalAvatar.mount(document.getElementById('avatar-slot')); };
    setTimeout(mountAv, 0); on('change', mountAv); on('quotes', mountAv);
    return out;
  }
  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportBackup() {
    saveNow();
    return JSON.stringify({ app: 'balances-portal', v: 1, exportedAt: new Date().toISOString(), data: data, settings: settings, options: readJSON(OPTIONS_KEY) }, null, 2);
  }
  function importBackup(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return false; }
    if (!o || o.app !== 'balances-portal' || !o.data) return false;
    data = merge(emptyData(), o.data); writeJSON(DATA_KEY, data);
    if (o.settings) { settings = merge({ lang: 'he', currency: 'ILS' }, o.settings); writeJSON(SETTINGS_KEY, settings); }
    if (o.options) writeJSON(OPTIONS_KEY, o.options);
    return true;
  }
  function exampleData() {
    var E = t('example_prefix') + ' – ', y = today().getFullYear();
    var d = emptyData();
    d.savings.cash = [{ id: uid(), name: E + 'עו"ש', kind: 'c_checking', balance: 15000, currency: 'ILS', rate: 0 }, { id: uid(), name: E + 'פיקדון', kind: 'c_deposit', balance: 50000, currency: 'ILS', rate: 4, maturity: (y + 1) + '-01-01' }];
    d.savings.standing = [{ id: uid(), name: E + 'S&P 500', monthly: 1000, start: (y - 1) + '-01-01', ret: 6, target: (y + 9) + '-01-01', include: true }];
    d.savings.portfolios = [{ id: uid(), name: E + 'תיק', rows: [{ id: uid(), ticker: 'NVDA', qty: 10, entry: 100, currency: 'USD', manual: null }, { id: uid(), ticker: 'LUMI.TA', qty: 100, entry: 60, currency: 'ILS', manual: null }] }];
    d.pension.funds = [{ id: uid(), name: E + 'קרן פנסיה', kind: 'k_pension', balance: 300000, deposit: 3000, feeBal: 0.2, feeDep: 1.5, ret: 4, age: 40, retireAge: 67 }];
    d.hishtalmut.funds = [{ id: uid(), name: E + 'השתלמות', balance: 120000, deposit: 1500, feeBal: 0.6, feeDep: 0, ret: 5, openDate: (y - 7) + '-03-01', target: (y + 5) + '-01-01' }];
    d.mortgage.tracks = [{ id: uid(), name: E + 'פריים', type: 't_prime', balance: 400000, rate: 5.5, months: 240 }];
    d.cards.cards = [{ id: uid(), name: E + 'כרטיס', charge: 6000, limit: 30000, billingDay: 10 }];
    d.home.income = [{ id: uid(), name: E + 'משכורת', amount: 20000 }];
    d.home.expenses = [{ id: uid(), category: 'e_food', name: E + 'סופר', amount: 3000 }, { id: uid(), category: 'e_car', name: E + 'דלק', amount: 800 }];
    d.home.assets = [{ id: uid(), name: E + 'דירה', type: 'a_realestate', value: 2000000, currency: 'ILS', liquid: false }];
    d.home.goal = { amount: 500000, date: (y + 5) + '-01-01', base: 'liquid', ret: 3 };
    return d;
  }
  function backupCard() {
    var file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (!confirm(t('confirm_import'))) { file.value = ''; return; }
      f.text().then(function (txt) { if (importBackup(txt)) { toast(t('imported')); setTimeout(function () { location.reload(); }, 400); } else toast(t('import_bad')); file.value = ''; });
    });
    return section(t('backup'), [
      h('p', { class: 'help', text: t('autosave') }),
      h('div', { class: 'backup-bar', style: 'margin-top:8px' }, [
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', text: t('export'), onclick: function () { download('balances-backup-' + new Date().toISOString().slice(0, 10) + '.json', exportBackup()); toast(t('exported')); } }),
        h('button', { type: 'button', class: 'btn btn-soft btn-sm', text: t('import'), onclick: function () { file.click(); } }), file,
        h('button', { type: 'button', class: 'btn btn-sm', text: t('example') + ' (' + t('example_prefix') + ')', onclick: function () { if (confirm(t('confirm_example'))) { data = exampleData(); saveNow(); toast(t('example_loaded')); setTimeout(function () { location.reload(); }, 400); } } }),
        h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('clear_all'), onclick: function () {
          if (!confirm(t('confirm_clear'))) return;
          [DATA_KEY, QUOTES_KEY, OPTIONS_KEY].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
          data = emptyData(); toast(t('cleared')); setTimeout(function () { location.reload(); }, 400);
        } })
      ]),
      h('p', { class: 'footer-note', text: t('disclaimer') })
    ]);
  }


  /* ---------- public fund statistics (funds.json, daily from data.gov.il) ---------- */
  var fundsP = null;
  var FUND_SRC = { gemelnet: 'https://data.gov.il/dataset/gemelnet', pensianet: 'https://data.gov.il/dataset/pensyanet', bituachnet: 'https://data.gov.il/dataset/bituachnet' };
  function loadFunds() {
    if (!fundsP) fundsP = fetchJSON('funds.json?d=' + new Date().toISOString().slice(0, 10), 20000).catch(function () { fundsP = null; return null; });
    return fundsP;
  }
  var FUNDS = null; // loaded funds.json, for track lists and monthly returns
  function fundsLoaded() { return loadFunds().then(function (j) { if (j && !FUNDS) { FUNDS = j; emit('change'); } return j; }); }
  // which public dataset + classification a personal product belongs to
  function productSet(kind, row) {
    if (kind === 'hishtalmut') return ['gemelnet', /השתלמות/];
    var k = row.kind || 'k_pension';
    if (k === 'k_gemel') return ['gemelnet', /^תגמולים|לפיצויים/];
    if (k === 'k_gemel_inv') return ['gemelnet', /להשקעה/];
    if (k === 'k_insurance') return ['bituachnet', /./];
    return ['pensianet', /חדשות/];
  }
  var PROVIDERS = ['אלטשולר', 'הראל', 'מגדל', 'כלל', 'מנורה', 'הפניקס', 'מיטב', 'אנליסט', 'מור', 'ילין', 'אינפיניטי', 'סלייס', 'הכשרה', 'איילון', 'פסגות', 'ברק', 'גלובל נט', 'אקסלנס', 'עמיתים', 'מדיטריינים', 'ביטוח ישיר', 'אומגה'];
  function providerKey(name) { var s = String(name || ''); for (var i = 0; i < PROVIDERS.length; i++) if (s.indexOf(PROVIDERS[i]) >= 0) return PROVIDERS[i]; return ''; }
  function trackList(kind, row) {
    if (!FUNDS || !FUNDS.sets) return [];
    var ps = productSet(kind, row), set = FUNDS.sets[ps[0]], pk = providerKey(row.name);
    if (!set) return [];
    return (set.funds || []).filter(function (f) { return ps[1].test(f.cls || '') && (!pk || (String(f.mgr || '') + ' ' + String(f.name || '')).indexOf(pk) >= 0); })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); }).map(function (f) { return { set: ps[0], id: String(f.id), name: f.name }; });
  }
  function trackField(row, f, onInput) {
    var id = 'f-' + uid(), sel = h('select', { id: id, 'data-k': 'trackId' });
    function fill() {
      var list = trackList(f.kind, row), cur = row.trackId ? String(row.trackId) : '';
      sel.innerHTML = '';
      sel.appendChild(h('option', { value: '', text: t('pick_track') }));
      var found = false;
      list.forEach(function (x) { if (x.id === cur) found = true; sel.appendChild(h('option', { value: x.set + ':' + x.id, text: x.name + ' (' + x.id + ')' })); });
      if (cur && !found) sel.appendChild(h('option', { value: (row.trackSet || '') + ':' + cur, text: (row.trackName || cur) }));
      sel.value = cur ? (row.trackSet || (list[0] && list[0].set) || '') + ':' + cur : '';
      if (!FUNDS) sel.appendChild(h('option', { value: '__l', text: t('loading'), disabled: 'disabled' }));
    }
    fill(); fundsLoaded().then(fill);
    sel.addEventListener('focus', fill);
    sel.addEventListener('change', function () {
      var v = sel.value; if (v === '__l') return;
      if (!v) { delete row.trackSet; delete row.trackId; delete row.trackName; }
      else { var i = v.indexOf(':'); row.trackSet = v.slice(0, i); row.trackId = v.slice(i + 1); row.trackName = sel.options[sel.selectedIndex].text.replace(/ \(\d+\)$/, ''); }
      onInput();
    });
    return h('div', { class: 'field' }, [h('label', { for: id, text: t(f.label) }), sel]);
  }
  // estimate: baseline balance compounded by the track's published monthly returns for every month after the baseline month
  function estimateFund(row) {
    var B = nn(row.balance), d = String(row.baseDate || '');
    if (B === null || !row.trackId) return { status: row.trackId ? 'no_base' : 'no_track' };
    if (!/^\d{4}-\d{2}/.test(d)) return { status: 'no_base' };
    if (!FUNDS) return { status: 'loading' };
    var set = FUNDS.sets && FUNDS.sets[row.trackSet], m = set && set.monthly && set.monthly[String(row.trackId)];
    if (!m) return { status: 'no_data' };
    var base = +(d.slice(0, 4) + d.slice(5, 7)), v = B, last = null, used = 0;
    Object.keys(m).map(Number).filter(function (p) { return p > base; }).sort().forEach(function (p) { v *= 1 + m[p] / 100; last = p; used++; });
    return { status: 'ok', value: v, asOf: last, months: used, baseMonth: base };
  }
  function trackOf(name, sub, spec) {
    var s = String(name || '') + ' ' + String(sub || '') + ' ' + String(spec || '');
    if (/s&p|500/i.test(s)) return 'tr_sp500';
    if (/הלכ/.test(s)) return 'tr_halacha';
    if (/לבני|גיל|\d\d\s*-\s*\d\d|ומעלה|ומטה|מדרגות/.test(s)) return 'tr_age';
    if (/אג["״]?ח|אשראי|כספי|שקלי|ממשלתי/.test(s)) return 'tr_bonds';
    if (/מניות/.test(s)) return 'tr_equity';
    if (/כללי/.test(s)) return 'tr_general';
    return 'tr_other';
  }
  function median(a) { a = a.filter(function (x) { return Number.isFinite(x); }).sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function periodLabel(p) { p = String(p || ''); return p.length === 6 ? p.slice(4) + '/' + p.slice(0, 4) : p; }
  function foldCmp(s) { return String(s || '').replace(/[״"'׳]/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function providerOf(f) { return f.mgr || f.parent || ''; }
  function matchMine(label, funds) {
    var q = foldCmp(label);
    if (q.length < 2) return null;
    var toks = q.split(' ').filter(function (x) { return x.length >= 2; });
    var exact = null, contains = null, tokenHit = null, tokenScore = 0;
    funds.forEach(function (f) {
      if (f._synthetic) return;
      var hay = foldCmp(f.name || '');
      if (hay === q) exact = f;
      else if (hay.indexOf(q) >= 0 || (q.length >= 6 && q.indexOf(hay) >= 0)) { if (!contains || hay.length < foldCmp(contains.name).length) contains = f; }
      else if (toks.length && toks.every(function (t) { return hay.indexOf(t) >= 0; }) && toks.length > tokenScore) { tokenScore = toks.length; tokenHit = f; }
    });
    return exact || contains || tokenHit;
  }
  function mineFrom(rows) {
    return (rows || []).filter(function (r) { return r && foldCmp(r.name).length >= 2; }).map(function (r) {
      return { label: r.name, track: trackOf(r.name, '', ''), feeAcc: nn(r.feeBal), feeDep: nn(r.feeDep) };
    });
  }
  // cfg: { title, sets: [[setName, classificationRegex]], tracks: [...], mine: [{label, track, feeAcc, feeDep}] }
  function fundsCompare(cfg) {
    var search = h('input', { type: 'search', 'aria-label': t('cmp_search'), placeholder: t('cmp_search') });
    var trackSel = h('select', { 'aria-label': t('track') });
    var provSel = h('select', { 'aria-label': t('provider') });
    var rankEl = h('p', { class: 'help' });
    var tblHost = h('div', { class: 'tbl-wrap' });
    var meta = h('div');
    var filters = h('div', { class: 'toolbar filters' }, [
      h('div', { class: 'field', style: 'flex:1 1 160px' }, [h('label', { text: t('cmp_search') }), search]),
      h('div', { class: 'field', style: 'flex:1 1 130px' }, [h('label', { text: t('track') }), trackSel]),
      h('div', { class: 'field', style: 'flex:1 1 130px' }, [h('label', { text: t('provider') }), provSel])
    ]);
    var sortKey = 'y5', sortDir = -1, all = [], mineHits = [];
    var TRACKS = cfg.tracks || [];
    var COLS = [
      { k: 'name', label: t('provider_track') },
      { k: 'provider', label: t('provider') },
      { k: 'track', label: t('track') },
      { k: 'feeAcc', label: t('fee_bal'), num: true, d: 2, pct: true },
      { k: 'feeDep', label: t('fee_dep'), num: true, d: 2, pct: true },
      { k: 'ytd', label: t('ret_ytd'), num: true, d: 1, pct: true },
      { k: 'y3', label: t('ret_3y_avg'), num: true, d: 1, pct: true },
      { k: 'y5', label: t('ret_5y_avg'), num: true, d: 1, pct: true },
      { k: 'sd', label: t('std_dev'), num: true, d: 1, pct: true },
      { k: 'assets', label: t('assets_m'), num: true, d: 0 }
    ];
    function val(f, k) {
      if (k === 'name') return f.name || '';
      if (k === 'provider') return providerOf(f);
      if (k === 'track') return t(f._track);
      return nn(f[k]);
    }
    function cmp(a, b) {
      var va = val(a, sortKey), vb = val(b, sortKey);
      if (typeof va === 'number' || typeof vb === 'number') {
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return (va - vb) * sortDir;
      }
      return String(va).localeCompare(String(vb), 'he') * sortDir;
    }
    function fmtCell(col, f) {
      if (!col.num) return val(f, col.k) || '—';
      var v = nn(f[col.k]);
      if (v === null) return '—';
      return col.pct ? pct(v, col.d) : fmt(v, col.d);
    }
    function fillSelects(presetTrack) {
      var tracksPresent = {}, provs = {};
      all.forEach(function (f) { tracksPresent[f._track] = (tracksPresent[f._track] || 0) + 1; var p = providerOf(f); if (p) provs[p] = true; });
      var curT = trackSel.value, curP = provSel.value;
      trackSel.innerHTML = '';
      trackSel.appendChild(h('option', { value: '', text: t('all_tracks') }));
      var seen = {};
      TRACKS.concat(Object.keys(tracksPresent)).forEach(function (k) {
        if (seen[k] || !tracksPresent[k]) return;
        seen[k] = true;
        trackSel.appendChild(h('option', { value: k, text: t(k) + ' (' + tracksPresent[k] + ')' }));
      });
      if (curT && tracksPresent[curT]) trackSel.value = curT;
      else if (!curT && presetTrack && tracksPresent[presetTrack]) trackSel.value = presetTrack;
      provSel.innerHTML = '';
      provSel.appendChild(h('option', { value: '', text: t('all_providers') }));
      Object.keys(provs).sort(function (a, b) { return a.localeCompare(b, 'he'); }).forEach(function (p) {
        provSel.appendChild(h('option', { value: p, text: p }));
      });
      if (curP && provs[curP]) provSel.value = curP;
    }
    function renderTable() {
      var rows = all.filter(function (f) {
        if (trackSel.value && f._track !== trackSel.value) return false;
        if (provSel.value && providerOf(f) !== provSel.value) return false;
        var q = foldCmp(search.value);
        if (!q) return true;
        var hay = foldCmp([f.name, f.mgr, f.parent, f.id, f.sub, f.spec].join(' '));
        return q.split(' ').every(function (tok) { return !tok || hay.indexOf(tok) >= 0; });
      }).slice().sort(cmp);
      tblHost.innerHTML = '';
      var head = h('tr', null, COLS.map(function (c) {
        var arrow = sortKey === c.k ? (sortDir > 0 ? ' ↑' : ' ↓') : '';
        return h('th', { scope: 'col', class: (c.num ? 'num ' : '') + 'sortable' + (c.k === 'name' ? ' name' : ''), text: c.label + arrow, onclick: function () {
          if (sortKey === c.k) sortDir = -sortDir;
          else { sortKey = c.k; sortDir = c.num ? -1 : 1; }
          renderTable();
        } });
      }));
      var body = rows.length ? rows.map(function (f) {
        return h('tr', { class: f._mine ? 'mine' : null }, COLS.map(function (c) {
          return h('td', { class: (c.num ? 'num' : '') + (c.k === 'name' ? ' name' : ''), text: fmtCell(c, f) });
        }));
      }) : [h('tr', { class: 'placeholder' }, [h('td', { colspan: String(COLS.length), text: t('funds_none') })])];
      tblHost.appendChild(h('table', { class: 'cmp data' }, [h('thead', null, [head]), h('tbody', null, body)]));
      var parts = [t('cmp_showing').replace('{n}', String(rows.length)).replace('{total}', String(all.filter(function (f) { return !f._synthetic; }).length))];
      var metricKey = (sortKey === 'ytd' || sortKey === 'y3' || sortKey === 'y5' || sortKey === 'sd') ? sortKey : 'y5';
      var metricLabel = { ytd: t('ret_ytd'), y3: t('ret_3y_avg'), y5: t('ret_5y_avg'), sd: t('std_dev') }[metricKey];
      mineHits.forEach(function (m) {
        if (m.fund._synthetic) return;
        var peers = all.filter(function (f) { return !f._synthetic && f._track === m.fund._track && nn(f[metricKey]) !== null; }).slice().sort(function (a, b) {
          var dir = metricKey === 'sd' ? 1 : -1;
          return ((nn(a[metricKey]) === null ? 99 : a[metricKey]) - (nn(b[metricKey]) === null ? 99 : b[metricKey])) * dir * -1;
        });
        // higher return is better (desc); lower sd is better (asc)
        if (metricKey === 'sd') peers.sort(function (a, b) { return (nn(a.sd) === null ? 99 : a.sd) - (nn(b.sd) === null ? 99 : b.sd); });
        else peers.sort(function (a, b) { return (nn(b[metricKey]) === null ? -99 : b[metricKey]) - (nn(a[metricKey]) === null ? -99 : a[metricKey]); });
        var idx = -1;
        peers.forEach(function (f, i) { if (f === m.fund) idx = i; });
        if (idx >= 0) parts.push(t('your_rank').replace('{name}', m.label).replace('{rank}', String(idx + 1)).replace('{of}', String(peers.length)).replace('{track}', t(m.fund._track)).replace('{metric}', metricLabel));
      });
      rankEl.textContent = parts.join(' · ');
    }
    function draw(j) {
      tblHost.innerHTML = ''; meta.innerHTML = ''; rankEl.textContent = '';
      if (!j) { tblHost.appendChild(h('div', { class: 'notice amber', text: t('funds_missing') })); return; }
      all = []; mineHits = [];
      var periods = [], links = [];
      cfg.sets.forEach(function (sp) {
        var set = j.sets && j.sets[sp[0]]; if (!set) return;
        periods.push(periodLabel(set.period));
        if (FUND_SRC[sp[0]]) links.push({ href: FUND_SRC[sp[0]], text: sp[0] });
        set.funds.forEach(function (f) {
          if (!sp[1].test(f.cls || '')) return;
          var row = {};
          Object.keys(f).forEach(function (k) { row[k] = f[k]; });
          row._set = sp[0];
          row._track = trackOf(f.name, f.sub, f.spec);
          all.push(row);
        });
      });
      if (!all.length) { tblHost.appendChild(h('div', { class: 'notice amber', text: t('funds_missing') })); return; }
      var preset = null;
      (cfg.mine || []).forEach(function (m) {
        var hit = matchMine(m.label, all);
        if (hit) { hit._mine = true; mineHits.push({ label: m.label, fund: hit }); if (!preset) preset = hit._track; }
        else {
          var syn = { name: t('mine') + ': ' + m.label, _track: m.track || 'tr_other', feeAcc: m.feeAcc, feeDep: m.feeDep, _mine: true, _synthetic: true };
          all.push(syn);
          mineHits.push({ label: m.label, fund: syn });
        }
      });
      fillSelects(preset);
      var periodTxt = periods.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
      var srcLine = h('p', { class: 'help' });
      srcLine.appendChild(document.createTextNode(t('funds_src') + ' ' + periodTxt + '. '));
      links.forEach(function (L, i) {
        if (i) srcLine.appendChild(document.createTextNode(', '));
        srcLine.appendChild(h('a', { href: L.href, target: '_blank', rel: 'noopener noreferrer', text: L.text }));
      });
      meta.appendChild(srcLine);
      meta.appendChild(h('p', { class: 'help', text: t('no_1y') + ' ' + t('past_returns') + ' ' + t('not_advice') }));
      renderTable();
    }
    search.addEventListener('input', renderTable);
    trackSel.addEventListener('change', renderTable);
    provSel.addEventListener('change', renderTable);
    tblHost.appendChild(h('div', { class: 'empty', text: t('loading') }));
    loadFunds().then(draw);
    return section(cfg.title || t('compare'), [filters, rankEl, tblHost, meta], h('span', { class: 'badge green', text: t('official_data') }));
  }
  function xirr(flows) {
    if (flows.length < 2) return null;
    var d0 = flows[0].d.getTime(), r = 0.1;
    function f(rate) { return flows.reduce(function (s, x) { return s + x.v / Math.pow(1 + rate, (x.d.getTime() - d0) / 31557600000); }, 0); }
    for (var i = 0; i < 60; i++) {
      var y = f(r), dy = (f(r + 1e-6) - y) / 1e-6; if (!Number.isFinite(dy) || dy === 0) return null;
      var nr = r - y / dy; if (!Number.isFinite(nr)) return null; if (nr <= -0.99) nr = -0.99; if (Math.abs(nr - r) < 1e-7) return nr * 100; r = nr;
    }
    return null;
  }
  function portfolioPerf() {
    // simple return since entry (portfolios + trades) and XIRR from the trades journal when dated
    var cost = 0, value = 0, flows = [], fees = 0;
    data.savings.portfolios.forEach(function (p) { var s = calc.portfolio(p); cost += s.costILS; value += s.valueILS; });
    var pos = calc.positions();
    pos.forEach(function (p) { if (p.valueILS !== null) value += p.valueILS; if (p.costILS !== null) cost += p.costILS; fees += n(toILS(p.fees, p.currency)); });
    data.journals.trades.forEach(function (r) { var d = parseDate(r.date), amt = toILS(n(r.qty) * n(r.price) + (r.side === 'sell' ? -n(r.fee) : n(r.fee)), r.currency || 'ILS'); if (d && amt !== null) flows.push({ d: d, v: r.side === 'sell' ? amt : -amt }); });
    flows.sort(function (a, b) { return a.d - b.d; });
    var jv = pos.reduce(function (a, p) { return a + (p.valueILS || 0); }, 0);
    var irr = flows.length && jv > 0 ? xirr(flows.concat([{ d: today(), v: jv }])) : null;
    return { cost: cost, value: value, simple: cost > 0 ? (value - cost) / cost * 100 : null, irr: irr, fees: fees };
  }
  function leadForm(topic) {
    var C = window.PortalCloud, msg = h('div');
    var name = h('input', { type: 'text', id: 'lead-name', autocomplete: 'name', 'aria-label': t('lead_name') }), contact = h('input', { type: 'text', id: 'lead-contact', autocomplete: 'email', 'aria-label': t('lead_contact'), dir: 'ltr' });
    var consent = h('input', { type: 'checkbox', id: 'lead-consent' }), hp = h('input', { type: 'text', tabindex: '-1', autocomplete: 'off', class: 'hp', 'aria-hidden': 'true' }), t0 = Date.now();
    var btn = h('button', { type: 'button', id: 'lead-send', class: 'btn btn-primary btn-sm', text: t('lead_send'), onclick: function () {
      msg.innerHTML = '';
      if (!name.value.trim() || !contact.value.trim()) { msg.appendChild(h('div', { class: 'notice amber', text: t('lead_need') })); return; }
      if (!consent.checked) { msg.appendChild(h('div', { class: 'notice amber', text: t('lead_need_consent') })); return; }
      if (!C || !C.configured) { msg.appendChild(h('div', { class: 'notice amber', text: t('backend_missing') })); return; }
      btn.disabled = true;
      C.submitLead({ name: name.value.trim(), contact: contact.value.trim(), topic: topic, consent: true, hp: hp.value, elapsed: Date.now() - t0 }).then(function () {
        msg.appendChild(h('div', { class: 'notice blue', text: t('lead_ok') })); name.value = ''; contact.value = ''; consent.checked = false;
      }, function (e) { msg.appendChild(h('div', { class: 'notice red', text: t('send_fail') + (e && e.message ? ' (' + e.message + ')' : '') })); }).then(function () { btn.disabled = false; });
    } });
    return section(t('lead_title'), [
      h('p', { class: 'help', text: t('lead_intro') }),
      h('div', { class: 'fields' }, [h('div', { class: 'field' }, [h('label', { text: t('lead_name') }), name]), h('div', { class: 'field' }, [h('label', { text: t('lead_contact') }), contact])]), hp,
      h('div', { class: 'field check', style: 'margin-top:8px' }, [consent, h('label', { for: 'lead-consent', text: t('lead_consent') })]),
      h('div', { class: 'toolbar' }, [btn]), msg,
      h('p', { class: 'footer-note', text: t('lead_note') })
    ]);
  }
  /* ---------- read-only building blocks ---------- */
  var CUR_OPTS = [['ILS', '₪ ILS'], ['USD', '$ USD'], ['EUR', '€ EUR'], ['GBP', '£ GBP']];
  // Fee references. Legal caps: Supervision of Financial Services (Provident Funds) (Management Fees) Regulations 2012, regs. 2-3.
  // Pension default funds: up to 1% of deposits + 0.22% of savings (Capital Market Authority tender, published 25.9.2024, in force 1.11.2024).
  var FEE_REF = {
    pension: { capDep: 6, capAcc: 0.5, refDep: 1, refAcc: 0.22 },
    gemel: { capDep: 4, capAcc: 1.05 }, gemel_inv: { capDep: 4, capAcc: 1.05 }, insurance: { capDep: 4, capAcc: 1.05 }, savings_policy: { capDep: 4, capAcc: 1.05 },
    hishtalmut: { capDep: 0, capAcc: 2 }
  };
  function table(cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) return h('div', { class: 'empty', text: opts.empty || t('none') });
    return h('div', { class: 'tbl-wrap', tabindex: '0' }, [h('table', { class: 'cmp data' }, [
      opts.caption ? h('caption', { class: 'sr-only', text: opts.caption }) : null,
      h('thead', null, [h('tr', null, cols.map(function (c) { return h('th', { scope: 'col', text: c[0] }); }))]),
      h('tbody', null, rows.map(function (r) { return h('tr', { class: opts.rowClass ? opts.rowClass(r) : null }, cols.map(function (c) { var v = c[1](r); return h('td', { class: c[2] || null }, [v === null || v === undefined ? '—' : typeof v === 'object' ? v : String(v)]); })); }))
    ])]);
  }
  function recsBox(items) {
    var box = h('div', { class: 'recs' });
    if (!items.length) box.appendChild(h('div', { class: 'empty', text: t('recs_none') }));
    items.forEach(function (it) { box.appendChild(h('div', { class: 'rec ' + (it.level || 'info') }, [h('strong', { text: it.title }), it.text ? h('p', { text: it.text }) : null])); });
    return section(t('recs_title'), [box, h('p', { class: 'help', text: t('recs_disclaimer') })]);
  }
  function editLink(anchor) { return h('div', { class: 'toolbar' }, [h('a', { class: 'btn btn-primary btn-sm', href: 'me.html#' + anchor, text: t('edit_in_me') })]); }
  function compareBox(cfg) {
    // cfg: { title, cols:[labels], mine:[[cells]], sameTrack:boolean, otherTracks:[names], source }
    var head = h('tr', null, cfg.cols.map(function (c) { return h('th', { scope: 'col', text: c }); }));
    var rows = [];
    (cfg.mine || []).forEach(function (r) { rows.push(h('tr', { class: 'mine' }, r.map(function (c, i) { return h('td', { text: c === null || c === undefined ? '—' : String(c) }); }))); });
    if (cfg.sameTrack) rows.push(h('tr', { class: 'grp' }, [h('td', { colspan: cfg.cols.length, text: t('cmp_same_track') })]));
    if (cfg.sameTrack) [1, 2, 3].forEach(function (i) { rows.push(h('tr', { class: 'placeholder' }, cfg.cols.map(function (c, j) { return h('td', { text: j === 0 ? t('placeholder_provider') + ' ' + i : '—' }); }))); });
    if (cfg.otherTracks && cfg.otherTracks.length) {
      rows.push(h('tr', { class: 'grp' }, [h('td', { colspan: cfg.cols.length, text: t('cmp_other_tracks') })]));
      cfg.otherTracks.forEach(function (nm) { rows.push(h('tr', { class: 'placeholder' }, cfg.cols.map(function (c, j) { return h('td', { text: j === 0 ? t(nm) : '—' }); }))); });
    }
    return section(cfg.title || t('compare'), [
      h('div', { class: 'tbl-wrap' }, [h('table', { class: 'cmp' }, [h('thead', null, [head]), h('tbody', null, rows)])]),
      h('p', { class: 'help', text: t('cmp_source') + ': ' + cfg.source })
    ], h('span', { class: 'badge amber', text: t('placeholder_badge') }));
  }
  function fmtYmd(s) { var d = parseDate(s); return d ? fmtDate(d) : (s || '—'); }
  function typeLabel(tp) { return t('mt_' + tp) || tp; }
  function feeCell(v, derived) { return v === null || v === undefined || v === '' ? '—' : pct(n(v), 2) + (derived ? '*' : ''); }

  /* ---------- pension / hishtalmut analysis ---------- */
  function fundRows(kind) {
    var rows = [];
    calc.maslaka(kind).forEach(function (p) { rows.push({ src: 'maslaka', provider: p.provider, plan: p.plan, type: p.type, track: p.track, account: p.account, active: p.active, balance: nn(p.balance), feeDep: nn(p.feeDep), feeAcc: nn(p.feeAcc), derived: p.feeAccDerived, updated: p.updated }); });
    data[kind].funds.forEach(function (r) { rows.push({ src: 'manual', provider: r.name, plan: '', type: kind === 'pension' ? ({ k_pension: 'pension', k_gemel: 'gemel', k_gemel_inv: 'gemel_inv', k_insurance: 'insurance' }[r.kind] || 'pension') : 'hishtalmut', track: '', account: '', active: null, balance: nn(r.balance), feeDep: nn(r.feeDep), feeAcc: nn(r.feeBal), deposit: nn(r.deposit), updated: '' }); });
    return rows;
  }
  function fundRecs(kind, rows) {
    var out = [], actives = 0;
    rows.forEach(function (r) {
      var ref = FEE_REF[r.type]; if (!ref) return;
      var name = (r.provider || '') + (r.plan ? ' · ' + r.plan : '');
      if (r.active) actives += r.type === 'pension' ? 1 : 0;
      if (r.feeAcc !== null && r.feeAcc > ref.capAcc + 1e-9) out.push({ level: 'bad', title: name + ': ' + t('rec_fee_over_cap'), text: t('fee_bal') + ' ' + pct(r.feeAcc, 2) + ' > ' + pct(ref.capAcc, 2) + ' (' + t('legal_cap') + ')' });
      if (ref.refAcc !== undefined && r.feeAcc !== null && r.balance > 0 && r.feeAcc > ref.refAcc + 0.005) {
        var save = r.balance * (r.feeAcc - ref.refAcc) / 100;
        out.push({ level: 'warn', title: name + ': ' + t('rec_fee_above_default'), text: t('rec_fee_above_default_txt').replace('{fee}', pct(r.feeAcc, 2)).replace('{ref}', pct(ref.refAcc, 2)).replace('{save}', disp(save)) });
      }
      if (ref.refDep !== undefined && r.feeDep !== null && r.feeDep > ref.refDep + 0.005) out.push({ level: 'warn', title: name + ': ' + t('rec_dep_fee_high'), text: t('fee_dep') + ' ' + pct(r.feeDep, 2) + ' · ' + t('default_funds_ref') + ' ' + pct(ref.refDep, 0) });
      if (ref.refAcc === undefined && r.feeAcc !== null && r.balance > 0) out.push({ level: 'info', title: name + ': ' + t('rec_fee_cost'), text: t('rec_fee_cost_txt').replace('{fee}', pct(r.feeAcc, 2)).replace('{cost}', disp(r.balance * r.feeAcc / 100)).replace('{per01}', disp(r.balance * 0.001)) });
      if (r.active === false && r.balance > 0 && kind === 'pension') out.push({ level: 'info', title: name + ': ' + t('rec_inactive'), text: t('rec_inactive_txt') });
    });
    if (kind === 'pension' && rows.filter(function (r) { return r.type === 'pension' && r.balance > 0; }).length > 1) out.push({ level: 'info', title: t('rec_multi_pension'), text: t('rec_multi_pension_txt') });
    if (!rows.length) out.push({ level: 'info', title: t('rec_no_data'), text: t('rec_no_data_txt') });
    if (rows.some(function (r) { return r.derived; })) out.push({ level: 'info', title: t('fee_derived_note'), text: '' });
    return out;
  }
  function maslakaLinkCard() {
    return section(t('maslaka_get_title'), [
      h('div', { class: 'toolbar' }, [
        h('a', { class: 'btn btn-primary', href: MASLAKA_URL, target: '_blank', rel: 'noopener', text: t('maslaka_open') }),
        h('a', { class: 'btn btn-soft', href: 'me.html#maslaka', text: t('maslaka_upload_btn') })]),
      h('ol', { class: 'steps' }, ['ms1', 'ms2', 'ms3', 'ms4', 'ms5'].map(function (k) { return h('li', { text: t(k) }); })),
      h('p', { class: 'help' }, [t('maslaka_official') + ' ', h('a', { href: MASLAKA_INFO_URL, target: '_blank', rel: 'noopener', text: 'swiftness.co.il' }), ' · ', h('a', { href: MASLAKA_REG_URL, target: '_blank', rel: 'noopener', text: t('maslaka_register') })])
    ]);
  }
  function fundPage(kind) {
    return function (main) {
      main.appendChild(maslakaLinkCard());
      var box = h('div'), recBox = h('div'), cmpBox = h('div');
      main.appendChild(section(t('my_products'), [box]));
      var estBox = h('div');
      main.appendChild(section(t('est_title'), [estBox]));
      main.appendChild(cmpBox); main.appendChild(recBox);
      fundsLoaded();
      function drawEst() {
        estBox.innerHTML = '';
        var list = data[kind].funds.filter(function (r) { return nn(r.balance) !== null; });
        if (!list.length) { estBox.appendChild(h('div', { class: 'empty', text: t('no_products') })); return; }
        var tot = 0, any = false, asOf = null;
        estBox.appendChild(table([
          [t('name'), function (r) { return r.name || '—'; }],
          [t('track'), function (r) { return r.trackId ? (r.trackName || r.trackId) : h('a', { href: 'me.html#' + kind, class: 'btn btn-soft btn-sm', text: t('pick_track') }); }],
          [t('balance_base'), function (r) { return disp(n(r.balance)) + (r.baseDate ? ' · ' + fmtDate(parseDate(r.baseDate)) : ''); }, 'num'],
          [t('est_balance'), function (r) { var e = estimateFund(r); if (e.status !== 'ok') return t('est_' + e.status); return disp(e.value); }, 'num'],
          [t('est_asof'), function (r) { var e = estimateFund(r); return e.status === 'ok' ? (e.asOf ? periodLabel(e.asOf) : t('est_no_new')) : '—'; }]
        ], list, {}));
        list.forEach(function (r) { var e = estimateFund(r); if (e.status === 'ok') { any = true; tot += e.value; if (e.asOf && (!asOf || e.asOf > asOf)) asOf = e.asOf; } else tot += n(r.balance); });
        if (any) estBox.appendChild(totalsBox([[t('est_total'), disp(tot), 'big']]));
        estBox.appendChild(h('p', { class: 'help', text: t('est_note') + (asOf ? ' · ' + t('est_asof') + ': ' + periodLabel(asOf) : '') }));
      }
      on('change', drawEst); drawEst();
      function draw() {
        var rows = fundRows(kind);
        box.innerHTML = '';
        if (data.maslaka.reportDate) box.appendChild(h('p', { class: 'help', text: t('maslaka_report_date') + ': ' + fmtYmd(data.maslaka.reportDate) + (data.maslaka.include === false ? ' · ' + t('maslaka_excluded') : '') }));
        box.appendChild(table([
          [t('provider'), function (r) { return r.provider || '—'; }], [t('plan'), function (r) { return r.plan || typeLabel(r.type); }],
          [t('track'), function (r) { return r.track || '—'; }], [t('account'), function (r) { return r.account || '—'; }, 'num'],
          [t('status'), function (r) { return r.active === null || r.active === undefined ? '—' : r.active ? t('st_active') : t('st_inactive'); }],
          [t('balance'), function (r) { return r.balance === null ? '—' : disp(r.balance); }, 'num'],
          [t('fee_dep'), function (r) { return feeCell(r.feeDep); }, 'num'], [t('fee_bal'), function (r) { return feeCell(r.feeAcc, r.derived); }, 'num'],
          [t('source'), function (r) { return r.src === 'maslaka' ? t('src_maslaka') : t('src_manual'); }]
        ], rows, { empty: t('no_products'), rowClass: function (r) { return r.active === false ? 'muted' : null; } }));
        var tot = 0, tAct = 0; rows.forEach(function (r) { tot += n(r.balance); if (r.active !== false) tAct += n(r.balance); });
        box.appendChild(totalsBox([[t('total') + ' ' + t('balance'), disp(tot), 'big'], [t('total_active'), disp(tAct)], [t('products_count'), fmt(rows.length)]]));
        if (kind === 'hishtalmut') box.appendChild(h('p', { class: 'help', text: t('hish_help') }));
        box.appendChild(editLink(kind === 'pension' ? 'pension' : 'hishtalmut'));
        if (!cmpBox.firstChild) {
          var mine = function (types) { return rows.filter(function (r) { return types.indexOf(r.type) >= 0 && r.balance > 0; }).map(function (r) { return { label: (r.provider || '') + (r.track ? ' · ' + r.track : ''), track: trackOf(r.track || r.plan), feeAcc: r.feeAcc, feeDep: r.feeDep }; }); };
          var TR = ['tr_general', 'tr_age', 'tr_equity', 'tr_sp500', 'tr_bonds', 'tr_halacha'];
          if (kind === 'pension') {
            cmpBox.appendChild(fundsCompare({ title: t('compare_pension'), sets: [['pensianet', /חדשות/]], tracks: TR, mine: mine(['pension']) }));
            if (rows.some(function (r) { return r.type === 'gemel' || r.type === 'gemel_inv'; })) cmpBox.appendChild(fundsCompare({ title: t('compare_gemel'), sets: [['gemelnet', /^תגמולים|^קופת גמל להשקעה$/]], tracks: TR, mine: mine(['gemel', 'gemel_inv']) }));
            if (rows.some(function (r) { return r.type === 'insurance' || r.type === 'savings_policy'; })) cmpBox.appendChild(fundsCompare({ title: t('compare_insurance'), sets: [['bituachnet', /2004/]], tracks: ['tr_general', 'tr_equity', 'tr_sp500', 'tr_bonds', 'tr_halacha'], mine: mine(['insurance', 'savings_policy']) }));
          } else cmpBox.appendChild(fundsCompare({ title: t('compare_hish'), sets: [['gemelnet', /השתלמות/]], tracks: TR.filter(function (x) { return x !== 'tr_age'; }), mine: mine(['hishtalmut']) }));
        }
        recBox.innerHTML = ''; recBox.appendChild(recsBox(fundRecs(kind, rows)));
      }
      on('change', draw); draw();
    };
  }

  /* ---------- category renderers ---------- */
  var pageRenderers = {
    pension: fundPage('pension'),
    hishtalmut: fundPage('hishtalmut'),
    wealth: function (main) {
      var box = h('div', { class: 'hub' });
      main.appendChild(box);
      function draw() {
        var s = calc.summary(); box.innerHTML = '';
        var pens = fundRows('pension').reduce(function (a, r) { return a + n(r.balance); }, 0), hish = fundRows('hishtalmut').reduce(function (a, r) { return a + n(r.balance); }, 0);
        var sav = (s.cats.cat_cash || 0) + (s.cats.cat_standing || 0) + (s.cats.cat_bank || 0), pf = (s.cats.cat_portfolio || 0) + (s.cats.cat_trades || 0), op = s.cats.cat_options || 0;
        [['pension.html', 'nav_pension', pens], ['hishtalmut.html', 'nav_hishtalmut', hish], ['savings.html', 'nav_savings', sav], ['portfolio.html', 'nav_portfolio', pf], ['options.html', 'nav_options', op]].forEach(function (x) {
          box.appendChild(h('a', { class: 'hub-card', href: x[0] }, [h('span', { class: 'k', text: t(x[1]) }), h('span', { class: 'v num', text: disp(x[2]) }), h('span', { class: 'stamp', text: t('open_page') + ' ›' })]));
        });
        box.appendChild(totalsBox([[t('wealth_total'), disp(pens + hish + sav + pf + op), 'big']]));
      }
      on('change', draw); on('quotes', draw); draw();
      main.appendChild(editLink('top'));
    },
    savings: function (main) {
      var box = h('div'), bankBox = h('div'), stBox = h('div'), recBox = h('div');
      main.appendChild(section(t('cash_title'), [box]));
      main.appendChild(section(t('bank_accounts'), [bankBox]));
      main.appendChild(section(t('standing_title'), [stBox]));
      main.appendChild(compareBox({ title: t('compare_deposits'), cols: [t('bank'), t('kind'), t('rate'), t('months')], sameTrack: true, otherTracks: ['c_deposit', 'c_mmf', 'c_savings'], mine: data.savings.cash.map(function (r) { return [t('mine') + ': ' + (r.name || ''), t(r.kind || 'c_checking'), pct(n(r.rate), 2), '—']; }), source: t('src_boi_deposits') }));
      main.appendChild(recBox); main.appendChild(fxCard());
      function draw() {
        box.innerHTML = '';
        box.appendChild(table([[t('name'), function (r) { return r.name; }], [t('kind'), function (r) { return t(r.kind || 'c_checking'); }], [t('balance'), function (r) { var v = toILS(r.balance, r.currency); return v === null ? t('missing_rate') : disp(v); }, 'num'], [t('rate'), function (r) { return pct(n(r.rate), 2); }, 'num'], [t('maturity'), function (r) { return fmtYmd(r.maturity); }]], data.savings.cash));
        var s = 0; data.savings.cash.forEach(function (r) { s += n(toILS(r.balance, r.currency)); }); box.appendChild(totalsBox([[t('total'), disp(s), 'big']])); box.appendChild(editLink('cash'));
        bankBox.innerHTML = '';
        var acc = calc.bankAccounts();
        bankBox.appendChild(table([[t('account'), function (a) { return a.account; }], [t('balance'), function (a) { return money(a.balance, a.currency, 0); }, 'num'], [t('last_entry'), function (a) { return fmtYmd(a.lastDate); }], [t('tx_count'), function (a) { return fmt(a.txCount); }, 'num']], acc, { empty: t('journal_empty') }));
        bankBox.appendChild(editLink('j-bank'));
        stBox.innerHTML = '';
        stBox.appendChild(table([[t('name'), function (r) { return r.name; }], [t('monthly_amount'), function (r) { return disp(n(r.monthly)); }, 'num'], [t('value_today'), function (r) { return disp(calc.standing(r).valueToday); }, 'num'], [t('projected'), function (r) { var x = calc.standing(r).projected; return x === null ? '—' : disp(x); }, 'num']], data.savings.standing));
        stBox.appendChild(editLink('standing'));
        var rec = [], best = 0;
        data.savings.cash.forEach(function (r) { best = Math.max(best, n(r.rate)); });
        data.savings.cash.forEach(function (r) {
          var v = n(toILS(r.balance, r.currency));
          if ((r.kind === 'c_checking' || !r.kind) && v > 20000 && !(n(r.rate) > 0)) rec.push({ level: 'warn', title: (r.name || t('c_checking')) + ': ' + t('rec_idle_cash'), text: t('rec_idle_cash_txt').replace('{v}', disp(v)) });
          var m = parseDate(r.maturity); if (m && m >= today() && monthsBetween(today(), m) <= 1) rec.push({ level: 'info', title: (r.name || '') + ': ' + t('rec_maturing'), text: fmtDate(m) });
        });
        recBox.innerHTML = ''; recBox.appendChild(recsBox(rec));
      }
      on('change', draw); on('quotes', draw); draw();
    },
    portfolio: function (main) {
      var pfBox = h('div'), trBox = h('div'), recBox = h('div');
      main.appendChild(section(t('portfolios_title'), [pfBox]));
      main.appendChild(section(t('trades_positions'), [trBox]));
      var perfBox = h('div');
      main.appendChild(section(t('perf_title'), [perfBox]));
      var pf0 = portfolioPerf();
      main.appendChild(fundsCompare({ title: t('real_alternative'), sets: [['gemelnet', /^קופת גמל להשקעה$/], ['bituachnet', /2004/]], tracks: ['tr_equity', 'tr_sp500', 'tr_general', 'tr_bonds'], mine: [], note: t('real_alt_note') }));
      main.appendChild(recBox);
      main.appendChild(leadForm('portfolio'));
      function draw() {
        pfBox.innerHTML = '';
        var rows = []; data.savings.portfolios.forEach(function (p) { p.rows.forEach(function (r) { var x = calc.portfolioRow(r); rows.push({ pf: p.name, r: r, x: x }); }); });
        pfBox.appendChild(table([[t('portfolio'), function (o) { return o.pf || '—'; }], [t('ticker'), function (o) { return o.r.ticker; }, 'num'], [t('qty'), function (o) { return fmt(n(o.r.qty), 2); }, 'num'], [t('price'), function (o) { return o.x.price === null ? '—' : money(o.x.price, o.r.currency || 'ILS', 2); }, 'num'], [t('value'), function (o) { return o.x.valueILS === null ? '—' : disp(o.x.valueILS); }, 'num'], [t('pl'), function (o) { return o.x.pl === null ? '—' : disp(o.x.pl) + ' (' + pct(o.x.plPct) + ')'; }, 'num']], rows));
        var v = 0, c = 0; data.savings.portfolios.forEach(function (p) { var s = calc.portfolio(p); v += s.valueILS; c += s.costILS; });
        pfBox.appendChild(totalsBox([[t('value'), disp(v), 'big'], [t('pl'), disp(v - c)]])); pfBox.appendChild(editLink('portfolios'));
        trBox.innerHTML = '';
        var pos = calc.positions();
        trBox.appendChild(table([[t('ticker'), function (p) { return p.symbol; }, 'num'], [t('qty'), function (p) { return fmt(p.qty, 2); }, 'num'], [t('avg_cost'), function (p) { return p.qty > 0 ? money(p.cost / p.qty, p.currency, 2) : '—'; }, 'num'], [t('price'), function (p) { return p.price === null ? '—' : money(p.price, p.currency, 2); }, 'num'], [t('value'), function (p) { return p.valueILS === null ? '—' : disp(p.valueILS); }, 'num'], [t('pl'), function (p) { return p.pl === null ? '—' : disp(p.pl); }, 'num'], [t('realized'), function (p) { return money(p.realized, p.currency, 0); }, 'num']], pos, { empty: t('journal_empty') }));
        trBox.appendChild(editLink('j-trades'));
        // recommendations: concentration and currency exposure
        var holdings = {}, total = 0, byCur = {};
        rows.forEach(function (o) { if (o.x.valueILS) { var k = (o.r.ticker || '').toUpperCase(); holdings[k] = (holdings[k] || 0) + o.x.valueILS; total += o.x.valueILS; byCur[o.r.currency || 'ILS'] = (byCur[o.r.currency || 'ILS'] || 0) + o.x.valueILS; } });
        pos.forEach(function (p) { if (p.valueILS) { holdings[p.symbol] = (holdings[p.symbol] || 0) + p.valueILS; total += p.valueILS; byCur[p.currency] = (byCur[p.currency] || 0) + p.valueILS; } });
        var rec = [];
        Object.keys(holdings).forEach(function (k) { var sh = holdings[k] / total * 100; if (total > 0 && sh > 25 && Object.keys(holdings).length > 1) rec.push({ level: 'warn', title: k + ': ' + t('rec_concentration'), text: t('rec_concentration_txt').replace('{p}', pct(sh, 0)) }); });
        if (total > 0) rec.push({ level: 'info', title: t('rec_currency_mix'), text: Object.keys(byCur).map(function (c) { return c + ' ' + pct(byCur[c] / total * 100, 0); }).join(' · ') });
        var fees = pos.reduce(function (a, p) { return a + n(toILS(p.fees, p.currency)); }, 0); if (fees > 0) rec.push({ level: 'info', title: t('rec_trade_fees'), text: disp(fees) });
        recBox.innerHTML = ''; recBox.appendChild(recsBox(rec));
        var pf = portfolioPerf(); perfBox.innerHTML = '';
        perfBox.appendChild(totalsBox([[t('cost'), disp(pf.cost)], [t('value'), disp(pf.value)], [t('ret_simple'), pf.simple === null ? '—' : pct(pf.simple, 1), 'big'], [t('ret_irr'), pf.irr === null ? '—' : pct(pf.irr, 1)], [t('trade_fees'), pf.fees ? disp(pf.fees) : '—']]));
        perfBox.appendChild(h('p', { class: 'help', text: t('perf_help') }));
      }
      on('change', draw); on('quotes', draw); draw();
      var stale = quotesStale() || Object.keys(quotes).some(function (k) { return Date.now() - (quotes[k].fetchedAt || 0) > 10 * 60 * 1000; });
      if (stale) refreshQuotes(null, true);
    },
    mortgage: function (main) {
      var box = h('div'), refiBox = h('div'), recBox = h('div'), ins = data.insights;
      main.appendChild(section(t('my_balances'), [box]));
      var boiFields = h('div', { class: 'fields' }, ['t_prime', 't_fixed_unlinked', 't_var_unlinked', 't_var_linked', 't_fixed_linked'].map(function (k) { return fieldInput(ins.boi, { k: k, type: 'number', label: k }, changed); }));
      main.appendChild(section(t('refi_title'), [
        h('p', { class: 'help', text: t('refi_help') }),
        h('h3', { class: 'card-title', style: 'font-size:14px', text: t('boi_avg_rates') + ' (' + ins.boiDate + ')' }), boiFields,
        h('div', { class: 'fields', style: 'margin-top:8px' }, [fieldInput(ins, { k: 'refiFee', type: 'number', label: 'refi_fee' }, changed), fieldInput(ins, { k: 'refiCost', type: 'number', label: 'refi_cost' }, changed)]),
        h('p', { class: 'help' }, [t('boi_src') + ' ', h('a', { href: 'https://www.boi.org.il/roles/statistics/banking/housing_cred/xls_report/', target: '_blank', rel: 'noopener', text: 'boi.org.il' }), ' · ', h('a', { href: 'https://boi.org.il/information/interestrates/mortgage/', target: '_blank', rel: 'noopener', text: t('boi_early_fee_page') })]),
        refiBox], h('span', { class: 'badge amber', text: t('assumptions_badge') })));
      main.appendChild(recBox);
      function draw() {
        var rows = data.mortgage.tracks;
        box.innerHTML = '';
        box.appendChild(table([[t('name'), function (r) { return r.name; }], [t('track_type'), function (r) { return t(r.type || 't_prime'); }], [t('balance'), function (r) { return disp(n(r.balance)); }, 'num'], [t('rate'), function (r) { return pct(n(r.rate), 2); }, 'num'], [t('months'), function (r) { return fmt(n(r.months)); }, 'num'], [t('pmt'), function (r) { return disp(nn(r.payment) !== null ? n(r.payment) : calc.mortgage(r).pmt); }, 'num'], [t('interest_left'), function (r) { return disp(calc.mortgage(r).interest); }, 'num']], rows));
        var b = 0, p = 0; rows.forEach(function (x) { b += n(x.balance); p += nn(x.payment) !== null ? n(x.payment) : calc.mortgage(x).pmt; });
        box.appendChild(totalsBox([[t('total') + ' ' + t('balance'), disp(b), 'big'], [t('pmt'), disp(p)]])); box.appendChild(h('p', { class: 'help', text: t('mortgage_help') })); box.appendChild(editLink('mortgage'));
        refiBox.innerHTML = '';
        var tot = 0, items = rows.map(function (r) {
          var avg = nn(ins.boi[r.type]); if (avg === null || !(n(r.balance) > 0) || !(n(r.months) > 0)) return null;
          var cur = calc.mortgage(r).pmt, nw = calc.mortgage({ balance: r.balance, rate: avg, months: r.months }).pmt, diff = cur - nw, total = diff * n(r.months);
          tot += total; return { r: r, avg: avg, cur: cur, nw: nw, diff: diff, total: total };
        }).filter(Boolean);
        refiBox.appendChild(table([[t('name'), function (x) { return x.r.name || t(x.r.type); }], [t('rate'), function (x) { return pct(n(x.r.rate), 2); }, 'num'], [t('boi_avg'), function (x) { return pct(x.avg, 2); }, 'num'], [t('pmt_now'), function (x) { return disp(x.cur); }, 'num'], [t('pmt_new'), function (x) { return disp(x.nw); }, 'num'], [t('saving_total'), function (x) { return disp(x.total); }, 'num']], items, { empty: t('refi_none') }));
        var net = tot - n(ins.refiFee) - n(ins.refiCost);
        if (items.length) refiBox.appendChild(totalsBox([[t('refi_gross'), disp(tot)], [t('refi_costs'), disp(-(n(ins.refiFee) + n(ins.refiCost)))], [t('refi_net'), disp(net), 'big']]));
        var rec = [];
        if (items.length && net > 0) rec.push({ level: 'warn', title: t('rec_refi'), text: t('rec_refi_txt').replace('{v}', disp(net)) });
        else if (items.length) rec.push({ level: 'good', title: t('rec_refi_no'), text: '' });
        if (items.length && ins.refiFee === null) rec.push({ level: 'info', title: t('rec_refi_fee_missing'), text: '' });
        recBox.innerHTML = ''; recBox.appendChild(recsBox(rec));
      }
      on('change', draw); draw();
    },
    loans: function (main) {
      var box = h('div'), consBox = h('div'), recBox = h('div'), ins = data.insights;
      main.appendChild(section(t('my_balances'), [box]));
      main.appendChild(section(t('consolidate_title'), [h('div', { class: 'fields' }, [fieldInput(ins, { k: 'consolidationRate', type: 'number', label: 'consolidation_rate' }, changed)]), consBox], h('span', { class: 'badge amber', text: t('assumptions_badge') })));
      main.appendChild(recBox);
      function pmtOf(r) { return nn(r.payment) !== null ? n(r.payment) : calc.mortgage(r).pmt; }
      function draw() {
        var rows = data.home.loans.slice().sort(function (a, b) { return n(b.rate) - n(a.rate); });
        box.innerHTML = '';
        box.appendChild(table([[t('order'), function (r) { return String(rows.indexOf(r) + 1); }, 'num'], [t('lender'), function (r) { return r.lender || r.name || '—'; }], [t('rate'), function (r) { return pct(n(r.rate), 2); }, 'num'], [t('balance'), function (r) { return disp(n(r.balance)); }, 'num'], [t('pmt'), function (r) { return disp(pmtOf(r)); }, 'num'], [t('end_date'), function (r) { return fmtYmd(r.endDate); }], [t('interest_left'), function (r) { return disp(calc.mortgage(r).interest); }, 'num']], rows));
        var b = 0, p = 0, i = 0; rows.forEach(function (r) { b += n(r.balance); p += pmtOf(r); i += calc.mortgage(r).interest; });
        box.appendChild(totalsBox([[t('total') + ' ' + t('balance'), disp(b), 'big'], [t('pmt'), disp(p)], [t('interest_left'), disp(i)]]));
        box.appendChild(h('p', { class: 'help', text: t('avalanche_help') })); box.appendChild(editLink('loans'));
        consBox.innerHTML = '';
        var cr = nn(ins.consolidationRate), rec = [];
        if (cr !== null && rows.length >= 2 && b > 0) {
          var maxM = rows.reduce(function (a, r) { return Math.max(a, Math.round(n(r.months))); }, 0);
          var nw = calc.mortgage({ balance: b, rate: cr, months: maxM });
          var save = i - nw.interest;
          consBox.appendChild(totalsBox([[t('cons_pmt'), disp(nw.pmt)], [t('cons_interest'), disp(nw.interest)], [t('cons_saving'), disp(save), 'big']]));
          if (save > 0) rec.push({ level: 'warn', title: t('rec_consolidate'), text: t('rec_consolidate_txt').replace('{v}', disp(save)) });
        } else consBox.appendChild(h('div', { class: 'empty', text: t('cons_need') }));
        var bestDeposit = data.savings.cash.reduce(function (a, r) { return Math.max(a, n(r.rate)); }, 0), liquidCash = data.savings.cash.reduce(function (a, r) { return a + n(toILS(r.balance, r.currency)); }, 0);
        if (rows.length) rec.unshift({ level: 'info', title: t('rec_avalanche'), text: t('rec_avalanche_txt').replace('{name}', rows[0].lender || rows[0].name || '1').replace('{rate}', pct(n(rows[0].rate), 2)) });
        rows.forEach(function (r) { if (n(r.rate) > bestDeposit + 1 && liquidCash > n(r.balance) && n(r.balance) > 0) rec.push({ level: 'warn', title: (r.lender || r.name || '') + ': ' + t('rec_payoff'), text: t('rec_payoff_txt').replace('{rate}', pct(n(r.rate), 2)).replace('{dep}', pct(bestDeposit, 2)) }); });
        recBox.innerHTML = ''; recBox.appendChild(recsBox(rec));
      }
      on('change', draw); draw();
    },
    cards: function (main) {
      var box = h('div'), txBox = h('div'), recBox = h('div');
      main.appendChild(section(t('my_balances'), [box]));
      main.appendChild(section(t('card_tx_title'), [txBox]));
      main.appendChild(compareBox({ cols: [t('card_name'), t('annual_fee'), t('fx_fee'), t('benefits')], sameTrack: false, otherTracks: ['cc_cashback', 'cc_nofee', 'cc_travel'], mine: data.cards.cards.map(function (c) { return [t('mine') + ': ' + (c.name || ''), c.annualFee === undefined || c.annualFee === null ? '—' : disp(n(c.annualFee)), c.fxFee === undefined || c.fxFee === null ? '—' : pct(n(c.fxFee), 2), '—']; }), source: t('src_tbd') }));
      main.appendChild(recBox);
      function draw() {
        var rows = data.cards.cards;
        box.innerHTML = '';
        box.appendChild(table([[t('card_name'), function (r) { return r.name; }], [t('charge'), function (r) { return disp(n(r.charge)); }, 'num'], [t('limit'), function (r) { return disp(n(r.limit)); }, 'num'], [t('utilization'), function (r) { return n(r.limit) > 0 ? pct(n(r.charge) / n(r.limit) * 100, 0) : '—'; }, 'num'], [t('annual_fee'), function (r) { return nn(r.annualFee) === null ? '—' : disp(n(r.annualFee)); }, 'num'], [t('fx_fee'), function (r) { return nn(r.fxFee) === null ? '—' : pct(n(r.fxFee), 2); }, 'num']], rows));
        var c = 0, l = 0; rows.forEach(function (x) { c += n(x.charge); l += n(x.limit); });
        box.appendChild(totalsBox([[t('total') + ' ' + t('charge'), disp(c), 'big'], [t('limit'), disp(l)]])); box.appendChild(editLink('cards'));
        txBox.innerHTML = '';
        var byMonth = {}, feesTx = 0;
        data.journals.cardTx.forEach(function (r) { var m = String(r.date || '').slice(0, 7) || '—'; byMonth[m] = byMonth[m] || { m: m, total: 0, count: 0, fees: 0 }; byMonth[m].total += n(r.amount); byMonth[m].count++; byMonth[m].fees += n(r.fee); feesTx += n(r.fee); });
        var months = Object.keys(byMonth).sort().reverse().map(function (k) { return byMonth[k]; });
        txBox.appendChild(table([[t('month'), function (x) { return x.m; }, 'num'], [t('charges'), function (x) { return disp(x.total); }, 'num'], [t('tx_count'), function (x) { return fmt(x.count); }, 'num'], [t('fees'), function (x) { return disp(x.fees); }, 'num']], months, { empty: t('journal_empty') }));
        txBox.appendChild(editLink('j-cards'));
        var rec = [];
        rows.forEach(function (r) { var u = n(r.limit) > 0 ? n(r.charge) / n(r.limit) * 100 : 0; if (u > 70) rec.push({ level: 'warn', title: (r.name || '') + ': ' + t('rec_util'), text: pct(u, 0) }); if (n(r.annualFee) > 0) rec.push({ level: 'info', title: (r.name || '') + ': ' + t('rec_card_fee'), text: t('rec_card_fee_txt').replace('{v}', disp(n(r.annualFee))) }); });
        if (feesTx > 0) rec.push({ level: 'info', title: t('rec_tx_fees'), text: disp(feesTx) });
        recBox.innerHTML = ''; recBox.appendChild(recsBox(rec));
      }
      on('change', draw); draw();
    },
    budget: function (main) {
      var box = h('div'), goalOut = h('div'), recBox = h('div');
      main.appendChild(section(t('cashflow'), [box]));
      main.appendChild(section(t('goal'), [goalOut]));
      main.appendChild(recBox);
      function draw() {
        var s = calc.summary();
        box.innerHTML = '';
        box.appendChild(table([[t('income'), function (r) { return r.name || '—'; }], [t('amount'), function (r) { return disp(n(r.amount)); }, 'num']], data.home.income));
        var byCat = {}; data.home.expenses.forEach(function (r) { var k = r.category || 'e_other'; byCat[k] = (byCat[k] || 0) + n(r.amount); });
        box.appendChild(table([[t('category'), function (k) { return t(k); }], [t('amount'), function (k) { return disp(byCat[k]); }, 'num'], [t('share'), function (k) { return s.expenses ? pct(byCat[k] / s.expenses * 100, 0) : '—'; }, 'num']], Object.keys(byCat)));
        var items = [[t('income'), disp(s.income)], [t('expenses'), disp(-s.expenses)], [t('surplus'), disp(s.surplus), 'big'], [t('savings_rate'), pct(s.savingsRate)]];
        if (data.home.includeMortgagePmt && s.mortgagePmt > 0) items.splice(2, 0, [t('mortgage_pmt_line'), disp(-s.mortgagePmt)]);
        if (s.loanPmt > 0) items.splice(2, 0, [t('loan_pmt_line'), disp(-s.loanPmt)]);
        box.appendChild(totalsBox(items)); box.appendChild(editLink('budget'));
        goalOut.innerHTML = '';
        var gr = calc.goal(s);
        if (gr) { goalOut.appendChild(totalsBox([[t('required_monthly'), disp(gr.required), 'big'], [t('surplus'), disp(s.surplus)], [t('months_left'), fmt(gr.months)]])); goalOut.appendChild(h('div', { class: 'notice ' + (gr.reached || gr.gap <= 0 ? 'blue' : 'amber'), style: 'margin-top:8px', text: gr.reached ? t('goal_reached') : gr.gap <= 0 ? t('on_track') : t('gap') + ': ' + disp(gr.gap) })); }
        else goalOut.appendChild(h('div', { class: 'empty', text: t('goal_none') }));
        goalOut.appendChild(editLink('goal'));
        var rec = [];
        if (s.income > 0 && s.savingsRate !== null && s.savingsRate < 10) rec.push({ level: 'warn', title: t('rec_low_savings'), text: pct(s.savingsRate) });
        if (s.income > 0 && s.surplus < 0) rec.push({ level: 'bad', title: t('rec_deficit'), text: disp(s.surplus) });
        var top = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; })[0]; if (top && s.expenses > 0) rec.push({ level: 'info', title: t('rec_top_expense'), text: t(top) + ' · ' + pct(byCat[top] / s.expenses * 100, 0) });
        recBox.innerHTML = ''; recBox.appendChild(recsBox(rec));
      }
      on('change', draw); draw();
    },
    home: function (main) {
      if (/(^|[#&])(s|strike|sell|spot|t1)=/.test(location.hash)) { location.replace('options.html' + location.hash); return; }
      var sumBox = h('div'), donutBox = h('div'), catBox = h('div'), optBox = h('div'), insBox = h('div'), peerBox = h('div');
      var heroBox = h('div', { class: 'hero', 'aria-live': 'polite' }), pillBox = h('div', { class: 'pills', role: 'list' }), tileBox = h('div', { class: 'tiles' }), actBox = h('div');
      main.appendChild(heroBox); main.appendChild(pillBox); main.appendChild(tileBox); fundsLoaded();
      main.appendChild(h('h2', { class: 'sec-h', text: t('actions_title') })); main.appendChild(actBox);
      main.appendChild(section(t('net_worth'), [sumBox, editLink('top')]));
      var pillSel = 'all';
      function drawHero(s) {
        heroBox.innerHTML = '';
        var hist = recordHistory(s), first = null, cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        hist.forEach(function (p) { if (!first && p[0] >= cutoff) first = p; });
        heroBox.appendChild(h('p', { class: 'big num', text: disp(s.net) }));
        heroBox.appendChild(h('p', { class: 'sub', text: t('net_worth') }));
        if (first && hist.length > 1 && first[1]) {
          var d = s.net - first[1], pc = d / Math.abs(first[1]) * 100;
          heroBox.appendChild(h('div', { class: 'delta ' + (d >= 0 ? 'pos' : 'neg') }, [h('span', { 'aria-hidden': 'true', text: d >= 0 ? '↑ ' : '↓ ' }), h('span', { class: 'num', text: (d >= 0 ? '+' : '') + pct(pc, 2) + ' (' + disp(d) + ')' }), h('span', { style: 'color:var(--muted);font-weight:400', text: ' · ' + t('since') + ' ' + fmtDate(parseDate(first[0])) })]));
        } else heroBox.appendChild(h('div', { class: 'help', text: t('spark_soon') }));
        heroBox.appendChild(sparkline(hist.map(function (p) { return p[1]; })));
      }
      function tileData(s) {
        var stocks = { v: 0, c: 0 }, crypto = { v: 0, c: 0 };
        data.savings.portfolios.forEach(function (p) {
          var isC = /קריפטו|crypto|cripto/i.test(p.name || '');
          (p.rows || []).forEach(function (r) { var x = calc.portfolioRow(r); if (x.valueILS === null) return; var b = (isC || r.kind === 'crypto') ? crypto : stocks; b.v += x.valueILS; if (x.costILS) b.c += x.costILS; });
        });
        function est(kind) { var v = 0, base = 0, any = false; data[kind].funds.forEach(function (r) { var e = estimateFund(r); base += n(r.balance); if (e.status === 'ok') { any = true; v += e.value; } else v += n(r.balance); }); return { v: v, base: base, any: any }; }
        var pe = est('pension'), hi = est('hishtalmut');
        if (data.maslaka.include !== false) data.maslaka.products.forEach(function (p) { if (!(n(p.balance) > 0)) return; if (p.type === 'hishtalmut') { hi.v += n(p.balance); hi.base += n(p.balance); } else { pe.v += n(p.balance); pe.base += n(p.balance); } });
        return [
          { id: 'stocks', k: t('tile_stocks'), v: stocks.v, d: stocks.c ? (stocks.v - stocks.c) / stocks.c * 100 : null, href: 'portfolio.html', icon: 'chart', cls: 't1' },
          { id: 'crypto', k: t('tile_crypto'), v: crypto.v, d: crypto.c ? (crypto.v - crypto.c) / crypto.c * 100 : null, href: 'portfolio.html', icon: '₿', cls: 't2' },
          { id: 'pension', k: t('nav_pension'), v: pe.v, d: pe.any && pe.base ? (pe.v - pe.base) / pe.base * 100 : null, href: 'pension.html', icon: 'umbrella', cls: 't3' },
          { id: 'hish', k: t('nav_hishtalmut'), v: hi.v, d: hi.any && hi.base ? (hi.v - hi.base) / hi.base * 100 : null, href: 'hishtalmut.html', icon: 'grad', cls: 't4' }
        ];
      }
      function drawTiles(s) {
        var td = tileData(s);
        pillBox.innerHTML = '';
        [['all', t('pill_all'), '']].concat(td.map(function (x) { return [x.id, x.k, x.icon]; })).forEach(function (p) {
          var b = h('button', { type: 'button', class: 'pill' + (pillSel === p[0] ? ' on' : ''), role: 'listitem', 'aria-pressed': pillSel === p[0] ? 'true' : 'false', onclick: function () { pillSel = p[0]; drawTiles(s); } }, [p[2] ? (p[2].length > 2 ? svgIcon(p[2]) : h('i', { 'aria-hidden': 'true', text: p[2] })) : null, h('span', { text: p[1] })]);
          pillBox.appendChild(b);
        });
        tileBox.innerHTML = '';
        td.filter(function (x) { return pillSel === 'all' || pillSel === x.id; }).forEach(function (x) {
          tileBox.appendChild(h('a', { class: 'tile ' + x.cls, href: x.href }, [h('span', { class: 'k', text: x.k }), h('span', { class: 'v num', text: disp(x.v) }),
            x.d === null ? h('span', { class: 'd', style: 'color:var(--muted)', text: '—' }) : h('span', { class: 'd num ' + (x.d >= 0 ? 'pos' : 'neg'), text: (x.d >= 0 ? '↑ +' : '↓ ') + pct(x.d, 2) }),
            h('span', { class: 'ico', 'aria-hidden': 'true' }, [x.icon.length > 2 ? svgIcon(x.icon) : h('span', { style: 'font-size:22px;font-weight:800;color:#c4b5fd', text: x.icon })])]));
        });
      }
      function drawActions() {
        actBox.innerHTML = '';
        var pen = fundRows('pension').filter(function (r) { return r.type === 'pension' && r.balance > 0; }), hish = fundRows('hishtalmut').filter(function (r) { return r.balance > 0; });
        var acts = [];
        if (pen.length > 1 || hish.length > 1) acts.push(['act_merge', 'act_merge_txt', 'pension.html', 'swap']);
        if (pen.some(function (r) { return (r.feeDep !== null && r.feeDep > 1) || (r.feeAcc !== null && r.feeAcc > 0.22); }) || hish.some(function (r) { return r.feeAcc !== null && r.feeAcc > 0.6; })) acts.push(['act_fees', 'act_fees_txt', 'pension.html', 'pie']);
        if (data.pension.funds.concat(data.hishtalmut.funds).some(function (r) { return nn(r.balance) !== null && !r.trackId; })) acts.push(['act_track', 'act_track_txt', 'me.html#pension', 'chart']);
        if (!data.home.goal.amount) acts.push(['act_goal', 'act_goal_txt', 'me.html#goal', 'key']);
        if (!acts.length) acts.push(['act_ok', 'act_ok_txt', 'wealth.html', 'shield']);
        acts.forEach(function (a) { actBox.appendChild(h('a', { class: 'action', href: a[2] }, [h('span', { class: 'ai', 'aria-hidden': 'true' }, [svgIcon(a[3])]), h('span', { class: 'at' }, [h('strong', { text: t(a[0]) }), h('span', { text: t(a[1]) })]), h('span', { class: 'chev', 'aria-hidden': 'true', text: settings.lang === 'he' ? '‹' : '›' })])); });
      }
      main.appendChild(section(t('breakdown'), [donutBox, catBox]));
      var optChk = h('input', { type: 'checkbox', id: 'incl-opt' }); optChk.checked = data.home.includeOptions !== false;
      optChk.addEventListener('change', function () { data.home.includeOptions = optChk.checked; changed(); });
      main.appendChild(section(t('options_from_calc'), [optBox, h('div', { class: 'field check', style: 'margin-top:8px' }, [optChk, h('label', { for: 'incl-opt', text: t('include') })]),
        h('div', { class: 'toolbar' }, [h('a', { class: 'btn btn-soft btn-sm', href: 'options.html', text: t('open_page') + ': ' + t('nav_options') })])]));
      main.appendChild(section(t('insights_title'), [insBox]));
      main.appendChild(section(t('peer_title'), [peerBox], h('span', { class: 'badge', text: t('peer_badge') })));
      main.appendChild(fxCard());
      function draw() {
        var s = calc.summary();
        drawHero(s); drawTiles(s); drawActions();
        sumBox.innerHTML = '';
        sumBox.appendChild(totalsBox([[t('net_worth'), disp(s.net), 'big'], [t('assets_total'), disp(s.assets)], [t('liab_total'), disp(-s.liabs)], [t('liquid'), disp(s.liquid)], [t('locked'), disp(s.locked)], [t('illiquid'), disp(s.illiquid)], [t('surplus'), disp(s.surplus)], [t('savings_rate'), pct(s.savingsRate)]]));
        if (s.missing) sumBox.appendChild(h('div', { class: 'notice amber', style: 'margin-top:8px', text: t('missing_rate') + ': ' + s.missing }));
        var colors = ['#1d4ed8', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#64748b', '#0d9488', '#9333ea'];
        var cats = Object.keys(s.cats).filter(function (k) { return s.cats[k] > 0; }), total = cats.reduce(function (a, k) { return a + s.cats[k]; }, 0);
        donutBox.innerHTML = '';
        if (total > 0) {
          var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '140'); svg.setAttribute('height', '140'); svg.setAttribute('viewBox', '0 0 42 42'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('breakdown'));
          var off = 25, bg = document.createElementNS(NS, 'circle'); bg.setAttribute('cx', 21); bg.setAttribute('cy', 21); bg.setAttribute('r', 15.9155); bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#e2e8f0'); bg.setAttribute('stroke-width', 6); svg.appendChild(bg);
          cats.forEach(function (k, i) { var share = s.cats[k] / total * 100, c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', 21); c.setAttribute('cy', 21); c.setAttribute('r', 15.9155); c.setAttribute('fill', 'none'); c.setAttribute('stroke', colors[i % colors.length]); c.setAttribute('stroke-width', 6); c.setAttribute('stroke-dasharray', share + ' ' + (100 - share)); c.setAttribute('stroke-dashoffset', off); off = (off - share + 100) % 100; svg.appendChild(c); });
          donutBox.appendChild(h('div', { class: 'donut-wrap' }, [svg, h('div', { class: 'legend' }, cats.map(function (k, i) { return h('div', null, [h('span', null, [h('i', { style: 'background:' + colors[i % colors.length] }), t(k)]), h('span', { class: 'num', text: pct(s.cats[k] / total * 100, 0) })]); }))]));
        } else donutBox.appendChild(h('div', { class: 'empty', text: t('none') }));
        var links = { cat_portfolio: 'portfolio.html', cat_trades: 'portfolio.html', cat_cash: 'savings.html', cat_bank: 'savings.html', cat_standing: 'savings.html', cat_pension: 'pension.html', cat_hish: 'hishtalmut.html', cat_options: 'options.html', cat_mortgage: 'mortgage.html', cat_cards: 'cards.html', cat_loans: 'loans.html' };
        var rows = Object.keys(s.cats).map(function (k) { return [k, s.cats[k]]; }).concat(Object.keys(s.liab).filter(function (k) { return s.liab[k] > 0; }).map(function (k) { return [k, -s.liab[k]]; }));
        catBox.innerHTML = '';
        catBox.appendChild(h('table', { class: 'cat-table' }, [h('tbody', null, rows.map(function (r) { return h('tr', null, [h('td', null, [links[r[0]] ? h('a', { href: links[r[0]], text: t(r[0]) }) : t(r[0])]), h('td', { class: 'num ' + (r[1] < 0 ? 'neg' : ''), text: disp(r[1]) })]); }))]));
        optBox.innerHTML = '';
        if (!s.options || !s.options.length) optBox.appendChild(h('div', { class: 'empty', text: t('options_none') }));
        else s.options.forEach(function (o) { optBox.appendChild(h('div', { class: 'fx-line' }, [h('strong', { class: 'num', text: o.symbol }), h('span', { text: t('options_net') + ': ' }), h('span', { class: 'num', text: o.pending ? t('price_pending') : o.netILS === null ? t('missing_rate') : disp(o.netILS) })])); });
        // insights digest: count per category with links
        insBox.innerHTML = '';
        var digest = [['pension.html', 'nav_pension', fundRecs('pension', fundRows('pension')).filter(function (x) { return x.level !== 'info'; }).length], ['hishtalmut.html', 'nav_hishtalmut', fundRecs('hishtalmut', fundRows('hishtalmut')).filter(function (x) { return x.level !== 'info'; }).length]];
        insBox.appendChild(h('div', { class: 'hub' }, digest.concat([['mortgage.html', 'nav_mortgage', null], ['loans.html', 'nav_loans', null], ['cards.html', 'nav_cards', null], ['budget.html', 'nav_budget', null], ['savings.html', 'nav_savings', null], ['portfolio.html', 'nav_portfolio', null]]).map(function (x) {
          return h('a', { class: 'hub-card', href: x[0] }, [h('span', { class: 'k', text: t(x[1]) }), h('span', { class: 'v', text: x[2] === null ? t('see_recs') : x[2] ? t('items_to_check').replace('{n}', x[2]) : t('looks_ok') })]);
        })));
      }
      function drawPeer() {
        peerBox.innerHTML = '';
        var C = window.PortalCloud;
        if (!C || !C.configured) { peerBox.appendChild(h('div', { class: 'empty', text: t('peer_need_cloud') })); return; }
        if (!C.user) { peerBox.appendChild(h('div', { class: 'empty', text: t('peer_need_signin') })); return; }
        if (!data.prefs.peerOptIn) { peerBox.appendChild(h('div', { class: 'empty' }, [t('peer_need_optin') + ' ', h('a', { href: 'me.html#peer', text: t('edit_in_me') })])); return; }
        peerBox.appendChild(h('div', { class: 'empty', text: t('loading') }));
        C.peerCompare().then(function (rows) {
          peerBox.innerHTML = '';
          var ok = (rows || []).filter(function (r) { return r.p50 !== null && r.p50 !== undefined; });
          if (!ok.length) { peerBox.appendChild(h('div', { class: 'empty', text: t('peer_not_enough') })); return; }
          peerBox.appendChild(table([[t('metric'), function (r) { return t('pm_' + r.metric); }], ['P25', function (r) { return peerFmt(r.metric, r.p25); }, 'num'], [t('median'), function (r) { return peerFmt(r.metric, r.p50); }, 'num'], ['P75', function (r) { return peerFmt(r.metric, r.p75); }, 'num'], [t('your_pct'), function (r) { return r.my_pct === null || r.my_pct === undefined ? '—' : fmt(n(r.my_pct)) + '%'; }, 'num'], ['n', function (r) { return '≥' + fmt(Math.floor(n(r.n) / 10) * 10); }, 'num']], ok));
        }, function () { peerBox.innerHTML = ''; peerBox.appendChild(h('div', { class: 'empty', text: t('peer_not_enough') })); });
      }
      function peerFmt(m, v) { if (v === null || v === undefined) return '—'; return m === 'net_worth' ? disp(n(v)) : pct(n(v), m === 'pension_fee_acc' ? 2 : 0); }
      on('change', draw); on('quotes', draw); on('cloud', drawPeer); draw(); drawPeer();
      var stale = quotesStale();
      if (stale) refreshQuotes(null, true);
    }
  };
  function recordHistory(s) {
    if (!Array.isArray(data.history)) data.history = [];
    var hist = data.history, day = new Date().toISOString().slice(0, 10);
    if (!s.missing && Number.isFinite(s.net) && (s.net !== 0 || hist.length)) {
      var last = hist[hist.length - 1];
      if (!last || last[0] !== day) { hist.push([day, Math.round(s.net)]); if (hist.length > 400) hist.splice(0, hist.length - 400); save(); }
      else if (Math.abs(last[1] - s.net) > Math.max(1, Math.abs(s.net) * 0.001)) { last[1] = Math.round(s.net); save(); }
    }
    return hist;
  }
  function sparkline(vals) {
    var NS = 'http://www.w3.org/2000/svg', W = 320, H = 84, svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'spark'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    if (vals.length < 2) vals = vals.length ? [vals[0], vals[0]] : [0, 0];
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = mx - mn || 1;
    var pts = vals.map(function (v, i) { return [(i / (vals.length - 1)) * (W - 8) + 4, H - 8 - (v - mn) / rg * (H - 20)]; });
    if (document.documentElement.dir === 'rtl') { /* time runs left→right like the mockup */ }
    var id = 'sg' + uid(), defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/></linearGradient><linearGradient id="' + id + 'f" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6366f1" stop-opacity=".35"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></linearGradient>';
    svg.appendChild(defs);
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = document.createElementNS(NS, 'path'); area.setAttribute('d', d + ' L' + pts[pts.length - 1][0] + ' ' + H + ' L' + pts[0][0] + ' ' + H + ' Z'); area.setAttribute('fill', 'url(#' + id + 'f)'); svg.appendChild(area);
    var line = document.createElementNS(NS, 'path'); line.setAttribute('d', d); line.setAttribute('fill', 'none'); line.setAttribute('stroke', 'url(#' + id + ')'); line.setAttribute('stroke-width', '3'); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(line);
    var dot = document.createElementNS(NS, 'circle'), lp = pts[pts.length - 1]; dot.setAttribute('cx', lp[0]); dot.setAttribute('cy', lp[1]); dot.setAttribute('r', '4.5'); dot.setAttribute('fill', '#60a5fa'); svg.appendChild(dot);
    return svg;
  }
  /* ---------- me.html: the single input hub ---------- */
  function fundSchema(kind) {
    var fields = [{ k: 'name', type: 'text', label: 'provider_track' }];
    if (kind === 'pension') fields.push({ k: 'kind', type: 'select', label: 'kind', options: opts(['k_pension', 'k_gemel', 'k_gemel_inv', 'k_insurance']) });
    fields.push({ k: 'trackId', type: 'track', label: 'track_pick', kind: kind });
    fields = fields.concat([{ k: 'balance', type: 'number', label: 'balance' }, { k: 'baseDate', type: 'date', label: 'balance_date' }, { k: 'deposit', type: 'number', label: 'monthly_deposit' }, { k: 'feeBal', type: 'number', label: 'fee_bal' }, { k: 'feeDep', type: 'number', label: 'fee_dep' }, { k: 'ret', type: 'number', label: 'exp_ret' }]);
    if (kind === 'pension') fields.push({ k: 'age', type: 'number', label: 'age' }, { k: 'retireAge', type: 'number', label: 'retire_age' });
    else fields.push({ k: 'openDate', type: 'date', label: 'open_date' });
    fields.push({ k: 'target', type: 'date', label: 'target_date' });
    return { fields: fields, outputs: function (r) { var f = calc.fund(r, kind), o = [[t('deposit_net'), disp(f.depositNet)], [t('projected'), f.projected === null ? '—' : disp(f.projected), 'pos']]; if (kind === 'hishtalmut') o.push([t('liquid_from'), f.liquidFrom ? fmtDate(f.liquidFrom) : '—', f.liquid ? 'pos' : '']); return o; } };
  }
  var JOURNALS = {
    bank: { fields: [{ k: 'date', type: 'date', label: 'date' }, { k: 'account', type: 'text', label: 'account' }, { k: 'kind', type: 'select', label: 'entry_kind', options: [['tx', 'j_tx'], ['balance', 'j_balance']] }, { k: 'amount', type: 'number', label: 'amount_signed' }, { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'desc', type: 'text', label: 'description' }],
      cols: { date: /^(date|תאריך|תאריך ערך|תאריך פעולה|value date)$/i, account: /^(account|חשבון|מספר חשבון)$/i, amount: /^(amount|סכום|סכום פעולה)$/i, credit: /^(credit|זכות|בזכות)$/i, debit: /^(debit|חובה|בחובה)$/i, balance: /^(balance|יתרה|יתרה בש"ח|יתרה בשח)$/i, desc: /^(description|תיאור|פרטים|הפעולה|תיאור התנועה)$/i, currency: /^(currency|מטבע)$/i },
      template: 'date,account,amount,balance,description,currency\n2026-11-01,Checking 1234,-250,,Supermarket (example),ILS\n2026-11-02,Checking 1234,12000,15200,Salary (example),ILS\n' },
    trades: { fields: [{ k: 'date', type: 'date', label: 'date' }, { k: 'ticker', type: 'text', label: 'ticker', upper: true, ph: 'LUMI.TA' }, { k: 'side', type: 'select', label: 'side', options: [['buy', 'buy'], ['sell', 'sell']] }, { k: 'qty', type: 'number', label: 'qty' }, { k: 'price', type: 'number', label: 'price' }, { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'fee', type: 'number', label: 'fee' }],
      cols: { date: /^(date|תאריך|תאריך ביצוע|trade date)$/i, ticker: /^(ticker|symbol|סימול|נייר|שם נייר|מספר נייר)$/i, side: /^(side|action|פעולה|סוג פעולה|קניה\/מכירה)$/i, qty: /^(qty|quantity|כמות)$/i, price: /^(price|מחיר|שער|שער ביצוע)$/i, fee: /^(fee|fees|commission|עמלה|עמלות)$/i, currency: /^(currency|מטבע)$/i },
      template: 'date,ticker,side,qty,price,fee,currency\n2025-03-10,NVDA,buy,10,110,5,USD\n2025-06-01,LUMI.TA,buy,100,48.5,10,ILS\n' },
    cardTx: { fields: [{ k: 'date', type: 'date', label: 'date' }, { k: 'card', type: 'text', label: 'card_name' }, { k: 'amount', type: 'number', label: 'amount' }, { k: 'desc', type: 'text', label: 'merchant' }, { k: 'fee', type: 'number', label: 'fee' }],
      cols: { date: /^(date|תאריך|תאריך עסקה|תאריך רכישה)$/i, card: /^(card|כרטיס|4 ספרות אחרונות|מספר כרטיס)$/i, amount: /^(amount|סכום|סכום חיוב|סכום החיוב|סכום חיוב בש"ח)$/i, desc: /^(merchant|description|שם בית העסק|בית עסק|תיאור)$/i, fee: /^(fee|עמלה|עמלות)$/i },
      template: 'date,card,amount,merchant,fee\n2026-11-03,Card 5678,320.5,Supermarket (example),0\n' }
  };
  function parseNum(v) { if (typeof v === 'number') return v; var s = String(v || '').trim(); if (!s) return null; var neg = /^\(.*\)$/.test(s) || /-$/.test(s); s = s.replace(/[()₪$€,\s]/g, '').replace(/-$/, ''); var x = parseFloat(s); return Number.isFinite(x) ? (neg ? -Math.abs(x) : x) : null; }
  function parseAnyDate(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    var s = String(v || '').trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s))) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    return '';
  }
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    var first = text.split(/\r?\n/)[0] || '', delim = [',', ';', '\t'].map(function (d) { return [d, first.split(d).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  function readTable(file) {
    return file.arrayBuffer().then(function (buf) {
      var u = new Uint8Array(buf.slice(0, 4));
      var isBin = (u[0] === 0x50 && u[1] === 0x4B) || (u[0] === 0xD0 && u[1] === 0xCF);
      if (isBin) return new Promise(function (res, rej) {
        if (window.XLSX) return res(window.XLSX);
        var s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = function () { res(window.XLSX); }; s.onerror = rej; document.head.appendChild(s);
      }).then(function (X) { var wb = X.read(new Uint8Array(buf), { type: 'array' }); return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }); });
      var txt = new TextDecoder('utf-8').decode(buf);
      if (txt.indexOf('\uFFFD') >= 0) { try { txt = new TextDecoder('windows-1255').decode(buf); } catch (e) {} }
      return parseCSV(txt);
    });
  }
  function importJournal(kind, rows) {
    var J = JOURNALS[kind], hr = -1, map = {};
    for (var r = 0; r < Math.min(15, rows.length) && hr < 0; r++) {
      var m = {}; rows[r].forEach(function (cell, j) { var c = String(cell || '').trim(); Object.keys(J.cols).forEach(function (k) { if (m[k] === undefined && J.cols[k].test(c)) m[k] = j; }); });
      if (m.date !== undefined && (m.amount !== undefined || m.credit !== undefined || m.debit !== undefined || m.balance !== undefined || m.qty !== undefined)) { hr = r; map = m; }
    }
    if (hr < 0) return { error: true };
    var out = [], lastBal = {};
    rows.slice(hr + 1).forEach(function (row) {
      var g = function (k) { return map[k] === undefined ? '' : row[map[k]]; }, d = parseAnyDate(g('date')); if (!d) return;
      if (kind === 'bank') {
        var acc = String(g('account') || t('account') + ' 1').trim(), amt = parseNum(g('amount'));
        if (amt === null && (map.credit !== undefined || map.debit !== undefined)) amt = (parseNum(g('credit')) || 0) - Math.abs(parseNum(g('debit')) || 0);
        var cur = String(g('currency') || 'ILS').toUpperCase(); if (!CUR[cur]) cur = 'ILS';
        if (amt !== null) out.push({ id: uid(), date: d, account: acc, kind: 'tx', amount: amt, currency: cur, desc: String(g('desc') || '') });
        var bal = parseNum(g('balance')); if (bal !== null && (!lastBal[acc] || d >= lastBal[acc].date)) lastBal[acc] = { id: uid(), date: d, account: acc, kind: 'balance', amount: bal, currency: cur, desc: t('j_balance') };
      } else if (kind === 'trades') {
        var side = /sell|מכיר|מכירה|s/i.test(String(g('side'))) && !/buy|קני/i.test(String(g('side'))) ? 'sell' : 'buy', c2 = String(g('currency') || 'ILS').toUpperCase();
        var qty = parseNum(g('qty')); if (qty !== null && qty < 0) { side = 'sell'; qty = -qty; }
        if (!String(g('ticker')).trim() || qty === null) return;
        out.push({ id: uid(), date: d, ticker: String(g('ticker')).trim().toUpperCase(), side: side, qty: qty, price: parseNum(g('price')) || 0, currency: CUR[c2] ? c2 : 'ILS', fee: parseNum(g('fee')) || 0 });
      } else {
        var a2 = parseNum(g('amount')); if (a2 === null) return;
        out.push({ id: uid(), date: d, card: String(g('card') || '').trim(), amount: a2, desc: String(g('desc') || ''), fee: parseNum(g('fee')) || 0 });
      }
    });
    // balance entries sit at the end of their day so same-day transactions are already included in them
    Object.keys(lastBal).forEach(function (k) { out.push(lastBal[k]); });
    return { rows: out };
  }
  function journalEditor(kind, list) {
    var J = JOURNALS[kind], box = h('div'), draft = { id: uid() }, showAll = false;
    J.fields.forEach(function (f) { if (f.type === 'select') draft[f.k] = (typeof f.options === 'function' ? f.options() : f.options)[0][0]; });
    var form = h('div', { class: 'fields' });
    function drawForm() { form.innerHTML = ''; J.fields.forEach(function (f) { var ff = f.type === 'select' ? { k: f.k, type: 'select', label: f.label, options: f.options.map(function (o) { return [o[0], t(o[1]) || o[1]]; }) } : f; form.appendChild(fieldInput(draft, ff, function () {})); }); }
    drawForm();
    var file = h('input', { type: 'file', id: 'j-file-' + kind, accept: '.csv,.xlsx,.xls,text/csv', class: 'hidden' }), msg = h('div');
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return; msg.innerHTML = '';
      readTable(f).then(function (rows) {
        var res = importJournal(kind, rows);
        if (res.error || !res.rows.length) { msg.appendChild(h('div', { class: 'notice amber', text: t('import_cols_bad') + ' ' + J.template.split('\n')[0] })); return; }
        Array.prototype.push.apply(list, res.rows); changed(); draw();
        msg.appendChild(h('div', { class: 'notice blue', text: t('imported_rows').replace('{n}', res.rows.length) }));
      }, function () { msg.appendChild(h('div', { class: 'notice red', text: t('import_bad_file') })); }).then(function () { file.value = ''; });
    });
    var tbl = h('div');
    function draw() {
      tbl.innerHTML = '';
      var rows = list.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      var shown = showAll ? rows : rows.slice(0, 30);
      var cols = J.fields.map(function (f) { return [t(f.label), function (r) { var v = r[f.k]; if (f.type === 'select') return t((f.options.filter(function (o) { return o[0] === v; })[0] || [v, v])[1]) || v; if (f.type === 'date') return fmtYmd(v); if (f.type === 'number') return v === null || v === undefined || v === '' ? '—' : fmt(n(v), 2); return v || '—'; }, f.type === 'number' ? 'num' : null]; });
      cols.push(['', function (r) { return h('button', { type: 'button', class: 'btn btn-danger btn-sm', 'aria-label': t('del'), text: '×', onclick: function () { var i = list.indexOf(r); if (i >= 0) list.splice(i, 1); changed(); draw(); } }); }]);
      tbl.appendChild(table(cols, shown, { empty: t('journal_empty') }));
      if (rows.length > 30) tbl.appendChild(h('button', { type: 'button', class: 'btn btn-sm', text: showAll ? t('show_less') : t('show_all') + ' (' + rows.length + ')', onclick: function () { showAll = !showAll; draw(); } }));
    }
    box.appendChild(form);
    box.appendChild(h('div', { class: 'toolbar' }, [
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', text: t('add_entry'), onclick: function () { if (!draft.date) draft.date = new Date().toISOString().slice(0, 10); list.push(draft); draft = { id: uid(), date: draft.date }; J.fields.forEach(function (f) { if (f.type === 'select') draft[f.k] = f.options[0][0]; }); changed(); drawForm(); draw(); } }),
      h('button', { type: 'button', class: 'btn btn-soft btn-sm', text: t('import_csv'), onclick: function () { file.click(); } }), file,
      h('button', { type: 'button', class: 'btn btn-sm', text: t('template'), onclick: function () { var b = new Blob(['\uFEFF' + J.template], { type: 'text/csv' }), u = URL.createObjectURL(b), a = h('a', { href: u, download: 'template-' + kind + '.csv' }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); } })
    ]));
    box.appendChild(msg); box.appendChild(tbl); draw();
    return box;
  }
  function passwordDialog(retry) {
    return new Promise(function (resolve) {
      var dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('zip_password') });
      var inp = h('input', { type: 'password', autocomplete: 'off', 'aria-label': t('zip_password') });
      function done(v) { dlg.remove(); resolve(v); }
      dlg.appendChild(h('div', { class: 'modal-card' }, [h('h2', { class: 'card-title', text: t('zip_password') }), h('p', { class: 'help', text: (retry ? t('zip_password_wrong') + ' ' : '') + t('zip_password_help') }), inp,
        h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-primary', text: t('ok'), onclick: function () { done(inp.value || null); } }), h('button', { type: 'button', class: 'btn', text: t('cancel'), onclick: function () { done(null); } })])]));
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(inp.value || null); });
      document.body.appendChild(dlg); setTimeout(function () { inp.focus(); }, 30);
    });
  }
  function maslakaUpload() {
    var M = window.PortalMaslaka, msg = h('div'), list = h('div');
    var file = h('input', { type: 'file', id: 'maslaka-file', multiple: true, accept: '.xml,.zip,.xls,.xlsx,.pdf,application/xml,text/xml,application/zip' });
    var inc = h('input', { type: 'checkbox', id: 'maslaka-inc' }); inc.checked = data.maslaka.include !== false;
    inc.addEventListener('change', function () { data.maslaka.include = inc.checked; changed(); });
    file.addEventListener('change', function () {
      var files = file.files; if (!files || !files.length) return;
      msg.innerHTML = ''; msg.appendChild(h('div', { class: 'notice blue', text: t('reading') }));
      M.readFiles(files, passwordDialog).then(function (res) {
        data.maslaka.products = res.products; data.maslaka.files = res.files; data.maslaka.reportDate = res.reportDate; data.maslaka.importedAt = new Date().toISOString();
        changed(); msg.innerHTML = '';
        var tot = res.products.reduce(function (a, p) { return a + n(p.balance); }, 0);
        msg.appendChild(h('div', { class: 'notice blue', id: 'maslaka-ok', text: t('maslaka_ok').replace('{n}', res.products.length).replace('{v}', disp(tot)) }));
        drawList();
      }, function (e) {
        var code = e && e.code, key = { PDF: 'm_err_pdf', PDF_ONLY: 'm_err_pdf', BAD_XML: 'm_err_xml', NOT_MASLAKA: 'm_err_not', BAD_PASSWORD: 'm_err_pw', CANCELLED: 'm_err_cancel', LIB: 'm_err_lib' }[code] || 'm_err_other';
        msg.innerHTML = ''; msg.appendChild(h('div', { class: 'notice ' + (code === 'PDF' || code === 'PDF_ONLY' ? 'amber' : 'red'), id: 'maslaka-err', text: t(key) }));
      }).then(function () { file.value = ''; });
    });
    function drawList() {
      list.innerHTML = '';
      var ps = data.maslaka.products;
      if (!ps.length) return;
      list.appendChild(table([[t('provider'), function (p) { return p.provider || '—'; }], [t('kind'), function (p) { return typeLabel(p.type); }], [t('account'), function (p) { return p.account || '—'; }, 'num'], [t('balance'), function (p) { return p.balance === null ? '—' : disp(n(p.balance)); }, 'num'], [t('fee_dep'), function (p) { return feeCell(p.feeDep); }, 'num'], [t('fee_bal'), function (p) { return feeCell(p.feeAcc, p.feeAccDerived); }, 'num'], [t('track'), function (p) { return p.track || '—'; }], [t('updated'), function (p) { return fmtYmd(p.updated); }]], ps));
      var tp = 0, th = 0; ps.forEach(function (p) { if (p.type === 'hishtalmut') th += n(p.balance); else tp += n(p.balance); });
      list.appendChild(totalsBox([[t('nav_pension'), disp(tp)], [t('nav_hishtalmut'), disp(th)], [t('total'), disp(tp + th), 'big']]));
      list.appendChild(h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('maslaka_clear'), onclick: function () { if (!confirm(t('maslaka_clear') + '?')) return; data.maslaka = { products: [], files: [], reportDate: '', importedAt: '', include: inc.checked }; changed(); drawList(); msg.innerHTML = ''; } })]));
    }
    drawList();
    return section(t('maslaka_upload_title'), [
      h('p', { class: 'help', text: t('maslaka_upload_help') }),
      h('div', { class: 'toolbar' }, [h('a', { class: 'btn btn-soft btn-sm', href: MASLAKA_URL, target: '_blank', rel: 'noopener', text: t('maslaka_open') }), h('a', { class: 'btn btn-sm', href: 'samples/maslaka-sample-FAKE.xml', download: '', text: t('maslaka_sample') })]),
      h('label', { class: 'upload', for: 'maslaka-file' }, [h('strong', { text: t('maslaka_choose') }), h('span', { class: 'help', text: t('maslaka_formats') }), file]),
      msg,
      h('div', { class: 'field check', style: 'margin-top:8px' }, [inc, h('label', { for: 'maslaka-inc', text: t('maslaka_include') })]),
      list,
      h('p', { class: 'footer-note', text: t('maslaka_privacy') })
    ], h('span', { class: 'badge green', text: t('in_browser_only') }));
  }
  function anchor(id, el) { el.id = id; return el; }
  function meGuide() {
    return section(t('guide_title'), [h('div', { class: 'guide' }, [
      h('h3', { text: t('g_maslaka_h') }), h('ol', { class: 'steps' }, ['ms1', 'ms2', 'ms3', 'ms4', 'ms5'].map(function (k) { return h('li', { text: t(k) }); })),
      h('h3', { text: t('g_bank_h') }), h('p', { text: t('g_bank') }),
      h('h3', { text: t('g_cards_h') }), h('p', { text: t('g_cards') }),
      h('h3', { text: t('g_trades_h') }), h('p', { text: t('g_trades') }),
      h('h3', { text: t('g_mortgage_h') }), h('p', { text: t('g_mortgage') })
    ])]);
  }
  pageRenderers.me = function (main) {
    var C = window.PortalCloud, gate = h('div'), body = h('div');
    main.appendChild(gate); main.appendChild(body);
    function build() {
      body.innerHTML = '';
      var idx = [['maslaka', 'maslaka_upload_title'], ['pension', 'nav_pension'], ['hishtalmut', 'nav_hishtalmut'], ['cash', 'cash_title'], ['standing', 'standing_title'], ['portfolios', 'portfolios_title'], ['j-trades', 'j_trades'], ['j-bank', 'j_bank'], ['mortgage', 'nav_mortgage'], ['loans', 'nav_loans'], ['cards', 'nav_cards'], ['j-cards', 'j_cards'], ['budget', 'nav_budget'], ['assets', 'other_assets'], ['goal', 'goal'], ['peer', 'peer_title'], ['guide', 'guide_title']];
      if (window.PortalAvatar) body.appendChild(anchor('avatar', section(window.PortalAvatar.title(), [window.PortalAvatar.studio(function (v) { return disp(v); })])));
      body.appendChild(anchor('top', section(t('me_index'), [h('div', { class: 'chips' }, idx.map(function (x) { return h('a', { class: 'chip', href: '#' + x[0], text: t(x[1]) }); }))])));
      body.appendChild(anchor('maslaka', maslakaUpload()));
      [['pension', 'pension'], ['hishtalmut', 'hishtalmut']].forEach(function (x) { var box = h('div'); renderList(box, data[x[0]].funds, fundSchema(x[0])); body.appendChild(anchor(x[0], section(t('manual_funds') + ' · ' + t('nav_' + x[0]), [h('p', { class: 'help', text: t('manual_funds_help') }), box]))); });
      var cashBox = h('div'); renderList(cashBox, data.savings.cash, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'kind', type: 'select', label: 'kind', options: opts(['c_checking', 'c_savings', 'c_deposit', 'c_mmf']) }, { k: 'balance', type: 'number', label: 'balance' }, { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'rate', type: 'number', label: 'rate' }, { k: 'maturity', type: 'date', label: 'maturity' }] });
      body.appendChild(anchor('cash', section(t('cash_title'), [cashBox])));
      var stBox = h('div'); renderList(stBox, data.savings.standing, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'monthly', type: 'number', label: 'monthly_amount' }, { k: 'start', type: 'date', label: 'start_date' }, { k: 'ret', type: 'number', label: 'exp_ret' }, { k: 'target', type: 'date', label: 'target_date' }, { k: 'include', type: 'check', label: 'include_nw', def: true }] });
      body.appendChild(anchor('standing', section(t('standing_title'), [stBox, h('p', { class: 'help', text: t('standing_help') })])));
      var pfWrap = h('div'), pfLists = [];
      function drawPf() {
        pfWrap.innerHTML = '';
        pfLists = [];
        data.savings.portfolios.forEach(function (p, pi) {
          var nameIn = h('input', { type: 'text', 'aria-label': t('portfolio_name'), placeholder: t('portfolio_name') }); nameIn.value = p.name || '';
          nameIn.addEventListener('input', function () { p.name = nameIn.value; changed(); });
          var box = h('div');
          var l = renderList(box, p.rows, { fields: [
              { k: 'kind', type: 'select', label: 'holding_kind', options: [['auto', t('hk_auto')], ['stock', t('hk_stock')], ['etf', t('hk_etf')], ['fund', t('hk_fund')], ['bond', t('hk_bond')], ['crypto', t('hk_crypto')]] },
              { k: 'ticker', type: 'security', label: 'security_or_ticker', ph: t('security_ph') },
              { k: 'qty', type: 'number', label: 'qty', step: 'any' },
              { k: 'entry', type: 'number', label: 'entry' },
              { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS },
              { k: 'manual', type: 'number', label: 'manual_price' }
            ],
            outputs: function (r) {
              var x = calc.portfolioRow(r), cur = r.currency || (x.resolved && x.resolved.currency) || 'ILS';
              var priceText = x.price === null ? t('price_pending') : money(x.price, cur, priceDecimals(x.price));
              var stamp = x.quote ? quoteLabel(x.quote) + (x.convertedFrom ? ' · ' + x.convertedFrom + '→' + cur : '')
                : (x.manual ? t('manual') : (x.needsManual ? t('fund_manual') : t('price_pending')));
              if (x.resolved && x.resolved.name && x.resolved.name !== r.ticker) stamp = x.resolved.name + (stamp ? ' · ' + stamp : '');
              return [[t('price'), priceText, '', stamp],
                      [t('value'), x.valueILS === null ? t('price_pending') : disp(x.valueILS)], [t('cost'), disp(x.costILS)],
                      [t('pl'), x.pl === null ? t('price_pending') : disp(x.pl) + ' (' + pct(x.plPct) + ')', x.pl === null ? '' : x.pl >= 0 ? 'pos' : 'neg']];
            }
          });
          pfLists.push(l);
          pfWrap.appendChild(h('div', { class: 'row-card' }, [h('div', { class: 'portfolio-head' }, [h('strong', { text: t('portfolio') + ':' }), nameIn, h('button', { type: 'button', class: 'btn btn-danger btn-sm', text: t('del_portfolio'), onclick: function () { if (!p.rows.length || confirm(t('del_portfolio') + '?')) { data.savings.portfolios.splice(pi, 1); changed(); drawPf(); } } })]), box]));
        });
      }
      drawPf();
      on('quotes', function () { pfLists.forEach(function (l) { if (l && l.refresh) l.refresh(); }); });
      body.appendChild(anchor('portfolios', section(t('portfolios_title'), [pfWrap, h('div', { class: 'toolbar' }, [h('button', { type: 'button', class: 'btn btn-soft', text: t('add_portfolio'), onclick: function () { data.savings.portfolios.push({ id: uid(), name: '', rows: [] }); changed(); drawPf(); } })]), h('p', { class: 'help', text: t('ticker_help') })])));
      body.appendChild(anchor('j-trades', section(t('j_trades'), [h('p', { class: 'help', text: t('j_trades_help') }), journalEditor('trades', data.journals.trades), checkPref(data.journals, 'includeTrades', 'include_nw')])));
      body.appendChild(anchor('j-bank', section(t('j_bank'), [h('p', { class: 'help', text: t('j_bank_help') }), journalEditor('bank', data.journals.bank), checkPref(data.journals, 'includeBank', 'include_nw')])));
      var mBox = h('div'); renderList(mBox, data.mortgage.tracks, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'type', type: 'select', label: 'track_type', options: opts(['t_prime', 't_fixed_unlinked', 't_fixed_linked', 't_var_linked', 't_var_unlinked', 't_other']) }, { k: 'balance', type: 'number', label: 'balance' }, { k: 'rate', type: 'number', label: 'rate' }, { k: 'months', type: 'number', label: 'months', step: '1' }, { k: 'payment', type: 'number', label: 'payment_actual' }], outputs: function (r) { return [[t('pmt'), disp(calc.mortgage(r).pmt), 'neg']]; } });
      body.appendChild(anchor('mortgage', section(t('nav_mortgage'), [mBox])));
      var lBox = h('div'); renderList(lBox, data.home.loans, { fields: [{ k: 'lender', type: 'text', label: 'lender' }, { k: 'name', type: 'text', label: 'name' }, { k: 'balance', type: 'number', label: 'balance' }, { k: 'rate', type: 'number', label: 'rate' }, { k: 'months', type: 'number', label: 'months', step: '1' }, { k: 'payment', type: 'number', label: 'payment_actual' }, { k: 'endDate', type: 'date', label: 'end_date' }], outputs: function (r) { return [[t('pmt'), disp(calc.mortgage(r).pmt), 'neg']]; } });
      body.appendChild(anchor('loans', section(t('nav_loans'), [lBox])));
      var cBox = h('div'); renderList(cBox, data.cards.cards, { fields: [{ k: 'name', type: 'text', label: 'card_name' }, { k: 'charge', type: 'number', label: 'charge' }, { k: 'limit', type: 'number', label: 'limit' }, { k: 'billingDay', type: 'number', label: 'billing_day', step: '1', min: '1' }, { k: 'annualFee', type: 'number', label: 'annual_fee' }, { k: 'fxFee', type: 'number', label: 'fx_fee_pct' }] });
      body.appendChild(anchor('cards', section(t('nav_cards'), [cBox, checkPref(data.home, 'includeCards', 'incl_cards')])));
      body.appendChild(anchor('j-cards', section(t('j_cards'), [h('p', { class: 'help', text: t('j_cards_help') }), journalEditor('cardTx', data.journals.cardTx)])));
      var iBox = h('div'), eBox = h('div');
      renderList(iBox, data.home.income, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'amount', type: 'number', label: 'amount' }] });
      renderList(eBox, data.home.expenses, { fields: [{ k: 'category', type: 'select', label: 'category', options: opts(['e_housing', 'e_food', 'e_car', 'e_insurance', 'e_telecom', 'e_leisure', 'e_other']) }, { k: 'name', type: 'text', label: 'name' }, { k: 'amount', type: 'number', label: 'amount' }] });
      body.appendChild(anchor('budget', section(t('nav_budget'), [h('h3', { class: 'card-title', style: 'font-size:14px', text: t('income') }), iBox, h('h3', { class: 'card-title', style: 'font-size:14px', text: t('expenses') }), eBox, checkPref(data.home, 'includeMortgagePmt', 'incl_mortgage_pmt')])));
      var aBox = h('div'); renderList(aBox, data.home.assets, { fields: [{ k: 'name', type: 'text', label: 'name' }, { k: 'type', type: 'select', label: 'kind', options: opts(['a_realestate', 'a_crypto', 'a_car', 'a_business', 'a_other']) }, { k: 'value', type: 'number', label: 'value' }, { k: 'currency', type: 'select', label: 'row_currency', options: CUR_OPTS }, { k: 'liquid', type: 'check', label: 'liquid_flag', def: false }] });
      body.appendChild(anchor('assets', section(t('other_assets'), [aBox])));
      var g = data.home.goal;
      body.appendChild(anchor('goal', section(t('goal'), [h('div', { class: 'fields' }, [fieldInput(g, { k: 'amount', type: 'number', label: 'goal_amount' }, changed), fieldInput(g, { k: 'date', type: 'date', label: 'goal_date' }, changed), fieldInput(g, { k: 'base', type: 'select', label: 'goal_base', options: [['net', t('base_net')], ['liquid', t('base_liquid')]] }, changed), fieldInput(g, { k: 'ret', type: 'number', label: 'goal_ret' }, changed)])])));
      body.appendChild(anchor('peer', peerCard()));
      body.appendChild(anchor('guide', meGuide()));
    }
    function checkPref(obj, key, label) {
      var id = 'cp-' + uid(), c = h('input', { type: 'checkbox', id: id }); c.checked = obj[key] !== false;
      c.addEventListener('change', function () { obj[key] = c.checked; changed(); });
      return h('div', { class: 'field check', style: 'margin-top:8px' }, [c, h('label', { for: id, text: t(label) })]);
    }
    function peerCard() {
      var box = h('div');
      function draw() {
        box.innerHTML = '';
        var C2 = window.PortalCloud;
        if (!C2 || !C2.configured || !C2.user) { box.appendChild(h('div', { class: 'empty', text: t('peer_need_signin') })); return; }
        var c = h('input', { type: 'checkbox', id: 'peer-opt' }); c.checked = !!data.prefs.peerOptIn;
        var age = fieldInput(data.prefs, { k: 'ageBand', type: 'select', label: 'age_band', options: [['', t('age_any')], ['<30', '<30'], ['30-39', '30-39'], ['40-49', '40-49'], ['50-59', '50-59'], ['60+', '60+']] }, function () { changed(); submit(); });
        c.addEventListener('change', function () { data.prefs.peerOptIn = c.checked; changed(); if (c.checked) submit(); else C2.peerWithdraw(); });
        box.appendChild(h('div', { class: 'field check' }, [c, h('label', { for: 'peer-opt', text: t('peer_optin') })]));
        box.appendChild(age);
        box.appendChild(h('p', { class: 'help', text: t('peer_explain') }));
      }
      function submit() {
        var C2 = window.PortalCloud; if (!C2 || !C2.user || !data.prefs.peerOptIn) return;
        var s = calc.summary(), fees = fundRows('pension').filter(function (r) { return r.type === 'pension' && r.feeAcc !== null && r.balance > 0; });
        var w = fees.reduce(function (a, r) { return a + r.balance; }, 0), fee = w ? fees.reduce(function (a, r) { return a + r.feeAcc * r.balance; }, 0) / w : null;
        C2.peerSubmit({ age_band: data.prefs.ageBand || '', net_worth: Math.round(s.net / 10000) * 10000, savings_rate: s.savingsRate === null ? null : Math.round(s.savingsRate), pension_fee_acc: fee === null ? null : Math.round(fee * 100) / 100 });
      }
      on('cloud', draw); draw();
      return section(t('peer_title'), [box]);
    }
    function showGate() {
      gate.innerHTML = '';
      var C2 = window.PortalCloud;
      var need = C2 && C2.configured && !C2.user && sessionStorage.getItem('me-local') !== '1';
      if (!need) { gate.classList.add('hidden'); if (!body.firstChild) build(); body.classList.remove('hidden'); return; }
      body.classList.add('hidden'); gate.classList.remove('hidden');
      gate.appendChild(section(t('me_gate_title'), [h('p', { text: t('me_gate_text') }), h('div', { class: 'toolbar' }, [
        h('button', { type: 'button', class: 'btn btn-primary', id: 'gate-signin', text: t('sign_in'), onclick: function () { C2.openDialog(); } }),
        h('button', { type: 'button', class: 'btn', id: 'gate-local', text: t('continue_local'), onclick: function () { sessionStorage.setItem('me-local', '1'); showGate(); } })])]));
    }
    if (C && C.configured && C.ready) { gate.appendChild(h('div', { class: 'empty', text: t('loading') })); C.ready.then(showGate, showGate); }
    else showGate();
    on('cloud', showGate);
    setTimeout(function () { if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); } }, 50);
  };

  function init() {
    var page = document.body.getAttribute('data-page') || 'home';
    var root = $('portal');
    chrome(page).forEach(function (e) { root.appendChild(e); });
    var titles = { home: ['home_title', 'home_sub'], wealth: ['wealth_title', 'wealth_sub'], pension: ['pension_title', 'pension_sub'], hishtalmut: ['hish_title', 'hish_sub'], mortgage: ['mortgage_title', 'mortgage_sub'], loans: ['loans_title', 'loans_sub'], cards: ['cards_title', 'cards_sub'], savings: ['savings_title', 'savings_sub'], portfolio: ['portfolio_title', 'portfolio_sub'], budget: ['budget_title', 'budget_sub'], me: ['me_title', 'me_sub'] };
    var EXT = window.PORTAL_PAGES || {};
    if (EXT[page]) titles[page] = EXT[page].title;
    var tt = titles[page] || titles.home;
    root.appendChild(h('header', { class: 'top-header' + (page === 'home' ? ' sr-only' : '') }, [h('h1', { text: t(tt[0]) }), h('p', { text: t(tt[1]) })]));
    document.title = t(tt[0]) + ' · ' + t('brand');
    var main = h('main'); root.appendChild(main);
    (EXT[page] ? EXT[page].render : (pageRenderers[page] || pageRenderers.home))(main);
    if (page === 'me') root.appendChild(backupCard());
    root.appendChild(h('footer', { class: 'site-footer' }, [h('a', { href: 'privacy.html', text: t('privacy_link') }), h('a', { href: 'support.html', text: t('support_link') }), h('span', { text: t('not_advice') })]));
    if (!$('toast')) document.body.appendChild(h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }));
    window.addEventListener('portal-cloud', function () { emit('cloud'); });
    try { if (window.self === window.top && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  }
  window.Portal = { calc: calc, get data() { return data; }, quotes: quotes, refreshQuotes: refreshQuotes, exportBackup: exportBackup, importBackup: importBackup, t: t, toILS: toILS, rateILS: rateILS, saveNow: saveNow,
    freeze: function () { frozen = true; clearTimeout(saveTimer); }, ui: { h: h, section: section, toast: toast, table: table, fmtDate: fmtDate, money: money }, keys: { data: DATA_KEY, settings: SETTINGS_KEY, options: OPTIONS_KEY, quotes: QUOTES_KEY }, lang: function () { return settings.lang; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
