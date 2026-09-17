# Database Schema Design - Sistema de Control de Personal de Campo

## 1. Resumen de Arquitectura

Este documento describe el diseño de base de datos optimizado para el sistema de control de personal de campo, con soporte para roles RBAC (Admin, Manager, Supervisor, Empleado), sincronización offline, y auditoría completa.

### 1.1 Colecciones Principales

| Colección | Propósito | Acceso Principal |
|-----------|-----------|------------------|
| `users` | Perfiles de usuario vinculados a Firebase Auth | Admin, Manager, Usuario propio |
| `personal` | Datos de trabajadores/empleados | Todos los autenticados |
| `asistencias` | Registros de marcación de entrada/salida | Todos los autenticados |
| `departamentos` | Departamentos organizacionales | Todos los autenticados |
| `proyectos` | Proyectos/obras de construcción | Todos los autenticados |
| `configuracion` | Configuración global del sistema | Todos (read), Admin (write) |
| `roles` | Definiciones de roles y permisos | Todos (read), Admin (write) |
| `alertas` | Alertas y notificaciones del sistema | Todos (read), Admin/Manager (create) |
| `notificaciones` | Notificaciones push/email por usuario | Usuario propio, Admin |
| `logs` | Registro de auditoría inmutable | Admin (read), Sistema (create) |

### 1.2 Relaciones entre Colecciones

```
users (1) ----< personal (N) >---- (N) proyectos
     |                                     |
     |                                     |
     +----< asistencias (N) >-------------+
     |
     +----< notificaciones (N)
     |
     +----< logs (N)
     
departamentos (1) ----< personal (N)
proyectos (1) ----< personal (N)
```

## 2. Esquema Detallado por Colección

### 2.1 Colección: `users`

Perfiles de usuario vinculados a Firebase Authentication mediante custom claims.

```typescript
interface User {
  uid: string;                    // UID de Firebase Auth (document ID)
  email: string;                  // Email del usuario
  displayName: string;            // Nombre completo
  photoURL?: string;              // URL de foto de perfil
  rol: 'admin' | 'manager' | 'supervisor' | 'employee';  // Rol principal
  roles?: string[];               // Roles adicionales (array)
  departamentoId?: string;        // Referencia a departamento
  proyectoId?: string;            // Referencia a proyecto asignado
  telefono?: string;              // Teléfono de contacto
  whatsapp?: string;              // WhatsApp
  direccion?: string;             // Dirección
  activo: boolean;                // Estado activo/inactivo
  fechaCreacion: number;          // Timestamp de creación
  fechaActualizacion: number;     // Timestamp de última actualización
  ultimoAcceso?: number;          // Timestamp del último acceso
  preferencias?: {
    tema: 'claro' | 'oscuro' | 'auto';
    idioma: string;
    notificacionesEmail: boolean;
    notificacionesPush: boolean;
  };
}
```

**Campos de búsqueda recomendados:**
- `email` (ascending)
- `rol` (ascending)
- `departamentoId` (ascending)
- `proyectoId` (ascending)
- `activo` (ascending)

**Índices compuestos recomendados:**
```json
{
  "collectionId": "users",
  "fields": [
    { "fieldPath": "rol", "order": "ASCENDING" },
    { "fieldPath": "departamentoId", "order": "ASCENDING" }
  ]
}
```

---

### 2.2 Colección: `personal`

Datos de trabajadores/empleados del sistema.

