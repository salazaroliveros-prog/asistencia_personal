# Control de Asistencia de Personal de Campo (PWA)

Sistema de control de asistencia para personal de obra: registro de entrada/salida
por **QR** o **código en campo**, validación por **GPS/geocerca**, generación de
**carnés con QR**, **reportes PDF/Excel** y funcionamiento **offline-first**.

- **Versión:** 1.5.0
- **Frontend:** JavaScript vanilla (IIFE + `window.*`), sin framework
- **Build:** Vite (solo empaqueta/copia; no hay bundling de módulos ES)
- **Backend:** Firebase (Auth + Firestore + Cloud Functions), SDK *compat* 10.12.2
- **Datos en el dispositivo:** `localStorage` + cola de sincronización offline
- **Empaquetado móvil:** Capacitor (Android/iOS)
- **Despliegue web:** Vercel (`vercel.json`) y Firebase Hosting (`firebase.json`)

---

## 1. Propósito funcional

| Módulo | Qué resuelve |
|--------|--------------|
| **Dashboard** | KPIs del día (presentes, ausentes, tardanzas, horas), gráficas y alertas |
| **Personal** | Alta/edición/baja de trabajadores, carné con QR, foto, exportación |
| **Asistencia** | Marcaciones del día, entradas/salidas, corrección manual, filtros |
| **Campo** | Modo operativo para obra: marcación rápida por QR y geocerca GPS |
| **Reportes** | Informes por rango de fechas en PDF/Excel e impresión |
| **Ajustes** | Configuración de Firebase, geocerca, horarios, temas, respaldos |
| **Field Scanner** | App independiente (`field-scanner.html`) para escanear QR en obra |

---

## 2. Arquitectura

```
index.html  ← SPA con 6 páginas en un solo documento (router por hash)
   │
   ├── css/              6 hojas: tokens+tema, glassmorphism, componentes, campo, a11y, print
   ├── js/
   │   ├── config.js, firebase-config.js
   │   ├── firebase-client.js   ← Firestore/Auth + health-check + reconexión
   │   ├── api.js               ← capa de datos (Firestore ↔ caché ↔ cola offline)
   │   ├── modules/             ← una vista por página (dashboard, personal, …)
   │   ├── utils/               ← GPS, QR, PDF, caché, validación, helpers, tema, …
   │   └── app.js               ← arranque, router, topbar, sidebar, splash
   ├── field-scanner.html/.js   ← app de escaneo independiente (SW propio)
   ├── public/                  ← vendor (librerías locales), PWA, icons
   ├── functions/               ← Cloud Functions (claims de admin, borrado de usuarios)
   ├── src/                     ← tipos TS + dominio + SDK generado de Data Connect
   └── __e2e__/, __tests__/     ← pruebas Playwright, Jest y verificadores HTML
```

### Decisiones clave

1. **Sin framework**: cada archivo es un IIFE que publica un objeto global
   (`window.API`, `window.FirebaseClient`, `window.AppState`, …). El orden de las
   etiquetas `<script>` en `index.html` importa: define las dependencias.
   Vite no reescribe código, solo copia/minifica a `dist/`.
2. **Doble motor de datos**: `api.js` intenta Firestore y, si no hay conexión o
   credenciales, opera contra `localStorage` (modo local). Mantiene además una
   **cola de operaciones pendientes** que se reenvía al recuperar la conexión.
3. **Librerías externas en local con respaldo CDN**: `public/vendor/` contiene
   lucide, qrcode, html5-qrcode, leaflet, chart.js, html2canvas, jsPDF, su
   plugin autotable **y el SDK compat de Firebase**
   (`public/vendor/firebase/firebase-{app,auth,firestore,functions}-compat.js`,
   copiados desde `node_modules/firebase`, v12.19.0). Si un archivo local no
   carga, un `document.write` inserta el mismo paquete desde CDN (patrón
   *local-first*, compatible con la CSP de `vercel.json` y con `index.html`).
   Servir Firebase desde el propio origen elimina 4 peticiones bloqueantes a
   `gstatic.com` en el arranque (mejor FCP/DOMContentLoaded) y hace que la PWA
   funcione offline desde la primera visita; el service worker los precachea.

---

## 3. Rutas y navegación

El router es **hash-based** sobre un único `index.html`:

| Ruta | Sección en el DOM | Módulo JS |
|------|-------------------|-----------|
| `#dashboard` | `#page-dashboard` | `js/modules/dashboard.js` |
| `#personal` | `#page-personal` | `js/modules/personal.js` |
| `#asistencia` | `#page-asistencia` | `js/modules/asistencia.js` |
| `#campo` | `#page-campo` | `js/modules/campo.js` |
| `#reportes` | `#page-reportes` | `js/modules/reportes.js` |
| `#ajustes` | `#page-ajustes` | `js/modules/ajustes.js` |

