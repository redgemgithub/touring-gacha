import { Hono } from "hono";
import type {
  Candidate,
  Env,
  PrepareRequestBody,
  PrepareResponseBody,
  ProcessRequestBody,
  ProcessResponseBody,
  SearchResponseBody,
  DestinationCategory,
  IntersectionStage,
  IntersectionAnchor,
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
import { isParkingElement, filterByNearbyParking } from "../lib/parking-filter";
import {
  buildIntersectionQuery,
  computeIntersectionCandidates,
  INTERSECTION_PROBE_RADIUS_M,
  INTERSECTION_ESCALATE_RADIUS_M,
  INTERSECTION_PROBE_MIN_COUNT,
} from "../lib/intersection";
import { buildCacheKey, getCachedCandidates, putCachedCandidates } from "../lib/cache";
import { computeDistanceBand, haversineDistanceKm, destinationPoint } from "../lib/geo";

const ALLOWED_RADIUS_KM = [10, 30, 50, 100];
const ALLOWED_CATEGORIES: DestinationCategory[] = [
  "food_rest",
  "shopping_other",
  "other",
  "intersection",
];
// 停車場所（駐車場）データがどれだけ候補に近ければ「停車できる場所あり」とみなすか。
// バイクで走る際の「近く」の感覚として1kmとした。当初50mを検討したが、山頂・峠等の
// タグ位置と実際の駐車場（登山口等）の距離を実データで検証した結果、50mでは
// 事実上マッチ件数が0件になることが判明したため変更した
// （docs/plans/260829-185103-phase4a-店以外タグ地点と停車場所.md）。
const PARKING_PROXIMITY_BUFFER_M = 1000;

function isValidPrepareRequest(body: unknown): body is PrepareRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.lat === "number" &&
    typeof b.lon === "number" &&
    typeof b.radiusKm === "number" &&
    ALLOWED_RADIUS_KM.includes(b.radiusKm) &&
    typeof b.category === "string" &&
    ALLOWED_CATEGORIES.includes(b.category as DestinationCategory) &&
    typeof b.parkingRequired === "boolean" &&
    (b.excludeIds === undefined || Array.isArray(b.excludeIds))
  );
}

function isValidIntersectionStage(value: unknown): value is IntersectionStage {
  return value === "probe" || value === "escalate";
}

function isValidAnchor(value: unknown): value is IntersectionAnchor {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return typeof a.lat === "number" && typeof a.lon === "number";
}

