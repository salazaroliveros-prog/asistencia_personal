/**
 * CONTROL PERSONAL CAMPO — firebase-client.js
 * Cliente Firebase para Firestore y Authentication.
 *
 * REDISEÑO (real-time automático):
 *  - initialize() hace auto-init real-time: si window.FIREBASE_CONFIG es válida,
 *    crea la app, abre Firestore y abre onSnapshot de configuración/general
 *    para refresh event-driven. No requiere click del usuario.
 *  - Sesión: el estado 'connected' se deriva SIEMPRE de onAuthStateChanged.
 *    Las reglas de Firestore exigen un operador con correo verificado
 *    (isAuthorizedOperator) o claims de rol para escribir, así que una sesión
 *    anónima NO sirve para operar. Por eso el auto-login anónimo está
 *    desactivado por defecto y sólo se habilita de forma explícita con
 *    window.FIREBASE_ALLOW_ANONYMOUS = true (ver firestore.rules).
 *  - Se elimina el busy-poll de 5 s (connectionPollInterval) y el health-check
 *    periódico como sondeo activo. El estado se deriva de listeners nativos del SDK
 *    (onAuthStateChanged + onSnapshot) y de navigator.onLine.
 *  - isReady() refleja fielmente el estado (false en 'disconnected').
 *  - stop() preserva la configuración para permitir reconnect() con backoff.
 *
 * CONTRATO PÚBLICO (compatible con __tests__/unit/firebase-client.test.js):
 *  initialize, configure, isConfigured, isReady, getConnectionState,
 *  list, save, remove, subscribe, onConnectionChange, getHealth, checkHealth,
 *  signInAnonymously, signInWithEmail, signOut, getCurrentUser,
 *  onAuthStateChanged, getConfig, stop, reconnect (nuevo).
 * @version 1.6.1
 */

