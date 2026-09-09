# Plan de Pruebas — Instalación PWA y Métodos de Despliegue
# Control Personal Campo

## 1. Objetivo
Validar que el proceso de instalación de la aplicación como PWA funcione correctamente en todos los métodos de despliegue disponibles, y que la ventana flotante de instalación se comporte de forma predecible:
- Aparece cuando el navegador emite `beforeinstallprompt`.
- Se cierra automáticamente tras una instalación exitosa.
- No deja residuos visuales ni bloquea la suite después de instalada o descartada.

## 2. Alcance
- Despliegues: Vercel (producción), local HTTP (`npm run start` / `npm run dev`), y cualquier otro método estático que sirva `index.html` + `service-worker.js`.
- Flujo PWA: `beforeinstallprompt` → banner/botón → `prompt()` → `appinstalled` → cierre automático.
- Service Worker: registro, precache, estrategias de fetch.
- Manifest: campos obligatorios y detección de instalación.
- Persistencia: localStorage `cpc_pwa_install_dismissed`, sesión y post-instalación.

## 3. Estrategia de pruebas
- Automatizadas: Playwright E2E instalable + tests Node estáticos.
- Manuales: checklist navegador para validar prompt nativo y comportamiento offline.
- Cross-browser: Chromium/Chrome, Edge, Safari iOS (si aplica).

## 4. Métodos de despliegue cubiertos
| Método | URL esperada | Comando | Notas |
|--------|--------------|---------|-------|
| Vercel producción | `https://controlasistenciaapp.vercel.app` | `vercel --prod --yes` | HTTPS requerido para PWA |
| Local HTTP | `http://localhost:3800` | `npm run start` | Solo para pruebas; PWA limitado en HTTP |
| Archivo | `file:///.../index.html` | Abrir directo | No recomendado; SW suele bloquearse |

## 5. Casos de prueba detallados

### 5.1 Instalación PWA — ventana flotante (banner)
#### TC-PWA-01
- **Precondición**: App desplegada en HTTPS, service worker soportado, sin `cpc_pwa_install_dismissed` en localStorage.
- **Pasos**:
  1. Abrir DevTools → Application → Service Workers.
  2. Recargar la app.
  3. Verificar consola: `[SW] Instalando v1.1.0...`.
  4. Esperar evento `beforeinstallprompt`.
  5. Verificar que `#pwa-install-banner` pase de `hidden` a visible.
  6. Verificar que `#btn-install-app` pase de `hidden` a visible.
- **Resultado esperado**: Banner visible, botón visible, sin errores 404 en `/manifest.json` ni `/favicon.svg`.

#### TC-PWA-02
- **Precondición**: Banner visible, `_deferredInstallPrompt` capturado.
- **Pasos**:
  1. Hacer clic en `#pwa-install-btn` del banner.
  2. Aceptar el prompt nativo del navegador.
  3. Esperar evento `appinstalled`.
- **Resultado esperado**:
  - `#pwa-install-banner` se oculta (`hidden = true`).
  - `#btn-install-app` se oculta.
  - `localStorage.removeItem('cpc_pwa_install_dismissed')` se ejecuta.
  - Toast: "La aplicación quedó instalada en este dispositivo."
  - Sin errores CORS/CSP en consola.

#### TC-PWA-03
- **Precondición**: Banner visible.
- **Pasos**:
  1. Hacer clic en `#btn-install-app` (topbar).
  2. Aceptar prompt nativo.
- **Resultado esperado**: Mismo cierre automático que TC-PWA-02.

#### TC-PWA-04
- **Precondición**: Banner visible.
- **Pasos**:
  1. Hacer clic en `#pwa-install-dismiss`.
  2. Recargar la página.
- **Resultado esperado**:
  - Banner NO reaparece.
  - localStorage contiene `cpc_pwa_install_dismissed = "1"`.
  - Botón topbar `#btn-install-app` puede seguir visible si `beforeinstallprompt` se dispara; el banner no.

#### TC-PWA-05
- **Precondición**: App ya instalada.
- **Pasos**:
  1. Abrir la app desde el icono instalado.
  2. Verificar DevTools → Application → Manifest.
  3. Verificar que `beforeinstallprompt` NO se dispare.
- **Resultado esperado**:
  - Banner no aparece.
  - Botón `#btn-install-app` permanece oculto.
  - `appinstalled` no se dispara nuevamente.

#### TC-PWA-06
- **Precondición**: Service Worker registrado.
- **Pasos**:
  1. Ir a DevTools → Application → Service Workers.
  2. Verificar estado: `activated` o `activated and is running`.
  3. Verificar que el cache `cpc-static-v1.1.0` exista.
  4. Ir a pestaña Network, marcar "Offline", recargar.
  5. Verificar que la app cargue desde cache.
- **Resultado esperado**: App funcional offline, SW responde con cache.

