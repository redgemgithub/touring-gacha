function makeApiError(res, body) {
  const err = new Error(body.error || "request_failed");
  err.status = res.status;
  err.retryAfter = res.headers.get("Retry-After");
  return err;
}

export async function getConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("config_fetch_failed");
  return res.json();
}

export async function prepareSearch({ lat, lon, radiusKm, category, parkingRequired, excludeIds }) {
  const res = await fetch("/api/destinations/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, radiusKm, category, parkingRequired, excludeIds }),
  });
  if (!res.ok) throw makeApiError(res, await res.json().catch(() => ({})));
  return res.json();
}

// ブラウザから直接Overpass APIへ問い合わせる。
// docs/decisions/260829-overpass-client-side-fetch.md 参照:
// Cloudflare Workersの共有送信元IPがOverpass側で制限されていたため、
// ここだけはサーバーを経由せずブラウザから直接fetchする。
export async function fetchOverpassDirect(endpoint, query) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (res.status === 429 || res.status >= 500) {
    const err = new Error("overpass_unavailable");
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err = new Error("overpass_error");
    err.status = 502;
    throw err;
  }
  return res.json();
}

export async function processSearch({
  cacheKey,
  category,
  parkingRequired,
  excludeIds,
  overpassResponse,
  lat,
  lon,
  radiusKm,
}) {
  const res = await fetch("/api/destinations/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cacheKey,
      category,
      parkingRequired,
      excludeIds,
      overpassResponse,
      lat,
      lon,
      radiusKm,
    }),
  });
  if (!res.ok) throw makeApiError(res, await res.json().catch(() => ({})));
  return res.json();
}

export async function prepareNearby({ lat, lon, excludeId, parkingWideSearch }) {
  const res = await fetch("/api/nearby/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, excludeId, parkingWideSearch }),
  });
  if (!res.ok) throw makeApiError(res, await res.json().catch(() => ({})));
  return res.json();
}

export async function processNearby({ cacheKey, lat, lon, excludeId, overpassResponse }) {
  const res = await fetch("/api/nearby/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cacheKey, lat, lon, excludeId, overpassResponse }),
  });
  if (!res.ok) throw makeApiError(res, await res.json().catch(() => ({})));
  return res.json();
}
