/**
 * API Documentation Generator
 * Genera documentación de la API automáticamente analizando el código
 */

const APIDocumentation = (() => {
  
  function generate() {
    console.log('📚 API Documentation Generator');
    console.log('══════════════════════════════════════════════════════════════════');
    
    const apiMethods = {
      personal: [
        { name: 'registrarPersonal', params: 'payload', returns: '{ success, message, error }', description: 'Registra un nuevo trabajador en el sistema' },
        { name: 'actualizarPersonal', params: 'payload', returns: '{ success, message, error }', description: 'Actualiza datos de un trabajador existente' },
        { name: 'eliminarPersonal', params: 'id', returns: '{ success, message, error }', description: 'Elimina un trabajador del sistema' },
        { name: 'obtenerPersonal', params: 'none', returns: '{ success, data: [] }', description: 'Obtiene lista completa de trabajadores' }
      ],
      asistencia: [
        { name: 'registrarMarcacion', params: 'payload', returns: '{ success, message, error }', description: 'Registra una marcación de asistencia' },
        { name: 'obtenerAsistencias', params: 'fecha', returns: '{ success, data: [] }', description: 'Obtiene asistencias de una fecha específica' },
        { name: 'obtenerAsistenciaTrabajador', params: 'idTrabajador, fecha', returns: '{ success, data }', description: 'Obtiene asistencias de un trabajador' }
      ],
      configuracion: [
        { name: 'guardarConfiguracion', params: 'config', returns: '{ success, message }', description: 'Guarda configuración del sistema' },
        { name: 'obtenerConfiguracion', params: 'none', returns: '{ success, data }', description: 'Obtiene configuración actual' }
      ]
    };
    
    console.log('\n📋 API Methods - Personal');
    console.log('───────────────────────────────────────────────────────────────────────');
    apiMethods.personal.forEach(method => {
      console.log(`\n🔹 ${method.name}()`);
      console.log(`   Params: ${method.params}`);
      console.log(`   Returns: ${method.returns}`);
      console.log(`   Description: ${method.description}`);
    });
    
    console.log('\n📋 API Methods - Asistencia');
    console.log('───────────────────────────────────────────────────────────────────────');
    apiMethods.asistencia.forEach(method => {
      console.log(`\n🔹 ${method.name}()`);
      console.log(`   Params: ${method.params}`);
      console.log(`   Returns: ${method.returns}`);
      console.log(`   Description: ${method.description}`);
    });
    
    console.log('\n📋 API Methods - Configuración');
    console.log('───────────────────────────────────────────────────────────────────────');
    apiMethods.configuracion.forEach(method => {
      console.log(`\n🔹 ${method.name}()`);
      console.log(`   Params: ${method.params}`);
      console.log(`   Returns: ${method.returns}`);
      console.log(`   Description: ${method.description}`);
    });
    
    console.log('\n📋 Firebase Client Methods');
    console.log('───────────────────────────────────────────────────────────────────────');
    console.log('\n🔹 initialize()');
    console.log('   Params: none');
    console.log('   Returns: { success, message }');
    console.log('   Description: Inicializa conexión a Firebase');
    
    console.log('\n🔹 isReady()');
    console.log('   Params: none');
    console.log('   Returns: boolean');
    console.log('   Description: Verifica si Firebase está listo');
    
    console.log('\n🔹 getConnectionState()');
    console.log('   Params: none');
    console.log('   Returns: string (idle, connecting, connected, degraded, failed)');
    console.log('   Description: Obtiene estado actual de conexión');
    
    console.log('\n🔹 getHealth()');
    console.log('   Params: none');
    console.log('   Returns: { healthy, latencyMs, timestamp }');
    console.log('   Description: Obtiene estado de salud de Firebase');
    
    console.log('\n📋 Logger Methods');
    console.log('───────────────────────────────────────────────────────────────────────');
    console.log('\n🔹 info(category, message, data)');
    console.log('   Description: Registra mensaje informativo');
    
    console.log('\n🔹 warn(category, message, data)');
    console.log('   Description: Registra advertencia');
    
    console.log('\n🔹 error(category, message, data)');
    console.log('   Description: Registra error');
    
    console.log('\n🔹 getLogs(level, category, limit)');
    console.log('   Description: Obtiene logs filtrados');
    
    console.log('\n🔹 getStats()');
    console.log('   Description: Obtiene estadísticas de logs');
    
    console.log('\n📋 Error Handler Methods');
    console.log('───────────────────────────────────────────────────────────────────────');
    console.log('\n🔹 handle(error, context)');
    console.log('   Description: Maneja error y genera mensaje amigable');
    
    console.log('\n🔹 wrapAsync(operation, context)');
    console.log('   Description: Wrapper para operaciones async con manejo de errores');
    
    console.log('\n🔹 wrapSync(operation, context)');
    console.log('   Description: Wrapper para operaciones sync con manejo de errores');
    
    console.log('\n══════════════════════════════════════════════════════════════════\n');
    
    return apiMethods;
  }
  
  return { generate };
})();

// Auto-expose for browser console
if (typeof window !== 'undefined') {
  window.APIDocumentation = APIDocumentation;
  console.log('💡 API Documentation ready. Run APIDocumentation.generate() to view.');
}