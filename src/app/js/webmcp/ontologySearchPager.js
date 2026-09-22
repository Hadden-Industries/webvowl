// Continuations retain bounded request metadata, never ontology-sized snapshots.
export function createOntologySearchPager({ ceiling, refuse }) {
  const continuations = new Map();
  const stateKey = (state) =>
    JSON.stringify([
      state.loadGeneration,
      state.documentRevision,
      state.view?.language ?? null,
    ]);
  const inputKey = (request) =>
    JSON.stringify([
      request.query,
      request.kinds ?? null,
      request.limit,
      request.includeNeighborhood,
    ]);

  return async function readSearchPage({ request, state, getState, find }) {
    const binding = stateKey(state);
    const inputs = inputKey(request);
    let offset = 0;
    if (request.continuation !== undefined) {
      const captured = continuations.get(request.continuation);
      if (
        !captured ||
        captured.binding !== binding ||
        captured.inputs !== inputs
      ) {
        refuse(
          "The search continuation is stale, expired, or belongs to different inputs. Restart the search without continuation.",
        );
      }
      offset = captured.offset;
    }
    const { continuation: ignored, ...searchRequest } = request;
    void ignored;
    const result = await find({ ...searchRequest, offset });
    if (binding !== stateKey(getState())) {
      refuse("The ontology changed during this search. Restart the search.");
    }
    const token = crypto.randomUUID();
    const toolResult = {
      operation: "find_ontology_elements",
      loadGeneration: state.loadGeneration,
      documentRevision: state.documentRevision,
      language: state.view?.language ?? null,
      matches: result.matches.map((match) => ({ ...match })),
      totalMatchCount: result.totalMatchCount,
      optionalFactsTruncated: result.optionalFactsTruncated === true,
      isTruncated: result.isTruncated === true,
      hasMore: false,
      continuation: null,
    };
    const envelope = { isSuccess: true, toolResult };
    function updateContinuation() {
      toolResult.hasMore =
        offset + toolResult.matches.length < result.totalMatchCount;
      toolResult.continuation = toolResult.hasMore ? token : null;
      toolResult.isTruncated ||=
        toolResult.hasMore || toolResult.optionalFactsTruncated;
    }
    function fits() {
      updateContinuation();
      return JSON.stringify(envelope).length <= ceiling;
    }
    if (!fits()) {
      for (const match of toolResult.matches) {
        if (match.neighborhoodFacts !== undefined) {
          delete match.neighborhoodFacts;
          toolResult.optionalFactsTruncated = true;
        }
      }
    }
    if (!fits()) {
      for (const match of toolResult.matches) {
        if (match.displayLabel?.length > 80) {
          match.displayLabel = [...match.displayLabel].slice(0, 80).join("");
          toolResult.optionalFactsTruncated = true;
        }
      }
    }
    while (!fits() && toolResult.matches.length > 1) {
      toolResult.matches.pop();
    }
    if (!fits() || (toolResult.hasMore && toolResult.matches.length === 0)) {
      refuse(
        "A search identity cannot fit the response budget. Inspect the ontology through the application; this search cannot advance without losing an exact identity.",
      );
    }
    if (toolResult.hasMore) {
      continuations.set(token, {
        binding,
        inputs,
        offset: offset + toolResult.matches.length,
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
