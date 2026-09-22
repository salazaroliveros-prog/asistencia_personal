/**
 * Auditoría en vivo contra producción (Vercel).
 * Simula un usuario: navega módulos, abre modales, prueba formularios,
 * reportes, carnets, ajustes y captura errores de consola.
 *
 *   npx playwright test __e2e__/live-production-audit.spec.ts --config=playwright.live.config.ts
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const LIVE = process.env.LIVE_URL || 'https://controlasistenciaapp.vercel.app';
const findings: Array<{ severity: string; module: string; detail: string }> = [];
const consoleNoise: string[] = [];

function note(severity: 'ok' | 'warn' | 'fail' | 'info', module: string, detail: string) {
  findings.push({ severity, module, detail });
}

async function boot(page: Page, hash = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    consoleNoise.push(`pageerror: ${e.message}`);
  });
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      consoleNoise.push(t);
      // Filtrar ruido conocido de extensiones / third-party
      if (!/favicon|ResizeObserver|extension:\/\//i.test(t)) {
        errors.push(t);
      }
    }
  });

  await page.goto(`${LIVE}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 25000 }).catch(() => {});
  await page.waitForSelector('#app:not([hidden])', { timeout: 25000 });
  await page.waitForTimeout(1200);
  return errors;
}

async function dismissBlockingBanners(page: Page) {
  await page.evaluate(() => {
    const ids = ['update-banner', 'pwa-install-banner', 'demo-banner'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
  });
  await page.locator('#update-dismiss').click({ timeout: 1000 }).catch(() => {});
}

async function go(page: Page, pageId: string) {
  await dismissBlockingBanners(page);
  const link = page.locator(`.nav-link[data-page="${pageId}"], a[href="#${pageId}"]`).first();
  if (await link.count()) {
    await link.click({ force: true });
  } else {
    await page.evaluate((id) => { window.location.hash = id; }, pageId);
  }
  await page.waitForTimeout(900);
  const section = page.locator(`#page-${pageId}, .page[data-page="${pageId}"]`);
  await expect(section.first()).toBeVisible({ timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test('LIVE audit — recorrido completo como usuario', async ({ page, context }) => {
  test.setTimeout(300000);
  await context.grantPermissions(['geolocation']).catch(() => {});
  await context.setGeolocation({ latitude: 14.6349, longitude: -90.5069 });

  const bootErrors = await boot(page);
  await dismissBlockingBanners(page);
  note(bootErrors.length ? 'warn' : 'ok', 'boot', `Errores al cargar: ${bootErrors.length}`);

  // ── Dashboard ──────────────────────────────────────────────────────────
  await go(page, 'dashboard');
  const kpis = ['Personal Activo', 'Asistencia Hoy'];
  for (const label of kpis) {
    const visible = await page.getByText(label, { exact: false }).first().isVisible().catch(() => false);
    note(visible ? 'ok' : 'fail', 'dashboard', `KPI "${label}" visible=${visible}`);
  }
  const refresh = page.locator('#btn-refresh-dashboard');
  if (await refresh.count()) {
    await refresh.click();
    await page.waitForTimeout(600);
    note('ok', 'dashboard', 'btn-refresh-dashboard click');
  }

  // ── Personal: CRUD local (sin sesión cloud) ────────────────────────────
  await go(page, 'personal');
  await page.locator('#btn-nuevo-personal').click();
  await expect(page.locator('#modal-personal')).toBeVisible({ timeout: 8000 });

  // Validación vacía
  await dismissBlockingBanners(page);
  await page.locator('#btn-guardar-personal').click({ force: true });
  await page.waitForTimeout(500);
  const toastVal = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
  note(/valid|nombre|dpi|requerid|completa/i.test(toastVal) || await page.locator('#modal-personal').isVisible(),
    'personal', `Validación form vacío → toast/modal: "${toastVal.slice(0, 80)}"`);

  const suffix = String(Date.now()).slice(-4);
  const dpi = `2988${suffix}010101`.replace(/\D/g, '').slice(0, 13).padEnd(13, '0');
  const nombre = `Carlos Perez Audit`;
  await page.fill('#p-nombre', nombre);
  await page.fill('#p-dpi', dpi);
  const puesto = page.locator('#p-puesto');
  const optCount = await puesto.locator('option').count();
  if (optCount > 1) await puesto.selectOption({ index: 1 });
  await page.fill('#p-jefe', 'Ingeniero Salazar');
  await page.fill('#p-telefono', '55551234');
  await page.fill('#p-whatsapp', '55551234');
  await page.fill('#p-direccion', 'Zona 1 Guatemala');

  await dismissBlockingBanners(page);
  await page.locator('#btn-guardar-personal').click({ force: true });
  await Promise.race([
    page.waitForSelector('#modal-personal[hidden], #modal-personal:not(.open)', { timeout: 20000 }).catch(() => null),
    page.waitForSelector('#toast-container .toast', { timeout: 20000 }),
  ]);
  await page.waitForTimeout(1000);

  const modalStill = await page.locator('#modal-personal').isVisible().catch(() => false);
  const toastSave = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
  const saved = !modalStill || /guardado|registrado|dispositivo|nube|sincroniz/i.test(toastSave);
  note(saved ? 'ok' : 'fail', 'personal', `Guardar trabajador: modalOpen=${modalStill} toast="${toastSave.slice(0, 100)}"`);

  // Verificar en tabla / estado
  const inTable = await page.locator('#personal-tbody, #tabla-personal').getByText(nombre).count().catch(() => 0);
  note(inTable > 0 ? 'ok' : 'warn', 'personal', `Trabajador en tabla: count=${inTable}`);

  const workerState = await page.evaluate((n) => {
    const all = (window as any).AppState?.get?.('personal') || [];
    const w = all.find((x: any) => x.Nombre_Completo === n);
    const Persist = (window as any).CPC?.Persist;
    const cap = Persist?.getWriteCapability?.();
    return {
      found: !!w,
      id: w?.ID_Trabajador || null,
      whatsapp: w?.WhatsApp || null,
      estado: w?.Estado || null,
      persistOk: !!Persist,
      writeCap: cap || null,
      queueLen: ((window as any).API?.getOfflineQueue?.() || []).length,
    };
  }, nombre);
  note(workerState.found ? 'ok' : 'fail', 'personal', `AppState: ${JSON.stringify(workerState)}`);

  // Editar si existe en tabla
  if (workerState.id) {
    const row = page.locator(`tr:has-text("${nombre}")`).first();
    const editBtn = row.locator('[data-action="edit"]').first();
    if (await editBtn.count()) {
      await dismissBlockingBanners(page);
      await editBtn.click({ force: true });
      await expect(page.locator('#modal-personal')).toBeVisible({ timeout: 8000 });
      await page.fill('#p-direccion', 'Zona 10 Editada');
      await dismissBlockingBanners(page);
      await page.locator('#btn-guardar-personal').click({ force: true });
      await page.waitForTimeout(1500);
      const toastEdit = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
      note(/actualiz|guardado|dispositivo|nube/i.test(toastEdit) || !(await page.locator('#modal-personal').isVisible()),
        'personal', `Editar: "${toastEdit.slice(0, 90)}"`);
    } else {
      note('warn', 'personal', 'No se encontró botón Editar en la fila');
    }

    // Carné QR
    const carneBtn = row.locator('[data-action="qr"]').first();
    if (await carneBtn.count()) {
      await dismissBlockingBanners(page);
      await carneBtn.click({ force: true });
      await page.waitForTimeout(1200);
      const carneVisible = await page.locator('#modal-carne').isVisible().catch(() => false);
      note(carneVisible ? 'ok' : 'warn', 'personal', `Modal carné visible=${carneVisible}`);
      if (carneVisible) {
        const qr = page.locator('#modal-carne canvas, #modal-carne img, #carne-qr-container canvas, #carne-qr-container img');
        note((await qr.count()) > 0 ? 'ok' : 'warn', 'personal', `QR en carné count=${await qr.count()}`);
        const dl = page.locator('#btn-descargar-carne-png');
        if (await dl.count()) {
          note(await dl.isEnabled() ? 'ok' : 'fail', 'personal', 'btn-descargar-carne-png enabled');
        }
        await page.locator('#modal-carne .modal-close, [data-modal="modal-carne"]').first().click({ force: true }).catch(() => {});
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      }
    } else {
      note('warn', 'personal', 'Botón carné/QR no encontrado en fila');
    }
  }

  // Cámara foto (permiso puede fallar headless)
  await page.locator('#btn-nuevo-personal').click();
  await expect(page.locator('#modal-personal')).toBeVisible();
  const camBtn = page.locator('#btn-tomar-foto');
  if (await camBtn.count()) {
    await camBtn.click();
    await page.waitForTimeout(1500);
    const camModal = await page.locator('#modal-camera').isVisible().catch(() => false);
    note(camModal ? 'ok' : 'warn', 'personal', `Modal cámara abierto=${camModal} (headless puede bloquear getUserMedia)`);
    await page.locator('#btn-camera-close, #modal-camera .modal-close').first().click().catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('#modal-personal .modal-close').first().click().catch(() => {});
  }

  // ── Asistencia ─────────────────────────────────────────────────────────
  await go(page, 'asistencia');
  const scanStart = page.locator('#btn-start-scan');
  if (await scanStart.count()) {
    await scanStart.click({ force: true });
    await page.waitForTimeout(2000);
    const scanStop = page.locator('#btn-stop-scan');
    const scanning = await scanStop.isVisible().catch(() => false);
    const camMsg = ((await page.locator('#page-asistencia').innerText().catch(() => '')) || '');
    note(scanning ? 'ok' : 'warn', 'asistencia', `Escáner start → stop=${scanning}; msgCam=${/cámara|camera|disponib/i.test(camMsg)}`);
    if (scanning) await scanStop.click({ force: true }).catch(() => {});
  }

  // Pestaña marcación manual
  const tabManual = page.locator('[data-tab="manual"], button:has-text("Marcación Manual"), .tab:has-text("Manual")').first();
  if (await tabManual.count()) {
    await tabManual.click({ force: true });
    await page.waitForTimeout(500);
    note('ok', 'asistencia', 'Tab Marcación Manual abierta');
  }
  const manualSearch = page.locator('#manual-worker-search');
  if (await manualSearch.count() && await manualSearch.isVisible().catch(() => false)) {
    await manualSearch.fill('Carlos');
    await page.waitForTimeout(800);
    const suggestion = page.locator('#autocomplete-list li, #autocomplete-list [role="option"]').first();
    if (await suggestion.count() && await suggestion.isVisible().catch(() => false)) {
      await suggestion.click({ force: true });
      await page.waitForTimeout(500);
      const selected = await page.locator('#manual-worker-selected').isVisible().catch(() => false);
      note(selected ? 'ok' : 'warn', 'asistencia', `Trabajador seleccionado=${selected}`);
      if (selected) {
        const entrada = page.locator('#manual-worker-selected .btn-marcacion[data-tipo="Entrada"]');
        if (await entrada.count()) {
          await entrada.click({ force: true });
          await page.waitForTimeout(1000);
          const toastM = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
          note(/entrada|marcaci|registr|guardad|dispositivo|sincroniz/i.test(toastM) ? 'ok' : 'warn',
            'asistencia', `Marcación Entrada: "${toastM.slice(0, 90)}"`);
        }
      }
    } else {
      note('warn', 'asistencia', 'Sin sugerencias autocomplete (¿personal vacío en esta sesión?)');
    }
    note('ok', 'asistencia', 'Búsqueda manual llenada');
  } else {
    note('warn', 'asistencia', 'manual-worker-search no visible');
  }
  const mapBtn = page.locator('#btn-view-map');
  if (await mapBtn.count()) {
    await mapBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    note('ok', 'asistencia', 'btn-view-map click');
    await page.keyboard.press('Escape').catch(() => {});
  }

  // ── Campo ──────────────────────────────────────────────────────────────
  await go(page, 'campo');
  const campoVideo = page.locator('#campo-video, #campo-scanner, video, #qr-reader');
  note((await campoVideo.count()) > 0 ? 'ok' : 'warn', 'campo', `Elementos cámara/scanner count=${await campoVideo.count()}`);
  const campoBtns = page.locator('#page-campo button:visible');
  note('info', 'campo', `Botones visibles en campo: ${await campoBtns.count()}`);

  // ── Reportes ───────────────────────────────────────────────────────────
  await go(page, 'reportes');
  for (const id of ['btn-preview-diario', 'btn-preview-semanal', 'btn-preview-mensual']) {
    const btn = page.locator(`#${id}`);
    if (await btn.count()) {
      await btn.click({ force: true });
      await page.waitForTimeout(1000);
      note('ok', 'reportes', `${id} click`);
    }
  }
  const csv = page.locator('#btn-csv-diario');
  if (await csv.count()) {
    await csv.click().catch(() => {});
    await page.waitForTimeout(600);
    note('ok', 'reportes', 'btn-csv-diario click');
  }

  // ── Ajustes: inputs y botones ──────────────────────────────────────────
  await go(page, 'ajustes');
  const inputs = [
    'firebase-auth-email', 'firebase-auth-password',
    'cfg-nombre-obra', 'cfg-encargado',
    'cfg-hora-entrada', 'cfg-hora-salida-obra',
    'cfg-gps-centro-lat', 'cfg-gps-centro-lon', 'cfg-gps-radio',
  ];
  for (const id of inputs) {
    const el = page.locator(`#${id}`);
    const exists = (await el.count()) > 0;
    note(exists ? 'ok' : 'warn', 'ajustes', `input #${id} exists=${exists}`);
  }

  // Guardar general con valor de prueba
  const obra = page.locator('#cfg-nombre-obra, #nombre-obra, #cfg-obra');
  if (await obra.count()) {
    await obra.first().fill(`Obra Audit Live`);
    const saveG = page.locator('#btn-save-general');
    if (await saveG.count()) {
      await saveG.click({ force: true });
      await page.waitForTimeout(800);
      const t = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
      note(/guardad|actualiz|config/i.test(t) ? 'ok' : 'warn', 'ajustes', `save-general toast="${t.slice(0, 80)}"`);
    }
  }

  const saveH = page.locator('#btn-save-horarios');
  if (await saveH.count()) {
    await saveH.click();
    await page.waitForTimeout(600);
    note('ok', 'ajustes', 'btn-save-horarios click');
  }

  const saveGps = page.locator('#btn-save-gps');
  if (await saveGps.count()) {
    await saveGps.click();
    await page.waitForTimeout(600);
    note('ok', 'ajustes', 'btn-save-gps click');
  }

  for (const id of [
    'btn-use-local', 'btn-load-scanner-audit', 'btn-qr-scanner-instalacion',
    'btn-export-backup', 'btn-export-trabajadores', 'btn-export-asistencias',
    'btn-check-claims', 'btn-open-gas-assistant',
  ]) {
    const btn = page.locator(`#${id}`);
    if (!(await btn.count())) {
      note('warn', 'ajustes', `faltante #${id}`);
      continue;
    }
    try {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(700);
      note('ok', 'ajustes', `${id} click ok`);
      // Cerrar modales abiertos
      await page.keyboard.press('Escape').catch(() => {});
      const close = page.locator('.modal-overlay:not([hidden]) .modal-close, .modal-overlay:visible .modal-close').first();
      if (await close.count()) await close.click().catch(() => {});
    } catch (e: any) {
      note('warn', 'ajustes', `${id} click falló: ${e.message?.slice(0, 80)}`);
    }
  }

  // Login vacío → validación
  const loginBtn = page.locator('#btn-login-firebase');
  if (await loginBtn.count()) {
    await page.fill('#firebase-auth-email', '');
    await page.fill('#firebase-auth-password', '');
    await loginBtn.click();
    await page.waitForTimeout(600);
    const t = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
    note(/correo|email|contrase|password|requerid|completa/i.test(t) ? 'ok' : 'info', 'ajustes', `login vacío → "${t.slice(0, 80)}"`);
  }

  // ── Scanner PWA remoto ─────────────────────────────────────────────────
  const scannerErrors: string[] = [];
  const scannerPage = await context.newPage();
  scannerPage.on('pageerror', (e) => scannerErrors.push(e.message));
  scannerPage.on('console', (m) => { if (m.type() === 'error') scannerErrors.push(m.text()); });
  await scannerPage.goto(`${LIVE}/field-scanner.html`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(async () => {
    await scannerPage.goto(`${LIVE}/field-scanner`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  });
  await scannerPage.waitForTimeout(2500);
  const scannerTitle = await scannerPage.title().catch(() => '');
  const scannerBody = await scannerPage.locator('body').innerText().catch(() => '');
  note(scannerTitle || scannerBody ? 'ok' : 'fail', 'field-scanner', `title="${scannerTitle}" bodyLen=${scannerBody.length} errors=${scannerErrors.length}`);
  if (scannerErrors.length) {
    note('warn', 'field-scanner', `console: ${scannerErrors.slice(0, 3).join(' | ').slice(0, 200)}`);
  }
  await scannerPage.close();

  // ── Resumen persistencia / auth ────────────────────────────────────────
  const runtime = await page.evaluate(() => {
    const FC = (window as any).FirebaseClient;
    const Persist = (window as any).CPC?.Persist;
    return {
      firebaseReady: FC?.isReady?.() ?? false,
      connection: FC?.getConnectionState?.() ?? null,
      user: FC?.getCurrentUser?.()?.email ?? null,
      capability: Persist?.getWriteCapability?.() ?? null,
      backendMode: (window as any).AppState?.get?.('backendMode'),
      connected: (window as any).AppState?.get?.('connected'),
      personalCount: ((window as any).AppState?.get?.('personal') || []).length,
      queue: ((window as any).API?.getOfflineQueue?.() || []).length,
      hasPersist: !!Persist,
    };
  });
  note('info', 'runtime', JSON.stringify(runtime));

  // Fatal Firebase noise
  const fatal = consoleNoise.filter((t) => /No Firebase App|shutting down|Uncaught/i.test(t));
  note(fatal.length ? 'fail' : 'ok', 'console', `Errores fatales Firebase/uncaught: ${fatal.length}`);
  if (fatal.length) note('fail', 'console', fatal.slice(0, 5).join(' || '));

  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/live-audit-report.json', JSON.stringify({ live: LIVE, findings, consoleNoise: consoleNoise.slice(0, 80) }, null, 2));

  const fails = findings.filter((f) => f.severity === 'fail');
  console.log('\n=== LIVE AUDIT SUMMARY ===');
  for (const f of findings) console.log(`[${f.severity}] ${f.module}: ${f.detail}`);
  expect(fails, `Fallos críticos:\n${fails.map((f) => f.detail).join('\n')}`).toEqual([]);
});
