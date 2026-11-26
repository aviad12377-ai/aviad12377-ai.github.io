#!/usr/bin/env python3
"""Build a Hebrew news item from the latest gemelnet / pensianet / bituachnet month.

Numbers come only from funds.json (data.gov.il / Capital Market Authority).
No invented figures: if a yield is missing, that sentence or row is omitted.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from statistics import mean

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from news_util import iso_il, load_news, save_news, upsert_items  # noqa: E402

MONTHS_HE = {
    1: "ינואר", 2: "פברואר", 3: "מרץ", 4: "אפריל", 5: "מאי", 6: "יוני",
    7: "יולי", 8: "אוגוסט", 9: "ספטמבר", 10: "אוקטובר", 11: "נובמבר", 12: "דצמבר",
}
TRACKS = ["כללי", "מנייתי", "S&P 500", "נאסד״ק", "אג״ח", "כספי", "מדרגות גיל"]
PRODUCTS = [
    ("hishtalmut", "קרנות השתלמות", "gemelnet", "קרנות השתלמות"),
    ("pension", "קרנות פנסיה", "pensianet", None),
    ("gemel", "קופות גמל לתגמולים ופיצויים", "gemelnet", "תגמולים ואישית לפיצויים"),
    ("gemel_inv", "קופות גמל להשקעה", "gemelnet", "קופת גמל להשקעה"),
]
# Official dataset landing pages used as source links (resource ids also live in funds.json).
SOURCE_LINKS = [
    {"title": "גמל נט ב-data.gov.il", "url": "https://data.gov.il/dataset/a30dcbea-a1d2-482c-ae29-8f781f5025fb"},
    {"title": "פנסיה נט ב-data.gov.il", "url": "https://data.gov.il/dataset/6d47d6b5-cb08-488b-b333-f1e717b1e1bd"},
    {"title": "ביטוח נט ב-data.gov.il", "url": "https://data.gov.il/dataset/c6c62cc7-fe02-4b18-8f3e-813abfbb4647"},
    {"title": "גמל נט", "url": "https://gemelnet.cma.gov.il/"},
    {"title": "פנסיה נט", "url": "https://pensianet.cma.gov.il/"},
]
MIN_ASSETS_LEADERS = 50  # million NIS, stated in the article
LEADERS = 5


def period_label(period) -> str:
    p = int(period)
    y, m = divmod(p, 100)
    return f"{MONTHS_HE.get(m, str(m))} {y}"


def prev_period(period) -> int:
    y, m = divmod(int(period), 100)
    return (y - 1) * 100 + 12 if m == 1 else y * 100 + (m - 1)


def last_n_periods(period, n=12) -> list[str]:
    p, out = int(period), []
    for _ in range(n):
        out.append(str(p))
        p = prev_period(p)
    return out


def display_name(name: str | None) -> str:
    # data.gov.il sometimes stores S&P as the mangled token "S1;P"
    return re.sub(r"S\s*1;\s*P", "S&P", name or "", flags=re.I)


def fmt_pct(value, signed=True) -> str:
    if value is None:
        return ""
    n = float(value)
    body = f"{abs(n):.2f}%"
    if not signed:
        return body
    if n > 0:
        return f"+{body}"
    if n < 0:
        return f"−{body}"
    return f"{body}"


def classify(name: str | None) -> str | None:
    n = name or ""
    nu = n.upper().replace("״", '"').replace("׳", "'")
    nu = re.sub(r"S\s*1;\s*P", "S&P", nu, flags=re.I)
    nu = re.sub(r"S\s+AND\s+P", "S&P", nu, flags=re.I)
    if re.search(r"S\s*&?\s*P\s*500|S&P500|S&P\s*500", nu) or ("S&P" in nu and "500" in nu):
        return "S&P 500"
    if "S&P" in nu or re.search(r"סנפ", n):
        return "S&P 500"
    if re.search(r"NASDAQ|נאסדק|נאסד\"ק|נאסד״ק", nu):
        return "נאסד״ק"
    if re.search(r"כספי|כספית", n) or 'מק"מ' in n or "מק״מ" in n:
        return "כספי"
    if re.search(r'אג["״\']?\s*ח|אגח', n):
        return "אג״ח"
    if re.search(r"מניית|מניות", n):
        return "מנייתי"
    if re.search(r"לבני\s*\d|מדרג", n):
        return "מדרגות גיל"
    stripped = re.sub(r"פנסיה\s+כללית", " ", n)
    if re.search(r"כללי(?!ת)", stripped):
        return "כללי"
    return None


def yield_of(monthly: dict, fund_id, period) -> float | None:
    row = monthly.get(str(fund_id)) or monthly.get(fund_id)
    if not row:
        return None
    val = row.get(str(period))
    if val in (None, ""):
        return None
    try:
        return round(float(val), 4)
    except (TypeError, ValueError):
        return None


def trailing_12(monthly: dict, fund_id, period) -> float | None:
    row = monthly.get(str(fund_id)) or {}
    acc = 1.0
    for p in last_n_periods(period, 12):
        val = row.get(p)
        if val in (None, ""):
            return None
        try:
            acc *= 1.0 + float(val) / 100.0
        except (TypeError, ValueError):
            return None
    return round((acc - 1.0) * 100.0, 4)


def bucket_funds(funds, monthly, period, cls_value):
    rows = []
    for f in funds:
        if cls_value and f.get("cls") != cls_value:
            continue
        track = classify(f.get("name"))
        if not track:
            continue
        y = yield_of(monthly, f.get("id"), period)
        if y is None:
            continue
        rows.append({
            "id": f.get("id"),
            "name": f.get("name"),
            "mgr": f.get("mgr") or f.get("parent") or "",
            "assets": f.get("assets"),
            "track": track,
            "month": y,
            "prev": yield_of(monthly, f.get("id"), prev_period(period)),
            "t12": trailing_12(monthly, f.get("id"), period),
        })
    return rows


def summarize(rows, track, period):
    group = [r for r in rows if r["track"] == track]
    if not group:
        return None
    curr = [r["month"] for r in group]
    prev = [r["prev"] for r in group if r["prev"] is not None]
    t12 = [r["t12"] for r in group if r["t12"] is not None]
    leaders = [r for r in group if (r.get("assets") or 0) >= MIN_ASSETS_LEADERS]
    leaders.sort(key=lambda r: r["month"], reverse=True)
    if len(leaders) < 3:
        leaders = sorted(group, key=lambda r: r["month"], reverse=True)
        used_floor = False
    else:
        used_floor = True
    avg = mean(curr)
    avg_prev = mean(prev) if prev else None
    return {
        "track": track,
        "n": len(group),
        "n_prev": len(prev),
        "n_t12": len(t12),
        "avg": round(avg, 4),
        "avg_prev": None if avg_prev is None else round(avg_prev, 4),
        "delta": None if avg_prev is None else round(avg - avg_prev, 4),
        "avg_t12": None if not t12 else round(mean(t12), 4),
        "leaders_min_assets": MIN_ASSETS_LEADERS if used_floor else None,
        "leaders": [
            {
                "name": display_name(r["name"]),
                "mgr": r["mgr"],
                "assets": r.get("assets"),
                "month": r["month"],
                "t12": r["t12"],
            }
            for r in leaders[:LEADERS]
        ],
    }


def product_block(label_he, rows, period):
    tracks = []
    for track in TRACKS:
        s = summarize(rows, track, period)
        if s:
            tracks.append(s)
    if not tracks:
        return None
    return {"label": label_he, "tracks": tracks}


def track_sentences(block, month_he, prev_he) -> list[str]:
    lines = []
    for t in block["tracks"]:
        parts = [
            f"במסלול {t['track']} נמדדו {t['n']} קרנות, והממוצע החשבוני הלא משוקלל עמד על {fmt_pct(t['avg'])}."
        ]
        if t["avg_prev"] is not None and t["delta"] is not None:
            direction = "גבוה" if t["delta"] > 0 else "נמוך" if t["delta"] < 0 else "זהה"
            if t["delta"] == 0:
                parts.append(f"הממוצע זהה לממוצע {prev_he}, שעמד על {fmt_pct(t['avg_prev'])}.")
            else:
                parts.append(
                    f"לעומת {fmt_pct(t['avg_prev'])} ב{prev_he}, הממוצע {direction} ב־{fmt_pct(abs(t['delta']), signed=False)}."
                )
        if t["avg_t12"] is not None:
            parts.append(
                f"התשואה המצטברת ל־12 חודשים, על בסיס התשואות החודשיות שפורסמו ולפי {t['n_t12']} קרנות שיש להן סדרה מלאה, עמדה בממוצע על {fmt_pct(t['avg_t12'])}."
            )
        if t["leaders"]:
            floor = (
                f"בין קרנות עם נכסים של {MIN_ASSETS_LEADERS} מיליון שקל לפחות, "
                if t["leaders_min_assets"]
                else "המובילים לפי התשואה החודשית שפורסמה: "
            )
            bits = []
            for i, r in enumerate(t["leaders"][:3], 1):
                extra = f", {fmt_pct(r['t12'])} ב־12 חודשים" if r.get("t12") is not None else ""
                mgr = f" ({r['mgr']})" if r.get("mgr") else ""
                bits.append(f"{i}) {r['name']}{mgr}: {fmt_pct(r['month'])}{extra}")
            parts.append(floor + "; ".join(bits) + ".")
        lines.append(" ".join(parts))
    return lines


def build_article(funds: dict) -> dict | None:
    # Use the newest period that exists in all (or any) sets.
    periods = [s.get("period") for s in funds.get("sets", {}).values() if s.get("period")]
    if not periods:
        return None
    period = str(max(int(p) for p in periods))
    month_he = period_label(period)
    prev_he = period_label(prev_period(period))
    generated = funds.get("generatedAt")
    blocks = []
    for key, label, set_name, cls_value in PRODUCTS:
        s = (funds.get("sets") or {}).get(set_name)
        if not s:
            continue
        rows = bucket_funds(s.get("funds") or [], s.get("monthly") or {}, period, cls_value)
        block = product_block(label, rows, period)
        if block:
            block["id"] = key
            blocks.append(block)
    if not blocks:
        return None

    paras = [
        f"רשות שוק ההון פרסמה בגמל נט ובפנסיה נט את תשואות {month_he}. "
        "הנתונים כאן מעובדים מתוך הקובץ הציבורי ב-data.gov.il, לפי המסלול כפי שהוא מופיע בשם הקרן, "
        "והממוצעים הם חשבוניים ולא משוקללים בהיקף נכסים. מידע בלבד, לא ייעוץ.",
    ]
    # Short lead with a few headline averages if present
    headlines = []
    for b in blocks:
        for t in b["tracks"]:
            if t["track"] in ("כללי", "מנייתי", "S&P 500") and t["avg"] is not None:
                headlines.append(f"{b['label']}, מסלול {t['track']}: {fmt_pct(t['avg'])}")
    if headlines:
        paras.append("בקצרה, הממוצעים החודשיים: " + "; ".join(headlines[:9]) + ".")

    body_sections = []
    for b in blocks:
        sentences = track_sentences(b, month_he, prev_he)
        paras.append(b["label"] + ": " + " ".join(sentences))
        body_sections.append({"title": b["label"], "id": b["id"], "tracks": b["tracks"], "paragraphs": sentences})

    paras.append(
        "המקורות: גמל נט ופנסיה נט של רשות שוק ההון, כפי שפורסמו ב-data.gov.il "
        f"(תקופת דיווח {period}). הסיווג למסלול נעשה לפי שם הקרן שפורסם, בלי הערכה חיצונית של הרכב הנכסים. "
        "אין כאן המלצה לרכישה, מכירה או בחירת מסלול."
    )
    if generated:
        paras.append(f"קובץ הנתונים שממנו נבנתה הכתבה נוצר ב־{generated} (זמן UTC).")

    summary = (
        f"סיכום תשואות {month_he} בקרנות השתלמות, פנסיה וגמל, לפי מסלול, "
        "מתוך הפרסום הרשמי בגמל נט ובפנסיה נט. הממוצעים חשבוניים, וההשוואה היא מול החודש הקודם ול־12 חודשים. מידע בלבד, לא ייעוץ."
    )
    title = f"תשואות {month_he}: המובילים במסלולים הכללי, המנייתי, S&P 500 והאג״ח"
    return {
        "id": f"funds-monthly-{period}",
        "kind": "funds",
        "time": iso_il(),
        "title": title,
        "summary": summary,
        "source": "גמל נט, פנסיה נט ורשות שוק ההון (data.gov.il)",
        "period": period,
        "period_label": month_he,
        "links": SOURCE_LINKS,
        "body": "\n\n".join(paras),
        "sections": body_sections,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--funds", default=os.path.join(os.path.dirname(__file__), "..", "funds.json"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "news.json"))
    args = ap.parse_args()
    funds_path = os.path.abspath(args.funds)
    out_path = os.path.abspath(args.out)
    if not os.path.exists(funds_path):
        sys.exit(f"missing {funds_path}")
    with open(funds_path, encoding="utf-8") as f:
        funds = json.load(f)
    item = build_article(funds)
    if not item:
        print("no fund article could be built")
        return
    feed = load_news(out_path)
    upsert_items(feed, [item])
    save_news(out_path, feed)
    print(f"wrote {item['id']} ({item['period_label']}) into {out_path}")


if __name__ == "__main__":
    main()
