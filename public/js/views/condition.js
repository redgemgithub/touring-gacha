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
  const destinationTypeChips = document.getElementById("destination-type-chips");
  const shopCategoryField = document.getElementById("shop-category-field");
  const categoryChips = document.getElementById("category-chips");
  const parkingField = document.getElementById("parking-field");
  const parkingChips = document.getElementById("parking-chips");

  function updateRadiusUI(radiusKm) {
    for (const chip of radiusChips.children) {
      chip.classList.toggle("active", Number(chip.dataset.radius) === radiusKm);
    }
    radiusSlider.value = String(RADIUS_STEPS.indexOf(radiusKm));
  }

  function updateDestinationTypeUI(destinationType) {
    for (const chip of destinationTypeChips.children) {
      chip.classList.toggle("active", chip.dataset.destinationType === destinationType);
    }
    shopCategoryField.hidden = destinationType !== "shop";
    parkingField.hidden = destinationType !== "other";
  }

  function updateCategoryUI(category) {
    for (const chip of categoryChips.children) {
      chip.classList.toggle("active", chip.dataset.category === category);
    }
  }

  function updateParkingUI(parkingRequired) {
    for (const chip of parkingChips.children) {
      chip.classList.toggle(
        "active",
        (chip.dataset.parking === "required") === parkingRequired,
      );
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

  destinationTypeChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-card");
    if (!chip) return;
    const destinationType = chip.dataset.destinationType;
    const category =
      destinationType === "shop" ? store.getState().lastShopCategory : destinationType;
    store.setState({ destinationType, category });
    updateDestinationTypeUI(destinationType);
    updateCategoryUI(category);
  });

  categoryChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-card");
    if (!chip) return;
    const category = chip.dataset.category;
    store.setState({ category, lastShopCategory: category });
    updateCategoryUI(category);
  });

  parkingChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip-card");
    if (!chip) return;
    const parkingRequired = chip.dataset.parking === "required";
    store.setState({ parkingRequired });
    updateParkingUI(parkingRequired);
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
  updateDestinationTypeUI(initialState.destinationType);
  updateCategoryUI(initialState.category);
  updateParkingUI(initialState.parkingRequired);
}
