/**
 * CONTROL PERSONAL CAMPO — utils/carnet-generator.js
 * Sistema de generación de carnets de trabajadores con QR code
 * @version 1.5.0
 */

const CarnetGenerator = (() => {
  /**
   * Genera QR code para un trabajador
   * @param {Object} trabajador - Datos del trabajador
   * @returns {Promise<string>} Data URL del QR code
   */
  async function generateWorkerQR(trabajador) {
    const qrData = {
      id: trabajador.ID_Trabajador,
      dpi: trabajador.DPI_CUI,
      nombre: trabajador.Nombre_Completo,
      puesto: trabajador.Puesto,
    };

    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined') {
        reject(new Error('QRCode no está disponible'));
        return;
      }

      try {
        const qr = new QRCode(document.createElement('div'), {
          text: JSON.stringify(qrData),
          width: 150,
          height: 150,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H,
        });

        // Esperar a que se genere el QR
        setTimeout(() => {
          const canvas = qr._el.querySelector('canvas');
          if (canvas) {
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('No se pudo generar el QR'));
          }
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera HTML del carnet de trabajador
   * @param {Object} trabajador - Datos del trabajador
   * @param {string} qrDataUrl - Data URL del QR code
   * @returns {string} HTML del carnet
   */
  function generateCarnetHTML(trabajador, qrDataUrl) {
    const fechaEmision = new Date().toLocaleDateString('es-GT');
    const fechaExpiracion = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-GT');

    return `
      <div class="carnet-container" style="
        width: 350px;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 15px;
        font-family: Arial, sans-serif;
        color: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      ">
        <div class="carnet-header" style="
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid rgba(255,255,255,0.3);
          padding-bottom: 15px;
        ">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold;">CONTROL PERSONAL CAMPO</h2>
          <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">CARNET DE IDENTIFICACIÓN</p>
        </div>

        <div class="carnet-body" style="display: flex; gap: 20px;">
          <div class="carnet-photo" style="
            flex-shrink: 0;
            width: 100px;
            height: 120px;
            background: rgba(255,255,255,0.2);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          ">
            ${trabajador.Fotografia_URL ? 
    `<img src="${trabajador.Fotografia_URL}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover;" />` :
    `<div style="font-size: 40px; font-weight: bold;">${trabajador.Nombre_Completo?.charAt(0) || '?'}</div>`
  }
          </div>

          <div class="carnet-info" style="flex: 1; font-size: 11px;">
            <div style="margin-bottom: 8px;">
              <strong style="opacity: 0.8;">Nombre:</strong><br>
              <span style="font-size: 13px; font-weight: bold;">${trabajador.Nombre_Completo || 'N/A'}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="opacity: 0.8;">ID Trabajador:</strong><br>
              <span style="font-size: 13px; font-weight: bold;">${trabajador.ID_Trabajador || 'N/A'}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="opacity: 0.8;">DPI/CUI:</strong><br>
              <span style="font-size: 13px;">${trabajador.DPI_CUI || 'N/A'}</span>
            </div>
            <div style="margin-bottom: 8px;">
              <strong style="opacity: 0.8;">Puesto:</strong><br>
              <span>${trabajador.Puesto || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="carnet-qr" style="
          text-align: center;
          margin: 20px 0;
          background: white;
          padding: 15px;
          border-radius: 10px;
        ">
          <img src="${qrDataUrl}" alt="QR Code" style="width: 120px; height: 120px;" />
          <p style="margin: 10px 0 0; color: #333; font-size: 10px; font-weight: bold;">ESCANEAR PARA MARCAR ASISTENCIA</p>
        </div>

        <div class="carnet-footer" style="
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          border-top: 2px solid rgba(255,255,255,0.3);
          padding-top: 15px;
          opacity: 0.8;
        ">
          <div>
            <strong>Emisión:</strong><br>
            ${fechaEmision}
          </div>
          <div>
            <strong>Expiración:</strong><br>
            ${fechaExpiracion}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Genera imagen del carnet usando html-to-image
   * @param {string} html - HTML del carnet
   * @returns {Promise<string>} Data URL de la imagen
   */
  async function generateCarnetImage(html) {
    if (typeof htmlToImage === 'undefined') {
      throw new Error('html-to-image no está disponible');
    }

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    try {
      const dataUrl = await htmlToImage.toPng(container);
      document.body.removeChild(container);
      return dataUrl;
    } catch (error) {
      document.body.removeChild(container);
      throw error;
    }
  }

  /**
   * Genera carnet completo (HTML e imagen) para un trabajador
   * @param {Object} trabajador - Datos del trabajador
   * @returns {Promise<Object>} HTML y Data URL del carnet
   */
  async function generateCarnet(trabajador) {
    try {
      const qrDataUrl = await generateWorkerQR(trabajador);
      const html = generateCarnetHTML(trabajador, qrDataUrl);
      const imageDataUrl = await generateCarnetImage(html);

      return {
        html,
        imageDataUrl,
        qrDataUrl,
        trabajador,
      };
    } catch (error) {
      console.error('[CarnetGenerator] Error al generar carnet:', error);
      throw error;
    }
  }

  /**
   * Genera carnets para múltiples trabajadores
   * @param {Array} trabajadores - Array de trabajadores
   * @returns {Promise<Array>} Array de carnets generados
   */
  async function generateMultipleCarnets(trabajadores) {
    const carnets = [];
    
    for (const trabajador of trabajadores) {
      try {
        const carnet = await generateCarnet(trabajador);
        carnets.push(carnet);
      } catch (error) {
        console.error(`[CarnetGenerator] Error generando carnet para ${trabajador.ID_Trabajador}:`, error);
        carnets.push({
          error: error.message,
          trabajador,
        });
      }
    }

    return carnets;
  }

  /**
   * Imprime un carnet
   * @param {string} html - HTML del carnet
   */
  function printCarnet(html) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Carnet</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .carnet-container { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        ${html}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  /**
   * Descarga un carnet como imagen
   * @param {string} imageDataUrl - Data URL de la imagen
   * @param {string} filename - Nombre del archivo
   */
  function downloadCarnet(imageDataUrl, filename) {
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = filename || 'carnet.png';
    link.click();
  }

  /**
   * Valida que un trabajador tenga los datos necesarios para generar carnet
   * @param {Object} trabajador - Datos del trabajador
   * @returns {Object} Resultado de validación
   */
  function validateWorkerForCarnet(trabajador) {
    const errors = [];
    const warnings = [];

    if (!trabajador) {
      errors.push('Trabajador no proporcionado');
      return { valid: false, errors, warnings };
    }

    if (!trabajador.ID_Trabajador) {
      errors.push('ID_Trabajador es requerido');
    }

    if (!trabajador.Nombre_Completo) {
      errors.push('Nombre_Completo es requerido');
    }

    if (!trabajador.DPI_CUI) {
      warnings.push('DPI_CUI no proporcionado, el QR no incluirá esta información');
    }

    if (!trabajador.Puesto) {
      warnings.push('Puesto no proporcionado');
    }

    if (!trabajador.Fotografia_URL) {
      warnings.push('Fotografía no proporcionada, se usará inicial del nombre');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  return {
    generateWorkerQR,
    generateCarnetHTML,
    generateCarnetImage,
    generateCarnet,
    generateMultipleCarnets,
    printCarnet,
    downloadCarnet,
    validateWorkerForCarnet,
  };
})();

// Exponer el módulo globalmente
window.CarnetGenerator = CarnetGenerator;