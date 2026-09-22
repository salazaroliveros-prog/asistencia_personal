/**
 * Control Personal Campo — Photo helpers globales.
 * Utilidades para captura, compresión y preview de imágenes.
 * @version 1.5.0
 */

window.CPC = window.CPC || {};

window.CPC.PhotoHelpers = {
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
};