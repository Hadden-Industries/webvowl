import { MissingImportError } from "owlapi/io";
import { createOntologyMaterializationClient } from "./ontologyMaterializationClient.js";
import { readOasisOntologyCatalog } from "./oasisXmlOntologyCatalog.js";
import {
  ontologySourceIri,
  OntologyCacheError,
} from "./ontologySourceIdentity.js";

const withdrawn = new Set([
  "SOURCE_WITHDRAWN",
  "SOURCE_QUARANTINED",
  "CONTENT_QUARANTINED",
]);

/** Cache policy surrounds the existing direct transport; parsing and managed closure stay worker-owned. */
export function createCachedOntologySourceAcquisition({
  resolver,
  serviceOrigin,
  approvedPolicyFingerprints,
  fetchImpl,
  catalogIri,
  deadlineMs = 60000,
  onDiagnostic = () => {},
  onAcquired = () => {},
} = {}) {
  const client = createOntologyMaterializationClient({
    serviceOrigin,
    approvedPolicyFingerprints,
    fetchImpl,
    deadlineMs,
  });
  const blocked = new Set();
  const confirmedSelections = new WeakSet();
  const observations = new Map();
  function diagnose(error) {
    onDiagnostic({
      code:
        error instanceof OntologyCacheError ? error.code : "CACHE_UNAVAILABLE",
    });
  }
  function check(error, iri, signal) {
    signal.throwIfAborted();
    if (withdrawn.has(error.code)) {
      blocked.add(iri);
      throw error;
    }
    diagnose(error);
  }
  const acquired = (iri, value) => {
    onAcquired({
      requestedDocumentIri: iri,
      resolution: value.resolution,
      pointer: value.pointer,
    });
    return value;
  };
  return Object.freeze({
    async acquire(
      iri,
      { signal: callerSignal, config, selectedBindings, context = {} } = {},
    ) {
      ontologySourceIri(iri);
      const signal = AbortSignal.any([
        ...(callerSignal ? [callerSignal] : []),
        AbortSignal.timeout(deadlineMs),
      ]);
      if (blocked.has(iri)) {
        throw new OntologyCacheError("SOURCE_WITHDRAWN");
      }
      context.bindings ??= new Map();
      const remember = (value) => {
        signal.throwIfAborted();
        context.bindings.set(iri, value);
        return acquired(iri, value);
      };
      if (context.bindings.has(iri)) {
        const value = context.bindings.get(iri);
        return { ...value, bytes: value.bytes.slice() };
      }
      if (selectedBindings?.has(iri)) {
        const selected = selectedBindings.get(iri);
        if (
          !confirmedSelections.has(selected) ||
          selected.resolution.requestedDocumentIri !== iri
        ) {
          throw new OntologyCacheError();
        }
        signal.throwIfAborted();
        return remember({ ...selected, bytes: selected.bytes.slice() });
      }
      if (catalogIri) {
        try {
          context.catalog ??= readOasisOntologyCatalog({
            serviceOrigin,
            catalogIri,
            fetchImpl,
            signal,
            onDiagnostic,
          });
          const catalog = await context.catalog;
          if (catalog.has(iri)) {
            return remember(
              await client.acquireBinding(iri, catalog.get(iri), {
                signal,
                context,
              }),
            );
          }
        } catch (error) {
          check(error, iri, signal);
        }
      }
      try {
        const value = await client.lookup(iri, { signal, context });
        if (value) {
          return remember(value);
        }
      } catch (error) {
        check(error, iri, signal);
      }
      try {
        return remember(
          await resolver.loadBytes(resolver.getDocumentIRI(iri).value, {
            config,
            signal,
          }),
        );
      } catch (error) {
        signal.throwIfAborted();
        // MissingImportError with a native TypeError cause identifies the browser's
        // unreadable network/CORS boundary. Readable HTTP, parser and limit errors never proxy.
        if (
          !(error instanceof MissingImportError) ||
          !(error.cause instanceof TypeError) ||
          error.status !== undefined
        ) {
          throw error;
        }
      }
      try {
        return remember(await client.materialize(iri, { signal, context }));
      } catch (error) {
        check(error, iri, signal);
        throw error;
      }
    },
    refresh(iri, { signal, mode = "check-now" } = {}) {
      if (blocked.has(iri)) {
        return Promise.reject(new OntologyCacheError("SOURCE_WITHDRAWN"));
      }
      // One observer per source/session, independently cancellable from a foreground read.
      if (!observations.has(iri)) {
        const observation = client
          .refresh(iri, { signal, mode })
          .catch((error) => {
            if (withdrawn.has(error.code)) {
              blocked.add(iri);
            }
            throw error;
          })
          .finally(() => {
            if (observations.get(iri) === observation) {
              observations.delete(iri);
            }
          });
        observations.set(iri, observation);
      }
      return observations.get(iri);
    },
    async confirm(iri, identity, options) {
      if (blocked.has(iri)) {
        throw new OntologyCacheError("SOURCE_WITHDRAWN");
      }
      try {
        const selected = await client.confirm(iri, identity, options);
        confirmedSelections.add(selected);
        return selected;
      } catch (error) {
        if (withdrawn.has(error.code)) {
          blocked.add(iri);
        }
        throw error;
      }
    },
  });
}
