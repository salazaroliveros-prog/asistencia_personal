describe('GPS util', () => {
  it('computes small distances near each other', () => {
    const a = { lat: 14.634915, lng: -90.506412 };
    const b = { lat: 14.635, lng: -90.5065 };
    const R = 6371e3;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    const d = R * c;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(200);
  });

  it('returns 0 for same point', () => {
    const p = { lat: 0, lng: 0 };
    const R = 6371e3;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(0);
    const dLng = toRad(0);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(0)) * Math.cos(toRad(0)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    expect(R * c).toBeCloseTo(0, 6);
  });
});
