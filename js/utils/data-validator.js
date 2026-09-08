/**
 * CONTROL PERSONAL CAMPO — utils/data-validator.js
 * Data validation for attendance and worker records
 * @version 1.0.0
 */

const DataValidator = (() => {
  
  const validators = {
    attendance: (data) => {
      const errors = [];
      
      if (!data.idTrabajador) errors.push('ID de trabajador requerido');
      if (!data.fecha) errors.push('Fecha requerida');
      if (!data.tipoMarcacion) errors.push('Tipo de marcación requerido');
      
      // Validate attendance type
      const validTypes = ['Entrada', 'Salida_Receso', 'Regreso_Receso', 'Salida_Obra'];
      if (!validTypes.includes(data.tipoMarcacion)) {
        errors.push('Tipo de marcación inválido');
      }
      
      // Validate time format
      if (data.horaReal && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.horaReal)) {
        errors.push('Formato de hora inválido');
      }
      
      // Validate hours extra
      if (data.horasExtra !== undefined) {
        const hours = parseFloat(data.horasExtra);
        if (isNaN(hours) || hours < 0 || hours > 12) {
          errors.push('Horas extra debe ser entre 0 y 12');
        }
      }
      
      return { valid: errors.length === 0, errors };
    },
    
    worker: (data) => {
      const errors = [];
      
      if (!data.Nombre_Completo) errors.push('Nombre completo requerido');
      if (!data.DPI_CUI) errors.push('DPI/CUI requerido');
      if (!data.Puesto) errors.push('Puesto requerido');
      
      // Validate DPI format (13 digits for Guatemala)
      if (data.DPI_CUI) {
        const cleanDPI = data.DPI_CUI.replace(/\s/g, '');
        if (!/^\d{13}$/.test(cleanDPI)) {
          errors.push('DPI debe tener 13 dígitos numéricos');
        }
      }
      
      // Validate phone number format
      if (data.Telefono) {
        const cleanPhone = data.Telefono.replace(/[\s\-\(\)]/g, '');
        if (!/^\+?\d{8,15}$/.test(cleanPhone)) {
          errors.push('Formato de teléfono inválido');
        }
      }
      
      // Validate email format if provided
      if (data.Email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.Email)) {
          errors.push('Formato de email inválido');
        }
      }
      
      return { valid: errors.length === 0, errors };
    },
    
    config: (data) => {
      const errors = [];
      
      // Validate time formats
      const timeFields = ['Hora_Entrada', 'Hora_Salida_Receso', 'Hora_Regreso_Receso', 'Hora_Salida_Obra'];
      timeFields.forEach(field => {
        if (data[field] && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data[field])) {
          errors.push(`${field} debe tener formato HH:MM`);
        }
      });
      
      // Validate tolerance
      if (data.Tolerancia_Minutos !== undefined) {
        const tolerance = parseInt(data.Tolerancia_Minutos);
        if (isNaN(tolerance) || tolerance < 0 || tolerance > 60) {
          errors.push('Tolerancia debe estar entre 0 y 60 minutos');
        }
      }
      
      // Validate GPS coordinates
      if (data.GPS_Centro_Lat !== undefined && data.GPS_Centro_Lat !== null) {
        const lat = parseFloat(data.GPS_Centro_Lat);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          errors.push('Latitud GPS debe estar entre -90 y 90');
        }
      }
      
      if (data.GPS_Centro_Lon !== undefined && data.GPS_Centro_Lon !== null) {
        const lon = parseFloat(data.GPS_Centro_Lon);
        if (isNaN(lon) || lon < -180 || lon > 180) {
          errors.push('Longitud GPS debe estar entre -180 y 180');
        }
      }
      
      // Validate geofence radius
      if (data.GPS_Radio_Metros !== undefined) {
        const radius = parseInt(data.GPS_Radio_Metros);
        if (isNaN(radius) || radius < 10 || radius > 10000) {
          errors.push('Radio de geocerca debe estar entre 10 y 10000 metros');
        }
      }
      
      return { valid: errors.length === 0, errors };
    }
  };

  /**
   * Validate data based on type
   * @param {string} type - Type of data to validate (attendance, worker, config)
   * @param {object} data - Data to validate
   * @returns {object} Validation result with valid flag and errors array
   */
  function validate(type, data) {
    const validator = validators[type];
    if (!validator) {
      console.warn(`No validator found for type: ${type}`);
      return { valid: true, errors: [] };
    }
    
    return validator(data);
  }

  /**
   * Validate attendance record specifically
   * @param {object} data - Attendance data to validate
   * @returns {object} Validation result
   */
  function validateAttendance(data) {
    return validate('attendance', data);
  }

  /**
   * Validate worker record specifically
   * @param {object} data - Worker data to validate
   * @returns {object} Validation result
   */
  function validateWorker(data) {
    return validate('worker', data);
  }

  /**
   * Validate configuration specifically
   * @param {object} data - Configuration data to validate
   * @returns {object} Validation result
   */
  function validateConfig(data) {
    return validate('config', data);
  }

  /**
   * Format validation errors for display
   * @param {object} validationResult - Result from validate function
   * @returns {string} Formatted error message
   */
  function formatErrors(validationResult) {
    if (validationResult.valid) {
      return '';
    }
    
    return validationResult.errors.join(', ');
  }

  return { 
    validate, 
    validateAttendance, 
    validateWorker, 
    validateConfig,
    formatErrors 
  };
})();