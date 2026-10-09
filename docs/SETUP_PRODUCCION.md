# GUÍA COMPLETA DE ARRANQUE EN PRODUCCIÓN
## Control Personal Campo v1.5.0

Sigue estas fases **en orden**. Cada paso está pensado para que lo ejecutes
una sola vez antes de ingresar datos reales.

---

## ÍNDICE

1. [Requisitos previos](#1-requisitos-previos)
2. [Configurar Firebase Console](#2-configurar-firebase-console)
3. [Desplegar reglas y funciones](#3-desplegar-reglas-y-funciones)
4. [Crear la cuenta del operador](#4-crear-la-cuenta-del-operador)
5. [Asignar permisos de administrador](#5-asignar-permisos-de-administrador)
6. [Verificar acceso end-to-end](#6-verificar-acceso-end-to-end)
7. [Desplegar en Vercel](#7-desplegar-en-vercel)
8. [Configurar la obra en la app](#8-configurar-la-obra-en-la-app)
9. [Dar de alta los primeros trabajadores](#9-dar-de-alta-los-primeros-trabajadores)
10. [Imprimir carnets QR](#10-imprimir-carnets-qr)
11. [Verificar el escáner de campo](#11-verificar-el-escáner-de-campo)
12. [Checklist de operación diaria](#12-checklist-de-operación-diaria)
13. [Resolución de problemas frecuentes](#13-resolución-de-problemas-frecuentes)

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Cómo verificar |
|-------------|----------------|----------------|
| Node.js | 18.x | `node --version` |
| npm | 9.x | `npm --version` |
| Firebase CLI | 13.x | `firebase --version` |
| Git | cualquier | `git --version` |

**Instalar Firebase CLI si no está:**
```bash
npm install -g firebase-tools
firebase login
```

**Datos que necesitas tener a mano:**
- Credenciales del operador principal (email + contraseña) — están en `credencialesgoogle.txt`
- Acceso a la consola de Firebase: https://console.firebase.google.com
- Token de Vercel si usas despliegue automático

---

## 2. Configurar Firebase Console

### 2.1 Autenticación — habilitar proveedores

En [Firebase Console](https://console.firebase.google.com) → proyecto
`sistema-de-control-aee89` → **Authentication** → **Sign-in method**:

- [x] **Email/Password** → Activar
- [x] **Google** → Activar (necesario para login con Google)

### 2.2 Autenticación — dominios autorizados

En **Authentication** → **Settings** → **Authorized domains**, agregar:

```
localhost
127.0.0.1
controlasistenciaapp.vercel.app
TU_DOMINIO_PERSONALIZADO.com   ← si tienes uno
```

> ⚠️ Si el dominio de Vercel es diferente al que aparece arriba, agrégalo aquí.
> El login fallará con error `auth/unauthorized-domain` si el dominio no está listado.

### 2.3 Firestore — crear la base de datos

Si no existe aún:
1. **Firestore Database** → **Create database**
2. Modo: **Production mode** (reglas restrictivas por defecto)
3. Región: `us-central1` (o la más cercana a Guatemala)

### 2.4 Firestore — índices

Importar los índices desde `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

---

## 3. Desplegar reglas y funciones

### 3.1 Reglas de Firestore

```bash
# Desde la raíz del proyecto
firebase deploy --only firestore:rules
```

Verificar en la consola que la versión activa muestra las reglas de
`firestore.rules` (con `isValidWorkerData`, `isValidAttendanceData`, etc.).

### 3.2 Cloud Functions — configurar el email del admin inicial

Este paso es **obligatorio** antes de desplegar las funciones. Sin él, ningún
usuario puede convertirse en administrador la primera vez.

```bash
firebase functions:config:set initial_admin.email="TU_EMAIL@dominio.com"
```

> Reemplaza `TU_EMAIL@dominio.com` con el email del operador principal
> (el que está en `credencialesgoogle.txt`).

### 3.3 Desplegar las funciones

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

> La función `setAdminClaim` queda disponible en la nube. Permite asignar
> el rol `admin` a cualquier cuenta desde dentro de la app.

---

## 4. Crear la cuenta del operador

Este script crea (o verifica) la cuenta del operador en Firebase Auth.
Lee las credenciales desde `.env.local`.

```bash
node scripts/setup-operator-account.js
```

**Salida esperada:**
```
Proyecto : sistema-de-control-aee89
Operador : tu@email.com

✔ Cuenta CREADA en Firebase Auth   (o: ℹ La cuenta ya existía)
✔ Login email+password VERIFICADO con las credenciales de .env.local
   uid: abc123xyz
✉ Correo de verificación enviado a tu@email.com
```

> Si aparece `OPERATION_NOT_ALLOWED`, ve a Firebase Console →
> Authentication → Sign-in method y habilita Email/Password.

---

## 5. Asignar permisos de administrador

Este script asigna los custom claims `admin`, `manager` y `supervisor` a
la cuenta del operador. Sin estos claims, la app puede marcar asistencia
pero **no puede gestionar personal** (alta, edición, configuración).

**Prerequisito:** tener `firebase-tools` instalado y sesión iniciada (`firebase login`).

```bash
node scripts/grant-admin-claim.js
```

Sin argumentos, usa el EMAIL de `.env.local`. También puedes pasar un email:

```bash
node scripts/grant-admin-claim.js otro@email.com
```

**Salida esperada:**
```
Cuenta: tu@email.com | uid: abc123xyz
✔ Claims asignados: {"admin":true,"manager":true,"supervisor":true}
ℹ El usuario debe volver a iniciar sesión para recibir los claims en su token.
```

> ⚠️ El usuario debe **cerrar sesión y volver a iniciar sesión** para que los
> nuevos claims se reflejen en su token JWT.

---

## 6. Verificar acceso end-to-end

Este script verifica el acceso real a Firestore haciendo escrituras de prueba
y limpiándolas al final.

```bash
node scripts/verify-firestore-access.js
```

**Salida esperada (6/6 OK):**
```
Proyecto: sistema-de-control-aee89
Operador: tu@email.com

✔ 1. Login email+password (uid abc123, admin=true)
✔ 2. Lectura autenticada de `personal`
✔ 3. Escritura de MARCACIÓN en `asistencias`
✔ 4. Escritura de TRABAJADOR en `personal`
✔ 5. Lectura anónima denegada (403) — reglas activas
✔ 6. Limpieza de documentos de prueba

RESULTADO: 6/6 comprobaciones OK
```

Si alguna falla, ver la sección [13. Resolución de problemas](#13-resolución-de-problemas-frecuentes).

---

## 7. Desplegar en Vercel

### 7.1 Variables de entorno en Vercel

En el [dashboard de Vercel](https://vercel.com) → tu proyecto → **Settings** →
**Environment Variables**, agregar:

| Variable | Valor |
|----------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `sistema-de-control-aee89.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `sistema-de-control-aee89` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `sistema-de-control-aee89.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `265655332442` |
| `VITE_FIREBASE_APP_ID` | `1:265655332442:web:c4e8617741e3b916987263` |

> Estas variables se inyectan al HTML en build time por `scripts/inject-env.js`.
> En local (dev), se leen de `.env.local`.

### 7.2 Desplegar

```bash
# Opción A — despliegue automático (recomendado)
git add .
git commit -m "chore: preparar producción v1.5.0"
git push origin main
# Vercel detecta el push y despliega automáticamente

# Opción B — despliegue manual con Vercel CLI
npx vercel --prod
```

### 7.3 Verificar el deploy

```bash
# Comprobar que la versión desplegada coincide con el commit
git rev-parse --short HEAD
# Abrir la app en producción y verificar en consola:
# window.__APP_VERSION__  → debe coincidir con el SHA anterior
```

---

## 8. Configurar la obra en la app

Una vez desplegada la app y con sesión iniciada, ve a **Ajustes** y configura:

### 8.1 Información de la obra

| Campo | Valor a ingresar |
|-------|-----------------|
| Nombre de la Obra | Ej: "Construcción Residencial Los Alpes" |
| Encargado | Nombre del supervisor principal |
| Teléfono de contacto | 8 dígitos |

### 8.2 Horarios de trabajo

| Campo | Valor típico |
|-------|-------------|
| Hora de Entrada | `07:00` |
| Salida a Receso | `10:00` |
| Regreso de Receso | `10:30` |
| Salida de Obra | `17:00` |
| Tolerancia (minutos) | `15` |

### 8.3 Geocerca GPS (opcional pero recomendado)

1. Ir a Google Maps → ubicar el centro de la obra
2. Clic derecho → "¿Qué hay aquí?" → copiar coordenadas
3. Ingresar en **Ajustes → GPS**:
   - Latitud del centro: `14.xxxxxx`
   - Longitud del centro: `-90.xxxxxx`
   - Radio permitido: `200` metros (ajustar según el tamaño del terreno)
   - Activar "Requerir ubicación para marcar" si se quiere enforcement estricto

### 8.4 Logo de la empresa (opcional)

En **Ajustes → Apariencia** → subir el logo (se incluirá en los reportes PDF).

### 8.5 Guardar

Clic en **Guardar configuración**. Los cambios se suben a Firestore y se
sincronizan en todos los dispositivos.

---

## 9. Dar de alta los primeros trabajadores

Ve a la sección **Personal** → botón **+ Nuevo Trabajador**.

### Datos obligatorios

| Campo | Descripción |
|-------|-------------|
| Nombre Completo | Nombre y apellidos completos |
| DPI/CUI | 13 dígitos exactos |
| Puesto | Seleccionar de la lista (o "Otro" para personalizado) |
| Teléfono | 8 dígitos |
| Estado | `Activo` |

### Datos opcionales pero recomendados

| Campo | Por qué es útil |
|-------|----------------|
| Fotografía | Aparece en el carnet y en la pantalla de marcación |
| WhatsApp | Permite enviar carnets por WhatsApp |
| Dirección | Registro del departamento para reportes |
| Jefe Inmediato | Útil para reportes por área |

### Verificar que el trabajador se guardó

Después de guardar, el trabajador debe aparecer en la tabla. Si el modo es
"Nube" (badge verde), está en Firestore. Si es "Local", está en cache y se
sincronizará al conectar.

---

## 10. Imprimir carnets QR

### Desde la app (modo web)

1. **Personal** → buscar el trabajador → botón **Carnet** (ícono de tarjeta)
2. Se abre el modal con el carnet y el código QR
3. Botón **Imprimir** → seleccionar "Guardar como PDF" o impresora física
4. Recortar y plastificar (tamaño recomendado: 85×54 mm — tarjeta de crédito)

### Impresión en lote

1. **Personal** → seleccionar múltiples trabajadores con los checkboxes
2. Botón **Imprimir Carnets seleccionados**
3. Se generan todos en un solo PDF

### Especificaciones del QR

El QR codifica: `{"id":"TRAB-xxxx","dpi":"1234567890101"}`

El escáner lo decodifica y busca el trabajador por `id` primero, y por `dpi`
como respaldo. **No modificar** este formato o los carnets dejarán de funcionar.

---

## 11. Verificar el escáner de campo

### En dispositivo móvil

1. Abrir `field-scanner.html` en el navegador del teléfono
   - URL: `https://TU_APP.vercel.app/field-scanner.html`
2. Iniciar sesión con las credenciales del operador
3. Activar la cámara
4. Escanear el carnet de prueba de un trabajador
5. Verificar que aparece el nombre y los botones de marcación
6. Hacer una marcación de "Entrada"
7. Verificar en **Asistencia** (app principal) que la marcación aparece

### Instalar como PWA

En el teléfono, al abrir `field-scanner.html`:
- Android (Chrome): menú → "Agregar a pantalla de inicio"
- iOS (Safari): compartir → "Agregar a pantalla de inicio"

La PWA funciona offline: guarda las marcaciones localmente y las sincroniza
cuando hay red.

---

## 12. Checklist de operación diaria

### Al inicio del día (supervisor)

- [ ] Abrir la app → verificar badge "Nube" (verde) o "Local"
- [ ] Dashboard → confirmar que muestra la fecha de hoy
- [ ] Verificar que la lista de personal activo está actualizada
- [ ] Operador de campo → abrir field-scanner → verificar cámara funciona

### Durante el día (operador de campo)

- [ ] Escanear carnets de los trabajadores al llegar (Entrada 07:00)
- [ ] Escanear al inicio del receso (Salida_Receso 10:00)
- [ ] Escanear al regresar del receso (Regreso_Receso 10:30)
- [ ] Escanear al terminar la jornada (Salida_Obra 17:00)
- [ ] Para trabajadores sin carnet: usar búsqueda manual en Asistencia

### Al final del día (supervisor)

- [ ] Dashboard → revisar resumen del día (presentes, ausentes, tardanzas)
- [ ] Alertas → revisar y marcar como revisadas
- [ ] Reportes → generar reporte diario PDF
- [ ] Verificar que las marcaciones están sincronizadas (modo Nube)

### Semanal

- [ ] Reportes → Semanal → descargar PDF y Excel
- [ ] Revisar trabajadores en estado "Suspendido" o "Inactivo"
- [ ] Verificar que no hay cola offline pendiente (Ajustes → Cola pendiente)

---

## 13. Resolución de problemas frecuentes

### "auth/unauthorized-domain"

**Causa:** El dominio desde donde se abre la app no está en la lista de
dominios autorizados de Firebase Auth.

**Solución:**
1. Firebase Console → Authentication → Settings → Authorized domains
2. Agregar el dominio exacto (sin `https://`, sin `/`)
3. Ejemplo: `controlasistenciaapp.vercel.app`

---

### "permission-denied" al guardar

**Causa A:** El usuario no tiene claims `admin` o `manager`.

**Solución:**
```bash
node scripts/grant-admin-claim.js
# Luego: cerrar sesión y volver a iniciar sesión en la app
```

**Causa B:** Los campos del documento no pasan la validación de Firestore Rules.

**Solución:**
```bash
node scripts/verify-firestore-access.js
# Ver cuál de las 6 verificaciones falla y el mensaje de error
```

---

### "OPERATION_NOT_ALLOWED" en setup-operator-account.js

**Causa:** El proveedor Email/Password no está habilitado en Firebase Auth.

**Solución:**
Firebase Console → Authentication → Sign-in method → Email/Password → Activar

---

### Las marcaciones se guardan en "Local" pero no suben a Firestore

**Causa:** La sesión no está activa o el token expiró.

**Solución:**
1. Abrir la app → Ajustes → sección "Conexión"
2. Verificar estado (debe decir "Nube")
3. Si dice "Local", iniciar sesión con el email/contraseña del operador
4. Una vez con sesión, usar el botón "Sincronizar pendientes"

---

### El QR se escanea pero no encuentra al trabajador

**Causa A:** El trabajador fue dado de alta después de instalar la PWA
y la caché no se actualizó.

**Solución:** En la app principal → Personal → botón Refrescar (↺).
O recargar la página (F5 / Pull-to-refresh en móvil).

**Causa B:** El carnet fue generado antes de que el trabajador tuviera ID.

**Solución:** Re-generar el carnet desde Personal → botón Carnet.

---

### Cómo agregar un segundo administrador

```bash
node scripts/grant-admin-claim.js segundo_admin@email.com
```

El segundo admin también debe tener cuenta en Firebase Auth. Si no la tiene:
1. Firebase Console → Authentication → Add user
2. Ingresar email y contraseña temporal
3. Ejecutar el comando de arriba con el email del nuevo admin

---

## DATOS DE REFERENCIA

```
Proyecto Firebase : sistema-de-control-aee89
Auth Domain       : sistema-de-control-aee89.firebaseapp.com
Storage Bucket    : sistema-de-control-aee89.firebasestorage.app
App ID            : 1:265655332442:web:c4e8617741e3b916987263
Región Firestore  : us-central1
```

Credenciales del operador principal: ver `credencialesgoogle.txt`
(archivo local, excluido del repositorio por `.gitignore`).

---

*Última actualización: 2026-10-08 | Control Personal Campo v1.5.0*
