/**
 * CONTROL PERSONAL CAMPO — Firebase Connection & CRUD Diagnostic
 * Validates connection, real-time sync, and CRUD integrity.
 * Run from browser console or include in page for audit.
 */

const FirebaseDiagnostic = (() => {
  const results = [];
  
  function log(test, status, detail) {
    results.push({ test, status, detail, timestamp: new Date().toISOString() });
    const prefix = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${prefix} [${status}] ${test}: ${detail}`);
  }
  
  function assert(condition, test, detail) {
    if (condition) {
      log(test, 'PASS', detail);
    } else {
      log(test, 'FAIL', detail);
    }
    return condition;
  }
  
  async function run() {
    console.clear();
    console.log('🔍 Firebase Connection & CRUD Diagnostic');
    console.log('══════════════════════════════════════════════════════════════════');
    
    results.length = 0;
    
    // ─────────────────────────────────────────────────────────────────────────
    // 1. CONFIGURATION AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📋 1. CONFIGURATION AUDIT');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const config = FirebaseClient.getConfig();
    assert(Boolean(config.projectId), 'Firebase Project ID', config.projectId || 'Missing');
    assert(Boolean(config.apiKey), 'Firebase API Key', config.apiKey ? 'Present' : 'Missing');
    assert(Boolean(config.authDomain), 'Firebase Auth Domain', config.authDomain || 'Missing');
    assert(Boolean(config.appId), 'Firebase App ID', config.appId || 'Missing');
    
    const isValid = FirebaseClient.isConfigured();
    assert(isValid, 'Config Valid', isValid ? 'All required fields present' : 'Missing required fields');
    
    // Check localStorage persistence
    const savedConfig = localStorage.getItem(window.LS_KEYS.FIREBASE_CONFIG);
    assert(savedConfig !== null, 'Config Persisted', savedConfig ? 'Saved in localStorage' : 'Not in localStorage');
    
    // ─────────────────────────────────────────────────────────────────────────
    // 2. CONNECTION STATE AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔌 2. CONNECTION STATE AUDIT');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const connectionState = FirebaseClient.getConnectionState();
    assert(['connected', 'degraded', 'connecting', 'idle', 'failed'].includes(connectionState), 
           'Valid Connection State', connectionState);
    
    const isReady = FirebaseClient.isReady();
    assert(typeof isReady === 'boolean', 'isReady() returns boolean', `isReady=${isReady}`);
    
    const health = FirebaseClient.getHealth();
    assert(health.lastCheck > 0, 'Health Check Executed', 
           `Last check: ${new Date(health.lastCheck).toLocaleTimeString()}, ` +
           `Failures: ${health.consecutiveFailures}, Latency: ${health.latencyMs}ms`);
    
    // Check AppState sync
    const backendMode = AppState.get('backendMode');
    assert(['local', 'firestore'].includes(backendMode), 'AppState.backendMode', backendMode);
    
    const connected = AppState.get('connected');
    assert(typeof connected === 'boolean', 'AppState.connected', `connected=${connected}`);
    
    // Check UI indicators
    const connectionDot = document.querySelector('.connection-dot');
    assert(connectionDot !== null, 'Connection Dot UI', connectionDot ? 'Present' : 'Missing');
    
    const connectionText = document.getElementById('connection-text');
    assert(connectionText !== null, 'Connection Text UI', connectionText ? `Text: "${connectionText.textContent}"` : 'Missing');
    
    const syncIndicator = document.getElementById('sync-indicator');
    assert(syncIndicator !== null, 'Sync Indicator UI', syncIndicator ? 'Present' : 'Missing');
    
    // ─────────────────────────────────────────────────────────────────────────
    // 3. REAL-TIME SUBSCRIPTIONS AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📡 3. REAL-TIME SUBSCRIPTIONS AUDIT');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    // Check if real-time subscriptions are active
    const hasPersonalSub = FirebaseClient.getHealth && FirebaseClient.getHealth().healthy;
    assert(hasPersonalSub || connectionState === 'idle', 
           'Realtime Subscriptions', 
           connectionState === 'connected' || connectionState === 'degraded' 
             ? 'Active (via onSnapshot)' 
             : 'Not active (no connection)');
    
    // Test connection change listener
    let listenerFired = false;
    const unsubscribe = FirebaseClient.onConnectionChange((state) => {
      listenerFired = true;
      console.log(`  [Test] Connection change listener fired: ${state}`);
    });
    
    assert(typeof unsubscribe === 'function', 'onConnectionChange() returns unsubscribe', 'Function returned');
    
    // Cleanup test listener
    unsubscribe();
    
    // ─────────────────────────────────────────────────────────────────────────
    // 4. CRUD OPERATIONS AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔨 4. CRUD OPERATIONS AUDIT');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    if (!isReady || connectionState !== 'connected') {
      log('SKIP', 'CRUD Tests', 'Skipped - Firebase not connected');
    } else {
      // Test ID generation
      const testId = `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      log('ID Generation', 'PASS', `Generated test ID: ${testId}`);
      
      // ── CREATE ──────────────────────────────────────────────────────────────
      console.log('\n  📝 CREATE (Save) Test');
      const testWorker = {
        ID_Trabajador: testId,
        Nombre_Completo: 'Test Worker',
        DPI_CUI: '1234567890123',
        Puesto: 'Albañil',
        Jefe_Inmediato: 'Test Boss',
        Telefono: '12345678',
        WhatsApp: '',
        Direccion: 'Test Address',
        Fotografia_URL: '',
        Fecha_Registro: new Date().toISOString(),
        Estado: 'Activo',
        _test: true
      };
      
      try {
        const createResult = await API.registrarPersonal({
          id: testId,
          nombre: testWorker.Nombre_Completo,
          dpi: testWorker.DPI_CUI,
          puesto: testWorker.Puesto,
          jefe: testWorker.Jefe_Inmediato,
          telefono: testWorker.Telefono,
          direccion: testWorker.Direccion
        });
        
        assert(createResult.success, 'CREATE - API returns success', 
               createResult.success ? 'Worker created' : `Error: ${createResult.error}`);
        assert(createResult.data && createResult.data.length > 0, 'CREATE - Returns data', 
               createResult.data ? `Returned ${createResult.data.length} record(s)` : 'No data');
        
        // Verify in cache
        const personalCache = AppState.get('personal') || [];
        const foundInCache = personalCache.find(p => p.ID_Trabajador === testId);
        assert(foundInCache !== undefined, 'CREATE - Data in AppState cache', 
               foundInCache ? 'Found in cache' : 'Not in cache');
        
      } catch (error) {
        log('CREATE', 'FAIL', `Exception: ${error.message}`);
      }
      
      // Wait for real-time sync
      await delay(2000);
      
      // ── READ ────────────────────────────────────────────────────────────────
      console.log('\n  📖 READ (List) Test');
      try {
        const readResult = await API.obtenerPersonal();
        assert(readResult.success, 'READ - API returns success', 
               readResult.success ? 'Personal list retrieved' : `Error: ${readResult.error}`);
        assert(Array.isArray(readResult.data), 'READ - Returns array', 
               `Array with ${readResult.data.length} items`);
        
        const found = readResult.data.find(p => p.ID_Trabajador === testId);
        assert(found !== undefined, 'READ - Test worker found', 
               found ? `Found: ${found.Nombre_Completo}` : 'Not found');
        
      } catch (error) {
        log('READ', 'FAIL', `Exception: ${error.message}`);
      }
      
      // ── UPDATE ──────────────────────────────────────────────────────────────
      console.log('\n  ✏️ UPDATE (Modify) Test');
      try {
        const updateResult = await API.actualizarPersonal({
          id: testId,
          nombre: 'Test Worker Updated',
          dpi: testWorker.DPI_CUI,
          puesto: 'Maestro de Obra', // Changed
          jefe: testWorker.Jefe_Inmediato,
          telefono: testWorker.Telefono,
          direccion: 'Updated Address'
        });
        
        assert(updateResult.success, 'UPDATE - API returns success', 
               updateResult.success ? 'Worker updated' : `Error: ${updateResult.error}`);
        
        // Verify update in cache
        await delay(1000);
        const updatedCache = AppState.get('personal') || [];
        const updated = updatedCache.find(p => p.ID_Trabajador === testId);
        assert(updated && updated.Puesto === 'Maestro de Obra', 'UPDATE - Data updated', 
               updated ? `Puesto: ${updated.Puesto}` : 'Not found');
        
      } catch (error) {
        log('UPDATE', 'FAIL', `Exception: ${error.message}`);
      }
      
      // Wait for real-time sync
      await delay(2000);
      
      // ── DELETE ──────────────────────────────────────────────────────────────
      console.log('\n  🗑️ DELETE (Remove) Test');
      try {
        const deleteResult = await API.eliminarPersonal(testId);
        assert(deleteResult.success, 'DELETE - API returns success', 
               deleteResult.success ? 'Worker deleted' : `Error: ${deleteResult.error}`);
        
        // Verify deletion (should be marked as Inactivo)
        await delay(1000);
        const afterDeleteCache = AppState.get('personal') || [];
        const deleted = afterDeleteCache.find(p => p.ID_Trabajador === testId);
        assert(deleted && deleted.Estado === 'Inactivo', 'DELETE - Marked as Inactive', 
               deleted ? `Estado: ${deleted.Estado}` : 'Not found');
        
      } catch (error) {
        log('DELETE', 'FAIL', `Exception: ${error.message}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 5. BIDIRECTIONAL SYNC AUDIT
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔄 5. BIDIRECTIONAL SYNC AUDIT');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const offlineQueue = API.getOfflineQueue ? API.getOfflineQueue() : [];
    assert(Array.isArray(offlineQueue), 'Offline Queue is array', `Queue length: ${offlineQueue.length}`);
    
    const hasPendingSync = API.hasPendingSync ? API.hasPendingSync() : false;
    assert(!hasPendingSync, 'No Pending Sync', hasPendingSync ? 'Has pending items' : 'Queue is clean');
    
    // ─────────────────────────────────────────────────────────────────────────
    // 6. PERFORMANCE METRICS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⚡ 6. PERFORMANCE METRICS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const start = performance.now();
    try {
      await API.ping();
      const latency = Math.round(performance.now() - start);
      assert(latency < 5000, 'API Latency < 5s', `${latency}ms`);
    } catch (e) {
      log('API Ping', 'WARN', `Error: ${e.message}`);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARN').length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    
    if (failed === 0) {
      console.log('\n🎉 All critical checks passed! Firebase connection is healthy.');
    } else {
      console.log('\n⚠️ Some checks failed. Review the details above.');
    }
    
    console.log('══════════════════════════════════════════════════════════════════\n');
    
    return {
      results,
      summary: { total: results.length, passed, failed, warnings },
      connection: { state: connectionState, ready: isReady, health }
    };
  }
  
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  return { run, assert, log, results };
})();

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('💡 Firebase Diagnostic ready. Run FirebaseDiagnostic.run() to start audit.');
}
