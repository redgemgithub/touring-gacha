const STORAGE_KEY = "touring-gacha:copy-preference";
const DEFAULT_PREFERENCE = { latlon: true, name: true, address: true };

export function getCopyPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCE, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCE };
  }
}

export function setCopyPreference(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // localStorageが使えない環境でも致命的にしない
  }
}

export function formatCopyText(item, preference = getCopyPreference()) {
  const lines = [];
  if (preference.latlon) lines.push(`${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}`);
  if (preference.name && item.name) lines.push(item.name);
  if (preference.address && item.address) lines.push(item.address);
  return lines.join("\n");
}
