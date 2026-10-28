import { jest } from "@jest/globals";
import { readOasisOntologyCatalog } from "./oasisXmlOntologyCatalog.js";

const serviceOrigin = "https://cache.test";
const root = `${serviceOrigin}/ontology/catalog-v001.xml`;
const iri = "https://source.test/onto#one";
const target = `${serviceOrigin}/ontology/cache/artifacts/sha256/${"a".repeat(64)}?source=${"b".repeat(64)}&amp;binding=${"c".repeat(64)}`;
const xml = (children) =>
  `<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">${children}</catalog>`;

test("bounded nested catalogs preserve exact names, xml:base and source binding tokens", async () => {
  const fetchImpl = jest.fn(
    async (url) =>
      new Response(
        url === root
          ? xml(
              '<group xml:base="/ontology/catalogs/"><nextCatalog catalog="nested.xml"/></group>',
            )
          : xml(`<uri name="${iri}" uri="${target}"/>`),
      ),
  );
  const map = await readOasisOntologyCatalog({ serviceOrigin, fetchImpl });
  expect(map.get(iri)).toBe(target.replace("&amp;", "&"));
  expect(map.has("https://source.test/onto")).toBe(false);
  expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
    root,
    `${serviceOrigin}/ontology/catalogs/nested.xml`,
  ]);
});

test.each([
  `<!DOCTYPE catalog [<!ENTITY x SYSTEM "https://evil.test/secret">]>${xml("")}`,
  `<?xml-stylesheet href="https://evil.test/style"?>${xml("")}`,
  '<catalog xmlns="https://evil.test"/>',
  xml(
    '<rewriteURI uriStartString="https://" rewritePrefix="https://evil.test"/>',
  ),
  xml('<nextCatalog catalog="https://evil.test/ontology/catalogs/x.xml"/>'),
  xml(
    `<uri name="${iri}" uri="${target}"/><uri name="${iri}" uri="${target.replace("a".repeat(64), "d".repeat(64))}"/>`,
  ),
])("unsafe or conflicting catalog is rejected: %s", async (text) => {
  const fetchImpl = jest.fn(async () => new Response(text));
  await expect(
    readOasisOntologyCatalog({ serviceOrigin, fetchImpl }),
  ).rejects.toThrow();
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("catalog cycles and over-budget streamed bodies stop acquisition", async () => {
  const fetchImpl = jest.fn(
    async (url) =>
      new Response(
        xml(
          `<nextCatalog catalog="${serviceOrigin}/ontology/catalogs/cycle.xml"/>`,
        ),
      ),
  );
  await expect(
    readOasisOntologyCatalog({ serviceOrigin, fetchImpl }),
  ).rejects.toThrow();
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  await expect(
    readOasisOntologyCatalog({
      serviceOrigin,
      fetchImpl: async () => new Response(" ".repeat(8388609)),
    }),
  ).rejects.toHaveProperty("code", "RESOURCE_LIMIT_EXCEEDED");
});
