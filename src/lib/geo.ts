// Геологика без PostGIS: haversine + point-in-polygon (ray casting). См. README «Известные упрощения».
export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** polygon: [[lat,lng], ...] */
export function pointInPolygon(p: LatLng, polygon: number[][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect = yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Минимальное расстояние от точки до вершин полигона (упрощение: до вершин, не до рёбер). */
export function distanceToPolygonKm(p: LatLng, polygon: number[][]): number {
  if (pointInPolygon(p, polygon)) return 0;
  let min = Infinity;
  for (const [lat, lng] of polygon) min = Math.min(min, haversineKm(p, { lat, lng }));
  return min;
}

export type ServiceArea = {
  polygon?: number[][] | null;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusKm?: number | null;
};

/**
 * Проверка покрытия: точка объекта внутри полигона ИЛИ в радиусе от опорной точки.
 * radiusMultiplier — для fallback-расширения радиуса (5А.6).
 * Возвращает {covered, distanceKm}.
 */
export function coversPoint(area: ServiceArea, p: LatLng, radiusMultiplier = 1): { covered: boolean; distanceKm: number } {
  let distanceKm = Infinity;
  let covered = false;
  if (area.centerLat != null && area.centerLng != null) {
    distanceKm = haversineKm(p, { lat: area.centerLat, lng: area.centerLng });
    const r = (area.radiusKm ?? 0) * radiusMultiplier;
    if (r > 0 && distanceKm <= r) covered = true;
  }
  if (Array.isArray(area.polygon) && area.polygon.length >= 3) {
    const d = distanceToPolygonKm(p, area.polygon);
    distanceKm = Math.min(distanceKm, d);
    if (d === 0) covered = true;
    // при расширении радиуса полигон тоже «раздувается» на (multiplier-1)*10 км
    else if (radiusMultiplier > 1 && d <= (radiusMultiplier - 1) * 10) covered = true;
  }
  return { covered, distanceKm: Number.isFinite(distanceKm) ? distanceKm : 9999 };
}
