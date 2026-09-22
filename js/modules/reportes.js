/**
 * CONTROL PERSONAL CAMPO — modules/reportes.js
 * Módulo de exportación de reportes: PDF diario, semanal, mensual y CSV.
 * @version 1.5.0
 */

const _ModuloReportes = (() => {

  // ─── Helpers globales ─────────────────────────────────────────────────────
  const isoDate = (date) => (window.CPC?.DateHelpers?.toISODate?.(date) ?? window.CPC?.StringHelpers?.dateToStr?.(date) ??
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _setFechasDefault();
  }

  function _setFechasDefault() {
    const hoy   = AppState.today();
    const fecha = document.getElementById('reporte-fecha-diario');
    if (fecha) fecha.value = hoy;

    // Semana actual (lunes a hoy)
    const lunes = _getLunesDeSemana(new Date());
    const lunesStr = isoDate(lunes);
    const semanainicio = document.getElementById('reporte-semana-inicio');
    const semanafin    = document.getElementById('reporte-semana-fin');
    if (semanainicio) semanainicio.value = lunesStr;
    if (semanafin)    semanafin.value    = hoy;

    // Mes actual
    const mesInput = document.getElementById('reporte-mes');
    if (mesInput) mesInput.value = hoy.substring(0, 7);
  }

  function _bindEvents() {
    // Diario
    _bindReporte('diario',
      'btn-preview-diario',
      'btn-pdf-diario',
      'btn-csv-diario',
      () => ({
        fechaInicio: document.getElementById('reporte-fecha-diario')?.value,
        fechaFin:    document.getElementById('reporte-fecha-diario')?.value,
        tipo:        'diario',
      }),
    );

    // Semanal
    _bindReporte('semanal',
      'btn-preview-semanal',
      'btn-pdf-semanal',
      'btn-csv-semanal',
      () => ({
        fechaInicio: document.getElementById('reporte-semana-inicio')?.value,
        fechaFin:    document.getElementById('reporte-semana-fin')?.value,
        tipo:        'semanal',
      }),
    );

    // Mensual
    _bindReporte('mensual',
      'btn-preview-mensual',
      'btn-pdf-mensual',
      'btn-csv-mensual',
      () => {
        const mes = document.getElementById('reporte-mes')?.value;
        if (!mes) return null;
        const [anio, mesNum] = mes.split('-').map(Number);
        const ultimoDia = new Date(anio, mesNum, 0).getDate();
        return {
          fechaInicio: `${mes}-01`,
          fechaFin:    `${mes}-${String(ultimoDia).padStart(2, '0')}`,
          tipo:        'mensual',
        };
      },
    );

    // Control de orientación en vista previa
    const orientationSel = document.getElementById('preview-orientation');
    if (orientationSel) {
      orientationSel.addEventListener('change', () => {
        const isLandscape = orientationSel.value === 'landscape';
        document.body.classList.toggle('print-landscape', isLandscape);
        const previewCard = document.getElementById('reporte-preview-card');
        if (previewCard && !previewCard.hidden) {
          const sheet = previewCard.querySelector('.print-preview-sheet');
          if (sheet) sheet.classList.toggle('landscape', isLandscape);
        }
      });
    }

    // Botón imprimir vista previa
    const btnPrint = document.getElementById('btn-print-preview');
    if (btnPrint) {
      btnPrint.addEventListener('click', _imprimirPreview);
    }
  }

  function _bindReporte(nombre, btnPreviewId, btnPdfId, btnCsvId, getParams) {
    const btnPreview = document.getElementById(btnPreviewId);
    const btnPdf     = document.getElementById(btnPdfId);
    const btnCsv     = document.getElementById(btnCsvId);

    if (btnPreview) btnPreview.addEventListener('click', async () => {
      const params = getParams();
      if (!_validarParams(params)) return;
      await _mostrarPreview(params);
    });

    if (btnPdf) btnPdf.addEventListener('click', async () => {
      const params = getParams();
      if (!_validarParams(params)) return;
      await _exportarPDF(params);
    });

    if (btnCsv) btnCsv.addEventListener('click', async () => {
      const params = getParams();
      if (!_validarParams(params)) return;
      await _exportarCSV(params);
    });
  }

  function _validarParams(params) {
    if (!params) {
      Alerts.error('Selecciona una fecha o período válido.');
      return false;
    }
    if (!params.fechaInicio || !params.fechaFin) {
      Alerts.error('Por favor selecciona las fechas del reporte.');
      return false;
    }
    if (params.fechaInicio > params.fechaFin) {
      Alerts.error('La fecha de inicio no puede ser mayor a la fecha fin.');
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OBTENER DATOS
  // ─────────────────────────────────────────────────────────────────────────
  let _avisoLocalMostrado = false;

  async function _obtenerDatos(fechaInicio, fechaFin) {
    const filterRange = (list) => (list || []).filter((a) => {
      const f = a.Fecha || '';
      return f >= fechaInicio && f <= fechaFin;
    });

    // Modo local / sin sesión: usar caché completa (no solo el día en AppState)
    if (AppState.get('backendMode') !== 'firestore' || !AppState.get('connected')) {
      if (!_avisoLocalMostrado) {
        Alerts.warning('Modo local activo. Los datos corresponden a este dispositivo.');
        _avisoLocalMostrado = true;
      }
      let cached = [];
      try {
        cached = JSON.parse(localStorage.getItem(window.LS_KEYS?.ATTENDANCE_CACHE || 'cpc_attendance_cache') || '[]');
      } catch (_e) {
        cached = [];
      }
      const fromState = AppState.get('asistencias') || [];
      const byId = new Map();
      [...cached, ...fromState].forEach((a, idx) => {
        if (!a) return;
        const key = a.ID_Marcacion || a.ID_Registro || a.ID_Asistencia
          || `${a.ID_Trabajador || 'x'}_${a.Fecha || ''}_${a.Tipo_Marcacion || ''}_${a.Hora_Real || idx}`;
        byId.set(key, a);
      });
      return filterRange([...byId.values()]);
    }

    try {
      if (fechaInicio === fechaFin) {
        const result = await API.obtenerAsistencias(fechaInicio);
        return result.success ? (result.data || []) : [];
      }
      const result = await API.obtenerAsistenciaRango(fechaInicio, fechaFin);
      return result.success ? (result.data || []) : [];
    } catch (err) {
      Alerts.error(err.message, 'Error al cargar datos');
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VISTA PREVIA
  // ─────────────────────────────────────────────────────────────────────────
  async function _mostrarPreview(params) {
    const loader = Alerts.loading('Generando vista previa...');

    try {
      const asistencias  = await _obtenerDatos(params.fechaInicio, params.fechaFin);
      const orientation  = document.getElementById('preview-orientation')?.value || 'portrait';
      const periodo      = _formatPeriodo(params);

      loader.close();

      const html = PDFBuilder.generarHTMLPreview(params.tipo, asistencias, periodo, orientation);

      const previewCard    = document.getElementById('reporte-preview-card');
      const previewContent = document.getElementById('reporte-preview-content');
      const previewTitle   = document.getElementById('preview-title');

      if (previewContent) previewContent.innerHTML = html;
      if (previewTitle) {
        previewTitle.innerHTML = `<i data-lucide="file-text"></i> Vista Previa — ${_labelTipo(params.tipo)} (${periodo})`;
      }
      if (previewCard) {
        previewCard.hidden = false;
        previewCard.scrollIntoView({ behavior: 'smooth' });
      }

      document.body.classList.toggle('print-landscape', orientation === 'landscape');

      if (window.lucide) lucide.createIcons({ nodes: [previewCard] });

    } catch (err) {
      loader.close();
      Alerts.error(err.message, 'Error al generar vista previa');
    }
  }

  function _imprimirPreview() {
    const orientation = document.getElementById('preview-orientation')?.value || 'portrait';
    const cleanup = () => {
      document.body.classList.remove('print-reporte');
      window.removeEventListener('afterprint', cleanup);
    };
    document.body.classList.toggle('print-landscape', orientation === 'landscape');
    document.body.classList.add('print-reporte');
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 2000);
    window.print();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORTAR PDF
  // ─────────────────────────────────────────────────────────────────────────
  async function _exportarPDF(params) {
    const loader = Alerts.loading('Generando PDF...');
    const btnPdf = document.querySelector('[id*="btn-pdf"]');
    if (btnPdf) btnPdf.disabled = true;

    try {
      const asistencias = await _obtenerDatos(params.fechaInicio, params.fechaFin);
      const orientation = document.getElementById('preview-orientation')?.value || 'portrait';

      let doc;
      if (params.tipo === 'diario') {
        doc = PDFBuilder.reporteDiario(params.fechaInicio, asistencias, orientation);
      } else {
        doc = PDFBuilder.reporteConsolidado(params.fechaInicio, params.fechaFin, asistencias, orientation);
      }

      const filename = `control-campo-${params.tipo}-${params.fechaInicio}.pdf`;
      doc.save(filename);

      loader.close();
      Alerts.success(`PDF "${filename}" descargado correctamente`);

    } catch (err) {
      loader.close();
      Alerts.error(err.message, 'Error al generar PDF');
    } finally {
      if (btnPdf) btnPdf.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORTAR CSV
  // ─────────────────────────────────────────────────────────────────────────
  async function _exportarCSV(params) {
    const loader = Alerts.loading('Generando CSV...');

    try {
      const asistencias = await _obtenerDatos(params.fechaInicio, params.fechaFin);
      const filename    = `control-campo-${params.tipo}-${params.fechaInicio}.csv`;

      PDFBuilder.exportarCSV(asistencias, filename, params.fechaInicio, params.fechaFin);

      loader.close();
      Alerts.success(`CSV "${filename}" descargado. Ábrelo con Excel o Google Sheets.`);

    } catch (err) {
      loader.close();
      Alerts.error(err.message, 'Error al generar CSV');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  function _formatPeriodo(params) {
    if (params.fechaInicio === params.fechaFin) {
      return new Date(params.fechaInicio + 'T12:00:00').toLocaleDateString('es-GT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    }
    const ini = new Date(params.fechaInicio + 'T12:00:00').toLocaleDateString('es-GT');
    const fin = new Date(params.fechaFin    + 'T12:00:00').toLocaleDateString('es-GT');
    return `${ini} al ${fin}`;
  }

  function _labelTipo(tipo) {
    const labels = { diario: 'Reporte Diario', semanal: 'Reporte Semanal', mensual: 'Reporte Mensual' };
    return labels[tipo] || tipo;
  }

  function _getLunesDeSemana(date) {
    const d   = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  }

  // Cargar al entrar al módulo
  async function cargar() {
    _setFechasDefault();
  }

  function cleanup() {
    // Sin listeners persistentes ni timers en este módulo.
  }

  return { init, cargar, cleanup };
})();

// Exponer el módulo globalmente
window.ModuloReportes = _ModuloReportes;