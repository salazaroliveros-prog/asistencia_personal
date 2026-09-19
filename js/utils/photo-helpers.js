/**
 * Control Personal Campo — Photo helpers globales.
 * Utilidades para captura, compresión y preview de imágenes.
 * @version 1.5.0
 */

window.CPC = window.CPC || {};

window.CPC.PhotoHelpers = {
  /**
   * Convierte un archivo a Data URL (base64).
   * @param {File} file - Archivo de imagen
   * @returns {Promise<string>} Data URL de la imagen
   */
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No se proporcionó un archivo válido'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  },

  /**
   * Comprime una imagen manteniendo aspect ratio.
   * @param {HTMLImageElement} img - Elemento de imagen
   * @param {number} maxW - Ancho máximo en px
   * @param {number} maxH - Alto máximo en px
   * @param {number} quality - Calidad JPEG (0-1)
   * @returns {string} Data URL de la imagen comprimida
   */
  compressImage(img, maxW = 600, maxH = 600, quality = 0.75) {
    if (!img || !img.width || !img.height) {
      console.warn('[PhotoHelpers] compressImage recibió elemento inválido');
      return '';
    }

    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;

    if (width > maxW || height > maxH) {
      const ratio = Math.min(maxW / width, maxH / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[PhotoHelpers] No se pudo obtener contexto 2D del canvas');
      return '';
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  },

  /**
   * Actualiza el preview de foto mostrando u ocultando elementos.
   * @param {string} src - Data URL de la imagen o null para limpiar
   * @param {string} previewId - ID del elemento preview
   * @param {string} placeholderId - ID del elemento placeholder
   */
  updatePhotoPreview(src, previewId = 'foto-preview', placeholderId = 'foto-placeholder') {
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);

    if (src) {
      if (preview) {
        preview.src = src;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (preview) {
        preview.src = '';
        preview.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'flex';
    }
  },
};