/**
 * CONTROL PERSONAL CAMPO — utils/qr-generator.js
 * Helper para generación y renderizado de códigos QR usando QRCode.js
 * @version 1.0.0
 */

const QRGenerator = (() => {

  /**
   * Genera un código QR en un contenedor DOM.
   * @param {HTMLElement|string} container - Elemento o ID del contenedor
   * @param {string} data - Datos a codificar
   * @param {object} options - Opciones de tamaño y color
   * @returns {QRCode|null}
   */
  function render(container, data, options = {}) {
    if (typeof window.QRCode === 'undefined') {
      console.error('[QRGenerator] QRCode.js no está cargado.');
      return null;
    }

    const el = typeof container === 'string'
      ? document.getElementById(container)
      : container;

    if (!el) {
      console.error('[QRGenerator] Contenedor no encontrado:', container);
      return null;
    }

    // Limpiar contenido previo
    el.innerHTML = '';

    const opts = {
      text:          data,
      width:         options.size  || 160,
      height:        options.size  || 160,
      colorDark:     options.dark  || '#003459',
      colorLight:    options.light || '#FFFFFF',
      correctLevel:  QRCode.CorrectLevel.H,  // Alta corrección para carnés
    };

    try {
      const qrInstance = new QRCode(el, opts);
      return qrInstance;
    } catch (err) {
      console.error('[QRGenerator] Error al generar QR:', err);
      return null;
    }
  }

  /**
   * Genera un QR para un trabajador y retorna la imagen en Base64.
   * @param {object} trabajador - Datos del trabajador
   * @param {number} size - Tamaño en px
   * @returns {Promise<string>} DataURL de la imagen PNG
   */
  function generarQRParaTrabajador(trabajador, size = 160) {
    return new Promise((resolve, reject) => {
      if (typeof window.QRCode === 'undefined') {
        reject(new Error('QRCode.js no está disponible'));
        return;
      }

      const qrData = JSON.stringify({
        id:  trabajador.ID_Trabajador || trabajador.id,
        dpi: trabajador.DPI_CUI || trabajador.dpi,
      });

      // Crear contenedor temporal fuera del DOM
      const tmpDiv = document.createElement('div');
      tmpDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:' + size + 'px;height:' + size + 'px;';
      document.body.appendChild(tmpDiv);

      try {
        const qr = new QRCode(tmpDiv, {
          text:         qrData,
          width:        size,
          height:       size,
          colorDark:    '#003459',
          colorLight:   '#FFFFFF',
          correctLevel: QRCode.CorrectLevel.M,
        });

        // QRCode.js genera el canvas de forma síncrona
        setTimeout(() => {
          const canvas = tmpDiv.querySelector('canvas');
          if (canvas) {
            resolve(canvas.toDataURL('image/png'));
          } else {
            // Fallback: usar img tag
            const img = tmpDiv.querySelector('img');
            if (img && img.src) {
              resolve(img.src);
            } else {
              reject(new Error('No se pudo obtener el canvas del QR'));
            }
          }
          document.body.removeChild(tmpDiv);
        }, 150);

      } catch (err) {
        document.body.removeChild(tmpDiv);
        reject(err);
      }
    });
  }

  /**
   * Renderiza el QR del carné en el modal.
   * @param {object} trabajador - Datos del trabajador
   */
  function renderCarneQR(trabajador) {
    const container = document.getElementById('carne-qr-container');
    if (!container) return;

    // Usar solo id y dpi para minimizar el tamaño del dato QR
    // El nombre completo puede sobrepasar el límite de caracteres del QR nivel H
    const qrData = JSON.stringify({
      id:  trabajador.ID_Trabajador,
      dpi: trabajador.DPI_CUI,
    });

    container.innerHTML = '';

    if (typeof window.QRCode === 'undefined') {
      container.innerHTML = '<p style="color:#666;font-size:11px;text-align:center">QR no disponible</p>';
      return;
    }

    try {
      // Nivel M soporta hasta 1269 chars (vs 800 del nivel H)
      new QRCode(container, {
        text:         qrData,
        width:        130,
        height:       130,
        colorDark:    '#003459',
        colorLight:   '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M,
      });

      // Ocultar la <img> de fallback, dejar visible el <canvas>
      const img = container.querySelector('img');
      if (img) img.style.display = 'none';

    } catch (err) {
      console.error('[QRGenerator] Error generando QR:', err);
      container.innerHTML = '<p style="color:#666;font-size:11px;text-align:center">Error al generar QR</p>';
    }
  }

  /**
   * Parsear el contenido escaneado de un QR de trabajador.
   * @param {string} rawText - Texto crudo del QR
   * @returns {object|null} Datos del QR o null si es inválido
   */
  function parseQRData(rawText) {
    if (!rawText) return null;

    try {
      const data = JSON.parse(rawText);
      // Validar que tenga los campos esperados
      if (data.id && (data.dpi || data.nombre)) {
        return data;
      }
    } catch {
      // Podría ser solo el ID directamente
      if (typeof rawText === 'string' && rawText.startsWith('TRAB-')) {
        return { id: rawText };
      }
    }

    return null;
  }

  /**
   * Buscar trabajador por datos del QR escaneado.
   * @param {object} qrData - Datos parseados del QR
   * @returns {object|null} Trabajador encontrado o null
   */
  function buscarTrabajadorPorQR(qrData) {
    const personal = AppState.get('personal') || [];

    // Buscar por ID primero
    let trabajador = personal.find(p => p.ID_Trabajador === qrData.id);

    // Si no, buscar por DPI
    if (!trabajador && qrData.dpi) {
      trabajador = personal.find(p => p.DPI_CUI === qrData.dpi);
    }

    return trabajador || null;
  }

  return {
    render,
    generarQRParaTrabajador,
    renderCarneQR,
    parseQRData,
    buscarTrabajadorPorQR,
  };
})();
