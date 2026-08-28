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

export interface SearchRequestBody {
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
