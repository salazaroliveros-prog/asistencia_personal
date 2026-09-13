/**
 * CONTROL PERSONAL CAMPO — utils/dashboard-enhancer.js
 * Mejoras de visualización de datos en dashboard
 * @version 1.0.0
 */

const DashboardEnhancer = (() => {
  
  function init() {
    if (window.Logger) {
      window.Logger.info('DashboardEnhancer', 'Inicializando mejoras de dashboard');
    }
    _enhanceKPIs();
    _enhanceTurnoPanel();
    _enhanceActivityFeed();
  }
  
  function _enhanceKPIs() {
    // Agregar tooltips y animaciones a KPIs
    const kpiCards = document.querySelectorAll('.glass-card');
    kpiCards.forEach(card => {
      card.classList.add('lazy-fade');
      card.setAttribute('title', 'Click para ver detalles');
    });
  }
  
  function _enhanceTurnoPanel() {
    // Mejorar visualización del panel de turno
    const turnoPanel = document.getElementById('turno-panel');
    if (turnoPanel) {
      // Agregar indicadores de estado mejorados
      const workerCards = turnoPanel.querySelectorAll('.worker-card');
      workerCards.forEach(card => {
        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge) {
          // Mejorar badges con colores más claros
          statusBadge.classList.add('status-enhanced');
        }
      });
    }
  }
  
  function _enhanceActivityFeed() {
    // Mejorar feed de actividad con timestamps mejorados
    const feedItems = document.querySelectorAll('.feed-item');
    feedItems.forEach(item => {
      const timestamp = item.querySelector('.feed-timestamp');
      if (timestamp) {
        // Formato relativo de tiempo
        const time = new Date(timestamp.textContent);
        const now = new Date();
        const diff = now - time;
        
        let relativeTime;
        if (diff < 60000) {
          relativeTime = 'Ahora mismo';
        } else if (diff < 3600000) {
          relativeTime = `Hace ${Math.floor(diff / 60000)} min`;
        } else if (diff < 86400000) {
          relativeTime = `Hace ${Math.floor(diff / 3600000)} h`;
        } else {
          relativeTime = `Hace ${Math.floor(diff / 86400000)} días`;
        }
        
        timestamp.textContent = relativeTime;
        timestamp.setAttribute('title', time.toLocaleString());
      }
    });
  }
  
  function addTrendIndicator(kpiCard, trend, value) {
    // Agregar indicador de tendencia a KPIs
    const trendElement = document.createElement('div');
    trendElement.className = `trend-indicator ${trend > 0 ? 'trend-up' : 'trend-down'}`;
    trendElement.innerHTML = `
      <i data-lucide="${trend > 0 ? 'trending-up' : 'trending-down'}" aria-hidden="true"></i>
      <span>${Math.abs(trend)}%</span>
    `;
    
    kpiCard.appendChild(trendElement);
    
    if (window.lucide) {
      lucide.createIcons({ nodes: [trendElement] });
    }
  }
  
  function createSparkline(container, data, color) {
    // Crear sparkline para mostrar tendencias
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 30;
    canvas.className = 'sparkline';
    
    const ctx = canvas.getContext('2d');
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
    const calendarCells = document.querySelectorAll('.calendar-cell');
    calendarCells.forEach(cell => {
      const date = cell.dataset.date;
      const attendanceCount = cell.dataset.attendance || 0;
      
      if (attendanceCount > 0) {
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