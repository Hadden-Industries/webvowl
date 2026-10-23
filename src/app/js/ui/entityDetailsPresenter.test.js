import { jest } from "@jest/globals";
import { createEntityDetailsPresenter } from "./entityDetailsPresenter.js";

class Element extends EventTarget {
  append() {}
  replaceChildren() {}
  contains() {
    return false;
  }
}

test.each([false, true])(
  "Details reads and restores scroll only while open: %s",
  (isOpen) => {
    const elements = new Map();
    const documentObject = {
      createElement: () => new Element(),
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, new Element());
        }
        return elements.get(id);
      },
    };
    const readScroll = jest.fn(() => 37);
    const restoreScroll = jest.fn();
    documentObject.getElementById("entity-full-details").parentElement =
      Object.defineProperty({}, "scrollTop", {
        get: readScroll,
        set: restoreScroll,
      });
    const presenter = createEntityDetailsPresenter({
      controller: {
        getState: () => ({
          loadGeneration: 1,
          documentRevision: 0,
          status: "ready",
          selection: [],
        }),
      },
      surface: {
        onOpen() {},
        onClose() {},
        isOpen: () => isOpen,
        closeDetails() {},
      },
      documentObject,
      onPresentationChanged() {},
    });
    try {
      presenter.render([]);
      expect(readScroll).toHaveBeenCalledTimes(isOpen ? 1 : 0);
      expect(restoreScroll.mock.calls).toEqual(isOpen ? [[37]] : []);
    } finally {
      presenter.dispose();
    }
  },
);
