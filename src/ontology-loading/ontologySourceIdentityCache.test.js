import { jest } from "@jest/globals";

afterEach(() => jest.restoreAllMocks());
async function identity() {
  jest.resetModules();
  return import("./ontologySourceIdentity.js");
}

test("repeated textual identities reuse only the exact preimage digest", async () => {
  const api = await identity();
  const digest = jest.spyOn(globalThis.crypto.subtle, "digest");
  const value = { a: "same", nested: { b: 1 } };
  const first = await api.ontologyRecordIdentity("resolution", value);
  expect(
    await api.ontologyRecordIdentity("resolution", {
      nested: { b: 1 },
      a: "same",
    }),
  ).toBe(first);
  expect(digest).toHaveBeenCalledTimes(1);
  value.nested.b = 2;
  expect(await api.ontologyRecordIdentity("resolution", value)).not.toBe(first);
  expect(await api.ontologyRecordIdentity("validation", value)).not.toBe(first);
  expect(digest).toHaveBeenCalledTimes(3);
});
test("source identities still validate each input and preserve exact lexical identity", async () => {
  const api = await identity();
  const digest = jest.spyOn(globalThis.crypto.subtle, "digest");
  expect(await api.ontologySourceKey("https://EXAMPLE.test/a")).toBe(
    await api.ontologySourceKey("https://EXAMPLE.test/a"),
  );
  expect(await api.ontologySourceKey("https://example.test/a")).not.toBe(
    await api.ontologySourceKey("https://EXAMPLE.test/a"),
  );
  expect(digest).toHaveBeenCalledTimes(2);
  expect(() => api.ontologySourceKey("https://example.test/a ")).toThrow(
    api.OntologyCacheError,
  );
});
test("artifact byte digests remain independent even after identical identity lookups", async () => {
  const api = await identity();
  const digest = jest.spyOn(globalThis.crypto.subtle, "digest");
  const bytes = new TextEncoder().encode("content");
  await api.ontologySha256(bytes);
  await api.ontologySha256(bytes);
  expect(digest).toHaveBeenCalledTimes(2);
  bytes[0] = 0;
  expect(await api.ontologySha256(bytes)).not.toBe(
    await api.ontologySha256(new TextEncoder().encode("content")),
  );
});
test("a failed digest is retained as failure and cannot poison a retry", async () => {
  const api = await identity();
  const error = new Error("Crypto unavailable");
  const digest = jest
    .spyOn(globalThis.crypto.subtle, "digest")
    .mockRejectedValueOnce(error);
  await expect(api.ontologyRecordIdentity("resolution", { a: 1 })).rejects.toBe(
    error,
  );
  await expect(
    api.ontologyRecordIdentity("resolution", { a: 1 }),
  ).resolves.toMatch(/^[a-f0-9]{64}$/u);
  expect(digest).toHaveBeenCalledTimes(2);
});
test("cache capacity and long preimages only disable reuse, never identity generation", async () => {
  const api = await identity();
  const digest = jest.spyOn(globalThis.crypto.subtle, "digest");
  const values = await Promise.all(
    Array.from({ length: 140 }, (_, i) =>
      api.ontologyRecordIdentity("test", { i }),
    ),
  );
  expect(new Set(values).size).toBe(140);
  const before = digest.mock.calls.length;
  await api.ontologyRecordIdentity("test", { i: 0 });
  expect(digest).toHaveBeenCalledTimes(before + 1);
  await api.ontologyRecordIdentity("test", { i: 139 });
  expect(digest).toHaveBeenCalledTimes(before + 1);
  const large = { text: "a".repeat(17000) };
  const first = await api.ontologyRecordIdentity("large", large);
  expect(await api.ontologyRecordIdentity("large", large)).toBe(first);
  expect(digest).toHaveBeenCalledTimes(before + 3);
});
