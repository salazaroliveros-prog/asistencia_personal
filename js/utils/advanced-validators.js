/**
 * VALIDADORES MEJORADOS - DPI, Horarios, GPS
 * CONTROL PERSONAL CAMPO v1.5.1
 * 
 * Validaciones robustas con checksums y lógica de negocio
 */

(() => {
  'use strict';

  const AdvancedValidators = {
    /**
     * Valida DPI Guatemalteco con checksum
     * Formato: DDDD DDDDD DDDD (13 dígitos)
     * El último dígito es un checksum calculado
     */
    validateDPI(dpi) {
      if (!dpi) return { valid: false, error: 'DPI requerido' };

      // Limpiar formato
      const cleaned = String(dpi).replace(/\s+/g, '').replace(/\D/g, '');

      // Validar longitud
      if (cleaned.length !== 13) {
        return { valid: false, error: 'DPI debe tener 13 dígitos' };
      }

      // Validar que sean solo dígitos
      if (!/^\d{13}$/.test(cleaned)) {
        return { valid: false, error: 'DPI debe contener solo dígitos' };
      }

      // Calcular checksum Luhn
      const checksum = this._luhnChecksum(cleaned.slice(0, 12));
      const lastDigit = parseInt(cleaned[12]);

      if (checksum !== lastDigit) {
        return { valid: false, error: 'DPI inválido (checksum incorrecto)' };
      }

      // Validar que no sea todos ceros
      if (cleaned === '0000000000000') {
        return { valid: false, error: 'DPI no válido' };
      }

      return { valid: true, value: cleaned };
    },

    /**
     * Calcula checksum Luhn para DPI guatemalteco
     * @private
     */
    _luhnChecksum(dpiPrefix) {
      const weights = [9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3];
      let sum = 0;

      for (let i = 0; i < 12; i++) {
        sum += parseInt(dpiPrefix[i]) * weights[i];
      }

      const remainder = sum % 11;
      return remainder === 0 ? 0 : 11 - remainder;
    },

    /**
     * Valida horarios de marcación
     * Verifica que sean secuenciales lógicamente
     */
    validateMarkingSequence(tipoMarcacion, horaReal, horariosProgramados) {
      if (!tipoMarcacion || !horaReal) {
        return { valid: false, error: 'Tipo de marcación e hora requeridos' };
      }

      const horaNum = this._timeToMinutes(horaReal);
      if (horaNum === null) {
        return { valid: false, error: 'Hora inválida' };
      }

      const config = horariosProgramados || {
        entrada: 420, // 07:00
        salidaReceso: 600, // 10:00
        regresoReceso: 630, // 10:30
        salidaObra: 1020, // 17:00
      };

      switch (tipoMarcacion) {
        case 'Entrada':
          if (horaNum < config.entrada - 120 || horaNum > config.entrada + 120) {
            return {
              valid: false,
              error: `Entrada debe estar entre ${this._minutesToTime(config.entrada - 120)} y ${this._minutesToTime(config.entrada + 120)}`,
            };
          }
          break;

        case 'Salida_Receso':
          if (horaNum < config.salidaReceso - 30 || horaNum > config.salidaReceso + 30) {
            return {
              valid: false,
              error: `Salida receso debe estar cerca de ${this._minutesToTime(config.salidaReceso)}`,
            };
          }
          break;

        case 'Regreso_Receso':
          if (horaNum < config.regresoReceso - 30 || horaNum > config.regresoReceso + 30) {
            return {
              valid: false,
              error: `Regreso receso debe estar cerca de ${this._minutesToTime(config.regresoReceso)}`,
            };
          }
          break;

        case 'Salida_Obra':
          if (horaNum < config.salidaObra - 120 || horaNum > 23 * 60) {
            return {
              valid: false,
              error: `Salida debe estar después de ${this._minutesToTime(config.salidaObra)}`,
            };
          }
          break;
      }

      return { valid: true };
    },

    /**
     * Valida GPS accuracy (rechaza si es muy impreciso)
     */
    validateGPSAccuracy(latitude, longitude, accuracy, maxAccuracyMeters = 50) {
      if (!latitude || !longitude) {
        return { valid: false, error: 'Coordenadas GPS requeridas' };
      }

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return { valid: false, error: 'Coordenadas GPS inválidas' };
      }

      if (latitude < -90 || latitude > 90) {
        return { valid: false, error: 'Latitud fuera de rango (-90 a 90)' };
      }

      if (longitude < -180 || longitude > 180) {
        return { valid: false, error: 'Longitud fuera de rango (-180 a 180)' };
      }

      if (accuracy === null || accuracy === undefined) {
        return { valid: false, error: 'Precisión GPS no disponible' };
      }

      if (accuracy > maxAccuracyMeters) {
        return {
          valid: false,
          error: `Precisión GPS muy baja (${Math.round(accuracy)}m > ${maxAccuracyMeters}m)`,
        };
      }

      return { valid: true, accuracy: Math.round(accuracy) };
    },

    /**
     * Valida que la hora está dentro de un rango
     */
    validateTimeRange(time, minTime, maxTime) {
      const timeNum = this._timeToMinutes(time);
      const minNum = this._timeToMinutes(minTime);
      const maxNum = this._timeToMinutes(maxTime);

      if (timeNum === null || minNum === null || maxNum === null) {
        return { valid: false, error: 'Formato de hora inválido (HH:MM)' };
      }

      if (timeNum < minNum || timeNum > maxNum) {
        return {
          valid: false,
          error: `Hora debe estar entre ${minTime} y ${maxTime}`,
        };
      }

      return { valid: true };
    },

    /**
     * Calcula la diferencia entre dos horas
     */
    getTimeDifference(time1, time2) {
      const t1 = this._timeToMinutes(time1);
      const t2 = this._timeToMinutes(time2);

      if (t1 === null || t2 === null) return null;

      return Math.abs(t2 - t1); // retorna diferencia en minutos
    },

    /**
     * Convierte hora HH:MM a minutos desde medianoche
     * @private
     */
    _timeToMinutes(time) {
      if (!time || typeof time !== 'string') return null;

      const parts = time.split(':');
      if (parts.length !== 2) return null;

      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

      return hours * 60 + minutes;
    },

    /**
     * Convierte minutos desde medianoche a HH:MM
     * @private
     */
    _minutesToTime(minutes) {
      const hours = Math.floor(minutes / 60) % 24;
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    },

    /**
     * Detecta si una hora es fuera del horario normal
     */
    isOutOfSchedule(time, scheduleConfig) {
      const config = scheduleConfig || {
        entrada: '07:00',
        salidaObra: '17:00',
      };

      const timeNum = this._timeToMinutes(time);
      const entradaNum = this._timeToMinutes(config.entrada);
      const salidaNum = this._timeToMinutes(config.salidaObra);

      if (timeNum === null || entradaNum === null || salidaNum === null) {
        return false;
      }

      return timeNum < entradaNum || timeNum > salidaNum;
    },
  };

  // Exportar globalmente
  window.AdvancedValidators = AdvancedValidators;
})();
