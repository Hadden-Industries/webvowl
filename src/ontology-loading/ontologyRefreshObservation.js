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
  let updateFailure;
  const current = () => {
    const identity = readIdentity();
    return (
      !lifetime.signal.aborted &&
      identity.loadGeneration === owner.loadGeneration &&
      identity.documentRevision === owner.documentRevision
    );
  };
  const sourceStates = sources.map(
    ({ requestedDocumentIri, role, resolution, pointer }) => ({
      requestedDocumentIri,
      role,
      retrievalIri: resolution.retrievalIri,
      artifactIri: resolution.artifactIri,
      sourceKey: resolution.sourceKey,
      resolutionIdentity: resolution.resolutionIdentity,
      sourceVersionIdentity: resolution.sourceVersionIdentity,
      acquiredAt: resolution.acquiredAt,
      checkedAt:
        pointer?.lastSuccessfullyCheckedAt ??
        (resolution.originMetadata ? resolution.checkedAt : undefined),
      checkOutcome: "not-checked",
      hasUpdate: false,
    }),
  );
  function publish(status, code) {
    if (current()) {
      onStatus({
        ...owner,
        status,
        hasUpdate: offers.size > 0,
        sources: sourceStates.map((entry) => ({ ...entry })),
        ...(updateFailure ? { updateFailure: { ...updateFailure } } : {}),
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
      let failure;
      updateFailure = undefined;
      for (const entry of sourceStates) {
        entry.checkOutcome = "not-checked";
        delete entry.code;
      }
      publish("checking");
      try {
        // Sequential observation bounds client concurrency independently of server coalescing.
        for (const source of sources) {
          const { requestedDocumentIri, resolution, pointer } = source;
          const entry = sourceStates[sources.indexOf(source)];
          if (
            mode === "if-due" &&
            (!pointer ||
              now() <
                Math.max(
                  Date.parse(pointer.freshUntil),
                  Date.parse(pointer.nextCheckAllowedAt),
                ))
          ) {
            entry.checkOutcome = "reused";
            continue;
          }
          try {
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
              entry.checkedAt = result.lastSuccessfullyCheckedAt;
            }
            entry.checkOutcome =
              result.state === "SKIPPED_FRESH" ? "reused" : "checked";
            const binding = result.resultBinding ?? result.currentBinding;
            if (
              binding &&
              binding.sourceVersionIdentity !== resolution.sourceVersionIdentity
            ) {
              offers.set(requestedDocumentIri, binding);
            } else {
              offers.delete(requestedDocumentIri);
            }
            entry.hasUpdate = offers.has(requestedDocumentIri);
          } catch (error) {
            if (!current()) {
              throw new OntologyCacheError("CACHE_OFFER_EXPIRED");
            }
            entry.checkOutcome = "failed";
            entry.code =
              error instanceof OntologyCacheError
                ? error.code
                : "CACHE_UNAVAILABLE";
            entry.hasUpdate = false;
            offers.delete(requestedDocumentIri);
            failure ??= error;
          } finally {
            // A later result for this document supersedes an overlapping selection failure.
            if (updateFailure?.requestedDocumentIri === requestedDocumentIri) {
              updateFailure = undefined;
            }
          }
        }
        if (failure) {
          throw failure;
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
      const offeredIdentities = new Map(
        [...offers].map(([iri, binding]) => [iri, binding.resolutionIdentity]),
      );
      const selected = new Map();
      let selecting;
      try {
        for (const { requestedDocumentIri: iri, resolution } of sources) {
          selecting = iri;
          const offeredIdentity = offeredIdentities.get(iri);
          // An update replaces only its offered members. Reverify the exact
          // accepted bindings of the others: mutable discovery may be stale
          // or have advanced, and must not silently change this selection.
          const acquired = offeredIdentity
            ? await client.confirm(iri, offeredIdentity, {
                signal: lifetime.signal,
              })
            : await client.acquireBinding(
                iri,
                `${resolution.artifactIri}?source=${resolution.sourceKey}&binding=${resolution.resolutionIdentity}`,
                { signal: lifetime.signal },
              );
          if (!current()) {
            throw new OntologyCacheError("CACHE_OFFER_EXPIRED");
          }
          selected.set(iri, acquired);
        }
      } catch (error) {
        offers.clear();
        updateFailure = {
          requestedDocumentIri: selecting,
          code:
            error instanceof OntologyCacheError
              ? error.code
              : "CACHE_UNAVAILABLE",
        };
        publish("update-failed", updateFailure.code);
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
