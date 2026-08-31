module.exports = function prefixRepresentationModule(graph) {
  /** variable defs **/
  const prefixRepresentationModule = {};

  let currentPrefixModel;

  prefixRepresentationModule.updatePrefixModel = function () {
    if (graph && typeof graph.options === "function") {
      currentPrefixModel = graph.options().prefixList();
    }
  };

  /**
   * Validates whether a given string is a well-formed absolute URL/URI
   * (supporting HTTP, HTTPS, and FTP protocols).
   *
   * Replaces legacy regex that used a hardcoded TLD whitelist with standard WHATWG
   * URL parsing to support all modern TLDs (e.g. .tech, .online, .cloud, .md),
   * IPv4/IPv6 addresses, localhost, and custom ports.
   *
   * @param {string} str - Candidate URL string to validate.
   * @returns {boolean} True if the string is a valid absolute HTTP/HTTPS/FTP URL.
   */
  function validURL(str) {
    if (!str || typeof str !== "string") {
      return false;
    }

    // Fast check: CURIEs / Prefixed QNames (such as "owl:Thing", "foaf:Person", ":MyClass")
    // contain colons without a protocol scheme ("http://", etc.) and should NOT be parsed as URLs.
    if (
      /^([a-zA-Z0-9_.-]*):([a-zA-Z0-9_.~%!$&'()*+,;=-]*)$/.test(str) &&
      !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(str)
    ) {
      return false;
    }

    try {
      if (typeof URL.canParse === "function") {
        if (!URL.canParse(str)) {
          return false;
        }
      }
      const parsed = new URL(str);
      return (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:" ||
        parsed.protocol === "ftp:"
      );
    } catch {
      return false;
    }
  }

  prefixRepresentationModule.validURL = function (url) {
    return validURL(url);
  };

  /**
   * Checks whether an IRI representation is formatted as a prefixed name (CURIE / QName)
   * such as "rdfs:label", "owl:Thing", or ":OntologyClass".
   *
   * @param {string} iri - The IRI representation string to test.
   * @returns {boolean} True if the string is a valid prefixed name.
   */
  prefixRepresentationModule.isPrefixedRepresentation = function (iri) {
    if (!iri || typeof iri !== "string") {
      return false;
    }
    // If it's a valid absolute URL (e.g. "https://example.tech/ontology#Item"), it is not a CURIE
    if (validURL(iri)) {
      return false;
    }
    // Match optional prefix name + ":" + local name
    return /^([a-zA-Z0-9_.-]*):([a-zA-Z0-9_.~%!$&'()*+,;=-]*)$/.test(iri);
  };

  /**
   * Formats an IRI for Turtle (TTL) serialization syntax:
   * - Prefixed names (CURIEs like "owl:Thing", ":MyClass") remain unbracketed.
   * - Un-prefixed absolute IRIs are enclosed in angle brackets (e.g. "<https://example.tech/ns#Item>").
   *
   * @param {string} iri - The IRI string (prefixed or absolute) to format.
   * @returns {string} The Turtle-safe representation.
   */
  prefixRepresentationModule.formatForTTL = function (iri) {
    if (!iri || typeof iri !== "string") {
      return "";
    }
    if (prefixRepresentationModule.isPrefixedRepresentation(iri)) {
      return iri;
    }
    // If already enclosed in angle brackets, return as-is
    if (iri.startsWith("<") && iri.endsWith(">")) {
      return iri;
    }
    return "<" + iri + ">";
  };

  function splitURLIntoBaseAndResource(fullURL) {
    let splitedURL = { base: "", resource: "" };
    if (fullURL === undefined) {
      splitedURL = { base: "ERROR", resource: "NOT FOUND" };
      return splitedURL;
    }

    let resource, base;
    // check if there is a last hashTag
    if (fullURL.indexOf("#") > -1) {
      resource = fullURL.substring(fullURL.lastIndexOf("#") + 1);
      base = fullURL.substring(0, fullURL.length - resource.length);
      // overwrite base if it is ontologyIri;
      if (base === graph.options().getGeneralMetaObjectProperty("iri")) {
        base = ":";
      }
      splitedURL.base = base;
      splitedURL.resource = resource;
    } else {
      resource = fullURL.substring(fullURL.lastIndexOf("/") + 1);
      base = fullURL.substring(0, fullURL.length - resource.length);
      // overwrite base if it is ontologyIri;
      if (base === graph.options().getGeneralMetaObjectProperty("iri")) {
        base = ":";
      }
      splitedURL.base = base;
      splitedURL.resource = resource;
    }
    return splitedURL;
  }

  prefixRepresentationModule.getPrefixRepresentationForFullURI = function (
    fullURL,
  ) {
    prefixRepresentationModule.updatePrefixModel();
    const splittedURL = splitURLIntoBaseAndResource(fullURL);

    // lazy approach , for
    // loop over prefix model
    for (const name in currentPrefixModel) {
      if (Object.prototype.hasOwnProperty.call(currentPrefixModel, name)) {
        // THIS IS CASE SENSITIVE!
        if (currentPrefixModel[name] === splittedURL.base) {
          return name + ":" + splittedURL.resource;
        }
      }
    }

    if (splittedURL.base === ":") {
      return ":" + splittedURL.resource;
    }

    return fullURL;
  };

  return prefixRepresentationModule;
};
