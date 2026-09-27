# Checklist — Connection Hub / Ajustes v2

Fecha: 2026-09-22  
Commit objetivo: reemplazo de auth en Ajustes por Connection Hub.

## Diagnóstico (evidencia)

- [x] Google fallaba por CSP `frame-src` sin `*.firebaseapp.com` / `accounts.google.com`
- [x] Estado `connected` se escribía desde Ajustes, FirebaseClient y API (acoplamiento)
- [x] Solo popup Google sin fallback redirect (móvil/PWA)
- [x] Field-scanner auth paralelo (email); marcajes dependen de Persist

## Quitar / desacoplar

- [x] Auth UI y handlers de login/logout desde `ajustes.js`
- [x] Escrituras optimistas `AppState.connected` desde Ajustes
- [x] Card “Datos y sincronización” + “Configuración inicial” mezclada con auth
- [x] IDs legacy: `firebase-auth-*`, `btn-login-firebase`, `btn-login-google`, `btn-connect-firebase`, `btn-use-local`, `connection-status-detail`

## Corregir

- [x] CSP `frame-src` + `form-action` para Google/Firebase Auth
- [x] `signInWithGoogle` popup → redirect automático
- [x] `completeGoogleRedirect()` en arranque del hub
- [x] Mensajes Auth (unauthorized-domain, provider, popup, etc.)
- [x] Sync cola offline al autenticar / botón hub

## Añadir / refactor

- [x] Módulo `js/modules/connection-hub.js`
- [x] Card HTML `#connection-hub-card` (span full width)
- [x] Ajustes solo: General, Horarios, GPS, Escáner, Logo, Backup, Roles
- [x] Config Firebase en panel “Avanzado” colapsado
- [x] Estilos hub (chip, actions) en `components.css`
- [x] `app.js` inicia `ConnectionHub.init()`
- [x] E2E actualizado a IDs hub

## Verificar (post-deploy)

- [ ] Login Google en Chrome (popup + redirect)
- [ ] Login email
- [ ] Authorized domain en Firebase Console incluye el host Vercel
- [ ] Proveedor Google habilitado en Firebase Auth
- [ ] Marcaciones/cámaras con sesión
- [ ] Field-scanner con sesión email
- [ ] CI + Vercel verdes
