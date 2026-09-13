# 🚀 Guía de Uso - Plan Gratuito Firebase
## Sistema de Control de Asistencia con Escáner QR

**Versión:** 1.0.0  
**Fecha:** 13 de septiembre de 2026  
**Plan:** Firebase Free Tier (Spark)

---

## 📋 CONFIGURACIÓN INICIAL

### 1. Servidor de Desarrollo
```bash
npm run dev
```
La aplicación estará disponible en: `http://127.0.0.1:3803`

### 2. Configuración Firebase (Principal)
1. Abre la aplicación principal en el navegador
2. Navega a **Ajustes** → **Datos y sincronización**
3. Ingresa los datos de tu proyecto Firebase:
   - **ID del proyecto:** `sistema-de-control-aee89`
   - **API Key:** (de Firebase Console)
   - **Dominio de autenticación:** `sistema-de-control-aee89.firebaseapp.com`
   - **App ID:** (de Firebase Console)
4. Click en **Conectar Firestore**
5. La aplicación autenticará automáticamente (Anonymous Auth)

### 3. Configuración Firebase (Escáner Móvil)
1. Abre `field-scanner.html` en el navegador móvil
2. Inicia sesión con el PIN del operador (default: `1234`)
3. Configura Firebase si no está configurado
4. El escáner sincronizará automáticamente con Firestore

---

## 🔄 FLUJO DE TRABAJO COMPLETO

### Escenario: Operador de Campo Escanea Trabajador

#### Paso 1: Administrador Configura Trabajadores
1. **Ubicación:** Dashboard → Personal
2. **Acción:** Registrar nuevos trabajadores
3. **Datos requeridos:**
   - ID_Trabajador (único)
   - Nombre_Completo
   - DPI_CUI
   - Puesto
   - Jefe_Inmediato (opcional)
   - Teléfono (opcional)
   - Dirección (opcional)
4. **Resultado:** Trabajador guardado en Firestore y cache local

#### Paso 2: Generar QR del Trabajador
1. **Ubicación:** Dashboard → Personal → Seleccionar trabajador
2. **Acción:** Click en "Generar QR"
3. **Resultado:** QR generado con datos del trabajador
4. **Acción:** Imprimir o mostrar QR para escaneo

#### Paso 3: Operador de Campo Escanea QR
1. **Dispositivo:** Mobile/Tablet con cámara
2. **URL:** `field-scanner.html`
3. **Login:** Ingresar PIN del operador
4. **Acción:** Click en "Iniciar escáner"
5. **Scan:** Apuntar cámara al QR del trabajador
6. **Resultado:** Trabajador identificado automáticamente

#### Paso 4: Registrar Marcación
1. **Selección:** El operador selecciona tipo de marcación:
   - 🟢 **Entrada** (default: 07:00)
   - 🟡 **Salida Receso** (default: 10:00)
   - 🟡 **Regreso Receso** (default: 10:30)
   - 🔴 **Salida Obra** (default: 17:00)
2. **GPS:** El sistema captura ubicación automáticamente
3. **Envío:** Datos enviados a Firestore en tiempo real
4. **Confirmación:** Feedback visual y auditivo

#### Paso 5: Administrador Observa en Tiempo Real
1. **Ubicación:** Dashboard principal
2. **Panel Turno en vivo:** Muestra trabajadores actualmente en obra
3. **Feed de actividad:** Actualizaciones en tiempo real
4. **KPIs:** Contadores actualizados automáticamente
5. **Calendario:** Visualización de asistencias del día

---

## 📱 APLICACIÓN MÓVIL: ESCÁNER DE CAMPO

### Características
- ✅ Escaneo QR con cámara del dispositivo
- ✅ Captura automática de GPS
- ✅ Offline-first (cola de marcaciones)
- ✅ Sincronización automática con Firestore
- ✅ Feed de marcaciones recientes
- ✅ Login con PIN del operador
- ✅ Feedback visual y auditivo

### URL de Acceso
- **Desarrollo:** `http://127.0.0.1:3803/field-scanner.html`
- **Producción:** Tu dominio + `/field-scanner.html`

### PIN del Operador
- **Default:** `1234`
- **Configuración:** Configurable en Ajustes → Configuración General → PIN Escáner de Campo

### Botones de Marcación
1. **Entrada** - Registro de llegada al trabajo
2. **Salida Receso** - Registro de salida a descanso
3. **Regreso Receso** - Registro de regreso del descanso
4. **Salida Obra** - Registro de salida del trabajo

---

## 📊 DASHBOARD: VISTA DE ADMINISTRADOR

