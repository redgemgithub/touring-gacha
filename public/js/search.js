import { searchDestinations } from "./api.js";

export async function performSearch(store, { isReroll = false } = {}) {
  const state = store.getState();
  if (!state.location) return;

  store.setState({
    searching: true,
    searchError: null,
    view: "result",
    decided: false,
  });

  try {
    const result = await searchDestinations({
      lat: state.location.lat,
      lon: state.location.lon,
      radiusKm: state.radiusKm,
      category: state.category,
      excludeIds: isReroll ? state.seenIds : [],
    });

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
