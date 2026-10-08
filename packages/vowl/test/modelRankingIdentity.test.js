import { openOwl } from "vowl/owl";
import { readFileSync } from "node:fs";
import {
  inspectModel,
  readModelRankingIdentity,
  captureModel,
  profiles,
  editModel,
  canonicalize,
  openCanonical,
} from "vowl";

const load = (text) =>
  openOwl(new TextEncoder().encode(text), {
    documentIri: "urn:ranking",
    mediaType: "text/turtle",
  });
const prefix =
  "@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>. ";

async function topology(model) {
  const inspection = inspectModel(model);
  const identity = await readModelRankingIdentity(model);
  const keys = new Map(
    identity.correspondence.map(({ previous, current }) => [previous, current]),
  );
  expect(keys.size).toBe(inspection.occurrences.length);
  expect([...keys.values()].every((key) => typeof key === "string")).toBe(true);
  expect(new Set(keys.values()).size).toBe(keys.size);
  return inspection.occurrences
    .map((occurrence) => ({
      key: keys.get(occurrence.id),
      kind: occurrence.kind,
      endpoints: (occurrence.ends ?? [occurrence.from, occurrence.to])
        .filter(Boolean)
        .map((id) => keys.get(id))
        .sort(),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

test("OWL ranking identity admits structural keys without weakening capture qualifications", async () => {
  const { model } = await load(prefix + "<urn:A> a owl:Class.");
  const before = inspectModel(model);
  expect(await topology(model)).toHaveLength(1);
  expect(inspectModel(model)).toEqual(before);
  await expect(
    captureModel(model, { profile: profiles.structuralContent }),
  ).rejects.toMatchObject({ code: "CAPTURE_QUALIFICATION_UNREPRESENTABLE" });
});

test("renamed blank nodes, shuffled statements and set operands preserve canonical topology keys", async () => {
  const first = await load(
    prefix +
      "<urn:A> a owl:Class; rdfs:subClassOf _:x. <urn:B> a owl:Class. _:x owl:unionOf (<urn:A> <urn:B>).",
  );
  const second = await load(
    prefix +
      "_:expr owl:unionOf (<urn:B> <urn:A>). <urn:B> a owl:Class. <urn:A> rdfs:subClassOf _:expr; a owl:Class.",
  );
  expect(await topology(first.model)).toEqual(await topology(second.model));
});

test("symmetric anonymous isolates compare by canonical isomorphism rather than source handles", async () => {
  async function fixture(name) {
    return openCanonical(
      await canonicalize(
        JSON.parse(
          readFileSync(
            new URL(
              `../conformance/vectors/symmetric-anonymous-classes/${name}.json`,
              import.meta.url,
            ),
          ),
        ),
        { profile: profiles.structuralContent },
      ),
    );
  }
  const a = await fixture("source");
  const b = await fixture("permuted-source");
  expect(await topology(a.model)).toEqual(await topology(b.model));
});

test("edited revisions, cancellation and limits preserve the original live model", async () => {
  const { model } = await load(prefix + "<urn:A> a owl:Class.");
  const before = await topology(model);
  const next = await editModel(model, [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: "new:s", iri: "urn:B" },
    },
    {
      kind: "insert",
      collection: "roles",
      record: { id: "new:r", subject: "new:s", kind: "class" },
    },
  ]);
  expect((await readModelRankingIdentity(next.model)).revision).toBe(1);
  expect(await topology(next.model)).toHaveLength(2);
  const abort = new AbortController();
  abort.abort();
  await expect(
    readModelRankingIdentity(model, { signal: abort.signal }),
  ).rejects.toMatchObject({ code: "ABORTED" });
  await expect(
    readModelRankingIdentity(model, { limits: { rdfQuads: 1 } }),
  ).rejects.toMatchObject({ code: "RDF_RESOURCE_LIMIT" });
  expect(await topology(model)).toEqual(before);
});
