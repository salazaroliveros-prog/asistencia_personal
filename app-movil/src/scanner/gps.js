export async function getCurrentPosition() {
  if (!('geolocation' in navigator)) throw new Error('Geolocalización no soportada');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({
          lat: latitude,
          lng: longitude,
          precision: accuracy,
          radio_valido: true,
        });
      },
      (error) => reject(new Error(`GPS error: ${error.message}`)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });
}

export function distanceMeters(a, b) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}
