/**
 * CONTROL PERSONAL CAMPO — locale-manager.js
 * Módulo centralizado para manejo de locales y formateo de fechas/horas/números.
 * Respetar la configuración regional del usuario en lugar de hardcodear el locale.
 * @version 1.0.0
 */

const LocaleManager = (() => {
  'use strict';

  // Cache de formatters para performance
  const _formatters = new Map();

  /**
   * Obtiene el locale preferido del usuario
   * @returns {string} Locale del navegador (ej: 'es-GT', 'en-US')
   */
  function getUserLocale() {
    // Prioridad: localStorage > navegador > fallback
    const stored = localStorage.getItem('cpc_user_locale');
    if (stored) return stored;

    const browserLocale = navigator.language || navigator.userLanguage || 'es-GT';
    return browserLocale;
  }

  /**
   * Establece el locale del usuario
   * @param {string} locale - Locale a establecer (ej: 'es-GT', 'en-US')
   */
  function setUserLocale(locale) {
    localStorage.setItem('cpc_user_locale', locale);
    // Limpiar cache de formatters
    _formatters.clear();
  }

  /**
   * Obtiene o crea un formatter de fecha cacheado
   * @param {string} key - Clave única para el formatter
   * @param {Object} options - Opciones de Intl.DateTimeFormat
   * @returns {Intl.DateTimeFormat}
   */
  function _getDateFormatter(key, options) {
    if (!_formatters.has(key)) {
      _formatters.set(key, new Intl.DateTimeFormat(getUserLocale(), options));
    }
    return _formatters.get(key);
  }

  /**
   * Obtiene o crea un formatter de número cacheado
   * @param {string} key - Clave única para el formatter
   * @param {Object} options - Opciones de Intl.NumberFormat
   * @returns {Intl.NumberFormat}
   */
  function _getNumberFormatter(key, options) {
    if (!_formatters.has(key)) {
      _formatters.set(key, new Intl.NumberFormat(getUserLocale(), options));
    }
    return _formatters.get(key);
  }

  /**
   * Formatea una fecha según el locale del usuario
   * @param {Date|string|number} date - Fecha a formatear
   * @param {Object} options - Opciones de formateo (opcional)
   * @returns {string} Fecha formateada
   */
  function formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    };
    const dateObj = date instanceof Date ? date : new Date(date);
    const formatter = _getDateFormatter('date-default', defaultOptions);
    return formatter.format(dateObj);
  }

  /**
   * Formatea una hora según el locale del usuario
   * @param {Date|string|number} date - Fecha/hora a formatear
   * @param {Object} options - Opciones de formateo (opcional)
   * @returns {string} Hora formateada
   */
  function formatTime(date, options = {}) {
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    };
    const dateObj = date instanceof Date ? date : new Date(date);
    const formatter = _getDateFormatter('time-default', defaultOptions);
    return formatter.format(dateObj);
  }

  /**
   * Formatea fecha y hora según el locale del usuario
   * @param {Date|string|number} date - Fecha/hora a formatear
   * @param {Object} options - Opciones de formateo (opcional)
   * @returns {string} Fecha y hora formateada
   */
  function formatDateTime(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    };
    const dateObj = date instanceof Date ? date : new Date(date);
    const formatter = _getDateFormatter('datetime-default', defaultOptions);
    return formatter.format(dateObj);
  }

  /**
   * Formatea un número según el locale del usuario
   * @param {number} num - Número a formatear
   * @param {Object} options - Opciones de formateo (opcional)
   * @returns {string} Número formateado
   */
  function formatNumber(num, options = {}) {
    const defaultOptions = {
      ...options,
    };
    const formatter = _getNumberFormatter('number-default', defaultOptions);
    return formatter.format(num);
  }

  /**
   * Formatea una moneda según el locale del usuario
   * @param {number} amount - Monto a formatear
   * @param {string} currency - Código de moneda (default: 'GTQ')
   * @param {Object} options - Opciones adicionales (opcional)
   * @returns {string} Monto formateado
   */
  function formatCurrency(amount, currency = 'GTQ', options = {}) {
    const defaultOptions = {
      style: 'currency',
      currency: currency,
      ...options,
    };
    const formatter = _getNumberFormatter(`currency-${currency}`, defaultOptions);
    return formatter.format(amount);
  }

  /**
   * Formatea un porcentaje según el locale del usuario
   * @param {number} value - Valor a formatear (0-1)
   * @param {Object} options - Opciones adicionales (opcional)
   * @returns {string} Porcentaje formateado
   */
  function formatPercent(value, options = {}) {
    const defaultOptions = {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      ...options,
    };
    const formatter = _getNumberFormatter('percent-default', defaultOptions);
    return formatter.format(value);
  }

  /**
   * Obtiene el nombre del día de la semana
   * @param {Date|string|number} date - Fecha
   * @returns {string} Nombre del día (ej: 'lunes')
   */
  function getDayName(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const formatter = _getDateFormatter('day-name', { weekday: 'long' });
    return formatter.format(dateObj);
  }

  /**
   * Obtiene el nombre del mes
   * @param {Date|string|number} date - Fecha
   * @returns {string} Nombre del mes (ej: 'enero')
   */
  function getMonthName(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const formatter = _getDateFormatter('month-name', { month: 'long' });
    return formatter.format(dateObj);
  }

  /**
   * Limpia el cache de formatters (útil cuando cambia el locale)
   */
  function clearCache() {
    _formatters.clear();
  }

  // API pública
  return {
    getUserLocale,
    setUserLocale,
    formatDate,
    formatTime,
    formatDateTime,
    formatNumber,
    formatCurrency,
    formatPercent,
    getDayName,
    getMonthName,
    clearCache,
  };
})();

// Exponer globalmente
window.LocaleManager = LocaleManager;