### Componentes en Tiempo Real

#### 1. **Panel Turno en Vivo**
- Trabajadores actualmente en obra
- Actualización automática cada 30 segundos
- Indicadores de estado (Presente, Ausente, Tardanza)

#### 2. **KPIs del Día**
- Total de trabajadores
- Presentes hoy
- Tardanzas
- Ausencias
- Horas extra

#### 3. **Feed de Actividad**
- Últimas marcaciones en tiempo real
- Tipo de marcación (Entrada, Salida, etc.)
- Hora de registro
- Trabajador involucrado

#### 4. **Calendario de Asistencias**
- Vista mensual/diaria
- Indicadores de asistencia por día
- Click en día para ver detalle

#### 5. **Lista de Trabajadores**
- Lista completa de personal
- Estado actual de cada trabajador
- Acciones rápidas (ver detalle, editar, eliminar)

---

## 🔥 FIRESTORE: COLECCIONES Y ESTRUCTURA

### Colección: `personal`
```javascript
{
  ID_Trabajador: "TRAB-001",
  Nombre_Completo: "Juan Pérez",
  DPI_CUI: "1234567890123",
  Puesto: "Albañil",
  Jefe_Inmediato: "Pedro Gómez",
  Telefono: "55555555",
  Direccion: "Dirección del trabajador",
  Estado: "Activo",
  Fecha_Registro: "2026-09-13",
  updated_at: "2026-09-13T10:00:00.000Z"
}
```

### Colección: `asistencias`
```javascript
{
  ID_Trabajador: "TRAB-001",
  Documento: "1234567890123",
  Nombre_Completo: "Juan Pérez",
  Puesto: "Albañil",
  Fecha: "2026-09-13",
  Estado_General: "Presente",
  Metodo_Registro: "Escaneo_QR",
  Ubicacion_Obra: "GPS: 14.12345, -90.12345",
  Historial_Marcaciones: [
    {
      Fecha: "2026-09-13",
      Hora: "07:05",
      Timestamp: 1726199100000,
      Metodo_Registro: "Escaneo_QR",
      Origen: "ESCANER_CAMPO"
    }
  ],
  Metodos_Registro: ["Escaneo_QR"],
  Ultima_Actualizacion: 1726199100000,
  updated_at: "2026-09-13T10:00:00.000Z"
}
```

### Colección: `configuracion`
```javascript
{
  nombre_obra: "Construcciones Ramsa",
  encargado: "Administrador",
  tolerancia: 15,
  hora_entrada: "07:00",
  hora_salida_receso: "10:00",
  hora_regreso_receso: "10:30",
  hora_salida_obra: "17:00"
}
```

---

## 🌐 SINCRONIZACIÓN EN TIEMPO REAL

### Cómo Funciona
1. **Escáner Móvil** → Envía marcación a Firestore
2. **Firestore** → Dispara eventos de cambio
3. **Dashboard** → Recibe actualización vía `onSnapshot`
4. **UI** → Actualiza automáticamente sin refresh

### Latencia
- **Normal:** < 500ms
- **Offline:** Los datos se guardan localmente y se sincronizan al reconectar
- **Health Check:** Cada 30 segundos

### Indicadores de Conexión
- 🟢 **En vivo** - Conectado y sincronizando
- 🟡 **Degradado** - Conexión lenta
- 🔴 **Offline** - Sin conexión (modo local)

---

## 🧪 PRUEBAS DE VALIDACIÓN

### Ejecutar Prueba Completa
```javascript
// En consola del navegador
FreePlanValidation.run()
```

### Pruebas Incluidas
1. ✅ Conexión Firebase
2. ✅ Autenticación anónima
3. ✅ CRUD de trabajadores
4. ✅ CRUD de asistencias
5. ✅ Sincronización en tiempo real
6. ✅ Offline queue
7. ✅ Validación de reglas de seguridad

---

## 🔐 SEGURIDAD EN PLAN GRATUITO

### Modelo de Permisos
- **Autenticación:** Firebase Anonymous Auth
- **Autorización:** Cualquier usuario autenticado tiene acceso completo
- **Validación:** Reglas de Firestore validan estructura y tamaño
- **Logs:** Sistema de logging registra todas las operaciones

### Limitaciones del Plan Gratuito
- ❌ No disponible gestión detallada de usuarios (requiere Cloud Functions)
- ❌ No disponible roles personalizados (requiere Cloud Functions)
- ✅ Sí disponible autenticación anónima
- ✅ Sí disponible Firestore en tiempo real
- ✅ Sí disponible validación de datos

