import { Hono } from "hono";
import type {
  Candidate,
  Env,
  PrepareRequestBody,
  PrepareResponseBody,
  ProcessRequestBody,
  SearchResponseBody,
  ShopCategory,
} from "../types";
import {
  buildOverpassQuery,
  parseOverpassResponse,
  OverpassError,
  OVERPASS_ENDPOINT,
  HIGHWAY_EXCLUSION_BUFFER_M,
} from "../lib/overpass";
import { toCandidates } from "../lib/candidate";
import { excludeNearHighways } from "../lib/highway-filter";
import { buildCacheKey, getCachedCandidates, putCachedCandidates } from "../lib/cache";

const ALLOWED_RADIUS_KM = [10, 30, 50, 100];
const ALLOWED_CATEGORIES: ShopCategory[] = ["food_rest", "shopping_other"];

function isValidPrepareRequest(body: unknown): body is PrepareRequestBody {
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

function isValidProcessRequest(body: unknown): body is ProcessRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.cacheKey === "string" &&
    typeof b.category === "string" &&
    ALLOWED_CATEGORIES.includes(b.category as ShopCategory) &&
    (b.excludeIds === undefined || Array.isArray(b.excludeIds)) &&
    "overpassResponse" in b
  );
}

function pickCandidate(candidates: Candidate[], excludeIds: string[]): Candidate | null {
  const exclude = new Set(excludeIds);
  const pool = candidates.filter((cand) => !exclude.has(cand.id));
  const effectivePool = pool.length > 0 ? pool : candidates;
  return effectivePool.length > 0
    ? effectivePool[Math.floor(Math.random() * effectivePool.length)]
    : null;
}

const app = new Hono<{ Bindings: Env }>();

app.post("/prepare", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isValidPrepareRequest(body)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const { lat, lon, radiusKm, category, excludeIds } = body;
  const cacheKey = buildCacheKey(lat, lon, radiusKm, category);
  const cached = await getCachedCandidates(c.env.CACHE, cacheKey);

  if (cached) {
    const response: PrepareResponseBody = {
      status: "done",
      picked: pickCandidate(cached, excludeIds ?? []),
      candidates: cached,
      cacheHit: true,
      searchedAt: new Date().toISOString(),
    };
    return c.json(response);
  }

  const query = buildOverpassQuery(lat, lon, radiusKm, category);
  const response: PrepareResponseBody = {
    status: "need_fetch",
    query,
    endpoint: OVERPASS_ENDPOINT,
    cacheKey,
  };
  return c.json(response);
});

app.post("/process", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isValidProcessRequest(body)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const { cacheKey, category, excludeIds, overpassResponse } = body;

  let candidates: Candidate[];
  try {
    const parsed = parseOverpassResponse(overpassResponse);
    const candidateElements = parsed.elements.filter((el) => !el.geometry);
    const highwayElements = parsed.elements.filter((el) => Array.isArray(el.geometry));
    const rawCandidates = toCandidates(candidateElements, category);
    candidates = excludeNearHighways(rawCandidates, highwayElements, HIGHWAY_EXCLUSION_BUFFER_M);
  } catch (err) {
    if (err instanceof OverpassError) {
      return c.json({ error: "overpass_error" }, 502);
    }
    throw err;
  }

  await putCachedCandidates(c.env.CACHE, cacheKey, candidates);

  const response: SearchResponseBody = {
    picked: pickCandidate(candidates, excludeIds ?? []),
    candidates,
    cacheHit: false,
    searchedAt: new Date().toISOString(),
  };
  return c.json(response);
});

export default app;
