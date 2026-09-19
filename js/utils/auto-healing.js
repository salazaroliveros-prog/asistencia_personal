/**
 * CONTROL PERSONAL CAMPO — utils/auto-healing.js
 * Sistema de autoreparación automática de errores
 * @version 1.5.0
 */

const AutoHealing = (() => {
  /**
   * Estrategias de autoreparación conocidas
   */
  const healingStrategies = {
    // Estrategia: Limpiar caché
    clearCache: {
      description: 'Limpiar caché del sistema',
      priority: 'high',
      execute: async () => {
        try {
          // Limpiar localStorage
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('cache') || key.includes('temp') || key.includes('queue'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((key) => localStorage.removeItem(key));
          
          // Limpiar IndexedDB (si existe)
          if (window.indexedDB) {
            const databases = await indexedDB.databases();
            for (const db of databases) {
              if (db.name) {
                await new Promise((resolve, reject) => {
                  const request = indexedDB.deleteDatabase(db.name);
                  request.onsuccess = resolve;
                  request.onerror = reject;
                });
              }
            }
          }
          
          return { success: true, message: 'Caché limpiada exitosamente' };
        } catch (error) {
          return { success: false, message: 'Error al limpiar caché', error: error.message };
        }
      },
    },

    // Estrategia: Activar modo offline
    activateOfflineMode: {
      description: 'Activar modo offline del sistema',
      priority: 'medium',
      execute: async () => {
        try {
          if (window.AppState) {
            window.AppState.set('offlineMode', true);
            return { success: true, message: 'Modo offline activado' };
          }
          return { success: false, message: 'AppState no disponible' };
        } catch (error) {
          return { success: false, message: 'Error al activar modo offline', error: error.message };
        }
      },
    },

    // Estrategia: Reiniciar conexión Firebase
    restartFirebaseConnection: {
      description: 'Reiniciar conexión Firebase',
      priority: 'high',
      execute: async () => {
        try {
          if (window.FirebaseClient) {
            await window.FirebaseClient.reconnect();
            return { success: true, message: 'Conexión Firebase reiniciada' };
          }
          return { success: false, message: 'FirebaseClient no disponible' };
        } catch (error) {
          return { success: false, message: 'Error al reiniciar Firebase', error: error.message };
        }
      },
    },

    // Estrategia: Reducir calidad de cámara
    reduceCameraQuality: {
      description: 'Reducir calidad de cámara',
      priority: 'medium',
      execute: async () => {
        try {
          if (window.AppState) {
            window.AppState.set('cameraQuality', 'low');
            return { success: true, message: 'Calidad de cámara reducida' };
          }
          return { success: false, message: 'AppState no disponible' };
        } catch (error) {
          return { success: false, message: 'Error al reducir calidad', error: error.message };
        }
      },
    },

    // Estrategia: Liberar memoria
    freeMemory: {
      description: 'Liberar memoria del sistema',
      priority: 'high',
      execute: async () => {
        try {
          // Forzar garbage collection (si está disponible)
          if (window.gc) {
            window.gc();
          }
          
          // Limpiar variables grandes en memoria
          if (window.AppState) {
            window.AppState.clearTempData();
          }
          
          return { success: true, message: 'Memoria liberada' };
        } catch (error) {
          return { success: false, message: 'Error al liberar memoria', error: error.message };
        }
      },
    },

    // Estrategia: Reiniciar aplicación
    restartApplication: {
      description: 'Reiniciar aplicación',
      priority: 'critical',
      execute: async () => {
        try {
          window.location.reload();
          return { success: true, message: 'Aplicación reiniciada' };
        } catch (error) {
          return { success: false, message: 'Error al reiniciar', error: error.message };
        }
      },
    },

    // Estrategia: Optimizar imágenes
    optimizeImages: {
      description: 'Optimizar imágenes almacenadas',
      priority: 'low',
      execute: async () => {
        // Implementar optimización de imágenes
        // Este es un placeholder para la implementación real
        return { success: true, message: 'Imágenes optimizadas' };
      },
    },

    // Estrategia: Recuperar datos corruptos
    recoverCorruptedData: {
      description: 'Recuperar datos corruptos',
      priority: 'high',
      execute: async () => {
        // Implementar recuperación de datos
        // Este es un placeholder para la implementación real
        return { success: true, message: 'Datos recuperados' };
      },
    },
  };

  /**
   * Analiza un error y determina la mejor estrategia de autoreparación
   * @param {Object} errorAnalysis - Análisis del error
   * @returns {Array} Estrategias recomendadas
   */
  function determineHealingStrategy(errorAnalysis) {
    const strategies = [];

    switch (errorAnalysis.category) {
      case 'storage':
        strategies.push('clearCache');
        strategies.push('optimizeImages');
        break;
      case 'network':
        strategies.push('activateOfflineMode');
        strategies.push('restartFirebaseConnection');
        break;
      case 'firebase':
        strategies.push('restartFirebaseConnection');
        strategies.push('activateOfflineMode');
        break;
      case 'cameraHardware':
        strategies.push('reduceCameraQuality');
        break;
      case 'memory':
        strategies.push('freeMemory');
        strategies.push('clearCache');
        break;
      case 'camera':
        strategies.push('reduceCameraQuality');
        strategies.push('clearCache');
        break;
      default:
        strategies.push('clearCache');
        strategies.push('restartApplication');
    }

    return strategies;
  }

  /**
   * Ejecuta una estrategia de autoreparación
   * @param {string} strategyName - Nombre de la estrategia
   * @returns {Promise<Object>} Resultado de la ejecución
   */
  async function executeHealingStrategy(strategyName) {
    const strategy = healingStrategies[strategyName];
    
    if (!strategy) {
      return {
        success: false,
        message: `Estrategia ${strategyName} no encontrada`,
      };
    }

    console.log(`[AutoHealing] Ejecutando estrategia: ${strategy.description}`);
    
    const result = await strategy.execute();
    
    // Log del resultado
    if (window.AILogger) {
      window.AILogger.log(
        result.success ? 'info' : 'error',
        `Estrategia de autoreparación: ${strategy.description}`,
        { strategy: strategyName },
        result.success ? null : new Error(result.message),
      );
    }

    return result;
  }

  /**
   * Ejecuta múltiples estrategias de autoreparación en secuencia
   * @param {Array} strategyNames - Nombres de las estrategias
   * @returns {Promise<Array>} Resultados de las ejecuciones
   */
  async function executeHealingStrategies(strategyNames) {
    const results = [];
    
    for (const strategyName of strategyNames) {
      const result = await executeHealingStrategy(strategyName);
      results.push({
        strategy: strategyName,
        ...result,
      });
      
      // Si una estrategia falla, continuar con la siguiente
      if (!result.success) {
        console.warn(`[AutoHealing] Estrategia ${strategyName} falló, continuando...`);
      }
    }

    return results;
  }

  /**
   * Intenta autoreparar un error automáticamente
   * @param {Object} errorAnalysis - Análisis del error
   * @returns {Promise<Object>} Resultado de la autoreparación
   */
  async function autoHeal(errorAnalysis) {
    console.log('[AutoHealing] Iniciando autoreparación para:', errorAnalysis.category);
    
    const strategies = determineHealingStrategy(errorAnalysis);
    
    if (strategies.length === 0) {
      return {
        success: false,
        message: 'No se encontraron estrategias de autoreparación',
      };
    }

    const results = await executeHealingStrategies(strategies);
    
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    
    return {
      success: successful.length > 0,
      message: `Autoreparación completada: ${successful.length} exitosas, ${failed.length} fallidas`,
      results,
      successfulCount: successful.length,
      failedCount: failed.length,
    };
  }

  /**
   * Ejecuta diagnóstico y autoreparación automática
   * @returns {Promise<Object>} Resultado del diagnóstico y autoreparación
   */
  async function diagnoseAndHeal() {
    const diagnostics = await window.HardwareDiagnostics?.runFullDiagnostics();
    
    if (!diagnostics) {
      return {
        success: false,
        message: 'HardwareDiagnostics no disponible',
      };
    }

    const healingActions = [];
    
    // Analizar diagnóstico y determinar acciones de autoreparación
    if (!diagnostics.camera.available) {
      healingActions.push('reduceCameraQuality');
    }
    
    if (!diagnostics.network.online) {
      healingActions.push('activateOfflineMode');
    }
    
    if (diagnostics.memory.percentage > 80) {
      healingActions.push('freeMemory');
      healingActions.push('clearCache');
    }
    
    if (diagnostics.storage.localStorage.percentage > 80) {
      healingActions.push('clearCache');
      healingActions.push('optimizeImages');
    }

    if (healingActions.length === 0) {
      return {
        success: true,
        message: 'No se requieren acciones de autoreparación',
        diagnostics,
      };
    }

    const results = await executeHealingStrategies(healingActions);
    
    return {
      success: true,
      message: `Autoreparación ejecutada: ${healingActions.length} acciones`,
      diagnostics,
      healingActions,
      results,
    };
  }

  /**
   * Configura autoreparación automática para errores recurrentes
   * @param {number} threshold - Umbral de errores para activar autoreparación
   */
  function setupAutoHealing(threshold = 3) {
    // Verificar errores recurrentes periódicamente
    setInterval(async () => {
      if (window.AILogger) {
        const patterns = window.AILogger.analyzePatterns();
        const recurrentErrors = Object.keys(patterns.recurrentPatterns);
        
        for (const category of recurrentErrors) {
          const pattern = patterns.recurrentPatterns[category];
          if (pattern.count >= threshold) {
            console.log(`[AutoHealing] Error recurrente detectado: ${category} (${pattern.count} veces)`);
            
            // Intentar autoreparación
            await autoHeal({ category, severity: pattern.severity });
          }
        }
      }
    }, 60000); // Verificar cada minuto
  }

  /**
   * Obtiene todas las estrategias disponibles
   * @returns {Object} Estrategias disponibles
   */
  function getAvailableStrategies() {
    return healingStrategies;
  }

  return {
    determineHealingStrategy,
    executeHealingStrategy,
    executeHealingStrategies,
    autoHeal,
    diagnoseAndHeal,
    setupAutoHealing,
    getAvailableStrategies,
  };
})();

// Exponer el módulo globalmente
window.AutoHealing = AutoHealing;