```typescript
interface Worker {
  ID_Trabajador: string;          // ID único del trabajador (document ID)
  Nombre_Completo: string;        // Nombre completo
  DPI_CUI: string;                // DPI o CUI (documento de identificación)
  Puesto: string;                 // Puesto de trabajo
  Jefe_Inmediato?: string;        // Nombre del jefe inmediato
  Telefono: string;               // Teléfono móvil
  WhatsApp: string;                // WhatsApp
  Direccion: string;               // Dirección residencial
  Fotografia_URL?: string;         // URL de foto del trabajador
  Codigo_QR_Data: string;          // JSON string con datos para QR
  Fecha_Registro: string;          // ISO-8601 (p. ej. 2026-09-17T14:05:22.123Z)
                                   // firestore.rules acepta string ISO, timestamp
                                   // o número > 0 (isValidDateValue)
  Fecha_Baja?: number;             // Timestamp de baja (si aplica)
  Motivo_Baja?: string;            // Motivo de baja
  Estado: 'Activo' | 'Inactivo' | 'Eliminado' | 'Suspendido';
  departamentoId: string;          // Referencia a departamento
  proyectoId: string;              // Referencia a proyecto/obra
  Salario?: number;                // Salario base
  Tipo_Contrato?: string;          // Tipo de contrato
  Fecha_Inicio?: number;           // Fecha de inicio de labores
  Fecha_Fin?: number;               // Fecha de fin de contrato (si aplica)
  Vacaciones_Dias?: number;        // Días de vacaciones disponibles
  Horas_Extra_Acumuladas?: number; // Horas extra acumuladas
}
```

**Campos de búsqueda recomendados:**
- `Estado` (ascending)
- `departamentoId` (ascending)
- `proyectoId` (ascending)
- `Puesto` (ascending)
- `Fecha_Registro` (descending)
- `DPI_CUI` (ascending) - para búsquedas únicas

**Índices compuestos recomendados:**
```json
{
  "collectionId": "personal",
  "fields": [
    { "fieldPath": "Estado", "order": "ASCENDING" },
    { "fieldPath": "departamentoId", "order": "ASCENDING" }
  ]
},
{
  "collectionId": "personal",
  "fields": [
    { "fieldPath": "Estado", "order": "ASCENDING" },
    { "fieldPath": "proyectoId", "order": "ASCENDING" }
  ]
},
{
  "collectionId": "personal",
  "fields": [
    { "fieldPath": "proyectoId", "order": "ASCENDING" },
    { "fieldPath": "Fecha_Registro", "order": "DESCENDING" }
  ]
}
```

---

### 2.3 Colección: `asistencias`

Registros de marcación de entrada, salida, y horas extra.

```typescript
interface Attendance {
  ID_Marcacion: string;            // ID único de la marcación (document ID)
  ID_Registro: string;             // ID de registro (puede ser igual a ID_Marcacion)
  ID_Trabajador: string;           // Referencia al trabajador
  Nombre_Trabajador: string;       // Nombre del trabajador (denormalizado para reportes)
  Fecha: string;                   // Fecha de la marcación (YYYY-MM-DD)
  Tipo_Marcacion: 'Entrada' | 'Salida_Receso' | 'Regreso_Receso' | 'Salida_Obra' | 'Entrada_Extra';
  Hora_Programada: string;         // Hora programada (HH:MM)
  Hora_Real: string;               // Hora real de marcación (HH:MM)
  Estado_Marcacion: 'A Tiempo' | 'Puntual' | 'Tolerancia' | 'Atraso' | 'Ausencia';
  Metodo_Registro: 'Manual' | 'QR' | 'GPS' | 'Web';
  Horas_Extra: number;             // Horas extra acumuladas en esta marcación
  Ubicacion_Obra: string;          // Nombre de la obra/proyecto
  GPS_Latitud?: number;            // Latitud GPS
  GPS_Longitud?: number;           // Longitud GPS
  GPS_Accuracy?: number;           // Precisión GPS en metros
  Geofence_Inside?: boolean;       // Si está dentro de geocerca
  Geofence_Distance?: number;      // Distancia al centro de geocerca (metros)
  Timestamp: number;               // Timestamp de la marcación
  observaciones?: string;          // Observaciones adicionales
  corregidoPor?: string;           // UID del usuario que corrigió
  corregidoEn?: number;            // Timestamp de corrección
}
```

**Campos de búsqueda recomendados:**
- `ID_Trabajador` (ascending)
- `Fecha` (ascending)
- `Tipo_Marcacion` (ascending)
- `Estado_Marcacion` (ascending)
- `Timestamp` (descending)

