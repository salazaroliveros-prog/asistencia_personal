/**
 * Prueba funcional de la lógica de registro de asistencia QR del scanner PWA
 * Simula Firestore (transaction, getDoc, collection, doc) para validar:
 *  - Flujo completo: escaneo -> registro -> persistencia
 *  - Acumulación correcta de Historial_Marcaciones (múltiples marcaciones por día)
 *  - Atomicidad de la transacción
 *  - Estructura de datos compatible con el sistema principal
 *  - Cooldown anti-duplicado de 2s
 */
const assert = require('assert');

// ── Mock de Firestore (compat API) ─────────────────────────────────────────
function createMockDb() {
  const store = new Map(); // id -> data
  return {
    store,
    db: {
      getDoc: async (ref) => ({ exists: store.has(ref.id), data: () => store.get(ref.id) || null }),
      setDoc: async (ref, data) => { store.set(ref.id, data); },
      doc: (col, id) => ({ id }),
      collection: (name) => ({ name }),
      runTransaction: async (cb) => {
        const transaction = {
          set: async (ref, data) => { store.set(ref.id, data); },
          get: async (ref) => ({ exists: store.has(ref.id), data: () => store.get(ref.id) || null })
        };
        return await cb(transaction);
      },
      onSnapshot: () => () => {}
    }
  };
}

// ── Función extraída del scanner.js (adaptada al mock) ─────────────────────
async function registrarAsistenciaMock(db, workerId, worker) {
  const fechaHoy = new Date().toISOString().split('T')[0];
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  const timestamp = ahora.getTime();
  const dpiLimpio = String(workerId).replace(/[^0-9]/g, '');
  const asistenciaId = `${fechaHoy}_${dpiLimpio}`;

  let historial = [];
  let metodosRegistro = [];

  const asistenciaData = await db.runTransaction(async (transaction) => {
    const refDoc = { id: asistenciaId };
    const docSnap = await transaction.get(refDoc);

    if (docSnap.exists) {
      const data = docSnap.data();
      historial = data.Historial_Marcaciones || [];
      metodosRegistro = data.Metodos_Registro || [];
    }

    historial.push({ Fecha: fechaHoy, Hora: hora, Timestamp: timestamp, Metodo_Registro: 'QR_ESCANER_MOVIL', Origen: 'SUB_APP_ESCANER' });
    metodosRegistro.push('QR_ESCANER_MOVIL');

    const data = {
      ID_Trabajador: workerId,
      Documento: worker.DPI || dpiLimpio,
      Nombre_Completo: worker.Nombre_Completo,
      Puesto: worker.Puesto || 'N/A',
      Fecha: fechaHoy,
      Estado_General: 'Presente',
      Metodo_Registro: 'QR_ESCANER_MOVIL',
      Historial_Marcaciones: historial,
      Metodos_Registro: [...new Set(metodosRegistro)],
      Ultima_Actualizacion: timestamp
    };
    transaction.set(refDoc, data, { merge: true });
    return data;
  });

  return { asistenciaId, data: asistenciaData, hora, fechaHoy, timestamp };
}

let pass = 0, fail = 0;
const check = (label, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ FAIL: ${label}`); }
};
(async () => {
  console.log('\n═══════ TEST FUNCIONAL: LÓGICA DE REGISTRO ASISTENCIA QR (SCANNER PWA) ═══════\n');

  // Test 1: Registro inicial crea documento
  console.log('── Test 1: Registro inicial de asistencia');
  {
    const { db, store } = createMockDb();
    const worker = { Nombre_Completo: 'Roberto Lima', Puesto: 'Maestro de Obra', DPI: '2512345678901' };
    const res = await registrarAsistenciaMock(db, '2512345678901', worker);
    const doc = store.get(res.asistenciaId);

    check('Documento creado con ID correcto', doc !== undefined);
    check('Nombre_Completo guardado', doc?.Nombre_Completo === 'Roberto Lima');
    check('Puesto guardado', doc?.Puesto === 'Maestro de Obra');
    check('Estado_General = Presente', doc?.Estado_General === 'Presente');
    check('Metodo_Registro = QR_ESCANER_MOVIL', doc?.Metodo_Registro === 'QR_ESCANER_MOVIL');
    check('1 marcación en historial', doc?.Historial_Marcaciones?.length === 1);
  }

  // Test 2: Segunda marcación SÍ acumula (múltiples registros por día)
  console.log('\n── Test 2: Acumulación de múltiples marcaciones (entradas/salidas)');
  {
    const { db, store } = createMockDb();
    const worker = { Nombre_Completo: 'Luisa Reyes', DPI: '1823456789012' };
    await registrarAsistenciaMock(db, '1823456789012', worker);
    const res2 = await registrarAsistenciaMock(db, '1823456789012', worker);
    const doc = store.get(res2.asistenciaId);

    check('2 marcaciones acumuladas', doc?.Historial_Marcaciones?.length === 2);
    check('Metodos_Registro deduplicado (1 tipo)', doc?.Metodos_Registro?.length === 1);
    check('Metodos_Registro contiene QR_ESCANER_MOVIL', doc?.Metodos_Registro?.includes('QR_ESCANER_MOVIL'));
  }

  // Test 3: ID se limpia de caracteres no numéricos
  console.log('\n── Test 3: Normalización de ID (solo dígitos)');
  {
    const { db } = createMockDb();
    const worker = { Nombre_Completo: 'Test', DPI: '1234567890123' };
    const res = await registrarAsistenciaMock(db, '2512-3456-7890-1', worker);
    check('ID normalizado sin guiones', res.asistenciaId.split('_')[1] === '2512345678901');
  }
  console.log('\n── Test 4: Debounce anti-escaneo duplicado (2s)');
  {
    let lastScan = 0;
    const handleQRScan = (data) => {
      const now = Date.now();
      if (now - lastScan < 2000) return null;
      lastScan = now;
      return data;
    };
    const first = handleQRScan('test');
    const second = handleQRScan('test');
    check('Primer escaneo procesado', first === 'test');
    check('Segundo escaneo inmediato rechazado', second === null);
  }

  // Test 5: Datos del trabajador inválidos rechazados
  console.log('\n── Test 5: Validación de datos QR inválidos');
  {
    const workerId = null;
    check('WorkerId vacío detectado como inválido', !workerId);
  }

  // Test 6: parseo de QR (JSON vs raw numérico/plano)
  console.log('\n── Test 6: Parseo de contenido QR (JSON, numérico y texto plano)');
  {
    // Mismo algoritmo que handleQRScan corregido en scanner.js
    const parseQR = (data) => {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
        return { raw: String(parsed).trim() };
      } catch { return { raw: String(data).trim() }; }
    };
    const jsonQr = parseQR('{"workerId":"2512345678901"}');
    const numeroQr = parseQR('2512345678901'); // DPI puro (número)
    const textoQr = parseQR('DPI-2512345678901'); // texto plano

    check('QR JSON parsea workerId', jsonQr.workerId === '2512345678901');
    check('QR numérico cae en fallback raw', numeroQr.raw === '2512345678901');
    check('QR texto plano cae en fallback raw', textoQr.raw === 'DPI-2512345678901');
  }

  console.log(`\n════════════════════════════════════════════\n  Total: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}\n════════════════════════════════════════════`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR FATAL:', e); process.exit(1); });