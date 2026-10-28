import { DOMParser } from "@xmldom/xmldom";
import { ResourceLimitError } from "owlapi/io";
import { readBoundedBytes } from "./boundedSourceBytes.js";
import {
  ontologyServiceOrigin,
  ontologySourceIri,
  OntologyCacheError,
} from "./ontologySourceIdentity.js";

const namespace = "urn:oasis:names:tc:entity:xmlns:xml:catalog";
const xmlNamespace = "http://www.w3.org/XML/1998/namespace";

/** Restricted, bounded OASIS exact-name catalogs; no rewrite rules, external entities or ambient fetch. */
export async function readOasisOntologyCatalog({
  serviceOrigin,
  catalogIri = `${serviceOrigin}/ontology/catalog-v001.xml`,
  fetchImpl = globalThis.fetch,
  signal,
  onDiagnostic = () => {},
} = {}) {
  const origin = ontologyServiceOrigin(serviceOrigin);
  const mappings = new Map();
  const visited = new Set();
  const active = new Set();
  let byteLength = 0;
  function catalogUrl(iri, root = false) {
    const url = new URL(iri);
    if (
      url.origin !== origin ||
      url.search ||
      url.hash ||
      !(
        (root && url.pathname === "/ontology/catalog-v001.xml") ||
        url.pathname.startsWith("/ontology/catalogs/")
      )
    ) {
      throw new OntologyCacheError();
    }
    return url.href;
  }
  async function visit(iri, depth) {
    signal?.throwIfAborted();
    if (depth > 4 || active.has(iri)) {
      throw new OntologyCacheError();
    }
    if (visited.has(iri)) {
      return;
    }
    if (visited.size >= 8) {
      throw new OntologyCacheError();
    }
    visited.add(iri);
    active.add(iri);
    const response = await fetchImpl(iri, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      signal,
    });
    if (!response.ok || (response.url && response.url !== iri)) {
      await response.body?.cancel();
      throw new OntologyCacheError();
    }
    const bytes = await readBoundedBytes(
      response,
      8388608 - byteLength,
      signal,
      ResourceLimitError,
    );
    byteLength += bytes.length;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Bound DOM allocation before the native parser constructs any nodes.
    let markupCount = 0;
    for (
      let offset = text.indexOf("<");
      offset >= 0;
      offset = text.indexOf("<", offset + 1)
    ) {
      if (++markupCount > 100000) {
        throw new OntologyCacheError();
      }
    }
    if (/<!(?:DOCTYPE|ENTITY)/iu.test(text) || /<\?(?!xml\s)/iu.test(text)) {
      throw new OntologyCacheError();
    }
    const document = new DOMParser({
      onError: () => {
        throw new OntologyCacheError();
      },
    }).parseFromString(text, "application/xml");
    if (
      document.documentElement.localName !== "catalog" ||
      document.documentElement.namespaceURI !== namespace
    ) {
      throw new OntologyCacheError();
    }
    const next = [];
    let elements = 0;
    function walk(element, base, nesting) {
      signal?.throwIfAborted();
      if (
        ++elements > 100000 ||
        nesting > 32 ||
        element.namespaceURI !== namespace ||
        !["catalog", "group", "uri", "nextCatalog"].includes(element.localName)
      ) {
        throw new OntologyCacheError();
      }
      for (const attribute of Array.from(element.attributes)) {
        if (!(
          attribute.name === "xmlns" ||
          attribute.prefix === "xmlns" ||
          (attribute.namespaceURI === xmlNamespace &&
            attribute.localName === "base") ||
          (!attribute.namespaceURI &&
            (element.localName === "uri"
              ? ["name", "uri"].includes(attribute.localName)
              : element.localName === "nextCatalog" &&
                attribute.localName === "catalog"))
        )) {
          throw new OntologyCacheError();
        }
      }
      const xmlBase = element.getAttributeNS(xmlNamespace, "base");
      const effectiveBase = xmlBase ? new URL(xmlBase, base).href : base;
      catalogUrl(effectiveBase, depth === 0);
      if (element.localName === "uri") {
        const name = ontologySourceIri(element.getAttribute("name"));
        const target = new URL(element.getAttribute("uri"), effectiveBase);
        if (
          target.origin !== origin ||
          !/^\/ontology\/cache\/artifacts\/sha256\/[0-9a-f]{64}$/u.test(
            target.pathname,
          ) ||
          target.hash
        ) {
          throw new OntologyCacheError();
        }
        if (mappings.has(name)) {
          onDiagnostic({ code: "CACHE_CATALOG_DUPLICATE" });
          if (mappings.get(name) !== target.href) {
            throw new OntologyCacheError();
          }
        } else {
          mappings.set(name, target.href);
        }
      } else if (element.localName === "nextCatalog") {
        next.push(
          catalogUrl(
            new URL(element.getAttribute("catalog"), effectiveBase).href,
          ),
        );
      }
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 1) {
          if (["uri", "nextCatalog"].includes(element.localName)) {
            throw new OntologyCacheError();
          }
          walk(child, effectiveBase, nesting + 1);
        } else if (
          child.nodeType !== 8 &&
          !(child.nodeType === 3 && !child.nodeValue.trim())
        ) {
          throw new OntologyCacheError();
        }
      }
    }
    walk(document.documentElement, iri, 0);
    for (const target of next) {
      await visit(target, depth + 1);
    }
    active.delete(iri);
  }
  await visit(catalogUrl(catalogIri, true), 0);
  signal?.throwIfAborted();
  return mappings;
}