function isValidProcessRequest(body: unknown): body is ProcessRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.cacheKey === "string" &&
    typeof b.category === "string" &&
    ALLOWED_CATEGORIES.includes(b.category as DestinationCategory) &&
    typeof b.parkingRequired === "boolean" &&
    (b.excludeIds === undefined || Array.isArray(b.excludeIds)) &&
    "overpassResponse" in b &&
    (b.intersectionStage === undefined || isValidIntersectionStage(b.intersectionStage)) &&
    (b.anchor === undefined || isValidAnchor(b.anchor)) &&
    typeof b.lat === "number" &&
    typeof b.lon === "number" &&
    typeof b.radiusKm === "number" &&
    ALLOWED_RADIUS_KM.includes(b.radiusKm)
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

  const { lat, lon, radiusKm, category, parkingRequired, excludeIds } = body;
  const cacheKey = buildCacheKey(lat, lon, radiusKm, category, parkingRequired);
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

  if (category === "intersection") {
    // 仮地点（現在地から乱数の方角×指定距離ちょうどの点）を決め、まずプローブ
    // （100m）から開始する。probe/escalateの2段階については
    // docs/plans/260830-060923-phase4b交差点検出実装.md 参照
    const anchor = destinationPoint(lat, lon, Math.random() * 360, radiusKm);
    const response: PrepareResponseBody = {
      status: "need_fetch",
      query: buildIntersectionQuery(anchor.lat, anchor.lon, INTERSECTION_PROBE_RADIUS_M),
      endpoint: OVERPASS_ENDPOINT,
      cacheKey,
      intersectionStage: "probe",
      anchor,
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

  const {
    cacheKey,
    category,
    parkingRequired,
    excludeIds,
    overpassResponse,
    lat,
    lon,
    radiusKm,
    intersectionStage,
    anchor,
  } = body;

  if (category === "intersection") {
    if (!intersectionStage || !anchor) {
      return c.json({ error: "invalid_request" }, 400);
    }
    try {
      const parsed = parseOverpassResponse(overpassResponse);
      const highwayElements = parsed.elements.filter((el) => Array.isArray(el.geometry));
      const rawCandidates: Candidate[] = computeIntersectionCandidates(parsed.elements).map(
        (p) => ({ id: p.id, lat: p.lat, lon: p.lon, name: null, category: "intersection", address: null }),
      );
      const nonHighwayCandidates = excludeNearHighways(
        rawCandidates,
        highwayElements,
        HIGHWAY_EXCLUSION_BUFFER_M,
      );
      // 交差点は帯検索ではなく仮地点（指定距離ちょうど）の周辺検索だが、最終的な
      // 候補は他カテゴリと同様に現在地から見た帯に収まっているかを再チェックする
      const { innerKm, outerKm } = computeDistanceBand(radiusKm);
      const bandFiltered = nonHighwayCandidates.filter((cand) => {
        const distKm = haversineDistanceKm(lat, lon, cand.lat, cand.lon);
        return distKm >= innerKm && distKm <= outerKm;
      });

      if (intersectionStage === "probe" && bandFiltered.length < INTERSECTION_PROBE_MIN_COUNT) {
        const response: ProcessResponseBody = {
          status: "need_fetch",
          query: buildIntersectionQuery(anchor.lat, anchor.lon, INTERSECTION_ESCALATE_RADIUS_M),
          endpoint: OVERPASS_ENDPOINT,
          cacheKey,
          intersectionStage: "escalate",
          anchor,
        };
        return c.json(response);
      }

      // 拡張（1km）まで見ても見つからなければ、それ以上は探さずそのまま0件として扱う
      await putCachedCandidates(c.env.CACHE, cacheKey, bandFiltered);
      const response: ProcessResponseBody = {
        status: "done",
        picked: pickCandidate(bandFiltered, excludeIds ?? []),
        candidates: bandFiltered,
        cacheHit: false,
        searchedAt: new Date().toISOString(),
      };
      return c.json(response);
    } catch (err) {
      if (err instanceof OverpassError) {
        return c.json({ error: "overpass_error" }, 502);
      }
      throw err;
    }
  }

  let candidates: Candidate[];
  try {
    const parsed = parseOverpassResponse(overpassResponse);
    const highwayElements = parsed.elements.filter((el) => Array.isArray(el.geometry));
    const parkingElements = parsed.elements.filter((el) => !el.geometry && isParkingElement(el));
    const candidateElements = parsed.elements.filter(
      (el) => !el.geometry && !isParkingElement(el),
    );
    const rawCandidates = toCandidates(candidateElements, category);
    const nonHighwayCandidates = excludeNearHighways(
      rawCandidates,
      highwayElements,
      HIGHWAY_EXCLUSION_BUFFER_M,
    );
    const parkingFilteredCandidates =
      category === "other" && parkingRequired
        ? filterByNearbyParking(nonHighwayCandidates, parkingElements, PARKING_PROXIMITY_BUFFER_M)
        : nonHighwayCandidates;
    // 探索範囲は「指定距離以内」ではなく「指定距離に近い帯」として扱う
    // （docs/decisions/260829-search-radius-band.md）。範囲外に見つからなくても
    // 自動的に範囲を広げず、そのまま0件として扱う。
    const { innerKm, outerKm } = computeDistanceBand(radiusKm);
    candidates = parkingFilteredCandidates.filter((cand) => {
      const distKm = haversineDistanceKm(lat, lon, cand.lat, cand.lon);
      return distKm >= innerKm && distKm <= outerKm;
    });
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
