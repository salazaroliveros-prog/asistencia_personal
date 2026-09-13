/**
 * Control Personal Campo — Field Scanner standalone
 * Sub-aplicación independiente para escaneo de QR en campo.
 * Envía marcaciones a Firestore en tiempo real.
 * @version 1.0.0
 */

(() => {
  'use strict';

  // ─── Estado ─────────────────────────────────────────────────────────
  let scanner = null;
  let scannerActive = false;
  let currentWorker = null;
  let marking = false;
  let audio = null;
  let db = null;
  let unsubscribe = null;

  const MARK_TYPES = [
    { tipo: 'Entrada', cls: 'campo-mark-entry', icono: 'log-in', horaKey: 'Hora_Entrada', fallback: '07:00' },
    { tipo: 'Salida_Receso', cls: 'campo-mark-break', icono: 'coffee', horaKey: 'Hora_Salida_Receso', fallback: '10:00' },
    { tipo: 'Regreso_Receso', cls: 'campo-mark-resume', icono: 'arrow-left-right', horaKey: 'Hora_Regreso_Receso', fallback: '10:30' },
    { tipo: 'Salida_Obra', cls: 'campo-mark-exit', icono: 'log-out', horaKey: 'Hora_Salida_Obra', fallback: '17:00' },
  ];

  const SESSION_KEY = 'field_scanner_session';
  const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hora
  const DEFAULT_PIN = '1234';

  // ─── Inicialización ─────────────────────────────────────────────────
  async function init() {
    bindEvents();
    initAudio();
    renderMarkButtons();
    updateStatusPill(false);
    lucide?.createIcons?.();

    if (isSessionValid()) {
      await onLoginSuccess();
    } else {
      showLogin();
    }
  }

  function isSessionValid() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const session = JSON.parse(raw);
      return Boolean(session?.operator) && Date.now() < Number(session.expiresAt);
    } catch {
      return false;
    }
  }

  function saveSession(operator) {
    const session = {
      operator,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function requirePin() {
    const stored = localStorage.getItem('cpc_field_scanner_pin');
    const validPin = stored && /^[0-9]{4,10}$/.test(stored) ? stored : DEFAULT_PIN;
    return validPin;
  }

  function showLogin() {
    const loginSection = document.getElementById('login-section');
    const scannerSection = document.getElementById('campo-scanner');
    const feedSection = document.getElementById('campo-feed');
    const workerSection = document.getElementById('campo-worker');
    const pinInput = document.getElementById('login-pin');
    const loginError = document.getElementById('login-error');

    if (loginSection) loginSection.hidden = false;
    if (scannerSection) scannerSection.hidden = true;
    if (feedSection) feedSection.hidden = true;
    if (workerSection) workerSection.hidden = true;
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
    if (loginError) loginError.hidden = true;

    if (scannerActive) {
      stopScanner();
    }
    if (unsubscribe && typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = null;
    }
  }

  async function onLoginSuccess() {
    const loginSection = document.getElementById('login-section');
    const scannerSection = document.getElementById('campo-scanner');
    const feedSection = document.getElementById('campo-feed');
    const workerSection = document.getElementById('campo-worker');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginSection) loginSection.hidden = true;
    if (scannerSection) scannerSection.hidden = false;
    if (feedSection) feedSection.hidden = false;
    if (workerSection) workerSection.hidden = true;
    if (logoutBtn) logoutBtn.hidden = false;

    await initFirebase();
    renderFeed([]);
    setTimeout(() => { if (!scannerActive) startScanner(); }, 350);
  }

  function handleLogin(pin) {
    const expected = requirePin();
    const loginError = document.getElementById('login-error');

    if (pin === expected) {
      saveSession('operador');
      if (loginError) loginError.hidden = true;
      onLoginSuccess();
    } else {
      if (loginError) loginError.hidden = false;
    }
  }

  function handleLogout() {
    clearSession();
    if (scannerActive) {
      stopScanner();
    }
    if (unsubscribe && typeof unsubscribe === 'function') {
      unsubscribe();
      unsubscribe = null;
    }
    showLogin();
  }

  async function initFirebase() {
    try {
      const stored = JSON.parse(localStorage.getItem('cpc_firebase_config') || '{}');
      const config = {
        apiKey: stored.apiKey || '',
        authDomain: stored.authDomain || '',
        projectId: stored.projectId || '',
        storageBucket: stored.storageBucket || '',
        messagingSenderId: stored.messagingSenderId || '',
        appId: stored.appId || '',
      };

      if (!config.apiKey || !config.projectId) {
        console.warn('[FieldScanner] Firebase no configurado');
        updateStatusPill(false);
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      db = firebase.firestore();
      db.enablePersistence?.({ synchronizeTabs: true }).catch((err) => {
        console.warn('[FieldScanner] Persistence no disponible:', err?.message || err);
      });
      updateStatusPill(true);
      subscribeRealtime();
    } catch (error) {
      console.error('[FieldScanner] Error Firebase:', error);
      updateStatusPill(false);
    }
  }

  function subscribeRealtime() {
    if (!db) return;
    try {
      unsubscribe = db.collection('asistencias')
        .orderBy('Fecha_Registro', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
          const records = snapshot.docs.map(doc => ({ ID_Marcacion: doc.id, ...doc.data() }));
          renderFeed(records);
        }, (error) => {
          console.error('[FieldScanner] Error suscripción:', error);
        });
    } catch (error) {
      console.error('[FieldScanner] No se pudo suscribir:', error);
    }
  }

  // ─── Eventos ────────────────────────────────────────────────────────
  function bindEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pinInput = document.getElementById('login-pin');
        const pin = (pinInput?.value || '').trim();
        handleLogin(pin);
      });
    }

    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.addEventListener('click', startScanner);
    if (btnStop) btnStop.addEventListener('click', stopScanner);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        handleLogout();
      });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.campo-mark-btn');
      if (btn && btn.dataset?.tipo) {
        procesarMarcacion(btn.dataset.tipo);
      }
    });
  }

  // ─── Audio ─────────────────────────────────────────────────────────
  function initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audio = {
        beepSuccess() {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.27, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.28);
        },
        beepError() {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.value = 220;
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        },
      };
    } catch (e) { /* Audio no disponible */ }
  }

  // ─── Escáner QR ────────────────────────────────────────────────────
  async function startScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      saveErrorLog(new Error('Html5Qrcode no disponible'), 'startScanner');
      alert('El escáner QR no está disponible.');
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      saveErrorLog(err, 'cameraPermission');
      alert('No se pudo acceder a la cámara. Verifica los permisos.');
      return;
    }

    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop = document.getElementById('campo-btn-stop');
    
    // Intentar cámara trasera primero, con fallback a frontal
    const tryStart = async (facingMode) => {
      scanner = new Html5Qrcode('campo-qr-reader');
      await scanner.start(
        { facingMode },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0, disableFlip: false },
        onQRSuccess,
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
          saveErrorLog(err2, 'scannerStartFallback');
          alert('No se pudo iniciar la cámara: ' + (err2.message || err2));
          return;
        }
      } else {
        saveErrorLog(err, 'scannerStart');
        alert('No se pudo iniciar la cámara: ' + (err.message || err));
        return;
      }
    }
    scannerActive = true;
    if (btnStart) btnStart.hidden = true;
    if (btnStop) btnStop.hidden = false;
    
    // Inyectar botón de flash si el dispositivo lo soporta
    injectTorchButton();
  }

  async function stopScanner() {
    if (scanner && scannerActive) {
      try { await scanner.stop(); } catch (e) { /* ignorar */ }
      scannerActive = false;
    }
    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.hidden = false;
    if (btnStop) btnStop.hidden = true;
    removeTorchButton();
  }

  // ─── Torch/Flash Support ─────────────────────────────────────────────
  let _torchEnabled = false;
  let _videoTrack = null;

  function injectTorchButton() {
    const actionsDiv = document.querySelector('.campo-scanner-actions');
    if (!actionsDiv || document.getElementById('campo-btn-torch')) return;
    
    const torchBtn = document.createElement('button');
    torchBtn.type = 'button';
    torchBtn.id = 'campo-btn-torch';
    torchBtn.className = 'campo-btn ghost';
    torchBtn.innerHTML = '<i data-lucide="flashlight" aria-hidden="true"></i> Flash';
    torchBtn.hidden = true; // Se muestra solo si hay soporte
    torchBtn.addEventListener('click', toggleTorch);
    actionsDiv.appendChild(torchBtn);
    
    // Verificar soporte de torch después de que el scanner inicie
    setTimeout(checkTorchSupport, 500);
  }

  function removeTorchButton() {
    const torchBtn = document.getElementById('campo-btn-torch');
    if (torchBtn) torchBtn.remove();
  }

  async function checkTorchSupport() {
    try {
      // Html5Qrcode no expone el video track directamente, intentamos obtenerlo
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
      // Torch no soportado o no disponible
    }
  }

  async function toggleTorch() {
    if (!_videoTrack) {
      // Re-obtener el track actual
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        _videoTrack = stream.getVideoTracks()[0];
      } catch {
        alert('No se pudo acceder a la cámara para activar flash');
        return;
      }
    }
    
    try {
      const capabilities = _videoTrack.getCapabilities?.();
      if (!capabilities?.torch) {
        alert('Flash no disponible en este dispositivo');
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
      console.error('[FieldScanner] Error toggle torch:', err);
      alert('Error al cambiar flash: ' + err.message);
    }
  }

  function onQRSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(80);
    if (audio) audio.beepSuccess();

    const qrData = parseQRData(decodedText);
    if (!qrData) {
      if (audio) audio.beepError();
      saveErrorLog(new Error('QR no reconocido: ' + decodedText), 'qrParse');
      alert('QR no reconocido. Usa un carné de este sistema.');
      return;
    }

    const trabajador = buscarTrabajadorPorQR(qrData);
    if (!trabajador) {
      if (audio) audio.beepError();
      saveErrorLog(new Error('Trabajador no encontrado: ' + (qrData.id || '—')), 'qrWorkerLookup');
      alert('Trabajador no encontrado. ID: ' + (qrData.id || '—'));
      return;
    }

    stopScanner();
    currentWorker = trabajador;
    renderWorker(trabajador);
    habilitaBotones(true);
    captureGPS();
  }

  function parseQRData(text) {
    try {
      const data = JSON.parse(text);
      if (data && data.id) return data;
      if (text && /^[A-Z0-9\-]+$/.test(text) && text.length >= 5) {
        return { id: text };
      }
      return null;
    } catch {
      if (text && /^[A-Z0-9\-]+$/.test(text) && text.length >= 5) {
        return { id: text };
      }
      return null;
    }
  }

  function buscarTrabajadorPorQR(qrData) {
    const personal = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
    if (!Array.isArray(personal)) return null;
    if (qrData.dpi) {
      const found = personal.find(p => (p.DPI_CUI || '').replace(/\D/g, '') === String(qrData.dpi).replace(/\D/g, ''));
      if (found) return found;
    }
    if (qrData.id) {
      const found = personal.find(p => p.ID_Trabajador === qrData.id);
      if (found) return found;
    }
    return null;
  }

  // ─── Worker UI ─────────────────────────────────────────────────────
  function renderWorker(trabajador) {
    const panel = document.getElementById('campo-worker');
    if (!panel) return;

    const nameEl = document.getElementById('campo-worker-name');
    const puestoEl = document.getElementById('campo-worker-puesto');
    const idEl = document.getElementById('campo-worker-id');
    const photo = document.getElementById('campo-worker-photo');
    const avatar = document.getElementById('campo-worker-avatar');

    if (nameEl) nameEl.textContent = trabajador.Nombre_Completo || '--';
    if (puestoEl) puestoEl.textContent = trabajador.Puesto || '--';
    if (idEl) idEl.textContent = trabajador.ID_Trabajador || '--';

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

  function habilitaBotones(enable) {
    document.querySelectorAll('.campo-mark-btn').forEach(btn => { btn.disabled = !enable; });
  }

  function renderMarkButtons() {
    const grid = document.getElementById('campo-mark-grid');
    if (!grid) return;
    const config = JSON.parse(localStorage.getItem('cpc_config_cache') || '{}');
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

  // ─── GPS ───────────────────────────────────────────────────────────
  async function captureGPS() {
    const gpsEl = document.getElementById('campo-gps');
    const lbl = document.getElementById('campo-gps-label');
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
    } catch (err) {
      if (lbl) lbl.textContent = 'Sin GPS';
      return null;
    }
  }

  // ─── Auditoría ──────────────────────────────────────────────────────
  function getDeviceInfo() {
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    const browser = isMobile ? 'Mobile' : 'Desktop';
    const os = ua.match(/Android|iPhone|iPad|Windows|Mac|Linux/)?.[0] || 'Unknown';
    return `${browser} · ${os}`;
  }

  function getOperatorInfo() {
    const session = (() => {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch { return {}; }
    })();
    return session.operator || 'unknown';
  }

  function saveAuditLog(record) {
    try {
      const key = 'field_scanner_audit_log';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push({
        timestamp: new Date().toISOString(),
        operator: getOperatorInfo(),
        device: getDeviceInfo(),
        action: 'marcacion',
        workerId: record.ID_Trabajador,
        workerName: record.Nombre_Trabajador,
        tipo: record.Tipo_Marcacion,
        status: 'success',
      });
      localStorage.setItem(key, JSON.stringify(log.slice(-100)));
    } catch {
      // Silenciar errores de storage
    }
  }

  function saveErrorLog(error, context = '') {
    try {
      const key = 'field_scanner_audit_log';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push({
        timestamp: new Date().toISOString(),
        operator: getOperatorInfo(),
        device: getDeviceInfo(),
        action: 'error',
        context,
        error: String(error?.message || error || 'Unknown error'),
        status: 'error',
      });
      localStorage.setItem(key, JSON.stringify(log.slice(-100)));
    } catch {
      // Silenciar errores de storage
    }
  }

  // ─── Marcación ─────────────────────────────────────────────────────
  async function procesarMarcacion(tipo) {
    if (!currentWorker) { alert('Escanea primero el QR del trabajador.'); return; }
    if (marking) return;
    marking = true;
    habilitaBotones(false);

    const hoy = new Date().toISOString().slice(0, 10);
    const gps = await captureGPS();
    const payload = {
      ID_Trabajador: currentWorker.ID_Trabajador,
      Nombre_Trabajador: currentWorker.Nombre_Completo,
      Tipo_Marcacion: tipo,
      Fecha: hoy,
      Metodo_Registro: 'Escaneo_QR',
      Ubicacion_Obra: '',
    };
    if (gps) {
      payload.GPS_Latitud = gps.latitude;
      payload.GPS_Longitud = gps.longitude;
    }

    try {
      const id = await enviarMarcacionFirestore(payload);
      const horaReal = new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
      if (audio) audio.beepSuccess();
      alert(`Marcación registrada:\n${currentWorker.Nombre_Completo}\n${tipo} ${horaReal}`);
      renderFeed([{ ID_Marcacion: id, ...payload, Hora_Real: horaReal, Estado_Marcacion: 'A Tiempo' }]);
    } catch (err) {
      saveErrorLog(err, 'enviarMarcacion');
      if (audio) audio.beepError();
      alert('No se pudo registrar la marca: ' + (err.message || err));
    } finally {
      marking = false;
      currentWorker = null;
      habilitaBotones(false);
      setTimeout(() => { if (!scannerActive) startScanner(); }, 450);
    }
  }

  async function enviarMarcacionFirestore(payload) {
    if (!db) throw new Error('Firebase no disponible');
    const doc = {
      ...payload,
      Operador: getOperatorInfo(),
      Dispositivo: getDeviceInfo(),
      Fecha_Registro: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('asistencias').add(doc);
    saveAuditLog({ ...doc, ID_Marcacion: ref.id });
    return ref.id;
  }

  // ─── Feed ──────────────────────────────────────────────────────────
  function renderFeed(records) {
    const list = document.getElementById('campo-feed-list');
    if (!list) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const today = (records || []).filter(a => a.Fecha === hoy).slice(-6).reverse();

    if (!today.length) {
      list.innerHTML = '<li class="campo-feed-empty">Aún no hay marcaciones hoy.</li>';
      return;
    }
    list.innerHTML = today.map(a => {
      const hora = (a.Hora_Real || '').substring(0, 5);
      return `<li class="campo-feed-item">
        <span class="feed-dot" aria-hidden="true"></span>
        <span><b>${a.Nombre_Trabajador || '—'}</b> · ${a.Tipo_Marcacion || ''}</span>
        <span class="feed-meta">${hora || 'registrada'}</span>
      </li>`;
    }).join('');
  }

  // ─── Estado ────────────────────────────────────────────────────────
  function updateStatusPill(connected) {
    const pill = document.getElementById('campo-status');
    if (pill) {
      pill.classList.toggle('connected', connected);
      pill.innerHTML = `<span class="dot ${connected ? 'connected' : 'disconnected'}" aria-hidden="true"></span>${connected ? 'En vivo' : 'Offline'}`;
    }
  }

  // ─── Ciclo de vida ─────────────────────────────────────────────────
  async function cargar() {
    if (!isSessionValid()) {
      showLogin();
      return;
    }
    await onLoginSuccess();
  }

  function cleanup() {
    if (scannerActive) stopScanner();
    if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
  }

  window.FieldScanner = { init, cargar, cleanup, showLogin, handleLogout };

  // Arranque automatico al cargar la pagina
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
