const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────

// Email del primer administrador (para setup inicial)
// Este usuario será el único que pueda establecer claims de admin inicialmente
const INITIAL_ADMIN_EMAIL = functions.config().initial_admin?.email || 'admin@tudominio.com';

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Establecer claim de administrador
// ─────────────────────────────────────────────────────────────────────────
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  // Verificar que el solicitante sea admin o el admin inicial
  const requesterClaims = context.auth.token;
  const isRequesterAdmin = requesterClaims.admin === true;
  const isInitialAdmin = requesterClaims.email === INITIAL_ADMIN_EMAIL;
  
  if (!isRequesterAdmin && !isInitialAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden establecer claims de admin'
    );
  }
  
  const { uid, isAdmin: makeAdmin } = data;
  
  if (!uid || typeof makeAdmin !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID y isAdmin son requeridos'
    );
  }
  
  try {
    const claims = { admin: makeAdmin };
    await admin.auth().setCustomUserClaims(uid, claims);
    
    // Log del cambio para auditoría
    console.log(`Admin claim ${makeAdmin ? 'granted' : 'revoked'} for user ${uid} by ${context.auth.uid}`);
    
    return { 
      success: true, 
      message: `Claim ${makeAdmin ? 'admin' : 'user'} establecido para ${uid}`,
      uid,
      admin: makeAdmin
    };
  } catch (error) {
    console.error('Error setting admin claim:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error al establecer claim: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Verificar claims de usuario actual
// ─────────────────────────────────────────────────────────────────────────
exports.getUserClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  try {
    const user = await admin.auth().getUser(context.auth.uid);
    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      customClaims: user.customClaims || {},
      isAdmin: !!(user.customClaims && user.customClaims.admin)
    };
  } catch (error) {
    console.error('Error getting user claims:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error al obtener claims: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Listar usuarios (solo administradores)
// ─────────────────────────────────────────────────────────────────────────
exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  // Verificar que sea admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden listar usuarios'
    );
  }
  
  try {
    const listUsersResult = await admin.auth().listUsers(100); // Máximo 100 usuarios
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email || 'Anónimo',
      emailVerified: user.emailVerified,
      customClaims: user.customClaims || {},
      isAdmin: !!(user.customClaims && user.customClaims.admin),
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime
    }));
    
    console.log(`User list retrieved by admin ${context.auth.uid}: ${users.length} users`);
    
    return { users, total: users.length };
  } catch (error) {
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error al listar usuarios: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Obtener información de usuario específico (solo administradores)
// ─────────────────────────────────────────────────────────────────────────
exports.getUserInfo = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  // Verificar que sea admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden obtener información de usuarios'
    );
  }
  
  const { uid } = data;
  
  if (!uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID es requerido'
    );
  }
  
  try {
    const user = await admin.auth().getUser(uid);
    return {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      photoURL: user.photoURL,
      customClaims: user.customClaims || {},
      isAdmin: !!(user.customClaims && user.customClaims.admin),
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime,
      providerData: user.providerData.map(provider => ({
        providerId: provider.providerId,
        uid: provider.uid,
        displayName: provider.displayName,
        email: provider.email
      }))
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error al obtener información del usuario: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Crear usuario (solo administradores)
// ─────────────────────────────────────────────────────────────────────────
exports.createUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  // Verificar que sea admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden crear usuarios'
    );
  }
  
  const { email, password, displayName, isAdmin: makeAdmin = false } = data;
  
  if (!email || !password) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email y password son requeridos'
    );
  }
  
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: false
    });
    
    // Establecer claim de admin si se solicita
    if (makeAdmin) {
      await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
    }
    
    console.log(`User created by admin ${context.auth.uid}: ${userRecord.uid}, admin: ${makeAdmin}`);
    
    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      isAdmin: makeAdmin
    };
  } catch (error) {
    console.error('Error creating user:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error al crear usuario: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Eliminar usuario (solo administradores)
// ─────────────────────────────────────────────────────────────────────────
exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  // Verificar que sea admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden eliminar usuarios'
    );
  }
  
  const { uid } = data;
  
  if (!uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID es requerido'
    );
  }
  
  // Prevenir que un admin se elimine a sí mismo
  if (uid === context.auth.uid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No puedes eliminar tu propio usuario'
    );
  }
  
  try {
    await admin.auth().deleteUser(uid);
    console.log(`User deleted by admin ${context.auth.uid}: ${uid}`);
    
    return { success: true, uid };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error al eliminar usuario: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Health check para monitoreo
// ─────────────────────────────────────────────────────────────────────────
exports.healthCheck = functions.https.onRequest(async (req, res) => {
  try {
    // Verificar conexión a Firebase Admin
    const listUsers = await admin.auth().listUsers(1);
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      firebase: 'connected',
      functions: 'active'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});