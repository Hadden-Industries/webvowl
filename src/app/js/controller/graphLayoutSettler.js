import { WebVowlOperationError } from "./webVowlControllerContracts.js";

const GRAPH_LAYOUT_SETTLER_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "nowMs",
]);
const SETTLEMENT_REQUEST_FIELD_NAMES = Object.freeze([
  "loadGeneration",
  "readGraphLayoutSnapshot",
  "settleTimeoutMs",
  "onTimeout",
  "subscribeToGraphLayoutEvents",
]);
const TIMEOUT_DISPOSITIONS = Object.freeze(["fail", "best-effort"]);
const GRAPH_LAYOUT_STATE_CHANGED_EVENT_KIND = "graph-layout-state-changed";

const REQUIRED_STABLE_FRAME_COUNT = 8;
const SETTLED_FORCE_ALPHA = 0.005;
const SETTLED_DISPLACEMENT_UNITS = 0.5;
const MINIMUM_SETTLE_TIMEOUT_MS = 1000;
const MAXIMUM_SETTLE_TIMEOUT_MS = 30000;
const DEFAULT_SETTLE_TIMEOUT_MS = 12000;

function assertPlainRecord(candidate, description) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertExactDependencyFieldNames(dependencies) {
  assertPlainRecord(dependencies, "graph layout settler dependencies");
  const actualFieldNames = Object.keys(dependencies).sort();
  const expectedFieldNames = [
    ...GRAPH_LAYOUT_SETTLER_DEPENDENCY_FIELD_NAMES,
  ].sort();
  if (
    actualFieldNames.length !== expectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== expectedFieldNames[index],
    )
  ) {
    throw new TypeError(
      "Graph layout settler dependencies have an invalid dependency field set.",
    );
  }
  for (const dependencyFieldName of GRAPH_LAYOUT_SETTLER_DEPENDENCY_FIELD_NAMES) {
    if (typeof dependencies[dependencyFieldName] !== "function") {
      throw new TypeError(`${dependencyFieldName} must be a function.`);
    }
  }
}

function assertAllowedFieldNames(record, description) {
  assertPlainRecord(record, description);
  const unsupportedFieldName = Object.keys(record).find(
    (fieldName) => !SETTLEMENT_REQUEST_FIELD_NAMES.includes(fieldName),
  );
  if (unsupportedFieldName !== undefined) {
    throw new TypeError(
      `${description} contains unsupported field ${unsupportedFieldName}.`,
    );
  }
}

function assertPositiveLoadGeneration(loadGeneration) {
  if (!Number.isInteger(loadGeneration) || loadGeneration < 1) {
    throw new TypeError("loadGeneration must be a positive integer.");
  }
}

function resolveSettleTimeoutMs(settleTimeoutMs) {
  if (settleTimeoutMs === undefined) {
    return DEFAULT_SETTLE_TIMEOUT_MS;
  }
  if (
    !Number.isInteger(settleTimeoutMs) ||
    settleTimeoutMs < MINIMUM_SETTLE_TIMEOUT_MS ||
    settleTimeoutMs > MAXIMUM_SETTLE_TIMEOUT_MS
  ) {
    throw new RangeError(
      `settleTimeoutMs must be an integer from ${MINIMUM_SETTLE_TIMEOUT_MS} through ${MAXIMUM_SETTLE_TIMEOUT_MS}.`,
    );
  }
  return settleTimeoutMs;
}

function resolveTimeoutDisposition(onTimeout) {
  if (onTimeout === undefined) {
    return "fail";
  }
  if (!TIMEOUT_DISPOSITIONS.includes(onTimeout)) {
    throw new TypeError(
      `onTimeout must be ${TIMEOUT_DISPOSITIONS.join(" or ")}.`,
    );
  }
  return onTimeout;
}

function createLoadAbortedError(cause) {
  return new WebVowlOperationError({
    cause,
    code: "LOAD_ABORTED",
    message: "The graph layout wait was superseded or cancelled.",
  });
}

