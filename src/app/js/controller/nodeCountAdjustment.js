import { createNodesShownIntent } from "./nodesShownContracts.js";

const QUIET_PERIOD_MS = 1000;
const sameIntent = (left, right) =>
  left?.mode === right?.mode && left?.requestedCount === right?.requestedCount;
const sameDocument = (left, right) =>
  left?.loadGeneration === right?.loadGeneration &&
  left?.documentRevision === right?.documentRevision;

/**
 * Owns one count draft and one application, never a queue of intermediate counts.
 * The controller supplies document authority and the temporary layout hold;
 * only the clock and those effectful ports are replaceable in timing tests.
 */
export function createNodeCountAdjustment({
  readAccepted,
  apply,
  holdLayout,
  publish,
  reportError,
  beforeStage = () => {},
  clock = {
    now: () => performance.now(),
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: (timer) => globalThis.clearTimeout(timer),
  },
}) {
  let identity;
  let pending;
  let running;
  let timer;
  let dueAt = 0;
  let visible = true;
  let disposed = false;
  let hold;

  function current() {
    if (disposed || !identity) {
      return false;
    }
    try {
      return sameDocument(identity, readAccepted());
    } catch {
      // A retired document has no readable identity. Late callbacks own nothing.
      return false;
    }
  }
  function snapshot() {
    const intent = pending ?? running?.intent;
    return intent
      ? {
          requestedNodesShown: { ...intent },
          status: running ? "applying" : "pending",
        }
      : null;
  }
  function notify() {
    publish(snapshot());
  }
  function clearTimer() {
    if (timer !== undefined) {
      clock.clearTimeout(timer);
    }
    timer = undefined;
  }
  function releaseHold() {
    const previous = hold;
    hold = undefined;
    previous?.release();
  }
  function acquireHold() {
    if (hold) {
      return hold;
    }
    const owner = holdLayout();
    hold = owner;
    try {
      owner.beginAdjustment?.();
    } catch (error) {
      if (hold === owner) {
        releaseHold();
      }
      throw error;
    }
    return owner;
  }
  function schedule() {
    clearTimer();
    if (!pending || !visible || disposed) {
      return;
    }
    timer = clock.setTimeout(
      () => {
        timer = undefined;
        void drain(false).catch(reportError);
      },
      Math.max(0, dueAt - clock.now()),
    );
  }
  function cancel() {
    const hadWork =
      pending !== undefined || running !== undefined || hold !== undefined;
    clearTimer();
    pending = undefined;
    const previous = running;
    running = undefined;
    identity = undefined;
    previous?.controller.abort();
    releaseHold();
    if (hadWork) {
      notify();
    }
  }
  async function drain(force) {
    clearTimer();
    if (!current()) {
      cancel();
      return;
    }
    if (running) {
      await running.promise;
      return drain(force);
    }
    if (!pending) {
      return;
    }
    if (!force && (!visible || clock.now() < dueAt)) {
      schedule();
      return;
    }
    if (sameIntent(pending, readAccepted().nodesShown)) {
      pending = undefined;
      releaseHold();
      notify();
      return;
    }
    const job = { intent: pending, controller: new AbortController() };
    pending = undefined;
    running = job;
    // Install the job before calling any controller effect: publication may
    // synchronously deliver new input or retire this document.
    job.promise = Promise.resolve()
      .then(async () => {
        if (running !== job || !current()) {
          return;
        }
        acquireHold().prepareInstallation();
        notify();
        job.controller.signal.throwIfAborted();
        await apply(job.intent, { signal: job.controller.signal });
      })
      .finally(() => {
        if (running !== job) {
          return;
        }
        running = undefined;
        if (!current()) {
          cancel();
        } else {
          if (pending && visible) {
            schedule();
          } else {
            releaseHold();
          }
          notify();
        }
      });
    await job.promise;
    if (force && pending) {
      return drain(true);
    }
  }

  return Object.freeze({
    stage(request) {
      if (disposed) {
        throw new DOMException("The adjustment was disposed.", "AbortError");
      }
      const intent = createNodesShownIntent(request);
      const accepted = readAccepted();
      if (identity && !sameDocument(identity, accepted)) {
        cancel();
      }
      identity = accepted;
      if (sameIntent(intent, pending ?? running?.intent)) {
        return snapshot();
      }
      pending = intent;
      dueAt = clock.now() + QUIET_PERIOD_MS;
      if (!running && sameIntent(intent, accepted.nodesShown)) {
        cancel();
      } else {
        try {
          beforeStage();
          if (visible) {
            acquireHold();
          }
          notify();
          schedule();
        } catch (error) {
          if (pending === intent) {
            cancel();
          }
          throw error;
        }
      }
      return snapshot();
    },
    flush: () => drain(true),
    cancel,
    // Explicit view requests supersede drafts. A filter request may consume the
    // latest count and apply both through the existing single view transaction.
    take() {
      const intent = current() ? (pending ?? running?.intent) : undefined;
      cancel();
      return intent;
    },
    setVisible(next) {
      if (disposed || visible === next) {
        return;
      }
      visible = next;
      if (!visible) {
        const retained = pending ?? running?.intent;
        const retainedIdentity = identity;
        cancel();
        if (retained && sameDocument(retainedIdentity, readAccepted())) {
          identity = retainedIdentity;
          pending = retained;
          notify();
        }
      } else if (pending) {
        if (!current()) {
          cancel();
        } else {
          acquireHold();
          schedule();
        }
      }
    },
    dispose() {
      disposed = true;
      cancel();
    },
  });
}
