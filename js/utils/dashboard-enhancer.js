/**
 * CONTROL PERSONAL CAMPO — utils/dashboard-enhancer.js
 * Mejoras de visualización de datos en dashboard
 * @version 1.5.0
 */

const DashboardEnhancer = (() => {
  
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

  function addTrendIndicator(kpiCard, trend, value) {
    if (!kpiCard) return;
    // Evita duplicar el indicador si se refresca el dashboard varias veces
    kpiCard.querySelector('.trend-indicator')?.remove();

    const trendElement = document.createElement('div');
    trendElement.className = `trend-indicator ${trend > 0 ? 'trend-up' : 'trend-down'}`;
    trendElement.innerHTML = `
      <i data-lucide="${trend > 0 ? 'trending-up' : 'trending-down'}" aria-hidden="true"></i>
      <span>${Math.abs(trend)}%</span>
    `;
    
    kpiCard.appendChild(trendElement);
    
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  
  function createSparkline(container, data, color) {
    if (!container || !Array.isArray(data) || data.length < 2) return;
    // Crear sparkline para mostrar tendencias
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 30;
    canvas.className = 'sparkline';
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * canvas.width;
      const y = canvas.height - ((value - min) / range) * canvas.height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    container.appendChild(canvas);
  }
  
  function enhanceCalendar() {
    // Mejorar calendario con indicadores visuales
    const calendarCells = document.querySelectorAll('.cal-day');
    calendarCells.forEach((cell) => {
      const attendanceCount = Number(cell.dataset.attendance) || 0;
      if (attendanceCount > 0 && !cell.querySelector('.attendance-indicator')) {
        const indicator = document.createElement('div');
        indicator.className = 'attendance-indicator';
        indicator.style.width = `${Math.min(attendanceCount * 10, 100)}%`;
        cell.appendChild(indicator);
      }
    });
  }
  
  return {
    init,
    addTrendIndicator,
    createSparkline,
    enhanceCalendar
  };
})();

if (typeof window !== 'undefined') {
  window.DashboardEnhancer = DashboardEnhancer;
}