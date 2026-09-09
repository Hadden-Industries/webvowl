import { DOMImplementation } from "@xmldom/xmldom";
import * as d3 from "d3";
import { beforeAll, describe, expect, jest, test } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let BaseProperty;
let RectangularNode;
let rectangle;
const textUpdates = [];
class TextFixture {
  addText() {}
  addEquivalents() {}
  addSubText() {}
  updateAllTextElements() {
    textUpdates.push(Number(rectangle.attr("width")));
  }
}
beforeAll(async () => {
  const stubs = {
    "../../../../shared/js/util/CenteringTextElement.js": {
      CenteringTextElement: TextFixture,
    },
    "../drawTools.js": {
      createDrawTools: () => ({
        appendRectangularClass: (_parent, width, height) =>
          rectangle.attr("width", width).attr("height", height),
        setBackgroundColor: () => {},
      }),
    },
  };
  ({ BaseProperty } = await loadEsmModuleForTest(
    new URL("./properties/BaseProperty.js", import.meta.url),
    import.meta.url,
    stubs,
  ));
  ({ RectangularNode } = await loadEsmModuleForTest(
    new URL("./nodes/RectangularNode.js", import.meta.url),
    import.meta.url,
    stubs,
  ));
});

describe("native label-width transition cancellation", () => {
  test.each([
    ["property", false],
    ["property", true],
    ["datatype", false],
    ["datatype", true],
  ])(
    "%s retains coherent geometry, text and focus when a transition has started: %s",
    async (kind, startTransition) => {
      const documentObject = new DOMImplementation().createDocument(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      rectangle = d3
        .select(
          documentObject.createElementNS("http://www.w3.org/2000/svg", "rect"),
        )
        .attr("width", 80);
      const graph = {
        options: () => ({
          dynamicLabelWidth: () => false,
          maxLabelWidth: () => 20,
        }),
      };
      const element =
        kind === "property"
          ? new BaseProperty(graph)
          : new RectangularNode(graph);
      element.getMyWidth = () => 100;
      element.labelForCurrentLanguage = () => "Example label";
      element.addRect = () => rectangle;
      element.addMouseListeners = () => {};
      if (kind === "property") {
        element.drawLabel(rectangle);
      } else {
        element.draw(rectangle);
      }
      const haloWidths = [];
      element.drawHalo = jest.fn(() => {
        element.halo(true);
        haloWidths.push(element.width());
      });
      element.halo(true);
      textUpdates.length = 0;
      const completion = element.animateDynamicLabelWidth(true);
      if (startTransition) {
        d3.timerFlush();
      }
      expect(Number(rectangle.attr("width"))).toBeGreaterThan(20);
      rectangle.interrupt();
      expect(await completion).toBe(false);
      expect(Number(rectangle.attr("width"))).toBe(20);
      expect(Number(rectangle.attr("x"))).toBe(-10);
      expect(textUpdates).toEqual([20]);
      expect(element.halo()).toBe(true);
      expect(haloWidths).toEqual([20]);
    },
  );
});
