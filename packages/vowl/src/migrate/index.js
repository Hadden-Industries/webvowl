import { optionRecord, ResourceBudget } from "../resourceBudget.js";
import { snapshotBytes, deepFreeze } from "../snapshot.js";
import { parseBytes } from "../lexicalJson.js";
import { canonicalize, profiles } from "../index.js";
import { canonicalizeWithBudget } from "../operationBudget.js";
import { VowlError } from "../errors.js";
import { migrationChecks, migrationPolicy } from "./policy.js";
import { validateLegacy, joinRecords } from "./grammar.js";
import { buildLegacyModel } from "./model.js";
import { attachArtifact } from "./artifact.js";

/** Explicit, one-way ingress for the pinned legacy exporter dialect. */
export async function migrate(input, options) {
  const startedAt = performance.now();
  const opts = optionRecord(options, [
    "dialect",
    "profile",
    "resolutions",
    "signal",
    "limits",
  ]);
  const budget = new ResourceBudget(
    opts,
    startedAt,
    migrationChecks(opts, startedAt),
  );
  try {
    const policy = migrationPolicy(opts, budget);
    const bytes = snapshotBytes(input, budget);
    const legacy = parseBytes(bytes, budget);
    validateLegacy(legacy, budget);
    const joined = joinRecords(legacy, budget);
    const source = buildLegacyModel(
      legacy,
      joined,
      opts.profile,
      budget,
      policy,
    );
    if (opts.profile === profiles.artifact) {
      attachArtifact(source, legacy, joined, budget, policy);
    }
    const diagnostics = policy.finish();
    const document = await canonicalizeWithBudget(
      canonicalize,
      source,
      { profile: opts.profile },
      budget,
    );
    budget.check();
    return deepFreeze({ document, dialect: opts.dialect, diagnostics });
  } catch (error) {
    budget.check();
    if (error instanceof VowlError) {
      throw error;
    }
    throw new VowlError(
      "DEPENDENCY_FAILURE",
      "Legacy migration dependency failed",
      { details: { stage: "legacy-migration" } },
    );
  } finally {
    budget.dispose();
  }
}
