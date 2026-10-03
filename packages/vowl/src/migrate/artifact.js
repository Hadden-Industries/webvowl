import { at, fail } from "../errors.js";
import { namespaces } from "../profiles.js";
import { legacyScalar } from "./grammar.js";

const filters = [
  "datatypeFilterCheckbox",
  "objectPropertyFilterCheckbox",
  "subclassFilterCheckbox",
  "disjointFilterCheckbox",
  "setoperatorFilterCheckbox",
];
const modes = [
  "nodescalingModuleCheckbox",
  "compactnotationModuleCheckbox",
  "colorexternalsModuleCheckbox",
];
const optionalModes = ["pickandpinModuleCheckbox", "labelWidthModuleCheckbox"];
const defaults = {
  rdf: namespaces.rdf,
  rdfs: namespaces.rdfs,
  owl: namespaces.owl,
  xsd: namespaces.xsd,
  dc: "http://purl.org/dc/elements/1.1/#",
  xml: "http://www.w3.org/XML/1998/namespace",
};

function numeric(
  value,
  pointer,
  budget,
  { positive = false, integer = false } = {},
) {
  if (typeof value === "string") {
    if (!value.trim()) {
      fail("MIGRATION_AMBIGUOUS", pointer);
    }
    value = Number(value);
  }
  legacyScalar(value, positive ? "PositiveNumber" : "Number", pointer, budget);
  if (integer && (!Number.isSafeInteger(value) || value < 0)) {
    fail("MIGRATION_AMBIGUOUS", pointer);
  }
  return value;
}

function choices(values, required, optional, pointer, budget) {
  if (!values) {
    fail("MIGRATION_AMBIGUOUS", pointer);
  }
  const result = new Map();
  for (const [index, { id, checked }] of values.entries()) {
    budget.check();
    if (![...required, ...optional].includes(id) || result.has(id)) {
      fail("MIGRATION_AMBIGUOUS", at(pointer, index));
    }
    result.set(id, checked);
  }
  if (required.some((id) => !result.has(id))) {
    fail("MIGRATION_AMBIGUOUS", pointer);
  }
  return result;
}

/** Replay only the pinned filters over admitted named relations, preserving legacy multiplicity. */
function visibility(nodes, edges, types, controls, degree, budget) {
  let activeNodes = new Set(nodes),
    activeEdges = [...edges];
  const tidy = () => {
    activeEdges = activeEdges.filter((edge) => {
      budget.check();
      return activeNodes.has(edge.from) && activeNodes.has(edge.to);
    });
  };
  const incident = () => {
    const result = new Map([...activeNodes].map((id) => [id, []]));
    for (const edge of activeEdges) {
      budget.check();
      result.get(edge.from)?.push(edge);
      if (edge.to !== edge.from) {
        result.get(edge.to)?.push(edge);
      }
    }
    return result;
  };
  // The only drawable generic builtin admitted here is Thing; its use must be explicit.
  let links = incident();
  for (const node of activeNodes) {
    if (
      ["owl:thing", "rdfs:literal"].includes(types.get(node)) &&
      !links.get(node).length
    ) {
      activeNodes.delete(node);
    }
  }
  tidy();
  if (degree > 0) {
    links = incident();
    const selected = new Set(
      [...activeNodes].filter((node) => {
        budget.check();
        return links.get(node).length >= degree;
      }),
    );
    if (selected.size) {
      activeNodes = selected;
      tidy();
    }
  }
  if (controls.get("datatypeFilterCheckbox")) {
    for (const node of activeNodes) {
      if (["rdfs:datatype", "rdfs:literal"].includes(types.get(node))) {
        activeNodes.delete(node);
      }
    }
    tidy();
  }
  // Object-property and set-operator records were rejected before this admitted branch.
  if (controls.get("objectPropertyFilterCheckbox")) {
    links = incident();
    for (const node of activeNodes) {
      if (types.get(node) === "owl:thing" && !links.get(node).length) {
        activeNodes.delete(node);
      }
    }
    tidy();
  }
  if (controls.get("subclassFilterCheckbox")) {
    links = incident();
    const removeNodes = new Set(),
      removeEdges = new Set();
    for (const edge of activeEdges) {
      budget.check();
      if (edge.type !== "rdfs:subclassof") {
        continue;
      }
      const node = edge.from;
      const visited = new Set();
      const stack = [node];
      const relevant = new Set();
      let onlySubclass = true,
        outgoing = 0;
      while (stack.length) {
        budget.check();
        const current = stack.pop();
        for (const connected of links.get(current) ?? []) {
          budget.check();
          relevant.add(connected);
          if (connected.type !== "rdfs:subclassof") {
            onlySubclass = false;
          }
          if (connected.from === node) {
            outgoing++;
          }
          if (
            connected.type === "rdfs:subclassof" &&
            connected.to === current &&
            !visited.has(connected.from)
          ) {
            visited.add(connected.from);
            stack.push(connected.from);
          }
        }
      }
      if (onlySubclass && outgoing <= 1) {
        removeNodes.add(node);
        for (const connected of relevant) {
          removeEdges.add(connected);
        }
      }
    }
    for (const node of removeNodes) {
      activeNodes.delete(node);
    }
    activeEdges = activeEdges.filter((edge) => !removeEdges.has(edge));
    tidy();
  }
  if (controls.get("disjointFilterCheckbox")) {
    activeEdges = activeEdges.filter((edge) => {
      budget.check();
      return edge.type !== "owl:disjointwith";
    });
  }
  return { nodes: activeNodes, edges: new Set(activeEdges) };
}

