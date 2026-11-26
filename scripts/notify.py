#!/usr/bin/env python3
"""Send brief / breaking alerts to opted-in subscribers. GATED.

Email goes out only when ALL of these are set (repo variables / secrets):
  EMAIL_SENDING_ENABLED=true, MAIL_FOOTER_ADDRESS (sender's physical postal address),
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Web Push goes out only when PUSH_ENABLED=true, VAPID_PRIVATE_KEY, VAPID_SUBJECT and the Supabase pair are set,
and pywebpush is installed. Otherwise the script prints what it would do and exits 0.

  python3 scripts/notify.py --brief data/briefs/latest.json            # brief alert for its topic
  python3 scripts/notify.py --breaking data/breaking.json              # new breaking items
  python3 scripts/notify.py --confirmations                            # double opt-in mails
  python3 scripts/notify.py --brief data/briefs/latest.json --preview out.html   # render only, no network
"""
from __future__ import annotations

import argparse
import html
import json
import os
import smtplib
import sys
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

SITE = "https://aviad12377-ai.github.io"
TOPIC_OF = {"week_ahead": "week"}
MAX_BREAKING_PER_RUN = 2


def env(k):
    return (os.environ.get(k) or "").strip()


def email_ready():
    need = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_FOOTER_ADDRESS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [k for k in need if not env(k)]
    if env("EMAIL_SENDING_ENABLED").lower() != "true":
        missing.insert(0, "EMAIL_SENDING_ENABLED=true")
    return missing


def push_ready():
    need = ["VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    missing = [k for k in need if not env(k)]
    if env("PUSH_ENABLED").lower() != "true":
        missing.insert(0, "PUSH_ENABLED=true")
    try:
        import pywebpush  # noqa: F401
    except Exception:
        missing.append("pywebpush")
    return missing


def rest(method, path, body=None):
    url = env("SUPABASE_URL").rstrip("/") + "/rest/v1/" + path
    key = env("SUPABASE_SERVICE_ROLE_KEY")
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=20) as r:
        t = r.read()
        return json.loads(t) if t else None


# ---------- rendering ----------
def shell(title, inner, unsub_url):
    foot = html.escape(env("MAIL_FOOTER_ADDRESS") or "[כתובת למשלוח דואר תתווסף לפני ההשקה]")
    return f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{html.escape(title)}</title></head>
