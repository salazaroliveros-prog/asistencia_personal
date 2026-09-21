/**
 * Control Personal Campo — Puestos de trabajo personalizados (unit tests)
 *
 * Verifica que el usuario pueda registrar puestos que no están en el catálogo
 * base, que se persistan en localStorage, que no se dupliquen y que se
 * reinyecten tanto en el select del formulario (#p-puesto) como en el filtro
 * de la tabla (#filter-puesto).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const personalCode = fs.readFileSync(
  path.resolve(__dirname, '../../js/modules/personal.js'),
  'utf8',
);

const CUSTOM_VALUE = '__custom__';
const CUSTOM_KEY = 'cpc_puestos_custom';
const BASE = ['Albañil', 'Maestro de Obra', 'Plomero'];
const FILTRO_EN_HTML = ['', 'Albañil', 'Maestro de Obra'];
const FORM_SELECT_ID = 'p-puesto';
const FILTER_SELECT_ID = 'filter-puesto';
const CUSTOM_INPUT_ID = 'p-puesto-custom';

/** Elemento genérico para ids no declarados explícitamente. */
function makeGeneric() {
  return {
    value: '',
    checked: false,
    hidden: false,
    textContent: '',
    innerHTML: '',
    src: '',
    style: {},
    options: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    appendChild() {},
    insertBefore() {},
    removeChild() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus() {},
  };
}

/** <select> falso con appendChild/insertBefore reales sobre `options`. */
function makeSelect(id, values) {
  const el = makeGeneric();
  el.id = id;
  el.options = values.map((valor) => ({ value: valor, textContent: valor }));
  el.value = values[0] || '';
  el.appendChild = function appendChild(node) { this.options.push(node); };
  el.insertBefore = function insertBefore(node, ref) {
    const index = this.options.indexOf(ref);
    if (index < 0) this.options.push(node);
    else this.options.splice(index, 0, node);
  };
  el.dispatch = function dispatch(type, event = {}) {
    (this.listeners[type] || []).forEach((fn) => fn(event));
  };
  return el;
}

/** Entorno aislado: DOM mínimo + localStorage respaldado por un Map. */
function buildContext() {
  const elements = {
    [FORM_SELECT_ID]: makeSelect(FORM_SELECT_ID, ['', ...BASE, CUSTOM_VALUE]),
    [FILTER_SELECT_ID]: makeSelect(FILTER_SELECT_ID, [...FILTRO_EN_HTML]),
    [CUSTOM_INPUT_ID]: makeGeneric(),
    'p-puesto-error': makeGeneric(),
    'btn-nuevo-personal': makeGeneric(),
  };
  const generic = makeGeneric();
  const store = new Map();

  const localStorageStub = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => store.clear(),
  };

  const documentStub = {
    readyState: 'complete',
    getElementById: (id) => elements[id] || generic,
    createElement: (tag) => ({ tagName: tag, value: '', textContent: '' }),
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { classList: { add() {}, remove() {} }, appendChild() {}, removeChild() {} },
  };

  const mockWindow = {
    PUESTOS: [...BASE],
    AppState: {
      get: (key) => (key === 'personal' ? [] : undefined),
      set() {},
      on: () => () => {},
      today: () => '2026-01-01',
    },
    LS_KEYS: { PERSONAL_CACHE: 'cpc_personal_cache', FIREBASE_CONFIG: 'cpc_firebase_config' },
    API: {},
    Alerts: {},
    DEFAULT_CONFIG: {},
    CPC: {},
    Logger: null,
    lucide: null,
    setTimeout,
    clearTimeout,
  };

  const sandbox = {
    window: mockWindow,
    document: documentStub,
    localStorage: localStorageStub,
    console,
    JSON,
    Math,
    Date,
    String,
    Array,
    Object,
    Promise,
    Error,
    TypeError,
    RegExp,
    Map,
    Set,
    Number,
    Boolean,
    isNaN,
    parseInt,
    parseFloat,
    setTimeout,
    clearTimeout,
    navigator: { mediaDevices: null },
    location: { protocol: 'https:', href: '', origin: '' },
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(personalCode, context);
  const api = vm.runInContext('ModuloPersonal', context);

  return { api, elements, store };
}

