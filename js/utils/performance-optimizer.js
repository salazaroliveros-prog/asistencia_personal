/**
 * CONTROL PERSONAL CAMPO — utils/performance-optimizer.js
 * Sistema de optimización de performance
 * @version 1.5.0
 */

const PerformanceOptimizer = (() => {
  
  const performanceMetrics = {
    pageLoad: 0,
    domContentLoaded: 0,
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
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    });
    
    // Observar elementos con clase lazy-fade
    document.querySelectorAll('.lazy-fade').forEach((el) => {
      observer.observe(el);
    });
  }
  
  function _setupLazyLoading() {
    // Lazy loading de imágenes
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
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

      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img);
      });
    }
  }

  return {
    init,
  };
})();

if (typeof window !== 'undefined') {
  window.PerformanceOptimizer = PerformanceOptimizer;
}