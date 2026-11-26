(function () {
  "use strict";
  if (window.PortalNav && window.PortalNav.mount) window.PortalNav.mount("news");

  var root = document.getElementById("news-root");
  var statusEl = document.getElementById("news-status");
  var filtersEl = document.getElementById("news-filters");
  var FILTERS = [
    { id: "all", label: "הכל" },
    { id: "digest", label: "מבזקי דסק" },
    { id: "funds", label: "תשואות קרנות" },
    { id: "rss", label: "כתבות מהעיתונות" }
  ];
  var current = "all";
  var feed = null;
  var pageSize = 12;

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "onclick") node.addEventListener("click", v);
      else node.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function setStatus(text) { if (statusEl) statusEl.textContent = text || ""; }

  function formatTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    try {
      return new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        weekday: "short", day: "numeric", month: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }).format(d);
    } catch (e) {
      return d.toLocaleString("he-IL");
    }
  }

  function kindLabel(kind) {
    if (kind === "digest") return "מבזק דסק";
    if (kind === "funds") return "תשואות קרנות";
    if (kind === "rss") return "עיתונות";
    return "עדכון";
  }

  function pctClass(text) {
    if (!text) return "num";
    if (String(text).indexOf("−") >= 0 || String(text).indexOf("-") === 0) return "num neg";
    if (String(text).indexOf("+") >= 0) return "num pos";
    return "num";
  }

  function fmtPct(n) {
    if (n === null || n === undefined || isNaN(Number(n))) return "";
    var v = Number(n);
    var s = Math.abs(v).toFixed(2) + "%";
    if (v > 0) return "+" + s;
    if (v < 0) return "−" + s;
    return s;
  }

  function renderFilters() {
    if (!filtersEl) return;
    filtersEl.textContent = "";
    FILTERS.forEach(function (f) {
      filtersEl.appendChild(el("button", {
        type: "button",
        class: "pill" + (current === f.id ? " on" : ""),
        role: "tab",
        "aria-selected": current === f.id ? "true" : "false",
        onclick: function () { current = f.id; pageSize = 12; render(); }
      }, [document.createTextNode(f.label)]));
    });
  }

  function detailsFor(item) {
    var box = el("div", { class: "news-details" });
    if (item.indices && item.indices.length) {
      var grid = el("div", { class: "news-indices", role: "group", "aria-label": "מדדים" });
      item.indices.forEach(function (ix) {
        if (!ix || !ix.name) return;
        grid.appendChild(el("div", { class: "news-index" }, [
          el("span", { class: "k", text: (ix.group ? ix.group + " · " : "") + ix.name }),
          el("span", { class: "v num", text: ix.display || ix.value || "—" }),
          el("span", { class: pctClass(ix.change_text), text: ix.change_text || "" })
        ]));
      });
      box.appendChild(grid);
    }
    (item.stories || []).forEach(function (st) {
      box.appendChild(el("article", { class: "news-story" }, [
        st.title ? el("h3", { text: st.title }) : null,
        st.text ? el("p", { text: st.text }) : null
      ]));
    });
    if (item.body && item.kind === "funds" && !(item.sections && item.sections.length)) {
      box.appendChild(el("div", { class: "news-body", text: item.body }));
    }
    (item.sections || []).forEach(function (sec) {
      var wrap = el("div", { class: "news-section" });
      wrap.appendChild(el("h3", { class: "card-title", text: sec.title || "" }));
      (sec.paragraphs || []).forEach(function (p) { wrap.appendChild(el("p", { class: "news-summary", text: p })); });
      (sec.tracks || []).forEach(function (tr) {
        if (!tr.leaders || !tr.leaders.length) return;
        var table = el("table", { class: "news-table" });
        table.appendChild(el("caption", { text: "מובילים במסלול " + tr.track + " (" + (tr.n || 0) + " קרנות, ממוצע " + fmtPct(tr.avg) + ")" }));
        var thead = el("thead", {}, [el("tr", {}, [
          el("th", { scope: "col", text: "קרן" }),
          el("th", { scope: "col", text: "חודש" }),
          el("th", { scope: "col", text: "12 חודשים" })
        ])]);
        var tb = el("tbody");
        tr.leaders.forEach(function (r) {
          tb.appendChild(el("tr", {}, [
            el("td", { text: r.name + (r.mgr ? " · " + r.mgr : "") }),
            el("td", { class: pctClass(fmtPct(r.month)), text: fmtPct(r.month) }),
            el("td", { class: pctClass(fmtPct(r.t12)), text: r.t12 == null ? "—" : fmtPct(r.t12) })
          ]));
        });
        table.appendChild(thead);
        table.appendChild(tb);
        wrap.appendChild(el("div", { class: "news-table-wrap" }, [table]));
      });
      box.appendChild(wrap);
    });
    return box;
  }

  function card(item) {
    var article = el("article", { class: "card news-card" + (item.lang === "en" ? " news-en" : "") });
    var meta = el("div", { class: "news-meta" }, [
      el("span", { class: "badge", text: kindLabel(item.kind) }),
      item.edition ? el("span", { class: "badge green", text: item.edition }) : null,
      el("time", { class: "stamp", datetime: item.time || "", text: formatTime(item.time) }),
      item.source ? el("span", { class: "stamp", text: item.source }) : null,
      item.lang === "en" ? el("span", { class: "badge amber", text: "באנגלית" }) : null
    ]);
    article.appendChild(meta);
    article.appendChild(el("h2", { text: item.title || "" }));
    if (item.summary) article.appendChild(el("p", { class: "news-summary", text: item.summary }));
    var hasDetails = (item.stories && item.stories.length) || (item.indices && item.indices.length) || item.body || (item.sections && item.sections.length);
    if (hasDetails) {
      var panel = detailsFor(item);
      panel.hidden = true;
      var btn = el("button", { type: "button", class: "news-toggle", "aria-expanded": "false", onclick: function () {
        var open = panel.hidden;
        panel.hidden = !open;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "הסתר פירוט" : "הצג פירוט";
      }, text: "הצג פירוט" });
      article.appendChild(btn);
      article.appendChild(panel);
    }
    if (item.links && item.links.length) {
      var links = el("div", { class: "news-links" });
      item.links.forEach(function (lk) {
        if (!lk || !lk.url) return;
        links.appendChild(el("a", { href: lk.url, target: "_blank", rel: "noopener noreferrer", text: lk.title || lk.url }));
      });
      article.appendChild(links);
    }
    return article;
  }

  function render() {
    renderFilters();
    root.textContent = "";
    if (!feed || !feed.items || !feed.items.length) {
      root.appendChild(el("p", { class: "empty", text: "עדיין אין ידיעות להצגה." }));
      return;
    }
    var items = feed.items.filter(function (it) { return current === "all" || it.kind === current; });
    items.sort(function (a, b) {
      var pa = a.kind === "funds" ? 0 : 1, pb = b.kind === "funds" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.time || "").localeCompare(a.time || "");
    });
    if (!items.length) {
      root.appendChild(el("p", { class: "empty", text: "אין ידיעות במסנן הזה כרגע." }));
      return;
    }
    var visible = items.slice(0, pageSize);
    visible.forEach(function (it) { root.appendChild(card(it)); });
    if (items.length > pageSize) {
      var more = el("button", { type: "button", class: "btn", onclick: function () { pageSize += 12; render(); }, text: "הצג עוד ידיעות (" + (items.length - pageSize) + ")" });
      root.appendChild(el("p", { style: "margin:8px 0 16px" }, [more]));
    }
    var stamp = feed.updated ? "עודכן לאחרונה " + formatTime(feed.updated) + " שעון ישראל. " : "";
    setStatus(stamp + (feed.disclaimer || "מידע בלבד, לא ייעוץ") + ". מוצגות " + visible.length + " מתוך " + items.length + " ידיעות.");
  }

  function load() {
    setStatus("טוען ידיעות…");
    fetch("data/news.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.json();
      })
      .then(function (data) {
        feed = data;
        render();
      })
      .catch(function () {
        setStatus("לא הצלחתי לטעון את הידיעות. אפשר לרענן את העמוד.");
        root.textContent = "";
        root.appendChild(el("p", { class: "empty", text: "טעינת החדשות נכשלה." }));
      });
  }

  load();
})();
