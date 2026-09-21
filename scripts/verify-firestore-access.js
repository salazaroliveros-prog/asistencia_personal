/**
 * CONTROL PERSONAL CAMPO — scripts/verify-firestore-access.js
 * Verifica el acceso real a Firestore con las credenciales del operador.
 *
 * Se ejecuta contra el proyecto de PRODUCCIÓN y limpia lo que crea. Comprueba:
 *   1. Login email + password (credenciales de .env.local)
 *   2. Lectura autenticada de `personal`
 *   3. Escritura de una MARCADIÓN en `asistencias`   (flujo del escáner)
 *   4. Escritura de un TRABAJADOR en `personal`      (gestión de personal)
 *   5. Lectura anónima denegada                      (las reglas se aplican)
 *   6. Limpieza de los documentos de prueba
 *
 * Sirve para detectar fallos de reglas que en la app sólo se ven como un
 * `permission-denied` genérico.
 *
 * Uso: node scripts/verify-firestore-access.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOC_ASISTENCIA = 'RULES-VERIFY-ASISTENCIA';
const DOC_TRABAJADOR = 'RULES-VERIFY-TRABAJADOR';
const resultados = [];

/**
 * Lee `.env.local` y devuelve un mapa de variables.
 * @returns {Object} Variables de entorno del proyecto
 */
function readEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) throw new Error('No existe .env.local');
  const env = {};
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
    if (m) env[m[1]] = m[2];
  });
  return env;
}

function ok(nombre, extra = '') { resultados.push(true); console.log('✔', nombre, extra); }
function fail(nombre, extra = '') { resultados.push(false); console.log('✖', nombre, extra); }

/** Imprime el resumen final y ajusta el código de salida. */
function resumen() {
  const total = resultados.length;
  const passed = resultados.filter(Boolean).length;
  console.log('');
  console.log(`RESULTADO: ${passed}/${total} comprobaciones OK`);
  if (passed !== total) process.exitCode = 1;
}

/** Documento de prueba válido según isValidAttendanceData() de firestore.rules. */
const MARCADION_PRUEBA = {
  fields: {
    ID_Marcacion:      { stringValue: DOC_ASISTENCIA },
    ID_Registro:       { stringValue: DOC_ASISTENCIA },
    ID_Trabajador:     { stringValue: DOC_TRABAJADOR },
    Nombre_Trabajador: { stringValue: 'Verificacion de reglas' },
    Fecha:             { stringValue: '1900-01-01' }, // fuera de rango: no aparece en el feed
    Tipo_Marcacion:    { stringValue: 'Entrada' },
    Hora_Real:         { stringValue: '00:00' },
    Estado_Marcacion:  { stringValue: 'Puntual' },
    Timestamp:         { integerValue: '1' },
  },
};

/** Documento de prueba válido según isValidWorkerData() de firestore.rules. */
const TRABAJADOR_PRUEBA = {
  fields: {
    ID_Trabajador:   { stringValue: DOC_TRABAJADOR },
    Nombre_Completo: { stringValue: 'Verificacion De Reglas' },
    DPI_CUI:         { stringValue: '1234567890101' },
    Puesto:          { stringValue: 'Albañil' },
    Estado:          { stringValue: 'Activo' },
    Fecha_Registro:  { stringValue: '2026-09-21T00:00:00Z' },
    Telefono:        { stringValue: '' },
    WhatsApp:        { stringValue: '' },
    Direccion:       { stringValue: '' },
  },
};

async function main() {
  const env = readEnvLocal();
  const {
    EMAIL: email, PASWORD: password,
    VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_PROJECT_ID: projectId,
  } = env;
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  console.log('Proyecto:', projectId);
  console.log('Operador:', email);
  console.log('');

  // 1) Login
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const auth = await authRes.json();
  if (authRes.status !== 200) {
    fail('1. Login', auth?.error?.message);
    resumen();
    return;
  }
  const H = { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' };
  const claims = JSON.parse(Buffer.from(auth.idToken.split('.')[1], 'base64url').toString('utf8'));
  ok('1. Login email+password', `(uid ${auth.localId}, admin=${claims.admin === true})`);

  // 2) Lectura autenticada
  const readRes = await fetch(`${base}/personal?pageSize=1`, { headers: H });
  if (readRes.status === 200) ok('2. Lectura autenticada de `personal`');
  else fail('2. Lectura autenticada de `personal`', readRes.status);

  // 3) Marcación en `asistencias`
  const wr1 = await fetch(`${base}/asistencias/${DOC_ASISTENCIA}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(MARCADION_PRUEBA),
  });
  if (wr1.status === 200) {
    ok('3. Escritura de MARCADIÓN en `asistencias`');
  } else {
    fail('3. Escritura de MARCADIÓN en `asistencias`',
      wr1.status + ' ' + JSON.stringify(await wr1.json()).slice(0, 200));
  }

  // 4) Trabajador en `personal`
  const wr2 = await fetch(`${base}/personal/${DOC_TRABAJADOR}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(TRABAJADOR_PRUEBA),
  });
  if (wr2.status === 200) {
    ok('4. Escritura de TRABAJADOR en `personal`');
  } else {
    fail('4. Escritura de TRABAJADOR en `personal`',
      wr2.status + ' ' + JSON.stringify(await wr2.json()).slice(0, 200));
  }

  // 5) Lectura anónima: debe estar denegada
  const anon = await fetch(`${base}/personal?pageSize=1`);
  if (anon.status === 403) ok('5. Lectura anónima denegada (403) — reglas activas');
  else fail('5. Lectura anónima NO denegada', anon.status);

  // 6) Limpieza
  const d1 = await fetch(`${base}/asistencias/${DOC_ASISTENCIA}`, { method: 'DELETE', headers: H });
  const d2 = await fetch(`${base}/personal/${DOC_TRABAJADOR}`, { method: 'DELETE', headers: H });
  if (d1.status === 200 && d2.status === 200) {
    ok('6. Limpieza de documentos de prueba');
  } else {
    fail('6. Limpieza de documentos de prueba', `asistencias=${d1.status} personal=${d2.status}`);
  }

  resumen();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});


