/**
 * CONTROL PERSONAL CAMPO — utils/map-viewer.js
 * Map visualization utility using Leaflet.js for GPS locations.
 * @version 1.0.0
 */

const MapViewer = (() => {
  
  let _map = null;
  let _markers = [];

  /**
   * Initialize a map in the specified container
   * @param {string} containerId - ID of the container element
   * @param {object} center - Center coordinates {lat, lon}
   * @param {number} zoom - Initial zoom level
   */
  function initMap(containerId, center = null, zoom = 15) {
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
      console.error('[MapViewer] Leaflet library not loaded');
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error('[MapViewer] Container not found:', containerId);
      return;
    }

    // Clean up existing map
    if (_map) {
      _map.remove();
      _markers = [];
    }

    // Default center if not provided
    const defaultCenter = center || { lat: 14.634915, lon: -90.506894 }; // Guatemala City

    try {
      _map = L.map(containerId).setView([defaultCenter.lat, defaultCenter.lon], zoom);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(_map);
    } catch (error) {
      console.error('[MapViewer] Error initializing map:', error);
      _map = null;
    }
  }

  /**
   * Add a marker to the map
   * @param {object} location - Location data {lat, lon, name, type}
   * @param {string} type - Marker type ('center', 'inside', 'outside')
   */
  function addMarker(location, type = 'inside') {
    if (!_map || !location.lat || !location.lon) return;

    // Check if GPS utility is available
    if (typeof GPS === 'undefined') {
      console.warn('[MapViewer] GPS utility not available');
    }

    const colorMap = {
      'center': '#007EA7',
      'inside': '#2A9D8F',
      'outside': '#FFB703',
    };

    const color = colorMap[type] || '#2A9D8F';

    // Create custom marker icon
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    try {
      const marker = L.marker([location.lat, location.lon], { icon })
        .addTo(_map);

      // Add popup if name provided
      if (location.name) {
        const coordsText = typeof GPS !== 'undefined' 
          ? GPS.formatCoordinates(location.lat, location.lon)
          : `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
        
        const popupContent = `
          <div style="min-width: 150px;">
            <strong>${location.name}</strong><br>
            <small>${coordsText}</small>
            ${location.distance ? `<br><small>Distancia: ${location.distance}m</small>` : ''}
          </div>
        `;
        marker.bindPopup(popupContent);
      }

      _markers.push(marker);
      return marker;
    } catch (error) {
      console.error('[MapViewer] Error adding marker:', error);
      return null;
    }
  }

  /**
   * Add geofence circle to the map
   * @param {object} center - Center coordinates {lat, lon}
   * @param {number} radius - Radius in meters
   */
  function addGeofence(center, radius) {
    if (!_map || !center || !radius) return;

    L.circle([center.lat, center.lon], {
      color: '#007EA7',
      fillColor: '#007EA7',
      fillOpacity: 0.1,
      radius: radius,
      weight: 2,
    }).addTo(_map);
  }

  /**
   * Show attendance locations on map
   * @param {Array} attendances - Array of attendance records with GPS data
   * @param {object} geofenceCenter - Geofence center {lat, lon}
   * @param {number} geofenceRadius - Geofence radius in meters
   */
  function showAttendanceMap(attendances, geofenceCenter, geofenceRadius) {
    const modal = document.getElementById('modal-map');
    if (!modal) return;

    modal.hidden = false;

    // Ensure close button cleans up map
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.onclick = closeMap;
    }

    // Wait for modal to be visible before initializing map
    setTimeout(() => {
      initMap('map-container', geofenceCenter, 16);

      // Add geofence if configured
      if (geofenceCenter && geofenceRadius) {
        addMarker({ ...geofenceCenter, name: 'Centro de Obra' }, 'center');
        addGeofence(geofenceCenter, geofenceRadius);
      }

      // Add attendance markers
      const locations = attendances
        .filter(a => a.GPS_Latitud && a.GPS_Longitud)
        .map(a => ({
          lat: parseFloat(a.GPS_Latitud),
          lon: parseFloat(a.GPS_Longitud),
          name: a.Nombre_Trabajador || 'Desconocido',
          type: a.Geofence_Inside !== false ? 'inside' : 'outside',
          distance: a.Geofence_Distance,
        }));

      locations.forEach(loc => addMarker(loc, loc.type));

      // Fit bounds to show all markers
      if (locations.length > 0) {
        const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lon]));
        _map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, 100);
  }

  /**
   * Close and clean up the map
   */
  function closeMap() {
    if (_map) {
      _map.remove();
      _map = null;
    }
    _markers = [];
    
    const modal = document.getElementById('modal-map');
    if (modal) modal.hidden = true;
  }

  return {
    initMap,
    addMarker,
    addGeofence,
    showAttendanceMap,
    closeMap,
  };
})();