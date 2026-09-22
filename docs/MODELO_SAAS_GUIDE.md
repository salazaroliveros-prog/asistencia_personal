# GUÍA DE IMPLEMENTACIÓN MODELO SAAS MULTI-TENANT

## 🎯 OBJETIVO

Transformar la aplicación en un sistema SaaS donde cualquier usuario con Gmail pueda autenticarse y tener sus propios datos aislados, sin necesidad de configuración manual de administradores.

---

## 🏗️ ARQUITECTURA MULTI-TENANT IMPLEMENTADA

### Estructura de Datos Firestore

```
users/{userId}/
├── personal/{workerId}          # Trabajadores del usuario
├── asistencias/{attendanceId}    # Marcaciones del usuario
├── configuracion/{configId}     # Configuración del usuario
├── alertas/{alertId}            # Alertas del usuario
└── logs/{logId}                # Logs de auditoría del usuario
```

### Reglas de Seguridad

- **Aislamiento por usuario:** Cada usuario solo puede acceder a sus propios datos
- **Sin roles complejos:** No se requieren custom claims de admin/manager
- **Auto-registro:** Cualquier usuario puede registrarse con Email/Password o Google
- **Seguridad:** `isOwner(userId)` garantiza que solo el dueño acceda a sus datos

---

## 🔧 MODIFICACIONES REALIZADAS

### 1. Reglas de Seguridad Firestore (`firestore.rules`)

**Cambio:** De roles complejos a aislamiento simple por usuario

```javascript
// Antes: Requería custom claims de admin/manager
function isAdmin() {
  return isAuthenticated() && request.auth.token.admin == true;
}

// Ahora: Simple aislamiento por usuario
function isOwner(userId) {
  return request.auth != null && request.auth.uid == userId;
}

// Estructura multi-tenant
match /users/{userId} {
  allow read, write: if isOwner(userId);
  
  match /personal/{workerId} {
    allow read, create, update, delete: if isOwner(userId);
  }
  // ... otras colecciones
}
```

### 2. FirebaseClient (`js/firebase-client.js`)

**Cambios:** Rutas multi-tenant automáticas

```javascript
// CRUD con rutas multi-tenant
async function save(collection, id, data, merge) {
  const user = auth?.currentUser;
  let docRef;
  
  if (user && ['personal', 'asistencias', 'configuracion', 'alertas', 'logs'].includes(collection)) {
    // Ruta multi-tenant: users/{userId}/{collection}/{id}
    docRef = db.collection('users').doc(user.uid).collection(collection).doc(id);
  } else {
    // Ruta tradicional para compatibilidad
    docRef = db.collection(collection).doc(id);
  }
  
  await docRef.set(data, { merge: !!merge });
}
```

**Nuevas funciones:**
- `registerUser(email, password, displayName)` - Registro automático
- `signInWithGoogle()` - Login con Google y auto-configuración

### 3. API (`js/api.js`)

**Cambio:** La función `guardarTrabajador` ya está corregida y compatible con el modelo multi-tenant

---

## 📱 MODIFICACIONES DE UI PENDIENTES

### 1. Pantalla de Bienvenida / Registro

Crear una pantalla inicial que ofrezca:

#### Opciones de Registro:
1. **"Registrarse con Gmail"** (Google Sign-In)
2. **"Registrarse con Email"** (Email/Password)
3. **"Continuar en modo local"** (Sin autenticación)

#### Flujo de Registro:
```
Usuario abre app → Pantalla de bienvenida
  ↓
Elige método de registro
  ↓
Completar registro
  ↓
Auto-configuración:
  - Crear documento usuario
  - Crear configuración inicial
  - Redirigir a Dashboard
```

### 2. Modificar Módulo de Ajustes

**Cambios necesarios:**

#### Antes (Configuración manual):
```html
<div class="auth-section">
  <h3>Configuración Firebase</h3>
  <input id="firebase-email" placeholder="Email administrador">
  <input id="firebase-password" placeholder="Contraseña">
  <button id="btn-login-firebase">Iniciar sesión</button>
</div>
```

#### Después (Auto-registro):
```html
<div class="auth-section">
  <h3>Autenticación y Sincronización</h3>
  
  <div id="auth-buttons">
    <button id="btn-google-login" class="btn-google">
      <i class="icon-google"></i> Continuar con Google
    </button>
    <button id="btn-email-login" class="btn-email">
      <i class="icon-email"></i> Iniciar sesión con Email
    </button>
  </div>
  
  <div id="auth-status" class="hidden">
    <div class="user-info">
      <span id="user-email"></span>
      <span id="user-display-name"></span>
    </div>
    <button id="btn-logout">Cerrar sesión</button>
  </div>
  
  <div class="auth-info">
    <p>🔒 Tus datos están aislados y seguros</p>
    <p>☁️ Sincronización automática cuando tengas conexión</p>
  </div>
</div>
```