**Índices compuestos recomendados:**
```json
{
  "collectionId": "asistencias",
  "fields": [
    { "fieldPath": "ID_Trabajador", "order": "ASCENDING" },
    { "fieldPath": "Fecha", "order": "ASCENDING" },
    { "fieldPath": "Hora_Real", "order": "ASCENDING" }
  ]
},
{
  "collectionId": "asistencias",
  "fields": [
    { "fieldPath": "Fecha", "order": "ASCENDING" },
    { "fieldPath": "Tipo_Marcacion", "order": "ASCENDING" },
    { "fieldPath": "Hora_Real", "order": "ASCENDING" }
  ]
},
{
  "collectionId": "asistencias",
  "fields": [
    { "fieldPath": "proyectoId", "order": "ASCENDING" },
    { "fieldPath": "Fecha", "order": "ASCENDING" },
    { "fieldPath": "Timestamp", "order": "DESCENDING" }
  ]
}
```

---

### 2.4 Colección: `departamentos`

Departamentos organizacionales de la empresa.

```typescript
interface Departamento {
  ID_Departamento: string;         // ID único del departamento (document ID)
  Nombre: string;                  // Nombre del departamento
  Descripcion: string;             // Descripción
  Activo: boolean;                 // Estado activo/inactivo
  Fecha_Creacion: number;          // Timestamp de creación
  Fecha_Actualizacion: number;     // Timestamp de última actualización
  Responsable?: string;            // UID del responsable
  Presupuesto?: number;            // Presupuesto asignado
}
```

---

### 2.5 Colección: `proyectos`

Proyectos u obras de construcción.

```typescript
interface Proyecto {
  ID_Proyecto: string;             // ID único del proyecto (document ID)
  Nombre: string;                  // Nombre del proyecto/obra
  Descripcion: string;             // Descripción detallada
  Direccion: string;               // Dirección física
  Latitud?: number;                // Latitud del centro
  Longitud?: number;               // Longitud del centro
  Radio_Geocerca?: number;         // Radio de geocerca en metros
  Activo: boolean;                 // Estado activo/inactivo
  Fecha_Inicio: number;            // Timestamp de inicio
  Fecha_Fin?: number;              // Timestamp de fin (si aplica)
  Fecha_Creacion: number;          // Timestamp de creación
  Fecha_Actualizacion: number;     // Timestamp de última actualización
  Encargado?: string;              // UID del encargado
  departamentoId: string;          // Referencia a departamento
  Presupuesto?: number;            // Presupuesto total
  Avance?: number;                 // Porcentaje de avance (0-100)
}
```

---

### 2.6 Colección: `configuracion`

Configuración global del sistema.

```typescript
interface Configuracion {
  ID_Config: string;               // ID de configuración (usualmente 'general')
  Obra: string;                    // Nombre de la obra/empresa
  Encargado: string;               // Nombre del encargado/administrador
  Tolerancia: number;              // Tolerancia de marcación en minutos
  Horarios: {
    Entrada: string;               // HH:MM
    Salida_Receso: string;         // HH:MM
    Regreso_Receso: string;        // HH:MM
    Salida_Obra: string;           // HH:MM
  };
  GPS: {
    Habilitado: boolean;           // GPS habilitado
    Requerido: boolean;            // GPS requerido para marcar
    Radio: number;                 // Radio de geocerca en metros
  };
  Scanner_PIN?: string;            // PIN para escáner de campo
  Logo_URL?: string;                // URL del logo de la empresa
  Moneda: string;                  // Moneda (ej: GTQ, USD)
  Zona_Horaria: string;            // Zona horaria (ej: America/Guatemala)
  Modo_Offline: boolean;           // Modo offline activado
  Sincronizacion_Auto: boolean;    // Sincronización automática
  Fecha_Actualizacion: number;     // Timestamp de última actualización
}
```

---

### 2.7 Colección: `roles`

Definiciones de roles y permisos del sistema.

