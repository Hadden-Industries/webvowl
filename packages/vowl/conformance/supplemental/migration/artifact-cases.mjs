// SPDX-License-Identifier: AGPL-3.0-only
// Saved fields and expected B3 state are manual independent transcriptions.
import assert from "node:assert/strict";
import { profiles } from "./support.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
const CAMERA = "/settings/global/translation";
const VIEWPORT = {
  kind: "viewport",
  sourcePointer: CAMERA,
  width: 640,
  height: 480,
};
const DEFAULT_PREFIXES = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  dc: "http://purl.org/dc/elements/1.1/#",
  xml: "http://www.w3.org/XML/1998/namespace",
};

function savedSettings() {
  return {
    global: {
      paused: false,
      language: "IRI-based",
      zoom: 2,
      translation: [12, -8],
    },
    gravity: { classDistance: 200, datatypeDistance: 120 },
    filter: {
      degreeSliderValue: 0,
      checkBox: [
        "datatypeFilterCheckbox",
        "objectPropertyFilterCheckbox",
        "subclassFilterCheckbox",
        "disjointFilterCheckbox",
        "setoperatorFilterCheckbox",
      ].map((id) => ({ id, checked: false })),
    },
    modes: {
      colorSwitchState: false,
      maxLabelWidth: 180,
      checkBox: [
        { id: "nodescalingModuleCheckbox", checked: false },
        { id: "compactnotationModuleCheckbox", checked: true },
        { id: "colorexternalsModuleCheckbox", checked: true },
        { id: "pickandpinModuleCheckbox", checked: true },
        { id: "labelWidthModuleCheckbox", checked: true },
      ],
    },
  };
}

function withState(
  input,
  { paired = false, equivalent = false, label = false } = {},
) {
  const output = clone(input);
  output.settings = savedSettings();
  for (const [index, attribute] of output.classAttribute.entries()) {
    attribute.pos =
      paired && !equivalent
        ? [
            [-3, 4],
            [12, 18],
          ][index]
        : [20, 30];
    attribute.pinned = paired && !equivalent ? index === 1 : true;
  }
  if (label) {
    assert.equal(output.propertyAttribute.length, 1);
    output.propertyAttribute[0].pos = [4.5, 11];
    output.propertyAttribute[0].pinned = false;
  }
  return output;
}

function expectedState(
  source,
  { paired = false, equivalent = false, label = false } = {},
) {
  const result = clone(source);
  const placements = result.structural.occurrences
    .filter(
      (occurrence) =>
        occurrence.kind === "class-node" || occurrence.kind === "label",
    )
    .map((occurrence) => {
      if (occurrence.kind === "label") {
        assert(label);
        return {
          occurrence: occurrence.id,
          position: { x: 4.5, y: 11 },
          pinned: false,
        };
      }
      if (paired && !equivalent) {
        const isA = occurrence.targets.includes("class-A");
        return {
          occurrence: occurrence.id,
          position: isA ? { x: -3, y: 4 } : { x: 12, y: 18 },
          pinned: !isA,
        };
      }
      return {
        occurrence: occurrence.id,
        position: { x: 20, y: 30 },
        pinned: true,
      };
    });
  result.visualization = {
    placements,
    camera: { center: { x: 154, y: 124 }, zoom: 2 },
    hidden: [],
    labelSelection: { mode: "iri" },
    prefixes: Object.entries(DEFAULT_PREFIXES).map(([prefix, iri]) => ({
      prefix,
      iri,
    })),
    display: {
      compactNotation: true,
      nodeScaling: "uniform",
      externalColoring: true,
    },
  };
  return result;
}

