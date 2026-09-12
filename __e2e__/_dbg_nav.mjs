// Debug paso a paso del test 03 (navegacion SPA)
import { chromium } from 'playwright';

const server = (await import('node:child_process')).spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3800', '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));

const log = (m) => console.log('[dbg]', new Date().toISOString().slice(11, 19), m);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
page.on('pageerror', e => log('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') log('CONSOLE: ' + m.text()); });
page.on('dialog', d => { log('DIALOG: ' + d.type() + ' - ' + d.message()); d.dismiss(); });
page.on('download', d => log('DOWNLOAD: ' + d.url()));

try {
  log('goto /');
  await page.goto('http://127.0.0.1:3800/', { waitUntil: 'domcontentloaded' });
  log('esperando #app visible');
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  log('#app visible OK');
  const burger = page.locator('#menu-toggle');
  log('burger count=' + (await burger.count()));
  const binfo = await burger.first().evaluate(el => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, display: cs.display, visibility: cs.visibility, pe: cs.pointerEvents };
  });
  log('binfo=' + JSON.stringify(binfo));
  log('click burger');
  await burger.first().click({ timeout: 8000 });
  log('click burger OK');
  await page.waitForTimeout(600);
  log('sidebar-open=' + (await page.evaluate(() => document.body.classList.contains('sidebar-open'))));
  log('shot 03');
  await page.screenshot({ path: '__e2e__/output/screenshots/03-dbg.png', timeout: 8000 }).catch(e => log('SHOT FAIL: ' + e.message.split('\n')[0]));
  log('shot OK');
  const pages = ['personal', 'asistencia', 'campo', 'reportes', 'ajustes'];
  for (const p of pages) {
    const link = page.locator('[data-page="' + p + '"]').first();
    const n = await link.count();
    log('link ' + p + ' count=' + n);
    if (n > 0) {
      const linfo = await link.evaluate(el => {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.max(r.x, 0) + r.width / 2, Math.max(r.y, 0) + r.height / 2);
        return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, pe: cs.pointerEvents, vis: cs.visibility, hit: hit ? hit.tagName + '#' + (hit.id || '') + '.' + (hit.className && hit.className.baseVal !== undefined ? hit.className.baseVal : hit.className) : 'null', parentPE: getComputedStyle(el.parentElement).pointerEvents };
      });
      log('linfo ' + p + '=' + JSON.stringify(linfo));
      log('click ' + p); await link.click({ timeout: 8000, force: true }); log('click ' + p + ' OK');
    }
    await page.waitForTimeout(800);
    log('shot nav-' + p);
    await page.screenshot({ path: '__e2e__/output/screenshots/nav-' + p + '.png', timeout: 8000 })
      .catch(e => log('SHOT FAIL ' + p + ': ' + e.message.split('\n')[0]));
    log('shot OK ' + p);
  }
  log('TODO OK');
} catch (e) {
  log('ERROR: ' + e.message.split('\n')[0]);
} finally {
  await browser.close().catch(() => {});
  server.kill();
  process.exit(0);
}