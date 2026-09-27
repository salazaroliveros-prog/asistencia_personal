# GUÍA DE CONFIGURACIÓN COMPLETA DE FIREBASE

## RESUMEN DE CONFIGURACIÓN REALIZADA

### ✅ Configuración Completada

1. **Proyecto Firebase**: `sistema-de-control-aee89`
2. **Firestore Database**: Habilitado (Edición Standard)
3. **Reglas de Seguridad**: Desplegadas correctamente
4. **Authentication Providers**: Habilitados
   - ✅ Email/Password
   - ✅ Google Sign-In
5. **Dominios Autorizados**: 
   - localhost
   - controlasistenciaapp.vercel.app
   - 127.0.0.1

---

## PASOS PENDIENTES PARA COMPLETAR LA CONFIGURACIÓN

### 1. CREAR USUARIO ADMINISTRADOR

#### Opción A: Desde Firebase Console (Recomendada)

1. **Ir a Firebase Console:**
   - https://console.firebase.google.com/project/sistema-de-control-aee89/authentication/users

2. **Agregar usuario:**
   - Click en "Agregar usuario"
   - Email: `admin@tuempresa.com` (o el correo que prefieras)
   - Contraseña: Mínimo 6 caracteres
   - Click en "Agregar usuario"

3. **Establecer Custom Claims (Requiere Script o Firebase Console):**
   - Los custom claims (admin, manager, supervisor) deben establecerse
   - Esto puede hacerse manualmente desde la consola o usando el script proporcionado

#### Opción B: Usando el Script Automatizado

1. **Obtener clave de servicio:**
   - Ir a: https://console.firebase.google.com/project/sistema-de-control-aee89/settings/serviceaccounts/adminsdk
   - Click en "Generar nueva clave privada"
   - Descargar el archivo JSON
   - Guardarlo como `service-account-key.json` en el directorio raíz del proyecto

2. **Instalar dependencias:**
   ```bash
   npm install firebase-admin
   ```

3. **Ejecutar el script:**
   ```bash
   node scripts/create-admin-user.js
   ```

4. **Seguir las instrucciones del script:**
   - Ingresar correo electrónico
   - Ingresar contraseña
   - Ingresar nombre completo

### 2. CONFIGURACIÓN EN LA APLICACIÓN

#### Variables de Entorno Configuradas

Las siguientes variables ya están configuradas en `.env.example` y deben estar en Vercel:

```env
VITE_FIREBASE_API_KEY=AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg
VITE_FIREBASE_AUTH_DOMAIN=sistema-de-control-aee89.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sistema-de-control-aee89
VITE_FIREBASE_STORAGE_BUCKET=sistema-de-control-aee89.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=265655332442
VITE_FIREBASE_APP_ID=1:265655332442:web:c4e8617741e3b916987263
```

#### Configuración en la Interfaz de Usuario

1. **Ir al módulo de Ajustes** en la aplicación
2. **Ingresar credenciales del administrador:**
   - Email: El correo del usuario administrador creado
   - Contraseña: La contraseña del usuario administrador
3. **Click en "Iniciar sesión segura"**
4. **Verificar conexión exitosa:**
   - El badge de conexión debe cambiar de "Modo local" a "Conectado"
   - Debe aparecer el email del usuario autenticado

---

## PRUEBA DE CONEXIÓN FIREBASE

### Script de Prueba Automatizado

El script `__e2e__/firestore-realtime-test.js` ya existe y puede usarse para verificar la conexión:

```bash
# Para probar en local
node __e2e__/firestore-realtime-test.js

# Para probar en Vercel (modificar la URL en el script)
# LIVE_URL=https://controlasistenciaapp.vercel.app node __e2e__/firestore-realtime-test.js
```

### Prueba Manual en la Aplicación

1. **Abrir la aplicación:** https://controlasistenciaapp.vercel.app
2. **Navegar a Ajustes**
3. **Ingresar credenciales del administrador**
4. **Click en "Iniciar sesión segura"**
5. **Verificar:**
   - Mensaje de éxito en la autenticación
   - Badge de conexión cambiado a "Conectado"
   - Email del usuario visible en ajustes

---

## VERIFICACIÓN DE REGLAS DE SEGURIDAD

Las reglas de seguridad (`firestore.rules`) han sido desplegadas y incluyen:

### ✅ Funciones de Seguridad
- `isAuthenticated()`: Verifica que el usuario esté autenticado
- `isAdmin()`: Verifica que el usuario tenga claim de admin
- `isManager()`: Verifica que el usuario tenga claim de manager
- `isSupervisor()`: Verifica que el usuario tenga claim de supervisor
- `isAuthorizedOperator()`: Verifica que el usuario pueda operar el sistema

