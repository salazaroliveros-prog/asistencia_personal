/**
 * Control Personal Campo — Field Scanner standalone
 * Sub-aplicación independiente para escaneo de QR en campo.
 * Envía marcaciones a Firestore en tiempo real.
 * @version 1.5.0
 */

(() => {
  'use strict';

  // ─── Estado ─────────────────────────────────────────────────────────────
  let _statusTimer    = null;
  let _qrController   = null;
  let _scannerActive  = false;
  let _facingMode     = 'environment';
  let _currentWorker  = null;
  let _marking        = false;
  let _audio          = null;
  let _db             = null;
  let _auth           = null;
  let _unsubscribe    = null;

  const AUTHORIZED_OPERATOR_EMAIL = 'sistemadecontrol090@gmail.com';

  const MARK_TYPES = [
    { tipo: 'Entrada',        cls: 'campo-mark-entry',  icono: 'log-in',          horaKey: 'Hora_Entrada',        fallback: '07:00' },
    { tipo: 'Salida_Receso',  cls: 'campo-mark-break',  icono: 'coffee',           horaKey: 'Hora_Salida_Receso',  fallback: '10:00' },
    { tipo: 'Regreso_Receso', cls: 'campo-mark-resume', icono: 'arrow-left-right', horaKey: 'Hora_Regreso_Receso', fallback: '10:30' },
    { tipo: 'Salida_Obra',    cls: 'campo-mark-exit',   icono: 'log-out',          horaKey: 'Hora_Salida_Obra',    fallback: '17:00' },
  ];

  // ─── Inicialización ──────────────────────────────────────────────────────
  async function init() {
    _bindEvents();
    _initAudio();
    _renderMarkButtons();
    _updateStatusPill(false);
    lucide?.createIcons?.();

    await _initFirebase();
    if (await _isAuthorizedOperator()) {
      await _onLoginSuccess();
    } else {
      _showLogin();
    }
  }

  function _showLogin() {
    document.getElementById('login-section').hidden  = false;
    document.getElementById('campo-scanner').hidden  = true;
    document.getElementById('campo-feed').hidden     = true;
    document.getElementById('campo-worker').hidden   = true;
    const loginError = document.getElementById('login-error');
    if (loginError) loginError.hidden = true;
    if (_scannerActive) _stopScanner();
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  }

  async function _onLoginSuccess() {
    document.getElementById('login-section').hidden = true;
    document.getElementById('campo-scanner').hidden = false;
    document.getElementById('campo-feed').hidden    = false;
    document.getElementById('campo-worker').hidden  = true;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.hidden = false;

    _renderFeed([]);
    setTimeout(() => { if (!_scannerActive) _startScanner(); }, 350);
  }

  async function _isAuthorizedOperator() {
    const user = _auth?.currentUser;
    if (!user) return false;
    const token = await user.getIdTokenResult();
    return token.claims.email_verified === true &&
      String(user.email || '').toLowerCase() === AUTHORIZED_OPERATOR_EMAIL;
  }

  async function _handleLogin() {
    const loginError = document.getElementById('login-error');
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await _auth.signInWithPopup(provider);
      if (!await _isAuthorizedOperator()) {
        await _auth.signOut();
        throw new Error('La cuenta no tiene rol de operador.');
      }
      if (loginError) loginError.hidden = true;
      await _onLoginSuccess();
    } catch (error) {
      console.error('[FieldScanner] Inicio de sesión rechazado:', error);
      if (loginError) loginError.hidden = false;
    }
  }

  function _handleLogout() {
    _auth?.signOut?.();
    if (_scannerActive) _stopScanner();
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _showLogin();
  }

  async function _initFirebase() {
    try {
      const stored     = JSON.parse(localStorage.getItem('cpc_firebase_config') || '{}');
      const configured = window.FIREBASE_CONFIG || {};
      const config = {
        apiKey:            stored.apiKey            || configured.apiKey            || '',
        authDomain:        stored.authDomain        || configured.authDomain        || '',
        projectId:         stored.projectId         || configured.projectId         || '',
        storageBucket:     stored.storageBucket     || '',
        messagingSenderId: stored.messagingSenderId || '',
        appId:             stored.appId             || '',
      };

      if (!config.apiKey || !config.projectId) {
        console.warn('[FieldScanner] Firebase no configurado');
        _updateStatusPill(false);
        return;
      }

      if (!firebase.apps.length) firebase.initializeApp(config);
      _db   = firebase.firestore();
      _auth = firebase.auth();
      _db.enablePersistence?.({ synchronizeTabs: true }).catch(err => {
        console.warn('[FieldScanner] Persistence no disponible:', err?.message || err);
      });
      _updateStatusPill(true);
      _subscribeRealtime();
    } catch (error) {
      console.error('[FieldScanner] Error Firebase:', error);
      _updateStatusPill(false);
    }
  }

  function _subscribeRealtime() {
    if (!_db) return;
    try {
      const hoy = _today();
      _unsubscribe = _db.collection('asistencias')
        .where('Fecha', '==', hoy)
        .limit(50)
        .onSnapshot(snapshot => {
          const records = snapshot.docs.map(doc => ({ ID_Marcacion: doc.id, ...doc.data() }));
          _renderFeed(records);
        }, error => {
          console.error('[FieldScanner] Error suscripción:', error);
        });
    } catch (error) {
      console.error('[FieldScanner] No se pudo suscribir:', error);
    }
  }

  // ─── Eventos ─────────────────────────────────────────────────────────────
  function _bindEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', e => { e.preventDefault(); _handleLogin(); });

    const btnStart  = document.getElementById('campo-btn-scan');
    const btnStop   = document.getElementById('campo-btn-stop');
    const btnSwitch = document.getElementById('campo-btn-switch-camera');
    const camSelect = document.getElementById('campo-camera-select');
    const logoutBtn = document.getElementById('logout-btn');

    if (btnStart)  btnStart.addEventListener('click', () => _startScanner());
    if (btnStop)   btnStop.addEventListener('click', _stopScanner);
    if (btnSwitch) btnSwitch.addEventListener('click', _switchCamera);
    if (camSelect) camSelect.addEventListener('change', () => _startScanner({ deviceId: camSelect.value }));
    if (logoutBtn) logoutBtn.addEventListener('click', _handleLogout);

    document.addEventListener('click', e => {
      const btn = e.target.closest('.campo-mark-btn');
      if (btn && btn.dataset?.tipo) _procesarMarcacion(btn.dataset.tipo);
    });
  }

  // ─── Audio ───────────────────────────────────────────────────────────────
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
    } catch (_) { /* Audio no disponible */ }
  }

  // ─── Escáner QR ──────────────────────────────────────────────────────────
  function _session() {
    return window.CPC?.CameraSession;
  }

  function _mobileSession() {
    return window.MobileQRScanner;
  }

  function _useMobileScanner() {
    return (window.MobileCameraOptimizer?.isMobile() || true) && window.MobileQRScanner;
  }

  function _setCameraStatus(msg) {
    const el = document.getElementById('campo-camera-status');
    if (el) el.textContent = msg;
  }

  async function _loadCameraChoices() {
    const session = _useMobileScanner() ? _mobileSession() : _session();
    const select = document.getElementById('campo-camera-select');
    const switchBtn = document.getElementById('campo-btn-switch-camera');
    if (!session || !select) return;
    try {
      const devices = await session.listCameras();
      select.innerHTML = devices.map(d =>
        `<option value="${_esc(d.id)}">${_esc(d.label)}</option>`
      ).join('');
      const multi = devices.length >= 2;
      select.hidden = !multi;
      if (switchBtn) switchBtn.hidden = !multi;
    } catch (_) { /* sin enumeración */ }
  }

  async function _startScanner(options = {}) {
    const useMobile = _useMobileScanner();
    const session = useMobile ? _mobileSession() : _session();
    
    if (useMobile && typeof Html5Qrcode === 'undefined') {
      _showStatusMessage('Escáner QR no disponible', 'error');
      return;
    }

    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');

    try {
      if (useMobile) {
        // Usar escáner móvil optimizado
        if (!_qrController) {
          _qrController = session;
        }
        _setCameraStatus('Iniciando cámara móvil optimizada…');
        const result = await session.start({
          elementId: 'campo-qr-reader',
          onSuccess: _onQRSuccess,
          onError: (error) => console.warn('[MobileQRScanner] Error:', error),
          cameraOptions: { facingMode: _facingMode, ...options }
        });
        if (!result) return;

        _scannerActive = true;
        if (btnStart) btnStart.hidden = true;
        if (btnStop)  btnStop.hidden  = false;
        _setCameraStatus('Cámara móvil activa');
        await _loadCameraChoices();
        _injectTorchButton();
      } else {
        // Usar escáner legacy
        if (!_qrController) {
          _qrController = session.createQrController({
            Scanner: Html5Qrcode,
            elementId: 'campo-qr-reader',
            onSuccess: _onQRSuccess,
          });
        }
        _setCameraStatus('Iniciando cámara…');
        const result = await _qrController.start({ facingMode: _facingMode, ...options });
        if (!result) return;

        _scannerActive = true;
        if (btnStart) btnStart.hidden = true;
        if (btnStop)  btnStop.hidden  = false;
        _setCameraStatus('Cámara activa');
        await _loadCameraChoices();
        _injectTorchButton();
      }
    } catch (err) {
      _saveErrorLog(err, 'scannerStart');
      _setCameraStatus('Cámara no disponible');
      const sessionDescribe = useMobile ? 'Verifica permisos de cámara en configuración del dispositivo' : session?.describeError?.(err);
      _showStatusMessage(sessionDescribe || 'Error al iniciar cámara', 'error');
    }
  }

  async function _stopScanner() {
    const useMobile = _useMobileScanner();
    const session = useMobile ? _mobileSession() : _session();
    
    if (useMobile && _qrController) {
      await _qrController.stop();
    } else if (_qrController) {
      await _qrController.stop();
    }
    
    _scannerActive = false;
    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.hidden = false;
    if (btnStop)  btnStop.hidden  = true;
    _removeTorchButton();
    _setCameraStatus('');
  }

  async function _switchCamera() {
    const useMobile = _useMobileScanner();
    const session = useMobile ? _mobileSession() : _session();
    
    if (useMobile && session) {
      try {
        await session.switchCamera();
        _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
      } catch (error) {
        _showStatusMessage('Error al cambiar cámara', 'error');
      }
    } else {
      _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
      await _startScanner();
    }
  }

  // ─── Torch/Flash ─────────────────────────────────────────────────────────
  function _injectTorchButton() {
    const container = document.querySelector('.campo-scanner-actions') ||
                      document.querySelector('.campo-scan-btns');
    if (!container || document.getElementById('campo-btn-torch')) return;

    const useMobile = _useMobileScanner();
    const session = useMobile ? _mobileSession() : _session();
    const supportsTorch = useMobile ? session?.supportsTorch?.() : session?.supportsTorch?.();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id   = 'campo-btn-torch';
    btn.className = 'campo-btn ghost';
    btn.setAttribute('aria-label', 'Activar/desactivar flash');
    btn.innerHTML = '<i data-lucide="flashlight" aria-hidden="true"></i> Flash';
    btn.hidden = !supportsTorch;
    btn.addEventListener('click', async () => {
      if (useMobile && session) {
        if (!session.supportsTorch()) {
          _showStatusMessage('Flash no disponible', 'error');
          return;
        }
        try {
          const on = await session.toggleTorch();
          btn.innerHTML = `<i data-lucide="${on ? 'flashlight-off' : 'flashlight'}" aria-hidden="true"></i> ${on ? 'Apagar flash' : 'Flash'}`;
          if (window.lucide) lucide.createIcons({ nodes: [btn] });
        } catch (err) {
          _showStatusMessage('Error al cambiar flash', 'error');
        }
      } else if (session && session.supportsTorch && session.supportsTorch()) {
        if (!session.supportsTorch()) {
          _showStatusMessage('Flash no disponible', 'error');
          return;
        }
        try {
          const on = await session.toggleTorch();
          btn.innerHTML = `<i data-lucide="${on ? 'flashlight-off' : 'flashlight'}" aria-hidden="true"></i> ${on ? 'Apagar flash' : 'Flash'}`;
          if (window.lucide) lucide.createIcons({ nodes: [btn] });
        } catch (err) {
          _showStatusMessage('Error al cambiar flash', 'error');
        }
      } else {
        _showStatusMessage('Flash no disponible', 'error');
      }
    });
    container.appendChild(btn);
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }

  function _removeTorchButton() {
    document.getElementById('campo-btn-torch')?.remove();
  }

  // ─── QR Success ──────────────────────────────────────────────────────────
  async function _onQRSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(80);
    if (_audio) _audio.beepSuccess();

    const qrData = _parseQRData(decodedText);
    if (!qrData) {
      if (_audio) _audio.beepError();
      _saveErrorLog(new Error('QR no reconocido: ' + decodedText), 'qrParse');
      _showStatusMessage('QR no reconocido', 'error');
      return;
    }

    _showStatusMessage('Buscando trabajador…', 'success');
    const trabajador = await _buscarTrabajadorPorQR(qrData);
    if (!trabajador) {
      if (_audio) _audio.beepError();
      _saveErrorLog(new Error('Trabajador no encontrado: ' + (qrData.id || '—')), 'qrWorkerLookup');
      _showStatusMessage('Trabajador no encontrado', 'error');
      return;
    }

    _stopScanner();
    _currentWorker = trabajador;
    _renderWorker(trabajador);
    _habilitaBotones(true);
    _captureGPS();
  }

  function _parseQRData(text) {
    try {
      const data = JSON.parse(text);
      if (data && data.id) return data;
    } catch (_) { /* no es JSON */ }
    if (text && /^[A-Z0-9\-]+$/.test(text) && text.length >= 5) return { id: text };
    return null;
  }

  function _buscarTrabajadorPorQR(qrData) {
    // Primero buscar en AppState (datos sincronizados de la app principal)
    const personal = (window.AppState && window.AppState.get('personal')) || [];
    if (Array.isArray(personal) && personal.length) {
      if (qrData.dpi) {
        const found = personal.find(p => (p.DPI_CUI || '').replace(/\D/g, '') === String(qrData.dpi).replace(/\D/g, ''));
        if (found) return found;
      }
      if (qrData.id) {
        const found = personal.find(p => p.ID_Trabajador === qrData.id);
        if (found) return found;
      }
    }
    // Fallback: cache local
    const cached = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
    if (Array.isArray(cached) && cached.length) {
      if (qrData.dpi) {
        const found = cached.find(p => (p.DPI_CUI || '').replace(/\D/g, '') === String(qrData.dpi).replace(/\D/g, ''));
        if (found) return found;
      }
      if (qrData.id) {
        const found = cached.find(p => p.ID_Trabajador === qrData.id);
        if (found) return found;
      }
    }
    // Cache vacío (dispositivo remoto): buscar directamente en Firestore
    return _buscarTrabajadorFirestore(qrData);
  }

  async function _buscarTrabajadorFirestore(qrData) {
    if (!_db) return null;
    try {
      let snap;
      if (qrData.id) {
        snap = await _db.collection('personal').where('ID_Trabajador', '==', qrData.id).limit(1).get();
      } else if (qrData.dpi) {
        const dpi = String(qrData.dpi).replace(/\D/g, '');
        snap = await _db.collection('personal').where('DPI_CUI', '==', dpi).limit(1).get();
      }
      if (!snap || snap.empty) return null;
      const trabajador = snap.docs[0].data();
      // Actualizar cache local para próximas búsquedas
      try {
        const cache = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
        if (!cache.find(p => p.ID_Trabajador === trabajador.ID_Trabajador)) {
          cache.push(trabajador);
          localStorage.setItem('cpc_personal_cache', JSON.stringify(cache));
        }
      } catch (_) { /* silenciar */ }
      return trabajador;
    } catch (err) {
      console.error('[FieldScanner] Error buscando trabajador:', err);
      return null;
    }
  }

  // ─── Worker UI ───────────────────────────────────────────────────────────
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
      if (trabajador.Fotografia_URL) {
        photo.src = trabajador.Fotografia_URL;
        photo.style.display = 'block';
        photo.hidden = false;
      } else {
        photo.removeAttribute('src');
        photo.style.display = 'none';
        photo.hidden = true;
      }
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

  function _renderMarkButtons() {
    const grid = document.getElementById('campo-mark-grid');
    if (!grid) return;
    // Usar AppState si está disponible (datos sincronizados), con fallback a localStorage
    const appStateConfig = (window.AppState && window.AppState.get('config')) || {};
    const lsConfig = JSON.parse(
      localStorage.getItem('cpc_config') ||
      localStorage.getItem('cpc_config_cache') ||
      '{}'
    );
    const config = { ...lsConfig, ...appStateConfig };
    grid.innerHTML = MARK_TYPES.map(m => {
      const hora = config[m.horaKey] || m.fallback;
      return `
        <button type="button" class="campo-mark-btn ${m.cls}" data-tipo="${m.tipo}" aria-label="Marcar ${m.tipo}">
          <i data-lucide="${m.icono}" aria-hidden="true"></i>
          <span>${m.tipo.replace(/_/g, ' ')}</span>
          <span class="campo-mark-time">${hora}</span>
        </button>`;
    }).join('');
    lucide?.createIcons?.({ nodes: [grid] });
  }

  // ─── GPS ─────────────────────────────────────────────────────────────────
  async function _captureGPS() {
    const gpsEl = document.getElementById('campo-gps');
    const lbl   = document.getElementById('campo-gps-label');
    if (gpsEl) gpsEl.hidden = true;
    if (!gpsEl) return;

    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });
      const { latitude, longitude } = pos.coords;
      if (lbl) lbl.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      gpsEl.hidden = false;
      return { latitude, longitude };
    } catch (_) {
      if (lbl) lbl.textContent = 'Sin GPS';
      return null;
    }
  }

  // ─── Auditoría ───────────────────────────────────────────────────────────
  function _getDeviceInfo() {
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    const os = ua.match(/Android|iPhone|iPad|Windows|Mac|Linux/)?.[0] || 'Unknown';
    return `${isMobile ? 'Mobile' : 'Desktop'} · ${os}`;
  }

  function _getOperatorInfo() {
    return _auth?.currentUser?.email || _auth?.currentUser?.uid || 'unknown';
  }

  function _today() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function _saveAuditLog(record) {
    try {
      const key = 'field_scanner_audit_log';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push({
        timestamp: new Date().toISOString(),
        operator: _getOperatorInfo(),
        device: _getDeviceInfo(),
        action: 'marcacion',
        workerId: record.ID_Trabajador,
        workerName: record.Nombre_Trabajador,
        tipo: record.Tipo_Marcacion,
        status: 'success',
      });
      localStorage.setItem(key, JSON.stringify(log.slice(-100)));
    } catch (_) { /* silenciar */ }
  }

  function _saveErrorLog(error, context = '') {
    try {
      const key = 'field_scanner_audit_log';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push({
        timestamp: new Date().toISOString(),
        operator: _getOperatorInfo(),
        device: _getDeviceInfo(),
        action: 'error',
        context,
        error: String(error?.message || error || 'Unknown error'),
        status: 'error',
      });
      localStorage.setItem(key, JSON.stringify(log.slice(-100)));
    } catch (_) { /* silenciar */ }
  }

  // ─── Marcación ───────────────────────────────────────────────────────────
  async function _procesarMarcacion(tipo) {
    if (!_currentWorker) { _showStatusMessage('Escanea primero el QR', 'error'); return; }
    if (_marking) return;
    _marking = true;
    _habilitaBotones(false);

    const hoy = _today();
    const gps = await _captureGPS();
    const payload = {
      ID_Trabajador:    _currentWorker.ID_Trabajador,
      Nombre_Trabajador: _currentWorker.Nombre_Completo,
      Tipo_Marcacion:   tipo,
      Fecha:            hoy,
      Metodo_Registro:  'Escaneo_QR',
      Ubicacion_Obra:   '',
    };
    if (gps) { payload.GPS_Latitud = gps.latitude; payload.GPS_Longitud = gps.longitude; }

    try {
      const id = await _enviarMarcacionFirestore(payload);
      const horaReal = new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
      if (_audio) _audio.beepSuccess();
      _showStatusMessage('Marcación registrada', 'success');
      _renderFeed([{ ID_Marcacion: id, ...payload, Hora_Real: horaReal, Estado_Marcacion: 'A Tiempo' }]);
    } catch (err) {
      _saveErrorLog(err, 'enviarMarcacion');
      if (_audio) _audio.beepError();
      _showStatusMessage('No se pudo registrar la marca', 'error');
    } finally {
      _marking = false;
      _currentWorker = null;
      _habilitaBotones(false);
      setTimeout(() => { if (!_scannerActive) _startScanner(); }, 450);
    }
  }

  async function _enviarMarcacionFirestore(payload) {
    if (!_db) throw new Error('Firebase no disponible');

    const horaReal = new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
    // La clave determinista hace que un reintento o doble lectura del mismo QR
    // sea idempotente por trabajador, fecha y tipo de marcación.
    const id = `${payload.ID_Trabajador}_${payload.Fecha}_${payload.Tipo_Marcacion}`.replace(/[^A-Za-z0-9_-]/g, '_');
    const record = {
      ID_Marcacion:     id,
      ID_Registro:      id,
      ID_Trabajador:    payload.ID_Trabajador,
      Nombre_Trabajador: payload.Nombre_Trabajador,
      Fecha:            payload.Fecha,
      Tipo_Marcacion:   payload.Tipo_Marcacion,
      Hora_Programada:  '',
      Hora_Real:        horaReal,
      Estado_Marcacion: 'A Tiempo',
      Metodo_Registro:  payload.Metodo_Registro || 'Escaneo_QR',
      Horas_Extra:      0,
      Ubicacion_Obra:   payload.Ubicacion_Obra || '',
      Timestamp:        Date.now(),
    };
    if (payload.GPS_Latitud  !== undefined) record.GPS_Latitud  = payload.GPS_Latitud;
    if (payload.GPS_Longitud !== undefined) record.GPS_Longitud = payload.GPS_Longitud;

    const ref = _db.collection('asistencias').doc(id);
    await _db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) transaction.set(ref, record, { merge: false });
    });
    _saveAuditLog({ ...record, Nombre_Trabajador: payload.Nombre_Trabajador });
    return id;
  }

  // ─── Feed ─────────────────────────────────────────────────────────────────
  function _renderFeed(records) {
    const list = document.getElementById('campo-feed-list');
    if (!list) return;
    const hoy   = _today();
    const today = (records || []).filter(a => a.Fecha === hoy).slice(-6).reverse();

    if (!today.length) {
      list.innerHTML = '<li class="campo-feed-empty">Aún no hay marcaciones hoy.</li>';
      return;
    }
    list.innerHTML = today.map(a => {
      const hora = (a.Hora_Real || '').substring(0, 5);
      return `<li class="campo-feed-item">
        <span class="feed-dot" aria-hidden="true"></span>
        <span><b>${_esc(a.Nombre_Completo || a.Nombre_Trabajador || '—')}</b> · ${_esc(a.Tipo_Marcacion || '')}</span>
        <span class="feed-meta">${hora || 'registrada'}</span>
      </li>`;
    }).join('');
  }

  // ─── Estado ──────────────────────────────────────────────────────────────
  function _updateStatusPill(connected) {
    const pill = document.getElementById('campo-status');
    const text = document.getElementById('campo-status-text');
    if (pill && text) {
      pill.classList.toggle('connected', connected);
      pill.classList.toggle('disconnected', !connected);
      text.textContent = connected ? 'En vivo' : 'Offline';
    }
  }

  function _showStatusMessage(message, type = 'error') {
    const pill = document.getElementById('campo-status');
    const text = document.getElementById('campo-status-text');
    if (!pill || !text) return;
    clearTimeout(_statusTimer);
    pill.classList.toggle('disconnected', type === 'error');
    pill.classList.toggle('connected', type !== 'error');
    text.textContent = message;
    _statusTimer = setTimeout(() => _updateStatusPill(!!_db), 4000);
  }

  // ─── Utilidades ──────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────
  async function cargar() {
    if (!await _isAuthorizedOperator()) { _showLogin(); return; }
    await _onLoginSuccess();
  }

  function cleanup() {
    if (_scannerActive) _stopScanner();
    if (_unsubscribe && typeof _unsubscribe === 'function') _unsubscribe();
  }

  window.FieldScanner = { init, cargar, cleanup, showLogin: _showLogin, handleLogout: _handleLogout };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
