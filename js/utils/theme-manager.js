/**
 * CONTROL PERSONAL CAMPO — utils/theme-manager.js
 * Sistema de temas personalizados
 * @version 1.5.0
 */

const ThemeManager = (() => {
  
  const THEME_KEY = 'cpc_theme';
  const THEMES = ['light', 'dark'];
  /* La interfaz está diseñada sobre el tema oscuro (glassmorphism). El valor
     por defecto debe ser 'dark' para no alterar la apariencia de los usuarios
     que nunca han cambiado el tema; antes era 'light' y activaba un tema claro
     que no estaba implementado en CSS. */
  const DEFAULT_THEME = 'dark';
  
  function init() {
    let savedTheme = DEFAULT_THEME;
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (THEMES.includes(stored)) savedTheme = stored;
    } catch (_) {
      /* localStorage puede no estar disponible (modo privado) */
    }
    setTheme(savedTheme);
    _bindEvents();
  }

  function _bindEvents() {
    const toggles = _getToggles();
    toggles.forEach((toggle) => {
      if (!toggle) return;
      toggle.addEventListener('click', toggleTheme);
    });
    _updateToggleUI(getTheme());
  }

  /** Devuelve los botones de tema presentes en el DOM (topbar/sidebar) */
  function _getToggles() {
    return ['theme-toggle', 'theme-toggle-sidebar']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
  }
  
  function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }
  
  function setTheme(theme) {
    if (!THEMES.includes(theme)) return;

    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {
      /* ignorar si localStorage no está disponible */
    }
    _updateToggleUI(theme);

    if (window.Logger) {
      window.Logger.info('ThemeManager', 'Tema cambiado', { theme });
    }
  }
  
  /** Sincroniza icono, etiqueta y estado ARIA de todos los botones de tema */
  function _updateToggleUI(theme) {
    const isLight = theme === 'light';
    _getToggles().forEach((toggle) => {
      const icon = toggle.querySelector('i');
      if (icon) {
        // Icono del tema AL QUE SE CAMBIA: luna si estamos en claro, sol si en oscuro
        icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
      }
      toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      toggle.setAttribute(
        'aria-label',
        isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'
      );
      toggle.setAttribute(
        'title',
        isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'
      );
    });
    if (window.lucide) {
      const nodes = _getToggles().map((t) => t.querySelector('i')).filter(Boolean);
      if (nodes.length) lucide.createIcons({ nodes });
    }
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
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