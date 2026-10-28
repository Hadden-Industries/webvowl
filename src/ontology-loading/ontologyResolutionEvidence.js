import * as validate from "./ontologyCacheValidators.js";
import {
  ontologyDigest,
  ontologyRecordIdentity,
  ontologySourceIri,
  ontologySourceKey,
  OntologyCacheError,
} from "./ontologySourceIdentity.js";

/** Native generated schemas own shapes. Consumers add cross-record/context and integrity checks. */
export function validateOntologyCacheRecord(kind, value) {
  if (!validate[kind]?.(value)) {
    throw new OntologyCacheError();
  }
  return value;
}

export function ontologyCachePaths(origin) {
  const digestPath = (prefix, digest) =>
    `${origin}/ontology/cache/${prefix}/sha256/${ontologyDigest(digest)}.json`;
  return Object.freeze({
    pointer: (key) =>
      `${origin}/ontology/cache/provenance/sources/${ontologyDigest(key)}.json`,
    resolution: (identity) => digestPath("resolutions", identity),
    version: (identity) => digestPath("versions", identity),
    validation: (identity) => digestPath("validations", identity),
    policy: (identity) => digestPath("policies", identity),
    artifact: (identity) =>
      `${origin}/ontology/cache/artifacts/sha256/${ontologyDigest(identity)}`,
    status: (key) =>
      `${origin}/ontology/materializations/${ontologyDigest(key)}`,
  });
}

function same(left, right) {
  if (left !== right) {
    throw new OntologyCacheError();
  }
}

/** Verify the complete immutable evidence chain before any artifact can enter the worker. */
export async function verifyOntologyResolution({
  requestedDocumentIri,
  resolutionIdentity,
  binding,
  readJson,
  paths,
  approvedPolicyFingerprints,
}) {
  const sourceKey = await ontologySourceKey(requestedDocumentIri);
  const resolution = validateOntologyCacheRecord(
    "resolution",
    await readJson(paths.resolution(resolutionIdentity)),
  );
  same(resolution.resolutionIdentity, resolutionIdentity);
  const resolutionInput = Object.fromEntries(
    Object.entries(resolution).filter(([key]) => key !== "resolutionIdentity"),
  );
  same(
    await ontologyRecordIdentity("resolution", resolutionInput),
    resolutionIdentity,
  );
  same(resolution.sourceKey, sourceKey);
  same(resolution.requestedDocumentIri, requestedDocumentIri);
  ontologySourceIri(resolution.retrievalIri);
  ontologySourceIri(resolution.effectiveRetrievalIri);
  ontologySourceIri(resolution.parserDocumentIri);
  same(resolution.parserDocumentIri, resolution.effectiveRetrievalIri);
  same(resolution.artifactIri, paths.artifact(resolution.artifactSha256));
  same(
    resolution.validationIri,
    paths.validation(resolution.validationIdentity),
  );
  same(
    resolution.loaderPolicyIri,
    paths.policy(resolution.loaderProfileFingerprint),
  );
  if (
    !approvedPolicyFingerprints.includes(resolution.loaderProfileFingerprint)
  ) {
    throw new OntologyCacheError("CACHE_POLICY_UNSUPPORTED");
  }
  if (binding) {
    for (const key of [
      "sourceVersionIdentity",
      "resolutionIdentity",
      "validationIdentity",
      "artifactSha256",
      "artifactByteLength",
      "artifactIri",
      "validationIri",
    ]) {
      same(binding[key], resolution[key]);
    }
    same(binding.resolutionIri, paths.resolution(resolutionIdentity));
    same(binding.versionIri, paths.version(resolution.sourceVersionIdentity));
  }
  const version = validateOntologyCacheRecord(
    "version",
    await readJson(paths.version(resolution.sourceVersionIdentity)),
  );
  for (const key of [
    "sourceVersionIdentity",
    "sourceKey",
    "requestedDocumentIri",
    "artifactSha256",
    "artifactByteLength",
    "effectiveRetrievalIri",
    "parserDocumentIri",
  ]) {
    same(version[key], resolution[key]);
  }
  const versionInput = Object.fromEntries(
    [
      "sourceKey",
      "artifactSha256",
      "effectiveRetrievalIri",
      "parserDocumentIri",
    ].map((key) => [key, version[key]]),
  );
  same(
    await ontologyRecordIdentity("source-version", versionInput),
    resolution.sourceVersionIdentity,
  );
  const validation = validateOntologyCacheRecord(
    "validation",
    await readJson(resolution.validationIri, 262144),
  );
  same(validation.validationIdentity, resolution.validationIdentity);
  same(
    await ontologyRecordIdentity(
      "document-validation",
      validation.identityInputs,
    ),
    resolution.validationIdentity,
  );
  for (const key of Object.keys(validation.identityInputs)) {
    same(validation.identityInputs[key], resolution[key]);
  }
  same(validation.sourceAssessment, resolution.sourceAssessment);
  const policyRecord = validateOntologyCacheRecord(
    "policy",
    await readJson(resolution.loaderPolicyIri, 262144),
  );
  same(
    policyRecord.loaderProfileFingerprint,
    resolution.loaderProfileFingerprint,
  );
  same(
    await ontologyRecordIdentity("loader-policy", policyRecord.policy),
    resolution.loaderProfileFingerprint,
  );
  same(
    await ontologyRecordIdentity(
      "parser-artifact",
      policyRecord.policy.owlapiArtifact,
    ),
    resolution.owlapiArtifactIdentity,
  );
  same(
    await ontologyRecordIdentity("request-variant", resolution.requestVariant),
    resolution.requestVariantFingerprint,
  );
  same(
    await ontologyRecordIdentity(
      "request-variant",
      policyRecord.policy.requestVariant,
    ),
    resolution.requestVariantFingerprint,
  );
  return Object.freeze(resolution);
}
