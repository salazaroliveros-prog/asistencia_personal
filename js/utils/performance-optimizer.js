/**
 * CONTROL PERSONAL CAMPO — utils/performance-optimizer.js
 * Sistema de optimización de performance
 * @version 1.0.0
 */

const PerformanceOptimizer = (() => {
  
  let performanceMetrics = {
    pageLoad: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    domContentLoaded: 0,
    loadComplete: 0
  };
  
  function init() {
    if (window.Logger) {
      window.Logger.info('PerformanceOptimizer', 'Inicializando optimizador de performance');
    }
    _measurePageLoad();
    _setupIntersectionObserver();
    _setupLazyLoading();
  }
  
  function _measurePageLoad() {
    if (window.performance) {
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        performanceMetrics.pageLoad = perfData.loadEventEnd - perfData.navigationStart;
        performanceMetrics.domContentLoaded = perfData.domContentLoadedEventEnd - perfData.navigationStart;
        
        if (window.Logger) {
          window.Logger.info('PerformanceOptimizer', 'Métricas de página cargadas', performanceMetrics);
        }
      });
    }
  }
  
  function _setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    // Observar elementos con clase lazy-fade
    document.querySelectorAll('.lazy-fade').forEach(el => {
      observer.observe(el);
    });
  }
  
  function _setupLazyLoading() {
    // Lazy loading de imágenes
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });
      
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }
  
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  function measureFunction(name, fn) {
    return async function(...args) {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const end = performance.now();
        const duration = end - start;
        
        if (window.Logger) {
          window.Logger.debug('PerformanceOptimizer', `${name} ejecutado`, { 
            duration: duration.toFixed(2) + 'ms' 
          });
        }
        
        return result;
      } catch (error) {
        const end = performance.now();
        const duration = end - start;
        
        if (window.Logger) {
          window.Logger.error('PerformanceOptimizer', `${name} falló`, { 
            duration: duration.toFixed(2) + 'ms',
            error: error.message
          });
        }
        
        throw error;
      }
    };
  }
  
  function getMetrics() {
    return performanceMetrics;
  }
  
  function clearCache() {
    // Limpiar cache de localStorage si está grande
    const cacheKeys = ['cpc_personal_cache', 'cpc_asistencias_cache', 'cpc_config_cache'];
    let totalSize = 0;
    
    cacheKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    });
    
    // Si el cache es > 5MB, limpiar
    if (totalSize > 5 * 1024 * 1024) {
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      if (window.Logger) {
        window.Logger.info('PerformanceOptimizer', 'Cache limpiado', { 
          previousSize: totalSize 
        });
      }
    }
  }
  
  return {
    init,
    debounce,
    throttle,
    measureFunction,
    getMetrics,
    clearCache
  };
})();

if (typeof window !== 'undefined') {
  window.PerformanceOptimizer = PerformanceOptimizer;
}