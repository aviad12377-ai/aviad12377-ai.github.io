#!/usr/bin/env python3
"""Refresh the Israeli mutual-fund and ETF (קרנות סל) lookup from Funder.

Keyless public pages (verified 2026-11-26):
  https://www.funder.co.il/fundlist   — כל קרנות הנאמנות (var fundlistData)
  https://www.funder.co.il/etflist    — קרנות סל (var fundlistData, secId + fundLongName)

Merges into tase_securities.json (does not drop Wikidata stocks). ETF last
prices from the list (intrPrc, agorot) are merged into prices.json. Mutual-fund
NAVs are not on the list page; fetch_fund_nav.py pulls those incrementally.

Run by the Actions prices workflow (cheap: two HTML pages). Weekly would be
enough for names; running with the 15-minute job also gives fetch_fund_nav.py
a fresh official lastUpdate so it only re-fetches funds whose NAV date moved.
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
TASE_PATH = ROOT / "tase_securities.json"
PRICES_PATH = ROOT / "prices.json"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
FUNDLIST_URL = "https://www.funder.co.il/fundlist"
ETFLIST_URL = "https://www.funder.co.il/etflist"
RETRIES = 3
ISO_DATE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


def http_text(url: str, timeout: int = 40) -> str:
    last_err: Exception | None = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
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


def _rows_of(data) -> list:
    if isinstance(data, dict) and isinstance(data.get("x"), list):
        return data["x"]
    if isinstance(data, list):
        return data
    return []


def parse_funds(html: str) -> list[dict]:
    rows = []
    for raw in _rows_of(extract_js_var(html, "fundlistData")):
        if not isinstance(raw, dict):
            continue
        fid = raw.get("fundNum")
        name = (raw.get("fundName") or raw.get("fundLongName") or "").strip()
        if not fid or not name:
            continue
        rows.append(
            {
                "id": str(fid),
                "he": name,
                "en": None,
                "symbol": None,
                "ticker": None,
                "isin": None,
                "type": "fund",
                "manager": (raw.get("fundMng") or raw.get("invstMng") or "").strip() or None,
                "lastUpdate": _nav_date(raw.get("lastUpdate")),
                "source": "funder.co.il/fundlist",
            }
        )
    return rows


def parse_etfs(html: str) -> tuple[list[dict], list[dict]]:
    secs: list[dict] = []
    quotes: list[dict] = []
    for raw in _rows_of(extract_js_var(html, "fundlistData")):
        if not isinstance(raw, dict):
            continue
        fid = raw.get("secId") or raw.get("fundNum")
        name = (raw.get("fundLongName") or raw.get("fundName") or "").strip()
        if not fid or not name:
            continue
        sid = str(fid)
        secs.append(
            {
                "id": sid,
                "he": name,
                "en": None,
                "symbol": None,
                "ticker": None,
                "isin": None,
                "type": "etf",
                "manager": (raw.get("fndMng") or raw.get("fundMng") or "").strip() or None,
                "lastUpdate": _nav_date(raw.get("yUpdate") or raw.get("lastUpdate")),
                "source": "funder.co.il/etflist",
            }
        )
        prc = raw.get("intrPrc")
        try:
            agorot = float(str(prc).replace(",", "").strip())
        except (TypeError, ValueError):
            continue
        if agorot <= 0:
            continue
        # TASE ETF quotes on Funder are in agorot (integer strings like "3799").
        factor = 100 if agorot >= 10 and float(agorot).is_integer() else 1
        ils = round(agorot / factor, 6)
        nav_date = _nav_date(raw.get("yUpdate"))
        pub = {
            "price": ils,
            "currency": "ILS",
            "regularMarketTime": f"{nav_date}T12:00:00+02:00" if nav_date else raw.get("yUpdate"),
            "navDate": nav_date,
            "previousClose": None,
            "exchange": "TASE",
            "state": "REGULAR",
            "agorot": agorot if factor == 100 else agorot * 100,
            "factor": factor,
            "source": "funder.co.il/etflist",
        }
        quotes.append((sid, pub))
    return secs, quotes


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


def upsert(rows: list[dict], incoming: list[dict]) -> None:
    by_id = {str(r.get("id")): i for i, r in enumerate(rows) if r.get("id")}
    for rec in incoming:
        sid = rec["id"]
        if sid in by_id:
            cur = rows[by_id[sid]]
            for field in ("he", "en", "type", "manager", "lastUpdate", "source"):
                if rec.get(field):
                    cur[field] = rec[field]
            cur.setdefault("symbol", rec.get("symbol"))
            cur.setdefault("ticker", rec.get("ticker"))
            cur.setdefault("isin", rec.get("isin"))
        else:
            rows.append(dict(rec))
            by_id[sid] = len(rows) - 1


def merge_quotes(path: Path, quotes: list[tuple[str, dict]], generated_at: str) -> int:
    if not quotes:
        return 0
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            data = {"quotes": {}}
    else:
        data = {"quotes": {}}
    table = dict(data.get("quotes") or {})
    for sid, pub in quotes:
        table[sid] = pub
        table[sid + ".TA"] = dict(pub)
    data["quotes"] = {k: table[k] for k in sorted(table)}
    data["generatedAt"] = generated_at
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(quotes)


def main(argv: list[str]) -> int:
    fund_html = http_text(FUNDLIST_URL)
    funds = parse_funds(fund_html)
    if not funds:
        print("ERROR: fundlistData was empty or unparseable.", file=sys.stderr)
        return 1
    etf_html = http_text(ETFLIST_URL)
    etfs, etf_quotes = parse_etfs(etf_html)
    if not etfs:
        print("WARN: etflist was empty or unparseable.", file=sys.stderr)

    tase = load_tase(TASE_PATH)
    rows = list(tase.get("securities") or [])
    upsert(rows, funds)
    upsert(rows, etfs)
    rows.sort(key=lambda r: (r.get("he") or r.get("en") or r.get("symbol") or r.get("id") or ""))
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    tase["securities"] = rows
    tase["count"] = len(rows)
    tase["withSecurityNumber"] = sum(1 for r in rows if r.get("id"))
    tase["withYahooSymbol"] = sum(1 for r in rows if r.get("symbol"))
    tase["fundCount"] = sum(1 for r in rows if r.get("type") == "fund")
    tase["etfCount"] = sum(1 for r in rows if r.get("type") == "etf")
    tase["generatedAt"] = now
    src = tase.get("source") or "Wikidata SPARQL for listed companies."
    note = "Mutual funds: funder.co.il/fundlist. ETFs (קרנות סל): funder.co.il/etflist."
    if "funder.co.il/fundlist" not in src:
        tase["source"] = src.rstrip() + " " + note
    TASE_PATH.write_text(json.dumps(tase, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n_quotes = merge_quotes(PRICES_PATH, etf_quotes, now)
    print(
        f"Wrote {TASE_PATH}: {len(funds)} funds, {len(etfs)} ETFs, "
        f"{len(rows)} securities total; {n_quotes} ETF last prices into {PRICES_PATH}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
