import { fail } from "./errors.js";
import { profiles, categories, namespaces } from "./profiles.js";
import { envelope } from "./modelContract.js";
import { validateFields, walkTyped } from "./typedValues.js";
import {
  validateGraph,
  validateMeaning,
  createAssertionSupportLookup,
} from "./validateGraph.js";
import { validateProjection } from "./projection.js";
import { snapshotSource, deepFreeze } from "./snapshot.js";
import { jsonKey } from "./canonicalJson.js";
import { readmitSourceArchive } from "./sourceArchive.js";
import {
  compatibleArtifactProfile,
  qualificationContract,
  validateQualifications,
} from "./compatibleContract.js";
import {
  portableQualifications,
  inspectPortableQualifications,
  canonicalSourceQualifications,
} from "./portableQualifications.js";
import {
  compatibleViewPolicy,
  sourceMappingRule,
  inspectSource,
  guardSourceEdit,
  guardUncertainSourceEdits,
} from "./sourceInspection.js";
import { sourceStatementUncertainty } from "./retainedSourceStatements.js";
import {
  applyChanges,
  normalizeDraft,
  editingCorrespondence,
} from "./editing.js";

const models = new WeakMap();
const inspections = new WeakMap();
const archives = new WeakMap();
const policy =
  "https://haddenindustries.com/ontology/profiles/vowl/live/retained/v1";
const implementation = "vowl-live-checkpoint/1";
const editRule = `${policy}#atomic-edit`;
const collections = Object.keys(categories);
const allRecords = (structural) =>
  collections.flatMap((key) => structural[key]);

function validateStructure(structural, budget) {
  const source = { structural };
  validateFields(source, envelope(profiles.structuralContent), budget);
  const graph = validateGraph(
    source,
    profiles.structuralContent,
    budget,
    false,
  );
  const context = validateMeaning(source, graph, budget);
  validateProjection(source, context, budget);
}

function identity(structural, budget) {
  return allRecords(structural).map(({ id }) => {
    budget.check();
    return { previous: id, current: id };
  });
}

/** Local handles have no portable identity meaning; every transfer returns a map. */
function relabel(structural, budget) {
  const replacements = new Map();
  for (const [collection, prefix] of Object.entries(categories)) {
    structural[collection].forEach(({ id }, index) => {
      budget.check();
      replacements.set(id, `live:${prefix}:${index}`);
    });
  }
  walkTyped(
    { structural },
    envelope(profiles.structuralContent),
    (value, shape, _pointer, parent, field) => {
      budget.check();
      if (shape?.reference || shape?.id) {
        parent[field] = replacements.get(value);
      }
    },
  );
  return replacements;
}

function admit(state, budget, archive) {
  state = snapshotSource(state, budget);
  validateStructure(state.structural, budget);
  if (state.qualifications) {
    validateQualifications(state, budget);
  }
  const model = Object.freeze({ revision: state.revision });
  deepFreeze(state);
  budget.check();
  models.set(model, state);
  inspections.set(model, inspection(state, archive, budget));
  if (archive) {
    archives.set(model, archive);
  }
  return model;
}

export function liveState(model) {
  const state = models.get(model);
  if (!state) {
    fail("MODEL_NOT_ADMITTED");
  }
  return state;
}

/** Original acquisition bytes are historical evidence, never edited output. */
export function readLiveModelSource(model, documentId, budget) {
  liveState(model);
  if (typeof documentId !== "string" || documentId.length === 0) {
    fail("SOURCE_DOCUMENT_UNKNOWN");
  }
  const archive = archives.get(model);
  if (!archive) {
    fail("SOURCE_BYTES_UNAVAILABLE");
  }
  const document = archive.evidence.documents.find(
    ({ id }) => id === documentId,
  );
  if (!document) {
    fail("SOURCE_DOCUMENT_UNKNOWN");
  }
  budget.check();
  const bytes = archive.readBytes(documentId, budget);
  budget.check();
  return Object.freeze({
    bytes,
    documentIri: document.documentIri,
    mediaType: document.mediaType,
    digest: document.digest,
  });
}

