import { prepareNearby, processNearby, fetchOverpassDirect, describeApiError } from "./api.js";

export async function loadNearbyPois(store) {
  const state = store.getState();
  const picked = state.picked;
  if (!picked) return;
  if (state.nearbyFetchedForId === picked.id && !state.nearbyError) return;

  store.setState({ nearbyLoading: true, nearbyError: null });

  const parkingWideSearch = picked.category === "other" && state.parkingRequired === true;

  try {
    // 500mで0件のとき1kmまで1回だけ拡張する場合があるため、既存カテゴリの検索と
    // 同様、need_fetchが続く限りfetch→processを繰り返すループにする
    // （docs/plans/260830-070951-周辺情報500m空振り時1km拡張.md）。
    let result = await prepareNearby({
      lat: picked.lat,
      lon: picked.lon,
      excludeId: picked.id,
      parkingWideSearch,
    });
    while (result.status === "need_fetch") {
      const overpassResponse = await fetchOverpassDirect(result.endpoint, result.query);
      result = await processNearby({
        cacheKey: result.cacheKey,
        lat: picked.lat,
        lon: picked.lon,
        excludeId: picked.id,
        overpassResponse,
        parkingWideSearch,
        nearbyStage: result.nearbyStage,
      });
    }

    store.setState({
      nearbyLoading: false,
      nearbyPois: result.pois,
      nearbyFetchedForId: picked.id,
      focusedPoiId: result.pois[0]?.id ?? null,
    });
  } catch (err) {
    console.error("loadNearbyPois error:", err);
    store.setState({
      nearbyLoading: false,
      nearbyError: { message: describeApiError(err) },
    });
  }
}
