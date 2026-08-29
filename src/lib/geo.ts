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

/**
 * 起点から指定の方角・距離だけ進んだ到達点を求める（順方向の球面測地線計算）。
 * Phase 4-B（次数ベースの交差点検出）の仮地点（乱数の方角×指定距離ちょうど）を
 * 決めるために使う（docs/plans/260830-060923-phase4b交差点検出実装.md）。
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): { lat: number; lon: number } {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const fromLatRad = (lat * Math.PI) / 180;
  const fromLonRad = (lon * Math.PI) / 180;
  const toLatRad = Math.asin(
    Math.sin(fromLatRad) * Math.cos(angularDistance) +
      Math.cos(fromLatRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const toLonRad =
    fromLonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(fromLatRad),
      Math.cos(angularDistance) - Math.sin(fromLatRad) * Math.sin(toLatRad),
    );
  return { lat: (toLatRad * 180) / Math.PI, lon: (toLonRad * 180) / Math.PI };
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
// UIの探索範囲チップの値。中抜けのない帯を作るため隣接する選択肢の値を使う
// （docs/decisions/260829-search-radius-band-gapless.md）。
const RADIUS_STEPS = [10, 30, 50, 100];

/**
 * 探索範囲は「指定距離以内」ではなく「指定距離に近い帯」として扱う
 * （docs/decisions/260829-search-radius-band.md）。隣り合う選択肢どうしの境界は
 * 2つの数値の中間値にし、選択肢の間に検索できない「中抜け」ができないようにする。
 * 両端（最小・最大の選択肢）だけ、指定距離の10%と固定下限5kmの大きい方をマージンとして使う。
 */
export function computeDistanceBand(radiusKm: number): {
  innerKm: number;
  outerKm: number;
  marginKm: number;
} {
  const idx = RADIUS_STEPS.indexOf(radiusKm);
  const marginKm = Math.max(radiusKm * RADIUS_BAND_TOLERANCE, RADIUS_BAND_MIN_MARGIN_KM);
  const innerKm = idx <= 0 ? radiusKm - marginKm : (RADIUS_STEPS[idx - 1] + radiusKm) / 2;
  const outerKm =
    idx === -1 || idx === RADIUS_STEPS.length - 1
      ? radiusKm + marginKm
      : (radiusKm + RADIUS_STEPS[idx + 1]) / 2;
  return { innerKm, outerKm, marginKm };
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
