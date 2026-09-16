# Guía de Estándares de Código - Control Personal Campo

## Convenciones de Nomenclatura

### Variables y Funciones (camelCase)
```javascript
// ✅ CORRECTO
const workerId = 'TRAB-123';
const backendMode = 'firestore';
function getPersonal() { }
function setConfig(config) { }

// ❌ INCORRECTO
const worker_id = 'TRAB-123';
const BackendMode = 'firestore';
function Get_Personal() { }
```

### Constantes (UPPER_SNAKE_CASE)
```javascript
// ✅ CORRECTO
const APP_VERSION = '1.5.0';
const MAX_RETRY_COUNT = 3;
const DEFAULT_THEME = 'dark';

// ❌ INCORRECTO
const appVersion = '1.5.0';
const Max_Retry_Count = 3;
```

### Clases/Constructores (PascalCase)
```javascript
// ✅ CORRECTO
class FirebaseClient { }
class AppState { }
class WorkerManager { }

// ❌ INCORRECTO
class firebaseClient { }
class app_state { }
```

### Campos de Base de Datos (snake_case)
```javascript
// ✅ CORRECTO - Campos Firestore
ID_Trabajador: 'TRAB-123'
Nombre_Completo: 'Juan Pérez'
Fecha_Registro: '2026-09-15'

// ❌ INCORRECTO
idTrabajador: 'TRAB-123'
nombreCompleto: 'Juan Pérez'
```

### Keys de localStorage (snake_case con prefijo)
```javascript
// ✅ CORRECTO
const LS_KEYS = {
  FIREBASE_CONFIG: 'cpc_firebase_config',
  PERSONAL_CACHE: 'cpc_personal_cache',
  ATTENDANCE_CACHE: 'cpc_attendance_cache',
};

// ❌ INCORRECTO
const LS_KEYS = {
  firebaseConfig: 'cpc-firebase-config',
  personalCache: 'cpc-personal-cache',
};
```

## Reglas Específicas

### IDs Generados
```javascript
// ✅ CORRECTO - Prefijo + timestamp + random
const workerId = `TRAB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const marcacionId = `MARC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// ❌ INCORRECTO
const workerId = `trab_${Date.now()}_${Math.random()}`;
const marcacionId = `marcacion-${Date.now()}`;
```

### Callbacks y Event Handlers
```javascript
// ✅ CORRECTO - Prefijo descriptivo
function _handleFotoUpload() { }
function _onAuthStateChanged() { }
function _bindEvents() { }

// ❌ INCORRECTO
function fotoUpload() { }
function authStateChanged() { }
function bindEvents() { }
```

### Funciones Privadas
```javascript
// ✅ CORRECTO - Prefijo underscore
function _internalHelper() { }
const _privateVar = true;

// ❌ INCORRECTO
function internalHelper() { }
const privateVar = true;
```

## Orden de Archivos en Scripts

En `index.html`, cargar scripts en este orden:
1. Configuración (`config.js`, `firebase-config.js`)
2. Firebase (`firebase-client.js`)
3. API (`api.js`)
4. Utils (`constants.js`, `validators.js`, etc.)
5. Módulos (`dashboard.js`, `personal.js`, etc.)
6. App principal (`app.js`)

## Comentarios y JSDoc

### JSDoc Completo
```javascript
/**
 * Función descriptiva breve
 * @param {string} param1 - Descripción del parámetro
 * @param {number} param2 - Descripción del parámetro
 * @returns {Object} Descripción del retorno
 * @example
 * const result = functionName('value', 123);
 */
function functionName(param1, param2) {
  // implementación
}
```

### Comentarios Inline
```javascript
// ✅ CORRECTO - Comentario antes del código
// Validar que el usuario tenga permisos
if (!user.canEdit) return;

// ❌ INCORRECTO - Comentario al final de línea sin espacio
if (!user.canEdit) return;//validar permisos
```

## Manejo de Errores

### Try-Catch Específico
```javascript
// ✅ CORRECTO
try {
  await FirebaseClient.save('personal', id, data);
} catch (error) {
  if (error.code === 'permission-denied') {
    // Manejo específico de permisos
    console.error('[API] Permiso denegado:', error);
  } else {
    // Manejo genérico
    console.error('[API] Error al guardar:', error);
  }
}

// ❌ INCORRECTO
try {
  await FirebaseClient.save('personal', id, data);
} catch (error) {
  console.error(error); // Muy genérico
}
```

## Validaciones

### Centralizar en Validators
```javascript
// ✅ CORRECTO - Usar Validators module
const nombreResult = Validators.validateNombre(trabajador.nombre);
if (!nombreResult.valid) {
  return { success: false, error: nombreResult.error };
}

// ❌ INCORRECTO - Validación inline
if (!trabajador.nombre || trabajador.nombre.length < 3) {
  return { success: false, error: 'Nombre inválido' };
}
```

## Performance

### Evitar Re-renders
```javascript
// ✅ CORRECTO - Usar debounce
const debouncedSearch = RequestOptimizer.debounce('search', handleSearch, 300);
searchInput.addEventListener('input', debouncedSearch);

// ❌ INCORRECTO - Sin debounce
searchInput.addEventListener('input', handleSearch);
```

## Seguridad

### No Exponer Credenciales
```javascript
// ✅ CORRECTO - Usar variables de entorno
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// ❌ INCORRECTO - Hardcoded
const config = {
  apiKey: 'AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg',
  projectId: 'sistema-de-control-aee89',
};
```

## Testing

### Nombres de Tests
```javascript
// ✅ CORRECTO - Descriptivo
test('debería validar DPI correctamente', () => {
  // ...
});

test('debería rechazar DPI con longitud incorrecta', () => {
  // ...
});

// ❌ INCORRECTO - Vago
test('validar DPI', () => {
  // ...
});
```

## Estructura de Módulos

### Patrón IIFE
```javascript
// ✅ CORRECTO
const ModuloPersonal = (() => {
  // Variables privadas
  let _editingId = null;
  
  // Funciones privadas
  function _helper() { }
  
  // API pública
  return {
    init,
    cleanup,
    // ...
  };
})();

// ❌ INCORRECTO - Variables globales
let editingId = null;
function helper() { }
```

## Notas de Migración

Este proyecto tiene una mezcla histórica de convenciones. Para nuevo código:
- Usar siempre camelCase para variables JS
- Mantener snake_case para campos de base de datos (compatibilidad)
- Seguir estrictamente estas guías para nuevo código
- Refactorizar código existente gradualmente cuando sea necesario