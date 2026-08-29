import { getCopyPreference, setCopyPreference } from "../copy-preference.js";

export function initCopyModal() {
  const modal = document.getElementById("copy-modal");
  const closeButton = document.getElementById("copy-close-button");
  const openButton = document.getElementById("copy-settings-open-button");
  const checkboxes = {
    latlon: document.getElementById("copy-pref-latlon"),
    name: document.getElementById("copy-pref-name"),
    address: document.getElementById("copy-pref-address"),
  };

  function applyPreferenceToCheckboxes(preference) {
    checkboxes.latlon.checked = preference.latlon;
    checkboxes.name.checked = preference.name;
    checkboxes.address.checked = preference.address;
  }

  function handleCheckboxChange() {
    const preference = {
      latlon: checkboxes.latlon.checked,
      name: checkboxes.name.checked,
      address: checkboxes.address.checked,
    };
    // 空コピーを防ぐため、全解除は許容しない
    if (!preference.latlon && !preference.name && !preference.address) {
      applyPreferenceToCheckboxes(getCopyPreference());
      return;
    }
    setCopyPreference(preference);
  }

  Object.values(checkboxes).forEach((checkbox) => {
    checkbox.addEventListener("change", handleCheckboxChange);
  });

  openButton.addEventListener("click", () => {
    applyPreferenceToCheckboxes(getCopyPreference());
    modal.hidden = false;
  });

  closeButton.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });
}
