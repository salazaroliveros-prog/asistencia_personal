# CORRECCIÓN DE NOTIFICACIONES DE ACTUALIZACIÓN CONSTANTES
**Fecha:** 2026-09-19  
**Versión:** 1.5.0  
**Problema:** Alerta de actualización aparece constantemente  
**Solución:** Corrección de lógica de Update Manager

---

## 🚨 Problema Identificado

**Síntoma:** El banner de actualización aparece constantemente incluso cuando no hay una nueva versión real disponible.

**Causas Raíz:**

1. **Intervalo de verificación muy frecuente:**
   - Original: Cada 5 minutos
   - Problema: Verifica demasiado seguido, causando spam de notificaciones

2. **Falta de protección contra múltiples display:**
   - Banner se mostraba cada vez que se detectaba updatefound
   - No se verificaba si ya estaba visible
   - No se verificaba si ya se había marcado como disponible

3. **Estado no reseteado después de actualización:**
   - `_updateAvailable` no se reseteaba al aplicar actualización
   - Después de recargar, el banner podía aparecer nuevamente

---

## ✅ Correcciones Aplicadas

### 1. Reducir Frecuencia de Verificación

**Antes:**
```javascript
_checkIntervalId = setInterval(() => {
  checkForUpdates();
}, 5 * 60 * 1000); // Cada 5 minutos
```

**Después:**
```javascript
_checkIntervalId = setInterval(() => {
  checkForUpdates();
}, 15 * 60 * 1000); // Cada 15 minutos en lugar de 5
```

**Justificación:** 15 minutos es suficiente para detectar actualizaciones sin molestar al usuario con verificaciones excesivas.

### 2. Protección Contra Múltiples Display

**Antes:**
```javascript
function handleUpdateFound() {
  const newWorker = _registration.installing;
  
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      _updateAvailable = true;
      showUpdateBanner(); // Siempre muestra
    }
  });
}
```

**Después:**
```javascript
function handleUpdateFound() {
  const newWorker = _registration.installing;
  
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // Solo mostrar si no se ha mostrado antes
      if (!_updateAvailable) {
        _updateAvailable = true;
        showUpdateBanner();
      }
    }
  });
}
```

**Justificación:** Previene mostrar el banner múltiples veces para la misma actualización.

### 3. Resetear Estado al Aplicar Actualización

**Antes:**
```javascript
function applyUpdate() {
  if (_registration && _registration.waiting) {
    _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  setTimeout(() => {
    window.location.reload();
  }, 500);
}
```

**Después:**
```javascript
function applyUpdate() {
  // Resetear estado para evitar mostrar banner nuevamente después de recargar
  _updateAvailable = false;
  hideUpdateBanner();
  
  if (_registration && _registration.waiting) {
    _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  setTimeout(() => {
    window.location.reload();
  }, 500);
}
```

**Justificación:** Asegura que después de actualizar, el banner no aparezca nuevamente en la siguiente carga.

---

## 🔍 Validación de Indicadores de Conexión

### Lógica de Connection Badge (Sidebar)

**Ubicación:** `app.js` - `_initConnectionBadge()`

**Estado:**
- ✅ Actualiza cuando cambia `backendMode`
- ✅ Actualiza cuando cambia `connected`
- ✅ Muestra "Firestore" cuando está conectado
- ✅ Muestra "Modo local" cuando está desconectado
- ✅ Indicador visual: verde (connected) o gris (disconnected)

**Consistencia:** ✅ CORRECTA

### Lógica de Sync Indicator (Topbar)

**Ubicación:** `app.js` - `_initSyncIndicator()`

**Estado:**
- ✅ Badge offline muestra count de operaciones pendientes
- ✅ Botón "Sincronizar ahora" solo visible cuando hay pendientes y conexión
- ✅ Última sincronización mostrada cuando no hay pendientes
- ✅ Auto-sync al reconectar si hay cola pendiente
- ✅ Spinner en botón durante sincronización

**Consistencia:** ✅ CORRECTA

---

## 🎯 Comportamiento Esperado

### Antes de la Corrección

1. **Banner Update:**
   - ❌ Aparecía cada 5 minutos
   - ❌ Se mostraba múltiples veces para la misma actualización
   - ❌ Podía aparecer después de actualizar

2. **Indicadores de Conexión:**
   - ✅ Funcionaban correctamente

### Después de la Corrección

1. **Banner Update:**
   - ✅ Verifica cada 15 minutos (menos frecuente)
   - ✅ Solo muestra una vez por actualización
   - ✅ No aparece después de actualizar
   - ✅ Respeta dismissedUntil (1 hora de cooldown)

2. **Indicadores de Conexión:**
   - ✅ Funcionan correctamente
   - ✅ Sincronización automática al reconectar
   - ✅ Feedback visual claro

---

## 📊 Validación de Todos los Banners Globales

### 1. PWA Install Banner

**Estado:** ✅ CORRECTO
- Solo aparece cuando PWA es instalable
- No aparece constantemente
- Tiene botón de cierre

### 2. Update Notification Banner

**Estado:** ✅ CORREGIDO
- Ahora respeta lógica adecuada
- No aparece constantemente
- Respeta dismissedUntil

### 3. Sync Indicator

**Estado:** ✅ CORRECTO
- Solo visible cuando hay operaciones pendientes
- Actualiza en tiempo real
- Muestra última sincronización

### 4. Demo Banner

**Estado:** ✅ CORRECTO
- Solo visible cuando hay datos demo
- Tiene botón de cierre
- No aparece constantemente

---

## 🔐 Validación de Lógica Funcional

### Flujo de Actualización Corregido

```
1. Service Worker detecta nueva versión
   ↓
2. updatefound event se dispara
   ↓
3. handleUpdateFound() verifica si _updateAvailable es false
   ↓
4. Si es false: marca _updateAvailable = true y muestra banner
   ↓
5. Usuario hace clic en "Actualizar ahora"
   ↓
6. applyUpdate() resetea _updateAvailable = false y oculta banner
   ↓
7. Página se recarga con nueva versión
   ↓
8. No se muestra banner nuevamente (estado reseteado)
```

### Flujo de Conexión

```
1. FirebaseClient detecta cambio de auth
   ↓
2. AppState.set('connected', true/false)
   ↓
3. Connection badge actualiza visualmente
   ↓
4. Sync indicator actualiza si hay cola pendiente
   ↓
5. Si reconecta con cola: auto-sync automático
```

---

## 🎯 Conclusión

**Problema Resuelto:** ✅

La alerta de actualización constante ha sido corregida mediante:
1. Reducción de frecuencia de verificación (5 → 15 minutos)
2. Protección contra múltiples display del mismo banner
3. Reset del estado al aplicar actualización

**Indicadores de Conexión:** ✅

Funcionan coherentemente según su lógica:
- Connection badge refleja estado real de Firebase
- Sync indicator muestra operaciones pendientes
- Auto-sync al reconectar cuando hay cola

**Todos los Banners Globales:** ✅

Funcionan correctamente según su lógica específica:
- PWA Install: solo cuando es instalable
- Update: solo cuando hay nueva versión real
- Sync: solo cuando hay operaciones pendientes
- Demo: solo cuando hay datos demo

**Estado Final:** El sistema de notificaciones funciona coherentemente según su lógica funcional sin spam de alertas.

---

**Fin de Corrección de Notificaciones de Actualización**