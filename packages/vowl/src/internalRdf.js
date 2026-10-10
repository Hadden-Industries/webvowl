import rdf from "rdf-canonize";
import { VowlError, fail } from "./errors.js";
import { categories, namespaces, collectionTypeNames } from "./profiles.js";
import { descriptorFor, walkTyped } from "./typedValues.js";
import { envelope } from "./modelContract.js";
import { jsonKey } from "./canonicalJson.js";

const named = (value) => ({ termType: "NamedNode", value });
const literal = (value, datatype) => ({
  termType: "Literal",
  value,
  datatype: named(datatype),
  language: "",
});
const type = named(namespaces.rdf + "type");
const graph = { termType: "DefaultGraph", value: "" };

function mappingContract(document) {
  return {
    descriptor: envelope(document.profile, true),
    collections: Object.entries(categories).map(([collection, prefix]) => ({
      records: document.structural[collection],
      prefix,
      type: collectionTypeNames[collection],
    })),
  };
}

/** Map an already validated typed profile. Private conformance tests may inspect A6 artifacts. */
export function mapDataset(
  document,
  budget,
  contract = mappingContract(document),
) {
  const dataset = [];
  const primaryNodes = new Map();
  const encoded = new Set();
  let blankCount = 0;
  const blank = () => ({ termType: "BlankNode", value: `b${blankCount++}` });
  function emit(subject, predicate, object) {
    budget.charge("rdfQuads", 1, undefined, "RDF_RESOURCE_LIMIT");
    dataset.push({ subject, predicate, object, graph });
  }
  const typed = (node, kind) =>
    emit(node, type, named(namespaces.mapping + kind));
  for (const collection of contract.collections) {
    for (const record of collection.records) {
      budget.check();
      const node = blank();
      primaryNodes.set(record.id, node);
      typed(node, collection.type);
    }
  }
  function encode(value, descriptor, root) {
    budget.check();
    const shape = descriptorFor(value, descriptor, "");
    if (shape?.reference) {
      return primaryNodes.get(value);
    }
    if (shape?.fields) {
      const primary = Object.values(shape.fields).some((field) => field?.id);
      const node = primary ? primaryNodes.get(value.id) : (root ?? blank());
      if (primary && encoded.has(value.id)) {
        return node;
      }
      if (primary) {
        encoded.add(value.id);
      } else {
        typed(node, "Object");
      }
      for (const field of Object.keys(value).sort()) {
        if (!shape.fields[field]?.id) {
          emit(
            node,
            named(namespaces.mapping + "field/" + field),
            encode(value[field], shape.fields[field]),
          );
        }
      }
      return node;
    }
    if (shape?.items) {
      const node = blank();
      typed(node, shape.sequence ? "Sequence" : "Set");
      value.forEach((member, i) => {
        if (shape.sequence) {
          // Arrays/objects were charged in the snapshot; RDF sequence slots are additional.
          budget.charge("embeddedValues");
          const slot = blank();
          emit(node, named(namespaces.mapping + "slot"), slot);
          typed(slot, "Slot");
          emit(
            slot,
            named(namespaces.mapping + "index"),
            literal(String(i), namespaces.xsd + "nonNegativeInteger"),
          );
          emit(
            slot,
            named(namespaces.mapping + "value"),
            encode(member, shape.items),
          );
        } else {
          emit(
            node,
            named(namespaces.mapping + "member"),
            encode(member, shape.items),
          );
        }
      });
      return node;
    }
    if (shape === "IRI" || shape?.iriConstant) {
      return named(value);
    }
    if (shape?.token) {
      return literal(value, namespaces.mapping + "token");
    }
    if (shape === "Boolean") {
      return literal(value ? "true" : "false", namespaces.xsd + "boolean");
    }
    if (["Number", "PositiveNumber"].includes(shape)) {
      return literal(jsonKey(value), namespaces.mapping + "binary64");
    }
    return literal(value, namespaces.xsd + "string");
  }
  encode(document, contract.descriptor, named(namespaces.mapping + "root"));
  return { dataset, primaryNodes, blankCount };
}

/** Label the complete A6 dataset before assigning or replacing any public identifier. */
export async function issueIds(
  document,
  budget,
  { contract = mappingContract(document), refine } = {},
) {
  const mapped = mapDataset(document, budget, contract);
  const { primaryNodes, blankCount } = mapped;
  const dataset = refine
    ? (await refine(mapped.dataset, budget)).dataset
    : mapped.dataset;
  const canonicalIdMap = new Map();
  // The approved A8 amendment allows recursive work while retaining the absolute cap.
  const maxDeepIterations = Math.min(
    blankCount * blankCount,
    budget.limits.rdfDeepIterations,
  );
  try {
    await rdf.canonize(dataset, {
      algorithm: "RDFC-1.0",
      messageDigestAlgorithm: "sha256",
      canonicalIdMap,
      rejectURDNA2015: true,
      signal: budget.signal,
      maxDeepIterations,
    });
  } catch (cause) {
    budget.check();
    if (
      cause?.message ===
      `Maximum deep iterations exceeded (${maxDeepIterations}).`
    ) {
      fail("RDFC_RESOURCE_LIMIT", undefined, {
        limit: "rdfDeepIterations",
        maximum: maxDeepIterations,
      });
    }
    throw new VowlError("DEPENDENCY_FAILURE", "RDF canonicalization failed", {
      details: { stage: "rdfc" },
      cause,
    });
  }
  budget.check();
  const replacements = new Map();
  const issued = new Set();
  for (const { records, prefix } of contract.collections) {
    const ranked = records.map((record) => {
      const label = canonicalIdMap.get(primaryNodes.get(record.id).value);
      if (
        typeof label !== "string" ||
        !/^c14n(0|[1-9][0-9]*)$/.test(label) ||
        issued.has(label)
      ) {
        fail("DEPENDENCY_FAILURE", undefined, { stage: "id-map" });
      }
      issued.add(label);
      return { id: record.id, rank: BigInt(label.slice(4)) };
    });
    ranked.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
    ranked.forEach((entry, i) => replacements.set(entry.id, `${prefix}${i}`));
  }
  walkTyped(
    document,
    contract.descriptor,
    (value, shape, _pointer, parent, field) => {
      budget.check();
      if (shape?.reference || shape?.id) {
        parent[field] = replacements.get(value);
      }
    },
  );
  return replacements;
}
