import { EXCLUDED_HIGHWAY_TYPES } from "./overpass";
import type { OverpassElement } from "./overpass";

export const INTERSECTION_PROBE_RADIUS_M = 100;
export const INTERSECTION_ESCALATE_RADIUS_M = 1000;
// このノードを共有する異なるway数がこれ以上なら交差点候補とする
export const INTERSECTION_DEGREE_THRESHOLD = 3;
// プローブ（100m）でこの件数以上あれば、拡張せずそこで確定する。暫定値。
// 実装後、実データで数件目視確認して妥当性を判断する
// （docs/plans/260830-060923-phase4b交差点検出実装.md）。
export const INTERSECTION_PROBE_MIN_COUNT = 5;
// 仮地点が完全な空振り（プローブ・拡張とも道路データ0件、海上等の可能性）だった
// 場合に、内部で別の方角の仮地点を引き直す上限回数。距離は変えず方角だけ
// 引き直すため、探索範囲を勝手に広げない方針とは矛盾しない
// （docs/plans/260830-075848-交差点仮地点の海上ハズレを内部リトライ.md）。
export const INTERSECTION_MAX_ANCHOR_ATTEMPTS = 2;
const HIGHWAY_SEARCH_BUFFER_M = 200;
const MAX_WAY_ELEMENTS = 20000;
const MAX_NODE_ELEMENTS = 60000;
const MAX_HIGHWAY_ELEMENTS = 500;

/**
 * 仮地点（anchor）周辺の道路網（way＋ノード）と、除外対象の高速道路ジオメトリを
 * 1回のOverpassクエリで取得する。交差点判定はここでは行わず、取得したway・ノード
 * データからアプリ側（computeIntersectionCandidates）でノードの次数を計算する
 * （過去の教訓により、関係計算はOverpass側でやらずアプリ側で行う）。
 *
 * way→nodeの取得は、docs/plans/260829-214939-phase4bスパイク検証.md で実測・
 * 検証済みのクエリ形（`way[...];out body;>;out skel qt;`）をそのまま踏襲する。
 */
export function buildIntersectionQuery(
  anchorLat: number,
  anchorLon: number,
  radiusM: number,
): string {
  const highwayRegex = EXCLUDED_HIGHWAY_TYPES.join("|");
  const highwayRadiusM = radiusM + HIGHWAY_SEARCH_BUFFER_M;
  return (
    `[out:json][timeout:25];` +
    `way["highway"](around:${radiusM},${anchorLat},${anchorLon});` +
    `out body ${MAX_WAY_ELEMENTS};` +
    `>;` +
    `out skel qt ${MAX_NODE_ELEMENTS};` +
    `way["highway"~"^(${highwayRegex})$"](around:${highwayRadiusM},${anchorLat},${anchorLon})->.hw;` +
    `.hw out geom ${MAX_HIGHWAY_ELEMENTS};`
  );
}

export interface IntersectionCandidatePoint {
  id: string;
  lat: number;
  lon: number;
}

/**
 * 道路網の生データから、次数（そのノードを共有する異なるway数）が
 * INTERSECTION_DEGREE_THRESHOLD以上のノードを交差点候補として抽出する。
 *
 * 簡易的な判定であり、同一道路がタグ上複数wayに分割されているだけのケースを
 * 交差点と誤検出する可能性がある点は既知の制限とする
 * （docs/plans/260830-060923-phase4b交差点検出実装.md）。
 */
export function computeIntersectionCandidates(
  elements: OverpassElement[],
): IntersectionCandidatePoint[] {
  // 除外用ハイウェイジオメトリ（.hw、out geomで取得）もnodesを持つため、
  // geometryの有無で道路網グラフ用のwayとを区別する（destinations.tsの
  // candidateElements/highwayElementsの分離と同じ考え方）。
  const ways = elements.filter(
    (el): el is OverpassElement & { nodes: number[] } =>
      el.type === "way" && Array.isArray(el.nodes) && !Array.isArray(el.geometry),
  );
  const nodeById = new Map<number, OverpassElement>();
  for (const el of elements) {
    if (el.type === "node") nodeById.set(el.id, el);
  }

  const nodeToWays = new Map<number, Set<number>>();
  for (const way of ways) {
    for (const nodeId of way.nodes) {
      if (!nodeToWays.has(nodeId)) nodeToWays.set(nodeId, new Set());
      nodeToWays.get(nodeId)!.add(way.id);
    }
  }

  const candidates: IntersectionCandidatePoint[] = [];
  for (const [nodeId, waySet] of nodeToWays) {
    if (waySet.size < INTERSECTION_DEGREE_THRESHOLD) continue;
    const node = nodeById.get(nodeId);
    if (!node || typeof node.lat !== "number" || typeof node.lon !== "number") continue;
    candidates.push({ id: `node/${nodeId}`, lat: node.lat, lon: node.lon });
  }
  return candidates;
}