export function appendArtifactCases({
  cases,
  exports,
  success,
  reject,
  manual,
  root,
}) {
  function accept(id, input, source, rationale) {
    success(id, input, source, rationale, [clone(VIEWPORT)]);
    Object.assign(cases.at(-1), {
      profile: profiles.artifact,
      rules: ["A9.3", "B2", "B3", "B4", "B5"],
      origin:
        "Pinned builder input with independently authored arrangement/settings shaped against the pinned controller field producers; not a claim of full historical browser execution.",
    });
  }
  const named = withState(exports.named);
  const namedExpected = expectedState(manual({ root, namedClass: true }));
  accept(
    "named-class-artifact",
    named,
    namedExpected,
    "The sole canonical node has explicit position and pin state. Saved mode intent and six effective document prefixes are known; viewport resolution converts translation/zoom exactly to center (154,124).",
  );
  const equivalent = withState(exports.equivalent, {
    paired: true,
    equivalent: true,
  });
  const equivalentExpected = expectedState(
    manual({
      root,
      namedClass: true,
      namedClasses: ["B"],
      relation: "equivalent-classes",
    }),
    { paired: true, equivalent: true },
  );
  accept(
    "equal-state-equivalence-collapse-artifact",
    equivalent,
    equivalentExpected,
    "Both equivalent named-class records correspond to one canonical occurrence and agree exactly in saved position and pin state, so no first-record choice is needed.",
  );
  const oneRepresentative = clone(equivalent);
  delete oneRepresentative.classAttribute[1].pos;
  delete oneRepresentative.classAttribute[1].pinned;
  accept(
    "single-placed-equivalence-representative-artifact",
    oneRepresentative,
    equivalentExpected,
    "One represented class supplies complete position and pin state for the single grouped occurrence. The other alias supplies no conflicting state claim, so no extra coordinate is required.",
  );
  const subclass = withState(exports.subclass, { paired: true, label: true });
  const subclassExpected = expectedState(
    manual({
      root,
      namedClass: true,
      namedClasses: ["B"],
      relation: "subclass",
    }),
    { paired: true, label: true },
  );
  accept(
    "subclass-label-placement-artifact",
    subclass,
    subclassExpected,
    "Each class node and the generated subclass label has its own saved placement. The edge itself is not positionable.",
  );
  const hiddenSubclass = clone(subclass);
  hiddenSubclass.settings.filter.checkBox.find(
    (entry) => entry.id === "subclassFilterCheckbox",
  ).checked = true;
  const hiddenExpected = clone(subclassExpected);
  hiddenExpected.visualization.hidden = hiddenExpected.structural.occurrences
    .filter(
      (occurrence) =>
        occurrence.kind === "subclass-edge" ||
        occurrence.kind === "label" ||
        (occurrence.kind === "class-node" &&
          occurrence.targets.includes("class-A")),
    )
    .map((occurrence) => occurrence.id);
  accept(
    "subclass-filter-hidden-closure-artifact",
    hiddenSubclass,
    hiddenExpected,
    "The pinned subclass filter removes A, whose only relation is its one outgoing subclass link; B remains. Canonical incidence closure hides A, the edge and its label while retaining every placement.",
  );
  const noOpFilters = clone(named);
  for (const entry of noOpFilters.settings.filter.checkBox)
    entry.checked = true;
  accept(
    "checked-inapplicable-filters-artifact",
    noOpFilters,
    namedExpected,
    "All five filters are checked, but this input contains no matching datatype, property, subclass, disjointness or set-operator record. Its ordinary named class remains visible.",
  );
  const restoredDegree = clone(named);
  restoredDegree.settings.filter.degreeSliderValue = 1;
  accept(
    "degree-all-empty-restoration-artifact",
    restoredDegree,
    namedExpected,
    "The sole class has degree zero; filtering at one would empty the graph, so the pinned degree filter restores its complete incoming graph rather than hiding the class.",
  );
  for (const [language, labelSelection] of [
    ["undefined", { mode: "untagged" }],
    ["FR-ca", { mode: "language", range: "fr-ca" }],
  ]) {
    const input = clone(named);
    input.settings.global.language = language;
    const expected = clone(namedExpected);
    expected.visualization.labelSelection = labelSelection;
    accept(
      `explicit-${labelSelection.mode}-selector-artifact`,
      input,
      expected,
      "The saved selector explicitly identifies the canonical selection intent; B4 defines the resulting selection algorithm. Language range case normalizes without choosing a different preference.",
    );
  }
  const prefixInput = clone(named);
  prefixInput.namespace = [
    { name: "ex", iri: "https://example.org/old#" },
    { name: "p", iri: "urn:first:" },
    { name: "p", iri: "urn:second:" },
  ];
  prefixInput.header.prefixList = { ex: "https://example.org/final#" };
  const prefixExpected = clone(namedExpected);
  prefixExpected.visualization.prefixes.push(
    { prefix: "ex", iri: "https://example.org/final#" },
    { prefix: "p", iri: "urn:second:" },
  );
  accept(
    "effective-prefix-overrides-artifact",
    prefixInput,
    prefixExpected,
    "Effective prefix state begins with the six pinned editor defaults, applies namespace entries in order, then header.prefixList. Shadowed declarations are not duplicate active bindings.",
  );

  success(
    "structural-explicit-layout-discard",
    named,
    manual({ root, namedClass: true }),
    "A9.3 permits structural migration to discard known arrangement/settings fields with diagnostics; no viewport resolution is consumed for structural output.",
  );
  cases.at(-1).diagnostics.push(
    { code: "MIGRATION_DROPPED_FIELD", sourcePointer: "/settings" },
    {
      code: "MIGRATION_DROPPED_FIELD",
      sourcePointer: "/classAttribute/0/pos",
    },
    {
      code: "MIGRATION_DROPPED_FIELD",
      sourcePointer: "/classAttribute/0/pinned",
    },
  );
  cases.at(-1).origin =
    "Pinned builder input plus independently authored complete saved fields";

  const rejection = (
    id,
    input,
    rationale,
    resolutions = [clone(VIEWPORT)],
    errorCode = "MIGRATION_AMBIGUOUS",
  ) =>
    reject(id, input, rationale, {
      profile: profiles.artifact,
      resolutions,
      errorCode,
    });
  rejection(
    "artifact-missing-viewport",
    named,
    "Viewport dimensions were not saved by the exporter. Migration cannot infer them from the camera or browser environment.",
    [],
  );
  rejection(
    "artifact-wrong-viewport-pointer",
    named,
    "The resolution must target the unresolved translation field, not a nearby settings object.",
    [{ ...VIEWPORT, sourcePointer: "/settings/global" }],
    "MIGRATION_RESOLUTION_INVALID",
  );
  for (const [id, change, rationale] of [
    [
      "artifact-missing-placement",
      (input) => {
        delete input.classAttribute[0].pos;
      },
      "No layout may be synthesized for the missing canonical class node placement.",
    ],
    [
      "artifact-missing-pin-state",
      (input) => {
        delete input.classAttribute[0].pinned;
      },
      "Omitted pin state cannot be silently defaulted to false.",
    ],
    [
      "artifact-incomplete-filter-state",
      (input) => {
        input.settings.filter.checkBox.pop();
      },
      "Missing effective filter choices are not replaced by current application defaults.",
    ],
    [
      "artifact-duplicate-filter-setting",
      (input) => {
        input.settings.filter.checkBox.push(
          clone(input.settings.filter.checkBox[0]),
        );
      },
      "Duplicate saved setting IDs have no unique contract interpretation, even when their values agree.",
    ],
    [
      "artifact-incomplete-display-state",
      (input) => {
        input.settings.modes.checkBox = input.settings.modes.checkBox.filter(
          (entry) => entry.id !== "compactnotationModuleCheckbox",
        );
      },
      "Every canonical display mode must be explicitly recoverable.",
    ],
    [
      "artifact-default-language-ambiguous",
      (input) => {
        input.settings.global.language = "default";
      },
      "Historical default selector behavior does not identify a canonical IRI, untagged, or language choice; closest-choice guessing is forbidden.",
    ],
  ]) {
    const input = clone(named);
    change(input);
    rejection(id, input, rationale);
  }
  const conflict = clone(equivalent);
  conflict.classAttribute[1].pos[0] += 1;
  rejection(
    "artifact-conflicting-collapsed-placement",
    conflict,
    "Two legacy records collapse to one canonical occurrence but disagree in x; neither first-record selection nor averaging is authorized.",
  );
  const missingLabel = clone(subclass);
  delete missingLabel.propertyAttribute[0].pos;
  rejection(
    "artifact-missing-generated-label-placement",
    missingLabel,
    "The canonical subclass label is positionable. Class placements alone cannot supply its missing saved position.",
  );
  reject(
    "structural-unused-viewport-resolution",
    named,
    "Structural migration discards the camera rather than resolving it, so a viewport resolution would be unused.",
    {
      resolutions: [clone(VIEWPORT)],
      errorCode: "MIGRATION_RESOLUTION_INVALID",
    },
  );
}
