# Test Cases - Firestore Security Rules & Online/Offline Behavior

## 1. Objetivo

Este documento describe los casos de prueba para validar el comportamiento del sistema bajo diferentes estados de conexión y escenarios de seguridad, asegurando que las reglas de Firestore funcionen correctamente en modo online y offline.

---

## 2. Estrategia de Pruebas

### 2.1 Tipos de Pruebas

1. **Pruebas Unitarias**: Validan funciones individuales de seguridad
2. **Pruebas de Integración**: Validan flujos completos de CRUD
3. **Pruebas de Seguridad**: Validan RBAC y restricciones de acceso
4. **Pruebas de Offline**: Validan sincronización y persistencia local
5. **Pruebas de Latencia**: Simulan condiciones de red pobres

### 2.2 Entornos de Prueba

- **Firestore Emulator**: Para pruebas locales de seguridad
- **Proyecto Firebase de Prueba**: Para pruebas en ambiente real
- **Playwright/E2E**: Para pruebas de UI completas
- **Jest**: Para pruebas unitarias de lógica de negocio

---

## 3. Pruebas de Seguridad (Firestore Rules)

### 3.1 Pruebas de Autenticación Básica

#### TC-SEC-001: Acceso sin autenticación
- **Descripción**: Usuario no autenticado intenta leer/escribir
- **Precondiciones**: Ninguna
- **Pasos**:
  1. Iniciar sesión como usuario anónimo
  2. Intentar leer `/personal/TRAB-001`
  3. Intentar crear documento en `/personal`
  4. Intentar leer `/asistencias`
- **Resultado Esperado**: Todos los accesos denegados con error `permission-denied`
- **Tipo**: Negativa

#### TC-SEC-002: Acceso con autenticación básica
- **Descripción**: Usuario autenticado sin roles especiales
- **Precondiciones**: Usuario autenticado con `employee` claim
- **Pasos**:
  1. Autenticar usuario employee
  2. Leer `/personal` (debe permitir)
  3. Crear `/personal` (debe denegar)
  4. Actualizar `/personal` (debe denegar)
  5. Leer `/asistencias` (debe permitir)
  6. Crear `/asistencias` (debe denegar)
- **Resultado Esperado**: Lecturas permitidas, escrituras denegadas
- **Tipo**: Autorización básica

### 3.2 Pruebas de Roles RBAC

#### TC-SEC-003: Rol Employee - Acceso limitado a datos propios
- **Descripción**: Employee solo ve sus propios datos
- **Precondiciones**: 
  - Usuario autenticado como employee con `uid: EMP-001`
  - Documento en `/personal/EMP-001` existe
  - Documento en `/personal/EMP-002` existe
- **Pasos**:
  1. Autenticar como employee
  2. Leer `/personal/EMP-001` → debe permitir
  3. Leer `/personal/EMP-002` → debe denegar
  4. Leer `/asistencias` → debe denegar (solo ve los suyos)
  5. Leer `/asistencias` filtrado por `ID_Trabajador == EMP-001` → debe permitir
- **Resultado Esperado**: Acceso solo a datos propios
- **Tipo**: RBAC Employee

#### TC-SEC-004: Rol Supervisor - Acceso a proyecto asignado
- **Descripción**: Supervisor ve trabajadores y asistencias de su proyecto
- **Precondiciones**:
  - Usuario autenticado como supervisor
  - `proyectoId: PROY-001` en perfil de usuario
  - Trabajadores en `/personal` con `proyectoId: PROY-001` y `proyectoId: PROY-002`
- **Pasos**:
  1. Autenticar como supervisor
  2. Leer `/personal` filtrado por `proyectoId == PROY-001` → debe permitir
  3. Leer `/personal` filtrado por `proyectoId == PROY-002` → debe denegar
  4. Crear `/asistencias` → debe permitir
  5. Actualizar `/asistencias` → debe denegar
- **Resultado Esperado**: Acceso solo a datos de su proyecto
- **Tipo**: RBAC Supervisor

#### TC-SEC-005: Rol Manager - Gestión de trabajadores
- **Descripción**: Manager puede crear/actualizar trabajadores
- **Precondiciones**: Usuario autenticado como manager
- **Pasos**:
  1. Autenticar como manager
  2. Crear `/personal/TRAB-NEW` con datos válidos → debe permitir
  3. Actualizar `/personal/TRAB-001` (campos permitidos) → debe permitir
  4. Eliminar `/personal/TRAB-001` → debe denegar (solo admin elimina)
  5. Crear `/asistencias` → debe permitir
  6. Actualizar `/asistencias` → debe permitir
