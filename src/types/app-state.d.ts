/**
 * Tipos estrictos para AppState, LS_KEYS y la configuración de la app.
 * @module app-state-types
 */

import type { FirebaseConfigShape } from './firebase';

/** Claves de localStorage usadas por la aplicación. */
export interface LocalStoreKeys {
  FIREBASE_CONFIG: string;
  CONFIG: string;
  PERSONAL_CACHE: string;
  ATTENDANCE_CACHE: string;
  ALERTS_CACHE: string;
  LAST_SYNC: string;
  OFFLINE_QUEUE: string;
}

/** Configuración general de la obra / sistema. */
export interface AppConfig {
  Nombre_App: string;
  Nombre_Obra: string;
  Tolerancia_Minutos: number;
  Hora_Entrada: string;
  Hora_Salida_Receso: string;
  Hora_Regreso_Receso: string;
  Hora_Salida_Obra: string;
  Encargado: string;
  Logo_Base64: string;
  Webhook_URL: string;
  Version: string;
  GPS_Habilitado: boolean;
  GPS_Requerir_Ubicacion: boolean;
  GPS_Centro_Lat: number | null;
  GPS_Centro_Lon: number | null;
  GPS_Radio_Metros: number;
}

/** Estados de trabajador aceptados por firestore.rules. */
export type WorkerEstado = 'Activo' | 'Inactivo' | 'Eliminado' | 'Suspendido';

/** Trabajador. */
export interface Worker {
  ID_Trabajador: string;
  Nombre_Completo: string;
  DPI_CUI: string;
  Puesto: string;
  Jefe_Inmediato?: string;
  Telefono?: string;
  WhatsApp?: string;
  Direccion?: string;
  Fotografia_URL?: string;
  Codigo_QR_Data: string;
  Fecha_Registro: string;
  Estado: WorkerEstado;
}

/**
 * Marcación de asistencia.
 *
 * Los campos obligatorios son exactamente los que exige
 * firestore.rules → isValidAttendanceData(); si falta alguno, la escritura se
 * deniega con permission-denied.
 */
export interface Marcacion {
  ID_Marcacion: string;
  ID_Registro: string;
  ID_Trabajador: string;
  Nombre_Trabajador: string;
  Fecha: string;
  Tipo_Marcacion: string;
  Hora_Programada: string;
  Hora_Real: string;
  Estado_Marcacion: string;
  Metodo_Registro: string;
  Horas_Extra: number;
  Ubicacion_Obra: string;
  GPS_Latitud: number | null;
  GPS_Longitud: number | null;
  GPS_Accuracy: number | null;
  Geofence_Inside: boolean | null;
  Geofence_Distance: number | null;
  Timestamp: number;
}

/** Contrato del store reactivo AppState. */
export interface AppStateContract {
  get<T = unknown>(key: string): T | undefined;
  getAll(): Record<string, unknown>;
  set(key: string, value: unknown): void;
  on(key: string, cb: (value: unknown, prev: unknown) => void): void;
  off(key: string, cb: (value: unknown, prev: unknown) => void): void;
  today(): string;
}

/** Tipos de marcación de asistencia. */
export type TipoMarcacion = 'Entrada' | 'Salida_Receso' | 'Regreso_Receso' | 'Salida_Obra';

/** Contrato del módulo de personal. */
export interface ModuloPersonalContract {
  init(): void;
  cargar(): Promise<void>;
  cleanup(): void;
  abrirModalCarne: (id: string) => void;
}

/** Contrato del módulo de asistencia. */
export interface ModuloAsistenciaContract {
  init(): void;
  cargar(): Promise<void>;
  cleanup(): void;
}

/** Contrato del módulo de ajustes. */
export interface ModuloAjustesContract {
  init(): void;
  cargar(): Promise<void>;
  cleanup(): void;
}

/** Contrato del módulo de dashboard. */
export interface ModuloDashboardContract {
  init(): void;
  cargar(): Promise<void>;
  cleanup(): void;
}

/** Contrato del módulo de reportes. */
export interface ModuloReportesContract {
  init(): void;
  cargar(): Promise<void>;
  cleanup(): void;
}

/** Contrato del módulo de campo. */
export interface ModuloCampoContract {
  init(): void;
  cargar(): Promise<void>;
  cleanup(): void;
}

