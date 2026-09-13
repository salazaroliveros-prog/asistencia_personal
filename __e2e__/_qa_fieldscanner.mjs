// QA en vivo: field-scanner (login PIN, escaner), instalacion PWA
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 3801;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] });
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));

try {
  // ── 1. Login PIN incorrecto ──
  await page.goto(BASE + '/field-scanner.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-section', { state: 'visible' });
  await page.fill('#login-pin', '9999');
  await page.press('#login-pin', 'Enter');
  await page.waitForTimeout(500);
  const errVisible = await page.evaluate(() => { const e = document.getElementById('login-error'); return e && !e.hidden; });
  ok('PIN incorrecto rechazado', errVisible);
  const stillLogin = await page.evaluate(() => !document.getElementById('login-section').hidden);
  ok('Sigue en login tras PIN incorrecto', stillLogin);

  // ── 2. Login PIN correcto (1234) ──
  await page.fill('#login-pin', '1234');
  await page.press('#login-pin', 'Enter');
  await page.waitForTimeout(1500);
  const scannerVisible = await page.evaluate(() => {
    const s = document.getElementById('campo-scanner');
    const l = document.getElementById('login-section');
    return s && !s.hidden && l && l.hidden;
  });
  ok('PIN correcto (1234) accede al escaner', scannerVisible);
  const sessionSaved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('field_scanner_session') || 'null')?.operator != null; } catch { return false; } });
  ok('Sesion persistida (TTL 1h)', sessionSaved);

  // ── 3. Escaner QR: libreria cargada + contenedor activo ──
  const qrLib = await page.evaluate(() => typeof window.Html5Qrcode === 'function');
  ok('html5-qrcode cargado', qrLib);
  await page.waitForTimeout(2500);
  const qrRunning = await page.evaluate(() => {
    const el = document.getElementById('qr-reader');
    return !!el && el.querySelector('video') !== null;
  });
  ok('Camara/lector iniciado (video activo)', qrRunning, qrRunning ? '' : '(esperable fallar en headless sin camara fisica)');

  // ── 4. Botones de marcacion renderizados ──
  const markBtns = await page.locator('#campo-mark-grid button').count();
  ok('Botones de marcacion (4 tipos)', markBtns === 4, 'count=' + markBtns);

  // ── 5. Logout ──
  await page.click('#logout-btn');
  await page.waitForTimeout(500);
  const backToLogin = await page.evaluate(() => !document.getElementById('login-section').hidden);
  ok('Logout vuelve a login', backToLogin);

  // ── 6. PWA instalable (manifest + SW) en field-scanner ──
  const resp = await ctx.request.get(BASE + '/field-scanner-manifest.json');
  ok('Manifest del escaner accesible', resp.status() === 200);
  const manifest = await resp.json().catch(() => null);
  ok('Manifest con nombre e iconos', !!manifest && manifest.name && Array.isArray(manifest.icons) && manifest.icons.length > 0);
  const swResp = await ctx.request.get(BASE + '/field-scanner-sw.js');
  ok('Service Worker del escaner accesible', swResp.status() === 200);

  // ── 7. Errores JS ──
  ok('0 errores JS en la pagina del escaner', errors.length === 0, errors.slice(0, 3).join(' | '));

} catch (e) {
  ok('Excepcion general', false, e.message.split('\n')[0]);
} finally {
  const fs = await import('node:fs');
  fs.writeFileSync('__e2e__/output/qa-fieldscanner-result.json', JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  await browser.close().catch(() => {});
  server.kill();
  const fails = results.filter(r => !r.pass).length;
  console.log('==== RESUMEN: ' + (results.length - fails) + '/' + results.length + ' PASS, ' + fails + ' FAIL ====');
  process.exit(0);
}