import {
  compatibleArtifactProfile,
  compatibleSourceContract,
  compatibleDocumentContract,
  compatibleMappingContract,
  validateQualifications,
} from "./compatibleContract.js";
import { profiles } from "./profiles.js";
import { validateFields } from "./typedValues.js";
import { validateGraph, validateMeaning } from "./validateGraph.js";
import { validateProjection, validateArtifact } from "./projection.js";
import { issueIds } from "./internalRdf.js";
import { refineDataset } from "./refinedRdf.js";
import { orderSets, jsonBytes, compareBytes } from "./canonicalJson.js";
import { fail } from "./errors.js";
import { deepFreeze } from "./snapshot.js";

/** Operates only on a caller-owned snapshot; root admission still owns encode authority. */
export async function admitCompatibleArtifact(source, budget, originalBytes) {
  validateFields(source, compatibleSourceContract, budget);
  const core = {
    structural: source.structural,
    visualization: source.visualization,
  };
  const graph = validateGraph(
    core,
    profiles.artifact,
    budget,
    originalBytes !== undefined,
  );
  const context = validateMeaning(core, graph, budget);
  validateProjection(core, context, budget);
  validateArtifact(core, context, budget);
  validateQualifications(source, budget, originalBytes !== undefined);
  const document = { profile: compatibleArtifactProfile, ...source };
  const correspondence = await issueIds(document, budget, {
    contract: compatibleMappingContract(document),
    refine: refineDataset,
  });
  orderSets(document, compatibleDocumentContract, budget);
  const bytes = jsonBytes(document);
  budget.check();
  if (originalBytes && compareBytes(bytes, originalBytes) !== 0) {
    fail("NON_CANONICAL_BYTES");
  }
  deepFreeze(document);
  budget.check();
  return { document, bytes, correspondence };
}
