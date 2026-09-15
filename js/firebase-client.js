/**
 * CONTROL PERSONAL CAMPO — firebase-client.js
 * Cliente Firebase para Firestore y Authentication
 * Implementación JavaScript para reemplazar TypeScript eliminado
 * @version 1.5.0
 */

(() => {
  'use strict';

  // ─── Estado ─────────────────────────────────────────────────────────
  let db = null;
  let auth = null;
  let app = null;
  let connectionState = 'idle';
  let healthCheckInterval = null;
  let connectionChangeListeners = [];
  let connectionPollInterval = null;
  let healthCheckData = {
    healthy: false,
    lastCheck: 0,
    consecutiveFailures: 0,
    latencyMs: 0
  };

  // ─── Inicialización ─────────────────────────────────────────────────────
  let _initialized = false;
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
        connectionState = 'error';
        return { success: false, message: 'Firebase SDK no disponible' };
      }
      
      if (!config.apiKey || !config.projectId) {
        console.warn('[FirebaseClient] Configuración incompleta, usando modo local');
        connectionState = 'disconnected';
        return { success: false, message: 'Configuración incompleta - modo local activado' };
      }

      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.apps[0];
      }

      db = firebase.firestore();
      auth = firebase.auth();
      _initialized = true;

      connectionState = 'connected';
      startHealthCheck();
      
      return { success: true, message: 'Firebase inicializado correctamente' };
    } catch (error) {
      console.error('[FirebaseClient] Error de inicialización:', error);
      connectionState = 'error';
      return { success: false, message: error.message, fallback: 'modo local' };
    }
  }

  function isConfigured(config = window.FIREBASE_CONFIG) {
    return Boolean(config && config.apiKey && config.projectId && config.authDomain && config.appId);
  }

  async function configure(config) {
    if (!isConfigured(config)) {
      return { success: false, error: 'Configuración de Firebase incompleta.' };
    }

    // Firebase no permite modificar la configuración de una app ya creada. Se
    // elimina la instancia compat anterior antes de recrearla con la elegida.
    stop();
    if (app && typeof app.delete === 'function') {
      await app.delete();
    }
    db = null;
    auth = null;
    app = null;
    window.FIREBASE_CONFIG = { ...config };
    try {
      localStorage.setItem('cpc_firebase_config', JSON.stringify(window.FIREBASE_CONFIG));
    } catch (error) {
      console.warn('[FirebaseClient] No se pudo guardar la configuración:', error);
    }
    return initialize();
  }

  // ─── Health Check ───────────────────────────────────────────────────────
  function startHealthCheck() {
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    
    healthCheckInterval = setInterval(async () => {
      try {
        // Use a lightweight read instead of querying a potentially empty collection
        const start = Date.now();
        await db.collection('configuracion').doc('general').get();
        const latency = Date.now() - start;
        
        healthCheckData = {
          healthy: true,
          lastCheck: Date.now(),
          consecutiveFailures: 0,
          latencyMs: latency
        };
        
        connectionState = latency < 1000 ? 'connected' : 'degraded';
        // Propagar al store reactivo
        if (typeof AppState !== 'undefined') {
          AppState.set('connected', true);
        }
      } catch (error) {
        healthCheckData.consecutiveFailures++;
        healthCheckData.lastCheck = Date.now();
        
        if (healthCheckData.consecutiveFailures >= 3) {
          connectionState = 'disconnected';
          healthCheckData.healthy = false;
          // Propagar al store reactivo
          if (typeof AppState !== 'undefined') {
            AppState.set('connected', false);
          }
        }
      }
    }, 30000); // Check cada 30 segundos
  }

  function getHealth() {
    return healthCheckData;
  }

  async function checkHealth() {
    try {
      const start = Date.now();
      await db.collection('configuracion').doc('general').get();
      const latency = Date.now() - start;
      
      healthCheckData = {
        healthy: true,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
        latencyMs: latency
      };
      
      connectionState = latency < 1000 ? 'connected' : 'degraded';
      return true;
    } catch (error) {
      healthCheckData.consecutiveFailures++;
      healthCheckData.lastCheck = Date.now();
      healthCheckData.healthy = false;
      connectionState = 'disconnected';
      return false;
    }
  }

  // ─── Operaciones CRUD ───────────────────────────────────────────────────
  async function list(collection, orderField = null, limit = null, filters = []) {
    if (!db) throw new Error('Firebase no inicializado');
    
    let query = db.collection(collection);
    
    // Aplicar filtros where antes de orderBy
    for (const [field, op, value] of filters) {
      query = query.where(field, op, value);
    }
    
    if (orderField) {
      query = query.orderBy(orderField);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function save(collection, id, data, merge = true) {
    if (!db) throw new Error('Firebase no inicializado');
    
    const docRef = db.collection(collection).doc(id);
    await docRef.set(data, { merge });
    return { id, ...data };
  }

  async function remove(collection, id) {
    if (!db) throw new Error('Firebase no inicializado');
    
    await db.collection(collection).doc(id).delete();
  }

  // ─── Realtime Subscriptions ───────────────────────────────────────────────
  function subscribe(collection, callback) {
    if (!db) return () => {};
    
    const unsubscribe = db.collection(collection)
      .onSnapshot((snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(records);
      }, (error) => {
        console.error(`[FirebaseClient] Error en suscripción ${collection}:`, error);
      });
    
    return unsubscribe;
  }

  // ─── Connection State ────────────────────────────────────────────────────
  function isReady() {
    return db !== null && connectionState !== 'error';
  }

  function getConnectionState() {
    return connectionState;
  }

  function onConnectionChange(callback) {
    connectionChangeListeners.push(callback);
    
    // Start polling only once
    if (!connectionPollInterval) {
      connectionPollInterval = setInterval(() => {
        const newState = getConnectionState();
        connectionChangeListeners.forEach(cb => {
          try { cb(newState); } catch (e) { console.error('[FirebaseClient] Listener error:', e); }
        });
      }, 5000);
    }
    
    // Return cleanup function
    return () => {
      connectionChangeListeners = connectionChangeListeners.filter(cb => cb !== callback);
      if (connectionChangeListeners.length === 0 && connectionPollInterval) {
        clearInterval(connectionPollInterval);
        connectionPollInterval = null;
      }
    };
  }

  // ─── Authentication ───────────────────────────────────────────────────────
  async function signInAnonymously() {
    if (!auth) throw new Error('Auth no inicializado');
    
    try {
      const userCredential = await auth.signInAnonymously();
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('[FirebaseClient] Error signInAnonymously:', error);
      return { success: false, error: error.message };
    }
  }

  function getCurrentUser() {
    if (!auth) return null;
    return auth.currentUser;
  }

  function onAuthStateChanged(callback) {
    if (!auth) return () => {};
    return auth.onAuthStateChanged(callback);
  }

  // ─── Config ───────────────────────────────────────────────────────────────
  function getConfig() {
    return window.FIREBASE_CONFIG || {};
  }

  function stop() {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
    if (connectionPollInterval) {
      clearInterval(connectionPollInterval);
      connectionPollInterval = null;
    }
    connectionChangeListeners = [];
    db = null;
    auth = null;
    _initialized = false;
    connectionState = 'idle';
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
    getCurrentUser,
    onAuthStateChanged,
    getConfig,
    stop
  };

  // Auto-inicializar en cuanto el módulo se carga.
  // Los SDKs de Firebase y firebase-config.js ya fueron ejecutados antes
  // (están declarados antes en el HTML), por lo que la config y el SDK
  // compat están disponibles en este punto.
  initialize();
})();
