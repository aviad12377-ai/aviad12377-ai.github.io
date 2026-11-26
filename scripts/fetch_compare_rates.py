#!/usr/bin/env python3
"""Fetch official Bank of Israel rate workbooks and write data/loan-rates.json and data/savings.json.

Sources (do not invent rates):
- Early-repayment mortgage averages: https://www.boi.org.il/information/interestrates/mortgage/
  files: /boi_files/Pikuah/pribmash.xls (CPI-linked), mashfix.xls (unlinked)
- Non-housing credit averages: https://www.boi.org.il/information/interestrates/not-residence/
  file: /boi_files/Pikuah/nonhousingloans.xls
- Equator bank-by-bank deposits and household credit (actual rates paid/charged that month):
  https://www.boi.org.il/information/bank-paymnts/financial-education/campaigns/boi-equator/deposit/
  file: /boi_files/Pikuah/g060a.xls
- Bank of Israel policy rate (SDMX): MNT_RIB_BOI_D

Rates of 0 in Equator files are treated as unpublished (too few observations), not as zero interest.
"""
from __future__ import annotations

import json
import sys
import tempfile
import urllib.request
from datetime import date, datetime, timezone
from io import BytesIO
from pathlib import Path

try:
    import xlrd
except ImportError:
    xlrd = None
try:
    import openpyxl
except ImportError:
    openpyxl = None

UA = "Mozilla/5.0 (compatible; portal-compare-rates/1.0; +https://aviad12377-ai.github.io/)"
BASE = "https://www.boi.org.il/boi_files/Pikuah/"
FILES = {
    "pribmash": BASE + "pribmash.xls",
    "mashfix": BASE + "mashfix.xls",
    "nonhousing": BASE + "nonhousingloans.xls",
    "equator": BASE + "g060a.xls",
}
BOI_RATE_URL = (
    "https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/"
    "BOI.STATISTICS/BR/1.0/MNT_RIB_BOI_D?format=csv&lastNObservations=1&labels=id"
)
MORTGAGE_PAGE = "https://www.boi.org.il/information/interestrates/mortgage/"
NONHOUSING_PAGE = "https://www.boi.org.il/information/interestrates/not-residence/"
EQUATOR_DEPOSIT = "https://www.boi.org.il/information/bank-paymnts/financial-education/campaigns/boi-equator/deposit/"
EQUATOR_LOANS = "https://www.boi.org.il/information/bank-paymnts/financial-education/campaigns/boi-equator/loans/"
PRIME_PAGE = "https://www.boi.org.il/information/interestrates/primerates"
BOI_PRESS = "https://www.boi.org.il/publications/pressreleases/"

BANKS = [
    ("hapoalim", "הפועלים", "Bank Hapoalim"),
    ("leumi", "לאומי", "Bank Leumi"),
    ("discount", "דיסקונט", "Israel Discount Bank"),
    ("mizrahi", "מזרחי-טפחות", "Mizrahi-Tefahot"),
    ("fibi", "הבינלאומי", "First International Bank"),
    ("yahav", "יהב", "Bank Yahav"),
    ("mercantile", "מרכנתיל", "Mercantile Discount Bank"),
    ("massad", "מסד", "Bank Massad"),
    ("jerusalem", "ירושלים", "Bank of Jerusalem"),
    ("onezero", "One Zero", "One Zero"),
]
LENDERS_CREDIT = BANKS + [
    ("max", "מקס", "Max"),
    ("cal", "כאל", "Cal"),
    ("isracard", "ישראכרט", "Isracard"),
]
# Fixed/variable unindexed deposit terms as published in g060a L7.6.1a / L7.6.2a (starting column of rates)
DEPOSIT_TERMS = [
    ("daily", "יומי", 0, 1, "high"),
    ("weekly", "שבועי", 0, 7, "high"),
    ("up_to_1m", "עד חודש", 1, 31, "high"),
    ("1_to_3m", "חודש עד 3 חודשים", 31, 92, "medium"),
    ("3_to_6m", "3 חודשים עד 6 חודשים", 92, 183, "medium"),
    ("6m_to_1y", "6 חודשים עד שנה", 183, 365, "low"),
    ("1_to_2y", "שנה עד שנתיים", 365, 730, "low"),
    ("2_to_3y", "שנתיים עד 3 שנים", 730, 1095, "low"),
    ("3_to_5y", "3 שנים עד 5 שנים", 1095, 1825, "low"),
]
TERM_START_COLS = [2, 15, 28, 41, 54, 67, 80, 93, 106]  # 11 bank rates + system rate + system amount


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def xldate(n, datemode=0) -> str | None:
    if not isinstance(n, (int, float)) or n < 20000:
        if isinstance(n, str) and n.strip():
            s = n.strip()
            if s.startswith("20") and len(s) >= 7:
                return s[:10]
        return None
    if xlrd is None:
        # Excel serial, assume 1899-12-30
        from datetime import timedelta
        d = datetime(1899, 12, 30) + timedelta(days=int(n))
        return d.strftime("%Y-%m-%d")
    t = xlrd.xldate_as_tuple(float(n), datemode)
    return "%04d-%02d-%02d" % t[:3]


