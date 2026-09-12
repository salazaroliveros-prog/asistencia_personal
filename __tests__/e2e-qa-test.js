/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QA E2E TEST — CONTROL PERSONAL CAMPO
 * Prueba de extremo a extremo: navegación, registro de personal,
 * validaciones, asistencia manual, modal carné QR y reportes.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '__tests__/screenshots/e2e';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

// ── Datos de trabajadores de prueba ───────────────────────────────────────
const TRABAJADORES = [
  {
    nombre:    'Roberto Estuardo Lima Cifuentes',
    dpi:       '2512345678901',
    puesto:    'Maestro de Obra',
    jefe:      'Ing. Ana López',
    telefono:  '55123456',
    whatsapp:  '55123456',
    direccion: 'Guatemala, Zona 10',
  },
  {
    nombre:    'Luisa Fernanda Reyes Ajú',
    dpi:       '1823456789012',
    puesto:    'Residente',
    jefe:      'Ing. Ana López',
    telefono:  '44987654',
    whatsapp:  '44987654',
    direccion: 'Mixco, Guatemala',
  },
  {
    nombre:    'Martín Alejandro Chávez Pac',
    dpi:       '3045678901234',
    puesto:    'Albañil',
    jefe:      'Roberto Lima',
    telefono:  '55678901',
    whatsapp:  '',
    direccion: 'Villa Nueva, Guatemala',
  },
];

// ── Datos DPI inválidos para prueba de validación ─────────────────────────
const DPI_INVALIDO   = '12345';       // menos de 13 dígitos
const NOMBRE_CORTO   = 'AB';          // menos de 3 caracteres

// ── Resultados del test ────────────────────────────────────────────────────
const reporte = {
  inicio:       new Date().toISOString(),
  fin:          null,
  totalChecks:  0,
  pasados:      0,
  fallidos:     0,
  advertencias: 0,
  pasos:        [],
};

let screenshotCounter = 0;

function check(condicion, descripcion, categoria = 'assert') {
  reporte.totalChecks++;
  const estado = condicion ? 'PASS' : 'FAIL';
  if (condicion) reporte.pasados++;
  else           reporte.fallidos++;

  const emoji = condicion ? '✅' : '❌';
  console.log(`  ${emoji} [${estado}] ${descripcion}`);
  reporte.pasos.push({ estado, descripcion, categoria });
}

function warn(descripcion) {
  reporte.advertencias++;
  console.log(`  ⚠️  [WARN] ${descripcion}`);
  reporte.pasos.push({ estado: 'WARN', descripcion, categoria: 'warn' });
}

