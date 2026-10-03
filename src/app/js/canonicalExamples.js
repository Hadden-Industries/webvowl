// Only the candidate entry imports these assets. Historical production presets
// remain in app/data until the separately governed cutover and retirement.
const examples = new Map([
  ["foaf", new URL("../../canonical-examples/foaf.json", import.meta.url).href],
  [
    "goodrelations",
    new URL("../../canonical-examples/goodrelations.json", import.meta.url)
      .href,
  ],
  ["muto", new URL("../../canonical-examples/muto.json", import.meta.url).href],
  [
    "ontovibe",
    new URL("../../canonical-examples/ontovibe.json", import.meta.url).href,
  ],
  [
    "personasonto",
    new URL("../../canonical-examples/personasonto.json", import.meta.url).href,
  ],
  ["sioc", new URL("../../canonical-examples/sioc.json", import.meta.url).href],
]);

export function canonicalExampleSource(name) {
  const url = examples.get(name);
  return url === undefined ? undefined : { kind: "vowl-json-url", url };
}