def load_xls(data: bytes):
    if xlrd is None:
        raise RuntimeError("xlrd is required to read .xls files")
    return xlrd.open_workbook(file_contents=data)


def load_xlsx(data: bytes):
    if openpyxl is None:
        raise RuntimeError("openpyxl is required to read .xlsx files")
    return openpyxl.load_workbook(BytesIO(data), data_only=True, read_only=True)


def is_zip(data: bytes) -> bool:
    return data[:2] == b"PK"


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        if v == 0:
            return None  # Equator: 0 = unpublished
        return round(float(v), 4)
    try:
        x = float(str(v).replace(",", ""))
        if x == 0:
            return None
        return round(x, 4)
    except ValueError:
        return None


def parse_pribmash(data: bytes) -> dict:
    book = load_xls(data)
    sh = book.sheet_by_name("RESULT")
    r = 6
    # cols: avg, 25+, 20-25, 15-20, 10-15, 5-10, up to 5, effective from, month
    labels = [
        ("average", 0),
        ("over_25y", 1),
        ("20_to_25y", 2),
        ("15_to_20y", 3),
        ("10_to_15y", 4),
        ("5_to_10y", 5),
        ("up_to_5y", 6),
    ]
    rates = {k: round(float(sh.cell_value(r, c)), 4) for k, c in labels}
    effective = xldate(sh.cell_value(r, 7), book.datemode)
    month = sh.cell_value(r, 8)
    month_s = month if isinstance(month, str) and "/" in str(month) else xldate(month, book.datemode)
    if month_s and "/" in str(month_s):
        # 31/10/2026
        p = str(month_s).strip().split("/")
        if len(p) == 3:
            month_s = f"{p[2]}-{p[1].zfill(2)}-{p[0].zfill(2)}"
    return {
        "linkage": "cpi",
        "period": (month_s or "")[:7],
        "reportMonth": month_s,
        "effectiveFrom": effective,
        "unit": "effective_annual_pct",
        "ratesByRemainingTerm": rates,
        "source": {"label": "בנק ישראל, ריבית ממוצעת על משכנתאות צמודות למדד", "url": MORTGAGE_PAGE, "file": FILES["pribmash"]},
        "usedFor": "early_repayment_fee",
    }


def parse_mashfix(data: bytes) -> dict:
    book = load_xls(data)
    sh = book.sheet_by_name("הלוואות שניתנו מ-01.03.2013")
    r = 7
    labels = [
        ("average", 0),
        ("over_25y", 1),
        ("20_to_25y", 2),
        ("15_to_20y", 3),
        ("10_to_15y", 4),
        ("5_to_10y", 5),
        ("1_to_5y", 6),
        ("up_to_1y", 7),
    ]
    rates = {k: round(float(sh.cell_value(r, c)), 4) for k, c in labels}
    effective = xldate(sh.cell_value(r, 8), book.datemode)
    month_s = xldate(sh.cell_value(r, 9), book.datemode)
    return {
        "linkage": "unlinked",
        "period": (month_s or "")[:7],
        "reportMonth": month_s,
        "effectiveFrom": effective,
        "unit": "effective_annual_pct",
        "ratesByRemainingTerm": rates,
        "note": "התקופה עד שנה כוללת גם הלוואות שמועד שינוי הריבית בהן אינו ידוע מראש (למשל פריים).",
        "source": {"label": "בנק ישראל, ריבית ממוצעת על משכנתאות במגזר השקלי הלא צמוד", "url": MORTGAGE_PAGE, "file": FILES["mashfix"]},
        "usedFor": "early_repayment_fee",
    }


