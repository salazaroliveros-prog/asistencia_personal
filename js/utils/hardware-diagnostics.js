/**
 * CONTROL PERSONAL CAMPO — utils/hardware-diagnostics.js
 * Sistema de diagnóstico de hardware para detección de problemas
 * @version 1.5.0
 */

const HardwareDiagnostics = (() => {
  /**
   * Verifica disponibilidad de cámara
   * @returns {Promise<Object>} Estado de la cámara
   */
  async function checkCameraAvailability() {
    const result = {
      available: false,
      facingMode: null,
      resolution: null,
      error: null,
      suggestions: []
    };

    try {
      // Verificar si getUserMedia está disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        result.error = 'getUserMedia no está disponible en este navegador';
        result.suggestions.push('Usar un navegador moderno (Chrome, Firefox, Safari)');
        result.suggestions.push('Verificar que el sitio usa HTTPS');
        return result;
      }

      // Solicitar permisos de cámara
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      result.available = true;
      
      // Obtener información de la cámara
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      result.facingMode = settings.facingMode;
      result.resolution = {
        width: settings.width,
        height: settings.height
      };
      
      // Detener stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      result.error = error.name;
      
      // Analizar error y generar sugerencias
      switch (error.name) {
        case 'NotAllowedError':
          result.suggestions.push('Permisos de cámara denegados');
          result.suggestions.push('Verificar configuración de permisos del navegador');
          result.suggestions.push('Permitir acceso a cámara en configuración del sitio');
          break;
        case 'NotFoundError':
          result.suggestions.push('No se encontró cámara en el dispositivo');
          result.suggestions.push('Verificar que el dispositivo tiene cámara');
          result.suggestions.push('Intentar usar cámara externa si está disponible');
          break;
        case 'NotReadableError':
          result.suggestions.push('La cámara no es accesible');
          result.suggestions.push('Otra aplicación puede estar usando la cámara');
          result.suggestions.push('Cerrar otras aplicaciones que usen cámara');
          result.suggestions.push('Reiniciar dispositivo');
          break;
        case 'OverconstrainedError':
          result.suggestions.push('La configuración solicitada no es compatible');
          result.suggestions.push('Reducir resolución solicitada');
          result.suggestions.push('Intentar diferentes modos de cámara');
          break;
        default:
          result.suggestions.push('Error desconocido de cámara');
          result.suggestions.push('Reiniciar aplicación');
          result.suggestions.push('Verificar conectividad USB de cámara externa');
      }
    }

    return result;
  }

  /**
   * Verifica disponibilidad de GPS
   * @returns {Promise<Object>} Estado del GPS
   */
  async function checkGPSAvailability() {
    const result = {
      available: false,
      accuracy: null,
      error: null,
      suggestions: []
    };

    try {
      // Verificar si geolocation está disponible
      if (!navigator.geolocation) {
        result.error = 'Geolocation no está disponible en este navegador';
        result.suggestions.push('Usar un navegador moderno con soporte de geolocalización');
        result.suggestions.push('Verificar que el sitio usa HTTPS');
        return result;
      }

      // Solicitar ubicación
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      result.available = true;
      result.accuracy = position.coords.accuracy;
      
    } catch (error) {
      result.error = error.code;
      
      // Analizar error y generar sugerencias
      switch (error.code) {
        case error.PERMISSION_DENIED:
          result.suggestions.push('Permisos de ubicación denegados');
          result.suggestions.push('Verificar configuración de permisos del navegador');
          result.suggestions.push('Permitir acceso a ubicación en configuración del sitio');
          break;
        case error.POSITION_UNAVAILABLE:
          result.suggestions.push('Ubicación no disponible');
          result.suggestions.push('Verificar que el GPS está habilitado en el dispositivo');
          result.suggestions.push('Conectarse a una red para mejorar GPS');
          result.suggestions.push('Salir de interiores para mejor señal GPS');
          break;
        case error.TIMEOUT:
          result.suggestions.push('Timeout al obtener ubicación');
          result.suggestions.push('Verificar conexión a internet');
          result.suggestions.push('Aumentar timeout de geolocalización');
          result.suggestions.push('Intentar nuevamente');
          break;
        default:
          result.suggestions.push('Error desconocido de GPS');
          result.suggestions.push('Reiniciar aplicación');
          result.suggestions.push('Verificar conexión de red');
      }
    }

    return result;
  }

  /**
   * Verifica disponibilidad de red
   * @returns {Object} Estado de la red
   */
  function checkNetworkAvailability() {
    const result = {
      online: navigator.onLine,
      connectionType: null,
      effectiveType: null,
      downlink: null,
      rtt: null,
      suggestions: []
    };

    // Verificar API de Network Information
    if (navigator.connection) {
      result.connectionType = navigator.connection.type;
      result.effectiveType = navigator.connection.effectiveType;
      result.downlink = navigator.connection.downlink;
      result.rtt = navigator.connection.rtt;
    }

    // Generar sugerencias basadas en estado
    if (!result.online) {
      result.suggestions.push('No hay conexión a internet');
      result.suggestions.push('Verificar conexión WiFi o datos móviles');
      result.suggestions.push('Activar modo offline del sistema');
    } else if (result.effectiveType === 'slow-2g' || result.effectiveType === '2g') {
      result.suggestions.push('Conexión muy lenta detectada');
      result.suggestions.push('Considerar usar WiFi para mejor experiencia');
      result.suggestions.push('Reducir uso de datos de imágenes');
      result.suggestions.push('Activar modo de bajo consumo de datos');
    } else if (result.effectiveType === '3g') {
      result.suggestions.push('Conexión moderadamente lenta');
      result.suggestions.push('Optimizar imágenes para mejor rendimiento');
    }

    return result;
  }

  /**
   * Verifica estado de memoria del sistema
   * @returns {Object} Estado de memoria
   */
  function checkMemoryStatus() {
    const result = {
      available: false,
      used: null,
      total: null,
      limit: null,
      percentage: null,
      suggestions: []
    };

    // Verificar API de Performance Memory
    if (performance.memory) {
      result.available = true;
      result.used = performance.memory.usedJSHeapSize;
      result.total = performance.memory.totalJSHeapSize;
      result.limit = performance.memory.jsHeapSizeLimit;
      result.percentage = (result.used / result.limit * 100).toFixed(2);

      // Generar sugerencias
      if (result.percentage > 80) {
        result.suggestions.push('Memoria del sistema casi llena');
        result.suggestions.push('Cerrar otras aplicaciones');
        result.suggestions.push('Limpiar caché del navegador');
        result.suggestions.push('Reiniciar dispositivo');
      } else if (result.percentage > 60) {
        result.suggestions.push('Memoria del sistema moderadamente alta');
        result.suggestions.push('Cerrar aplicaciones no utilizadas');
        result.suggestions.push('Limpiar caché del navegador');
      }
    } else {
      result.suggestions.push('API de memoria no disponible en este navegador');
      result.suggestions.push('Usar Chrome o Firefox para mejor monitoreo');
    }

    return result;
  }

  /**
   * Verifica estado de almacenamiento
   * @returns {Promise<Object>} Estado de almacenamiento
   */
  async function checkStorageStatus() {
    const result = {
      localStorage: { used: 0, available: 0, percentage: 0 },
      indexedDB: { used: 0, available: 0, percentage: 0 },
      suggestions: []
    };

    try {
      // Verificar localStorage
      let localStorageSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length;
        }
      }
      result.localStorage.used = localStorageSize;
      result.localStorage.available = 5 * 1024 * 1024 - localStorageSize; // Aprox 5MB
      result.localStorage.percentage = (localStorageSize / (5 * 1024 * 1024) * 100).toFixed(2);

      // Verificar IndexedDB si está disponible
      if (window.indexedDB) {
        const storageEstimate = await navigator.storage.estimate();
        result.indexedDB.used = storageEstimate.usage;
        result.indexedDB.available = storageEstimate.quota - storageEstimate.usage;
        result.indexedDB.percentage = (storageEstimate.usage / storageEstimate.quota * 100).toFixed(2);
      }

      // Generar sugerencias
      if (result.localStorage.percentage > 80) {
        result.suggestions.push('LocalStorage casi lleno');
        result.suggestions.push('Limpiar caché del sistema');
        result.suggestions.push('Eliminar datos antiguos');
        result.suggestions.push('Usar IndexedDB para más almacenamiento');
      }

      if (result.indexedDB.percentage > 80) {
        result.suggestions.push('IndexedDB casi lleno');
        result.suggestions.push('Eliminar datos antiguos');
        result.suggestions.push('Comprimir datos almacenados');
      }

    } catch (error) {
      result.suggestions.push('Error al verificar almacenamiento');
      result.suggestions.push('Limpiar caché del navegador');
    }

    return result;
  }

  /**
   * Ejecuta diagnóstico completo de hardware
   * @returns {Promise<Object>} Diagnóstico completo
   */
  async function runFullDiagnostics() {
    const diagnostics = {
      timestamp: Date.now(),
      camera: await checkCameraAvailability(),
      gps: await checkGPSAvailability(),
      network: checkNetworkAvailability(),
      memory: checkMemoryStatus(),
      storage: await checkStorageStatus(),
      overallHealth: 'unknown'
    };

    // Determinar salud general del sistema
    const criticalIssues = [];
    const warnings = [];

    if (!diagnostics.camera.available) {
      criticalIssues.push('Cámara no disponible');
    }
    if (!diagnostics.gps.available) {
      criticalIssues.push('GPS no disponible');
    }
    if (!diagnostics.network.online) {
      criticalIssues.push('Sin conexión a internet');
    }
    if (diagnostics.memory.percentage > 80) {
      warnings.push('Memoria alta');
    }
    if (diagnostics.storage.localStorage.percentage > 80) {
      warnings.push('Almacenamiento local lleno');
    }

    if (criticalIssues.length > 0) {
      diagnostics.overallHealth = 'critical';
    } else if (warnings.length > 0) {
      diagnostics.overallHealth = 'warning';
    } else {
      diagnostics.overallHealth = 'healthy';
    }

    diagnostics.criticalIssues = criticalIssues;
    diagnostics.warnings = warnings;

    return diagnostics;
  }

  /**
   * Genera reporte de diagnóstico con sugerencias automáticas
   * @returns {Promise<Object>} Reporte de diagnóstico
   */
  async function generateDiagnosticReport() {
    const diagnostics = await runFullDiagnostics();
    
    const report = {
      timestamp: diagnostics.timestamp,
      overallHealth: diagnostics.overallHealth,
      components: {},
      allSuggestions: [],
      autoFixable: [],
      manualFixRequired: []
    };

    // Procesar cada componente
    Object.entries(diagnostics).forEach(([component, data]) => {
      if (typeof data === 'object' && data.suggestions) {
        report.components[component] = {
          status: data.available !== undefined ? (data.available ? 'available' : 'unavailable') : 'checked',
          suggestions: data.suggestions
        };
        
        report.allSuggestions.push(...data.suggestions);
      }
    });

    // Categorizar sugerencias
    report.allSuggestions.forEach(suggestion => {
      if (suggestion.includes('automático') || suggestion.includes('auto')) {
        report.autoFixable.push(suggestion);
      } else {
        report.manualFixRequired.push(suggestion);
      }
    });

    return report;
  }

  return {
    checkCameraAvailability,
    checkGPSAvailability,
    checkNetworkAvailability,
    checkMemoryStatus,
    checkStorageStatus,
    runFullDiagnostics,
    generateDiagnosticReport
  };
})();

// Exponer el módulo globalmente
window.HardwareDiagnostics = HardwareDiagnostics;