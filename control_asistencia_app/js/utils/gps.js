/**
 * CONTROL PERSONAL CAMPO — utils/gps.js
 * GPS location utilities for attendance verification.
 * Handles geolocation capture, geofence validation, and distance calculations.
 * @version 1.0.0
 */

const GPS = (() => {
  
  // ─── Constants ──────────────────────────────────────────────────────────
  const DEFAULT_GEOFENCE_RADIUS = 200; // meters
  const GPS_TIMEOUT = 10000; // 10 seconds
  const GPS_OPTIONS = {
    enableHighAccuracy: true,
    timeout: GPS_TIMEOUT,
    maximumAge: 30000, // Accept 30-second-old cached positions
  };

  // ─── Public API ─────────────────────────────────────────────────────────
  return {

    /**
     * Get current GPS position
     * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
     */
    getCurrentPosition() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocalización no soportada por este navegador'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy, // in meters
              timestamp: position.timestamp,
            });
          },
          (error) => {
            let message = 'Error de geolocalización';
            switch (error.code) {
              case error.PERMISSION_DENIED:
                message = 'Permiso de ubicación denegado';
                break;
              case error.POSITION_UNAVAILABLE:
                message = 'Ubicación no disponible';
                break;
              case error.TIMEOUT:
                message = 'Tiempo de espera de ubicación agotado';
                break;
            }
            reject(new Error(message));
          },
          GPS_OPTIONS
        );
      });
    },

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      return R * c;
    },

    /**
     * Check if a position is within a geofence
     * @param {object} position - Current position {latitude, longitude}
     * @param {object} center - Geofence center {latitude, longitude}
     * @param {number} radius - Geofence radius in meters
     * @returns {object} {inside: boolean, distance: number}
     */
    checkGeofence(position, center, radius = DEFAULT_GEOFENCE_RADIUS) {
      if (!position || !center) {
        return { inside: false, distance: null };
      }

      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        center.latitude,
        center.longitude
      );

      return {
        inside: distance <= radius,
        distance: Math.round(distance),
      };
    },

    /**
     * Format coordinates for display
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {string} Formatted coordinates
     */
    formatCoordinates(lat, lon) {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    },

    /**
     * Generate Google Maps link from coordinates
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {string} Google Maps URL
     */
    getMapsLink(lat, lon) {
      return `https://www.google.com/maps?q=${lat},${lon}`;
    },

    /**
     * Check if geolocation is available
     * @returns {boolean}
     */
    isAvailable() {
      return 'geolocation' in navigator;
    },

    /**
     * Request high accuracy location permission (for mobile)
     * @returns {Promise<PermissionState>}
     */
    async requestPermission() {
      if (!navigator.permissions) {
        return 'prompt';
      }

      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
      } catch (e) {
        return 'prompt';
      }
    },
  };
})();