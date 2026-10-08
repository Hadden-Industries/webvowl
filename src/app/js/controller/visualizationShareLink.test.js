import { beforeAll, describe, expect, test } from "@jest/globals";

let readVisualizationShareLink;
let createVisualizationShareLink;
beforeAll(async () => {
  ({ readVisualizationShareLink, createVisualizationShareLink } =
    await import("./visualizationShareLink.js"));
});

describe("visualization share-link input", () => {
  test("reads existing option names as explicit semantic choices and retains the ontology fragment", () => {
    const link =
      "https://example.test/app/#opts=nodesShown=0;cd=300;dd=180;filter_datatypes=true;filter_disjoint=false;mode_dynamic=false;mode_pnp=true;mode_scaling=false;mode_compact=true;mode_colorExt=false;mode_multiColor=false;sidebar=0;editorMode=false;#iri=https://example.test/model#part";
    expect(readVisualizationShareLink(link)).toEqual({
      ontologyIdentifier: "iri=https://example.test/model#part",
      initialVisualization: {
        view: {
          nodesShown: { mode: "exact", requestedCount: 0 },
          filters: { datatypes: "hide", disjointness: "show" },
        },
        modes: {
          dynamicLabelWidth: false,
          pickAndPin: true,
          nodeScaling: false,
          compactNotation: true,
          colorExternals: false,
          colorExternalsMode: "same",
        },
        forceDistances: { classDistancePx: 300, datatypeDistancePx: 180 },
      },
      presentation: { sidebar: 0, editorMode: false },
    });
  });

  test("omitted choices preserve ontology defaults and obsolete degree options are rejected", () => {
    expect(readVisualizationShareLink("https://example.test/#foaf")).toEqual({
      ontologyIdentifier: "foaf",
      initialVisualization: {},
      presentation: {},
    });
    expect(() =>
      readVisualizationShareLink("https://example.test/#opts=doc=-1;#foaf"),
    ).toThrow("nodesShown");
    expect(
      readVisualizationShareLink("https://example.test/").ontologyIdentifier,
    ).toBe("foaf");
  });

  test("creates a link from the accepted remote source and applied choices rather than a stale location", () => {
    const state = {
      source: {
        kind: "ontology-document-iri",
        identity: "https://example.test/model#part",
      },
      view: {
        nodesShown: { mode: "exact", requestedCount: 0 },
        language: "en-gb",
        focus: [],
        filters: {
          datatypes: "show",
          objectProperties: "hide",
          subclasses: "show",
          disjointness: "hide",
          setOperators: "show",
        },
        modes: {
          nodeScaling: true,
          compactNotation: false,
          colorExternals: true,
          pickAndPin: false,
          dynamicLabelWidth: true,
          colorExternalsMode: "same",
          maxLabelWidthPx: 120,
        },
        forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
      },
      layout: { status: "paused" },
      zoomScale: 0.5,
      translation: { xPx: 0, yPx: -20 },
    };
    const link = createVisualizationShareLink(
      "https://viewer.test/webvowl/?theme=dark#stale",
      state,
      { sidebar: 0 },
    );
    expect(
      new URL(link).origin + new URL(link).pathname + new URL(link).search,
    ).toBe("https://viewer.test/webvowl/?theme=dark");
    expect(link).toContain("#iri=https://example.test/model#part");
    expect(readVisualizationShareLink(link)).toEqual({
      ontologyIdentifier: "iri=https://example.test/model#part",
      initialVisualization: {
        view: {
          language: "en-gb",
          filters: state.view.filters,
          nodesShown: state.view.nodesShown,
          layout: "pause",
          zoomScale: 0.5,
          translation: { xPx: 0, yPx: -20 },
        },
        modes: state.view.modes,
        forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
      },
      presentation: { sidebar: 0 },
    });
    for (const identity of [
      "https://example.test/a%2Fb?value=%23&other=one%20two#part",
      "https://example.test/a?first=a+b;second=a=b#opts=paused=true;#foaf",
      "https://example.test/тест?value=α#β",
      "https://[::1]/model?value=%25#part",
    ]) {
      const shared = createVisualizationShareLink("https://viewer.test/", {
        ...state,
        source: { kind: "ontology-document-iri", identity },
      });
      const identifier = readVisualizationShareLink(shared).ontologyIdentifier;
      expect(decodeURIComponent(identifier.slice(4))).toBe(identity);
    }
    expect(() =>
      createVisualizationShareLink("https://viewer.test/", {
        ...state,
        source: { kind: "vowl-json-text", displayName: "local.json" },
      }),
    ).toThrow("URL");
  });
});
