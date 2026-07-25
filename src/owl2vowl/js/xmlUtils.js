/**
 * Resolves inline DTD entities inside XML string content.
 * Matches `<!ENTITY name "value">` syntax and expands `&name;` references.
 * Safe against XXE because it only resolves internal string expansions.
 * @param {string} xmlString
 * @returns {string}
 */
export function resolveXmlEntities(xmlString) {
  if (!xmlString) {return xmlString;}

  // Regex to match internal entity declarations
  const entityRegex = /<!ENTITY\s+([a-zA-Z0-9_-]+)\s+["']([^"']*)["']\s*>/g;
  const entities = {};
  let match;

  while ((match = entityRegex.exec(xmlString)) !== null) {
    entities[match[1]] = match[2];
  }

  // Resolve nested references inside entity declarations (e.g. ENTITY values referring to other ENTITYs)
  for (const [name, val] of Object.entries(entities)) {
    let resolvedVal = val;
    for (const [otherName, otherVal] of Object.entries(entities)) {
      if (name !== otherName) {
        resolvedVal = resolvedVal.split(`&${otherName};`).join(otherVal);
      }
    }
    entities[name] = resolvedVal;
  }

  // Replace &name; occurrences globally
  let resolvedXml = xmlString;
  for (const [name, val] of Object.entries(entities)) {
    resolvedXml = resolvedXml.split(`&${name};`).join(val);
  }

  return resolvedXml;
}
