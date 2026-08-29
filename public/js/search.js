import { prepareSearch, fetchOverpassDirect, processSearch } from "./api.js";

export async function performSearch(store, { isReroll = false } = {}) {
  const state = store.getState();
  if (!state.location) return;

  store.setState({
    searching: true,
    searchError: null,
    view: "result",
    sheetExpanded: false,
    nearbyPois: [],
    nearbyLoading: false,
    nearbyError: null,
    nearbyFetchedForId: null,
    focusedPoiId: null,
  });

  const excludeIds = isReroll ? state.seenIds : [];

  try {
    const prepared = await prepareSearch({
      lat: state.location.lat,
      lon: state.location.lon,
      radiusKm: state.radiusKm,
      category: state.category,
      parkingRequired: state.parkingRequired,
      excludeIds,
    });

    // 「交差点」カテゴリはプローブ（100m）→不足時のみ拡張（1km）の最大2段階になる。
    // need_fetchが返る限りfetch→processを繰り返すループにすることで、既存カテゴリ
    // （1段階で終わる）と交差点カテゴリの両方に対応する
    // （docs/plans/260830-060923-phase4b交差点検出実装.md）。
    let result = prepared;
    while (result.status === "need_fetch") {
      const overpassResponse = await fetchOverpassDirect(result.endpoint, result.query);
      result = await processSearch({
        cacheKey: result.cacheKey,
        category: state.category,
        parkingRequired: state.parkingRequired,
        intersectionStage: result.intersectionStage,
        anchor: result.anchor,
        excludeIds,
        overpassResponse,
        lat: state.location.lat,
        lon: state.location.lon,
        radiusKm: state.radiusKm,
      });
    }

    const seenIds = isReroll ? [...state.seenIds] : [];
    if (result.picked) seenIds.push(result.picked.id);

    store.setState({
      searching: false,
      picked: result.picked,
      candidates: result.candidates,
      seenIds,
    });
  } catch (err) {
    console.error("performSearch error:", err);
    store.setState({
      searching: false,
      searchError: {
        status: err.status,
        retryAfter: err.retryAfter,
        message:
          err.status === 503
            ? "混み合っています。しばらくしてからお試しください。"
            : "検索に失敗しました。もう一度お試しください。",
      },
    });
  }
}
