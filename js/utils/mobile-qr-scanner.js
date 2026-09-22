/**
 * CONTROL PERSONAL CAMPO — utils/mobile-qr-scanner.js
 * Sistema de escaneo QR optimizado específicamente para dispositivos móviles
 * Maneja rendimiento, orientación, flash y capacidades específicas de móviles
 * @version 1.6.0
 */

const _MobileQRScanner = (() => {
  let scanner = null;
  let active = false;
  let selectedCamera = null;
  let torchEnabled = false;
  // Persistir contexto de la sesión activa para switchCamera
  let activeElementId = null;
  let activeOnSuccess = null;
  let activeOnError = null;

  /**
   * Fracción por defecto del lado menor del frame que ocupa el recorte.
   * Un QR que ocupe hasta este porcentaje del encuadre entra completo.
   */
  const DEFAULT_QRBOX_RATIO = 0.7;

  /**
   * Lado de respaldo cuando todavía no hay dimensiones de vídeo (node/vm o
   * cámara aún no iniciada).  Sólo aplica a las pruebas con stub.
   */
  const DEFAULT_QRBOX_FALLBACK = 320;

  /** Mínimo de lado que exige html5-qrcode (MIN_QR_BOX_SIZE). */
  const MIN_QR_BOX = 50;

  /**
   * Construye el qrbox como función para html5-qrcode.
   *
   * html5-qrcode admite `qrbox` como función; la invoca con las dimensiones
   * INTRÍNSECAS del video (naturalWidth x naturalHeight) y usa el valor devuelto
   * como recorte del frame que envía al decodificador.  Calcular el qrbox a
   * partir del ancho/alto CSS del contenedor produce un recorte demasiado
   * pequeño en el frame real y el QR nunca se lee.
   *
   * El recorte es cuadrado y ocupa `ratio` del lado menor del frame, de modo que
   * un QR que ocupe hasta ese porcentaje del encuadre siempre entra completo.
   *
   * @param {Object|number} [base] - Opciones del recorte
   * @param {number} [base.ratio]  - Fracción del lado menor (0 < ratio <= 1)
   * @param {number} [base.width]  - Lado de respaldo si aún no hay vídeo
   * @param {number} [base.height] - Alto de respaldo si aún no hay vídeo
   * @returns {Function} qrbox(videoWidth, videoHeight) => {width, height}
   */


  function buildQrboxFn(base) {
    const ratio = base?.ratio > 0 && base.ratio <= 1 ? base.ratio : DEFAULT_QRBOX_RATIO;
    const respaldo = typeof base === 'number' ? base : base?.width || base?.height || 0;

    return function (surfaceWidth, surfaceHeight) {
      // Sin dimensiones reales (entorno node/vm o vídeo no cargado todavía).
      if (!surfaceWidth || !surfaceHeight) {
        const lado = respaldo || DEFAULT_QRBOX_FALLBACK;
        return { width: lado, height: lado };
      }

      // html5-qrcode llama al qrbox con el tamaño CSS del <video> y luego escala
      // el recorte a píxeles del frame con videoWidth/clientWidth.  Por eso la
      // fracción se aplica al lado menor de la superficie: equivale a "este
      // porcentaje del frame visible" y mantiene la escala uniforme.
      const lado = Math.max(MIN_QR_BOX, Math.round(Math.min(surfaceWidth, surfaceHeight) * ratio));
      return { width: lado, height: lado };
    };
  }

  /**
   * Normaliza las opciones de cámara a un destino válido para html5-qrcode.
   *
   * `Html5Qrcode.start()` NO acepta un `MediaStreamConstraints` completo
   * ({ video, audio }): su `createVideoConstraints()` exige un objeto con
   * EXACTAMENTE 1 clave (`facingMode` o `deviceId`) o un string con el
   * deviceId. Al pasarle `{ video: {...}, audio: false }` lanzaba
   * "'cameraIdOrConfig' object should have exactly 1 key, if passed as an
   * object, found 2 keys" — un string, no un Error — por lo que la cámara
   * nunca arrancaba y la UI solo alcanzaba a mostrar "Cámara no disponible".
   *
   * @param {Object} cameraOptions - Opciones recibidas ({ facingMode, deviceId })
   * @returns {Object} Destino válido ({ facingMode } o { deviceId })
   */
  function toScannerTarget(cameraOptions = {}) {
    const { facingMode, deviceId } = cameraOptions || {};
    if (typeof deviceId === 'string' && deviceId) return { deviceId };
    if (typeof facingMode === 'string' && facingMode) return { facingMode };
    return { facingMode: 'environment' };
  }

  /**
   * Verifica que un candidato sea aceptable por html5-qrcode
   * (string con deviceId, o objeto de 1 sola clave facingMode/deviceId).
   * @param {string|Object} candidate - Candidato a validar
   * @returns {boolean} true si es un destino válido
   */
  function isValidScannerTarget(candidate) {
    if (typeof candidate === 'string') return candidate.length > 0;
    if (!candidate || typeof candidate !== 'object') return false;
    const keys = Object.keys(candidate);
    return keys.length === 1 && (keys[0] === 'facingMode' || keys[0] === 'deviceId');
  }

  /**
   * Construye la lista de cámaras a intentar (principal + respaldo).
   * Si la cámara trasera no existe/está ocupada, se prueba la frontal y
   * viceversa, de modo que el escaneo funcione en cualquier dispositivo.
   * @param {Object} cameraOptions - Opciones de cámara solicitadas
   * @returns {Array<Object>} Candidatos válidos y sin duplicados
   */
  function buildScannerTargets(cameraOptions = {}) {
    const primary = toScannerTarget(cameraOptions);
    const alternate = primary.facingMode === 'environment'
      ? { facingMode: 'user' }
      : { facingMode: 'environment' };
    return [primary, alternate].filter((candidate, index, all) =>
      isValidScannerTarget(candidate)
      && index === all.findIndex((item) => JSON.stringify(item) === JSON.stringify(candidate)),
    );
  }

  /**
   * Indica si tras un error conviene probar la siguiente cámara candidata.
   * No se reintenta cuando el usuario denegó el permiso o el contexto no es
   * seguro: en esos casos el fallo es del entorno y no de la lente elegida.
   * @param {Error|string} error - Error lanzado por html5-qrcode
   * @returns {boolean} true si se debe probar otra cámara
   */
  function canTryNextCamera(error) {
    const name = (error && error.name) || '';
    return !['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name);
  }

  /**
   * Configuración de rendimiento según modo
   * @param {string} mode - Modo de rendimiento
   * @returns {Object} Configuración de escaneo
   */
  function getPerformanceConfig(mode) {
    // `qrboxRatio` es la fracción del lado menor del frame de vídeo que ocupa el
    // recorte del decodificador.  Un valor pequeño deja fuera el QR cuando el
    // operario acerca el carnet (el QR ocupa gran parte del encuadre), por lo que
    // los tres modos usan recortes amplios y sólo se ajusta el FPS.
    const configs = {
      low: {
        fps: 5,
        qrboxRatio: 0.65,
        aspectRatio: 1,
        disableFlip: false,
        maxScansPerSecond: 1,
      },
      balanced: {
        fps: 10,
        qrboxRatio: 0.7,
        aspectRatio: 1,
        disableFlip: false,
        maxScansPerSecond: 2,
      },
      high: {
        fps: 15,
        qrboxRatio: 0.8,
        aspectRatio: 1,
        disableFlip: false,
        maxScansPerSecond: 5,
      },
    };
    return { ...(configs[mode] || configs.balanced) };
  }

  /**
   * Configuración de escaneo optimizada para móvil
   * @param {Object} options - Opciones adicionales
   * @returns {Object} Configuración optimizada
   */
  function getMobileOptimizedConfig(options = {}) {
    const deviceType = window.MobileCameraOptimizer?.getDeviceType() || 'other';
    const orientation = window.MobileCameraOptimizer?.getOrientation() || 'portrait';

    const baseConfig = getPerformanceConfig('balanced');

    // Optimizaciones específicas por dispositivo
    if (deviceType === 'ios') {
      // iOS: Reducir FPS para mejor rendimiento
      baseConfig.fps = Math.min(baseConfig.fps, 10);
      baseConfig.qrboxRatio = Math.max(baseConfig.qrboxRatio, 0.7);
    } else if (deviceType === 'android') {
      // Android: Mayor rango de FPS
      baseConfig.fps = Math.min(baseConfig.fps, 15);
    }

    // En horizontal el frame es más ancho, así que el recorte puede ser mayor.
    if (orientation === 'landscape') {
      baseConfig.qrboxRatio = Math.max(baseConfig.qrboxRatio, 0.8);
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
    if (permissions && !permissions.granted) {
      throw new Error(permissions.error?.message || 'Permisos de cámara no otorgados');
    }

    const scanConfig = getMobileOptimizedConfig(cameraOptions);
    // El qrbox se pasa como función: html5-qrcode la invoca con el tamaño CSS
    // del <video> ya montado y luego escala el recorte a los píxeles del frame
    // (videoWidth/clientWidth), así que el recorte es siempre proporcional al
    // encuadre real y no al contenedor medido antes de arrancar la cámara.
    scanConfig.qrbox = buildQrboxFn({ ratio: scanConfig.qrboxRatio });

    // html5-qrcode exige un destino de 1 sola clave; nunca se le pasa el
    // MediaStreamConstraints completo (ver toScannerTarget).
    const targets = buildScannerTargets(cameraOptions);
    let lastError = null;

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const instance = new Html5Qrcode(elementId);

      try {
        await instance.start(
          target,
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

        // Registro de la sesión activa (necesario para switchCamera/selectCamera)
        scanner = instance;
        active = true;
        activeElementId = elementId;
        activeOnSuccess = onSuccess;
        activeOnError = onError || null;
        selectedCamera = target.facingMode || target.deviceId || 'environment';

        // Optimizar el <video> que html5-qrcode montó dentro del contenedor
        // (antes se le pasaba el contenedor, así que playsInline/objectFit no
        // llegaban nunca al elemento real).
        const videoElement = document
          .getElementById(elementId)
          ?.querySelector('video');
        if (videoElement) {
          window.MobileCameraOptimizer?.optimizeVideoElement(videoElement);
        }

        return {
          success: true,
          scanner,
          camera: selectedCamera,
          config: scanConfig,
        };
      } catch (error) {
        lastError = error;
        // Limpiar la instancia fallida antes de probar la siguiente cámara
        try {
          await instance.stop();
        } catch (_) {
          // El escáner nunca llegó a iniciarse, ignorar error
        }
        try {
          instance.clear();
        } catch (_) {
          // DOM ya limpio, ignorar
        }
        scanner = null;
        active = false;
        activeElementId = null;
        activeOnSuccess = null;
        activeOnError = null;

        if (!canTryNextCamera(error) || index === targets.length - 1) throw error;
      }
    }

    throw lastError || new Error('No se pudo iniciar la cámara');
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
    activeElementId = null;
    activeOnSuccess = null;
    activeOnError = null;
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

    // Conservar el contexto de la sesión activa (elemento y callbacks)
    const elementId = activeElementId;
    const onSuccess = activeOnSuccess;
    const onError = activeOnError;
    if (!elementId) {
      throw new Error('No hay elemento de escáner activo');
    }

    await stop();

    try {
      await start({
        elementId,
        onSuccess,
        onError,
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
          elementId,
          onSuccess,
          onError,
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

  return {
    start,
    stop,
    switchCamera,
    supportsTorch,
    toggleTorch,
    listCameras,
    // Utilidades expuestas para pruebas y para el escáner de escritorio.
    buildQrboxFn,
    getPerformanceConfig,
    getMobileOptimizedConfig,
  };
})();

// Exponer el módulo globalmente
window.MobileQRScanner = _MobileQRScanner;