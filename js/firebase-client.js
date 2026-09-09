/** Cliente Firestore/Auth para modo online y sincronización en tiempo real. */
const FirebaseClient = (() => {
  let db = null;
  let auth = null;
  let initialized = false;
  const listeners = [];

  function getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEYS.FIREBASE_CONFIG) || '{}');
      return { ...(window.FIREBASE_CONFIG || {}), ...saved };
    } catch (_) { return { ...(window.FIREBASE_CONFIG || {}) }; }
  }

  function isConfigured(config = getConfig()) {
    return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  }

  async function initialize(config = getConfig()) {
    if (!window.firebase || !isConfigured(config)) return { success: false, configured: false, mode: 'local' };
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      auth = firebase.auth();
      db = firebase.firestore();
      // Firestore mantiene una caché propia; si no está disponible (por
      // ejemplo, múltiples pestañas antiguas), la caché de API sigue siendo
      // el respaldo determinista.
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch (persistenceError) {
        console.info('[Firestore] Persistencia local no habilitada:', persistenceError.code || persistenceError.message);
      }
      if (!auth.currentUser) await auth.signInAnonymously();
      initialized = true;
      AppState.set('backendMode', 'firestore');
      AppState.set('connected', true);
      return { success: true, configured: true, mode: 'firestore', projectId: config.projectId };
    } catch (error) {
      initialized = false;
      AppState.set('backendMode', 'local');
      AppState.set('connected', false);
      return { success: false, configured: true, mode: 'local', error: error.message };
    }
  }

  function isReady() { return initialized && db !== null; }
  function collection(name) { if (!isReady()) throw new Error('Firestore no está conectado.'); return db.collection(name); }
  function clean(data) {
    return Object.fromEntries(Object.entries(data || {}).filter(([, value]) => value !== undefined));
  }
  function serialize(doc) {
    const data = doc.data() || {};
    Object.keys(data).forEach(key => {
      if (data[key] && typeof data[key].toDate === 'function') data[key] = data[key].toDate().toISOString();
    });
    return { ...data, _docId: doc.id };
  }

  async function list(name, orderField = null) {
    let query = collection(name);
    if (orderField) query = query.orderBy(orderField, 'desc');
    const snapshot = await query.get();
    return snapshot.docs.map(serialize);
  }

  async function save(name, id, data) {
    const ref = collection(name).doc(id || undefined);
    const payload = clean({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await ref.set(payload, { merge: true });
    return { ...data, ID_Registro: ref.id };
  }

  async function remove(name, id) { await collection(name).doc(id).delete(); }

  function subscribe(name, callback) {
    if (!isReady()) return () => {};
    const unsubscribe = collection(name).onSnapshot(snapshot => callback(snapshot.docs.map(serialize)), error => {
      console.warn(`[Firestore] Suscripción ${name}:`, error.message);
    });
    listeners.push(unsubscribe);
    return unsubscribe;
  }

  function stop() { listeners.splice(0).forEach(unsubscribe => unsubscribe()); }

  return { getConfig, isConfigured, initialize, isReady, list, save, remove, subscribe, stop };
})();

window.FirebaseClient = FirebaseClient;