```typescript
interface Rol {
  ID_Rol: string;                  // ID del rol (document ID)
  Nombre: string;                  // Nombre del rol
  Descripcion: string;             // Descripción del rol
  Permisos: string[];              // Lista de permisos
  Activo: boolean;                 // Estado activo/inactivo
  Fecha_Creacion: number;          // Timestamp de creación
  Nivel: number;                   // Nivel jerárquico (1=admin, 2=manager, etc.)
}

// Permisos disponibles:
const PERMISOS = [
  'personal:read', 'personal:create', 'personal:update', 'personal:delete',
  'asistencia:read', 'asistencia:create', 'asistencia:update', 'asistencia:delete',
  'reportes:read', 'reportes:export',
  'configuracion:read', 'configuracion:update',
  'usuarios:read', 'usuarios:create', 'usuarios:update', 'usuarios:delete',
  'roles:read', 'roles:create', 'roles:update', 'roles:delete',
  'proyectos:read', 'proyectos:create', 'proyectos:update', 'proyectos:delete',
  'departamentos:read', 'departamentos:create', 'departamentos:update', 'departamentos:delete',
  'logs:read', 'alertas:read', 'alertas:create', 'alertas:update', 'alertas:delete'
];
```

---

### 2.8 Colección: `alertas`

Alertas y notificaciones del sistema.

```typescript
interface Alerta {
  ID_Alerta: string;               // ID único de la alerta (document ID)
  Tipo: 'info' | 'warning' | 'error' | 'success';
  Mensaje: string;                 // Mensaje de la alerta
  Detalles?: string;               // Detalles adicionales
  Destinatario?: string;           // UID del destinatario (si es personal)
  ProyectoId?: string;             // Proyecto relacionado
  Timestamp: number;               // Timestamp de creación
  Revisada: boolean;               // Si fue revisada
  Fecha_Revision?: number;         // Timestamp de revisión
  Revisada_Por?: string;           // UID del usuario que revisó
}
```

---

### 2.9 Colección: `notificaciones`

Notificaciones push/email por usuario.

```typescript
interface Notificacion {
  ID_Notificacion: string;         // ID único (document ID)
  UsuarioId: string;               // UID del usuario destinatario
  Titulo: string;                   // Título de la notificación
  Mensaje: string;                  // Cuerpo del mensaje
  Tipo: 'info' | 'warning' | 'error' | 'success';
  Leida: boolean;                   // Si fue leída
  Fecha_Lectura?: number;           // Timestamp de lectura
  Fecha_Creacion: number;           // Timestamp de creación
  Datos_Adicionales?: map;          // Datos adicionales para la app
  Accion?: {                        // Acción asociada
    tipo: string;
    payload: map;
  };
}
```

---

### 2.10 Colección: `logs`

Registro de auditoría inmutable de todas las operaciones.

```typescript
interface Log {
  ID_Log: string;                  // ID único del log (document ID)
  Accion: string;                  // Acción realizada (create, update, delete, etc.)
  Coleccion: string;               // Colección afectada
  DocumentoId: string;             // ID del documento afectado
  UsuarioId: string;               // UID del usuario que realizó la acción
  Email: string;                    // Email del usuario
  Rol: string;                      // Rol del usuario en el momento
  Timestamp: number;               // Timestamp de la acción
  Detalles: map;                   // Detalles adicionales
  IP?: string;                     // Dirección IP (si está disponible)
  UserAgent?: string;               // User agent (si está disponible)
}
```

---

## 3. Índices Firestore Recomendados

### 3.1 Índices Simples (Auto-creados por Firestore)

- `personal/Estado` (ascending)
- `personal/departamentoId` (ascending)
- `personal/proyectoId` (ascending)
- `asistencias/ID_Trabajador` (ascending)
- `asistencias/Fecha` (ascending)
- `asistencias/Timestamp` (descending)
- `users/email` (ascending)
- `users/rol` (ascending)

### 3.2 Índices Compuestos (Requieren creación manual)

