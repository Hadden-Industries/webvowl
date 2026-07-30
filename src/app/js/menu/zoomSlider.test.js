const { describe, test, expect, beforeEach } = require("@jest/globals");
const d3 = require("d3");
const zoomSliderFactory = require("./zoomSlider");

describe("zoomSlider real DOM element event listeners", () => {
  beforeEach(() => {
    // Set up DOM elements expected by zoomSlider.setup()
    document.body.innerHTML = `
      <div id="zoomSliderParagraph"></div>
      <button id="zoomInButton"></button>
      <button id="zoomOutButton"></button>
      <button id="centerGraphButton"></button>
    `;
    global.d3 = d3;
    global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  test("dispatches touchstart and contextmenu on #zoomInButton and #zoomOutButton to verify preventDefault is executed", () => {
    const mockGraph = {
      options: () => ({
        minMagnification: () => 0.1,
        maxMagnification: () => 4.0,
        width: () => 800,
        height: () => 600,
        navigationMenu: () => ({ hideAllMenus: () => {} })
      }),
      scaleFactor: () => 1.0,
      setSliderZoom: () => {}
    };

    const zoomSlider = zoomSliderFactory(mockGraph);
    zoomSlider.setup();

    const zoomInBtn = document.getElementById("zoomInButton");
    const zoomOutBtn = document.getElementById("zoomOutButton");

    // Test #zoomInButton touchstart
    const touchEventIn = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    zoomInBtn.dispatchEvent(touchEventIn);
    expect(touchEventIn.defaultPrevented).toBe(true);

    // Test #zoomInButton contextmenu
    const contextEventIn = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    zoomInBtn.dispatchEvent(contextEventIn);
    expect(contextEventIn.defaultPrevented).toBe(true);

    // Test #zoomOutButton touchstart
    const touchEventOut = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    zoomOutBtn.dispatchEvent(touchEventOut);
    expect(touchEventOut.defaultPrevented).toBe(true);

    // Test #zoomOutButton contextmenu
    const contextEventOut = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    zoomOutBtn.dispatchEvent(contextEventOut);
    expect(contextEventOut.defaultPrevented).toBe(true);

    // Test #centerGraphButton contextmenu
    const centerBtn = document.getElementById("centerGraphButton");
    const contextEventCenter = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    centerBtn.dispatchEvent(contextEventCenter);
    expect(contextEventCenter.defaultPrevented).toBe(true);
  });
});
