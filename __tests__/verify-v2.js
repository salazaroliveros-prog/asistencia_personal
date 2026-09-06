/**
 * Screenshots de verificación v2 — iniciales coloreadas, alertas con nombres, modal día
 */
const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '__tests__/screenshots/demo';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  page.on('pageerror', e => console.warn('[JS ERR]', e.message));

  await page.goto('http://localhost:3800', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.hidden;
  }, { timeout: 10000 });
  await page.waitForTimeout(2500);

  // ── 1. Personal tabla — iniciales coloreadas ──────────────────────────────
  await page.evaluate(() => window.location.hash = '#personal');
  await page.waitForFunction(() => {
    const el = document.getElementById('page-personal');
    return el && el.classList.contains('active');
  }, { timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${DIR}/v2-personal-iniciales.png`,
    clip: { x: 0, y: 0, width: 1280, height: 600 },
  });
  console.log('✓ v2-personal-iniciales.png — tabla de personal con iniciales coloreadas');

  // ── 2. Dashboard alertas — nombres de trabajadores ────────────────────────
  await page.evaluate(() => window.location.hash = '#dashboard');
  await page.waitForFunction(() => {
    const el = document.getElementById('page-dashboard');
    return el && el.classList.contains('active');
  }, { timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${DIR}/v2-alertas-nombres.png`,
    clip: { x: 0, y: 0, width: 1280, height: 500 },
  });
  console.log('✓ v2-alertas-nombres.png — alertas con nombres de trabajadores');

  // ── 3. Modal detalle día — iniciales coloreadas presentes/ausentes ─────────
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const hoy = await page.evaluate(() => AppState.today());
  console.log(`   Fecha hoy: ${hoy}`);
  await page.click(`[data-fecha="${hoy}"]`);
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: `${DIR}/v2-modal-dia-iniciales.png`,
    clip: { x: 0, y: 0, width: 1280, height: 700 },
  });
  console.log('✓ v2-modal-dia-iniciales.png — modal detalle día con iniciales coloreadas');

  // ── Verificación DOM: ningún user-circle-2 en tabla de personal ───────────
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.location.hash = '#personal');
  await page.waitForFunction(() => {
    const el = document.getElementById('page-personal');
    return el && el.classList.contains('active');
  }, { timeout: 5000 });
  await page.waitForTimeout(800);

  const iconosGenericos = await page.evaluate(() => {
    return document.querySelectorAll('#personal-tbody [data-lucide="user-circle-2"]').length;
  });
  console.log(`\n📊 Iconos genéricos user-circle-2 en tabla: ${iconosGenericos} (debe ser 0)`);

  const iniciales = await page.evaluate(() => {
    return document.querySelectorAll('#personal-tbody .worker-photo-placeholder').length;
  });
  console.log(`   Placeholders con iniciales: ${iniciales}`);

  const alertDetail = await page.evaluate(() => {
    return window.location.hash = '#dashboard';
  });
  await page.waitForTimeout(1000);
  const alertTexts = await page.evaluate(() => {
    return [...document.querySelectorAll('.alert-detail')].map(el => el.textContent.trim());
  });
  console.log('\n📋 Textos de alert-detail (deben mostrar nombres, no IDs):');
  alertTexts.forEach(t => console.log(`   ${t}`));

  await browser.close();
  console.log('\n✅ Verificación v2 completada');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
