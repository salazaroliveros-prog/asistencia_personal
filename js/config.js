/**
 * CONTROL PERSONAL CAMPO — config.js
 * Constantes globales y estado de la aplicación.
 * @version 1.5.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE VERSIÓN
// ─────────────────────────────────────────────────────────────────────────────
const APP_VERSION  = '1.5.0';
const APP_NAME     = 'CONTROL PERSONAL CAMPO';
const TIMEZONE     = 'America/Guatemala'; // GMT-6

// ─────────────────────────────────────────────────────────────────────────────
// CLAVES localStorage
// ─────────────────────────────────────────────────────────────────────────────
const LS_KEYS = {
  FIREBASE_CONFIG: 'cpc_firebase_config',
  CONFIG:          'cpc_config',
  PERSONAL_CACHE:  'cpc_personal_cache',
  ATTENDANCE_CACHE: 'cpc_attendance_cache',
  ALERTS_CACHE:    'cpc_alerts_cache',
  LAST_SYNC:       'cpc_last_sync',
  OFFLINE_QUEUE:   'cpc_offline_queue',
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN POR DEFECTO DEL SISTEMA
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  Nombre_App:          APP_NAME,
  Nombre_Obra:         'Obra Principal',
  Tolerancia_Minutos:  15,
  Hora_Entrada:        '07:00',
  Hora_Salida_Receso:  '10:00',
  Hora_Regreso_Receso: '10:30',
  Hora_Salida_Obra:    '17:00',
  Encargado:           'Administrador',
  Logo_Base64:         '',
  Webhook_URL:         '',
  Version:             APP_VERSION,
  // GPS Configuration
  GPS_Habilitado:       true,
  GPS_Requerir_Ubicacion: false,
  GPS_Centro_Lat:       null,
  GPS_Centro_Lon:       null,
  GPS_Radio_Metros:     200,
};

// ─────────────────────────────────────────────────────────────────────────────
// HORARIOS DE MARCACIÓN (se sobreescribe con config)
// ─────────────────────────────────────────────────────────────────────────────
const TIPOS_MARCACION = [
  {
    tipo:    'Entrada',
    label:   'Entrada a Obra',
    hora:    '07:00',
    icono:   'log-in',
    clase:   'btn-entrada',
    color:   '#2A9D8F',
  },
  {
    tipo:    'Salida_Receso',
    label:   'Salida a Receso',
    hora:    '10:00',
    icono:   'coffee',
    clase:   'btn-receso',
    color:   '#FFB703',
  },
  {
    tipo:    'Regreso_Receso',
    label:   'Regreso de Receso',
    hora:    '10:30',
    icono:   'arrow-left-right',
    clase:   'btn-regreso',
    color:   '#00A8E8',
  },
  {
    tipo:    'Salida_Obra',
    label:   'Salida de Obra',
    hora:    '17:00',
    icono:   'log-out',
    clase:   'btn-salida',
    color:   '#E63946',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PUESTOS DISPONIBLES
// ─────────────────────────────────────────────────────────────────────────────
const PUESTOS = [
  'Albañil',
  'Maestro de Obra',
  'Armador',
  'Carpintero',
  'Electricista',
  'Operador',
  'Residente',
  'Bodeguero',
  'Plomero',
  'Soldador',
];

// Color asociado a cada puesto (usado para iniciales y badges)
const PUESTO_COLORES = {
  'Maestro de Obra': 'var(--color-primary)',          // azul oscuro
  'Residente':       'var(--color-accent-green)',     // verde
  'Albañil':         'var(--color-secondary)',        // celeste
  'Armador':         '#2980B9',                       // azul medio
  'Carpintero':      '#17A589',                       // verde azulado
  'Electricista':    '#6A0DAD',                       // violeta
  'Operador':        '#E07B39',                       // naranja
  'Bodeguero':       'var(--color-accent-amber)',     // ámbar
  'Plomero':         '#C0392B',                       // rojo oscuro
  'Soldador':        'var(--color-text-muted)',       // gris
};

/**
 * Devuelve el color CSS para un puesto dado, con fallback al color primary.
 * @param {string} puesto - Nombre del puesto del trabajador
 * @returns {string} Color CSS (puede ser valor hex o variable CSS)
 * @example
 * colorPorPuesto('Maestro de Obra') // returns 'var(--color-primary)'
 * colorPorPuesto('Electricista')    // returns '#6A0DAD'
 */
