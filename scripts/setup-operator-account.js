/**
 * CONTROL PERSONAL CAMPO — scripts/setup-operator-account.js
 * Crea (o comprueba) la cuenta del operador de campo en Firebase Auth.
 *
 * Lee las credenciales desde `.env.local` (gitignored) para no duplicar
 * secretos en el repositorio. Usa la API pública de Identity Toolkit con la
 * misma API key web que consume la app.
 *
 * Uso: node scripts/setup-operator-account.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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

/**
 * Llama a un endpoint de Identity Toolkit.
 * @param {string} endpoint - Nombre del endpoint (signUp, signInWithPassword…)
 * @param {string} apiKey - API key web del proyecto
 * @param {Object} payload - Cuerpo de la petición
 * @returns {Promise<{status: number, body: Object}>} Respuesta cruda
 */
async function identityToolkit(endpoint, apiKey, payload) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return { status: res.status, body: await res.json() };
}

async function main() {
  const env = readEnvLocal();
  const email = env.EMAIL;
  const password = env.PASWORD;
  const apiKey = env.VITE_FIREBASE_API_KEY;

  if (!email || !password || !apiKey) {
    throw new Error('Faltan EMAIL, PASWORD o VITE_FIREBASE_API_KEY en .env.local');
  }

  console.log('Proyecto :', env.VITE_FIREBASE_PROJECT_ID);
  console.log('Operador :', email);
  console.log('');

  // 1) Crear la cuenta (si ya existe, se informa y se continúa).
  const signUp = await identityToolkit('signUp', apiKey, {
    email,
    password,
    returnSecureToken: true,
  });

  if (signUp.status === 200) {
    console.log('✔ Cuenta CREADA en Firebase Auth');
  } else if (signUp.body?.error?.message === 'EMAIL_EXISTS') {
    console.log('ℹ La cuenta ya existía (EMAIL_EXISTS)');
  } else {
    console.log('✖ signUp falló:', signUp.body?.error?.message || signUp.status);
    if (signUp.body?.error?.message === 'OPERATION_NOT_ALLOWED') {
      console.log('  → Habilita Email/Password en Firebase Console → Authentication → Sign-in method');
    }
    process.exitCode = 1;
    return;
  }

  // 2) Iniciar sesión para comprobar que las credenciales son válidas.
  const signIn = await identityToolkit('signInWithPassword', apiKey, {
    email,
    password,
    returnSecureToken: true,
  });

  if (signIn.status !== 200) {
    console.log('✖ signIn falló:', signIn.body?.error?.message || signIn.status);
    process.exitCode = 1;
    return;
  }
  console.log('✔ Login email+password VERIFICADO con las credenciales de .env.local');
  console.log('   uid:', signIn.body.localId);

  // 3) Enviar el correo de verificación (best-effort, no bloquea el acceso).
  const oob = await identityToolkit('sendOobCode', apiKey, {
    requestType: 'VERIFY_EMAIL',
    idToken: signIn.body.idToken,
  });
  console.log(
    oob.status === 200
      ? `✉ Correo de verificación enviado a ${email}`
      : `ℹ No se pudo enviar el correo de verificación: ${oob.body?.error?.message || oob.status}`,
  );
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});
