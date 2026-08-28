import type { OverpassElement } from "./overpass";
import type { Candidate } from "../types";
import { distanceToPolylineMeters } from "./geo";

export function excludeNearHighways(
  candidates: Candidate[],
  highwayElements: OverpassElement[],
  bufferM: number,
): Candidate[] {
  const polylines = highwayElements
    .map((el) => el.geometry)
    .filter((geom): geom is { lat: number; lon: number }[] => Array.isArray(geom) && geom.length >= 2);

  if (polylines.length === 0) return candidates;

  return candidates.filter((cand) => {
    for (const polyline of polylines) {
      const dist = distanceToPolylineMeters({ lat: cand.lat, lon: cand.lon }, polyline);
      if (dist <= bufferM) return false;
    }
    return true;
  });
}
