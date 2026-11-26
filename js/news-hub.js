/* News hub page: headlines from many public sources, hot news on top, filters and search. */
(function () {
  var T = window.T16, el = T.el;
  T.mountNav('news');
  var state = { cat: 'all', q: '', src: '', lang: 'all', shown: 40, items: [], hub: null };
  var root = document.getElementById('t16-news');
  var listBox = document.getElementById('t16-list'), statusBox = document.getElementById('t16-status');

  function catName(c) { var f = T.CATS.filter(function (x) { return x[0] === c; })[0]; return f ? f[1] : ''; }

  function itemNode(it, hot) {
    var url = T.safeUrl(it.url);
    var meta = el('div', { class: 't16-meta' }, [
      hot ? el('span', { class: 't16-badge hot', text: 'חם' }) : null,
      el('span', { class: 't16-src', text: it.source }),
      el('time', { datetime: it.time, text: T.ago(it.time) }),
      (it.cats || []).slice(0, 2).map(function (c) { return el('span', { class: 't16-tag', text: catName(c) }); })[0] || null
    ]);
    var kids = [meta, url ? el('a', { class: 't', href: url, target: '_blank', rel: 'noopener', text: it.title }) : el('span', { class: 't', text: it.title })];
    if (it.snippet) kids.push(el('p', { class: 'sn', text: it.snippet }));
    if (it.also && it.also.length) kids.push(el('p', { class: 'small muted', text: 'גם ב־' + it.also.slice(0, 4).join(', ') }));
    return el('li', { class: 't16-item', lang: it.lang === 'en' ? 'en' : 'he' }, kids);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return state.items.filter(function (it) {
      if (state.cat !== 'all' && (it.cats || []).indexOf(state.cat) < 0) return false;
      if (state.src && it.source !== state.src) return false;
      if (state.lang !== 'all' && (it.lang === 'en' ? 'en' : 'he') !== state.lang) return false;
      if (q && (it.title + ' ' + (it.snippet || '') + ' ' + it.source).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderList() {
    var rows = filtered();
    listBox.textContent = '';
    if (!rows.length) {
      listBox.appendChild(el('li', { class: 'empty', text: 'לא נמצאו כתבות שמתאימות לסינון. אפשר לנקות את החיפוש או לבחור "הכל".' }));
    } else rows.slice(0, state.shown).forEach(function (it) { listBox.appendChild(itemNode(it)); });
    statusBox.textContent = rows.length ? 'מוצגות ' + Math.min(rows.length, state.shown) + ' מתוך ' + rows.length + ' כתבות' : '';
    var more = document.getElementById('t16-more');
    more.hidden = rows.length <= state.shown;
  }

  function chips() {
    var box = document.getElementById('t16-cats');
    T.CATS.forEach(function (c) {
      var b = el('button', { type: 'button', class: 't16-chip', 'aria-pressed': String(c[0] === state.cat), text: c[1], onclick: function () {
        state.cat = c[0]; state.shown = 40;
        [].forEach.call(box.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderList();
      } });
      box.appendChild(b);
    });
  }

  function sources(hub) {
    var sel = document.getElementById('t16-src');
    (hub.sources || []).forEach(function (s) { sel.appendChild(el('option', { value: s, text: s })); });
    sel.addEventListener('change', function () { state.src = sel.value; state.shown = 40; renderList(); });
    var lang = document.getElementById('t16-lang');
    lang.addEventListener('change', function () { state.lang = lang.value; state.shown = 40; renderList(); });
    document.getElementById('t16-sources').textContent = 'המקורות: ' + (hub.sources || []).join(' · ');
    document.getElementById('t16-updated').textContent = (hub.sources || []).length + ' מקורות · עודכן ' + T.ago(hub.updated);
  }

  function breaking(br) {
    var box = document.getElementById('t16-breaking');
    var cutoff = Date.now() - 12 * 3600e3;
    var items = (br && br.items || []).filter(function (b) { return Date.parse(b.time) > cutoff; }).slice(0, 5);
    if (!items.length) { box.hidden = true; return; }
    box.hidden = false;
    var ul = box.querySelector('ul'); ul.textContent = '';
    items.forEach(function (it) { ul.appendChild(itemNode(it, true)); });
  }

  function latestBrief(b) {
    var box = document.getElementById('t16-brief');
    if (!b || !b.title) { box.hidden = true; return; }
    box.querySelector('.ed').textContent = b.edition;
    box.querySelector('time').textContent = b.day ? 'יום ' + b.day + ', ' + T.clock(b.time, true) : T.clock(b.time, true);
    box.querySelector('h2').textContent = b.title;
    box.querySelector('.sum').textContent = b.summary || '';
    box.querySelector('a.btn').href = 'briefs.html?id=' + encodeURIComponent(b.id);
    box.hidden = false;
  }

  document.getElementById('t16-q').addEventListener('input', function (e) { state.q = e.target.value; state.shown = 40; renderList(); });
  document.getElementById('t16-more').addEventListener('click', function () { state.shown += 40; renderList(); });
  chips();

  Promise.all([
    T.getJSON('data/news-hub.json').catch(function () { return null; }),
    T.getJSON('data/breaking.json').catch(function () { return null; }),
    T.getJSON('data/briefs/latest.json').catch(function () { return null; })
  ]).then(function (r) {
    var hub = r[0];
    latestBrief(r[2]);
    breaking(r[1]);
    if (!hub) { statusBox.textContent = 'לא הצלחנו לטעון את החדשות כרגע. נסה לרענן בעוד דקה.'; return; }
    state.items = hub.items || [];
    sources(hub);
    renderList();
  });
  root.setAttribute('aria-busy', 'false');
})();
