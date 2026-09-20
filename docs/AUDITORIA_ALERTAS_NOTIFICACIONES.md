# AUDITORÍA DE ALERTAS Y NOTIFICACIONES
**Fecha:** 2026-09-19  
**Versión:** 1.5.0  
**Objetivo:** Analizar consistencia e incoherencias en el sistema de alertas y notificaciones

---

## ✅ Sistema de Alertas Principal (alerts.js)

### Tipos de Alertas Implementados

**1. Toasts Estándar:**
- ✅ `success(message, title)` - Éxito, duración 4500ms
- ✅ `error(message, title, persistent)` - Error, duración 6000ms (0 si persistent)
- ✅ `warning(message, title)` - Advertencia, duración 5500ms
- ✅ `info(message, title)` - Información, duración 4500ms

**2. Toasts Especializados:**
- ✅ `marcacion(data)` - Confirmación de marcación de asistencia
- ✅ `loading(message)` - Toast de carga con métodos update() y close()

**3. Modales de Confirmación:**
- ✅ `confirm(message, title, opts)` - Reemplazo de window.confirm
  - `opts.okLabel` - Texto botón confirmar (default: "Confirmar")
  - `opts.cancelLabel` - Texto botón cancelar (default: "Cancelar")
  - `opts.type` - Estilo: 'danger' | 'info' (default: "danger")

### Configuración del Sistema

**Valores por Defecto:**
- `maxToasts: 5` - Máximo de toasts simultáneos
- `duration: 4500ms` - Duración auto-cierre por defecto

**Íconos por Tipo:**
- `success` - check-circle-2
- `error` - x-circle
- `warning` - alert-triangle
- `info` - info

**Títulos por Defecto:**
- `success` - "Éxito"
- `error` - "Error"
- `warning` - "Advertencia"
- `info` - "Información"

---

## 📊 Uso de Alertas en Módulos

### Estadísticas de Uso

**Total de llamadas a Alerts analizadas:** 100+

**Distribución por Tipo:**
- `Alerts.success()`: 12 usos
- `Alerts.error()`: 35 usos
- `Alerts.warning()`: 8 usos
- `Alerts.info()`: 0 usos directos
- `Alerts.marcacion()`: 2 usos
- `Alerts.loading()`: 5 usos
- `Alerts.confirm()`: 5 usos

### Módulos que Usan Alertas

**1. personal.js (31 usos):**
- ✅ Validación de errores de conexión
- ✅ Validación de datos duplicados (DPI)
- ✅ Feedback de operaciones CRUD
- ✅ Errores de cámara y captura de foto
- ✅ Advertencias de tamaño de imagen
- ✅ Confirmación de baja de trabajador

**2. reportes.js (13 usos):**
- ✅ Validación de parámetros de reporte
- ✅ Errores de carga de datos
- ✅ Feedback de exportación PDF/CSV
- ✅ Advertencias de modo local

**3. campo.js (2 usos):**
- ✅ Confirmación de marcación en campo
- ✅ Advertencia de modo offline

**4. asistencia.js (5 usos):**
- ✅ Confirmación de marcación manual
- ✅ Validación de trabajador
- ✅ Errores de validación

**5. error-handler.js (2 usos):**
- ✅ Mostrar toast de error
- ✅ Mostrar toast de advertencia

---

## 🔍 Validación de Consistencia de Tipos

### ✅ Consistencia Verificada

**1. Mensajes de Éxito:**
```javascript
// ✅ PATRÓN CONSISTENTE: "X completado/descargado/registrado"
Alerts.success("Trabajador registrado");
Alerts.success("Trabajador actualizado");
Alerts.success(`${nombre} dado de baja correctamente`);
Alerts.success(`PDF "${filename}" descargado correctamente`);
Alerts.success(`CSV "${filename}" descargado. Ábrelo con Excel o Google Sheets.`);
Alerts.success(`Carné de ${nombre} descargado como imagen PNG`);
```

