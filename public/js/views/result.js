import { haversineDistanceKm, bearingLabel, computeDistanceBand } from "../geo.js";
import { performSearch } from "../search.js";
import {
  initMap,
  setUserLocation,
  showCandidate,
  recenter,
  showNearbyPois,
  focusPoi,
  clearNearbyPoiMarkers,
  clearFocusRing,
} from "../components/map.js";
import { loadNearbyPois } from "../nearby.js";
import { formatCopyText } from "../copy-preference.js";
import { showToast } from "../toast.js";
import { attachLongPress } from "../long-press.js";

async function copyItem(item, { forceLatLon = false } = {}) {
  const text = forceLatLon ? `${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}` : formatCopyText(item);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(forceLatLon ? "緯度経度をコピーしました" : "コピーしました");
    } catch {
      // クリップボードへのアクセスが拒否された場合等は何もしない
    }
  }
}

let mapInitialized = false;
let lastFocusTarget = null;
let lastMarkersKey = null;

const POI_ICONS = {
  parking: "🅿️",
  shrine_temple: "⛩️",
  vending_machine: "🥤",
  fuel: "⛽",
  toilets: "🚻",
  food_rest: "🍴",
  shop: "🛒",
  other: "📍",
};

function formatPoiSubtitle(poi) {
  const dist =
    poi.distanceM < 1000 ? `目的地から ${poi.distanceM}m` : `目的地から ${(poi.distanceM / 1000).toFixed(1)}km`;
  return poi.kind === "parking" ? `停車可 ・ ${dist}` : dist;
}

function buildNearbyItemElement({ name, subtitle, icon, active, extraClass }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = ["nearby-item", active ? "active" : "", extraClass ?? ""].filter(Boolean).join(" ");
  const iconEl = document.createElement("span");
  iconEl.className = "nearby-item-icon";
  iconEl.textContent = icon;
  const textEl = document.createElement("span");
  textEl.className = "nearby-item-text";
  const nameEl = document.createElement("p");
  nameEl.className = "nearby-item-name";
  nameEl.textContent = name;
  textEl.appendChild(nameEl);
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  for (const line of subtitleLines) {
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "nearby-item-subtitle";
    subtitleEl.textContent = line;
    textEl.appendChild(subtitleEl);
  }
  const chevronEl = document.createElement("span");
  chevronEl.className = "nearby-item-chevron";
  chevronEl.textContent = "›";
  btn.append(iconEl, textEl, chevronEl);
  return btn;
}

