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
    if (input.disabled || !Number.isFinite(value) || value < 1) {
      return;
    }
    valueLabel.textContent = input.value;
    requestValue(value);
  }
  function handleChange() {
    // Some input/AT paths commit with change alone. The presented value also
    // tracks external state, so deduplicate against it rather than a stale cache.
    if (Number(input.value) !== Number(valueLabel.textContent)) {
      handleInput();
    }
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
  input.addEventListener("change", handleChange);
  input.addEventListener("wheel", handleWheel, { passive: false });
  return () => {
    input.removeEventListener("input", handleInput);
    input.removeEventListener("change", handleChange);
    input.removeEventListener("wheel", handleWheel);
  };
}
