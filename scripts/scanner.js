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

  function render(data) {
    root.textContent = "";
    var kpis = el("div", { class: "scan-kpis" });
    var counts = data.counts || {};
    [
      ["תאריך סריקה", data.date || "—", ""],
      ["נמצאו במסך", fmtNum(counts.raw, 0), "num"],
      ["עברו סינון", fmtNum(counts.after_filters, 0), "num"],
      ["נזילים", fmtNum(counts.liquid, 0), "num"]
    ].forEach(function (row) {
      kpis.appendChild(el("div", { class: "scan-kpi" }, [
        el("span", { class: "k", text: row[0] }),
        el("span", { class: "v " + row[2], text: String(row[1]) })
      ]));
    });
    root.appendChild(kpis);

    var meta = el("section", { class: "card" }, [
      el("h2", { class: "card-title", text: "מסננים קבועים" }),
      el("p", { class: "help", text: data.update_schedule || "מתעדכן בימי חול בבוקר, לפי נתוני הסגירה בארה״ב." })
    ]);
    var ul = el("ul", { class: "scan-filters" });
    (data.filters || []).forEach(function (f) { ul.appendChild(el("li", { text: f.label || f.field || "" })); });
    if (data.liquidity_rule && data.liquidity_rule.label) ul.appendChild(el("li", { text: data.liquidity_rule.label }));
    meta.appendChild(ul);
    var close = closeDate(data);
    if (close) meta.appendChild(el("p", { class: "stamp", text: "סגירת ארה״ב ששימשה בסריקה: " + close }));
    if (data.source && data.source.screener) {
      var src = "מקור הסינון: " + data.source.screener;
      if (data.source.short_interest) src += ". שורט: " + data.source.short_interest + ".";
      meta.appendChild(el("p", { class: "stamp", text: src }));
      if (data.source.url) {
        meta.appendChild(el("p", {}, [el("a", { href: data.source.url, target: "_blank", rel: "noopener noreferrer", text: "פתיחת המסך ב-Finviz" })]));
      }
    }
    root.appendChild(meta);

    if ((data.entered && data.entered.length) || (data.exited && data.exited.length) || data.compared_to) {
      var ch = el("section", { class: "card" }, [
        el("h2", { class: "card-title", text: "שינויים מול הסריקה הקודמת" }),
        data.compared_to ? el("p", { class: "help", text: "השוואה אל: " + comparedLabel(data.compared_to) }) : null
      ]);
      var row = el("div", { class: "scan-chiprow" });
      (data.entered || []).forEach(function (t) { row.appendChild(el("span", { class: "scan-chip", text: "נכנס " + t })); });
      (data.exited || []).forEach(function (t) { row.appendChild(el("span", { class: "scan-chip out", text: "יצא " + t })); });
      if (!row.childNodes.length) ch.appendChild(el("p", { class: "empty", text: "אין כניסות או יציאות ברשימה הקצרה." }));
      else ch.appendChild(row);
      root.appendChild(ch);
    }

    var top = data.top || [];
    var list = el("section", { class: "card" }, [
      el("h2", { class: "card-title", text: "הרשימה הקצרה" }),
      el("p", { class: "help", text: "מיון לפי שיעור השורט מהפלואט, אחרי הסינון והנזילות. מעקב בלבד." })
    ]);
    if (!top.length) {
      list.appendChild(el("p", { class: "empty", text: "אין רשימה להצגה לתאריך הזה." }));
      root.appendChild(list);
      return;
    }

    var table = el("table", { class: "scan-table" });
    table.appendChild(el("caption", { class: "sr-only", text: "רשימת המעקב של הסורק, " + (data.date || "") }));
    table.appendChild(el("thead", {}, [el("tr", {}, [
      el("th", { scope: "col", text: "#" }),
      el("th", { scope: "col", text: "סימול" }),
      el("th", { scope: "col", text: "חברה" }),
      el("th", { scope: "col", text: "שווי" }),
      el("th", { scope: "col", text: "מכפיל" }),
      el("th", { scope: "col", text: "קדימה" }),
      el("th", { scope: "col", text: "PEG" }),
      el("th", { scope: "col", text: "שורט %" }),
      el("th", { scope: "col", text: "ימים לכיסוי" }),
      el("th", { scope: "col", text: "מחיר" }),
      el("th", { scope: "col", text: "שינוי" })
    ])]));
    var tb = el("tbody");
    top.forEach(function (row, i) {
      tb.appendChild(el("tr", {}, [
        el("td", { class: "num", text: String(row.rank || i + 1) }),
        el("td", { class: "tk", text: row.ticker || "" }),
        el("td", { text: row.company || "" }),
        el("td", { class: "num", text: fmtCap(row) }),
        el("td", { class: "num", text: fmtNum(row.pe, 2) }),
        el("td", { class: "num", text: fmtNum(row.fwd_pe, 2) }),
        el("td", { class: "num", text: fmtNum(row.peg, 2) }),
        el("td", { class: "num", text: row.short_float_pct == null ? "—" : fmtNum(row.short_float_pct, 2) + "%" }),
        el("td", { class: "num", text: fmtNum(row.days_to_cover, 2) }),
        el("td", { class: "num", text: fmtNum(row.price, 2) }),
        el("td", { class: pctClass(row.change_pct), text: fmtPct(row.change_pct) })
      ]));
    });
    table.appendChild(tb);
    list.appendChild(el("div", { class: "scan-table-wrap" }, [table]));

    var cards = el("div", { class: "scan-cards" });
    top.forEach(function (row, i) {
      cards.appendChild(el("article", { class: "scan-card" }, [
        el("h3", { text: (row.rank || i + 1) + ". " + (row.ticker || "") }),
        el("div", { class: "co", text: [row.company, row.sector, row.country].filter(Boolean).join(" · ") }),
        el("div", { class: "scan-grid" }, [
          metric("שווי שוק", fmtCap(row)),
          metric("מחיר", fmtNum(row.price, 2)),
          metric("שינוי", fmtPct(row.change_pct), pctClass(row.change_pct)),
          metric("חודש", fmtPct(row.perf_month_pct), pctClass(row.perf_month_pct)),
          metric("מכפיל", fmtNum(row.pe, 2)),
          metric("מכפיל קדימה", fmtNum(row.fwd_pe, 2)),
          metric("PEG", fmtNum(row.peg, 2)),
          metric("שורט מהפלואט", row.short_float_pct == null ? "—" : fmtNum(row.short_float_pct, 2) + "%"),
          metric("ימים לכיסוי", fmtNum(row.days_to_cover, 2)),
          metric("דוחות", row.earnings || "—", "")
        ])
      ]));
    });
    list.appendChild(cards);
    list.appendChild(el("p", { class: "footer-note", text: data.disclaimer || "מידע בלבד, לא ייעוץ." }));
    root.appendChild(list);
    setStatus((data.updated_at_israel ? "זמן הסריקה: " + data.updated_at_israel + ". " : "") + (data.disclaimer || "מידע בלבד, לא ייעוץ."));
  }

  setStatus("טוען את הסריקה…");
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
