// Diag: por que no se puede clicar el menu
import { chromium } from 'playwright';
const BASE = 'https://controlasistenciaapp.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(8000);
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#app:not([hidden])', { timeout: 25000 });
const mt = page.locator('#menu-toggle');
console.log('menu-toggle count=' + (await mt.count()));
try { await mt.click(); console.log('CLICK menu-toggle OK'); } catch (e) { console.log('CLICK menu-toggle FAIL: ' + e.message.split('\n').slice(0, 10).join(' | ')); }
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const el = document.querySelector('a[data-page="personal"]');
  const b = el.getBoundingClientRect();
  return { hidden: el.hidden, x: b.x, y: b.y, w: b.width, h: b.height,
    sidebarClass: document.getElementById('sidebar')?.className,
    topAtPoint: (() => { const e2 = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e2 ? e2.tagName + '.' + e2.className : null; })() };
});
console.log(JSON.stringify(info));
try { await page.locator('a[data-page="personal"]').click(); console.log('CLICK nav OK'); } catch (e) { console.log('CLICK nav FAIL: ' + e.message.split('\n').slice(0, 10).join(' | ')); }
await browser.close(); process.exit(0);