# Auditoría de integridad — Carnés y códigos QR

**Fecha:** 2026-09-27
**Versión del sistema:** 1.5.0
**Alcance:** carné de identificación del trabajador → render en el modal, PNG descargado, impresión y lectura por el escáner de campo (`field-scanner.html`) y la app principal (`asistencia.js` / `campo.js`).
**Spec de auditoría:** `__e2e__/carnet-qr-audit.spec.ts` (5 tests)

---

## 1. Veredicto

| | Antes | Después |
|---|---|---|
| QRs mostrados en el carné | **2 (duplicados)** | 1 |
| QR dentro del PNG descargado | **no decodificable** | decodifica el payload exacto |
| Carné de un trabajador sin DPI | **rechazado** por la app principal | se acepta y resuelve al trabajador |
| Payload del QR | 3 formatos distintos e incompatibles | canónico `{ id, dpi }` |
| Módulos del QR | 33 × 3,94 px con **2 px recortados** | 33 × 4 px **exactos (0 px recortados)** |

Los carnés **no estaban corruptos en su contenido** (los datos del trabajador se renderizaban completos y el QR era un símbolo válido y decodificable *dentro del canvas*), pero **sí había un defecto grave en el documento que recibe el usuario**: el carné mostraba y guardaba **dos códigos QR**, lo que impedía que un lector los decodificara.

---

## 2. Metodología (por qué esta auditoría sí demuestra algo)

Los reportes anteriores validaban "hay un canvas y tiene píxeles", lo que **no** prueba que el QR sea legible. Esta auditoría usa evidencia dura:

1. **Camino real del usuario:** se abre `#modal-carne` desde la tabla de Personal (clic en la acción `qr`); no se inyecta HTML ni texto decodificado.
2. **Decodificación real:** el `<canvas>` del carné se convierte a PNG y se decodifica con `Html5Qrcode.scanFileV2` — **el mismo motor** que usa el escáner de campo. Se exige coincidencia carácter a carácter con el payload esperado.
3. **Verificación de matriz:** se vuelve a codificar el mismo payload con la misma librería, se leen sus módulos (`_oQRCode.getModuleCount()` / `isDark()`) y se comparan con los píxeles del canvas del carné módulo por módulo (coincidencia medida: **100 %**). Además se comprueban los 3 *finder patterns*, el *timing pattern*, el módulo oscuro fijo y que el total sea `21 + 4k`.
4. **Interoperabilidad:** el payload decodificado se pasa por las 3 rutas de escaneo del sistema (`QRGenerator.parseQRData` + `buscarTrabajadorPorQR`, `CarnetValidator.validateQR` y las reglas de `field-scanner._parseQRData`).
5. **Artefacto final:** se descarga el PNG del carné (html2canvas), se guarda en `__e2e__/screenshots/carnet-audit-descargado.png` y se decodifica el QR **dentro de esa imagen**.

---

## 3. Hallazgos

### H1 — GRAVE · El carné mostraba DOS códigos QR (y el PNG descargado era ilegible)

**Síntoma:** el modal mostraba dos QR idénticos lado a lado; el PNG descargado también los contenía, y `Html5Qrcode.scanFileV2` sobre ese PNG devolvía
`No MultiFormat Readers were able to detect the code`.

**Causa raíz (medida, no supuesta):** `qrcodejs` inserta **siempre dos nodos**: el `<canvas>` y una `<img>` de respaldo con el mismo QR en *data URL* (se verificó `mismaImagen: true`). El CSS

```css
/* css/components.css:1153 */
.carne-qr canvas,
.carne-qr img { display: block !important; width: 130px !important; height: 130px !important; }
```

**anula con `!important` el `display:none`** que aplicaban tanto `renderCarneQR` como la propia librería. Diagnóstico del DOM del contenedor:

```
totalHijos: 2
 CANVAS  displayInline="none"  displayComputed="block"  130x130
 IMG     displayInline="block" displayComputed="block"  130x130  src="data:image/png;base64,..."
mismaImagen: true
```

**Corrección:** eliminar el nodo de respaldo del DOM (ocultarlo no basta) y dejar un único QR, el `<canvas>`.

### H2 — GRAVE · Los carnés de trabajadores sin DPI no se podían escanear en la app principal