describe('Personal — puestos de trabajo personalizados', () => {
  let api;
  let elements;
  let store;

  beforeEach(() => {
    const ctx = buildContext();
    api = ctx.api.__testPuestos;
    elements = ctx.elements;
    store = ctx.store;
    store.clear();
  });

  test('expone los ganchos de prueba del catálogo de puestos', () => {
    expect(typeof api.leer).toBe('function');
    expect(typeof api.registrar).toBe('function');
    expect(typeof api.resolver).toBe('function');
    expect(typeof api.sincronizar).toBe('function');
    expect(typeof api.hidratar).toBe('function');
  });

  test('registra un puesto nuevo en localStorage', () => {
    const devuelto = api.registrar('  Ferrallista  ');

    expect(devuelto).toBe('Ferrallista');
    expect(api.leer()).toEqual(['Ferrallista']);
    expect(JSON.parse(store.get(CUSTOM_KEY))).toEqual(['Ferrallista']);
  });

  test('normaliza espacios internos y descarta vacíos', () => {
    expect(api.registrar('  Jefe   de   Obra ')).toBe('Jefe de Obra');
    expect(api.registrar('')).toBe('');
    expect(api.registrar('   ')).toBe('');
    expect(api.leer()).toEqual(['Jefe de Obra']);
  });

  test('no duplica el mismo puesto personalizado', () => {
    api.registrar('Vidriero');
    api.registrar('Vidriero');
    api.registrar('  Vidriero ');

    expect(api.leer()).toEqual(['Vidriero']);
    const coincidencias = elements[FORM_SELECT_ID].options.filter((o) => o.value === 'Vidriero');
    expect(coincidencias).toHaveLength(1);
  });

  test('no persiste puestos que ya están en el catálogo base', () => {
    expect(api.registrar('Albañil')).toBe('Albañil');
    expect(api.leer()).toEqual([]);
    expect(store.has(CUSTOM_KEY)).toBe(false);
  });

  test('tolera un localStorage corrupto', () => {
    store.set(CUSTOM_KEY, '{no-es-json');

    expect(api.leer()).toEqual([]);
    expect(api.registrar('Yesero')).toBe('Yesero');
    expect(api.leer()).toEqual(['Yesero']);
  });

  test('deduplica entradas repetidas guardadas en versiones anteriores', () => {
    store.set(CUSTOM_KEY, JSON.stringify(['Yesero', 'Yesero', '', 42, 'Enladrillador']));

    expect(api.leer()).toEqual(['Yesero', 'Enladrillador']);
  });

  test('resolver devuelve el puesto elegido del catálogo', () => {
    elements[FORM_SELECT_ID].value = 'Maestro de Obra';

    expect(api.resolver()).toBe('Maestro de Obra');
    expect(api.leer()).toEqual([]);
  });

  test('resolver devuelve "" en modo personalizado si el texto está vacío', () => {
    elements[FORM_SELECT_ID].value = CUSTOM_VALUE;
    elements[CUSTOM_INPUT_ID].value = '   ';

    expect(api.resolver()).toBe('');
    expect(api.leer()).toEqual([]);
  });

  test('resolver registra el puesto escrito en modo personalizado', () => {
    elements[FORM_SELECT_ID].value = CUSTOM_VALUE;
    elements[CUSTOM_INPUT_ID].value = '  Colocador de cerámica ';

    expect(api.resolver()).toBe('Colocador de cerámica');
    expect(api.leer()).toEqual(['Colocador de cerámica']);
  });

  test('hidratar selecciona un puesto del catálogo y oculta el campo extra', () => {
    elements[CUSTOM_INPUT_ID].value = 'algo';
    elements[CUSTOM_INPUT_ID].hidden = false;

    api.hidratar('Albañil');

    expect(elements[FORM_SELECT_ID].value).toBe('Albañil');
    expect(elements[CUSTOM_INPUT_ID].hidden).toBe(true);
    expect(elements[CUSTOM_INPUT_ID].value).toBe('');
  });

  test('hidratar conserva un puesto fuera de catálogo en modo personalizado', () => {
    api.hidratar('Operador de grúa torre');

    expect(elements[FORM_SELECT_ID].value).toBe(CUSTOM_VALUE);
    expect(elements[CUSTOM_INPUT_ID].value).toBe('Operador de grúa torre');
    expect(elements[CUSTOM_INPUT_ID].hidden).toBe(false);
  });

  test('hidratar sin puesto deja el select vacío', () => {
    elements[FORM_SELECT_ID].value = 'Albañil';
    elements[CUSTOM_INPUT_ID].hidden = false;

    api.hidratar('');

    expect(elements[FORM_SELECT_ID].value).toBe('');
    expect(elements[CUSTOM_INPUT_ID].hidden).toBe(true);
  });

  test('sincronizar inyecta los puestos personalizados antes de "Otro…"', () => {
    store.set(CUSTOM_KEY, JSON.stringify(['Ferrallista', 'Vidriero']));

    api.sincronizar();

    const valores = elements[FORM_SELECT_ID].options.map((o) => o.value);
    expect(valores).toContain('Ferrallista');
    expect(valores).toContain('Vidriero');
    expect(valores.indexOf('Vidriero')).toBeLessThan(valores.indexOf(CUSTOM_VALUE));
  });

  test('sincronizar inyecta los puestos personalizados en el filtro de la tabla', () => {
    store.set(CUSTOM_KEY, JSON.stringify(['Ferrallista']));

    api.sincronizar();

    const valores = elements[FILTER_SELECT_ID].options.map((o) => o.value);
    expect(valores).toContain('Ferrallista');
    expect(valores).not.toContain(CUSTOM_VALUE);
  });

  test('sincronizar completa el filtro con puestos del catálogo ausentes en el HTML', () => {
    api.sincronizar();

    const valores = elements[FILTER_SELECT_ID].options.map((o) => o.value);
    expect(valores).toContain('Plomero');
    expect(valores.filter((v) => v === 'Albañil')).toHaveLength(1);
  });

  test('sincronizar no duplica opciones ya presentes', () => {
    store.set(CUSTOM_KEY, JSON.stringify(['Ferrallista']));

    api.sincronizar();
    api.sincronizar();

    const opciones = elements[FORM_SELECT_ID].options.filter((o) => o.value === 'Ferrallista');
    expect(opciones).toHaveLength(1);
  });
});

