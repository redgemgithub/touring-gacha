const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

const BEARING_LABELS = [
  "北",
  "北東",
  "東",
  "南東",
  "南",
  "南西",
  "西",
  "北西",
] as const;

export function bearingLabel(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): string {
  const rFromLat = (fromLat * Math.PI) / 180;
  const rToLat = (toLat * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(rToLat);
  const x =
    Math.cos(rFromLat) * Math.sin(rToLat) -
    Math.sin(rFromLat) * Math.cos(rToLat) * Math.cos(dLon);
  const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const index = Math.round(bearingDeg / 45) % 8;
  return BEARING_LABELS[index];
}

interface LatLon {
  lat: number;
  lon: number;
}

function toLocalMeters(point: LatLon, refLat: number): { x: number; y: number } {
  const R = EARTH_RADIUS_KM * 1000;
  const x = ((point.lon * Math.PI) / 180) * Math.cos((refLat * Math.PI) / 180) * R;
  const y = ((point.lat * Math.PI) / 180) * R;
  return { x, y };
}

export function distanceToSegmentMeters(point: LatLon, a: LatLon, b: LatLon): number {
  const p = toLocalMeters(point, point.lat);
  const pa = toLocalMeters(a, point.lat);
  const pb = toLocalMeters(b, point.lat);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(p.x - pa.x, p.y - pa.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSq),
  );
  const projX = pa.x + t * dx;
  const projY = pa.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function distanceToPolylineMeters(point: LatLon, polyline: LatLon[]): number {
  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentMeters(point, polyline[i], polyline[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

export const RADIUS_BAND_TOLERANCE = 0.1;
export const RADIUS_BAND_MIN_MARGIN_KM = 5;

/**
 * 探索範囲は「指定距離以内」ではなく「指定距離に近い帯」として扱う
 * （docs/decisions/260829-search-radius-band.md）。マージンは指定距離の10%と
 * 固定下限5kmの大きい方とし、小さい指定距離での帯の狭すぎを防ぐ。
 */
export function computeDistanceBand(radiusKm: number): {
  innerKm: number;
  outerKm: number;
  marginKm: number;
} {
  const marginKm = Math.max(radiusKm * RADIUS_BAND_TOLERANCE, RADIUS_BAND_MIN_MARGIN_KM);
  return { innerKm: radiusKm - marginKm, outerKm: radiusKm + marginKm, marginKm };
}

export function bucketCoordinate(
  lat: number,
  lon: number,
  radiusKm: number,
): { lat: number; lon: number } {
  const bucketKm = radiusKm / 4;
  const latStepDeg = bucketKm / 111;
  const lonStepDeg = bucketKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    lat: Math.round(lat / latStepDeg) * latStepDeg,
    lon: Math.round(lon / lonStepDeg) * lonStepDeg,
  };
}
