/**
 * Control Personal Campo — String helpers globales.
 * Utilidades compartidas para formateo y saneamiento de strings.
 * @version 1.5.0
 */

window.CPC = window.CPC || {};

window.CPC.StringHelpers = {
  /**
   * Escapa caracteres HTML para prevenir XSS.
   * @param {string} str - String a escapar
   * @returns {string} String escapado seguro para HTML
   */
  escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /**
   * Formatea número de teléfono al formato de Guatemala (+502 XXXX-XXXX).
   * @param {string} tel - Número de teléfono
   * @returns {string} Teléfono formateado
   */
  formatTelefono(tel) {
    if (!tel) return '';
    const num = String(tel).replace(/\D/g, '');
    if (num.length === 8) return `+502 ${num.substring(0, 4)}-${num.substring(4)}`;
    return tel;
  },

  /**
   * Debounce de función para limitar ejecuciones frecuentes.
   * @param {Function} fn - Función a debouncear
   * @param {number} wait - Tiempo de espera en ms
   * @returns {Function} Función debounciada
   */
  debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  /**
   * Genera un ID local único con prefijo.
   * @param {string} prefix - Prefijo del ID
   * @param {number} length - Longitud del sufijo aleatorio
   * @returns {string} ID generado
   */
  generateLocalId(prefix = 'TRAB', length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = prefix + '-';
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  },

  /**
   * Convierte una fecha a formato YYYY-MM-DD.
   * @param {Date} date - Fecha a convertir
   * @returns {string} Fecha en formato ISO date
   */
  dateToStr(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.warn('[StringHelpers] dateToStr recibió fecha inválida, usando fecha actual');
      date = new Date();
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },
};