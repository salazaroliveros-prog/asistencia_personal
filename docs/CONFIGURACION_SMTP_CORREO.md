# Configuración de Correo SMTP - Control Personal Campo

**Versión:** 1.5.0  
**Fecha:** 2026-09-27  
**Estado:** ✅ IMPLEMENTADO

---

## 📋 Resumen

Se ha implementado un sistema completo de configuración SMTP que permite al usuario configurar credenciales de correo electrónico reales (Gmail, Outlook, etc.) para enviar correos desde la aplicación.

---

## 🎯 Características Implementadas

### **1. Interfaz de Configuración SMTP**
- Ubicación: Módulo de Ajustes
- Campos disponibles:
  - Servidor SMTP (host)
  - Puerto SMTP
  - Usuario / Correo Electrónico
  - Contraseña / App Password
  - Dirección de Envío (From)
  - Nombre del Remitente
  - Opción de conexión segura TLS/SSL

### **2. Funcionalidades**
- ✅ Prueba de conexión SMTP en tiempo real
- ✅ Validación de credenciales antes de guardar
- ✅ Guardado local de configuración
- ✅ Sincronización con Firestore (cuando está conectado)
- ✅ Soporte para variables de entorno (.env.local)
- ✅ Firebase Functions para envío de correos

### **3. Seguridad**
- La contraseña se guarda en localStorage (nota: para producción se recomienda encriptación adicional)
- Firebase Functions requieren autenticación para usar el servicio SMTP
- Validación de formato de email antes de guardar
- Opción de conexión segura TLS/SSL por defecto

---

## 🔧 Configuración para Gmail

### **Método 1: Contraseña Normal (Sin 2FA)**
```
Servidor SMTP: smtp.gmail.com
Puerto: 587
Usuario: tu.correo@gmail.com
Contraseña: tu_contraseña_normal
Seguro: true (TLS)
```

### **Método 2: App Password (Con 2FA) - RECOMENDADO**
1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Activa la verificación en dos pasos (2FA)
3. Ve a: https://myaccount.google.com/apppasswords
4. Selecciona "Mail" como aplicación
5. Genera una App Password (ej: `abcd efgh ijkl mnop`)
6. Usa esta App Password en lugar de tu contraseña normal

Configuración:
```
Servidor SMTP: smtp.gmail.com
Puerto: 587
Usuario: tu.correo@gmail.com
Contraseña: abcd efgh ijkl mnop (App Password)
Seguro: true (TLS)
```

### **Método 3: Puerto SSL Alternativo**
```
Servidor SMTP: smtp.gmail.com
Puerto: 465
Usuario: tu.correo@gmail.com
Contraseña: tu_app_password
Seguro: true (SSL)
```

---

## 🔧 Configuración para Outlook/Office 365

### **Outlook.com (Gratuito)**
```
Servidor SMTP: smtp-mail.outlook.com
Puerto: 587
Usuario: tu.correo@outlook.com
Contraseña: tu_contraseña
Seguro: true (TLS)
```

### **Office 365 (Empresarial)**
```
Servidor SMTP: smtp.office365.com
Puerto: 587
Usuario: tu.correo@tuempresa.com
Contraseña: tu_contraseña_corporativa
Seguro: true (TLS)
```

---

## 🔧 Configuración para Otros Proveedores

### **Yahoo Mail**
```
Servidor SMTP: smtp.mail.yahoo.com
Puerto: 587
Usuario: tu.correo@yahoo.com
Contraseña: tu_contraseña
Seguro: true (TLS)
```

### **SendGrid**
```
Servidor SMTP: smtp.sendgrid.net
Puerto: 587
Usuario: apikey
Contraseña: SG.tu_api_key_aqui
Seguro: true (TLS)
```

### **Amazon SES**
```
Servidor SMTP: email-smtp.us-east-1.amazonaws.com
Puerto: 587
Usuario: tu_usuario_aws
Contraseña: tu_contraseña_aws
Seguro: true (TLS)
```

---

## 💻 Configuración desde Variables de Entorno

Para configurar SMTP por defecto en desarrollo, edita el archivo `.env.local`:

```bash
# SMTP Configuration (opcional)
VITE_SMTP_HOST=smtp.gmail.com
VITE_SMTP_PORT=587
VITE_SMTP_USER=tu.correo@gmail.com
VITE_SMTP_PASSWORD=tu_app_password_aqui
VITE_SMTP_FROM=tu.correo@gmail.com
VITE_SMTP_FROM_NAME=Control Personal Campo
VITE_SMTP_SECURE=true
```

**Notas:**
- Las variables de entorno solo se cargan si TODAS las variables requeridas están presentes
- La contraseña solo se pre-llena si viene de variables de entorno (por seguridad)
- Esto es útil para configuración de desarrollo, no para producción

---

## 🧪 Probar la Conexión SMTP

### **Desde la Interfaz de Ajustes**

