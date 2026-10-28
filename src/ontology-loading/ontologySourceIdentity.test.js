import { readFileSync } from "node:fs";
import {
  ontologyRecordIdentity,
  ontologySourceKey,
  ontologySha256,
} from "./ontologySourceIdentity.js";
import { parseOntologyCacheJson } from "./ontologyCacheJson.js";

const vectors = JSON.parse(
  readFileSync(
    new URL("./contracts/fixtures/identity-vectors.v1.json", import.meta.url),
  ),
).vectors;
test.each(vectors)("provider literal identity $id", async (vector) => {
  const actual =
    vector.algorithm === "sha256-utf8"
      ? await ontologySha256(new TextEncoder().encode(vector.inputText))
      : await ontologyRecordIdentity(vector.domain, vector.input);
  expect(actual).toBe(vector.expectedSha256);
});

test("exact logical spellings and fragments remain distinct", async () => {
  expect(await ontologySourceKey("https://ontology.example.test/onto#v1")).toBe(
    "2ae413f58ab8c2a6a10ed89e9a2de1039cedcfacd62cea2d0c78db205846ce1f",
  );
  expect(
    await ontologySourceKey("https://ONTOLOGY.example.test/onto#v1"),
  ).not.toBe(await ontologySourceKey("https://ontology.example.test/onto#v1"));
});

test.each([
  '{"a":1,"a":2}',
  '{"a":1,"\\u0061":2}',
  '{"a":{"b":1,"b":2}}',
  '{"text":"\\ud800"}',
  '{"n":9007199254740992}',
  '{"n":1e999}',
  '{"checkedAt":"2026-02-30T00:00:00.000Z"}',
  "\ufeff{}",
  "[".repeat(33) + "0" + "]".repeat(33),
  "{} {}",
])("hostile metadata is rejected before schema validation: %s", (text) => {
  expect(() => parseOntologyCacheJson(new TextEncoder().encode(text))).toThrow(
    expect.objectContaining({ code: "CACHE_PROTOCOL_INVALID" }),
  );
});

test("native JSON construction retains own proto keys and ordered arrays", () => {
  const value = parseOntologyCacheJson(
    new TextEncoder().encode('{"__proto__":{"x":1},"items":[true,null,2]}'),
  );
  expect(Object.hasOwn(value, "__proto__")).toBe(true);
  expect(value.items).toEqual([true, null, 2]);
  expect({}.x).toBeUndefined();
});
