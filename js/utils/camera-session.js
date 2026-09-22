/**
 * CONTROL PERSONAL CAMPO — utils/camera-session.js
 * Cámara compartida para los flujos legacy.
 * Centraliza el acceso físico: una vista nunca debe dejar tracks activos al
 * cambiar de lente, cerrar el modal o abandonar la página.
 * @version 1.6.0
 */
(() => {
  'use strict';

  /**
   * Obtiene el objeto mediaDevices del navegador
   * @returns {MediaDevices|null} Objeto mediaDevices o null si no está disponible
   */
  const getMediaDevices = () =>
    typeof navigator !== 'undefined' ? navigator.mediaDevices : null;

  /**
   * Verifica el soporte de cámaras en el entorno actual
   * @returns {Object} { supported: boolean, secure: boolean }
   */
  function getSupport() {
    const protocol = typeof location === 'undefined' ? '' : location.protocol;
    const secure = protocol === 'https:' || protocol === 'capacitor:' || protocol === 'http:';
    const mediaDevices = getMediaDevices();
    return {
      supported: Boolean(secure && mediaDevices && typeof mediaDevices.getUserMedia === 'function'),
      secure,
    };
  }

  /**
   * Detiene todos los tracks de un stream de video
   * @param {MediaStream} stream - Stream de video a detener
   * @returns {void}
   */
  function stopTracks(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach((track) => {
      try { track.stop(); } catch (_) { /* Track ya detenido. */ }
    });
  }

  /**
   * Detiene el stream de un elemento de video
   * @param {HTMLVideoElement} videoElement - Elemento de video
   * @returns {void}
   */
  function stopStream(videoElement) {
    if (!videoElement) return;
    stopTracks(videoElement.srcObject);
    videoElement.srcObject = null;
  }

  /**
   * Construye candidatos de configuración para getUserMedia
   * @param {Object} options - Opciones de configuración
   * @param {string} options.deviceId - ID del dispositivo específico
   * @param {string} options.facingMode - Modo de cámara ('environment' o 'user')
   * @param {number} options.width - Ancho deseado
   * @param {number} options.height - Alto deseado
   * @returns {Array} Array de candidatos de configuración
   */
  function buildCandidates({ deviceId, facingMode = 'environment', width, height } = {}) {
    const dimensions = {};
    if (width) dimensions.width = { ideal: width };
    if (height) dimensions.height = { ideal: height };
    const candidates = [];
    if (deviceId) candidates.push({ video: { deviceId: { exact: deviceId }, ...dimensions }, audio: false });
    if (facingMode) candidates.push({ video: { facingMode: { ideal: facingMode }, ...dimensions }, audio: false });
    candidates.push({ video: Object.keys(dimensions).length ? dimensions : true, audio: false });
    return candidates;
  }

  /**
   * Determina si se puede usar fallback ante un error
   * @param {Error} error - Error a evaluar
   * @returns {boolean} true si se puede usar fallback
   */
  function canFallback(error) {
    return ['OverconstrainedError', 'NotFoundError', 'DevicesNotFoundError'].includes(error && error.name);
  }

  /**
   * Inicia un stream de video con las opciones especificadas
   * @param {Object} options - Opciones de configuración
   * @returns {Promise<MediaStream>} Stream de video iniciado
   */
  async function startStream(options = {}) {
    const support = getSupport();
    if (!support.supported) {
      const error = new Error(describeError({ name: support.secure ? 'NotSupportedError' : 'SecurityError' }));
      error.name = support.secure ? 'NotSupportedError' : 'SecurityError';
      throw error;
    }

    const candidates = buildCandidates(options);
    let lastError;
    for (let index = 0; index < candidates.length; index += 1) {
      try {
        const stream = await getMediaDevices().getUserMedia(candidates[index]);
        return { stream, constraints: candidates[index] };
      } catch (error) {
        lastError = error;
        if (!canFallback(error) || index === candidates.length - 1) throw error;
      }
    }
    throw lastError;
  }

  async function listDevices() {
    const mediaDevices = getMediaDevices();
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') return [];
    const devices = await mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Cámara ${index + 1}`,
      }));
  }

  function describeError(error) {
    switch (error && error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'El permiso de cámara fue denegado. Habilítalo en la configuración del navegador y vuelve a intentarlo.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No se encontró una cámara disponible. Conecta una cámara o usa otro dispositivo.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'La cámara está en uso por otra aplicación. Ciérrala e inténtalo de nuevo.';
      case 'SecurityError':
        return 'La cámara requiere una conexión segura. Abre la aplicación mediante HTTPS o la aplicación instalada.';
      case 'NotSupportedError':
        return 'Este navegador no admite acceso a la cámara. Usa una versión actual de Chrome, Edge o Safari.';
      default:
        return 'No se pudo iniciar la cámara. Selecciona otra cámara o vuelve a intentarlo.';
    }
  }

  function qrCandidates({ deviceId, facingMode = 'environment' } = {}) {
    const candidates = [];
    // html5-qrcode SOLO acepta facingMode como string o { exact: ... };
    // un objeto { ideal } lanza "'facingMode' should be string or object
    // with exact as key" y rompe el arranque de la cámara en escritorio.
    if (deviceId) candidates.push(deviceId);
    if (facingMode) {
      candidates.push({ facingMode });
      candidates.push({ facingMode: facingMode === 'environment' ? 'user' : 'environment' });
    }
    candidates.push({ facingMode: 'environment' });
    return candidates.filter((candidate, index, all) =>
      index === all.findIndex((item) => JSON.stringify(item) === JSON.stringify(candidate)),
    );
  }

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
   * INTRÍNSECAS del <video> (naturalWidth × naturalHeight, típicamente 640×480
   * o 1280×720) y usa el valor devuelto como recorte del frame que envía al
   * decodificador.  Calcular el qrbox a partir del ancho/alto CSS del
   * contenedor (p. ej. 430×200) produce un recorte demasiado pequeño en el
   * frame real y el QR nunca se lee (el histórico "220 px" era insuficiente).
   *
   * El recorte es cuadrado y ocupa `ratio` del lado menor del frame, de modo que
   * un QR que ocupe hasta ese porcentaje del encuadre siempre entra completo.
   *
   * @param {Object|number} [base] - Opciones del recorte
   * @param {number} [base.ratio]  - Fracción del lado menor (0 < ratio ≤ 1)
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
   * Compatibilidad: devuelve un qrbox estático (sin dimensiones de vídeo).
   * @deprecated Usar buildQrboxFn para aprovechar las dimensiones intrínsecas
   *   del vídeo.  Se mantiene para código que espere un objeto explícito.
   * @param {HTMLElement} _el - Contenedor del escáner (ya no se usa)
   * @param {Object|number} [base] - Opciones del recorte
   * @returns {Object} qrbox(videoWidth, videoHeight) => {width, height}
   */
  function safeQrBox(_el, base) {
    return buildQrboxFn(base)(0, 0);
  }

  function createQrController({ Scanner, elementId, onSuccess, onError, config = {} }) {
    let scanner = null;
    let active = false;
    let operation = 0;
    let selectedCamera = null;
    let torchEnabled = false;

    async function dispose(instance) {
      if (!instance) return;
      try { await instance.stop(); } catch (_) { /* No llegó a iniciar. */ }
      try { instance.clear && instance.clear(); } catch (_) { /* DOM ya limpiado. */ }
    }

    async function start(options = {}) {
      const token = ++operation;
      await dispose(scanner);
      scanner = null;
      active = false;
      const candidates = qrCandidates(options);
      // El qrbox se pasa como función: html5-qrcode lo evalúa con las dimensiones
      // intrínsecas del vídeo real, por lo que el recorte siempre es proporcional
      // al frame y no al ancho/alto CSS del contenedor.
      const qrbox = buildQrboxFn(config.qrbox);
      const scanConfig = { fps: 10, aspectRatio: 1, disableFlip: false, ...config, qrbox };
      let lastError;

      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const instance = new Scanner(elementId);
        try {
          await instance.start(
            candidate,
            scanConfig,
            onSuccess,
            onError || (() => {}),
          );
          if (token !== operation) {
            await dispose(instance);
            return null;
          }
          scanner = instance;
          active = true;
          selectedCamera = typeof candidate === 'string' ? candidate : null;
          return { scanner, camera: candidate };
        } catch (error) {
          lastError = error;
          await dispose(instance);
          if (!canFallback(error) || index === candidates.length - 1) throw error;
        }
      }
      throw lastError;
    }

    async function stop() {
      operation += 1;
      await dispose(scanner);
      scanner = null;
      active = false;
      torchEnabled = false;
    }

    function supportsTorch() {
      if (!active || !scanner) return false;
      try {
        const capabilities = scanner.getRunningTrackCapabilities && scanner.getRunningTrackCapabilities();
        return Boolean(capabilities && capabilities.torch);
      } catch (_) {
        return false;
      }
    }

    async function toggleTorch() {
      if (!supportsTorch() || !scanner || !scanner.applyVideoConstraints) return false;
      torchEnabled = !torchEnabled;
      await scanner.applyVideoConstraints({ advanced: [{ torch: torchEnabled }] });
      return torchEnabled;
    }

    return {
      start,
      stop,
      supportsTorch,
      toggleTorch,
      isActive: () => active,
      getSelectedCamera: () => selectedCamera,
    };
  }

  window.CPC = window.CPC || {};
  window.CPC.CameraSession = {
    getSupport,
    stopTracks,
    stopStream,
    buildCandidates,
    startStream,
    listDevices,
    listCameras: listDevices,
    describeError,
    createQrController,
    buildQrboxFn,
    safeQrBox,
  };
})();
