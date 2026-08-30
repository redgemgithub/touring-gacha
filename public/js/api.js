function makeApiError(res, body) {
  const err = new Error(body.error || "request_failed");
  err.status = res.status;
  err.retryAfter = res.headers.get("Retry-After");
  return err;
}

// 同じ系統のエラーには同じ文言を使う（利用者は開発者ではないので、
// 「今使えない」ことが分かれば十分という前提で簡潔にする）。
// 目的地検索・周辺情報検索など、Overpass/APIエラーを扱うすべての箇所で共通利用する。
export function describeApiError(err) {
  if (err?.status === 503) {
    return "混み合っています。しばらくしてからお試しください。";
  }
  return "取得できませんでした。もう一度お試しください。";
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
  intersectionStage,
  anchor,
  anchorAttempt,
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
      intersectionStage,
      anchor,
      anchorAttempt,
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

export async function processNearby({
  cacheKey,
  lat,
  lon,
  excludeId,
  overpassResponse,
  parkingWideSearch,
  nearbyStage,
}) {
  const res = await fetch("/api/nearby/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cacheKey,
      lat,
      lon,
      excludeId,
      overpassResponse,
      parkingWideSearch,
      nearbyStage,
    }),
  });
  if (!res.ok) throw makeApiError(res, await res.json().catch(() => ({})));
  return res.json();
}
