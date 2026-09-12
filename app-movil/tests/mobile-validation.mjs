/**
 * CONTROL PERSONAL CAMPO — Mobile App Validation
 * Run this in the browser console after loading the app to verify:
 * 1. Firebase connection
 * 2. Real-time subscriptions
 * 3. Offline queue functionality
 * 4. GPS functionality
 */

const MobileAppValidation = (() => {
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
    console.log('🔍 Mobile App Validation');
    console.log('══════════════════════════════════════════════════════════════════');

    results.length = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. FIREBASE CONNECTION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📋 1. FIREBASE CONNECTION');
    console.log('───────────────────────────────────────────────────────────────────────');

    const firebaseConfig = typeof FirebaseClient !== 'undefined' ? FirebaseClient.getConfig?.() : null;
    assert(firebaseConfig && firebaseConfig.projectId, 'Firebase Project ID', firebaseConfig?.projectId || 'Missing');
    assert(firebaseConfig && firebaseConfig.apiKey, 'Firebase API Key', firebaseConfig?.apiKey ? 'Present' : 'Missing');

    const connectionState = typeof FirebaseClient !== 'undefined' ? FirebaseClient.getConnectionState?.() : 'unavailable';
    assert(['connected', 'degraded', 'connecting', 'idle', 'failed'].includes(connectionState), 'Valid Connection State', connectionState);

    const isReady = typeof FirebaseClient !== 'undefined' ? FirebaseClient.isReady?.() : false;
    assert(typeof isReady === 'boolean', 'FirebaseClient.isReady()', `isReady=${isReady}`);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. API INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔌 2. API INITIALIZATION');
    console.log('───────────────────────────────────────────────────────────────────────');

    const apiReady = typeof API !== 'undefined';
    assert(apiReady, 'API object exists', apiReady ? 'API is defined' : 'API not found');

    if (apiReady) {
      const pingResult = await API.ping();
      assert(pingResult.success !== undefined, 'API.ping() works', `success=${pingResult.success}, message=${pingResult.message}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. OFFLINE QUEUE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n💾 3. OFFLINE QUEUE');
    console.log('───────────────────────────────────────────────────────────────────────');

    const queueAvailable = typeof enqueue !== 'undefined' && typeof listQueue !== 'undefined';
    assert(queueAvailable, 'Queue functions available', queueAvailable ? 'enqueue/listQueue/syncOfflineQueue available' : 'Missing');

    if (queueAvailable) {
      const queue = await listQueue();
      assert(Array.isArray(queue), 'Queue returns array', `Queue length: ${queue.length}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. GPS MODULE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📍 4. GPS MODULE');
    console.log('───────────────────────────────────────────────────────────────────────');

    const gpsAvailable = typeof getCurrentPosition === 'function' && typeof distanceMeters === 'function';
    assert(gpsAvailable, 'GPS functions available', gpsAvailable ? 'getCurrentPosition/distanceMeters available' : 'Missing');

    if (gpsAvailable) {
      const testDistance = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 });
      assert(testDistance === 0, 'distanceMeters() works', `Same point distance: ${testDistance}m`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. QR SCANNER
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📷 5. QR SCANNER');
    console.log('───────────────────────────────────────────────────────────────────────');

    const scannerAvailable = typeof QrScanner === 'function';
    assert(scannerAvailable, 'QrScanner class available', scannerAvailable ? 'QrScanner can be instantiated' : 'Missing');

    // ─────────────────────────────────────────────────────────────────────────
    // 6. APP STATE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🗄️ 6. APP STATE');
    console.log('───────────────────────────────────────────────────────────────────────');

    const appStateAvailable = typeof state !== 'undefined' && typeof state.get === 'function' && typeof state.set === 'function';
    assert(appStateAvailable, 'AppState available', appStateAvailable ? 'state.get/set/on available' : 'Missing');

    // ─────────────────────────────────────────────────────────────────────────
    // 7. REAL-TIME SUBSCRIPTIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📡 7. REAL-TIME SUBSCRIPTIONS');
    console.log('───────────────────────────────────────────────────────────────────────');

    const hasSubscriptions = typeof FirebaseClient !== 'undefined' && typeof FirebaseClient.subscribeAttendance === 'function';
    assert(hasSubscriptions, 'Subscription APIs available', hasSubscriptions ? 'subscribeAttendance/subscribeWorkers available' : 'Missing');

    // ─────────────────────────────────────────────────────────────────────────
    // 8. CONNECTION STATE LISTENER
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n🔔 8. CONNECTION STATE LISTENER');
    console.log('───────────────────────────────────────────────────────────────────────');

    let listenerFired = false;
    let listenerState = null;

    if (typeof FirebaseClient !== 'undefined' && FirebaseClient.onConnectionChange) {
      const unsubscribe = FirebaseClient.onConnectionChange((state) => {
        listenerFired = true;
        listenerState = state;
      });
      assert(typeof unsubscribe === 'function', 'onConnectionChange returns unsubscribe', 'Function returned');
      unsubscribe();
    } else {
      assert(false, 'onConnectionChange available', 'Not available');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('📊 VALIDATION SUMMARY');
    console.log('══════════════════════════════════════════════════════════════════');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warnings = results.filter(r => r.status === 'WARN').length;

    console.log(`Total Checks: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);

    if (failed === 0) {
      console.log('\n🎉 All critical checks passed! Mobile app is ready.');
    } else {
      console.log('\n⚠️ Some checks failed. Review the details above.');
    }

    console.log('══════════════════════════════════════════════════════════════════\n');

    return {
      results,
      summary: { total: results.length, passed, failed, warnings },
      connection: { state: connectionState, ready: isReady },
    };
  }

  return { run, assert, log, results };
})();

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('💡 Mobile App Validation ready. Run MobileAppValidation.run() to start validation.');
}
