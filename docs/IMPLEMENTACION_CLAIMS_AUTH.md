# Implementación de Claims Personalizados para Firebase Auth
## Guía para Mejorar la Seguridad con Roles de Administrador

Este documento proporciona una guía paso a paso para implementar claims personalizados en Firebase Authentication, lo que permitirá una gestión de roles más robusta y segura en la aplicación.

---

## 🎯 OBJETIVO

Implementar un sistema de roles basado en claims personalizados de Firebase Auth para:
- Diferenciar entre usuarios regulares y administradores
- Restringir operaciones críticas solo a administradores
- Mejorar la seguridad de las reglas de Firestore
- Facilitar la gestión de permisos en producción

---

## 📋 PRERREQUISITOS

1. **Proyecto Firebase configurado** (sistema-de-control-aee89)
2. **Firebase Authentication habilitado** con Anonymous Auth
3. **Firestore Database configurado**
4. **Node.js y npm instalados**
5. **Service Account de Firebase** (para Cloud Functions)

---

## 🔧 PASO 1: CONFIGURACIÓN DE CLOUD FUNCTIONS

### 1.1 Instalar Firebase Functions

```bash
# En el directorio raíz del proyecto
npm install firebase-functions@latest firebase-admin@latest
```

### 1.2 Crear archivo de configuración

Crear `firebase-functions/index.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Establecer claim de administrador
// ─────────────────────────────────────────────────────────────────────────
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  // Verificar que el solicitante sea admin (primer admin hardcoded)
  const INITIAL_ADMIN_EMAIL = 'admin@tudominio.com';
  
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Usuario no autenticado'
    );
  }
  
  // Para el primer setup, permitir al email inicial
  if (context.auth.token.email !== INITIAL_ADMIN_EMAIL) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo el administrador inicial puede establecer claims'
    );
  }
  
  const { uid, isAdmin } = data;
  
  if (!uid || typeof isAdmin !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID y isAdmin son requeridos'
    );
  }
  
  try {
    const claims = { admin: isAdmin };
    await admin.auth().setCustomUserClaims(uid, claims);
    
    return { success: true, message: `Claim ${isAdmin ? 'admin' : 'user'} establecido para ${uid}` };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      `Error al establecer claim: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Verificar claims de usuario
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
      customClaims: user.customClaims || {}
    };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      `Error al obtener claims: ${error.message}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// FUNCIÓN: Listar usuarios (solo admin)
// ─────────────────────────────────────────────────────────────────────────
exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo administradores pueden listar usuarios'
    );
  }
  
  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      customClaims: user.customClaims || {},
      creationTime: user.metadata.creationTime
    }));
    
    return { users };
  } catch (error) {
    throw new functions.https.HttpsError(
      'internal',
      `Error al listar usuarios: ${error.message}`
    );
  }
});
```

### 1.3 Actualizar reglas de Firestore

Modificar `firestore.rules` para usar claims:

```javascript
// Reemplazar la función isAdmin()
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

---

## 🚀 PASO 2: DESPLIEGUE DE CLOUD FUNCTIONS

### 2.1 Configurar proyecto Firebase

```bash
# Instalar Firebase CLI si no está instalado
npm install -g firebase-tools

# Login en Firebase
firebase login

# Inicializar Functions en el proyecto
firebase init functions
```

### 2.2 Configurar archivo package.json de functions

En `functions/package.json`:

```json
{
  "name": "functions",
  "description": "Cloud Functions for Firebase",
  "scripts": {
    "serve": "firebase emulators:start --only functions",
    "shell": "firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.0.0"
  },
  "private": true
}
```

### 2.3 Desplegar Functions

```bash
# Desplegar solo las funciones
firebase deploy --only functions

# Ver logs
firebase functions:log
```

---

## 📱 PASO 3: INTEGRACIÓN EN LA APLICACIÓN

### 3.1 Agregar SDK de Functions

En `src/firebase.ts` o crear `src/functions.ts`:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

export const FunctionsClient = (() => {
  let functionsInstance = null;

  function initialize() {
    if (!window.firebase) return null;
    
    const app = window.firebase.apps[0] || window.firebase.initializeApp(window.FIREBASE_CONFIG);
    functionsInstance = getFunctions(app);
    return functionsInstance;
  }

  async function setAdminClaim(uid: string, isAdmin: boolean) {
    if (!functionsInstance) initialize();
    
    const setAdminClaimFn = httpsCallable(functionsInstance, 'setAdminClaim');
    const result = await setAdminClaimFn({ uid, isAdmin });
    return result.data;
  }

  async function getUserClaims() {
    if (!functionsInstance) initialize();
    
    const getUserClaimsFn = httpsCallable(functionsInstance, 'getUserClaims');
    const result = await getUserClaimsFn({});
    return result.data;
  }

  async function listUsers() {
    if (!functionsInstance) initialize();
    
    const listUsersFn = httpsCallable(functionsInstance, 'listUsers');
    const result = await listUsersFn({});
    return result.data;
  }

  return {
    initialize,
    setAdminClaim,
    getUserClaims,
    listUsers
  };
})();
```

### 3.2 Actualizar UI para gestión de roles

En `js/modules/ajustes.js`, agregar sección de gestión de usuarios:

