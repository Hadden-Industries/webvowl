/** Observe pointer motion without intercepting pan, drag, pinch or native click. */
export function createBackgroundSelectionGesture({
  isBackground,
  clear,
  mouseThresholdPx = 0,
  touchThresholdPx = 10,
}) {
  const pointers = new Set();
  let candidate;
  return {
    down(event) {
      pointers.add(event.pointerId);
      if (
        pointers.size !== 1 ||
        event.button !== 0 ||
        !isBackground(event.target)
      ) {
        candidate = undefined;
        return;
      }
      candidate = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        threshold:
          event.pointerType === "touch" ? touchThresholdPx : mouseThresholdPx,
        moved: false,
        ended: false,
      };
    },
    move(event) {
      if (
        candidate?.id === event.pointerId &&
        Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) >
          candidate.threshold
      ) {
        candidate.moved = true;
      }
    },
    up(event) {
      pointers.delete(event.pointerId);
      if (candidate?.id === event.pointerId) {
        candidate.ended = true;
      }
    },
    cancel(event) {
      pointers.delete(event.pointerId);
      candidate = undefined;
    },
    click(event) {
      if (
        candidate?.ended &&
        !candidate.moved &&
        !pointers.size &&
        !event.defaultPrevented &&
        isBackground(event.target)
      ) {
        clear();
      }
      candidate = undefined;
    },
  };
}
