/**
 * CONTROL PERSONAL CAMPO — utils/alerts.js
 * Sistema de notificaciones Toast y alertas en tiempo real.
 * @version 1.0.0
 */

const Alerts = (() => {
  const DEFAULTS = {
    duration: 4500,   // ms antes de auto-cerrar
    maxToasts: 5,     // máximo de toasts simultáneos
  };

  // Íconos por tipo (usando Lucide)
  const ICONS = {
    success: '<i data-lucide="check-circle-2"></i>',
    error:   '<i data-lucide="x-circle"></i>',
    warning: '<i data-lucide="alert-triangle"></i>',
    info:    '<i data-lucide="info"></i>',
  };

  // Títulos por defecto por tipo
  const DEFAULT_TITLES = {
    success: 'Éxito',
    error:   'Error',
    warning: 'Advertencia',
    info:    'Información',
  };

  let _container = null;

  function _getContainer() {
    if (!_container) {
      _container = document.getElementById('toast-container');
    }
    return _container;
  }

  /**
   * Mostrar un toast.
   * @param {object|string} options - Opciones o texto directo del mensaje
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {number} [duration]
   */
  function toast(options, type = 'info', duration) {
    const container = _getContainer();
    if (!container) return;

    // Aceptar string directo
    let opts = typeof options === 'string'
      ? { message: options, type, duration }
      : { ...options };

    opts.type     = opts.type     || type;
    opts.duration = opts.duration !== undefined ? opts.duration : DEFAULTS.duration;
    opts.title    = opts.title    || DEFAULT_TITLES[opts.type] || '';

    // Limitar cantidad de toasts
    const existing = container.querySelectorAll('.toast');
    if (existing.length >= DEFAULTS.maxToasts) {
      _removeToast(existing[0]);
    }

    // Crear elemento
    const el = document.createElement('div');
    el.className = `toast ${opts.type}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${ICONS[opts.type] || ICONS.info}</span>
      <div class="toast-body">
        ${opts.title ? `<div class="toast-title">${_escapeHtml(opts.title)}</div>` : ''}
        <div class="toast-message">${_escapeHtml(opts.message || '')}</div>
      </div>
      <button class="toast-close" aria-label="Cerrar notificación">
        <i data-lucide="x"></i>
      </button>
    `;

    // Botón cerrar
    el.querySelector('.toast-close').addEventListener('click', () => {
      _removeToast(el);
    });

    container.appendChild(el);

    // Renderizar íconos Lucide dentro del toast
    if (window.lucide) {
      lucide.createIcons({ nodes: [el] });
    }

    // Auto-cerrar
    if (opts.duration > 0) {
      setTimeout(() => _removeToast(el), opts.duration);
    }

    return el;
  }

  function _removeToast(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('removing');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 320);
  }

  function _escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Helpers de tipo específico ──────────────────────────────────────────

  /**
   * Toast de éxito.
   * @param {string} message
   * @param {string} [title]
   */
  function success(message, title) {
    return toast({ message, title, type: 'success' });
  }

  /**
   * Toast de error.
   * @param {string} message
   * @param {string} [title]
   * @param {boolean} [persistent=false] - Si true, no se cierra automáticamente
   */
  function error(message, title, persistent = false) {
    return toast({ message, title, type: 'error', duration: persistent ? 0 : 6000 });
  }

  /**
   * Toast de advertencia.
   */
  function warning(message, title) {
    return toast({ message, title, type: 'warning', duration: 5500 });
  }

  /**
   * Toast informativo.
   */
  function info(message, title) {
    return toast({ message, title, type: 'info' });
  }

  /**
   * Toast especial para confirmación de marcación de asistencia.
   * Incluye feedback visual más prominente.
   * @param {object} data - Datos de la marcación: {nombre, tipo, horaReal, estado}
   */
  function marcacion(data) {
    const tipoLabel = {
      'Entrada':        'Entrada a Obra',
      'Salida_Receso':  'Salida a Receso',
      'Regreso_Receso': 'Regreso de Receso',
      'Salida_Obra':    'Salida de Obra',
    };

    const estadoClass = {
      'A Tiempo':   'success',
      'Tolerancia': 'warning',
      'Atraso':     'error',
    };

    const tipo = data.tipo || 'Entrada';
    const tipo_text = tipoLabel[tipo] || tipo;
    const estado = data.estado || 'A Tiempo';
    const toastType = estadoClass[estado] || 'success';

    const title = `✓ ${tipo_text} registrada`;
    const message = `${data.nombre} — ${data.horaReal || ''}` +
      (estado !== 'A Tiempo' ? ` (${estado})` : '');

    return toast({ title, message, type: toastType, duration: 5000 });
  }

  /**
   * Toast de carga mientras espera una operación asíncrona.
   * Devuelve un objeto con método close().
   * @param {string} message
   */
  function loading(message = 'Procesando...') {
    const el = document.createElement('div');
    el.className = 'toast info loading-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');

    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true"><div class="spinner"></div></span>
      <div class="toast-body">
        <div class="toast-message">${_escapeHtml(message)}</div>
      </div>
    `;

    const container = _getContainer();
    if (container) container.appendChild(el);

    return {
      update(newMessage) {
        const msgEl = el.querySelector('.toast-message');
        if (msgEl) msgEl.textContent = newMessage;
      },
      close() {
        _removeToast(el);
      },
    };
  }

  /**
   * Diálogo de confirmación custom (modal) — reemplaza window.confirm.
   * Retorna una Promise<boolean>: true si el usuario confirma, false si cancela.
   *
   * @param {string} message    - Mensaje descriptivo de la acción
   * @param {string} [title]    - Título del diálogo
   * @param {object} [opts]     - Opciones adicionales
   * @param {string} [opts.okLabel='Confirmar']     - Texto del botón OK
   * @param {string} [opts.cancelLabel='Cancelar']  - Texto del botón cancelar
   * @param {'danger'|'info'} [opts.type='danger']  - Estilo del icono
   */
  function confirm(message, title = '¿Estás seguro?', opts = {}) {
    return new Promise((resolve) => {
      const modal     = document.getElementById('modal-confirm');
      const titleEl   = document.getElementById('modal-confirm-title');
      const msgEl     = document.getElementById('modal-confirm-message');
      const btnOk     = document.getElementById('btn-confirm-ok');
      const btnCancel = document.getElementById('btn-confirm-cancel');
      const iconWrap  = document.getElementById('confirm-icon-wrap');
      const okLabel   = document.getElementById('confirm-ok-label');
      const cancelLbl = opts.cancelLabel || 'Cancelar';
      const okLbl     = opts.okLabel     || 'Confirmar';
      const type      = opts.type        || 'danger';

      if (!modal || !titleEl || !msgEl || !btnOk || !btnCancel) {
        // Fallback a nativo si el DOM no está listo
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }

      // Configurar contenido
      if (titleEl)  titleEl.textContent  = title;
      if (msgEl)    msgEl.textContent    = message;
      if (okLabel)  okLabel.textContent  = okLbl;
      if (btnCancel) btnCancel.textContent = cancelLbl;

      // Estilo del icono
      if (iconWrap) {
        iconWrap.className = 'confirm-icon-wrap' +
          (type === 'info' ? ' confirm-icon-info' : '');
      }
      if (btnOk) {
        btnOk.className = type === 'info'
          ? 'btn btn-primary'
          : 'btn btn-danger';
      }

      // Mostrar modal
      modal.hidden = false;

      // Limpiar handlers previos clonando
      const newOk     = btnOk.cloneNode(true);
      const newCancel = btnCancel.cloneNode(true);
      btnOk.parentNode.replaceChild(newOk, btnOk);
      btnCancel.parentNode.replaceChild(newCancel, btnCancel);

      // Renderizar iconos Lucide
      if (window.lucide) lucide.createIcons({ nodes: [modal] });

      function _close(result) {
        modal.hidden = true;
        resolve(result);
      }

      newOk.addEventListener('click',     () => _close(true));
      newCancel.addEventListener('click', () => _close(false));

      // Cerrar con Escape
      function _onKey(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', _onKey); _close(false); }
        if (e.key === 'Enter')  { document.removeEventListener('keydown', _onKey); _close(true); }
      }
      document.addEventListener('keydown', _onKey);

      // Focus en botón cancelar por defecto (más seguro)
      setTimeout(() => newCancel.focus(), 80);
    });
  }

  // API pública
  return { toast, success, error, warning, info, marcacion, loading, confirm };
})();

// Alias global corto
const Toast = Alerts;
