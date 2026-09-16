/**
 * CONTROL PERSONAL CAMPO — utils/ai-predictor.js
 * Sistema de predicción proactiva de errores y anomalías
 * @version 1.5.0
 */

const AIPredictor = (() => {
  let predictionHistory = [];
  let patterns = [];
  let thresholds = {
    errorRate: 0.1,        // 10% de tasa de error
    memoryUsage: 0.8,     // 80% de uso de memoria
    networkLatency: 5000, // 5 segundos de latencia
    storageUsage: 0.9,    // 90% de uso de almacenamiento
    batteryLevel: 0.2      // 20% de batería
  };

  /**
   * Analiza patrones de errores para predecir futuros errores
   * @param {Array} errorHistory - Historial de errores
   * @returns {Object} Predicción de errores
   */
  function predictErrors(errorHistory) {
    const prediction = {
      likelihood: 0,
      predictedErrors: [],
      timeFrame: '1 hora',
      confidence: 0,
      recommendations: []
    };

    if (!Array.isArray(errorHistory) || errorHistory.length === 0) {
      return prediction;
    }

    // Analizar frecuencia de errores por tipo
    const errorFrequency = {};
    errorHistory.forEach(error => {
      const type = error.type || 'unknown';
      errorFrequency[type] = (errorFrequency[type] || 0) + 1;
    });

    // Detectar errores recurrentes
    const recurrentErrors = Object.entries(errorFrequency)
      .filter(([_, count]) => count >= 3)
      .map(([type, count]) => ({ type, count }));

    if (recurrentErrors.length > 0) {
      prediction.likelihood = Math.min(0.9, recurrentErrors.length * 0.3);
      prediction.predictedErrors = recurrentErrors.map(r => r.type);
      prediction.confidence = 0.7;
      prediction.recommendations = recurrentErrors.map(r => 
        `Prevenir ${r.type}: Verificar ${getErrorPreventionTip(r.type)}`
      );
    }

    // Analizar tendencia temporal
    const recentErrors = errorHistory.slice(-10);
    const olderErrors = errorHistory.slice(0, -10);
    
    if (recentErrors.length > olderErrors.length) {
      prediction.likelihood = Math.min(0.95, prediction.likelihood + 0.2);
      prediction.recommendations.push('Aumento en tasa de errores detectado - considere revisar configuración');
    }

    return prediction;
  }

  /**
   * Obtiene consejo de prevención para un tipo de error
   * @param {string} errorType - Tipo de error
   * @returns {string} Consejo de prevención
   */
  function getErrorPreventionTip(errorType) {
    const tips = {
      'camera': 'conexión de cámara y permisos',
      'gps': 'configuración de GPS y señal',
      'network': 'conectividad y latencia de red',
      'storage': 'espacio disponible y cuotas',
      'memory': 'uso de memoria y leaks',
      'firebase': 'conexión Firebase y límites',
      'scanner': 'configuración de escáner y calidad de imagen',
      'unknown': 'configuración general del sistema'
    };
    return tips[errorType] || tips.unknown;
  }

  /**
   * Analiza patrones de uso del sistema
   * @param {Object} usageData - Datos de uso
   * @returns {Object} Análisis de patrones
   */
  function analyzeUsagePatterns(usageData) {
    const patterns = {
      peakHours: [],
      frequentActions: [],
      resourceUsage: {},
      trends: []
    };

    if (!usageData) return patterns;

    // Analizar horarios pico
    if (usageData.timestamps) {
      const hourCounts = {};
      usageData.timestamps.forEach(ts => {
        const hour = new Date(ts).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const avgUsage = Object.values(hourCounts).reduce((a, b) => a + b, 0) / Object.keys(hourCounts).length;
      patterns.peakHours = Object.entries(hourCounts)
        .filter(([_, count]) => count > avgUsage * 1.5)
        .map(([hour, _]) => parseInt(hour));
    }

    // Analizar acciones frecuentes
    if (usageData.actions) {
      const actionCounts = {};
      usageData.actions.forEach(action => {
        actionCounts[action] = (actionCounts[action] || 0) + 1;
      });

      patterns.frequentActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }));
    }

    // Analizar uso de recursos
    if (usageData.resources) {
      patterns.resourceUsage = {
        memory: usageData.resources.memory || 0,
        storage: usageData.resources.storage || 0,
        network: usageData.resources.network || 0
      };
    }

    return patterns;
  }

  /**
   * Detecta anomalías en el comportamiento del sistema
   * @param {Object} currentMetrics - Métricas actuales
   * @param {Object} baselineMetrics - Métricas base
   * @returns {Object} Anomalías detectadas
   */
  function detectAnomalies(currentMetrics, baselineMetrics) {
    const anomalies = {
      detected: [],
      severity: 'none',
      actions: []
    };

    if (!currentMetrics || !baselineMetrics) {
      return anomalies;
    }

    // Detectar anomalías en uso de memoria
    if (currentMetrics.memoryUsage > baselineMetrics.memoryUsage * 1.5) {
      anomalies.detected.push({
        type: 'memory',
        value: currentMetrics.memoryUsage,
        baseline: baselineMetrics.memoryUsage,
        severity: 'high'
      });
      anomalies.actions.push('Limpiar caché y reiniciar si el uso de memoria es crítico');
    }

    // Detectar anomalías en latencia de red
    if (currentMetrics.networkLatency > baselineMetrics.networkLatency * 2) {
      anomalies.detected.push({
        type: 'network',
        value: currentMetrics.networkLatency,
        baseline: baselineMetrics.networkLatency,
        severity: 'medium'
      });
      anomalies.actions.push('Verificar conectividad y considerar modo offline');
    }

    // Detectar anomalías en tasa de errores
    if (currentMetrics.errorRate > baselineMetrics.errorRate * 2) {
      anomalies.detected.push({
        type: 'errors',
        value: currentMetrics.errorRate,
        baseline: baselineMetrics.errorRate,
        severity: 'high'
      });
      anomalies.actions.push('Investigar causa del aumento en errores');
    }

    // Determinar severidad general
    if (anomalies.detected.some(a => a.severity === 'high')) {
      anomalies.severity = 'high';
    } else if (anomalies.detected.some(a => a.severity === 'medium')) {
      anomalies.severity = 'medium';
    } else if (anomalies.detected.length > 0) {
      anomalies.severity = 'low';
    }

    return anomalies;
  }

  /**
   * Genera recomendaciones inteligentes basadas en el estado del sistema
   * @param {Object} systemState - Estado actual del sistema
   * @returns {Array} Recomendaciones
   */
  function generateSmartRecommendations(systemState) {
    const recommendations = [];

    if (!systemState) return recommendations;

    // Recomendaciones de rendimiento
    if (systemState.memoryUsage > thresholds.memoryUsage) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        action: 'Reducir calidad de video y activar modo de ahorro de memoria',
        reason: 'Uso de memoria crítico'
      });
    }

    if (systemState.networkLatency > thresholds.networkLatency) {
      recommendations.push({
        type: 'network',
        priority: 'medium',
        action: 'Activar modo offline y sincronización diferida',
        reason: 'Latencia de red alta'
      });
    }

    if (systemState.storageUsage > thresholds.storageUsage) {
      recommendations.push({
        type: 'storage',
        priority: 'high',
        action: 'Limpiar caché y datos antiguos',
        reason: 'Almacenamiento casi lleno'
      });
    }

    // Recomendaciones de experiencia de usuario
    if (systemState.batteryLevel < thresholds.batteryLevel) {
      recommendations.push({
        type: 'battery',
        priority: 'medium',
        action: 'Reducir FPS y optimizar para ahorro de batería',
        reason: 'Nivel de batería bajo'
      });
    }

    // Recomendaciones de seguridad
    if (systemState.errorRate > thresholds.errorRate) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        action: 'Activar modo seguro y limitar operaciones críticas',
        reason: 'Tasa de errores alta'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Analiza rendimiento en tiempo real
   * @param {Object} metrics - Métricas actuales
   * @returns {Object} Análisis de rendimiento
   */
  function analyzeRealTimePerformance(metrics) {
    const analysis = {
      score: 100,
      factors: [],
      status: 'excellent'
    };

    if (!metrics) return analysis;

    // Factor de memoria
    if (metrics.memoryUsage) {
      const memoryScore = Math.max(0, 100 - (metrics.memoryUsage * 100));
      analysis.score -= (100 - memoryScore) * 0.3;
      analysis.factors.push({
        name: 'memory',
        score: memoryScore,
        impact: 0.3
      });
    }

    // Factor de red
    if (metrics.networkLatency) {
      const networkScore = Math.max(0, 100 - (metrics.networkLatency / 100));
      analysis.score -= (100 - networkScore) * 0.25;
      analysis.factors.push({
        name: 'network',
        score: networkScore,
        impact: 0.25
      });
    }

    // Factor de errores
    if (metrics.errorRate) {
      const errorScore = Math.max(0, 100 - (metrics.errorRate * 1000));
      analysis.score -= (100 - errorScore) * 0.35;
      analysis.factors.push({
        name: 'errors',
        score: errorScore,
        impact: 0.35
      });
    }

    // Determinar estado
    if (analysis.score >= 90) {
      analysis.status = 'excellent';
    } else if (analysis.score >= 70) {
      analysis.status = 'good';
    } else if (analysis.score >= 50) {
      analysis.status = 'fair';
    } else {
      analysis.status = 'poor';
    }

    analysis.score = Math.max(0, Math.min(100, analysis.score));

    return analysis;
  }

  /**
   * Auto-configura parámetros del sistema según el estado
   * @param {Object} systemState - Estado actual del sistema
   * @returns {Object} Parámetros configurados
   */
  function autoConfigureParameters(systemState) {
    const parameters = {
      scanFPS: 10,
      videoQuality: 'balanced',
      cacheSize: 50,
      syncInterval: 30000,
      performanceMode: 'balanced'
    };

    if (!systemState) return parameters;

    // Ajustar según memoria
    if (systemState.memoryUsage > 0.7) {
      parameters.scanFPS = 5;
      parameters.videoQuality = 'low';
      parameters.performanceMode = 'low';
    } else if (systemState.memoryUsage > 0.5) {
      parameters.scanFPS = 10;
      parameters.videoQuality = 'balanced';
      parameters.performanceMode = 'balanced';
    } else {
      parameters.scanFPS = 15;
      parameters.videoQuality = 'high';
      parameters.performanceMode = 'high';
    }

    // Ajustar según red
    if (systemState.networkLatency > 3000) {
      parameters.syncInterval = 60000;
      parameters.cacheSize = 100;
    } else if (systemState.networkLatency > 1000) {
      parameters.syncInterval = 30000;
      parameters.cacheSize = 50;
    } else {
      parameters.syncInterval = 15000;
      parameters.cacheSize = 25;
    }

    // Ajustar según batería
    if (systemState.batteryLevel < 0.3) {
      parameters.scanFPS = Math.min(parameters.scanFPS, 5);
      parameters.performanceMode = 'low';
    }

    return parameters;
  }

  /**
   * Analiza tendencias de datos
   * @param {Array} dataPoints - Puntos de datos históricos
   * @returns {Object} Análisis de tendencias
   */
  function analyzeTrends(dataPoints) {
    const trends = {
      direction: 'stable',
      changeRate: 0,
      prediction: null,
      confidence: 0
    };

    if (!Array.isArray(dataPoints) || dataPoints.length < 2) {
      return trends;
    }

    // Calcular tasa de cambio
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changeRate = ((secondAvg - firstAvg) / firstAvg) * 100;
    trends.changeRate = changeRate;

    // Determinar dirección
    if (changeRate > 10) {
      trends.direction = 'increasing';
    } else if (changeRate < -10) {
      trends.direction = 'decreasing';
    } else {
      trends.direction = 'stable';
    }

    // Predicción simple
    const lastValue = dataPoints[dataPoints.length - 1];
    trends.prediction = lastValue * (1 + changeRate / 100);
    trends.confidence = Math.min(0.9, dataPoints.length / 20);

    return trends;
  }

  /**
   * Genera alertas predictivas
   * @param {Object} predictions - Predicciones del sistema
   * @returns {Array} Alertas predictivas
   */
  function generatePredictiveAlerts(predictions) {
    const alerts = [];

    if (!predictions) return alerts;

    // Alerta de predicción de errores
    if (predictions.errorPrediction && predictions.errorPrediction.likelihood > 0.5) {
      alerts.push({
        type: 'error_prediction',
        severity: predictions.errorPrediction.likelihood > 0.7 ? 'high' : 'medium',
        message: `Probabilidad ${(predictions.errorPrediction.likelihood * 100).toFixed(0)}% de errores en ${predictions.errorPrediction.timeFrame}`,
        recommendations: predictions.errorPrediction.recommendations
      });
    }

    // Alerta de anomalías
    if (predictions.anomalies && predictions.anomalies.detected.length > 0) {
      alerts.push({
        type: 'anomaly',
        severity: predictions.anomalies.severity,
        message: `${predictions.anomalies.detected.length} anomalías detectadas`,
        details: predictions.anomalies.detected,
        actions: predictions.anomalies.actions
      });
    }

    // Alerta de rendimiento
    if (predictions.performance && predictions.performance.score < 70) {
      alerts.push({
        type: 'performance',
        severity: predictions.performance.score < 50 ? 'high' : 'medium',
        message: `Rendimiento del sistema: ${predictions.performance.status} (${predictions.performance.score.toFixed(0)}/100)`,
        factors: predictions.performance.factors
      });
    }

    return alerts;
  }

  /**
   * Ejecuta análisis predictivo completo
   * @param {Object} systemData - Datos del sistema
   * @returns {Object} Análisis predictivo completo
   */
  function runPredictiveAnalysis(systemData) {
    const analysis = {
      timestamp: Date.now(),
      errorPrediction: null,
      usagePatterns: null,
      anomalies: null,
      recommendations: null,
      performance: null,
      parameters: null,
      trends: null,
      alerts: []
    };

    if (!systemData) return analysis;

    // Predicción de errores
    if (systemData.errorHistory) {
      analysis.errorPrediction = predictErrors(systemData.errorHistory);
    }

    // Patrones de uso
    if (systemData.usageData) {
      analysis.usagePatterns = analyzeUsagePatterns(systemData.usageData);
    }

    // Detección de anomalías
    if (systemData.currentMetrics && systemData.baselineMetrics) {
      analysis.anomalies = detectAnomalies(systemData.currentMetrics, systemData.baselineMetrics);
    }

    // Recomendaciones inteligentes
    if (systemData.currentState) {
      analysis.recommendations = generateSmartRecommendations(systemData.currentState);
    }

    // Análisis de rendimiento
    if (systemData.currentMetrics) {
      analysis.performance = analyzeRealTimePerformance(systemData.currentMetrics);
    }

    // Auto-configuración de parámetros
    if (systemData.currentState) {
      analysis.parameters = autoConfigureParameters(systemData.currentState);
    }

    // Análisis de tendencias
    if (systemData.trendData) {
      analysis.trends = analyzeTrends(systemData.trendData);
    }

    // Generar alertas predictivas
    analysis.alerts = generatePredictiveAlerts(analysis);

    // Guardar en historial
    predictionHistory.push(analysis);
    if (predictionHistory.length > 100) {
      predictionHistory = predictionHistory.slice(-100);
    }

    return analysis;
  }

  /**
   * Obtiene historial de predicciones
   * @returns {Array} Historial de predicciones
   */
  function getPredictionHistory() {
    return predictionHistory;
  }

  /**
   * Configura umbrales de detección
   * @param {Object} newThresholds - Nuevos umbrales
   */
  function setThresholds(newThresholds) {
    thresholds = { ...thresholds, ...newThresholds };
  }

  /**
   * Obtiene umbrales actuales
   * @returns {Object} Umbrales actuales
   */
  function getThresholds() {
    return { ...thresholds };
  }

  return {
    predictErrors,
    analyzeUsagePatterns,
    detectAnomalies,
    generateSmartRecommendations,
    analyzeRealTimePerformance,
    autoConfigureParameters,
    analyzeTrends,
    generatePredictiveAlerts,
    runPredictiveAnalysis,
    getPredictionHistory,
    setThresholds,
    getThresholds
  };
})();

// Exponer el módulo globalmente
window.AIPredictor = AIPredictor;