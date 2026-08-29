export interface Env {
  CACHE: KVNamespace;
  MAPTILER_API_KEY: string;
}

export type DestinationCategory = "food_rest" | "shopping_other" | "other" | "intersection";

// "intersection"カテゴリのみ使用。プローブ→拡張の2段階のどちらの問い合わせかと、
// 両段階で共有する仮地点（docs/plans/260830-060923-phase4b交差点検出実装.md）
export type IntersectionStage = "probe" | "escalate";

export interface IntersectionAnchor {
  lat: number;
  lon: number;
}

export interface Candidate {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  category: DestinationCategory;
  address: string | null;
}

export interface PrepareRequestBody {
  lat: number;
  lon: number;
  radiusKm: number;
  category: DestinationCategory;
  // category==="other"のときのみ意味を持つ。それ以外は無視される
  parkingRequired: boolean;
  excludeIds: string[];
}

export interface SearchResponseBody {
  picked: Candidate | null;
  candidates: Candidate[];
  cacheHit: boolean;
  searchedAt: string;
}

export type PrepareResponseBody =
  | ({ status: "done" } & SearchResponseBody)
  | {
      status: "need_fetch";
      query: string;
      endpoint: string;
      cacheKey: string;
      // category==="intersection"のときのみ使用
      intersectionStage?: IntersectionStage;
      anchor?: IntersectionAnchor;
    };

export interface ProcessRequestBody {
  cacheKey: string;
  category: DestinationCategory;
  // category==="other"のときのみ意味を持つ。それ以外は無視される
  parkingRequired: boolean;
  excludeIds: string[];
  overpassResponse: unknown;
  // 探索範囲の帯フィルタ（docs/decisions/260829-search-radius-band.md）に必要
  lat: number;
  lon: number;
  radiusKm: number;
  // category==="intersection"のときのみ使用
  intersectionStage?: IntersectionStage;
  anchor?: IntersectionAnchor;
}

// /processは、"intersection"カテゴリのプローブ→拡張の2段階目に進む必要がある場合、
// SearchResponseBodyではなくPrepareResponseBody相当（need_fetch）を返すことがある
export type ProcessResponseBody = PrepareResponseBody;

export type PoiKind =
  | "parking"
  | "shrine_temple"
  | "vending_machine"
  | "fuel"
  | "toilets"
  | "food_rest"
  | "shop"
  | "other";

export interface PoiItem {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  kind: PoiKind;
  address: string | null;
}

export interface RankedPoiItem extends PoiItem {
  distanceM: number;
}

export interface NearbyPrepareRequestBody {
  lat: number;
  lon: number;
  excludeId: string;
  // 「店以外」×「停車できる場所が必要」で選ばれた目的地の場合のみtrueにする。
  // 駐車場だけ検索範囲を広げる（src/lib/nearby.ts参照）
  parkingWideSearch?: boolean;
}

export interface NearbyResponseBody {
  pois: RankedPoiItem[];
  cacheHit: boolean;
  fetchedAt: string;
}

export type NearbyPrepareResponseBody =
  | ({ status: "done" } & NearbyResponseBody)
  | {
      status: "need_fetch";
      query: string;
      endpoint: string;
      cacheKey: string;
      // 初回（500m）で0件だった場合のみ使用。1kmへの拡張問い合わせであることを示す
      nearbyStage?: "escalate";
    };

export interface NearbyProcessRequestBody {
  cacheKey: string;
  lat: number;
  lon: number;
  excludeId: string;
  overpassResponse: unknown;
  parkingWideSearch?: boolean;
  nearbyStage?: "escalate";
}

// /processは、500mで0件だった場合に1kmへの拡張問い合わせへ進む必要があるため、
// NearbyResponseBodyではなくNearbyPrepareResponseBody相当（need_fetch）を返すことがある
export type NearbyProcessResponseBody = NearbyPrepareResponseBody;