- **Resultado Esperado**: Acceso completo a trabajadores, limitado en asistencias
- **Tipo**: RBAC Manager

#### TC-SEC-006: Rol Admin - Acceso completo
- **Descripción**: Admin tiene acceso completo a todas las operaciones
- **Precondiciones**: Usuario autenticado como admin
- **Pasos**:
  1. Autenticar como admin
  2. CRUD completo en `/personal` → todos permitidos
  3. CRUD completo en `/asistencias` → todos permitidos
  4. CRUD completo en `/configuracion` → todos permitidos
  5. CRUD completo en `/users` → todos permitidos
  6. CRUD completo en `/roles` → todos permitidos
  7. Lectura en `/logs` → permitida
  8. Escritura en `/logs` → denegada (solo sistema)
- **Resultado Esperado**: Acceso completo excepto escritura en logs
- **Tipo**: RBAC Admin

### 3.3 Pruebas de Validación de Datos

#### TC-SEC-007: Validación de campos requeridos en Personal
- **Descripción**: Verificar que todos los campos requeridos estén presentes
- **Precondiciones**: Usuario autenticado como admin
- **Pasos**:
  1. Intentar crear `/personal` sin `Nombre_Completo` → debe denegar
  2. Intentar crear `/personal` sin `DPI_CUI` → debe denegar
  3. Intentar crear `/personal` sin `Puesto` → debe denegar
  4. Intentar crear `/personal` con `DPI_CUI` de 5 caracteres → debe denegar
  5. Intentar crear `/personal` con `Estado: "Invalid"` → debe denegar
  6. Crear `/personal` con todos los campos válidos → debe permitir
- **Resultado Esperado**: Validación estricta de campos
- **Tipo**: Validación de datos

#### TC-SEC-008: Validación de campos requeridos en Asistencias
- **Descripción**: Verificar que todos los campos requeridos estén presentes
- **Precondiciones**: Usuario autenticado como admin
- **Pasos**:
  1. Intentar crear `/asistencias` sin `ID_Marcacion` → debe denegar
  2. Intentar crear `/asistencias` sin `ID_Trabajador` → debe denegar
  3. Intentar crear `/asistencias` sin `Fecha` → debe denegar
  4. Intentar crear `/asistencias` con `Tipo_Marcacion: "Invalid"` → debe denegar
  5. Intentar crear `/asistencias` con `Estado_Marcacion: "Invalid"` → debe denegar
  6. Crear `/asistencias` con todos los campos válidos → debe permitir
- **Resultado Esperado**: Validación estricta de campos
- **Tipo**: Validación de datos

#### TC-SEC-009: Validación de longitud de campos
- **Descripción**: Verificar límites de longitud en strings
- **Precondiciones**: Usuario autenticado como admin
- **Pasos**:
  1. Crear `/personal` con `Nombre_Completo` de 150 caracteres → debe denegar
  2. Crear `/personal` con `DPI_CUI` de 5 caracteres → debe denegar
  3. Crear `/personal` con `Telefono` de 30 caracteres → debe denegar
  4. Crear `/asistencias` con `Nombre_Trabajador` de 150 caracteres → debe denegar
- **Resultado Esperado**: Validación de longitudes máximas
- **Tipo**: Validación de datos

#### TC-SEC-010: Validación de tipos de datos
- **Descripción**: Verificar que los tipos de datos sean correctos
- **Precondiciones**: Usuario autenticado como admin
- **Pasos**:
  1. Crear `/personal` con `Fecha_Registro: "invalid"` → debe denegar
  2. Crear `/asistencias` con `Timestamp: "invalid"` → debe denegar
  3. Crear `/asistencias` con `Horas_Extra: "cinco"` → debe denegar
  4. Crear `/configuracion` con `tolerancia: "diez"` → debe denegar
- **Resultado Esperado**: Validación de tipos
- **Tipo**: Validación de datos

### 3.4 Pruebas de Operador Autorizado

#### TC-SEC-011: Operador autorizado puede crear asistencias
- **Descripción**: El operador autorizado puede marcar asistencias
- **Precondiciones**: 
  - Usuario autenticado como `sistemadecontrol090@gmail.com`
  - Email verificado
