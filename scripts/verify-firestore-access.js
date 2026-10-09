/**
 * CONTROL PERSONAL CAMPO — scripts/verify-firestore-access.js
 * Verifica el acceso real a Firestore con las credenciales del operador.
 *
 * MODELO SAAS: los datos viven en subcollecciones bajo users/{userId}/
 *   - users/{userId}/personal/{workerId}
 *   - users/{userId}/asistencias/{attendanceId}
 *
 * Comprueba:
 *   1. Login email + password
 *   2. Lectura autenticada de users/{uid}/personal
 *   3. Escritura de MARCACIÓN en users/{uid}/asistencias
 *   4. Escritura de TRABAJADOR en users/{uid}/personal
 *   5. Lectura anónima denegada (reglas activas)
 *   6. Limpieza de los documentos de prueba
 *
 * Uso: node scripts/verify-firestore-access.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '..');
const DOC_ASISTENCIA = 'RULES-VERIFY-ASISTENCIA';
const DOC_TRABAJADOR = 'RULES-VERIFY-TRABAJADOR';
const resultados     = [];

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

function ok(nombre, extra = '')   { resultados.push(true);  console.log('✔', nombre, extra); }
function fail(nombre, extra = '') { resultados.push(false); console.log('✖', nombre, extra); }

function resumen() {
  const total  = resultados.length;
  const passed = resultados.filter(Boolean).length;
  console.log('');
  console.log(`RESULTADO: ${passed}/${total} comprobaciones OK`);
  if (passed !== total) process.exitCode = 1;
}

async function main() {
  const env = readEnvLocal();

  // Acepta EMAIL/PASWORD (legado) o VITE_SMTP_USER/VITE_SMTP_PASSWORD
  const email    = env.EMAIL    || env.VITE_SMTP_USER;
  const password = env.PASWORD  || env.PASSWORD || env.VITE_SMTP_PASSWORD;
  const apiKey   = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  if (!email || !password || !apiKey || !projectId) {
    throw new Error('Faltan credenciales en .env.local (VITE_SMTP_USER, VITE_SMTP_PASSWORD, VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID)');
  }

  const fsBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  console.log('Proyecto:', projectId);
  console.log('Operador:', email);
  console.log('');

  // ── 1. Login ──────────────────────────────────────────────────────────────
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const auth = await authRes.json();
  if (authRes.status !== 200) {
    fail('1. Login', auth?.error?.message);
    resumen();
    return;
  }

  const uid    = auth.localId;
  const claims = JSON.parse(Buffer.from(auth.idToken.split('.')[1], 'base64url').toString('utf8'));
  const H      = { Authorization: `Bearer ${auth.idToken}`, 'Content-Type': 'application/json' };

  ok('1. Login email+password', `(uid ${uid}, admin=${claims.admin === true})`);

  // Rutas SaaS correctas
  const userBase       = `${fsBase}/users/${uid}`;
  const personalPath   = `${userBase}/personal`;
  const asistenciasPath = `${userBase}/asistencias`;

  // ── 2. Lectura autenticada ─────────────────────────────────────────────────
  const readRes = await fetch(`${personalPath}?pageSize=1`, { headers: H });
  if (readRes.status === 200) {
    ok('2. Lectura autenticada de `users/{uid}/personal`');
  } else {
    fail('2. Lectura autenticada de `users/{uid}/personal`', `${readRes.status}`);
  }

  // ── 3. Escritura de MARCACIÓN ─────────────────────────────────────────────
  const marcacion = {
    fields: {
      ID_Marcacion:      { stringValue: DOC_ASISTENCIA },
      ID_Registro:       { stringValue: DOC_ASISTENCIA },
      ID_Trabajador:     { stringValue: DOC_TRABAJADOR },
      Nombre_Trabajador: { stringValue: 'Verificacion de reglas' },
      Fecha:             { stringValue: '1900-01-01' },
      Tipo_Marcacion:    { stringValue: 'Entrada' },
      Hora_Real:         { stringValue: '00:00' },
      Estado_Marcacion:  { stringValue: 'Puntual' },
      Timestamp:         { integerValue: String(Date.now()) },
      // Campos opcionales requeridos por la validación de reglas
      Horas_Extra:       { nullValue: null },
      GPS_Latitud:       { nullValue: null },
      GPS_Longitud:      { nullValue: null },
      GPS_Accuracy:      { nullValue: null },
    },
  };
  const wr1 = await fetch(`${asistenciasPath}/${DOC_ASISTENCIA}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(marcacion),
  });
  if (wr1.status === 200) {
    ok('3. Escritura de MARCACIÓN en `users/{uid}/asistencias`');
  } else {
    const body = await wr1.json().catch(() => ({}));
    fail('3. Escritura de MARCACIÓN', `${wr1.status} ${JSON.stringify(body).slice(0, 200)}`);
  }

  // ── 4. Escritura de TRABAJADOR ────────────────────────────────────────────
  const trabajador = {
    fields: {
      ID_Trabajador:   { stringValue: DOC_TRABAJADOR },
      Nombre_Completo: { stringValue: 'Verificacion De Reglas' },
      DPI_CUI:         { stringValue: '1234567890101' },
      Puesto:          { stringValue: 'Albanil' },
      Estado:          { stringValue: 'Activo' },
      Fecha_Registro:  { stringValue: '2026-09-21T00:00:00Z' },
      Telefono:        { stringValue: '' },
      WhatsApp:        { stringValue: '' },
      Direccion:       { stringValue: '' },
    },
  };
  const wr2 = await fetch(`${personalPath}/${DOC_TRABAJADOR}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(trabajador),
  });
  if (wr2.status === 200) {
    ok('4. Escritura de TRABAJADOR en `users/{uid}/personal`');
  } else {
    const body = await wr2.json().catch(() => ({}));
    fail('4. Escritura de TRABAJADOR', `${wr2.status} ${JSON.stringify(body).slice(0, 200)}`);
  }

  // ── 5. Lectura anónima denegada ────────────────────────────────────────────
  const anon = await fetch(`${personalPath}?pageSize=1`);
  if (anon.status === 403) {
    ok('5. Lectura anónima denegada (403) — reglas activas');
  } else {
    fail('5. Lectura anónima NO denegada', `${anon.status}`);
  }

  // ── 6. Limpieza ────────────────────────────────────────────────────────────
  const d1 = await fetch(`${asistenciasPath}/${DOC_ASISTENCIA}`, { method: 'DELETE', headers: H });
  const d2 = await fetch(`${personalPath}/${DOC_TRABAJADOR}`,    { method: 'DELETE', headers: H });
  if (d1.status === 200 && d2.status === 200) {
    ok('6. Limpieza de documentos de prueba');
  } else {
    fail('6. Limpieza', `asistencias=${d1.status} personal=${d2.status}`);
  }

  resumen();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});
