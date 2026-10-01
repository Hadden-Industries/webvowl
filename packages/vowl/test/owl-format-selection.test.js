import { jest } from "@jest/globals";
import { OWLDocumentFormat } from "owlapi/model";
import { OWLDocumentFormats } from "owlapi/formats";

const alias = "application/x-test-owlapi-functional";
const ambiguous = "application/x-test-owlapi-ambiguous";

// The external dependency's current catalogue has no shared media type. Supply
// genuine format identities with controlled metadata to test consumer selection;
// keep the real owning parsers, source assessment and VOWL mapping in the path.
const formats = Object.freeze({
  ...OWLDocumentFormats,
  FUNCTIONAL: new OWLDocumentFormat({
    ...OWLDocumentFormats.FUNCTIONAL,
    mediaTypes: [...OWLDocumentFormats.FUNCTIONAL.mediaTypes, alias, ambiguous],
  }),
  MANCHESTER: new OWLDocumentFormat({
    ...OWLDocumentFormats.MANCHESTER,
    mediaTypes: [...OWLDocumentFormats.MANCHESTER.mediaTypes, ambiguous],
  }),
});
jest.unstable_mockModule("owlapi/formats", () => ({
  OWLDocumentFormats: formats,
}));
const { fromOwl } = await import("vowl/owl");
const { encode } = await import("vowl");

const bytes = (text) => new TextEncoder().encode(text);
const subclass = "Ontology(SubClassOf(<urn:A> <urn:B>))";
const options = { documentIri: "urn:doc", mediaType: "text/owl-functional" };
const strict =
  "https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/strict/v1";

test.each([
  [alias, undefined],
  [ambiguous, "MAPPING_MEDIA_TYPE_UNSUPPORTED"],
])(
  "owning metadata controls %s at root and import boundaries",
  async (mediaType, code) => {
    for (const mappingProfile of [undefined, strict]) {
      for (const imported of [false, true]) {
        const load = (selected) =>
          imported
            ? fromOwl(bytes("Ontology(Import(<urn:import>))"), {
                ...options,
                mappingProfile,
                resolveImport: async () => ({
                  bytes: bytes(subclass),
                  documentIri: "urn:import",
                  mediaType: selected,
                }),
              })
            : fromOwl(bytes(subclass), {
                ...options,
                mappingProfile,
                mediaType: selected,
              });
        if (code) {
          await expect(load(mediaType)).rejects.toMatchObject({
            code,
            pointer: imported ? "/resolveImport/mediaType" : "/mediaType",
          });
        } else {
          const result = await load(mediaType);
          const expected = await load(options.mediaType);
          expect(result.diagnostics).toEqual([]);
          expect(result.document.structural.constructs).toHaveLength(1);
          expect(
            result.document.structural.subjects.map(({ iri }) => iri).sort(),
          ).toEqual(["urn:A", "urn:B"]);
          expect(encode(result.document)).toEqual(encode(expected.document));
        }
      }
    }
  },
);