- **Pasos**:
  1. Autenticar como operador autorizado
  2. Crear `/asistencias` con datos válidos → debe permitir
  3. Actualizar `/asistencias` existente → debe denegar
  4. Eliminar `/asistencias` → debe denegar
- **Resultado Esperado**: Solo create permitido para operador
- **Tipo**: Operador autorizado

---

## 4. Pruebas de Comportamiento Online/Offline

### 4.1 Pruebas de Sincronización Online

#### TC-ONLINE-001: Sincronización exitosa
- **Descripción**: Los datos se sincronizan correctamente con Firestore
- **Precondiciones**:
  - Dispositivo online
  - Firebase conectado
  - Usuario autenticado como admin
- **Pasos**:
  1. Crear trabajador en modo online
  2. Verificar que el documento se creó en Firestore
  3. Actualizar trabajador en modo online
  4. Verificar que el documento se actualizó en Firestore
  5. Eliminar trabajador en modo online
  6. Verificar que el documento se eliminó de Firestore
- **Resultado Esperado**: Todos los cambios reflejados en Firestore
- **Tipo**: Online sync

#### TC-ONLINE-002: Conflicto de sincronización
- **Descripción**: Manejo de conflictos cuando hay cambios en local y remoto
- **Precondiciones**:
  - Dispositivo con datos locales modificados
  - Mismos documentos modificados en Firestore por otro dispositivo
- **Pasos**:
  1. Modificar trabajador en dispositivo A (offline)
  2. Modificar mismo trabajador en dispositivo B (online)
  3. Sincronizar dispositivo A (online)
  4. Verificar resolución de conflicto
- **Resultado Esperado**: Última modificación gana (last-write-wins) o merge inteligente
- **Tipo**: Conflict resolution

### 4.2 Pruebas de Comportamiento Offline

#### TC-OFFLINE-001: Creación de trabajador offline
- **Descripción**: Crear trabajador sin conexión y verificar cola
- **Precondiciones**:
  - Dispositivo offline
  - localStorage disponible
- **Pasos**:
  1. Desconectar red
  2. Crear trabajador nuevo
  3. Verificar que aparece en tabla local
  4. Verificar que se agregó a `cpc_offline_queue`
  5. Reconectar red
  6. Esperar sincronización automática
  7. Verificar que el trabajador se creó en Firestore
- **Resultado Esperado**: Datos persistentes localmente, sincronización al reconectar
- **Tipo**: Offline creation

#### TC-OFFLINE-002: Actualización de asistencia offline
- **Descripción**: Actualizar asistencia sin conexión
- **Precondiciones**:
  - Dispositivo offline
  - Asistencia existente en cache local
- **Pasos**:
  1. Desconectar red
  2. Modificar horas extra de una asistencia
  3. Verificar cambio en cache local
  4. Verificar que se agregó a `cpc_offline_queue`
  5. Reconectar red
  6. Esperar sincronización
  7. Verificar actualización en Firestore
- **Resultado Esperado**: Actualización persistida y sincronizada
- **Tipo**: Offline update

#### TC-OFFLINE-003: Eliminación offline con fallback local
- **Descripción**: Eliminar trabajador offline (cambio de estado a Inactivo)
- **Precondiciones**:
  - Dispositivo offline
  - Trabajador activo en cache
- **Pasos**:
  1. Desconectar red
  2. Eliminar trabajador (cambiar estado a Inactivo)
  3. Verificar que el trabajador ya no aparece en lista de activos
  4. Verificar que se agregó a `cpc_offline_queue`
  5. Reconectar red
  6. Esperar sincronización
  7. Verificar que el estado cambió a Inactivo en Firestore
- **Resultado Esperado**: Eliminación lógica persistida y sincronizada
- **Tipo**: Offline delete

#### TC-OFFLINE-004: Cola de sincronización acumulada
- **Descripción**: Múltiples operaciones offline se sincronizan en orden
- **Precondiciones**:
  - Dispositivo offline
- **Pasos**:
  1. Desconectar red
  2. Crear 3 trabajadores
  3. Actualizar 2 trabajadores
  4. Eliminar 1 trabajador
  5. Crear 5 asistencias
  6. Actualizar 2 asistencias
  7. Verificar queue tiene 11 items
  8. Reconectar red
  9. Esperar sincronización completa
  10. Verificar queue vacía
  11. Verificar todos los cambios en Firestore
- **Resultado Esperado**: Todos los items sincronizados en orden FIFO
- **Tipo**: Queue processing

### 4.3 Pruebas de Latencia y Degradación

