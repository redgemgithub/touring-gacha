export interface Env {
  CACHE: KVNamespace;
  MAPTILER_API_KEY: string;
}

export type ShopCategory = "food_rest" | "shopping_other";

export interface Candidate {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  category: ShopCategory;
  address: string | null;
}

export interface PrepareRequestBody {
  lat: number;
  lon: number;
  radiusKm: number;
  category: ShopCategory;
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
    };

export interface ProcessRequestBody {
  cacheKey: string;
  category: ShopCategory;
  excludeIds: string[];
  overpassResponse: unknown;
  // 探索範囲の帯フィルタ（docs/decisions/260829-search-radius-band.md）に必要
  lat: number;
  lon: number;
  radiusKm: number;
}
