/**
 * CONTROL PERSONAL CAMPO — utils/request-optimizer.js
 * Request optimization: debouncing, throttling, and deduplication
 * @version 1.0.0
 */

const RequestOptimizer = (() => {
  
  const pendingRequests = new Map();
  const debounceTimers = new Map();
  const throttleTimers = new Map();

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

  /**
   * Throttle function - limits execution to once per time period
   * @param {string} key - Unique identifier for the throttled function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds (default: 1000ms)
   * @returns {Function} Throttled function
   */
  function throttle(key, func, limit = 1000) {
    let inThrottle = false;
    
    return (...args) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        
        if (throttleTimers.has(key)) {
          clearTimeout(throttleTimers.get(key));
        }
        
        const timer = setTimeout(() => {
          inThrottle = false;
          throttleTimers.delete(key);
        }, limit);
        
        throttleTimers.set(key, timer);
      }
    };
  }

  /**
   * Deduplicate identical requests to prevent duplicate API calls
   * @param {string} key - Unique identifier for the request
   * @param {Function} requestFunc - Function that returns a Promise
   * @returns {Promise} Result of the request function
   */
  function deduplicateRequest(key, requestFunc) {
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }
    
    const promise = requestFunc().finally(() => {
      pendingRequests.delete(key);
    });
    
    pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Clear all pending timers and requests
   */
  function clearAll() {
    debounceTimers.forEach(timer => clearTimeout(timer));
    throttleTimers.forEach(timer => clearTimeout(timer));
    
    debounceTimers.clear();
    throttleTimers.clear();
    pendingRequests.clear();
  }

  /**
   * Clear specific debounce timer
   * @param {string} key - Key of the timer to clear
   */
  function clearDebounce(key) {
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
      debounceTimers.delete(key);
    }
  }

  /**
   * Clear specific throttle timer
   * @param {string} key - Key of the timer to clear
   */
  function clearThrottle(key) {
    if (throttleTimers.has(key)) {
      clearTimeout(throttleTimers.get(key));
      throttleTimers.delete(key);
    }
  }

  return { 
    debounce, 
    throttle, 
    deduplicateRequest, 
    clearAll, 
    clearDebounce, 
    clearThrottle 
  };
})();