def parse_nonhousing(data: bytes) -> dict:
    book = load_xls(data)
    out = {}
    sh = book.sheet_by_name("לא צמוד")
    r = sh.nrows - 1
    labels = [
        ("average", 0),
        ("over_5y", 1),
        ("2_to_5y", 2),
        ("1_to_2y", 3),
        ("3m_to_1y", 4),
        ("up_to_3m", 5),
    ]
    rates = {k: round(float(sh.cell_value(r, c)), 4) for k, c in labels}
    effective = xldate(sh.cell_value(r, 6), book.datemode)
    month_s = xldate(sh.cell_value(r, 7), book.datemode)
    out["unlinked"] = {
        "linkage": "unlinked",
        "period": (month_s or "")[:7],
        "reportMonth": month_s,
        "effectiveFrom": effective,
        "unit": "effective_annual_pct",
        "ratesByRemainingTerm": rates,
        "source": {"label": "בנק ישראל, ריבית ממוצעת אשראי לא לדיור — מגזר שקלי לא צמוד", "url": NONHOUSING_PAGE, "file": FILES["nonhousing"]},
    }
    sh2 = book.sheet_by_name("צמוד מדד")
    r2 = sh2.nrows - 1
    month2 = xldate(sh2.cell_value(r2, 2), book.datemode)
    out["cpi"] = {
        "linkage": "cpi",
        "period": (month2 or "")[:7],
        "reportMonth": month2,
        "effectiveFrom": xldate(sh2.cell_value(r2, 1), book.datemode),
        "unit": "effective_annual_pct",
        "average": round(float(sh2.cell_value(r2, 0)), 4),
        "source": {"label": "בנק ישראל, ריבית ממוצעת אשראי לא לדיור — מגזר צמוד מדד", "url": NONHOUSING_PAGE, "file": FILES["nonhousing"]},
    }
    return out


def _sheet_rows(wb, name):
    sh = wb[name]
    return list(sh.iter_rows(values_only=True))


def _latest_period_row(rows, col=1):
    for r in rows:
        v = r[col] if len(r) > col else None
        if isinstance(v, str) and v.startswith("20"):
            return v, r
    return None, None


def parse_equator_deposits(wb) -> dict:
    products = []
    file_date = None
    period = None
    for sheet, rate_type, type_he in (
        ("L7.6.1a", "fixed", "קבועה לא צמודה"),
        ("L7.6.2a", "variable", "משתנה לא צמודה"),
    ):
        rows = _sheet_rows(wb, sheet)
        if rows and rows[0] and rows[0][1]:
            d = rows[0][1]
            if isinstance(d, datetime):
                file_date = d.date().isoformat()
        per, latest = _latest_period_row(rows)
        if not latest:
            continue
        period = per
        for i, (term_id, term_he, min_d, max_d, liq) in enumerate(DEPOSIT_TERMS):
            start = TERM_START_COLS[i]
            system = num(latest[start + 10] if len(latest) > start + 10 else None)
            # 0 already becomes None in num(); keep system 0 as None too
            for b_i, (bid, bhe, ben) in enumerate(BANKS):
                rate = num(latest[start + b_i] if len(latest) > start + b_i else None)
                if rate is None:
                    continue
                products.append({
                    "id": f"{bid}-{rate_type}-{term_id}",
                    "providerId": bid,
                    "providerHe": bhe,
                    "providerEn": ben,
                    "kind": "deposit",
                    "rateType": rate_type,
                    "rateTypeHe": type_he,
                    "linkage": "unlinked",
                    "termId": term_id,
                    "termHe": term_he,
                    "termMinDays": min_d,
                    "termMaxDays": max_d,
                    "liquidity": liq,
                    "ratePct": rate,
                    "systemAvgPct": system,
                    "period": per,
                    "minAmount": None,
                    "maxAmount": None,
                    "earlyWithdrawal": "usually_forfeits_interest",
                })
    return {
        "period": period,
        "workbookDate": file_date,
        "unit": "average_annual_pct_actually_paid",
        "products": products,
        "source": {
            "label": "בנק ישראל, קו המשווה — ריבית ממוצעת על פיקדונות שנתקבלו בפועל",
            "url": EQUATOR_DEPOSIT,
            "file": FILES["equator"],
        },
        "notes": [
            "אלה ריביות ממוצעות ששולמו בפועל בחודש הדיווח, לא הצעת ריבית נוכחית.",
            "פיקדונות במטבע ישראלי שאינו צמוד למדד, משקי בית ללא בנקאות פרטית.",
            "ריבית בהנחה שהפיקדון נשמר עד סוף התקופה, בלי פירעון מוקדם.",
            "לא מוצגות ריביות לסגמנטים עם פחות מ-10 הפקדות, או לסוג ריבית ששיעורו מתחת ל-5% מסך ההפקדות. בקבצים ערך 0 טופל כחסר.",
        ],
    }


