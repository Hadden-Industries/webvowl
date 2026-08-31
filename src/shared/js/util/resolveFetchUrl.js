function protocolOf(baseUrl) {
  try {
    return new URL(String(baseUrl)).protocol;
  } catch {
    return baseUrl?.protocol;
  }
}

function resolveFetchUrl(resourceUrl, baseUrl = globalThis.location) {
  if (protocolOf(baseUrl) !== "https:") {
    return resourceUrl;
  }

  try {
    const url = new URL(resourceUrl);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return url.href;
    }
  } catch {
    // Relative and non-URL resource identifiers are not mixed-content URLs.
  }
  return resourceUrl;
}

module.exports = resolveFetchUrl;
