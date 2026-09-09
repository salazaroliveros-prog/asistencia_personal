# Empaquetado nativo

La aplicación usa Capacitor para distribuir el mismo código web como PWA, Android e iOS.

## Android

Requisitos: Node.js, JDK 21 y Android SDK configurado.

### APK de depuración (debug)

```powershell
npm install
npm run cap:build:android
```

Genera `android/app/build/outputs/apk/debug/app-debug.apk` (~5.6 MB).
Firmado con el certificado debug de Android — instalable en cualquier dispositivo Android 7.0+
habilitando "Orígenes desconocidos".

### APK de publicación (release) firmado

```powershell
npm run cap:build:release
```

Genera `android/app/build/outputs/apk/release/app-release.apk` (~4.5 MB).
Firmado con el keystore del proyecto (ver `android/keystore.properties`).

La firma se configura automáticamente leyendo `android/keystore.properties` o estas
variables de entorno: `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.

**IMPORTANTE:** Haz una copia de seguridad de `android/app/control-personal-campo-release.jks`
y de las contraseñas en `android/keystore.properties`. Sin ellos no podrás actualizar
la app en Google Play ni instalar versiones nuevas sobre las anteriores.

### Apertura en Android Studio

```powershell
npm run cap:open:android
```

### Desinstalación por conflicto de firma

Si un APK de depuración está instalado y deseas instalar el release, debes desinstalar
el primero primero (la firma no coincide). Alternativa: `adb install -r` para
reemplazar si se tiene acceso por USB.

## iOS

Requisitos: macOS, Xcode y CocoaPods/Swift Package Manager disponibles.

```bash
npm install
npm run cap:ios
npm run cap:open:ios
```

Desde Xcode se debe seleccionar un equipo de desarrollo, configurar el identificador `com.controlpersonalcampo.app`,
firmar la aplicación y archivar para TestFlight/App Store.

## Sincronización después de cambios web

```powershell
npm run cap:sync
```

Este comando recompila Vite y copia `dist` dentro de los proyectos nativos.

## Dependencias locales (vendor)

Las librerías externas están vendoreadas en `assets/vendor/` para que la app funcione
sin conexión a internet (situaciones de obra con mala señal):

| Librería | Archivo | Uso |
|----------|---------|-----|
| Lucide Icons | `lucide.min.js` | Iconografía |
| QRCode.js | `qrcode.min.js` | Generación de QR |
| html5-qrcode | `html5-qrcode.min.js` | Escáner de cámara QR |
| Leaflet.js | `leaflet/` (CSS + JS + images) | Mapas GPS |
| Chart.js | `chart.umd.min.js` | Gráficas |
| html2canvas | `html2canvas.min.js` | Capturas de pantalla |
| jsPDF | `jspdf.umd.min.js` | Exportación PDF |

En caso de fallo de carga local, se usa automáticamente CDN como respaldo.
