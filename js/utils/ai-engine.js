/**
 * CONTROL PERSONAL CAMPO — utils/ai-engine.js
 * Motor central de inteligencia artificial del sistema
 * Coordina logging, diagnóstico, autoreparación y aprendizaje
 * @version 1.5.0
 */

const AIEngine = (() => {
  let initialized = false;
  let autoHealingEnabled = true;
  let learningEnabled = true;
  let healthCheckInterval = null;

  /**
   * Inicializa el motor de IA
   * @param {Object} config - Configuración del motor
   */
  function initialize(config = {}) {
    if (initialized) {
      console.warn('[AIEngine] Ya inicializado');
      return;
    }

    console.log('[AIEngine] Inicializando motor de IA...');
    
    // Configurar opciones
    autoHealingEnabled = config.autoHealing !== undefined ? config.autoHealing : true;
    learningEnabled = config.learning !== undefined ? config.learning : true;
    
    // Configurar autoreparación automática
    if (autoHealingEnabled && window.AutoHealing) {
      window.AutoHealing.setupAutoHealing(config.autoHealingThreshold || 3);
    }

    // Configurar verificación de salud periódica
    const healthCheckInterval = config.healthCheckInterval || 300000; // 5 minutos
    startHealthMonitoring(healthCheckInterval);

    // Configurar manejo global de errores
    setupGlobalErrorHandling();

    initialized = true;
    console.log('[AIEngine] Motor de IA inicializado exitosamente');
  }

  /**
   * Configura manejo global de errores
   */
  function setupGlobalErrorHandling() {
    // Capturar errores no manejados
    window.addEventListener('error', (event) => {
      handleGlobalError(event.error, 'window.onerror');
    });

    // Capturar promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event) => {
      handleGlobalError(event.reason, 'unhandledrejection');
    });
  }

  /**
   * Maneja errores globales
   * @param {Error} error - Error capturado
   * @param {string} source - Fuente del error
   */
  async function handleGlobalError(error, source) {
    console.error(`[AIEngine] Error global capturado (${source}):`, error);
    
    if (window.AILogger) {
      const analysis = window.AILogger.analyzeError(error);
      window.AILogger.log('error', `Error global (${source})`, { source }, error);
      
      // Intentar autoreparación si está habilitado
      if (autoHealingEnabled && window.AutoHealing) {
        const healingResult = await window.AutoHealing.autoHeal(analysis);
        console.log('[AIEngine] Resultado de autoreparación:', healingResult);
      }
    }
  }

  /**
   * Inicia monitoreo de salud del sistema
   * @param {number} interval - Intervalo en milisegundos
   */
  function startHealthMonitoring(interval) {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }

    healthCheckInterval = setInterval(async () => {
      await performHealthCheck();
    }, interval);
  }

  /**
   * Detiene monitoreo de salud
   */
  function stopHealthMonitoring() {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  }

  /**
   * Realiza verificación de salud del sistema
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async function performHealthCheck() {
    console.log('[AIEngine] Realizando verificación de salud...');
    
    const healthReport = {
      timestamp: Date.now(),
      overallHealth: 'unknown',
      components: {},
      recommendations: [],
      autoHealingActions: []
    };

    // Verificar diagnóstico de hardware
    if (window.HardwareDiagnostics) {
      const diagnostics = await window.HardwareDiagnostics.runFullDiagnostics();
      healthReport.components.hardware = diagnostics;
      healthReport.overallHealth = diagnostics.overallHealth;
      
      // Generar recomendaciones
      healthReport.recommendations.push(...diagnostics.criticalIssues.map(issue => 
        `CRÍTICO: ${issue}`
      ));
      healthReport.recommendations.push(...diagnostics.warnings.map(warning => 
        `ADVERTENCIA: ${warning}`
      ));
    }

    // Verificar logs de IA
    if (window.AILogger) {
      const aiLogs = window.AILogger.generateHealthReport();
      healthReport.components.ai = aiLogs;
      
      if (aiLogs.alerts.length > 0) {
        healthReport.recommendations.push(...aiLogs.alerts.map(alert => 
          `IA: ${alert.message}`
        ));
      }
    }

    // Ejecutar autoreparación si hay problemas críticos
    if (autoHealingEnabled && window.AutoHealing && healthReport.overallHealth === 'critical') {
      console.log('[AIEngine] Problemas críticos detectados, ejecutando autoreparación...');
      const healingResult = await window.AutoHealing.diagnoseAndHeal();
      healthReport.autoHealingActions = healingResult;
    }

    // Guardar reporte en localStorage
    try {
      const healthHistory = JSON.parse(localStorage.getItem('cpc_health_history') || '[]');
      healthHistory.push(healthReport);
      
      // Mantener solo últimos 50 reportes
      if (healthHistory.length > 50) {
        healthHistory.shift();
      }
      
      localStorage.setItem('cpc_health_history', JSON.stringify(healthHistory));
    } catch (e) {
      console.warn('[AIEngine] No se pudo guardar historial de salud:', e);
    }

    return healthReport;
  }

  /**
   * Genera reporte completo del sistema
   * @returns {Promise<Object>} Reporte completo
   */
  async function generateSystemReport() {
    const report = {
      timestamp: Date.now(),
      ai: {},
      hardware: {},
      health: {},
      recommendations: []
    };

    // Reporte de IA
    if (window.AILogger) {
      report.ai = {
        logs: window.AILogger.getLogs(),
        errorHistory: window.AILogger.getErrorHistory(),
        patterns: window.AILogger.analyzePatterns(),
        health: window.AILogger.generateHealthReport()
      };
    }

    // Reporte de hardware
    if (window.HardwareDiagnostics) {
      report.hardware = await window.HardwareDiagnostics.generateDiagnosticReport();
    }

    // Reporte de salud
    const healthCheck = await performHealthCheck();
    report.health = healthCheck;

    // Generar recomendaciones inteligentes
    report.recommendations = generateIntelligentRecommendations(report);

    return report;
  }

  /**
   * Genera recomendaciones inteligentes basadas en el estado del sistema
   * @param {Object} report - Reporte del sistema
   * @returns {Array} Recomendaciones
   */
  function generateIntelligentRecommendations(report) {
    const recommendations = [];

    // Recomendaciones basadas en hardware
    if (report.hardware.overallHealth === 'critical') {
      recommendations.push({
        priority: 'critical',
        category: 'hardware',
        message: 'Problemas críticos de hardware detectados',
        actions: report.hardware.manualFixRequired
      });
    }

    // Recomendaciones basadas en IA
    if (report.ai.health.systemHealth === 'issues_detected') {
      recommendations.push({
        priority: 'high',
        category: 'software',
        message: 'Problemas de software detectados',
        actions: report.ai.health.suggestions
      });
    }

    // Recomendaciones basadas en patrones
    if (report.ai.patterns.recentErrors > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: 'Alta actividad de errores detectada',
        actions: ['Revisar configuración del sistema', 'Verificar conectividad', 'Considerar reiniciar aplicación']
      });
    }

    return recommendations;
  }

  /**
   * Habilita/deshabilita autoreparación
   * @param {boolean} enabled - Estado de autoreparación
   */
  function setAutoHealing(enabled) {
    autoHealingEnabled = enabled;
    console.log(`[AIEngine] Autoreparación ${enabled ? 'habilitada' : 'deshabilitada'}`);
  }

  /**
   * Habilita/deshabilita aprendizaje
   * @param {boolean} enabled - Estado de aprendizaje
   */
  function setLearning(enabled) {
    learningEnabled = enabled;
    console.log(`[AIEngine] Aprendizaje ${enabled ? 'habilitado' : 'deshabilitado'}`);
  }

  /**
   * Obtiene estado del motor de IA
   * @returns {Object} Estado del motor
   */
  function getStatus() {
    return {
      initialized,
      autoHealingEnabled,
      learningEnabled,
      healthMonitoring: healthCheckInterval !== null
    };
  }

  /**
   * Limpia todos los datos de IA
   */
  function cleanup() {
    stopHealthMonitoring();
    
    if (window.AILogger) {
      window.AILogger.clearHistory();
    }
    
    localStorage.removeItem('cpc_error_history');
    localStorage.removeItem('cpc_ai_logs');
    localStorage.removeItem('cpc_health_history');
    
    console.log('[AIEngine] Datos de IA limpiados');
  }

  return {
    initialize,
    handleGlobalError,
    performHealthCheck,
    generateSystemReport,
    setAutoHealing,
    setLearning,
    getStatus,
    cleanup
  };
})();

// Exponer el módulo globalmente
window.AIEngine = AIEngine;