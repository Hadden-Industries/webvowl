import * as validate from "./ontologyCacheValidators.js";
import { owlMappingDefinitions } from "./owlMappingDefinitions.js";
import {
  ontologyDigest,
  ontologyRecordIdentity,
  ontologySourceIri,
  ontologySourceKey,
  OntologyCacheError,
  isOntologyImportIri,
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

function verifyCuratedCapture(resolution) {
  const capture = resolution.archiveCapture;
  if (new TextEncoder().encode(JSON.stringify(capture)).byteLength > 8192) {
    throw new OntologyCacheError();
  }
  for (const iri of [capture.archiveIri, capture.originalDocumentIri]) {
    ontologySourceIri(iri);
    const url = new URL(iri);
    same(url.href, iri);
    same(url.hash, "");
  }
  same(new URL(capture.archiveIri).protocol, "https:");
  const capturedAt = Date.parse(capture.capturedAt);
  if (!Number.isFinite(capturedAt) || capturedAt > Date.now()) {
    throw new OntologyCacheError();
  }
  same(new Date(capturedAt).toISOString(), capture.capturedAt);
  for (const value of [
    capture.archiveMediaType,
    ...Object.values(capture.knownOriginalHeaders),
  ]) {
    if (
      [...value].some((character) => {
        const code = character.codePointAt(0);
        return code < 32 || code === 127;
      })
    ) {
      throw new OntologyCacheError();
    }
  }
  same(resolution.requestVariant, null);
  same(resolution.originMetadata, null);
  for (const field of [
    "retrievalIri",
    "effectiveRetrievalIri",
    "parserDocumentIri",
  ]) {
    same(resolution[field], capture.originalDocumentIri);
  }
  same(resolution.acquiredAt, capture.capturedAt);
  same(resolution.checkedAt, capture.capturedAt);
}

// Observe each rejection immediately, including reads that an earlier failed
// check makes unnecessary. Unwrap in the established validation/error order.
async function readOutcome(readJson, url, limit) {
  try {
    return { ok: true, value: await readJson(url, limit) };
  } catch (error) {
    return { ok: false, error };
  }
}
async function readValue(pending) {
  const outcome = await pending;
  if (!outcome.ok) {
    throw outcome.error;
  }
  return outcome.value;
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
  if (resolution.publicationDisposition === "CURATED_PUBLIC_ARCHIVE") {
    try {
      verifyCuratedCapture(resolution);
    } catch {
      throw new OntologyCacheError();
    }
  }
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
  // Only verified same-origin, digest-bound paths reach this boundary. These
  // three bounded records are independent reads; all checks below still run
  // before the caller can acquire/consume the artifact.
  const versionRead = readOutcome(
    readJson,
    paths.version(resolution.sourceVersionIdentity),
  );
  const validationRead = readOutcome(
    readJson,
    resolution.validationIri,
    262144,
  );
  const policyRead = readOutcome(readJson, resolution.loaderPolicyIri, 262144);
  const version = validateOntologyCacheRecord(
    "version",
    await readValue(versionRead),
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
    await readValue(validationRead),
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
    await readValue(policyRead),
  );
  same(
    policyRecord.loaderProfileFingerprint,
    resolution.loaderProfileFingerprint,
  );
  same(
    await ontologyRecordIdentity("loader-policy", policyRecord.policy),
    resolution.loaderProfileFingerprint,
  );
  same(validation.validationProfileId, policyRecord.policy.validationProfileId);
  same(validation.parseMode, policyRecord.policy.parseMode);
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
  if (resolution.publicationDisposition !== "CURATED_PUBLIC_ARCHIVE") {
    same(
      await ontologyRecordIdentity(
        "request-variant",
        policyRecord.policy.requestVariant,
      ),
      resolution.requestVariantFingerprint,
    );
  }
  if (resolution.declaredImports) {
    if (
      resolution.declaredImports.iris.some((iri) => !isOntologyImportIri(iri))
    ) {
      throw new OntologyCacheError();
    }
    same(
      resolution.declaredImports.owlMappingStrategy,
      owlMappingDefinitions.choices.find(
        ({ parseMode }) => parseMode === validation.parseMode,
      )?.id,
    );
    same(
      resolution.declaredImports.iris.length,
      validation.importDeclarationCount,
    );
    same(
      resolution.declaredImports.iris.reduce(
        (size, iri) => size + new TextEncoder().encode(iri).byteLength,
        0,
      ),
      resolution.declaredImports.iriByteLength,
    );
  }
  return Object.freeze(resolution);
}
