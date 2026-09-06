/**
 * CONTROL PERSONAL CAMPO — modules/personal.js
 * Módulo CRUD de Trabajadores + Generación de Carnés QR.
 * @version 1.0.0
 */

const ModuloPersonal = (() => {

  // ─── Estado local del módulo ──────────────────────────────────────────────
  let _filteredPersonal = [];
  let _editingId        = null;
  let _fotoBase64       = '';

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _setDefaultDate();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENTOS
  // ─────────────────────────────────────────────────────────────────────────
  function _bindEvents() {
    // Abrir modal nuevo trabajador
    const btnNuevo = document.getElementById('btn-nuevo-personal');
    if (btnNuevo) btnNuevo.addEventListener('click', () => _abrirModalNuevo());

    // Guardar trabajador
    const btnGuardar = document.getElementById('btn-guardar-personal');
    if (btnGuardar) btnGuardar.addEventListener('click', _guardarPersonal);

    // Búsqueda en tiempo real
    const searchInput = document.getElementById('personal-search');
    if (searchInput) {
      searchInput.addEventListener('input', _debounce(_filtrarTabla, 300));
    }

    // Filtros de tabla
    const filterPuesto = document.getElementById('filter-puesto');
    if (filterPuesto) filterPuesto.addEventListener('change', _filtrarTabla);

    const filterEstado = document.getElementById('filter-estado-personal');
    if (filterEstado) filterEstado.addEventListener('change', _filtrarTabla);

    // Upload foto desde archivo/galería
    const fotoInput = document.getElementById('foto-input');
    if (fotoInput) fotoInput.addEventListener('change', _handleFotoUpload);

    // ── Botón "Tomar Foto" — abre la cámara ────────────────────────────────
    const btnTomarFoto = document.getElementById('btn-tomar-foto');
    if (btnTomarFoto) btnTomarFoto.addEventListener('click', () => _abrirCamara());

    // ── Botón "Eliminar foto" ──────────────────────────────────────────────
    const btnEliminarFoto = document.getElementById('btn-eliminar-foto');
    if (btnEliminarFoto) btnEliminarFoto.addEventListener('click', _eliminarFoto);

    // ── Eventos del modal de cámara ────────────────────────────────────────
    const btnCapturar = document.getElementById('btn-capturar-foto');
    if (btnCapturar) btnCapturar.addEventListener('click', _capturarFoto);

    const btnRetomar = document.getElementById('btn-retomar-foto');
    if (btnRetomar) btnRetomar.addEventListener('click', async () => {
      _mostrarEstadoCamara('live');
      await _iniciarStream();
    });

    const btnUsarFoto = document.getElementById('btn-usar-foto');
    if (btnUsarFoto) btnUsarFoto.addEventListener('click', _usarFotoCapturada);

    const btnFlip = document.getElementById('btn-flip-camera');
    if (btnFlip) btnFlip.addEventListener('click', () => _voltearCamara());

    // Cerrar modal de cámara libera el stream
    const btnCameraClose = document.getElementById('btn-camera-close');
    if (btnCameraClose) btnCameraClose.addEventListener('click', _cerrarCamara);

    // También el botón "Cancelar" del footer del modal de cámara
    const btnCameraCancel = document.querySelector('#camera-footer-live [data-modal="modal-camera"]');
    if (btnCameraCancel) btnCameraCancel.addEventListener('click', _cerrarCamara);

    // Imprimir carné
    const btnImprimirCarne = document.getElementById('btn-imprimir-carne');
    if (btnImprimirCarne) {
      btnImprimirCarne.addEventListener('click', _imprimirCarne);
    }

    // Descargar carné como PNG
    const btnDescPNG = document.getElementById('btn-descargar-carne-png');
    if (btnDescPNG) {
      btnDescPNG.addEventListener('click', _descargarCarnePNG);
    }

    // Validación DPI en tiempo real
    const dpiInput = document.getElementById('p-dpi');
    if (dpiInput) {
      dpiInput.addEventListener('input', () => {
        dpiInput.value = dpiInput.value.replace(/\D/g, '').substring(0, 13);
        _validateDPI(dpiInput.value);
      });
    }

    // Escuchar cambios en el estado global
    AppState.on('personal', (personal) => {
      _filteredPersonal = personal;
      _filtrarTabla();
    });
  }

  function _setDefaultDate() {
    // Asegura que los filtros usen el estado activo
    const filterEstado = document.getElementById('filter-estado-personal');
    if (filterEstado) filterEstado.value = 'Activo';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CARGAR DATOS
  // ─────────────────────────────────────────────────────────────────────────
  async function cargar() {
    const personal = AppState.get('personal');

    // Si hay cache, mostrar inmediatamente
    if (personal && personal.length > 0) {
      _filteredPersonal = personal;
      _filtrarTabla();
    }

    // Intentar actualizar desde API
    if (AppState.get('gasUrl')) {
      _setLoadingState(true);
      try {
        const result = await API.obtenerPersonal();
        if (result.success) {
          _filteredPersonal = result.data;
          _filtrarTabla();
          Alerts.success(`${result.data.length} trabajadores cargados`);
        } else {
          Alerts.warning('No se pudo actualizar la lista: ' + (result.error || 'Error desconocido'));
        }
      } catch (err) {
        Alerts.error(err.message, 'Error de conexión');
      } finally {
        _setLoadingState(false);
      }
    } else {
      _filteredPersonal = personal || [];
      _filtrarTabla();
    }
  }

  function _setLoadingState(loading) {
    AppState.set('loading', { ...AppState.get('loading'), personal: loading });
    const tbody = document.getElementById('personal-tbody');
    if (!tbody) return;

    if (loading && tbody.rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center">
            <div class="loading-overlay">
              <div class="spinner spinner-lg"></div>
              <p>Cargando personal...</p>
            </div>
          </td>
        </tr>
      `;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERIZAR TABLA
  // ─────────────────────────────────────────────────────────────────────────
  function _filtrarTabla() {
    const search    = (document.getElementById('personal-search')?.value || '').toLowerCase();
    const puesto    = document.getElementById('filter-puesto')?.value || '';
    const estado    = document.getElementById('filter-estado-personal')?.value || '';

    let data = AppState.get('personal') || [];

    if (search) {
      data = data.filter(p =>
        (p.Nombre_Completo || '').toLowerCase().includes(search) ||
        (p.DPI_CUI         || '').includes(search) ||
        (p.Puesto          || '').toLowerCase().includes(search)
      );
    }

    if (puesto) {
      data = data.filter(p => p.Puesto === puesto);
    }

    if (estado) {
      data = data.filter(p => p.Estado === estado);
    }

    _filteredPersonal = data;
    _renderTabla(data);
  }

  function _renderTabla(data) {
    const tbody   = document.getElementById('personal-tbody');
    const counter = document.getElementById('personal-count');
    if (!tbody) return;

    if (counter) {
      counter.textContent = `${data.length} trabajador${data.length !== 1 ? 'es' : ''}`;
    }

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8" class="text-center">
            <div class="empty-state">
              <i data-lucide="users"></i>
              <p>No se encontraron trabajadores</p>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons({ nodes: [tbody] });
      return;
    }

    tbody.innerHTML = data.map(p => {
      const ini = inicialesDeNombre(p.Nombre_Completo);
      const col = colorPorPuesto(p.Puesto);
      return `
      <tr data-id="${_escHtml(p.ID_Trabajador)}">
        <td>
          ${p.Fotografia_URL
            ? `<img src="${_escHtml(p.Fotografia_URL)}"
                   alt="Foto de ${_escHtml(p.Nombre_Completo)}"
                   class="worker-photo-small"
                   loading="lazy"
                   style="border-color:${col};"
                   onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';" />
               <div class="worker-photo-placeholder" style="border-color:${col};color:${col};font-size:var(--text-xs);font-weight:700;display:none;">${ini}</div>`
            : `<div class="worker-photo-placeholder" style="border-color:${col};color:${col};font-size:var(--text-xs);font-weight:700;">${ini}</div>`
          }
        </td>
        <td>
          <code style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--color-secondary)">
            ${_escHtml(p.ID_Trabajador)}
          </code>
        </td>
        <td><strong>${_escHtml(p.Nombre_Completo)}</strong></td>
        <td style="font-family:var(--font-mono)">${_escHtml(p.DPI_CUI)}</td>
        <td><span class="badge badge-blue">${_escHtml(p.Puesto)}</span></td>
        <td>
          ${p.Telefono
            ? `<a href="tel:${_escHtml(p.Telefono)}" style="color:var(--color-secondary)">${_escHtml(p.Telefono)}</a>`
            : '<span class="text-muted">—</span>'
          }
        </td>
        <td>
          <span class="${p.Estado === 'Activo' ? 'estado-activo' : 'estado-inactivo'}">
            ${_escHtml(p.Estado)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="table-action-btn qr"       data-action="qr"       data-id="${_escHtml(p.ID_Trabajador)}" title="Ver/Imprimir QR" aria-label="Ver QR de ${_escHtml(p.Nombre_Completo)}">
              <i data-lucide="qr-code"></i>
            </button>
            <button class="table-action-btn historial" data-action="historial" data-id="${_escHtml(p.ID_Trabajador)}" title="Historial de marcaciones" aria-label="Ver historial de ${_escHtml(p.Nombre_Completo)}">
              <i data-lucide="clock-3"></i>
            </button>
            <button class="table-action-btn edit"      data-action="edit"     data-id="${_escHtml(p.ID_Trabajador)}" title="Editar" aria-label="Editar ${_escHtml(p.Nombre_Completo)}">
              <i data-lucide="pencil"></i>
            </button>
            <button class="table-action-btn delete"    data-action="delete"   data-id="${_escHtml(p.ID_Trabajador)}" title="Dar de baja" aria-label="Dar de baja ${_escHtml(p.Nombre_Completo)}">
              <i data-lucide="user-x"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

    // Render Lucide icons en tabla
    if (window.lucide) lucide.createIcons({ nodes: [tbody] });

    // Delegación de eventos en tabla
    tbody.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit')      _abrirModalEditar(id);
      if (action === 'delete')    _confirmarEliminar(id);
      if (action === 'qr')        _abrirModalCarne(id);
      if (action === 'historial') _abrirModalHistorial(id);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL NUEVO / EDITAR
  // ─────────────────────────────────────────────────────────────────────────
  function _abrirModalNuevo() {
    _editingId   = null;
    _fotoBase64  = '';
    _resetForm();
    document.getElementById('modal-personal-title').textContent = 'Registrar Nuevo Trabajador';
    _abrirModal('modal-personal');
    // Activar cámara automáticamente al registrar nuevo trabajador
    setTimeout(() => _abrirCamara(), 300);
  }

  function _abrirModalEditar(id) {
    const personal = AppState.get('personal') || [];
    const trabajador = personal.find(p => p.ID_Trabajador === id);
    if (!trabajador) {
      Alerts.error('Trabajador no encontrado en cache. Actualiza la lista.');
      return;
    }

    _editingId  = id;
    _fotoBase64 = trabajador.Fotografia_URL || '';

    _resetForm();
    _llenarForm(trabajador);
    document.getElementById('modal-personal-title').textContent = 'Editar Trabajador';
    _abrirModal('modal-personal');
  }

  function _resetForm() {
    const form = document.getElementById('form-personal');
    if (form) form.reset();
    document.getElementById('personal-id').value = '';
    _fotoBase64 = '';
    _actualizarFotoPreview('');
    _clearErrors();
  }

  function _llenarForm(t) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('personal-id', t.ID_Trabajador);
    setVal('p-nombre',    t.Nombre_Completo);
    setVal('p-dpi',       t.DPI_CUI);
    setVal('p-puesto',    t.Puesto);
    setVal('p-jefe',      t.Jefe_Inmediato);
    setVal('p-telefono',  t.Telefono);
    setVal('p-whatsapp',  t.WhatsApp);
    setVal('p-direccion', t.Direccion);

    if (t.Fotografia_URL) {
      _fotoBase64 = t.Fotografia_URL;
      _actualizarFotoPreview(t.Fotografia_URL);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GUARDAR TRABAJADOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera un ID único para trabajadores locales con el prefijo TRAB-.
   * @returns {string}
   */
  function _generarIdLocal() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'TRAB-';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Guarda un trabajador directamente en AppState cuando no hay
   * Google Apps Script configurado (modo offline / sin conexión).
   * Replica la estructura de campos que usa el GAS backend.
   * @param {object} payload
   * @param {boolean} isEdit
   * @returns {{ success: boolean, message: string, offline: boolean }}
   */
  function _guardarPersonalLocal(payload, isEdit) {
    const personal = AppState.get('personal') ? [...AppState.get('personal')] : [];

    if (isEdit) {
      // Edición: actualizar el registro existente
      const idx = personal.findIndex(p => p.ID_Trabajador === payload.id);
      if (idx === -1) {
        return { success: false, error: 'Trabajador no encontrado en datos locales' };
      }
      const anterior = personal[idx];
      personal[idx] = {
        ...anterior,
        Nombre_Completo: payload.nombre,
        DPI_CUI:         payload.dpi,
        Puesto:          payload.puesto,
        Jefe_Inmediato:  payload.jefe     || '',
        Telefono:        payload.telefono || '',
        WhatsApp:        payload.whatsapp || '',
        Direccion:       payload.direccion || '',
        Fotografia_URL:  payload.fotografia || anterior.Fotografia_URL || '',
      };
    } else {
      // Nuevo trabajador
      const id     = _generarIdLocal();
      const ahora  = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const qrData = JSON.stringify({ id, dpi: payload.dpi, nombre: payload.nombre });

      personal.push({
        ID_Trabajador:   id,
        Nombre_Completo: payload.nombre,
        DPI_CUI:         payload.dpi,
        Puesto:          payload.puesto,
        Jefe_Inmediato:  payload.jefe      || '',
        Telefono:        payload.telefono  || '',
        WhatsApp:        payload.whatsapp  || '',
        Direccion:       payload.direccion || '',
        Fotografia_URL:  payload.fotografia || '',
        Codigo_QR_Data:  qrData,
        Fecha_Registro:  ahora,
        Estado:          'Activo',
      });
    }

    // Persistir en AppState y localStorage
    AppState.set('personal', personal);
    try {
      localStorage.setItem(LS_KEYS.PERSONAL_CACHE, JSON.stringify(personal));
    } catch (e) { /* ignorar quota errors */ }

    return {
      success: true,
      offline: true,
      message: isEdit
        ? 'Trabajador actualizado localmente (sin conexión con Google Sheets)'
        : 'Trabajador registrado localmente (sin conexión con Google Sheets)',
    };
  }

  async function _guardarPersonal() {
    if (!_validateForm()) return;

    const payload = {
      id:         _editingId,
      nombre:     document.getElementById('p-nombre').value.trim(),
      dpi:        document.getElementById('p-dpi').value.replace(/\D/g, ''),
      puesto:     document.getElementById('p-puesto').value,
      jefe:       document.getElementById('p-jefe').value.trim(),
      telefono:   _formatTelefono(document.getElementById('p-telefono').value.trim()),
      whatsapp:   document.getElementById('p-whatsapp').value.trim(),
      direccion:  document.getElementById('p-direccion').value.trim(),
      fotografia: _fotoBase64,
    };

    // Construir link de WhatsApp si se proporcionó número
    if (payload.whatsapp) {
      const numWA = payload.whatsapp.replace(/\D/g, '');
      payload.whatsapp = `https://wa.me/502${numWA}`;
    }

    // ── Modo offline: sin URL configurada, guardar localmente ──────────────
    if (!AppState.get('gasUrl')) {
      const result = _guardarPersonalLocal(payload, !!_editingId);
      if (result.success) {
        Alerts.success(result.message);
        _cerrarModal('modal-personal');
        _filtrarTabla();
      } else {
        Alerts.error(result.error || 'Error al guardar localmente', 'Error');
      }
      return;
    }

    // ── Modo online: enviar al GAS ─────────────────────────────────────────
    const loader  = Alerts.loading(_editingId ? 'Actualizando trabajador...' : 'Registrando trabajador...');
    const btnSave = document.getElementById('btn-guardar-personal');
    if (btnSave) btnSave.disabled = true;

    try {
      let result;
      if (_editingId) {
        result = await API.actualizarPersonal(payload);
      } else {
        result = await API.registrarPersonal(payload);
      }

      loader.close();

      if (result.success) {
        Alerts.success(result.message || (_editingId ? 'Trabajador actualizado' : 'Trabajador registrado'));
        _cerrarModal('modal-personal');
        _filtrarTabla();
      } else {
        Alerts.error(result.error || 'Error al guardar', 'Error');
      }
    } catch (err) {
      loader.close();
      Alerts.error(err.message, 'Error de conexión');
    } finally {
      if (btnSave) btnSave.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ELIMINAR (BAJA LÓGICA)
  // ─────────────────────────────────────────────────────────────────────────
  async function _confirmarEliminar(id) {
    const personal = AppState.get('personal') || [];
    const t = personal.find(p => p.ID_Trabajador === id);
    if (!t) return;

    const confirmed = await Alerts.confirm(
      `¿Dar de baja a "${t.Nombre_Completo}"?\n\nEsto cambiará su estado a Inactivo${AppState.get('gasUrl') ? ' en Google Sheets' : ' localmente'}.`,
      'Confirmar baja de trabajador'
    );

    if (!confirmed) return;

    // ── Modo offline ────────────────────────────────────────────────────────
    if (!AppState.get('gasUrl')) {
      const lista = personal.map(p =>
        p.ID_Trabajador === id ? { ...p, Estado: 'Inactivo' } : p
      );
      AppState.set('personal', lista);
      try { localStorage.setItem(LS_KEYS.PERSONAL_CACHE, JSON.stringify(lista)); } catch (e) {}
      Alerts.success(`${t.Nombre_Completo} dado de baja localmente`);
      _filtrarTabla();
      return;
    }

    // ── Modo online ─────────────────────────────────────────────────────────
    const loader = Alerts.loading('Procesando baja...');

    try {
      const result = await API.eliminarPersonal(id);
      loader.close();

      if (result.success) {
        Alerts.success(`${t.Nombre_Completo} dado de baja correctamente`);
        _filtrarTabla();
      } else {
        Alerts.error(result.error || 'Error al eliminar');
      }
    } catch (err) {
      loader.close();
      Alerts.error(err.message, 'Error');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL CARNÉ QR
  // ─────────────────────────────────────────────────────────────────────────
  function _abrirModalCarne(id) {
    const personal = AppState.get('personal') || [];
    const t = personal.find(p => p.ID_Trabajador === id);
    if (!t) {
      Alerts.error('Trabajador no encontrado');
      return;
    }

    const config = AppState.get('config');

    // Llenar datos del carné
    document.getElementById('carne-nombre').textContent    = t.Nombre_Completo || '--';
    document.getElementById('carne-puesto').textContent    = t.Puesto || '--';
    document.getElementById('carne-id').textContent        = t.ID_Trabajador || '--';
    document.getElementById('carne-dpi').textContent       = t.DPI_CUI || '--';
    document.getElementById('carne-empresa-nombre').textContent = config.Nombre_App || APP_NAME;
    document.getElementById('carne-obra-nombre').textContent    = config.Nombre_Obra || 'Obra Principal';

    // Foto del trabajador en carné
    const carneFoto = document.getElementById('carne-foto');
    if (t.Fotografia_URL) {
      carneFoto.src = t.Fotografia_URL;
      carneFoto.style.display = 'block';
    } else {
      carneFoto.src = '';
      carneFoto.style.display = 'none';
    }

    // Logo en carné
    const carneLogo = document.getElementById('carne-logo');
    if (config.Logo_Base64) {
      carneLogo.src = config.Logo_Base64;
      carneLogo.hidden = false;
    } else {
      carneLogo.hidden = true;
    }

    // Abrir modal PRIMERO para que el contenedor tenga layout real en el DOM
    _abrirModal('modal-carne');

    // Limpiar QR previo
    const qrContainer = document.getElementById('carne-qr-container');
    if (qrContainer) qrContainer.innerHTML = '';

    // renderCarneQR maneja su propio timing con rAF interno
    QRGenerator.renderCarneQR(t);
  }

  function _imprimirCarne() {
    document.body.classList.add('print-carne');
    window.print();
    document.body.classList.remove('print-carne');
  }

  async function _descargarCarnePNG() {
    if (typeof html2canvas === 'undefined') {
      Alerts.error('html2canvas no está disponible. Verifica la conexión a internet.');
      return;
    }

    const carneEl = document.getElementById('carne-print-area');
    if (!carneEl) return;

    const btn = document.getElementById('btn-descargar-carne-png');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" style="animation:spin 0.7s linear infinite"></i> Generando...';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });
    }

    try {
      const canvas = await html2canvas(carneEl, {
        scale:           3,          // Alta resolución para impresión
        useCORS:         true,       // Para imágenes externas (fotos)
        allowTaint:      true,
        backgroundColor: '#003459',  // Fondo del carné
        logging:         false,
      });

      // Obtener nombre del trabajador desde el carné para el filename
      const nombre = document.getElementById('carne-nombre')?.textContent?.trim() || 'trabajador';
      const id     = document.getElementById('carne-id')?.textContent?.trim()     || '';
      const slug   = (nombre + '-' + id).toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Descargar
      const link     = document.createElement('a');
      link.download  = `carne-${slug}.png`;
      link.href      = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Alerts.success(`Carné de ${nombre} descargado como imagen PNG`);

    } catch (err) {
      Alerts.error('Error al generar la imagen: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="image-down"></i> Descargar PNG';
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CÁMARA — Captura de foto del trabajador
  // ─────────────────────────────────────────────────────────────────────────
  let _cameraStream      = null;   // MediaStream activo
  let _cameraFacingMode  = 'user'; // 'user' (frontal) | 'environment' (trasera)
  let _capturedPhotoData = '';     // Base64 de la foto capturada (pre-confirmación)

  /** Abre el modal de cámara e inicia el stream de video. */
  async function _abrirCamara() {
    const modal = document.getElementById('modal-camera');
    if (!modal) return;

    _capturedPhotoData = '';
    _mostrarEstadoCamara('live');
    modal.hidden = false;
    await _iniciarStream();
  }

  /** Inicia (o reinicia) el stream con el facing mode actual. */
  async function _iniciarStream() {
    _detenerStream();

    const statusLabel = document.getElementById('camera-status-label');
    const errorDiv    = document.getElementById('camera-error-msg');
    const videoEl     = document.getElementById('camera-video');
    const viewerWrap  = document.querySelector('.camera-viewer-wrapper');

    if (statusLabel) statusLabel.textContent = 'Iniciando cámara...';
    if (errorDiv)    errorDiv.hidden = true;
    if (viewerWrap)  viewerWrap.style.display = '';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      _mostrarErrorCamara('Tu navegador no soporta acceso a la cámara. Usa Chrome, Edge o Safari actualizado.');
      return;
    }

    try {
      _cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: _cameraFacingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });

      if (videoEl) {
        videoEl.srcObject = _cameraStream;
        videoEl.onloadedmetadata = () => {
          videoEl.play().catch(() => {});
          if (statusLabel) {
            const label = _cameraStream.getVideoTracks()[0]?.label || 'Cámara activa';
            statusLabel.textContent = label.length > 42 ? label.substring(0, 39) + '...' : label;
          }
        };
      }
    } catch (err) {
      let msg = 'No se pudo acceder a la cámara.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No se encontró ninguna cámara en este dispositivo.';
      } else if (err.name === 'NotReadableError') {
        msg = 'La cámara está siendo usada por otra aplicación.';
      } else if (err.name === 'OverconstrainedError') {
        // Reintentar sin restricciones de facing mode
        try {
          _cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (videoEl) { videoEl.srcObject = _cameraStream; videoEl.play().catch(() => {}); }
          if (statusLabel) statusLabel.textContent = 'Cámara activa';
          return;
        } catch (_) { msg = 'No se pudo configurar la cámara. Intenta voltear.'; }
      }
      _mostrarErrorCamara(msg);
    }
  }

  /** Detiene el stream y libera la cámara. */
  function _detenerStream() {
    if (_cameraStream) {
      _cameraStream.getTracks().forEach(t => t.stop());
      _cameraStream = null;
    }
    const videoEl = document.getElementById('camera-video');
    if (videoEl) videoEl.srcObject = null;
  }

  /** Captura el frame actual como imagen JPEG. */
  function _capturarFoto() {
    const videoEl = document.getElementById('camera-video');
    const canvas  = document.getElementById('camera-canvas');
    const preview = document.getElementById('camera-captured-img');
    if (!videoEl || !canvas) return;

    const w = videoEl.videoWidth  || 640;
    const h = videoEl.videoHeight || 480;
    canvas.width  = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    // Voltear horizontalmente si es cámara frontal (efecto espejo natural)
    if (_cameraFacingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, w, h);

    _capturedPhotoData = canvas.toDataURL('image/jpeg', 0.88);
    if (preview) preview.src = _capturedPhotoData;

    _detenerStream();
    _mostrarEstadoCamara('preview');
  }

  /** Alterna cámara frontal ↔ trasera. */
  async function _voltearCamara() {
    _cameraFacingMode = _cameraFacingMode === 'user' ? 'environment' : 'user';
    _mostrarEstadoCamara('live');
    await _iniciarStream();
  }

  /** Comprime y aplica la foto capturada al formulario. */
  function _usarFotoCapturada() {
    if (!_capturedPhotoData) return;
    const img = new Image();
    img.onload = () => {
      const compressed = _comprimirFoto(img, 600, 600, 0.80);
      _fotoBase64 = compressed;
      _actualizarFotoPreview(compressed);
      _cerrarCamara();
    };
    img.src = _capturedPhotoData;
  }

  /** Cierra el modal de cámara y libera todos los recursos. */
  function _cerrarCamara() {
    _detenerStream();
    _capturedPhotoData = '';
    const modal = document.getElementById('modal-camera');
    if (modal) modal.hidden = true;
  }

  /** Muestra un mensaje de error dentro del modal de cámara. */
  function _mostrarErrorCamara(msg) {
    const errorDiv   = document.getElementById('camera-error-msg');
    const errorText  = document.getElementById('camera-error-text');
    const viewerWrap = document.querySelector('.camera-viewer-wrapper');
    if (errorDiv)    errorDiv.hidden = false;
    if (errorText)   errorText.textContent = msg;
    if (viewerWrap)  viewerWrap.style.display = 'none';
    const statusLabel = document.getElementById('camera-status-label');
    if (statusLabel) statusLabel.textContent = 'Error de cámara';
  }

  /**
   * Alterna los estados del modal de cámara.
   * @param {'live'|'preview'} estado
   */
  function _mostrarEstadoCamara(estado) {
    const footerLive    = document.getElementById('camera-footer-live');
    const footerPreview = document.getElementById('camera-footer-preview');
    const viewerWrap    = document.querySelector('.camera-viewer-wrapper');
    const previewSec    = document.getElementById('camera-preview-section');
    const errorDiv      = document.getElementById('camera-error-msg');

    if (estado === 'live') {
      if (footerLive)    footerLive.hidden    = false;
      if (footerPreview) footerPreview.hidden = true;
      if (viewerWrap)    viewerWrap.style.display = '';
      if (previewSec)    previewSec.hidden = true;
      if (errorDiv)      errorDiv.hidden   = true;
    } else {
      if (footerLive)    footerLive.hidden    = true;
      if (footerPreview) footerPreview.hidden = false;
      if (viewerWrap)    viewerWrap.style.display = 'none';
      if (previewSec)    previewSec.hidden = false;
    }
  }

  /** Elimina la foto y restaura el placeholder. */
  function _eliminarFoto() {
    _fotoBase64 = '';
    _actualizarFotoPreview('');
    const fotoInput = document.getElementById('foto-input');
    if (fotoInput) fotoInput.value = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOTO UPLOAD Y COMPRESIÓN
  // ─────────────────────────────────────────────────────────────────────────
  function _handleFotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Alerts.error('El archivo debe ser una imagen (JPG, PNG, etc.)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const compressed = _comprimirFoto(img, 600, 600, 0.75);
        _fotoBase64 = compressed;
        _actualizarFotoPreview(compressed);

        // Verificar tamaño
        const sizeKB = Math.round((compressed.length * 3) / 4 / 1024);
        if (sizeKB > 250) {
          Alerts.warning(`La imagen comprimida pesa ${sizeKB}KB. Se recomienda menos de 200KB.`);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function _comprimirFoto(img, maxW = 600, maxH = 600, quality = 0.75) {
    const canvas = document.createElement('canvas');
    let { width, height } = img;

    if (width > maxW || height > maxH) {
      const ratio = Math.min(maxW / width, maxH / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);
    }

    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function _actualizarFotoPreview(src) {
    const preview     = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');

    if (src) {
      if (preview) {
        preview.src = src;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (preview) {
        preview.src = '';
        preview.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'flex';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDACIONES
  // ─────────────────────────────────────────────────────────────────────────
  function _validateForm() {
    let valid = true;

    // Nombre
    const nombre = document.getElementById('p-nombre')?.value.trim();
    if (!nombre || nombre.length < 3) {
      _showError('p-nombre-error', 'El nombre debe tener al menos 3 caracteres');
      valid = false;
    } else {
      _clearError('p-nombre-error');
    }

    // DPI
    const dpi = document.getElementById('p-dpi')?.value.replace(/\D/g, '');
    if (!_validateDPI(dpi)) {
      valid = false;
    }

    // Puesto
    const puesto = document.getElementById('p-puesto')?.value;
    if (!puesto) {
      _showError('p-puesto-error', 'Selecciona un puesto de trabajo');
      valid = false;
    } else {
      _clearError('p-puesto-error');
    }

    return valid;
  }

  function _validateDPI(dpi) {
    const clean = (dpi || '').replace(/\D/g, '');
    if (clean.length !== 13) {
      _showError('p-dpi-error', 'El DPI/CUI debe tener exactamente 13 dígitos');
      return false;
    }
    _clearError('p-dpi-error');
    return true;
  }

  function _showError(errorId, message) {
    const el = document.getElementById(errorId);
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  function _clearError(errorId) {
    const el = document.getElementById(errorId);
    if (el) {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function _clearErrors() {
    ['p-nombre-error', 'p-dpi-error', 'p-puesto-error'].forEach(_clearError);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────────────────────────────────
  function _formatTelefono(tel) {
    if (!tel) return '';
    const num = tel.replace(/\D/g, '');
    if (num.length === 8) return `+502 ${num.substring(0, 4)}-${num.substring(4)}`;
    return tel;
  }

  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function _abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.hidden = false;
      // Focus primer input del modal
      const firstInput = modal.querySelector('input:not([hidden]):not([type="file"])');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  function _cerrarModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORIAL DE MARCACIONES POR TRABAJADOR
  // ─────────────────────────────────────────────────────────────────────────
  let _historialWorkerId = null;

  function _abrirModalHistorial(id) {
    const personal  = AppState.get('personal') || [];
    const trabajador = personal.find(p => p.ID_Trabajador === id);
    if (!trabajador) { Alerts.error('Trabajador no encontrado'); return; }

    _historialWorkerId = id;

    // Encabezado del modal
    const title = document.getElementById('modal-historial-title');
    const sub   = document.getElementById('modal-historial-sub');
    if (title) title.textContent = `Historial — ${trabajador.Nombre_Completo}`;
    if (sub)   sub.textContent   = `${trabajador.Puesto} · DPI: ${trabajador.DPI_CUI}`;

    // Fechas default: últimos 30 días
    const hoy    = AppState.today();
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    const hace30Str = `${hace30.getFullYear()}-${String(hace30.getMonth()+1).padStart(2,'0')}-${String(hace30.getDate()).padStart(2,'0')}`;

    const fechaIni = document.getElementById('historial-fecha-inicio');
    const fechaFin = document.getElementById('historial-fecha-fin');
    if (fechaIni) fechaIni.value = hace30Str;
    if (fechaFin) fechaFin.value = hoy;

    // Limpiar contenido
    const resumen = document.getElementById('historial-resumen');
    const content = document.getElementById('historial-content');
    if (resumen) resumen.hidden = true;
    if (content) content.innerHTML = `
      <div class="empty-state" style="padding:var(--space-10)">
        <i data-lucide="clock" aria-hidden="true"></i>
        <p>Selecciona un rango de fechas y haz click en Buscar</p>
      </div>`;
    if (window.lucide) lucide.createIcons({ nodes: [content] });

    // Bind botón buscar (re-bind cada vez para closure correcto)
    const btnBuscar = document.getElementById('btn-buscar-historial');
    if (btnBuscar) {
      const newBtn = btnBuscar.cloneNode(true);
      btnBuscar.parentNode.replaceChild(newBtn, btnBuscar);
      newBtn.addEventListener('click', () => _cargarHistorial(_historialWorkerId));
    }

    _abrirModal('modal-historial');

    // Cargar inmediatamente con el rango default
    _cargarHistorial(id);
  }

  async function _cargarHistorial(workerId) {
    const fechaIni = document.getElementById('historial-fecha-inicio')?.value;
    const fechaFin = document.getElementById('historial-fecha-fin')?.value;

    if (!fechaIni || !fechaFin) { Alerts.error('Selecciona un rango de fechas'); return; }
    if (fechaIni > fechaFin)    { Alerts.error('La fecha inicio debe ser anterior al fin'); return; }

    const content = document.getElementById('historial-content');
    const resumen = document.getElementById('historial-resumen');

    if (content) content.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner spinner-lg"></div>
        <p>Cargando historial...</p>
      </div>`;

    try {
      let asistencias = [];

      if (AppState.get('gasUrl')) {
        if (fechaIni === fechaFin) {
          const r = await API.obtenerAsistencias(fechaIni);
          if (r.success) asistencias = r.data;
        } else {
          const r = await API.obtenerAsistenciaRango(fechaIni, fechaFin);
          if (r.success) asistencias = r.data;
        }
      } else {
        asistencias = (AppState.get('asistencias') || []);
      }

      // Filtrar solo las del trabajador
      const misMarcaciones = asistencias.filter(a => a.ID_Trabajador === workerId);

      // ── Calcular estadísticas ──────────────────────────────────────────
      const personal  = (AppState.get('personal') || []);
      const diasRango = _diasEnRango(fechaIni, fechaFin);

      // Días con al menos una marcación de Entrada
      const diasConEntrada = new Set(
        misMarcaciones.filter(a => a.Tipo_Marcacion === 'Entrada').map(a => a.Fecha)
      );
      const tardanzas = misMarcaciones.filter(a =>
        a.Tipo_Marcacion === 'Entrada' &&
        (a.Estado_Marcacion === 'Atraso' || a.Estado_Marcacion === 'Tolerancia')
      ).length;
      const horasExtra = misMarcaciones.reduce((sum, a) => sum + (parseFloat(a.Horas_Extra) || 0), 0);
      const ausencias  = Math.max(0, diasRango - diasConEntrada.size);

      // Actualizar tarjetas de resumen
      _setEl('hstat-dias',       diasConEntrada.size);
      _setEl('hstat-tardanzas',  tardanzas);
      _setEl('hstat-horas-extra', horasExtra.toFixed(1) + 'h');
      _setEl('hstat-ausencias',  ausencias);
      if (resumen) resumen.hidden = false;

      if (misMarcaciones.length === 0) {
        if (content) content.innerHTML = `
          <div class="empty-state" style="padding:var(--space-8)">
            <i data-lucide="inbox" aria-hidden="true"></i>
            <p>No hay marcaciones en el período seleccionado</p>
          </div>`;
        if (window.lucide) lucide.createIcons({ nodes: [content] });
        return;
      }

      // ── Agrupar por día para el timeline ──────────────────────────────
      const porDia = {};
      misMarcaciones.forEach(a => {
        if (!porDia[a.Fecha]) porDia[a.Fecha] = [];
        porDia[a.Fecha].push(a);
      });

      const fechasOrdenadas = Object.keys(porDia).sort().reverse();

      const estadoColor = {
        'Puntual':    'var(--color-accent-green)',
        'Tolerancia': 'var(--color-accent-amber)',
        'Atraso':     'var(--color-accent-red)',
        'Extra':      'var(--color-secondary)',
      };

      const tipoIcono = {
        'Entrada':        'log-in',
        'Salida_Receso':  'coffee',
        'Regreso_Receso': 'arrow-left-right',
        'Salida_Obra':    'log-out',
      };

      const tipoLabel = {
        'Entrada':        'Entrada',
        'Salida_Receso':  'Salida Receso',
        'Regreso_Receso': 'Regreso Receso',
        'Salida_Obra':    'Salida Obra',
      };

      const html = fechasOrdenadas.map(fecha => {
        const marcsDia = porDia[fecha].sort((a, b) => (a.Hora_Real || '').localeCompare(b.Hora_Real || ''));
        const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', {
          weekday: 'long', day: 'numeric', month: 'long',
        });

        const tieneEntrada = marcsDia.some(m => m.Tipo_Marcacion === 'Entrada');
        const tieneSalida  = marcsDia.some(m => m.Tipo_Marcacion === 'Salida_Obra');
        const estadosDia   = marcsDia.filter(m => m.Estado_Marcacion).map(m => m.Estado_Marcacion);
        const tieneAtraso  = estadosDia.some(e => e === 'Atraso');
        const tieneToler   = estadosDia.some(e => e === 'Tolerancia');

        const badgeColor = tieneAtraso ? 'badge-red' : tieneToler ? 'badge-amber' : 'badge-green';
        const badgeText  = tieneAtraso ? 'Tardanza' : tieneToler ? 'Tolerancia' : 'Puntual';

        return `
          <div class="historial-dia">
            <div class="historial-dia-header">
              <div>
                <span class="historial-dia-fecha">${fechaFmt}</span>
                ${tieneEntrada ? `<span class="badge ${badgeColor}" style="margin-left:var(--space-2)">${badgeText}</span>` : '<span class="badge" style="margin-left:var(--space-2);opacity:0.5">Sin entrada</span>'}
              </div>
              <div style="display:flex;gap:var(--space-2)">
                ${tieneEntrada ? '<span title="Entró"><i data-lucide="log-in" style="width:14px;height:14px;color:var(--color-accent-green)"></i></span>' : ''}
                ${tieneSalida  ? '<span title="Salió"><i data-lucide="log-out" style="width:14px;height:14px;color:var(--color-accent-red)"></i></span>' : ''}
              </div>
            </div>
            <div class="historial-timeline">
              ${marcsDia.map(m => `
                <div class="historial-marcacion">
                  <span class="historial-hora">${m.Hora_Real ? m.Hora_Real.substring(0,5) : '--:--'}</span>
                  <span class="historial-icono" style="color:${estadoColor[m.Estado_Marcacion] || 'var(--color-text-muted)'}">
                    <i data-lucide="${tipoIcono[m.Tipo_Marcacion] || 'clock'}" style="width:14px;height:14px"></i>
                  </span>
                  <span class="historial-tipo">${tipoLabel[m.Tipo_Marcacion] || m.Tipo_Marcacion}</span>
                  ${m.Estado_Marcacion ? `<span class="badge" style="font-size:0.65rem;padding:2px 6px;background:${estadoColor[m.Estado_Marcacion]}20;color:${estadoColor[m.Estado_Marcacion]};border:1px solid ${estadoColor[m.Estado_Marcacion]}40">${m.Estado_Marcacion}</span>` : ''}
                  ${m.Horas_Extra && parseFloat(m.Horas_Extra) > 0 ? `<span class="badge badge-blue" style="font-size:0.65rem;padding:2px 6px">+${m.Horas_Extra}h extra</span>` : ''}
                  <span class="historial-metodo text-muted">${m.Metodo_Registro || ''}</span>
                </div>`).join('')}
            </div>
          </div>`;
      }).join('');

      if (content) {
        content.innerHTML = `<div class="historial-lista">${html}</div>`;
        if (window.lucide) lucide.createIcons({ nodes: [content] });
      }

    } catch (err) {
      if (content) content.innerHTML = `<p class="text-muted text-center" style="padding:var(--space-6)">Error al cargar historial: ${err.message}</p>`;
      console.error('[Personal] Error cargando historial:', err);
    }
  }

  function _diasEnRango(fechaInicio, fechaFin) {
    const ini = new Date(fechaInicio + 'T12:00:00');
    const fin = new Date(fechaFin + 'T12:00:00');
    let count = 0;
    const cur = new Date(ini);
    while (cur <= fin) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++; // Solo días hábiles
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── API Pública del Módulo ───────────────────────────────────────────────
  return {
    init,
    cargar,
    abrirModalCarne: _abrirModalCarne,
  };
})();
