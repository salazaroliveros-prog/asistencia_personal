// QA VISUAL: crear trabajador por UI en produccion, validar almacenamiento en Firestore, screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://controlasistenciaapp.vercel.app';
const OUT = '__e2e__/output/visual';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const r = (name, ok, extra = '') => { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : '')); };

const server = (await import('node:child_process')).spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3800', '--strictPort'], { stdio: 'ignore' });
await new Promise(res => setTimeout(res, 4000));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const jsErrors = [];
page.on('pageerror', e => jsErrors.push(e.message));

const shot = async (n) => {
  const f = `${OUT}/${n}.png`;
  await page.screenshot({ path: f, fullPage: false, timeout: 8000 }).catch(() => {});
  return f;
};

try {
  // 1. Carga
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#app:not([hidden])', { timeout: 25000 });
  await shot('01-dashboard');
  r('App carga y dashboard visible', true);

  // 2. Navegar a Personal (movil: abrir menu hamburguesa primero)
  const mt = page.locator('#menu-toggle');
  if (await mt.count() > 0) { await mt.click().catch(() => {}); await page.waitForTimeout(400); }
  const link = page.locator('a[data-page="personal"]');
  await link.click({ timeout: 10000 });
  await page.waitForTimeout(1200);
  await shot('02-personal');
  r('Navegacion a Personal', await page.locator('#btn-nuevo-personal').count() > 0);

  // 3. Abrir modal
  await page.click('#btn-nuevo-personal');
  await page.waitForFunction(() => !document.getElementById('modal-personal').hidden);
  await page.waitForTimeout(500);
  await shot('03-modal-vacio');
  r('Modal Registrar Trabajador abre', true);

  // 4. Validacion negativa: guardar vacio
  await page.click('#btn-guardar-personal');
  await page.waitForTimeout(600);
  const negOK = await page.evaluate(() => !document.getElementById('modal-personal').hidden);
  r('Validacion negativa: guardado vacio rechazado', negOK);
  await shot('04-validacion-negativa');
  await page.click('#btn-guardar-personal').catch(() => {});
  await page.waitForTimeout(300);

  // 5. Llenar formulario
  const DPI = '2001123456789';
  const NOMBRE = 'QA Visual Tester';
  await page.fill('#p-nombre', NOMBRE);
  await page.fill('#p-dpi', DPI);
  await page.selectOption('#p-puesto', 'Albanil');
  await page.fill('#p-telefono', '+502 5555-0101');
  await page.waitForTimeout(300);
  await shot('05-modal-llenado');

  // 6. Guardar
  await page.click('#btn-guardar-personal');
  await page.waitForTimeout(2500);
  const cerrado = await page.evaluate(() => document.getElementById('modal-personal').hidden);
  await shot('06-tras-guardar');
  r('Guardado exitoso (modal cerrado)', cerrado);

  // 7. Verificar en la UI (busqueda por DPI)
  await page.fill('#personal-search', DPI);
  await page.waitForTimeout(1500);
  const enTabla = await page.evaluate((dpi) => {
    const t = document.getElementById('personal-tbody');
    return t ? t.textContent.includes(dpi) : false;
  }, DPI);
  await shot('07-busqueda-en-tabla');
  r('Trabajador visible en la tabla', enTabla);

  // 8. Verificar en Firestore directamente (SDK ya cargado en la app)
  const firestoreCheck = await page.evaluate(async (dpi) => {
    try {
      const app = firebase.apps()[0];
      const db = firebase.firestore(app);
      const snap = await db.collection('trabajadores').where('dpi', '==', dpi).get();
      if (snap.empty) return { found: false };
      const doc = snap.docs[0];
      return { found: true, id: doc.id, data: doc.data() };
    } catch (e) { return { error: e.message }; }
  }, DPI);
  r('Persistido en Firestore (trabajadores)', !!(firestoreCheck.found), firestoreCheck.found ? 'id=' + firestoreCheck.id : JSON.stringify(firestoreCheck).slice(0, 120));
  console.log('   Datos:', JSON.stringify(firestoreCheck.data || {}).slice(0, 300));

  // 9. Editar el trabajador (cambiar nombre)
  if (firestoreCheck.found) {
    await page.fill('#personal-search', DPI);
    await page.waitForTimeout(1000);
    const row = page.locator('#personal-tbody tr', { hasText: DPI }).first();
    if (await row.count()) {
      const editBtn = row.locator('button').first();
      await editBtn.click();
      await page.waitForTimeout(800);
      const modalAbierto = await page.evaluate(() => !document.getElementById('modal-personal').hidden);
      r('Editar: modal abre con datos precargados', modalAbierto);
      await shot('08-modal-editar');
      if (modalAbierto) {
        await page.fill('#p-nombre', NOMBRE + ' Editado');
        await page.click('#btn-guardar-personal');
        await page.waitForTimeout(2500);
        const verif = await page.evaluate(async (dpi) => {
          const db = firebase.firestore(firebase.apps()[0]);
          const s = await db.collection('trabajadores').where('dpi', '==', dpi).get();
          return s.empty ? null : s.docs[0].data().nombre;
        }, DPI);
        r('Modificacion persistida', verif === NOMBRE + ' Editado', 'nombre=' + verif);
        await shot('09-tras-editar');
      }
    }
  }

  // 10. Eliminar el trabajador de prueba (limpieza de produccion)
  await page.fill('#personal-search', DPI);
  await page.waitForTimeout(1000);
  const row2 = page.locator('#personal-tbody tr', { hasText: DPI }).first();
  if (await row2.count()) {
    const btns = row2.locator('button');
    const n = await btns.count();
    page.once('dialog', d => d.accept());
    await btns.nth(n - 1).click();
    await page.waitForTimeout(2000);
    const eliminado = await page.evaluate(async (dpi) => {
      const db = firebase.firestore(firebase.apps()[0]);
      const s = await db.collection('trabajadores').where('dpi', '==', dpi).get();
      return s.empty;
    }, DPI);
    await shot('10-tras-eliminar');
    r('Eliminacion funciona y limpia Firestore', eliminado);
  } else {
    await page.evaluate(async (dpi) => {
      const db = firebase.firestore(firebase.apps()[0]);
      const s = await db.collection('trabajadores').where('dpi', '==', dpi).get();
      for (const d of s.docs) await d.ref.delete();
    }, DPI);
    console.log('WARN | Boton eliminar no encontrado en fila; limpiado directo por SDK');
  }

  // 11. Errores JS
  r('0 errores JS durante todo el flujo', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 200));

  await page.fill('#personal-search', '').catch(() => {});
  await page.waitForTimeout(800);
  await shot('11-final');
} catch (e) {
  console.log('ERROR FATAL: ' + e.message.split('\n')[0]);
  await shot('99-error').catch(() => {});
} finally {
  await browser.close().catch(() => {});
  server.kill();
}
const p = results.filter(x => x.ok).length, f = results.length - p;
console.log(`==== RESUMEN: ${p}/${results.length} PASS, ${f} FAIL ====`);
fs.writeFileSync(`${OUT}/visual-results.json`, JSON.stringify({ results, jsErrors }, null, 2));
process.exit(0);

