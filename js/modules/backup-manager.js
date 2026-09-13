/**
 * CONTROL PERSONAL CAMPO — modules/backup-manager.js
 * Módulo de gestión de backup y exportación de datos
 * @version 1.0.0
 */

const BackupManager = (() => {
  
  function init() {
    if (window.Logger) {
      window.Logger.info('BackupManager', 'Inicializando módulo de backup');
    }
    _bindEvents();
  }
  
  function _bindEvents() {
    const btnExportBackup = document.getElementById('btn-export-backup');
    const btnImportBackup = document.getElementById('btn-import-backup');
    const importInput = document.getElementById('import-backup-input');
    const btnExportTrabajadores = document.getElementById('btn-export-trabajadores');
    const btnExportAsistencias = document.getElementById('btn-export-asistencias');
    
    if (btnExportBackup) {
      btnExportBackup.addEventListener('click', _handleExportBackup);
    }
    
    if (btnImportBackup) {
      btnImportBackup.addEventListener('click', () => {
        if (importInput) importInput.click();
      });
    }
    
    if (importInput) {
      importInput.addEventListener('change', _handleImportBackup);
    }
    
    if (btnExportTrabajadores) {
      btnExportTrabajadores.addEventListener('click', _handleExportTrabajadores);
    }
    
    if (btnExportAsistencias) {
      btnExportAsistencias.addEventListener('click', _handleExportAsistencias);
    }
  }
  
  function _handleExportBackup() {
    if (window.DataExport) {
      try {
        window.DataExport.createBackup();
        if (window.Alerts) {
          window.Alerts.success('Backup exportado exitosamente');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('BackupManager', 'Error al exportar backup', { 
            error: error.message 
          });
        }
        if (window.Alerts) {
          window.Alerts.error('Error al exportar backup');
        }
      }
    } else {
      if (window.Alerts) {
        window.Alerts.error('Módulo de exportación no disponible');
      }
    }
  }
  
  function _handleImportBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (window.DataExport) {
      try {
        window.DataExport.restoreBackup(file, (result) => {
          if (result.success) {
            if (window.Alerts) {
              window.Alerts.success('Backup restaurado exitosamente');
            }
            // Refresh data
            if (window.ModuloPersonal) {
              window.ModuloPersonal._filtrarTabla();
            }
            if (window.ModuloDashboard) {
              window.ModuloDashboard.cargar();
            }
          } else {
            if (window.Alerts) {
              window.Alerts.error(result.error || 'Error al restaurar backup');
            }
          }
        });
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('BackupManager', 'Error al importar backup', { 
            error: error.message 
          });
        }
        if (window.Alerts) {
          window.Alerts.error('Error al importar backup');
        }
      }
    } else {
      if (window.Alerts) {
        window.Alerts.error('Módulo de importación no disponible');
      }
    }
    
    // Reset input
    event.target.value = '';
  }
  
  function _handleExportTrabajadores() {
    const personal = AppState.get('personal') || [];
    
    if (personal.length === 0) {
      if (window.Alerts) {
        window.Alerts.warning('No hay trabajadores para exportar');
      }
      return;
    }
    
    if (window.DataExport) {
      try {
        window.DataExport.exportWorkerReport(personal);
        if (window.Alerts) {
          window.Alerts.success('Trabajadores exportados exitosamente');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('BackupManager', 'Error al exportar trabajadores', { 
            error: error.message 
          });
        }
        if (window.Alerts) {
          window.Alerts.error('Error al exportar trabajadores');
        }
      }
    }
  }
  
  function _handleExportAsistencias() {
    const asistencias = AppState.get('asistencias') || [];
    const personal = AppState.get('personal') || [];
    const today = new Date().toISOString().split('T')[0];
    
    const todayAsistencias = asistencias.filter(a => a.Fecha === today);
    
    if (todayAsistencias.length === 0) {
      if (window.Alerts) {
        window.Alerts.warning('No hay asistencias hoy para exportar');
      }
      return;
    }
    
    if (window.DataExport) {
      try {
        window.DataExport.exportAttendanceReport(todayAsistencias, personal, today);
        if (window.Alerts) {
          window.Alerts.success('Asistencias exportadas exitosamente');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('BackupManager', 'Error al exportar asistencias', { 
            error: error.message 
          });
        }
        if (window.Alerts) {
          window.Alerts.error('Error al exportar asistencias');
        }
      }
    }
  }
  
  return {
    init,
    _handleExportBackup,
    _handleImportBackup,
    _handleExportTrabajadores,
    _handleExportAsistencias
  };
})();

if (typeof window !== 'undefined') {
  window.BackupManager = BackupManager;
}