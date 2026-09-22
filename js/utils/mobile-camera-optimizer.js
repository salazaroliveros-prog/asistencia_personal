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
   * Solicita permisos de cámara específicos para móvil
   * @returns {Promise<Object>} Estado de permisos
   */
  async function requestCameraPermissions() {
    const deviceType = getDeviceType();
    const permissions = {
      granted: false,
      error: null,
      needsManualAction: false,
    };

    try {
      if (deviceType === 'ios') {
        // iOS requiere contexto de usuario explícito
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
        });
        stream.getTracks().forEach((track) => track.stop());
        permissions.granted = true;
      } else if (deviceType === 'android') {
        // Android permite solicitud directa
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
        });
        stream.getTracks().forEach((track) => track.stop());
        permissions.granted = true;
      } else {
        // Otros dispositivos
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
        });
        stream.getTracks().forEach((track) => track.stop());
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
      cores: navigator.hardwareConcurrency,
    };
  }

  return {
    isMobile,
    getDeviceType,
    getOrientation,
    requestCameraPermissions,
    optimizeVideoElement,
    getDeviceInfo,
  };
})();

// Exponer el módulo globalmente
window.MobileCameraOptimizer = MobileCameraOptimizer;