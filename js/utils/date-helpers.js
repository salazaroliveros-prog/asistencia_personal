/**
 * CONTROL PERSONAL CAMPO — utils/date-helpers.js
 * Utilidades compartidas para formateo y manipulación de fechas.
 * Timezone fijo: America/Guatemala (GMT-6, sin DST).
 * @version 1.5.0
 */

window.CPC = window.CPC || {};

window.CPC.DateHelpers = (() => {
  'use strict';

  const _TZ     = 'America/Guatemala';
  const _LOCALE = 'es-GT';

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS INTERNOS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convierte cualquier input a un objeto Date válido.
   * Acepta Date, número (ms), string ISO y string YYYY-MM-DD.
   * @param {Date|number|string} d
   * @returns {Date}
   */
  function _toDate(d) {
    if (d instanceof Date) return d;
    if (typeof d === 'number') return new Date(d);
    if (typeof d === 'string') {
      // YYYY-MM-DD → parsear como local (no UTC) para evitar el off-by-one en GMT-6
      const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      return new Date(d);
    }
    return new Date(d);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSIÓN A STRING ISO — YYYY-MM-DD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convierte un Date a YYYY-MM-DD usando la zona horaria de Guatemala.
   * @param {Date|number|string} date
   * @returns {string} "YYYY-MM-DD"
   */
  function toISODate(date) {
    const d = _toDate(date);
    // Usamos Intl para obtener los componentes en la timezone correcta
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: _TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    return `${p.year}-${p.month}-${p.day}`;
  }

  /**
   * Devuelve la fecha de hoy en Guatemala como YYYY-MM-DD.
   * @returns {string}
   */
  function hoy() {
    return toISODate(new Date());
  }

  /**
   * Parsea un string YYYY-MM-DD a un Date en hora local (Guatemala).
   * @param {string} str — "YYYY-MM-DD"
   * @returns {Date|null}
   */
  function parseDate(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FORMATEO PARA MOSTRAR EN UI
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Formatea una fecha para mostrar en la UI.
   * Ej: "08/10/2026" (DD/MM/YYYY)
   * @param {Date|number|string} date
   * @returns {string}
   */
  function formatDate(date) {
    const d = _toDate(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(_LOCALE, {
      timeZone: _TZ,
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  }

  /**
   * Formatea una fecha de forma larga.
   * Ej: "jueves, 8 de octubre de 2026"
   * @param {Date|number|string} date
   * @returns {string}
   */
  function formatearFechaLarga(date) {
    const d = _toDate(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(_LOCALE, {
      timeZone: _TZ,
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(d);
  }

  /**
   * Formatea una fecha de forma corta sin año.
   * Ej: "8 oct"
   * @param {Date|number|string} date
   * @returns {string}
   */
  function formatearFechaCorta(date) {
    const d = _toDate(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(_LOCALE, {
      timeZone: _TZ,
      day: 'numeric', month: 'short',
    }).format(d);
  }

  /**
   * Formatea la hora de un Date.
   * Ej: "14:30" o "02:05 PM" según el locale
   * @param {Date|number|string} date
   * @param {boolean} [segundos=false] — incluir segundos
   * @returns {string}
   */
  function formatTime(date, segundos = false) {
    const d = _toDate(date);
    if (isNaN(d.getTime())) return '—';
    const opts = {
      timeZone: _TZ,
      hour: '2-digit', minute: '2-digit', hour12: false,
    };
    if (segundos) opts.second = '2-digit';
    return new Intl.DateTimeFormat(_LOCALE, opts).format(d);
  }

  /**
   * Formatea fecha + hora juntas.
   * Ej: "08/10/2026 14:30"
   * @param {Date|number|string} date
   * @returns {string}
   */
  function formatDateTime(date) {
    const d = _toDate(date);
    if (isNaN(d.getTime())) return '—';
    return `${formatDate(d)} ${formatTime(d)}`;
  }

  /**
   * Devuelve la hora actual en Guatemala en formato HH:MM.
   * @returns {string}
   */
  function obtenerHoraActual() {
    return formatTime(new Date());
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RANGOS DE FECHAS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve el inicio (lunes) y fin (domingo) de la semana que contiene la fecha dada.
   * @param {Date|string} fecha
   * @returns {{ inicio: string, fin: string }} Strings YYYY-MM-DD
   */
  function getRangoSemana(fecha) {
    const d = _toDate(fecha);
    const dow = d.getDay(); // 0=dom, 1=lun … 6=sab
    const diffLun = (dow === 0 ? -6 : 1 - dow);
    const lunes   = new Date(d); lunes.setDate(d.getDate() + diffLun);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    return { inicio: toISODate(lunes), fin: toISODate(domingo) };
  }

  /**
   * Devuelve el primer y último día del mes de la fecha dada.
   * @param {Date|string} fecha
   * @returns {{ inicio: string, fin: string }} Strings YYYY-MM-DD
   */
  function getRangoMes(fecha) {
    const d = _toDate(fecha);
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fin    = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { inicio: toISODate(inicio), fin: toISODate(fin) };
  }

  /**
   * Devuelve el rango de los últimos N días (hoy incluido).
   * @param {number} dias
   * @returns {{ inicio: string, fin: string }}
   */
  function getRangoUltimosDias(dias) {
    const fin    = new Date();
    const inicio = new Date(); inicio.setDate(fin.getDate() - (dias - 1));
    return { inicio: toISODate(inicio), fin: toISODate(fin) };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPARACIONES Y DIFERENCIAS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Comprueba si dos fechas caen en el mismo día (ignorando la hora).
   * @param {Date|string} a
   * @param {Date|string} b
   * @returns {boolean}
   */
  function esMismaFecha(a, b) {
    return toISODate(_toDate(a)) === toISODate(_toDate(b));
  }

  /**
   * Diferencia en días entre dos fechas (siempre positivo).
   * @param {Date|string} desde
   * @param {Date|string} hasta
   * @returns {number}
   */
  function diffDias(desde, hasta) {
    const a = parseDate(toISODate(_toDate(desde)));
    const b = parseDate(toISODate(_toDate(hasta)));
    return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
  }

  /**
   * Diferencia en minutos entre dos strings HH:MM.
   * Resultado positivo si hasta > desde; negativo si es antes.
   * @param {string} desde "HH:MM"
   * @param {string} hasta "HH:MM"
   * @returns {number}
   */
  function diffMinutos(desde, hasta) {
    const [dh, dm] = desde.split(':').map(Number);
    const [hh, hm] = hasta.split(':').map(Number);
    return (hh * 60 + hm) - (dh * 60 + dm);
  }

  /**
   * Comprueba si una fecha YYYY-MM-DD está dentro de un rango (inclusive).
   * @param {string} fecha
   * @param {string} inicio
   * @param {string} fin
   * @returns {boolean}
   */
  function estaEnRango(fecha, inicio, fin) {
    return fecha >= inicio && fecha <= fin;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILIDADES DE TIEMPO / HORARIO
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Convierte "HH:MM" a minutos totales desde medianoche.
   * @param {string} hora
   * @returns {number}
   */
  function horaAMinutos(hora) {
    if (!hora || typeof hora !== 'string') return 0;
    const [h, m] = hora.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Convierte minutos totales a string "HH:MM".
   * @param {number} minutos
   * @returns {string}
   */
  function minutosAHora(minutos) {
    const h = Math.floor(Math.abs(minutos) / 60);
    const m = Math.abs(minutos) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Determina el estado de puntualidad de una marcación.
   * @param {string} horaReal "HH:MM"
   * @param {string} horaProgramada "HH:MM"
   * @param {number} toleranciaMinutos
   * @returns {'A Tiempo'|'Puntual'|'Tolerancia'|'Atraso'}
   */
  function calcularEstadoMarcacion(horaReal, horaProgramada, toleranciaMinutos = 15) {
    const diff = diffMinutos(horaProgramada, horaReal);
    if (diff <= 0)                    return 'A Tiempo';
    if (diff <= 1)                    return 'Puntual';
    if (diff <= toleranciaMinutos)    return 'Tolerancia';
    return 'Atraso';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NOMBRES EN ESPAÑOL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve el nombre del día de la semana en español.
   * @param {Date|string} date
   * @returns {string} Ej: "lunes"
   */
  function getNombreDia(date) {
    const d = _toDate(date);
    return new Intl.DateTimeFormat(_LOCALE, { timeZone: _TZ, weekday: 'long' }).format(d);
  }

  /**
   * Devuelve el nombre del mes en español.
   * @param {Date|string} date
   * @returns {string} Ej: "octubre"
   */
  function getNombreMes(date) {
    const d = _toDate(date);
    return new Intl.DateTimeFormat(_LOCALE, { timeZone: _TZ, month: 'long' }).format(d);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    // Conversión
    toISODate,
    hoy,
    parseDate,
    // Formateo
    formatDate,
    formatearFechaLarga,
    formatearFechaCorta,
    formatTime,
    formatDateTime,
    obtenerHoraActual,
    // Rangos
    getRangoSemana,
    getRangoMes,
    getRangoUltimosDias,
    // Comparaciones
    esMismaFecha,
    diffDias,
    diffMinutos,
    estaEnRango,
    // Horario
    horaAMinutos,
    minutosAHora,
    calcularEstadoMarcacion,
    // Nombres
    getNombreDia,
    getNombreMes,
  };
})();