`renderCarneQR` graba `{ id, dpi }`. Si el trabajador no tiene DPI, el payload queda `{"id":"TRAB-…"}` y `QRGenerator.parseQRData` exigía `id && (dpi || nombre)` → devolvía `null` → **"QR no reconocido. Usa un carné generado por este sistema."** en `asistencia.js` y `campo.js`.

Evidencia (ejecución real, antes del arreglo):

```json
{"viaQrGenerator":null,"errorQrGenerator":null,
 "viaFieldScanner":{"id":"TRAB-1789583331224-B7Q2M","dpi":""}}
```

Es decir: **el escáner de campo sí leía el carné, pero la app principal lo rechazaba** → dos consumidores con criterios distintos para el mismo código.

Un DPI ausente es un caso legítimo, no teórico: `js/api.js#normalizeWorker` no lo valida (acepta `dpi: ''`), `CarnetGenerator.validateWorkerForCarnet` sólo advierte, y hay registros reales así en `__tests__/functional-test-results.json` (`"dpi":""`).

**Corrección:** el ID es la clave del trabajador; `parseQRData` acepta `{ id }` (o `ID_Trabajador`), alineándose con `CarnetValidator.validateQR` y con `field-scanner._parseQRData`. También se alineó la aceptación del ID en texto plano con la del escáner de campo (superset: no se pierde compatibilidad con `TRAB-…`).

### H3 — MEDIO · Tres formatos de payload distintos y módulos de carné que no se cargan en la app

| Productor | Payload |
|---|---|
| Carné del modal (`qr-generator.js#renderCarneQR`) | `{"id":…,"dpi":…}` |
| `carnet-generator.js#generateWorkerQR` (cambio **sin commit** de la sesión anterior) | ID en texto plano |
| `carnet-validator.js#simulateQRScan` (mismo cambio) | ID en texto plano |
| `API.buildQrData` → `Codigo_QR_Data` | `{"id":…,"dpi":…,"nombre":…}` |

Además, `carnet-generator.js` y `carnet-validator.js` **no se cargan** en `index.html` ni en `field-scanner.html` (sólo en `carnet-test.html`): en producción son código muerto, porque el carné real lo dibuja `QRGenerator`.

El cambio "solo ID" degradaba la interoperabilidad: un ID en texto plano sólo es válido si empieza por `TRAB-`, y se pierde el **respaldo por DPI** de los buscadores. Con otro formato de ID (por ejemplo el *document id* de Firestore) el QR sería irreconocible.

**Corrección:** ambos módulos vuelven al payload canónico `{ id, dpi }`, idéntico al del carné.

**Corrección al reporte anterior:** `docs/reportes/VALIDACION_INTEGRIDAD_CARNETS_QR_2026-09-27.md` afirmaba un "code length overflow" del QR y recomendaba usar sólo el ID. Es **incorrecto**: el payload real mide **56 caracteres** y el símbolo resultante es versión 4 (33×33) con nivel de corrección M, decodificando perfectamente (ver §4). No hay ningún overflow.

### H4 — LEVE · Módulos del QR recortados (2 px)

`qrcodejs` dibuja cada módulo con un tamaño **entero** de píxeles: `Math.round(lado / módulos)`. Con 33 módulos y `lado = 130` usa 4 px/módulo = **132 px**, pero el canvas mide 130 px → **recorta 2 px** de la última columna y fila, dejando esos módulos a media anchura.

Medido antes: `modulos: 33 · moduloPx: 3.939 · simboloRenderizado: 132 · pixelesRecortados: 2`.
Medido después: `modulos: 33 · moduloPx: 4 · canvas: 132x132 · pixelesRecortados: 0`.

**Corrección:** se calcula primero el número de módulos y se dibuja el carné en un **múltiplo exacto** (`módulos × round(130/módulos)` = 132 px para 33 módulos), fijando también el tamaño CSS al mismo valor para mantener 1 px CSS = 1 px real (sin reescalado borroso). Si la API privada no estuviera disponible, se conserva el comportamiento anterior (130 px) como respaldo.

### H5 — RECOMENDACIÓN (no aplicada: es decisión de diseño)

