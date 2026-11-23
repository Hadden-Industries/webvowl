import { canonicalize, profiles, inspectModel } from "../index.js";
import { admitOwlModel } from "../modelAdmission.js";
import { prepareCompatibleView } from "./compatibleLoading.js";
import { selectOwlMappingStrategy } from "../owlMappingStrategy.js";
import { fail, VowlError } from "../errors.js";
import { optionRecord, ResourceBudget } from "../resourceBudget.js";
import { canonicalizeWithBudget } from "../operationBudget.js";
import { snapshotBytes, deepFreeze } from "../snapshot.js";
import {
  documentContext,
  localDocumentContext,
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
  } catch (error) {
    budget.reportHostLimit(error);
    throw error;
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

/** Open qualified OWL, with optional external base context for a local root file. */
export async function openOwl(input, options) {
  const opts = optionRecord(options, [
    "documentIri",
    "localSource",
    "fallbackBaseIri",
    "mediaType",
    "owlMappingStrategy",
    "resolveImport",
    "signal",
    "limits",
  ]);
  const checks = {
    owlMappingStrategy: selectOwlMappingStrategy,
    mediaType(value) {
      if (value !== undefined) {
        optionChecks.mediaType(value);
      }
    },
    resolveImport: optionChecks.resolveImport,
  };
  const budget = new ResourceBudget(opts, performance.now(), checks);
  try {
    if (opts.localSource !== undefined && opts.localSource !== true) {
      fail("OPTION_INVALID", "/localSource");
    }
    const context = opts.localSource
      ? localDocumentContext(opts, budget)
      : documentContext(opts.documentIri, opts.mediaType, budget, "", true);
    if (!opts.localSource && opts.fallbackBaseIri !== undefined) {
      fail("OPTION_INVALID", "/fallbackBaseIri");
    }
    const bytes = snapshotBytes(input, budget);
    const prepared = await prepareCompatibleView(bytes, context, opts, budget);
    const admissionStartedAt = performance.now();
    const result = admitOwlModel(
      inspectModel,
      prepared.source,
      prepared.retained,
      opts.localSource ? null : opts.documentIri,
      budget,
    );
    performance.measure("webvowl.owl-model-admission", {
      start: admissionStartedAt,
      end: performance.now(),
    });
    return result;
  } catch (error) {
    budget.check();
    if (error instanceof VowlError) {
      throw error;
    }
    budget.reportHostLimit(error);
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
    budget.reportHostLimit(error);
    throw new VowlError("DEPENDENCY_FAILURE", "OWL mapping dependency failed", {
      details: { stage: "owl-mapping" },
    });
  } finally {
    budget.dispose();
  }
}
