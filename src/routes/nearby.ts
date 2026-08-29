import { Hono } from "hono";
import type {
  Env,
  NearbyPrepareRequestBody,
  NearbyPrepareResponseBody,
  NearbyProcessRequestBody,
  NearbyProcessResponseBody,
  PoiItem,
} from "../types";
import {
  buildNearbyQuery,
  NEARBY_POI_LIMIT,
  NEARBY_ESCALATE_RADIUS_M,
  rankNearbyPois,
} from "../lib/nearby";
import { toPoiItems } from "../lib/poi";
import { parseOverpassResponse, OverpassError, OVERPASS_ENDPOINT } from "../lib/overpass";
import { buildNearbyCacheKey, getCachedPois, putCachedPois } from "../lib/cache";

function isValidPrepareRequest(body: unknown): body is NearbyPrepareRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.lat === "number" &&
    typeof b.lon === "number" &&
    typeof b.excludeId === "string" &&
    (b.parkingWideSearch === undefined || typeof b.parkingWideSearch === "boolean")
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
    "overpassResponse" in b &&
    (b.parkingWideSearch === undefined || typeof b.parkingWideSearch === "boolean") &&
    (b.nearbyStage === undefined || b.nearbyStage === "escalate")
  );
}

const app = new Hono<{ Bindings: Env }>();

app.post("/prepare", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isValidPrepareRequest(body)) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const { lat, lon, excludeId, parkingWideSearch } = body;
  const cacheKey = buildNearbyCacheKey(lat, lon, parkingWideSearch ?? false);
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

  const query = buildNearbyQuery(lat, lon, undefined, parkingWideSearch ?? false);
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

  const { cacheKey, lat, lon, excludeId, overpassResponse, parkingWideSearch, nearbyStage } = body;

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

  const ranked = rankNearbyPois(pois, lat, lon, excludeId, NEARBY_POI_LIMIT);

  // 500m（初回）で0件だった場合のみ、1kmまで1回だけ拡張して再検索する
  // （docs/plans/260830-070951-周辺情報500m空振り時1km拡張.md）。拡張後
  // （nearbyStage==="escalate"）は件数に関わらずそのままキャッシュ・確定する。
  if (ranked.length === 0 && nearbyStage !== "escalate") {
    const response: NearbyProcessResponseBody = {
      status: "need_fetch",
      query: buildNearbyQuery(lat, lon, NEARBY_ESCALATE_RADIUS_M, parkingWideSearch ?? false),
      endpoint: OVERPASS_ENDPOINT,
      cacheKey,
      nearbyStage: "escalate",
    };
    return c.json(response);
  }

  await putCachedPois(c.env.CACHE, cacheKey, pois);

  const response: NearbyProcessResponseBody = {
    status: "done",
    pois: ranked,
    cacheHit: false,
    fetchedAt: new Date().toISOString(),
  };
  return c.json(response);
});

export default app;
