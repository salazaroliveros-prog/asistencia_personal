/**
 * CONTROL PERSONAL CAMPO — modules/dashboard.js
 * Panel de control: KPIs, gráficas Chart.js, panel de turno en tiempo real,
 * calendario interactivo y alertas.
 * @version 1.1.0
 */

const ModuloDashboard = (() => {

  // ─── Estado del módulo ────────────────────────────────────────────────────
  let _asistenciaDelMes = {};  // { 'YYYY-MM-DD': { presentes, total } }
  let _chartSemana      = null; // Instancia Chart.js semanal
  let _chartMes         = null; // Instancia Chart.js mensual
  let _turnoFiltroActivo = 'en-obra'; // tab activo del panel turno

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _setFechaInput();
    // Mantener las listas derivadas sincronizadas con marcaciones hechas desde
    // Asistencia (incluido el adapter local/demo), sin depender de un refresh
    // manual del Dashboard.
    AppState.on('asistencias', _onAttendanceStateChanged);
    AppState.on('personal', _onAttendanceStateChanged);
  }

  function _onAttendanceStateChanged() {
    const fecha = AppState.get('dashboardDate') || AppState.today();
    const personal = AppState.get('personal') || [];
    const asistencias = (AppState.get('asistencias') || []).filter(a => a.Fecha === fecha);
    _actualizarKPIs(personal, asistencias, fecha);
    _renderListaAsistenciaHoy(personal, asistencias);
    _renderPanelTurno(personal, asistencias);
  }

  function _bindEvents() {
    // Botón refrescar dashboard
    const btnRefresh = document.getElementById('btn-refresh-dashboard');
    if (btnRefresh) btnRefresh.addEventListener('click', cargar);

    // Cambio de fecha
    const fechaInput = document.getElementById('dashboard-date');
    if (fechaInput) {
      fechaInput.addEventListener('change', () => _cargarDatosFecha(fechaInput.value));
    }

    // Navegación del calendario
    document.getElementById('cal-prev')?.addEventListener('click', () => _navegarCalendario(-1));
    document.getElementById('cal-next')?.addEventListener('click', () => _navegarCalendario(1));

    // Marcar todas las alertas como revisadas
    document.getElementById('btn-clear-alerts')?.addEventListener('click', _marcarTodasAlertas);

    // Tabs del panel de turno
    document.querySelectorAll('.turno-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        _turnoFiltroActivo = tab.dataset.turno;
        document.querySelectorAll('.turno-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        _renderTurnoFiltrado();
      });
    });

    // Botón refresh turno
    document.getElementById('btn-refresh-turno')?.addEventListener('click', async () => {
      await Promise.allSettled([_cargarDatosFecha(AppState.today()), _cargarDatosMes()]);
    });
  }

  function _setFechaInput() {
    const hoy   = AppState.today();
    const input = document.getElementById('dashboard-date');
    if (input) input.value = hoy;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CARGAR DATOS PRINCIPALES
  // ─────────────────────────────────────────────────────────────────────────
  async function cargar() {
    const hoy = AppState.today();
    AppState.set('dashboardDate', hoy);

    _mostrarKPIsSkeleton();

    await Promise.allSettled([
      _cargarDatosFecha(hoy),
      _cargarAlertas(),
      _cargarDatosMes(),
      _cargarGraficaSemanal(),
    ]);
  }

  async function _cargarDatosFecha(fecha) {
    fecha = fecha || AppState.today();

    try {
      const [personalResult, asistenciaResult] = await Promise.allSettled([
        API.obtenerPersonal(),
        API.obtenerAsistencias(fecha),
      ]);

      const personal    = personalResult.status === 'fulfilled' && personalResult.value.success
        ? personalResult.value.data : (AppState.get('personal') || []);

      const asistencias = asistenciaResult.status === 'fulfilled' && asistenciaResult.value.success
        ? asistenciaResult.value.data
        : (AppState.get('asistencias') || []).filter(a => a.Fecha === fecha);

      _actualizarKPIs(personal, asistencias, fecha);
      _renderListaAsistenciaHoy(personal, asistencias);
      _renderPanelTurno(personal, asistencias);

    } catch (err) {
      console.warn('[Dashboard] Error cargando datos:', err.message);
      _calcularKPIsDesdeCache(fecha);
    }
  }

  function _calcularKPIsDesdeCache(fecha) {
    const personal    = AppState.get('personal') || [];
    const asistencias = AppState.get('asistencias') || [];
    _actualizarKPIs(personal, asistencias, fecha);
    _renderListaAsistenciaHoy(personal, asistencias);
    _renderPanelTurno(personal, asistencias);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KPI CARDS
  // ─────────────────────────────────────────────────────────────────────────
  function _mostrarKPIsSkeleton() {
    ['kpi-total', 'kpi-asistencia', 'kpi-tardanzas', 'kpi-ausencias'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '...';
    });
  }

  function _actualizarKPIs(personal, asistencias, fecha) {
    const total      = personal.length;
    const presentes  = new Set(asistencias.map(a => a.ID_Trabajador)).size;
    const ausentes   = Math.max(0, total - presentes);
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    const tardanzas  = asistencias.filter(a =>
      a.Estado_Marcacion === 'Atraso' || a.Estado_Marcacion === 'Tolerancia'
    ).length;

    _setKPI('kpi-total',      total);
    _setKPI('kpi-asistencia', porcentaje + '%');
    _setKPI('kpi-tardanzas',  tardanzas);
    _setKPI('kpi-ausencias',  ausentes);

    const kpiAsistencia = document.getElementById('kpi-asistencia');
    if (kpiAsistencia) {
      kpiAsistencia.style.color = porcentaje >= 90 ? 'var(--color-accent-green)'
        : porcentaje >= 75 ? 'var(--color-accent-amber)'
        : 'var(--color-accent-red)';
    }

    _asistenciaDelMes[fecha] = { presentes, total };
  }

  function _setKPI(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      el.style.transform  = 'scale(1.1)';
      setTimeout(() => { el.style.transform = 'scale(1)'; el.style.transition = 'transform 0.2s ease'; }, 100);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LISTA DE ASISTENCIA HOY
  // ─────────────────────────────────────────────────────────────────────────
  function _renderListaAsistenciaHoy(personal, asistencias) {
    const container = document.getElementById('attendance-today-list');
    const counter   = document.getElementById('today-count');
    if (!container) return;

    const presentesIds = [...new Set(asistencias.map(a => a.ID_Trabajador))];
    const presentes    = presentesIds.map(id => personal.find(p => p.ID_Trabajador === id)).filter(Boolean);

    if (counter) counter.textContent = presentes.length;

    if (presentes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox"></i>
          <p>Sin marcaciones hoy</p>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    const ultimaMarcacion = {};
    asistencias.forEach(a => {
      if (!ultimaMarcacion[a.ID_Trabajador] || a.Hora_Real > ultimaMarcacion[a.ID_Trabajador].Hora_Real) {
        ultimaMarcacion[a.ID_Trabajador] = a;
      }
    });

    const tipoLabel = {
      'Entrada':        '✓ Entrada',
      'Salida_Receso':  '☕ Receso',
      'Regreso_Receso': '↩ En Obra',
      'Salida_Obra':    '🏠 Salida',
    };

    container.innerHTML = presentes.map(p => {
      const ultima = ultimaMarcacion[p.ID_Trabajador];
      const whatsappNum = p.WhatsApp
        ? p.WhatsApp.replace('https://wa.me/', '')
        : (p.Telefono || '').replace(/\D/g, '');

      const iniciales = p.Nombre_Completo
        ? p.Nombre_Completo.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        : '??';

      // Color del tipo de marcación
      const estadoColor = {
        'Entrada':        'var(--color-accent-green)',
        'Salida_Receso':  'var(--color-accent-amber)',
        'Regreso_Receso': 'var(--color-accent-green)',
        'Salida_Obra':    'var(--color-text-muted)',
      }[ultima?.Tipo_Marcacion] || 'var(--color-accent-green)';

      return `
        <div class="attendance-item">
          ${p.Fotografia_URL
            ? `<img src="${p.Fotografia_URL}"
                  class="item-photo"
                  alt="${p.Nombre_Completo}"
                  loading="lazy"
                  style="border-color:${estadoColor};"
                  onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';" />
               <div class="item-photo" style="display:none;align-items:center;justify-content:center;background:var(--glass-bg);border:2px solid ${estadoColor};font-size:var(--text-xs);font-weight:700;color:${estadoColor};flex-shrink:0;">${iniciales}</div>`
            : `<div class="item-photo" style="display:flex;align-items:center;justify-content:center;background:var(--glass-bg);border:2px solid ${estadoColor};font-size:var(--text-xs);font-weight:700;color:${estadoColor};flex-shrink:0;">${iniciales}</div>`
          }
          <div class="item-info">
            <div class="item-name">${p.Nombre_Completo}</div>
            <div class="item-detail">
              ${p.Puesto} — ${ultima ? tipoLabel[ultima.Tipo_Marcacion] || ultima.Tipo_Marcacion : ''}
              ${ultima ? `<span style="opacity:0.6"> ${ultima.Hora_Real ? ultima.Hora_Real.substring(0,5) : ''}</span>` : ''}
            </div>
          </div>
          ${whatsappNum
            ? `<a href="https://wa.me/${whatsappNum}" target="_blank" rel="noopener noreferrer" class="table-action-btn" style="color:var(--color-accent-green)" title="Contactar por WhatsApp" aria-label="Contactar a ${p.Nombre_Completo} por WhatsApp">
                <i data-lucide="message-circle"></i>
              </a>`
            : ''
          }
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [container] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PANEL ¿QUIÉN ESTÁ EN OBRA? — Estado de turno en tiempo real
  // ─────────────────────────────────────────────────────────────────────────

  // Estado interno del turno para reutilizar en el filtrado
  let _turnoData = { enObra: [], receso: [], salio: [], sinMarcar: [] };

  function _renderPanelTurno(personal, asistencias) {
    // Calcular el ÚLTIMO tipo de marcación de cada trabajador hoy
    const ultimaMap = {};
    asistencias.forEach(a => {
      const prev = ultimaMap[a.ID_Trabajador];
      if (!prev || a.Hora_Real > prev.Hora_Real) {
        ultimaMap[a.ID_Trabajador] = a;
      }
    });

    const enObra    = [];
    const receso    = [];
    const salio     = [];
    const sinMarcar = [];

    personal.filter(p => p.Estado === 'Activo').forEach(p => {
      const ultima = ultimaMap[p.ID_Trabajador];
      if (!ultima) {
        sinMarcar.push({ trabajador: p, marcacion: null });
        return;
      }
      switch (ultima.Tipo_Marcacion) {
        case 'Entrada':
        case 'Regreso_Receso':
          enObra.push({ trabajador: p, marcacion: ultima });
          break;
        case 'Salida_Receso':
          receso.push({ trabajador: p, marcacion: ultima });
          break;
        case 'Salida_Obra':
          salio.push({ trabajador: p, marcacion: ultima });
          break;
        default:
          enObra.push({ trabajador: p, marcacion: ultima });
      }
    });

    _turnoData = { enObra, receso, salio, sinMarcar };

    // Actualizar contadores en tabs
    _setTurnoCount('turno-count-en-obra',    enObra.length);
    _setTurnoCount('turno-count-receso',     receso.length);
    _setTurnoCount('turno-count-salio',      salio.length);
    _setTurnoCount('turno-count-sin-marcar', sinMarcar.length);

    // Timestamp última actualización
    const tsEl = document.getElementById('turno-last-update');
    if (tsEl) {
      const now = new Date();
      tsEl.textContent = `Actualizado: ${now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
    }

    _renderTurnoFiltrado();
  }

  function _setTurnoCount(id, count) {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  }

  function _renderTurnoFiltrado() {
    const lista = document.getElementById('turno-lista');
    if (!lista) return;

    const grupos = {
      'en-obra':    { items: _turnoData.enObra,    color: 'var(--color-accent-green)',  icono: 'hard-hat',    etiqueta: 'En Obra' },
      'receso':     { items: _turnoData.receso,     color: 'var(--color-accent-amber)',  icono: 'coffee',      etiqueta: 'En Receso' },
      'salio':      { items: _turnoData.salio,      color: 'var(--color-accent-red)',    icono: 'log-out',     etiqueta: 'Ya Salió' },
      'sin-marcar': { items: _turnoData.sinMarcar,  color: 'var(--color-text-muted)',    icono: 'user-minus',  etiqueta: 'Sin Marcar' },
    };

    const grupo = grupos[_turnoFiltroActivo];
    if (!grupo) return;

    if (grupo.items.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <i data-lucide="${grupo.icono}"></i>
          <p>No hay trabajadores en estado "${grupo.etiqueta}"</p>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [lista] });
      return;
    }

    lista.innerHTML = grupo.items.map(({ trabajador: p, marcacion }) => {
      const horaStr = marcacion?.Hora_Real ? marcacion.Hora_Real.substring(0, 5) : '--';
      const whatsappNum = p.WhatsApp
        ? p.WhatsApp.replace('https://wa.me/', '')
        : (p.Telefono || '').replace(/\D/g, '');

      // Iniciales para el placeholder
      const iniciales = p.Nombre_Completo
        ? p.Nombre_Completo.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        : '??';

      return `
        <div class="turno-item" role="listitem">
          <div class="turno-item-indicator" style="background:${grupo.color}" aria-hidden="true"></div>
          ${p.Fotografia_URL
            ? `<img src="${p.Fotografia_URL}"
                  class="item-photo"
                  alt="${p.Nombre_Completo}"
                  loading="lazy"
                  style="border-color:${grupo.color};"
                  onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';" />
               <div class="turno-photo-placeholder" style="display:none;border-color:${grupo.color};color:${grupo.color};">${iniciales}</div>`
            : `<div class="turno-photo-placeholder" style="border-color:${grupo.color};color:${grupo.color};"
                    aria-hidden="true">${iniciales}</div>`
          }
          <div class="item-info">
            <div class="item-name">${p.Nombre_Completo}</div>
            <div class="item-detail">
              <span class="badge" style="background:${grupo.color}20;color:${grupo.color};border:1px solid ${grupo.color}40">
                ${p.Puesto}
              </span>
              ${marcacion ? `<span style="opacity:0.65;font-size:var(--text-xs)"> · ${grupo.etiqueta} desde ${horaStr}</span>` : ''}
            </div>
          </div>
          ${whatsappNum
            ? `<a href="https://wa.me/${whatsappNum}" target="_blank" rel="noopener noreferrer"
                  class="table-action-btn" style="color:var(--color-accent-green)"
                  title="WhatsApp" aria-label="WhatsApp de ${p.Nombre_Completo}">
                <i data-lucide="message-circle"></i>
              </a>`
            : ''
          }
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [lista] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRÁFICA SEMANAL — Últimos 7 días (Chart.js barras)
  // ─────────────────────────────────────────────────────────────────────────
  async function _cargarGraficaSemanal() {
    const canvas = document.getElementById('chart-semana');
    if (!canvas || typeof Chart === 'undefined') return;

    // Generar los últimos 7 días
    const dias = [];
    const hoy  = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(d.getDate() - i);
      dias.push(_dateToStr(d));
    }

    // Cargar asistencias del rango (funciona tanto en modo real como en modo demo)
    let datosPorDia = {};
    try {
      const result = await API.obtenerAsistenciaRango(dias[0], dias[6]);
      if (result.success && Array.isArray(result.data)) {
        const personal = AppState.get('personal') || [];
        const total    = personal.length || 1;

        // Contar presentes únicos por día
        result.data.forEach(a => {
          if (!datosPorDia[a.Fecha]) datosPorDia[a.Fecha] = new Set();
          datosPorDia[a.Fecha].add(a.ID_Trabajador);
        });

        // Convertir a porcentajes
        Object.keys(datosPorDia).forEach(fecha => {
          datosPorDia[fecha] = Math.round((datosPorDia[fecha].size / total) * 100);
        });
      }
    } catch (err) {
      console.warn('[Dashboard] Error cargando datos gráfica semanal:', err.message);
    }

    const labels     = dias.map(d => _formatDiaLabel(d));
    const dataValues = dias.map(d => datosPorDia[d] || 0);

    // Colores dinámicos por valor
    const bgColors = dataValues.map(v =>
      v >= 90 ? 'rgba(56, 203, 137, 0.7)' :
      v >= 75 ? 'rgba(251, 191, 36, 0.7)' :
      v > 0   ? 'rgba(239, 68, 68, 0.7)'  :
                'rgba(100, 116, 139, 0.3)'
    );

    const borderColors = dataValues.map(v =>
      v >= 90 ? 'rgb(56, 203, 137)' :
      v >= 75 ? 'rgb(251, 191, 36)' :
      v > 0   ? 'rgb(239, 68, 68)'  :
                'rgb(100, 116, 139)'
    );

    if (_chartSemana) {
      _chartSemana.data.labels            = labels;
      _chartSemana.data.datasets[0].data  = dataValues;
      _chartSemana.data.datasets[0].backgroundColor  = bgColors;
      _chartSemana.data.datasets[0].borderColor       = borderColors;
      _chartSemana.update('active');
      return;
    }

    _chartSemana = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '% Asistencia',
          data:  dataValues,
          backgroundColor:  bgColors,
          borderColor:      borderColors,
          borderWidth:      2,
          borderRadius:     8,
          borderSkipped:    false,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y}% asistencia`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: 'rgba(255,255,255,0.6)',
              callback: v => v + '%',
            },
            grid: {
              color: 'rgba(255,255,255,0.08)',
            },
            border: { color: 'rgba(255,255,255,0.1)' },
          },
          x: {
            ticks: { color: 'rgba(255,255,255,0.7)' },
            grid:  { display: false },
            border: { color: 'rgba(255,255,255,0.1)' },
          },
        },
        animation: {
          duration: 600,
          easing:   'easeOutQuart',
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRÁFICA MENSUAL — Línea de tendencia (Chart.js línea)
  // ─────────────────────────────────────────────────────────────────────────
  function _renderGraficaMes() {
    const canvas = document.getElementById('chart-mes');
    if (!canvas || typeof Chart === 'undefined') return;

    const mes      = AppState.get('calMonth');
    const anio     = AppState.get('calYear');
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();
    const hoy      = AppState.today();

    const labels     = [];
    const dataValues = [];

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      if (fechaStr > hoy) break; // No mostrar días futuros

      const datos = _asistenciaDelMes[fechaStr];
      labels.push(dia);
      dataValues.push(datos && datos.total > 0
        ? Math.round((datos.presentes / datos.total) * 100)
        : null // null = gap en la línea
      );
    }

    // Actualizar label del mes
    const mesLabel = document.getElementById('chart-mes-label');
    if (mesLabel) {
      const nombreMes = new Date(anio, mes, 1).toLocaleDateString('es-GT', { month: 'long' });
      mesLabel.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) + ' ' + anio;
    }

    if (_chartMes) {
      _chartMes.data.labels            = labels;
      _chartMes.data.datasets[0].data  = dataValues;
      _chartMes.update('active');
      return;
    }

    _chartMes = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label:            '% Asistencia',
          data:             dataValues,
          borderColor:      'rgb(0, 168, 232)',
          backgroundColor:  'rgba(0, 168, 232, 0.12)',
          borderWidth:      2.5,
          pointBackgroundColor: 'rgb(0, 168, 232)',
          pointRadius:      4,
          pointHoverRadius: 6,
          fill:             true,
          tension:          0.4,
          spanGaps:         false,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => `Día ${ctx[0].label}`,
              label: ctx => ctx.parsed.y !== null ? ` ${ctx.parsed.y}% asistencia` : ' Sin datos',
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: 'rgba(255,255,255,0.6)',
              callback: v => v + '%',
            },
            grid: { color: 'rgba(255,255,255,0.08)' },
            border: { color: 'rgba(255,255,255,0.1)' },
          },
          x: {
            ticks: {
              color: 'rgba(255,255,255,0.7)',
              maxTicksLimit: 10,
            },
            grid: { display: false },
            border: { color: 'rgba(255,255,255,0.1)' },
          },
        },
        animation: {
          duration: 600,
          easing:   'easeOutQuart',
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CALENDARIO INTERACTIVO
  // ─────────────────────────────────────────────────────────────────────────
  async function _cargarDatosMes() {
    const mes  = AppState.get('calMonth');
    const anio = AppState.get('calYear');

    const primerDia   = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
    const ultimoDia   = new Date(anio, mes + 1, 0);
    const ultimoDiaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

    if (AppState.get('backendMode') === 'firestore' || true) { // API resuelve Firestore o cache local
      try {
        const result = await API.obtenerAsistenciaRango(primerDia, ultimoDiaStr);
        if (result.success && Array.isArray(result.data)) {
          const personal = AppState.get('personal') || [];
          const total    = personal.length || 1;

          const porFecha = {};
          result.data.forEach(a => {
            if (!porFecha[a.Fecha]) porFecha[a.Fecha] = new Set();
            porFecha[a.Fecha].add(a.ID_Trabajador);
          });

          Object.keys(porFecha).forEach(fecha => {
            _asistenciaDelMes[fecha] = { presentes: porFecha[fecha].size, total };
          });
        }
      } catch (err) {
        console.warn('[Dashboard] Error cargando datos del mes:', err.message);
      }
    }

    _renderCalendario();
    _renderGraficaMes(); // Actualizar gráfica de tendencia mensual
  }

  function _renderCalendario() {
    const mes        = AppState.get('calMonth');
    const anio       = AppState.get('calYear');
    const grid       = document.getElementById('calendar-grid');
    const mesAnioEl  = document.getElementById('cal-month-year');
    if (!grid) return;

    const nombreMes = new Date(anio, mes, 1).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
    if (mesAnioEl) mesAnioEl.textContent = nombreMes;

    const diasSemana      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const diasEnMes       = new Date(anio, mes + 1, 0).getDate();
    const hoy             = AppState.today();

    let html = '';
    diasSemana.forEach(d => { html += `<div class="cal-day-header" role="columnheader">${d}</div>`; });
    for (let i = 0; i < primerDiaSemana; i++) { html += '<div class="cal-day empty" aria-hidden="true"></div>'; }

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const esHoy    = fechaStr === hoy;
      const datosDia = _asistenciaDelMes[fechaStr];

      let dotClass = '';
      let pct      = 0;
      if (datosDia && datosDia.total > 0) {
        pct = Math.round((datosDia.presentes / datosDia.total) * 100);
        dotClass = pct >= 90 ? 'green' : pct >= 75 ? 'amber' : 'red';
      }

      html += `
        <div class="cal-day ${esHoy ? 'today' : ''}"
             role="gridcell" tabindex="0"
             data-fecha="${fechaStr}"
             aria-label="${fechaStr}${datosDia ? `, ${pct}% asistencia` : ''}"
             title="${fechaStr}${datosDia ? ` — ${pct}% asistencia` : ''}">
          ${dia}
          ${dotClass ? `<span class="cal-dot ${dotClass}" aria-hidden="true"></span>` : ''}
        </div>`;
    }

    grid.innerHTML = html;

    grid.onclick = (e) => {
      const day = e.target.closest('.cal-day:not(.empty)');
      if (day?.dataset.fecha) _abrirDetalleDia(day.dataset.fecha);
    };
    grid.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const day = e.target.closest('.cal-day:not(.empty)');
        if (day?.dataset.fecha) { e.preventDefault(); _abrirDetalleDia(day.dataset.fecha); }
      }
    };
  }

  function _navegarCalendario(direccion) {
    let mes  = AppState.get('calMonth')  + direccion;
    let anio = AppState.get('calYear');
    if (mes < 0)  { mes = 11; anio--; }
    if (mes > 11) { mes = 0;  anio++; }
    AppState.set('calMonth', mes);
    AppState.set('calYear',  anio);
    _cargarDatosMes();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETALLE DE DÍA (Modal)
  // ─────────────────────────────────────────────────────────────────────────
  async function _abrirDetalleDia(fecha) {
    const modal   = document.getElementById('modal-dia-calendario');
    const title   = document.getElementById('modal-dia-title');
    const content = document.getElementById('modal-dia-content');
    if (!modal) return;

    const fechaFormateada = new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    if (title)   title.textContent = fechaFormateada;
    if (content) content.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner spinner-lg"></div>
        <p>Cargando datos del día...</p>
      </div>`;

    modal.hidden = false;

    try {
      const personal = AppState.get('personal') || [];
      let asistencias = [];
      // Siempre llamar API (funciona en modo demo y en modo real)
      try {
        const result = await API.obtenerAsistencias(fecha);
        if (result.success) asistencias = result.data;
      } catch (err) {
        // Fallback al caché de AppState
        asistencias = AppState.get('asistencias') || [];
      }

      const presentesIds = [...new Set(asistencias.map(a => a.ID_Trabajador))];
      const presentes    = presentesIds.map(id => personal.find(p => p.ID_Trabajador === id)).filter(Boolean);
      const ausentes     = personal.filter(p => !presentesIds.includes(p.ID_Trabajador));
      const pct          = personal.length > 0 ? Math.round((presentes.length / personal.length) * 100) : 0;

      if (content) {
        content.innerHTML = `
          <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-5);flex-wrap:wrap">
            <div class="glass-card glass-card-sm" style="flex:1;text-align:center;min-width:110px">
              <div style="font-size:var(--text-2xl);font-weight:800;color:var(--color-accent-green)">${presentes.length}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase">Presentes</div>
            </div>
            <div class="glass-card glass-card-sm" style="flex:1;text-align:center;min-width:110px">
              <div style="font-size:var(--text-2xl);font-weight:800;color:var(--color-accent-red)">${ausentes.length}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase">Ausentes</div>
            </div>
            <div class="glass-card glass-card-sm" style="flex:1;text-align:center;min-width:110px">
              <div style="font-size:var(--text-2xl);font-weight:800;color:${pct >= 90 ? 'var(--color-accent-green)' : pct >= 75 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)'}">${pct}%</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase">Asistencia</div>
            </div>
          </div>
          ${ausentes.length > 0 ? `
            <h4 style="margin-bottom:var(--space-3);color:var(--color-accent-red)">
              <i data-lucide="user-x"></i> Ausentes (${ausentes.length})
            </h4>
            <div style="display:flex;flex-direction:column;gap:var(--space-2);margin-bottom:var(--space-5)">
              ${ausentes.map(p => {
                const wa  = p.WhatsApp ? p.WhatsApp.replace('https://wa.me/', '') : (p.Telefono || '').replace(/\D/g, '');
                const ini = p.Nombre_Completo ? p.Nombre_Completo.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() : '??';
                const col = 'var(--color-accent-red)';
                return `
                  <div class="attendance-item">
                    ${p.Fotografia_URL
                      ? `<img src="${p.Fotografia_URL}" class="item-photo" alt="${p.Nombre_Completo}" loading="lazy"
                              style="border-color:${col};"
                              onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';" />
                         <div class="item-photo" style="display:none;align-items:center;justify-content:center;background:var(--glass-bg);border:2px solid ${col};font-size:var(--text-xs);font-weight:700;color:${col};flex-shrink:0;">${ini}</div>`
                      : `<div class="item-photo" style="display:flex;align-items:center;justify-content:center;background:var(--glass-bg);border:2px solid ${col};font-size:var(--text-xs);font-weight:700;color:${col};flex-shrink:0;">${ini}</div>`
                    }
                    <div class="item-info">
                      <div class="item-name">${p.Nombre_Completo}</div>
                      <div class="item-detail">${p.Puesto}</div>
                    </div>
                    ${wa ? `<a href="https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${p.Nombre_Completo}, tienes ausencia el ${fechaFormateada}`)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success"><i data-lucide="message-circle"></i> WA</a>` : ''}
                  </div>`;
              }).join('')}
            </div>` : ''}
          ${presentes.length > 0 ? `
            <h4 style="margin-bottom:var(--space-3);color:var(--color-accent-green)">
              <i data-lucide="user-check"></i> Presentes (${presentes.length})
            </h4>
            <div style="display:flex;flex-direction:column;gap:var(--space-2)">
              ${presentes.map(p => {
                const ultimaP   = asistencias.filter(a => a.ID_Trabajador === p.ID_Trabajador).sort((a,b) => (b.Hora_Real||'') > (a.Hora_Real||'') ? 1 : -1)[0];
                const colPresente = {
                  'Entrada':        'var(--color-accent-green)',
                  'Salida_Receso':  'var(--color-accent-amber)',
                  'Regreso_Receso': 'var(--color-accent-green)',
                  'Salida_Obra':    'var(--color-text-muted)',
                }[ultimaP?.Tipo_Marcacion] || 'var(--color-accent-green)';
                const ini = p.Nombre_Completo ? p.Nombre_Completo.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase() : '??';
                const tipoLabel = { 'Entrada':'✓ Entrada', 'Salida_Receso':'☕ Receso', 'Regreso_Receso':'↩ En Obra', 'Salida_Obra':'🏠 Salida' };
                return `
                  <div class="attendance-item">
                    ${p.Fotografia_URL
                      ? `<img src="${p.Fotografia_URL}" class="item-photo" alt="${p.Nombre_Completo}" loading="lazy"
                              style="border-color:${colPresente};"
                              onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';" />
                         <div class="item-photo" style="display:none;align-items:center;justify-content:center;background:var(--glass-bg);border:2px solid ${colPresente};font-size:var(--text-xs);font-weight:700;color:${colPresente};flex-shrink:0;">${ini}</div>`
                      : `<div class="item-photo" style="display:flex;align-items:center;justify-content:center;background:var(--glass-bg);border:2px solid ${colPresente};font-size:var(--text-xs);font-weight:700;color:${colPresente};flex-shrink:0;">${ini}</div>`
                    }
                    <div class="item-info">
                      <div class="item-name">${p.Nombre_Completo}</div>
                      <div class="item-detail">
                        ${p.Puesto}
                        ${ultimaP ? `<span style="opacity:0.65"> — ${tipoLabel[ultimaP.Tipo_Marcacion] || ultimaP.Tipo_Marcacion} ${ultimaP.Hora_Real ? ultimaP.Hora_Real.substring(0,5) : ''}</span>` : ''}
                      </div>
                    </div>
                  </div>`;
              }).join('')}
            </div>` : ''}`;

        if (window.lucide) lucide.createIcons({ nodes: [content] });
      }
    } catch (err) {
      if (content) content.innerHTML = `<p class="text-muted text-center" style="padding:var(--space-6)">Error al cargar datos: ${err.message}</p>`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ALERTAS
  // ─────────────────────────────────────────────────────────────────────────
  async function _cargarAlertas() {
    // Siempre llamar API (funciona en demo y en modo real)
    try {
      const result = await API.obtenerAlertas();
      if (result.success) {
        _renderAlertas(result.data);
        const badge = document.getElementById('alerts-badge');
        if (badge) {
          const count = result.data.length;
          badge.textContent = count;
          badge.hidden = count === 0;
        }
      } else {
        _renderAlertas([]);
      }
    } catch (err) {
      console.warn('[Dashboard] Error cargando alertas:', err.message);
      _renderAlertas([]);
    }
  }

  function _renderAlertas(alertas) {
    const container = document.getElementById('alerts-list');
    if (!container) return;

    // Mapa de ID → nombre para mostrar nombres en alertas
    const personalMap = {};
    (AppState.get('personal') || []).forEach(p => {
      personalMap[p.ID_Trabajador] = p.Nombre_Completo || p.ID_Trabajador;
    });

    if (!alertas || alertas.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="check-circle-2"></i>
          <p>No hay alertas pendientes</p>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    container.innerHTML = alertas.slice(0, 10).map(a => {
      const nombreTrab = a.ID_Trabajador ? (personalMap[a.ID_Trabajador] || a.ID_Trabajador) : '';
      return `
      <div class="alert-item" data-id="${a.ID_Alerta}">
        <i data-lucide="alert-circle"></i>
        <div class="alert-text">
          <div class="alert-title">${a.Tipo_Incidencia || '--'}</div>
          <div class="alert-detail">${nombreTrab}${a.Fecha_Hora ? ` — ${a.Fecha_Hora}` : ''}</div>
        </div>
        <button class="alert-dismiss" data-id="${a.ID_Alerta}" aria-label="Marcar alerta como revisada">
          <i data-lucide="check"></i>
        </button>
      </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [container] });

    container.querySelectorAll('.alert-dismiss').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await _descartarAlerta(btn.dataset.id);
      });
    });
  }

  async function _descartarAlerta(id) {
    try {
      await API.marcarAlertaRevisada(id);
      await _cargarAlertas();
    } catch (err) { Alerts.error(err.message, 'Error'); }
  }

  async function _marcarTodasAlertas() {
    const alertas = AppState.get('alertas') || [];
    if (alertas.length === 0) return;
    const confirmed = await Alerts.confirm(`¿Marcar las ${alertas.length} alertas como revisadas?`);
    if (!confirmed) return;
    const loader = Alerts.loading('Procesando alertas...');
    try {
      await Promise.allSettled(alertas.map(a => API.marcarAlertaRevisada(a.ID_Alerta)));
      loader.close();
      Alerts.success('Todas las alertas marcadas como revisadas');
      await _cargarAlertas();
    } catch (err) {
      loader.close();
      Alerts.error(err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  function _dateToStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function _formatDiaLabel(fechaStr) {
    const d = new Date(fechaStr + 'T12:00:00');
    return d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric' });
  }

  return { init, cargar };
})();