### 5.2 Cierre automático de la ventana flotante post-instalación
#### TC-PWA-07
- **Precondición**: `_deferredInstallPrompt` presente.
- **Pasos**:
  1. Disparar `_triggerInstall()`.
  2. En `userChoice.outcome === 'accepted'`, inspeccionar DOM.
- **Resultado esperado**:
  - `#pwa-install-banner.hidden === true`.
  - `#btn-install-app.hidden === true`.
  - `_deferredInstallPrompt = null`.
  - No quedan overlays ni modales bloqueando el contenido.

#### TC-PWA-08
- **Precondición**: `_deferredInstallPrompt` presente.
- **Pasos**:
  1. Disparar `_triggerInstall()`.
  2. En `userChoice.outcome === 'dismissed'`, inspeccionar DOM.
- **Resultado esperado**:
  - Banner permanece oculto.
  - `_deferredInstallPrompt = null`.
  - No se muestran toasts de error.

#### TC-PWA-09
- **Precondición**: App en producción Vercel.
- **Pasos**:
  1. Abrir `https://controlasistenciaapp.vercel.app` en Chrome.
  2. Esperar carga completa.
  3. Observar si aparece el icono de instalación en la omnibox.
  4. Si aparece, instalar desde ahí.
  5. Verificar cierre del banner si estaba visible.
- **Resultado esperado**:
  - Icono de instalación visible en omnibox si criterios PWA se cumplen.
  - Al instalar, `appinstalled` se dispara.
  - Banner se oculta automáticamente.

### 5.3 Métodos de despliegue
#### TC-DEPLOY-01 Vercel
- **Pasos**:
  1. `git push origin main`.
  2. `vercel --prod --yes`.
  3. Verificar URL producción: `https://controlasistenciaapp.vercel.app`.
  4. Verificar headers: `Cache-Control`, `Service-Worker-Allowed`.
  5. Verificar que `/manifest.json` devuelva `application/json`.
  6. Verificar que `/service-worker.js` se sirva con `Content-Type: application/javascript`.
- **Resultado esperado**: Deploy verde, HTTPS válido, SW y manifest accesibles.

#### TC-DEPLOY-02 Local
- **Pasos**:
  1. `npm run start` o `node __tests__/server.js`.
  2. Abrir `http://localhost:3800`.
  3. Verificar consola: SW registrado.
  4. Verificar que `/manifest.json` sea accesible.
- **Resultado esperado**: Servidor responde 200, SW se registra. Nota: PWA nativo puede estar limitado en HTTP.

#### TC-DEPLOY-03 Archivo
- **Pasos**:
  1. Abrir `index.html` como `file://`.
  2. Verificar consola.
- **Resultado esperado**: SW puede no registrarse; se espera fallo controlado. No es método soportado para PWA.

### 5.4 Regresión visual y UX
#### TC-REG-01
- **Pasos**:
  1. Abrir app en viewport 320px, 768px, 1024px, 1440px.
  2. Verificar que el banner no cubra contenido crítico.
  3. Verificar que el botón topbar no se superponga con otros controles.
  4. Cerrar banner y verificar que no quede espacio vacío permanente.
- **Resultado esperado**: Layout estable en todos los breakpoints.

#### TC-REG-02
- **Pasos**:
  1. Instalar PWA.
  2. Abrir app instalada.
  3. Navegar por todas las páginas.
  4. Verificar que no quede ningún elemento con clase `pwa-install-banner` visible.
- **Resultado esperado**: Suite limpia, sin residuos de instalación.

## 6. Criterios de aceptación
- [ ] `beforeinstallprompt` se captura y no se pierde.
- [ ] Banner flotante aparece exactamente una vez por sesión no descartada.
- [ ] Al instalar, banner y botón topbar se ocultan automáticamente.
- [ ] Evento `appinstalled` se maneja y limpia estado.
- [ ] Dismiss persiste en localStorage y evita reapariciones.
- [ ] Service Worker se registra, activa y sirve offline.
- [ ] Manifest válido con iconos 192/512.
- [ ] No hay errores CORS/CSP durante instalación en Vercel.
- [ ] No hay residuos visuales post-instalación ni post-descarte.

## 7. Métricas y monitoreo
- Console logs clave: `[SW] Instalando`, `beforeinstallprompt`, `appinstalled`.
- localStorage: `cpc_pwa_install_dismissed`.
- Network: `/manifest.json` 200, `/service-worker.js` 200.
- DevTools → Application: SW activado, CacheStorage con `cpc-static-v1.1.0`.

## 8. Riesgos y mitigaciones
| Riesgo | Mitigación |
|--------|------------|
| `beforeinstallprompt` no se dispara en Safari/iOS | Provisión de instructivo de instalación manual en Ajustes (`gas-assistant.js`). |
| Banner tapa contenido en móvil | Revisar z-index y media queries CSS. |
| SW desactualizado tras deploy | Usar `skipWaiting()` + `clients.claim()` y versionado de cache. |
| localStorage lleno impide guardar dismiss | `CacheManager.checkQuota()` ya advierte; considerar fallback en memoria. |