1. Inicia sesión en la aplicación
2. Navega a "Ajustes"
3. Busca la sección "Configuración de Correo SMTP"
4. Completa todos los campos:
   - Servidor SMTP (ej: smtp.gmail.com)
   - Puerto (ej: 587)
   - Usuario (tu correo completo)
   - Contraseña (tu contraseña o App Password)
   - Dirección de Envío (opcional, usa el usuario si está vacío)
   - Nombre del Remitente (opcional)
   - Usar conexión segura (recomendado)
5. Haz clic en "Probar Conexión"
6. Si la conexión es exitosa, verás un mensaje de confirmación
7. Si falla, verifica:
   - Las credenciales son correctas
   - El puerto es el correcto para tu proveedor
   - Tienes permisos para usar SMTP (Gmail puede bloquear conexiones de apps menos seguras)
   - Usas App Password si tienes 2FA activado en Gmail

---

## 📝 Uso de la API de Envío de Correos

### **Función Firebase: `sendEmail`**

Para enviar correos desde la aplicación, usa la Firebase Function:

```javascript
const sendEmailFunction = window.firebase.functions().httpsCallable('sendEmail');

const result = await sendEmailFunction({
  smtpConfig: {
    host: 'smtp.gmail.com',
    port: 587,
    user: 'tu.correo@gmail.com',
    password: 'tu_app_password',
    secure: true
  },
  to: 'destinatario@ejemplo.com',
  subject: 'Asunto del correo',
  text: 'Contenido en texto plano',
  html: '<h1>Contenido HTML</h1>',
  from: 'tu.correo@gmail.com',
  fromName: 'Control Personal Campo'
});

console.log('Correo enviado:', result.data);
```

### **Respuesta Exitosa**
```json
{
  "success": true,
  "messageId": "<mensaje-id@ejemplo.com>",
  "to": "destinatario@ejemplo.com",
  "subject": "Asunto del correo"
}
```

---

## 🔒 Consideraciones de Seguridad

### **Para Desarrollo**
- Las credenciales se guardan en localStorage
- No hay encriptación adicional
- Aceptable para entornos de desarrollo

### **Para Producción**
**Recomendaciones:**
1. Usar App Passwords en lugar de contraseñas normales
2. Implementar encriptación de la contraseña antes de guardar
3. Considerar usar un servicio de correos transaccional (SendGrid, Mailgun, AWS SES)
4. No exponer credenciales en el código fuente
5. Usar variables de entorno en lugar de valores hardcodeados
6. Implementar rate limiting para evitar spam
7. Usar HTTPS siempre

### **Firebase Cloud Functions**
- Las funciones requieren autenticación del usuario
- Las credenciales se envían encriptadas a través de HTTPS
- Los logs de Firebase no deben contener contraseñas en texto plano

---

## 🐛 Solución de Problemas Comunes

### **Error: "Invalid login"**
- Verifica que el usuario y contraseña son correctos
- Para Gmail, usa App Password si tienes 2FA activado
- Verifica que el puerto es el correcto

### **Error: "Connection timeout"**
- Verifica que el servidor SMTP es correcto
- Verifica que el puerto es el correcto
- Verifica que tu firewall no bloquee el puerto
- Para Gmail, habilita "Acceso de apps menos seguras" si no usas App Password

### **Error: "Self-signed certificate"**
- Asegúrate de tener "Usar conexión segura" activado
- Verifica que tu servidor SMTP usa certificados válidos
- La configuración actual usa `rejectUnauthorized: false` para pruebas

### **Error: "Authentication required"**
- Asegúrate de estar autenticado en Firebase antes de probar
- La función `testSMTPConnection` requiere autenticación

---

## 📊 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                      │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Módulo Ajustes  │───▶│ Firebase Functions (Backend)     │ │
│  │   (ajustes.js)  │    │      (functions/index.js)        │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│         │                           │                         │
│         │                           ▼                         │
│         │                  ┌─────────────────┐              │
│         │                  │   nodemailer    │              │
│         │                  │  (SMTP Client)  │              │
│         │                  └─────────────────┘              │
│         │                           │                         │
│         │                           ▼                         │
│         │                    ┌──────────┐                │
│         │                    │ Servidor │                │
│         │                    │   SMTP   │                │
│         │                    └──────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Próximos Pasos

### **Implementaciones Futuras Recomendadas**
1. ✅ Encriptación de contraseña en localStorage
2. ✅ Rate limiting para envío de correos
3. ✅ Plantillas de correo predefinidas
4. ✅ Cola de correos para envío masivo
5. ✅ Historial de correos enviados
6. ✅ Notificaciones de ausencias por correo
7. ✅ Envío automático de reportes por correo
8. ✅ Adjuntos en correos (PDF, CSV)

---

## 📞 Soporte

Si tienes problemas con la configuración SMTP:

1. **Gmail**: https://support.google.com/mail/answer/7126229
2. **Outlook**: https://support.microsoft.com/outlook
3. **Firebase Functions**: https://firebase.google.com/docs/functions
4. **Nodemailer**: https://nodemailer.com/

---

**Generado por:** Devin - AI Assistant  
**Fecha:** 2026-09-27  
**Versión del Sistema:** 1.5.0  
**Estado Final:** ✅ CONFIGURACIÓN SMTP COMPLETAMENTE IMPLEMENTADA