function createLayoutTimeoutError(settleTimeoutMs) {
  return new WebVowlOperationError({
    code: "LAYOUT_TIMEOUT",
    details: { settleTimeoutMs },
    message: "The graph layout did not settle within its budget.",
  });
}

function createLayoutOutcome(loadGeneration, status, reason) {
  return Object.freeze({ loadGeneration, status, reason });
}

function layoutPositionsByKey(graphLayoutSnapshot) {
  const positionsByKey = new Map();
  for (const layoutElementPosition of graphLayoutSnapshot.layoutElementPositions) {
    positionsByKey.set(layoutElementPosition.stableLayoutElementKey, {
      x: layoutElementPosition.x,
      y: layoutElementPosition.y,
    });
  }
  return positionsByKey;
}

function hasMatchingLayoutKeySet(
  previousPositionsByKey,
  currentPositionsByKey,
) {
  if (previousPositionsByKey.size !== currentPositionsByKey.size) {
    return false;
  }
  for (const stableLayoutElementKey of previousPositionsByKey.keys()) {
    if (!currentPositionsByKey.has(stableLayoutElementKey)) {
      return false;
    }
  }
  return true;
}

function maximumLayoutDisplacement(
  previousPositionsByKey,
  currentPositionsByKey,
) {
  let maximumDisplacement = 0;
  for (const [
    stableLayoutElementKey,
    currentPosition,
  ] of currentPositionsByKey) {
    const previousPosition = previousPositionsByKey.get(stableLayoutElementKey);
    const displacement = Math.hypot(
      currentPosition.x - previousPosition.x,
      currentPosition.y - previousPosition.y,
    );
    maximumDisplacement = Math.max(maximumDisplacement, displacement);
  }
  return maximumDisplacement;
}

