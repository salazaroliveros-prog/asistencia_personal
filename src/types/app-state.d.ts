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

// ─────────────────────────────────────────────────────────────────────────────
// ESCÁNER QR Y CÁMARA
// ─────────────────────────────────────────────────────────────────────────────

/** Dimensiones del recorte del escáner (guía visual y región de decodificación). */
export interface QrDimensions {
  width: number;
  height: number;
}

/** `qrbox` calculado a partir de las dimensiones reales del `<video>`. */
export type QrboxFn = (videoWidth: number, videoHeight: number) => QrDimensions;

/**
 * Valores que acepta `config.qrbox` de html5-qrcode:
 * `toQrdimensions()` devuelve el número tal cual, invoca la función con las
 * dimensiones del `<video>` o usa el objeto recibido.
 */
export type Qrbox = QrDimensions | number | QrboxFn;

/** Parámetros con los que se construye el recorte del escáner. */
export interface QrboxOptions {
  /** Fracción del lado menor del frame que ocupa el recorte (0 < ratio ≤ 1). */
  ratio?: number;
  /** Lado de respaldo mientras el vídeo no tiene dimensiones. */
  width?: number;
  height?: number;
}

/** Opciones de cámara aceptadas por los candidatos de `getUserMedia`. */
export interface CameraOptions {
  deviceId?: string;
  facingMode?: string;
  width?: number;
  height?: number;
}

/** Cámara enumerada por `enumerateDevices()`. */
export interface CameraDevice {
  id: string;
  label: string;
}

/** Instancia mínima de `Html5Qrcode` que consume el controlador de QR. */
export interface ScannerLike {
  start(camera: unknown, config: unknown, onSuccess: unknown, onError?: unknown): Promise<void>;
  stop(): Promise<void>;
  clear?(): void;
}

/**
 * Contrato de `window.CPC.CameraSession` (js/utils/camera-session.js).
 *
 * Centraliza el acceso físico a la cámara y expone un controlador de escáner
 * que ya construye el `qrbox` proporcional al frame real.
 */
export interface CameraSessionContract {
  getSupport(): { supported: boolean; secure: boolean };
  stopTracks(stream: { getTracks(): Array<{ stop(): void }> } | null): void;
  stopStream(videoElement: { srcObject: unknown } | null): void;
  buildCandidates(options?: CameraOptions): MediaStreamConstraints[];
  startStream(options?: CameraOptions): Promise<{ stream: MediaStream; constraints: MediaStreamConstraints }>;
  listDevices(): Promise<CameraDevice[]>;
  describeError(error: { name?: string } | null): string;
  createQrController(options: {
    Scanner: new (elementId: string) => ScannerLike;
    elementId: string;
    onSuccess: (decodedText: string, decodedResult?: unknown) => void;
    onError?: (message: string) => void;
    config?: Record<string, unknown> & { qrbox?: Qrbox };
  }): {
    start(options?: { deviceId?: string; facingMode?: string }): Promise<{ scanner: ScannerLike; camera: unknown } | null>;
    stop(): Promise<void>;
    supportsTorch(): boolean;
    toggleTorch(): Promise<boolean>;
    isActive(): boolean;
    getSelectedCamera(): string | null;
  };
  /**
   * Construye el `qrbox` como **función**: html5-qrcode la invoca con las
   * dimensiones del `<video>` y usa el resultado como recorte del frame.
   */
  buildQrboxFn(base?: QrboxOptions | number): QrboxFn;
  /** @deprecated Usar `buildQrboxFn`; devuelve un recorte estático. */
  safeQrBox(element: HTMLElement | null, base?: QrboxOptions | number): QrDimensions;
}

/** Contrato de `window.CPC.MobileCameraOptimizer` (utils/mobile-camera-optimizer.js). */
export interface MobileCameraOptimizerContract {
  /** true si el UA indica un dispositivo móvil real. */
  isMobile(): boolean;
  getDeviceType(): 'ios' | 'android' | 'other';
  getOrientation(): 'portrait' | 'landscape';
  requestCameraPermissions(): Promise<{ granted: boolean; error?: Error }>;
  /** Aplica `playsInline`/`muted`/`objectFit` y arranca la reproducción. */
  optimizeVideoElement(videoElement: HTMLVideoElement): void;
  getDeviceInfo(): { isMobile: boolean; deviceType: string; pixelRatio: number; memory?: number; [key: string]: unknown };
}

/**
 * Contrato de `window.MobileQRScanner` (utils/mobile-qr-scanner.js).
 *
 * Envuelve html5-qrcode con presets de rendimiento por dispositivo. El recorte
 * del decodificador se expresa como fracción del frame (`qrboxRatio`) y se
 * materializa con `buildQrboxFn`.
 */
