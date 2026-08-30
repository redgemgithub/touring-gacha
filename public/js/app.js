import { createStore } from "./state.js";
import { getConfig } from "./api.js";
import { initConditionView } from "./views/condition.js";
import { initResultView } from "./views/result.js";
import { initCopyModal } from "./views/copy-modal.js";

const store = createStore({
  view: "condition",
  location: null,
  radiusKm: 50,
  destinationType: "shop",
  category: "food_rest",
  lastShopCategory: "food_rest",
  parkingRequired: false,
  mapTilerApiKey: null,
  mapTilerApiKeyError: false,
  searching: false,
  searchError: null,
  picked: null,
  candidates: [],
  seenIds: [],
  sheetExpanded: false,
  nearbyPois: [],
  nearbyLoading: false,
  nearbyError: null,
  nearbyFetchedForId: null,
  focusedPoiId: null,
});

function renderViewVisibility(state) {
  document.getElementById("view-condition").hidden = state.view !== "condition";
  document.getElementById("view-result").hidden = state.view !== "result";
}

store.subscribe(renderViewVisibility);
renderViewVisibility(store.getState());

initConditionView(store);
initResultView(store);
initCopyModal();

getConfig()
  .then((config) => store.setState({ mapTilerApiKey: config.mapTilerApiKey }))
  .catch(() => {
    // 地図タイルキーが取得できなくても条件設定画面自体は使えるようにする。
    // 結果画面に進んだ際、地図が無言で空白のままにならないよう理由を表示する
    store.setState({ mapTilerApiKeyError: true });
  });
