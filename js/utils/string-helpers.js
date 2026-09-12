/**
 * Control Personal Campo — String helpers globales.
 * Utilidades compartidas para formateo y saneamiento de strings.
 */

window.CPC = window.CPC || {};

window.CPC.StringHelpers = {
  escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  formatTelefono(tel) {
    if (!tel) return '';
    const num = String(tel).replace(/\D/g, '');
    if (num.length === 8) return `+502 ${num.substring(0, 4)}-${num.substring(4)}`;
    return tel;
  },

  debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  generateLocalId(prefix = 'TRAB', length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = prefix + '-';
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },
};
