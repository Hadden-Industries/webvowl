const REQUIRED_PLATFORM_CAPABILITIES_MESSAGE =
  "Linked abort signals require AbortController, AbortSignal, and EventTarget platform capabilities.";

function requiredLinkedAbortSignalPlatformCapabilities() {
  const AbortControllerConstructor = globalThis.AbortController;
  const AbortSignalConstructor = globalThis.AbortSignal;
  const EventTargetConstructor = globalThis.EventTarget;
  if (
    typeof AbortControllerConstructor !== "function" ||
    typeof AbortSignalConstructor !== "function" ||
    typeof EventTargetConstructor !== "function"
  ) {
    throw new TypeError(REQUIRED_PLATFORM_CAPABILITIES_MESSAGE);
  }

  const abortControllerAbort = AbortControllerConstructor.prototype.abort;
  const abortControllerSignalGetter = Object.getOwnPropertyDescriptor(
    AbortControllerConstructor.prototype,
    "signal",
  )?.get;
  const abortSignalAbortedGetter = Object.getOwnPropertyDescriptor(
    AbortSignalConstructor.prototype,
    "aborted",
  )?.get;
  const abortSignalReasonGetter = Object.getOwnPropertyDescriptor(
    AbortSignalConstructor.prototype,
    "reason",
  )?.get;
  const eventTargetAddEventListener =
    EventTargetConstructor.prototype.addEventListener;
  const eventTargetRemoveEventListener =
    EventTargetConstructor.prototype.removeEventListener;
  if (
    typeof abortControllerAbort !== "function" ||
    typeof abortControllerSignalGetter !== "function" ||
    typeof abortSignalAbortedGetter !== "function" ||
    typeof abortSignalReasonGetter !== "function" ||
    typeof eventTargetAddEventListener !== "function" ||
    typeof eventTargetRemoveEventListener !== "function"
  ) {
    throw new TypeError(REQUIRED_PLATFORM_CAPABILITIES_MESSAGE);
  }

  return {
    AbortControllerConstructor,
    abortControllerAbort,
    abortControllerSignalGetter,
    abortSignalAbortedGetter,
    abortSignalReasonGetter,
    eventTargetAddEventListener,
    eventTargetRemoveEventListener,
  };
}

function isAbortSignalAborted(abortSignal, abortSignalAbortedGetter) {
  return abortSignalAbortedGetter.call(abortSignal);
}

function abortSignalReason(abortSignal, abortSignalReasonGetter) {
  return abortSignalReasonGetter.call(abortSignal);
}

function hasAbortSignalBrand(candidateSignal, abortSignalAbortedGetter) {
  if (
    (typeof candidateSignal !== "object" &&
      typeof candidateSignal !== "function") ||
    candidateSignal === null
  ) {
    return false;
  }

  try {
    isAbortSignalAborted(candidateSignal, abortSignalAbortedGetter);
    return true;
  } catch {
    return false;
  }
}

function uniqueAbortSignals(sourceSignals, abortSignalAbortedGetter) {
  if (sourceSignals === null || sourceSignals === undefined) {
    throw new TypeError("Source abort signals must be iterable.");
  }

  const abortSignals = [...sourceSignals];
  for (const sourceSignal of abortSignals) {
    if (!hasAbortSignalBrand(sourceSignal, abortSignalAbortedGetter)) {
      throw new TypeError("Every source signal must be an AbortSignal.");
    }
  }
  return [...new Set(abortSignals)];
}

export function createLinkedAbortSignal(sourceSignals) {
  const {
    AbortControllerConstructor,
    abortControllerAbort,
    abortControllerSignalGetter,
    abortSignalAbortedGetter,
    abortSignalReasonGetter,
    eventTargetAddEventListener,
    eventTargetRemoveEventListener,
  } = requiredLinkedAbortSignalPlatformCapabilities();
  const abortSignals = uniqueAbortSignals(
    sourceSignals,
    abortSignalAbortedGetter,
  );
  const linkedAbortController = new AbortControllerConstructor();
  const linkedAbortSignal = abortControllerSignalGetter.call(
    linkedAbortController,
  );
  const abortListenerBySignal = new Map();
  let isDisposed = false;

  function removeSourceAbortListeners() {
    for (const [sourceSignal, abortListener] of abortListenerBySignal) {
      eventTargetRemoveEventListener.call(sourceSignal, "abort", abortListener);
    }
    abortListenerBySignal.clear();
  }

  function abortFromSource(sourceSignal) {
    if (
      isDisposed ||
      isAbortSignalAborted(linkedAbortSignal, abortSignalAbortedGetter) ||
      !isAbortSignalAborted(sourceSignal, abortSignalAbortedGetter)
    ) {
      return;
    }
    isDisposed = true;
    abortControllerAbort.call(
      linkedAbortController,
      abortSignalReason(sourceSignal, abortSignalReasonGetter),
    );
    removeSourceAbortListeners();
  }

  const alreadyAbortedSource = abortSignals.find((sourceSignal) =>
    isAbortSignalAborted(sourceSignal, abortSignalAbortedGetter),
  );
  if (alreadyAbortedSource !== undefined) {
    isDisposed = true;
    abortControllerAbort.call(
      linkedAbortController,
      abortSignalReason(alreadyAbortedSource, abortSignalReasonGetter),
    );
  } else {
    for (const sourceSignal of abortSignals) {
      const abortListener = () => abortFromSource(sourceSignal);
      abortListenerBySignal.set(sourceSignal, abortListener);
      eventTargetAddEventListener.call(sourceSignal, "abort", abortListener);
    }
  }

  return Object.freeze({
    signal: linkedAbortSignal,
    dispose() {
      if (isDisposed && abortListenerBySignal.size === 0) {
        return;
      }
      isDisposed = true;
      removeSourceAbortListeners();
    },
  });
}