Rutas servidas aparte (no SPA): `/field-scanner.html` (escáner de campo) y
`/pwa/*`. `vercel.json` reescribe cualquier ruta desconocida a `index.html`.

---

## 4. Base de datos (Firestore)

Colecciones usadas por la aplicación (esquema ampliado, índices y costos en
`docs/database-schema.md`):

| Colección | Contenido | Campos principales |
|-----------|-----------|--------------------|
| `personal` | Trabajadores | `ID_Trabajador`, `Nombre_Trabajador`, `Cedula`, `Cargo`, `Obra`, `Estado`, `foto`, `QR_Code` |
| `asistencias` | Marcaciones | `ID_Marcacion`, `ID_Trabajador`, `Nombre_Trabajador`, `Fecha` (`YYYY-MM-DD`), `Hora_Entrada`, `Hora_Salida`, `Latitud`, `Longitud`, `Dentro_Geocerca`, `Metodo` (`QR`/`MANUAL`/`CAMPO`) |
| `alertas` | Avisos del sistema | `ID_Alerta`, `Tipo`, `Mensaje`, `Fecha`, `Revisada` |
| `configuracion` | Config global (doc `general`) | `Latitud_Centro`, `Longitud_Centro`, `Radio_Geocerca`, `Hora_Entrada`, `Hora_Salida`, `Obras` |
| `users`, `roles`, `logs`, `departamentos`, `proyectos`, `notificaciones` | Definidas en el esquema y las reglas; uso parcial | ver `docs/database-schema.md` |

Convenciones:

- **IDs** como `string`; **fechas** como `YYYY-MM-DD`; **timestamps** en ms.
- **Denormalización deliberada** (`Nombre_Trabajador`, `Nombre_Obra` en
  `asistencias`) para evitar *joins* en los reportes.
- El acceso pasa siempre por `window.FirebaseClient` / `window.API`; las vistas
  nunca llaman a `firebase.firestore()` directamente.

`localStorage` (ver `LS_KEYS` en `js/utils/constants.js`): caché de personal y
asistencias, cola de operaciones offline, tema (`cpc_theme`), configuración de
Firebase (`cpc_firebase_config`) y marca del último sync.

---

## 5. Estilos y temas

Orden de carga en `index.html` (importa: hay cascada intencional):

```
main.css → accessibility.css → glassmorphism.css → components.css → campo.css → print.css
```

| Archivo | Responsabilidad |
|---------|-----------------|
| `main.css` | Reset, tokens (`:root`), tema claro/oscuro, layout (topbar/sidebar/páginas) y bloques responsive |
| `accessibility.css` | Foco visible, *skip link*, contraste, `prefers-reduced-motion` |
| `glassmorphism.css` | Sistema de superficies de vidrio (fondo, sidebar, cards, modales) y su responsive |
| `components.css` | Botones, inputs, tablas, calendario, QR, modales, KPI, toasts, navegación |
| `campo.css` | Vista de campo y escáner |
| `print.css` | Estilos de impresión de reportes |

### Sistema de temas

- El tema **base es oscuro** (`:root`); el claro se activa con
  `html[data-theme="light"]` y redefine los tokens de vidrio.
- `js/utils/theme-manager.js` guarda la preferencia en `localStorage`
  (`cpc_theme`) y sincroniza **los dos** conmutadores existentes:
  `#theme-toggle` (topbar, accesible en móvil) y `#theme-toggle-sidebar`
  (pie del cajón lateral).
- Cada botón contiene los dos iconos (sol y luna) y el CSS muestra solo el de
  la acción disponible según `data-theme`; no requiere re-render de Lucide.

### Breakpoints estandarizados

| Rango | Uso |
|-------|-----|
| `≤ 380px` | Móviles muy angostos (evita desbordes horizontales) |
| `≤ 479px` | Móvil pequeño |
| `480px – 767px` | Móvil grande |
| `≥ 768px` | Tablet/escritorio (sidebar fijo, desaparece el botón hamburguesa) |
| `≥ 1024px` | Escritorio |
| `1024px – 1199px` | Escritorio compacto |
| `landscape y ≤ 900px` | Ajustes de altura en horizontal |

Ergonomía móvil aplicada en el bloque final de `components.css`: áreas táctiles
≥ 44×44 px, modales en formato *hoja inferior*, scroll horizontal en tabs de
turno y tablas sin desbordamiento (columnas secundarias ocultas).

---

## 6. Scripts y flujo de trabajo