export function initResultView(store) {
  const radiusLabel = document.getElementById("radius-label");
  const statusEl = document.getElementById("result-status");
  const sheetEl = document.getElementById("result-sheet");
  const sheetCollapsedEl = document.getElementById("sheet-collapsed");
  const sheetExpandedEl = document.getElementById("sheet-expanded");
  const nameEl = document.getElementById("candidate-name");
  const coordsEl = document.getElementById("candidate-coords");
  const distanceEl = document.getElementById("candidate-distance");
  const candidateInfoButton = document.getElementById("candidate-info-button");
  const backButton = document.getElementById("back-button");
  const recenterButton = document.getElementById("recenter-button");
  const rerollButton = document.getElementById("reroll-button");
  const nearbyExpandToggle = document.getElementById("nearby-expand-toggle");
  const nearbyCollapseButton = document.getElementById("nearby-collapse-button");
  const nearbyDestinationItemEl = document.getElementById("nearby-destination-item");
  const nearbyCountLabelEl = document.getElementById("nearby-count-label");
  const nearbyStatusEl = document.getElementById("nearby-status");
  const nearbyPoiListEl = document.getElementById("nearby-poi-list");

  backButton.addEventListener("click", () => {
    store.setState({ view: "condition" });
  });

  recenterButton.addEventListener("click", () => {
    const { location } = store.getState();
    if (location) recenter(location.lat, location.lon);
  });

  rerollButton.addEventListener("click", () => {
    performSearch(store, { isReroll: true });
  });

  candidateInfoButton.addEventListener("click", () => {
    const { picked } = store.getState();
    if (picked) copyItem(picked);
  });

  attachLongPress(candidateInfoButton, {
    onLongPress: () => {
      const { picked } = store.getState();
      if (picked) copyItem(picked, { forceLatLon: true });
    },
  });

  nearbyExpandToggle.addEventListener("click", () => {
    store.setState({ sheetExpanded: true });
    loadNearbyPois(store);
  });

  nearbyCollapseButton.addEventListener("click", () => {
    store.setState({ sheetExpanded: false });
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

  function applyMapFocus(state) {
    if (!state.picked || !state.location) return;
    const target =
      state.sheetExpanded && state.focusedPoiId ? `poi:${state.focusedPoiId}` : `dest:${state.picked.id}`;
    if (target === lastFocusTarget) return;
    lastFocusTarget = target;
    if (target.startsWith("dest:")) {
      clearFocusRing();
      showCandidate(state.location.lat, state.location.lon, state.picked.lat, state.picked.lon);
    } else {
      const poi = state.nearbyPois.find((p) => p.id === state.focusedPoiId);
      if (poi) focusPoi(poi.lat, poi.lon);
    }
  }

  function applyNearbyMarkers(state) {
    const key = state.sheetExpanded && state.nearbyFetchedForId ? state.nearbyFetchedForId : null;
    if (key === lastMarkersKey) return;
    lastMarkersKey = key;
    if (key) {
      showNearbyPois(state.nearbyPois);
    } else {
      clearNearbyPoiMarkers();
    }
  }

  function renderNearbySection(state) {
    const { picked, location } = state;
    nearbyDestinationItemEl.innerHTML = "";
    const coordsText = `${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)}`;
    const subtitle = [coordsText];
    if (location) {
      const distanceKm = haversineDistanceKm(location.lat, location.lon, picked.lat, picked.lon);
      const direction = bearingLabel(location.lat, location.lon, picked.lat, picked.lon);
      subtitle.push(`現在地から ${distanceKm.toFixed(1)}km ${direction}`);
    }
    const destBtn = buildNearbyItemElement({
      name: (picked.name ?? "(名称不明)") + "（目的地）",
      subtitle,
      icon: "📍",
      active: false,
      extraClass: "nearby-item-destination",
    });
    destBtn.addEventListener("click", () => {
      if (store.getState().focusedPoiId === null) {
        copyItem(picked);
      } else {
        store.setState({ focusedPoiId: null });
      }
    });
    attachLongPress(destBtn, { onLongPress: () => copyItem(picked, { forceLatLon: true }) });
    nearbyDestinationItemEl.appendChild(destBtn);

    if (state.nearbyLoading) {
      nearbyStatusEl.hidden = false;
      nearbyStatusEl.textContent = "読み込み中…";
      nearbyCountLabelEl.textContent = "";
      nearbyPoiListEl.innerHTML = "";
      return;
    }
    if (state.nearbyError) {
      nearbyStatusEl.hidden = false;
      nearbyStatusEl.textContent = state.nearbyError.message;
      nearbyCountLabelEl.textContent = "";
      nearbyPoiListEl.innerHTML = "";
      return;
    }

    nearbyStatusEl.hidden = true;
    nearbyCountLabelEl.textContent =
      state.nearbyPois.length > 0 ? `近くのスポット（${state.nearbyPois.length}件）` : "近くのスポットは見つかりませんでした";
    nearbyPoiListEl.innerHTML = "";
    for (const poi of state.nearbyPois) {
      const item = buildNearbyItemElement({
        name: poi.name ?? "(名称不明)",
        subtitle: formatPoiSubtitle(poi),
        icon: POI_ICONS[poi.kind] ?? POI_ICONS.other,
        active: poi.id === state.focusedPoiId,
      });
      item.addEventListener("click", () => {
        if (store.getState().focusedPoiId === poi.id) {
          copyItem(poi);
        } else {
          store.setState({ focusedPoiId: poi.id });
        }
      });
      attachLongPress(item, { onLongPress: () => copyItem(poi, { forceLatLon: true }) });
      nearbyPoiListEl.appendChild(item);
    }
  }

  function render(state) {
    if (state.view !== "result") return;

    const band = computeDistanceBand(state.radiusKm);
    radiusLabel.textContent = `探索範囲 ${band.innerKm.toFixed(0)}〜${band.outerKm.toFixed(0)}km`;
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
    sheetEl.classList.toggle("expanded", state.sheetExpanded);
    sheetCollapsedEl.hidden = state.sheetExpanded;
    sheetExpandedEl.hidden = !state.sheetExpanded;

    const { picked, location } = state;
    nameEl.textContent = picked.name ?? "(名称不明)";
    coordsEl.textContent = `${picked.lat.toFixed(6)}, ${picked.lon.toFixed(6)}`;

    if (location) {
      const distanceKm = haversineDistanceKm(location.lat, location.lon, picked.lat, picked.lon);
      const direction = bearingLabel(location.lat, location.lon, picked.lat, picked.lon);
      distanceEl.textContent = `現在地から ${distanceKm.toFixed(1)}km ${direction}`;
    }

    if (state.sheetExpanded) {
      renderNearbySection(state);
    }

    applyNearbyMarkers(state);
    applyMapFocus(state);
  }
}
