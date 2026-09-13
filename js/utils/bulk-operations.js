/**
 * CONTROL PERSONAL CAMPO — utils/bulk-operations.js
 * Sistema de operaciones en lote (bulk operations)
 * @version 1.0.0
 */

const BulkOperations = (() => {
  
  async function bulkDeleteWorkers(workerIds) {
    if (!workerIds || workerIds.length === 0) {
      return { success: false, error: 'No workers selected' };
    }
    
    if (window.Logger) {
      window.Logger.info('BulkOperations', 'Iniciando eliminación en lote', { 
        count: workerIds.length 
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const workerId of workerIds) {
      try {
        const result = await window.API.eliminarPersonal(workerId);
        if (result.success) {
          results.push(workerId);
        } else {
          errors.push({ workerId, error: result.error });
        }
      } catch (error) {
        errors.push({ workerId, error: error.message });
      }
    }
    
    if (window.Logger) {
      window.Logger.info('BulkOperations', 'Eliminación en lote completada', { 
        success: results.length,
        errors: errors.length
      });
    }
    
    return {
      success: errors.length === 0,
      results,
      errors,
      message: `${results.length} trabajadores eliminados, ${errors.length} errores`
    };
  }
  
  async function bulkUpdateWorkers(updates) {
    if (!updates || updates.length === 0) {
      return { success: false, error: 'No updates provided' };
    }
    
    if (window.Logger) {
      window.Logger.info('BulkOperations', 'Iniciando actualización en lote', { 
        count: updates.length 
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const update of updates) {
      try {
        const result = await window.API.actualizarPersonal(update);
        if (result.success) {
          results.push(update.id);
        } else {
          errors.push({ id: update.id, error: result.error });
        }
      } catch (error) {
        errors.push({ id: update.id, error: error.message });
      }
    }
    
    if (window.Logger) {
      window.Logger.info('BulkOperations', 'Actualización en lote completada', { 
        success: results.length,
        errors: errors.length
      });
    }
    
    return {
      success: errors.length === 0,
      results,
      errors,
      message: `${results.length} trabajadores actualizados, ${errors.length} errores`
    };
  }
  
  async function bulkDeleteAttendances(attendanceIds) {
    if (!attendanceIds || attendanceIds.length === 0) {
      return { success: false, error: 'No attendances selected' };
    }
    
    if (window.Logger) {
      window.Logger.info('BulkOperations', 'Iniciando eliminación de asistencias en lote', { 
        count: attendanceIds.length 
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const attendanceId of attendanceIds) {
      try {
        const result = await window.API.eliminarAsistencia(attendanceId);
        if (result.success) {
          results.push(attendanceId);
        } else {
          errors.push({ attendanceId, error: result.error });
        }
      } catch (error) {
        errors.push({ attendanceId, error: error.message });
      }
    }
    
    if (window.Logger) {
      window.Logger.info('BulkOperations', 'Eliminación de asistencias en lote completada', { 
        success: results.length,
        errors: errors.length
      });
    }
    
    return {
      success: errors.length === 0,
      results,
      errors,
      message: `${results.length} asistencias eliminadas, ${errors.length} errores`
    };
  }
  
  function showBulkProgress(current, total, operation) {
    const progress = Math.round((current / total) * 100);
    
    if (window.Alerts) {
      window.Alerts.info(`${operation}: ${current}/${total} (${progress}%)`);
    }
  }
  
  return {
    bulkDeleteWorkers,
    bulkUpdateWorkers,
    bulkDeleteAttendances,
    showBulkProgress
  };
})();

if (typeof window !== 'undefined') {
  window.BulkOperations = BulkOperations;
}