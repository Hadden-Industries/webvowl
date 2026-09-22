export const ONTOLOGY_SUMMARY_SECTIONS = Object.freeze([
  "ontologyHeader",
  "source",
  "visibleGraphCounts",
  "namespaces",
  "imports",
  "availableLabelLanguages",
  "selectedLanguage",
  "filters",
  "warnings",
]);

export function projectOntologySummary(summary, { ceiling, refuse }) {
  let toolResult = {
    operation: "get_ontology_summary",
    ...summary,
    isTruncated: summary.isTruncated === true,
  };
  const fits = () =>
    JSON.stringify({ isSuccess: true, toolResult }).length <= ceiling;
  if (!fits()) {
    toolResult = {
      operation: "get_ontology_summary",
      loadGeneration: summary.loadGeneration,
      ontologyHeader: {
        ontologyIri: summary.ontologyHeader?.ontologyIri ?? null,
      },
      elementCounts: summary.elementCounts,
      availableSections: ONTOLOGY_SUMMARY_SECTIONS.filter((section) =>
        Object.hasOwn(summary, section),
      ),
      sectionsOmitted: true,
      isTruncated: true,
    };
    if (!fits()) {
      refuse(
        "The exact ontology identity and core counts cannot fit the response budget. Inspect the ontology in the application or request a summary section.",
      );
    }
  }
  return Object.freeze({
    isSuccess: true,
    toolResult: Object.freeze(toolResult),
  });
}

export function createOntologySummaryPager({ ceiling, refuse }) {
  const continuations = new Map();
  const stateKey = (state) =>
    JSON.stringify([
      state.loadGeneration,
      state.documentRevision,
      state.view?.language ?? null,
    ]);
  return async function readSummary({ request, state, getState, read }) {
    const binding = stateKey(state);
    const summary = await read();
    if (binding !== stateKey(getState())) {
      refuse(
        "The ontology changed while reading the summary. Restart the summary.",
      );
    }
    if (request.section === undefined) {
      return projectOntologySummary(summary, { ceiling, refuse });
    }
    if (!Object.hasOwn(summary, request.section)) {
      refuse(
        "This summary section is unavailable. Request the default summary for available sections.",
      );
    }
    const jsonText = JSON.stringify(summary[request.section]);
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(jsonText),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    if (binding !== stateKey(getState())) {
      refuse(
        "The ontology changed while reading the summary. Restart the summary.",
      );
    }
    let offset = 0;
    if (request.continuation !== undefined) {
      const captured = continuations.get(request.continuation);
      if (
        !captured ||
        captured.binding !== binding ||
        captured.section !== request.section ||
        captured.digest !== digest
      ) {
        refuse(
          "The summary continuation is stale, expired, or belongs to another section. Restart that section without continuation.",
        );
      }
      offset = captured.offset;
    }
    const token = crypto.randomUUID();
    let end = Math.min(offset + 1000, jsonText.length);
    let toolResult;
    do {
      toolResult = {
        operation: "get_ontology_summary",
        loadGeneration: state.loadGeneration,
        documentRevision: state.documentRevision,
        language: state.view?.language ?? null,
        section: request.section,
        encoding: "json",
        offset,
        totalCharacterCount: jsonText.length,
        jsonFragment: jsonText.slice(offset, end),
        continuation: end < jsonText.length ? token : null,
        isTruncated: summary.isTruncated === true,
      };
      if (JSON.stringify({ isSuccess: true, toolResult }).length <= ceiling) {
        break;
      }
      end -= Math.max(1, Math.ceil((end - offset) / 8));
    } while (end > offset);
    if (end <= offset) {
      refuse(
        "The summary section page cannot fit the response budget. Inspect the ontology in the application.",
      );
    }
    if (toolResult.continuation) {
      continuations.set(token, {
        binding,
        section: request.section,
        digest,
        offset: end,
      });
      if (continuations.size > 8) {
        continuations.delete(continuations.keys().next().value);
      }
    }
    return Object.freeze({
      isSuccess: true,
      toolResult: Object.freeze(toolResult),
    });
  };
}
