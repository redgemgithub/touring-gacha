import { haversineDistanceKm, bearingLabel } from "../geo.js";
import { performSearch } from "../search.js";
import { initMap, setUserLocation, showCandidate, recenter } from "../components/map.js";
import { openCopyModal } from "./copy-modal.js";

let mapInitialized = false;

export function initResultView(store) {
  const radiusLabel = document.getElementById("radius-label");
  const statusEl = document.getElementById("result-status");
  const sheetEl = document.getElementById("result-sheet");
  const nameEl = document.getElementById("candidate-name");
  const coordsEl = document.getElementById("candidate-coords");
  const distanceEl = document.getElementById("candidate-distance");
  const decideButton = document.getElementById("decide-button");
  const backButton = document.getElementById("back-button");
  const recenterButton = document.getElementById("recenter-button");
  const rerollButton = document.getElementById("reroll-button");
  const copyOpenButton = document.getElementById("copy-open-button");

  backButton.addEventListener("click", () => {
    store.setState({ view: "condition" });
  });

  recenterButton.addEventListener("click", () => {
    const { location } = store.getState();
    if (location) recenter(location.lat, location.lon);
  });

  decideButton.addEventListener("click", () => {
    store.setState({ decided: true });
  });

  rerollButton.addEventListener("click", () => {
    performSearch(store, { isReroll: true });
  });

  copyOpenButton.addEventListener("click", () => {
    const { picked } = store.getState();
    if (picked) openCopyModal(picked);
  });

  store.subscribe((state) => render(state));
  render(store.getState());

  function ensureMap(state) {
    if (mapInitialized || !state.mapTilerApiKey || !state.location) return;
    mapInitialized = true;
    const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${state.mapTilerApiKey}`;
    initMap("map", styleUrl, state.location);
    setUserLocation(state.location.lat, state.location.lon);
  }

  function render(state) {
    if (state.view !== "result") return;

    radiusLabel.textContent = `探索範囲 ${state.radiusKm}km 圏内`;
    ensureMap(state);

    if (state.searching) {
      statusEl.hidden = false;
      statusEl.textContent = "検索中…";
      sheetEl.hidden = true;
      return;
    }

    if (state.searchError) {
      statusEl.hidden = false;
      statusEl.textContent = state.searchError.message;
      sheetEl.hidden = true;
      return;
    }

    if (!state.picked) {
      statusEl.hidden = false;
      statusEl.textContent = "条件に合う目的地が見つかりませんでした。条件を変えてお試しください。";
      sheetEl.hidden = true;
      return;
    }

    statusEl.hidden = true;
    sheetEl.hidden = false;

    const { picked, location } = state;
    nameEl.textContent = picked.name ?? "(名称不明)";
    coordsEl.textContent = `${picked.lat.toFixed(6)}, ${picked.lon.toFixed(6)}`;

    if (location) {
      const distanceKm = haversineDistanceKm(location.lat, location.lon, picked.lat, picked.lon);
      const direction = bearingLabel(location.lat, location.lon, picked.lat, picked.lon);
      distanceEl.textContent = `現在地から ${distanceKm.toFixed(1)}km ${direction}`;
      showCandidate(location.lat, location.lon, picked.lat, picked.lon);
    }

    decideButton.textContent = state.decided ? "✓ 決定済み" : "✓ この場所に決める";
  }
}
