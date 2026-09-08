/**
 * CONTROL PERSONAL CAMPO — utils/performance-monitor.js
 * Performance monitoring and analytics tracking
 * @version 1.0.0
 */

const PerformanceMonitor = (() => {
  
  const metrics = {
    apiCalls: [],
    operations: [],
    errors: []
  };

  /**
   * Mark the start of an operation
   * @param {string} name - Operation name
   */
  function markOperation(name) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
    metrics.operations.push({
      name,
      startTime: Date.now(),
      type: 'start'
    });
  }

  /**
   * Measure the duration of an operation
   * @param {string} name - Operation name
   * @returns {number} Duration in milliseconds
   */
  function measureOperation(name) {
    const endTime = Date.now();
    
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      try {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        const measure = performance.getEntriesByName(name)[0];
        const duration = measure ? measure.duration : (endTime - metrics.operations.find(o => o.name === name && o.type === 'start')?.startTime || endTime);
        
        // Clean up marks
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
        performance.clearMeasures(name);
        
        // Log slow operations
        if (duration > 1000) {
          console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
        }
        
        return duration;
      } catch (e) {
        // Fallback to manual calculation
        const startTime = metrics.operations.find(o => o.name === name && o.type === 'start')?.startTime || endTime;
        return endTime - startTime;
      }
    }
    
    // Fallback if performance API not available
    const startTime = metrics.operations.find(o => o.name === name && o.type === 'start')?.startTime || endTime;
    const duration = endTime - startTime;
    
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  /**
   * Track API response metrics
   * @param {string} endpoint - API endpoint
   * @param {number} duration - Response time in milliseconds
   * @param {boolean} success - Whether the request was successful
   */
  function trackAPIResponse(endpoint, duration, success) {
    const metric = {
      endpoint,
      duration,
      success,
      timestamp: Date.now()
    };
    
    metrics.apiCalls.push(metric);
    
    // Keep only last 1000 API call metrics
    if (metrics.apiCalls.length > 1000) {
      metrics.apiCalls.shift();
    }
    
    // Store in localStorage for persistence
    try {
      const apiMetrics = JSON.parse(localStorage.getItem('cpc_api_metrics') || '[]');
      apiMetrics.push(metric);
      
      // Keep only last 1000 entries
      if (apiMetrics.length > 1000) {
        apiMetrics.shift();
      }
      
      localStorage.setItem('cpc_api_metrics', JSON.stringify(apiMetrics));
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to store API metrics:', e);
    }
  }

  /**
   * Log error for tracking
   * @param {Error} error - Error object
   * @param {object} context - Additional context about the error
   */
  function logError(error, context = {}) {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    metrics.errors.push(errorLog);
    
    // Store in localStorage
    try {
      const errorLogs = JSON.parse(localStorage.getItem('cpc_error_logs') || '[]');
      errorLogs.push(errorLog);
      
      // Keep only last 100 errors
      if (errorLogs.length > 100) {
        errorLogs.shift();
      }
      
      localStorage.setItem('cpc_error_logs', JSON.stringify(errorLogs));
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to store error log:', e);
    }
  }

  /**
   * Get performance report
   * @returns {object} Performance statistics
   */
  function getPerformanceReport() {
    const apiMetrics = JSON.parse(localStorage.getItem('cpc_api_metrics') || '[]');
    
    if (apiMetrics.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageResponseTime: 0,
        slowestEndpoint: null,
        fastestEndpoint: null
      };
    }
    
    const totalCalls = apiMetrics.length;
    const successfulCalls = apiMetrics.filter(m => m.success).length;
    const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;
    const averageResponseTime = apiMetrics.reduce((sum, m) => sum + m.duration, 0) / totalCalls;
    
    const sortedByDuration = [...apiMetrics].sort((a, b) => b.duration - a.duration);
    const slowestEndpoint = sortedByDuration[0];
    const fastestEndpoint = sortedByDuration[sortedByDuration.length - 1];
    
    return {
      totalCalls,
      successRate: successRate.toFixed(2),
      averageResponseTime: averageResponseTime.toFixed(2),
      slowestEndpoint: {
        endpoint: slowestEndpoint.endpoint,
        duration: slowestEndpoint.duration.toFixed(2)
      },
      fastestEndpoint: {
        endpoint: fastestEndpoint.endpoint,
        duration: fastestEndpoint.duration.toFixed(2)
      }
    };
  }

  /**
   * Get recent errors
   * @param {number} count - Number of recent errors to return
   * @returns {Array} Recent error logs
   */
  function getRecentErrors(count = 10) {
    try {
      const logs = JSON.parse(localStorage.getItem('cpc_error_logs') || '[]');
      return logs.slice(-count);
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to retrieve error logs:', e);
      return [];
    }
  }

  /**
   * Clear error logs
   */
  function clearErrorLogs() {
    try {
      localStorage.removeItem('cpc_error_logs');
      metrics.errors = [];
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to clear error logs:', e);
    }
  }

  /**
   * Clear API metrics
   */
  function clearAPIMetrics() {
    try {
      localStorage.removeItem('cpc_api_metrics');
      metrics.apiCalls = [];
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to clear API metrics:', e);
    }
  }

  /**
   * Clean up old metrics (older than 7 days)
   */
  function cleanupOldMetrics() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    try {
      // Clean API metrics
      const apiMetrics = JSON.parse(localStorage.getItem('cpc_api_metrics') || '[]');
      const recentAPIMetrics = apiMetrics.filter(m => m.timestamp > sevenDaysAgo);
      localStorage.setItem('cpc_api_metrics', JSON.stringify(recentAPIMetrics));
      
      // Clean error logs
      const errorLogs = JSON.parse(localStorage.getItem('cpc_error_logs') || '[]');
      const recentErrorLogs = errorLogs.filter(e => e.timestamp > sevenDaysAgo);
      localStorage.setItem('cpc_error_logs', JSON.stringify(recentErrorLogs));
      
      console.log('[PerformanceMonitor] Cleaned up old metrics');
    } catch (e) {
      console.warn('[PerformanceMonitor] Failed to cleanup old metrics:', e);
    }
  }

  return { 
    markOperation, 
    measureOperation, 
    trackAPIResponse, 
    logError, 
    getPerformanceReport, 
    getRecentErrors, 
    clearErrorLogs,
    clearAPIMetrics,
    cleanupOldMetrics
  };
})();