/**
 * CONTROL PERSONAL CAMPO — utils/feedback-audio.js
 * Beeps de éxito/error compartidos (Asistencia, Campo, etc.).
 * Una sola implementación para no duplicar Web Audio API.
 *
 * @typedef {{ beepSuccess: function(): void, beepError: function(): void }} FeedbackAudioController
 */
(() => {
  'use strict';

  /**
   * @param {AudioContext} ctx
   * @param {OscillatorType} type
   * @param {number} freq
   * @param {number} gainVal
   * @param {number} duration
   * @returns {void}
   */
  function playTone(ctx, type, freq, gainVal, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  /**
   * Crea un controlador de audio con beepSuccess / beepError.
   * @returns {FeedbackAudioController | null}
   */
  function createFeedbackAudio() {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;
      const ctx = new AudioContextCtor();
      return {
        beepSuccess() { playTone(ctx, 'sine', 880, 0.3, 0.3); },
        beepError() { playTone(ctx, 'square', 220, 0.2, 0.4); },
      };
    } catch (_e) {
      return null;
    }
  }

  window.CPC = window.CPC || {};
  window.CPC.FeedbackAudio = { create: createFeedbackAudio };
})();
