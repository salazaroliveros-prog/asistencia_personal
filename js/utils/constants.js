/**
 * CONTROL PERSONAL CAMPO — utils/constants.js
 * Constantes compartidas para evitar magic numbers en el código.
 * @version 1.0.0
 */

// ─── Tiempos y Duraciones ────────────────────────────────────────────────────
const TIME_CONSTANTS = {
  TIMEOUT_MS: 30000,           // 30 segundos para requests API
  GPS_TIMEOUT_MS: 10000,      // 10 segundos para GPS
  GPS_MAX_AGE_MS: 30000,       // 30 segundos de cache GPS
  SPLASH_MIN_DURATION_MS: 1800, // 1.8 segundos splash screen
  PAGE_TRANSITION_MS: 300,    // 300ms animación de página
  TOAST_DURATION_MS: 4500,    // 4.5 segundos toast
  TOAST_ERROR_DURATION_MS: 6000, // 6 segundos toast error
  DEBOUNCE_SEARCH_MS: 300,    // 300ms debounce búsqueda
  DEBOUNCE_AUTOCOMPLETE_MS: 250, // 250ms debounce autocomplete
  CAMERA_CAPTURE_DELAY_MS: 150, // 150ms delay captura foto
  ICON_RENDER_DELAY_MS: 80,   // 80ms delay render íconos
  AUTO_SYNC_DELAY_MS: 800,    // 800ms delay reintentos
};

// ─── Cantidad y Límites ──────────────────────────────────────────────────────
const LIMIT_CONSTANTS = {
  MAX_TOASTS: 5,              // Máximo de toasts simultáneos
  MAX_AUTOCOMPLETE_RESULTS: 8, // Máximo de resultados autocomplete
  MAX_SIMULTANEOUS_DOWNLOADS: 3, // Máximo de descargas simultáneas
  API_RETRY_COUNT: 2,         // Reintentos en error de red
  MAX_LOCAL_STORAGE_MB: 5,     // Máximo localStorage en MB
  MAX_IMAGE_SIZE_BYTES: 600 * 1024, // 600KB máximo imagen
  MAX_IMAGE_DIMENSION: 300,   // 300px máximo dimensión imagen
  IMAGE_QUALITY: 0.85,        // Calidad compresión imagen
};

// ─── Configuración GPS ────────────────────────────────────────────────────────
const GPS_CONSTANTS = {
  DEFAULT_RADIUS_METERS: 200,    // Radio default geocerca
  MIN_RADIUS_METERS: 10,         // Radio mínimo geocerca
  MAX_RADIUS_METERS: 10000,      // Radio máximo geocerca
  ACCURACY_THRESHOLD_M: 50,      // Umbral precisión GPS
  LATITUDE_MIN: -90,             // Latitud mínima
  LATITUDE_MAX: 90,              // Latitud máxima
  LONGITUDE_MIN: -180,           // Longitud mínima
  LONGITUDE_MAX: 180,            // Longitud máxima
};

// ─── Configuración QR ─────────────────────────────────────────────────────────
const QR_CONSTANTS = {
  DEFAULT_SIZE: 160,            // Tamaño default QR
  CARNE_SIZE: 130,             // Tamaño QR en carné
  CORRECTION_LEVEL: 'M',       // Nivel corrección QR
  FPS: 10,                     // FPS escáner QR
  QRBOX_SIZE: 220,             // Tamaño caja escáner
  QRBOX_RATIO: 1.0,            // Ratio caja escáner
};

// ─── Configuración Cámara ─────────────────────────────────────────────────────
const CAMERA_CONSTANTS = {
  FACING_MODE: 'environment',   // Modo cámara (trasera)
  MAX_RESOLUTION: {             // Resolución máxima
    width: 1280,
    height: 720
  },
  MIN_RESOLUTION: {             // Resolución mínima
    width: 640,
    height: 480
  },
};

// ─── Configuración Formularios ─────────────────────────────────────────────────
const FORM_CONSTANTS = {
  DPI_LENGTH: 13,               // Longitud DPI
  DPI_MIN_LENGTH: 4,            // Longitud mínima DPI
  NOMBRE_MIN_LENGTH: 2,         // Longitud mínima nombre
  NOMBRE_MAX_LENGTH: 100,       // Longitud máxima nombre
  TELEFONO_LENGTH: 8,           // Longitud teléfono Guatemala
  TOLERANCIA_MIN: 0,            // Tolerancia mínima minutos
  TOLERANCIA_MAX: 60,           // Tolerancia máxima minutos
};

// ─── Configuración UI ────────────────────────────────────────────────────────
const UI_CONSTANTS = {
  SIDEBAR_BREAKPOINT: 768,      // Breakpoint sidebar móvil
  MOBILE_BREAKPOINT: 768,       // Breakpoint móvil
  TABLET_BREAKPOINT: 1024,      // Breakpoint tablet
  DESKTOP_BREAKPOINT: 1024,    // Breakpoint desktop
  TOUCH_TARGET_MIN: 44,         // Mínimo tamaño touch target (px)
  FONT_SIZE_BASE: 16,           // Tamaño fuente base móvil (px)
  SPACING_UNIT: 8,              // Unidad espaciado base (px)
};

// ─── Configuración Service Worker ────────────────────────────────────────────
const SW_CONSTANTS = {
  CACHE_VERSION: 'v1.0.0',
  CACHE_STATIC: 'cpc-static-v1.0.0',
  CACHE_DYNAMIC: 'cpc-dynamic-v1.0.0',
  STALE_WHILE_REVALIDATE_AGE: 3600000, // 1 hora
};

// ─── Códigos de Estado ──────────────────────────────────────────────────────
const STATUS_CODES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading',
  OFFLINE: 'offline',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
};

// ─── Estados de Marcación ────────────────────────────────────────────────────
const ATTENDANCE_STATUS = {
  ON_TIME: 'A Tiempo',
  TOLERANCE: 'Tolerancia',
  LATE: 'Atraso',
  ABSENT: 'Ausencia',
};

// ─── Tipos de Marcación ──────────────────────────────────────────────────────
const ATTENDANCE_TYPES = {
  ENTRY: 'Entrada',
  BREAK_START: 'Salida_Receso',
  BREAK_END: 'Regreso_Receso',
  EXIT: 'Salida_Obra',
};

// ─── Colores CSS ─────────────────────────────────────────────────────────────
const COLOR_CONSTANTS = {
  PRIMARY: '#003459',
  SECONDARY: '#00A8E8',
  ACCENT_GREEN: '#2A9D8F',
  ACCENT_AMBER: '#FFB703',
  ACCENT_RED: '#E63946',
  TEXT_MUTED: '#64748B',
  TEXT_DARK: '#1E3A5F',
  WHITE: '#FFFFFF',
  GRAY_LIGHT: '#F4F9F9',
  GRAY_BORDER: '#D0E0E8',
};

// ─── Exportar todas las constantes ──────────────────────────────────────────────
const CONSTANTS = {
  TIME: TIME_CONSTANTS,
  LIMIT: LIMIT_CONSTANTS,
  GPS: GPS_CONSTANTS,
  QR: QR_CONSTANTS,
  CAMERA: CAMERA_CONSTANTS,
  FORM: FORM_CONSTANTS,
  UI: UI_CONSTANTS,
  SW: SW_CONSTANTS,
  STATUS: STATUS_CODES,
  ATTENDANCE: {
    STATUS: ATTENDANCE_STATUS,
    TYPES: ATTENDANCE_TYPES,
  },
  COLORS: COLOR_CONSTANTS,
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}