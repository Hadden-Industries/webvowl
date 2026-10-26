/**
 * Optional, local diagnostic timing. Returned facts contain no DOM targets,
 * source URLs, labels or ontology data. Event duration is browser-quantized:
 * its presentation component is an estimate, never page-level INP.
 * This function is also serialized into the isolated production browser.
 */
export function createLocalInteractionTiming({
  PerformanceObserverClass = globalThis.PerformanceObserver,
  maxEntries = 256,
  now = () => performance.now(),
} = {}) {
  if (
    !Number.isSafeInteger(maxEntries) ||
    maxEntries < 1 ||
    maxEntries > 4096
  ) {
    throw new RangeError("Local timing capacity must be between 1 and 4096");
  }
  const events = [];
  const loaf = [];
  const dropped = { events: 0, loaf: 0 };
  const supported = { event: false, loaf: false };
  const observers = [];
  let cutoff = now();
  let disposed = false;
  const number = (value) =>
    Number.isFinite(value) && value >= 0 ? value : undefined;
  function collect(entries, kind) {
    if (disposed) return;
    const rows = kind === "event" ? events : loaf;
    for (const entry of entries) {
      if (
        number(entry.startTime) === undefined ||
        (kind === "event"
          ? entry.startTime < cutoff
          : entry.startTime + entry.duration <= cutoff) ||
        number(entry.duration) === undefined
      )
        continue;
      if (rows.length >= maxEntries) {
        dropped[kind === "event" ? "events" : "loaf"]++;
        continue;
      }
      if (kind === "event") {
        if (
          number(entry.processingStart) === undefined ||
          number(entry.processingEnd) === undefined ||
          entry.processingStart < entry.startTime ||
          entry.processingEnd < entry.processingStart
        )
          continue;
        rows.push(
          Object.freeze({
            name: [
              "click",
              "pointerdown",
              "pointerup",
              "keydown",
              "keyup",
              "input",
              "beforeinput",
              "mousedown",
              "mouseup",
              "touchstart",
              "touchend",
            ].includes(entry.name)
              ? entry.name
              : "other",
            startTime: entry.startTime,
            duration: entry.duration,
            interactionId: number(entry.interactionId),
            inputDelay: entry.processingStart - entry.startTime,
            processingDuration: entry.processingEnd - entry.processingStart,
            presentationDelayEstimate: Math.max(
              0,
              entry.startTime + entry.duration - entry.processingEnd,
            ),
          }),
        );
      } else {
        const scripts = Array.from(entry.scripts ?? []);
        rows.push(
          Object.freeze({
            startTime: entry.startTime,
            duration: entry.duration,
            blockingDuration: number(entry.blockingDuration),
            overlapsObservationStart: entry.startTime < cutoff,
            renderStart: number(entry.renderStart),
            styleAndLayoutStart: number(entry.styleAndLayoutStart),
            firstUIEventTimestamp: number(entry.firstUIEventTimestamp),
            droppedScripts: Math.max(0, scripts.length - 16),
            scripts: Object.freeze(
              scripts.slice(0, 16).map((script) =>
                Object.freeze({
                  duration: number(script.duration),
                  executionStart: number(script.executionStart),
                  forcedStyleAndLayoutDuration: number(
                    script.forcedStyleAndLayoutDuration,
                  ),
                  pauseDuration: number(script.pauseDuration),
                }),
              ),
            ),
          }),
        );
      }
    }
  }
  for (const [type, key] of [
    ["event", "event"],
    ["long-animation-frame", "loaf"],
  ]) {
    let observer;
    try {
      if (!PerformanceObserverClass?.supportedEntryTypes?.includes(type))
        continue;
      observer = new PerformanceObserverClass((list) =>
        collect(list.getEntries(), type === "event" ? "event" : "loaf"),
      );
      observer.observe({
        type,
        buffered: false,
        ...(type === "event" ? { durationThreshold: 16 } : {}),
      });
      observers.push({ observer, kind: type === "event" ? "event" : "loaf" });
      supported[key] = true;
    } catch {
      // An advertised but denied optional observer must not fail the workload.
      observer?.disconnect();
    }
  }
  function clear() {
    events.length = 0;
    loaf.length = 0;
    dropped.events = 0;
    dropped.loaf = 0;
  }
  return Object.freeze({
    reset() {
      for (const { observer } of observers) observer.takeRecords();
      clear();
      cutoff = now();
    },
    snapshot() {
      if (!disposed)
        for (const { observer, kind } of observers)
          collect(observer.takeRecords(), kind);
      return Object.freeze({
        supported: Object.freeze({ ...supported }),
        dropped: Object.freeze({ ...dropped }),
        events: Object.freeze(events.slice()),
        loaf: Object.freeze(loaf.slice()),
      });
    },
    dispose() {
      disposed = true;
      for (const { observer } of observers) observer.disconnect();
      observers.length = 0;
      clear();
    },
  });
}
