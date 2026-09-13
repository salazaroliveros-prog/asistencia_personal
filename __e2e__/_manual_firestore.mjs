// PRUEBA MANUAL: Módulo Ajustes -> formulario Firestore -> botón "Conectar Firestore"
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '3800', '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 4000));

const log = (m) => console.log('[manual] ' + m);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const consoleErrors = [];
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text.includes('.js.map')) consoleErrors.push(m.text); });
page.on('requestfailed', r => consoleErrors.push('REQFAIL: ' + r.url));

const CFG = {
  projectId: 'sistema-de-control-aee89',
  apiKey: 'AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg',
  authDomain: 'sistema-de-control-aee89.firebaseapp.com',
  appId: '1:265655332442:web:c4e8617741e3b916987263',
};

try {
  log('goto /#ajustes');
  await page.goto('http://127.0.0.1:3800/#ajustes', { waitUntil: 'load' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 25000 });
  // confirmar que la página de ajustes quedó activa
  await page.waitForFunction(() => {
    const el = document.getElementById('page-ajustes');
    return el && (el.classList.contains('active') || !el.hasAttribute('hidden'));
  }, { timeout: 20000 }).catch(() => log('AVISO: page-ajustes no marco active, continuo igual'));
  await page.waitForTimeout(1200);
  log('#app visible + ajustes');

  // Comprobar que los inputs existen
  const ids = ['firebase-project-id', 'firebase-api-key', 'firebase-auth-domain', 'firebase-app-id'];
  const missing = [];
  for (const id of ids) if ((await page.locator('#' + id).count()) === 0) missing.push(id);
  log('inputs faltantes: ' + (missing.length ? missing.join(',') : 'ninguno'));

  // Rellenar formulario con datos del .env
  await page.locator('#firebase-project-id').fill(CFG.projectId);
  await page.locator('#firebase-api-key').fill(CFG.apiKey);
  await page.locator('#firebase-auth-domain').fill(CFG.authDomain);
  await page.locator('#firebase-app-id').fill(CFG.appId);
  const vals = {
    projectId: await page.locator('#firebase-project-id').inputValue(),
    apiKey: await page.locator('#firebase-api-key').inputValue(),
    authDomain: await page.locator('#firebase-auth-domain').inputValue(),
    appId: await page.locator('#firebase-app-id').inputValue(),
  };
  log('formulario rellenado: ' + JSON.stringify(vals));

  // Estado inicial del status
  const statusInit = await page.locator('#connection-status-detail').textContent();
  log('status inicial: ' + statusInit);

  // DEPURACIÓN: replicar exactamente el config que construye _conectarFirebase
  const dbgConfig = await page.evaluate(() => {
    const raw = { ...(window.FirebaseClient ? FirebaseClient.getConfig() : {}),
      projectId: document.getElementById('firebase-project-id')?.value.trim(),
      apiKey: document.getElementById('firebase-api-key')?.value.trim(),
      authDomain: document.getElementById('firebase-auth-domain')?.value.trim(),
      appId: document.getElementById('firebase-app-id')?.value.trim(),
    };
    let v = 'n/a';
    try { v = JSON.stringify(window.validateFirebaseConfig ? window.validateFirebaseConfig(raw) : null); } catch (e) { v = 'THROW ' + e.message; }
    return { raw, validationResult: v, hasFC: !!window.FirebaseClient, hasValidate: !!window.validateFirebaseConfig, firebaseConfigGlobal: JSON.stringify(window.FIREBASE_CONFIG || 'n/a') };
  });
  log('DBG ingress: ' + JSON.stringify(dbgConfig));

  // Pulsar "Conectar Firestore"
  const btnCount = await page.locator('#btn-connect-firebase').count();
  log('btn-connect-firebase count=' + btnCount);
  await page.evaluate(() => document.getElementById('btn-connect-firebase')?.click());
  log('boton Conectar Firestore pulsado');

  // Esperar resultado (conectar -> exito/error), hasta ~30s
  let finalText = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    finalText = await page.locator('#connection-status-detail').textContent();
    if (finalText !== '⏳ Conectando con Firestore…' && !statusInit.includes('⏳') && finalText !== statusInit) break;
  }
  log('STATUS_FINAL: ' + finalText);

  await page.screenshot({ path: '__e2e__/output/screenshots/manual-firestore-final.png', fullPage: false, timeout: 8000 })
    .catch(e => log('shot fail: ' + e.message.split('\n')[0]));
  log('screenshot guardada');

  const mode = await page.evaluate(() => (window.AppState && window.AppState.get && window.AppState.get('backendMode')) || '?');
  const conn = await page.evaluate(() => (window.FirebaseClient && FirebaseClient.getConnectionState && FirebaseClient.getConnectionState()) || '?');
  log('backendMode=' + mode + ' connectionState=' + conn);

  console.log('====================================================');
  console.log('RESULTADO FINAL: ' + finalText);
  console.log('ERRORES DE CONSOLA OBSERVADOS: ' + consoleErrors.length);
  consoleErrors.forEach(e => console.log('  - ' + e));
  console.log('====================================================');
} catch (e) {
  log('EXCEPCION: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: '__e2e__/output/screenshots/manual-firestore-error.png' }).catch(() => {});
} finally {
  await browser.close().catch(() => {});
  server.kill();
  process.exit(0);
}