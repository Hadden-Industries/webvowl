import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { namespaces } from "vowl";

let createOntologyEditingState;
const context = createContext({ URL });
beforeAll(async () => {
  const modules = new Map();
  const vocabulary = new SyntheticModule(
    ["namespaces"],
    function () {
      this.setExport("namespaces", namespaces);
    },
    { context },
  );
  function load(url) {
    if (!modules.has(url.href)) {
      modules.set(
        url.href,
        new SourceTextModule(readFileSync(url, "utf8"), {
          context,
          identifier: url.href,
        }),
      );
    }
    return modules.get(url.href);
  }
  const source = load(new URL("./ontologyEditingState.js", import.meta.url));
  await source.link((specifier, referring) =>
    specifier === "vowl"
      ? vocabulary
      : load(new URL(specifier, referring.identifier)),
  );
  await source.evaluate();
  ({ createOntologyEditingState } = source.namespace);
});

test("editor defaults retain legacy spellings and independent mutable instances", () => {
  const first = createOntologyEditingState();
  const second = createOntologyEditingState();
  expect(first.prefixList().dc).toBe("http://purl.org/dc/elements/1.1/#");
  expect(first.supportedProperties()).not.toContain("owl:datatypeProperty");
  expect(first.defaultClass()).toBe("owl:Class");
  expect(first.defaultProperty()).toBe("owl:objectProperty");
  expect(first.defaultDatatype()).toBe("rdfs:Literal");
  first.prefixList().owl = "urn:changed:";
  first.supportedClasses().push("custom:Class");
  first.supportedDatatypes().push("custom:Datatype");
  first.supportedProperties().push("custom:property");
  expect(second.prefixList().owl).toBe("http://www.w3.org/2002/07/owl#");
  expect(second.supportedClasses()).not.toContain("custom:Class");
  expect(second.supportedDatatypes()).not.toContain("custom:Datatype");
  expect(second.supportedProperties()).not.toContain("custom:property");
  const initial = first.initialConfig();
  expect(initial).toEqual({
    sidebar: "1",
    cd: 200,
    dd: 120,
    editorMode: "false",
    filter_datatypes: "false",
    filter_objectProperties: "false",
    filter_sco: "false",
    filter_disjoint: "true",
    filter_setOperator: "false",
    mode_dynamic: "true",
    mode_scaling: "true",
    mode_compact: "false",
    mode_colorExt: "true",
    mode_multiColor: "false",
    mode_pnp: "false",
    debugFeatures: "false",
    rect: 0,
  });
  initial.cd = 999;
  expect(first.initialConfig().cd).toBe(200);
});

describe("explicit debug feature visibility", () => {
  test.each([true, false])(
    "applies %s idempotently to stored and displayed choices",
    (visible) => {
      const state = createOntologyEditingState();
      const classes = new Set();
      const element = {
        classList: {
          toggle: (name, present) =>
            present ? classes.add(name) : classes.delete(name),
        },
      };
      context.document = { querySelectorAll: () => [element] };
      try {
        state.setDebugFeaturesVisible(visible);
        state.setDebugFeaturesVisible(visible);
        expect(state.getHideDebugFeatures()).toBe(!visible);
        expect(classes.has("hidden")).toBe(!visible);
      } finally {
        context.document = undefined;
      }
    },
  );
});
