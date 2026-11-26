#!/usr/bin/env python3
"""Fetch daily NAVs for Israeli mutual funds (קרנות נאמנות) and merge into prices.json.

Verified 2026-11-26 against a bank screenshot (agorot, same calendar date):

  26.11  5133236=409.13  5131925=389.14  5140504=175.13
  25.11  5136262=227.94  5129283=353.57  5124805=218.14

Sources, tried in this order for each security number:

1. funder.co.il (primary — exact agora match on the same NAV date).
   Public page https://www.funder.co.il/fund/{id} embeds
     var fundData = {"x":[{buyPrice, sellPrice, lastUpdate, ...}]}
   Prices are in agorot (divide by 100 for ILS). For the six seed funds,
   buyPrice == sellPrice and both equal the bank figure. lastUpdate's
   calendar date is the official NAV date (stored as navDate).

2. Fallback: Fair public fund pages
     https://funds.fair.co.il/search/funds/{id}
   <script id="ng-state"> fund-summary sellPrice / buyPrice (also equal
   to each other; no separate פדיון field). On 2026-11-26 those values
   were the previous trading day's Funder/bank NAV, so Fair is kept only
   as a fallback. dataAsOf 22:00Z is treated as that UTC calendar date.

3. Last resort: Maya / TASE JSON
     https://mayaapi.tase.co.il/api/fund/details?fundId={id}
   with X-Maya-With: allow. Official TASE Data Hub / most tase.co.il
   APIs return 403 without a key; the Maya API often times out behind
   Incapsula from datacenter IPs. Short timeout so Actions is not stalled.

Other keyless sources checked the same day and not used as primary:
  bizportal pages had no exact bank figures; Fair lagged one session;
  investing.com / Globes were skipped (differences vs the bank, per
  the requirement to match to the agora).

Fund IDs are collected from:
  - scripts/universe.json key "mutual_funds" (and "tase_funds")
  - scripts/extra_tickers.json (numeric IDs or {"id": "..."})
  - existing tase_securities.json rows with type "fund" or a numeric id
    that looks like a mutual-fund number (7 digits starting with 51)

Also refreshes those rows in tase_securities.json (number, Hebrew/English name, type: fund).
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
UNIVERSE_PATH = Path(__file__).resolve().parent / "universe.json"
EXTRA_PATH = Path(__file__).resolve().parent / "extra_tickers.json"
PRICES_PATH = ROOT / "prices.json"
TASE_PATH = ROOT / "tase_securities.json"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
RETRIES = 3
PAUSE = 0.25
FUNDER_URL = "https://www.funder.co.il/fund/{id}"
FAIR_URL = "https://funds.fair.co.il/search/funds/{id}"
MAYA_API = "https://mayaapi.tase.co.il/api/fund/details?fundId={id}"
MAYA_PAGE = "https://maya.tase.co.il/fund/{id}"
MAYA_TIMEOUT = 6
NG_STATE = re.compile(
    r'<script id="ng-state" type="application/json">(.*?)</script>',
    re.S,
)
ISO_DATE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


def _add_id(raw, seen: set[str], ids: list[str]) -> None:
    if raw is None:
        return
    text = str(raw).strip()
    if text.endswith(".TA"):
        text = text[:-3]
    if re.fullmatch(r"\d{4,9}", text) and text not in seen:
        seen.add(text)
        ids.append(text)


def load_fund_ids() -> list[str]:
    seen: set[str] = set()
    ids: list[str] = []
    if UNIVERSE_PATH.exists():
        data = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
        for key in ("mutual_funds", "tase_funds"):
            val = data.get(key)
            if not isinstance(val, list):
                continue
            for item in val:
                if isinstance(item, dict):
                    _add_id(item.get("id") or item.get("symbol") or item.get("ticker"), seen, ids)
                else:
                    _add_id(item, seen, ids)
    if EXTRA_PATH.exists():
        extra = json.loads(EXTRA_PATH.read_text(encoding="utf-8"))
        if isinstance(extra, dict):
            extra = extra.get("symbols") or extra.get("tickers") or extra.get("funds") or []
        for item in extra or []:
            if isinstance(item, dict):
                _add_id(item.get("id") or item.get("symbol") or item.get("ticker"), seen, ids)
            else:
                _add_id(item, seen, ids)
    if TASE_PATH.exists():
        try:
            blob = json.loads(TASE_PATH.read_text(encoding="utf-8"))
            rows = blob.get("securities") if isinstance(blob, dict) else blob
            for row in rows or []:
                if not isinstance(row, dict):
                    continue
                if row.get("type") == "fund" or (
                    isinstance(row.get("id"), str) and re.fullmatch(r"51\d{5}", str(row["id"]))
                ):
                    _add_id(row.get("id"), seen, ids)
        except Exception:
            pass
    return ids


def http_text(url: str, timeout: int = 25) -> str:
    last_err: Exception | None = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/json",
        "Accept-Language": "he-IL,he,en;q=0.8",
    }
    for attempt in range(RETRIES):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", "replace")
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed after {RETRIES} tries: {last_err}")


def extract_js_var(html: str, name: str):
    m = re.search(rf"var\s+{re.escape(name)}\s*=\s*", html)
    if not m:
        return None
    i = m.end()
    while i < len(html) and html[i] in " \r\n\t":
        i += 1
    if i >= len(html) or html[i] not in "{[":
        return None
    stack: list[str] = []
    in_str = False
    esc = False
    end = None
    for j in range(i, len(html)):
        c = html[j]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == in_str:
                in_str = False
            continue
        if c in "\"'":
            in_str = c
        elif c in "{[":
            stack.append(c)
        elif c in "}]":
            if stack:
                stack.pop()
            if not stack:
                end = j + 1
                break
    if end is None:
        return None
    try:
        return json.loads(html[i:end])
    except json.JSONDecodeError:
        return None


def _nav_date(raw) -> str | None:
    if not raw:
        return None
    m = ISO_DATE.match(str(raw).strip())
    return m.group(1) if m else None


def _market_time(nav_date: str | None, raw=None) -> str | None:
    if nav_date:
        # Noon Israel (UTC+2 in winter) is Funder's own stamp; date is what matters.
        return f"{nav_date}T12:00:00+02:00"
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _quote(
    *,
    ils: float,
    currency: str,
    nav_date: str | None,
    rmt: str | None,
    previous: float | None,
    agorot: float,
    buy_agorot: float | None,
    factor: float,
    source: str,
    meta: dict,
) -> dict:
    return {
        "price": ils,
        "currency": currency,
        "regularMarketTime": rmt,
        "navDate": nav_date,
        "previousClose": previous,
        "exchange": "TASE-MF",
        "state": "closed",
        "agorot": agorot,
        "buyAgorot": buy_agorot,
        "factor": factor,
        "source": source,
        "meta": meta,
    }


def parse_funder(html: str, fund_id: str) -> dict | None:
    data = extract_js_var(html, "fundData")
    if not isinstance(data, dict):
        return None
    rows = data.get("x") if isinstance(data.get("x"), list) else [data]
    row = rows[0] if rows and isinstance(rows[0], dict) else None
    if not row:
        return None
    sell = row.get("sellPrice")
    buy = row.get("buyPrice")
    if not isinstance(sell, (int, float)) or sell <= 0:
        sell = buy
    if not isinstance(sell, (int, float)) or sell <= 0:
        return None
    factor = 100
    ils = round(float(sell) / factor, 6)
    nav_date = _nav_date(row.get("lastUpdate"))
    prev_ils = None
    graph = extract_js_var(html, "fundGraphData")
    if isinstance(graph, dict) and isinstance(graph.get("x"), list) and len(graph["x"]) >= 2:
        prev = graph["x"][-2]
        if isinstance(prev, dict) and isinstance(prev.get("p"), (int, float)) and prev["p"] > 0:
            prev_ils = round(float(prev["p"]) / factor, 6)
    return _quote(
        ils=ils,
        currency="ILS",
        nav_date=nav_date,
        rmt=_market_time(nav_date, row.get("lastUpdate")),
        previous=prev_ils,
        agorot=float(sell),
        buy_agorot=float(buy) if isinstance(buy, (int, float)) else None,
        factor=factor,
        source="funder.co.il",
        meta={
            "id": str(row.get("fundNum") or fund_id),
            "he": row.get("fundLongName") or row.get("fundName"),
            "en": None,
            "type": "fund",
        },
    )


def parse_fair(html: str) -> dict | None:
    m = NG_STATE.search(html)
    if not m:
        return None
    state = json.loads(m.group(1))
    summary = state.get("fund-summary") or {}
    sell = summary.get("sellPrice")
    buy = summary.get("buyPrice")
    factor = summary.get("factor") or 100
    if not isinstance(sell, (int, float)) or sell <= 0 or not factor:
        sell = buy
    if not isinstance(sell, (int, float)) or sell <= 0 or not factor:
        return None
    ils = round(float(sell) / float(factor), 6)
    as_of = state.get("dataAsOf")
    # Fair stamps close-of-day as 22:00Z; use the UTC calendar date, not Israel midnight.
    nav_date = _nav_date(as_of)
    return _quote(
        ils=ils,
        currency="USD" if summary.get("isDollarUnits") else "ILS",
        nav_date=nav_date,
        rmt=_market_time(nav_date, as_of),
        previous=None,
        agorot=float(sell),
        buy_agorot=float(buy) if isinstance(buy, (int, float)) else None,
        factor=float(factor),
        source="fair.co.il",
        meta={
            "id": str(summary.get("fundID") or ""),
            "he": summary.get("fundName") or summary.get("shortHebrewName"),
            "en": summary.get("name_english") or summary.get("shortEnglishName"),
            "type": "fund",
        },
    )


def _first_number(obj: dict, keys: tuple[str, ...]):
    for k in keys:
        v = obj.get(k)
        if isinstance(v, (int, float)) and v > 0:
            return float(v)
    return None


def _first_str(obj: dict, keys: tuple[str, ...]):
    for k in keys:
        v = obj.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def parse_maya(payload: dict, fund_id: str) -> dict | None:
    """Best-effort parse of Maya fund/details JSON (field names vary). Prices are in agorot."""
    if not isinstance(payload, dict):
        return None
    body = payload.get("result") or payload.get("data") or payload.get("Fund") or payload
    if not isinstance(body, dict):
        return None
    sell = _first_number(body, (
        "RedemptionPrice", "redemptionPrice", "SellPrice", "sellPrice",
        "PurchasePrice", "purchasePrice", "BuyPrice", "buyPrice",
        "Price", "price", "FundPrice", "fundPrice", "Nav", "NAV", "nav",
    ))
    if sell is None:
        return None
    factor = 100 if sell >= 10 else 1
    ils = round(sell / factor, 6)
    as_of = _first_str(body, ("PriceDate", "priceDate", "NavDate", "navDate", "Date", "date", "AsOf", "asOf"))
    nav_date = _nav_date(as_of)
    return _quote(
        ils=ils,
        currency="ILS",
        nav_date=nav_date,
        rmt=_market_time(nav_date, as_of),
        previous=None,
        agorot=sell if factor == 100 else sell * 100,
        buy_agorot=None,
        factor=factor,
        source="maya.tase.co.il",
        meta={
            "id": str(body.get("FundId") or body.get("fundId") or body.get("Id") or fund_id),
            "he": _first_str(body, ("FundLongName", "FundShortName", "fundName", "Name", "name")),
            "en": _first_str(body, ("FundLongNameEn", "englishName", "NameEn", "name_english")),
            "type": "fund",
        },
    )


def fetch_maya(fund_id: str) -> dict | None:
    """Try the official Maya JSON API. Short timeout: Incapsula often hangs datacenter IPs."""
    url = MAYA_API.format(id=fund_id)
    req = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "he-IL",
            "Origin": "https://maya.tase.co.il",
            "Referer": MAYA_PAGE.format(id=fund_id),
            "X-Maya-With": "allow",
        },
    )
    with urlopen(req, timeout=MAYA_TIMEOUT) as resp:
        raw = resp.read().decode("utf-8", "replace")
    payload = json.loads(raw)
    return parse_maya(payload, fund_id)


def fetch_funder(fund_id: str) -> dict | None:
    html = http_text(FUNDER_URL.format(id=fund_id))
    return parse_funder(html, fund_id)


def fetch_fair(fund_id: str) -> dict | None:
    html = http_text(FAIR_URL.format(id=fund_id))
    return parse_fair(html)


def fetch_one(fund_id: str) -> tuple[str, dict | None, str | None]:
    errors = []
    try:
        quote = fetch_funder(fund_id)
        if quote:
            return fund_id, quote, None
        errors.append("Funder: no fundData / sellPrice")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Funder: {exc}")
    try:
        quote = fetch_fair(fund_id)
        if quote:
            return fund_id, quote, None
        errors.append("Fair: no ng-state / sellPrice")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Fair: {exc}")
    try:
        quote = fetch_maya(fund_id)
        if quote:
            return fund_id, quote, None
        errors.append("Maya: no usable price fields")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Maya: {exc}")
    return fund_id, None, " | ".join(errors)


def load_prices(path: Path) -> dict:
    if not path.exists():
        return {"generatedAt": None, "quotes": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data.get("quotes"), dict):
            return data
        quotes = {k: v for k, v in data.items() if k != "generatedAt" and isinstance(v, dict) and "price" in v}
        return {"generatedAt": data.get("generatedAt"), "quotes": quotes}
    except Exception:
        return {"generatedAt": None, "quotes": {}}


def load_tase(path: Path) -> dict:
    if not path.exists():
        return {"securities": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data.setdefault("securities", [])
            return data
        return {"securities": data if isinstance(data, list) else []}
    except Exception:
        return {"securities": []}


def upsert_tase(rows: list[dict], meta: dict) -> None:
    sec_id = meta.get("id")
    if not sec_id:
        return
    for row in rows:
        if str(row.get("id") or "") == str(sec_id):
            if meta.get("he"):
                row["he"] = meta["he"]
            if meta.get("en"):
                row["en"] = meta["en"]
            row["type"] = "fund"
            row.setdefault("symbol", None)
            row.setdefault("ticker", None)
            return
    rows.append(
        {
            "id": str(sec_id),
            "he": meta.get("he"),
            "en": meta.get("en"),
            "symbol": None,
            "ticker": None,
            "isin": None,
            "type": "fund",
        }
    )


def public_quote(q: dict) -> dict:
    out = {
        "price": q["price"],
        "currency": q["currency"],
        "regularMarketTime": q.get("regularMarketTime"),
        "navDate": q.get("navDate"),
        "previousClose": q.get("previousClose"),
        "exchange": q.get("exchange"),
        "state": q.get("state"),
        "agorot": q.get("agorot"),
        "factor": q.get("factor"),
        "source": q.get("source"),
    }
    if q.get("buyAgorot") is not None:
        out["buyAgorot"] = q["buyAgorot"]
    return out


def main(argv: list[str]) -> int:
    prices_path = Path(argv[1]) if len(argv) > 1 else PRICES_PATH
    ids = load_fund_ids()
    if not ids:
        print("No mutual-fund IDs found; nothing to do.")
        return 0

    fetched: dict[str, dict] = {}
    errors: dict[str, str] = {}
    for i, fund_id in enumerate(ids):
        fid, quote, err = fetch_one(fund_id)
        if quote:
            fetched[fid] = quote
            print(f"OK {fid} {quote.get('agorot')} agorot  navDate={quote.get('navDate')}  src={quote.get('source')}")
        else:
            errors[fid] = err or "unknown error"
            print(f"WARN {fid}: {err}", file=sys.stderr)
        if i + 1 < len(ids):
            time.sleep(PAUSE)

    if not fetched and errors:
        print(f"ERROR: no fund NAVs fetched ({len(errors)} failed).", file=sys.stderr)
        return 1

    prices = load_prices(prices_path)
    quotes = dict(prices.get("quotes") or {})
    for fid, q in fetched.items():
        pub = public_quote(q)
        quotes[fid] = pub
        quotes[fid + ".TA"] = dict(pub)

    prices["quotes"] = {k: quotes[k] for k in sorted(quotes)}
    prices["generatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    prices_path.write_text(json.dumps(prices, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    tase = load_tase(TASE_PATH)
    rows = list(tase.get("securities") or [])
    for q in fetched.values():
        upsert_tase(rows, q.get("meta") or {})
    rows.sort(key=lambda r: (r.get("he") or r.get("en") or r.get("symbol") or r.get("id") or ""))
    tase["securities"] = rows
    tase["count"] = len(rows)
    tase["withSecurityNumber"] = sum(1 for r in rows if r.get("id"))
    tase["withYahooSymbol"] = sum(1 for r in rows if r.get("symbol"))
    tase["generatedAt"] = prices["generatedAt"]
    src_note = "Mutual-fund NAVs: funder.co.il (primary, matches bank official daily price); Fair public pages as fallback."
    existing = tase.get("source") or "Wikidata SPARQL for listed companies."
    if "funder.co.il" not in existing:
        tase["source"] = existing.rstrip() + " " + src_note
    TASE_PATH.write_text(json.dumps(tase, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Wrote {len(fetched)} fund NAVs into {prices_path} "
        f"({len(errors)} failed, {len(ids)} requested); updated {TASE_PATH}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