export function createGraphLayoutSettler(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const { requestAnimationFrame, cancelAnimationFrame, nowMs } = dependencies;

  return Object.freeze({
    waitForSettledGraphLayout(request, options = {}) {
      assertAllowedFieldNames(request, "graph layout settlement request");
      assertPlainRecord(options, "graph layout settlement options");
      const {
        loadGeneration,
        readGraphLayoutSnapshot,
        subscribeToGraphLayoutEvents,
      } = request;
      assertPositiveLoadGeneration(loadGeneration);
      if (typeof readGraphLayoutSnapshot !== "function") {
        throw new TypeError("readGraphLayoutSnapshot must be a function.");
      }
      if (
        subscribeToGraphLayoutEvents !== undefined &&
        typeof subscribeToGraphLayoutEvents !== "function"
      ) {
        throw new TypeError(
          "subscribeToGraphLayoutEvents must be a function when provided.",
        );
      }
      const settleTimeoutMs = resolveSettleTimeoutMs(request.settleTimeoutMs);
      const timeoutDisposition = resolveTimeoutDisposition(request.onTimeout);
      const cancellationSignal = options.signal;
      if (
        cancellationSignal !== undefined &&
        typeof cancellationSignal?.addEventListener !== "function"
      ) {
        throw new TypeError("signal must be an AbortSignal when provided.");
      }

      return new Promise((resolveSettlement, rejectSettlement) => {
        const startedAtMs = nowMs();
        let previousPositionsByKey;
        let stableFrameCount = 0;
        let pendingFrameHandle;
        let unsubscribeFromGraphLayoutEvents;
        let isComplete = false;

        function releaseSettlementResources() {
          if (pendingFrameHandle !== undefined) {
            cancelAnimationFrame(pendingFrameHandle);
            pendingFrameHandle = undefined;
          }
          if (unsubscribeFromGraphLayoutEvents !== undefined) {
            unsubscribeFromGraphLayoutEvents();
            unsubscribeFromGraphLayoutEvents = undefined;
          }
          if (cancellationSignal !== undefined) {
            cancellationSignal.removeEventListener("abort", onCallerAbort);
          }
        }

        function completeWithOutcome(layoutOutcome) {
          if (isComplete) {
            return;
          }
          isComplete = true;
          releaseSettlementResources();
          resolveSettlement(layoutOutcome);
        }

        function completeWithError(settlementError) {
          if (isComplete) {
            return;
          }
          isComplete = true;
          releaseSettlementResources();
          rejectSettlement(settlementError);
        }

        function onCallerAbort() {
          completeWithError(createLoadAbortedError(cancellationSignal?.reason));
        }

        function readCurrentGenerationSnapshot() {
          const graphLayoutSnapshot = readGraphLayoutSnapshot();
          if (graphLayoutSnapshot.loadGeneration > loadGeneration) {
            completeWithError(createLoadAbortedError());
            return undefined;
          }
          if (graphLayoutSnapshot.loadGeneration < loadGeneration) {
            return undefined;
          }
          return graphLayoutSnapshot;
        }

        function onGraphLayoutEvent(renderedGraphEvent) {
          if (
            isComplete ||
            renderedGraphEvent?.kind !==
              GRAPH_LAYOUT_STATE_CHANGED_EVENT_KIND ||
            renderedGraphEvent.loadGeneration !== loadGeneration
          ) {
            return;
          }
          const graphLayoutSnapshot = readCurrentGenerationSnapshot();
          if (graphLayoutSnapshot?.hasEnded === true) {
            completeWithOutcome(
              createLayoutOutcome(loadGeneration, "settled", "native-end"),
            );
          }
        }

        function observeSettlementFrame() {
          pendingFrameHandle = undefined;
          if (isComplete) {
            return;
          }

          const graphLayoutSnapshot = readCurrentGenerationSnapshot();
          if (isComplete) {
            return;
          }

          if (graphLayoutSnapshot !== undefined) {
            if (graphLayoutSnapshot.hasEnded) {
              completeWithOutcome(
                createLayoutOutcome(loadGeneration, "settled", "native-end"),
              );
              return;
            }

            const currentPositionsByKey =
              layoutPositionsByKey(graphLayoutSnapshot);
            const isComparableFrame =
              previousPositionsByKey !== undefined &&
              hasMatchingLayoutKeySet(
                previousPositionsByKey,
                currentPositionsByKey,
              );
            if (
              isComparableFrame &&
              graphLayoutSnapshot.forceAlpha <= SETTLED_FORCE_ALPHA &&
              maximumLayoutDisplacement(
                previousPositionsByKey,
                currentPositionsByKey,
              ) <= SETTLED_DISPLACEMENT_UNITS
            ) {
              stableFrameCount += 1;
            } else {
              stableFrameCount = 0;
            }
            previousPositionsByKey = currentPositionsByKey;

            if (stableFrameCount >= REQUIRED_STABLE_FRAME_COUNT) {
              completeWithOutcome(
                createLayoutOutcome(loadGeneration, "settled", "stable-frames"),
              );
              return;
            }
          }

          if (nowMs() - startedAtMs >= settleTimeoutMs) {
            if (timeoutDisposition === "best-effort") {
              completeWithOutcome(
                createLayoutOutcome(loadGeneration, "best-effort", "timeout"),
              );
              return;
            }
            completeWithError(createLayoutTimeoutError(settleTimeoutMs));
            return;
          }

          pendingFrameHandle = requestAnimationFrame(observeSettlementFrame);
        }

        if (cancellationSignal?.aborted === true) {
          rejectSettlement(createLoadAbortedError(cancellationSignal.reason));
          return;
        }
        if (cancellationSignal !== undefined) {
          cancellationSignal.addEventListener("abort", onCallerAbort, {
            once: true,
          });
        }
        if (subscribeToGraphLayoutEvents !== undefined) {
          unsubscribeFromGraphLayoutEvents =
            subscribeToGraphLayoutEvents(onGraphLayoutEvent);
        }
        pendingFrameHandle = requestAnimationFrame(observeSettlementFrame);
      });
    },
  });
}
