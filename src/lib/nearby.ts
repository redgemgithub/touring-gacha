import { haversineDistanceKm } from "./geo";
import type { PoiItem, RankedPoiItem } from "../types";

export const NEARBY_POI_RADIUS_M = 500;
export const NEARBY_POI_LIMIT = 5;
const NEARBY_QUERY_MAX_ELEMENTS = 50;
// 「店以外」×「停車できる場所が必要」で選ばれた目的地は、判定に使ったのと同じ
// 1km圏内のどこかに駐車場があることが根拠になっている（destinations.tsの
// PARKING_PROXIMITY_BUFFER_M）。周辺情報表示側の駐車場だけこの半径に合わせないと、
// 選定根拠の駐車場が周辺情報一覧に一件も出てこず、矛盾して見える
// （docs/plans/260829-185103-phase4a-店以外タグ地点と停車場所.md）。
const NEARBY_PARKING_WIDE_RADIUS_M = 1000;
const NEARBY_OTHER_AMENITY_KINDS =
  "place_of_worship|vending_machine|fuel|toilets|restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten";

/**
 * 周辺情報表示（要件7）用のPOI検索クエリ。目的地探索の帯検索（docs/decisions/
 * 260829-search-radius-band.md）とは独立しており、固定半径の円内検索のまま。
 * 高速道路除外も行わない（表示専用の付随情報のため）。
 *
 * parkingWideSearchが真のとき、駐車場（amenity=parking/motorcycle_parking）だけ
 * NEARBY_PARKING_WIDE_RADIUS_M（1km）で別文として検索する。それ以外のPOI種別は
 * 従来通りradiusM（既定500m）のまま変えない。偽のときは既存のクエリ文字列と
 * 完全に同一になる。
 */
export function buildNearbyQuery(
  lat: number,
  lon: number,
  radiusM = NEARBY_POI_RADIUS_M,
  parkingWideSearch = false,
): string {
  const mainAmenityRegex = parkingWideSearch
    ? NEARBY_OTHER_AMENITY_KINDS
    : `parking|${NEARBY_OTHER_AMENITY_KINDS}`;
  const statements = [
    `nwr["amenity"~"^(${mainAmenityRegex})$"](around:${radiusM},${lat},${lon});`,
    `nwr["shop"](around:${radiusM},${lat},${lon});`,
  ];
  if (parkingWideSearch) {
    statements.push(
      `nwr["amenity"~"^(parking|motorcycle_parking)$"](around:${NEARBY_PARKING_WIDE_RADIUS_M},${lat},${lon});`,
    );
  }
  return (
    `[out:json][timeout:25];` +
    `(${statements.join("")})->.poi;` +
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
