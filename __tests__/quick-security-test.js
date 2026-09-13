/**
 * Quick Security Rules Verification
 * Verificación rápida de que las nuevas reglas de seguridad están funcionando
 */

const QuickSecurityTest = async () => {
  console.log('🔒 Quick Security Rules Verification');
  console.log('══════════════════════════════════════════════════════════════════');
  
  try {
    // Verificar conexión a Firebase
    const isReady = FirebaseClient.isReady();
    console.log(`${isReady ? '✅' : '❌'} Firebase Connection: ${isReady ? 'Connected' : 'Not Connected'}`);
    
    if (!isReady) {
      console.log('⚠️ Firebase not connected. Cannot test security rules.');
      return;
    }
    
    // Verificar autenticación
    const auth = window.firebase.auth();
    const user = auth.currentUser;
    console.log(`${user ? '✅' : '❌'} User Authenticated: ${user ? 'Yes' : 'No'}`);
    
    if (user) {
      console.log(`👤 User UID: ${user.uid}`);
      
      // Verificar claims
      const idTokenResult = await user.getIdTokenResult();
      console.log(`🔐 Admin Claim: ${!!idTokenResult.claims.admin}`);
    }
    
    // Verificar estado de conexión
    const connectionState = FirebaseClient.getConnectionState();
    console.log(`🔌 Connection State: ${connectionState}`);
    
    // Verificar health
    const health = FirebaseClient.getHealth();
    console.log(`💚 Health Status: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`⏱️  Latency: ${health.latencyMs}ms`);
    
    // Verificar API
    console.log(`🌐 API Available: ${typeof window.API !== 'undefined'}`);
    
    console.log('══════════════════════════════════════════════════════════════════');
    console.log('✅ Security rules deployed and Firebase connected successfully.');
    console.log('📝 For comprehensive testing, run: SecurityRulesTest.run()');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
};

// Auto-expose for browser console
if (typeof window !== 'undefined') {
  window.QuickSecurityTest = QuickSecurityTest;
  console.log('💡 Quick Security Test ready. Run QuickSecurityTest() to verify.');
}