#### TC-LATENCY-001: Conexión degradada
- **Descripción**: App funciona con conexión lenta/inestable
- **Precondiciones**:
  - Red con alta latencia (>2s)
  - Timeouts configurados
- **Pasos**:
  1. Simular red lenta
  2. Intentar crear trabajador
  3. Verificar timeout o fallback a local
  4. Verificar mensaje de estado al usuario
- **Resultado Esperado**: Fallback a local mode, sin crash
- **Tipo**: Degraded mode

#### TC-LATENCY-002: Reconexión automática
- **Descripción**: App se reconecta automáticamente después de perder conexión
- **Precondiciones**:
  - Dispositivo online
  - Firebase conectado
- **Pasos**:
  1. Conectar y verificar estado "connected"
  2. Desconectar red
  3. Verificar estado cambia a "offline"
  4. Reconectar red
  5. Verificar estado cambia a "connected"
  6. Verificar sincronización automática de cola
- **Resultado Esperado**: Reconexión y sync automática
- **Tipo**: Auto-reconnect

### 4.4 Pruebas de Persistencia Local

#### TC-PERSIST-001: Persistencia en localStorage
- **Descripción**: Los datos sobreviven a recargas de página
- **Precondiciones**:
  - Datos locales creados
- **Pasos**:
  1. Crear trabajador en modo local
  2. Recargar página (F5)
  3. Verificar que el trabajador sigue en la tabla
  4. Verificar que `cpc_personal_cache` tiene los datos
- **Resultado Esperado**: Datos persistentes en localStorage
- **Tipo**: Local persistence

#### TC-PERSIST-002: Limpieza de cache
- **Descripción**: El cache se limpia correctamente al hacer logout
- **Precondiciones**:
  - Usuario autenticado
  - Datos en cache
- **Pasos**:
  1. Cerrar sesión
  2. Verificar que `cpc_personal_cache` está vacío
  3. Verificar que `cpc_asistencias_cache` está vacío
  4. Verificar que `cpc_offline_queue` está vacío
- **Resultado Esperado**: Cache limpiado al logout
- **Tipo**: Cache cleanup

---

## 5. Pruebas de Integración E2E

### 5.1 Flujo Completo de Registro de Personal

#### TC-E2E-001: Flujo completo de registro
- **Descripción**: Registrar trabajador, marcar asistencia, generar reporte
- **Precondiciones**:
  - Usuario autenticado como admin
  - Proyecto y departamento creados
- **Pasos**:
  1. Ir a módulo Personal
  2. Crear nuevo trabajador con todos los campos
  3. Verificar que aparece en tabla
  4. Ir a módulo Asistencia
  5. Seleccionar trabajador
  6. Marcar entrada
  7. Marcar salida
  8. Ir a módulo Reportes
  9. Generar reporte diario
  10. Exportar PDF
- **Resultado Esperado**: Flujo completo sin errores
- **Tipo**: E2E happy path

### 5.2 Flujo de Sincronización Offline → Online

#### TC-E2E-002: Sincronización completa
- **Descripción**: Trabajar offline y sincronizar al reconectar
- **Precondiciones**:
  - Dispositivo con datos iniciales en Firestore
- **Pasos**:
  1. Sincronizar datos iniciales
  2. Desconectar red
  3. Crear 2 trabajadores
  4. Marcar 4 asistencias
  5. Actualizar 1 trabajador
  6. Reconectar red
  7. Esperar sync automática
  8. Verificar en Firestore Console que todos los documentos existen
  9. Verificar queue vacía
  10. Recargar página
  11. Verificar que los datos se cargan desde Firestore
- **Resultado Esperado**: Sincronización completa y consistente
- **Tipo**: E2E offline sync

### 5.3 Flujo de Multi-Usuario

#### TC-E2E-003: Múltiples usuarios simultáneos
- **Descripción**: Dos dispositivos modifican datos simultáneamente
- **Precondiciones**:
  - Dos dispositivos con mismos credenciales
  - Mismo trabajador en ambos dispositivos
- **Pasos**:
  1. Dispositivo A: Modificar teléfono del trabajador
  2. Dispositivo B: Modificar dirección del mismo trabajador
  3. Dispositivo A: Sincronizar
  4. Dispositivo B: Sincronizar
  5. Verificar que ambos cambios se aplicaron
- **Resultado Esperado**: Merge de cambios sin conflictos
- **Tipo**: Multi-user sync

---

