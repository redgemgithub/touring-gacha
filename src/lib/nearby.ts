import { haversineDistanceKm } from "./geo";
import type { PoiItem, RankedPoiItem } from "../types";

export const NEARBY_POI_RADIUS_M = 500;
export const NEARBY_POI_LIMIT = 5;
const NEARBY_QUERY_MAX_ELEMENTS = 50;

const NEARBY_TAG_STATEMENTS = [
  'nwr["amenity"~"^(parking|place_of_worship|vending_machine|fuel|toilets|restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten)$"]',
  'nwr["shop"]',
];

/**
 * 周辺情報表示（要件7）用のPOI検索クエリ。目的地探索の帯検索（docs/decisions/
 * 260829-search-radius-band.md）とは独立しており、固定半径の円内検索のまま。
 * 高速道路除外も行わない（表示専用の付随情報のため）。
 */
export function buildNearbyQuery(lat: number, lon: number, radiusM = NEARBY_POI_RADIUS_M): string {
  const statements = NEARBY_TAG_STATEMENTS.map(
    (stmt) => `${stmt}(around:${radiusM},${lat},${lon});`,
  ).join("");
  return (
    `[out:json][timeout:25];` +
    `(${statements})->.poi;` +
    `.poi out center tags ${NEARBY_QUERY_MAX_ELEMENTS};`
  );
}

export function rankNearbyPois(
  pois: PoiItem[],
  originLat: number,
  originLon: number,
  excludeId: string,
  limit: number,
): RankedPoiItem[] {
  return pois
    .filter((p) => p.id !== excludeId)
    .map((p) => ({
      ...p,
      distanceM: Math.round(haversineDistanceKm(originLat, originLon, p.lat, p.lon) * 1000),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}