export interface MobileQRScannerContract {
  start(params: {
    elementId: string;
    onSuccess: (decodedText: string, decodedResult?: unknown) => void;
    onError?: (message: string) => void;
    cameraOptions?: { facingMode?: string; deviceId?: string };
  }): Promise<{ success: boolean; scanner: ScannerLike; camera: string; config: Record<string, unknown> }>;
  stop(): Promise<void>;
  switchCamera(): Promise<{ success: boolean; camera: string; previousCamera: string | null }>;
  supportsTorch(): boolean;
  /** Devuelve el estado del flash tras el cambio (no un objeto). */
  toggleTorch(): Promise<boolean>;
  listCameras(): Promise<Array<{ id: string; label: string; groupId: string }>>;
  /** Igual que `CameraSession.buildQrboxFn`. */
  buildQrboxFn(base?: QrboxOptions | number): QrboxFn;
  getPerformanceConfig(mode?: string): { fps: number; qrboxRatio: number; aspectRatio: number; disableFlip: boolean; maxScansPerSecond: number };
  getMobileOptimizedConfig(options?: Record<string, unknown>): { fps: number; qrboxRatio: number; aspectRatio: number; disableFlip: boolean; maxScansPerSecond: number };
}

/**
 * Resultado unificado de persistencia (js/utils/persist.js + api.js).
 */
export type PersistMode = 'cloud' | 'local' | 'queued' | 'blocked';

export interface PersistResult {
  success: boolean;
  mode: PersistMode;
  data?: unknown;
  message: string;
  error?: string;
  code?: string;
  needsAuth?: boolean;
  needsRole?: boolean;
  offline?: boolean;
}

export interface WriteCapability {
  ok: boolean;
  reason?: string;
  code?: string;
  user?: unknown;
  needsAuth?: boolean;
}

/** Contrato de `window.CPC.Persist` (js/utils/persist.js). */
export interface PersistContract {
  getWriteCapability(): WriteCapability;
  classifyFirestoreError(error: { code?: string; message?: string } | null): {
    code: string;
    message: string;
    needsAuth?: boolean;
    needsRole?: boolean;
  };
  normalizeWhatsApp(value: string): string;
  localSuccess(data: unknown, message: string, queued?: boolean): PersistResult;
  cloudSuccess(data: unknown, message: string): PersistResult;
  blocked(message: string, extra?: Record<string, unknown>): PersistResult;
}

/** Contrato de `window.CPC.FeedbackAudio` (js/utils/feedback-audio.js). */
export interface FeedbackAudioContract {
  create(): { beepSuccess(): void; beepError(): void } | null;
}

/**
 * Namespace de utilidades compartidas montado en `window.CPC` por
 * `js/utils/{string,date,photo}-helpers.js`, `validation-rules.js`,
 * `camera-session.js`, `persist.js` y `feedback-audio.js`.
 */
export interface CpcNamespace {
  CameraSession: CameraSessionContract;
  Persist: PersistContract;
  FeedbackAudio: FeedbackAudioContract;
  StringHelpers: {
    /** Escapa `& < > "` para insertar de forma segura en HTML. */
    escHtml(value: unknown): string;
    formatTelefono(tel: string): string;
    generateLocalId(prefix?: string, length?: number): string;
    dateToStr(date: Date): string;
  };
  DateHelpers: {
    toISODate(date: Date): string;
  };
  PhotoHelpers: {
    /** Comprime manteniendo la relación de aspecto y devuelve un Data URL JPEG. */
    compressImage(img: HTMLImageElement, maxW?: number, maxH?: number, quality?: number): string;
  };
  ValidationRules: {
    DPI_LENGTH: number;
    DPI_MIN_LENGTH: number;
    DPI_MAX_LENGTH: number;
    TOLERANCIA_MIN: number;
    TOLERANCIA_MAX: number;
    LATITUDE_MIN: number;
    LATITUDE_MAX: number;
    LONGITUDE_MIN: number;
    LONGITUDE_MAX: number;
    GPS_RADIUS_MIN: number;
    GPS_RADIUS_MAX: number;
    NOMBRE_MIN_LENGTH: number;
    NOMBRE_MAX_LENGTH: number;
    TELEFONO_LENGTH: number;
    IMAGEN_MAX_SIZE: number;
    IMAGEN_MAX_DIMENSION: number;
  };
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
    /**
     * utils/mobile-qr-scanner.js — escáner QR optimizado para móviles.
     *
     * `start()` recibe el `elementId` del contenedor y los callbacks; el
     * `<video>` lo monta html5-qrcode dentro de ese contenedor.
     */
    MobileQRScanner: MobileQRScannerContract;
    /** utils/mobile-camera-optimizer.js — ajustes por dispositivo y orientación. */
    MobileCameraOptimizer: MobileCameraOptimizerContract;
    /** Namespace de utilidades compartidas montadas en window.CPC.*. */
    CPC: CpcNamespace;
    /** js/utils/update-manager.js — banner solo si hay deploy real. */
    UpdateManager: {
      init(): void;
      checkForUpdates(): void;
      showUpdateBanner(): void;
      hideUpdateBanner(): void;
      applyUpdate(): void;
      dismissUpdate(): void;
    };
    /** Versión de la aplicación (js/config.js). */
    APP_VERSION: string;
    /** Nombre de la aplicación (js/config.js). */
    APP_NAME: string;
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
    };
    DashboardEnhancer: {
      init: () => void;
    };
  }
}

export {};
