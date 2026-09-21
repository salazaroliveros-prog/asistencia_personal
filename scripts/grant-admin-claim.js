/**
 * CONTROL PERSONAL CAMPO — scripts/grant-admin-claim.js
 * Asigna los custom claims `admin`, `manager` y `supervisor` a una cuenta.
 *
 * `firestore.rules` exige esos claims para escribir en `personal` (alta y
 * edición de trabajadores), `configuracion` y `alertas`, y para leer `logs`.
 * Sin ellos la app puede marcar asistencia pero NO puede gestionar personal:
 * cada guardado falla con `permission-denied`.
 *
 * Usa la sesión ya autenticada de firebase-tools, de modo que no hace falta
 * una clave de servicio ni abrir la consola.
 *
 * Uso: node scripts/grant-admin-claim.js [correo]
 *      (sin argumento usa el EMAIL de .env.local)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'sistema-de-control-aee89';

// Client OAuth público de firebase-tools (no es un secreto del proyecto).
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

/**
 * Lee `.env.local` y devuelve un mapa de variables.
 * @returns {Object} Variables de entorno del proyecto
 */
function readEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return {};
  const env = {};
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
    if (m) env[m[1]] = m[2];
  });
  return env;
}

/**
 * Obtiene un token OAuth a partir del refresh token que guarda firebase-tools.
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  const candidates = [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ];
  const cfgPath = candidates.find((p) => p && fs.existsSync(p));
  if (!cfgPath) throw new Error('No se encontró la config de firebase-tools');
  const refresh = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))?.tokens?.refresh_token;
  if (!refresh) throw new Error('No hay refresh_token (ejecuta firebase login)');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error('Token: ' + (body.error_description || body.error));
  return body.access_token;
}

async function main() {
  const env = readEnvLocal();
  const email = process.argv[2] || env.EMAIL;
  if (!email) throw new Error('Indica un correo o define EMAIL en .env.local');

  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Resolver el uid a partir del correo
  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    { method: 'POST', headers, body: JSON.stringify({ email: [email] }) },
  ).then((r) => r.json());

  const localId = lookup?.users?.[0]?.localId;
  if (!localId) throw new Error('No se encontró la cuenta: ' + JSON.stringify(lookup).slice(0, 200));
  console.log('Cuenta:', email, '| uid:', localId);

  const claims = { admin: true, manager: true, supervisor: true };
  const updRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`,
    { method: 'POST', headers, body: JSON.stringify({ localId, customAttributes: JSON.stringify(claims) }) },
  );
  if (!updRes.ok) {
    throw new Error('accounts:update: ' + JSON.stringify(await updRes.json()).slice(0, 300));
  }
  console.log('✔ Claims asignados:', JSON.stringify(claims));
  console.log('ℹ El usuario debe volver a iniciar sesión para recibir los claims en su token.');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});