def parse_equator_credit(wb) -> dict:
    # L7.6.3a — mean rates: 10 banks + Max + Cal + Isracard + system
    rows = _sheet_rows(wb, "L7.6.3a")
    per, latest = _latest_period_row(rows)
    means = []
    if latest:
        for i, (lid, lhe, len_) in enumerate(LENDERS_CREDIT):
            rate = num(latest[2 + i] if len(latest) > 2 + i else None)
            means.append({"providerId": lid, "providerHe": lhe, "providerEn": len_, "averagePct": rate})
        system = num(latest[2 + len(LENDERS_CREDIT)] if len(latest) > 2 + len(LENDERS_CREDIT) else None)
    else:
        system = None
    # L7.6.4a — 25th / median / 75th for same lenders
    rows4 = _sheet_rows(wb, "L7.6.4a")
    per4, latest4 = _latest_period_row(rows4)
    percentiles = []
    if latest4:
        for i, (lid, lhe, len_) in enumerate(LENDERS_CREDIT):
            base = 2 + i * 3
            percentiles.append({
                "providerId": lid,
                "providerHe": lhe,
                "p25": num(latest4[base] if len(latest4) > base else None),
                "median": num(latest4[base + 1] if len(latest4) > base + 1 else None),
                "p75": num(latest4[base + 2] if len(latest4) > base + 2 else None),
            })
    file_date = None
    if rows and rows[0] and rows[0][1] and isinstance(rows[0][1], datetime):
        file_date = rows[0][1].date().isoformat()
    return {
        "period": per or per4,
        "workbookDate": file_date,
        "unit": "average_annual_pct_actually_charged",
        "systemAveragePct": system,
        "byLenderMean": means,
        "byLenderPercentiles": percentiles,
        "source": {
            "label": "בנק ישראל, קו המשווה — ריבית ממוצעת על אשראי למשקי בית שניתן בפועל",
            "url": EQUATOR_LOANS,
            "file": FILES["equator"],
        },
        "notes": [
            "אשראי במטבע ישראלי שאינו צמוד למדד, משקי בית ללא בנקאות פרטית.",
            "ממוצעים, לא הצעה אישית. הפער בין הרבע הזול ליקר בתוך אותו גוף גדול לעיתים מהפער בין הגופים.",
        ],
    }


def fetch_boi_policy_rate() -> dict:
    raw = fetch(BOI_RATE_URL).decode("utf-8", "replace")
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    # last data line
    header = lines[0].split(",")
    last = lines[-1].split(",")
    # TIME_PERIOD and OBS_VALUE columns
    try:
        i_t = header.index("TIME_PERIOD")
        i_v = header.index("OBS_VALUE")
        period = last[i_t]
        value = float(last[i_v])
    except (ValueError, IndexError):
        # fallback parse: look for 20xx-xx-xx and a number
        period, value = None, None
        for part in last:
            if part.startswith("20") and len(part) >= 10:
                period = part[:10]
            else:
                try:
                    value = float(part)
                except ValueError:
                    pass
    typical_margin = 1.5
    typical_prime = None if value is None else round(value + typical_margin, 4)
    return {
        "boiPolicyRatePct": value,
        "asOf": period,
        "typicalPrimeMarginPct": typical_margin,
        "typicalPrimePct": typical_prime,
        "note": "ריבית הפריים הנהוגה במערכת הבנקאית היא בדרך כלל ריבית בנק ישראל בתוספת 1.5%. השיעור המדויק נקבע בכל בנק; יש לאמת בפרסום הבנק.",
        "source": {
            "label": "בנק ישראל, סדרת ריבית בנק ישראל (MNT_RIB_BOI_D)",
            "url": "https://www.boi.org.il/information/bank-paymnts/guide/api-guide/",
            "seriesUrl": BOI_RATE_URL,
        },
        "primePage": PRIME_PAGE,
    }


