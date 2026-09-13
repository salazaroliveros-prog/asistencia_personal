/**
 * CONTROL PERSONAL CAMPO — utils/theme-manager.js
 * Sistema de temas personalizados
 * @version 1.0.0
 */

const ThemeManager = (() => {
  
  const THEME_KEY = 'cpc_theme';
  const THEMES = ['light', 'dark'];
  
  function init() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    setTheme(savedTheme);
    _bindEvents();
  }
  
  function _bindEvents() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', toggleTheme);
    }
    
    const toggleSidebar = document.getElementById('theme-toggle-sidebar');
    if (toggleSidebar) {
      toggleSidebar.addEventListener('click', toggleTheme);
    }
  }
  
  function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }
  
  function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
        if (window.lucide) lucide.createIcons({ nodes: [toggle] });
      }
    }
    
    if (window.Logger) {
      window.Logger.info('ThemeManager', 'Tema cambiado', { theme });
    }
  }
  
  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }
  
  return {
    init,
    toggleTheme,
    setTheme,
    getTheme
  };
})();

if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}