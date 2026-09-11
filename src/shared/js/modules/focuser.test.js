import { beforeAll, jest } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let focuserFactory;

beforeAll(async () => {
  ({ createFocuser: focuserFactory } = await loadEsmModuleForTest(
    new URL("./focuser.js", import.meta.url),
    import.meta.url,
    {
      "../util/elementTools.js": {
        createElementTools: () => ({
          isProperty: (elem) => elem && elem.isProperty === true,
        }),
      },
    },
  ));
});

describe("Focuser Module Unit Tests", () => {
  let graphMock;
  let focuser;

  beforeEach(() => {
    graphMock = {
      isTouchDevice: () => false,
      activateHoverElementsForProperties: jest.fn(),
      activateHoverElements: jest.fn(),
      removeEditElements: jest.fn(),
    };

    focuser = focuserFactory(graphMock);
  });

  test("activates hover elements for property and passes inversed = true when transform translate is (0,15)", () => {
    let focused = false;
    const propertyMock = {
      isProperty: true,
      focused: () => focused,
      toggleSelection: () => {
        focused = !focused;
      },
      inverse: () => ({}),
      labelElement: () => ({
        attr: (attrName) => (attrName === "transform" ? "translate(0,15)" : ""),
      }),
    };

    focuser.handle({}, propertyMock);

    expect(graphMock.activateHoverElementsForProperties).toHaveBeenCalledWith(
      true,
      propertyMock,
      true,
      false,
    );
  });

  test("passes inversed = false when transform translate is (0,-15) or top label", () => {
    let focused = false;
    const propertyMock = {
      isProperty: true,
      focused: () => focused,
      toggleSelection: () => {
        focused = !focused;
      },
      inverse: () => ({}),
      labelElement: () => ({
        attr: (attrName) =>
          attrName === "transform" ? "translate(0,-15)" : "",
      }),
    };

    focuser.handle({}, propertyMock);

    expect(graphMock.activateHoverElementsForProperties).toHaveBeenCalledWith(
      true,
      propertyMock,
      false,
      false,
    );
  });
});
