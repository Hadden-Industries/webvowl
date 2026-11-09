import { beforeAll, jest } from "@jest/globals";
import { BaseProperty } from "../../../webvowl/js/elements/properties/BaseProperty.js";

let pickAndPinFactory;

beforeAll(async () => {
  ({ createPickAndPin: pickAndPinFactory } = await import("./pickAndPin.js"));
});

describe("Pick and Pin Module Unit Tests", () => {
  let pap;
  let mockNode;
  let mockProperty;

  beforeEach(() => {
    pap = pickAndPinFactory();

    let nodePinned = false;
    mockNode = {
      pinned: (v) => {
        if (v !== undefined) {
          nodePinned = v;
        }
        return nodePinned;
      },
      drawPin: jest.fn(() => {
        nodePinned = true;
      }),
      removePin: jest.fn(() => {
        nodePinned = false;
      }),
    };

    const parallelLinks = [{ id: "first" }, { id: "second" }];
    mockProperty = new BaseProperty()
      .domain({ links: () => parallelLinks })
      .range({ links: () => parallelLinks });
    mockProperty.drawPin = jest.fn(() => mockProperty.pinned(true));
    mockProperty.removePin = jest.fn(() => mockProperty.pinned(false));
  });

  test("does not pin when pickAndPin module is disabled", () => {
    pap.enabled(false);
    pap.handle({ defaultPrevented: false }, mockNode, true);
    expect(mockNode.drawPin).not.toHaveBeenCalled();
  });

  test("ignores simple click when forced is false", () => {
    pap.enabled(true);
    pap.handle({ defaultPrevented: false }, mockNode, false);
    expect(mockNode.drawPin).not.toHaveBeenCalled();
  });

  test("pins node when forced is true on dragend", () => {
    pap.enabled(true);
    pap.handle({}, mockNode, true);
    expect(mockNode.drawPin).toHaveBeenCalledTimes(1);
    expect(mockNode.pinned()).toBe(true);
  });

  test("pins property when forced is true on dragend", () => {
    pap.enabled(true);
    pap.handle({}, mockProperty, true);
    expect(mockProperty.drawPin).toHaveBeenCalledTimes(1);
    expect(mockProperty.pinned()).toBe(true);
  });

  test("repeated links and lookalikes do not count as parallel links", () => {
    const sharedLink = { id: "shared" };
    const lookalike = { id: "other" };
    mockProperty
      .domain({ links: () => [sharedLink, sharedLink, lookalike] })
      .range({ links: () => [sharedLink, sharedLink, { ...lookalike }] });

    pap.enabled(true);
    pap.handle({}, mockProperty, true);

    expect(mockProperty.pinned()).toBe(false);
    expect(mockProperty.drawPin).not.toHaveBeenCalled();
  });

  test("resets all pinned elements on pap.reset()", () => {
    pap.enabled(true);
    pap.handle({}, mockNode, true);
    pap.handle({}, mockProperty, true);

    expect(mockNode.pinned()).toBe(true);
    expect(mockProperty.pinned()).toBe(true);

    pap.reset();

    expect(mockNode.removePin).toHaveBeenCalledTimes(1);
    expect(mockProperty.removePin).toHaveBeenCalledTimes(1);
  });
});
