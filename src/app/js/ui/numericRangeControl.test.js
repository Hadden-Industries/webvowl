import { jest } from "@jest/globals";
import { bindNumericRangeControl } from "./numericRangeControl.js";

function fixture() {
  const input = Object.assign(new EventTarget(), {
    value: "",
    disabled: false,
    setAttribute: jest.fn(),
    // Explicit resulting values, not a second implementation of browser stepping.
    stepUp: jest.fn(function () {
      this.value = "210";
    }),
    stepDown: jest.fn(function () {
      this.value = "190";
    }),
  });
  const label = { textContent: "" };
  const request = jest.fn();
  const dispose = bindNumericRangeControl(input, label, 200, request);
  return { input, label, request, dispose };
}
function wheel(input, deltaY) {
  const event = new Event("wheel", { cancelable: true });
  Object.defineProperty(event, "deltaY", { value: deltaY });
  input.dispatchEvent(event);
  return event;
}
test.each([
  [-1, "stepUp", 210],
  [1, "stepDown", 190],
])("uses one native step for delta %s", (delta, method, expected) => {
  const { input, label, request } = fixture();
  expect(wheel(input, delta).defaultPrevented).toBe(true);
  expect(input[method]).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(expected);
  expect(label.textContent).toBe(String(expected));
});
test.each([0, NaN, Infinity, -Infinity])(
  "ignores vertical delta %s",
  (delta) => {
    const { input, request } = fixture();
    expect(wheel(input, delta).defaultPrevented).toBe(false);
    expect(input.stepUp).not.toHaveBeenCalled();
    expect(input.stepDown).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  },
);
test("disabled controls leave wheel scrolling available", () => {
  const { input, request } = fixture();
  input.disabled = true;
  expect(wheel(input, -1).defaultPrevented).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(input.stepUp).not.toHaveBeenCalled();
});
test("captures enabled wheel at a bound without a redundant request", () => {
  const { input, request } = fixture();
  input.stepUp.mockImplementation(() => {});
  expect(wheel(input, -1).defaultPrevented).toBe(true);
  expect(request).not.toHaveBeenCalled();
});
test("state presentation emits no request and disposal removes both listeners", () => {
  const { input, label, request, dispose } = fixture();
  expect(label.textContent).toBe("200");
  expect(request).not.toHaveBeenCalled();
  input.value = "400";
  label.textContent = "400";
  expect(request).not.toHaveBeenCalled();
  dispose();
  dispose();
  input.dispatchEvent(new Event("input"));
  expect(wheel(input, -1).defaultPrevented).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(input.stepUp).not.toHaveBeenCalled();
});