<body style="margin:0;background:#0d0d10;color:#f4f4f6;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6">
<div style="max-width:600px;margin:0 auto;padding:20px" dir="rtl">{inner}
<hr style="border:0;border-top:1px solid #333;margin:24px 0">
<p style="font-size:13px;color:#b4b4c0">מידע כללי בלבד, לא ייעוץ. קיבלת את המייל כי נרשמת למבזקי השוק באתר.
<a href="{unsub_url}" style="color:#c4b5fd">להסרה מרשימת התפוצה</a> · <a href="{SITE}/alerts.html" style="color:#c4b5fd">שינוי ההעדפות</a><br>{foot}</p>
</div></body></html>"""


def brief_html(b, unsub_url):
    rows = "".join(
        f"<tr><td style='padding:6px 4px;border-bottom:1px solid #2a2a33'>{html.escape(r['name'])}</td><td style='padding:6px 4px;border-bottom:1px solid #2a2a33' dir='ltr'>{html.escape(r['display'])}</td>"
        f"<td style='padding:6px 4px;border-bottom:1px solid #2a2a33;color:{'#4ade80' if r['dir']=='up' else '#f87171' if r['dir']=='down' else '#b4b4c0'}' dir='ltr'>{html.escape(r['change_text'])}</td></tr>"
        for r in (b.get("indices") or [])[:12])
    stories = "".join(f"<h3 style='font-size:17px;margin:16px 0 4px'>{html.escape(s['title'])}</h3><p style='margin:0'>{html.escape(s['text'])}</p>" for s in b.get("stories", []) if s.get("text"))
    link = f"{SITE}/briefs.html?id={b['id']}"
    inner = (f"<p style='color:#93c5fd;font-weight:bold;margin:0'>{html.escape(b['edition'])} · {html.escape(b.get('date',''))}</p>"
             f"<h1 style='font-size:22px;margin:6px 0 12px'>{html.escape(b['title'])}</h1>"
             + (f"<table style='width:100%;border-collapse:collapse;font-size:15px'>{rows}</table>" if rows else "")
             + stories + f"<p style='margin:20px 0'><a href='{link}' style='display:inline-block;background:#7c3aed;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold'>למבזק המלא עם הגרפים</a></p>")
    return shell(b["title"], inner, unsub_url)


def breaking_html(items, unsub_url):
    li = "".join(f"<li style='margin:0 0 12px'><b>{html.escape(i['title'])}</b><br><span style='color:#b4b4c0;font-size:14px'>{html.escape(i['source'])}</span> · <a href='{html.escape(i['url'])}' style='color:#c4b5fd'>לכתבה</a></li>" for i in items)
    return shell("חדשות חמות", f"<p style='color:#f87171;font-weight:bold;margin:0'>חדשות חמות</p><ul style='padding-inline-start:18px'>{li}</ul><p><a href='{SITE}/news.html' style='color:#c4b5fd'>לכל החדשות</a></p>", unsub_url)


def confirm_html(token):
    url = f"{SITE}/alerts.html?confirm={token}"
    inner = (f"<h1 style='font-size:22px'>רק עוד צעד אחד</h1><p>כדי להתחיל לקבל את מבזקי השוק במייל, צריך לאשר שהכתובת שלך.</p>"
             f"<p><a href='{url}' style='display:inline-block;background:#7c3aed;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold'>אישור הכתובת</a></p>"
             "<p style='color:#b4b4c0;font-size:14px'>אם לא נרשמת, אפשר להתעלם מהמייל הזה ולא יישלחו אליך מיילים נוספים.</p>")
    return shell("אישור הרשמה למבזקי השוק", inner, f"{SITE}/alerts.html")


# ---------- sending ----------
def send_mail(to, subject, body_html, unsub_url):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr(("מבזקי שוק", env("MAIL_FROM")))
    msg["To"] = to
    msg["Message-ID"] = make_msgid()
    msg["List-Unsubscribe"] = f"<{unsub_url}>"
    msg.set_content("כדי לקרוא את המייל צריך תצוגת HTML. מבזקים: " + SITE + "/briefs.html  ·  להסרה: " + unsub_url)
    msg.add_alternative(body_html, subtype="html")
    with smtplib.SMTP(env("SMTP_HOST"), int(env("SMTP_PORT") or 587), timeout=30) as s:
        s.starttls()
        s.login(env("SMTP_USER"), env("SMTP_PASS"))
        s.send_message(msg)


def email_topic(topic, subject, render, key):
    missing = email_ready()
    if missing:
        print(f"[email gated] would send '{subject}' to subscribers of '{topic}'. Missing: {', '.join(missing)}")
        return
    subs = rest("GET", f"portal_subscribers?select=id,email,unsub_token,last_sent_key&confirmed_at=not.is.null&unsubscribed_at=is.null&topics=cs.{{{topic}}}")
    sent = 0
    for s in subs or []:
        if s.get("last_sent_key") == key:
            continue
        unsub = f"{SITE}/alerts.html?unsub={s['unsub_token']}"
        try:
            send_mail(s["email"], subject, render(unsub), unsub)
            rest("PATCH", f"portal_subscribers?id=eq.{s['id']}", {"last_sent_at": "now()", "last_sent_key": key})
            sent += 1
        except Exception as e:  # noqa: BLE001
            print("mail fail", s["id"], e, file=sys.stderr)
    print(f"email sent {sent}")


def push_topic(topic, title, body, url, tag):
    missing = push_ready()
    if missing:
        print(f"[push gated] would push '{title}' to '{topic}'. Missing: {', '.join(missing)}")
        return
    from pywebpush import WebPushException, webpush
    subs = rest("GET", f"portal_push_subs?select=id,endpoint,p256dh,auth&gone_at=is.null&topics=cs.{{{topic}}}")
    payload = json.dumps({"title": title, "body": body[:180], "url": url, "tag": tag}, ensure_ascii=False)
    sent = 0
    for s in subs or []:
        try:
            webpush({"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}}, payload,
                    vapid_private_key=env("VAPID_PRIVATE_KEY"), vapid_claims={"sub": env("VAPID_SUBJECT")}, ttl=3600)
            sent += 1
        except WebPushException as e:
            code = getattr(getattr(e, "response", None), "status_code", 0)
            if code in (404, 410):
                rest("PATCH", f"portal_push_subs?id=eq.{s['id']}", {"gone_at": "now()"})
            else:
                print("push fail", s["id"], code, file=sys.stderr)
    print(f"push sent {sent}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief")
    ap.add_argument("--breaking")
    ap.add_argument("--confirmations", action="store_true")
    ap.add_argument("--preview")
    a = ap.parse_args()
    if a.brief:
        b = json.load(open(a.brief, encoding="utf-8"))
        topic = TOPIC_OF.get(b["slot"], b["slot"])
        if a.preview:
            open(a.preview, "w", encoding="utf-8").write(brief_html(b, SITE + "/alerts.html?unsub=PREVIEW"))
            print("preview", a.preview)
            return
        subject = f"{b['edition']}: {b['title']}"[:140]
        email_topic(topic, subject, lambda u: brief_html(b, u), b["id"])
        push_topic(topic, b["edition"], b["title"], f"{SITE}/briefs.html?id={b['id']}", b["id"])
    if a.breaking:
        d = json.load(open(a.breaking, encoding="utf-8"))
        new = [i for i in d.get("items", []) if i["id"] in set(d.get("new") or [])][:MAX_BREAKING_PER_RUN]
        if not new:
            print("no new breaking items")
        elif a.preview:
            open(a.preview, "w", encoding="utf-8").write(breaking_html(new, SITE + "/alerts.html?unsub=PREVIEW"))
        else:
            key = "br-" + new[0]["id"]
            email_topic("breaking", "חדשות חמות: " + new[0]["title"][:110], lambda u: breaking_html(new, u), key)
            for i in new:
                push_topic("breaking", "חדשות חמות · " + i["source"], i["title"], i["url"] if i.get("url", "").startswith("http") else SITE + "/news.html", i["id"])
    if a.confirmations:
        missing = email_ready()
        if missing:
            print(f"[email gated] confirmation mails not sent. Missing: {', '.join(missing)}")
            return
        rows = rest("GET", "portal_subscribers?select=id,email,confirm_token&confirmed_at=is.null&unsubscribed_at=is.null&confirm_sent_at=is.null&limit=50")
        for r in rows or []:
            try:
                send_mail(r["email"], "אישור הרשמה למבזקי השוק", confirm_html(r["confirm_token"]), f"{SITE}/alerts.html")
                rest("PATCH", f"portal_subscribers?id=eq.{r['id']}", {"confirm_sent_at": "now()"})
            except Exception as e:  # noqa: BLE001
                print("confirm fail", r["id"], e, file=sys.stderr)


if __name__ == "__main__":
    main()
