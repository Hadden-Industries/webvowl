const { describe, test, expect, beforeEach } = require("@jest/globals");
const d3 = require("d3");
const navigationMenuFactory = require("./navigationMenu");

describe("navigationMenu and adjacent button event listeners", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="menuContainer">
        <ul id="menuElementContainer">
          <li><button class="navButton" id="locateSearchResult"></button></li>
          <li><button class="navButton" id="reset-button"></button></li>
        </ul>
      </div>
      <button id="scrollLeftButton"></button>
      <button id="scrollRightButton"></button>
    `;
    global.d3 = d3;
    global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  test("suppresses contextmenu on scroll buttons and navButtons", () => {
    const mockGraph = {
      options: () => ({
        navigationMenu: () => ({ hideAllMenus: () => {} })
      }),
      scaleFactor: () => 1.0
    };

    const navMenu = navigationMenuFactory(mockGraph);
    navMenu.setup();

    const scrollRightBtn = document.getElementById("scrollRightButton");
    const scrollLeftBtn = document.getElementById("scrollLeftButton");
    const navBtn = document.getElementById("locateSearchResult");

    const touchEventRight = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    scrollRightBtn.dispatchEvent(touchEventRight);
    expect(touchEventRight.defaultPrevented).toBe(true);

    const contextEventRight = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    scrollRightBtn.dispatchEvent(contextEventRight);
    expect(contextEventRight.defaultPrevented).toBe(true);

    const touchEventLeft = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    scrollLeftBtn.dispatchEvent(touchEventLeft);
    expect(touchEventLeft.defaultPrevented).toBe(true);

    const contextEventLeft = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    scrollLeftBtn.dispatchEvent(contextEventLeft);
    expect(contextEventLeft.defaultPrevented).toBe(true);

    const contextEventNav = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    navBtn.dispatchEvent(contextEventNav);
    expect(contextEventNav.defaultPrevented).toBe(true);
  });
});
