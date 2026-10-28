import { OntologyCacheError } from "./ontologySourceIdentity.js";

/** One loaded document owns observation only; a shared backend attempt survives its cancellation. */
export function createOntologyRefreshObservation({
  sources,
  client,
  readIdentity,
  onStatus = () => {},
  now = Date.now,
}) {
  const owner = { ...readIdentity() };
  const lifetime = new AbortController();
  const offers = new Map();
  let pending;
  const current = () => {
    const identity = readIdentity();
    return (
      !lifetime.signal.aborted &&
      identity.loadGeneration === owner.loadGeneration &&
      identity.documentRevision === owner.documentRevision
    );
  };
  const dates = sources.map(({ resolution, pointer }) => ({
    acquiredAt: resolution.acquiredAt,
    checkedAt: pointer?.lastSuccessfullyCheckedAt ?? resolution.checkedAt,
  }));
  function publish(status, code) {
    if (current()) {
      onStatus({
        ...owner,
        status,
        hasUpdate: offers.size > 0,
        sources: dates.map((entry) => ({ ...entry })),
        ...(code ? { code } : {}),
      });
    }
  }
  async function refresh(mode) {
    if (!current()) {
      throw new OntologyCacheError("CACHE_OFFER_EXPIRED");
    }
    if (pending) {
      return pending;
    }
    pending = (async () => {
      publish("checking");
      try {
        // Sequential observation bounds client concurrency independently of server coalescing.
        for (const source of sources) {
          const { requestedDocumentIri, resolution, pointer } = source;
          if (
            mode === "if-due" &&
            (!pointer ||
              now() <
                Math.max(
                  Date.parse(pointer.freshUntil),
                  Date.parse(pointer.nextCheckAllowedAt),
                ))
          ) {
            continue;
          }
          const result = await client.refresh(requestedDocumentIri, {
            signal: lifetime.signal,
            mode,
          });
          if (!current()) {
            throw new OntologyCacheError("CACHE_OFFER_EXPIRED");
          }
          if (result.state === "FAILED" || result.state === "SUPERSEDED") {
            throw new OntologyCacheError("CACHE_REFRESH_FAILED");
          }
          if (result.lastSuccessfullyCheckedAt) {
            dates[sources.indexOf(source)].checkedAt =
              result.lastSuccessfullyCheckedAt;
          }
          const binding = result.resultBinding ?? result.currentBinding;
          if (
            binding &&
            binding.sourceVersionIdentity !== resolution.sourceVersionIdentity
          ) {
            offers.set(requestedDocumentIri, binding);
          } else {
            offers.delete(requestedDocumentIri);
          }
        }
        publish(offers.size ? "update-available" : "checked");
      } catch (error) {
        publish(
          "check-failed",
          error instanceof OntologyCacheError
            ? error.code
            : "CACHE_UNAVAILABLE",
        );
        throw error;
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  }
  return Object.freeze({
    start() {
      publish("archived");
      if (
        sources.some(
          ({ pointer }) =>
            pointer &&
            now() >=
              Math.max(
                Date.parse(pointer.freshUntil),
                Date.parse(pointer.nextCheckAllowedAt),
              ),
        )
      ) {
        void refresh("if-due").catch(() => {
          /* The bounded failure is already presented; the graph remains admitted. */
        });
      }
    },
    refresh: () => refresh("check-now"),
    async selectUpdate() {
      if (!current() || offers.size === 0) {
        throw new OntologyCacheError("CACHE_OFFER_EXPIRED");
      }
      const selected = new Map();
      try {
        for (const [iri, binding] of offers) {
          const acquired = await client.confirm(
            iri,
            binding.resolutionIdentity,
            {
              signal: lifetime.signal,
            },
          );
          if (!current()) {
            throw new OntologyCacheError("CACHE_OFFER_EXPIRED");
          }
          selected.set(iri, acquired);
        }
      } catch (error) {
        offers.clear();
        publish(
          "check-failed",
          error instanceof OntologyCacheError
            ? error.code
            : "CACHE_UNAVAILABLE",
        );
        throw error;
      }
      return selected;
    },
    dispose() {
      lifetime.abort();
      offers.clear();
    },
  });
}
