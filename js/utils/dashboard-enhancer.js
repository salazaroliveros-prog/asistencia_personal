/**
 * CONTROL PERSONAL CAMPO — utils/dashboard-enhancer.js
 * Mejoras de visualización de datos en dashboard
 * @version 1.5.0
 */

const _DashboardEnhancer = (() => {
  
  function init() {
    if (window.Logger) {
      window.Logger.info('DashboardEnhancer', 'Inicializando mejoras de dashboard');
    }
    _enhanceKPIs();
    _enhanceTurnoPanel();
  }
  
  /**
   * Prepara los KPIs para animación progresiva.
   *
   * Corrección: antes se aplicaba `title="Click para ver detalles"` a TODAS las
   * `.glass-card` de la aplicación (no solo a los KPIs), un tooltip engañoso
   * porque la mayoría de tarjetas no es clicable ni abre un detalle. Ahora solo
   * se marca la clase observada por PerformanceOptimizer sobre los KPIs reales.
   */
  function _enhanceKPIs() {
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach((card) => card.classList.add('lazy-fade'));
  }
  
  /**
   * Refuerza visualmente el panel "¿Quién está en obra?".
   *
   * Corrección: buscaba `#turno-panel` y `.worker-card`, elementos que no
   * existen en el marcado. El panel real es `#turno-lista` con ítems
   * `.turno-item`, que es lo que se procesa ahora.
   */
  function _enhanceTurnoPanel() {
    const turnoPanel = document.getElementById('turno-lista');
    if (!turnoPanel) return;

    turnoPanel.querySelectorAll('.turno-item').forEach((item) => {
      const badge = item.querySelector('.badge');
      if (badge) badge.classList.add('status-enhanced');
      // La lista es informativa; el detalle del trabajador se abre desde Personal
      item.classList.add('lazy-fade');
    });
  }

  return {
    init,
  };
})();

// Exponer el módulo globalmente
window.DashboardEnhancer = _DashboardEnhancer;