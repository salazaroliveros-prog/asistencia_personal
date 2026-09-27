# Auditoría integral del sistema — 2026-09-17

Diagnóstico granular del proyecto **CONTROL PERSONAL CAMPO v1.5.0** en cinco
dimensiones (lógica/arquitectura, capa de datos, integridad funcional, interfaz y
especificaciones técnicas), con las correcciones aplicadas y su verificación.

Alcance: repositorio completo (`index.html`, `js/`, `src/`, `firestore.rules`,
`functions/`, `dataconnect/`, pruebas y documentación).

---

## 1. Resumen ejecutivo

| Indicador | Antes | Después |
|-----------|-------|---------|
| `npm run lint` | **1 126 errores** (1 118 de `linebreak-style`) + 50 warnings | **0 errores**, 49 warnings |
| `npm test` (Jest) | **5 fallos** / 51 (todos en `firebase-client.test.js`) | **54/54 pasan** |
| `npm run typecheck` | **1 error TS1005** (archivo huérfano con sintaxis rota) y, tras limpiarlo, cientos de errores por `checkJs` en `js/**` | **0 errores** |
| `npm run build` | OK | OK |
| `npm run verify` | **fallaba** (lint + typecheck) | **completo en verde** |
| Job `lint` de CI | deshabilitado por errores | reactivado |

Además se corrigieron **4 defectos funcionales/de seguridad** que no detectaba
ninguna suite: login anónimo incompatible con las reglas de Firestore, actualización
de alertas que se denegaba o destruía datos, `configure()` sin validación previa y
reconexión apuntando a la app/proyecto equivocados.

---

## 2. Metodología

Comandos ejecutados (Windows, Node v24.16.0):

```bash
npm run lint            # ESLint 8.57
npm test                # Jest (7 suites, __tests__/unit)
npm run typecheck       # tsc --noEmit
npm run build           # Vite 8 + vite-plugin-pwa + inyección de env
node __tests__/verify-html.js
npx playwright test     # E2E (ver §6.2)
git --no-pager diff     # cambios sin commitear de la sesión anterior
```

Inspección manual de: `js/api.js`, `js/firebase-client.js`, `js/config.js`,
`js/app.js`, `js/modules/{ajustes,asistencia,dashboard}.js`,
`js/utils/{validators,alerts,validation-rules}.js`, `src/api.ts`,
`src/domain/*.ts`, `src/types/*.d.ts`, `firestore.rules`,
`firestore.indexes.json`, `functions/index.js`, `dataconnect/*`, `vite.config.mjs`,
`tsconfig.json`, `.eslintrc.js`, `.prettierrc`, `.github/workflows/ci.yml`,
`README.md`, `docs/database-schema.md`.

---

## 3. Hallazgos y correcciones

### 3.1 Artefactos de una sesión anterior rompían el toolchain (crítico)

**Evidencia.** Estaban sin commitear ficheros temporales de un agente previo:

- `js/firebase-client-new.js` — copia truncada del cliente, con error de sintaxis
  (`error TS1005: ')' expected`, línea 47, y `Parsing error` en ESLint).
- `js/firebase-client-full.txt` — volcado idéntico (mismo MD5) de
  `js/firebase-client.js`.
- `.tmp-count.js`, `.tmp-extract-ajustes.js`, `.tmp-parse-index.js`,
  `.tmp-write-client.js`, `.tmp-write-final.js`, `.tmp-write-tsconfig.js`.

**Impacto.** `npm run typecheck` fallaba por el archivo con sintaxis rota y
`npm run lint` no podía terminar (error de parseo). Riesgo añadido: los
`.tmp-write-*.js` sobrescribían `js/firebase-client.js` y `tsconfig.json` si
alguien los ejecutaba.

**Corrección.** Eliminados los 8 archivos.

### 3.2 Contradicción ESLint ↔ Prettier en los finales de línea (crítico para CI)

**Evidencia.** `.eslintrc.js` fijaba `'linebreak-style': ['error','windows']`
mientras `.prettierrc` tenía `"endOfLine": "lf"`, y el repositorio tiene finales
mixtos (los archivos reescritos por herramientas quedan en LF; `core.autocrlf=true`
convierte a CRLF sólo en el checkout de Windows; en Linux/CI nunca hay CRLF).
Medición: **1 118 de los 1 126 errores de lint eran `linebreak-style`**.

**Impacto.** `npm run format` rompía `npm run lint` (círculo vicioso), el job de CI
tuvo que deshabilitarse y ningún desarrollador en Linux podía pasar el lint.

**Corrección.**