`css/components.css:1155` aplica `border-radius: var(--radius-sm)` (**8 px**) al canvas del QR. Con módulos de 4 px, 8 px equivalen a **2 módulos** redondeados en cada esquina de los tres *finder patterns*, que son precisamente la referencia que usan los lectores. Hoy decodifica, pero reduce el margen de lectura en campo (foto con móvil, impreso pequeño). Sugerencia: `border-radius: 0` (o ≤ 2 px) para `#carne-qr-container canvas`.

La zona de silencio (*quiet zone*) la aporta el contenedor: `.carne-qr` tiene `padding: 16px 20px` y fondo `rgba(255,255,255,0.95)`; el canvas no la incluye (`margenModulos: 0`). Es correcto mientras nadie cambie ese fondo/padding.

### H6 — OPERATIVO · Los E2E locales validan el build, no el código fuente

El servidor en `127.0.0.1:3801` es **`vite preview` sirviendo `dist/`** (comprobado: el archivo servido es byte a byte idéntico a `dist/js/utils/qr-generator.js` y no coincide con `js/utils/qr-generator.js`). Consecuencia: **cualquier cambio en `js/**` no surte efecto en los E2E hasta ejecutar `npm run build`**, y los tests pueden dar "verde" sobre código antiguo.

Durante esta auditoría se sincronizaron los 3 archivos corregidos en `dist/js/utils/` (`dist/` está en `.gitignore`) para poder validar los arreglos contra el mismo servidor. **Recomendación: ejecutar `npm run build`** para regenerar el artefacto desde las fuentes.

---

## 4. Cambios aplicados

| Archivo | Cambio |
|---|---|
| `js/utils/qr-generator.js` | `renderCarneQR`: se elimina el `<img>` de respaldo (queda un único `<canvas>`); el contenedor se limpia antes de dibujar; tamaño del canvas = múltiplo exacto del número de módulos y CSS 1:1. `parseQRData`: acepta payloads con sólo `id`/`ID_Trabajador` (DPI y nombre pasan a ser opcionales) y acepta ID en texto plano como el escáner de campo. |
| `js/utils/carnet-generator.js` | `generateWorkerQR` vuelve al payload canónico `JSON.stringify({ id, dpi })`. |
| `js/utils/carnet-validator.js` | `simulateQRScan` genera el mismo payload canónico (antes ID plano). |
| `__e2e__/carnet-qr-audit.spec.ts` | **Nuevo.** 5 tests de auditoría: matriz exacta, decode del canvas, decode del PNG descargado, interop de las 3 rutas de escaneo, escaneabilidad/quiet zone. |
| `dist/js/utils/*` (3 archivos) | `npm run build` regeneró `dist/` desde las fuentes; se comprobó que copia los tres archivos byte a byte (`fc /b` → idénticos), de modo que ya no hay parcheo manual. |

---

## 5. Verificación (post-corrección)

| Comprobación | Resultado |
|---|---|
| `npx playwright test __e2e__/carnet-qr-audit.spec.ts` (5 tests) | **5/5 PASS** |
| Payload decodificado del canvas | `{"id":"TRAB-1789583331224-B7Q2M","dpi":"0101199000012"}` — coincidencia exacta |
| Módulos: 33 (21+4k) · coincidencia con el modelo | 33 · **100 %** |
| Finder / timing / módulo oscuro | presentes y correctos |
| Decode del PNG descargado (artefacto real) | **OK** |
| Rutas de escaneo (`parseQRData`, `validateQR`, `field-scanner`) | las 3 aceptan el payload |
| Carné sin DPI (`{"id":…}`) | aceptado (antes rechazado) |
| Suite unitaria | **117/117 PASS** (13 suites) |
| ESLint (`js/utils/qr-generator.js`, `carnet-generator.js`, `carnet-validator.js`) | **sin errores ni warnings** |
| Compatibilidad con specs existentes | `live-mobile-smoke.spec.ts` y `live-production-audit.spec.ts` usan el selector `#carne-qr-container canvas, img` → siguen cumpliendo (el canvas permanece) |

