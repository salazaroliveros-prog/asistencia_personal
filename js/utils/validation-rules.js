/**
 * Control Personal Campo — Reglas de validación centralizadas.
 * Fuente única para constantes usadas por validadores y formularios.
 */

window.CPC = window.CPC || {};

window.CPC.ValidationRules = {
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
