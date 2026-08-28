let currentCandidate = null;

export function initCopyModal() {
  const modal = document.getElementById("copy-modal");
  const closeButton = document.getElementById("copy-close-button");
  const latlonEl = document.getElementById("copy-latlon");
  const nameEl = document.getElementById("copy-name");
  const addressRow = document.getElementById("copy-address-row");
  const addressEl = document.getElementById("copy-address");
  const allButton = document.getElementById("copy-all-button");

  closeButton.addEventListener("click", () => {
    modal.hidden = true;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });

  modal.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.copyTarget;
      const text = { latlon: latlonEl, name: nameEl, address: addressEl }[target]?.textContent ?? "";
      copyText(text);
    });
  });

  allButton.addEventListener("click", () => {
    if (!currentCandidate) return;
    const lines = [`緯度経度: ${latlonEl.textContent}`, `名称: ${nameEl.textContent}`];
    if (currentCandidate.address) lines.push(`住所: ${currentCandidate.address}`);
    copyText(lines.join("\n"));
  });

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }
}

export function openCopyModal(candidate) {
  currentCandidate = candidate;
  const modal = document.getElementById("copy-modal");
  document.getElementById("copy-latlon").textContent = `${candidate.lat.toFixed(6)}, ${candidate.lon.toFixed(6)}`;
  document.getElementById("copy-name").textContent = candidate.name ?? "(名称不明)";

  const addressRow = document.getElementById("copy-address-row");
  if (candidate.address) {
    addressRow.hidden = false;
    document.getElementById("copy-address").textContent = candidate.address;
  } else {
    addressRow.hidden = true;
  }

  modal.hidden = false;
}