function colorPorPuesto(puesto) {
  return PUESTO_COLORES[puesto] || 'var(--color-primary)';
}

/**
 * Genera las iniciales de un nombre completo (máx. 2 palabras).
 * @param {string} nombre - Nombre completo del trabajador
 * @returns {string} Iniciales en mayúsculas (máximo 2 caracteres)
 * @example
 * inicialesDeNombre('Juan Pérez')       // returns 'JP'
 * inicialesDeNombre('María')           // returns 'M'
 * inicialesDeNombre('')                // returns '??'
 */
function inicialesDeNombre(nombre) {
  if (!nombre) return '??';
  return nombre.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTAMENTOS Y MUNICIPIOS DE GUATEMALA
// ─────────────────────────────────────────────────────────────────────────────
const DEPARTAMENTOS_GT = [
  'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula',
  'El Progreso', 'Escuintla', 'Guatemala', 'Huehuetenango',
  'Izabal', 'Jalapa', 'Jutiapa', 'Petén',
  'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez',
  'San Marcos', 'Santa Rosa', 'Sololá', 'Suchitepéquez',
  'Totonicapán', 'Zacapa'
];

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL DE LA APLICACIÓN (Store reactivo simple)
// ─────────────────────────────────────────────────────────────────────────────
const AppState = (() => {
  const _state = {
    // Página activa del router
    currentPage: 'dashboard',

    // Backend activo: local siempre disponible; Firestore cuando está configurado
    backendMode: 'local',

    // Estado de conexión
    connected: false,
    connecting: false,

    // Datos cacheados
    personal: [],       // Lista completa de trabajadores activos
    asistencias: [],    // Marcaciones del día activo
    alertas: [],        // Alertas pendientes

    // Configuración del sistema
    config: { ...DEFAULT_CONFIG },

    // Fecha activa en el dashboard
    dashboardDate: _today(),

    // Trabajador seleccionado para QR scan
    scannedWorker: null,
    manualWorker: null,

    // Calendario: mes/año visible
    calMonth: new Date().getMonth(),
    calYear:  new Date().getFullYear(),

    // Spinners de carga
    loading: {
      personal:   false,
      asistencia: false,
      dashboard:  false,
      reportes:   false,
    },
  };

  // Suscriptores a cambios de estado
  const _listeners = {};

  function _today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  return {
    /**
     * Leer una propiedad del estado
     * @param {string} key - Nombre de la propiedad a leer
     * @returns {*} Valor de la propiedad
     * @example
     * const currentPage = AppState.get('currentPage');
     * const personal = AppState.get('personal');
     */
    get(key) {
      return _state[key];
    },

    /**
     * Leer todo el estado (copia superficial)
     * @returns {Object} Copia del estado completo
     * @example
     * const fullState = AppState.getAll();
     */
    getAll() {
      return { ..._state };
    },

    /**
     * Actualizar una propiedad y notificar listeners
     * @param {string} key - Nombre de la propiedad a actualizar
     * @param {*} value - Nuevo valor
     * @example
     * AppState.set('currentPage', 'personal');
     * AppState.set('connected', true);
     */
    set(key, value) {
      const prev = _state[key];
      
      // Validación básica de tipos para propiedades críticas
      if (key === 'backendMode' && !['local', 'firestore'].includes(value)) {
        console.warn('[AppState] backendMode inválido:', value);
        return;
      }
      
      if (key === 'connected' && typeof value !== 'boolean') {
        console.warn('[AppState] connected debe ser boolean, recibido:', typeof value);
        return;
      }
      
      if (key === 'personal' && value !== null && !Array.isArray(value)) {
        console.warn('[AppState] personal debe ser array, recibido:', typeof value);
        return;
      }
      
      if (key === 'config' && value !== null && typeof value !== 'object') {
        console.warn('[AppState] config debe ser object, recibido:', typeof value);
        return;
      }
      
      _state[key] = value;
      if (_listeners[key]) {
        _listeners[key].forEach(fn => {
          try { fn(value, prev); } catch (e) { console.error('AppState listener error:', e); }
        });
      }
    },

    /**
     * Suscribirse a cambios de una propiedad
     * @param {string} key - Nombre de la propiedad a observar
     * @param {Function} callback - Función a ejecutar cuando cambie la propiedad
     * @returns {void}
     * @example
     * AppState.on('personal', (newPersonal, oldPersonal) => {
     *   console.log('Personal actualizado:', newPersonal);
     * });
     */
    on(key, callback) {
      if (!_listeners[key]) _listeners[key] = [];
      _listeners[key].push(callback);
    },

    /**
     * Quitar suscriptor
     * @param {string} key - Nombre de la propiedad
     * @param {Function} callback - Función a remover de los listeners
     * @returns {void}
     * @example
     * const handler = (data) => console.log(data);
     * AppState.on('asistencias', handler);
     * AppState.off('asistencias', handler);
     */
    off(key, callback) {
      if (_listeners[key]) {
        _listeners[key] = _listeners[key].filter(fn => fn !== callback);
      }
    },

    /**
     * Obtener la fecha de hoy en formato YYYY-MM-DD
     * @returns {string} Fecha actual en formato ISO
     * @example
     * const hoy = AppState.today(); // "2026-09-15"
     */
    today() {
      return _today();
    },
  };
})();

// Puente explícito para los módulos ES/TypeScript. Las declaraciones `const`
// de scripts clásicos no forman propiedades de window en todos los runtimes.
window.LS_KEYS = LS_KEYS;
window.DEFAULT_CONFIG = DEFAULT_CONFIG;
window.AppState = AppState;

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAR ESTADO DESDE localStorage
// ─────────────────────────────────────────────────────────────────────────────
(function initStateFromStorage() {
  try {
    // ── Limpieza de datos demo ─────────────────────────────────────────────
    // Limpiar datos de prueba/demo si quedaron residuales en localStorage
    const URL_DEMO = 'demo.control-personal-campo.local';
    const tieneDatosDemo = localStorage.getItem('cpc_demo_loaded') === '1';

    if (tieneDatosDemo) {
      ['cpc_demo_loaded', 'cpc_personal_cache', 'cpc_attendance_cache', 'cpc_last_sync', 'cpc_config'].forEach(k => {
        localStorage.removeItem(k);
      });
      localStorage.removeItem(LS_KEYS.FIREBASE_CONFIG);
    }

    // ── Restaurar estado normal ────────────────────────────────────────────
    const savedConfig = localStorage.getItem(LS_KEYS.CONFIG);
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      AppState.set('config', { ...DEFAULT_CONFIG, ...parsed });
    }

    const cachedPersonal = localStorage.getItem(LS_KEYS.PERSONAL_CACHE);
    if (cachedPersonal) {
      const parsed = JSON.parse(cachedPersonal);
      if (Array.isArray(parsed)) {
        AppState.set('personal', parsed);
      }
    }

    const cachedAttendance = localStorage.getItem(LS_KEYS.ATTENDANCE_CACHE);
    if (cachedAttendance) {
      const parsed = JSON.parse(cachedAttendance);
      if (Array.isArray(parsed)) AppState.set('asistencias', parsed);
    }

    const cachedAlerts = localStorage.getItem(LS_KEYS.ALERTS_CACHE);
    if (cachedAlerts) {
      const parsed = JSON.parse(cachedAlerts);
      if (Array.isArray(parsed)) AppState.set('alertas', parsed);
    }
  } catch (e) {
    console.warn('[Config] Error al restaurar estado desde localStorage:', e.message);
  }
})();