def term_bucket_for_months(months: int, linkage: str) -> str:
    years = months / 12.0
    if linkage == "cpi":
        if years <= 5:
            return "up_to_5y"
        if years <= 10:
            return "5_to_10y"
        if years <= 15:
            return "10_to_15y"
        if years <= 20:
            return "15_to_20y"
        if years <= 25:
            return "20_to_25y"
        return "over_25y"
    # unlinked
    if years <= 1:
        return "up_to_1y"
    if years <= 5:
        return "1_to_5y"
    if years <= 10:
        return "5_to_10y"
    if years <= 15:
        return "10_to_15y"
    if years <= 20:
        return "15_to_20y"
    if years <= 25:
        return "20_to_25y"
    return "over_25y"


def build(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    checked = date.today().isoformat()

    blobs = {}
    for key, url in FILES.items():
        print("fetching", url, file=sys.stderr)
        blobs[key] = fetch(url)
        print("  ", key, "bytes", len(blobs[key]), file=sys.stderr)

    cpi_m = parse_pribmash(blobs["pribmash"])
    unl_m = parse_mashfix(blobs["mashfix"])
    nh = parse_nonhousing(blobs["nonhousing"])

    eq = blobs["equator"]
    if is_zip(eq):
        wb = load_xlsx(eq)
    else:
        # unexpected old xls — try converting via rename won't help; require xlsx
        raise RuntimeError("g060a.xls is not a zip/xlsx workbook")
    deposits = parse_equator_deposits(wb)
    credit = parse_equator_credit(wb)
    wb.close()

    policy = fetch_boi_policy_rate()

    loan = {
        "schema": 1,
        "generatedAt": fetched_at,
        "checkedOn": checked,
        "disclaimer": "מידע בלבד, לא ייעוץ. הממוצעים אינם הצעה אישית ואינם מחליפים בדיקה בבנק.",
        "policyRate": policy,
        "mortgageEarlyRepaymentAverages": {
            "cpiIndexed": cpi_m,
            "unlinked": unl_m,
        },
        "consumerLoanAverages": nh,
        "equatorHouseholdCredit": credit,
        "trackNotes": {
            "t_prime": "בנק ישראל אינו מפרסם ממוצע נפרד למסלול פריים. להשוואה משתמשים בריבית הפריים הטיפוסית (ריבית בנק ישראל + 1.5%) או בממוצע 'עד שנה' הלא צמוד המשמש גם לחישוב עמלת פירעון מוקדם.",
            "t_var_unlinked": "אין סדרת ממוצע נפרדת למסלול משתנה לא צמוד. להשוואת מחזור ניתן להיעזר בממוצע לפי תקופה שנותרה במגזר הלא צמוד, ולסמן שזו הערכה.",
            "t_fixed_unlinked": "השוואת מסלול קבועה לא צמודה מול הממוצע הלא צמוד לפי התקופה שנותרה (קובץ הריבית לעמלת פירעון מוקדם כולל גם מסלולים משתנים).",
            "t_fixed_linked": "השוואת מסלול קבועה צמודה מול הממוצע הצמוד לפי התקופה שנותרה.",
            "t_var_linked": "אין בקבצי עמלת הפירעון פירוט נפרד למשתנה צמודה; הממוצע הצמוד כולל קבועה ומשתנה יחד.",
        },
        "earlyRepaymentRules": {
            "source": {
                "label": "צו הבנקאות (פירעון מוקדם של הלוואה לדיור), התשס\"ב–2002",
                "url": "https://www.boi.org.il/information/interestrates/mortgage/",
                "formulaCircular": "https://boi.org.il/media/lqvg1b4g/h2103.pdf",
            },
            "operationalFeeMaxIls": 60,
            "noNoticeFeePct": 0.1,
            "noticeDays": 10,
            "capitalization": "If current average A is below the loan rate R, fee is PV(future payments at A) minus PV(future payments at R), using monthly equivalent of effective annual rates. Bank may charge the lower of this and the same calculation versus the average at origination.",
            "variableRate": "If rate-change dates are unknown, or change at least once a year (e.g. prime), no capitalization fee. If the rate changes every 5 years, treat remaining principal on the next change date as the final payment.",
            "holdingDiscounts": [
                {"afterYears": 3, "reductionPct": 20},
                {"afterYears": 5, "reductionPct": 30},
            ],
            "estimateOnly": True,
        },
    }
    (out_dir / "loan-rates.json").write_text(json.dumps(loan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    savings = {
        "schema": 1,
        "generatedAt": fetched_at,
        "checkedOn": checked,
        "disclaimer": "מידע בלבד, לא ייעוץ. הריביות הן ממוצעים ששולמו בפועל בחודש הדיווח, לא הצעה נוכחית.",
        "deposits": deposits,
        "moneyMarketFunds": {
            "note": "תשואות קרנות כספיות (קרנות נאמנות) משתנות מדי יום ואינן מופיעות בקו המשווה. ממשק מאיה/הבורסה הציבורי לא סיפק תשואות בלי מפתח, וקובץ funds.json מכיל מסלולים כספיים בגמל/פנסיה/ביטוח — לא קרנות כספיות. מוצג קישור למאיה בלי תשואה מומצאת.",
            "source": {
                "label": "הבורסה לניירות ערך, מאיה — קרנות נאמנות",
                "url": "https://maya.tase.co.il/funds",
            },
            "funds": [
                {"nameHe": "קרן כספית שקלית (כללית)", "kind": "mmf", "currency": "ILS", "liquidity": "high", "termHe": "נזילה", "ratePct": None, "rateType": "variable", "linkage": "unlinked", "minAmount": None, "providerHe": "בהתאם למנהל הקרן", "infoUrl": "https://maya.tase.co.il/funds"}
            ],
        },
        "gaps": [
            "אין בנתונים הרשמיים האלה ריביות פרסומיות נוכחיות ('מהיום') של הבנקים — רק ממוצעי ביצוע לחודש שעבר.",
            "אין סכום מינימום או מקסימום רשמי בקו המשווה, לכן סינון לפי סכום מחשב רק את הריבית המוערכת ולא פוסל מוצרים.",
            "פיקדונות צמודי מדד אינם כלולים בקובץ קו המשווה (רק לא צמוד).",
            "תשואות קרנות כספיות לא נמשכו ממאיה או מ-funds.json (שם יש מסלולים כספיים בחיסכון ארוך טווח, לא קרנות נאמנות); מוצג קישור למאיה בלי תשואה.",
        ],
        "bankRatePages": [
            {"providerHe": "הפועלים", "url": "https://www.bankhapoalim.co.il/"},
            {"providerHe": "לאומי", "url": "https://www.leumi.co.il/"},
            {"providerHe": "דיסקונט", "url": "https://www.discountbank.co.il/"},
            {"providerHe": "מזרחי-טפחות", "url": "https://www.mizrahi-tefahot.co.il/"},
            {"providerHe": "הבינלאומי", "url": "https://www.fibi.co.il/"},
            {"providerHe": "יהב", "url": "https://www.bankyahav.co.il/"},
            {"providerHe": "ירושלים", "url": "https://www.bankjerusalem.co.il/"},
        ],
    }
    (out_dir / "savings.json").write_text(json.dumps(savings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", out_dir / "loan-rates.json", "and", out_dir / "savings.json")
    print("deposits", len(deposits["products"]), "period", deposits["period"])
    print("mortgage cpi period", cpi_m["period"], "unlinked", unl_m["period"])
    print("consumer", nh["unlinked"]["period"], "equator credit", credit["period"], "system", credit["systemAveragePct"])
    print("policy", policy)


if __name__ == "__main__":
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "data"
    build(dest)