```bash
npm install            # instala deps (incluye devDependencies, ver sección 8)
npm run dev            # servidor Vite en http://127.0.0.1:3801
npm run build          # genera dist/
npm start              # build + vista previa en el puerto 3801

npm test               # pruebas unitarias (node __tests__/run-tests.mjs)
npm run test:html      # verificación estática del HTML
npm run test:e2e       # suite Playwright (65 pruebas, __e2e__/)
npm run typecheck      # tsc --noEmit sobre src/
npm run verify         # typecheck + tests + build

npm run cap:sync             # build + cap sync (Android/iOS)
npm run cap:build:android    # APK debug (requiere Android SDK)
```

### Organización de las pruebas

| Suite | Ubicación | Qué valida |
|-------|-----------|------------|
| Unitarias | `__tests__/unit/**/*.test.js` (Jest) | Lógica de dominio y utilidades |
| HTML/estáticas | `__tests__/verify-html.js` | IDs y *handlers* referenciados en `index.html` |
| E2E móvil | `__e2e__/mobile-ui.spec.ts` | Layout móvil, navegación, tablas, modales |
| E2E regresión | `__e2e__/comprehensive-manual-test.spec.ts` | Recorrido funcional + capturas base |
| E2E correcciones | `__e2e__/verify-fixes.spec.ts` | Sin desborde horizontal, drawer, tema, ergonomía |

Playwright usa el proyecto `mobile` (390×844, táctil) y añade casos de escritorio
(1280×800) dentro del mismo *spec* mediante `test.use`.

---

## 7. Despliegue

| Destino | Configuración | Notas |
|---------|---------------|-------|
| **Vercel** | `vercel.json` | `installCommand: npm ci --include=dev` (el build necesita Vite, que es devDependency), CSP estricta con permiso para los CDN de respaldo, cabeceras de caché por carpeta y *rewrites* a `index.html` |
| **Firebase Hosting** | `firebase.json` | Hosting + reglas de Firestore/Storage + functions |
| **Android / iOS** | `capacitor.config.json` | Copia `dist/` al proyecto nativo |

---

## 8. Entorno: problemas conocidos y solución

Esta sección documenta conflictos reales de entorno detectados y ya resueltos;
conviene revisarla antes de tocar la instalación de dependencias.

### 8.1 `npm install` borraba las devDependencies

Si el proceso que ejecuta npm hereda `NODE_ENV=production` (ocurre en algunos
IDE y en entornos de agentes), npm cambia el valor por defecto de `omit` a
`dev` y **elimina en silencio** Vite, Playwright, TypeScript y Jest. El
resultado es que `npm run build` y `npm test` dejan de funcionar.

Solución aplicada en `.npmrc`:

```ini
omit=peer
```

Fijar `omit` a un valor válido distinto de `dev` neutraliza el comportamiento
sin avisos de *invalid config* (`omit=`, vacío, funciona pero npm lo reporta
como inválido en cada comando). `peer` es coherente con el
`legacy-peer-deps=true` ya presente en el equipo: en la práctica no cambia el
árbol de dependencias. `vercel.json` añade además `--include=dev` explícito.

### 8.2 Navegadores de Playwright

La suite usa los navegadores instalados en la caché estándar
(`%LOCALAPPDATA%\ms-playwright`) y **no** requiere la variable
`PLAYWRIGHT_BROWSERS_PATH`. No definas esa variable con un valor terminado en
espacio (`set VAR=valor && comando`): crea una carpeta fantasma y un
`__dirlock` que bloquean instalaciones posteriores.

Si Playwright indica que falta el ejecutable:

```bash
npx playwright install chromium
```

### 8.3 VS Code

`.vscode/settings.json` excluye del índice y de los *file watchers*
`node_modules`, `dist`, `.playwright-browsers` (~450 MB), `playwright-report`
y `__e2e__/output`. Sin esas exclusiones VS Code consume CPU/RAM de forma
notoria y las tareas en segundo plano se bloquean.

### 8.4 OjO con las carpetas generadas

`dist/`, `playwright-report/`, `.playwright-browsers/`, `.playwright-mcp/`,
`.qa-deps/`, `functions/node_modules/` y `__e2e__/` están en `.gitignore`:
son artefactos locales y se pueden borrar sin afectar al código.

---

## 9. Documentación relacionada

- `docs/database-schema.md` — esquema completo de Firestore, índices y costos.
- `docs/NATIVE_BUILD.md` — compilación Android/iOS con Capacitor.
- `docs/TESTING_STRATEGY.md`, `docs/test-cases.md` — estrategia y casos de prueba.
- `docs/IMPLEMENTACION_CLAIMS_AUTH.md` — roles con *custom claims*.
- `docs/RESUMEN_*.md`, `docs/AUDITORIA_*.md` — historial de mejoras y auditorías.
- `README.Docker.md` — uso con Docker.