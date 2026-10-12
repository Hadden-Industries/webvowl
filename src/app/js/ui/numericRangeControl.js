/** Bind native input mechanics; the caller owns commands and authoritative state. */
export function bindNumericRangeControl(
  input,
  valueLabel,
  initialValue,
  requestValue,
) {
  input.setAttribute("value", initialValue);
  input.value = String(initialValue);
  valueLabel.textContent = input.value;

  function handleInput() {
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 1) {
      return;
    }
    valueLabel.textContent = input.value;
    requestValue(value);
  }
  function handleWheel(event) {
    if (
      input.disabled ||
      !Number.isFinite(event.deltaY) ||
      event.deltaY === 0
    ) {
      return;
    }
    const previousValue = input.value;
    if (event.deltaY < 0) {
      input.stepUp();
    } else {
      input.stepDown();
    }
    if (input.value !== previousValue) {
      handleInput();
    }
    event.preventDefault();
  }
  input.addEventListener("input", handleInput);
  input.addEventListener("wheel", handleWheel, { passive: false });
  return () => {
    input.removeEventListener("input", handleInput);
    input.removeEventListener("wheel", handleWheel);
  };
}
