const SOURCE_NAMES = new Map([["http://www.w3.org/2004/02/skos/core", "SKOS"]]);

export function ontologySourceName(iri) {
  return SOURCE_NAMES.get(iri) ?? iri ?? "Unnamed source";
}

export function sourceWebUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function formatSourceDate(value, { locale, timeZone } = {}) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "Not recorded";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

function storageName(source) {
  const origin = sourceWebUrl(source.artifactIri);
  if (!origin) {
    return "the ontology service";
  }
  const url = new URL(origin);
  return url.origin === "https://haddenindustries.com"
    ? "the Hadden Industries ontology service"
    : url.origin;
}

export function sourceCheckDescription(source, options) {
  const date = formatSourceDate(source.checkedAt, options);
  if (source.updateFailure?.code === "CACHE_OFFER_SUPERSEDED") {
    return "The available update changed. Check this document again before reloading.";
  }
  if (source.updateFailure) {
    return "Couldn’t load an update for this document. The loaded graph is still available.";
  }
  if (source.checkOutcome === "failed") {
    return ["SOURCE_REFRESH_COOLDOWN", "API_RATE_EXCEEDED"].includes(
      source.code,
    )
      ? "Update checks are temporarily limited. Try again later. The loaded graph is still available."
      : "Couldn’t check this document for changes. The loaded graph is still available.";
  }
  if (source.hasUpdate) {
    return "A newer copy is available. The graph still uses the loaded copy.";
  }
  if (source.checkOutcome === "reused") {
    return source.checkedAt
      ? `Using the check recorded on ${date}; no new publisher check was made.`
      : "No new publisher check was made. The previous check time is not recorded.";
  }
  if (source.checkOutcome === "checked") {
    return source.checkedAt
      ? `No changes found in this document. Checked ${date}.`
      : "The service completed a source check; its time was not recorded.";
  }
  return "";
}

function acquisitionDescription(source) {
  if (source.saved) {
    return `Loaded from a copy stored by ${source.storage}.`;
  }
  if (source.role === "import") {
    return "No saved service copy is recorded for this imported ontology.";
  }
  switch (source.kind) {
    case "ontology-text":
      return "Opened from a local file or entered ontology text.";
    case "ontology-bytes":
      return "Opened from a local file or supplied ontology document.";
    case "vowl-json-text":
    case "vowl-json-bytes":
      return "Opened a visualization from a local JSON file or supplied JSON.";
    case "ontology-document-iri":
      return "Opened from the selected URL; no saved service copy is recorded for this document.";
    case "vowl-json-url":
      return "Opened a visualization from the selected JSON URL.";
    default:
      return "Source acquisition details are not recorded.";
  }
}

/** User-facing source provenance and update status for Ontology Overview. */
export function presentOntologySources(state, importedIris = []) {
  const cache = state.source?.cache;
  const saved = cache?.sources ?? [];
  const expired = Boolean(
    cache &&
    (cache.loadGeneration !== state.loadGeneration ||
      cache.documentRevision !== state.documentRevision),
  );
  const only = saved.length === 1 ? saved[0] : undefined;
  const name = only
    ? ontologySourceName(only.requestedDocumentIri)
    : "saved sources";
  const checked = saved.filter(
    (source) => source.checkOutcome === "checked",
  ).length;
  const reused = saved.filter(
    (source) => source.checkOutcome === "reused",
  ).length;
  const failed = saved.filter(
    (source) => source.checkOutcome === "failed",
  ).length;
  const importCount = saved.filter((source) => source.role === "import").length;
  let message = only
    ? only.role === "import"
      ? `Includes a saved copy of ${name}.`
      : `Loaded from a saved copy of ${name}.`
    : importCount === saved.length
      ? `Includes saved copies of ${importCount} imported ontologies.`
      : `Ontology and ${importCount} ${importCount === 1 ? "import" : "imports"} loaded from saved copies.`;
  if (expired) {
    message =
      cache.loadGeneration !== state.loadGeneration
        ? "This source check belongs to an earlier load. Reopen the source before loading updates."
        : "This graph has edits. Reopen its source before loading updates.";
  } else if (cache?.code === "CACHE_OFFER_SUPERSEDED") {
    message =
      "The available update changed. Check for source updates again before reloading.";
  } else if (cache?.status === "checking") {
    message = `Checking ${name} for changes…`;
  } else if (cache?.status === "update-failed") {
    message =
      "Couldn’t load the source update. The loaded graph is still available. Check for source updates again before reloading.";
  } else if (cache?.status === "check-failed") {
    message = only
      ? `Couldn’t check ${name} for changes. The loaded graph is still available.`
      : `Checked ${checked} of ${saved.length} saved sources; reused ${reused} recent ${reused === 1 ? "result" : "results"}. ${failed} ${failed === 1 ? "document could" : "documents could"} not be checked.`;
    if (cache.hasUpdate) {
      message += " An update is available for another source.";
    }
  } else if (cache?.hasUpdate) {
    message = only
      ? `A newer copy of ${name} is available. The loaded graph has not changed.`
      : "Newer source copies are available. The loaded graph has not changed.";
  } else if (cache?.status === "checked") {
    message = only
      ? only.checkOutcome === "reused"
        ? `Using the last recorded check for ${name}.`
        : `No changes found in ${name}.`
      : `Checked ${checked} of ${saved.length} saved sources; reused ${reused} recent ${reused === 1 ? "result" : "results"}.`;
  }
  const root = saved.find((source) => source.role === "ontology");
  const sources = state.source
    ? [
        {
          ...(root ?? {}),
          requestedDocumentIri:
            root?.requestedDocumentIri ?? state.source.identity,
          label:
            state.source.displayName ??
            ontologySourceName(state.source.identity),
          role: "ontology",
          saved: Boolean(root),
          kind: state.source.kind,
        },
      ]
    : [];
  for (const source of saved.filter((source) => source.role !== "ontology")) {
    sources.push({
      ...source,
      label: ontologySourceName(source.requestedDocumentIri),
      saved: true,
    });
  }
  for (const iri of importedIris) {
    if (!sources.some((source) => source.requestedDocumentIri === iri)) {
      sources.push({
        requestedDocumentIri: iri,
        label: ontologySourceName(iri),
        role: "import",
        saved: false,
      });
    }
  }
  return {
    visible: Boolean(
      saved.length && ["ready", "relaxing"].includes(state.status),
    ),
    message,
    checkLabel: only
      ? `Check ${name} for updates`
      : "Check saved sources for updates",
    expired,
    checking: cache?.status === "checking",
    hasUpdate: Boolean(cache?.hasUpdate),
    sources: sources.map((source) => ({
      ...source,
      storage: storageName(source),
      description: acquisitionDescription({
        ...source,
        storage: storageName(source),
      }),
      ...(cache?.updateFailure &&
      cache.updateFailure.requestedDocumentIri === source.requestedDocumentIri
        ? { updateFailure: cache.updateFailure }
        : {}),
    })),
  };
}
