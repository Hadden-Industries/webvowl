import { sameSemanticSelection } from "./entityPresentationModel.js";

/** One semantic read per frame, with no retries while the document is loading. */
export function createSelectionPresentationScheduler({
  describe,
  render,
  requestFrame = globalThis.requestAnimationFrame.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame.bind(globalThis),
}) {
  let current;
  let frame;
  let scheduled = false;
  let disposed = false;
  function cancel() {
    if (scheduled) {
      cancelFrame(frame);
      scheduled = false;
    }
  }
  function readable(state) {
    return (
      state?.loadGeneration > 0 &&
      state.selection?.length > 0 &&
      !["idle", "loading", "disposed"].includes(state.status)
    );
  }
  function sameMeaning(a, b) {
    return (
      readable(b) &&
      a.loadGeneration === b.loadGeneration &&
      a.documentRevision === b.documentRevision &&
      sameSemanticSelection(a.selection, b.selection) &&
      a.view?.language === b.view?.language
    );
  }
  return Object.freeze({
    observe(state) {
      current = state;
      if (!readable(state)) {
        cancel();
      }
    },
    schedule(state) {
      current = state;
      if (disposed) {
        return;
      }
      if (!readable(state)) {
        cancel();
        render([]);
        return;
      }
      if (scheduled) {
        return;
      }
      scheduled = true;
      frame = requestFrame(() => {
        scheduled = false;
        const requested = current;
        if (disposed || !readable(requested)) {
          return;
        }
        let result;
        try {
          result = describe({ ontologyElementReferences: requested.selection });
        } catch (error) {
          if (
            ["LOAD_PENDING", "NO_ONTOLOGY", "ELEMENT_NOT_FOUND"].includes(
              error?.code,
            )
          ) {
            render([]);
            return;
          }
          throw error;
        }
        if (!disposed && sameMeaning(requested, current)) {
          render(result.elementDescriptions);
        }
      });
    },
    dispose() {
      disposed = true;
      cancel();
      current = undefined;
    },
  });
}
