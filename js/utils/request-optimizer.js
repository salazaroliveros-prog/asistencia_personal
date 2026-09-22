/**
 * CONTROL PERSONAL CAMPO — utils/request-optimizer.js
 * Request optimization: debouncing compartido (fuente única).
 * @version 1.6.0
 */

const RequestOptimizer = (() => {

  const debounceTimers = new Map();

  /**
   * Debounce function - delays execution until after wait time has elapsed
   * @param {string} key - Unique identifier for the debounced function
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds (default: 300ms)
   * @returns {Function} Debounced function
   */
  function debounce(key, func, delay = 300) {
    return (...args) => {
      if (debounceTimers.has(key)) {
        clearTimeout(debounceTimers.get(key));
      }

      const timer = setTimeout(() => {
        func(...args);
        debounceTimers.delete(key);
      }, delay);

      debounceTimers.set(key, timer);
    };
  }

  return {
    debounce,
  };
})();

if (typeof window !== 'undefined') {
  window.RequestOptimizer = RequestOptimizer;
}