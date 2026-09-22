/**
 * Tipos de los globals de la capa legacy (js/**\/*.js) que **no** forman parte
 * del escáner QR ni de la configuración de la app — esos viven en
 * `app-state.d.ts`.
 *
 * La capa legacy son scripts clásicos con IIFE: cada módulo se publica en
 * `window` y aquí sólo se describe su contrato público para que los archivos
 * `.ts` (y el autocompletado del editor) tengan tipos reales.
 *
 * El código JS no se typecheckea (ver la nota de `tsconfig.json`), por lo que
 * este archivo es la única fuente de verdad de esos contratos: al cambiar la
 * API pública de un módulo en `js/`, hay que actualizar su tipo aquí.
 *
 * @module legacy-globals-types
 */

/** Resultado estándar de las validaciones del proyecto. */
export interface ValidationOutcome {
  valid: boolean;
  errors: Array<{ campo: string; error: string } | string>;
}

/** Entrada del historial de logs. */
export interface LogEntry {
  level: string;
  category: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

/** Contrato de `window.Logger` (utils/logger.js). */
export interface LoggerContract {
  init(): void;
  debug(category: string, message: string, data?: unknown): void;
  info(category: string, message: string, data?: unknown): void;
  warn(category: string, message: string, data?: unknown): void;
  error(category: string, message: string, data?: unknown): void;
  fatal(category: string, message: string, data?: unknown): void;
  getLogs(level?: string, category?: string, limit?: number): LogEntry[];
  clearLogs(): void;
  exportLogs(): string;
  getStats(): { total: number; byLevel: Record<string, number>; byCategory: Record<string, number> };
  setLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'): void;
}

/** Posición geográfica resuelta por `GPS.getCurrentPosition()`. */
export interface GeolocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

/** Contrato de `window.GPS` (utils/gps.js). */
export interface GpsContract {
  getCurrentPosition(): Promise<GeolocationFix>;
  /** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
  checkGeofence(
    position: { latitude: number; longitude: number } | null,
    center: { latitude: number; longitude: number } | null,
    radius?: number,
  ): { inside: boolean; distance: number | null };
  formatCoordinates(lat: number, lon: number): string;
  getMapsLink(lat: number, lon: number): string;
  isAvailable(): boolean;
  requestPermission(): Promise<PermissionState>;
}

/** Contrato de `window.CacheManager` (utils/cache-manager.js). */
export interface CacheManagerContract {
  set(key: string, value: unknown, ttl?: number): void;
  get<T = unknown>(key: string): T | null;
  has(key: string): boolean;
  invalidate(key: string): void;
  clear(): void;
  getStats(): { size: number; keys: string[]; memoryUsage: number };
  cleanExpired(): number;
  getOrSet<T = unknown>(key: string, computeFn: () => T | Promise<T>, ttl?: number): Promise<T>;
  checkQuota(): { ok: boolean; usage: number };
}

/** Contrato de `window.DataExport` (utils/data-export.js). */
export interface DataExportContract {
  exportToCSV(data: unknown[], filename: string): void;
  exportToJSON(data: unknown, filename: string): void;
  importFromJSON(file: File, callback: (data: unknown) => void): void;
  exportAttendanceReport(asistencias: unknown[], personal: unknown[], fecha: string): void;
  exportWorkerReport(personal: unknown[]): void;
  createBackup(): void;
  restoreBackup(file: File, callback: (data: unknown) => void): void;
}

/** Contrato de `window.Validators` (utils/validators.js). */
export interface ValidatorsContract {
  /** Constantes de validación compartidas (`js/utils/validation-rules.js`). */
  RULES: Record<string, number>;
  validateDPI(value: string): { valid: boolean; error?: string };
  validateNombre(value: string): { valid: boolean; error?: string };
  validateTelefono(value: string): { valid: boolean; error?: string };
  validateTolerancia(value: number): { valid: boolean; error?: string };
  validateLatitud(value: number): { valid: boolean; error?: string };
  validateLongitud(value: number): { valid: boolean; error?: string };
  validateGPSRadius(value: number): { valid: boolean; error?: string };
  validateHora(value: string): { valid: boolean; error?: string };
  validateOrdenHorarios(config: unknown): ValidationOutcome;
  validateImagen(file: File): { valid: boolean; error?: string };
  validateGASUrl(url: string): { valid: boolean; error?: string };
  validateTrabajadorCompleto(trabajador: unknown): ValidationOutcome;
  validateMarcacion(marcacion: unknown): ValidationOutcome;
  validateConfigSistema(config: unknown): ValidationOutcome;
  /** @deprecated Alias de `validateTrabajadorCompleto`. */
  validateTrabajador(trabajador: unknown): ValidationOutcome;
  validateConfigGPS(config: Partial<AppConfigLike>): ValidationOutcome;
  calcularEstado(horaProgramada: string, horaReal: string, tolerancia: number): string;
  calcularHorasExtra(horaSalida: string, horaReal: string): number;
}

/** Forma mínima de la configuración del sistema que consumen los validadores. */
export interface AppConfigLike {
  GPS_Centro_Lat: number | null;
  GPS_Centro_Lon: number | null;
  GPS_Radio_Metros: number;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULOS DE SOPORTE
// ─────────────────────────────────────────────────────────────────────────────

/** Contrato de `window.AIEngine` (utils/ai-engine.js). */
export interface AiEngineContract {
  initialize(config?: Record<string, unknown>): void;
  handleGlobalError(error: Error, source?: string): Promise<{ handled: boolean; strategy?: string }>;
  performHealthCheck(): Promise<Record<string, unknown>>;
  generateSystemReport(): Promise<{ overallHealth: string; [key: string]: unknown }>;
  setAutoHealing(enabled: boolean): void;
  setLearning(enabled: boolean): void;
  getStatus(): { initialized: boolean; autoHealingEnabled: boolean; learningEnabled: boolean; healthMonitoring: boolean };
  cleanup(): void;
}

/** Resultado de una operación en lote. */
export interface BulkResult {
  success: boolean;
  results: string[];
  errors: Array<Record<string, unknown>>;
  message: string;
}

