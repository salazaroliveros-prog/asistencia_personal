# Development Guidelines — Control Personal Campo

## Code Quality Standards

### File Header Convention
Every JS file starts with a JSDoc block identifying the module, purpose, and version:
```js
/**
 * CONTROL PERSONAL CAMPO — <filename>
 * <One-line description of the module's responsibility.>
 * @version 1.5.0
 */
```

### Section Separators
Long files use ASCII-art dividers to separate logical sections:
```js
// ─────────────────────────────────────────────────────────────────────────────
// SECTION NAME
// ─────────────────────────────────────────────────────────────────────────────
```

### JSDoc on Public Functions
All exported/public functions have JSDoc with `@param` and `@returns`:
```js
/**
 * Genera el reporte diario de asistencia.
 * @param {string} fecha - YYYY-MM-DD
 * @param {Array} asistencias - Marcaciones del día
 * @param {'portrait'|'landscape'} orientation
 * @returns {jsPDF}
 */
function reporteDiario(fecha, asistencias, orientation = 'portrait') { ... }
```

Private helpers (prefixed `_`) may have shorter inline comments.

---

## Module Pattern (IIFE + Revealing Module)

Every feature module and utility is an IIFE that returns a public API object:
```js
const ModuloPersonal = (() => {
  // Private state
  let _editingId = null;

  // Private functions prefixed with _
  function _bindEvents() { ... }
  function _renderTabla(data) { ... }

  // Public API
  return {
    init,
    cargar,
    abrirModalCarne: _abrirModalCarne,
  };
})();
```

- Private members: `_camelCase` (underscore prefix)
- Public members: `camelCase` (no prefix)
- Each module exposes at minimum `init()` and `cargar()` functions

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Module globals | PascalCase | `ModuloPersonal`, `PDFBuilder`, `AppState` |
| Private functions | `_camelCase` | `_bindEvents`, `_renderTabla` |
| Public functions | `camelCase` | `init`, `cargar`, `reporteDiario` |
| DOM helper alias | `$` | `const $ = (id) => document.getElementById(id)` |
| Constants | `UPPER_SNAKE_CASE` | `APP_VERSION`, `LS_KEYS`, `TIPOS_MARCACION` |
| Firestore field names | `PascalCase_With_Underscores` | `ID_Trabajador`, `Nombre_Completo`, `Tipo_Marcacion` |
| CSS variables | `--kebab-case` | `--color-primary`, `--space-4`, `--font-mono` |
| localStorage keys | `cpc_snake_case` | `cpc_personal_cache`, `cpc_last_sync` |

---

## AppState — Reactive Global Store

All cross-module state flows through `AppState`. Never store shared state in module-level variables.

```js
// Read
const personal = AppState.get('personal');
const today    = AppState.today();

// Write (triggers listeners)
AppState.set('personal', updatedList);

// Subscribe
AppState.on('personal', (newValue, prevValue) => {
  _filtrarTabla();
});

// Unsubscribe
AppState.off('personal', myCallback);
```

Key state properties: `currentPage`, `backendMode` (`'local'|'firestore'`), `connected`, `personal`, `asistencias`, `alertas`, `config`, `loading`.

---

## Dual Backend Pattern

Always check `backendMode` before deciding where to persist data:
```js
if (AppState.get('backendMode') !== 'firestore') {
  // Local mode: update AppState + localStorage
  const result = _guardarPersonalLocal(payload, isEdit);
  ...
  return;
}

// Online mode: call API
const result = await API.registrarPersonal(payload);
```

Never call Firestore SDK directly from modules — always go through `API.*`.

---

## Error Handling Pattern

All async operations follow this try/catch/finally structure:
```js
const loader = Alerts.loading('Procesando...');
const btn = document.getElementById('btn-guardar');
if (btn) btn.disabled = true;

try {
  const result = await API.someOperation(payload);
  loader.close();
  if (result.success) {
    Alerts.success(result.message || 'Operación exitosa');
  } else {
    Alerts.error(result.error || 'Error desconocido');
  }
} catch (err) {
  loader.close();
  if (window.ErrorHandler) {
    const handled = window.ErrorHandler.handle(err, { context: 'operationName' });
    Alerts.error(handled.message, 'Error de conexión');
  } else {
    Alerts.error(err.message, 'Error de conexión');
  }
} finally {
  if (btn) btn.disabled = false;
}
```

---

## Logging Pattern

Use `window.Logger` when available, with module name as first argument:
```js
if (window.Logger) {
  window.Logger.info('ModuloPersonal', 'Iniciando guardado', { isEdit: !!_editingId });
  window.Logger.warn('ModuloPersonal', 'Validación fallida');
  window.Logger.error('ModuloPersonal', 'Excepción', { error: err.message, stack: err.stack });
}
```

---

## DOM Interaction Patterns

### Element Access
```js
const $ = (id) => document.getElementById(id);
// Usage: $('btn-guardar-personal')
```

### Event Delegation (preferred over per-element listeners)
```js
tbody.onclick = (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { id, action } = btn.dataset;
  if (action === 'edit')   _abrirModalEditar(id);
  if (action === 'delete') _confirmarEliminar(id);
};
```

### Modal Open/Close
```js
// Open
const modal = document.getElementById('modal-personal');
if (modal) {
  modal.hidden = false;
  const firstInput = modal.querySelector('input:not([hidden]):not([type="file"])');
  if (firstInput) setTimeout(() => firstInput.focus(), 100);
}

// Close
const modal = document.getElementById('modal-personal');
if (modal) modal.hidden = true;
```

Modals use `hidden` attribute (not CSS classes) to show/hide. The global `MutationObserver` in `app.js` handles focus management automatically for `.modal-overlay` elements.

