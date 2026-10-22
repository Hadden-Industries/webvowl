import assert from "node:assert/strict";
import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Browser-wide tracing retains short-lived worker activity that a page-only
// CPU profile misses. None of these controls run during a latency pass.
export function createProductionTrace({ call, events, output }) {
  let active = false;
  const traceBufferSizeInKb = 512 * 1024;
  let bufferObservation;
  return {
    async start() {
      assert(!active, "A diagnostic trace is already active");
      bufferObservation = {
        reports: 0,
        maximumFraction: 0,
        maximumEventCount: 0,
      };
      assert(!events.has("Tracing.bufferUsage"));
      events.set("Tracing.bufferUsage", (usage) => {
        bufferObservation.reports++;
        bufferObservation.maximumFraction = Math.max(
          bufferObservation.maximumFraction,
          usage.percentFull ?? usage.value ?? 0,
        );
        bufferObservation.maximumEventCount = Math.max(
          bufferObservation.maximumEventCount,
          usage.eventCount ?? 0,
        );
      });
      try {
        await call(
          "Tracing.start",
          {
            transferMode: "ReturnAsStream",
            streamFormat: "json",
            streamCompression: "gzip",
            bufferUsageReportingInterval: 1000,
            traceConfig: {
              recordMode: "recordUntilFull",
              // Long SVG revisions can exhaust Chrome's default 200 MB buffer.
              // This diagnostic-only allocation remains finite; data loss still fails.
              traceBufferSizeInKb,
              enableSampling: true,
              includedCategories: [
                "devtools.timeline",
                "v8.execute",
                "blink.user_timing",
                "disabled-by-default-devtools.timeline",
                "disabled-by-default-devtools.timeline.stack",
                "disabled-by-default-v8.cpu_profiler",
              ],
            },
          },
          null,
        );
      } catch (error) {
        events.delete("Tracing.bufferUsage");
        throw error;
      }
      active = true;
    },
    async stop(name) {
      assert(active, "No diagnostic trace is active");
      let complete;
      const completed = new Promise((done) => {
        complete = done;
      });
      assert(!events.has("Tracing.tracingComplete"));
      events.set("Tracing.tracingComplete", complete);
      let timer;
      let file;
      let stream;
      try {
        await call("Tracing.end", {}, null);
        const result = await Promise.race([
          completed,
          new Promise((_done, fail) => {
            timer = setTimeout(
              () => fail(new Error("Diagnostic trace completion deadline")),
              60000,
            );
          }),
        ]);
        stream = result.stream;
        assert(stream, "Browser did not return a trace stream");
        assert.equal(result.streamCompression, "gzip");
        file = await open(resolve(output, name), "wx");
        const hash = createHash("sha256");
        let byteLength = 0;
        for (;;) {
          const chunk = await call("IO.read", { handle: stream }, null);
          const bytes = Buffer.from(
            chunk.data,
            chunk.base64Encoded ? "base64" : "utf8",
          );
          await file.writeFile(bytes);
          hash.update(bytes);
          byteLength += bytes.length;
          if (chunk.eof) break;
        }
        return {
          path: name,
          byteLength,
          sha256: hash.digest("hex"),
          dataLossOccurred: result.dataLossOccurred,
          traceBufferSizeInKb,
          bufferObservation,
        };
      } finally {
        clearTimeout(timer);
        events.delete("Tracing.tracingComplete");
        events.delete("Tracing.bufferUsage");
        active = false;
        try {
          if (stream) await call("IO.close", { handle: stream }, null);
        } finally {
          await file?.close();
        }
      }
    },
  };
}
