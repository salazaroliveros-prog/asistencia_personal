/**
 * Control Personal Campo — Photo helpers globales.
 * Utilidades para captura, compresión y preview de imágenes.
 */

window.CPC = window.CPC || {};

window.CPC.PhotoHelpers = {
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  compressImage(img, maxW = 600, maxH = 600, quality = 0.75) {
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
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  },

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
