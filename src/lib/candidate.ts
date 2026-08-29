import type { OverpassElement } from "./overpass";
import type { Candidate, ShopCategory } from "../types";

const ADDRESS_TAG_KEYS = [
  "addr:state",
  "addr:city",
  "addr:suburb",
  "addr:street",
  "addr:housenumber",
];

export function buildAddress(tags: Record<string, string>): string | null {
  const parts = ADDRESS_TAG_KEYS.map((key) => tags[key]).filter(
    (v): v is string => Boolean(v),
  );
  return parts.length > 0 ? parts.join("") : null;
}

export function toCandidates(
  elements: OverpassElement[],
  category: ShopCategory,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const el of elements) {
    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lon = el.type === "node" ? el.lon : el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;

    const tags = el.tags ?? {};
    candidates.push({
      id: `${el.type}/${el.id}`,
      lat,
      lon,
      name: tags.name ?? null,
      category,
      address: buildAddress(tags),
    });
  }
  return candidates;
}
