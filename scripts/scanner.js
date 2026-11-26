(function () {
  "use strict";
  if (window.PortalNav && window.PortalNav.mount) window.PortalNav.mount("scanner");

  var root = document.getElementById("scanner-root");
  var statusEl = document.getElementById("scanner-status");

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") node.textContent = v;
      else if (k === "onclick") node.addEventListener("click", v);
      else node.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function setStatus(text) { if (statusEl) statusEl.textContent = text || ""; }

  function fmtNum(n, digits) {
    if (n === null || n === undefined || isNaN(Number(n))) return "—";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: digits == null ? 2 : digits, minimumFractionDigits: digits || 0 });
  }

  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(Number(n))) return "—";
    var v = Number(n);
    var s = Math.abs(v).toFixed(2) + "%";
    if (v > 0) return "+" + s;
    if (v < 0) return "−" + s;
    return s;
  }

  function pctClass(n) {
    if (n === null || n === undefined || isNaN(Number(n))) return "num";
    if (Number(n) > 0) return "num pos";
    if (Number(n) < 0) return "num neg";
    return "num";
  }

  function fmtCap(row) {
    if (row.market_cap_display) return row.market_cap_display;
    var n = row.market_cap_usd;
    if (n == null) return "—";
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return fmtNum(n, 0);
  }


  function closeDate(data) {
    var raw = data.us_close_date;
    if (!raw) return null;
    var m = String(raw).match(/(\d{4}-\d{2}-\d{2})/);
    if (!m) return null;
    if (data.date) {
      var a = Date.parse(data.date), b = Date.parse(m[1]);
      if (isFinite(a) && isFinite(b) && (a - b) > 20 * 86400000) return null;
    }
    return m[1];
  }

  function comparedLabel(raw) {
    if (!raw) return "";
    var m = String(raw).match(/(\d{4}-\d{2}-\d{2})/);
    return m ? ("סריקה מ־" + m[1]) : String(raw);
  }

  function metric(label, value, cls) {
    return el("div", {}, [el("span", { text: label }), el("b", { class: cls || "num", text: value })]);
  }

  // plain-Hebrew labels with one-line explanations (used in cards, table headers and the glossary)
  var LBL = {
    cap: ["שווי שוק", "כמה כל החברה שווה בבורסה"],
    pe: ["מכפיל רווח", "מחיר המניה חלקי הרווח למניה בשנה האחרונה"],
    fwd: ["מכפיל רווח צפוי", "כמו מכפיל רווח, לפי תחזית הרווח לשנה הבאה"],
    peg: ["PEG", "מכפיל הרווח חלקי קצב צמיחת הרווח. מתחת ל־1 נחשב זול ביחס לצמיחה"],
    short: ["שורט (%)", "איזה חלק מהמניות הזמינות למסחר מושאל למכירה בחסר"],
    dtc: ["ימים לכיסוי", "כמה ימי מסחר ממוצעים צריך כדי שכל השורטיסטים יסגרו את הפוזיציה"],
    price: ["מחיר ($)", "מחיר הסגירה האחרון"],
    chg: ["שינוי יומי", "השינוי ביום המסחר האחרון"],
    month: ["שינוי בחודש", "השינוי בחודש האחרון"],
    earn: ["דוחות", "מועד הדוחות האחרון או הקרוב"]
  };
  function lbl(k) { return LBL[k][0]; }
  function shortPct(row) { return row.short_float_pct == null ? "—" : fmtNum(row.short_float_pct, 1) + "%"; }

  function card(row, i, big) {
    var key = el("div", { class: "scan-grid" }, [
      metric(lbl("short"), shortPct(row)),
      metric(lbl("peg"), fmtNum(row.peg, 2)),
      metric(lbl("price"), fmtNum(row.price, 2)),
      metric(lbl("chg"), fmtPct(row.change_pct), pctClass(row.change_pct))
    ]);
    var more = el("details", { class: "scan-more" }, [
      el("summary", { text: "עוד נתונים" }),
      el("div", { class: "scan-grid" }, [
        metric(lbl("cap"), fmtCap(row)), metric(lbl("pe"), fmtNum(row.pe, 2)), metric(lbl("fwd"), fmtNum(row.fwd_pe, 2)),
        metric(lbl("dtc"), fmtNum(row.days_to_cover, 1)), metric(lbl("month"), fmtPct(row.perf_month_pct), pctClass(row.perf_month_pct)), metric(lbl("earn"), row.earnings || "—", "")
      ])
    ]);
    return el("article", { class: "scan-card" + (big ? " top3" : "") }, [
      el("div", { class: "scan-card-head" }, [
        el("span", { class: "scan-rank", text: String(row.rank || i + 1) }),
        el("div", {}, [el("h3", { dir: "ltr", text: row.ticker || "" }), el("div", { class: "co", text: [row.company, row.sector].filter(Boolean).join(" · ") })])
      ]),
      key, more
    ]);
  }

  function render(data) {
    root.textContent = "";
    var top = data.top || [], counts = data.counts || {};

    // 1. one primary action
    root.appendChild(el("div", { class: "toolbar scan-cta" }, [
      el("a", { class: "btn btn-primary", href: "#short-list", text: "לרשימה של היום (" + top.length + ")" })
    ]));

    // 2. top 3 first
    if (top.length) {
      var t3 = el("section", { class: "card", "aria-labelledby": "scan-top3" }, [
        el("h2", { class: "card-title", id: "scan-top3", text: "שלוש הבולטות היום" }),
        el("p", { class: "help", text: "המניות עם השורט הגבוה ביותר מתוך אלה שעברו את כל המסננים. מעקב בלבד, לא המלצה." })
      ]);
      var g = el("div", { class: "scan-top3" });
      top.slice(0, 3).forEach(function (r, i) { g.appendChild(card(r, i, true)); });
      t3.appendChild(g);
      root.appendChild(t3);
    }

    // 3. what changed, short
    if ((data.entered && data.entered.length) || (data.exited && data.exited.length)) {
      var row = el("div", { class: "scan-chiprow", "aria-label": "שינויים מול הסריקה הקודמת" });
      (data.entered || []).forEach(function (t) { row.appendChild(el("span", { class: "scan-chip", text: "נכנסה " + t })); });
      (data.exited || []).forEach(function (t) { row.appendChild(el("span", { class: "scan-chip out", text: "יצאה " + t })); });
      root.appendChild(el("section", { class: "card" }, [
        el("h2", { class: "card-title", text: "מה השתנה מאתמול" }),
        data.compared_to ? el("p", { class: "help", text: "בהשוואה ל" + comparedLabel(data.compared_to) }) : null, row
      ]));
    }

    // 4. full short list: cards on mobile, table with sticky ticker column on desktop
    var list = el("section", { class: "card", id: "short-list", tabindex: "-1" }, [
      el("h2", { class: "card-title", text: "הרשימה הקצרה" }),
      el("p", { class: "help", text: "ממוין לפי השורט מהמניות הסחירות, אחרי כל המסננים ובדיקת הנזילות." })
    ]);
    if (!top.length) {
      list.appendChild(el("p", { class: "empty", text: "אין רשימה לתאריך הזה. הסריקה הבאה בבוקר יום החול הקרוב." }));
    } else {
      var cols = [["#", null], [ "סימול", null], ["חברה", null], [lbl("cap"), "cap"], [lbl("pe"), "pe"], [lbl("fwd"), "fwd"], ["PEG", "peg"], [lbl("short"), "short"], [lbl("dtc"), "dtc"], [lbl("price"), "price"], [lbl("chg"), "chg"]];
      var table = el("table", { class: "scan-table" });
      table.appendChild(el("caption", { class: "sr-only", text: "רשימת המעקב של הסורק, " + (data.date || "") }));
      table.appendChild(el("thead", {}, [el("tr", {}, cols.map(function (c) { return el("th", { scope: "col", title: c[1] ? LBL[c[1]][1] : null, text: c[0] }); }))]));
      var tb = el("tbody");
      top.forEach(function (row, i) {
        tb.appendChild(el("tr", {}, [
          el("td", { class: "num", text: String(row.rank || i + 1) }),
          el("th", { scope: "row", class: "tk", dir: "ltr", text: row.ticker || "" }),
          el("td", { text: row.company || "" }),
          el("td", { class: "num", text: fmtCap(row) }),
          el("td", { class: "num", text: fmtNum(row.pe, 2) }),
          el("td", { class: "num", text: fmtNum(row.fwd_pe, 2) }),
          el("td", { class: "num", text: fmtNum(row.peg, 2) }),
          el("td", { class: "num", text: shortPct(row) }),
          el("td", { class: "num", text: fmtNum(row.days_to_cover, 1) }),
          el("td", { class: "num", text: fmtNum(row.price, 2) }),
          el("td", { class: pctClass(row.change_pct), text: fmtPct(row.change_pct) })
        ]));
      });
      table.appendChild(tb);
      list.appendChild(el("div", { class: "scan-table-wrap", tabindex: "0", "aria-label": "טבלה, אפשר לגלול לצדדים" }, [table]));
      var cards = el("div", { class: "scan-cards" });
      top.forEach(function (r, i) { cards.appendChild(card(r, i, false)); });
      list.appendChild(cards);
    }
    root.appendChild(list);

    // 5. method, filters, counts and glossary: collapsed
    var how = el("details", { class: "card scan-how" }, [el("summary", { text: "איך הרשימה נבנית ומה המונחים אומרים" })]);
    var kpis = el("div", { class: "scan-kpis" });
    [["תאריך סריקה", data.date || "—", ""], ["נמצאו במסך", fmtNum(counts.raw, 0), "num"], ["עברו את המסננים", fmtNum(counts.after_filters, 0), "num"], ["נזילות מספיק", fmtNum(counts.liquid, 0), "num"]].forEach(function (r) {
      kpis.appendChild(el("div", { class: "scan-kpi" }, [el("span", { class: "k", text: r[0] }), el("span", { class: "v " + r[2], text: String(r[1]) })]));
    });
    how.appendChild(kpis);
    how.appendChild(el("h3", { text: "מסננים קבועים" }));
    how.appendChild(el("p", { class: "help", text: data.update_schedule || "מתעדכן בימי חול בבוקר, לפי נתוני הסגירה בארה״ב." }));
    var ul = el("ul", { class: "scan-filters" });
    (data.filters || []).forEach(function (f) { ul.appendChild(el("li", { text: f.label || f.field || "" })); });
    if (data.liquidity_rule && data.liquidity_rule.label) ul.appendChild(el("li", { text: data.liquidity_rule.label }));
    how.appendChild(ul);
    var close = closeDate(data);
    if (close) how.appendChild(el("p", { class: "stamp", text: "סגירת ארה״ב ששימשה בסריקה: " + close }));
    if (data.source && data.source.screener) {
      var src = "מקור הסינון: " + data.source.screener;
      if (data.source.short_interest) src += ". שורט: " + data.source.short_interest + ".";
      how.appendChild(el("p", { class: "stamp", text: src }));
      if (data.source.url) how.appendChild(el("p", {}, [el("a", { href: data.source.url, target: "_blank", rel: "noopener noreferrer", text: "פתיחת המסך ב־Finviz" })]));
    }
    how.appendChild(el("h3", { text: "מילון מונחים" }));
    var dl = el("dl", { class: "scan-gloss" });
    Object.keys(LBL).forEach(function (k) { dl.appendChild(el("dt", { text: LBL[k][0] })); dl.appendChild(el("dd", { text: LBL[k][1] })); });
    how.appendChild(dl);
    root.appendChild(how);

    root.appendChild(el("p", { class: "footer-note", text: data.disclaimer || "מידע בלבד, לא ייעוץ." }));
    setStatus(data.updated_at_israel ? "זמן הסריקה: " + data.updated_at_israel : "");
  }

  setStatus("טוען את הסריקה…");
  root.appendChild(el("div", { class: "skel", role: "status", "aria-label": "טוען" }, [el("div", { class: "skel-row" }), el("div", { class: "skel-row" }), el("div", { class: "skel-row" })]));
  fetch("data/scanner.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    })
    .then(render)
    .catch(function () {
      setStatus("לא הצלחתי לטעון את הסריקה. אפשר לרענן את העמוד.");
      root.textContent = "";
      root.appendChild(el("p", { class: "empty", text: "טעינת הסורק נכשלה." }));
    });
})();
