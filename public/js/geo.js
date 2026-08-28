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
