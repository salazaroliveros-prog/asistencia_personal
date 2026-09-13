/**
 * CONTROL PERSONAL CAMPO — firebase-client.js
 * Cliente Firebase para Firestore y Authentication
 * Implementación JavaScript para reemplazar TypeScript eliminado
 * @version 1.0.0
 */

(() => {
  'use strict';

  // ─── Estado ─────────────────────────────────────────────────────────
  let db = null;
  let auth = null;
  let app = null;
  let connectionState = 'idle';
  let healthCheckInterval = null;
  let healthCheckData = {
    healthy: false,
    lastCheck: 0,
    consecutiveFailures: 0,
    latencyMs: 0
  };

  // ─── Inicialización ─────────────────────────────────────────────────────
  function initialize() {
    try {
      const config = window.FIREBASE_CONFIG || {};
      
      if (!config.apiKey || !config.projectId) {
        console.warn('[FirebaseClient] Configuración incompleta, usando modo local');
        return { success: false, message: 'Configuración incompleta' };
      }

      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.apps[0];
      }

      db = firebase.firestore();
      auth = firebase.auth();

      // Habilitar persistencia para modo offline
      if (db.enablePersistence) {
        db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('[FirebaseClient] Persistencia ya habilitada en otra pestaña');
          } else if (err.code === 'unimplemented') {
            console.warn('[FirebaseClient] Persistencia no soportada por navegador');
          }
        });
      }

      connectionState = 'connected';
      startHealthCheck();
      
      return { success: true, message: 'Firebase inicializado correctamente' };
    } catch (error) {
      console.error('[FirebaseClient] Error de inicialización:', error);
      connectionState = 'error';
      return { success: false, message: error.message };
    }
  }

  // ─── Health Check ───────────────────────────────────────────────────────
  function startHealthCheck() {
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    
    healthCheckInterval = setInterval(async () => {
      try {
        const start = Date.now();
        await db.collection('health').limit(1).get();
        const latency = Date.now() - start;
        
        healthCheckData = {
          healthy: true,
          lastCheck: Date.now(),
          consecutiveFailures: 0,
          latencyMs: latency
        };
        
        connectionState = latency < 1000 ? 'connected' : 'degraded';
      } catch (error) {
        healthCheckData.consecutiveFailures++;
        healthCheckData.lastCheck = Date.now();
        
        if (healthCheckData.consecutiveFailures >= 3) {
          connectionState = 'disconnected';
          healthCheckData.healthy = false;
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
      await db.collection('health').limit(1).get();
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
  async function list(collection, orderField = null, limit = null) {
    if (!db) throw new Error('Firebase no inicializado');
    
    let query = db.collection(collection);
    
    if (orderField) {
      query = query.orderBy(orderField);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function save(collection, id, data) {
    if (!db) throw new Error('Firebase no inicializado');
    
    const docRef = db.collection(collection).doc(id);
    await docRef.set(data);
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
    // Firebase Firestore no tiene evento nativo de conexión
    // Usamos health check para detectar cambios
    const interval = setInterval(() => {
      const newState = getConnectionState();
      callback(newState);
    }, 5000);
    
    return () => clearInterval(interval);
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
    signInAnonymously,
    getCurrentUser,
    onAuthStateChanged,
    getConfig,
    stop
  };

  console.log('[FirebaseClient] Módulo cargado correctamente');
})();