/** Called only after the root surface verifies local canonical admission. */
export async function openCanonicalState(document, bytes, budget) {
  const source = snapshotSource({ structural: document.structural }, budget);
  const replacements = relabel(source.structural, budget);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  budget.check();
  const state = {
    revision: 0,
    origin: {
      kind: "canonical",
      profile: document.profile,
      inputDigest: [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      sourceAccess: "unavailable",
    },
    structural: source.structural,
    supports: allRecords(source.structural).map(({ id }) => ({
      record: id,
      assertions: [],
      derivations: [],
      origin: "canonical",
    })),
  };
  if (document.profile === compatibleArtifactProfile) {
    state.qualifications = snapshotSource(document.qualifications, budget);
    walkTyped(
      state.qualifications,
      qualificationContract,
      (value, shape, _pointer, parent, field) => {
        if (shape?.reference === "A") {
          parent[field] = replacements.get(value);
        }
      },
    );
  }
  const model = admit(state, budget);
  return deepFreeze({
    model,
    correspondence: [...replacements].map(([previous, current]) => ({
      previous,
      current,
    })),
  });
}

export function inspectLiveModel(model) {
  const state = liveState(model);
  return inspections.get(model) ?? inspection(state);
}

export function openOwlState(source, archive, documentIri, budget) {
  const owned = snapshotSource({ structural: source.structural }, budget);
  const replacements = relabel(owned.structural, budget);
  const root = archive.evidence.documents.find(
    (document) => document.documentIri === documentIri,
  );
  if (!root) {
    fail("MODEL_NOT_ADMITTED");
  }
  const model = admit(
    {
      revision: 0,
      origin: {
        kind: "owl",
        profile: compatibleViewPolicy,
        inputDigest: root.digest,
        sourceAccess: "available",
      },
      structural: owned.structural,
      supports: allRecords(owned.structural).map(({ id }) => ({
        record: id,
        assertions: [],
        derivations: [{ rule: sourceMappingRule, records: [] }],
        origin: "generated",
      })),
    },
    budget,
    archive,
  );
  return deepFreeze({
    model,
    correspondence: [...replacements].map(([previous, current]) => ({
      previous,
      current,
    })),
  });
}

function inspection(state, archive, budget) {
  const { occurrences, ...records } = state.structural;
  const index = new Map(
    allRecords(state.structural).map((record) => [record.id, record]),
  );
  const { support } = createAssertionSupportLookup(
    state.structural,
    (id) => index.get(id),
    budget,
  );
  const signature = new Map(
    records.roles.map((role) => [
      JSON.stringify([index.get(role.subject).iri, role.kind]),
      role.id,
    ]),
  );
  function references(value, type) {
    const required = new Set();
    walkTyped(value, type, (item, shape) => {
      budget.check();
      if (shape?.reference) {
        required.add(item);
      }
      // A5 signature dependencies are semantic even where the wire carries an
      // IRI scalar: deleting these roles must include their dependent facts.
      if (shape?.fields?.predicate) {
        required.add(
          signature.get(
            JSON.stringify([item.predicate, "annotation-property"]),
          ),
        );
      }
      if (shape?.fields?.lexical && ["typed", "language"].includes(item.kind)) {
        required.add(
          signature.get(
            JSON.stringify([
              item.kind === "language"
                ? namespaces.rdf + "langString"
                : item.datatype,
              "datatype",
            ]),
          ),
        );
      }
    });
    return required;
  }
  const dependencies = [
    ["subjects", "Subject"],
    ["roles", "Role"],
    ["expressions", "Expression"],
    ["constructs", "Construct"],
  ].flatMap(([collection, type]) =>
    records[collection].map((record) => {
      const required = references(record, type);
      if (record.kind === "assertion-anchor") {
        const supported = support(record.assertion);
        if (supported !== undefined) {
          required.add(supported);
        }
      }
      return { record: record.id, requires: [...required] };
    }),
  );
  // All values are recursively frozen, owned plain data, never dependency objects.
  return deepFreeze({
    revision: state.revision,
    origin: state.origin,
    records,
    dependencies,
    ontologyDependencies: [...references(records.ontology, "Ontology")],
    occurrences,
    documents: [],
    imports: [],
    assertions: [],
    sourceNodes: [],
    sourceStatements: [],
    supports: state.supports,
    qualifications: [],
    diagnostics: [],
    coverage: {
      basis: "unavailable",
      represented: null,
      qualified: null,
      excluded: null,
      unrepresented: null,
    },
    ...(archive ? inspectSource(state, archive, budget) : {}),
    ...(state.qualifications
      ? inspectPortableQualifications(state.qualifications)
      : {}),
  });
}

export function captureQualifications(model, budget) {
  const state = liveState(model);
  return state.qualifications
    ? snapshotSource(state.qualifications, budget)
    : archives.has(model)
      ? portableQualifications(state, archives.get(model), budget)
      : snapshotSource(canonicalSourceQualifications(state), budget);
}

export function editLiveModel(model, changes, budget) {
  const before = liveState(model);
  if (before.revision === Number.MAX_SAFE_INTEGER) {
    fail("MODEL_RESOURCE_LIMIT");
  }
  const source = snapshotSource({ structural: before.structural }, budget);
  const requests = snapshotSource({ changes }, budget, (pointer) =>
    /^\/changes\/[0-9]+\/record$/.test(pointer),
  ).changes;
  applyChanges(source, requests, budget);
  const archive = archives.get(model);
  if (archive) {
    guardSourceEdit(before, archive, requests, budget);
  }
  if (before.qualifications) {
    const uncertainty = sourceStatementUncertainty(
      before.qualifications.sourceStatements,
      budget,
    );
    guardUncertainSourceEdits(
      before,
      requests,
      uncertainty.iris,
      uncertainty.anonymous,
      budget,
    );
    guardSourceEdit(
      before,
      {
        evidence: {
          documents: [],
          diagnostics: before.qualifications.entries
            .filter(({ detail }) => detail.kind === "property")
            .map(({ code, detail }) => ({ diagnostic: { code, ...detail } })),
        },
      },
      requests,
      budget,
    );
  }
  const resolve = normalizeDraft(
    source,
    budget,
    allRecords(before.structural).map(({ id }) => id),
  );
  const correspondence = editingCorrespondence(before, source, resolve, budget);
  const renamedBefore = snapshotSource(
    { structural: before.structural },
    budget,
  );
  const successors = new Map(
    correspondence.map(({ previous, current }) => [previous, current]),
  );
  walkTyped(
    renamedBefore,
    envelope(profiles.structuralContent),
    (value, shape, _pointer, parent, field) => {
      budget.check();
      if (shape?.reference || shape?.id) {
        parent[field] = successors.get(value) ?? null;
      }
    },
  );
  const previousSupport = new Map(
    before.supports.map((support) => [support.record, support]),
  );
  const preserved = new Map();
  for (const collection of collections) {
    renamedBefore.structural[collection].forEach((record, index) => {
      budget.check();
      if (record.id === null) {
        return;
      }
      const key = jsonKey(record);
      const support = previousSupport.get(
        before.structural[collection][index].id,
      );
      if (!preserved.has(key) || support.origin !== "edit") {
        preserved.set(key, support);
      }
    });
  }
  const supports = allRecords(source.structural).map((record) => {
    budget.check();
    const support = preserved.get(jsonKey(record));
    return support
      ? { ...support, record: record.id }
      : {
          record: record.id,
          assertions: [],
          derivations: [{ rule: editRule, records: [] }],
          origin: "edit",
        };
  });
  const matched = new Set(correspondence.map(({ current }) => current));
  const created = allRecords(source.structural)
    .filter(({ id }) => !matched.has(id))
    .map(({ id }) => id);
  let qualifications;
  if (before.qualifications) {
    qualifications = snapshotSource(before.qualifications, budget);
    const retained = new Set(
      supports
        .filter(({ origin }) => origin !== "edit")
        .map(({ record }) => record),
    );
    for (const entry of qualifications.entries) {
      entry.records = [
        ...new Set(
          entry.records
            .map((id) => successors.get(id))
            .filter((id) => retained.has(id)),
        ),
      ];
    }
  }
  const next = admit(
    {
      revision: before.revision + 1,
      origin: before.origin,
      structural: source.structural,
      supports,
      ...(qualifications ? { qualifications } : {}),
    },
    budget,
    archive,
  );
  return deepFreeze({ model: next, correspondence, created });
}

export function checkpointLiveModel(model, budget) {
  const state = liveState(model);
  const checkpoint = deepFreeze(
    snapshotSource({ version: 1, policy, implementation, ...state }, budget),
  );
  const archive = archives.get(model);
  return archive
    ? Object.freeze({ ...checkpoint, source: archive.checkpoint(budget) })
    : checkpoint;
}

function fields(value, names) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  ) {
    fail("CHECKPOINT_INVALID");
  }
}

