/**
 * Firebase Firestore Integration Audit Test
 * Ejecuta pruebas CRUD completas para verificar la integración con Firestore
 */

const FirebaseAudit = (() => {
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
  
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function run() {
    console.clear();
    console.log('🔍 Firebase Firestore Integration Audit');
    console.log('══════════════════════════════════════════════════════════════════');
    
    results.length = 0;
    
    // ─────────────────────────────────────────────────────────────────────────
    // 1. CONFIGURATION AND CONNECTION TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📋 1. CONFIGURATION AND CONNECTION');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const config = FirebaseClient.getConfig();
    assert(Boolean(config.projectId), 'Firebase Project ID', config.projectId || 'Missing');
    assert(Boolean(config.apiKey), 'Firebase API Key', config.apiKey ? 'Present' : 'Missing');
    assert(Boolean(config.authDomain), 'Firebase Auth Domain', config.authDomain || 'Missing');
    assert(Boolean(config.appId), 'Firebase App ID', config.appId || 'Missing');
    
    const isValid = FirebaseClient.isConfigured();
    assert(isValid, 'Config Valid', isValid ? 'All required fields present' : 'Missing required fields');
    
    // ─────────────────────────────────────────────────────────────────────────
    // 2. CONNECTION STATE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔌 2. CONNECTION STATE');
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
    
    // Initialize if not ready
    if (!isReady) {
      console.log('⚠️ Firebase not ready, attempting initialization...');
      const initResult = await FirebaseClient.initialize();
      assert(initResult.success, 'Firebase Initialization', initResult.success ? 'Success' : 'Failed');
      await delay(2000);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 3. PERSONAL MODULE CRUD TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n👥 3. PERSONAL MODULE CRUD TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    if (FirebaseClient.isReady()) {
      const testId = `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      // CREATE TEST
      console.log('\n  📝 CREATE Personal Test');
      try {
        const createResult = await API.registrarPersonal({
          id: testId,
          nombre: 'Audit Test Worker',
          dpi: '9876543210123',
          puesto: 'Audit Tester',
          jefe: 'Audit Supervisor',
          telefono: '55555555',
          direccion: 'Test Address'
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
      
      await delay(2000);
      
      // READ TEST
      console.log('\n  📖 READ Personal Test');
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
      
      // UPDATE TEST
      console.log('\n  ✏️ UPDATE Personal Test');
      try {
        const updateResult = await API.actualizarPersonal({
          id: testId,
          nombre: 'Audit Test Worker Updated',
          dpi: '9876543210123',
          puesto: 'Senior Audit Tester',
          jefe: 'Audit Supervisor',
          telefono: '55555555',
          direccion: 'Updated Test Address'
        });
        
        assert(updateResult.success, 'UPDATE - API returns success', 
               updateResult.success ? 'Worker updated' : `Error: ${updateResult.error}`);
        
        await delay(1000);
        const updatedCache = AppState.get('personal') || [];
        const updated = updatedCache.find(p => p.ID_Trabajador === testId);
        assert(updated && updated.Puesto === 'Senior Audit Tester', 'UPDATE - Data updated', 
               updated ? `Puesto: ${updated.Puesto}` : 'Not found');
        
      } catch (error) {
        log('UPDATE', 'FAIL', `Exception: ${error.message}`);
      }
      
      await delay(2000);
      
      // DELETE TEST
      console.log('\n  🗑️ DELETE Personal Test');
      try {
        const deleteResult = await API.eliminarPersonal(testId);
        assert(deleteResult.success, 'DELETE - API returns success', 
               deleteResult.success ? 'Worker deleted' : `Error: ${deleteResult.error}`);
        
        await delay(1000);
        const afterDeleteCache = AppState.get('personal') || [];
        const deleted = afterDeleteCache.find(p => p.ID_Trabajador === testId);
        assert(deleted && deleted.Estado === 'Inactivo', 'DELETE - Marked as Inactive', 
               deleted ? `Estado: ${deleted.Estado}` : 'Not found');
        
      } catch (error) {
        log('DELETE', 'FAIL', `Exception: ${error.message}`);
      }
    } else {
      log('Personal CRUD', 'SKIP', 'Firebase not connected');
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 4. ASISTENCIA MODULE CRUD TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⏰ 4. ASISTENCIA MODULE CRUD TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    if (FirebaseClient.isReady()) {
      const attendanceTestId = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const workerId = 'TEST-WORKER-001';
      
      // CREATE ATTENDANCE TEST
      console.log('\n  📝 CREATE Asistencia Test');
      try {
        const attendanceResult = await API.registrarMarcacion({
          id: attendanceTestId,
          idTrabajador: workerId,
          nombreTrabajador: 'Test Attendance Worker',
          fecha: new Date().toISOString().split('T')[0],
          tipoMarcacion: 'Entrada',
          horaProgramada: '07:00',
          horaReal: new Date().toTimeString().split(' ')[0].substring(0, 5),
          metodo: 'Manual Audit',
          obra: 'Audit Test Site'
        });
        
        assert(attendanceResult.success, 'CREATE Attendance - API returns success', 
               attendanceResult.success ? 'Attendance created' : `Error: ${attendanceResult.error}`);
        
        const attendanceCache = AppState.get('asistencias') || [];
        const foundAttendance = attendanceCache.find(a => a.ID_Marcacion === attendanceTestId);
        assert(foundAttendance !== undefined, 'CREATE Attendance - Data in cache', 
               foundAttendance ? 'Found in cache' : 'Not in cache');
        
      } catch (error) {
        log('CREATE Attendance', 'FAIL', `Exception: ${error.message}`);
      }
      
      await delay(2000);
      
      // READ ATTENDANCE TEST
      console.log('\n  📖 READ Asistencia Test');
      try {
        const today = new Date().toISOString().split('T')[0];
        const readAttendanceResult = await API.obtenerAsistencias(today);
        assert(readAttendanceResult.success, 'READ Attendance - API returns success', 
               readAttendanceResult.success ? 'Attendance list retrieved' : `Error: ${readAttendanceResult.error}`);
        assert(Array.isArray(readAttendanceResult.data), 'READ Attendance - Returns array', 
               `Array with ${readAttendanceResult.data.length} items`);
        
      } catch (error) {
        log('READ Attendance', 'FAIL', `Exception: ${error.message}`);
      }
    } else {
      log('Asistencia CRUD', 'SKIP', 'Firebase not connected');
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 5. REAL-TIME SYNC TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📡 5. REAL-TIME SYNC TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    let realtimeTriggered = false;
    const unsubscribe = FirebaseClient.onConnectionChange((state) => {
      realtimeTriggered = true;
      console.log(`  [Real-time] Connection changed: ${state}`);
    });
    
    assert(typeof unsubscribe === 'function', 'Real-time listener setup', 'Listener registered');
    
    // Simulate connection change by re-initializing
    if (FirebaseClient.isReady()) {
      try {
        await FirebaseClient.initialize();
        await delay(1000);
        assert(realtimeTriggered, 'Real-time sync triggered', realtimeTriggered ? 'Yes' : 'No');
      } catch (error) {
        log('Real-time sync', 'WARN', `Error during re-init: ${error.message}`);
      }
    }
    
    unsubscribe();
    
    // ─────────────────────────────────────────────────────────────────────────
    // 6. OFFLINE QUEUE TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔄 6. OFFLINE QUEUE TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const offlineQueue = API.getOfflineQueue ? API.getOfflineQueue() : [];
    assert(Array.isArray(offlineQueue), 'Offline Queue structure', `Array with ${offlineQueue.length} items`);
    
    const hasPendingSync = API.hasPendingSync ? API.hasPendingSync() : false;
    assert(typeof hasPendingSync === 'boolean', 'Pending sync check', `Has pending: ${hasPendingSync}`);
    
    // Test sync if queue has items
    if (hasPendingSync && FirebaseClient.isReady()) {
      try {
        const syncResult = await API.syncOfflineQueue();
        assert(syncResult.enviadas > 0, 'Sync processed items', `Sent: ${syncResult.enviadas}, Errors: ${syncResult.errores}`);
      } catch (error) {
        log('Offline sync', 'WARN', `Sync error: ${error.message}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 7. SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('📊 AUDIT SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARN').length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    
    if (failed === 0) {
      console.log('\n🎉 All Firebase integration tests passed!');
    } else {
      console.log('\n⚠️ Some tests failed. Review the details above.');
    }
    
    console.log('══════════════════════════════════════════════════════════════════\n');
    
    return {
      results,
      summary: { total: results.length, passed, failed, warnings },
      connection: { state: connectionState, ready: isReady, health }
    };
  }
  
  return { run, results };
})();

// Auto-expose for browser console
if (typeof window !== 'undefined') {
  window.FirebaseAudit = FirebaseAudit;
  console.log('💡 Firebase Audit ready. Run FirebaseAudit.run() to start the audit.');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseAudit;
}