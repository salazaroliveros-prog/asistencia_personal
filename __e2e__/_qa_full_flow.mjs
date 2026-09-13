// QA E2E — Escáner de Campo (field-scanner.html) en production
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log('[' + new Date().toISOString().slice(11, 19) + ']', m);
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: false, timeout: 12000 }).catch(() => {});

const APP = 'https://controlasistenciaapp.vercel.app';
const PIN = '1234';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const cons = [];
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { const t = m.text(); cons.push('[' + m.type() + '] ' + t); });
page.on('dialog', async d => { log('DIALOG: ' + d.message()); await d.dismiss(); });

const res = { pasos: [], login: false, qr: false, banner: false, x: false, errors: [] };

try {
  log('=== E2E ESCANER DE CAMPO ===');
  log('1) Abro field-scanner.html');
  await page.goto(APP + '/field-scanner.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot(page, '01-scanner-cargado');
  const loginForm = await page.$('#login-form');
  res.pasos.push('login-form=' + (loginForm ? 'ok' : 'no'));
  log('Formulario login presente:', !!loginForm);
  const pinInput = await page.$('#login-pin');
  if (!pinInput) res.errors.push('No se encontró #login-pin');

  log('2) PIN incorrecto (9999)');
  await pinInput.fill('9999');
  await page.click('#login-form button[type=submit]');
  await page.waitForTimeout(1000);
  const errVisible = await page.$('#login-error:not([hidden])');
  res.pasos.push('pin-incorrecto-rechazado=' + !!errVisible);
  log('Login rechaza PIN incorrecto:', !!errVisible);

  log('3) PIN correcto');
  await pinInput.fill(PIN);
  await page.click('#login-form button[type=submit]');
  await page.waitForTimeout(1500);
  const scannerVisible = await page.$('#campo-scanner:not([hidden])');
  res.login = !!scannerVisible;
  res.pasos.push('login-correcto-entra=' + res.login);
  log('PIN correcto -> scanner visible:', res.login);

  if (res.login) {
    await shot(page, '02-escaner-login-ok');
    log('4) Boton Iniciar esca.nner');
    const btnScan = await page.$('#campo-btn-scan');
    log('boton scan:', !!btnScan);
    if (btnScan) { try { await btnScan.click(); await page.waitForTimeout(1500); } catch(e) {} }
    const qrEl = await page.$('#campo-qr-reader');
    res.qr = !!qrEl;
    res.pasos.push('qr-reader-presente=' + (qrEl ? 'ok' : 'no'));
    log('Contenedor QR (campo-qr-reader):', res.qr);
    await shot(page, '03-qr-reader');
  }

  log('5) Banner instalacion PWA (beforeinstallprompt)');
  await page.evaluate(() => { if (window.deferredPrompt) window.deferredPrompt.dispatchEvent(new Event('beforeinstallprompt')); });
  await page.waitForTimeout(800);
  const banner = await page.$('[id*=install], .install-banner');
  res.banner = !!banner;
  res.pasos.push('banner=' + (banner ? 'visible' : 'oculto'));
  log('Banner instalacion:', res.banner);
} catch (e) {
  res.errors.push(String(e.message || e).split(String.fromCharCode(10))[0]);
  log('FATAL: ' + res.errors[res.errors.length - 1]);
} finally {
  try { await shot(page, 'final'); } catch {}
  res.consoleErrors = cons.filter(l => l.startsWith('[error'));
  res.pageErrors = errs;
  fs.writeFileSync(path.join(OUT, 'qa-scanner-result.json'), JSON.stringify(res, null, 2));
  await browser.close();
}

console.log('=== RESUMEN ESCANER DE CAMPO ===');
console.log('Login correcto entra al escaner: ' + res.login);
console.log('Escaner QR (campo-qr-reader): ' + res.qr);
console.log('Banner instalacion PWA: ' + res.banner);
console.log('Pasos: ' + res.pasos.join(' -> '));
console.log('Console errors: ' + res.consoleErrors.length);
console.log('Page errors: ' + res.pageErrors.length);
console.log('Errores: ' + (res.errors.length ? res.errors.join(' | ') : 'Ninguno'));
process.exit(0);