### ✅ Colecciones Protegidas
- **users**: Perfiles de usuarios vinculados a Firebase Auth
- **personal**: Trabajadores del sistema
- **asistencias**: Registros de marcación
- **configuracion**: Configuración global del sistema
- **alertas**: Notificaciones y alertas
- **logs**: Registro de auditoría

### ✅ Validaciones de Datos
- Validación de strings, números, timestamps
- Validación específica por colección
- Control de tamaño de documentos
- Validación de campos obligatorios

---

## TESTING COMPLETO CON FIREBASE

### 1. CRUD de Trabajadores

```javascript
// Prueba de creación de trabajador
const worker = {
  nombre: 'Trabajador Test Firebase',
  dpi: '1234567890101',
  puesto: 'Albañil',
  jefe: 'Supervisor Test',
  telefono: '55551111',
  whatsapp: '55551111',
  direccion: 'Zona 10 Guatemala'
};

const result = await API.guardarTrabajador(worker);
console.log('Resultado:', result);
```

### 2. Prueba de Marcación de Asistencia

```javascript
// Prueba de marcación
const attendance = {
  ID_Trabajador: 'TRAB-123',
  Nombre_Trabajador: 'Trabajador Test',
  Fecha: '2026-09-22',
  Tipo_Marcacion: 'Entrada',
  Hora_Real: '08:00',
  Estado_Marcacion: 'A Tiempo'
};

const result = await API.registrarMarcacion(attendance);
console.log('Resultado:', result);
```

### 3. Prueba de Sincronización Offline/Online

1. **Desconectar internet**
2. **Crear trabajador**
3. **Verificar que se guarde localmente**
4. **Reconectar internet**
5. **Verificar que se sincronice con Firestore**

---

## SOLUCIÓN DE PROBLEMAS

### Problema: "permission-denied" en Firestore

**Causa:** El usuario no tiene los custom claims necesarios

**Solución:**
1. Verificar que el usuario tenga los claims correctos
2. Re-desplegar las reglas de seguridad
3. Verificar que el usuario esté autenticado correctamente

### Problema: "auth-domain-not-authorized"

**Causa:** El dominio no está en la lista de dominios autorizados

**Solución:**
1. Agregar el dominio a `firebase.json` en `authorizedDomains`
2. Re-deployar la configuración de auth: `npx -y firebase-tools@latest deploy --only auth`

### Problema: "network-request-failed"

**Causa:** Problemas de conexión o CORS

**Solución:**
1. Verificar conexión a internet
2. Verificar configuración de CORS en Firebase Console
3. Verificar que las reglas de seguridad permitan la operación

---

## MONITOREO Y MANTENIMIENTO

### Firebase Console

- **Overview:** https://console.firebase.google.com/project/sistema-de-control-aee89/overview
- **Firestore:** https://console.firebase.google.com/project/sistema-de-control-aee89/firestore
- **Authentication:** https://console.firebase.google.com/project/sistema-de-control-aee89/authentication
- **Usage:** https://console.firebase.google.com/project/sistema-de-control-aee89/usage

### Métricas Importantes

- **Firestore Reads:** Número de lecturas a la base de datos
- **Firestore Writes:** Número de escrituras a la base de datos
- **Auth Operations:** Operaciones de autenticación
- **Storage Usage:** Uso de almacenamiento

### Alertas Recomendadas

- Alerta de presupuesto cuando se alcance el 80% del límite gratuito
- Alerta de errores de autenticación frecuentes
- Alerta de operaciones de escritura anómalas

---

## DOCUMENTACIÓN ADICIONAL

- **Documentación Firebase:** https://firebase.google.com/docs
- **Firestore Security Rules:** https://firebase.google.com/docs/firestore/security/rules
- **Firebase Authentication:** https://firebase.google.com/docs/auth
- **Reglas de Seguridad del Proyecto:** `firestore.rules`

---

## SIGUIENTES PASOS

1. ✅ **Crear usuario administrador** (pendiente de tu acción)
2. ✅ **Probar conexión Firebase** en la aplicación
3. ✅ **Verificar CRUD completo** con Firebase
4. ✅ **Probar sincronización offline/online**
5. ✅ **Configurar backups automáticos**
6. ✅ **Establecer monitoreo y alertas**

---

## CONTACTO Y SOPORTE

Para problemas técnicos relacionados con Firebase:
- Documentación oficial: https://firebase.google.com/docs
- Stack Overflow: https://stackoverflow.com/questions/tagged/firebase
- Firebase Community: https://firebase.community

Para problemas específicos de esta aplicación:
- Revisar logs en Firebase Console
- Verificar reglas de seguridad en `firestore.rules`
- Validar configuración en `firebase.json`