/** Contrato del sistema de alertas. */
export interface AlertsContract {
  toast(title: string, message?: string): HTMLElement;
  success(title: string, message?: string): HTMLElement;
  error(title: string, message?: string): HTMLElement;
  warning(title: string, message?: string): HTMLElement;
  info(title: string, message?: string): HTMLElement;
  marcacion(data: { nombre: string; tipo: string; horaReal: string }): HTMLElement;
  loading(message: string): { close: () => void };
  confirm(message: string, title?: string, options?: { okLabel?: string; cancelLabel?: string }): Promise<boolean>;
}

/** Contrato del generador de PDF. */
export interface PDFBuilderContract {
  reporteDiario(fecha: string, asistencias: Marcacion[], orientation?: 'portrait' | 'landscape'): unknown;
  reporteConsolidado(fechaInicio: string, fechaFin: string, asistencias: Marcacion[], orientation?: 'portrait' | 'landscape'): unknown;
  exportarCSV(fechaInicio: string, fechaFin: string, asistencias: Marcacion[]): string;
  generarHTMLPreview(fechaInicio: string, fechaFin: string, asistencias: Marcacion[]): string;
}

/** Contrato del generador de QR. */
export interface QRGeneratorContract {
  generate(container: HTMLElement | string, data: string, size?: number): void;
  generateDataURL(data: string, size?: number): Promise<string>;
}

/** Contrato del optimizador de requests. */
export interface RequestOptimizerContract {
  debounce(key: string, fn: (...args: unknown[]) => void, delay: number): (...args: unknown[]) => void;
  throttle(key: string, fn: (...args: unknown[]) => void, limit: number): (...args: unknown[]) => void;
  dedupe(key: string, fn: () => Promise<unknown>): () => Promise<unknown>;
}

