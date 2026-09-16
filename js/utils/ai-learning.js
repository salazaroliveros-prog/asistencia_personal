/**
 * CONTROL PERSONAL CAMPO — utils/ai-learning.js
 * Sistema de aprendizaje avanzado con adaptación dinámica
 * @version 1.5.0
 */

const AILearning = (() => {
  let learningData = {
    patterns: [],
    rules: [],
    adaptations: [],
    performance: [],
    userBehaviors: []
  };

  let modelState = {
    accuracy: 0.5,
    confidence: 0.5,
    adaptationRate: 0.1,
    lastTraining: null
  };

  /**
   * Aprende de patrones de errores recurrentes
   * @param {Array} errorPatterns - Patrones de errores detectados
   * @returns {Object} Reglas aprendidas
   */
  function learnFromErrorPatterns(errorPatterns) {
    const learnedRules = [];

    if (!Array.isArray(errorPatterns)) return learnedRules;

    errorPatterns.forEach(pattern => {
      if (pattern.frequency >= 3) {
        const rule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'prevention',
          trigger: pattern.type,
          condition: pattern.condition,
          action: determinePreventiveAction(pattern),
          confidence: Math.min(0.95, 0.5 + (pattern.frequency * 0.1)),
          createdAt: Date.now(),
          applied: 0,
          successRate: 0
        };

        learnedRules.push(rule);
        learningData.rules.push(rule);
      }
    });

    return learnedRules;
  }

  /**
   * Determina acción preventiva basada en patrón
   * @param {Object} pattern - Patrón de error
   * @returns {string} Acción preventiva
   */
  function determinePreventiveAction(pattern) {
    const actions = {
      'camera': 'reduceCameraQuality',
      'gps': 'increaseGPSTimeout',
      'network': 'activateOfflineMode',
      'storage': 'clearCache',
      'memory': 'reduceMemoryUsage',
      'firebase': 'retryWithBackoff',
      'scanner': 'adjustScannerSensitivity'
    };

    return actions[pattern.type] || 'logAndMonitor';
  }

  /**
   * Aprende de comportamiento del usuario
   * @param {Object} userBehavior - Datos de comportamiento del usuario
   * @returns {Object} Patrones aprendidos
   */
  function learnFromUserBehavior(userBehavior) {
    const patterns = [];

    if (!userBehavior) return patterns;

    // Detectar patrones de uso horario
    if (userBehavior.activeHours) {
      const peakHours = userBehavior.activeHours.filter(hour => hour.count > userBehavior.avgActivity * 1.5);
      if (peakHours.length > 0) {
        patterns.push({
          type: 'usage_timing',
          pattern: 'peak_hours',
          data: peakHours.map(h => h.hour),
          recommendation: 'Optimizar recursos para horarios pico'
        });
      }
    }

    // Detectar patrones de acción frecuente
    if (userBehavior.frequentActions) {
      const topActions = userBehavior.frequentActions.slice(0, 3);
      patterns.push({
        type: 'action_preference',
        pattern: 'frequent_actions',
        data: topActions.map(a => a.action),
        recommendation: 'Priorizar funcionalidades más usadas'
      });
    }

    // Detectar patrones de error por contexto
    if (userBehavior.contextErrors) {
      const errorContexts = Object.entries(userBehavior.contextErrors)
        .filter(([_, count]) => count > 2)
        .map(([context, count]) => ({ context, count }));

      if (errorContexts.length > 0) {
        patterns.push({
          type: 'error_context',
          pattern: 'contextual_errors',
          data: errorContexts,
          recommendation: 'Prevenir errores en contextos específicos'
        });
      }
    }

    learningData.userBehaviors.push(...patterns);
    return patterns;
  }

  /**
   * Adapta comportamiento del sistema basado en aprendizaje
   * @param {Object} adaptationContext - Contexto de adaptación
   * @returns {Object} Adaptaciones aplicadas
   */
  function adaptSystemBehavior(adaptationContext) {
    const adaptations = [];

    if (!adaptationContext) return adaptations;

    // Adaptar rendimiento según historial
    if (adaptationContext.performanceHistory) {
      const avgPerformance = adaptationContext.performanceHistory
        .slice(-10)
        .reduce((a, b) => a + b.score, 0) / 10;

      if (avgPerformance < 60) {
        adaptations.push({
          type: 'performance',
          action: 'reducePerformanceMode',
          target: 'low',
          reason: 'Rendimiento promedio bajo'
        });
      } else if (avgPerformance > 85) {
        adaptations.push({
          type: 'performance',
          action: 'increasePerformanceMode',
          target: 'high',
          reason: 'Rendimiento promedio alto'
        });
      }
    }

    // Adaptar configuración de cámara según éxito
    if (adaptationContext.cameraSuccessRate) {
      if (adaptationContext.cameraSuccessRate < 0.7) {
        adaptations.push({
          type: 'camera',
          action: 'adjustCameraSettings',
          target: 'more_permissive',
          reason: 'Tasa de éxito de cámara baja'
        });
      }
    }

    // Adaptar sincronización según latencia
    if (adaptationContext.networkLatency) {
      if (adaptationContext.networkLatency > 3000) {
        adaptations.push({
          type: 'sync',
          action: 'increaseSyncInterval',
          target: 60000,
          reason: 'Latencia de red alta'
        });
      } else if (adaptationContext.networkLatency < 500) {
        adaptations.push({
          type: 'sync',
          action: 'decreaseSyncInterval',
          target: 15000,
          reason: 'Latencia de red baja'
        });
      }
    }

    learningData.adaptations.push(...adaptations);
    return adaptations;
  }

  /**
   * Evalúa efectividad de reglas aprendidas
   * @param {string} ruleId - ID de la regla
   * @param {boolean} success - Resultado de la aplicación
   * @returns {Object} Efectividad de la regla
   */
  function evaluateRuleEffectiveness(ruleId, success) {
    const rule = learningData.rules.find(r => r.id === ruleId);
    if (!rule) return null;

    rule.applied++;
    if (success) {
      rule.successRate = (rule.successRate * (rule.applied - 1) + 1) / rule.applied;
    } else {
      rule.successRate = (rule.successRate * (rule.applied - 1)) / rule.applied;
    }

    // Actualizar precisión del modelo
    updateModelAccuracy();

    return {
      ruleId,
      applied: rule.applied,
      successRate: rule.successRate,
      effectiveness: rule.successRate > 0.7 ? 'high' : rule.successRate > 0.5 ? 'medium' : 'low'
    };
  }

  /**
   * Actualiza precisión del modelo
   */
  function updateModelAccuracy() {
    if (learningData.rules.length === 0) return;

    const avgSuccessRate = learningData.rules
      .reduce((sum, rule) => sum + rule.successRate, 0) / learningData.rules.length;

    modelState.accuracy = avgSuccessRate;
    modelState.confidence = Math.min(0.95, avgSuccessRate + 0.1);
  }

  /**
   * Entrena el modelo con nuevos datos
   * @param {Object} trainingData - Datos de entrenamiento
   * @returns {Object} Resultado del entrenamiento
   */
  function trainModel(trainingData) {
    const result = {
      previousAccuracy: modelState.accuracy,
      newAccuracy: modelState.accuracy,
      improvements: [],
      timestamp: Date.now()
    };

    if (!trainingData) return result;

    // Aprender de patrones de errores
    if (trainingData.errorPatterns) {
      const learnedRules = learnFromErrorPatterns(trainingData.errorPatterns);
      result.improvements.push({
        type: 'error_prevention',
        count: learnedRules.length
      });
    }

    // Aprender de comportamiento del usuario
    if (trainingData.userBehavior) {
      const learnedPatterns = learnFromUserBehavior(trainingData.userBehavior);
      result.improvements.push({
        type: 'user_behavior',
        count: learnedPatterns.length
      });
    }

    // Adaptar comportamiento del sistema
    if (trainingData.adaptationContext) {
      const adaptations = adaptSystemBehavior(trainingData.adaptationContext);
      result.improvements.push({
        type: 'system_adaptation',
        count: adaptations.length
      });
    }

    // Actualizar modelo
    updateModelAccuracy();
    result.newAccuracy = modelState.accuracy;
    modelState.lastTraining = Date.now();

    return result;
  }

  /**
   * Genera recomendaciones basadas en aprendizaje
   * @returns {Array} Recomendaciones aprendidas
   */
  function generateLearnedRecommendations() {
    const recommendations = [];

    // Recomendaciones basadas en reglas efectivas
    const effectiveRules = learningData.rules
      .filter(rule => rule.successRate > 0.7 && rule.applied >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    effectiveRules.forEach(rule => {
      recommendations.push({
        type: 'proven_rule',
        action: rule.action,
        trigger: rule.trigger,
        confidence: rule.successRate,
        description: `Aplicar ${rule.action} cuando se detecte ${rule.trigger}`
      });
    });

    // Recomendaciones basadas en patrones de usuario
    learningData.userBehaviors.forEach(pattern => {
      if (pattern.recommendation) {
        recommendations.push({
          type: 'user_pattern',
          action: pattern.recommendation,
          confidence: 0.8,
          description: pattern.recommendation
        });
      }
    });

    return recommendations;
  }

  /**
   * Optimiza hiperparámetros del sistema
   * @param {Object} currentParams - Parámetros actuales
   * @param {Object} performanceMetrics - Métricas de rendimiento
   * @returns {Object} Parámetros optimizados
   */
  function optimizeHyperparameters(currentParams, performanceMetrics) {
    const optimizedParams = { ...currentParams };

    if (!performanceMetrics) return optimizedParams;

    // Optimizar tasa de aprendizaje
    if (performanceMetrics.accuracy < 0.7) {
      modelState.adaptationRate = Math.min(0.3, modelState.adaptationRate * 1.2);
    } else if (performanceMetrics.accuracy > 0.9) {
      modelState.adaptationRate = Math.max(0.05, modelState.adaptationRate * 0.8);
    }

    // Optimizar parámetros de rendimiento
    if (performanceMetrics.memoryPressure > 0.8) {
      optimizedParams.scanFPS = Math.max(5, optimizedParams.scanFPS - 2);
      optimizedParams.performanceMode = 'low';
    } else if (performanceMetrics.memoryPressure < 0.5) {
      optimizedParams.scanFPS = Math.min(15, optimizedParams.scanFPS + 2);
      optimizedParams.performanceMode = optimizedParams.scanFPS > 12 ? 'high' : 'balanced';
    }

    return optimizedParams;
  }

  /**
   * Realiza análisis de importancia de características
   * @param {Object} featureData - Datos de características
   * @returns {Object} Importancia de características
   */
  function analyzeFeatureImportance(featureData) {
    const importance = {};

    if (!featureData) return importance;

    // Analizar impacto de cada característica en el rendimiento
    Object.entries(featureData).forEach(([feature, data]) => {
      if (data.impact !== undefined) {
        importance[feature] = {
          score: data.impact,
          trend: data.trend || 'stable',
          recommendation: data.impact > 0.7 ? 'maintain' : data.impact < 0.3 ? 'optimize' : 'monitor'
        };
      }
    });

    return importance;
  }

  /**
   * Genera insights del sistema
   * @returns {Object} Insights generados
   */
  function generateSystemInsights() {
    const insights = {
      modelHealth: {
        accuracy: modelState.accuracy,
        confidence: modelState.confidence,
        adaptationRate: modelState.adaptationRate,
        lastTraining: modelState.lastTraining
      },
      rulePerformance: learningData.rules.map(rule => ({
        id: rule.id,
        type: rule.type,
        successRate: rule.successRate,
        applied: rule.applied
      })),
      adaptationHistory: learningData.adaptations.slice(-10),
      userPatterns: learningData.userBehaviors.slice(-10),
      recommendations: generateLearnedRecommendations()
    };

    return insights;
  }

  /**
   * Reinicia el modelo de aprendizaje
   */
  function resetModel() {
    learningData = {
      patterns: [],
      rules: [],
      adaptations: [],
      performance: [],
      userBehaviors: []
    };

    modelState = {
      accuracy: 0.5,
      confidence: 0.5,
      adaptationRate: 0.1,
      lastTraining: null
    };
  }

  /**
   * Exporta datos de aprendizaje
   * @returns {Object} Datos de aprendizaje
   */
  function exportLearningData() {
    return {
      learningData,
      modelState,
      exportedAt: Date.now()
    };
  }

  /**
   * Importa datos de aprendizaje
   * @param {Object} data - Datos de aprendizaje
   */
  function importLearningData(data) {
    if (data.learningData) {
      learningData = data.learningData;
    }
    if (data.modelState) {
      modelState = data.modelState;
    }
  }

  return {
    learnFromErrorPatterns,
    learnFromUserBehavior,
    adaptSystemBehavior,
    evaluateRuleEffectiveness,
    trainModel,
    generateLearnedRecommendations,
    optimizeHyperparameters,
    analyzeFeatureImportance,
    generateSystemInsights,
    resetModel,
    exportLearningData,
    importLearningData,
    getModelState: () => ({ ...modelState }),
    getLearningData: () => ({ ...learningData })
  };
})();

// Exponer el módulo globalmente
window.AILearning = AILearning;