- `.eslintrc.js` → `'linebreak-style': 'off'` (con comentario explicativo).
- `.prettierrc` → `"endOfLine": "auto"`.
- `.github/workflows/ci.yml` → job `lint` reactivado (ahora 0 errores, 49 warnings,
  por debajo del límite de 50 que impone el script).

### 3.3 `tsconfig.json` incluía la capa JS legacy (crítico para CI)

**Evidencia.** La configuración sin commitear añadía
`"include": ["src/**/*.ts", "js/**/*.js"]` con `checkJs` + `noImplicitAny`. Al
eliminar el archivo roto, `tsc` reportó **cientos** de `TS7006` (parámetros
implícitos `any`) y `TS2339` en `js/api.js`, `js/utils/*.js`, `js/modules/*.js`:
son scripts clásicos (IIFE con globals implícitos), no módulos tipados.

**Impacto.** La tarea "TypeScript Check" de CI fallaría en cada push.

**Corrección.** `tsconfig.json` vuelve a `"include": ["src/**/*.ts"]` con
`allowJs:false`/`checkJs:false` y un comentario que documenta la decisión y dónde se
valida esa capa (ESLint + Jest + Playwright). Los contratos de los globals quedan en
`src/types/*.d.ts`. Ver §6.3 para la alternativa.

### 3.4 El auto-login anónimo era incompatible con `firestore.rules` (crítico: funcional/seguridad)

**Evidencia.** `js/firebase-client.js` ejecutaba `_tryAutoAnonymousSignIn()` cuando
no había usuario (auto-init y evento `online`), y `_setState()` marcaba
`AppState.connected = true` incluso en estado `connecting`.

Pero las reglas exigen identidad verificada para escribir:

```text
canMarkAttendance() = isAuthorizedOperator() || isAdmin() || isManager() || isSupervisor()
isAuthorizedOperator() = email_verified && email == 'sistemadecontrol090@gmail.com'
canManageWorkers() = isAdmin() || isManager()
```

**Impacto.** Con sesión anónima la app mostraba "Firestore en línea" (badge y
`connection-status-detail`), `API.connected()` devolvía `true`, y sin embargo
**todas** las escrituras caían en `permission-denied`: cada alta de trabajador o
marcación acababa en la cola offline sin que el operador lo supiera. Se leía lo
remoto, no se guardaba nada: la peor combinación posible.

**Corrección.**

- Nuevo interruptor explícito `window.FIREBASE_ALLOW_ANONYMOUS` (por defecto
  **false**): sin sesión el cliente queda en `disconnected` y no intenta login
  anónimo.
- `_setState()` marca `AppState.connected` sólo en `connected`/`degraded` (antes
  `connecting` contaba como conectado y el badge mentía durante el arranque).
- `js/modules/ajustes.js` ya no fuerza `AppState.connected = true`: usa el nuevo
  helper `_sincronizarEstadoConexion()`, que deriva el estado del cliente (única
  fuente de verdad); si sólo se configuró sin iniciar sesión informa
  "Configuración aceptada. Inicia sesión para escribir en Firestore…".
- Documentado en `README.md` §4.1 y en la cabecera del cliente.

### 3.5 `marcarAlertaRevisada` denegaba o borraba la alerta (alto)

**Evidencia.** `js/api.js`: `FirebaseClient.save('alertas', alertId, { Revisada: true })`
sin `merge`. `FirebaseClient.save()` usa `docRef.set(data, { merge: !!merge })`, es
decir un **reemplazo total** del documento.

**Impacto.** La regla `allow update ... affectedKeys().hasOnly(['Revisada'])` recibe
un documento que elimina `Tipo`, `Mensaje` y `Timestamp` → `permission-denied`; y de
haber pasado, la alerta habría quedado reducida a `{Revisada:true}`. Afecta a
"Descartar alerta" y "Marcar todas" del dashboard.

**Corrección.** `merge = true` + comentario explicativo.

### 3.6 `isValidAlerta` validaba un esquema inexistente (alto)

**Evidencia.** La regla exigía claves en minúsculas (`tipo`, `mensaje`, `timestamp`,
`revisada`) mientras el cliente, el caché y `docs/database-schema.md` usan
PascalCase (`ID_Alerta`, `Tipo`, `Mensaje`, `Timestamp`, `Revisada`).

**Impacto.** Ninguna alerta creada desde la app/backoffice podía superar
`allow create`; el `allow update` sí coincidía (usa `Revisada`), de ahí que el
defecto pasara desapercibido.

**Corrección.** `firestore.rules` acepta las dos formas (PascalCase documentado y
minúsculas heredadas) para no invalidar datos históricos. **Requiere desplegar las
reglas** (`firebase deploy --only firestore:rules`).

<!-- CONT -->