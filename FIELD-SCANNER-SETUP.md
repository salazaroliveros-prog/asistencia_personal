# Field Scanner — Instalación y Configuración

## Instalación rápida

1. Asegurarse de que la app principal esté accesible en internet o red local.
2. Abrir `/field-scanner.html` en el navegador del dispositivo móvil.
3. Desde Chrome/Edge: menú → **“Agregar a pantalla de inicio”** o **“Instalar app”**.
4. El ícono quedará disponible como app independiente.

## Configuración inicial

1. Abrir la app del escáner.
2. Ingresar el PIN configurado en **Ajustes → PIN Escáner de Campo**.
3. Otorgar permisos de cámara y ubicación cuando lo solicite el navegador.

## Vínculo de acceso para el encargado

- En la app principal: **Ajustes → WhatsApp** para enviar el link de instalación.
- También se puede compartir manualmente: `https://<tu-dominio>/field-scanner.html`
- El encargado abre el link desde su móvil y lo instala como PWA.

## Checklist de verificación

- [ ] La app principal está publicada y accesible.
- [ ] `field-scanner.html` se abre correctamente en el móvil.
- [ ] El login con PIN funciona.
- [ ] La cámara escanea QR de prueba.
- [ ] El GPS muestra coordenadas o “Sin GPS”.
- [ ] Las marcaciones se reflejan en Firestore.
- [ ] La app se instala como PWA en Android/iOS.

## Notas

- El service worker requiere HTTPS en producción.
- En desarrollo local usar `http://localhost` o `127.0.0.1`.
- La sesión dura 1 hora; luego pide PIN nuevamente.
