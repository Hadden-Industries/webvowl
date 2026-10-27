// Only callbacks registered by the harness may receive browser event payloads.
export function dispatchCdpEvent(events, message) {
  if (typeof message.method !== "string") return;
  const handler = events.get(message.method);
  if (typeof handler === "function") {
    handler(message.params, message.sessionId);
  }
}
