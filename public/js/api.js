export async function getConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("config_fetch_failed");
  return res.json();
}

export async function searchDestinations({ lat, lon, radiusKm, category, excludeIds }) {
  const res = await fetch("/api/destinations/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, radiusKm, category, excludeIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || "search_failed");
    err.status = res.status;
    err.retryAfter = res.headers.get("Retry-After");
    throw err;
  }
  return res.json();
}
