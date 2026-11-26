/**
 * Cloudflare Worker: keyless CORS proxy for Yahoo Finance quotes and search.
 *
 * Why this exists: no public stock API we tested (Yahoo, Stooq, Nasdaq, TASE)
 * returns Access-Control-Allow-Origin for arbitrary tickers without an API key.
 * Crypto (CoinGecko / Binance / Coinbase) and FX already work from the browser.
 * This worker covers stocks, ETFs, TASE securities and anything else Yahoo has.
 *
 * Deploy: see scripts/PRICE-PROXY.md
 * Then set window.PORTAL_PRICE_PROXY to this worker's URL before portal.js loads.
 */
const ALLOWED_ORIGIN = [
  /^https:\/\/aviad12377-ai\.github\.io$/,
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
];
const YAHOO = "https://query1.finance.yahoo.com";
const UA =
  "Mozilla/5.0 (compatible; options-calc-prices/1.1; +https://aviad12377-ai.github.io/)";

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGIN.some((re) => re.test(origin)) ? origin : ALLOWED_ORIGIN[0].source.includes("github") ? "https://aviad12377-ai.github.io" : "";
  // Echo a matching allowed origin (not *), so we can keep this tight.
  const echoed = origin && ALLOWED_ORIGIN.some((re) => re.test(origin)) ? origin : "https://aviad12377-ai.github.io";
  return {
    "Access-Control-Allow-Origin": echoed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, origin, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30",
      ...corsHeaders(origin),
      ...(extra || {}),
    },
  });
}

function forbidden(origin) {
  return new Response("Forbidden", {
    status: 403,
    headers: corsHeaders(origin),
  });
}

async function yahooJson(path) {
  const res = await fetch(YAHOO + path, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error("Yahoo HTTP " + res.status);
  }
  return res.json();
}

function convertPrice(price, currency) {
  if (currency === "ILA" || currency === "ILX") return { price: price / 100, currency: "ILS" };
  if (currency === "GBp" || currency === "GBX") return { price: price / 100, currency: "GBP" };
  return { price, currency: currency || "USD" };
}

function fromMeta(meta, symbol) {
  const raw = meta && meta.regularMarketPrice;
  if (!(typeof raw === "number" && raw > 0)) return null;
  const conv = convertPrice(raw, meta.currency || "USD");
  const state = meta.marketState;
  return {
    price: conv.price,
    currency: conv.currency,
    regularMarketTime: meta.regularMarketTime || null,
    previousClose: meta.chartPreviousClose || meta.previousClose || meta.regularMarketPreviousClose || null,
    exchange: meta.exchangeName || null,
    state: state ? (String(state).toUpperCase() === "REGULAR" ? "open" : "closed") : null,
    symbol: symbol || meta.symbol,
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") {
      return forbidden(origin);
    }
    if (origin && !ALLOWED_ORIGIN.some((re) => re.test(origin))) {
      return forbidden(origin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "" || path === "/" || path === "/health") {
        return json({ ok: true, service: "options-calc-price-proxy" }, origin);
      }

      if (path === "/quote") {
        const raw = url.searchParams.get("symbols") || "";
        const symbols = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 25);
        if (!symbols.length) {
          return json({ error: "symbols required" }, origin, 400);
        }
        const qs =
          "/v7/finance/spark?symbols=" +
          symbols.map(encodeURIComponent).join(",") +
          "&range=1d&interval=1d";
        const payload = await yahooJson(qs);
        const quotes = {};
        for (const item of (payload.spark && payload.spark.result) || []) {
          const meta = item.response && item.response[0] && item.response[0].meta;
          const q = fromMeta(meta, item.symbol);
          if (q) quotes[item.symbol] = q;
        }
        // Fill gaps with the chart endpoint (one symbol at a time, capped).
        const missing = symbols.filter((s) => !quotes[s]).slice(0, 8);
        for (const sym of missing) {
          try {
            const chart = await yahooJson(
              "/v8/finance/chart/" + encodeURIComponent(sym) + "?range=1d&interval=1d"
            );
            const result = chart.chart && chart.chart.result && chart.chart.result[0];
            const q = fromMeta(result && result.meta, sym);
            if (q) quotes[sym] = q;
          } catch (_) {
            /* per-symbol tolerance */
          }
        }
        return json({ quotes }, origin);
      }

      if (path === "/search") {
        const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
        if (!q) return json({ quotes: [] }, origin);
        const payload = await yahooJson(
          "/v1/finance/search?q=" +
            encodeURIComponent(q) +
            "&quotesCount=8&newsCount=0&listsCount=0"
        );
        const quotes = (payload.quotes || []).map((x) => ({
          symbol: x.symbol,
          shortname: x.shortname || x.longname || "",
          longname: x.longname || "",
          exchange: x.exchDisp || x.exchange || "",
          type: x.quoteType || x.typeDisp || "",
        }));
        return json({ quotes }, origin);
      }

      return json({ error: "not found" }, origin, 404);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, origin, 502);
    }
  },
};
