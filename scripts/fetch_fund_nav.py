#!/usr/bin/env python3
"""Fetch daily NAVs for Israeli mutual funds (קרנות נאמנות) and merge into prices.json.

Sources, tried in this order for each security number:

1. Maya / TASE first (as requested): GET
     https://mayaapi.tase.co.il/api/fund/details?fundId={id}
   with a browser User-Agent, Origin/Referer of maya.tase.co.il, and the
   X-Maya-With: allow header used by the official Maya site (see pymaya).
   Verified 2026-11-26 from this environment: the public HTML page
   https://maya.tase.co.il/fund/{id} returns 200 but is an empty SPA shell
   (no embedded NAV). The JSON API timed out behind Incapsula even after
   visiting the page and sending WAF cookies. Official TASE Data Hub and
   most api.tase.co.il / market.tase.co.il endpoints returned HTTP 403.
   The job still tries Maya first, with a short timeout so Actions is not stalled.

2. Fallback (verified keyless, 2026-11-26): Fair public fund pages
     https://funds.fair.co.il/search/funds/{securityNumber}
   The Angular app embeds a <script id="ng-state"> JSON blob with fund-summary
   sellPrice / buyPrice quoted in agorot and a factor (typically 100). We store
   ILS = sellPrice / factor. Yahoo has no quotes for these funds.

Fund IDs are collected from:
  - scripts/universe.json key "mutual_funds" (and "tase_funds")
  - scripts/extra_tickers.json (numeric IDs or {"id": "..."})
  - existing tase_securities.json rows with type "fund" or a numeric id
    that looks like a mutual-fund number (7 digits starting with 51/52/51…)

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
    "Mozilla/5.0 (compatible; options-calc-prices/1.1; "
    "+https://aviad12377-ai.github.io/)"
)
RETRIES = 3
PAUSE = 0.25
FAIR_URL = "https://funds.fair.co.il/search/funds/{id}"
MAYA_API = "https://mayaapi.tase.co.il/api/fund/details?fundId={id}"
MAYA_PAGE = "https://maya.tase.co.il/fund/{id}"
MAYA_TIMEOUT = 8
NG_STATE = re.compile(
    r'<script id="ng-state" type="application/json">(.*?)</script>',
    re.S,
)


def _add_id(raw, seen: set[str], ids: list[str]) -> None:
    if raw is None:
        return
    s = str(raw).strip().replace(".TA", "").replace(".TLV", "")
    if re.fullmatch(r"\d{4,9}", s) and s not in seen:
        seen.add(s)
        ids.append(s)


def load_fund_ids() -> list[str]:
    seen: set[str] = set()
    ids: list[str] = []
    if UNIVERSE_PATH.exists():
        data = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
        for key in ("mutual_funds", "tase_funds"):
            for item in data.get(key) or []:
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


def http_text(url: str) -> str:
    last_err: Exception | None = None
    for attempt in range(RETRIES):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
            with urlopen(req, timeout=25) as resp:
                return resp.read().decode("utf-8", "replace")
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"fetch failed after {RETRIES} tries: {last_err}")


def parse_fair(html: str) -> dict | None:
    m = NG_STATE.search(html)
    if not m:
        return None
    state = json.loads(m.group(1))
    summary = state.get("fund-summary") or {}
    sell = summary.get("sellPrice")
    factor = summary.get("factor") or 100
    if not isinstance(sell, (int, float)) or sell <= 0 or not factor:
        return None
    ils = round(float(sell) / float(factor), 6)
    as_of = state.get("dataAsOf")
    return {
        "price": ils,
        "currency": "USD" if summary.get("isDollarUnits") else "ILS",
        "regularMarketTime": as_of,
        "previousClose": None,
        "exchange": "TASE-MF",
        "state": "closed",
        "agorot": sell,
        "factor": factor,
        "source": "fair.co.il",
        "meta": {
            "id": str(summary.get("fundID") or ""),
            "he": summary.get("fundName") or summary.get("shortHebrewName"),
            "en": summary.get("name_english") or summary.get("shortEnglishName"),
            "type": "fund",
        },
    }


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
    # Sometimes wrapped
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
    # Maya quotes mutual funds in agorot, same as Fair (factor 100), unless already small.
    factor = 100 if sell >= 10 else 1
    ils = round(sell / factor, 6)
    as_of = _first_str(body, ("PriceDate", "priceDate", "NavDate", "navDate", "Date", "date", "AsOf", "asOf"))
    return {
        "price": ils,
        "currency": "ILS",
        "regularMarketTime": as_of,
        "previousClose": None,
        "exchange": "TASE-MF",
        "state": "closed",
        "agorot": sell if factor == 100 else sell * 100,
        "factor": factor,
        "source": "maya.tase.co.il",
        "meta": {
            "id": str(body.get("FundId") or body.get("fundId") or body.get("Id") or fund_id),
            "he": _first_str(body, ("FundLongName", "FundShortName", "fundName", "Name", "name")),
            "en": _first_str(body, ("FundLongNameEn", "englishName", "NameEn", "name_english")),
            "type": "fund",
        },
    }


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


def fetch_fair(fund_id: str) -> dict | None:
    html = http_text(FAIR_URL.format(id=fund_id))
    return parse_fair(html)


def fetch_one(fund_id: str) -> tuple[str, dict | None, str | None]:
    errors = []
    try:
        quote = fetch_maya(fund_id)
        if quote:
            return fund_id, quote, None
        errors.append("Maya: no usable price fields")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Maya: {exc}")
    try:
        quote = fetch_fair(fund_id)
        if quote:
            return fund_id, quote, None
        errors.append("Fair: no ng-state / sellPrice")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Fair: {exc}")
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
        if str(row.get("id") or "") == sec_id:
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
            "id": sec_id,
            "he": meta.get("he"),
            "en": meta.get("en"),
            "symbol": None,
            "ticker": None,
            "isin": None,
            "type": "fund",
        }
    )


def public_quote(q: dict) -> dict:
    # prices.json public shape (keep agorot metadata for debugging / UI)
    return {
        "price": q["price"],
        "currency": q["currency"],
        "regularMarketTime": q.get("regularMarketTime"),
        "previousClose": q.get("previousClose"),
        "exchange": q.get("exchange"),
        "state": q.get("state"),
        "agorot": q.get("agorot"),
        "factor": q.get("factor"),
        "source": q.get("source"),
    }


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
        quotes[fid + ".TA"] = dict(pub)  # so holding lookup by either form works

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
    tase.setdefault(
        "source",
        "Wikidata SPARQL for listed companies; Fair fund pages for קרנות נאמנות NAVs.",
    )
    if "Fair fund pages" not in (tase.get("source") or ""):
        tase["source"] = (tase.get("source") or "") + " Mutual-fund names and numbers: Fair public fund pages."
    TASE_PATH.write_text(json.dumps(tase, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Wrote {len(fetched)} fund NAVs into {prices_path} "
        f"({len(errors)} failed, {len(ids)} requested); updated {TASE_PATH}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
