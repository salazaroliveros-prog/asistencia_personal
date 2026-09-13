/**
 * CONTROL PERSONAL CAMPO — utils/pdf-builder.js
 * Generador de reportes PDF con membrete institucional usando jsPDF + AutoTable.
 * @version 1.0.0
 */

const PDFBuilder = (() => {

  // ─── Constantes de estilo ─────────────────────────────────────────────────
  const COLORS = {
    primary:    [0, 126, 167],    // #007EA7
    dark:       [0, 52, 89],      // #003459
    light:      [244, 249, 249],  // #F4F9F9
    white:      [255, 255, 255],
    green:      [42, 157, 143],   // #2A9D8F
    amber:      [255, 183, 3],    // #FFB703
    red:        [230, 57, 70],    // #E63946
    grayLight:  [240, 244, 248],
    grayBorder: [208, 220, 232],
    textDark:   [20, 30, 40],
    textMuted:  [100, 120, 140],
  };

  const FONTS = {
    base: 10,
    sm:   8,
    xs:   7,
    h1:   18,
    h2:   14,
    h3:   11,
  };

  /**
   * Obtener instancia de jsPDF
   * @param {'portrait'|'landscape'} orientation
   */
  function _newDoc(orientation = 'portrait') {
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      throw new Error('jsPDF no está disponible. Verifica los CDN.');
    }
    const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    return new jsPDF({
      orientation,
      unit:   'mm',
      format: 'a4',
    });
  }

  /**
   * Obtener la configuración actual del sistema.
   */
  function _getConfig() {
    return AppState.get('config') || DEFAULT_CONFIG;
  }

  /**
   * Dibujar el membrete institucional en el documento.
   * @param {jsPDF} doc
   * @param {string} tipoReporte - Nombre del reporte
   * @param {string} periodo - Fecha/rango del reporte
   * @param {number} totalTrabajadores
   * @returns {number} Y cursor después del header
   */
  function _drawHeader(doc, tipoReporte, periodo, totalTrabajadores = 0) {
    const config   = _getConfig();
    const pageW    = doc.internal.pageSize.getWidth();
    const margin   = 15;
    let y          = margin;

    // ─── Línea azul superior ─────────────────────────────────────────────
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageW, 6, 'F');

    // ─── Línea decorativa secundaria ───────────────────────────────────
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 6, pageW, 2, 'F');

    y = 14;

    // ─── Logo (si existe) ─────────────────────────────────────────────────
    const logo = config.Logo_Base64;
    let logoWidth = 0;

    if (logo && logo.startsWith('data:image')) {
      try {
        const logoH = 25;
        logoWidth   = 25;
        doc.addImage(logo, 'PNG', margin, y, logoWidth, logoH);
        logoWidth += 8; // espacio después del logo
      } catch (e) {
        logoWidth = 0;
      }
    }

    // ─── Nombre de la app y reporte ──────────────────────────────────────
    const textX = margin + logoWidth;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTS.xs);
    doc.setTextColor(...COLORS.primary);
    doc.text(APP_NAME.toUpperCase(), textX, y + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTS.h1);
    doc.setTextColor(...COLORS.dark);
    doc.text(tipoReporte.toUpperCase(), textX, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONTS.h3);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(config.Nombre_Obra || 'Obra Principal', textX, y + 20);

    // ─── Metadatos (derecha) ─────────────────────────────────────────────
    const metaX = pageW - margin;
    const metaLines = [
      { label: 'Período:', value: periodo },
      { label: 'Encargado:', value: config.Encargado || 'Administrador' },
      { label: 'Total Trabajadores:', value: String(totalTrabajadores) },
      { label: 'Emitido:', value: _formatDate(new Date()) + ' ' + _formatTime(new Date()) },
      { label: 'Documento:', value: 'CONFIDENCIAL' },
    ];

    metaLines.forEach((item, i) => {
      const lineY = y + 4 + (i * 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONTS.xs);
      doc.setTextColor(...COLORS.textMuted);
      const labelW = doc.getTextWidth(item.label + ' ');
      doc.text(item.label, metaX - doc.getTextWidth(item.label) - doc.getTextWidth(item.value) - 2, lineY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.dark);
      doc.text(item.value, metaX - doc.getTextWidth(item.value), lineY);
    });

    y += 28;

    // ─── Línea separadora ─────────────────────────────────────────────────
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(1);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    return y;
  }

  /**
   * Agregar pie de página en todas las páginas del documento.
   * @param {jsPDF} doc
   */
  function _drawFooter(doc) {
    const config  = _getConfig();
    const pageCount = doc.internal.getNumberOfPages();
    const pageW   = doc.internal.pageSize.getWidth();
    const pageH   = doc.internal.pageSize.getHeight();
    const margin  = 15;

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Línea superior del footer
      doc.setDrawColor(...COLORS.grayBorder);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - 20, pageW - margin, pageH - 20);

      // Línea decorativa secundaria
      doc.setDrawColor(...COLORS.primary);
      doc.setLineWidth(0.3);
      doc.line(margin, pageH - 20, pageW - margin, pageH - 20);

      // Texto footer izquierda
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(
        `${config.Nombre_Obra || 'Obra Principal'} — ${APP_NAME} v${APP_VERSION}`,
        margin,
        pageH - 13
      );

      // Información adicional
      doc.setFontSize(6);
      doc.text(
        `Sistema de Control de Asistencia — Documento Oficial`,
        margin,
        pageH - 8
      );

      // Paginación (derecha)
      doc.setFontSize(7);
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageW - margin,
        pageH - 13,
        { align: 'right' }
      );

      // Confidencial (centro)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.red);
      doc.text(
        'DOCUMENTO CONFIDENCIAL',
        pageW / 2,
        pageH - 13,
        { align: 'center' }
      );

      // Fecha generación (centro, abajo)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(
        `Generado el ${_formatDate(new Date())} a las ${_formatTime(new Date())}`,
        pageW / 2,
        pageH - 8,
        { align: 'center' }
      );
    }
  }

  /**
   * Color del estado de marcación para PDF.
   */
  function _colorEstado(estado) {
    switch (estado) {
      case 'A Tiempo':   return COLORS.green;
      case 'Tolerancia': return COLORS.amber;
      case 'Atraso':     return COLORS.red;
      case 'Ausencia':   return COLORS.red;
      default:           return COLORS.textMuted;
    }
  }

  // ─── FORMATTERS ──────────────────────────────────────────────────────────
  function _formatDate(date) {
    if (!date) return '--';
    const d = date instanceof Date ? date : new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  function _formatTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function _labelTipoMarcacion(tipo) {
    const labels = {
      'Entrada':        'Entrada',
      'Salida_Receso':  'S. Receso',
      'Regreso_Receso': 'R. Receso',
      'Salida_Obra':    'Salida',
    };
    return labels[tipo] || tipo;
  }

  // ─── REPORTE DIARIO ───────────────────────────────────────────────────────

  /**
   * Genera el reporte diario de asistencia.
   * @param {string} fecha - YYYY-MM-DD
   * @param {Array} asistencias - Marcaciones del día
   * @param {'portrait'|'landscape'} orientation
   * @returns {jsPDF}
   */
  function reporteDiario(fecha, asistencias, orientation = 'portrait') {
    const doc      = _newDoc(orientation);
    const personal = AppState.get('personal') || [];
    const personalMap = new Map(personal.map(p => [p.ID_Trabajador, p]));

    // Resumen
    const presentes = new Set(asistencias.map(a => a.ID_Trabajador)).size;
    const total     = personal.length;
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    const tardanzas = asistencias.filter(a => a.Estado_Marcacion === 'Atraso').length;
    const presentesIds = new Set(asistencias.map(a => a.ID_Trabajador));
    const ausentes = personal
      .filter(p => p.Estado === 'Activo' && !presentesIds.has(p.ID_Trabajador))
      .map(worker => ({ __absence: true, worker }));
    const reporteRows = [...asistencias, ...ausentes];

    const fechaFormateada = fecha
      ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : _formatDate(new Date());

    let y = _drawHeader(doc, 'REPORTE DIARIO DE OBRA', fechaFormateada, total);

    // ─── Resumen ──────────────────────────────────────────────────────────
    const summaryData = [
      ['Total Personal', String(total)],
      ['Presentes', String(presentes)],
      ['Ausentes', String(total - presentes)],
      ['% Asistencia', porcentaje + '%'],
      ['Tardanzas', String(tardanzas)],
    ];

    _drawSummaryRow(doc, summaryData, y, orientation);
    y += 22;

    // ─── Tabla de marcaciones ─────────────────────────────────────────────
    if (reporteRows.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(FONTS.base);
      doc.setTextColor(...COLORS.textMuted);
      doc.text('No hay marcaciones registradas para esta fecha.', 15, y + 10);
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: 15, right: 15, top: 10, bottom: 22 },
        head: [['Trabajador', 'DPI', 'Puesto', 'Tipo', 'H. Prog.', 'H. Real', 'Estado', 'Método', 'H. Extra']],
        body: reporteRows.map(a => {
          if (a.__absence) {
            return [
              a.worker.Nombre_Completo || '--', a.worker.DPI_CUI || '--', a.worker.Puesto || '--',
              '—', '--', '--', 'Ausencia', '—', '-',
            ];
          }
          const worker = personalMap.get(a.ID_Trabajador) || {};
          return [
            a.Nombre_Trabajador || '--',
            a.DPI_CUI || worker.DPI_CUI || '--',
            worker.Puesto || '--',
            _labelTipoMarcacion(a.Tipo_Marcacion),
            a.Hora_Programada || '--',
            a.Hora_Real ? a.Hora_Real.substring(0, 5) : '--',
            a.Estado_Marcacion || '--',
            a.Metodo_Registro === 'Escaneo_QR' ? 'QR' : 'Manual',
            a.Horas_Extra > 0 ? a.Horas_Extra + 'h' : '-',
          ];
        }),
        headStyles: {
          fillColor: COLORS.primary,
          textColor: COLORS.white,
          fontStyle: 'bold',
          fontSize:  FONTS.xs,
          halign:    'center',
        },
        bodyStyles: {
          fontSize:   FONTS.sm,
          textColor:  COLORS.textDark,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: COLORS.grayLight,
        },
        columnStyles: {
          6: {
            cellWidth: 18,
            fontStyle: 'bold',
          },
        },
        didParseCell(data) {
          // Colorear columna Estado
          if (data.section === 'body' && data.column.index === 6) {
            const estado = data.cell.raw;
            const col    = _colorEstado(estado);
            data.cell.styles.textColor = col;
          }
        },
        showHead: 'everyPage',
        tableLineColor: COLORS.grayBorder,
        tableLineWidth: 0.1,
      });
    }

    _drawFooter(doc);
    return doc;
  }

  // ─── REPORTE SEMANAL / MENSUAL ────────────────────────────────────────────

  /**
   * Genera el reporte consolidado (semanal o mensual).
   * @param {string} fechaInicio - YYYY-MM-DD
   * @param {string} fechaFin - YYYY-MM-DD
   * @param {Array} asistencias - Todas las marcaciones del período
   * @param {'portrait'|'landscape'} orientation
   */
  function reporteConsolidado(fechaInicio, fechaFin, asistencias, orientation = 'landscape') {
    const doc      = _newDoc(orientation);
    const personal = AppState.get('personal') || [];

    const periodo = `${_formatDate(new Date(fechaInicio + 'T12:00:00'))} al ${_formatDate(new Date(fechaFin + 'T12:00:00'))}`;

    let y = _drawHeader(doc, 'REPORTE CONSOLIDADO DE ASISTENCIA', periodo, personal.length);

    // ─── Consolidar datos por trabajador ─────────────────────────────────
    const resumen = {};

    personal.forEach(p => {
      resumen[p.ID_Trabajador] = {
        id:         p.ID_Trabajador,
        nombre:     p.Nombre_Completo,
        puesto:     p.Puesto,
        diasTrabajados: 0,
        minutosAtraso:  0,
        horasExtra:     0,
        tardanzas:      0,
        ausencias:      0,
      };
    });

    // Calcular días únicos por trabajador
    const diasPorTrabajador = {};
    asistencias.forEach(a => {
      const id   = a.ID_Trabajador;
      const fecha = a.Fecha;
      if (!diasPorTrabajador[id]) diasPorTrabajador[id] = new Set();
      diasPorTrabajador[id].add(fecha);

      if (resumen[id]) {
        if (a.Estado_Marcacion === 'Atraso') {
          resumen[id].tardanzas++;
        }
        resumen[id].horasExtra += parseFloat(a.Horas_Extra) || 0;
      }
    });

    Object.keys(diasPorTrabajador).forEach(id => {
      if (resumen[id]) {
        resumen[id].diasTrabajados = diasPorTrabajador[id].size;
      }
    });

    // Calcular días hábiles en el período
    const diasHabiles = _contarDiasHabiles(fechaInicio, fechaFin);

    Object.values(resumen).forEach(r => {
      r.ausencias = Math.max(0, diasHabiles - r.diasTrabajados);
    });

    const tableData = Object.values(resumen).map(r => [
      r.nombre,
      r.puesto,
      String(r.diasTrabajados),
      String(diasHabiles),
      String(r.ausencias),
      String(r.tardanzas),
      r.horasExtra.toFixed(1) + 'h',
      r.diasTrabajados > 0 ? Math.round((r.diasTrabajados / diasHabiles) * 100) + '%' : '0%',
    ]);

    // Resumen total
    const totalDias     = Object.values(resumen).reduce((s, r) => s + r.diasTrabajados, 0);
    const totalAusencias = Object.values(resumen).reduce((s, r) => s + r.ausencias, 0);
    const totalHExtra   = Object.values(resumen).reduce((s, r) => s + r.horasExtra, 0);

    _drawSummaryRow(doc, [
      ['Trabajadores',    String(personal.length)],
      ['Días Hábiles',    String(diasHabiles)],
      ['Total Ausencias', String(totalAusencias)],
      ['Total H. Extra',  totalHExtra.toFixed(1) + 'h'],
    ], y, orientation);
    y += 22;

    doc.autoTable({
      startY: y,
      margin: { left: 15, right: 15, top: 10, bottom: 22 },
      head: [['Trabajador', 'Puesto', 'Días Trabajados', 'Días Hábiles', 'Ausencias', 'Tardanzas', 'H. Extra', '% Asist.']],
      body: tableData,
      headStyles: {
        fillColor: COLORS.primary,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize:  FONTS.xs,
        halign:    'center',
      },
      bodyStyles: {
        fontSize:    FONTS.sm,
        textColor:   COLORS.textDark,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: COLORS.grayLight,
      },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center', fontStyle: 'bold' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell(data) {
        // Colorear ausencias
        if (data.section === 'body' && data.column.index === 4) {
          const val = parseInt(data.cell.raw);
          if (val > 0) data.cell.styles.textColor = COLORS.red;
        }
        // Colorear % asistencia
        if (data.section === 'body' && data.column.index === 7) {
          const pct = parseInt(data.cell.raw);
          if (pct >= 90)       data.cell.styles.textColor = COLORS.green;
          else if (pct >= 75)  data.cell.styles.textColor = COLORS.amber;
          else                 data.cell.styles.textColor = COLORS.red;
        }
      },
      showHead: 'everyPage',
    });

    _drawFooter(doc);
    return doc;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function _drawSummaryRow(doc, items, y, orientation) {
    const pageW  = orientation === 'landscape' ? 297 : 210;
    const margin = 15;
    const usableW = pageW - margin * 2;
    const itemW = usableW / items.length;

    items.forEach((item, i) => {
      const x = margin + (i * itemW);

      doc.setFillColor(...COLORS.grayLight);
      doc.setDrawColor(...COLORS.grayBorder);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, itemW - 2, 18, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(item[0], x + (itemW - 2) / 2, y + 5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONTS.h3);
      doc.setTextColor(...COLORS.dark);
      doc.text(item[1], x + (itemW - 2) / 2, y + 14, { align: 'center' });
    });
  }

  function _contarDiasHabiles(inicio, fin) {
    let count = 0;
    const start = new Date(inicio + 'T12:00:00');
    const end   = new Date(fin   + 'T12:00:00');

    const current = new Date(start);
    while (current <= end) {
      const dow = current.getDay();
      if (dow !== 0) count++; // Excluir domingo (en Guatemala el sábado es laborable en construcción)
      current.setDate(current.getDate() + 1);
    }
    return count || 1;
  }

  // ─── EXPORTAR CSV ─────────────────────────────────────────────────────────

  /**
   * Genera y descarga un CSV de asistencias.
   * @param {Array} asistencias
   * @param {string} filename
   */
  function exportarCSV(asistencias, filename = 'asistencias.csv', fechaInicio = '', fechaFin = fechaInicio) {
    const personalMap = new Map((AppState.get('personal') || []).map(p => [p.ID_Trabajador, p]));
    const headers = [
      'ID_Marcacion', 'ID_Trabajador', 'Nombre_Completo', 'DPI_CUI', 'Puesto', 'Jefe_Inmediato',
      'Fecha', 'Tipo_Marcacion', 'Hora_Programada', 'Hora_Real', 'Estado_Marcacion', 
      'Estado_General', 'Metodo_Registro', 'Horas_Extra', 'Ubicacion_Obra', 'Ultima_Actualizacion'
    ];

    const presentesIds = new Set(asistencias.filter(a => a.Tipo_Marcacion === 'Entrada').map(a => a.ID_Trabajador));
    const absentRows = fechaInicio === fechaFin
      ? [...personalMap.values()].filter(p => p.Estado === 'Activo' && !presentesIds.has(p.ID_Trabajador)).map(worker => ({ __absence: true, worker }))
      : [];
    const rawRows = [...asistencias, ...absentRows].map(a => a.__absence ? [
      '', a.worker.ID_Trabajador || '', a.worker.Nombre_Completo || '', a.worker.DPI_CUI || '',
      a.worker.Puesto || '', a.worker.Jefe_Inmediato || '', fechaInicio, '', '', '', 'Ausencia', '', '', '0', '', '',
    ] : [
      a.ID_Marcacion || a.ID_Asistencia || a.ID_Registro || '',
      a.ID_Trabajador    || '',
      a.Nombre_Trabajador || personalMap.get(a.ID_Trabajador)?.Nombre_Completo || '',
      a.DPI_CUI || personalMap.get(a.ID_Trabajador)?.DPI_CUI || '',
      personalMap.get(a.ID_Trabajador)?.Puesto || '',
      personalMap.get(a.ID_Trabajador)?.Jefe_Inmediato || '',
      a.Fecha            || '',
      a.Tipo_Marcacion   || '',
      a.Hora_Programada  || '',
      a.Hora_Real        ? a.Hora_Real.substring(0, 5) : '',
      a.Estado_Marcacion || '',
      a.Estado_General   || '',
      a.Metodo_Registro  || '',
      a.Horas_Extra      || '0',
      a.Ubicacion_Obra   || '',
      a.Ultima_Actualizacion ? new Date(a.Ultima_Actualizacion).toLocaleString('es-GT') : '',
    ]);
    const rows = rawRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`));

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const BOM        = '\uFEFF'; // UTF-8 BOM para Excel español
    const blob       = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url        = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── VISTA PREVIA HTML ────────────────────────────────────────────────────

  /**
   * Genera HTML de vista previa del reporte para mostrar en modal.
   * @param {string} tipo - 'diario' | 'semanal' | 'mensual'
   * @param {Array} asistencias
   * @param {string} periodo
   * @param {string} orientation
   */
  function generarHTMLPreview(tipo, asistencias, periodo, orientation = 'portrait') {
    const config   = _getConfig();
    const personal = AppState.get('personal') || [];
    const presentes = new Set(asistencias.map(a => a.ID_Trabajador)).size;

    const filas = asistencias.map((a, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${a.Nombre_Trabajador || '--'}</strong></td>
        <td>${_labelTipoMarcacion(a.Tipo_Marcacion)}</td>
        <td>${a.Hora_Programada || '--'}</td>
        <td>${a.Hora_Real ? a.Hora_Real.substring(0, 5) : '--'}</td>
        <td class="print-estado-${(a.Estado_Marcacion || 'tiempo').toLowerCase().replace(' ', '-')}">${a.Estado_Marcacion || '--'}</td>
        <td>${a.Metodo_Registro === 'Escaneo_QR' ? 'QR' : 'Manual'}</td>
        <td>${a.Horas_Extra > 0 ? a.Horas_Extra + 'h' : '-'}</td>
      </tr>
    `).join('');

    return `
      <div class="print-preview-sheet${orientation === 'landscape' ? ' landscape' : ''}">
        <div class="print-header">
          <div class="print-title-block">
            <p class="print-app-name">${APP_NAME}</p>
            <h1 class="print-report-name">REPORTE ${tipo.toUpperCase()}</h1>
            <p class="print-obra-name">${config.Nombre_Obra || 'Obra Principal'}</p>
          </div>
          <div class="print-meta-block">
            <p class="print-meta-item"><strong>Período:</strong> ${periodo}</p>
            <p class="print-meta-item"><strong>Encargado:</strong> ${config.Encargado || 'Administrador'}</p>
            <p class="print-meta-item"><strong>Emitido:</strong> ${new Date().toLocaleString('es-GT')}</p>
          </div>
        </div>
        <div class="print-summary">
          <div class="print-summary-item"><span class="print-summary-label">Total Personal</span><span class="print-summary-value">${personal.length}</span></div>
          <div class="print-summary-item"><span class="print-summary-label">Presentes</span><span class="print-summary-value">${presentes}</span></div>
          <div class="print-summary-item"><span class="print-summary-label">Ausentes</span><span class="print-summary-value">${personal.length - presentes}</span></div>
          <div class="print-summary-item"><span class="print-summary-label">Marcaciones</span><span class="print-summary-value">${asistencias.length}</span></div>
        </div>
        <table class="print-table">
          <thead>
            <tr>
              <th>#</th><th>Nombre</th><th>Tipo</th><th>H. Prog.</th><th>H. Real</th><th>Estado</th><th>Método</th><th>H. Extra</th>
            </tr>
          </thead>
          <tbody>
            ${filas || '<tr><td colspan="8" style="text-align:center;color:#888;font-style:italic">Sin registros para este período</td></tr>'}
          </tbody>
        </table>
        <div class="print-footer">
          <div>
            <div class="print-signature-line">Firma del Encargado</div>
          </div>
          <div class="print-pagination">
            ${APP_NAME} v${APP_VERSION} — Documento confidencial
          </div>
        </div>
      </div>
    `;
  }

  // API Pública
  return {
    reporteDiario,
    reporteConsolidado,
    exportarCSV,
    generarHTMLPreview,
  };
})();
