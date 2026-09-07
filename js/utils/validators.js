/**
 * CONTROL PERSONAL CAMPO — utils/validators.js
 * Módulo de validaciones compartido para consistencia en toda la aplicación.
 * @version 1.0.0
 */

const Validators = (() => {

  // ─── Constantes de Validación ───────────────────────────────────────────────
  const VALIDATION_RULES = {
    DPI_LENGTH: 13,
    DPI_MIN_LENGTH: 4,
    DPI_MAX_LENGTH: 13,
    TOLERANCIA_MIN: 0,
    TOLERANCIA_MAX: 60,
    LATITUDE_MIN: -90,
    LATITUDE_MAX: 90,
    LONGITUDE_MIN: -180,
    LONGITUDE_MAX: 180,
    GPS_RADIUS_MIN: 10,
    GPS_RADIUS_MAX: 10000,
    NOMBRE_MIN_LENGTH: 2,
    NOMBRE_MAX_LENGTH: 100,
    TELEFONO_LENGTH: 8,
    IMAGEN_MAX_SIZE: 600 * 1024, // 600KB
    IMAGEN_MAX_DIMENSION: 300,
  };

  // ─── Validaciones de Campos ──────────────────────────────────────────────────

  /**
   * Valida un número de DPI/CUI guatemalteco.
   * @param {string} dpi - Número de DPI a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateDPI(dpi) {
    if (!dpi || typeof dpi !== 'string') {
      return { valid: false, error: 'El DPI es requerido' };
    }

    const cleanDPI = dpi.replace(/\D/g, '');

    if (cleanDPI.length < VALIDATION_RULES.DPI_MIN_LENGTH) {
      return { valid: false, error: `El DPI debe tener al menos ${VALIDATION_RULES.DPI_MIN_LENGTH} dígitos` };
    }

    if (cleanDPI.length > VALIDATION_RULES.DPI_MAX_LENGTH) {
      return { valid: false, error: `El DPI no puede exceder ${VALIDATION_RULES.DPI_MAX_LENGTH} dígitos` };
    }

    // Validación básica de checksum para DPI guatemalteco
    if (cleanDPI.length === VALIDATION_RULES.DPI_LENGTH) {
      const checksum = calculateDPIChecksum(cleanDPI);
      if (!checksum.valid) {
        return { valid: false, error: 'El DPI no tiene un formato válido' };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Calcula el checksum de un DPI guatemalteco (algoritmo simplificado).
   * @param {string} dpi - DPI limpio (solo dígitos)
   * @returns {object} { valid: boolean }
   */
  function calculateDPIChecksum(dpi) {
    // Algoritmo simplificado de validación de DPI guatemalteco
    // Para producción, implementar el algoritmo oficial del RENAP
    const digits = dpi.split('').map(Number);
    
    // Verificar que todos sean dígitos
    if (digits.some(d => isNaN(d))) {
      return { valid: false };
    }

    // Verificar longitud exacta para checksum completo
    if (digits.length !== VALIDATION_RULES.DPI_LENGTH) {
      return { valid: true }; // Aceptar si no es longitud exacta
    }

    // Algoritmo de módulo 11 (simplificado)
    let sum = 0;
    for (let i = 0; i < digits.length - 1; i++) {
      sum += digits[i] * (digits.length - i);
    }

    const remainder = sum % 11;
    const expectedCheckDigit = remainder === 0 ? 0 : 11 - remainder;

    return { valid: expectedCheckDigit === digits[digits.length - 1] };
  }

  /**
   * Valida un nombre completo.
   * @param {string} nombre - Nombre a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateNombre(nombre) {
    if (!nombre || typeof nombre !== 'string') {
      return { valid: false, error: 'El nombre es requerido' };
    }

    const trimmed = nombre.trim();

    if (trimmed.length < VALIDATION_RULES.NOMBRE_MIN_LENGTH) {
      return { valid: false, error: `El nombre debe tener al menos ${VALIDATION_RULES.NOMBRE_MIN_LENGTH} caracteres` };
    }

    if (trimmed.length > VALIDATION_RULES.NOMBRE_MAX_LENGTH) {
      return { valid: false, error: `El nombre no puede exceder ${VALIDATION_RULES.NOMBRE_MAX_LENGTH} caracteres` };
    }

    // Verificar que contenga al menos letras y espacios
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/.test(trimmed)) {
      return { valid: false, error: 'El nombre solo puede contener letras, espacios y caracteres comunes' };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida un número de teléfono guatemalteco.
   * @param {string} telefono - Teléfono a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateTelefono(telefono) {
    if (!telefono) {
      return { valid: true, error: null }; // Teléfono opcional
    }

    const clean = telefono.replace(/\D/g, '');

    if (clean.length !== VALIDATION_RULES.TELEFONO_LENGTH) {
      return { valid: false, error: `El teléfono debe tener ${VALIDATION_RULES.TELEFONO_LENGTH} dígitos` };
    }

    // Verificar que comience con código de Guatemala (2 para Guatemala fijo, 3-7 para móviles)
    const firstDigit = parseInt(clean[0]);
    if (firstDigit < 2 || firstDigit > 7) {
      return { valid: false, error: 'El teléfono debe comenzar con 2-7 (código Guatemala)' };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida un valor de tolerancia en minutos.
   * @param {number|string} tolerancia - Valor de tolerancia
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateTolerancia(tolerancia) {
    const value = parseInt(tolerancia);

    if (isNaN(value)) {
      return { valid: false, error: 'La tolerancia debe ser un número' };
    }

    if (value < VALIDATION_RULES.TOLERANCIA_MIN) {
      return { valid: false, error: `La tolerancia debe ser al menos ${VALIDATION_RULES.TOLERANCIA_MIN} minutos` };
    }

    if (value > VALIDATION_RULES.TOLERANCIA_MAX) {
      return { valid: false, error: `La tolerancia no puede exceder ${VALIDATION_RULES.TOLERANCIA_MAX} minutos` };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida coordenadas GPS (latitud).
   * @param {number|string} lat - Latitud a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateLatitud(lat) {
    const value = parseFloat(lat);

    if (isNaN(value)) {
      return { valid: false, error: 'La latitud debe ser un número' };
    }

    if (value < VALIDATION_RULES.LATITUDE_MIN || value > VALIDATION_RULES.LATITUDE_MAX) {
      return { valid: false, error: `La latitud debe estar entre ${VALIDATION_RULES.LATITUDE_MIN} y ${VALIDATION_RULES.LATITUDE_MAX} grados` };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida coordenadas GPS (longitud).
   * @param {number|string} lon - Longitud a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateLongitud(lon) {
    const value = parseFloat(lon);

    if (isNaN(value)) {
      return { valid: false, error: 'La longitud debe ser un número' };
    }

    if (value < VALIDATION_RULES.LONGITUDE_MIN || value > VALIDATION_RULES.LONGITUDE_MAX) {
      return { valid: false, error: `La longitud debe estar entre ${VALIDATION_RULES.LONGITUDE_MIN} y ${VALIDATION_RULES.LONGITUDE_MAX} grados` };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida un radio de geocerca en metros.
   * @param {number|string} radio - Radio a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateGPSRadius(radio) {
    const value = parseInt(radio);

    if (isNaN(value)) {
      return { valid: false, error: 'El radio debe ser un número' };
    }

    if (value < VALIDATION_RULES.GPS_RADIUS_MIN) {
      return { valid: false, error: `El radio debe ser al menos ${VALIDATION_RULES.GPS_RADIUS_MIN} metros` };
    }

    if (value > VALIDATION_RULES.GPS_RADIUS_MAX) {
      return { valid: false, error: `El radio no puede exceder ${VALIDATION_RULES.GPS_RADIUS_MAX} metros` };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida un formato de hora (HH:MM).
   * @param {string} hora - Hora a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateHora(hora) {
    if (!hora || typeof hora !== 'string') {
      return { valid: false, error: 'La hora es requerida' };
    }

    const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!regex.test(hora)) {
      return { valid: false, error: 'La hora debe tener formato HH:MM (24 horas)' };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida el orden lógico de horarios.
   * @param {object} horarios - Objeto con horarios { entrada, salidaReceso, regresoReceso, salidaObra }
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateOrdenHorarios(horarios) {
    const { entrada, salidaReceso, regresoReceso, salidaObra } = horarios;

    const min1 = _horaToMinutos(entrada);
    const min2 = _horaToMinutos(salidaReceso);
    const min3 = _horaToMinutos(regresoReceso);
    const min4 = _horaToMinutos(salidaObra);

    if (min2 <= min1) {
      return { valid: false, error: 'La salida a receso debe ser después de la entrada' };
    }

    if (min3 <= min2) {
      return { valid: false, error: 'El regreso de receso debe ser después de la salida a receso' };
    }

    if (min4 <= min3) {
      return { valid: false, error: 'La salida de obra debe ser después del regreso de receso' };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida una imagen (tamaño y tipo).
   * @param {File} file - Archivo de imagen
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateImagen(file) {
    if (!file) {
      return { valid: false, error: 'No se proporcionó ninguna imagen' };
    }

    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'El archivo debe ser una imagen (JPG, PNG, etc.)' };
    }

    if (file.size > VALIDATION_RULES.IMAGEN_MAX_SIZE) {
      return { valid: false, error: `La imagen excede el tamaño máximo de ${Math.round(VALIDATION_RULES.IMAGEN_MAX_SIZE / 1024)}KB` };
    }

    return { valid: true, error: null };
  }

  /**
   * Valida una URL de Google Apps Script.
   * @param {string} url - URL a validar
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateGASUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'La URL es requerida' };
    }

    const trimmed = url.trim();

    if (!trimmed.startsWith('https://script.google.com/macros/s/')) {
      return { valid: false, error: 'La URL debe comenzar con https://script.google.com/macros/s/' };
    }

    if (!trimmed.includes('/exec')) {
      return { valid: false, error: 'La URL debe terminar con /exec' };
    }

    return { valid: true, error: null };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function _horaToMinutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  // ─── API Pública ───────────────────────────────────────────────────────────
  return {
    // Reglas de validación
    RULES: VALIDATION_RULES,

    // Validaciones individuales
    validateDPI,
    validateNombre,
    validateTelefono,
    validateTolerancia,
    validateLatitud,
    validateLongitud,
    validateGPSRadius,
    validateHora,
    validateOrdenHorarios,
    validateImagen,
    validateGASUrl,

    // Validaciones compuestas
    validateTrabajador(trabajador) {
      const errors = [];

      const nombreResult = this.validateNombre(trabajador.nombre);
      if (!nombreResult.valid) errors.push({ campo: 'nombre', error: nombreResult.error });

      const dpiResult = this.validateDPI(trabajador.dpi);
      if (!dpiResult.valid) errors.push({ campo: 'dpi', error: dpiResult.error });

      if (trabajador.telefono) {
        const telResult = this.validateTelefono(trabajador.telefono);
        if (!telResult.valid) errors.push({ campo: 'telefono', error: telResult.error });
      }

      return {
        valid: errors.length === 0,
        errors
      };
    },

    validateConfigGPS(config) {
      const errors = [];

      if (config.GPS_Centro_Lat) {
        const latResult = this.validateLatitud(config.GPS_Centro_Lat);
        if (!latResult.valid) errors.push({ campo: 'GPS_Centro_Lat', error: latResult.error });
      }

      if (config.GPS_Centro_Lon) {
        const lonResult = this.validateLongitud(config.GPS_Centro_Lon);
        if (!lonResult.valid) errors.push({ campo: 'GPS_Centro_Lon', error: lonResult.error });
      }

      if (config.GPS_Radio_Metros) {
        const radioResult = this.validateGPSRadius(config.GPS_Radio_Metros);
        if (!radioResult.valid) errors.push({ campo: 'GPS_Radio_Metros', error: radioResult.error });
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }
  };
})();