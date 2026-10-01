import { canonicalize, profiles } from "../index.js";
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
