const EARTH_RADIUS_KM = 6371;

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation_unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
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

const RADIUS_BAND_TOLERANCE = 0.1;
const RADIUS_BAND_MIN_MARGIN_KM = 5;
// UIの探索範囲チップの値。中抜けのない帯を作るため隣接する選択肢の値を使う
// （docs/decisions/260829-search-radius-band-gapless.md）。
const RADIUS_STEPS = [10, 30, 50, 100];

// 探索範囲は「指定距離以内」ではなく「指定距離に近い帯」として扱う
// （docs/decisions/260829-search-radius-band.md）。サーバー側 geo.ts の
// computeDistanceBand と同じロジック（バンドラーなし構成のため別実装）。
// 隣り合う選択肢どうしの境界は2つの数値の中間値にし、中抜けができないようにする。
// 両端だけ、指定距離の10%と固定下限5kmの大きい方をマージンとして使う。
export function computeDistanceBand(radiusKm) {
  const idx = RADIUS_STEPS.indexOf(radiusKm);
  const marginKm = Math.max(radiusKm * RADIUS_BAND_TOLERANCE, RADIUS_BAND_MIN_MARGIN_KM);
  const innerKm = idx <= 0 ? radiusKm - marginKm : (RADIUS_STEPS[idx - 1] + radiusKm) / 2;
  const outerKm =
    idx === -1 || idx === RADIUS_STEPS.length - 1
      ? radiusKm + marginKm
      : (radiusKm + RADIUS_STEPS[idx + 1]) / 2;
  return { innerKm, outerKm, marginKm };
}

const BEARING_LABELS = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];

export function bearingLabel(fromLat, fromLon, toLat, toLon) {
  const rFromLat = (fromLat * Math.PI) / 180;
  const rToLat = (toLat * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(rToLat);
  const x =
    Math.cos(rFromLat) * Math.sin(rToLat) -
    Math.sin(rFromLat) * Math.cos(rToLat) * Math.cos(dLon);
  const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return BEARING_LABELS[Math.round(bearingDeg / 45) % 8];
}
