import { prepareSearch, fetchOverpassDirect, processSearch } from "./api.js";

export async function performSearch(store, { isReroll = false } = {}) {
  const state = store.getState();
  if (!state.location) return;

  store.setState({
    searching: true,
    searchError: null,
    view: "result",
    decided: false,
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

    let result;
    if (prepared.status === "done") {
      result = prepared;
    } else {
      const overpassResponse = await fetchOverpassDirect(prepared.endpoint, prepared.query);
      result = await processSearch({
        cacheKey: prepared.cacheKey,
        category: state.category,
        parkingRequired: state.parkingRequired,
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
