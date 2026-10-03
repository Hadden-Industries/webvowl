import {
  positives,
  readJson,
  readPinned as readCore,
} from "../test/independentCorpus.js";
import { loadCorpus as loadOwl } from "../conformance/supplemental/owl-mapping/source-v2/catalog-portable.mjs";
import { readPinned as readOwl } from "../conformance/supplemental/owl-mapping/support.mjs";
import { loadCorpus as loadMigration } from "../conformance/supplemental/migration/review-cases.mjs";

/** Package actual pinned inputs for a browser worker; never generate expected bytes. */
export async function browserVectors() {
  const core = positives.map((vector) => ({
    name: vector.id,
    profile: vector.profile,
    source: readJson(vector.files["source.json"]),
    expected: readCore(vector.files["canonical.json"]).toString("utf8"),
  }));
  const owl = [];
  for (const { vector, run } of (await loadOwl()).runs) {
    const imports = [];
    for (const entry of vector.imports ?? [])
      imports.push({
        ...entry,
        text: (await readOwl(entry.bytes)).toString("utf8"),
      });
    owl.push({
      name: `${vector.id}/${run.id}`,
      text: (await readOwl(vector.root.bytes)).toString("utf8"),
      options: {
        documentIri: vector.root.documentIri,
        mediaType: vector.root.mediaType,
        ...run.options,
      },
      imports,
      resolverContexts: vector.resolverContexts ?? [],
      outcome: run.outcome,
      errorCode: run.errorCode,
      expected:
        run.outcome === "success"
          ? (await readOwl(vector.expected["canonical.json"])).toString("utf8")
          : undefined,
    });
  }
  const migration = (await loadMigration()).runs.map((run) => ({
    name: run.id,
    text: new TextDecoder().decode(run.bytes),
    options: {
      dialect: run.dialect,
      profile: run.profile,
      resolutions: run.resolutions,
    },
    outcome: run.outcome,
    errorCode: run.errorCode,
    expected: run.expected?.canonicalBytes.text,
  }));
  return { core, owl, migration };
}
