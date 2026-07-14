/**
 * Highly performant IRI resolver utilizing internal Map caching to bypass
 * repetitive string-slicing and indexing operations on high-volume ontologies.
 */
export class PerformanceIriResolver {
  #ontologyBaseIri;
  #resolvedCache;
  #localNameCache;
  #baseIriCache;

  /**
   * @param {string} ontologyBaseIri
   */
  constructor(ontologyBaseIri) {
    this.#ontologyBaseIri = ontologyBaseIri;
    this.#resolvedCache = new Map();
    this.#localNameCache = new Map();
    this.#baseIriCache = new Map();
  }

  /**
   * Resolves raw schema fragments and relative IRIs into absolute IRIs.
   * @param {string} iri 
   * @param {string} [baseIri]
   * @returns {string}
   */
  resolve(iri, baseIri) {
    const activeBase = baseIri || this.#ontologyBaseIri;
    if (!iri) return activeBase;
    
    const cacheKey = baseIri ? baseIri + "|" + iri : iri;
    if (this.#resolvedCache.has(cacheKey)) {
      return this.#resolvedCache.get(cacheKey);
    }
 
    const colonIdx = iri.indexOf(":");
    const slashIdx = iri.indexOf("/");
    let resolved = iri;
 
    // Is absolute IRI?
    if (!(colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx))) {
      if (activeBase) {
        if (iri === "") {
          resolved = activeBase;
        } else if (iri.startsWith("#")) {
          const baseHasHash = activeBase.endsWith("#");
          resolved = baseHasHash ? activeBase + iri.substring(1) : activeBase + iri;
        } else {
          const baseEndsWithHashOrSlash = activeBase.endsWith("#") || activeBase.endsWith("/");
          resolved = baseEndsWithHashOrSlash ? activeBase + iri : activeBase + "#" + iri;
        }
      }
    }
 
    this.#resolvedCache.set(cacheKey, resolved);
    return resolved;
  }

  /**
   * Splits and extracts the local name segment of an IRI.
   * @param {string} iri 
   * @returns {string}
   */
  getLocalName(iri) {
    if (!iri) return "";
    if (this.#localNameCache.has(iri)) {
      return this.#localNameCache.get(iri);
    }
    const hashIdx = iri.lastIndexOf("#");
    let local = iri;
    if (hashIdx !== -1) {
      local = iri.substring(hashIdx + 1);
    } else {
      const slashIdx = iri.lastIndexOf("/");
      if (slashIdx !== -1) {
        local = iri.substring(slashIdx + 1);
      }
    }
    this.#localNameCache.set(iri, local);
    return local;
  }

  /**
   * Splits and extracts the base namespace segment of an IRI.
   * @param {string} iri 
   * @returns {string}
   */
  getBaseIri(iri) {
    if (!iri) return "";
    if (this.#baseIriCache.has(iri)) {
      return this.#baseIriCache.get(iri);
    }
    const hashIdx = iri.lastIndexOf("#");
    let base = iri;
    if (hashIdx !== -1) {
      base = iri.substring(0, hashIdx);
    } else {
      const slashIdx = iri.lastIndexOf("/");
      if (slashIdx !== -1) {
        base = iri.substring(0, slashIdx);
      }
    }
    this.#baseIriCache.set(iri, base);
    return base;
  }
}
