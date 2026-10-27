import { expect, jest, test } from "@jest/globals";
import { dispatchCdpEvent } from "./dispatchCdpEvent.mjs";

test("registered CDP events forward the original payload and session exactly once", () => {
  const handler = jest.fn();
  const other = jest.fn();
  const events = new Map([
    ["Runtime.exceptionThrown", handler],
    ["Debugger.paused", other],
  ]);
  const params = { exceptionDetails: { text: "fixture" } };
  dispatchCdpEvent(events, {
    method: "Runtime.exceptionThrown",
    params,
    sessionId: "session-1",
  });
  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler.mock.calls[0][0]).toBe(params);
  expect(handler.mock.calls[0][1]).toBe("session-1");
  expect(other).not.toHaveBeenCalled();
});

test.each([
  "Unknown.event",
  "__proto__",
  "constructor",
  "toString",
  "get",
  "set",
  "clear",
  "Runtime.exceptionThrown.call",
  "Runtime.exceptionThrown\u0000",
  null,
  undefined,
  1,
  ["Runtime.exceptionThrown"],
  { toString: "Runtime.exceptionThrown" },
])(
  "unregistered or non-string method %j cannot select a callback",
  (method) => {
    const handler = jest.fn();
    const events = new Map([["Runtime.exceptionThrown", handler]]);
    dispatchCdpEvent(events, { method, params: {} });
    expect(handler).not.toHaveBeenCalled();
    expect(events.size).toBe(1);
    expect(events.get("Runtime.exceptionThrown")).toBe(handler);
  },
);

test("removed registrations and non-callable values are ignored", () => {
  const handler = jest.fn();
  const events = new Map([["Tracing.tracingComplete", handler]]);
  events.delete("Tracing.tracingComplete");
  dispatchCdpEvent(events, { method: "Tracing.tracingComplete" });
  expect(handler).not.toHaveBeenCalled();
  for (const value of [undefined, null, false, 1, "callback", {}]) {
    events.set("Tracing.tracingComplete", value);
    expect(() =>
      dispatchCdpEvent(events, { method: "Tracing.tracingComplete" }),
    ).not.toThrow();
  }
});

test("registered callbacks retain their error behavior", () => {
  const failure = new Error("callback failure");
  const events = new Map([
    [
      "Debugger.paused",
      () => {
        throw failure;
      },
    ],
  ]);
  expect(() => dispatchCdpEvent(events, { method: "Debugger.paused" })).toThrow(
    failure,
  );
});