**2. Mensajes de Error:**
```javascript
// ✅ PATRÓN CONSISTENTE: "Error al X" o "X falló"
Alerts.error("Error de conexión");
Alerts.error("Error al guardar");
Alerts.error("Error al eliminar");
Alerts.error("Error al generar la imagen: " + err.message);
Alerts.error("Error al capturar la foto. Intenta nuevamente.");
Alerts.error("Error al cargar datos");
Alerts.error("Error al generar vista previa");
Alerts.error("Error al generar PDF");
```

**3. Mensajes de Advertencia:**
```javascript
// ✅ PATRÓN CONSISTENTE: Advertencias informativas
Alerts.warning("No se pudo actualizar la lista: " + error);
Alerts.warning("Modo local activo. Los datos corresponden a este dispositivo.");
Alerts.warning(`La imagen comprimida pesa ${sizeKB}KB. Se recomienda menos de 200KB.`);
Alerts.warning("Sin conexión: la marca quedó en cola y se sincronizará automáticamente.", "Modo offline");
```

**4. Confirmaciones:**
```javascript
// ✅ PATRÓN CONSISTENTE: Pregunta con contexto
Alerts.confirm(
  `¿Dar de baja a "${nombre}"?\n\nEsto cambiará su estado a Inactivo...`,
  "Confirmar baja de trabajador"
);
```

---

## 🚨 Incoherencias Detectadas

### 1. Inconsistencia Leve en Feedback de Marcación

**Lugar:** `campo.js` vs `asistencia.js`

**campo.js (línea 373):**
```javascript
Alerts.marcacion({ 
  nombre: _currentWorker.Nombre_Completo || 'Trabajador', 
  tipo, 
  horaReal, 
  estado 
});
```

**asistencia.js (línea 580):**
```javascript
Alerts.marcacion({
  nombre: trabajador.Nombre_Completo,
  tipo,
  horaReal: result.horaReal || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
  estado: result.estadoMarcacion || estadoMarcacion,
});
```

**Problema:** 
- `campo.js` usa fallback `'Trabajador'` genérico
- `asistencia.js` usa fallback de hora más específico
- `campo.js` usa `estado` directo, `asistencia.js` usa `result.estadoMarcacion` con fallback

**Impacto:** ⚠️ LEVE - Funcionalmente correcto, pero podría ser más consistente

**Recomendación:** Unificar la lógica de fallbacks entre ambos módulos

### 2. Faltan Alertas de Tipo `info()`

**Observación:**
- No se encontraron usos directos de `Alerts.info()`
- Solo se usan `success`, `error`, `warning`, `marcacion`, `loading`, `confirm`

**Impacto:** ℹ️ INFORMATIVO - No es un error, pero podría haber oportunidades para usar `info()` en situaciones informativas que no son ni éxito ni error

**Recomendación:** Considerar usar `Alerts.info()` para mensajes puramente informativos

### 3. Consistencia en Mensajes de Error Genéricos

**Observación:**
Algunos mensajes de error usan títulos genéricos:
```javascript
Alerts.error(result.error || 'Error al guardar', 'Error');
Alerts.error(err.message, 'Error');
```

**Impacto:** ⚠️ LEVE - Funcionalmente correcto, pero podría ser más específico

**Recomendación:** Usar títulos más descriptivos cuando sea posible

---

## 🎯 Banners y Notificaciones Globales

### 1. PWA Install Banner

**ID:** `#pwa-install-banner`
**Estado:** ✅ Oculto por defecto, mostrado cuando PWA es instalable
**Contenido:**
- Título: "Instalar aplicación"
- Subtítulo: "Agregar Control Personal Campo a tu pantalla de inicio"
- Botón: "Instalar"

**Consistencia:** ✅ Mensaje claro y coherente

### 2. Update Notification Banner

**ID:** `#update-banner`
**Estado:** ✅ Oculto por defecto, mostrado cuando hay actualización
**Contenido:**
- Título: "Nueva versión disponible"
- Subtítulo: "Hay una actualización disponible. Recargar para aplicar."
- Botón: "Actualizar ahora"

