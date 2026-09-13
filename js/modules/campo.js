/**
 * CONTROL PERSONAL CAMPO — modules/campo.js
 * "Sub-app" de campo: vista instalable pensada para operarse en un móvil
 * dentro de la obra. Escanea el QR del carné, captura GPS opcional y registra
 * la marcación en Firestore en tiempo real (con cola offline como respaldo).
 * @version 1.1.0
 */

const ModuloCampo = (() => {

  // ─── Estado del módulo ──────────────────────────────────────────────────
  let _scanner       = null;
  let _scannerActive = false;
  let _currentWorker = null;   // Trabajador escaneado/seleccionado
  let _audio         = null;
  let _marking       = false;  // Guard anti doble-pulso

  const MARK_TYPES = [
    { tipo: 'Entrada',         cls: 'campo-mark-entry',  icono: 'log-in',             horaKey: 'Hora_Entrada',        fallback: '07:00' },
    { tipo: 'Salida_Receso',   cls: 'campo-mark-break',   icono: 'coffee',             horaKey: 'Hora_Salida_Receso',   fallback: '10:00' },
    { tipo: 'Regreso_Receso',  cls: 'campo-mark-resume',   icono: 'arrow-left-right', horaKey: 'Hora_Regreso_Receso',  fallback: '10:30' },
    { tipo: 'Salida_Obra',     cls: 'campo-mark-exit',    icono: 'log-out',            horaKey: 'Hora_Salida_Obra',      fallback: '17:00' },
  ];

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Inicialización ─────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _initAudio();
    _renderMarkButtons();
    _updateStatus();
  }

  function _bindEvents() {
    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.addEventListener('click', _iniciarScanner);
    if (btnStop)  btnStop.addEventListener('click',  _detenerScanner);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.campo-mark-btn');
      if (btn && btn.dataset && btn.dataset.tipo) {
        _procesarMarcacion(btn.dataset.tipo);
      }
    });

    AppState.on('asistencias', () => { _renderFeed(); });
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

  function _renderMarkButtons() {
    const grid = document.getElementById('campo-mark-grid');
    if (!grid) return;
    const config = AppState.get('config') || window.DEFAULT_CONFIG || {};
    grid.innerHTML = MARK_TYPES.map(m => {
      const hora = config[m.horaKey] || m.fallback;
      return `
        <button type="button" class="campo-mark-btn ${m.cls}" data-tipo="${m.tipo}" aria-label="Marcar ${m.tipo}">
          <i data-lucide="${m.icono}" aria-hidden="true"></i>
          <span>${m.tipo.replace(/_/g, ' ')}</span>
          <span class="campo-mark-time">${hora}</span>
        </button>`;
    }).join('');
    if (window.lucide) lucide.createIcons({ nodes: [grid] });
  }

  // ─── Escáner QR ─────────────────────────────────────────────────────────
  async function _iniciarScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      Alerts.error('El escáner QR no está disponible. Verifica los recursos.', 'Error');
      return;
    }
    try { await navigator.mediaDevices.getUserMedia({ video: true }); }
    catch (err) {
      Alerts.error('No se pudo acceder a la cámara. Verifica los permisos del navegador.', 'Sin acceso a cámara');
      return;
    }

    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');
    
    const tryStart = async (facingMode) => {
      _scanner = new Html5Qrcode('campo-qr-reader');
      await _scanner.start(
        { facingMode },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0, disableFlip: false },
        _onQRSuccess,
        () => {}
      );
    };

    try {
      await tryStart('environment');
    } catch (err) {
      if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
        try {
          await tryStart('user');
        } catch (err2) {
          Alerts.error(err2.message || 'No se pudo iniciar la cámara.', 'Error de cámara');
          return;
        }
      } else {
        Alerts.error(err.message || 'No se pudo iniciar la cámara.', 'Error de cámara');
        return;
      }
    }
    _scannerActive = true;
    if (btnStart) btnStart.hidden = true;
    if (btnStop)  btnStop.hidden  = false;
    
    // Inyectar botón de flash
    _injectTorchButton();
  }

  async function _detenerScanner() {
    if (_scanner && _scannerActive) {
      try { await _scanner.stop(); } catch (e) { /* ignorar */ }
      _scannerActive = false;
    }
    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.hidden = false;
    if (btnStop)  btnStop.hidden  = true;
    _removeTorchButton();
  }

  // ─── Torch/Flash Support ─────────────────────────────────────────────
  let _torchEnabled = false;
  let _videoTrack = null;

  function _injectTorchButton() {
    const actionsDiv = document.querySelector('.campo-scanner-actions');
    if (!actionsDiv || document.getElementById('campo-btn-torch')) return;
    
    const torchBtn = document.createElement('button');
    torchBtn.type = 'button';
    torchBtn.id = 'campo-btn-torch';
    torchBtn.className = 'campo-btn ghost';
    torchBtn.innerHTML = '<i data-lucide="flashlight" aria-hidden="true"></i> Flash';
    torchBtn.hidden = true;
    torchBtn.addEventListener('click', _toggleTorch);
    actionsDiv.appendChild(torchBtn);
    
    setTimeout(_checkTorchSupport, 500);
  }

  function _removeTorchButton() {
    const torchBtn = document.getElementById('campo-btn-torch');
    if (torchBtn) torchBtn.remove();
  }

  async function _checkTorchSupport() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      stream.getTracks().forEach(t => t.stop());
      
      if (capabilities?.torch) {
        _videoTrack = track;
        const torchBtn = document.getElementById('campo-btn-torch');
        if (torchBtn) torchBtn.hidden = false;
      }
    } catch {
      // Torch no soportado
    }
  }

  async function _toggleTorch() {
    if (!_videoTrack) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        _videoTrack = stream.getVideoTracks()[0];
      } catch {
        Alerts.error('No se pudo acceder a la cámara para activar flash');
        return;
      }
    }
    
    try {
      const capabilities = _videoTrack.getCapabilities?.();
      if (!capabilities?.torch) {
        Alerts.warning('Flash no disponible en este dispositivo');
        return;
      }
      _torchEnabled = !_torchEnabled;
      await _videoTrack.applyConstraints({ advanced: [{ torch: _torchEnabled }] });
      const torchBtn = document.getElementById('campo-btn-torch');
      if (torchBtn) {
        torchBtn.innerHTML = `<i data-lucide="${_torchEnabled ? 'flashlight-off' : 'flashlight'}" aria-hidden="true"></i> ${_torchEnabled ? 'Apagar flash' : 'Flash'}`;
      }
      if (window.lucide) lucide.createIcons({ nodes: [torchBtn] });
    } catch (err) {
      console.error('[Campo] Error toggle torch:', err);
      Alerts.error('Error al cambiar flash: ' + err.message);
    }
  }

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
    const panel  = document.getElementById('campo-worker');
    if (!panel) return;

    const nameEl   = document.getElementById('campo-worker-name');
    const puestoEl = document.getElementById('campo-worker-puesto');
    const idEl     = document.getElementById('campo-worker-id');
    const photo    = document.getElementById('campo-worker-photo');
    const avatar   = document.getElementById('campo-worker-avatar');

    if (nameEl)   nameEl.textContent = trabajador.Nombre_Completo || '--';
    if (puestoEl) puestoEl.textContent = trabajador.Puesto || '--';
    if (idEl)     idEl.textContent   = trabajador.ID_Trabajador || '--';

    if (photo) {
      if (trabajador.Fotografia_URL) { photo.src = trabajador.Fotografia_URL; photo.style.display = 'block'; }
      else { photo.removeAttribute('src'); photo.style.display = 'none'; }
    }
    if (avatar) {
      const ini = String(trabajador.Nombre_Completo || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
      avatar.textContent = ini || '?';
    }

    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _habilitaBotones(enable) {
    document.querySelectorAll('.campo-mark-btn').forEach(btn => { btn.disabled = !enable; });
  }

  // ─── GPS / geocerca ─────────────────────────────────────────────────────
  function _scope() {
    const config = AppState.get('config') || window.DEFAULT_CONFIG || {};
    const center = (config.GPS_Centro_Lat && config.GPS_Centro_Lon)
      ? { lat: parseFloat(config.GPS_Centro_Lat), lon: parseFloat(config.GPS_Centro_Lon) }
      : null;
    return { enabled: config.GPS_Habilitado !== false, center, radius: parseInt(config.GPS_Radio_Metros || 200) };
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
        const f = GPS.checkGeofence({ latitude: pos.latitude, longitude: pos.longitude }, { latitude: s.center.lat, longitude: s.center.lon }, s.radius);
        info += f.inside ? ' · Dentro de geocerca' : ` · Fuera (${f.distance}m)`;
        if (gpsEl) gpsEl.classList.toggle('out-of-fence', !f.inside);
      }
      if (lbl) lbl.textContent = info;
    } catch (err) {
      if (lbl) lbl.textContent = err.message || 'GPS no disponible';
    }
  }

  // ─── Marcación ─────────────────────────────────────────────────────────
  async function _procesarMarcacion(tipo) {
    if (!_currentWorker) { Alerts.info('Escanea primero el QR del trabajador.'); return; }
    if (_marking) return;  // Guard anti doble-pulso
    _marking = true;
    _habilitaBotones(false);

    const config = AppState.get('config') || window.DEFAULT_CONFIG || {};
    const hoy    = (AppState.today ? AppState.today() : new Date().toISOString().slice(0, 10));

    // GPS opcional
    let lat = null, lon = null, dentroFence = null;
    if (_scopeGPS()) {
      try {
        const pos = await GPS.getCurrentPosition();
        lat = pos.latitude; lon = pos.longitude;
        const s = _scope();
        if (s.center) dentroFence = GPS.checkGeofence({ latitude: lat, longitude: lon }, { latitude: s.center.lat, longitude: s.center.lon }, s.radius).inside;
      } catch (e) { /* sin GPS -> se marca sin ubicacion */ }
    }

    const payload = {
      ID_Trabajador: _currentWorker.ID_Trabajador,
      Nombre_Trabajador: _currentWorker.Nombre_Completo,
      Tipo_Marcacion: tipo,
      Fecha: hoy,
      Metodo_Registro: 'Escaneo_QR',
      Ubicacion_Obra: config.Nombre_Obra || '',
    };
    if (lat !== null) payload.GPS_Latitud = lat;
    if (lon !== null) payload.GPS_Longitud = lon;
    if (dentroFence !== null) payload.GPS_Dentro_Geocerca = dentroFence;

    try {
      const resp   = await API.registrarMarcacion(payload);
      const estado = resp.estadoMarcacion || (resp.data && resp.data[0] && resp.data[0].Estado_Marcacion) || 'A Tiempo';
      const horaReal = (resp && resp.horaReal) || new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
      const offline = !!(resp.offline) || (typeof API.isOffline === 'function' && API.isOffline());
      if (_audio) _audio.beepSuccess();
      Alerts.marcacion({
        nombre: _currentWorker.Nombre_Completo || 'Trabajador',
        tipo,
        horaReal,
        estado,
      });
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

  // ─── Feed de marcas recientes (en vivo) ───────────────────────────────
  function _renderFeed() {
    const list = document.getElementById('campo-feed-list');
    if (!list) return;
    const all   = AppState.get('asistencias') || [];
    const hoy   = (AppState.today ? AppState.today() : new Date().toISOString().slice(0, 10));
    const recent = all.filter(a => a.Fecha === hoy).slice(-6).reverse();

    if (!recent.length) {
      list.innerHTML = '<li class="campo-feed-empty">Aún no hay marcaciones hoy.</li>';
      return;
    }
    const pendSet = new Set((API.getOfflineQueue ? API.getOfflineQueue() : []).map(q => q && q.payload && q.payload.ID_Marcacion));
    list.innerHTML = recent.map(a => {
      const pend = pendSet.has(a.ID_Marcacion) ? ' pending' : '';
      const hora = (a.Hora_Real || '').substring(0, 5);
      return `<li class="campo-feed-item${pend}">
        <span class="feed-dot" aria-hidden="true"></span>
        <span><b>${esc(a.Nombre_Trabajador || '—')}</b> · ${esc(a.Tipo_Marcacion || '')}</span>
        <span class="feed-meta">${pend ? 'en cola' : hora}</span>
      </li>`;
    }).join('');
  }

  // ─── Estado de conexión ───────────────────────────────────────────────
  function _updateStatus() {
    const pill = document.getElementById('campo-status');
    const connected = !!AppState.get('connected');
    if (pill) {
      pill.classList.toggle('connected', connected);
      pill.innerHTML = `<span class="dot" aria-hidden="true"></span>${connected ? 'En vivo' : 'Offline'}`;
    }
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────
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