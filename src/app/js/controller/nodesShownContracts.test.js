import {
  createNodesShownIntent,
  readNodesShownOption,
} from "./nodesShownContracts.js";
import { readVisualizationShareLink } from "./visualizationShareLink.js";
import { normalizeSetVisualizationViewToolInput } from "../webmcp/webMcpToolContracts.js";

test.each(["auto", "all", "0", "37", "9007199254740991"])(
  "URL count grammar accepts %s",
  (value) => {
    expect(
      readVisualizationShareLink(
        `https://example.test/#opts=nodesShown=${value};#foaf`,
      ).initialVisualization.view.nodesShown,
    ).toEqual(readNodesShownOption(value));
  },
);
test.each([
  "",
  "-1",
  "+1",
  "1.5",
  "1e2",
  "Infinity",
  "NaN",
  "9007199254740992",
  " 37",
  "37 ",
])("URL count grammar rejects %j", (value) => {
  expect(() => readNodesShownOption(value)).toThrow();
});
test.each(["doc", "minDegree", "nodes"])(
  "obsolete %s is rejected even alongside nodesShown",
  (name) => {
    expect(() =>
      readVisualizationShareLink(
        `https://example.test/#opts=nodesShown=37;${name}=0;#foaf`,
      ),
    ).toThrow();
    expect(() =>
      normalizeSetVisualizationViewToolInput({
        [name]: 0,
        nodesShown: { mode: "all" },
      }),
    ).toThrow();
    expect(() =>
      normalizeSetVisualizationViewToolInput({
        filters: { [name]: 0, datatypes: "show" },
        nodesShown: { mode: "all" },
      }),
    ).toThrow();
  },
);
test("saved doc=0 URLs reopen with All while other obsolete values remain rejected", () => {
  const saved = readVisualizationShareLink(
    "https://haddenindustries.com/webvowl/#opts=doc=0;mode_multiColor=true;#goodrelations",
  );
  expect(saved.ontologyIdentifier).toBe("goodrelations");
  expect(saved.initialVisualization.view.nodesShown).toEqual({ mode: "all" });
  expect(saved.initialVisualization.modes.colorExternalsMode).toBe("gradient");
  for (const value of ["-1", "1", "00", "0.0", "", "%200"]) {
    expect(() =>
      readVisualizationShareLink(
        `https://example.test/#opts=doc=${value};#foaf`,
      ),
    ).toThrow("doc is obsolete");
  }
  expect(() =>
    readVisualizationShareLink("https://example.test/#opts=doc=0;doc=0;#foaf"),
  ).toThrow("Duplicate");
  expect(() =>
    readVisualizationShareLink(
      "https://example.test/#opts=doc=0;nodesShown=37;#foaf",
    ),
  ).toThrow("both");
});

test("duplicate count options and non-data intent objects are rejected", () => {
  expect(() =>
    readVisualizationShareLink(
      "https://example.test/#opts=nodesShown=37;nodesShown=all;#foaf",
    ),
  ).toThrow("Duplicate");
  for (const value of [
    { mode: "all", requestedCount: 0 },
    { mode: "exact" },
    { mode: "exact", requestedCount: Infinity },
    Object.create({ mode: "all" }),
    { mode: "auto", [Symbol()]: 1 },
  ]) {
    expect(() => createNodesShownIntent(value)).toThrow();
  }
  const withAccessor = {
    get mode() {
      throw new Error("invoked accessor");
    },
  };
  expect(() => createNodesShownIntent(withAccessor)).toThrow("plain data");
});