```json
{
  "indexes": [
    {
      "collectionId": "asistencias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ID_Trabajador", "order": "ASCENDING" },
        { "fieldPath": "Fecha", "order": "ASCENDING" },
        { "fieldPath": "Hora_Real", "order": "ASCENDING" }
      ]
    },
    {
      "collectionId": "personal",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "Estado", "order": "ASCENDING" },
        { "fieldPath": "departamentoId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionId": "personal",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "Estado", "order": "ASCENDING" },
        { "fieldPath": "proyectoId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionId": "asistencias",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "proyectoId", "order": "ASCENDING" },
        { "fieldPath": "Fecha", "order": "ASCENDING" },
        { "fieldPath": "Timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionId": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "rol", "order": "ASCENDING" },
        { "fieldPath": "departamentoId", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 4. Consideraciones de Diseño

### 4.1 Denormalización Estratégica

- **Nombre_Trabajador** en `asistencias`: Se denormaliza para evitar joins en reportes.
- **Nombre_Obra** en `asistencias`: Se almacena en la marcación para reportes históricos.
- **Hora_Programada** en `asistencias`: Se almacena para auditoría de cumplimiento.

### 4.2 Escalabilidad

- **Sharding por fecha**: `asistencias` puede particionarse por mes/año si crece demasiado.
- **TTL automático**: Configurar TTL en `logs` (ej: 2 años) y `notificaciones` (ej: 30 días).
- **Archivado**: Mover asistencias antiguas a Cloud Storage/Archi

### 4.3 Consistencia

- **IDs como strings**: Todos los IDs son strings para consistencia.
- **Timestamps en milisegundos**: Todos los timestamps usan `Date.now()` o equivalentes.
- **Fechas como ISO strings**: `Fecha` usa formato `YYYY-MM-DD`.

### 4.4 Seguridad

- **Custom claims**: Roles almacenados en tokens de Firebase Auth.
- **Validación en reglas**: Todas las escrituras validan estructura y tipos.
- **Auditoría completa**: Todos los cambios se registran en `logs`.
- **Inmutabilidad**: `logs` y `asistencias` antiguas no se pueden modificar/eliminar.

---

## 5. Migración desde Esquema Actual

### 5.1 Cambios Requeridos

| Colección Actual | Nueva Colección | Acción |
|------------------|-----------------|--------|
| `personal` | `personal` | Agregar campos: `departamentoId`, `proyectoId`, `Fecha_Baja`, `Motivo_Baja`, `Salario`, `Tipo_Contrato` |
| `asistencias` | `asistencias` | Agregar campos: `observaciones`, `corregidoPor`, `corregidoEn`, `proyectoId` |
| `configuracion` | `configuracion` | Agregar campos: `Moneda`, `Zona_Horaria`, `Modo_Offline`, `Sincronizacion_Auto` |
| `alertas` | `alertas` | Agregar campos: `Tipo`, `Destinatario`, `ProyectoId`, `Fecha_Revision`, `Revisada_Por` |
| N/A | `users` | Nueva colección |
| N/A | `roles` | Nueva colección |
| N/A | `departamentos` | Nueva colección |
| N/A | `proyectos` | Nueva colección |
| N/A | `notificaciones` | Nueva colección |
| N/A | `logs` | Nueva colección |

### 5.2 Script de Migración

Se recomienda crear un Cloud Function que migre los datos existentes:

```javascript
// Función para migrar personal existente
exports.migrarPersonal = functions.firestore
  .document('personal/{workerId}')
  .onWrite((change, context) => {
    const data = change.after.data();
    if (!data.departamentoId) {
      return change.after.ref.update({
        departamentoId: 'DEFAULT',
        proyectoId: 'DEFAULT'
      });
    }
    return null;
  });
```

---

## 6. Costos Estimados

### 6.1 Lecturas/Escrituras Diarias (Estimación para 500 trabajadores)

- **Lecturas**: ~2,000/día (consultas de personal, asistencias, config)
- **Escrituras**: ~1,500/día (marcaciones, actualizaciones)
- **Total operaciones/día**: ~3,500

### 6.2 Costo Mensual Aproximado

- **Lecturas**: 3,500 × 30 = 105,000 → Gratis (dentro del límite gratuito de 50K/día)
- **Escrituras**: 1,500 × 30 = 45,000 → $0.18 por 100K = $0.09/mes
- **Almacenamiento**: ~1GB → Gratis
- **Total estimado**: < $1/mes (dentro del plan gratuito de Firebase)

---

## 7. Próximos Pasos

1. Crear colecciones `departamentos` y `proyectos` con datos iniciales
2. Implementar Cloud Functions para custom claims
3. Crear índice compuesto para `asistencias`
4. Implementar sistema de notificaciones
5. Configurar TTL para `logs` y `notificaciones`