### 3. Modal de Registro Email/Password

```html
<div id="modal-register" class="modal-overlay hidden">
  <div class="modal">
    <div class="modal-header">
      <h2>Crear Cuenta</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nombre Completo</label>
        <input type="text" id="reg-nombre" placeholder="Tu nombre">
      </div>
      <div class="form-group">
        <label>Correo Electrónico</label>
        <input type="email" id="reg-email" placeholder="tu@email.com">
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input type="password" id="reg-password" placeholder="Mínimo 6 caracteres">
      </div>
      <div class="form-group">
        <label>Confirmar Contraseña</label>
        <input type="password" id="reg-password-confirm" placeholder="Repite la contraseña">
      </div>
      <div class="form-actions">
        <button id="btn-cancel-register" class="btn-secondary">Cancelar</button>
        <button id="btn-submit-register" class="btn-primary">Registrarse</button>
      </div>
    </div>
  </div>
</div>
```

---

## 🔧 IMPLEMENTACIÓN DE UI

### Archivos a Modificar

#### 1. `index.html` - Agregar Scripts de Auth Firebase

```html
<!-- Agregar scripts de Auth de Firebase (versión modular) -->
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
  import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
  
  // Configuración Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg",
    authDomain: "sistema-de-control-aee89.firebaseapp.com",
    projectId: "sistema-de-control-aee89",
    storageBucket: "sistema-de-control-aee89.firebasestorage.app",
    messagingSenderId: "265655332442",
    appId: "1:265655332442:web:c4e8617741e3b916987263"
  };
  
  // Inicializar Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  
  // Hacer auth disponible globalmente
  window.firebaseAuth = auth;
  window.firebaseGoogleAuthProvider = GoogleAuthProvider;
</script>
```

#### 2. `js/modules/auth.js` - Nuevo módulo de autenticación

```javascript
/**
 * CONTROL PERSONAL CAMPO — modules/auth.js
 * Módulo de autenticación SaaS multi-tenant
 * @version 1.0.0
 */

const ModuloAuth = (() => {
  let _eventsBound = false;

  function init() {
    _bindEvents();
    _checkAuthState();
  }

  function _bindEvents() {
    if (_eventsBound) return;
    _eventsBound = true;

    // Botón Google Sign-In
    const btnGoogle = document.getElementById('btn-google-login');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', _handleGoogleLogin);
    }

    // Botón Email Login
    const btnEmail = document.getElementById('btn-email-login');
    if (btnEmail) {
      btnEmail.addEventListener('click', _showEmailModal);
    }

    // Botón Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', _handleLogout);
    }

    // Formulario de Registro
    const btnSubmitRegister = document.getElementById('btn-submit-register');
    if (btnSubmitRegister) {
      btnSubmitRegister.addEventListener('click', _handleRegister);
    }

    const btnCancelRegister = document.getElementById('btn-cancel-register');
    if (btnCancelRegister) {
      btnCancelRegister.addEventListener('click', _hideRegisterModal);
    }

    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        _hideRegisterModal();
      }
    });
  }

  function _checkAuthState() {
    if (window.firebaseAuth) {
      window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
          _showAuthenticatedState(user);
          _loadUserData(user);
        } else {
          _showUnauthenticatedState();
        }
      });
    }
  }

  async function _handleGoogleLogin() {
    try {
      const result = await window.FirebaseClient.signInWithGoogle();
      if (result.success) {
        Alerts.success('¡Bienvenido! Has iniciado sesión con Google');
        _loadUserData(result.user);
      }
    } catch (error) {
      Alerts.error('Error al iniciar sesión con Google: ' + error.message);
    }
  }

  function _showEmailModal() {
    const modal = document.getElementById('modal-register');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('reg-nombre').focus();
    }
  }

  function _hideRegisterModal() {
    const modal = document.getElementById('modal-register');
    if (modal) {
      modal.classList.add('hidden');
      // Limpiar formulario
      document.getElementById('reg-nombre').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-password-confirm').value = '';
    }
  }

  async function _handleRegister() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    // Validaciones
    if (!nombre || nombre.length < 2) {
      Alerts.error('El nombre debe tener al menos 2 caracteres');
      return;
    }

    if (!email || !email.includes('@')) {
      Alerts.error('Ingresa un correo electrónico válido');
      return;
    }

    if (!password || password.length < 6) {
      Alerts.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== passwordConfirm) {
      Alerts.error('Las contraseñas no coinciden');
      return;
    }

    try {
      const loader = Alerts.loading('Registrando cuenta...');
      const result = await window.FirebaseClient.registerUser(email, password, nombre);
      loader.close();

      if (result.success) {
        Alerts.success('¡Cuenta creada exitosamente! Bienvenido ' + result.user.displayName);
        _hideRegisterModal();
        _loadUserData(result.user);
      }
    } catch (error) {
      Alerts.error('Error al crear cuenta: ' + error.message);
    }
  }

  async function _handleLogout() {
    try {
      await window.FirebaseClient.signOut();
      Alerts.success('Has cerrado sesión correctamente');
      _showUnauthenticatedState();
    } catch (error) {
      Alerts.error('Error al cerrar sesión: ' + error.message);
    }
  }

  function _showAuthenticatedState(user) {
    // Ocultar botones de login
    document.getElementById('auth-buttons')?.classList.add('hidden');
    // Mostrar info de usuario
    document.getElementById('auth-status')?.classList.remove('hidden');
    
    // Mostrar datos del usuario
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-display-name').textContent = user.displayName || '';
    
    // Actualizar badge de conexión
    const badge = document.querySelector('.connection-badge');
    if (badge) {
      badge.textContent = 'Conectado';
      badge.classList.add('connected');
    }
  }

  function _showUnauthenticatedState() {
    // Mostrar botones de login
    document.getElementById('auth-buttons')?.classList.remove('hidden');
    // Ocultar info de usuario
    document.getElementById('auth-status')?.classList.add('hidden');
    
    // Actualizar badge de conexión
    const badge = document.querySelector('.connection-badge');
    if (badge) {
      badge.textContent = 'Modo local';
      badge.classList.remove('connected');
    }
  }

  async function _loadUserData(user) {
    try {
      // Cargar datos del usuario desde Firestore
      const personal = await window.API.obtenerPersonal();
      AppState.set('personal', personal.data || []);
      
      const config = await window.API.obtenerConfiguracion();
      AppState.set('config', config.data || {});
      
      // Refrescar UI
      if (window.ModuloPersonal) window.ModuloPersonal.cargar();
      if (window.ModuloDashboard) window.ModuloDashboard.cargar();
    } catch (error) {
      console.error('Error cargando datos del usuario:', error);
    }
  }

  return {
    init,
    checkAuthState: _checkAuthState,
    showAuthenticatedState: _showAuthenticatedState,
    showUnauthenticatedState: _showUnauthenticatedState
  };
})();
```

