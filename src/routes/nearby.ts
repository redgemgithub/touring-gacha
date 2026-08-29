import { Hono } from "hono";
import type {
  Env,
  NearbyPrepareRequestBody,
  NearbyPrepareResponseBody,
  NearbyProcessRequestBody,
  NearbyResponseBody,
  PoiItem,
} from "../types";
import { buildNearbyQuery, NEARBY_POI_LIMIT, rankNearbyPois } from "../lib/nearby";
import { toPoiItems } from "../lib/poi";
import { parseOverpassResponse, OverpassError, OVERPASS_ENDPOINT } from "../lib/overpass";
import { buildNearbyCacheKey, getCachedPois, putCachedPois } from "../lib/cache";

function isValidPrepareRequest(body: unknown): body is NearbyPrepareRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.lat === "number" && typeof b.lon === "number" && typeof b.excludeId === "string"
  );
}

function isValidProcessRequest(body: unknown): body is NearbyProcessRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.cacheKey === "string" &&
    typeof b.lat === "number" &&
    typeof b.lon === "number" &&
    typeof b.excludeId === "string" &&
    "overpassResponse" in b
  );
}

const app = new Hono<{ Bindings: Env }>();

app.post("/prepare", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isValidPrepareRequest(body)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const { lat, lon, excludeId } = body;
  const cacheKey = buildNearbyCacheKey(lat, lon);
  const cached = await getCachedPois(c.env.CACHE, cacheKey);

  if (cached) {
    const response: NearbyPrepareResponseBody = {
      status: "done",
      pois: rankNearbyPois(cached, lat, lon, excludeId, NEARBY_POI_LIMIT),
      cacheHit: true,
      fetchedAt: new Date().toISOString(),
    };
    return c.json(response);
  }

  const query = buildNearbyQuery(lat, lon);
  const response: NearbyPrepareResponseBody = {
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

  const { cacheKey, lat, lon, excludeId, overpassResponse } = body;

  let pois: PoiItem[];
  try {
    const parsed = parseOverpassResponse(overpassResponse);
    pois = toPoiItems(parsed.elements);
  } catch (err) {
    if (err instanceof OverpassError) {
      return c.json({ error: "overpass_error" }, 502);
    }
    throw err;
  }

  await putCachedPois(c.env.CACHE, cacheKey, pois);

  const response: NearbyResponseBody = {
    pois: rankNearbyPois(pois, lat, lon, excludeId, NEARBY_POI_LIMIT),
    cacheHit: false,
    fetchedAt: new Date().toISOString(),
  };
  return c.json(response);
});

export default app;
