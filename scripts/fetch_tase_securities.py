#!/usr/bin/env python3
"""Build tase_securities.json — lookup of TASE securities by number, Hebrew name, or ticker.

Verified keyless source (2026-11-26): Wikidata SPARQL, items with P414 =
Tel Aviv Stock Exchange (Q1507974). Hebrew and English labels, optional
ticker (P249 qualifier) and ISIN (P946). Israeli security numbers (מספר נייר)
are derived from IL ISINs: the 9-digit national number with leading zeros
stripped (e.g. IL0006046119 → 604611). The SPARQL endpoint sends
Access-Control-Allow-Origin: * but this job still runs server-side and
writes a same-origin file for the site.

Official TASE Data Hub / file 0803 / api.tase.co.il require a subscription
or returned HTTP 403 from this environment. data.gov.il CKAN has no TASE
securities or mutual-fund NAV dataset (catalog searched 2026-11-26).
Mutual funds (קרנות נאמנות) therefore have no automated daily NAV in this
file; the UI marks them for a manual price unless a Yahoo symbol exists.

Standard library only. No secrets. Keeps the previous file if the fetch fails.
"""
from __future__ import annotations

import json
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "tase_securities.json"
USER_AGENT = (
    "Mozilla/5.0 (compatible; options-calc-prices/1.1; "
    "+https://aviad12377-ai.github.io/)"
)
# Tel Aviv Stock Exchange
TASE_QID = "Q1507974"
SPARQL = """
SELECT ?item ?en ?he ?isin ?ticker ?classEn WHERE {
  ?item wdt:P414 wd:Q1507974 .
  OPTIONAL { ?item wdt:P946 ?isin. }
  OPTIONAL {
    ?item p:P414 ?s.
    ?s ps:P414 wd:Q1507974.
    OPTIONAL { ?s pq:P249 ?ticker. }
  }
  OPTIONAL { ?item rdfs:label ?en. FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?he. FILTER(LANG(?he) = "he") }
  OPTIONAL {
    ?item wdt:P31 ?class.
    OPTIONAL { ?class rdfs:label ?classEn. FILTER(LANG(?classEn) = "en") }
  }
}
""".strip()

TYPE_HINTS = (
    (("exchange-traded fund", "etf", "exchange traded fund", "traded fund"), "etf"),
    (("mutual fund", "investment fund", "open-end fund", "unit trust"), "fund"),
    (("bond", "debenture", "government bond", "corporate bond", "convertible bond"), "bond"),
    (("warrant",), "warrant"),
)


def http_json(url: str, accept: str = "application/sparql-results+json") -> dict:
    req = Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": accept},
    )
    with urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def security_number_from_isin(isin: str | None) -> str | None:
    if not isin or not isin.startswith("IL") or len(isin) < 12:
        return None
    national = isin[2:11]
    if not national.isdigit():
        return None
    return national.lstrip("0") or "0"


def classify(class_labels: list[str]) -> str:
    blob = " | ".join(class_labels).lower()
    for needles, typ in TYPE_HINTS:
        if any(n in blob for n in needles):
            return typ
    return "stock"


def yahoo_symbol(ticker: str | None) -> str | None:
    if not ticker:
        return None
    t = ticker.strip()
    if not t or t.isdigit() and len(t) < 3:
        return None
    if "." in t:
        return t.upper()
    return t.upper() + ".TA"


def load_existing(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data.get("securities") if isinstance(data, dict) else data
        return rows if isinstance(rows, list) else []
    except Exception:
        return []


def merge_rows(rows: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    order: list[str] = []

    def key_of(r: dict) -> str:
        if r.get("id"):
            return "id:" + str(r["id"])
        if r.get("symbol"):
            return "sym:" + str(r["symbol"]).upper()
        if r.get("isin"):
            return "isin:" + str(r["isin"]).upper()
        return "he:" + (r.get("he") or r.get("en") or "")

    for r in rows:
        if not isinstance(r, dict):
            continue
        k = key_of(r)
        if k not in by_key:
            by_key[k] = dict(r)
            order.append(k)
        else:
            cur = by_key[k]
            for field in ("id", "he", "en", "symbol", "ticker", "isin", "type"):
                if not cur.get(field) and r.get(field):
                    cur[field] = r[field]
    out = [by_key[k] for k in order]
    out.sort(key=lambda r: (r.get("he") or r.get("en") or r.get("symbol") or ""))
    return out


def from_wikidata(bindings: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for b in bindings:
        qid = (b.get("item") or {}).get("value") or ""
        rec = grouped.setdefault(
            qid,
            {"he": None, "en": None, "isin": None, "tickers": [], "classes": []},
        )
        for field in ("he", "en", "isin"):
            val = (b.get(field) or {}).get("value")
            if val and not rec[field]:
                rec[field] = val
        tick = (b.get("ticker") or {}).get("value")
        if tick and tick not in rec["tickers"]:
            rec["tickers"].append(tick)
        cls = (b.get("classEn") or {}).get("value")
        if cls and cls not in rec["classes"]:
            rec["classes"].append(cls)

    rows = []
    for rec in grouped.values():
        typ = classify(rec["classes"])
        isin = rec["isin"]
        sec_id = security_number_from_isin(isin)
        # One row per ticker if several (e.g. preferred shares); otherwise one nameless row.
        tickers = rec["tickers"] or [None]
        for tick in tickers:
            symbol = yahoo_symbol(tick)
            if not symbol and not sec_id and not rec["he"]:
                continue
            rows.append(
                {
                    "id": sec_id,
                    "he": rec["he"],
                    "en": rec["en"],
                    "symbol": symbol,
                    "ticker": tick.upper() if isinstance(tick, str) else None,
                    "isin": isin,
                    "type": typ,
                }
            )
    return rows


def main(argv: list[str]) -> int:
    out_path = Path(argv[1]) if len(argv) > 1 else OUT_PATH
    previous = load_existing(out_path)
    source_note = (
        "Wikidata SPARQL: items with P414 = Tel Aviv Stock Exchange (Q1507974). "
        "Security numbers derived from Israeli ISINs. Official TASE APIs were not "
        "reachable without a key (HTTP 403 / Data Hub). data.gov.il has no matching dataset."
    )
    try:
        url = "https://query.wikidata.org/sparql?query=" + urllib.parse.quote(SPARQL) + "&format=json"
        payload = http_json(url)
        bindings = (payload.get("results") or {}).get("bindings") or []
        fresh = from_wikidata(bindings)
        if not fresh:
            raise RuntimeError("Wikidata returned no TASE rows")
    except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError, OSError) as exc:
        if previous:
            print(f"WARN fetch failed ({exc}); leaving {out_path} as-is ({len(previous)} rows).", file=sys.stderr)
            return 0
        print(f"ERROR: could not fetch TASE securities and no previous file: {exc}", file=sys.stderr)
        return 1

    securities = merge_rows(previous + fresh)
    with_id = sum(1 for r in securities if r.get("id"))
    with_symbol = sum(1 for r in securities if r.get("symbol"))
    payload = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": source_note,
        "count": len(securities),
        "withSecurityNumber": with_id,
        "withYahooSymbol": with_symbol,
        "securities": securities,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {out_path} with {len(securities)} securities "
        f"({with_id} with מספר נייר, {with_symbol} with Yahoo symbol)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
