import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceX,
  forceY,
  forceCollide,
} from "d3";
import { openOwl } from "../packages/vowl/src/owl/index.js";
import {
  inspectModel,
  captureModel,
  encode,
  decode,
  compatibleArtifactProfile,
} from "../packages/vowl/src/index.js";
import { createCanonicalVowlScene } from "../src/app/js/controller/canonicalVowlScene.js";

// Explicit operator tool; never downloads imports or changes historical examples.
const [manifestPath, outputDirectory] = process.argv.slice(2);
if (!manifestPath || !outputDirectory || process.argv.length !== 4) {
  throw new Error(
    "Usage: node util/regenerateCanonicalExamples.mjs <pinned-closure-report.json> <new-output-directory>",
  );
}
const { manifest } = JSON.parse(await readFile(manifestPath, "utf8"));
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const examples = [
  ["foaf", "foaf.rdf"],
  ["goodrelations", "goodrelations.owl"],
  ["muto", "muto.rdf"],
  ["ontovibe", "BenchmarkOntology.ttl"],
  ["personasonto", "personasonto.owl"],
  ["sioc", "sioc.rdf"],
];

async function verified(entry) {
  if (!entry || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new Error("A source has no pinned SHA-256.");
  }
  const bytes = await readFile(entry.localPath);
  if (sha(bytes) !== entry.sha256) {
    throw new Error(`Source hash mismatch: ${entry.name}`);
  }
  return new Uint8Array(bytes);
}

function freshScene(inspection) {
  const nodes = inspection.occurrences
    .filter(({ kind }) =>
      ["class-node", "datatype-node", "label"].includes(kind),
    )
    .map(({ id, kind }) => ({ id, kind }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const labels = new Map(
    inspection.occurrences
      .filter(({ kind }) => kind === "label")
      .map((node) => [node.edge, node.id]),
  );
  const links = [];
  for (const occurrence of inspection.occurrences) {
    const ends = occurrence.ends ?? [occurrence.from, occurrence.to];
    const label = labels.get(occurrence.id);
    if (label) {
      for (const end of ends) {
        if (byId.has(end)) {
          links.push({ source: label, target: end });
        }
      }
    } else if (ends.length === 2 && ends.every((id) => byId.has(id))) {
      links.push({ source: ends[0], target: ends[1] });
    }
  }
  // d3's default seeded random source makes this finite, fresh layout repeatable.
  const simulation = forceSimulation(nodes)
    .stop()
    .force(
      "link",
      forceLink(links)
        .id(({ id }) => id)
        .distance(130),
    )
    .force("charge", forceManyBody().strength(-350))
    .force("x", forceX(0).strength(0.015))
    .force("y", forceY(0).strength(0.015))
    .force(
      "collision",
      forceCollide(({ kind }) => (kind === "label" ? 35 : 60)),
    );
  simulation.tick(400);
  const suppliedPositions = new Map(
    nodes.map(({ id, x, y }) => [
      id,
      { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 },
    ]),
  );
  const scene = createCanonicalVowlScene(inspection.occurrences, {
    loadGeneration: 1,
    suppliedPositions,
  }).snapshot();
  const xs = nodes.map(({ x }) => x),
    ys = nodes.map(({ y }) => y);
  const minX = Math.min(0, ...xs) - 70,
    maxX = Math.max(0, ...xs) + 70;
  const minY = Math.min(0, ...ys) - 70,
    maxY = Math.max(0, ...ys) + 70;
  scene.camera = {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    zoom: Math.min(1, 900 / (maxX - minX), 700 / (maxY - minY)),
  };
  scene.labelSelection = { mode: "language", range: "en" };
  return scene;
}

const report = {
  scope:
    "Candidate compatible artifacts from pinned complete closures; historical files unchanged. Rights/provenance qualification is separate from this technical report.",
  layout:
    "Fresh deterministic d3-force placement, 400 ticks, 900 by 700 framing; historical placements are not reused.",
  sourceManifestSha256: sha(await readFile(manifestPath)),
  generatorSha256: sha(await readFile(new URL(import.meta.url))),
  examples: [],
};
for (const [name, sourceName] of examples) {
  const root = manifest.documents.find(({ name }) => name === sourceName);
  const acquiredImports = [];
  const resolveImport = async (importIri) => {
    const entry = manifest.imports.find(
      (candidate) => candidate.importIri === importIri,
    );
    if (!entry) {
      throw new Error(`Unpinned import: ${importIri}`);
    }
    acquiredImports.push({
      importIri,
      documentIri: entry.documentIri,
      sha256: entry.sha256,
    });
    return {
      bytes: await verified(entry),
      documentIri: entry.documentIri,
      mediaType: entry.mediaType,
    };
  };
  const { model } = await openOwl(await verified(root), {
    documentIri: root.documentIri,
    mediaType: root.mediaType,
    resolveImport,
  });
  const inspection = inspectModel(model);
  const captured = await captureModel(model, {
    profile: compatibleArtifactProfile,
    visualization: freshScene(inspection),
  });
  const bytes = encode(captured.document);
  const readmitted = await decode(bytes);
  if (sha(encode(readmitted)) !== sha(bytes)) {
    throw new Error(`Readmission differs: ${name}`);
  }
  const historicalBytes = await readFile(
    new URL(`../src/app/data/${name}.json`, import.meta.url),
  );
  const historical = JSON.parse(historicalBytes);
  const oldIris = new Set(
    [
      ...(historical.classAttribute ?? []),
      ...(historical.propertyAttribute ?? []),
    ]
      .map(({ iri }) => iri)
      .filter(Boolean),
  );
  const currentIris = new Set(
    inspection.records.subjects.map(({ iri }) => iri).filter(Boolean),
  );
  const record = {
    name,
    sourceName,
    documentIri: root.documentIri,
    mediaType: root.mediaType,
    sourceSha256: root.sha256,
    imports: acquiredImports,
    historicalSha256: sha(historicalBytes),
    artifactSha256: sha(bytes),
    artifactBytes: bytes.length,
    historical: {
      classes: historical.class?.length ?? 0,
      properties: historical.property?.length ?? 0,
      namedIris: oldIris.size,
    },
    current: {
      ...Object.fromEntries(
        ["subjects", "roles", "expressions", "constructs"].map((key) => [
          key,
          inspection.records[key].length,
        ]),
      ),
      occurrences: inspection.occurrences.length,
      qualifications: inspection.qualifications.length,
      namedIris: currentIris.size,
    },
    historicalIrisAbsentFromCurrent: [...oldIris]
      .filter((iri) => !currentIris.has(iri))
      .sort(),
    currentIrisAbsentFromHistorical: [...currentIris]
      .filter((iri) => !oldIris.has(iri))
      .sort(),
    qualificationCodes: [
      ...new Set(inspection.qualifications.map(({ code }) => code)),
    ].sort(),
  };
  await writeFile(join(output, `${name}.json`), bytes, { flag: "wx" });
  report.examples.push(record);
  console.log(`${name}: ${bytes.length} bytes, readmission passed`);
}
await writeFile(
  join(output, "regeneration-report.json"),
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" },
);
