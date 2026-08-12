const focuserFactory = require("./focuser");

describe("Focuser Module Unit Tests", () => {
  let graphMock;
  let focuser;
  let updateSelectionInformationMock;

  beforeEach(() => {
    global.webvowl = {
      util: {
        elementTools: () => ({
          isProperty: (elem) => elem && elem.isProperty === true,
        }),
      },
    };

    updateSelectionInformationMock = jest.fn();
    graphMock = {
      options: () => ({
        editSidebar: () => ({
          updateSelectionInformation: updateSelectionInformationMock,
        }),
      }),
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
      toggleFocus: () => { focused = !focused; },
      inverse: () => ({}),
      labelElement: () => ({
        attr: (attrName) => (attrName === "transform" ? "translate(0,15)" : ""),
      }),
    };

    focuser.handle({}, propertyMock);

    expect(updateSelectionInformationMock).toHaveBeenCalledWith(propertyMock);
    expect(graphMock.activateHoverElementsForProperties).toHaveBeenCalledWith(
      true,
      propertyMock,
      true,
      false
    );
  });

  test("passes inversed = false when transform translate is (0,-15) or top label", () => {
    let focused = false;
    const propertyMock = {
      isProperty: true,
      focused: () => focused,
      toggleFocus: () => { focused = !focused; },
      inverse: () => ({}),
      labelElement: () => ({
        attr: (attrName) => (attrName === "transform" ? "translate(0,-15)" : ""),
      }),
    };

    focuser.handle({}, propertyMock);

    expect(graphMock.activateHoverElementsForProperties).toHaveBeenCalledWith(
      true,
      propertyMock,
      false,
      false
    );
  });
});
