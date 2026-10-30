import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, parseArgs } from "node:util";
import { createServer } from "vite";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const packageFile = new URL("../package.json", import.meta.url);
const legacySha256 =
  "c8e0f44e0f11da290c075fc90057ff2c1f92612f65b5662e1d198aa170d84fc5";
export const rootIri =
  "https://haddenindustries.com/ontology/universal/extended/latest";
const fixture = [
  [
    rootIri,
    "universal/extended/latest",
    "text/turtle",
    "92ad97ccb1acf4f2413dc3f1100433adbaa965ce98821f863de9df22eced7f24",
  ],
  [
    "https://haddenindustries.com/ontology/universal/core/20260912",
    "universal/core/20260912",
    "text/turtle",
    "214f21e9116c0515bd52e5e8e893c83fcf93eb4ce586a49dbd8afc8a05e2c190",
  ],
  [
    "https://haddenindustries.com/ontology/universal/reference-data/20260912",
    "universal/reference-data/20260912",
    "text/turtle",
    "1354d260a8bf33d0e67b6145b45438be719203f71e0280d61fc498b697860260",
  ],
  [
    "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/20260912",
    "iso-iec/11179/-3/ed-4/20260912",
    "text/turtle",
    "b621c3d545343cbfab9e8c41cf296046df32722204b8ff76251b7b5a6f3a2e74",
  ],
  [
    "http://www.w3.org/ns/time/gregorian",
    "external/time-gregorian.ttl",
    "text/turtle",
    "e7a5e5f6ba555bf2086169ed05bdde9901f146ffc25f3d0aa62798170b2b5880",
  ],
  [
    "http://www.w3.org/2006/time",
    "external/time.rdf",
    "application/rdf+xml",
    "8ce934e406401e0e6cb9b6d4407bb69103d62c94107e2a1a30b4a31cc2772e58",
  ],
  [
    "http://www.w3.org/2004/02/skos/core",
    "external/skos.rdf",
    "application/rdf+xml",
    "378fe72e82a529a3338e00c1fb157112d9941c94ac5c8bc7e88a8463ea879e96",
  ],
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function legacyNamedEntities(document) {
  return Object.fromEntries(
    ["class", "property"].map((kind) => {
      assert(
        Array.isArray(document[`${kind}Attribute`]),
        "Missing original converter output",
      );
      return [
        kind,
        [
          ...new Set(
            document[`${kind}Attribute`]
              .map(({ iri }) => iri)
              .filter((iri) => typeof iri === "string"),
          ),
        ].sort(),
      ];
    }),
  );
}

/** Named-role coverage is an independent sink, not a complete semantic equivalence claim. */
export function assertLegacyCoverage(expected, current) {
  assert.equal(
    current.documents,
    fixture.length,
    "Incomplete current import closure",
  );
  assert.equal(
    current.unresolved,
    0,
    "Unresolved current imports cannot qualify timing",
  );
  for (const kind of ["class", "property"]) {
    const actual = new Set(current.entities[kind]);
    const missing = expected[kind].filter((iri) => !actual.has(iri));
    assert.equal(
      missing.length,
      0,
      `Missing ${kind} IRIs: ${missing.slice(0, 5).join(", ")}`,
    );
  }
}

/** Freeze the verified browser bytes for Java; never reread a mutable dist path. */
export async function writeLegacySources(inputs, scratch) {
  const sources = await Promise.all(
    inputs.map(async ({ documentIri, mediaType, base64 }, index) => {
      const file = join(scratch, `source-${index}`);
      await writeFile(file, Buffer.from(base64, "base64"));
      return { documentIri, mediaType, file };
    }),
  );
  assert(sources.every(({ file }) => !/[\r\n\t]/u.test(file)));
  const manifest = join(scratch, "sources.tsv");
  await writeFile(
    manifest,
    sources
      .map(
        ({ documentIri, file, mediaType }) =>
          `${documentIri}\t${mediaType}\t${file}\n`,
      )
      .join(""),
  );
  return manifest;
}

export async function readComparisonInputs(ontologies) {
  return Promise.all(
    fixture.map(async ([documentIri, path, mediaType, digest]) => {
      const bytes = await readFile(resolve(ontologies, path));
      assert.equal(
        sha256(bytes),
        digest,
        `Frozen ontology input changed: ${path}`,
      );
      return { documentIri, mediaType, base64: bytes.toString("base64") };
    }),
  );
}

async function compare(options) {
  const iterations = Number(options.iterations ?? 3);
  assert(
    Number.isSafeInteger(iterations) && iterations >= 2 && iterations <= 10,
  );
  const engine = options.engine ?? "chromium";
  assert(["chromium", "firefox", "webkit"].includes(engine));
  const jar = resolve(options.jar);
  assert.equal(
    sha256(await readFile(jar)),
    legacySha256,
    "The original baseline JAR changed",
  );
  const inputs = await readComparisonInputs(options.ontologies);
  const scratch = await mkdtemp(join(tmpdir(), "owl2vowl-comparison-"));
  let vite, browser;
  try {
    const manifest = await writeLegacySources(inputs, scratch);
    const output = join(scratch, "legacy.json");
    const javaExecutable = (name) =>
      join(
        options["java-home"],
        "bin",
        process.platform === "win32" ? `${name}.exe` : name,
      );
    await exec(
      javaExecutable("javac"),
      [
        "--release",
        "8",
        "-Xlint:all,-options",
        "-cp",
        jar,
        "-d",
        scratch,
        join(root, "util/fixtures/LegacyOwl2VowlBenchmark.java"),
      ],
      { windowsHide: true, timeout: 30000 },
    );
    const legacy = await exec(
      javaExecutable("java"),
      [
        "--add-opens=java.base/java.lang=ALL-UNNAMED",
        "-Xmx1536m",
        "-XX:ActiveProcessorCount=2",
        "-cp",
        `${scratch}${process.platform === "win32" ? ";" : ":"}${jar}`,
        "LegacyOwl2VowlBenchmark",
        manifest,
        rootIri,
        String(iterations),
        output,
      ],
      { maxBuffer: 1048576, windowsHide: true, timeout: 120000 },
    );
    const samples = legacy.stdout
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('{"kind":"owl2vowl-legacy-benchmark"'))
      .map(JSON.parse);
    assert.equal(samples.length, iterations);
    for (const sample of samples) {
      assert.equal(sample.documents, fixture.length);
      assert.equal(sample.closure, fixture.length);
      assert.equal(sample.missingImports, false);
      console.log(JSON.stringify(sample));
    }
    const expected = legacyNamedEntities(
      JSON.parse(await readFile(output, "utf8")),
    );
    const playwright = await import(
      pathToFileURL(resolve(options.playwright)).href
    );
    vite = await createServer({
      root: join(root, "src"),
      configFile: join(root, "vite.config.mjs"),
      cacheDir: join(scratch, "vite"),
      optimizeDeps: { force: true },
      logLevel: "error",
      server: {
        host: "127.0.0.1",
        port: 0,
        open: false,
        watch: null,
        hmr: false,
      },
    });
    await vite.listen();
    browser = await playwright[engine].launch({
      headless: true,
      ...(options.executable
        ? { executablePath: resolve(options.executable) }
        : {}),
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      globalThis.benchmarkMain = [...globalThis.document.scripts].find(
        ({ src }) => src.includes("/main.js"),
      ).src;
    });
    await page.waitForFunction(
      async () =>
        (await import(globalThis.benchmarkMain)).application
          .getWebVowlController()
          .getState().status === "ready",
    );
    await page.evaluate(async () =>
      (await import(globalThis.benchmarkMain)).application.dispose(),
    );
    const current = [];
    for (let iteration = 0; iteration < iterations; iteration++) {
      const sample = await page.evaluate(
        async ({ inputs, rootIri }) => {
          const sources = new Map(
            inputs.map(({ documentIri, base64 }) => [
              documentIri,
              Uint8Array.from(atob(base64), (character) =>
                character.charCodeAt(0),
              ),
            ]),
          );
          const { createCanonicalVowlWorkerClient } =
            await import("/app/js/controller/canonicalVowlWorkerClient.js");
          const measures = [];
          const moduleUrl = new URL(
            "/app/js/controller/canonicalVowlWorker.js",
            globalThis.location.href,
          ).href;
          const wrapper = `const send=self.postMessage.bind(self),queued=[];self.onmessage=e=>queued.push(e);self.postMessage=(message,...rest)=>{if(message.type==="result")send({type:"benchmark-measures",measures:performance.getEntriesByType("measure").map(e=>({name:e.name,duration:e.duration}))});send(message,...rest)};await import(${JSON.stringify(moduleUrl)});for(const event of queued)self.onmessage(event);`;
          const blob = URL.createObjectURL(
            new Blob([wrapper], { type: "text/javascript" }),
          );
          const client = createCanonicalVowlWorkerClient({
            createWorker() {
              const worker = new globalThis.Worker(blob, { type: "module" });
              worker.addEventListener("message", (event) => {
                if (event.data.type === "benchmark-measures") {
                  measures.push(...event.data.measures);
                  event.stopImmediatePropagation();
                }
              });
              return worker;
            },
          });
          const start = performance.now();
          try {
            const result = await client.run(
              {
                operation: "open-owl-model",
                bytes: sources.get(rootIri),
                documentIri: rootIri,
                owlMappingStrategy: "heuristic",
              },
              {
                loadGeneration: 1,
                baseRevision: 0,
                resolveImport: async (documentIri) => {
                  if (!sources.has(documentIri))
                    throw new Error("Unknown frozen source");
                  return {
                    bytes: sources.get(documentIri).slice(),
                    documentIri,
                  };
                },
              },
            );
            const milliseconds = performance.now() - start;
            const { records } = result.inspection;
            const subjects = new Map(
              records.subjects.map(({ id, iri }) => [id, iri]),
            );
            const entities = Object.fromEntries(
              [
                ["class", ["class", "rdf-class", "datatype"]],
                ["property", ["object-property", "data-property"]],
              ].map(([kind, roles]) => [
                kind,
                [
                  ...new Set(
                    records.roles
                      .filter((record) => roles.includes(record.kind))
                      .map(({ subject }) => subjects.get(subject))
                      .filter(Boolean),
                  ),
                ].sort(),
              ]),
            );
            return {
              milliseconds,
              documents: result.inspection.documents.length,
              unresolved: result.inspection.imports.filter(
                ({ targetDocument }) => targetDocument === null,
              ).length,
              entities,
              measures,
              assessment: result.checkpoint.source.evidence.assessment,
              profileViolations:
                result.checkpoint.source.evidence.profileViolations,
            };
          } finally {
            client.dispose();
            URL.revokeObjectURL(blob);
          }
        },
        { inputs, rootIri },
      );
      assertLegacyCoverage(expected, sample);
      current.push(sample);
      console.log(
        JSON.stringify({
          kind: "owl2vowl-current-benchmark",
          engine,
          browserVersion: browser.version(),
          iteration,
          milliseconds: sample.milliseconds,
          documents: sample.documents,
          unresolved: sample.unresolved,
          namedClasses: sample.entities.class.length,
          namedProperties: sample.entities.property.length,
          assessmentStatus: sample.assessment.status,
          assessmentSha256: sha256(
            JSON.stringify({
              assessment: sample.assessment,
              profileViolations: sample.profileViolations,
            }),
          ),
          measures: sample.measures,
        }),
      );
    }
    const median = (values) => {
      const sorted = values.toSorted((a, b) => a - b),
        middle = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
    };
    const ratios = {
      firstUse: current[0].milliseconds / samples[0].totalMs,
      subsequentJobs:
        median(current.slice(1).map(({ milliseconds }) => milliseconds)) /
        median(samples.slice(1).map(({ totalMs }) => totalMs)),
    };
    console.log(
      JSON.stringify({
        kind: "owl2vowl-performance-comparison",
        engine,
        legacySha256,
        owlapi: JSON.parse(await readFile(packageFile, "utf8")).dependencies
          .owlapi,
        ratios,
        scope:
          "Same seven fixed documents; actual Java conversion/export versus fresh browser-worker parse, assessment, model admission, checkpoint and ordering. No source HTTP, AWS, rendering or activation. Named-role coverage is not axiom or JSON equality. Java runs reuse one JVM; application jobs create fresh workers.",
      }),
    );
    if (options["assert-parity"])
      assert(
        Object.values(ratios).every((ratio) => ratio <= 1.1),
        "Original OWL2VOWL performance parity remains unqualified",
      );
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        await vite?.close();
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { values } = parseArgs({
    options: {
      jar: { type: "string" },
      ontologies: { type: "string" },
      playwright: { type: "string" },
      "java-home": { type: "string" },
      engine: { type: "string" },
      executable: { type: "string" },
      iterations: { type: "string" },
      "assert-parity": { type: "boolean" },
    },
  });
  for (const name of ["jar", "ontologies", "playwright", "java-home"])
    assert(values[name], `Missing --${name}`);
  await compare(values);
}
