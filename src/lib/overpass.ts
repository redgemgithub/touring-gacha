import type { DestinationCategory } from "../types";
import { computeDistanceBand } from "./geo";

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const EXCLUDED_HIGHWAY_TYPES = ["motorway", "motorway_link", "trunk", "trunk_link"];
export const HIGHWAY_EXCLUSION_BUFFER_M = 100;
const HIGHWAY_SEARCH_BUFFER_M = 200;
const MAX_CANDIDATE_ELEMENTS = 300;
const MAX_HIGHWAY_ELEMENTS = 200;
// 停車場所の近接判定バッファ（PARKING_PROXIMITY_BUFFER_M=1000m、destinations.ts）と
// 同じかそれ以上にしておき、判定対象の駐車場データが検索範囲の境界で漏れないようにする
const PARKING_SEARCH_BUFFER_M = 1000;
const MAX_PARKING_ELEMENTS = 300;

const CATEGORY_TAG_FILTERS: Record<DestinationCategory, string> = {
  food_rest:
    'nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten)$"]',
  shopping_other: 'nwr["shop"];nwr["amenity"~"^(marketplace|fuel)$"]',
  other:
    'nwr["natural"="peak"];nwr["natural"="saddle"];nwr["mountain_pass"="yes"];nwr["tourism"="viewpoint"]',
};

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

export interface OverpassRawResponse {
  elements: OverpassElement[];
  remark?: string;
}

/**
 * 候補（店）検索と高速道路ジオメトリ取得を別々のOverpass文にする。
 * around.hw のような2集合間の近接フィルタはOverpass側の計算コストが非常に高く、
 * shop=* のような件数の多いカテゴリでは実際にタイムアウトすることを確認済み。
 * 高速道路除外はここでは行わず、取得したジオメトリを使ってアプリ側で計算する。
 *
 * このクエリはCloudflare Workers（サーバー）ではなくブラウザから直接Overpassへ
 * 送信される（docs/decisions/260829-overpass-client-side-fetch.md）。ここではクエリ
 * 文字列の組み立てのみ行い、実際のfetchはクライアント側が行う。
 *
 * 探索範囲は「指定距離以内」ではなく「指定距離に近い帯」として扱う
 * （docs/decisions/260829-search-radius-band.md）。ここでは帯の外側境界までを
 * Overpassに問い合わせ、内側境界での絞り込みは呼び出し側（destinations.ts）で行う。
 *
 * category==="other"のときのみ、停車場所（amenity=parking/motorcycle_parking）を
 * 高速道路ジオメトリと同様に別文として取得する（近接判定はアプリ側、parking-filter.ts）。
 * 既存カテゴリ（food_rest/shopping_other）ではこのクエリ文字列は一切変わらない。
 */
export function buildOverpassQuery(
  lat: number,
  lon: number,
  radiusKm: number,
  category: DestinationCategory,
): string {
  const { outerKm } = computeDistanceBand(radiusKm);
  const radiusM = Math.round(outerKm * 1000);
  const highwayRadiusM = radiusM + HIGHWAY_SEARCH_BUFFER_M;
  const highwayRegex = EXCLUDED_HIGHWAY_TYPES.join("|");
  const candStatements = CATEGORY_TAG_FILTERS[category]
    .split(";")
    .filter(Boolean)
    .map((stmt) => `${stmt}(around:${radiusM},${lat},${lon});`)
    .join("");
  const parkingQuery =
    category === "other"
      ? `nwr["amenity"~"^(parking|motorcycle_parking)$"](around:${radiusM + PARKING_SEARCH_BUFFER_M},${lat},${lon})->.pk;` +
        `.pk out center tags ${MAX_PARKING_ELEMENTS};`
      : "";

  return (
    `[out:json][timeout:25];` +
    `(${candStatements})->.cand;` +
    `.cand out center tags ${MAX_CANDIDATE_ELEMENTS};` +
    `way["highway"~"^(${highwayRegex})$"](around:${highwayRadiusM},${lat},${lon})->.hw;` +
    `.hw out geom ${MAX_HIGHWAY_ELEMENTS};` +
    parkingQuery
  );
}

export class OverpassError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * クライアントから届いた「Overpassの生レスポンスのはず」の値を検証する。
 * Overpassはクエリのランタイムエラー（タイムアウト等）でもHTTP 200を返し、
 * elementsが空のまま remark にエラー内容を入れてくることがある。見逃すと
 * 「候補0件」という誤った結果を静かにキャッシュしてしまうため、明示的に弾く。
 */
export function parseOverpassResponse(raw: unknown): OverpassRawResponse {
  if (typeof raw !== "object" || raw === null || !("elements" in raw)) {
    throw new OverpassError("invalid Overpass response shape");
  }
  const response = raw as OverpassRawResponse;
  if (!Array.isArray(response.elements)) {
    throw new OverpassError("invalid Overpass response shape");
  }
  if (response.remark) {
    throw new OverpassError(response.remark);
  }
  return response;
}
