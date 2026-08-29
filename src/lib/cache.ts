import type { Candidate, Env, PoiItem, DestinationCategory } from "../types";
import { bucketCoordinate } from "./geo";
import { NEARBY_POI_RADIUS_M } from "./nearby";

const CACHE_TTL_SECONDS = 60 * 60 * 24;

export function buildCacheKey(
  lat: number,
  lon: number,
  radiusKm: number,
  category: DestinationCategory,
  parkingRequired: boolean,
): string {
  // v2: 探索範囲を「円内」から「帯」に変更した際にバージョンを上げた。
  // v3: 帯の計算式を変更（隣接選択肢との中間値を境界にし、中抜けを解消）した際に上げた
  // （docs/decisions/260829-search-radius-band-gapless.md）。以後、候補の絞り込み
  // ロジックを変更する際は必ずこのバージョンを上げること（docs/decisions/260829-cache-key-versioning.md）。
  //
  // parkingRequiredはcategory==="other"のときだけキーに反映する。既存カテゴリ
  // （food_rest/shopping_other）は停車場所条件を持たず、値の意味も変わらないため
  // バージョンは据え置きでよい（既存カテゴリのキー文字列は一切変わらない）。
  const bucket = bucketCoordinate(lat, lon, radiusKm);
  const parkingSegment = category === "other" ? `:parking${parkingRequired ? "1" : "0"}` : "";
  return `ov:v3:${category}:${radiusKm}:${bucket.lat.toFixed(4)}:${bucket.lon.toFixed(4)}${parkingSegment}`;
}

// 交差点候補専用のキャッシュキー。現在地・探索範囲ではなく、仮地点自身の座標を
// バケット化する。ランダム性の源（仮地点の乱数決定）がキャッシュキーの外側に
// あると、同じ現在地・探索範囲での検索・再抽選が同じキャッシュを共有し続け、
// 実質的に毎回似た結果しか出なくなる不具合になる
// （docs/plans/260830-073043-交差点キャッシュを仮地点ベースに変更.md）。
const INTERSECTION_CACHE_BUCKET_KM = 1;

export function buildIntersectionCacheKey(anchorLat: number, anchorLon: number): string {
  const bucket = bucketCoordinate(anchorLat, anchorLon, INTERSECTION_CACHE_BUCKET_KM);
  return `int:v1:${bucket.lat.toFixed(4)}:${bucket.lon.toFixed(4)}`;
}

export async function getCachedCandidates(
  cache: Env["CACHE"],
  key: string,
): Promise<Candidate[] | null> {
  const raw = await cache.get(key, "json");
  return (raw as Candidate[] | null) ?? null;
}

export async function putCachedCandidates(
  cache: Env["CACHE"],
  key: string,
  candidates: Candidate[],
): Promise<void> {
  await cache.put(key, JSON.stringify(candidates), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}

export function buildNearbyCacheKey(lat: number, lon: number, parkingWideSearch = false): string {
  // parkingWideSearchが真のときだけ区別用セグメントを付与する。
  // v2: 500mで0件のとき1kmへ1回だけ拡張してからキャッシュするよう変更した際に上げた
  // （docs/plans/260830-070951-周辺情報500m空振り時1km拡張.md）。旧v1のキャッシュは
  // 拡張前ロジックでの0件結果を含みうるため、そのまま使い続けると修正が反映されない。
  const bucket = bucketCoordinate(lat, lon, NEARBY_POI_RADIUS_M / 1000);
  const parkingSegment = parkingWideSearch ? ":pkwide" : "";
  return `poi:v2:${bucket.lat.toFixed(4)}:${bucket.lon.toFixed(4)}${parkingSegment}`;
}

export async function getCachedPois(cache: Env["CACHE"], key: string): Promise<PoiItem[] | null> {
  const raw = await cache.get(key, "json");
  return (raw as PoiItem[] | null) ?? null;
}

export async function putCachedPois(
  cache: Env["CACHE"],
  key: string,
  pois: PoiItem[],
): Promise<void> {
  await cache.put(key, JSON.stringify(pois), { expirationTtl: CACHE_TTL_SECONDS });
}
