let hideTimeoutId = null;

export function showToast(message, durationMs = 1500) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(hideTimeoutId);
  hideTimeoutId = setTimeout(() => {
    el.hidden = true;
  }, durationMs);
}
