/**
 * CONTROL PERSONAL CAMPO — utils/data-export.js
 * Sistema de exportación e importación de datos
 * @version 1.0.0
 */

const DataExport = (() => {
  
  function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      if (window.Alerts) {
        window.Alerts.warning('No hay datos para exportar');
      }
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    
    // BOM UTF-8 para que Excel español reconozca caracteres especiales
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.Logger) {
      window.Logger.info('DataExport', 'Datos exportados a CSV', { 
        filename, 
        recordCount: data.length 
      });
    }
  }
  
  function exportToJSON(data, filename) {
    if (!data || data.length === 0) {
      if (window.Alerts) {
        window.Alerts.warning('No hay datos para exportar');
      }
      return;
    }
    
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.Logger) {
      window.Logger.info('DataExport', 'Datos exportados a JSON', { 
        filename, 
        recordCount: data.length 
      });
    }
  }
  
  function importFromJSON(file, callback) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (window.Logger) {
          window.Logger.info('DataExport', 'Datos importados desde JSON', { 
            recordCount: Array.isArray(data) ? data.length : 1 
          });
        }
        
        callback({ success: true, data });
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('DataExport', 'Error al importar JSON', { 
            error: error.message 
          });
        }
        callback({ success: false, error: 'Formato JSON inválido' });
      }
    };
    
    reader.onerror = () => {
      if (window.Logger) {
        window.Logger.error('DataExport', 'Error al leer archivo');
      }
      callback({ success: false, error: 'Error al leer archivo' });
    };
    
    reader.readAsText(file);
  }
  
  function exportAttendanceReport(asistencias, personal, fecha) {
    const report = asistencias.map(a => {
      const trabajador = personal.find(p => p.ID_Trabajador === a.ID_Trabajador);
      return {
        'ID Trabajador': a.ID_Trabajador || '',
        'Nombre Completo': trabajador?.Nombre_Completo || 'Desconocido',
        'DPI/CUI': trabajador?.DPI_CUI || 'N/A',
        'Puesto': trabajador?.Puesto || 'N/A',
        'Jefe Inmediato': trabajador?.Jefe_Inmediato || 'N/A',
        'Fecha Marcación': a.Fecha || '',
        'Tipo Marcación': a.Tipo_Marcacion || 'N/A',
        'Hora Programada': a.Hora_Programada || '--:--',
        'Hora Real': a.Hora_Real ? a.Hora_Real.substring(0, 5) : '--:--',
        'Estado Marcación': a.Estado_Marcacion || 'N/A',
        'Estado General': a.Estado_General || 'N/A',
        'Método Registro': a.Metodo_Registro || 'N/A',
        'Horas Extra': a.Horas_Extra || '0',
        'Ubicación Obra': a.Ubicacion_Obra || 'N/A',
        'Última Actualización': a.Ultima_Actualizacion ? new Date(a.Ultima_Actualizacion).toLocaleString('es-GT') : 'N/A'
      };
    });
    
    exportToCSV(report, `reporte_asistencia_${fecha}`);
  }
  
  function exportWorkerReport(personal) {
    const report = personal.map(p => ({
      'ID Trabajador': p.ID_Trabajador || '',
      'Nombre Completo': p.Nombre_Completo || '',
      'DPI/CUI': p.DPI_CUI || 'N/A',
      'Puesto': p.Puesto || 'N/A',
      'Jefe Inmediato': p.Jefe_Inmediato || 'N/A',
      'Teléfono': p.Telefono || 'N/A',
      'WhatsApp': p.Whatsapp || 'N/A',
      'Dirección': p.Direccion || 'N/A',
      'Estado': p.Estado || 'Activo',
      'Fecha Registro': p.Fecha_Registro || 'N/A',
      'Fecha Última Actualización': p.Ultima_Actualizacion ? new Date(p.Ultima_Actualizacion).toLocaleString('es-GT') : 'N/A'
    }));
    
    exportToCSV(report, 'reporte_trabajadores');
  }
  
  function createBackup() {
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        personal: AppState.get('personal') || [],
        asistencias: AppState.get('asistencias') || [],
        configuracion: AppState.get('config') || {}
      }
    };
    
    exportToJSON(backup, 'backup_completo');
    
    if (window.Logger) {
      window.Logger.info('DataExport', 'Backup completo creado', { 
        personalCount: backup.data.personal.length,
        asistenciasCount: backup.data.asistencias.length
      });
    }
  }
  
  function restoreBackup(file, callback) {
    importFromJSON(file, (result) => {
      if (!result.success) {
        callback(result);
        return;
      }
      
      const backup = result.data;
      
      if (!backup.data || !backup.timestamp) {
        callback({ success: false, error: 'Formato de backup inválido' });
        return;
      }
      
      // Restore data
      if (backup.data.personal) {
        AppState.set('personal', backup.data.personal);
      }
      
      if (backup.data.asistencias) {
        AppState.set('asistencias', backup.data.asistencias);
      }
      
      if (backup.data.configuracion) {
        AppState.set('config', backup.data.configuracion);
      }
      
      if (window.Logger) {
        window.Logger.info('DataExport', 'Backup restaurado exitosamente', { 
          backupDate: backup.timestamp,
          personalCount: backup.data.personal.length,
          asistenciasCount: backup.data.asistencias.length
        });
      }
      
      callback({ success: true, restoredAt: backup.timestamp });
    });
  }
  
  return {
    exportToCSV,
    exportToJSON,
    importFromJSON,
    exportAttendanceReport,
    exportWorkerReport,
    createBackup,
    restoreBackup
  };
})();

if (typeof window !== 'undefined') {
  window.DataExport = DataExport;
}