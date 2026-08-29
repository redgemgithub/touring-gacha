export function attachLongPress(el, { onLongPress, thresholdMs = 1000, moveTolerancePx = 10 } = {}) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let firedLongPress = false;

  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    firedLongPress = false;
    clear();
    timer = setTimeout(() => {
      firedLongPress = true;
      onLongPress(e);
    }, thresholdMs);
  }

  function onPointerMove(e) {
    if (!timer) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > moveTolerancePx) clear();
  }

  function onPointerUpOrCancel() {
    clear();
  }

  function onClickCapture(e) {
    if (firedLongPress) {
      e.preventDefault();
      e.stopImmediatePropagation();
      firedLongPress = false;
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUpOrCancel);
  el.addEventListener("pointercancel", onPointerUpOrCancel);
  el.addEventListener("click", onClickCapture, true);
  el.addEventListener("contextmenu", onContextMenu);
}
