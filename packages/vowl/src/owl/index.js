import { canonicalize, profiles, inspectModel } from "../index.js";
import { admitOwlModel } from "../modelAdmission.js";
import { prepareCompatibleView } from "./compatibleLoading.js";
import { fail, VowlError } from "../errors.js";
import { optionRecord, ResourceBudget } from "../resourceBudget.js";
import { canonicalizeWithBudget } from "../operationBudget.js";
import { snapshotBytes, deepFreeze } from "../snapshot.js";
import {
  documentContext,
  loadClosure,
  validateDocumentIri,
  resolveDocumentFormat,
} from "./loading.js";
import { buildModel } from "./modelBuilder.js";
import {
  mappingPolicy,
  checkClosure,
  validateMappingProfile,
} from "./policy.js";
import { serializeModelRdf } from "./exportRdf.js";

/** Serialize the current admitted semantic revision, not historical source. */
export async function exportModelRdf(model, options) {
  const opts = optionRecord(options, ["signal", "limits"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    return Object.freeze(serializeModelRdf(inspectModel(model), budget));
  } finally {
    budget.dispose();
  }
}

const optionChecks = {
  documentIri: validateDocumentIri,
  mediaType: resolveDocumentFormat,
  mappingProfile: validateMappingProfile,
  resolveImport(value) {
    if (value !== undefined && typeof value !== "function") {
      fail("OPTION_INVALID", "/resolveImport");
    }
  },
};

/** Open a qualified live OWL model; canonical identity is a separate operation. */
export async function openOwl(input, options) {
  const opts = optionRecord(options, [
    "documentIri",
    "mediaType",
    "resolveImport",
    "signal",
    "limits",
  ]);
  const checks = {
    documentIri: optionChecks.documentIri,
    mediaType: optionChecks.mediaType,
    resolveImport: optionChecks.resolveImport,
  };
  const budget = new ResourceBudget(opts, performance.now(), checks);
  try {
    const context = documentContext(opts.documentIri, opts.mediaType, budget);
    const bytes = snapshotBytes(input, budget);
    const prepared = await prepareCompatibleView(bytes, context, opts, budget);
    return admitOwlModel(
      inspectModel,
      prepared.source,
      prepared.retained,
      opts.documentIri,
      budget,
    );
  } catch (error) {
    budget.check();
    if (error instanceof VowlError) {
      throw error;
    }
    throw new VowlError(
      "DEPENDENCY_FAILURE",
      "OWL live admission dependency failed",
      {
        details: { stage: "owl-live-admission" },
      },
    );
  } finally {
    budget.dispose();
  }
}

/** A9 source-preserving OWL ingress. Acquisition is only through the explicit callback. */
export async function fromOwl(input, options) {
  const startedAt = performance.now();
  const opts = optionRecord(options, [
    "documentIri",
    "mediaType",
    "mappingProfile",
    "resolveImport",
    "signal",
    "limits",
  ]);
  const budget = new ResourceBudget(opts, startedAt, optionChecks);
  try {
    const policy = mappingPolicy(opts.mappingProfile, budget);
    const context = documentContext(opts.documentIri, opts.mediaType, budget);
    const bytes = snapshotBytes(input, budget);
    const loaded = await loadClosure(bytes, context, opts, budget, policy);
    await checkClosure(loaded, budget, policy);
    const source = buildModel(loaded, budget, policy);
    const document = await canonicalizeWithBudget(
      canonicalize,
      source,
      { profile: profiles.structuralContent },
      budget,
    );
    const result = deepFreeze({
      document,
      mappingProfile: policy.profile,
      diagnostics: policy.finish(),
    });
    budget.check();
    return result;
  } catch (error) {
    budget.check();
    if (error instanceof VowlError) {
      throw error;
    }
    throw new VowlError("DEPENDENCY_FAILURE", "OWL mapping dependency failed", {
      details: { stage: "owl-mapping" },
    });
  } finally {
    budget.dispose();
  }
}
