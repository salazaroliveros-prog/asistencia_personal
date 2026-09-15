/**
 * Google Apps Script — Auto-población de configuración
 *
 * Este módulo contiene:
 * - Función manual para poblar configuración desde PropertiesService hacia Firestore.
 * - Validación previa a escritura.
 * - Integración referenciada por el email configurado.
 * - Sin secretos embebidos en el código fuente.
 */

/* ---------------------------------------------------------------------------
 * FLUJO SEGURO DE CONFIGURACIÓN
 * --------------------------------------------------------------------------- */

/**
 * Flujo recomendado:
 * 1. Ejecutar initAppConfig() una vez para guardar valores en PropertiesService.
 * 2. Ejecutar populateAppConfigFromProperties() para volcar a Firestore.
 * 3. La app cliente lee Firestore para inicializarse.
 *
 * Nunca expongas API_KEY en PropertiesService si no es estrictamente necesario.
 * En este flujo se prioriza almacenar en Firestore protegido por reglas.
 */

/**
 * Lee la configuración desde PropertiesService y la escribe en Firestore.
 * Solo se escriben metadatos operativos, no secretos sensibles.
 */
async function populateAppConfigFromProperties() {
  const emailValid = isIntegrationEmailValid();
  if (!emailValid) {
    throw new Error('INTEGRATION_EMAIL no está configurado. Ejecuta initAppConfig() primero.');
  }

  logConfigAccess('populate_start');

  try {
    await upsertAppConfigInFirestore();
    logConfigAccess('populate_success');
    Logger.log('Configuración poblada correctamente desde PropertiesService hacia Firestore.');
  } catch (error) {
    logConfigAccess('populate_error');
    throw error;
  }
}

/**
 * Verifica que la configuración en Firestore esté completa y vigente.
 */
async function verifyFirestoreConfig() {
  const config = await readAppConfigFromFirestore();

  if (!config) {
    return {
      ok: false,
      reason: 'Configuración no encontrada en Firestore. Ejecuta populateAppConfigFromProperties().',
    };
  }

  const issues = [];

  if (!config.obra) issues.push('obra faltante');
  if (!config.encargado) issues.push('encargado faltante');
  if (!config.horarios?.Entrada) issues.push('horario de entrada faltante');
  if (!config.integracion?.projectId) issues.push('projectId faltante');

  return {
    ok: issues.length === 0,
    issues,
    config,
  };
}

/* ---------------------------------------------------------------------------
 * EXPORTACIÓN
 * --------------------------------------------------------------------------- */

/**
 * Resumen de funciones disponibles:
 *
 * - initAppConfig() -> inicializa PropertiesService con valores base.
 * - getPublicConfig() -> obtiene config pública desde PropertiesService.
 * - isIntegrationEmailValid() -> valida presencia del email de integración.
 * - populateAppConfigFromProperties() -> escribe configuración en Firestore.
 * - readAppConfigFromFirestore() -> lee configuración desde Firestore.
 * - verifyFirestoreConfig() -> valida completitud de config en Firestore.
 * - getIntegrationEmail() -> obtiene email de integración (uso interno).
 * - logConfigAccess(action) -> registra accesos/configuraciones.
 */