### Para Mejorar Seguridad
- Actualizar a **Firebase Blaze Plan** (~$0.10 por 100k invocaciones)
- Desplegar **Cloud Functions** para gestión de usuarios
- Implementar **Custom Claims** para roles específicos

---

## 📱 INSTALACIÓN EN DISPOSITIVOS MÓVILES

### Opción 1: Acceso Web
1. Abre el navegador en el dispositivo móvil
2. Navega a la URL del escáner
3. Agrega a pantalla de inicio (PWA)

### Opción 2: Capacitor (App Nativa)
```bash
cd app-movil
npm install
npx cap sync
npx cap open android  # o ios
```

### Requisitos Móviles
- **Cámara:** Para escaneo QR
- **GPS:** Para captura de ubicación
- **Internet:** Para sincronización con Firestore
- **Storage:** Para cache local

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### Error: "No se pudo conectar a Firebase"
**Solución:**
1. Verifica que los datos de Firebase sean correctos
2. Verifica conexión a internet
3. Revisa Firebase Console para ver si el proyecto está activo

### Error: "Cámara no disponible"
**Solución:**
1. Verifica permisos de cámara en el dispositivo
2. Asegúrate de que el dispositivo tenga cámara
3. Intenta con HTTPS (requerido para acceso a cámara)

### Error: "GPS no disponible"
**Solución:**
1. Verifica permisos de ubicación
2. Asegúrate de que el GPS esté activado
3. Las marcaciones se registran sin GPS, pero sin ubicación

### Sincronización lenta
**Solución:**
1. Verifica conexión a internet
2. Revisa el indicador de estado en el dashboard
3. Los datos se sincronizarán cuando mejore la conexión

---

## 📊 MONITOREO Y LOGS

### Ver Logs de Aplicación
```javascript
// En consola del navegador
Logger.getStats()
Logger.getLogs('ERROR', null, 10) // Últimos 10 errores
Logger.exportLogs() // Exportar todos los logs
```

### Ver Conexión Firebase
```javascript
// En consola del navegador
FirebaseClient.getHealth()
FirebaseClient.getConnectionState()
```

### Ver Auditoría de Escáner
```javascript
// En consola del navegador (escáner)
JSON.parse(localStorage.getItem('field_scanner_audit_log'))
```

---

## 🎯 CHECKLIST DE PUESTA EN MARCHA

### Antes de Usar
- [ ] Servidor de desarrollo iniciado
- [ ] Firebase configurado en aplicación principal
- [ ] Firebase configurado en escáner móvil
- [ ] Trabajadores registrados en el sistema
- [ ] QRs generados para los trabajadores
- [ ] PIN del operador configurado
- [ ] Dispositivo móvil con cámara y GPS

### Durante el Uso
- [ ] Operador escanea QR del trabajador
- [ ] Selecciona tipo de marcación
- [ ] GPS capturado automáticamente
- [ ] Marcación enviada a Firestore
- [ ] Dashboard actualizado en tiempo real
- [ ] Feed de actividad muestra la marcación

### Después del Uso
- [ ] Verificar KPIs del día
- [ ] Revisar historial de asistencias
- [ ] Generar reportes si necesario
- [ ] Exportar logs para auditoría

---

## 📞 SOPORTE

### Documentación
- **Auditoría Firestore:** `AUDITORIA_FIRESTORE_COMPLETA.md`
- **Resumen Mejoras:** `RESUMEN_MEJORAS_COMPLETAS.md`
- **Guía Claims:** `IMPLEMENTACION_CLAIMS_AUTH.md`

### Herramientas de Prueba
- **Validación Plan Gratuito:** `FreePlanValidation.run()`
- **Verificación Completa:** `CompleteVerification.run()`
- **Pruebas Seguridad:** `SecurityRulesTest.run()`

### Firebase Console
- **URL:** https://console.firebase.google.com/project/sistema-de-control-aee89/overview
- **Firestore:** Ver colecciones en tiempo real
- **Authentication:** Ver usuarios anónimos
- **Usage:** Ver límites y cuotas del plan gratuito

---

## 🎉 LISTO PARA USAR

El sistema está completamente funcional con el plan gratuito de Firebase. La sincronización en tiempo real entre el escáner móvil y el dashboard del administrador está operativa y lista para producción.

**URL Principal:** http://127.0.0.1:3803  
**URL Escáner:** http://127.0.0.1:3803/field-scanner.html  
**Firebase Console:** https://console.firebase.google.com/project/sistema-de-control-aee89/overview