/**
 * CONTROL PERSONAL CAMPO — modules/asistencia.js
 * Módulo de control de asistencia: escáner QR móvil + marcación manual.
 * Lógica de horarios, tolerancias y horas extra.
 * @version 1.0.0
 */

const ModuloAsistencia = (() => {

  // ─── Estado del módulo ────────────────────────────────────────────────────
  let _scanner           = null;
  let _scannerActive     = false;
  let _pendingWorker     = null;  // Trabajador scaneado o seleccionado
  let _pendingMarcacion  = null;  // Para el flujo de horas extra
  let _audio             = null;
  const DEFAULT_GEOFENCE_RADIUS = 200; // meters

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    if (window.Logger) {
      window.Logger.info('ModuloAsistencia', 'Inicializando módulo de asistencia');
    }
    _bindEvents();
    _setFechaHoy();
    _initAudio();
    _actualizarHorariosBotones();

    // Cuando cambie la config (ej: se guarden horarios en Ajustes) → actualizar botones
    AppState.on('config', () => _actualizarHorariosBotones());
  }

  function _bindEvents() {
    // Tabs QR / Manual
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => _switchTab(tab.dataset.tab));
    });

    // Botón iniciar/detener cámara
    const btnStart = document.getElementById('btn-start-scan');
    const btnStop  = document.getElementById('btn-stop-scan');
    if (btnStart) btnStart.addEventListener('click', _iniciarScanner);
    if (btnStop)  btnStop.addEventListener('click',  _detenerScanner);

    // Búsqueda manual con autocomplete (optimized with RequestOptimizer)
    const searchInput = document.getElementById('manual-worker-search');
    if (searchInput) {
      const debouncedSearch = RequestOptimizer.debounce('manual-search', _buscarTrabajadorManual, 250);
      searchInput.addEventListener('input', debouncedSearch);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') _limpiarAutocomplete();
      });
    }

    // Botones de marcación — Delegación en el contenedor de marcaciones
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-marcacion');
      if (!btn) return;

      const tipo = btn.dataset.tipo;
      const hora = btn.dataset.hora;

      if (_pendingWorker) {
        _procesarMarcacion(_pendingWorker, tipo, hora);
      }
    });

    // Confirmar horas extra
    const btnConfirmarHExtra = document.getElementById('btn-confirmar-horas-extra');
    if (btnConfirmarHExtra) {
      btnConfirmarHExtra.addEventListener('click', _confirmarHorasExtra);
    }

    // Filtro de fecha en tabla de marcaciones
    const filtroFecha = document.getElementById('asistencia-filter-date');
    if (filtroFecha) {
      filtroFecha.addEventListener('change', () => _cargarMarcaciones(filtroFecha.value));
    }

    // Botón ver mapa
    const btnViewMap = document.getElementById('btn-view-map');
    if (btnViewMap) {
      btnViewMap.addEventListener('click', _mostrarMapaUbicaciones);
    }
  }

  function _setFechaHoy() {
    const hoy = AppState.today();
    const filtroFecha = document.getElementById('asistencia-filter-date');
    if (filtroFecha) filtroFecha.value = hoy;

    const display = document.getElementById('asistencia-date-display');
    if (display) {
      display.textContent = new Date(hoy + 'T12:00:00').toLocaleDateString('es-GT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
  }

  function _initAudio() {
    // Crear beep de confirmación via Web Audio API
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        _audio = {
          beepSuccess() {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
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
      }
    } catch (e) { /* Audio no disponible */ }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TABS
  // ─────────────────────────────────────────────────────────────────────────
  function _switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabId);
      t.setAttribute('aria-selected', t.dataset.tab === tabId ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      const isActive = content.id === `tab-${tabId}`;
      content.classList.toggle('active', isActive);
      content.hidden = !isActive;
    });

    // Detener scanner si se cambia a manual
    if (tabId !== 'qr-scanner' && _scannerActive) {
      _detenerScanner();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ESCÁNER QR
  // ─────────────────────────────────────────────────────────────────────────
  async function _iniciarScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      Alerts.error('El escáner QR no está disponible. Verifica los CDN.', 'Error');
      return;
    }

    // Verificar permiso de cámara
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err) {
      Alerts.error('No se pudo acceder a la cámara. Verifica los permisos del navegador.', 'Sin acceso a cámara');
      return;
    }

    const btnStart = document.getElementById('btn-start-scan');
    const btnStop  = document.getElementById('btn-stop-scan');

    try {
      _scanner = new Html5Qrcode('qr-reader');

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      await _scanner.start(
        { facingMode: 'environment' },
        config,
        _onQRSuccess,
        _onQRError
      );

      _scannerActive = true;
      if (btnStart) btnStart.hidden = true;
      if (btnStop)  btnStop.hidden  = false;

      // Ocultar resultado previo
      const resultPanel = document.getElementById('scan-result');
      if (resultPanel) resultPanel.hidden = true;

    } catch (err) {
      Alerts.error('Error al iniciar el escáner: ' + err.message, 'Error de cámara');
    }
  }

  async function _detenerScanner() {
    if (_scanner && _scannerActive) {
      try {
        await _scanner.stop();
      } catch (e) { /* Ignorar */ }
      _scannerActive = false;
    }

    const btnStart = document.getElementById('btn-start-scan');
    const btnStop  = document.getElementById('btn-stop-scan');
    if (btnStart) btnStart.hidden = false;
    if (btnStop)  btnStop.hidden  = true;
  }

  // Callback éxito de escaneo
  function _onQRSuccess(decodedText) {
    // Vibrar en dispositivos que lo soporten
    if (navigator.vibrate) navigator.vibrate(100);

    // Reproducir beep
    if (_audio) _audio.beepSuccess();

    const qrData = QRGenerator.parseQRData(decodedText);
    if (!qrData) {
      Alerts.warning('QR no reconocido. Usa un carné generado por este sistema.');
      return;
    }

    const trabajador = QRGenerator.buscarTrabajadorPorQR(qrData);
    if (!trabajador) {
      if (_audio) _audio.beepError();
      Alerts.error('Trabajador no encontrado en el sistema. ID: ' + (qrData.id || '—'), 'No encontrado');
      return;
    }

    // Detener scanner temporalmente
    _detenerScanner();

    _pendingWorker = trabajador;
    _mostrarResultadoScan(trabajador);
  }

  function _onQRError(error) {
    // Errores silenciosos durante el escaneo continuo (normal)
    // Solo loggear errores significativos
    if (!error.includes('No QR code found')) {
      console.debug('[Scanner]', error);
    }
  }

  function _mostrarResultadoScan(trabajador) {
    const panel = document.getElementById('scan-result');
    if (!panel) return;

    document.getElementById('scan-worker-name').textContent  = trabajador.Nombre_Completo || '--';
    document.getElementById('scan-worker-id').textContent    = trabajador.ID_Trabajador   || '--';
    document.getElementById('scan-worker-puesto').textContent = trabajador.Puesto         || '--';

    const photo = document.getElementById('scan-worker-photo');
    if (photo) {
      photo.src = trabajador.Fotografia_URL || '';
      photo.style.display = trabajador.Fotografia_URL ? 'block' : 'none';
    }

    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MARCACIÓN MANUAL CON AUTOCOMPLETE
  // ─────────────────────────────────────────────────────────────────────────
  function _buscarTrabajadorManual() {
    const query    = document.getElementById('manual-worker-search')?.value.toLowerCase() || '';
    const listEl   = document.getElementById('autocomplete-list');
    if (!listEl) return;

    if (query.length < 1) {
      _limpiarAutocomplete();
      return;
    }

    const personal = AppState.get('personal') || [];

    // Sin trabajadores registrados aún — guiar al usuario
    if (personal.length === 0) {
      listEl.innerHTML = `
        <li class="autocomplete-item" style="pointer-events:none;opacity:0.7;gap:var(--space-3);">
          <i data-lucide="users" style="width:20px;height:20px;color:var(--color-text-muted);flex-shrink:0;"></i>
          <div>
            <div class="item-name">Sin trabajadores registrados</div>
            <div class="item-detail">Ve a <b>Personal</b> para agregar trabajadores primero</div>
          </div>
        </li>`;
      listEl.hidden = false;
      if (window.lucide) lucide.createIcons({ nodes: [listEl] });
      return;
    }

    const results  = personal.filter(p =>
      (p.Nombre_Completo || '').toLowerCase().includes(query) ||
      (p.DPI_CUI         || '').includes(query) ||
      (p.Puesto          || '').toLowerCase().includes(query)
    ).slice(0, 8);

    if (results.length === 0) {
      _limpiarAutocomplete();
      return;
    }

    listEl.innerHTML = results.map(p => {
      const ini = inicialesDeNombre(p.Nombre_Completo);
      const col = colorPorPuesto(p.Puesto);
      return `
      <li class="autocomplete-item" data-id="${_escHtml(p.ID_Trabajador)}" role="option" tabindex="0">
        ${p.Fotografia_URL
          ? `<img src="${_escHtml(p.Fotografia_URL)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid ${col};"
                 onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';" />
             <span style="display:none;width:32px;height:32px;border-radius:50%;border:2px solid ${col};background:var(--glass-bg);align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${col};flex-shrink:0;">${ini}</span>`
          : `<span style="display:flex;width:32px;height:32px;border-radius:50%;border:2px solid ${col};background:var(--glass-bg);align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${col};flex-shrink:0;">${ini}</span>`
        }
        <div>
          <div class="item-name">${_escHtml(p.Nombre_Completo)}</div>
          <div class="item-detail">${_escHtml(p.Puesto)} · ${_escHtml(p.DPI_CUI)}</div>
        </div>
      </li>`;
    }).join('');

    listEl.hidden = false;

    if (window.lucide) lucide.createIcons({ nodes: [listEl] });

    // Click en item del autocomplete
    listEl.onclick = (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const id = item.dataset.id;
      const t  = personal.find(p => p.ID_Trabajador === id);
      if (t) _seleccionarTrabajadorManual(t);
    };

    // Accesibilidad teclado
    listEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const item = e.target.closest('.autocomplete-item');
        if (item) item.click();
      }
    };
  }

  function _limpiarAutocomplete() {
    const listEl = document.getElementById('autocomplete-list');
    if (listEl) {
      listEl.hidden = true;
      listEl.innerHTML = '';
    }
  }

  function _seleccionarTrabajadorManual(trabajador) {
    _pendingWorker = trabajador;
    _limpiarAutocomplete();

    const searchInput = document.getElementById('manual-worker-search');
    if (searchInput) searchInput.value = trabajador.Nombre_Completo;

    _mostrarTrabajadorManualSeleccionado(trabajador);
  }

  function _mostrarTrabajadorManualSeleccionado(trabajador) {
    const panel = document.getElementById('manual-worker-selected');
    if (!panel) return;

    document.getElementById('manual-worker-name').textContent   = trabajador.Nombre_Completo || '--';
    document.getElementById('manual-worker-id').textContent     = trabajador.ID_Trabajador   || '--';
    document.getElementById('manual-worker-puesto').textContent = trabajador.Puesto          || '--';

    const photo = document.getElementById('manual-worker-photo');
    if (photo) {
      photo.src = trabajador.Fotografia_URL || '';
      photo.style.display = trabajador.Fotografia_URL ? 'block' : 'none';
    }

    panel.hidden = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESAR MARCACIÓN
  // ─────────────────────────────────────────────────────────────────────────
  async function _procesarMarcacion(trabajador, tipo, horaOficial) {
    const config  = AppState.get('config');
    const horaActual = _getHoraActual();
    const tolerancia = parseInt(config.Tolerancia_Minutos || 15);

    // Calcular estado de la marcación
    const estadoMarcacion = _calcularEstado(horaOficial, horaActual, tolerancia);

    // Si es salida de obra y hay horas extra, preguntar
    if (tipo === 'Salida_Obra') {
      const horasExtra = _calcularHorasExtra(horaActual, config.Hora_Salida_Obra || '17:00');
      if (horasExtra > 0) {
        _pedirConfirmacionHorasExtra(trabajador, tipo, horaOficial, estadoMarcacion, horasExtra);
        return;
      }
    }

    await _enviarMarcacion(trabajador, tipo, horaOficial, estadoMarcacion, 0);
  }

  function _pedirConfirmacionHorasExtra(trabajador, tipo, horaOficial, estadoMarcacion, horasExtra) {
    _pendingMarcacion = { trabajador, tipo, horaOficial, estadoMarcacion };

    const modal = document.getElementById('modal-horas-extra');
    const workerNameEl = document.getElementById('horas-extra-worker-name');
    const valorInput   = document.getElementById('horas-extra-valor');

    if (workerNameEl) workerNameEl.textContent = `Trabajador: ${trabajador.Nombre_Completo}`;
    if (valorInput)   valorInput.value = horasExtra;

    if (modal) modal.hidden = false;
  }

  async function _confirmarHorasExtra() {
    if (!_pendingMarcacion) return;

    const horasExtra = parseFloat(document.getElementById('horas-extra-valor')?.value || 0);
    const { trabajador, tipo, horaOficial, estadoMarcacion } = _pendingMarcacion;

    const modal = document.getElementById('modal-horas-extra');
    if (modal) modal.hidden = true;
    _pendingMarcacion = null;

    await _enviarMarcacion(trabajador, tipo, horaOficial, estadoMarcacion, horasExtra);
  }

  async function _enviarMarcacion(trabajador, tipo, horaOficial, estadoMarcacion, horasExtra = 0) {
    const config = AppState.get('config');
    const hoy    = AppState.today();

    // Capture GPS location if enabled
    let gpsData = null;
    const gpsEnabled = config.GPS_Habilitado !== false; // Default to true
    let geofenceStatus = null;

    if (gpsEnabled && GPS.isAvailable()) {
      try {
        const position = await GPS.getCurrentPosition();
        gpsData = {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
        };

        // Check geofence if configured
        if (config.GPS_Centro_Lat && config.GPS_Centro_Lon) {
          const geofenceCenter = {
            latitude: parseFloat(config.GPS_Centro_Lat),
            longitude: parseFloat(config.GPS_Centro_Lon),
          };
          const radius = parseInt(config.GPS_Radio_Metros || DEFAULT_GEOFENCE_RADIUS);
          geofenceStatus = GPS.checkGeofence(position, geofenceCenter, radius);

          // Warn if outside geofence (but still allow marking)
          if (!geofenceStatus.inside && config.GPS_Requerir_Ubicacion === true) {
            // Use custom confirmation instead of window.confirm
            const confirmed = await Alerts.confirm(
              `Estás a ${geofenceStatus.distance}m del sitio de obra (${radius}m permitido). ` +
              '¿Deseas registrar la marcación de todas formas?',
              'Fuera del área permitida'
            );
            if (!confirmed) {
              Alerts.warning('Marcación cancelada por estar fuera del área permitida');
              return;
            }
          }
        }
      } catch (gpsError) {
        console.warn('[Asistencia] Error capturando GPS:', gpsError.message);
        // Continue without GPS - don't block attendance
        if (config.GPS_Requerir_Ubicacion === true) {
          Alerts.warning('No se pudo obtener la ubicación. Marcación no registrada.');
          return;
        }
      }
    }

    const payload = {
      idTrabajador:     trabajador.ID_Trabajador,
      nombreTrabajador: trabajador.Nombre_Completo,
      fecha:            hoy,
      tipoMarcacion:    tipo,
      horaProgramada:   horaOficial,
      estadoMarcacion:  estadoMarcacion,
      minutosTolerancia: parseInt(config.Tolerancia_Minutos || 15),
      horasExtra:       horasExtra,
      metodo:           _scannerActive || _pendingWorker ? 'Escaneo_QR' : 'Manual_Fisica',
      obra:             config.Nombre_Obra || 'Obra Principal',
      gpsData:          gpsData,
      geofenceStatus:   geofenceStatus,
    };

    // Determinar método más preciso
    const tab = document.querySelector('.tab.active');
    if (tab) {
      payload.metodo = tab.dataset.tab === 'qr-scanner' ? 'Escaneo_QR' : 'Manual_Fisica';
    }

    const loader = Alerts.loading('Registrando marcación...');
    const tipoLabel = { 'Entrada': 'Entrada', 'Salida_Receso': 'Salida Receso', 'Regreso_Receso': 'Regreso Receso', 'Salida_Obra': 'Salida de Obra' };

    try {
      const result = await API.registrarMarcacion(payload);
      loader.close();

      if (result.success) {
        // Feedback toast especial de marcación
        Alerts.marcacion({
          nombre:   trabajador.Nombre_Completo,
          tipo,
          horaReal: result.horaReal || _getHoraActual(),
          estado:   result.estadoMarcacion || estadoMarcacion,
        });

        // Vibrar
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        // Si fue guardado offline, reflejar inmediatamente en AppState.asistencias
        if (result.offline) {
          const horaReal = result.horaReal || _getHoraActual();
          const nuevaAsistencia = {
            ID_Asistencia:     `ASIS-LOCAL-${Date.now()}`,
            ID_Trabajador:     trabajador.ID_Trabajador,
            Nombre_Trabajador: trabajador.Nombre_Completo,
            Fecha:             hoy,
            Tipo_Marcacion:    tipo,
            Hora_Programada:   horaOficial,
            Hora_Real:         horaReal,
            Estado_Marcacion:  estadoMarcacion,
            Metodo_Registro:  payload.metodo,
            Horas_Extra:       horasExtra || 0,
            Ubicacion_Obra:    payload.obra,
            GPS_Latitud:       payload.gpsData?.latitude || null,
            GPS_Longitud:      payload.gpsData?.longitude || null,
            GPS_Accuracy:      payload.gpsData?.accuracy || null,
            Geofence_Inside:   payload.geofenceStatus?.inside || null,
            Geofence_Distance: payload.geofenceStatus?.distance || null,
            _offline:          true,
          };
          const asistenciaActual = AppState.get('asistencias') || [];
          AppState.set('asistencias', [...asistenciaActual, nuevaAsistencia]);

          // Renderizar tabla con datos locales directamente
          _renderTablaMarcaciones([...asistenciaActual, nuevaAsistencia].filter(a => a.Fecha === hoy));
        } else {
          // Recargar tabla desde servidor
          await _cargarMarcaciones(hoy);
        }

        // Limpiar UI
        _limpiarEstadoPendiente();

      } else {
        Alerts.error(result.error || 'Error al registrar la marcación');
      }
    } catch (err) {
      loader.close();
      Alerts.error(err.message, 'Error de conexión');
    }
  }

  function _limpiarEstadoPendiente() {
    _pendingWorker = null;

    // Ocultar resultado scan
    const scanResult = document.getElementById('scan-result');
    if (scanResult) scanResult.hidden = true;

    // Limpiar manual
    const manualPanel = document.getElementById('manual-worker-selected');
    if (manualPanel) manualPanel.hidden = true;

    const searchInput = document.getElementById('manual-worker-search');
    if (searchInput) searchInput.value = '';

    _limpiarAutocomplete();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TABLA DE MARCACIONES
  // ─────────────────────────────────────────────────────────────────────────
  async function _cargarMarcaciones(fecha) {
    fecha = fecha || AppState.today();

    // Modo offline: mostrar asistencias locales del AppState para la fecha
    if (AppState.get('backendMode') !== 'firestore') {
      const locales = (AppState.get('asistencias') || []).filter(a => a.Fecha === fecha);
      _renderTablaMarcaciones(locales);
      return;
    }

    // Siempre intentar cargar (API mockeada en demo, real en producción)
    try {
      const result = await API.obtenerAsistencias(fecha);
      if (result.success) {
        _renderTablaMarcaciones(result.data);
      } else {
        _renderTablaVacia();
      }
    } catch (err) {
      console.warn('[Asistencia] Error cargando marcaciones:', err.message);
      _renderTablaVacia();
    }
  }

  function _renderTablaMarcaciones(marcaciones) {
    const tbody = document.getElementById('asistencia-tbody');
    if (!tbody) return;

    if (!marcaciones || marcaciones.length === 0) {
      _renderTablaVacia();
      return;
    }

    const tipoLabel = {
      'Entrada':        'Entrada',
      'Salida_Receso':  'Sal. Receso',
      'Regreso_Receso': 'Reg. Receso',
      'Salida_Obra':    'Salida Obra',
    };

    tbody.innerHTML = marcaciones.map(m => {
      const estadoClase = {
        'A Tiempo':   'estado-a-tiempo',
        'Tolerancia': 'estado-tolerancia',
        'Atraso':     'estado-atraso',
        'Ausencia':   'estado-ausencia',
      }[m.Estado_Marcacion] || '';

      // GPS location display
      let locationDisplay = '—';
      if (m.GPS_Latitud && m.GPS_Longitud) {
        const isInside = m.Geofence_Inside !== false;
        const distance = m.Geofence_Distance ? `${m.Geofence_Distance}m` : '';
        const badgeClass = isInside ? 'inside' : 'outside';
        const badgeText = isInside ? 'En zona' : 'Fuera';
        
        locationDisplay = `
          <div class="location-badge ${badgeClass}">
            <i data-lucide="map-pin" style="width:12px;height:12px"></i>
            ${badgeText}
            ${distance ? `<span style="margin-left:4px;opacity:0.8">(${distance})</span>` : ''}
          </div>
          <a href="${GPS.getMapsLink(m.GPS_Latitud, m.GPS_Longitud)}" 
             target="_blank" 
             class="location-link"
             title="Ver en Google Maps">
            <i data-lucide="external-link" style="width:10px;height:10px"></i> Mapa
          </a>
        `;
      }

      return `
        <tr>
          <td data-label="Trabajador"><strong>${_escHtml(m.Nombre_Trabajador || '--')}</strong></td>
          <td data-label="Tipo"><span class="badge badge-blue">${_escHtml(tipoLabel[m.Tipo_Marcacion] || m.Tipo_Marcacion || '--')}</span></td>
          <td data-label="Programada">${_escHtml(m.Hora_Programada || '--')}</td>
          <td data-label="Real" style="font-family:var(--font-mono)">${_escHtml(m.Hora_Real ? m.Hora_Real.substring(0, 5) : '--')}</td>
          <td data-label="Estado"><span class="${estadoClase}">${_escHtml(m.Estado_Marcacion || '--')}</span></td>
          <td data-label="Método">
            ${m.Metodo_Registro === 'Escaneo_QR'
              ? '<span class="badge badge-green"><i data-lucide="qr-code" style="width:10px;height:10px"></i> QR</span>'
              : '<span class="badge badge-gray">Manual</span>'
            }
          </td>
          <td data-label="Horas Extra">${parseFloat(m.Horas_Extra || 0) > 0 ? `<strong style="color:var(--color-accent-amber)">${m.Horas_Extra}h</strong>` : '—'}</td>
          <td data-label="Ubicación">${locationDisplay}</td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
  }

  function _renderTablaVacia() {
    const tbody = document.getElementById('asistencia-tbody');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8" class="text-center">
          <div class="empty-state">
            <i data-lucide="clock"></i>
            <p>No hay marcaciones para esta fecha</p>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons({ nodes: [tbody] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LÓGICA DE HORARIOS Y TOLERANCIA
  // ─────────────────────────────────────────────────────────────────────────
  function _calcularEstado(horaOficial, horaReal, tolerancia) {
    if (!horaOficial || !horaReal) return 'A Tiempo';

    const [hO, mO] = horaOficial.split(':').map(Number);
    const [hR, mR] = horaReal.split(':').map(Number);

    const minOficial = hO * 60 + mO;
    const minReal    = hR * 60 + mR;
    const diferencia = minReal - minOficial;

    if (diferencia <= 0)          return 'A Tiempo';
    if (diferencia <= tolerancia) return 'Tolerancia';
    return 'Atraso';
  }

  function _calcularHorasExtra(horaReal, horaSalida) {
    if (!horaReal || !horaSalida) return 0;

    const [hS, mS] = horaSalida.split(':').map(Number);
    const [hR, mR] = horaReal.split(':').map(Number);

    const minSalida = hS * 60 + mS + 15; // 15 min de tolerancia antes de contar extra
    const minReal   = hR * 60 + mR;
    const exceso    = minReal - minSalida;

    if (exceso <= 0) return 0;
    return Math.round(exceso / 30) * 0.5; // Bloques de 0.5h
  }

  function _getHoraActual() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CARGAR MÓDULO (llamado desde router)
  // ─────────────────────────────────────────────────────────────────────────
  async function cargar() {
    _setFechaHoy();
    _actualizarHorariosBotones();
    await _cargarMarcaciones(AppState.today());
  }

  function _escHtml(str) {
    if (window.CPC?.StringHelpers?.escHtml) {
      return window.CPC.StringHelpers.escHtml(str);
    }
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HORARIOS DINÁMICOS — actualizar data-hora en botones desde AppState.config
  // ─────────────────────────────────────────────────────────────────────────
  function _actualizarHorariosBotones() {
    const config = AppState.get('config');
    if (!config) return;

    // Mapa: tipo de marcación → clave en config
    const horaMap = {
      'Entrada':        config.Hora_Entrada        || '07:00',
      'Salida_Receso':  config.Hora_Salida_Receso  || '10:00',
      'Regreso_Receso': config.Hora_Regreso_Receso || '10:30',
      'Salida_Obra':    config.Hora_Salida_Obra    || '17:00',
    };

    // Actualizar TODOS los botones de marcación en el DOM (QR y manual)
    document.querySelectorAll('.btn-marcacion[data-tipo]').forEach(btn => {
      const tipo = btn.dataset.tipo;
      if (horaMap[tipo]) {
        btn.dataset.hora = horaMap[tipo];

        // Actualizar el label visual de hora si existe en el botón
        const horaSpan = btn.querySelector('.hora-label');
        if (horaSpan) horaSpan.textContent = horaMap[tipo];
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAPA DE UBICACIONES
  // ─────────────────────────────────────────────────────────────────────────
  async function _mostrarMapaUbicaciones() {
    const fecha = document.getElementById('asistencia-filter-date')?.value || AppState.today();
    const config = AppState.get('config');

    // Get attendance data
    let asistencias = [];
    try {
      const result = await API.obtenerAsistencias(fecha);
      if (result.success) {
        asistencias = result.data;
      }
    } catch (err) {
      console.warn('[Asistencia] Error cargando asistencias para mapa:', err.message);
      // Try local data
      asistencias = (AppState.get('asistencias') || []).filter(a => a.Fecha === fecha);
    }

    // Filter records with GPS data
    const conGPS = asistencias.filter(a => a.GPS_Latitud && a.GPS_Longitud);

    if (conGPS.length === 0) {
      Alerts.info('No hay marcaciones con GPS para esta fecha');
      return;
    }

    // Get geofence configuration
    const geofenceCenter = (config.GPS_Centro_Lat && config.GPS_Centro_Lon)
      ? { lat: parseFloat(config.GPS_Centro_Lat), lon: parseFloat(config.GPS_Centro_Lon) }
      : null;
    const geofenceRadius = parseInt(config.GPS_Radio_Metros || 200);

    // Show map
    MapViewer.showAttendanceMap(conGPS, geofenceCenter, geofenceRadius);
  }

  // Limpiar recursos al salir de la página
  function cleanup() {
    if (_scannerActive) _detenerScanner();
    MapViewer.closeMap();
  }

  return { init, cargar, cleanup };
})();
