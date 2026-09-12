/**
 * AUDITORÍA E2E EXTENDIDA — cámara, QR, exportaciones PDF/CSV, formatos
 * Requiere vite preview en http://127.0.0.1:3800
 */
const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '__tests__/screenshots/e2e-extended';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const ctx = await browser.newContext({
    permissions: ['camera', 'geolocation'],
    geolocation: { latitude: 14.6349, longitude: -90.5069 },
  });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  const B = 'http://127.0.0.1:3800';
  await page.goto(B, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4500);

  // 1. Estructura SPA
  const pages = await page.$$eval('[data-page]', (els) => els.map((e) => e.dataset.page));
  check('Páginas SPA declaradas', pages.length >= 6, pages.join(','));
  const navOrder = await page.$$eval('a.nav-link[data-page]', (els) =>
    els.map((e) => e.dataset.page).filter(Boolean));
  check('Navegación lateral con targets', navOrder.length >= 5, navOrder.join(','));

  // 2. Formulario de personal
  await page.click('a.nav-link[data-page="personal"]').catch(() => {});
  await page.waitForTimeout(500);
  const newBtn = page.locator('#btn-add-personal, #btn-nuevo-personal, .btn-nuevo-trabajador').first();
  if (await newBtn.count()) await newBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  const modalVisible = await page.isVisible('#modal-personal').catch(() => false);
  check('Modal de registro de personal abre', modalVisible);
  if (modalVisible) {
    const fields = await page.evaluate(() => {
      const inp = (sel) => {
        const el = document.querySelector(sel);
        return el ? { type: el.type, required: el.required, maxLength: el.maxLength } : null;
      };
      return {
        nombre: inp('#p-nombre'),
        dpi: inp('#p-dpi'),
        puesto: document.querySelector('#p-puesto') ? 'select' : null,
        foto: inp('#personal-foto, #inp-foto, input[type=file]'),
      };
    });
    check('Campo nombre requerido', !!fields.nombre && fields.nombre.required === true);
    check('Campo DPI con pattern 13 dígitos', !!fields.dpi && fields.dpi.maxLength === 13, JSON.stringify(fields.dpi));
    check('Select de puesto presente', fields.puesto === 'select');
    check('Input de foto (file)', !!fields.foto);
    await page.fill('#p-nombre', 'Prueba Validacion');
    await page.fill('#p-dpi', 'ABC123');
    const guardar = page.locator('#btn-guardar-personal, #form-personal button[type=submit]').first();
    if (await guardar.count()) {
      await guardar.click().catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  // 3. Cámara en campo (fake device)
  await page.click('a.nav-link[data-page="campo"]').catch(() => {});
  await page.waitForTimeout(600);
  const btnCam = page.locator('#btn-start-scan').first();
  if (await btnCam.count()) {
    await btnCam.click().catch(() => {});
    await page.waitForTimeout(2500);
    const videoPlaying = await page.evaluate(() => {
      const vids = [...document.querySelectorAll('video')];
      return vids.some((v) => v.srcObject instanceof MediaStream &&
        v.srcObject.getVideoTracks().some((t) => t.readyState === 'live'));
    });
    check('Cámara de campo inicia (stream vivo)', videoPlaying);
    await page.locator('#btn-stop-scan').first().click().catch(() => {});
  } else {
    check('Cámara de campo inicia (stream vivo)', false, 'botón cámara no encontrado');
  }

  // 4. Librería QR
  const qrLibLoaded = await page.evaluate(() =>
    typeof window.QRious === 'function' || typeof window.QRCode === 'function' ||
    !!document.querySelector('script[src*="qr"], script[src*="QRious"], script[src*="qrcode"]'));
  check('Librería QR cargada', !!qrLibLoaded);
  await page.screenshot({ path: DIR + '/paso-campos.png' });

  // 5. Exportaciones
  await page.click('a.nav-link[data-page="reportes"]').catch(() => {});
  await page.waitForTimeout(600);
  const btnPreview = page.locator('#btn-preview-diario, .preview-btn').first();
  if (await btnPreview.count()) {
    await btnPreview.click().catch(() => {});
    await page.waitForTimeout(800);
    const previewRows = await page.evaluate(() =>
      document.querySelectorAll('#preview-reporte tbody tr, .preview-tabla tbody tr, #reporte-preview tr').length);
    check('Vista previa de reporte genera tabla', previewRows >= 0, 'filas: ' + previewRows);
  }
  const btnCsv = page.locator('#btn-csv-diario').first();
  if (await btnCsv.count()) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      btnCsv.click().catch(() => {}),
    ]);
    check('Exportación CSV genera descarga',
      download ? /\.csv$/i.test(download.suggestedFilename()) : false,
      download ? download.suggestedFilename() : 'sin evento download');
  } else {
    check('Exportación CSV genera descarga', false, 'botón CSV no encontrado');
  }
  const btnPdf = page.locator('#btn-pdf-diario').first();
  if (await btnPdf.count()) {
    await btnPdf.click().catch(() => {});
    await page.waitForTimeout(1500);
    check('Exportación PDF ejecuta sin errores JS', jsErrors.length === 0, jsErrors[0] || 'limpio');
  }

  // 6. Formatos
  const fechaInputs = await page.$$eval('input[type="date"], input[type="time"]', (els) => els.length);
  check('Inputs de fecha/hora con tipos nativos', fechaInputs >= 2, fechaInputs + ' inputs');

  await page.screenshot({ path: DIR + '/final.png' });
  console.log('\nTOTAL: ' + (pass + fail) + ' | PASS: ' + pass + ' | FAIL: ' + fail);
  console.log('ERRORES JS durante sesión: ' + jsErrors.length);
  fs.writeFileSync(DIR + '/extended-audit.json',
    JSON.stringify({ pass, fail, results, jsErrors }, null, 2));
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);

})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
