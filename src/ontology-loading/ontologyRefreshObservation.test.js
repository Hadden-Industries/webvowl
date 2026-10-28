import { jest } from "@jest/globals";
import { createOntologyRefreshObservation } from "./ontologyRefreshObservation.js";

function fixture() {
  const source = {
    requestedDocumentIri: "https://origin.test/root",
    resolution: {
      sourceVersionIdentity: "old",
      acquiredAt: "2026-10-01T00:00:00.000Z",
      checkedAt: "2026-10-02T00:00:00.000Z",
    },
    pointer: {
      freshUntil: "2026-10-04T00:00:00.000Z",
      nextCheckAllowedAt: "2026-10-03T00:00:00.000Z",
    },
  };
  const identity = { loadGeneration: 3, documentRevision: 0 };
  const onStatus = jest.fn();
  const selected = {
    bytes: new Uint8Array([42]),
    documentIri: source.requestedDocumentIri,
  };
  const client = {
    refresh: jest.fn(async () => ({
      state: "CHANGED",
      resultBinding: {
        sourceVersionIdentity: "new",
        resolutionIdentity: "new-binding",
      },
    })),
    confirm: jest.fn(async () => selected),
  };
  const observation = createOntologyRefreshObservation({
    sources: [source],
    client,
    readIdentity: () => identity,
    onStatus,
    now: () => Date.parse("2026-10-02T12:00:00.000Z"),
  });
  return { observation, source, identity, onStatus, client, selected };
}

test("a fresh archived open creates no timer or provider call", () => {
  const { observation, client, onStatus } = fixture();
  observation.start();
  expect(client.refresh).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "archived", hasUpdate: false }),
  );
  observation.dispose();
});

test("changed source is offered, then exactly confirmed on explicit apply", async () => {
  const { observation, source, client, onStatus, selected } = fixture();
  await observation.refresh();
  expect(client.confirm).not.toHaveBeenCalled();
  expect(onStatus).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "update-available", hasUpdate: true }),
  );
  expect(
    (await observation.selectUpdate()).get(source.requestedDocumentIri),
  ).toBe(selected);
  expect(client.confirm).toHaveBeenCalledWith(
    source.requestedDocumentIri,
    "new-binding",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  observation.dispose();
});

test("304/evidence-only requalification updates check dates without an offer", async () => {
  const { observation, client, onStatus } = fixture();
  client.refresh.mockResolvedValue({
    state: "UNCHANGED",
    lastSuccessfullyCheckedAt: "2026-10-04T00:00:00.000Z",
    resultBinding: {
      sourceVersionIdentity: "old",
      resolutionIdentity: "different-evidence",
    },
  });
  await observation.refresh();
  expect(onStatus).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: "checked",
      hasUpdate: false,
      sources: [
        {
          acquiredAt: "2026-10-01T00:00:00.000Z",
          checkedAt: "2026-10-04T00:00:00.000Z",
        },
      ],
    }),
  );
  observation.dispose();
});

test("an intervening edit invalidates an update without confirmation or replacement", async () => {
  const { observation, identity, client } = fixture();
  await observation.refresh();
  identity.documentRevision++;
  await expect(observation.selectUpdate()).rejects.toHaveProperty(
    "code",
    "CACHE_OFFER_EXPIRED",
  );
  expect(client.confirm).not.toHaveBeenCalled();
  observation.dispose();
});

test("late observation after replacement never publishes and never cancels backend work", async () => {
  const { observation, client, onStatus } = fixture();
  let finish;
  client.refresh.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const waiting = observation.refresh();
  expect(onStatus).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: "checking" }),
  );
  observation.dispose();
  finish({
    state: "CHANGED",
    resultBinding: {
      sourceVersionIdentity: "new",
      resolutionIdentity: "new-binding",
    },
  });
  await expect(waiting).rejects.toHaveProperty("code", "CACHE_OFFER_EXPIRED");
  expect(onStatus).toHaveBeenCalledTimes(1);
  expect(client.confirm).not.toHaveBeenCalled();
});

test("failed refresh remains a failure and preserves the previous successful-check date", async () => {
  const { observation, client, onStatus } = fixture();
  client.refresh.mockResolvedValue({
    state: "FAILED",
    error: { code: "UPSTREAM_TIMEOUT" },
  });
  await expect(observation.refresh()).rejects.toHaveProperty(
    "code",
    "CACHE_REFRESH_FAILED",
  );
  expect(onStatus).toHaveBeenLastCalledWith(
    expect.objectContaining({
      status: "check-failed",
      sources: [
        {
          acquiredAt: "2026-10-01T00:00:00.000Z",
          checkedAt: "2026-10-02T00:00:00.000Z",
        },
      ],
    }),
  );
  observation.dispose();
});