#### 3. `js/app.js` - Inicializar módulo de auth

```javascript
// En la función _initModules(), agregar:
if (window.ModuloAuth) window.ModuloAuth.init();
```

---

## 🧪 PRUEBAS DEL MODELO SAAS

### Script de Prueba Multi-Tenant

Crear `__e2e__/test-saas-model.js`:

```javascript
const { chromium } = require('playwright');

async function testSaaSModel() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('=== PRUEBA MODELO SAAS MULTI-TENANT ===\n');

    await page.goto('http://127.0.0.1:3801');
    await page.waitForTimeout(3000);

    // Prueba 1: Registro de nuevo usuario
    console.log('1. Probando registro de usuario...');
    const btnEmailLogin = page.locator('#btn-email-login');
    await btnEmailLogin.click();
    await page.waitForTimeout(500);

    const nombre = 'Usuario Test SaaS';
    const email = `test${Date.now()}@gmail.com`;
    const password = 'password123';

    await page.fill('#reg-nombre', nombre);
    await page.fill('#reg-email', email);
    await page.fill('#reg-password', password);
    await page.fill('#reg-password-confirm', password);

    await page.locator('#btn-submit-register').click();
    await page.waitForTimeout(3000);

    // Verificar autenticación
    const authStatus = await page.locator('#auth-status').isVisible();
    console.log('Estado autenticación:', authStatus ? 'Autenticado' : 'No autenticado');

    // Prueba 2: Crear trabajador (debe ir a espacio del usuario)
    console.log('2. Probando CRUD en espacio del usuario...');
    await page.evaluate(() => window.location.hash = 'personal');
    await page.waitForTimeout(1000);

    const btnNuevo = page.locator('#btn-nuevo-personal');
    await btnNuevo.click();
    await page.waitForTimeout(500);

    await page.fill('#p-nombre', 'Trabajador SaaS Test');
    await page.fill('#p-dpi', '1234567890101');
    
    const puesto = page.locator('#p-puesto');
    await puesto.selectOption({ index: 1 });
    
    await page.fill('#p-jefe', 'Supervisor SaaS');
    await page.fill('#p-telefono', '55551111');

    await page.locator('#btn-guardar-personal').click();
    await page.waitForTimeout(2000);

    // Verificar que el trabajador se guardó
    const workerCount = await page.locator('#personal-tbody tr').count();
    console.log('Trabajadores en tabla:', workerCount);

    // Prueba 3: Logout y verificación de aislamiento
    console.log('3. Probando aislamiento de datos...');
    await page.locator('#btn-logout').click();
    await page.waitForTimeout(2000);

    // Verificar que no se pueda acceder a datos del usuario anterior
    await page.evaluate(() => window.location.hash = 'personal');
    await page.waitForTimeout(1000);

    const workerCountAfterLogout = await page.locator('#personal-tbody tr').count();
    console.log('Trabajadores después de logout:', workerCountAfterLogout);

    console.log('\n✅ PRUEBAS SAAS COMPLETADAS');

  } catch (error) {
    console.error('Error en pruebas:', error);
  } finally {
    await browser.close();
  }
}

testSaaSModel();
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN UI

### HTML (`index.html`)
- [ ] Agregar scripts de Auth Firebase modular
- [ ] Agregar botones de Google Sign-In y Email Login
- [ ] Agregar modal de registro
- [ ] Agregar sección de estado de autenticación

### CSS (`css/auth.css`)
- [ ] Estilos para botones de login social
- [ ] Estilos para modal de registro
- [ ] Estilos para estado de usuario

### JavaScript
- [ ] Crear `js/modules/auth.js`
- [ ] Modificar `js/app.js` para inicializar auth
- [ ] Modificar `js/modules/ajustes.js` para UI simplificada

### Firebase
- [ ] Reglas de seguridad desplegadas ✅
- [ ] Authentication configurado ✅
- [ ] Dominios autorizados ✅

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Backend (COMPLETADO ✅)
- [x] Reglas de seguridad multi-tenant
- [x] FirebaseClient con rutas multi-tenant
- [x] Funciones de registro automático
- [x] Despliegue de reglas

### Fase 2: Frontend - Scripts (PENDIENTE)
- [ ] Agregar scripts de Auth Firebase en index.html
- [ ] Crear módulo auth.js
- [ ] Integrar con app.js

### Fase 3: Frontend - UI (PENDIENTE)
- [ ] Modificar sección de autenticación en ajustes
- [ ] Agregar botones de Google/Email login
- [ ] Crear modal de registro
- [ ] Actualizar estado de usuario

### Fase 4: Pruebas (PENDIENTE)
- [ ] Probar registro con Google
- [ ] Probar registro con Email
- [ ] Verificar aislamiento de datos
- [ ] Probar sincronización offline/online

---

## 🎯 BENEFICIOS DEL MODELO SAAS

### Para el Vendedor
- **Venta simple:** Cualquier usuario con Gmail puede usar la app
- **Sin configuración:** No requiere crear usuarios administradores manualmente
- **Escalabilidad:** Cada usuario tiene su propio espacio aislado
- **Bajo mantenimiento:** Sin gestión de roles y permisos complejos

### Para el Usuario Final
- **Fácil acceso:** Registro simple con Google o Email
- **Datos privados:** Su información está aislada de otros usuarios
- **Trabajo offline:** Funciona sin internet, sincroniza cuando reconecta
- **Sin bloqueos:** No depende de que un administrador le dé acceso

### Técnicamente
- **Seguridad:** Aislamiento por UID es muy seguro
- **Escalabilidad:** Firestore escala automáticamente
- **Costos:** Cada usuario paga solo su propio uso
- **Mantenimiento:** Sin gestión manual de usuarios

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Limitaciones del Plan Gratuito Firebase
- **Firestore:** 50K lecturas, 20K escrituras diarias
- **Storage:** 5GB
- **Authentication:** 10K autenticaciones/mes

### Para Escala Comercial
- Considerar planes Blaze de Firebase
- Implementar lógica de planes de suscripción
- Agregar límites por usuario según plan
- Implementar sistema de pagos

### Backward Compatibility
- El código mantiene compatibilidad con rutas tradicionales
- Funciona en modo local sin cambios
- Migración gradual posible

---

## 📝 DOCUMENTACIÓN FINAL

Una vez completada la implementación UI, crear documentación de usuario final:

### Guía para Usuarios Finales
1. "Cómo registrarse en la aplicación"
2. "Cómo iniciar sesión con Google"
3. "Cómo funciona la sincronización"
4. "Mis datos están seguros y privados"

### Guía para Vendedores
1. "Cómo ofrecer la aplicación a clientes"
2. "Modelo de suscripción"
3. "Soporte técnico básico"

---

## ✅ ESTADO ACTUAL

### ✅ Completado
- Reglas de seguridad multi-tenant desplegadas
- FirebaseClient con rutas multi-tenant
- Funciones de registro automático implementadas
- Authentication configurado con Google y Email/Password

### ⏳ Pendiente (Requiere implementación UI)
- Scripts de Auth Firebase en index.html
- Módulo auth.js
- Modificación de UI en ajustes
- Modal de registro
- Pruebas E2E del modelo SAAS

El backend está completamente listo para el modelo SaaS. Solo falta implementar la interfaz de usuario para el registro y login.