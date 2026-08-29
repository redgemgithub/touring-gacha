import type { OverpassElement } from "./overpass";
import type { PoiItem, PoiKind } from "../types";
import { buildAddress } from "./candidate";

const FOOD_REST_AMENITIES = new Set([
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "pub",
  "ice_cream",
  "food_court",
  "biergarten",
]);

export function classifyPoiKind(tags: Record<string, string>): PoiKind {
  const amenity = tags.amenity;
  if (amenity === "parking" || amenity === "motorcycle_parking") return "parking";
  if (amenity === "place_of_worship") return "shrine_temple";
  if (amenity === "vending_machine") return "vending_machine";
  if (amenity === "fuel") return "fuel";
  if (amenity === "toilets") return "toilets";
  if (amenity && FOOD_REST_AMENITIES.has(amenity)) return "food_rest";
  if (tags.shop) return "shop";
  return "other";
}

export function toPoiItems(elements: OverpassElement[]): PoiItem[] {
  const items: PoiItem[] = [];
  for (const el of elements) {
    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lon = el.type === "node" ? el.lon : el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;

    const tags = el.tags ?? {};
    items.push({
      id: `${el.type}/${el.id}`,
      lat,
      lon,
      name: tags.name ?? null,
      kind: classifyPoiKind(tags),
      address: buildAddress(tags),
    });
  }
  return items;
}
