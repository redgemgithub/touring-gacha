import { Hono } from "hono";
import type { Env, SearchRequestBody, SearchResponseBody, ShopCategory } from "../types";
import {
  buildOverpassQuery,
  fetchOverpass,
  OverpassRateLimitedError,
  OverpassError,
  HIGHWAY_EXCLUSION_BUFFER_M,
} from "../lib/overpass";
import { toCandidates } from "../lib/candidate";
import { excludeNearHighways } from "../lib/highway-filter";
import { buildCacheKey, getCachedCandidates, putCachedCandidates } from "../lib/cache";

const ALLOWED_RADIUS_KM = [10, 30, 50, 100];
const ALLOWED_CATEGORIES: ShopCategory[] = ["food_rest", "shopping_other"];

function isValidSearchRequest(body: unknown): body is SearchRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.lat === "number" &&
    typeof b.lon === "number" &&
    typeof b.radiusKm === "number" &&
    ALLOWED_RADIUS_KM.includes(b.radiusKm) &&
    typeof b.category === "string" &&
    ALLOWED_CATEGORIES.includes(b.category as ShopCategory) &&
    (b.excludeIds === undefined || Array.isArray(b.excludeIds))
  );
}

const app = new Hono<{ Bindings: Env }>();

app.post("/search", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isValidSearchRequest(body)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const { lat, lon, radiusKm, category, excludeIds } = body;
  const exclude = new Set(excludeIds ?? []);

  const key = buildCacheKey(lat, lon, radiusKm, category);
  const cached = await getCachedCandidates(c.env.CACHE, key);
  const cacheHit = cached !== null;
  let candidates = cached;

  if (!candidates) {
    const query = buildOverpassQuery(lat, lon, radiusKm, category);
    try {
      const result = await fetchOverpass(query);
      const candidateElements = result.elements.filter((el) => !el.geometry);
      const highwayElements = result.elements.filter((el) => Array.isArray(el.geometry));
      const rawCandidates = toCandidates(candidateElements, category);
      candidates = excludeNearHighways(rawCandidates, highwayElements, HIGHWAY_EXCLUSION_BUFFER_M);
    } catch (err) {
      if (err instanceof OverpassRateLimitedError) {
        c.header("Retry-After", "30");
        return c.json({ error: "overpass_unavailable" }, 503);
      }
      if (err instanceof OverpassError) {
        return c.json({ error: "overpass_error" }, 502);
      }
      throw err;
    }
    await putCachedCandidates(c.env.CACHE, key, candidates);
  }

  const pool = candidates.filter((cand) => !exclude.has(cand.id));
  const effectivePool = pool.length > 0 ? pool : candidates;
  const picked =
    effectivePool.length > 0
      ? effectivePool[Math.floor(Math.random() * effectivePool.length)]
      : null;

  const response: SearchResponseBody = {
    picked,
    candidates,
    cacheHit,
    searchedAt: new Date().toISOString(),
  };
  return c.json(response);
});

export default app;
