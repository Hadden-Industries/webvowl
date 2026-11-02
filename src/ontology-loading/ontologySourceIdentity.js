import canonicalize from "canonicalize";
import { isIri } from "@hyperjump/uri";

const encoder = new TextEncoder();
// SHA-256 is a pure function of the exact preimage. Reuse only bounded textual
// identity preimages; decoded artifact bytes are always independently digested.
const identityDigests = new Map();
const maximumCachedIdentities = 128;
const maximumCachedIdentityCharacters = 16384;
function textIdentityDigest(text) {
  if (text.length > maximumCachedIdentityCharacters) {
    return ontologySha256(encoder.encode(text));
  }
  if (identityDigests.has(text)) {
    const digest = identityDigests.get(text);
    identityDigests.delete(text);
    identityDigests.set(text, digest);
    return digest;
  }
  const digest = ontologySha256(encoder.encode(text));
  if (identityDigests.size >= maximumCachedIdentities) {
    identityDigests.delete(identityDigests.keys().next().value);
  }
  identityDigests.set(text, digest);
  void digest.catch(() => {
    if (identityDigests.get(text) === digest) {
      identityDigests.delete(text);
    }
  });
  return digest;
}

/** Import metadata uses logical IRIs; lexer failures are not wire error details. */
export function isOntologyImportIri(value) {
  try {
    return typeof value === "string" && value.isWellFormed() && isIri(value);
  } catch {
    return false;
  }
}

/** Stable, bounded consumer failures never expose remote messages or source excerpts. */
export class OntologyCacheError extends Error {
  constructor(code = "CACHE_PROTOCOL_INVALID") {
    super("The ontology cache could not provide an eligible verified source.");
    this.name = "OntologyCacheError";
    this.code = code;
  }
}

/** Logical source identity is the exact accepted string, including case and fragments. */
export function ontologySourceIri(value) {
  if (
    typeof value !== "string" ||
    !isIri(value) ||
    !value.isWellFormed() ||
    encoder.encode(value).length > 4096 ||
    /\s|\\/u.test(value)
  ) {
    throw new OntologyCacheError();
  }
  const url = new URL(value);
  if (
    !/^https?:$/u.test(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname ||
    !/^https?:\/\//iu.test(value)
  ) {
    throw new OntologyCacheError();
  }
  return value;
}

/** Digest exact content-decoded bytes; never hash decoded ontology text. */
export async function ontologySha256(bytes) {
  return Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function ontologySourceKey(iri) {
  return textIdentityDigest(ontologySourceIri(iri));
}

/** Provider-owned domain separation and RFC 8785 encoding, using the native JCS library. */
export function ontologyRecordIdentity(domain, value) {
  return textIdentityDigest(
    `hadden-ontology-cache/${domain}/v1\n${canonicalize(value)}`,
  );
}

/** Every service link must equal a locally constructed HTTPS origin/path. */
export function ontologyServiceOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.username ||
    url.password
  ) {
    throw new OntologyCacheError();
  }
  return url.origin;
}

export function ontologyDigest(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new OntologyCacheError();
  }
  return value;
}
