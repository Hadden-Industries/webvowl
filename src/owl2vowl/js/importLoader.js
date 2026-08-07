import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { NAMESPACES, ONTOLOGY_CATALOG } from "./constants.js";
import { resolveXmlEntities } from "./xmlUtils.js";
import { parseTurtle, serializeTriplesToRdfXml } from "./turtleParser.js";
import { isOwlXmlFormat, convertOwlXmlToRdfXml } from "./owlXmlParser.js";
import { isManchesterSyntaxFormat, convertManchesterSyntaxToRdfXml } from "./manchesterSyntaxParser.js";
import { parseFunctionalSyntax } from "./functionalSyntaxParser.js";
import { parseDLSyntax, isDLSyntaxFormat } from "./dlSyntaxParser.js";

/**
 * Attempts to parse an ontology string across multiple syntax formats 
 * (OWL/XML, Functional, Turtle, Manchester Syntax) and convert it to RDF/XML.
 * Emulates the Java OWLAPI fall-through parser selection logic.
 * 
 * @param {string} text - The ontology source string
 * @returns {string} The converted RDF/XML string, or the original string if all converters fail (assuming it is native RDF/XML)
 */
export function convertToRdfXmlFallback(text) {
  const domParser = new DOMParser({
    onError: () => {}
  });

  // Java OWLAPI priority order (HasPriorityComparator sorts ascending — lower = first):
  //   RDF/XML = 0 (highest), OWL/XML = 1, Functional = 2, Manchester = 4, Turtle = 12
  //
  // RDF/XML is the default format: try it first. If the text is already valid XML
  // (no parsererror) AND it is not OWL/XML (which needs conversion), return it
  // immediately without attempting any converter.
  // Note: xmldom throws ParseError (not a parsererror element) on completely non-XML input.
  try {
    const nativeXmlDoc = domParser.parseFromString(text, "application/xml");
    if (!nativeXmlDoc.getElementsByTagName("parsererror")[0] && !isOwlXmlFormat(nativeXmlDoc)) {
      return text;
    }
  } catch (_xmlErr) {
    // Not valid XML at all — proceed to format converters below
  }

  // Not valid XML — try each non-XML format converter in Java priority order:
  // OWL/XML (1) → Functional (2) → Manchester (4) → Turtle (12) → DL Syntax (15) → KRSS2 (16)
  const parsers = [
    {
      name: "OWL/XML",
      parse: (t) => convertOwlXmlToRdfXml(t)
    },
    {
      name: "Functional Syntax",
      parse: (t) => parseFunctionalSyntax(t)
    },
    {
      name: "Manchester Syntax",
      parse: (t) => {
        // Relaxed mode is very permissive — it accepts nearly anything and returns
        // a near-empty ontology skeleton without throwing. Only apply it when the
        // file is positively identified as Manchester syntax by the sniff check;
        // otherwise throw so the fallback continues to the next parser.
        if (!isManchesterSyntaxFormat(t)) {
          throw new Error("Not Manchester syntax");
        }
        return convertManchesterSyntaxToRdfXml(t, { strictMode: false });
      }
    },
    {
      name: "Turtle",
      parse: (t) => {
        const parsed = parseTurtle(t);
        return serializeTriplesToRdfXml(parsed.triples, parsed.prefixes, parsed.baseIri);
      }
    },
    {
      name: "DL Syntax",
      parse: (t) => {
        // Sniff guard to prevent DL Syntax from consuming non-DL input and throwing later,
        // although DL Syntax does not have a relaxed mode, it is a best practice.
        if (!isDLSyntaxFormat(t)) {
          throw new Error("Not DL syntax");
        }
        return parseDLSyntax(t);
      }
    },
    {
      // TODO: Implement KRSS2 parser (Java: KRSS2OWLParserFactory @HasPriority(16))
      // Reference: owlapi/parsers/.../krss2/parser/KRSS2OWLParserFactory.java
      name: "KRSS2",
      parse: (_t) => { throw new Error("KRSS2 parser not yet implemented"); }
    }
  ];

  for (const parserDef of parsers) {
    try {
      const convertedXml = parserDef.parse(text);
      
      // Validate that it produced structurally sound XML
      const doc = domParser.parseFromString(convertedXml, "application/xml");
      if (!doc.getElementsByTagName("parsererror")[0]) {
        return convertedXml;
      }
    } catch (_err) {
      // Failed to parse, fall through to the next parser in the list
    }
  }

  // If all alternate format parsers fail, return the original text and let
  // the downstream RDF parser produce the final error.
  return text;
}

