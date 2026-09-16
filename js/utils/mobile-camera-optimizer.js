/**
 * CONTROL PERSONAL CAMPO — utils/mobile-camera-optimizer.js
 * Sistema de cámara optimizado específicamente para dispositivos móviles
 * Maneja orientación, resolución, permisos y capacidades específicas de móviles
 * @version 1.5.0
 */

const MobileCameraOptimizer = (() => {
  /**
   * Detecta si el dispositivo es móvil
   * @returns {boolean} true si es móvil
   */
  function isMobile() {
    const ua = navigator.userAgent || '';
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  }

  /**
   * Detecta el tipo de dispositivo móvil
   * @returns {string} Tipo de dispositivo (android, ios, other)
   */
  function getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    return 'other';
  }

  /**
   * Obtiene la orientación actual del dispositivo
   * @returns {string} Orientación (portrait, landscape)
   */
  function getOrientation() {
    if (screen.orientation) {
      return screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
    }
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  /**
   * Obtiene la resolución óptima para el dispositivo móvil
   * @returns {Object} Resolución óptima {width, height}
   */
  function getOptimalResolution() {
    const deviceType = getDeviceType();
    const orientation = getOrientation();
    
    // Resoluciones recomendadas por dispositivo
    const resolutions = {
      android: {
        portrait: { width: 720, height: 1280 },
        landscape: { width: 1280, height: 720 }
      },
      ios: {
        portrait: { width: 1080, height: 1920 },
        landscape: { width: 1920, height: 1080 }
      },
      other: {
        portrait: { width: 640, height: 480 },
        landscape: { width: 800, height: 600 }
      }
    };

    const deviceRes = resolutions[deviceType] || resolutions.other;
    return deviceRes[orientation] || deviceRes.portrait;
  }

  /**
   * Obtiene las capacidades de la cámara móvil
   * @param {MediaStreamTrack} track - Track de video
   * @returns {Promise<Object>} Capacidades de la cámara
   */
  async function getCameraCapabilities(track) {
    try {
      const capabilities = track.getCapabilities();
      return {
        width: capabilities.width,
        height: capabilities.height,
        aspectRatio: capabilities.aspectRatio,
        frameRate: capabilities.frameRate,
        facingMode: capabilities.facingMode,
        torch: capabilities.torch,
        focusMode: capabilities.focusMode,
        exposureMode: capabilities.exposureMode,
        whiteBalanceMode: capabilities.whiteBalanceMode
      };
    } catch (error) {
      console.warn('[MobileCameraOptimizer] No se pueden obtener capacidades:', error);
      return null;
    }
  }

  /**
   * Aplica configuración óptima para móvil
   * @param {MediaStreamTrack} track - Track de video
   * @returns {Promise<boolean>} true si se aplicó exitosamente
   */
  async function applyOptimalSettings(track) {
    try {
      const capabilities = await getCameraCapabilities(track);
      if (!capabilities) return false;

      const constraints = {
        advanced: []
      };

      // Optimizar para móvil: baja latencia
      if (capabilities.frameRate) {
        constraints.advanced.push({ frameRate: { ideal: 30, max: 30 } });
      }

      // Optimizar exposición para ambientes interiores/exteriores
      if (capabilities.exposureMode) {
        constraints.advanced.push({ exposureMode: 'continuous' });
      }

      // Optimizar balance de blancos
      if (capabilities.whiteBalanceMode) {
        constraints.advanced.push({ whiteBalanceMode: 'continuous' });
      }

      // Optimizar enfoque para móviles
      if (capabilities.focusMode) {
        constraints.advanced.push({ focusMode: 'continuous' });
      }

      await track.applyConstraints(constraints);
      return true;
    } catch (error) {
      console.warn('[MobileCameraOptimizer] No se pueden aplicar configuraciones óptimas:', error);
      return false;
    }
  }

  /**
   * Solicita permisos de cámara específicos para móvil
   * @returns {Promise<Object>} Estado de permisos
   */
  async function requestCameraPermissions() {
    const deviceType = getDeviceType();
    const permissions = {
      granted: false,
      error: null,
      needsManualAction: false
    };

    try {
      if (deviceType === 'ios') {
        // iOS requiere contexto de usuario explícito
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        stream.getTracks().forEach(track => track.stop());
        permissions.granted = true;
      } else if (deviceType === 'android') {
        // Android permite solicitud directa
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        stream.getTracks().forEach(track => track.stop());
        permissions.granted = true;
      } else {
        // Otros dispositivos
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        stream.getTracks().forEach(track => track.stop());
        permissions.granted = true;
      }
    } catch (error) {
      permissions.error = error;
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        permissions.needsManualAction = true;
      }
    }

    return permissions;
  }

  /**
   * Genera configuración de getUserMedia optimizada para móvil
   * @param {Object} options - Opciones adicionales
   * @returns {Object} Configuración optimizada
   */
  function getMobileOptimizedConstraints(options = {}) {
    const deviceType = getDeviceType();
    const resolution = getOptimalResolution();
    const orientation = getOrientation();

    const constraints = {
      video: {
        facingMode: options.facingMode || 'environment',
        width: {
          ideal: resolution.width,
          max: resolution.width
        },
        height: {
          ideal: resolution.height,
          max: resolution.height
        }
      },
      audio: false
    };

    // Optimizaciones específicas por dispositivo
    if (deviceType === 'ios') {
      // iOS: Prevenir rotación automática
      constraints.video.aspectRatio = { ideal: orientation === 'portrait' ? 9/16 : 16/9 };
    } else if (deviceType === 'android') {
      // Android: Permitir más flexibilidad
      constraints.video.width = { ideal: resolution.width, min: 640 };
      constraints.video.height = { ideal: resolution.height, min: 480 };
    }

    return constraints;
  }

  /**
   * Optimiza el elemento de video para móvil
   * @param {HTMLVideoElement} videoElement - Elemento de video
   */
  function optimizeVideoElement(videoElement) {
    if (!videoElement) return;

    // Optimizar para móvil
    videoElement.playsInline = true; // iOS: prevenir pantalla completa automática
    videoElement.muted = true; // Prevenir problemas de audio
    videoElement.autoplay = true; // Reproducción automática
    videoElement.objectFit = 'cover'; // Mejor calidad visual

    // Optimizar rendimiento
    videoElement.setAttribute('playsinline', '');
    videoElement.setAttribute('webkit-playsinline', '');
  }

  /**
   * Maneja la rotación del dispositivo
   * @param {HTMLVideoElement} videoElement - Elemento de video
   * @param {MediaStreamTrack} track - Track de video
   */
  function handleDeviceRotation(videoElement, track) {
    if (!videoElement || !track) return;

    // Escuchar cambios de orientación
    screen.orientation.addEventListener('change', async () => {
      try {
        const newOrientation = getOrientation();
        const newResolution = getOptimalResolution();
        
        await track.applyConstraints({
          width: { ideal: newResolution.width },
          height: { ideal: newResolution.height }
        });
      } catch (error) {
        console.warn('[MobileCameraOptimizer] Error al manejar rotación:', error);
      }
    });
  }

  /**
   * Obtiene información del dispositivo móvil
   * @returns {Object} Información del dispositivo
   */
  function getDeviceInfo() {
    return {
      isMobile: isMobile(),
      deviceType: getDeviceType(),
      orientation: getOrientation(),
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio,
      memory: navigator.deviceMemory,
      cores: navigator.hardwareConcurrency
    };
  }

  /**
   * Verifica si el dispositivo soporta características específicas
   * @returns {Object} Características soportadas
   */
  function getSupportedFeatures() {
    return {
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      enumerateDevices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
      orientation: !!screen.orientation,
      vibration: !!navigator.vibrate,
      touch: 'ontouchstart' in window,
      webGL: !!window.WebGLRenderingContext,
      webSocket: !!window.WebSocket,
      serviceWorker: !!navigator.serviceWorker,
      pwa: !!window.matchMedia('(display-mode: standalone)').matches
    };
  }

  /**
   * Genera sugerencias específicas para el dispositivo móvil
   * @returns {Array} Sugerencias de optimización
   */
  function getOptimizationSuggestions() {
    const deviceInfo = getDeviceInfo();
    const features = getSupportedFeatures();
    const suggestions = [];

    if (!features.getUserMedia) {
      suggestions.push('El navegador no soporta acceso a cámara. Usa Chrome, Safari o Edge.');
    }

    if (deviceInfo.deviceType === 'ios' && !features.enumerateDevices) {
      suggestions.push('iOS 11+ requiere HTTPS para acceso a cámara.');
    }

    if (deviceInfo.pixelRatio > 2) {
      suggestions.push('Dispositivo con alta densidad de píxeles. Considera reducir resolución para mejor rendimiento.');
    }

    if (deviceInfo.memory && deviceInfo.memory < 4) {
      suggestions.push('Dispositivo con memoria limitada. Considera reducir calidad de video.');
    }

    if (!features.vibration) {
      suggestions.push('El dispositivo no soporta vibración. Usa audio como feedback.');
    }

    if (!features.serviceWorker) {
      suggestions.push('El navegador no soporta Service Workers. Algunas características offline no estarán disponibles.');
    }

    return suggestions;
  }

  return {
    isMobile,
    getDeviceType,
    getOrientation,
    getOptimalResolution,
    getCameraCapabilities,
    applyOptimalSettings,
    requestCameraPermissions,
    getMobileOptimizedConstraints,
    optimizeVideoElement,
    handleDeviceRotation,
    getDeviceInfo,
    getSupportedFeatures,
    getOptimizationSuggestions
  };
})();

// Exponer el módulo globalmente
window.MobileCameraOptimizer = MobileCameraOptimizer;