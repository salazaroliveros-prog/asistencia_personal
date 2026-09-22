/**
 * CONTROL PERSONAL CAMPO — firebase-config.js
 * Configuración pública de Firebase con validación y gestión de prioridades.
 * @version 1.5.0
 *
 * PRIORIDAD de fuentes (de menor a mayor):
 *   1. bundledFirebaseConfig  — valores compilados en este archivo (fallback)
 *   2. window.__FIREBASE_ENV__ — inyectado por Vite (dev + build) desde .env.local
 *   3. cpc_firebase_config en localStorage — configuración guardada desde Ajustes
 *   4. window.FIREBASE_CONFIG ya existente — configuración externa (máxima prioridad)
 *
 * NOTA: Este archivo se carga como SCRIPT CLÁSICO (no type="module"), por lo que
 * NO se puede usar `import.meta.env` directamente. Vite inyecta
 * `window.__FIREBASE_ENV__` desde las variables VITE_FIREBASE_* definidas en
 * .env.local durante dev y build (plugin injectFirebaseEnv en vite.config.mjs).
 *
 * SEGURIDAD: Las credenciales de Firebase web son públicas por diseño. La seguridad
 * real se maneja con Firebase Authentication y Firestore Rules.
 */
const FirebaseConfigManager = (() => {
  // ─── 1. Configuración embebida (fallback garantizado) ─────────────────────
  const bundledFirebaseConfig = window.bundledFirebaseConfig || {
    apiKey:            'AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg',
    authDomain:        'sistema-de-control-aee89.firebaseapp.com',
    projectId:         'sistema-de-control-aee89',
    storageBucket:     'sistema-de-control-aee89.firebasestorage.app',
    messagingSenderId: '265655332442',
    appId:             '1:265655332442:web:c4e8617741e3b916987263',
  };

  // ─── 2. Variables de entorno inyectadas por Vite ──────────────────────────
  // window.__FIREBASE_ENV__ es inyectado por el plugin injectFirebaseEnv
  // de vite.config.mjs tanto en modo dev como en build.
  const envConfig = (() => {
    const raw = window.__FIREBASE_ENV__;
    if (!raw || typeof raw !== 'object') return null;
    // Solo usar si al menos hay un campo con valor real
    const hasValues = Object.values(raw).some((v) => typeof v === 'string' && v.length > 5);
    return hasValues ? raw : null;
  })();

  // ─── 3. Configuración guardada desde Ajustes (localStorage) ───────────────
  const storedConfig = (() => {
    try {
      const raw = localStorage.getItem('cpc_firebase_config');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const hasValues = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
      return hasValues ? parsed : null;
    } catch (_) {
      return null;
    }
  })();

  // ─── 4. Configuración externa ya existente en window.FIREBASE_CONFIG ──────
  const existingConfig = (window.FIREBASE_CONFIG && Object.keys(window.FIREBASE_CONFIG).length > 0)
    ? window.FIREBASE_CONFIG
    : null;

  // ─── Diagnóstico en consola (debug: no ensucia consola por defecto) ────────
  // El fallback bundled es comportamiento esperado cuando no hay env inyectado.
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    if (window.__FIREBASE_ENV__) {
      const envKeys = Object.values(window.__FIREBASE_ENV__).filter((v) => v && v.length > 0).length;
      console.debug(`[FirebaseConfig] window.__FIREBASE_ENV__ disponible con ${envKeys}/7 campos`);
    } else {
      console.debug('[FirebaseConfig] window.__FIREBASE_ENV__ no inyectado — usando config bundled');
    }
    if (storedConfig) {
      console.debug('[FirebaseConfig] Config guardada en localStorage encontrada');
    }
  }

  /**
   * Valida la configuración de Firebase.
   * @param {Object} config - Configuración a validar
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateFirebaseConfig(config) {
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Configuración inválida.' };
    }
    if (!config.apiKey || config.apiKey.length <= 10) {
      return { valid: false, error: 'API Key inválida o vacía.' };
    }
    if (!config.authDomain || !config.authDomain.includes('.firebaseapp.com')) {
      return { valid: false, error: 'Dominio de autenticación inválido. Debe terminar en .firebaseapp.com' };
    }
    if (!config.projectId || config.projectId.length <= 2) {
      return { valid: false, error: 'ID del proyecto inválido.' };
    }
    if (!config.appId || config.appId.length <= 5) {
      return { valid: false, error: 'App ID inválido.' };
    }
    return { valid: true };
  }

  /**
   * Obtiene la configuración de Firebase combinando todas las fuentes
   * en orden de prioridad (la última gana en caso de conflicto).
   * @returns {Object} Configuración de Firebase lista para usar
   */
  function getFirebaseConfig() {
    const merged = {
      ...bundledFirebaseConfig,
      ...(envConfig   || {}),
      ...(storedConfig || {}),
      ...(existingConfig || {}),
    };
    return merged;
  }

  /**
   * Retorna la fuente activa de configuración para diagnóstico.
   * @returns {string} Nombre de la fuente dominante
   */
  function getConfigSource() {
    if (existingConfig) return 'external (window.FIREBASE_CONFIG)';
    if (storedConfig)   return 'localStorage (Ajustes)';
    if (envConfig)      return 'env (.env.local via Vite)';
    return 'bundled (hardcoded)';
  }

  // Exponer la configuración globalmente (otros scripts la leen de aquí)
  window.FIREBASE_CONFIG = getFirebaseConfig();
  window.validateFirebaseConfig = validateFirebaseConfig;

  const finalConfig = window.FIREBASE_CONFIG;
  const valid = validateFirebaseConfig(finalConfig);
  console.log(
    `[FirebaseConfig] Config activa — fuente: "${getConfigSource()}" | ` +
    `proyecto: "${finalConfig.projectId || 'sin proyecto'}" | ` +
    `válida: ${valid.valid}${valid.error ? ' — ' + valid.error : ''}`,
  );

  return {
    getFirebaseConfig,
    validateFirebaseConfig,
    getConfigSource,
  };
})();

// Exponer el módulo globalmente
window.FirebaseConfigManager = FirebaseConfigManager;
