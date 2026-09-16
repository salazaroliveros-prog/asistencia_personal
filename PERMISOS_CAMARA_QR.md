# Permisos Necesarios para Cámara y Scanner QR

## Permisos de Navegador Requeridos

### 1. Permisos de Cámara
- **Permiso:** `camera`
- **Descripción:** Acceso al hardware de cámara para captura de video
- **Uso:** Escaneo de códigos QR, captura de fotos para carnets, verificación de identidad

### 2. Permisos de Audio (Opcional)
- **Permiso:** `microphone` 
- **Descripción:** Acceso al micrófono para comandos de voz (futuro)
- **Uso:** Marcación por voz, comandos de hands-free

## Contextos de Seguridad Requeridos

### HTTPS Obligatorio
Las APIs de cámara (`navigator.mediaDevices.getUserMedia`) solo funcionan en:
- **HTTPS:** `https://` 
- **Localhost:** `http://localhost` o `http://127.0.0.1`
- **Capacitor:** `capacitor://`
- **File:** `file://` (limitado)

## Configuración CSP (Content Security Policy)

### Directivas CSP Esenciales para Cámara/QR

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com https://www.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  media-src 'self' blob:;              <!-- IMPORTANTE: Para streams de cámara -->
  connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.googleapis.com;
  worker-src 'self' blob:;
  frame-src 'self';
">
```

### Errores Comunes de CSP

#### ❌ Error: `frame-ancestors` en meta tag
**Problema:** La directiva `frame-ancestors` solo se puede configurar a nivel de servidor (HTTP headers), no en meta tags HTML.

**Solución:** Eliminar `frame-ancestors` del meta tag CSP y configurarlo en el servidor si es necesario.

#### ❌ Error: Falta `media-src`
**Problema:** Sin `media-src blob:`, los streams de cámara no pueden ser capturados.

**Solución:** Agregar `media-src 'self' blob:;` a la configuración CSP.

## Permisos Playwright para Testing

### Configuración de Contexto
```typescript
await context.grantPermissions(['camera']);
await context.grantPermissions(['camera', 'microphone']);
```

### Revocación de Permisos
```typescript
await context.clearPermissions();
```

## Permisos Capacitor (Móvil)

### Android (android/app/src/main/AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

### iOS (ios/App/App/Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>Necesitamos acceso a la cámara para escanear códigos QR y registrar asistencia.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Necesitamos acceso a la galería para seleccionar fotos de carnets.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Necesitamos acceso para guardar fotos de carnets.</string>
```

## Validación de Permisos en Código

### Verificar Soporte de Cámara
```javascript
function getCameraSupport() {
  const protocol = location.protocol;
  const secure = protocol === 'https:' || protocol === 'capacitor:' || protocol === 'http:';
  const mediaDevices = navigator.mediaDevices;
  
  return {
    supported: Boolean(secure && mediaDevices && typeof mediaDevices.getUserMedia === 'function'),
    secure,
    protocol,
    hasMediaDevices: Boolean(mediaDevices),
    hasGetUserMedia: typeof mediaDevices?.getUserMedia === 'function'
  };
}
```

### Solicitar Permiso de Cámara
```javascript
async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment', // Cámara trasera
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    // Permiso concedido
    return { success: true, stream };
  } catch (error) {
    // Manejo de errores
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Permiso denegado por usuario' };
    } else if (error.name === 'NotFoundError') {
      return { success: false, error: 'No se encontró cámara' };
    } else {
      return { success: false, error: error.message };
    }
  }
}
```

## Errores Comunes y Soluciones

### Error: `NotAllowedError`
**Causa:** Usuario denegó permiso de cámara
**Solución:** Mostrar UI explicativa y solicitar permiso nuevamente

### Error: `NotFoundError`
**Causa:** No hay cámara disponible en el dispositivo
**Solución:** Verificar hardware y ofrecer alternativas

### Error: `NotReadableError`
**Causa:** Cámara en uso por otra aplicación
**Solución:** Solicitar al usuario cerrar otras apps que usen cámara

### Error: `OverconstrainedError`
**Causa:** Requisitos de cámara no soportados
**Solución:** Usar configuraciones más flexibles

## Verificación de Producción

### Checklist de Despliegue
- [ ] CSP configurado correctamente con `media-src blob:`
- [ ] No usar `frame-ancestors` en meta tags
- [ ] Servir via HTTPS
- [ ] Permisos Capacitor configurados para iOS/Android
- [ ] Manejo de errores de permisos implementado
- [ ] UI para solicitar permisos cuando sean denegados
- [ ] Fallback para dispositivos sin cámara

## Testing

### Tests Automatizados
- **Ejecutar:** `npx playwright test __e2e__/camera-qr-validation.spec.ts`
- **Cobertura:** 16 tests validando:
  - Soporte de mediaDevices
  - Acceso a lista de cámaras
  - Configuración CSP
  - Funcionalidad de scanner QR
  - Manejo de permisos
  - Error handling

### Pruebas Manuales
1. Abrir app en navegador con cámara
2. Navegar a módulo de asistencia
3. Clic en botón de escaneo QR
4. Conceder permiso de cámara
5. Verificar que la cámara se active
6. Escanear un código QR de prueba
7. Verificar que la marcación se registre

## Soporte de Navegadores

### Navegadores Soportados
- ✅ Chrome/Edge (desktop y móvil)
- ✅ Firefox (desktop y móvil)
- ✅ Safari (iOS y macOS)
- ✅ Samsung Internet
- ⚠️ Opera (limitado en algunas versiones)

### Requisitos Mínimos
- **Chrome:** 53+
- **Firefox:** 36+
- **Safari:** 11+
- **Edge:** 79+ (Chromium)

## Conclusión

Para el correcto funcionamiento de cámaras y scanners QR en campo:

1. **Permisos:** Configurar `camera` en Capacitor y Playwright
2. **Seguridad:** Usar HTTPS obligatoriamente
3. **CSP:** Incluir `media-src blob:` y evitar `frame-ancestors` en meta tags
4. **UI:** Implementar solicitud y manejo de permisos
5. **Testing:** Validar con tests automatizados y pruebas manuales
6. **Fallback:** Ofrecer alternativas para dispositivos sin cámara