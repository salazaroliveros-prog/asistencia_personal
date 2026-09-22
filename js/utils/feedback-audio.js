/**
 * CONTROL PERSONAL CAMPO — utils/feedback-audio.js
 * Beeps de éxito/error compartidos (Asistencia, Campo, etc.).
 * Una sola implementación para no duplicar Web Audio API.
 */
(() => {
  'use strict';

  /**
   * Crea un controlador de audio con beepSuccess / beepError.
   * @returns {{ beepSuccess: function, beepError: function } | null}
   */
  function createFeedbackAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const ctx = new AudioContext();

      function _tone(type, freq, gainVal, duration) {
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

      return {
        beepSuccess() { _tone('sine', 880, 0.3, 0.3); },
        beepError() { _tone('square', 220, 0.2, 0.4); },
      };
    } catch (_e) {
      return null;
    }
  }

  window.CPC = window.CPC || {};
  window.CPC.FeedbackAudio = { create: createFeedbackAudio };
})();
