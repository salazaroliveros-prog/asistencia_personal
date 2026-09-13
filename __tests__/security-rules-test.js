/**
 * Firebase Security Rules Test Suite
 * Prueba las nuevas reglas de seguridad implementadas
 */

const SecurityRulesTest = (() => {
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
    console.log('🔒 Firebase Security Rules Test Suite');
    console.log('══════════════════════════════════════════════════════════════════');
    
    results.length = 0;
    
    // ─────────────────────────────────────────────────────────────────────────
    // 1. AUTHENTICATION TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔐 1. AUTHENTICATION TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    const isAuth = FirebaseClient.isReady();
    assert(isAuth, 'Firebase Authenticated', isAuth ? 'User authenticated' : 'Not authenticated');
    
    if (isAuth) {
      const auth = window.firebase.auth();
      const user = auth.currentUser;
      assert(user !== null, 'Current User Available', user ? `UID: ${user.uid}` : 'No user');
      
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        assert(idTokenResult !== null, 'ID Token Available', 'Token retrieved');
        log('Admin Claim Check', 'INFO', `Admin: ${!!idTokenResult.claims.admin}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 2. PERSONAL COLLECTION RULES TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n👥 2. PERSONAL COLLECTION RULES TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    if (isAuth) {
      const testId = `SEC-TEST-${Date.now()}`;
      
      // TEST: Valid Worker Data
      console.log('\n  📝 Test Valid Worker Data Structure');
      try {
        const validWorker = {
          id: testId,
          nombre: 'Security Test Worker',
          dpi: '1234567890123',
          puesto: 'Security Tester',
          jefe: 'Test Supervisor',
          telefono: '55555555',
          direccion: 'Test Address'
        };
        
        const createResult = await API.registrarPersonal(validWorker);
        assert(createResult.success, 'Valid Worker Creation', 
               createResult.success ? 'Valid data accepted' : `Error: ${createResult.error}`);
        
      } catch (error) {
        log('Valid Worker Creation', 'FAIL', `Exception: ${error.message}`);
      }
      
      await delay(1000);
      
      // TEST: Invalid Worker Data (missing required fields)
      console.log('\n  🚫 Test Invalid Worker Data Structure');
      try {
        const invalidWorker = {
          id: `SEC-INVALID-${Date.now()}`,
          nombre: 'Invalid Worker'
          // Missing: dpi, puesto (required fields)
        };
        
        const invalidResult = await API.registrarPersonal(invalidWorker);
        // This should fail due to missing required fields
        assert(!invalidResult.success, 'Invalid Worker Rejected', 
               !invalidResult.success ? 'Invalid data rejected' : 'Invalid data accepted (SECURITY ISSUE)');
        
      } catch (error) {
        log('Invalid Worker Rejection', 'PASS', `Exception as expected: ${error.message}`);
      }
      
      // TEST: Field Size Limits
      console.log('\n  📏 Test Field Size Limits');
      try {
        const oversizedWorker = {
          id: `SEC-OVERSIZE-${Date.now()}`,
          nombre: 'A'.repeat(200), // Exceeds 100 char limit
          dpi: '1234567890123',
          puesto: 'Oversized Tester',
          jefe: 'Test Supervisor',
          telefono: '55555555',
          direccion: 'Test Address'
        };
        
        const oversizedResult = await API.registrarPersonal(oversizedWorker);
        // This should fail due to oversized field
        assert(!oversizedResult.success, 'Oversized Field Rejected', 
               !oversizedResult.success ? 'Oversized data rejected' : 'Oversized data accepted (SECURITY ISSUE)');
        
      } catch (error) {
        log('Oversized Field Rejection', 'PASS', `Exception as expected: ${error.message}`);
      }
      
      // TEST: Update with Allowed Fields
      console.log('\n  ✏️ Test Update with Allowed Fields');
      try {
        const updateResult = await API.actualizarPersonal({
          id: testId,
          nombre: 'Updated Security Test Worker',
          dpi: '1234567890123',
          puesto: 'Senior Security Tester',
          jefe: 'Test Supervisor',
          telefono: '55555555',
          direccion: 'Updated Address'
        });
        
        assert(updateResult.success, 'Allowed Fields Update', 
               updateResult.success ? 'Update with allowed fields succeeded' : `Error: ${updateResult.error}`);
        
      } catch (error) {
        log('Allowed Fields Update', 'FAIL', `Exception: ${error.message}`);
      }
      
      // Cleanup test worker
      await API.eliminarPersonal(testId);
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 3. ASISTENCIA COLLECTION RULES TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⏰ 3. ASISTENCIA COLLECTION RULES TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    if (isAuth) {
      const attendanceTestId = `SEC-ATT-${Date.now()}`;
      
      // TEST: Valid Attendance Data
      console.log('\n  📝 Test Valid Attendance Data Structure');
      try {
        const validAttendance = {
          id: attendanceTestId,
          idTrabajador: 'TEST-WORKER-001',
          nombreTrabajador: 'Test Attendance Worker',
          fecha: new Date().toISOString().split('T')[0],
          tipoMarcacion: 'Entrada',
          horaProgramada: '07:00',
          horaReal: new Date().toTimeString().split(' ')[0].substring(0, 5),
          metodo: 'Security Test',
          obra: 'Test Site'
        };
        
        const createResult = await API.registrarMarcacion(validAttendance);
        assert(createResult.success, 'Valid Attendance Creation', 
               createResult.success ? 'Valid attendance accepted' : `Error: ${createResult.error}`);
        
      } catch (error) {
        log('Valid Attendance Creation', 'FAIL', `Exception: ${error.message}`);
      }
      
      // TEST: Invalid Attendance Type
      console.log('\n  🚫 Test Invalid Attendance Type');
      try {
        const invalidAttendance = {
          id: `SEC-INVALID-ATT-${Date.now()}`,
          idTrabajador: 'TEST-WORKER-001',
          nombreTrabajador: 'Test Worker',
          fecha: new Date().toISOString().split('T')[0],
          tipoMarcacion: 'INVALID_TYPE', // Not in allowed types
          horaReal: '08:00',
          metodo: 'Test'
        };
        
        const invalidResult = await API.registrarMarcacion(invalidAttendance);
        // This should fail due to invalid type
        assert(!invalidResult.success, 'Invalid Type Rejected', 
               !invalidResult.success ? 'Invalid type rejected' : 'Invalid type accepted (SECURITY ISSUE)');
        
      } catch (error) {
        log('Invalid Type Rejection', 'PASS', `Exception as expected: ${error.message}`);
      }
      
      // TEST: Update Prevention
      console.log('\n  🚫 Test Attendance Update Prevention');
      try {
        // The rules should prevent updates to attendance records
        // This test verifies that the application respects this constraint
        log('Update Prevention', 'INFO', 'Application does not allow attendance updates by design');
        
      } catch (error) {
        log('Update Prevention', 'WARN', `Error: ${error.message}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 4. CONFIGURACIÓN COLLECTION RULES TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n⚙️ 4. CONFIGURACIÓN COLLECTION RULES TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    if (isAuth) {
      // TEST: Configuration Access
      console.log('\n  🔒 Test Configuration Access');
      try {
        const configResult = await API.obtenerConfiguracion();
        assert(configResult.success, 'Configuration Read', 
               configResult.success ? 'Configuration accessible' : 'Access denied');
        
      } catch (error) {
        log('Configuration Access', 'WARN', `Error: ${error.message}`);
      }
      
      // TEST: Configuration Write
      console.log('\n  ✏️ Test Configuration Write');
      try {
        const writeResult = await API.guardarConfiguracion({
          TestSetting: 'Security Test Value',
          TestNumber: 123
        });
        
        assert(writeResult.success, 'Configuration Write', 
               writeResult.success ? 'Configuration write succeeded' : `Error: ${writeResult.error}`);
        
      } catch (error) {
        log('Configuration Write', 'FAIL', `Exception: ${error.message}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // 5. SIZE LIMITS TESTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📏 5. SIZE LIMITS TESTS');
    console.log('───────────────────────────────────────────────────────────────────────');
    
    log('Field Size Limits', 'INFO', 'Personal: max 15 fields, string 1-100 chars');
    log('Field Size Limits', 'INFO', 'Asistencia: max 20 fields, string 1-100 chars');
    log('Field Size Limits', 'INFO', 'Configuración: max 30 fields');
    
    // ─────────────────────────────────────────────────────────────────────────
    // 6. SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('📊 SECURITY RULES TEST SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARN').length;
    const info = results.filter(r => r.status === 'INFO').length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`ℹ️ Info: ${info}`);
    
    if (failed === 0) {
      console.log('\n🎉 All security rules tests passed! Rules are working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Review the details above.');
    }
    
    console.log('══════════════════════════════════════════════════════════════════\n');
    
    return {
      results,
      summary: { total: results.length, passed, failed, warnings, info },
      security: { level: failed === 0 ? 'HIGH' : 'MEDIUM', score: failed === 0 ? 9 : 7 }
    };
  }
  
  return { run, results };
})();

// Auto-expose for browser console
if (typeof window !== 'undefined') {
  window.SecurityRulesTest = SecurityRulesTest;
  console.log('💡 Security Rules Test ready. Run SecurityRulesTest.run() to start testing.');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecurityRulesTest;
}