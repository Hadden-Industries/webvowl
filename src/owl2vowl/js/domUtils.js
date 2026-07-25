import { NAMESPACES } from "./constants.js";

/**
 * Extracts an attribute robustly across multiple RDF formats and prefixes.
 * @param {Element} el
 * @param {string} name
 * @param {string} [ns]
 * @returns {string|null}
 */
export function getAttr(el, name, ns) {
  if (ns) {
    const val = el.getAttributeNS(ns, name);
    if (val !== null && val !== "") {return val;}
  }
  const val = el.getAttribute(name) || el.getAttribute("rdf:" + name) || el.getAttribute("owl:" + name);
  if (val !== null && val !== "") {return val;}
  
  // Fallback: check all attributes for local name match
  if (el.attributes) {
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      if (attr.localName === name) {
        return attr.value;
      }
    }
  }
  return null;
}

/**
 * Safely matches subject identifier references.
 * @param {Element} el
 * @returns {string|null}
 */
export function getAbout(el) {
  const about = getAttr(el, "about", NAMESPACES.RDF);
  if (about !== null && about !== "") {return about;}
  const id = getAttr(el, "ID", NAMESPACES.RDF);
  if (id !== null && id !== "") {
    return id.startsWith("#") ? id : "#" + id;
  }
  return null;
}

/**
 * Extracts immediate child elements by localName in an efficient O(d) linear search,
 * avoiding slow deep recursive DOM scans.
 * @param {Node} parent
 * @param {string} localName
 * @returns {Element[]}
 */
export function findImmediateChildren(parent, localName) {
  const matched = [];
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1 && child.localName === localName) {
      matched.push(child);
    }
  }
  return matched;
}

/**
 * Fast XML tree-traversal matching specific localName tokens recursively.
 * @param {Node} parent
 * @param {string} localName
 * @returns {Element[]}
 */
export function getElementsByLocalName(parent, localName) {
  const matched = [];
  function traverse(node) {
    if (node.nodeType === 1 || node.nodeType === 9) {
      if (node.nodeType === 1 && node.localName === localName) {
        matched.push(node);
      }
      for (let child = node.firstChild; child; child = child.nextSibling) {
        traverse(child);
      }
    }
  }
  traverse(parent);
  return matched;
}
