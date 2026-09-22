/**
 * CONTROL PERSONAL CAMPO — utils/alerts.js
 * Sistema de notificaciones Toast y alertas en tiempo real.
 * @version 1.5.0
 */

// eslint-disable-next-line no-unused-vars
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
    const opts = typeof options === 'string'
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

    // Crear elemento.
    // Una sola región viva por aviso: el contenedor ya no lo es (ver el
    // comentario en index.html), así que el tipo decide el rol y la política
    // de anuncio. Los errores se anuncian de inmediato (assertive); el resto
    // espera (polite) a que el lector termine la frase en curso.
    const el = document.createElement('div');
    el.className = `toast ${opts.type}`;
    const vital = opts.type === 'error';
    el.setAttribute('role', vital ? 'alert' : 'status');
    el.setAttribute('aria-live', vital ? 'assertive' : 'polite');

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
    _renderIconsIn(el);

    // Auto-cerrar
    if (opts.duration > 0) {
      setTimeout(() => _removeToast(el), opts.duration);
    }

    return el;
  }

  /**
   * Renderiza los íconos Lucide de un subárbol concreto.
   *
   * El bundle de Lucide incluido en el proyecto expone
   * createIcons({ icons, nameAttr, attrs }) y NO soporta la opción `nodes`:
   * pasar { nodes: [el] } se ignora en silencio y el escaneo recorre TODO el
   * documento. Como el <svg> generado conserva el atributo de nombre, cada
   * toast (y cada confirmación) recreaba los íconos de la aplicación entera,
   * lo que produce parpadeo y es costoso en tablas grandes.
   *
   * Para limitar el trabajo al subárbol pedido se renombra temporalmente el
   * atributo de nombre de esos íconos y se usa `nameAttr` como selector.
   *
   * @param {Element} root - Contenedor cuyos íconos se quieren renderizar
   */
  function _renderIconsIn(root) {
    if (!window.lucide || !root) return;

    const pending = root.querySelectorAll('[data-lucide]');
    if (!pending.length) return;

    pending.forEach((node) => {
      node.setAttribute('data-lucide-pending', node.getAttribute('data-lucide'));
      node.removeAttribute('data-lucide');
    });

    try {
      lucide.createIcons({ nameAttr: 'data-lucide-pending' });
    } catch (err) {
      // Un fallo de renderizado no debe romper la notificación: el aviso ya
      // está en el DOM y el ícono se reintenta en el siguiente escaneo global.
      console.warn('[Alerts] No se pudieron renderizar los íconos:', err);
    } finally {
      // El <svg> resultante puede conservar el atributo temporal: se restaura
      // el nombre estándar para no dejar atributos huérfanos en el DOM.
      root.querySelectorAll('[data-lucide-pending]').forEach((node) => {
        node.setAttribute('data-lucide', node.getAttribute('data-lucide-pending'));
        node.removeAttribute('data-lucide-pending');
      });
    }
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

      // Elemento que abrió el diálogo: el foco se devuelve ahí al cerrar
      // (WCAG 2.4.3 Orden del foco).
      const opener = document.activeElement;

      // Mostrar modal
      modal.hidden = false;

      // Limpiar handlers previos clonando
      const newOk     = btnOk.cloneNode(true);
      const newCancel = btnCancel.cloneNode(true);
      btnOk.parentNode.replaceChild(newOk, btnOk);
      btnCancel.parentNode.replaceChild(newCancel, btnCancel);

      // Renderizar iconos Lucide
      _renderIconsIn(modal);

      let settled = false;

      function _close(result) {
        // Antes se resolvía en cada cierre y el listener de teclado nunca se
        // retiraba, por lo que quedaba vivo el resto de la sesión.
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', _onKey);
        modal.hidden = true;
        if (opener && typeof opener.focus === 'function') opener.focus();
        resolve(result);
      }

      newOk.addEventListener('click',     () => _close(true));
      newCancel.addEventListener('click', () => _close(false));

      // Sólo se intercepta Escape. Enter NO se captura a nivel de documento:
      // el foco está en un botón, así que la activación nativa ya confirma o
      // cancela según cuál esté enfocado. Al capturarlo, Enter sobre
      // "Cancelar" resolvía true (keydown) antes de que llegara el click
      // nativo, es decir, ejecutaba la acción destructiva con el botón seguro.
      function _onKey(e) {
        if (e.key === 'Escape') _close(false);
      }
      document.addEventListener('keydown', _onKey);

      // Focus en botón cancelar por defecto (más seguro)
      setTimeout(() => { if (!settled) newCancel.focus(); }, 80);
    });
  }

  // API pública
  return { toast, success, error, warning, info, marcacion, loading, confirm };
})();

if (typeof window !== 'undefined') {
  window.Alerts = Alerts;
}