/**
 * CONTROL PERSONAL CAMPO — utils/persist.js
 * Capa de persistencia unificada: decide cloud vs local, nunca miente al usuario.
 *
 * @typedef {'cloud'|'local'|'queued'|'blocked'} PersistMode
 * @typedef {{
 *   success: boolean,
 *   mode: PersistMode,
 *   data?: unknown,
 *   message: string,
 *   error?: string,
 *   code?: string,
 *   needsAuth?: boolean,
 *   needsRole?: boolean,
 *   offline?: boolean,
 * }} PersistResult
 */
(() => {
  'use strict';

  /**
   * ¿Hay sesión Firebase usable para escribir en Firestore?
   * @returns {{ ok: boolean, reason?: string, code?: string, user?: object }}
   */
  function getWriteCapability() {
    const client = window.FirebaseClient;
    if (!client || typeof client.isReady !== 'function') {
      return { ok: false, reason: 'Cliente Firebase no disponible.', code: 'no-client' };
    }
    if (!client.isReady()) {
      return { ok: false, reason: 'Firebase no está listo.', code: 'not-ready' };
    }
    const state = client.getConnectionState ? client.getConnectionState() : '';
    if (state !== 'connected' && state !== 'degraded') {
      return { ok: false, reason: 'Sin conexión a Firestore.', code: 'offline' };
    }
    const user = typeof client.getCurrentUser === 'function' ? client.getCurrentUser() : null;
    if (!user) {
      return {
        ok: false,
        reason: 'Inicia sesión en Ajustes para guardar en la nube.',
        code: 'auth-required',
        needsAuth: true,
      };
    }
    return { ok: true, user };
  }

  /**
   * Clasifica un error de Firestore en código de UX.
   * @param {Error & { code?: string }} error
   * @returns {{ code: string, message: string, needsAuth?: boolean, needsRole?: boolean }}
   */
  function classifyFirestoreError(error) {
    const code = (error && error.code) || '';
    const msg = (error && error.message) || 'Error desconocido';
    if (code === 'permission-denied' || /permission/i.test(msg)) {
      return {
        code: 'permission-denied',
        message: 'No tienes permiso para guardar en la nube. Inicia sesión con una cuenta autorizada.',
        needsAuth: true,
        needsRole: true,
      };
    }
    if (code === 'unavailable' || code === 'network-request-failed' || /network|offline/i.test(msg)) {
      return { code: 'unavailable', message: 'Sin red. Los datos se guardarán en este dispositivo.' };
    }
    if (code === 'invalid-argument' || code === 'failed-precondition') {
      return { code, message: 'Datos inválidos para Firestore: ' + msg };
    }
    if (code === 'unauthenticated') {
      return {
        code: 'unauthenticated',
        message: 'Sesión expirada. Vuelve a iniciar sesión en Ajustes.',
        needsAuth: true,
      };
    }
    return { code: code || 'unknown', message: msg };
  }

  /**
   * Normaliza WhatsApp a dígitos (máx. 15) para cumplir reglas y UX.
   * La UI puede construir wa.me a partir del número.
   * @param {string} value
   * @returns {string}
   */
  function normalizeWhatsApp(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    // Si ya es URL, extraer dígitos
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    // Guatemala: si vienen 8 dígitos locales, prefijar 502
    if (digits.length === 8) return '502' + digits;
    return digits.slice(0, 15);
  }

  /**
   * Construye un PersistResult de éxito local/cola.
   * @param {unknown} data
   * @param {string} message
   * @param {boolean} [queued]
   * @returns {PersistResult}
   */
  function localSuccess(data, message, queued) {
    return {
      success: true,
      mode: queued ? 'queued' : 'local',
      data,
      message,
      offline: true,
    };
  }

  /**
   * Construye un PersistResult de éxito en nube.
   * @param {unknown} data
   * @param {string} message
   * @returns {PersistResult}
   */
  function cloudSuccess(data, message) {
    return {
      success: true,
      mode: 'cloud',
      data,
      message,
      offline: false,
    };
  }

  /**
   * @param {string} message
   * @param {object} [extra]
   * @returns {PersistResult}
   */
  function blocked(message, extra) {
    return {
      success: false,
      mode: 'blocked',
      message,
      error: message,
      ...(extra || {}),
    };
  }

  window.CPC = window.CPC || {};
  window.CPC.Persist = {
    getWriteCapability,
    classifyFirestoreError,
    normalizeWhatsApp,
    localSuccess,
    cloudSuccess,
    blocked,
  };
})();