/** Construct every B3 value from explicit saved claims, after canonical topology generation. */
export function attachArtifact(source, input, joined, budget, policy) {
  const settings = input.settings;
  if (!settings?.global || !settings.filter || !settings.modes) {
    fail("MIGRATION_AMBIGUOUS", "/settings");
  }
  const global = settings.global;
  const zoom = numeric(global.zoom, "/settings/global/zoom", budget, {
    positive: true,
  });
  if (!global.translation) {
    fail("MIGRATION_AMBIGUOUS", "/settings/global/translation");
  }
  const translation = global.translation.map((value, index) =>
    numeric(value, `/settings/global/translation/${index}`, budget),
  );
  const control = choices(
    settings.filter.checkBox,
    filters,
    [],
    "/settings/filter/checkBox",
    budget,
  );
  const mode = choices(
    settings.modes.checkBox,
    modes,
    optionalModes,
    "/settings/modes/checkBox",
    budget,
  );
  const degree = numeric(
    settings.filter.degreeSliderValue,
    "/settings/filter/degreeSliderValue",
    budget,
    { integer: true },
  );
  let labelSelection;
  if (global.language === "IRI-based") {
    labelSelection = { mode: "iri" };
  } else if (global.language === "undefined") {
    labelSelection = { mode: "untagged" };
  } else {
    if (global.language === "default") {
      fail("MIGRATION_AMBIGUOUS", "/settings/global/language");
    }
    labelSelection = {
      mode: "language",
      range: legacyScalar(
        global.language,
        "LanguageTag",
        "/settings/global/language",
        budget,
      ),
    };
  }
  const prefixes = new Map(
    Object.entries(defaults).map(([prefix, iri]) => [prefix, { iri }]),
  );
  function binding(prefix, iri, pointer) {
    budget.check();
    const prior = prefixes.get(prefix);
    if (prior?.pointer) {
      policy.drop(prior.pointer);
    }
    prefixes.set(prefix, { iri, pointer });
  }
  for (const [index, { name, iri }] of (input.namespace ?? []).entries()) {
    binding(name, iri, `/namespace/${index}`);
  }
  for (const [name, iri] of Object.entries(input.header?.prefixList ?? {})) {
    binding(name, iri, at("/header/prefixList", name));
  }
  const bindings = [...prefixes].map(([prefix, { iri, pointer }]) => {
    if (!/^(?:[A-Za-z][A-Za-z0-9_-]*)?$/.test(prefix)) {
      fail("MIGRATION_AMBIGUOUS", pointer ?? "/namespace");
    }
    return { prefix, iri };
  });
  const occurrences = source.structural.occurrences;
  const nodeByRole = new Map(),
    edgeByConstruct = new Map(),
    labelByEdge = new Map();
  const positionable = new Set(),
    nodes = new Set(),
    types = new Map();
  for (const occurrence of occurrences) {
    budget.check();
    if (
      occurrence.kind === "class-node" ||
      occurrence.kind === "datatype-node"
    ) {
      nodes.add(occurrence.id);
      positionable.add(occurrence.id);
      for (const id of occurrence.targets ?? [occurrence.target]) {
        if (!nodeByRole.has(id)) {
          nodeByRole.set(id, []);
        }
        nodeByRole.get(id).push(occurrence.id);
      }
    } else if (occurrence.kind === "label") {
      positionable.add(occurrence.id);
      labelByEdge.set(occurrence.edge, occurrence.id);
    } else if (occurrence.construct) {
      if (!edgeByConstruct.has(occurrence.construct)) {
        edgeByConstruct.set(occurrence.construct, []);
      }
      edgeByConstruct.get(occurrence.construct).push(occurrence);
    }
  }
  const placements = new Map(),
    correspondences = new Map(),
    edges = [];
  for (const row of joined.all.values()) {
    budget.check();
    let target, edge;
    if (row.role) {
      const candidates = nodeByRole.get(row.role) ?? [];
      if (candidates.length !== 1) {
        fail("MIGRATION_AMBIGUOUS", row.pointer);
      }
      target = candidates[0];
      types.set(target, row.type);
    } else {
      const candidates = edgeByConstruct.get(row.construct) ?? [];
      if (candidates.length !== 1) {
        fail("MIGRATION_AMBIGUOUS", row.pointer);
      }
      const occurrence = candidates[0];
      edge = occurrence;
      target = labelByEdge.get(occurrence.id);
      const domain = nodeByRole.get(joined.all.get(row.fields.domain).role);
      const range = nodeByRole.get(joined.all.get(row.fields.range).role);
      if (domain?.length !== 1 || range?.length !== 1) {
        fail("MIGRATION_AMBIGUOUS", row.pointer);
      }
      edges.push({
        from: domain[0],
        to: range[0],
        type: row.type,
        occurrence: occurrence.id,
        row,
      });
    }
    // B2 disjoint edges have no label and B3 does not place edges.
    if (edge?.kind === "disjoint-edge") {
      for (const key of ["pos", "pinned"]) {
        if (Object.hasOwn(row.fields, key)) {
          policy.drop(row.locations.get(key));
        }
      }
      continue;
    }
    if (!target) {
      fail("MIGRATION_AMBIGUOUS", row.pointer);
    }
    correspondences.set(row, target);
    const hasPosition = Object.hasOwn(row.fields, "pos"),
      hasPin = Object.hasOwn(row.fields, "pinned");
    if (hasPosition !== hasPin) {
      fail(
        "MIGRATION_AMBIGUOUS",
        row.locations.get(hasPosition ? "pos" : "pinned"),
      );
    }
    if (hasPosition) {
      const [x, y] = row.fields.pos;
      const placement = {
        occurrence: target,
        position: { x, y },
        pinned: row.fields.pinned,
      };
      if (
        placements.has(target) &&
        JSON.stringify(placements.get(target)) !== JSON.stringify(placement)
      ) {
        fail("MIGRATION_AMBIGUOUS", row.locations.get("pos"));
      }
      placements.set(target, placement);
    }
  }
  for (const occurrence of positionable) {
    if (!placements.has(occurrence)) {
      fail("MIGRATION_AMBIGUOUS", "/settings");
    }
  }
  const visible = visibility(nodes, edges, types, control, degree, budget);
  const hidden = new Set([...nodes].filter((node) => !visible.nodes.has(node)));
  // Multiple legacy records may name the same canonical edge. Conflicting visibility is not a choice rule.
  const edgeVisibility = new Map();
  for (const edge of edges) {
    const value = visible.edges.has(edge);
    if (
      edgeVisibility.has(edge.occurrence) &&
      edgeVisibility.get(edge.occurrence) !== value
    ) {
      fail("MIGRATION_AMBIGUOUS", edge.row.pointer);
    }
    edgeVisibility.set(edge.occurrence, value);
    if (!value) {
      hidden.add(edge.occurrence);
    }
  }
  for (const occurrence of occurrences) {
    budget.check();
    if (occurrence.kind.endsWith("-edge")) {
      if (
        (occurrence.ends ?? [occurrence.from, occurrence.to]).some((id) =>
          hidden.has(id),
        )
      ) {
        hidden.add(occurrence.id);
      }
    }
    if (occurrence.kind === "label" && hidden.has(occurrence.edge)) {
      hidden.add(occurrence.id);
    }
  }
  const viewport = policy.resolve("viewport", "/settings/global/translation");
  const center = {
    x: numeric(
      (viewport.width / 2 - translation[0]) / zoom,
      "/settings/global/translation",
      budget,
    ),
    y: numeric(
      (viewport.height / 2 - translation[1]) / zoom,
      "/settings/global/translation",
      budget,
    ),
  };
  if (global.paused !== undefined) {
    policy.drop("/settings/global/paused");
  }
  if (settings.gravity) {
    policy.drop("/settings/gravity");
  }
  policy.drop("/settings/filter");
  for (const key of ["colorSwitchState", "maxLabelWidth"]) {
    if (settings.modes[key] !== undefined) {
      policy.drop(`/settings/modes/${key}`);
    }
  }
  settings.modes.checkBox.forEach(({ id }, index) => {
    if (optionalModes.includes(id)) {
      policy.drop(`/settings/modes/checkBox/${index}`);
    }
  });
  source.visualization = {
    placements: [...placements.values()],
    camera: { center, zoom },
    hidden: [...hidden],
    labelSelection,
    prefixes: bindings,
    display: {
      compactNotation: mode.get("compactnotationModuleCheckbox"),
      nodeScaling: mode.get("nodescalingModuleCheckbox")
        ? "direct-membership"
        : "uniform",
      externalColoring: mode.get("colorexternalsModuleCheckbox"),
    },
  };
}
