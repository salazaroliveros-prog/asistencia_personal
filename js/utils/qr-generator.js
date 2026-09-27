/**
 * CONTROL PERSONAL CAMPO — utils/qr-generator.js
 * Helper para generación y renderizado de códigos QR usando QRCode.js
 * @version 1.5.0
 */

// eslint-disable-next-line no-unused-vars
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
      // qrcodejs dibuja cada módulo con un tamaño ENTERO de píxeles
      // (Math.round(lado / módulos)) y el canvas mide exactamente `lado`. Con
      // { id, dpi } el QR es de 33x33 módulos: 130/33 = 3,94 ⇒ usa 4px por
      // módulo (132px) y RECORTA 2px la última columna/fila, dejando esos
      // módulos a la mitad. Por eso se calcula primero el número de módulos y
      // se dibuja el carné en un tamaño múltiplo exacto (132px para 33
      // módulos): ningún módulo queda cortado y se mantiene 1px CSS = 1px
      // real (sin reescalado borroso).
      let lado = 130;
      try {
        const sonda = new QRCode(document.createElement('div'), {
          text:         qrData,
          width:        130,
          height:       130,
          correctLevel: QRCode.CorrectLevel.M,
        });
        const nucleo = sonda && sonda._oQRCode;
        const modulos = nucleo && typeof nucleo.getModuleCount === 'function' ? nucleo.getModuleCount() : 0;
        if (modulos > 0) {
          const pxPorModulo = Math.max(1, Math.round(130 / modulos));
          lado = modulos * pxPorModulo;
        }
      } catch (_) { /* se conserva el tamaño por defecto */ }

      container.innerHTML = '';

      // Nivel M: con el payload { id, dpi } el QR queda en versión 4 (33x33
      // módulos), así que la capacidad extra del nivel H no aporta nada y sí
      // encarecería el símbolo. Nivel M mantiene buena tolerancia a daños.
      new QRCode(container, {
        text:         qrData,
        width:        lado,
        height:       lado,
        colorDark:    '#003459',
        colorLight:   '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M,
      });

      // qrcodejs inserta SIEMPRE dos nodos: el <canvas> y una <img> de respaldo
      // con el mismo QR (data URL). El CSS
      //   .carne-qr canvas, .carne-qr img { display: block !important; }
      // anula cualquier display:none, así que "ocultar" el respaldo no funcionaba:
      // el carné mostraba DOS códigos QR (en pantalla, en el PNG descargado y en
      // la impresión) y un lector no podía decodificarlos
      // ("No MultiFormat Readers were able to detect the code").
      // Solución: eliminar el respaldo y dejar un único QR (el <canvas>).
      const canvas = container.querySelector('canvas');
      if (canvas) {
        container.querySelectorAll('img').forEach((img) => img.remove());
        canvas.style.setProperty('display', 'block', 'important');
        // El CSS fija 130px !important; se respeta el tamaño exacto calculado
        // para no reescalar el símbolo.
        canvas.style.setProperty('width', lado + 'px', 'important');
        canvas.style.setProperty('height', lado + 'px', 'important');
      }
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
      // El ID es la clave del trabajador: con que venga es suficiente. DPI y
      // nombre son opcionales (hay trabajadores sin DPI importados o de datos
      // antiguos) y exigirlos hacía que el QR de su carné se rechazara aquí con
      // "QR no reconocido" aunque el escáner de campo sí lo leyera.
      if (data && (data.id || data.ID_Trabajador)) {
        const id = data.id || data.ID_Trabajador;
        return { ...data, id };
      }
    } catch {
      // Podría ser solo el ID directamente (formato histórico del sistema o
      // cualquier texto que el escáner de campo también acepte como ID).
      const texto = String(rawText).trim();
      if (texto.startsWith('TRAB-') || /^[A-Z0-9-]{5,}$/.test(texto)) {
        return { id: texto };
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
    let trabajador = personal.find((p) => p.ID_Trabajador === qrData.id);

    // Si no, buscar por DPI
    if (!trabajador && qrData.dpi) {
      trabajador = personal.find((p) => p.DPI_CUI === qrData.dpi);
    }

    return trabajador || null;
  }

  return {
    render,
    renderCarneQR,
    parseQRData,
    buscarTrabajadorPorQR,
  };
})();

if (typeof window !== 'undefined') {
  window.QRGenerator = QRGenerator;
}