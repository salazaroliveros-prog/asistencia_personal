/**
 * CONTROL PERSONAL CAMPO — utils/mobile-qr-scanner.js
 * Sistema de escaneo QR optimizado específicamente para dispositivos móviles
 * Maneja rendimiento, orientación, flash y capacidades específicas de móviles
 * @version 1.5.0
 */

const _MobileQRScanner = (() => {
  let scanner = null;
  let active = false;
  let selectedCamera = null;
  let torchEnabled = false;
  let performanceMode = 'balanced'; // 'low', 'balanced', 'high'

  /**
   * Configuración de rendimiento según modo
   * @param {string} mode - Modo de rendimiento
   * @returns {Object} Configuración de escaneo
   */
  function getPerformanceConfig(mode) {
    const configs = {
      low: {
        fps: 5,
        qrbox: { width: 200, height: 200 },
        aspectRatio: 1,
        disableFlip: false,
        maxScansPerSecond: 1,
      },
      balanced: {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
        disableFlip: false,
        maxScansPerSecond: 2,
      },
      high: {
        fps: 15,
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1,
        disableFlip: false,
        maxScansPerSecond: 5,
      },
    };
    return configs[mode] || configs.balanced;
  }

  /**
   * Configuración de escaneo optimizada para móvil
   * @param {Object} options - Opciones adicionales
   * @returns {Object} Configuración optimizada
   */
  function getMobileOptimizedConfig(options = {}) {
    const deviceType = window.MobileCameraOptimizer?.getDeviceType() || 'other';
    const orientation = window.MobileCameraOptimizer?.getOrientation() || 'portrait';
    
    const baseConfig = getPerformanceConfig(performanceMode);
    
    // Optimizaciones específicas por dispositivo
    if (deviceType === 'ios') {
      // iOS: Reducir FPS para mejor rendimiento
      baseConfig.fps = Math.min(baseConfig.fps, 10);
      baseConfig.qrbox = { width: 280, height: 280 };
    } else if (deviceType === 'android') {
      // Android: Mayor rango de FPS
      baseConfig.fps = Math.min(baseConfig.fps, 15);
    }

    // Ajustar según orientación
    if (orientation === 'landscape') {
      baseConfig.qrbox = { width: 350, height: 350 };
    }

    return {
      ...baseConfig,
      ...options,
    };
  }

  /**
   * Inicia el escáner QR con configuración móvil optimizada
   * @param {Object} params - Parámetros de inicialización
   * @param {string} params.elementId - ID del elemento HTML
   * @param {Function} params.onSuccess - Callback al detectar QR
   * @param {Function} params.onError - Callback al ocurrir error
   * @param {Object} params.cameraOptions - Opciones de cámara
   * @returns {Promise<Object>} Resultado de inicialización
   */
  async function start(params) {
    const { elementId, onSuccess, onError, cameraOptions = {} } = params;

    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('Html5Qrcode no está disponible');
    }

    // Solicitar permisos si no se han otorgado
    const permissions = await window.MobileCameraOptimizer?.requestCameraPermissions();
    if (!permissions.granted) {
      throw new Error(permissions.error?.message || 'Permisos de cámara no otorgados');
    }

    // Obtener configuración móvil optimizada
    const mobileConstraints = window.MobileCameraOptimizer?.getMobileOptimizedConstraints(cameraOptions) || {
      video: { facingMode: 'environment' },
    };

    const scanConfig = getMobileOptimizedConfig(cameraOptions);

    try {
      // Crear instancia del escáner
      scanner = new Html5Qrcode(elementId);

      // Optimizar elemento de video
      const videoElement = document.getElementById(elementId);
      if (videoElement) {
        window.MobileCameraOptimizer?.optimizeVideoElement(videoElement);
      }

      // Iniciar escaneo
      await scanner.start(
        mobileConstraints,
        scanConfig,
        (decodedText, decodedResult) => {
          // Vibrate en móvil si está disponible
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
          onSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
          if (onError) onError(errorMessage);
        },
      );

      active = true;
      selectedCamera = mobileConstraints.video?.facingMode || 'environment';

      return {
        success: true,
        camera: selectedCamera,
        config: scanConfig,
      };
    } catch (error) {
      active = false;
      if (scanner) {
        try {
          await scanner.stop();
        } catch (_) {
          // El escáner nunca llegó a iniciarse, ignorar error
        }
        scanner = null;
      }
      throw error;
    }
  }

  /**
   * Detiene el escáner QR
   * @returns {Promise<void>}
   */
  async function stop() {
    if (!scanner || !active) return;

    try {
      await scanner.stop();
    } catch (error) {
      console.warn('[MobileQRScanner] Error al detener escáner:', error);
    }

    try {
      scanner.clear();
    } catch (error) {
      console.warn('[MobileQRScanner] Error al limpiar escáner:', error);
    }

    scanner = null;
    active = false;
    selectedCamera = null;
    torchEnabled = false;
  }

  /**
   * Cambia entre cámaras frontal y trasera
   * @returns {Promise<Object>} Resultado del cambio
   */
  async function switchCamera() {
    if (!active) {
      throw new Error('El escáner no está activo');
    }

    const currentFacingMode = selectedCamera;
    const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

    await stop();

    try {
      await start({
        elementId: scanner?._elementId,
        onSuccess: () => {},
        cameraOptions: { facingMode: newFacingMode },
      });

      return {
        success: true,
        camera: newFacingMode,
        previousCamera: currentFacingMode,
      };
    } catch (error) {
      // Intentar revertir si falla
      try {
        await start({
          elementId: scanner?._elementId,
          onSuccess: () => {},
          cameraOptions: { facingMode: currentFacingMode },
        });
      } catch (_) {
        // Revertir falló, continuar con el error original
      }
      throw error;
    }
  }

  /**
   * Verifica si el dispositivo soporta flash/torch
   * @returns {boolean} true si soporta torch
   */
  function supportsTorch() {
    if (!active || !scanner) return false;

    try {
      const capabilities = scanner.getRunningTrackCapabilities?.();
      return Boolean(capabilities && capabilities.torch);
    } catch (error) {
      return false;
    }
  }

  /**
   * Activa/desactiva el flash de la cámara
   * @returns {Promise<boolean>} Estado del flash después del cambio
   */
  async function toggleTorch() {
    if (!supportsTorch() || !scanner) {
      return false;
    }

    try {
      torchEnabled = !torchEnabled;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: torchEnabled }],
      });
      return torchEnabled;
    } catch (error) {
      console.warn('[MobileQRScanner] Error al cambiar torch:', error);
      torchEnabled = false;
      return false;
    }
  }

  /**
   * Cambia el modo de rendimiento
   * @param {string} mode - Nuevo modo de rendimiento
   * @returns {Promise<Object>} Resultado del cambio
   */
  async function setPerformanceMode(mode) {
    if (!['low', 'balanced', 'high'].includes(mode)) {
      throw new Error('Modo de rendimiento inválido');
    }

    const previousMode = performanceMode;
    performanceMode = mode;

    if (active) {
      const elementId = scanner?._elementId;
      await stop();
      
      try {
        await start({
          elementId,
          onSuccess: () => {},
          cameraOptions: { facingMode: selectedCamera },
        });

        return {
          success: true,
          previousMode,
          currentMode: mode,
        };
      } catch (error) {
        // Revertir si falla
        performanceMode = previousMode;
        try {
          await start({
            elementId,
            onSuccess: () => {},
            cameraOptions: { facingMode: selectedCamera },
          });
        } catch (_) {
          // Revertir falló, continuar con el error original
        }
        throw error;
      }
    }

    return {
      success: true,
      previousMode,
      currentMode: mode,
    };
  }

  /**
   * Lista las cámaras disponibles en el dispositivo
   * @returns {Promise<Array>} Lista de cámaras
   */
  async function listCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          id: device.deviceId,
          label: device.label || `Cámara ${index + 1}`,
          groupId: device.groupId,
        }));
    } catch (error) {
      console.warn('[MobileQRScanner] Error al enumerar cámaras:', error);
      return [];
    }
  }

  /**
   * Selecciona una cámara específica por ID
   * @param {string} deviceId - ID de la cámara
   * @returns {Promise<Object>} Resultado de la selección
   */
  async function selectCamera(deviceId) {
    if (!active) {
      throw new Error('El escáner no está activo');
    }

    const elementId = scanner?._elementId;
    await stop();

    await start({
      elementId,
      onSuccess: () => {},
      cameraOptions: { deviceId },
    });

    selectedCamera = deviceId;
    return {
      success: true,
      camera: deviceId,
    };
  }

  /**
   * Obtiene el estado actual del escáner
   * @returns {Object} Estado del escáner
   */
  function getStatus() {
    return {
      active,
      selectedCamera,
      torchEnabled,
      performanceMode,
      supportsTorch: supportsTorch(),
    };
  }

  /**
   * Genera sugerencias de optimización para el dispositivo
   * @returns {Array} Sugerencias de optimización
   */
  function getOptimizationSuggestions() {
    const suggestions = [];
    const deviceInfo = window.MobileCameraOptimizer?.getDeviceInfo() || {};
    const status = getStatus();

    if (deviceInfo.isMobile) {
      if (deviceInfo.pixelRatio > 2) {
        suggestions.push('Dispositivo con alta densidad de píxeles. Considera usar modo de rendimiento "low" para mejor batería.');
      }

      if (deviceInfo.memory && deviceInfo.memory < 4) {
        suggestions.push('Dispositivo con memoria limitada. Usa modo de rendimiento "low" para mejor estabilidad.');
      }

      if (deviceInfo.deviceType === 'ios') {
        suggestions.push('iOS: Usa facingMode "environment" para mejor calidad de cámara trasera.');
      }

      if (deviceInfo.deviceType === 'android') {
        suggestions.push('Android: Verifica que el permiso de cámara esté otorgado en configuración del sistema.');
      }
    }

    if (status.active && !status.supportsTorch) {
      suggestions.push('El dispositivo no soporta flash. Asegura buena iluminación para escaneo QR.');
    }

    if (performanceMode === 'high') {
      suggestions.push('Modo de rendimiento "high" consume más batería. Considera "balanced" para uso prolongado.');
    }

    return suggestions;
  }

  return {
    start,
    stop,
    switchCamera,
    supportsTorch,
    toggleTorch,
    setPerformanceMode,
    listCameras,
    selectCamera,
    getStatus,
    getOptimizationSuggestions,
  };
})();

// Exponer el módulo globalmente
window.MobileQRScanner = _MobileQRScanner;