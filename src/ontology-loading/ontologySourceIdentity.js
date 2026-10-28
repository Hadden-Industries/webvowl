import canonicalize from "canonicalize";
import { isIri } from "@hyperjump/uri";

const encoder = new TextEncoder();

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
  return ontologySha256(encoder.encode(ontologySourceIri(iri)));
}

/** Provider-owned domain separation and RFC 8785 encoding, using the native JCS library. */
export function ontologyRecordIdentity(domain, value) {
  return ontologySha256(
    encoder.encode(
      `hadden-ontology-cache/${domain}/v1\n${canonicalize(value)}`,
    ),
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
