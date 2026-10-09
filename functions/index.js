/**
 * CONTROL PERSONAL CAMPO — functions/index.js
 * Cloud Functions: gestión de claims, usuarios, SMTP y health-check.
 *
 * Configuración por variables de entorno (process.env) en lugar del API
 * deprecated functions.config(). Para desarrollo local, crea el archivo
 * functions/.env con el contenido de functions/.env.example.
 * @version 1.5.0
 */

'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN — leída de variables de entorno
// Despliegue: firebase functions:secrets:set o definidas en .env en functions/
// ─────────────────────────────────────────────────────────────────────────

/**
 * Email del primer administrador.
 * Se lee de la variable de entorno INITIAL_ADMIN_EMAIL inyectada en deploy.
 * Sin ella, solo usuarios con claim admin=true existente pueden conceder admin.
 */
const INITIAL_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || null;

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Construye un transporte Nodemailer a partir de la config SMTP recibida.
 * En producción rejectUnauthorized = true (verificación real del certificado).
 * @param {object} cfg
 * @returns {import('nodemailer').Transporter}
 */
function _buildTransport(cfg) {
  return nodemailer.createTransport({
    host:   cfg.host,
    port:   parseInt(cfg.port || '587', 10),
    secure: cfg.secure === true || cfg.secure === 'true' || Number(cfg.port) === 465,
    auth: {
      user: cfg.user,
      pass: cfg.password,
    },
    // En producción siempre validar el certificado TLS
    tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: setAdminClaim — asigna / revoca claim admin
// ─────────────────────────────────────────────────────────────────────────
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const requesterClaims = context.auth.token;
  const isRequesterAdmin = requesterClaims.admin === true;
  // El admin inicial puede auto-promoverte en el primer setup aunque email no esté verificado
  const isInitialAdmin = Boolean(INITIAL_ADMIN_EMAIL) &&
    requesterClaims.email === INITIAL_ADMIN_EMAIL;

  if (!isRequesterAdmin && !isInitialAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden establecer claims de admin',
    );
  }

  const { uid, isAdmin: makeAdmin } = data;
  if (!uid || typeof makeAdmin !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'UID y isAdmin son requeridos');
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { admin: makeAdmin });
    console.log(`[setAdminClaim] admin=${makeAdmin} → uid=${uid} by ${context.auth.uid}`);
    return {
      success: true,
      message: `Claim ${makeAdmin ? 'admin' : 'user'} establecido para ${uid}`,
      uid,
      admin: makeAdmin,
    };
  } catch (err) {
    console.error('[setAdminClaim] Error:', err);
    throw new functions.https.HttpsError('internal', `Error al establecer claim: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: getUserClaims — devuelve los claims del usuario actual
// ─────────────────────────────────────────────────────────────────────────
exports.getUserClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  try {
    const user = await admin.auth().getUser(context.auth.uid);
    return {
      uid:          user.uid,
      email:        user.email,
      emailVerified: user.emailVerified,
      customClaims: user.customClaims || {},
      isAdmin:      !!(user.customClaims && user.customClaims.admin),
    };
  } catch (err) {
    console.error('[getUserClaims] Error:', err);
    throw new functions.https.HttpsError('internal', `Error al obtener claims: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: listUsers — lista usuarios (solo admin)
// ─────────────────────────────────────────────────────────────────────────
exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden listar usuarios');
  }
  try {
    const result = await admin.auth().listUsers(100);
    const users = result.users.map((u) => ({
      uid:           u.uid,
      email:         u.email || 'Anónimo',
      emailVerified: u.emailVerified,
      customClaims:  u.customClaims || {},
      isAdmin:       !!(u.customClaims && u.customClaims.admin),
      creationTime:  u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
    }));
    console.log(`[listUsers] ${users.length} usuarios por admin ${context.auth.uid}`);
    return { users, total: users.length };
  } catch (err) {
    console.error('[listUsers] Error:', err);
    throw new functions.https.HttpsError('internal', `Error al listar usuarios: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: getUserInfo — info de un usuario específico (solo admin)
// ─────────────────────────────────────────────────────────────────────────
exports.getUserInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores');
  }
  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID es requerido');
  }
  try {
    const u = await admin.auth().getUser(uid);
    return {
      uid:           u.uid,
      email:         u.email,
      emailVerified: u.emailVerified,
      displayName:   u.displayName,
      photoURL:      u.photoURL,
      customClaims:  u.customClaims || {},
      isAdmin:       !!(u.customClaims && u.customClaims.admin),
      creationTime:  u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
      providerData:  u.providerData.map((p) => ({
        providerId:  p.providerId,
        uid:         p.uid,
        displayName: p.displayName,
        email:       p.email,
      })),
    };
  } catch (err) {
    console.error('[getUserInfo] Error:', err);
    throw new functions.https.HttpsError('internal', `Error: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: createUser — crea usuario (solo admin)
// ─────────────────────────────────────────────────────────────────────────
exports.createUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden crear usuarios');
  }
  const { email, password, displayName, isAdmin: makeAdmin = false } = data;
  if (!email || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Email y password son requeridos');
  }
  try {
    const userRecord = await admin.auth().createUser({ email, password, displayName, emailVerified: false });
    if (makeAdmin) {
      await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
    }
    console.log(`[createUser] uid=${userRecord.uid} admin=${makeAdmin} by ${context.auth.uid}`);
    return { success: true, uid: userRecord.uid, email: userRecord.email, displayName: userRecord.displayName, isAdmin: makeAdmin };
  } catch (err) {
    console.error('[createUser] Error:', err);
    throw new functions.https.HttpsError('internal', `Error al crear usuario: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: deleteUser — elimina usuario (solo admin)
// ─────────────────────────────────────────────────────────────────────────
exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden eliminar usuarios');
  }
  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID es requerido');
  }
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'No puedes eliminar tu propio usuario');
  }
  try {
    await admin.auth().deleteUser(uid);
    console.log(`[deleteUser] uid=${uid} by ${context.auth.uid}`);
    return { success: true, uid };
  } catch (err) {
    console.error('[deleteUser] Error:', err);
    throw new functions.https.HttpsError('internal', `Error al eliminar usuario: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: healthCheck — monitoreo (HTTP público)
// ─────────────────────────────────────────────────────────────────────────
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  try {
    await admin.auth().listUsers(1);
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString(), firebase: 'connected' });
  } catch (err) {
    console.error('[healthCheck] Error:', err);
    res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString(), error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: testSMTPConnection — prueba conexión SMTP
// ─────────────────────────────────────────────────────────────────────────
exports.testSMTPConnection = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  const { host, port, user, password, secure } = data;
  if (!host || !port || !user || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Host, puerto, usuario y contraseña son requeridos');
  }
  try {
    const transporter = _buildTransport({ host, port, user, password, secure });
    await transporter.verify();
    console.log(`[testSMTP] OK user=${user}`);
    return { success: true, message: 'Conexión SMTP exitosa', host, port, user };
  } catch (err) {
    console.error('[testSMTP] Error:', err);
    throw new functions.https.HttpsError('internal', `Error de conexión SMTP: ${err.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: sendEmail — envía correo usando config SMTP del cliente
// ─────────────────────────────────────────────────────────────────────────
exports.sendEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  const { smtpConfig, to, subject, text, html, from, fromName } = data;
  if (!smtpConfig || !to || !subject) {
    throw new functions.https.HttpsError('invalid-argument', 'Configuración SMTP, destinatario y asunto son requeridos');
  }
  try {
    const transporter = _buildTransport(smtpConfig);
    const fromAddr = from || smtpConfig.user;
    const info = await transporter.sendMail({
      from:    `"${fromName || 'Control Personal Campo'}" <${fromAddr}>`,
      to,
      subject,
      text:    text || '',
      html:    html || text || '',
    });
    console.log(`[sendEmail] OK to=${to} msgId=${info.messageId}`);
    return { success: true, messageId: info.messageId, to, subject };
  } catch (err) {
    console.error('[sendEmail] Error:', err);
    throw new functions.https.HttpsError('internal', `Error al enviar correo: ${err.message}`);
  }
});
