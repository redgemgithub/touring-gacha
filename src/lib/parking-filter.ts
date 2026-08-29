import type { OverpassElement } from "./overpass";
import type { Candidate } from "../types";
import { haversineDistanceKm } from "./geo";

export function isParkingElement(el: OverpassElement): boolean {
  const amenity = el.tags?.amenity;
  return amenity === "parking" || amenity === "motorcycle_parking";
}

/**
 * 停車できる場所が近く（bufferM以内）にある候補だけを残す。
 * 「地図データから判断可能な場合のみ条件として使用する」を、判断できないもの
 * （駐車場データが見つからない候補）は通すのではなく除外すると解釈している
 * （docs/decisions/260829-phase4a-店以外タグ地点と停車場所.md）。
 */
export function filterByNearbyParking(
  candidates: Candidate[],
  parkingElements: OverpassElement[],
  bufferM: number,
): Candidate[] {
  const parkingPoints = parkingElements
    .map((el) => {
      const lat = el.type === "node" ? el.lat : el.center?.lat;
      const lon = el.type === "node" ? el.lon : el.center?.lon;
      return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
    })
    .filter((p): p is { lat: number; lon: number } => p !== null);

  if (parkingPoints.length === 0) return [];

  return candidates.filter((cand) =>
    parkingPoints.some(
      (p) => haversineDistanceKm(cand.lat, cand.lon, p.lat, p.lon) * 1000 <= bufferM,
    ),
  );
}