### Build, CI y despliegue (commit `d463c2e`)

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | sin errores |
| `npm run lint` (`--max-warnings 50`) | **0 errores**, 3 warnings preexistentes en `js/modules/ajustes.js` |
| `npm test` | **117/117 PASS** (13 suites) |
| `npm run build` (vite + inject-env) | OK; `dist/` regenerado y sincronizado con las fuentes |
| `npx playwright test __e2e__/carnet-qr-audit.spec.ts` tras el build | **5/5 PASS** (24.7 s) |
| `__e2e__/carnet-visual.spec.ts` (5 tests) | **5/5 PASS** |
| `__e2e__/live-worker-carnet.spec.ts` (2 tests) | **2/2 PASS** |
| GitHub Actions · CI run [36359817095](https://github.com/salazaroliveros-prog/asistencia_personal/actions/runs/36359817095) | **success**: TypeScript Check 19 s, Unit Tests 22 s, Lint 20 s, Build 23 s, Validate PWA 46 s (artefacto `dist-d463c2e…`) |
| Vercel · deployment `dpl_DcQ25e7zgKrvs6yttPqBNB1dy9Wi` | **Ready** (Production, 15 s) |
| Vercel · alias de producción | `https://controlasistenciaapp.vercel.app` |
| HTTP en producción (`index.html`, `js/utils/qr-generator.js`, `field-scanner.html`) | **200 · 200 · 200** |
| Marcador de versión del deploy | `window.__APP_VERSION__ = "d463c2ef18db8107187b4f7dbb25366854253324"` (SHA del commit) |
| MD5 del `qr-generator.js` servido en producción vs. blob del commit `d463c2e` en GitHub | `e0cd06a377b82db2c0109606aa03dd2f` = `e0cd06a377b82db2c0109606aa03dd2f` → **byte-idénticos** |

> Nota sobre los finales de línea: el archivo local (Windows) usa CRLF y el build de Vercel (Linux) usa LF, por eso el MD5 del `dist/` local no coincide con el del deploy; contra el blob de git la coincidencia es exacta.

### Evidencia gráfica

- `__e2e__/screenshots/carnet-audit-completo.png` — carné completo con **un solo** QR centrado.
- `__e2e__/screenshots/carnet-audit-descargado.png` — PNG descargado, decodificado con éxito.

---

## 6. Pendientes y recomendaciones

1. ~~**Ejecutar `npm run build`** y volver a correr la auditoría contra el `dist` regenerado~~ — **Hecho (27/09/2026)**: `dist/` regenerado desde las fuentes, auditoría repetida (5/5) y cambios desplegados en producción con CI en verde.
2. **`border-radius` del canvas del QR → 0** (H5) para maximizar el margen de lectura en campo.
3. **Unificar el payload en una sola constante** (por ejemplo `API.buildQrData`) usada por el carné, `CarnetGenerator` y `CarnetValidator`, para que no vuelvan a divergir los tres productores.
4. **Revisar qué hacer con `carnet-generator.js` / `carnet-validator.js`**: hoy no se cargan en las páginas de producción; o se integran (cargándolos en `index.html`) o se documentan como utilidades sólo de pruebas.
5. **`docs/reportes/VALIDACION_INTEGRIDAD_CARNETS_QR_2026-09-27.md` contiene afirmaciones inexactas** (overflow inexistente; test de duplicados que no detectaba el duplicado real). Este informe lo sustituye; conviene no citarlo como fuente.
6. **`__e2e__/qr-integrity.spec.ts` fue eliminado** (creado sin commit en la sesión anterior): generaba un QR a mano con payload de sólo ID y `CorrectLevel.H` —institucionalizando el formato y la premisa de "overflow" que esta auditoría refuta— y sólo verificaba "hay píxeles", sin decodificar. Su cobertura la cubre `carnet-qr-audit.spec.ts` con decodificación real.
7. **`__e2e__/carnet-visual.spec.ts` reforzado:** su test "validar que la función CarnetGenerator esté disponible" no tenía **ninguna aserción** (sólo `console.log`), por lo que "pasaba" sin validar nada —el mismo defecto metodológico que este informe señala. Ahora comprueba `window.QRCode` y `window.QRGenerator` (el generador real del carné) y deja constancia de que `window.CarnetGenerator` no está cargado en producción.
8. **No lanzar dos ejecuciones de Playwright en paralelo:** comparten `__e2e__/output/.playwright-artifacts-*` y fallan con `browserContext.close: ENOENT … .trace` (fallo espurio, no del producto).

