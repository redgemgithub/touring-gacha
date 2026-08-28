import type { Candidate, Env, ShopCategory } from "../types";
import { bucketCoordinate } from "./geo";

const CACHE_TTL_SECONDS = 60 * 60 * 24;

export function buildCacheKey(
  lat: number,
  lon: number,
  radiusKm: number,
  category: ShopCategory,
): string {
  const bucket = bucketCoordinate(lat, lon, radiusKm);
  return `ov:v1:${category}:${radiusKm}:${bucket.lat.toFixed(4)}:${bucket.lon.toFixed(4)}`;
}

export async function getCachedCandidates(
  cache: Env["CACHE"],
  key: string,
): Promise<Candidate[] | null> {
  const raw = await cache.get(key, "json");
  return (raw as Candidate[] | null) ?? null;
}

export async function putCachedCandidates(
  cache: Env["CACHE"],
  key: string,
  candidates: Candidate[],
): Promise<void> {
  await cache.put(key, JSON.stringify(candidates), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}
