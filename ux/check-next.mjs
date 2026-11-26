// Live/local check for /next/ (based on check-v2.mjs; does not modify it).
// usage: node ux/check-next.mjs <BASE e.g. https://aviad12377-ai.github.io/next/> <TAG>
import { chromium } from '/workspace/options-calc/node_modules/playwright/index.mjs';
const BASE = process.argv[2] || 'http://localhost:8941/next/';
const TAG = process.argv[3] || 'local';
const OUT = '/workspace/options-calc/ux/shots/';
const routes = [['home','#/'],['savings','#/savings'],['invest','#/invest'],['options','#/invest/options'],['compare','#/compare'],['funds','#/compare/funds?type=hishtalmut'],['fund',null],['fund404','#/fund/gemelnet/999999999'],['news','#/news'],['me','#/me']];
const MEASURE = () => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]') && !el.closest('.sr') && !el.closest('.skip'); };
  const overflow = document.documentElement.scrollWidth > innerWidth + 1;
  const small = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node; while ((node = tw.nextNode())) { if (!node.textContent.trim()) continue; const el = node.parentElement; if (!vis(el)) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 13) small.push(fs + ' ' + node.textContent.trim().slice(0, 30)); }
  const taps = [...document.querySelectorAll('a,button,input:not([type=range]),select,label.row')].filter(vis).filter(el => !(el.tagName==='INPUT' && el.closest('label.row'))).filter(el => !el.closest('#portal')).map(el => { const r = el.getBoundingClientRect(); return { t: (el.getAttribute('aria-label') || el.textContent || el.id).trim().slice(0, 25), w: Math.round(r.width), h: Math.round(r.height), inline: getComputedStyle(el).display === 'inline' }; }).filter(x => (x.h < 44 || x.w < 44) && !x.inline);
  const tab = document.querySelector('#tabbar, .tabbar'); const tr = tab && vis(tab) ? tab.getBoundingClientRect() : null;
  scrollTo(0, document.documentElement.scrollHeight);
  const items = [...document.querySelectorAll('#main > *, main > *, .col > *')].filter(vis); const last = items.length ? Math.max(...items.map(e => e.getBoundingClientRect().bottom)) : 0;
  const gap = tr && tr.top > 0 && tr.top < innerHeight ? Math.round(tr.top - last) : null;
  scrollTo(0, 0);
  return { overflow, small: small.slice(0, 5), taps: taps.slice(0, 8), cls: +window.__cls.toFixed(4), gap };
};
const browser = await chromium.launch();
const report = {};
for (const [vw, vh, dev] of [[375, 812, 'm'], [1280, 860, 'd']]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: dev === 'm', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
  await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await page.goto(BASE + '#/', { waitUntil: 'load' });
  for (let [name, hash] of routes) {
    if (name === 'fund') { await page.goto(BASE + '#/compare/funds?type=hishtalmut'); await page.waitForSelector('a.fundlink', { timeout: 15000 }); await page.click('a.fundlink'); }
    else await page.goto(BASE + hash);
    await page.waitForTimeout(['funds', 'fund', 'fund404'].includes(name) ? 2500 : 1400);
    const m = await page.evaluate(MEASURE);
    if (name === 'fund' || name === 'fund404') m.text = await page.evaluate(() => { const t = document.getElementById('main').innerText; return { nan: /NaN|undefined/.test(t), src: /מידע בלבד, לא ייעוץ/.test(t), empty: !!document.querySelector('.empty'), chart: !!document.querySelector('.chart svg, svg.chart, .chart canvas'), hash: location.hash }; });
    if (name === 'fund') { const box = await page.$('.chart svg, .chart'); if (box) { const b = await box.boundingBox(); await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2); await page.waitForTimeout(150); m.scrub = await page.evaluate(() => (document.body.innerText.match(/מצטבר עד סוף [^\n]+/) || [''])[0]); await page.mouse.up(); } }
    if (name === 'savings') m.fee = await page.evaluate(() => (document.body.innerText.match(/דמי ניהול מהצבירה[^\n]*/) || [''])[0]);
    await page.screenshot({ path: `${OUT}next-${TAG}-${dev}-${name}.png` });
    report[`${dev}:${name}`] = m;
  }
  // standing-order editor (demo)
  await page.goto(BASE + '#/invest'); await page.waitForTimeout(1200);
  const so = {};
  if (await page.$('#so-edit')) {
    await page.click('#so-edit'); await page.waitForTimeout(500);
    so.sheet = await page.evaluate(() => { const t = document.body.innerText; return { assumption: /הנחה בלבד, לא תחזית ולא ייעוץ/.test(t), device: /נשמר במכשיר בלבד/.test(t) }; });
    so.taps = await page.evaluate(() => [...document.querySelectorAll('#sheet button, #sheet input:not([type=range]), #sheet a')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 12) || e.id, Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 44 || x[2] < 44));
    await page.screenshot({ path: `${OUT}next-${TAG}-${dev}-so-sheet.png` });
    await page.click('.stepper [data-k="1"]'); await page.click('#so-day [data-v="15"]');
    await page.click('#so-save'); await page.waitForTimeout(700);
    so.toast = await page.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
    so.after = await page.evaluate(() => { const t = document.querySelector('#inv').innerText; return (t.match(/₪[\d,]+ בחודש[^\n]*\n?[^\n]*/) || [''])[0]; });
  } else so.missing = true;
  report[`${dev}:standing`] = so;
  report[`${dev}:errors`] = errs;
  await ctx.close();
}
// real-data path (signed-in simulated with fake test values in memory only; nothing persisted to the repo)
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'he-IL', serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror ' + e.message));
  await page.goto(BASE + '#/', { waitUntil: 'load' }); await page.waitForTimeout(800);
  const sim = async (funds) => page.evaluate((funds) => { window.PortalCloud = window.PortalCloud || {}; PortalCloud.user = { id: 'test' }; const d = Portal.data; d.pension.funds = funds.p; d.hishtalmut.funds = funds.h; d.savings.cash = []; location.hash = '#/invest'; location.hash = '#/savings'; }, funds);
  await sim({ p: [{ name: 'בדיקה פנסיה', kind: 'k_pension', balance: 100000, feeBal: 0.2, feeDep: 1.5 }], h: [{ name: 'בדיקה השתלמות', balance: 50000, feeBal: 0.5 }] });
  await page.waitForTimeout(800);
  const withFees = await page.evaluate(() => (document.body.innerText.match(/דמי ניהול מהצבירה[^\n]*/) || [''])[0]);
  await sim({ p: [{ name: 'בדיקה בלי דמי ניהול', kind: 'k_pension', balance: 100000 }], h: [] });
  await page.waitForTimeout(800);
  const noFees = await page.evaluate(() => (document.body.innerText.match(/דמי ניהול מהצבירה[^\n]*/) || [''])[0]);
  const demoBadge = await page.evaluate(() => /נתוני דוגמה/.test(document.getElementById('main').innerText));
  await page.goto(BASE + '#/invest'); 
  report.real = { withFees, expected: '100000*0.2% + 50000*0.5% = ₪450 בשנה', noFees: noFees || '(none, as required)', demoBadge, soEditVisible: !!(await page.$('#so-edit')), errs };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