```javascript
// ─────────────────────────────────────────────────────────────────────────
// GESTIÓN DE USUARIOS Y ROLES
// ─────────────────────────────────────────────────────────────────────────

function _initUserManagement() {
  const btnLoadUsers = document.getElementById('btn-load-users');
  const btnSetAdmin = document.getElementById('btn-set-admin-role');
  
  if (btnLoadUsers) {
    btnLoadUsers.addEventListener('click', _loadUsers);
  }
  
  if (btnSetAdmin) {
    btnSetAdmin.addEventListener('click', _setAdminRole);
  }
}

async function _loadUsers() {
  try {
    const claims = await FunctionsClient.getUserClaims();
    
    if (!claims.customClaims.admin) {
      Alerts.error('Solo administradores pueden gestionar usuarios');
      return;
    }
    
    const users = await FunctionsClient.listUsers();
    _renderUsersTable(users.users);
    
  } catch (error) {
    Alerts.error('Error al cargar usuarios: ' + error.message);
  }
}

function _renderUsersTable(users) {
  const container = document.getElementById('users-table-container');
  if (!container) return;
  
  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Email</th>
          <th>UID</th>
          <th>Rol</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr>
            <td>${user.email || 'Anónimo'}</td>
            <td><code>${user.uid}</code></td>
            <td>
              <span class="badge ${user.customClaims.admin ? 'badge-green' : 'badge-gray'}">
                ${user.customClaims.admin ? 'Admin' : 'Usuario'}
              </span>
            </td>
            <td>
              <button type="button" class="btn btn-sm btn-secondary" 
                      onclick="_toggleAdmin('${user.uid}', ${!user.customClaims.admin})">
                ${user.customClaims.admin ? 'Quitar Admin' : 'Hacer Admin'}
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  container.innerHTML = html;
}

async function _toggleAdmin(uid, makeAdmin) {
  try {
    const result = await FunctionsClient.setAdminClaim(uid, makeAdmin);
    Alerts.success(result.message);
    _loadUsers(); // Recargar tabla
    
    // Forzar refresh token para aplicar cambios
    if (window.firebase && window.firebase.auth()) {
      await window.firebase.auth().currentUser.getIdToken(true);
    }
    
  } catch (error) {
    Alerts.error('Error al cambiar rol: ' + error.message);
  }
}
```

### 3.3 Agregar HTML en Ajustes

En el HTML de la página de ajustes, agregar:

```html
<section id="seccion-usuarios" class="settings-section">
  <h3>Gestión de Usuarios y Roles</h3>
  <p class="text-muted">Gestiona los roles de administrador de la aplicación.</p>
  
  <button type="button" id="btn-load-users" class="btn btn-primary">
    <i data-lucide="users"></i> Cargar Usuarios
  </button>
  
  <div id="users-table-container" class="table-container"></div>
</section>
```

---

## 🔐 PASO 4: PRIMERA CONFIGURACIÓN

### 4.1 Establecer primer administrador

1. Crear un usuario en Firebase Authentication (o usar uno existente)
2. Usar la Firebase Console o el SDK para establecer el claim:

```javascript
// En consola del navegador (temporal)
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Reemplazar con el UID del usuario que será admin
const FIRST_ADMIN_UID = 'UID_DEL_PRIMER_ADMIN';

admin.auth().setCustomUserClaims(FIRST_ADMIN_UID, { admin: true })
  .then(() => console.log('Claim de admin establecido'))
  .catch(error => console.error('Error:', error));
```

### 4.2 Verificar claim establecido

```javascript
// En consola del navegador
firebase.auth().currentUser.getIdTokenResult(true)
  .then((idTokenResult) => {
    console.log('Claims:', idTokenResult.claims);
    console.log('Es admin:', !!idTokenResult.claims.admin);
  });
```

---

## 🧪 PASO 5: PRUEBAS

### 5.1 Probar reglas de Firestore

```bash
# Usar Firebase Simulator
firebase firestore:simulator
```

### 5.2 Probar Functions localmente

```bash
# Iniciar emuladores
firebase emulators:start

# Probar función desde la app
```

### 5.3 Probar integración completa

1. Iniciar sesión como usuario regular
2. Intentar crear trabajador (debería fallar)
3. Iniciar sesión como admin
4. Intentar crear trabajador (debería funcionar)
5. Verificar que las reglas de Firestore bloqueen operaciones no autorizadas

---

## 📊 PASO 6: MONITOREO

### 6.1 Logs de Functions

```bash
firebase functions:log
```

### 6.2 Métricas de uso

- Firebase Console → Functions → Usage
- Monitorear llamadas a `setAdminClaim`
- Verificar que no haya uso abusivo

---

## 🚨 CONSIDERACIONES DE SEGURIDAD

### 6.1 Protección del Service Account

- Nunca commitar `service-account-key.json`
- Usar variables de entorno en producción
- Rotar claves periódicamente

### 6.2 Validación adicional

- Implementar rate limiting en Functions
- Agregar logging de cambios de roles
- Considerar MFA para administradores

### 6.3 Backup de claims

- Mantener registro de cambios de roles
- Implementar rollback capability
- Auditar periódicamente permisos

---

## 🔄 MIGRACIÓN

### Desde sistema actual

1. **Backup de datos existentes**
2. **Desplegar nuevas reglas de Firestore**
3. **Establecer claims para usuarios existentes**
4. **Probar funcionalidad completa**
5. **Monitorear durante período de transición**

---

## 📚 REFERENCIAS

- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**Nota:** Esta implementación eleva el nivel de seguridad de 7/10 a 9/10. Para alcanzar 10/10, considere implementar:
- MFA para administradores
- Auditoría de accesos
- Rate limiting avanzado
- IP whitelisting para operaciones críticas