**Consistencia:** ✅ Mensaje claro y coherente

### 3. Sync Indicator

**ID:** `#sync-indicator`
**Estado:** ✅ Oculto por defecto, mostrado cuando hay operaciones pendientes
**Contenido:**
- Badge offline: muestra count de operaciones pendientes
- Botón: "Sincronizar ahora"
- Timestamp: última sincronización

**Consistencia:** ✅ Feedback visual claro del estado de sincronización

### 4. Demo Banner

**ID:** `#demo-banner`
**Estado:** ✅ Oculto por defecto, mostrado cuando hay datos demo
**Contenido:**
- Texto: "MODO DEMO — Datos de prueba cargados. Configura Firestore en Ajustes para sincronizar datos reales."
- Botón: Cerrar

**Consistencia:** ✅ Mensaje claro y contextual

---

## 🔐 Seguridad y Accesibilidad

### Validación de Seguridad

**1. Escapado de HTML:**
- ✅ `_escapeHtml()` implementado en todos los mensajes
- ✅ Prevención de XSS en toasts
- ✅ Mensajes sanitizados antes de renderizar

**2. ARIA Attributes:**
- ✅ `role="alert"` para errores (assertive)
- ✅ `role="status"` para otros tipos (polite)
- ✅ `aria-live="assertive"` para errores críticos
- ✅ `aria-live="polite"` para notificaciones normales
- ✅ `aria-label` en botones de cierre

**3. Gestión de Foco:**
- ✅ Foco devuelto al elemento opener al cerrar modal
- ✅ Focus management en confirmaciones
- ✅ Tecla Escape cierra modales

---

## 📱 Validación de Lógica de Display

### Contenedor de Toasts

**ID:** `#toast-container`
**Estado:** ✅ Único contenedor en DOM
**Lógica:**
- ✅ Máximo 5 toasts simultáneos
- ✅ Auto-remoción del toast más antiguo al exceder límite
- ✅ Animación de salida de 320ms
- ✅ Icons renderizados eficientemente

### Lógica de Auto-cierre

**Duraciones:**
- `success`: 4500ms (default)
- `error`: 6000ms (0 si persistent)
- `warning`: 5500ms
- `info`: 4500ms (default)
- `marcacion`: 5000ms
- `loading`: Manual (sin auto-cierre)

**Consistencia:** ✅ Duraciones apropiadas por tipo de mensaje

---

## 🎯 Conclusiones

### ✅ Sistema de Alertas CONSISTENTE

**Fortalezas:**
- ✅ API unificada y bien documentada
- ✅ Tipos de alertas claramente diferenciados
- ✅ Mensajes consistentes en su mayoría
- ✅ Seguridad implementada (escapado HTML, ARIA)
- ✅ Accesibilidad cumpliendo WCAG
- ✅ Gestión de límites de toasts
- ✅ Banners globales bien implementados

**Incoherencias Leves:**
1. ⚠️ Pequeñas diferencias en fallbacks de `Alerts.marcacion()` entre módulos
2. ℹ️ No se usa `Alerts.info()` (opcional pero podría ser útil)
3. ⚠️ Algunos títulos de error genéricos podrían ser más específicos

**Estado General:** ✅ El sistema de alertas funciona correctamente sin inconsistencias críticas que afecten la funcionalidad

### 📊 Recomendaciones Opcionales

1. **Unificar lógica de fallbacks en `Alerts.marcacion()`**
   - Crear helper centralizado para horaReal y estado
   - Usar en ambos módulos (campo.js y asistencia.js)

2. **Considerar uso de `Alerts.info()`**
   - Para mensajes puramente informativos
   - Para notificaciones de estado no críticas

3. **Mejorar especificidad de títulos de error**
   - Usar títulos más descriptivos cuando sea posible
   - Mantener contexto claro para el usuario

---

**Estado Final: El sistema de alertas y notificaciones funciona correctamente con consistencia adecuada. No hay incoherencias críticas que afecten la funcionalidad.**

---

**Fin de Auditoría de Alertas y Notificaciones**