### Lucide Icons Re-render
After injecting HTML with `<i data-lucide="...">` icons, always call:
```js
if (window.lucide) lucide.createIcons({ nodes: [containerElement] });
```

---

## HTML Injection Safety

Always escape user-supplied strings before inserting into innerHTML:
```js
const esc = (str) => CPC.StringHelpers?.escHtml?.(str) ?? _escHtml(str);

// In template literals:
`<td>${esc(worker.Nombre_Completo)}</td>`
```

Never use `innerHTML = userInput` without escaping.

---

## Form Validation Pattern

Two-layer validation: inline field checks + shared `Validators` module:
```js
// Layer 1: inline field validation
function _validateForm() {
  let valid = true;
  const nombre = document.getElementById('p-nombre')?.value.trim();
  if (!nombre || nombre.length < 3) {
    _showError('p-nombre-error', 'El nombre debe tener al menos 3 caracteres');
    valid = false;
  } else {
    _clearError('p-nombre-error');
  }
  return valid;
}

// Layer 2: shared validators
const validation = Validators.validateTrabajador(payload);
if (!validation.valid) {
  Alerts.error(validation.errors[0].error, 'Error de validación');
  return;
}
```

Error display helpers:
```js
function _showError(errorId, message) {
  const el = document.getElementById(errorId);
  if (el) { el.textContent = message; el.hidden = false; }
}
function _clearError(errorId) {
  const el = document.getElementById(errorId);
  if (el) { el.textContent = ''; el.hidden = true; }
}
```

---

## Debounce / Performance

Use `RequestOptimizer.debounce` for search inputs (not a custom debounce):
```js
const debouncedFilter = RequestOptimizer.debounce('personal-search', _filtrarTabla, 300);
searchInput.addEventListener('input', debouncedFilter);
```

---

## PDF Generation Pattern (PDFBuilder)

All PDF reports follow: `_newDoc()` → `_drawHeader()` → `doc.autoTable()` → `_drawFooter()` → return `doc`.

```js
function reporteDiario(fecha, asistencias, orientation = 'portrait') {
  const doc = _newDoc(orientation);
  let y = _drawHeader(doc, 'REPORTE DIARIO DE OBRA', fechaFormateada, total);
  _drawSummaryRow(doc, summaryData, y, orientation);
  y += 22;
  doc.autoTable({ startY: y, margin: { left: 15, right: 15, top: 10, bottom: 22 }, ... });
  _drawFooter(doc);
  return doc;
}
```

Color constants are RGB arrays: `COLORS.primary = [0, 126, 167]`.

---

## Cloud Functions Pattern

All callable functions follow this guard structure:
```js
exports.functionName = functions.https.onCall(async (data, context) => {
  // 1. Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }
  // 2. Permission check
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores...');
  }
  // 3. Input validation
  if (!data.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'UID es requerido');
  }
  // 4. Operation + audit log
  try {
    await admin.auth().someOperation(...);
    console.log(`Action by admin ${context.auth.uid}: ...`);
    return { success: true, ... };
  } catch (error) {
    console.error('Error:', error);
    throw new functions.https.HttpsError('internal', `Error: ${error.message}`);
  }
});
```

---

## E2E Test Patterns (Playwright)

Tests are organized in `test.describe` blocks by feature area. Each block uses:
- `test.beforeEach` for navigation setup
- Helper functions `waitForSplash(page)` and `navigateTo(page, section)` for common setup
- Screenshots saved to `__e2e__/output/` with numbered filenames
- Soft checks for non-critical assertions (e.g., accessibility warnings use `toBeLessThan` not `toHaveLength(0)`)
- Firebase/network errors are filtered from fatal JS error checks

```ts
async function waitForSplash(page: Page) {
  await page.waitForSelector('#splash-screen[hidden]', { timeout: TIMEOUT }).catch(() => {});
  await page.waitForSelector('#app-wrapper, .app-wrapper, #page-dashboard', { timeout: TIMEOUT }).catch(() => {});
}
```

---

## Firestore Data Model Conventions

Field names use `PascalCase_With_Underscores` (matching the original GAS backend schema):

| Collection | Key Fields |
|-----------|-----------|
| `personal` | `ID_Trabajador`, `Nombre_Completo`, `DPI_CUI`, `Puesto`, `Estado` |
| `asistencias` | `ID_Marcacion`, `ID_Trabajador`, `Fecha` (YYYY-MM-DD), `Tipo_Marcacion`, `Hora_Real`, `Estado_Marcacion` |
| `configuracion` | Mirrors `DEFAULT_CONFIG` keys |
| `alertas` | `Revisada` (boolean, updatable by any auth user) |

Dates are stored as strings in `YYYY-MM-DD` format. Times as `HH:MM` or `HH:MM:SS`.

---

## Accessibility Requirements

- All interactive elements must have `aria-label` when text content is not descriptive
- Modals must use `role="dialog"` and `aria-modal="true"` with `aria-labelledby`
- Navigation links use `aria-current="page"` for the active item
- Respect `prefers-reduced-motion` for page transition animations
- Minimum touch target: 44px (WCAG), practical minimum 28px enforced in E2E tests
- Skip link `.skip-link` pointing to `#app` must be present

---

## Localization

- All UI text is in Spanish (Guatemala)
- Date formatting: `toLocaleDateString('es-GT', ...)` and `toLocaleTimeString('es-GT', ...)`
- Timezone: `America/Guatemala` (GMT-6)
- DPI/CUI: exactly 13 digits, numeric only
- Phone numbers: Guatemalan format (8 digits, prefix `502` for WhatsApp links)
