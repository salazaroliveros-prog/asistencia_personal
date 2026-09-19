/**
 * CONTROL PERSONAL CAMPO — utils/validators.js
 * Módulo de validaciones compartido para consistencia en toda la aplicación.
 * Centraliza todas las validaciones de datos para evitar duplicación.
 * @version 1.5.0
 */

const Validators = (() => {

  // ─── Constantes de Validación ───────────────────────────────────────────────
  const VALIDATION_RULES = window.CPC?.ValidationRules || {
    DPI_LENGTH: 13,
    DPI_MIN_LENGTH: 13,
    DPI_MAX_LENGTH: 13,
    TOLERANCIA_MIN: 0,
    TOLERANCIA_MAX: 60,
    LATITUDE_MIN: -90,
    LATITUDE_MAX: 90,
    LONGITUDE_MIN: -180,
    LONGITUDE_MAX: 180,
    GPS_RADIUS_MIN: 10,
    GPS_RADIUS_MAX: 10000,
    NOMBRE_MIN_LENGTH: 3,
    NOMBRE_MAX_LENGTH: 100,
    TELEFONO_LENGTH: 8,
    IMAGEN_MAX_SIZE: 600 * 1024,
    IMAGEN_MAX_DIMENSION: 300,
  };

  // ─── Validaciones de Datos de Trabajador ───────────────────────────────────────

  /**
   * Valida datos completos de un trabajador
   * @param {Object} trabajador - Datos del trabajador a validar
   * @returns {Object} { valid: boolean, errors: Array<{campo: string, error: string}> }
   * @example
   * const result = Validators.validateTrabajadorCompleto({
   *   nombre: 'Juan Pérez',
   *   dpi: '1234567890101',
   *   puesto: 'Albañil'
   * });
   */
  function validateTrabajadorCompleto(trabajador) {
    const errors = [];

    // Validar nombre
    if (!trabajador.nombre) {
      errors.push({ campo: 'nombre', error: 'El nombre es requerido' });
    } else {
      const nombreResult = validateNombre(trabajador.nombre);
      if (!nombreResult.valid) {
        errors.push({ campo: 'nombre', error: nombreResult.error });
      }
    }

    // Validar DPI
    if (!trabajador.dpi) {
      errors.push({ campo: 'dpi', error: 'El DPI es requerido' });
    } else {
      const dpiResult = validateDPI(trabajador.dpi);
      if (!dpiResult.valid) {
        errors.push({ campo: 'dpi', error: dpiResult.error });
      }
    }

    // Validar puesto
    if (!trabajador.puesto) {
      errors.push({ campo: 'puesto', error: 'El puesto es requerido' });
    }

    // Validar teléfono (opcional)
    if (trabajador.telefono) {
      const telResult = validateTelefono(trabajador.telefono);
      if (!telResult.valid) {
        errors.push({ campo: 'telefono', error: telResult.error });
      }
    }

    // Validar dirección (opcional)
    if (trabajador.direccion && typeof trabajador.direccion === 'string') {
      if (trabajador.direccion.trim().length < 5) {
        errors.push({ campo: 'direccion', error: 'La dirección debe tener al menos 5 caracteres' });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida datos de marcación de asistencia
   * @param {Object} marcacion - Datos de la marcación a validar
   * @returns {Object} { valid: boolean, errors: Array<{campo: string, error: string}> }
   * @example
   * const result = Validators.validateMarcacion({
   *   idTrabajador: 'TRAB-123',
   *   tipo: 'Entrada',
   *   fecha: '2026-09-15'
   * });
   */
  function validateMarcacion(marcacion) {
    const errors = [];

    // Validar ID de trabajador
    if (!marcacion.idTrabajador && !marcacion.ID_Trabajador) {
      errors.push({ campo: 'idTrabajador', error: 'El ID del trabajador es requerido' });
    }

    // Validar tipo de marcación.
    // 'Entrada_Extra' es aceptada por firestore.rules (isValidAttendanceData) y
    // por el flujo de marcaciones extraordinarias; antes se rechazaba aquí.
    const tiposValidos = ['Entrada', 'Salida_Receso', 'Regreso_Receso', 'Salida_Obra', 'Entrada_Extra'];
    const tipo = marcacion.tipo || marcacion.Tipo_Marcacion;
    if (!tipo || !tiposValidos.includes(tipo)) {
      errors.push({ campo: 'tipo', error: `Tipo de marcación inválido. Debe ser: ${tiposValidos.join(', ')}` });
    }

    // Validar fecha
    const fecha = marcacion.fecha || marcacion.Fecha;
    if (!fecha) {
      errors.push({ campo: 'fecha', error: 'La fecha es requerida' });
    } else {
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!fechaRegex.test(fecha)) {
        errors.push({ campo: 'fecha', error: 'La fecha debe tener formato YYYY-MM-DD' });
      }
    }

    // Validar hora si está presente
    if (marcacion.horaReal || marcacion.Hora_Real) {
      const hora = marcacion.horaReal || marcacion.Hora_Real;
      const horaResult = validateHora(hora);
      if (!horaResult.valid) {
        errors.push({ campo: 'horaReal', error: horaResult.error });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida configuración del sistema
   * @param {Object} config - Configuración a validar
   * @returns {Object} { valid: boolean, errors: Array<{campo: string, error: string}> }
   * @example
   * const result = Validators.validateConfigSistema({
   *   Hora_Entrada: '07:00',
   *   Hora_Salida_Obra: '17:00',
   *   GPS_Radio_Metros: 200
   * });
   */
  function validateConfigSistema(config) {
    const errors = [];

    // Validar horarios si están presentes
    if (config.Hora_Entrada) {
      const result = validateHora(config.Hora_Entrada);
      if (!result.valid) errors.push({ campo: 'Hora_Entrada', error: result.error });
    }

    if (config.Hora_Salida_Obra) {
      const result = validateHora(config.Hora_Salida_Obra);
      if (!result.valid) errors.push({ campo: 'Hora_Salida_Obra', error: result.error });
    }

    // Validar GPS si está presente
    if (config.GPS_Centro_Lat || config.GPS_Centro_Lon || config.GPS_Radio_Metros) {
      const gpsResult = validateConfigGPS(config);
      if (!gpsResult.valid) {
        errors.push(...gpsResult.errors);
      }
    }

    // Validar tolerancia si está presente
    if (config.Tolerancia_Minutos !== undefined) {
      const result = validateTolerancia(config.Tolerancia_Minutos);
      if (!result.valid) errors.push({ campo: 'Tolerancia_Minutos', error: result.error });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

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

    // Validar que tenga exactamente 13 dígitos (formato guatemalteco)
    if (cleanDPI.length !== VALIDATION_RULES.DPI_LENGTH) {
      return { valid: false, error: `El DPI debe tener exactamente ${VALIDATION_RULES.DPI_LENGTH} dígitos (actual: ${cleanDPI.length})` };
    }

    // Verificar que todos sean dígitos numéricos
    if (!/^\d+$/.test(cleanDPI)) {
      return { valid: false, error: 'El DPI debe contener solo números' };
    }

    // El DPI de 13 dígitos es válido, sin validación de checksum
    // El algoritmo oficial de RENAP es complejo y puede tener variaciones
    return { valid: true, error: null };
  }

  /**
   * Calcula el checksum de un DPI guatemalteco (algoritmo simplificado).
   * @param {string} dpi - DPI limpio (solo dígitos)
   * @returns {object} { valid: boolean }
   */
  function _calculateDPIChecksum(dpi) {
    // Algoritmo simplificado de validación de DPI guatemalteco
    // Para producción, implementar el algoritmo oficial del RENAP
    const digits = dpi.split('').map(Number);
    
    // Verificar que todos sean dígitos
    if (digits.some((d) => isNaN(d))) {
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

    // Aceptar 8 dígitos (local) o 11 dígitos (con código de país 502)
    if (clean.length !== 8 && clean.length !== 11) {
      return { valid: false, error: 'El teléfono debe tener 8 dígitos (sin país) o 11 dígitos (con +502)' };
    }

    if (clean.length === 11) {
      if (!clean.startsWith('502')) {
        return { valid: false, error: 'El teléfono con código de país debe comenzar con 502' };
      }
    } else {
      const firstDigit = parseInt(clean[0], 10);
      if (firstDigit < 2 || firstDigit > 7) {
        return { valid: false, error: 'El teléfono debe comenzar con 2-7 (código Guatemala)' };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Valida un valor de tolerancia en minutos.
   * @param {number|string} tolerancia - Valor de tolerancia
   * @returns {object} { valid: boolean, error: string | null }
   */
  function validateTolerancia(tolerancia) {
    const value = parseInt(tolerancia, 10);

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
    const value = parseInt(radio, 10);

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
    const { entrada, salidaReceso, regresoReceso, salidaObra } = horarios || {};

    const min1 = _horaToMinutos(entrada);
    const min2 = _horaToMinutos(salidaReceso);
    const min3 = _horaToMinutos(regresoReceso);
    const min4 = _horaToMinutos(salidaObra);

    // Antes, con horarios vacíos o mal formados los cuatro valores eran NaN y
    // la función devolvía valid:true (todas las comparaciones NaN son falsas).
    if ([min1, min2, min3, min4].some((m) => m === null)) {
      return { valid: false, error: 'Los cuatro horarios son obligatorios y deben tener formato HH:MM' };
    }

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

  /** Minutos de gracia tras la hora de salida antes de contar horas extra. */
  const HORAS_EXTRA_GRACIA_MIN = 15;
  /** Bloque de redondeo de horas extra (30 min → 0,5 h). */
  const HORAS_EXTRA_BLOQUE_MIN = 30;

  /**
   * Convierte 'HH:MM' a minutos desde medianoche.
   * @param {string} hora - Hora en formato HH:MM
   * @returns {number|null} Minutos transcurridos, o null si el formato es inválido
   */
  function _horaToMinutos(hora) {
    if (typeof hora !== 'string' || !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(hora.trim())) return null;
    const [h, m] = hora.trim().split(':').map(Number);
    return h * 60 + m;
  }

  function calcularEstado(horaOficial, horaReal, tolerancia) {
    const minOficial = _horaToMinutos(horaOficial);
    const minReal    = _horaToMinutos(horaReal);

    // Sin horas comparables se asume puntual (comportamiento histórico).
    if (minOficial === null || minReal === null) return 'A Tiempo';

    const toleranciaMin = Number.isFinite(Number(tolerancia)) ? Number(tolerancia) : 0;
    const diferencia    = minReal - minOficial;

    if (diferencia <= 0)             return 'A Tiempo';
    if (diferencia <= toleranciaMin) return 'Tolerancia';
    return 'Atraso';
  }

  /**
   * Calcula las horas extra de una salida.
   *
   * Regla: se ignoran los primeros HORAS_EXTRA_GRACIA_MIN minutos posteriores a
   * la salida programada y el exceso se redondea al bloque de 30 min más cercano
   * (0,5 h). Con datos inválidos devuelve 0 en vez de NaN.
   * @param {string} horaReal - Hora real de la marcación (HH:MM)
   * @param {string} horaSalida - Hora programada de salida (HH:MM)
   * @returns {number} Horas extra calculadas
   */
  function calcularHorasExtra(horaReal, horaSalida) {
    const minReal   = _horaToMinutos(horaReal);
    const minSalida = _horaToMinutos(horaSalida);

    if (minReal === null || minSalida === null) return 0;

    const exceso = minReal - (minSalida + HORAS_EXTRA_GRACIA_MIN);
    if (exceso <= 0) return 0;
    return Math.round(exceso / HORAS_EXTRA_BLOQUE_MIN) * (HORAS_EXTRA_BLOQUE_MIN / 60);
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

    // Validaciones compuestas (centralizadas)
    validateTrabajadorCompleto,
    validateMarcacion,
    validateConfigSistema,

    // Validaciones compuestas (legacy - mantenidas por compatibilidad)
    validateTrabajador(trabajador) {
      return this.validateTrabajadorCompleto(trabajador);
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
        errors,
      };
    },

    // Helpers de negocio
    calcularEstado,
    calcularHorasExtra,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validators;
}