/** Tipado de window.FirebaseConfigShape (inyectado por firebase-config.js). */
declare global {
  interface Window {
    FIREBASE_CONFIG: FirebaseConfigShape;
    AppState: AppStateContract;
    LS_KEYS: LocalStoreKeys;
    DEFAULT_CONFIG: AppConfig;
    TIPOS_MARCACION: Array<{ tipo: TipoMarcacion; label: string; hora: string; icono: string; clase: string; color: string }>;
    PUESTOS: string[];
    PUESTO_COLORES: Record<string, string>;
    colorPorPuesto: (puesto: string) => string;
    inicialesDeNombre: (nombre: string) => string;
    DEPARTAMENTOS_GT: string[];
    ModuloPersonal: ModuloPersonalContract;
    ModuloAsistencia: ModuloAsistenciaContract;
    ModuloAjustes: ModuloAjustesContract;
    ModuloDashboard: ModuloDashboardContract;
    ModuloReportes: ModuloReportesContract;
    ModuloCampo: ModuloCampoContract;
    Alerts: AlertsContract;
    PDFBuilder: PDFBuilderContract;
    QRGenerator: QRGeneratorContract;
    RequestOptimizer: RequestOptimizerContract;
    AutoHealing: {
      determineHealingStrategy: (errorAnalysis: { category: string }) => string[];
      executeHealingStrategy: (strategyName: string) => Promise<{ success: boolean; message: string }>;
      autoHeal: (errorAnalysis: { category: string }) => Promise<{ success: boolean; message: string }>;
      diagnoseAndHeal: () => Promise<{ success: boolean; message: string }>;
      setupAutoHealing: (threshold?: number) => void;
      getAvailableStrategies: () => Record<string, { description: string; priority: string }>;
    };
    HardwareDiagnostics: {
      checkCameraAvailability: () => Promise<{ available: boolean; error: string | null; suggestions: string[] }>;
      checkGPSAvailability: () => Promise<{ available: boolean; error: string | null; suggestions: string[] }>;
      checkNetworkAvailability: () => { online: boolean; connectionType: string | null; suggestions: string[] };
      checkMemoryStatus: () => { available: boolean; percentage: string | null; suggestions: string[] };
      checkStorageStatus: () => Promise<{ localStorage: { percentage: string }; indexedDB: { percentage: string }; suggestions: string[] }>;
      runFullDiagnostics: () => Promise<{ timestamp: number; camera: unknown; gps: unknown; network: unknown; memory: unknown; storage: unknown; overallHealth: string }>;
    };
    DataValidator: {
      validate: (type: string, data: unknown) => { valid: boolean; errors: string[] };
      validateAttendance: (data: unknown) => { valid: boolean; errors: string[] };
      validateWorker: (data: unknown) => { valid: boolean; errors: string[] };
      validateConfig: (data: unknown) => { valid: boolean; errors: string[] };
      formatErrors: (validationResult: { valid: boolean; errors: string[] }) => string;
    };
    MobileQRScanner: {
      start: (options?: { elementId?: string; onSuccess?: () => void; cameraOptions?: { facingMode?: string; deviceId?: string } }) => Promise<{ success: boolean; camera: string }>;
      stop: () => Promise<void>;
      switchCamera: () => Promise<{ success: boolean; camera: string; previousCamera: string }>;
      supportsTorch: () => boolean;
      toggleTorch: () => Promise<{ success: boolean; enabled: boolean }>;
      setPerformanceMode: (mode: 'low' | 'balanced' | 'high') => Promise<{ success: boolean; previousMode: string; currentMode: string }>;
      listCameras: () => Promise<Array<{ deviceId: string; label: string }>>;
      selectCamera: (deviceId: string) => Promise<{ success: boolean; camera: string }>;
      getStatus: () => { active: boolean; selectedCamera: string | null; torchEnabled: boolean; performanceMode: string; supportsTorch: boolean };
      getOptimizationSuggestions: () => string[];
    };
    MapViewer: {
      initMap: (containerId: string) => void;
      addMarker: (location: { lat: number; lon: number; type: string; name?: string }) => void;
      addGeofence: (center: { lat: number; lon: number }, radius: number) => void;
      showAttendanceMap: (asistencias: Marcacion[], center: { lat: number; lon: number }, radius: number) => void;
      closeMap: () => void;
    };
    ErrorHandler: {
      handle: (error: Error, context?: string) => { type: string; message: string; recovery?: { type: string; message: string } };
      wrapAsync: (fn: () => Promise<unknown>, context?: string) => (...args: unknown[]) => Promise<unknown>;
      wrapSync: (fn: (...args: unknown[]) => unknown, context?: string) => (...args: unknown[]) => unknown;
      ERROR_TYPES: { NETWORK: string; FIREBASE: string; VALIDATION: string; PERMISSION: string; OFFLINE: string; TIMEOUT: string; UNKNOWN: string };
    };
    AILogger: {
      log: (level: string, context: string, message: string, error?: Error) => void;
      analyzeError: (error: Error) => { category: string; severity: string; suggestion: string };
      analyzePatterns: () => { recurrentPatterns: Record<string, { count: number; severity: string }>; recentErrors: Error[] };
      checkRecurrentErrors: () => Array<{ type: string; category: string; count: number; severity: string; message: string; suggestion: string }>;
      generateSuggestion: (errorAnalysis: { category: string; severity: string }) => { type: string; suggestion: string; suggestedCodeFix?: string };
      analyzePerformance: () => { memoryUsage: number; cpuUsage: number; suggestions: string[] };
      generateHealthReport: () => { overallHealth: string; issues: string[]; recommendations: string[] };
      getErrorHistory: () => Error[];
      getLogs: () => Array<{ level: string; context: string; message: string; timestamp: number }>;
      clearHistory: () => void;
    };
    AIPredictor: {
      predictErrors: (errorHistory: Error[]) => { likelihood: number; predictedErrors: string[]; timeFrame: string; confidence: number; recommendations: string[] };
      analyzeUsagePatterns: (usageData: unknown) => { patterns: string[]; anomalies: string[] };
      detectAnomalies: (metrics: unknown) => { anomalies: string[]; severity: string };
      generateSmartRecommendations: (context: unknown) => string[];
      analyzeRealTimePerformance: () => { cpu: number; memory: number; network: number; status: string };
      autoConfigureParameters: (performanceData: unknown) => { parameters: Record<string, unknown>; reason: string };
      analyzeTrends: (data: unknown) => { trends: string[]; forecast: string };
      generatePredictiveAlerts: (prediction: unknown) => Array<{ type: string; message: string; severity: string }>;
      runPredictiveAnalysis: () => { health: string; riskLevel: string; recommendations: string[] };
      getPredictionHistory: () => unknown[];
      setThresholds: (thresholds: Record<string, number>) => void;
      getThresholds: () => Record<string, number>;
    };
    DashboardEnhancer: {
      init: () => void;
      addTrendIndicator: (kpiCard: HTMLElement, trend: number) => void;
      createSparkline: (container: HTMLElement, data: number[], color: string) => void;
      enhanceCalendar: () => void;
    };
    Constants: {
      TIME: {
        TIMEOUT_MS: number;
        GPS_TIMEOUT_MS: number;
        GPS_MAX_AGE_MS: number;
        SPLASH_MIN_DURATION_MS: number;
        PAGE_TRANSITION_MS: number;
        TOAST_DURATION_MS: number;
        TOAST_ERROR_DURATION_MS: number;
        DEBOUNCE_SEARCH_MS: number;
        DEBOUNCE_AUTOCOMPLETE_MS: number;
        CAMERA_CAPTURE_DELAY_MS: number;
        ICON_RENDER_DELAY_MS: number;
        AUTO_SYNC_DELAY_MS: number;
      };
      LIMIT: {
        MAX_TOASTS: number;
        MAX_AUTOCOMPLETE_RESULTS: number;
        MAX_SIMULTANEOUS_DOWNLOADS: number;
        API_RETRY_COUNT: number;
        MAX_LOCAL_STORAGE_MB: number;
        MAX_IMAGE_SIZE_BYTES: number;
        MAX_IMAGE_DIMENSION: number;
        IMAGE_QUALITY: number;
      };
      GPS: {
        DEFAULT_RADIUS_METERS: number;
        MIN_RADIUS_METERS: number;
        MAX_RADIUS_METERS: number;
        ACCURACY_THRESHOLD_M: number;
        LATITUDE_MIN: number;
        LATITUDE_MAX: number;
        LONGITUDE_MIN: number;
        LONGITUDE_MAX: number;
      };
      QR: {
        DEFAULT_SIZE: number;
        CARNE_SIZE: number;
        CORRECTION_LEVEL: string;
        FPS: number;
        QRBOX_SIZE: number;
        QRBOX_RATIO: number;
      };
      CAMERA: {
        FACING_MODE: string;
        MAX_RESOLUTION: { width: number; height: number };
        MIN_RESOLUTION: { width: number; height: number };
      };
      FORM: {
        DPI_LENGTH: number;
        DPI_MIN_LENGTH: number;
        NOMBRE_MIN_LENGTH: number;
        NOMBRE_MAX_LENGTH: number;
        TELEFONO_LENGTH: number;
        TOLERANCIA_MIN: number;
        TOLERANCIA_MAX: number;
      };
      UI: {
        SIDEBAR_BREAKPOINT: number;
        MOBILE_BREAKPOINT: number;
        TABLET_BREAKPOINT: number;
        DESKTOP_BREAKPOINT: number;
        TOUCH_TARGET_MIN: number;
        FONT_SIZE_BASE: number;
        SPACING_UNIT: number;
      };
      SW: {
        CACHE_VERSION: string;
        CACHE_STATIC: string;
        CACHE_DYNAMIC: string;
        STALE_WHILE_REVALIDATE_AGE: number;
      };
      STATUS: {
        SUCCESS: string;
        ERROR: string;
        WARNING: string;
        INFO: string;
        LOADING: string;
        OFFLINE: string;
        CONNECTED: string;
        DISCONNECTED: string;
      };
      ATTENDANCE: {
        STATUS: {
          ON_TIME: string;
          TOLERANCE: string;
          LATE: string;
          ABSENT: string;
        };
        TYPES: {
          ENTRY: string;
          BREAK_START: string;
          BREAK_END: string;
          EXIT: string;
        };
      };
      COLORS: {
        PRIMARY: string;
        SECONDARY: string;
        ACCENT_GREEN: string;
        ACCENT_AMBER: string;
        ACCENT_RED: string;
        TEXT_MUTED: string;
        TEXT_DARK: string;
        WHITE: string;
        GRAY_LIGHT: string;
        GRAY_BORDER: string;
      };
    };
  }
}

export {};
