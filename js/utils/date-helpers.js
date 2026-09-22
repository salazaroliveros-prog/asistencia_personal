/**
 * Control Personal Campo — Date helpers globales.
 * Utilidades compartidas para formateo y manipulación de fechas.
 */

window.CPC = window.CPC || {};

window.CPC.DateHelpers = {
  toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },
};