/** Checkpoint bytes convey structure, never local admission or provenance authority. */
export async function readmitLiveModel(input, budget) {
  let source;
  let hasSource = false;
  let plain = input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const descriptors = Object.getOwnPropertyDescriptors(input);
    hasSource = Object.hasOwn(descriptors, "source");
    if (hasSource) {
      const descriptor = descriptors.source;
      if (!descriptor.enumerable || !("value" in descriptor)) {
        fail("SOURCE_UNSAFE_VALUE", "/source");
      }
      source = descriptor.value;
      delete descriptors.source;
      plain = Object.create(Object.getPrototypeOf(input), descriptors);
    }
  }
  const checkpoint = snapshotSource(plain, budget);
  fields(checkpoint, [
    "version",
    "policy",
    "implementation",
    "revision",
    "origin",
    "structural",
    "supports",
    ...(checkpoint.origin?.profile === compatibleArtifactProfile
      ? ["qualifications"]
      : []),
  ]);
  if (
    checkpoint.version !== 1 ||
    checkpoint.policy !== policy ||
    checkpoint.implementation !== implementation
  ) {
    fail("CHECKPOINT_VERSION_UNSUPPORTED");
  }
  if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0) {
    fail("CHECKPOINT_INVALID");
  }
  const { origin } = checkpoint;
  fields(origin, ["kind", "profile", "inputDigest", "sourceAccess"]);
  if (
    !["canonical", "owl"].includes(origin.kind) ||
    (origin.kind === "canonical"
      ? ![...Object.values(profiles), compatibleArtifactProfile].includes(
          origin.profile,
        )
      : origin.profile !== compatibleViewPolicy) ||
    typeof origin.inputDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(origin.inputDigest) ||
    origin.sourceAccess !==
      (origin.kind === "owl" ? "available" : "unavailable") ||
    (origin.kind === "owl") !== hasSource
  ) {
    fail("CHECKPOINT_INVALID");
  }
  validateStructure(checkpoint.structural, budget);
  const remaining = new Set(
    allRecords(checkpoint.structural).map(({ id }) => id),
  );
  if (!Array.isArray(checkpoint.supports)) {
    fail("CHECKPOINT_INVALID");
  }
  for (const support of checkpoint.supports) {
    budget.check();
    fields(support, ["record", "assertions", "derivations", "origin"]);
    if (
      !remaining.delete(support.record) ||
      !Array.isArray(support.assertions) ||
      support.assertions.length ||
      !Array.isArray(support.derivations) ||
      !(
        origin.kind === "owl" ? ["generated", "edit"] : ["canonical", "edit"]
      ).includes(support.origin)
    ) {
      fail("CHECKPOINT_INVALID");
    }
    if (support.origin === "canonical") {
      if (support.derivations.length) {
        fail("CHECKPOINT_INVALID");
      }
    } else {
      if (support.derivations.length !== 1) {
        fail("CHECKPOINT_INVALID");
      }
      const derivation = support.derivations[0];
      fields(derivation, ["rule", "records"]);
      if (
        derivation.rule !==
          (support.origin === "generated" ? sourceMappingRule : editRule) ||
        !Array.isArray(derivation.records) ||
        derivation.records.length
      ) {
        fail("CHECKPOINT_INVALID");
      }
    }
  }
  if (remaining.size) {
    fail("CHECKPOINT_INVALID");
  }
  const archive =
    origin.kind === "owl"
      ? await readmitSourceArchive(source, budget)
      : undefined;
  if (
    archive &&
    !archive.evidence.documents.some(
      (document) => document.digest === origin.inputDigest,
    )
  ) {
    fail("CHECKPOINT_INVALID");
  }
  const model = admit(
    {
      revision: checkpoint.revision,
      origin,
      structural: checkpoint.structural,
      supports: checkpoint.supports,
      ...(checkpoint.qualifications
        ? { qualifications: checkpoint.qualifications }
        : {}),
    },
    budget,
    archive,
  );
  return deepFreeze({
    model,
    correspondence: identity(checkpoint.structural, budget),
  });
}
