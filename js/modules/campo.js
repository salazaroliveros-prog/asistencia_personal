/**
 * CONTROL PERSONAL CAMPO — modules/campo.js
 * "Sub-app" de campo: vista instalable pensada para operarse en un móvil
 * dentro de la obra. Escanea el QR del carné, captura GPS opcional y registra
 * la marcación en Firestore en tiempo real (con cola offline como respaldo).
 * @version 1.5.0
 */

const _ModuloCampo = (() => {

  // ─── Estado del módulo ──────────────────────────────────────────────────
  let _scanner          = null;
  let _scannerActive    = false;
  let _qrController     = null;
  let _cameraFacingMode = 'environment';
  let _currentWorker    = null;
  let _audio            = null;
  let _marking          = false;

  const MARK_TYPES = [
    { tipo: 'Entrada',        cls: 'campo-mark-entry',  icono: 'log-in',           horaKey: 'Hora_Entrada',        fallback: '07:00' },
    { tipo: 'Salida_Receso',  cls: 'campo-mark-break',  icono: 'coffee',            horaKey: 'Hora_Salida_Receso',  fallback: '10:00' },
    { tipo: 'Regreso_Receso', cls: 'campo-mark-resume', icono: 'arrow-left-right',  horaKey: 'Hora_Regreso_Receso', fallback: '10:30' },
    { tipo: 'Salida_Obra',    cls: 'campo-mark-exit',   icono: 'log-out',           horaKey: 'Hora_Salida_Obra',    fallback: '17:00' },
  ];

  function esc(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Inicialización ─────────────────────────────────────────────────────
  function init() {
    if (window.Logger) window.Logger.info('ModuloCampo', 'Inicializando módulo de campo');
    _bindEvents();
    _initAudio();
    _renderMarkButtons();
    _updateStatus();
  }

  function _bindEvents() {
    const btnStart    = document.getElementById('campo-btn-scan');
    const btnStop     = document.getElementById('campo-btn-stop');
    const btnSwitch   = document.getElementById('campo-btn-switch-camera');
    const camSelect   = document.getElementById('campo-camera-select');

    if (btnStart)  btnStart.addEventListener('click', () => _iniciarScanner());
    if (btnStop)   btnStop.addEventListener('click', _detenerScanner);
    if (btnSwitch) btnSwitch.addEventListener('click', _cambiarCamara);
    if (camSelect) camSelect.addEventListener('change', () => _iniciarScanner({ deviceId: camSelect.value }));
    window.addEventListener('pagehide', _detenerScanner);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.campo-mark-btn');
      if (btn && btn.dataset && btn.dataset.tipo) _procesarMarcacion(btn.dataset.tipo);
    });

    AppState.on('asistencias', () => _renderFeed());
    AppState.on('connected',   () => _updateStatus());
  }

  function _initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      _audio = {
        beepSuccess() {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine'; osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.27, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.28);
        },
        beepError() {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'square'; osc.frequency.value = 220;
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
        },
      };
    } catch (e) { /* Audio no disponible */ }
  }

  /**
   * Renderiza los botones de marcación con horarios configurados
   * @returns {void}
   */
  function _renderMarkButtons() {
    const grid = document.getElementById('campo-mark-grid');
    if (!grid) return;
    const config = AppState.get('config') || window.DEFAULT_CONFIG || {};
    grid.innerHTML = MARK_TYPES.map((m) => {
      const hora = config[m.horaKey] || m.fallback;
      return `
        <button type="button" class="campo-mark-btn ${m.cls}" data-tipo="${m.tipo}" aria-label="Marcar ${m.tipo.replace(/_/g, ' ')} a las ${hora}">
          <i data-lucide="${m.icono}" aria-hidden="true"></i>
          <span>${m.tipo.replace(/_/g, ' ')}</span>
          <span class="campo-mark-time">${hora}</span>
        </button>`;
    }).join('');
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ESCÁNER QR — usa CameraSession para soporte multi-cámara y torch
  // ─────────────────────────────────────────────────────────────────────────
  function _cameraSession() {
    return window.CPC && window.CPC.CameraSession;
  }

  function _setCameraStatus(message) {
    const el = document.getElementById('campo-camera-status');
    if (el) el.textContent = message;
  }

  function _setScannerBusy(busy) {
    ['campo-btn-scan', 'campo-btn-stop', 'campo-btn-switch-camera', 'campo-camera-select'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = busy;
    });
  }

  async function _loadCameraChoices() {
    const session   = _cameraSession();
    const select    = document.getElementById('campo-camera-select');
    const switchBtn = document.getElementById('campo-btn-switch-camera');
    if (!session || !select) return;
    try {
      const devices = await session.listDevices();
      select.innerHTML = devices.map((d) =>
        `<option value="${esc(d.id)}">${esc(d.label)}</option>`,
      ).join('');
      const multi = devices.length >= 2;
      select.hidden = !multi;
      if (switchBtn) switchBtn.hidden = !multi;
    } catch (_) { /* enumeración no disponible */ }
  }

  async function _iniciarScanner(options = {}) {
    const session = _cameraSession();
    if (typeof Html5Qrcode === 'undefined' || !session) {
      Alerts.error('El escáner QR no está disponible. Verifica los recursos.', 'Error');
      return;
    }
    _setScannerBusy(true);
    _setCameraStatus('Iniciando cámara…');
    try {
      if (!_qrController) {
        _qrController = session.createQrController({
          Scanner: Html5Qrcode,
          elementId: 'campo-qr-reader',
          onSuccess: _onQRSuccess,
        });
      }
      const result = await _qrController.start({ facingMode: _cameraFacingMode, ...options });
      if (!result) return;
      _scanner = result.scanner;
      _scannerActive = true;
      const btnStart = document.getElementById('campo-btn-scan');
      const btnStop  = document.getElementById('campo-btn-stop');
      if (btnStart) btnStart.hidden = true;
      if (btnStop)  btnStop.hidden  = false;
      _setCameraStatus('Cámara activa');
      await _loadCameraChoices();
      _injectTorchButton();
    } catch (error) {
      _setCameraStatus('Cámara no disponible');
      Alerts.error(session.describeError(error), 'Error de cámara');
    } finally {
      _setScannerBusy(false);
    }
  }

  async function _detenerScanner() {
    if (_qrController) await _qrController.stop();
    _scanner = null;
    _scannerActive = false;
    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.hidden = false;
    if (btnStop)  btnStop.hidden  = true;
    _removeTorchButton();
    _setCameraStatus('Cámara detenida');
  }

  async function _cambiarCamara() {
    _cameraFacingMode = _cameraFacingMode === 'environment' ? 'user' : 'environment';
    await _iniciarScanner();
  }

  // ─── Torch/Flash ─────────────────────────────────────────────────────────
  function _injectTorchButton() {
    // Soporta tanto .campo-scan-btns (index.html) como .campo-scanner-actions (field-scanner.html)
    const container = document.querySelector('.campo-scan-btns') ||
                      document.querySelector('.campo-scanner-actions');
    if (!container || document.getElementById('campo-btn-torch')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id   = 'campo-btn-torch';
    btn.className = 'btn btn-ghost';
    btn.setAttribute('aria-label', 'Activar/desactivar flash');
    btn.innerHTML = '<i data-lucide="flashlight" aria-hidden="true"></i> Flash';
    btn.hidden = !(_qrController && _qrController.supportsTorch());
    btn.addEventListener('click', _toggleTorch);
    container.appendChild(btn);
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }

  function _removeTorchButton() {
    document.getElementById('campo-btn-torch')?.remove();
  }

  async function _toggleTorch() {
    try {
      if (!_qrController || !_qrController.supportsTorch()) {
        Alerts.warning('Flash no disponible en este dispositivo');
        return;
      }
      const on = await _qrController.toggleTorch();
      const btn = document.getElementById('campo-btn-torch');
      if (btn) {
        btn.innerHTML = `<i data-lucide="${on ? 'flashlight-off' : 'flashlight'}" aria-hidden="true"></i> ${on ? 'Apagar flash' : 'Flash'}`;
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      }
    } catch (err) {
      console.error('[Campo] Error toggle torch:', err);
      Alerts.error('Error al cambiar flash: ' + err.message);
    }
  }

  // ─── QR Success ──────────────────────────────────────────────────────────
  function _onQRSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(80);
    if (_audio) _audio.beepSuccess();

    const qrData = QRGenerator.parseQRData(decodedText);
    if (!qrData) { Alerts.warning('QR no reconocido. Usa un carné de este sistema.'); return; }

    const trabajador = QRGenerator.buscarTrabajadorPorQR(qrData);
    if (!trabajador) {
      if (_audio) _audio.beepError();
      Alerts.error('Trabajador no encontrado. ID: ' + (qrData.id || '—'), 'No encontrado');
      return;
    }

    _detenerScanner();
    _currentWorker = trabajador;
    _renderWorker(trabajador);
    _habilitaBotones(true);
    _captureGPS();
  }

  function _renderWorker(trabajador) {
    const panel = document.getElementById('campo-worker');
    if (!panel) return;

    const nameEl   = document.getElementById('campo-worker-name');
    const puestoEl = document.getElementById('campo-worker-puesto');
    const idEl     = document.getElementById('campo-worker-id');
    const photo    = document.getElementById('campo-worker-photo');
    const avatar   = document.getElementById('campo-worker-avatar');

    if (nameEl)   nameEl.textContent   = trabajador.Nombre_Completo || '--';
    if (puestoEl) puestoEl.textContent = trabajador.Puesto || '--';
    if (idEl)     idEl.textContent     = trabajador.ID_Trabajador || '--';

    if (photo) {
      if (trabajador.Fotografia_URL) { photo.src = trabajador.Fotografia_URL; photo.style.display = 'block'; }
      else { photo.removeAttribute('src'); photo.style.display = 'none'; }
    }
    if (avatar) {
      const ini = String(trabajador.Nombre_Completo || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      avatar.textContent = ini || '?';
    }

    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _habilitaBotones(enable) {
    document.querySelectorAll('.campo-mark-btn').forEach((btn) => { btn.disabled = !enable; });
  }

  // ─── GPS / geocerca ──────────────────────────────────────────────────────
  function _scope() {
    const config = AppState.get('config') || window.DEFAULT_CONFIG || {};
    const center = (config.GPS_Centro_Lat && config.GPS_Centro_Lon)
      ? { lat: parseFloat(config.GPS_Centro_Lat), lon: parseFloat(config.GPS_Centro_Lon) }
      : null;
    return { enabled: config.GPS_Habilitado !== false, center, radius: parseInt(config.GPS_Radio_Metros || 200, 10) };
  }

  function _scopeGPS() {
    const s = _scope();
    return s.enabled && window.GPS && typeof GPS.getCurrentPosition === 'function';
  }

  async function _captureGPS() {
    const gpsEl = document.getElementById('campo-gps');
    const lbl   = document.getElementById('campo-gps-label');
    if (gpsEl) gpsEl.hidden = !_scopeGPS();
    if (!_scopeGPS()) return;

    try {
      const pos = await GPS.getCurrentPosition();
      const s   = _scope();
      let info  = `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
      if (s.center) {
        const f = GPS.checkGeofence(
          { latitude: pos.latitude, longitude: pos.longitude },
          { latitude: s.center.lat, longitude: s.center.lon },
          s.radius,
        );
        info += f.inside ? ' · Dentro de geocerca' : ` · Fuera (${f.distance}m)`;
        if (gpsEl) gpsEl.classList.toggle('out-of-fence', !f.inside);
      }
      if (lbl) lbl.textContent = info;
    } catch (err) {
      if (lbl) lbl.textContent = err.message || 'GPS no disponible';
    }
  }

  // ─── Marcación ───────────────────────────────────────────────────────────
  async function _procesarMarcacion(tipo) {
    if (!_currentWorker) { Alerts.info('Escanea primero el QR del trabajador.'); return; }
    if (_marking) return;
    _marking = true;
    _habilitaBotones(false);

    const config = AppState.get('config') || window.DEFAULT_CONFIG || {};
    const hoy    = AppState.today ? AppState.today() : new Date().toISOString().slice(0, 10);

    let lat = null, lon = null, dentroFence = null;
    if (_scopeGPS()) {
      try {
        const pos = await GPS.getCurrentPosition();
        lat = pos.latitude; lon = pos.longitude;
        const s = _scope();
        if (s.center) {
          dentroFence = GPS.checkGeofence(
            { latitude: lat, longitude: lon },
            { latitude: s.center.lat, longitude: s.center.lon },
            s.radius,
          ).inside;
        }
      } catch (_) { /* sin GPS → se marca sin ubicación */ }
    }

    const payload = {
      ID_Trabajador:    _currentWorker.ID_Trabajador,
      Nombre_Trabajador: _currentWorker.Nombre_Completo,
      Tipo_Marcacion:   tipo,
      Fecha:            hoy,
      Metodo_Registro:  'Escaneo_QR',
      Ubicacion_Obra:   config.Nombre_Obra || '',
    };
    if (lat !== null)         payload.GPS_Latitud         = lat;
    if (lon !== null)         payload.GPS_Longitud        = lon;
    if (dentroFence !== null) payload.GPS_Dentro_Geocerca = dentroFence;

    try {
      const resp     = await API.registrarMarcacion(payload);
      const estado   = resp.estadoMarcacion || (resp.data && resp.data[0] && resp.data[0].Estado_Marcacion) || 'A Tiempo';
      const horaReal = (resp && resp.horaReal) || new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
      const offline  = !!(resp.offline) || (typeof API.isOffline === 'function' && API.isOffline());
      if (_audio) _audio.beepSuccess();
      Alerts.marcacion({ nombre: _currentWorker.Nombre_Completo || 'Trabajador', tipo, horaReal, estado });
      if (offline) Alerts.warning('Sin conexión: la marca quedó en cola y se sincronizará automáticamente.', 'Modo offline');
      _renderFeed();
    } catch (err) {
      if (_audio) _audio.beepError();
      Alerts.error('No se pudo registrar la marca: ' + err.message, 'Error');
    } finally {
      _marking = false;
      _currentWorker = null;
      _habilitaBotones(false);
      setTimeout(() => { if (!_scannerActive) _iniciarScanner(); }, 450);
    }
  }

  // ─── Feed de marcas recientes ─────────────────────────────────────────────
  function _renderFeed() {
    const list = document.getElementById('campo-feed-list');
    if (!list) return;
    const all    = AppState.get('asistencias') || [];
    const hoy    = AppState.today ? AppState.today() : new Date().toISOString().slice(0, 10);
    const recent = all.filter((a) => a.Fecha === hoy).slice(-6).reverse();

    if (!recent.length) {
      list.innerHTML = '<li class="campo-feed-empty">Aún no hay marcaciones hoy.</li>';
      return;
    }
    const pendSet = new Set((API.getOfflineQueue ? API.getOfflineQueue() : []).map((q) => q && q.payload && q.payload.ID_Marcacion));
    list.innerHTML = recent.map((a) => {
      const pend = pendSet.has(a.ID_Marcacion) ? ' pending' : '';
      const hora = (a.Hora_Real || '').substring(0, 5);
      return `<li class="campo-feed-item${pend}">
        <span class="feed-dot" aria-hidden="true"></span>
        <span><b>${esc(a.Nombre_Trabajador || '—')}</b> · ${esc(a.Tipo_Marcacion || '')}</span>
        <span class="feed-meta">${pend ? 'en cola' : hora}</span>
      </li>`;
    }).join('');
  }

  // ─── Estado de conexión ───────────────────────────────────────────────────
  function _updateStatus() {
    const pill      = document.getElementById('campo-status');
    const connected = !!AppState.get('connected');
    if (pill) {
      pill.classList.toggle('connected', connected);
      pill.innerHTML = `<span class="dot" aria-hidden="true"></span>${connected ? 'En vivo' : 'Offline'}`;
    }
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────
  async function cargar() {
    _renderMarkButtons();
    _updateStatus();
    _renderFeed();
    setTimeout(() => { if (!_scannerActive) _iniciarScanner(); }, 350);
  }

  function cleanup() {
    if (_scannerActive) _detenerScanner();
  }

  return { init, cargar, cleanup };
})();

// Exponer el módulo globalmente
window.ModuloCampo = _ModuloCampo;