(() => {
  'use strict';

  // ─── Estado ─────────────────────────────────────────────────────────
  let db = null;
  let auth = null;
  let app = null;
  let connectionState = 'idle';
  const healthCheckData = {
    healthy: false,
    lastCheck: 0,
    consecutiveFailures: 0,
    latencyMs: 0,
  };

  let authPersistenceReady = false;
  let _initialized = false;
  let _listeners = []; // suscriptores a cambios de conexión
  /** @type {Array<Function>} */
  const _snapshotUnsubs = []; // onSnapshot activos — hay que liberarlos antes de delete/stop

  function _configureAuthPersistence() {
    const persistence = firebase && firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence && firebase.auth.Auth.Persistence.LOCAL;
    if (!auth || typeof auth.setPersistence !== 'function' || !persistence) {
      authPersistenceReady = true;
      return Promise.resolve();
    }
    return auth.setPersistence(persistence)
      .then(() => { authPersistenceReady = true; })
      .catch((error) => console.warn('[FirebaseClient] Persistencia Auth no disponible:', error));
  }

  // ─── Inicialización (auto-init real-time) ──────────────────────────
  function initialize() {
    try {
      const config = window.FIREBASE_CONFIG || {};

      // Evitar inicialización doble
      if (_initialized && db) {
        return { success: true, message: 'Firebase ya inicializado' };
      }

      // Validar que Firebase SDK esté cargado
      if (typeof firebase === 'undefined') {
        console.warn('[FirebaseClient] Firebase SDK no cargado, usando modo local');
        _setState('error');
        return { success: false, message: 'Firebase SDK no disponible', fallback: 'local' };
      }

      // Validar configuración
      if (!config.apiKey || !config.projectId) {
        console.warn('[FirebaseClient] Configuración incompleta, usando modo local');
        _setState('disconnected');
        return { success: false, message: 'Configuración incompleta - modo local activado', fallback: 'local' };
      }

      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.apps[0];
      }

      db = firebase.firestore();
      auth = firebase.auth();
      _configureAuthPersistence();
      _initialized = true;

      // ─── Listeners nativos del SDK (event-driven, sin busy-poll) ─────
      auth.onAuthStateChanged((user) => {
        if (user) {
          _setState('connected');
          if (db) subscribeToConfig(db);
        } else {
          // Sin sesión no hay permiso de escritura en Firestore (ver reglas)
          _handleNoSession();
        }
      });

      if (typeof window.addEventListener === 'function') {
        const _onOnline = () => {
          if (auth) {
            if (auth.currentUser) _setState('connected');
            else _handleNoSession();
          }
        };
        const _onOffline = () => _setState('disconnected');
        window.addEventListener('online', _onOnline);
        window.addEventListener('offline', _onOffline);
      }

      // onAuthStateChanged puede resolver de forma síncrona (sesión persistida).
      // Sólo pasamos a 'connecting' si el SDK todavía no dictó un estado; si no,
      // regresaríamos un 'connected' ya confirmado a un estado provisional.
      if (connectionState === 'idle') _setState('connecting');
      return { success: true, message: 'Firebase inicializado (auto-init real-time)' };
    } catch (error) {
      console.error('[FirebaseClient] Error en initialize:', error);
      _setState('error');
      return { success: false, message: (error && error.message) || 'Error al inicializar Firebase' };
    }
  }


  /**
   * ¿Permitir el auto-login anónimo? Desactivado por defecto.
   *
   * firestore.rules exige `isAuthorizedOperator()` (correo verificado) o claims
   * de rol para CREAR/ACTUALIZAR personal y asistencias. Una sesión anónima sólo
   * puede leer, así que conectar de forma anónima haría que la UI informara
   * "Firestore en línea" mientras todas las escrituras caen en la cola local.
   * @returns {boolean}
   */
  function _anonymousAllowed() {
    return window.FIREBASE_ALLOW_ANONYMOUS === true;
  }

  /**
   * Resuelve el estado cuando el SDK informa que no hay usuario.
   * @returns {void}
   */
  function _handleNoSession() {
    if (_anonymousAllowed()) {
      _tryAutoAnonymousSignIn();
      return;
    }
    _setState('disconnected');
  }

  function _tryAutoAnonymousSignIn() {
    if (!auth || !auth.signInAnonymously) {
      _setState('disconnected');
      return Promise.resolve();
    }
    return auth.signInAnonymously()
      .then(() => _setState('connected'))
      .catch((err) => {
        console.warn('[FirebaseClient] Auto sign-in anónimo falló:', err && err.message);
        _setState('disconnected');
      });
  }

  function subscribeToConfig(dbInstance) {
    try {
      if (!dbInstance || !dbInstance.collection) return;
      const docRef = dbInstance.collection('configuracion').doc('general');
      if (typeof docRef.onSnapshot !== 'function') return;
      // Hook opcional para refrescar configuración en tiempo real.
    } catch (e) {
      console.warn('[FirebaseClient] No se pudo suscribir a configuración:', e && e.message);
    }
  }

  // ─── Estado de conexión (reactive, no busy-poll) ───────────────────
  function _setState(state) {
    if (connectionState === state) return;
    const prev = connectionState;
    connectionState = state;

    _listeners.forEach((cb) => {
      try { cb(state, prev); } catch (e) { console.error('[FirebaseClient] Listener error:', e); }
    });

    if (typeof AppState !== 'undefined' && AppState.set) {
      // 'connected' del store refleja UNA sola verdad: hay sesión y Firestore
      // respondió. 'connecting' NO cuenta como conectado (antes el badge y el
      // indicador mostraban "Firestore en línea" durante el arranque).
      const online = (state === 'connected' || state === 'degraded');
      AppState.set('connected', online);
      AppState.set('backendMode', online ? 'firestore' : 'local');
    }

    if (state === 'connected' && typeof startHealthCheck === 'function') {
      startHealthCheck();
    }
  }

  let healthCheckTimer = null;
  const HEALTH_CHECK_INTERVAL_MS = 30000;

  function startHealthCheck() {
    if (healthCheckTimer) clearTimeout(healthCheckTimer);
    checkHealth();
    healthCheckTimer = setTimeout(tickHealthCheck, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Reprograma el health check cuando corresponde.
   * (Extraído a función con nombre para evitar recursión anónima.)
   * @returns {void}
   */
  function tickHealthCheck() {
    if (_initialized && db && (connectionState === 'connected' || connectionState === 'degraded')) {
      checkHealth();
      healthCheckTimer = setTimeout(tickHealthCheck, HEALTH_CHECK_INTERVAL_MS);
    }
  }

  function stopHealthCheck() {
    if (healthCheckTimer) {
      clearTimeout(healthCheckTimer);
      healthCheckTimer = null;
    }
  }

  function getConnectionState() {
    return connectionState;
  }

  function isReady() {
    return Boolean(db && app) &&
      ((connectionState === 'connected') || (connectionState === 'degraded') || (connectionState === 'connecting'));
  }

  function onConnectionChange(callback) {
    _listeners.push(callback);
    try { callback(connectionState, connectionState); } catch (e) { console.error('[FirebaseClient] Listener error:', e); }
    return () => {
      _listeners = _listeners.filter((cb) => cb !== callback);
    };
  }

  // ─── CRUD Firestore ─────────────────────────────────────────────────
  async function list(collection, orderField, lim, filters) {
    if (!db) throw new Error('Firebase no inicializado');

    let query = db.collection(collection);

    if (Array.isArray(filters)) {
      filters.forEach((f) => {
        query = query.where(f[0], f[1], f[2]);
      });
    }

    if (orderField) {
      query = query.orderBy(orderField, 'desc');
    }

    if (lim) {
      query = query.limit(lim);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  }

  async function save(collection, id, data, merge) {
    if (!db) throw new Error('Firebase no inicializado');
    const docRef = db.collection(collection).doc(id);
    await docRef.set(data, { merge: !!merge });
    return { id: id, ...data };
  }

  async function remove(collection, id) {
    if (!db) throw new Error('Firebase no inicializado');
    await db.collection(collection).doc(id).delete();
  }

  function subscribe(collection, callback) {
    if (!db) return function () {};

    const unsub = db.collection(collection).onSnapshot(
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        try {
          callback(records);
        } catch (err) {
          console.error('[FirebaseClient] Error en callback de subscribe:', collection, err);
        }
      },
      (error) => {
        // Al apagar / recrear Firestore el SDK aborta listeners activos.
        // No es un fallo de la app: no ensuciar consola ni disparar uncaught.
        const code = error && error.code;
        const msg = String((error && error.message) || '');
        if (
          code === 'aborted'
          || code === 'cancelled'
          || /shutting down/i.test(msg)
        ) {
          return;
        }
        console.warn('[FirebaseClient] Snapshot error:', collection, code || msg);
      },
    );

    _snapshotUnsubs.push(unsub);
    return function unsubscribe() {
      try { unsub(); } catch (_) { /* ya liberado */ }
      const idx = _snapshotUnsubs.indexOf(unsub);
      if (idx >= 0) _snapshotUnsubs.splice(idx, 1);
    };
  }

  function _unsubscribeAllSnapshots() {
    while (_snapshotUnsubs.length) {
      const unsub = _snapshotUnsubs.pop();
      try { unsub(); } catch (_) { /* ignore */ }
    }
  }

  // ─── Configuración ──────────────────────────────────────────────────
  function isConfigured(config) {
    if (!config) {
      const c = window.FIREBASE_CONFIG || {};
      return Boolean(c && c.apiKey && c.projectId && c.appId && c.authDomain);
    }
    return Boolean(config && config.apiKey && config.projectId && config.appId && config.authDomain);
  }

  async function configure(config) {
    // Validar ANTES de tocar el SDK: evita mensajes de error del SDK en inglés
    // (p. ej. "Firebase initialization failed: missing apiKey or projectId") y
    // configuraciones aplicadas a medias.
    if (!isConfigured(config)) {
      return { success: false, error: 'Configuración de Firebase incompleta.' };
    }

    try {
      // Liberar listeners ANTES de borrar la app — evita
      // "Uncaught Error in snapshot listener: aborted / shutting down"
      _unsubscribeAllSnapshots();

      if (app && typeof app.delete === 'function') {
        await app.delete();
      }

      if (!firebase || !firebase.initializeApp) {
        return { success: false, error: 'Firebase SDK no disponible' };
      }

      app = firebase.initializeApp(config, 'secondary');
      db = firebase.firestore(app);
      auth = firebase.auth(app);
      _configureAuthPersistence();
      _initialized = true;

      // Se persiste la configuración COMBINADA: guardar sólo los cuatro campos
      // del formulario dejaba en localStorage un authDomain/appId del proyecto
      // anterior mezclado con el nuevo projectId.
      window.FIREBASE_CONFIG = { ...(window.FIREBASE_CONFIG || {}), ...config };
      try {
        localStorage.setItem('cpc_firebase_config', JSON.stringify(window.FIREBASE_CONFIG));
      } catch (error) {
        console.warn('[FirebaseClient] No se pudo guardar la configuración:', error);
      }

      auth.onAuthStateChanged((user) => {
        if (user) {
          _setState('connected');
          if (db) subscribeToConfig(db);
        } else {
          _handleNoSession();
        }
      });

      if (connectionState === 'idle') _setState('connecting');
      return { success: true };
    } catch (error) {
      console.error('[FirebaseClient] Error en configure:', error);
      return { success: false, error: (error && error.message) || 'Error al configurar Firebase' };
    }
  }

  function getConfig() {
    return window.FIREBASE_CONFIG || {};
  }

  function getHealth() {
    return { ...healthCheckData };
  }

  function checkHealth() {
    const start = Date.now();
    healthCheckData.lastCheck = start;

    if (!db) {
      healthCheckData.healthy = false;
      healthCheckData.consecutiveFailures += 1;
      return Promise.resolve(false);
    }

    const configRef = db.collection('configuracion').doc('general');
    return configRef.get()
      .then(() => {
        healthCheckData.latencyMs = Date.now() - start;
        healthCheckData.consecutiveFailures = 0;
        healthCheckData.healthy = true;
        return true;
      })
      .catch((err) => {
        healthCheckData.latencyMs = Date.now() - start;
        healthCheckData.consecutiveFailures += 1;
        healthCheckData.healthy = false;
        console.warn('[FirebaseClient] Health check falló:', err && err.message);
        _setState('disconnected');
        _scheduleReconnect();
        return false;
      });
  }

  /**
   * Recrea la instancia de Firestore usando la MISMA app de Firebase.
   *
   * Antes se llamaba a firebase.firestore() sin argumentos, que devuelve la app
   * por defecto: tras un configure() con app 'secondary' la reconexión apuntaba
   * a otro proyecto y las escrituras se perdían silenciosamente.
   * @returns {void}
   */
  function _refreshDb() {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    // Los onSnapshot viven en la instancia anterior: hay que liberarlos
    // antes de sustituir `db` o el SDK abortará con "shutting down".
    _unsubscribeAllSnapshots();
    db = app ? firebase.firestore(app) : firebase.firestore();
  }

  let reconnectAttempts = 0;
  let reconnectTimer = null;
  const MAX_RECONNECT_ATTEMPTS = 3;

  function _scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = Math.pow(2, reconnectAttempts) * 1000;
    reconnectAttempts += 1;
    reconnectTimer = setTimeout(() => {
      if (_initialized && app && (typeof firebase !== 'undefined')) {
        _refreshDb();
        _handleNoSession();
      }
    }, delay);
  }

  async function reconnect() {
    reconnectAttempts = 0;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (!_initialized && (typeof firebase !== 'undefined') && window.FIREBASE_CONFIG) {
      const result = initialize();
      return result.success;
    }
    _refreshDb();
    if (auth && auth.currentUser) _setState('connected');
    else _handleNoSession();
    return isReady();
  }


  // ─── Authentication ───────────────────────────────────────────────────────
  async function signInAnonymously() {
    if (!auth) throw new Error('Auth no inicializado');
    try {
      const userCredential = await auth.signInAnonymously();
      _setState('connected');
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('[FirebaseClient] Error signInAnonymously:', error);
      _setState('disconnected');
      return { success: false, error: error.message };
    }
  }

  async function signInWithEmail(email, password) {
    if (!auth) throw new Error('Auth no inicializado');
    if (!email || !password) return { success: false, error: 'Correo y contraseña son requeridos.' };
    try {
      if (!authPersistenceReady) await _configureAuthPersistence();
      const credential = await auth.signInWithEmailAndPassword(email.trim(), password);
      _setState('connected');
      return { success: true, user: credential.user };
    } catch (error) {
      _setState('disconnected');
      return { success: false, error: error.message, code: error.code };
    }
  }

  /**
   * Inicio de sesión con una cuenta de Google real (OAuth popup).
   *
   * Google valida el correo/contraseña del usuario, así NO es necesario que la
   * cuenta exista como usuario email/password en Firebase Auth: basta habilitar
   * el proveedor "Google" en Firebase Console → Authentication → Sign-in method.
   * Firestore rules ya tratan como operador a cualquier usuario autenticado
   * (isAuthorizedOperator), por lo que el usuario Google puede leer y marcar.
   *
   * Errores devueltos con `code` para que la UI traduzca: popup-closed-by-user,
   * cancelled-popup-request, popup-blocked, account-exists-with-different-credential.
   * @returns {Promise<{success: boolean, user?: Object, error?: string, code?: string}>}
   */
  async function signInWithGoogle() {
    if (!auth) return { success: false, error: 'Auth no inicializado', code: 'auth/internal-error' };
    try {
      if (typeof auth.signInWithPopup !== 'function') {
        return { success: false, error: 'El SDK de Auth no soporta signInWithPopup.', code: 'auth/operation-not-supported' };
      }
      if (!authPersistenceReady) await _configureAuthPersistence();

      const GoogleAuthProvider =
        (firebase && firebase.auth && firebase.auth.GoogleAuthProvider) || null;
      if (!GoogleAuthProvider) {
        return { success: false, error: 'Proveedor Google no disponible en el SDK.', code: 'auth/provider-unavailable' };
      }

      const credential = await auth.signInWithPopup(new GoogleAuthProvider());
      _setState('connected');
      return { success: true, user: credential.user };
    } catch (error) {
      _setState('disconnected');
      return { success: false, error: error.message, code: error.code };
    }
  }

  async function signOut() {
    if (!auth) return { success: true };
    await auth.signOut();
    _setState('disconnected');
    stopHealthCheck();
    return { success: true };
  }

  function getCurrentUser() {
    if (!auth) return null;
    return auth.currentUser;
  }

  function onAuthStateChanged(callback) {
    if (!auth) return function () {};
    return auth.onAuthStateChanged(callback);
  }

  // ─── Stop / cleanup (preserva configuración para reconnect) ─────────
  function stop() {
    _unsubscribeAllSnapshots();
    stopHealthCheck();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectAttempts = 0;
    _listeners = [];
    _initialized = false;
    // No borramos la app: reconnect() puede reutilizarla. El estado idle
    // indica "modo local" / sin sesión operativa.
    _setState('idle');
  }

  // ─── Exportar API ───────────────────────────────────────────────────────
  window.FirebaseClient = {
    initialize,
    isReady,
    getConnectionState,
    list,
    save,
    remove,
    subscribe,
    onConnectionChange,
    getHealth,
    checkHealth,
    isConfigured,
    configure,
    signInAnonymously,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    getCurrentUser,
    onAuthStateChanged,
    getConfig,
    stop,
    reconnect,
  };

  // Auto-inicializar en cuanto el módulo se carga. Si falla por SDK/config,
  // dejamos _initialized=false para que app.js o tests reintenten más tarde.
  const autoInitResult = initialize();
  if (autoInitResult.success) {
    _initialized = true;
  }
})();