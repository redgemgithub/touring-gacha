import { prepareNearby, processNearby, fetchOverpassDirect } from "./api.js";

export async function loadNearbyPois(store) {
  const state = store.getState();
  const picked = state.picked;
  if (!picked) return;
  if (state.nearbyFetchedForId === picked.id && !state.nearbyError) return;

  store.setState({ nearbyLoading: true, nearbyError: null });

  const parkingWideSearch = picked.category === "other" && state.parkingRequired === true;

  try {
    const prepared = await prepareNearby({
      lat: picked.lat,
      lon: picked.lon,
      excludeId: picked.id,
      parkingWideSearch,
    });

    const result =
      prepared.status === "done"
        ? prepared
        : await processNearby({
            cacheKey: prepared.cacheKey,
            lat: picked.lat,
            lon: picked.lon,
            excludeId: picked.id,
            overpassResponse: await fetchOverpassDirect(prepared.endpoint, prepared.query),
          });

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
      nearbyError: { message: "周辺情報を取得できませんでした。" },
    });
  }
}
