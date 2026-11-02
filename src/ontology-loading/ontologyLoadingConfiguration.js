/** Activation is an operator composition decision, independent of endpoint discovery. */
const serviceOrigin = "https://haddenindustries.com";
export const ONTOLOGY_CACHE_CONFIGURATION = Object.freeze({
  enabled: true,
  serviceOrigin,
  catalogIri: `${serviceOrigin}/ontology/catalog-v001.xml`,
  approvedPolicyFingerprints: Object.freeze([
    "a39d32c115fb96fab262369d1d40db97272d97be746cd567c8244f1d6f283acc",
    "1ba66d1a684d0097ad312d4ba2a51a89cdc22d306d129880b896e76fcece6107",
  ]),
});
