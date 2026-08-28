import { getCurrentLocation } from "../geo.js";
import { performSearch } from "../search.js";

const RADIUS_STEPS = [10, 30, 50, 100];

export function initConditionView(store) {
  const statusEl = document.getElementById("location-status");
  const coordsEl = document.getElementById("location-coords");
  const searchButton = document.getElementById("search-button");
  const errorEl = document.getElementById("condition-error");
  const radiusChips = document.getElementById("radius-chips");
  const radiusSlider = document.getElementById("radius-slider");
  const categoryChips = document.getElementById("category-chips");

  function updateRadiusUI(radiusKm) {
    for (const chip of radiusChips.children) {
      chip.classList.toggle("active", Number(chip.dataset.radius) === radiusKm);
    }
    radiusSlider.value = String(RADIUS_STEPS.indexOf(radiusKm));
  }

  function updateCategoryUI(category) {
    for (const chip of categoryChips.children) {
      chip.classList.toggle("active", chip.dataset.category === category);
    }
  }

  radiusChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const radiusKm = Number(chip.dataset.radius);
    store.setState({ radiusKm });
    updateRadiusUI(radiusKm);
  });

  radiusSlider.addEventListener("input", () => {
    const radiusKm = RADIUS_STEPS[Number(radiusSlider.value)];
    store.setState({ radiusKm });
    updateRadiusUI(radiusKm);
  });

  categoryChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-card");
    if (!chip) return;
    const category = chip.dataset.category;
    store.setState({ category });
    updateCategoryUI(category);
  });

  searchButton.addEventListener("click", () => {
    performSearch(store, { isReroll: false });
  });

  getCurrentLocation()
    .then((location) => {
      store.setState({ location });
      statusEl.textContent = "取得済み";
      coordsEl.textContent = `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`;
      searchButton.disabled = false;
    })
    .catch(() => {
      statusEl.textContent = "取得できませんでした";
      errorEl.hidden = false;
      errorEl.textContent =
        "現在地を取得できませんでした。ブラウザの位置情報許可を確認してください。";
    });

  const initialState = store.getState();
  updateRadiusUI(initialState.radiusKm);
  updateCategoryUI(initialState.category);
}
