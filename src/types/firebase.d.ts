/**
 * Tipos estrictos para la capa de conexión a Firebase.
 * @module firebase-types
 *
 * NOTA: Este archivo es el contrato TypeScript que el runtime ES5
 * en `js/firebase-client.js` cumple. No es runtime, solo validación estática.
 */

/** Estados posibles de conexión a Firestore. */
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'disconnected'
  | 'error';

/** Modos de backend soportados por la aplicación. */
export type BackendMode = 'local' | 'firestore';

/** Configuración pública de Firebase web. */
export interface FirebaseConfigShape {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/** Usuario autenticado (Firebase Auth). */
export interface AuthUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

/** Resultado de una operación de conexión/autenticación. */
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

/** Resultado de inicialización del cliente Firebase. */
export interface InitResult {
  success: boolean;
  message: string;
  fallback?: 'local';
}

/** Resultado del configure(). */
export interface ConfigureResult {
  success: boolean;
  error?: string;
}

/** Snapshot de salud de la conexión. */
export interface HealthData {
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  latencyMs: number;
}

/** Contrato mínimo de Firestore (compat con mock en tests). */
export interface DBLike {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ docs?: unknown[] }>;
      set(data: object, opts?: { merge: boolean }): Promise<void>;
      delete(): Promise<void>;
    };
    onSnapshot(
      next: (snap: { docs: Array<{ id: string; data(): unknown }> }) => void,
      error?: (err: unknown) => void,
    ): () => void;
    where(field: string, op: string, value: unknown): unknown;
    orderBy?(field: string): unknown;
    limit?(n: number): unknown;
    get(): Promise<{ docs: Array<{ id: string; data(): unknown }> }>;
  };
}

/** Contrato mínimo de Auth (compat con mock en tests). */
export interface AuthLike {
  currentUser: AuthUser | null;
  signInAnonymously(): Promise<{ user: AuthUser }>;
  signInWithEmailAndPassword(email: string, password: string): Promise<{ user: AuthUser }>;
  signOut(): Promise<void>;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void;
  setPersistence?(level: unknown): Promise<void>;
}

/** Contrato del FirebaseClient público. */
export interface FirebaseClientContract {
  initialize(): InitResult;
  configure(config: FirebaseConfigShape): Promise<ConfigureResult>;
  isConfigured(config?: FirebaseConfigShape): boolean;
  isReady(): boolean;
  getConnectionState(): ConnectionState;
  onConnectionChange(cb: (state: ConnectionState) => void): () => void;
  reconnect(): Promise<boolean>;
  stop(): void;
  list<K = unknown>(collection: string, orderField?: string | null, limit?: number | null, filters?: Array<[string, string, unknown]>): Promise<K[]>;
  save<K = unknown>(collection: string, id: string, data: K, merge?: boolean): Promise<K & { id: string }>;
  remove(collection: string, id: string): Promise<void>;
  subscribe<K = unknown>(collection: string, cb: (records: K[]) => void): () => void;
  signInAnonymously(): Promise<AuthResult>;
  signInWithEmail(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  getCurrentUser(): AuthUser | null;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void;
  getConfig(): FirebaseConfigShape;
  getHealth(): HealthData;
  checkHealth(): Promise<boolean>;
}