function paso(numero, descripcion) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PASO ${numero}: ${descripcion}`);
  console.log('═'.repeat(60));
  reporte.pasos.push({ estado: 'STEP', descripcion: `PASO ${numero}: ${descripcion}`, categoria: 'step' });
}

async function shot(page, nombre) {
  screenshotCounter++;
  const numStr = String(screenshotCounter).padStart(2, '0');
  const path   = `${DIR}/${numStr}-${nombre}.png`;
  await page.screenshot({ path, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log(`  📸 ${path}`);
  return path;
}

async function navegarA(page, seccion) {
  await page.evaluate(p => window.location.hash = '#' + p, seccion);
  await page.waitForFunction(p => {
    const el = document.getElementById('page-' + p);
    return el && el.classList.contains('active');
  }, seccion, { timeout: 6000 });
  await page.waitForTimeout(800);
}

// ── Llenar y guardar un trabajador ─────────────────────────────────────────
async function registrarTrabajador(page, datos) {
  // Esperar a que no haya overlay ni modal bloqueando antes de abrir
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return !m || m.hidden;
  }, { timeout: 8000 });

  // Abrir modal
  await page.click('#btn-nuevo-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  }, { timeout: 5000 });
  await page.waitForTimeout(400);

  // Llenar campos
  await page.fill('#p-nombre',    datos.nombre);
  await page.fill('#p-dpi',       datos.dpi);
  await page.selectOption('#p-puesto', datos.puesto);
  if (datos.jefe)      await page.fill('#p-jefe',      datos.jefe);
  if (datos.telefono)  await page.fill('#p-telefono',  datos.telefono);
  if (datos.whatsapp)  await page.fill('#p-whatsapp',  datos.whatsapp);
  if (datos.direccion) await page.fill('#p-direccion', datos.direccion);

  await page.waitForTimeout(200);

  // Guardar
  await page.click('#btn-guardar-personal');

  // Esperar activamente el cierre del modal (máx 8s)
  try {
    await page.waitForFunction(() => {
      const m = document.getElementById('modal-personal');
      return m && m.hidden;
    }, { timeout: 8000 });
  } catch (_) {
    // Si no se cerró en tiempo, retornar false para que el check falle con info clara
  }

  // Confirmar estado final
  const modalCerrado = await page.evaluate(() => {
    const m = document.getElementById('modal-personal');
    return m && m.hidden;
  });

  return modalCerrado;
}

// ══════════════════════════════════════════════════════════════════════════
// EJECUCIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({
    viewport:     { width: 1280, height: 800 },
    storageState: undefined,
  });
  const page = await ctx.newPage();

  // Capturar errores JS
  const jsErrors = [];
  page.on('pageerror', e => {
    if (!e.message.includes('html5-qrcode') && !e.message.includes('Script error')) {
      jsErrors.push(e.message);
      console.warn('  [JS ERROR]', e.message);
    }
  });

  console.log('\n🚀 Iniciando QA E2E — CONTROL PERSONAL CAMPO');
  console.log(`   Fecha: ${new Date().toLocaleString('es-GT')}`);
  console.log(`   URL:   http://localhost:3800\n`);

  try {

    // ──────────────────────────────────────────────────────────────────────
    paso(1, 'CARGA INICIAL DE LA APLICACIÓN');
    // ──────────────────────────────────────────────────────────────────────
    await page.goto('http://localhost:3800', { waitUntil: 'networkidle' });

    // Esperar que termine el splash y aparezca la app
    await page.waitForFunction(() => {
      const app = document.getElementById('app');
      return app && !app.hidden;
    }, { timeout: 15000 });
    await page.waitForTimeout(2000);

    await shot(page, 'carga-inicial');

    const appVisible = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app && !app.hidden;
    });
    check(appVisible, 'La aplicación carga y muestra el contenido principal');

    const sinBanner = await page.evaluate(() => {
      const b = document.getElementById('demo-banner');
      return !b || b.hidden || getComputedStyle(b).display === 'none';
    });
    check(sinBanner, 'No se muestra el banner MODO DEMO en estado inicial limpio');

    const connText = await page.evaluate(() =>
      document.getElementById('connection-text')?.textContent?.trim()
    );
    check(connText === 'Modo local', `Indicador de conexión correcto: "${connText}"`);

    const currentPage = await page.evaluate(() => AppState.get('currentPage'));
    check(currentPage === 'dashboard', `Página inicial correcta: "${currentPage}"`);

    // ──────────────────────────────────────────────────────────────────────
    paso(2, 'NAVEGACIÓN ENTRE SECCIONES');
    // ──────────────────────────────────────────────────────────────────────
    const secciones = ['personal', 'asistencia', 'reportes', 'ajustes', 'dashboard'];

    for (const sec of secciones) {
      await navegarA(page, sec);
      const activa = await page.evaluate(s => {
        const el = document.getElementById('page-' + s);
        return el && el.classList.contains('active') && !el.hidden;
      }, sec);
      check(activa, `Navegación a "${sec}" — página visible y activa`);
      await shot(page, `nav-${sec}`);
    }

    // Verificar título del topbar coincide con la sección
    await navegarA(page, 'personal');
    const titulo = await page.evaluate(() =>
      document.getElementById('page-title')?.textContent?.trim()
    );
    check(titulo === 'Gestión de Personal', `Título topbar correcto en Personal: "${titulo}"`);

    // ──────────────────────────────────────────────────────────────────────
    paso(3, 'VALIDACIONES DEL FORMULARIO — PRUEBAS NEGATIVAS');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'personal');

    // 3A: Intentar guardar sin datos
    await page.click('#btn-nuevo-personal');
    await page.waitForFunction(() => !document.getElementById('modal-personal').hidden, { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(500);

    const errorNombreVacio = await page.evaluate(() => {
      const el = document.getElementById('p-nombre-error');
      return el && !el.hidden && el.textContent.trim().length > 0;
    });
    check(errorNombreVacio, 'Error de validación: nombre vacío detectado correctamente');

    await shot(page, 'validacion-campos-vacios');

    // 3B: Nombre muy corto
    await page.fill('#p-nombre', NOMBRE_CORTO);
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(400);
    const errorNombreCorto = await page.evaluate(() => {
      const el = document.getElementById('p-nombre-error');
      return el && !el.hidden;
    });
    check(errorNombreCorto, 'Error de validación: nombre menor a 3 caracteres detectado');

    // 3C: DPI inválido (menos de 13 dígitos)
    await page.fill('#p-nombre', 'Carlos Ramírez López');
    await page.fill('#p-dpi', DPI_INVALIDO);
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(400);
    const errorDPI = await page.evaluate(() => {
      const el = document.getElementById('p-dpi-error');
      return el && !el.hidden && el.textContent.includes('13');
    });
    check(errorDPI, 'Error de validación: DPI con menos de 13 dígitos rechazado correctamente');

    await shot(page, 'validacion-dpi-invalido');

    // 3D: Sin puesto seleccionado
    await page.fill('#p-nombre', 'Carlos Ramírez López');
    await page.fill('#p-dpi', '2512345678901');
    // Puesto vacío intencional
    await page.selectOption('#p-puesto', '');
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(400);
    const errorPuesto = await page.evaluate(() => {
      const el = document.getElementById('p-puesto-error');
      return el && !el.hidden;
    });
    check(errorPuesto, 'Error de validación: puesto no seleccionado rechazado correctamente');

    // Modal sigue abierto (validaciones fallidas no cierran el modal)
    const modalSigueAbierto = await page.evaluate(() =>
      !document.getElementById('modal-personal').hidden
    );
    check(modalSigueAbierto, 'Modal permanece abierto tras validaciones fallidas');

    // Cerrar modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // ──────────────────────────────────────────────────────────────────────
    paso(4, 'REGISTRO DE 3 TRABAJADORES NUEVOS');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'personal');

    for (let i = 0; i < TRABAJADORES.length; i++) {
      const t = TRABAJADORES[i];
      console.log(`\n  Registrando trabajador ${i + 1}: ${t.nombre}`);

      const exitoso = await registrarTrabajador(page, t);
      await shot(page, `registro-trab-${i + 1}`);

      check(exitoso, `Trabajador ${i + 1} registrado y modal cerrado: "${t.nombre}"`);

      // Verificar que aparece en la tabla
      await page.waitForTimeout(500);
      const enTabla = await page.evaluate(nombre => {
        const filas = document.querySelectorAll('#personal-tbody tr');
        return [...filas].some(f => f.textContent.includes(nombre.split(' ')[0]));
      }, t.nombre);
      check(enTabla, `Trabajador "${t.nombre.split(' ')[0]}" visible en tabla tras registro`);
    }

    // Verificar contador de trabajadores
    const contadorTexto = await page.evaluate(() =>
      document.getElementById('personal-count')?.textContent?.trim()
    );
    check(
      contadorTexto === '3 trabajadores',
      `Contador de trabajadores correcto: "${contadorTexto}"`
    );

    await shot(page, 'tabla-3-trabajadores');

    // ──────────────────────────────────────────────────────────────────────
    paso(5, 'INTEGRIDAD DE DATOS — VERIFICAR PERSISTENCIA EN AppState');
    // ──────────────────────────────────────────────────────────────────────
    const estadoPersonal = await page.evaluate(() => {
      const lista = AppState.get('personal') || [];
      return {
        total:   lista.length,
        nombres: lista.map(p => p.Nombre_Completo),
        ids:     lista.map(p => p.ID_Trabajador),
        estados: lista.map(p => p.Estado),
        puestos: lista.map(p => p.Puesto),
      };
    });

    check(estadoPersonal.total === 3, `AppState contiene ${estadoPersonal.total} trabajador(es) (esperado: 3)`);

    estadoPersonal.nombres.forEach((nombre, i) => {
      check(
        nombre === TRABAJADORES[i].nombre,
        `Nombre íntegro en AppState [${i}]: "${nombre}"`
      );
    });

    estadoPersonal.ids.forEach((id, i) => {
      check(
        id && id.length > 0,
        `ID generado correctamente para trabajador ${i + 1}: "${id}"`
      );
    });

    estadoPersonal.estados.forEach((estado, i) => {
      check(estado === 'Activo', `Estado "Activo" para trabajador ${i + 1}: "${estado}"`);
    });

    estadoPersonal.puestos.forEach((puesto, i) => {
      check(
        puesto === TRABAJADORES[i].puesto,
        `Puesto íntegro para "${TRABAJADORES[i].nombre.split(' ')[0]}": "${puesto}"`
      );
    });

    // ──────────────────────────────────────────────────────────────────────
    paso(6, 'BÚSQUEDA Y FILTROS EN TABLA DE PERSONAL');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'personal');
    await page.waitForTimeout(500);

    // Búsqueda por nombre
    await page.fill('#personal-search', 'Roberto');
    await page.waitForTimeout(500);
    await shot(page, 'busqueda-roberto');

    const resultadosBusqueda = await page.evaluate(() =>
      document.querySelectorAll('#personal-tbody tr:not(.empty-row)').length
    );
    check(resultadosBusqueda >= 1, `Búsqueda "Roberto" filtra correctamente (${resultadosBusqueda} resultado(s))`);

    // Limpiar búsqueda
    await page.fill('#personal-search', '');
    await page.waitForTimeout(400);

    // Filtro por puesto
    await page.selectOption('#filter-puesto', 'Albañil');
    await page.waitForTimeout(400);
    const filtroAlbanil = await page.evaluate(() =>
      document.querySelectorAll('#personal-tbody tr:not(.empty-row)').length
    );
    check(filtroAlbanil === 1, `Filtro por puesto "Albañil" muestra ${filtroAlbanil} resultado(s) (esperado: 1)`);

    await shot(page, 'filtro-albanil');

    // Resetear filtro
    await page.selectOption('#filter-puesto', '');
    await page.waitForTimeout(400);

    // ──────────────────────────────────────────────────────────────────────
    paso(7, 'EDICIÓN DE TRABAJADOR EXISTENTE');
    // ──────────────────────────────────────────────────────────────────────
    // Hacer click en editar el primer trabajador
    await page.click('#personal-tbody .table-action-btn.edit');
    await page.waitForFunction(() => !document.getElementById('modal-personal').hidden, { timeout: 5000 });
    await page.waitForTimeout(400);

    const tituloEditar = await page.evaluate(() =>
      document.getElementById('modal-personal-title')?.textContent?.trim()
    );
    check(tituloEditar === 'Editar Trabajador', `Modal muestra título correcto: "${tituloEditar}"`);

    // Verificar que los datos están precargados
    const nombrePrecargado = await page.evaluate(() =>
      document.getElementById('p-nombre')?.value?.trim()
    );
    check(
      nombrePrecargado === TRABAJADORES[0].nombre,
      `Datos precargados en edición: nombre correcto "${nombrePrecargado}"`
    );

    await shot(page, 'modal-editar-precargado');

    // Modificar el jefe inmediato
    await page.fill('#p-jefe', 'Ing. Roberto Fuentes');
    await page.click('#btn-guardar-personal');
    await page.waitForTimeout(1200);

    const modalCerradoEdicion = await page.evaluate(() =>
      document.getElementById('modal-personal').hidden
    );
    check(modalCerradoEdicion, 'Edición guardada — modal se cerró correctamente');

    // ──────────────────────────────────────────────────────────────────────
    paso(8, 'MODAL CARNÉ QR');
    // ──────────────────────────────────────────────────────────────────────
    await page.click('#personal-tbody .table-action-btn.qr');
    await page.waitForFunction(() => !document.getElementById('modal-carne').hidden, { timeout: 5000 });
    await page.waitForTimeout(1500); // Tiempo para renderizar QR

    const carneNombre = await page.evaluate(() =>
      document.getElementById('carne-nombre')?.textContent?.trim()
    );
    check(
      carneNombre === TRABAJADORES[0].nombre,
      `Carné muestra nombre correcto: "${carneNombre}"`
    );

    // Verificar que el canvas QR se generó
    const qrGenerado = await page.evaluate(() => {
      const container = document.getElementById('carne-qr-container');
      return container && (
        container.querySelector('canvas') !== null ||
        container.querySelector('img')    !== null ||
        container.querySelector('svg')    !== null
      );
    });
    check(qrGenerado, 'Código QR generado en el carné de identificación');

    await shot(page, 'modal-carne-qr');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // ──────────────────────────────────────────────────────────────────────
    paso(9, 'HISTORIAL DE MARCACIONES DE TRABAJADOR');
    // ──────────────────────────────────────────────────────────────────────
    await page.click('#personal-tbody .table-action-btn.historial');
    await page.waitForTimeout(1000);

    const modalHistorial = await page.evaluate(() => {
      // Puede ser un modal o un panel
      const modales = document.querySelectorAll('.modal-overlay:not([hidden])');
      return modales.length > 0;
    });
    check(modalHistorial, 'Modal de historial de marcaciones se abre correctamente');

    await shot(page, 'modal-historial');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // ──────────────────────────────────────────────────────────────────────
    paso(10, 'MÓDULO ASISTENCIA — MARCACIÓN MANUAL CON TRABAJADORES REGISTRADOS');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'asistencia');

    // Ir a tab Manual
    await page.click('[data-tab="manual"]');
    await page.waitForTimeout(300);

    // Buscar el primer trabajador
    await page.fill('#manual-worker-search', 'Roberto');
    await page.waitForTimeout(600);

    await shot(page, 'asistencia-autocomplete-con-datos');

    const autocompleteItems = await page.evaluate(() =>
      document.querySelectorAll('#autocomplete-list .autocomplete-item:not([style*="pointer-events"])').length
    );
    check(autocompleteItems >= 1, `Autocomplete muestra ${autocompleteItems} resultado(s) para "Roberto"`);

    // No muestra el mensaje de "sin trabajadores"
    const noMensajeSinDatos = await page.evaluate(() => {
      const items = document.querySelectorAll('#autocomplete-list .autocomplete-item');
      return ![...items].some(el => el.textContent.includes('Sin trabajadores registrados'));
    });
    check(noMensajeSinDatos, 'Autocomplete NO muestra "Sin trabajadores registrados" cuando hay personal');

    // Seleccionar el primer resultado
    const primerItem = await page.$('#autocomplete-list .autocomplete-item');
    if (primerItem) {
      await primerItem.click();
      await page.waitForTimeout(600);
    }

    const trabajadorSeleccionado = await page.evaluate(() => {
      const panel = document.getElementById('manual-worker-selected');
      return panel && !panel.hidden;
    });
    check(trabajadorSeleccionado, 'Panel de trabajador seleccionado aparece tras click en autocomplete');

    await shot(page, 'asistencia-trabajador-seleccionado');

    // Hacer una marcación de Entrada
    const btnEntrada = await page.$('#manual-worker-selected [data-tipo="Entrada"]');
    if (btnEntrada) {
      await btnEntrada.click();
      await page.waitForTimeout(1500);
      await shot(page, 'asistencia-marcacion-entrada');

      // Verificar que se registró (toast de éxito o fila en tabla)
      const marcacionRegistrada = await page.evaluate(() => {
        // Revisar si hay una fila en la tabla de marcaciones
        const filas = document.querySelectorAll('#asistencia-tbody tr:not(.empty-row)');
        return filas.length > 0;
      });
      check(marcacionRegistrada, 'Marcación de Entrada registrada y visible en tabla del día');
    } else {
      warn('Botón de Entrada no encontrado en pantalla — posiblemente fuera del viewport');
    }

    // ──────────────────────────────────────────────────────────────────────
    paso(11, 'DASHBOARD — KPIs ACTUALIZADOS CON DATOS REALES');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'dashboard');
    await page.waitForTimeout(1000);

    await shot(page, 'dashboard-con-datos');

    const kpis = await page.evaluate(() => ({
      total:      document.getElementById('kpi-total')?.textContent?.trim(),
      asistencia: document.getElementById('kpi-asistencia')?.textContent?.trim(),
      tardanzas:  document.getElementById('kpi-tardanzas')?.textContent?.trim(),
      ausencias:  document.getElementById('kpi-ausencias')?.textContent?.trim(),
    }));
    console.log(`  KPIs: Total=${kpis.total} | Asist=${kpis.asistencia} | Tard=${kpis.tardanzas} | Aus=${kpis.ausencias}`);

    check(kpis.total === '3', `KPI Personal Activo actualizado a 3 (obtenido: "${kpis.total}")`);
    check(kpis.asistencia !== '0%', `KPI Asistencia refleja presencia (obtenido: "${kpis.asistencia}")`);

    // Lista "Asistencia de Hoy" debe mostrar al menos 1 trabajador
    const listaHoy = await page.evaluate(() =>
      document.querySelectorAll('#attendance-today-list .attendance-item').length
    );
    check(listaHoy >= 1, `Lista "Asistencia de Hoy" muestra ${listaHoy} trabajador(es)`);

    // Panel turno — debe reflejar al trabajador en obra
    const enObraCount = await page.evaluate(() =>
      document.getElementById('turno-count-en-obra')?.textContent?.trim()
    );
    check(parseInt(enObraCount) >= 1, `Panel turno "En Obra" muestra ${enObraCount} trabajador(es)`);

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(300);
    await shot(page, 'dashboard-turno-actualizado');

    // ──────────────────────────────────────────────────────────────────────
    paso(12, 'MÓDULO REPORTES');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'reportes');
    await page.waitForTimeout(500);

    await shot(page, 'reportes-inicial');

    const btnPreviewDiario = await page.$('#btn-preview-diario');
    if (btnPreviewDiario) {
      await btnPreviewDiario.click();
      await page.waitForTimeout(2000);
      await shot(page, 'reportes-preview-diario');

      const previewVisible = await page.evaluate(() => {
        const card    = document.getElementById('reporte-preview-card');
        const content = document.getElementById('reporte-preview-content');
        return card && !card.hidden && content && content.childNodes.length > 0;
      });
      check(previewVisible, 'Vista previa del reporte diario generada');
    } else {
      warn('Botón de preview diario no encontrado');
    }

    // ──────────────────────────────────────────────────────────────────────
    paso(13, 'DAR DE BAJA A UN TRABAJADOR');
    // ──────────────────────────────────────────────────────────────────────
    await navegarA(page, 'personal');
    await page.waitForTimeout(500);

    const countAntes = await page.evaluate(() =>
      (AppState.get('personal') || []).length
    );

    // Click en eliminar el último trabajador (Martín)
    const botonesDelete = await page.$$('#personal-tbody .table-action-btn.delete');
    if (botonesDelete.length > 0) {
      await botonesDelete[botonesDelete.length - 1].click();
      await page.waitForTimeout(400);

      // Confirmar usando el modal custom si está presente; si no, aceptar dialog nativo
      const modalConfirm = await page.$('#modal-confirm');
      if (modalConfirm) {
        const titleBefore = await page.textContent('#modal-confirm-title');
        check(!!titleBefore && titleBefore.trim().length > 0, 'Modal de confirmación mostrado para baja');
        await page.click('#btn-confirm-ok');
      } else {
        page.once('dialog', async dialog => {
          await dialog.accept();
        });
      }
      await page.waitForTimeout(800);

      const countDespues = await page.evaluate(() =>
        (AppState.get('personal') || []).length
      );
      const estadoMartín = await page.evaluate(() => {
        const lista = AppState.get('personal') || [];
        const m = lista.find(p => p.Nombre_Completo.includes('Martín'));
        return m ? m.Estado : null;
      });
      check(countDespues === countAntes && estadoMartín === 'Inactivo', 'Baja lógica aplicada como cambio de estado a Inactivo');
      await shot(page, 'baja-trabajador');
    }

    // ──────────────────────────────────────────────────────────────────────
    paso(14, 'ERRORES JAVASCRIPT DURANTE TODA LA SESIÓN');
    // ──────────────────────────────────────────────────────────────────────
    if (jsErrors.length === 0) {
      check(true, 'Sin errores JavaScript durante toda la sesión E2E');
    } else {
      jsErrors.forEach(e => check(false, `Error JS detectado: ${e}`));
    }

  } catch (err) {
    console.error(`\n💥 ERROR FATAL EN EL TEST: ${err.message}`);
    await shot(page, 'error-fatal').catch(() => {});
    reporte.pasos.push({ estado: 'FAIL', descripcion: `ERROR FATAL: ${err.message}`, categoria: 'fatal' });
    reporte.fallidos++;
    reporte.totalChecks++;
  }

  await browser.close();

  // ══════════════════════════════════════════════════════════════════════
  // GENERAR REPORTE FINAL
  // ══════════════════════════════════════════════════════════════════════
  reporte.fin = new Date().toISOString();
  const duracionSeg = ((new Date(reporte.fin) - new Date(reporte.inicio)) / 1000).toFixed(1);

  console.log('\n');
  console.log('╔' + '═'.repeat(60) + '╗');
  console.log('║        REPORTE FINAL — QA E2E CONTROL PERSONAL CAMPO       ║');
  console.log('╠' + '═'.repeat(60) + '╣');
  console.log(`║  Inicio:       ${reporte.inicio.replace('T', ' ').substring(0, 19)}${' '.repeat(17)}║`);
  console.log(`║  Fin:          ${reporte.fin.replace('T', ' ').substring(0, 19)}${' '.repeat(17)}║`);
  console.log(`║  Duración:     ${duracionSeg}s${' '.repeat(43 - duracionSeg.length)}║`);
  console.log('╠' + '═'.repeat(60) + '╣');
  console.log(`║  ✅ Pasados:    ${String(reporte.pasados).padEnd(5)} de ${reporte.totalChecks}${' '.repeat(40 - String(reporte.totalChecks).length)}║`);
  console.log(`║  ❌ Fallidos:   ${String(reporte.fallidos).padEnd(45)}║`);
  console.log(`║  ⚠️  Advertencias: ${String(reporte.advertencias).padEnd(41)}║`);
  console.log('╠' + '═'.repeat(60) + '╣');

  const porcentaje = reporte.totalChecks > 0
    ? Math.round((reporte.pasados / reporte.totalChecks) * 100)
    : 0;
  const resultado  = reporte.fallidos === 0 ? '✅ EXITOSO' : '❌ CON FALLOS';

  console.log(`║  Resultado:    ${resultado}${' '.repeat(44 - resultado.length)}║`);
  console.log(`║  Cobertura:    ${porcentaje}%${' '.repeat(43 - String(porcentaje).length)}║`);
  console.log('╚' + '═'.repeat(60) + '╝');

  if (reporte.fallidos > 0) {
    console.log('\n❌ CHECKS FALLIDOS:');
    reporte.pasos
      .filter(p => p.estado === 'FAIL')
      .forEach(p => console.log(`   • ${p.descripcion}`));
  }

  if (reporte.advertencias > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    reporte.pasos
      .filter(p => p.estado === 'WARN')
      .forEach(p => console.log(`   • ${p.descripcion}`));
  }

  console.log(`\n📸 Screenshots guardados en: ${DIR}/`);
  console.log(`   Total screenshots: ${screenshotCounter}`);

  // Guardar reporte JSON
  fs.writeFileSync(
    `${DIR}/reporte-e2e.json`,
    JSON.stringify(reporte, null, 2),
    'utf-8'
  );
  console.log(`📄 Reporte JSON: ${DIR}/reporte-e2e.json\n`);

  if (reporte.fallidos > 0) process.exit(1);
})().catch(e => {
  console.error('Error fatal:', e.message);
  process.exit(1);
});