/**
 * Resolves logical ontology import IRIs to dereferenceable physical URLs
 * using the catalog registries.
 * @param {string} importUri
 * @returns {string}
 */
export function resolveImportUrl(importUri) {
  if (!importUri) {return importUri;}
  
  // 1. Precise match
  if (ONTOLOGY_CATALOG[importUri]) {
    return ONTOLOGY_CATALOG[importUri];
  }
  
  const normalize = (uri) => uri ? uri.replace(/^https?:\/\//i, "").replace(/[#/]$/, "").toLowerCase() : "";
  const targetNorm = normalize(importUri);

  // 2. Normalized protocol/separator match
  for (const [key, val] of Object.entries(ONTOLOGY_CATALOG)) {
    if (normalize(key) === targetNorm) {
      return val;
    }
  }

  // 3. Filename/basename fallback match (e.g. "prov-o", "prov-o.rdf", "prov.owl")
  const getFilename = (str) => {
    if (!str) { return ""; }
    const clean = str.replace(/[#/]$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1].toLowerCase();
  };

  const targetFile = getFilename(importUri);
  const targetFileNoExt = targetFile.replace(/\.(rdf|owl|ttl|xml)$/i, "");

  if (targetFileNoExt) {
    for (const [key, val] of Object.entries(ONTOLOGY_CATALOG)) {
      const keyFile = getFilename(key).replace(/\.(rdf|owl|ttl|xml)$/i, "");
      const valFile = getFilename(val).replace(/\.(rdf|owl|ttl|xml)$/i, "");
      if (keyFile === targetFileNoExt || valFile === targetFileNoExt) {
        return val;
      }
    }
  }
  
  return importUri;
}

/**
 * Loads the initial XML doc, fetches transitively all imports,
 * merges them into a single XML tree, and calls rootParserFn.
 * @param {string} initialXmlText
 * @param {function} rootParserFn
 * @returns {Promise<any>}
 */
export function loadWithImports(initialXmlText, rootParserFn) {
  const resolvedText = resolveXmlEntities(initialXmlText);
  const parsedInitialText = convertToRdfXmlFallback(resolvedText);

  const parser = new DOMParser();
  let mainDoc;
  try {
    mainDoc = parser.parseFromString(parsedInitialText, "application/xml");
  } catch (e) {
    return Promise.reject(e);
  }

  const parserError = mainDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    return Promise.reject(new Error("XML parsing error: " + parserError.textContent));
  }

  const rootEl = mainDoc.documentElement;
  if (!rootEl) {
    return Promise.reject(new Error("Invalid XML document"));
  }

  const loadedUrls = new Set();
  const normalizeUrl = (uri) => uri ? uri.replace(/^https?:\/\//i, "").replace(/[#/]$/, "").toLowerCase() : "";

  function isAlreadyLoaded(uri) {
    if (!uri) { return true; }
    if (loadedUrls.has(uri)) { return true; }
    const norm = normalizeUrl(uri);
    return Boolean(norm && loadedUrls.has(norm));
  }

  function markLoaded(uri) {
    if (!uri) { return; }
    loadedUrls.add(uri);
    const norm = normalizeUrl(uri);
    if (norm) { loadedUrls.add(norm); }
  }
  
  function getAttr(el, name, ns) {
    if (ns) {
      const val = el.getAttributeNS(ns, name);
      if (val !== null && val !== "") {return val;}
    }
    return el.getAttribute(name) || el.getAttribute("rdf:" + name) || el.getAttribute("owl:" + name);
  }

  function getImports(doc, docBase) {
    const imports = [];
    const elements = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS("*", "imports") : doc.getElementsByTagName("owl:imports");
    for (let i = 0; i < elements.length; i++) {
      let res = getAttr(elements[i], "resource", NAMESPACES.RDF);
      if (res) {
        if (docBase && !/^https?:\/\//i.test(res)) {
          try {
            res = new URL(res, docBase).href;
          } catch (_e) {
            // Keep original res if resolution fails
          }
        }
        imports.push(res);
      }
    }
    return imports;
  }

  // Identify main ontology IRI to avoid self-imports
  const ontologyEl = (mainDoc.getElementsByTagNameNS ? mainDoc.getElementsByTagNameNS("*", "Ontology") : mainDoc.getElementsByTagName("owl:Ontology"))[0];
  if (ontologyEl) {
    const mainOntologyIri = getAttr(ontologyEl, "about", NAMESPACES.RDF) || "";
    if (mainOntologyIri) {markLoaded(mainOntologyIri);}
  }
  const baseAttr = rootEl.getAttribute("xml:base") || rootEl.getAttribute("base") || "";
  if (baseAttr) {markLoaded(baseAttr);}

  function fetchAndMerge(doc, currentBase) {
    const docRoot = doc ? doc.documentElement : null;
    const docBase = (docRoot && (docRoot.getAttribute("xml:base") || docRoot.getAttribute("base"))) || currentBase || baseAttr || "";
    const imports = getImports(doc, docBase);
    const promises = [];
    
    for (const url of imports) {
      let resolvedUrl = resolveImportUrl(url);
      const isHttpsPage = typeof window !== "undefined" && window.location && window.location.protocol === "https:";
      let wasUpgraded = false;
      if (isHttpsPage && resolvedUrl.indexOf("http://") === 0) {
        resolvedUrl = "https://" + resolvedUrl.substring(7);
        wasUpgraded = true;
      }

      if (isAlreadyLoaded(url) || isAlreadyLoaded(resolvedUrl)) {
        continue;
      }

      markLoaded(url);
      markLoaded(resolvedUrl);

      const menu = (typeof window !== "undefined" && window.WebVOWL && window.WebVOWL.ontologyMenu) ? window.WebVOWL.ontologyMenu : null;
      if (menu && menu.append_bulletPoint) {
        if (wasUpgraded) {
          menu.append_bulletPoint(`Importing external ontology: ${url} (auto-upgraded HTTPS fetching: ${resolvedUrl}) ...`);
        } else {
          menu.append_bulletPoint(`Importing external ontology: ${url} (fetching: ${resolvedUrl}) ...`);
        }
      }
      
      promises.push(
        fetch(resolvedUrl, {
          headers: {
            'Accept': 'application/rdf+xml, application/xml, text/xml, application/owl+xml, */*'
          }
        })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
            }
            return response.text();
          })
          .then(xmlText => {
            const resolvedText = resolveXmlEntities(xmlText);
            const parsedXmlText = convertToRdfXmlFallback(resolvedText);
            const parser = new DOMParser({
              onError: () => {}
            });
            const importedDoc = parser.parseFromString(parsedXmlText, "application/xml");
            const parserError = importedDoc.getElementsByTagName("parsererror")[0];
            if (parserError) {
              throw new Error(`XML/Turtle parsing error inside imported ontology "${resolvedUrl}": ${parserError.textContent}`);
            }
            const importedRoot = importedDoc.documentElement;
            if (!importedRoot) {
              throw new Error(`The imported ontology "${resolvedUrl}" does not possess a valid root XML element.`);
            }
            
            // Merge namespace attributes
            if (importedRoot.attributes) {
              for (let i = 0; i < importedRoot.attributes.length; i++) {
                const attr = importedRoot.attributes[i];
                if (attr.name.startsWith("xmlns:") && !rootEl.hasAttribute(attr.name)) {
                  rootEl.setAttribute(attr.name, attr.value);
                }
              }
            }
            
            // Merge children, preserving original local base URI context (e.g. rdf:ID relative resolving)
            const importedBase = importedRoot.getAttribute("xml:base") || importedRoot.getAttribute("base") || resolvedUrl;
            if (importedBase) {
              markLoaded(importedBase);
            }
            const importedOntologyEl = (importedDoc.getElementsByTagNameNS ? importedDoc.getElementsByTagNameNS("*", "Ontology") : importedDoc.getElementsByTagName("owl:Ontology"))[0];
            if (importedOntologyEl) {
              const importedOntologyIri = getAttr(importedOntologyEl, "about", NAMESPACES.RDF) || "";
              if (importedOntologyIri) {
                markLoaded(importedOntologyIri);
              }
            }
            const children = importedRoot.childNodes;
            for (let i = 0; i < children.length; i++) {
              const child = children[i];
              if (child.nodeType === 1) {
                if (child.localName === "Ontology") {
                  continue;
                }
                const importedNode = mainDoc.importNode(child, true);
                if (importedBase && !importedNode.hasAttribute("xml:base")) {
                  importedNode.setAttribute("xml:base", importedBase);
                }
                rootEl.appendChild(importedNode);
              }
            }
            
            if (menu && menu.append_message_toLastBulletPoint) {
              menu.append_message_toLastBulletPoint("done");
            }
            
            // Transitively resolve any nested imports declared in the merged file
            return fetchAndMerge(importedDoc);
          })
          .catch(err => {
            if (err.message.indexOf("HTTP Error") === 0 || 
                err.message.indexOf("XML parsing error") === 0 || 
                err.message.indexOf("The imported ontology") === 0) {
              if (menu && menu.append_message_toLastBulletPoint) {
                menu.append_message_toLastBulletPoint("failed", { tone: "error" });
              }
              throw err;
            }

            const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

            let checkPromise;
            if (isOffline) {
              checkPromise = Promise.resolve("Network Connection Failure: Your browser reports that it is offline.");
            } else if (typeof fetch !== 'undefined') {
              checkPromise = fetch(resolvedUrl, { mode: 'no-cors' })
                .then(function () {
                  let corsMsg = "CORS Restriction: The remote server is online but blocks access from this origin.\n" +
                         "The server hosting '" + resolvedUrl + "' does not return the required 'Access-Control-Allow-Origin' header.\n" +
                         "To fix: Configure CORS headers on the host server, or register a local mapping: owl2vowl.catalog[\"" + url + "\"] = \"local_path\";";
                  if (wasUpgraded) {
                    corsMsg += "\nNote: The request was automatically upgraded to HTTPS ('" + resolvedUrl + "') to prevent secure context (Mixed Content) blocking, but the secure request failed with CORS.";
                  }
                  return corsMsg;
                })
                .catch(function () {
                  let unreachableMsg = "Host Unreachable / Network Error: Could not connect to the remote host at '" + resolvedUrl + "'.\n" +
                         "Please verify that the host domain is correct, the remote server is online, and there are no active firewall blocks.";
                  if (wasUpgraded) {
                    unreachableMsg += "\nNote: The request was automatically upgraded to HTTPS ('" + resolvedUrl + "') to prevent secure context (Mixed Content) blocking, but the secure host was unreachable.";
                  }
                  return unreachableMsg;
                });
            } else {
              checkPromise = Promise.resolve("Network Connection Failure / Fetch Error: " + err.message);
            }

            return checkPromise.then(function (diagnosticMsg) {
              const fullMsg = `Failed to load transitive import: "${url}" (fetching: "${resolvedUrl}").\n` + diagnosticMsg;
              if (menu && menu.append_message_toLastBulletPoint) {
                menu.append_message_toLastBulletPoint("failed", { tone: "error" });
              }
              throw new Error(fullMsg);
            });
          })
      );
    }
    
    return Promise.all(promises).then(() => doc);
  }

  return fetchAndMerge(mainDoc).then(finalDoc => {
    const serializer = new XMLSerializer();
    const mergedXml = serializer.serializeToString(finalDoc);
    return rootParserFn(mergedXml);
  });
}
