import type { ShopCategory } from "../types";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "touring-gacha/0.1 (personal use)";
const EXCLUDED_HIGHWAY_TYPES = ["motorway", "motorway_link", "trunk", "trunk_link"];
export const HIGHWAY_EXCLUSION_BUFFER_M = 100;
const HIGHWAY_SEARCH_BUFFER_M = 200;
const MAX_CANDIDATE_ELEMENTS = 300;
const MAX_HIGHWAY_ELEMENTS = 200;

const CATEGORY_TAG_FILTERS: Record<ShopCategory, string> = {
  food_rest:
    'nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten)$"]',
  shopping_other: 'nwr["shop"];nwr["amenity"~"^(marketplace|fuel)$"]',
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

interface OverpassResponse {
  elements: OverpassElement[];
  remark?: string;
}

/**
 * 候補（店）検索と高速道路ジオメトリ取得を別々のOverpass文にする。
 * around.hw のような2集合間の近接フィルタはOverpass側の計算コストが非常に高く、
 * shop=* のような件数の多いカテゴリでは実際にタイムアウトすることを確認済み。
 * 高速道路除外はここでは行わず、取得したジオメトリを使ってアプリ側（Workers）で計算する。
 */
export function buildOverpassQuery(
  lat: number,
  lon: number,
  radiusKm: number,
  category: ShopCategory,
): string {
  const radiusM = Math.round(radiusKm * 1000);
  const highwayRadiusM = radiusM + HIGHWAY_SEARCH_BUFFER_M;
  const highwayRegex = EXCLUDED_HIGHWAY_TYPES.join("|");
  const candStatements = CATEGORY_TAG_FILTERS[category]
    .split(";")
    .filter(Boolean)
    .map((stmt) => `${stmt}(around:${radiusM},${lat},${lon});`)
    .join("");

  return (
    `[out:json][timeout:25];` +
    `(${candStatements})->.cand;` +
    `.cand out center tags ${MAX_CANDIDATE_ELEMENTS};` +
    `way["highway"~"^(${highwayRegex})$"](around:${highwayRadiusM},${lat},${lon})->.hw;` +
    `.hw out geom ${MAX_HIGHWAY_ELEMENTS};`
  );
}

export class OverpassRateLimitedError extends Error {
  constructor(public status: number) {
    super(`Overpass API rate limited or unavailable (status ${status})`);
  }
}

export class OverpassError extends Error {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(message ?? `Overpass API error (status ${status})`);
  }
}

export async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "data=" + encodeURIComponent(query),
  });

  if (res.status === 429 || res.status >= 500) {
    throw new OverpassRateLimitedError(res.status);
  }
  if (!res.ok) {
    throw new OverpassError(res.status);
  }

  const json = (await res.json()) as OverpassResponse;
  // Overpassはクエリのランタイムエラー（タイムアウト等）でもHTTP 200を返し、
  // elementsが空のまま remark にエラー内容を入れてくることがある。見逃すと
  // 「候補0件」という誤った結果を静かにキャッシュしてしまうため、明示的に弾く。
  if (json.remark) {
    throw new OverpassError(res.status, json.remark);
  }
  return json;
}
