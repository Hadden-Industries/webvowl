// SPDX-License-Identifier: AGPL-3.0-only
// Sources and occurrences are hand-derived from A2/B2/B3, never production output.
import { profiles } from "./producer.mjs";
const empty = () => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  },
});
const namedClass = () => {
  const source = empty();
  source.structural.subjects = [
    { id: "class-subject", iri: "https://example.org/o#A" },
  ];
  source.structural.roles = [
    { id: "class-role", kind: "class", subject: "class-subject" },
  ];
  source.structural.occurrences = [
    { id: "class-node", kind: "class-node", targets: ["class-role"] },
  ];
  return source;
};
const state = (placements = []) => ({
  placements,
  camera: { center: { x: 0, y: 0 }, zoom: 1 },
  hidden: [],
  labelSelection: { mode: "untagged" },
  prefixes: [],
  display: {
    compactNotation: false,
    nodeScaling: "uniform",
    externalColoring: true,
  },
});
const artifactEmpty = empty();
artifactEmpty.visualization = state();
const artifactClass = namedClass();
artifactClass.visualization = state([
  { occurrence: "class-node", position: { x: 12.5, y: -7 }, pinned: true },
]);
export const seedSources = [
  {
    id: "empty-structural",
    profile: profiles.structural,
    source: empty(),
    rules: ["A2", "A6.1", "A6.2", "A6.3", "D9", "D18.2"],
    expectedCounts: { primary: 0, blankNodes: 9, quads: 20 },
  },
  {
    id: "named-class-structural",
    profile: profiles.structural,
    source: namedClass(),
    rules: ["A2", "A6", "B2.1", "D18.2"],
    expectedCounts: { primary: 3, blankNodes: 13, quads: 33 },
  },
  {
    id: "empty-artifact",
    profile: profiles.artifact,
    source: artifactEmpty,
    rules: ["A6", "B3", "D9"],
    expectedCounts: { primary: 0, blankNodes: 17, quads: 43 },
  },
  {
    id: "named-class-artifact",
    profile: profiles.artifact,
    source: artifactClass,
    rules: ["A6", "B2.1", "B3", "D18.2"],
    expectedCounts: { primary: 3, blankNodes: 23, quads: 64 },
  },
];
