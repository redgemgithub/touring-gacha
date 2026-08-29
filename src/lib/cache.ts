import type { Candidate, Env, PoiItem, ShopCategory } from "../types";
import { bucketCoordinate } from "./geo";
import { NEARBY_POI_RADIUS_M } from "./nearby";

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

export function buildNearbyCacheKey(lat: number, lon: number): string {
  const bucket = bucketCoordinate(lat, lon, NEARBY_POI_RADIUS_M / 1000);
  return `poi:v1:${bucket.lat.toFixed(4)}:${bucket.lon.toFixed(4)}`;
}

export async function getCachedPois(cache: Env["CACHE"], key: string): Promise<PoiItem[] | null> {
  const raw = await cache.get(key, "json");
  return (raw as PoiItem[] | null) ?? null;
}

export async function putCachedPois(
  cache: Env["CACHE"],
  key: string,
  pois: PoiItem[],
): Promise<void> {
  await cache.put(key, JSON.stringify(pois), { expirationTtl: CACHE_TTL_SECONDS });
}
