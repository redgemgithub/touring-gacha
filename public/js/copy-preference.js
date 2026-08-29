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
  // 選択した項目がその候補にたまたま存在しない場合（例: 名称のみ選択なのに名称不明）、
  // コピー結果が空になるとナビアプリに渡せず無意味になる。緯度経度は必ず存在するため
  // 最終フォールバックとして使う（docs/decisions/260829-copy-preference.md 追記）。
  if (lines.length === 0) {
    lines.push(`${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}`);
  }
  return lines.join("\n");
}