## 6. Pruebas de Rendimiento

### 6.1 Pruebas de Escalabilidad

#### TC-PERF-001: Carga de 1000 trabajadores
- **Descripción**: App maneja correctamente 1000 trabajadores
- **Pasos**:
  1. Cargar 1000 trabajadores en Firestore
  2. Abrir app en dispositivo
  3. Ir a módulo Personal
  4. Verificar tiempo de carga < 3s
  5. Filtrar por departamento
  6. Verificar tiempo de filtrado < 500ms
- **Resultado Esperado**: Rendimiento aceptable con muchos datos
- **Tipo**: Performance

#### TC-PERF-002: Carga de 500 asistencias por día
- **Descripción**: App maneja muchas asistencias diarias
- **Pasos**:
  1. Cargar 500 asistencias para una fecha
  2. Generar reporte diario
  3. Verificar tiempo de generación < 2s
  4. Exportar CSV
  5. Verificar tiempo de exportación < 1s
- **Resultado Esperado**: Reportes generados rápidamente
- **Tipo**: Performance

### 6.2 Pruebas de Storage

#### TC-STORAGE-001: Uso de localStorage
- **Descripción**: Verificar límites de localStorage
- **Pasos**:
  1. Llenar cache con 500 trabajadores
  2. Verificar tamaño de localStorage < 5MB
  3. Llenar cache con 1000 asistencias
  4. Verificar tamaño de localStorage < 10MB
- **Resultado Esperado**: Uso de storage dentro de límites seguros
- **Tipo**: Storage limits

---

## 7. Pruebas de Casos Extremos (Edge Cases)

### 7.1 Datos Corruptos

#### TC-EDGE-001: Manejo de datos corruptos en cache
- **Descripción**: App se recupera de localStorage corrupto
- **Pasos**:
  1. Modificar `cpc_personal_cache` con JSON inválido
  2. Recargar página
  3. Verificar que la app no crashea
  4. Verificar que se inicializa con array vacío
- **Resultado Esperado**: Recuperación graceful
- **Tipo**: Error handling

#### TC-EDGE-002: Manejo de Firestore no disponible
- **Descripción**: App funciona cuando Firestore está caído
- **Pasos**:
  1. Configurar Firestore endpoint inválido
  2. Iniciar app
  3. Verificar que funciona en modo local
  4. Verificar mensaje de estado "Modo local"
- **Resultado Esperado**: App funcional en modo degradado
- **Tipo**: Fallback

### 7.2 Validación de IDs Duplicados

#### TC-EDGE-003: Prevenir duplicado de DPI
- **Descripción**: No se puede crear trabajador con DPI duplicado
- **Pasos**:
  1. Crear trabajador con DPI "1234567890123"
  2. Intentar crear otro trabajador con mismo DPI
  3. Verificar error de duplicado
- **Resultado Esperado**: Segundo registro rechazado
- **Tipo**: Uniqueness

### 7.3 Límites de Tamaño

#### TC-EDGE-004: Payload demasiado grande
- **Descripción**: Rechazar documentos que excedan límites
- **Pasos**:
  1. Intentar crear `/personal` con 25 campos → debe denegar
  2. Intentar crear `/asistencias` con 25 campos → debe denegar
  3. Intentar crear `/configuracion` con 35 campos → debe denegar
- **Resultado Esperado**: Rechazo por tamaño excesivo
- **Tipo**: Size limits

---

## 8. Pruebas de Accesibilidad y UI

### 8.1 Pruebas de Responsive Design

#### TC-UI-001: Vista móvil (375px)
- **Descripción**: App se ve correctamente en móvil pequeño
- **Pasos**:
  1. Abrir app en viewport 375px
  2. Verificar sidebar oculto
  3. Verificar botón de menú visible
  4. Navegar por todos los módulos
  5. Verificar no hay scroll horizontal
- **Resultado Esperado**: UI funcional en móvil
- **Tipo**: Responsive

#### TC-UI-002: Vista tablet (768px)
- **Descripción**: App se ve correctamente en tablet
- **Pasos**:
  1. Abrir app en viewport 768px
  2. Verificar layout adaptado
  3. Verificar tablas legibles
  4. Verificar botones accesibles
- **Resultado Esperado**: UI funcional en tablet
- **Tipo**: Responsive

### 8.2 Pruebas de Accesibilidad

