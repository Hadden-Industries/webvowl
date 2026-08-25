import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import * as d3 from "d3";
import navigationMenuFactory from "./navigationMenu.js";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

class MockElement {
  constructor(id, className, tagName = "div") {
    this.id = id || "";
    this._classList = new Set(
      className ? className.split(/\s+/).filter(Boolean) : [],
    );
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.listeners = {};
    const self = this;
    this.style = {
      _props: {},
      setProperty: (k, v) => {
        self.style._props[k] = v;
        self.style[k] = v;
      },
      removeProperty: (k) => {
        delete self.style._props[k];
        delete self.style[k];
      },
      getPropertyValue: (k) => self.style._props[k] || "",
    };
    this.ownerDocument = global.document;
    this.nodeType = 1;
    this.attributes = {};
    this.children = [];
    this.scrollLeft = 0;
    this.namespaceURI = HTML_NAMESPACE;
    this.popoverState = "closed";
  }

  get className() {
    return Array.from(this._classList).join(" ");
  }

  set className(val) {
    this._classList = new Set(val ? val.split(/\s+/).filter(Boolean) : []);
  }

  get classList() {
    const self = this;
    return {
      add: (...names) => {
        names.forEach((n) => self._classList.add(n));
      },
      remove: (...names) => {
        names.forEach((n) => self._classList.delete(n));
      },
      contains: (name) => self._classList.has(name),
      toggle: (name, force) => {
        if (force === undefined) {
          if (self._classList.has(name)) {
            self._classList.delete(name);
          } else {
            self._classList.add(name);
          }
        } else if (force) {
          self._classList.add(name);
        } else {
          self._classList.delete(name);
        }
      },
    };
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== fn);
    }
  }

  dispatchEvent(evt) {
    if (!evt.target) {
      evt.target = this;
    }
    const handlers = (this.listeners[evt.type] || []).slice();
    for (const h of handlers) {
      h.call(this, evt, this.__data__);
    }
    return !evt.defaultPrevented;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
    if (name === "class") {
      this.className = val;
    }
  }

  getAttribute(name) {
    if (name === "class") {
      return this.className;
    }
    return this.attributes[name] || "";
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
    };
  }

  matches(selector) {
    if (selector === ":popover-open") {
      return this.popoverState === "open";
    }
    if (selector.startsWith(".")) {
      return this._classList.has(selector.slice(1));
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    return false;
  }

  showPopover() {
    this.popoverState = "open";
  }

  hidePopover() {
    this.popoverState = "closed";
  }

  focus(options) {
    this.focusOptions = options;
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  contains(node) {
    if (node === this) {
      return true;
    }
    return this.children.some((child) => child.contains(node));
  }

  querySelectorAll(selector) {
    if (
      selector.includes(".sheet-handle") ||
      selector.includes(".popover-header")
    ) {
      if (!this.children || this.children.length === 0) {
        const handle = new MockElement("", "sheet-handle");
        const header = new MockElement("", "popover-header");
        handle.parentNode = this;
        header.parentNode = this;
        this.children = [handle, header];
      }
      return this.children;
    }
    return [];
  }
}

class MockCustomEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.cancelable = opts.cancelable !== undefined ? opts.cancelable : true;
    this.bubbles = opts.bubbles || false;
    this.defaultPrevented = false;
    this.newState = opts.newState || "";
    this.touches = opts.touches || [];
    this.target = opts.target || null;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

/**
 * These lightweight DOM doubles test WebVOWL's side of the Popover API
 * contract; Jest cannot reproduce WebKit's native focus-controller loop. The
 * regression signal is therefore structural and behavioral: standalone touch
 * setup must remove the declarative trigger, call `showPopover` with no source,
 * maintain the accessibility state that the trigger previously supplied, and
 * restore focus without overriding a subsequent light-dismiss target.
 *
 * Desktop remains the control case. If setup mutates its `popovertarget` or
 * invokes the Popover API itself, the desktop test fails before a browser can
 * silently lose native focus management.
 */
describe("navigationMenu and popover event listeners", () => {
  let elementMap;

  const getOrCreateElement = (idKey) => {
    const cleanId = idKey.startsWith("#") ? idKey.slice(1) : idKey;
    if (!elementMap[cleanId]) {
      elementMap[cleanId] = new MockElement(cleanId);
    }
    return elementMap[cleanId];
  };

  beforeEach(() => {
    elementMap = {};

    global.CustomEvent = MockCustomEvent;
    global.document = {
      body: new MockElement("body"),
      documentElement: { namespaceURI: HTML_NAMESPACE },
      defaultView: null,
      getElementById: (id) => getOrCreateElement(id),
      querySelector: (selector) => getOrCreateElement(selector),
      querySelectorAll: (selector) => {
        if (selector === ".navButton[popovertarget]") {
          // Model toolbar openers only. Popover close buttons also carry a
          // `popovertarget`, but lack `.navButton` and must retain their native
          // hide action in standalone mode.
          return [
            getOrCreateElement("selectMenuButton"),
            getOrCreateElement("exportMenuButton"),
          ];
        }
        if (selector === ".navButton") {
          return [
            getOrCreateElement("locateSearchResult"),
            getOrCreateElement("reset-button"),
          ];
        }
        if (selector === ".modern-popover") {
          return [
            getOrCreateElement("m_select"),
            getOrCreateElement("m_export"),
          ];
        }
        return [];
      },
      createElement: (tag) => new MockElement("", "", tag),
      createElementNS: (ns, tag) => new MockElement("", "", tag),
    };
    global.document.body.ownerDocument = global.document;
    global.document.activeElement = global.document.body;

    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: () => ({ matches: false }),
      innerWidth: 1024,
      document: global.document,
    };
    global.document.defaultView = global.window;

    const scrollContainer = getOrCreateElement("menuElementContainer");
    scrollContainer.children = [
      getOrCreateElement("c_select"),
      getOrCreateElement("c_export"),
    ];

    const menuContainer = getOrCreateElement("menuContainer");
    menuContainer.children = [
      getOrCreateElement("m_select"),
      getOrCreateElement("m_export"),
    ];

    getOrCreateElement("selectMenuButton").setAttribute(
      "popovertarget",
      "m_select",
    );
    getOrCreateElement("exportMenuButton").setAttribute(
      "popovertarget",
      "m_export",
    );

    global.d3 = d3;
    global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  test("suppresses contextmenu on scroll buttons and navButtons", () => {
    const mockGraph = {
      options: () => ({
        navigationMenu: () => ({ hideAllMenus: () => {} }),
      }),
      scaleFactor: () => 1.0,
    };

    const navMenu = navigationMenuFactory(mockGraph);
    navMenu.setup();

    const scrollRightBtn = document.getElementById("scrollRightButton");
    const scrollLeftBtn = document.getElementById("scrollLeftButton");
    const navBtn = document.getElementById("locateSearchResult");

    const touchEventRight = new CustomEvent("touchstart", {
      cancelable: true,
      bubbles: true,
    });
    scrollRightBtn.dispatchEvent(touchEventRight);
    expect(touchEventRight.defaultPrevented).toBe(true);

    const contextEventRight = new CustomEvent("contextmenu", {
      cancelable: true,
      bubbles: true,
    });
    scrollRightBtn.dispatchEvent(contextEventRight);
    expect(contextEventRight.defaultPrevented).toBe(true);

    const touchEventLeft = new CustomEvent("touchstart", {
      cancelable: true,
      bubbles: true,
    });
    scrollLeftBtn.dispatchEvent(touchEventLeft);
    expect(touchEventLeft.defaultPrevented).toBe(true);

    const contextEventLeft = new CustomEvent("contextmenu", {
      cancelable: true,
      bubbles: true,
    });
    scrollLeftBtn.dispatchEvent(contextEventLeft);
    expect(contextEventLeft.defaultPrevented).toBe(true);

    const contextEventNav = new CustomEvent("contextmenu", {
      cancelable: true,
      bubbles: true,
    });
    navBtn.dispatchEvent(contextEventNav);
    expect(contextEventNav.defaultPrevented).toBe(true);
  });

  test("keeps scroll-button visibility in sync with the menu viewport", () => {
    const mockGraph = {
      options: () => ({
        navigationMenu: () => ({ hideAllMenus: () => {} }),
      }),
      scaleFactor: () => 1.0,
    };
    const navMenu = navigationMenuFactory(mockGraph);
    const scrollContainer = document.getElementById("menuElementContainer");
    const leftButton = document.getElementById("scrollLeftButton");
    const rightButton = document.getElementById("scrollRightButton");

    scrollContainer.clientWidth = 300;
    scrollContainer.scrollWidth = 500;
    scrollContainer.scrollLeft = 0;
    navMenu.updateScrollButtonVisibility();
    expect(leftButton.classList.contains("hidden")).toBe(true);
    expect(rightButton.classList.contains("hidden")).toBe(false);

    scrollContainer.scrollLeft = 100;
    navMenu.updateScrollButtonVisibility();
    expect(leftButton.classList.contains("hidden")).toBe(false);
    expect(rightButton.classList.contains("hidden")).toBe(false);

    scrollContainer.scrollLeft = 200;
    navMenu.updateScrollButtonVisibility();
    expect(leftButton.classList.contains("hidden")).toBe(false);
    expect(rightButton.classList.contains("hidden")).toBe(true);

    scrollContainer.scrollWidth = 300;
    navMenu.updateScrollButtonVisibility();
    expect(leftButton.classList.contains("hidden")).toBe(true);
    expect(rightButton.classList.contains("hidden")).toBe(true);
  });

  describe("standalone touch popover focus workaround", () => {
    test("opens without an invoker source and maintains expanded state", () => {
      global.window.matchMedia = jest.fn(() => ({ matches: true }));
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
          exportMenu: () => ({ exportAsUrl: jest.fn() }),
        }),
      };
      const popover = getOrCreateElement("m_export");
      const nativeShowPopover = popover.showPopover.bind(popover);
      popover.showPopover = jest.fn(nativeShowPopover);

      navigationMenuFactory(mockGraph).setup();

      const opener = getOrCreateElement("exportMenuButton");
      opener.dispatchEvent(new CustomEvent("click", { cancelable: true }));

      expect(window.matchMedia).toHaveBeenCalledWith(
        "(display-mode: standalone) and (hover: none) and (pointer: coarse)",
      );
      expect(opener.getAttribute("popovertarget")).toBe("");
      expect(opener.getAttribute("aria-controls")).toBe("m_export");
      // This zero-argument assertion is the core regression guard. Passing the
      // opener as `source` would make it WebKit's focus-navigation scope owner
      // and restore the condition that can freeze the installed iOS app.
      expect(popover.showPopover).toHaveBeenCalledWith();

      popover.dispatchEvent(new CustomEvent("toggle", { newState: "open" }));
      expect(opener.getAttribute("aria-expanded")).toBe("true");
    });

    test("restores focus to the opener when a focused popover closes", () => {
      global.window.matchMedia = jest.fn(() => ({ matches: true }));
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
          exportMenu: () => ({ exportAsUrl: jest.fn() }),
        }),
      };
      const popover = getOrCreateElement("m_export");
      const input = new MockElement("exportedUrl", "", "input");
      input.ownerDocument = global.document;
      popover.appendChild(input);

      navigationMenuFactory(mockGraph).setup();

      const opener = getOrCreateElement("exportMenuButton");
      opener.dispatchEvent(new CustomEvent("click", { cancelable: true }));
      global.document.activeElement = input;
      popover.popoverState = "closed";
      popover.dispatchEvent(new CustomEvent("toggle", { newState: "closed" }));

      expect(opener.getAttribute("aria-expanded")).toBe("false");
      expect(global.document.activeElement).toBe(opener);
      expect(opener.focusOptions).toEqual({ preventScroll: true });
    });

    test("does not steal focus from an external control after light dismiss", () => {
      global.window.matchMedia = jest.fn(() => ({ matches: true }));
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
          exportMenu: () => ({ exportAsUrl: jest.fn() }),
        }),
      };
      const popover = getOrCreateElement("m_export");
      const externalControl = getOrCreateElement("sidebarExpandButton");

      navigationMenuFactory(mockGraph).setup();

      const opener = getOrCreateElement("exportMenuButton");
      opener.dispatchEvent(new CustomEvent("click", { cancelable: true }));
      global.document.activeElement = externalControl;
      popover.popoverState = "closed";
      popover.dispatchEvent(new CustomEvent("toggle", { newState: "closed" }));

      // `toggle` is queued. By the time it runs, a light-dismiss target may
      // already own focus; restoration must not undo that later interaction.
      expect(global.document.activeElement).toBe(externalControl);
      expect(opener.focusOptions).toBeUndefined();
    });

    test("leaves declarative popover invocation untouched on desktop", () => {
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };
      const popover = getOrCreateElement("m_export");
      popover.showPopover = jest.fn(popover.showPopover.bind(popover));

      navigationMenuFactory(mockGraph).setup();

      const opener = getOrCreateElement("exportMenuButton");
      opener.dispatchEvent(new CustomEvent("click", { cancelable: true }));

      expect(opener.getAttribute("popovertarget")).toBe("m_export");
      expect(opener.getAttribute("aria-controls")).toBe("");
      expect(popover.showPopover).not.toHaveBeenCalled();
    });
  });

  describe("Popover toggle event synchronization", () => {
    test("sets active-menu-item and triggers exportAsUrl when toggle opens export popover", () => {
      const exportAsUrlMock = jest.fn();
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
          exportMenu: () => ({ exportAsUrl: exportAsUrlMock }),
        }),
        scaleFactor: () => 1.0,
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const popover = getOrCreateElement("m_export");
      popover._classList.add("modern-popover");
      popover.popoverState = "open";

      const toggleEvent = new CustomEvent("toggle", {
        bubbles: true,
        newState: "open",
      });
      popover.dispatchEvent(toggleEvent);

      const controller = getOrCreateElement("c_export");
      expect(controller.classList.contains("active-menu-item")).toBe(true);
      expect(exportAsUrlMock).toHaveBeenCalled();
      expect(popover.style.getPropertyValue("--popover-inline-start")).toBe(
        "16px",
      );
    });

    test("removes active-menu-item when toggle closes popover", () => {
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
        scaleFactor: () => 1.0,
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const controller = getOrCreateElement("c_select");
      controller.classList.add("active-menu-item");

      const popover = getOrCreateElement("m_select");
      popover._classList.add("modern-popover");
      popover.popoverState = "closed";

      const toggleEvent = new CustomEvent("toggle", {
        bubbles: true,
        newState: "closed",
      });
      popover.dispatchEvent(toggleEvent);

      expect(controller.classList.contains("active-menu-item")).toBe(false);
    });

    test("does not throw error in updateMenuPosition when mouseout occurs", () => {
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const controller = getOrCreateElement("c_select");
      const popover = getOrCreateElement("m_select");
      popover.popoverState = "open";

      const mouseoutEvent = new CustomEvent("mouseout", { bubbles: true });
      controller.dispatchEvent(mouseoutEvent);

      expect(() => {
        navMenu.updateMenuPosition();
      }).not.toThrow();
    });
  });

  describe("Mobile Bottom Sheet Touch Drag-to-Dismiss", () => {
    test("tracks downward touch displacement and dismisses when drag exceeds threshold on mobile viewport", (done) => {
      global.window.innerWidth = 480;

      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const popover = getOrCreateElement("m_select");
      popover.popoverState = "open";
      const handles = popover.querySelectorAll(
        ".sheet-handle, .popover-header",
      );
      const handleNode = handles[0];

      const startEvent = new CustomEvent("touchstart", {
        touches: [{ clientY: 100 }],
      });
      handleNode.dispatchEvent(startEvent);

      const moveEvent = new CustomEvent("touchmove", {
        cancelable: true,
        touches: [{ clientY: 220 }],
      });
      handleNode.dispatchEvent(moveEvent);

      expect(popover.style.getPropertyValue("--sheet-drag-y")).toBe("120px");
      expect(popover.classList.contains("has-dragged")).toBe(true);

      const endEvent = new CustomEvent("touchend", {});
      handleNode.dispatchEvent(endEvent);

      expect(popover.classList.contains("sheet-dismissing")).toBe(true);

      setTimeout(() => {
        expect(popover.popoverState).toBe("closed");
        done();
      }, 250);
    });

    test("snaps back and maintains has-dragged class when drag is below threshold to prevent double bounce-back", (done) => {
      global.window.innerWidth = 480;

      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const popover = getOrCreateElement("m_select");
      popover.popoverState = "open";
      const handles = popover.querySelectorAll(
        ".sheet-handle, .popover-header",
      );
      const handleNode = handles[0];

      const startEvent = new CustomEvent("touchstart", {
        touches: [{ clientY: 100 }],
      });
      handleNode.dispatchEvent(startEvent);

      const moveEvent = new CustomEvent("touchmove", {
        cancelable: true,
        touches: [{ clientY: 130 }],
      });
      handleNode.dispatchEvent(moveEvent);

      expect(popover.style.getPropertyValue("--sheet-drag-y")).toBe("30px");

      setTimeout(() => {
        const endEvent = new CustomEvent("touchend", {});
        handleNode.dispatchEvent(endEvent);

        expect(popover.classList.contains("snap-back")).toBe(true);
        expect(popover.classList.contains("has-dragged")).toBe(true);

        setTimeout(() => {
          expect(popover.classList.contains("snap-back")).toBe(false);
          expect(popover.classList.contains("has-dragged")).toBe(true);
          expect(popover.popoverState).toBe("open");
          done();
        }, 300);
      }, 200);
    });

    test("clamps upward dragging (dy < 0) to translateY(0px) to prevent tearing from bottom of screen", () => {
      global.window.innerWidth = 480;

      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const popover = getOrCreateElement("m_select");
      popover.popoverState = "open";
      const handles = popover.querySelectorAll(
        ".sheet-handle, .popover-header",
      );
      const handleNode = handles[0];

      const startEvent = new CustomEvent("touchstart", {
        touches: [{ clientY: 100 }],
      });
      handleNode.dispatchEvent(startEvent);

      const moveEvent = new CustomEvent("touchmove", {
        cancelable: true,
        touches: [{ clientY: 50 }],
      });
      handleNode.dispatchEvent(moveEvent);

      expect(popover.style.getPropertyValue("--sheet-drag-y")).toBe("0px");
    });

    test("ignores drag initialization when target is close button", () => {
      global.window.innerWidth = 480;

      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const popover = getOrCreateElement("m_select");
      popover.popoverState = "open";
      const handles = popover.querySelectorAll(
        ".sheet-handle, .popover-header",
      );
      const handleNode = handles[1]; // popover-header

      const closeBtnTarget = new MockElement("", "popover-close-btn");
      closeBtnTarget.closest = (sel) =>
        sel === ".popover-close-btn" ? closeBtnTarget : null;

      const startEvent = new CustomEvent("touchstart", {
        touches: [{ clientY: 100 }],
        target: closeBtnTarget,
      });
      handleNode.dispatchEvent(startEvent);

      const moveEvent = new CustomEvent("touchmove", {
        cancelable: true,
        touches: [{ clientY: 150 }],
      });
      handleNode.dispatchEvent(moveEvent);

      expect(popover.style.getPropertyValue("--sheet-drag-y")).toBe("");
    });
  });

  describe("Popover event containment", () => {
    test("stops propagation of interaction events originating inside modern-popover", () => {
      const mockGraph = {
        options: () => ({
          navigationMenu: () => ({ hideAllMenus: () => {} }),
        }),
      };

      const navMenu = navigationMenuFactory(mockGraph);
      navMenu.setup();

      const popover = getOrCreateElement("m_select");
      popover._classList.add("modern-popover");

      const clickEvent = new CustomEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      clickEvent.stopPropagation = jest.fn();

      popover.dispatchEvent(clickEvent);

      expect(clickEvent.stopPropagation).toHaveBeenCalled();
    });
  });
});
