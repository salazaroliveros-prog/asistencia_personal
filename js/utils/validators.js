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
    // Validaciones de campos
    validateDPI,
    validateNombre,
    validateTelefono,
    validateLatitud,
    validateLongitud,
    validateGPSRadius,

    // Validaciones compuestas (centralizadas)
    validateTrabajadorCompleto,

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

if (typeof window !== 'undefined') {
  window.Validators = Validators;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validators;
}