#### TC-A11Y-001: Navegación por teclado
- **Descripción**: Todos los elementos son accesibles por teclado
- **Pasos**:
  1. Navegar usando solo Tab
  2. Verificar que todos los botones son alcanzables
  3. Verificar que los modales se pueden cerrar con Escape
  4. Verificar que el foco es visible en todo momento
- **Resultado Esperado**: Navegación completa por teclado
- **Tipo**: Accessibility

---

## 9. Pruebas de Seguridad Adicionales

### 9.1 Pruebas de Inyección

#### TC-SEC-INJ-001: Prevenir inyección de scripts
- **Descripción**: Los campos de texto no permiten XSS
- **Pasos**:
  1. Crear trabajador con nombre: `<script>alert('XSS')</script>`
  2. Verificar que se almacena pero no se ejecuta
  3. Verificar que se escapa al mostrar en UI
- **Resultado Esperado**: XSS prevenido
- **Tipo**: Security

#### TC-SEC-INJ-002: Prevenir inyección en consultas
- **Descripción**: Los filtros de consulta son seguros
- **Pasos**:
  1. Intentar consulta con caracteres especiales
  2. Verificar que no causa error en Firestore
  3. Verificar que no retorna datos no autorizados
- **Resultado Esperado**: Consultas seguras
- **Tipo**: Security

### 9.2 Pruebas de Privilegios

#### TC-SEC-PRIV-001: Escalada de privilegios
- **Descripción**: Un usuario no puede elevar sus propios privilegios
- **Pasos**:
  1. Autenticar como employee
  2. Intentar actualizar propio perfil con `admin: true` → debe denegar
  3. Intentar actualizar propio perfil con `manager: true` → debe denegar
- **Resultado Esperado**: Escalada de privilegios prevenida
- **Tipo**: Security

#### TC-SEC-PRIV-002: Acceso a rutas protegidas
- **Descripción**: Solo admin puede acceder a rutas administrativas
- **Pasos**:
  1. Autenticar como employee
  2. Intentar acceder a `/users` → debe denegar
  3. Intentar acceder a `/roles` → debe permitir (read)
  4. Intentar crear `/roles` → debe denegar
- **Resultado Esperado**: Acceso restringido por rol
- **Tipo**: Security

---

## 10. Ejecución de Pruebas

### 10.1 Comandos de Prueba

```bash
# Ejecutar todas las pruebas unitarias
npm run test:unit

# Ejecutar pruebas E2E con Playwright
npx playwright test

# Ejecutar pruebas de seguridad de Firestore Rules
firebase emulators:exec "npm run test:rules"

# Ejecutar pruebas específicas
npm run test:unit -- --testNamePattern="firebase-client"
npx playwright test --grep "offline"
```

### 10.2 Configuración de Emuladores

```json
// firebase.json
{
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

### 10.3 Variables de Entorno para Pruebas

```bash
# .env.test
VITE_FIREBASE_API_KEY=test-api-key
VITE_FIREBASE_AUTH_DOMAIN=test-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=test-project
VITE_FIREBASE_STORAGE_BUCKET=test-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_USE_EMULATORS=true
VITE_FIRESTORE_EMULATOR_HOST=localhost:8080
VITE_AUTH_EMULATOR_HOST=localhost:9099
```

---

## 11. Criterios de Aceptación

### 11.1 Criterios Mínimos

- [ ] 100% de pruebas unitarias pasan
- [ ] 95% de pruebas E2E pasan
- [ ] 100% de pruebas de seguridad pasan
- [ ] Tiempo de carga < 3s en 3G
- [ ] Sincronización offline < 30s después de reconexión
- [ ] Sin errores de consola en navegación completa

### 11.2 Criterios de Seguridad

- [ ] Todas las reglas de Firestore validadas
- [ ] RBAC funciona para todos los roles
- [ ] No hay bypass de autenticación
- [ ] Datos sensibles protegidos
- [ ] Auditoría completa de cambios

### 11.3 Criterios de Rendimiento

- [ ] App funciona con 1000+ trabajadores
- [ ] Reportes generados en < 2s
- [ ] Sincronización de 100 items en < 10s
- [ ] Uso de memoria < 100MB
- [ ] localStorage < 10MB

---

## 12. Próximos Pasos

1. Implementar pruebas unitarias de reglas de seguridad
2. Configurar emuladores de Firebase para CI/CD
3. Crear suite de pruebas automatizadas en GitHub Actions
4. Documentar procedimientos de deployment
5. Capacitar equipo en pruebas de seguridad Firestore
