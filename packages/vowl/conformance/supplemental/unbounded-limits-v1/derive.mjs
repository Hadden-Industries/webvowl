// SPDX-License-Identifier: AGPL-3.0-only
// Unbounded-limits overlay, version 1.
//
// The owner-approved unbounded-limits amendment removes the finite upper
// override bounds of A8 in the core contract, so the values of the nine
// option-<limit>-above-ceiling records of the frozen negative/boundary
// manifest are now valid overrides. This script derives the current
// expectations of those records, and of new vectors for further override
// values that the amendment decides, from the pinned authorities and frozen
// corpus files alone. No module of the vowl package is read, imported or
// executed, and no runtime output is used: the script needs only Node.js
// built-ins and the corpus storage reader, which returns corpus member bytes.
//
//   node derive.mjs              derive and verify every file; writes nothing
//   node derive.mjs --write-new  create missing derived files only, then verify
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readCorpusArtifact } from "../../storage.mjs";

class DerivationFailure extends Error {}
function fail(message) {
  throw new DerivationFailure(message);
}
function check(condition, message) {
  if (!condition) fail(message);
}

const supplementDirectory = dirname(fileURLToPath(import.meta.url));
const corpusDirectory = resolve(supplementDirectory, "../..");
const repositoryDirectory = resolve(corpusDirectory, "../../..");
const supplementMember = "supplemental/unbounded-limits-v1";
const supplementFiles = [
  "README.md",
  "derive.mjs",
  "manifest.json",
  "provenance.json",
];
const vectorStatus =
  "independently-derived-pending-review-and-production-execution";
const structuralContentProfile =
  "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1";
const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonDocument = (value) => JSON.stringify(value, null, 2) + "\n";
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// The record-hash convention of the accepted-protocol overlays, which compute
// hash(json(record)) with supplemental/field-contract/support.mjs.
const recordHashConvention =
  "SHA-256 of the UTF-8 bytes of JSON.stringify(record, null, 2) followed by one line feed, where record is the predecessor record as JSON.parse returns it from the predecessor manifest. This is hash(json(record)) of supplemental/field-contract/support.mjs, as accepted-protocol-v1 and accepted-protocol-v2 compute it.";
const recordSha256 = (record) =>
  sha256Hex(Buffer.from(jsonDocument(record), "utf8"));

// ---------------------------------------------------------------------------
// Pins. Authority paths are relative to the repository root and corpus paths
// to packages/vowl/conformance. A changed or missing pinned file stops the
// script: review every expectation that depends on it before re-pinning.
const amendment = {
  path: "docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md",
  sha256: "8f5b7dd02ebeefd0f3deced6fe7096b194120090611c58f505123c0c843bc9cc",
  byteLength: 8819,
};
// The amendment as first approved, which the first derivation of this overlay
// read. The owner corrected it the same day. Reversing the three edits below
// must give exactly these bytes, so every other sentence is unchanged.
const firstReadAmendment = {
  sha256: "eeddcb4121c6b4b00e0eda990eb9b06c5bdabd0001e52ca28940912a9b7c3e45",
  byteLength: 8518,
  edits: [
    {
      corrected:
        "Status: owner approved on 27 October 2026.\nCorrected the same day at the owner's request: each bound the OWL adapter derives from a limit fails with that limit's code, and operations that read no XML still validate `expandedXmlBytes`.\n",
      firstRead: "Status: owner approved on 27 October 2026.\n",
    },
    {
      corrected:
        "Operations that read no XML validate the limit like any other and otherwise ignore it.\n",
      firstRead: "Operations that read no XML accept the limit and ignore it.\n",
    },
    {
      corrected:
        "Crossing it fails with `MODEL_RESOURCE_LIMIT`, the code of `expandedXmlBytes`; each other bound that the adapter derives from a limit fails with the code of that limit.\n",
      firstRead:
        "Crossing it fails with `MODEL_RESOURCE_LIMIT`, like the adapter's other parser limits.\n",
    },
  ],
};
const coreContract = {
  path: "docs/specs/2026-09-24-canonical-vowl-core-contract.md",
  sha256: "711ba30c291cfb0960334328203188600f60a331996e83379267a4a77b87988d",
  byteLength: 53207,
};
const predecessorManifest = {
  path: "supplemental/negative/manifest.json",
  sha256: "b7f6d60f8ba05c2c4a9e3fe6f2fe97f73b5c89a1ad656bf1ed8b06f49e4893a3",
  byteLength: 45264,
};
// The current positive baseline: it records the fixture's success with
// default options, and pins the fixture files by hash and length.
const positiveBaseline = {
  path: "supplemental/amended-policy/manifest.json",
  sha256: "90f3754316f683a76ad9eecb8341d29a738b3f77b61c13362034de07cee92156",
  byteLength: 200161,
};

async function readRepositoryFile(path) {
  try {
    return await readFile(resolve(repositoryDirectory, path));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function readCorpusMember(path) {
  try {
    return readCorpusArtifact(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function pinProblem(pin, bytes) {
  if (bytes === null) return `${pin.path} is missing`;
  const digest = sha256Hex(bytes);
  if (digest === pin.sha256 && bytes.length === pin.byteLength) return null;
  return `${pin.path} changed: it now has ${bytes.length} bytes with SHA-256 ${digest}, but the pin is ${pin.byteLength} bytes with SHA-256 ${pin.sha256}`;
}
function requirePinned(pin, bytes) {
  const problem = pinProblem(pin, bytes);
  check(problem === null, problem);
  return bytes;
}

// ---------------------------------------------------------------------------
// Markdown reading. A section is its heading line through to the line before
// the next heading of the same or a higher level; a line inside a fenced code
// block is not a heading. The pinned bytes make every parse deterministic.
function section(text, heading, documentPath) {
  const lines = text.split("\n");
  const headings = [];
  let fence = null;
  lines.forEach((line, index) => {
    if (fence !== null) {
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (
        closing !== null &&
        closing[1][0] === fence[0] &&
        closing[1].length >= fence.length
      )
        fence = null;
      return;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opening !== null) {
      fence = opening[1];
      return;
    }
    const marker = /^(#{1,6})[ \t]/.exec(line);
    if (marker !== null)
      headings.push({ index, level: marker[1].length, line });
  });
  const matches = headings.filter((entry) => entry.line === heading);
  check(
    matches.length === 1,
    `${documentPath}: expected one heading line "${heading}", found ${matches.length}`,
  );
  const [start] = matches;
  const next = headings.find(
    (entry) => entry.index > start.index && entry.level <= start.level,
  );
  return {
    documentPath,
    heading,
    title: heading.replace(/^#+[ \t]+/, ""),
    text: lines
      .slice(start.index, next === undefined ? lines.length : next.index)
      .join("\n"),
  };
}
const reliedText = [];
function quote(part, sentence) {
  check(
    part.text.includes(sentence),
    `${part.documentPath}, section "${part.title}": a sentence that the expectations rely on is no longer present: ${sentence}`,
  );
  reliedText.push({
    document: part.documentPath,
    section: part.title,
    sentence,
  });
  return sentence;
}
function tableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}
function tableRows(part, header) {
  const lines = part.text.split("\n");
  const start = lines.findIndex((line) => sameJson(tableCells(line), header));
  const where = `${part.documentPath}, section "${part.title}"`;
  check(start !== -1, `${where}: no table with the columns ${header.join(", ")}`);
  const separator = tableCells(lines[start + 1] ?? "");
  check(
    separator !== null &&
      separator.length === header.length &&
      separator.every((cell) => /^:?-+:?$/.test(cell)),
    `${where}: the table ${header.join(", ")} has no separator row`,
  );
  const rows = [];
  for (let index = start + 2; index < lines.length; index += 1) {
    const row = tableCells(lines[index]);
    if (row === null) break;
    check(
      row.length === header.length,
      `${where}: a row of the table ${header.join(", ")} has ${row.length} cells`,
    );
    rows.push(row);
  }
  check(rows.length > 0, `${where}: the table ${header.join(", ")} is empty`);
  return rows;
}
function limitName(cell, where) {
  const match = /^`([A-Za-z]+)`$/.exec(cell);
  check(match !== null, `${where}: ${cell} is not a limit name`);
  return match[1];
}
function integerCell(cell, where) {
  check(/^(0|[1-9][0-9]*)$/.test(cell), `${where}: ${cell} is not an integer`);
  const value = Number(cell);
  check(Number.isSafeInteger(value), `${where}: ${cell} is not a safe integer`);
  return value;
}
const ruleLabel = (part) =>
  "unbounded-limits#" +
  part.title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

// ---------------------------------------------------------------------------
async function main() {
  const commandArguments = process.argv.slice(2);
  for (const argument of commandArguments)
    check(
      argument === "--write-new",
      `unknown argument ${argument}; the only option is --write-new`,
    );
  const writeMissingFiles = commandArguments.includes("--write-new");

  const producerBytes = await readFile(fileURLToPath(import.meta.url));
  check(
    /^[\x00-\x7f]*$/.test(producerBytes.toString("latin1")),
    "derive.mjs must stay ASCII, so that no editor or transport changes the text that it quotes",
  );
  check(
    !producerBytes.includes(0x0d),
    "derive.mjs must use LF line endings, as the repository stores text",
  );

  const amendmentBytes = await readRepositoryFile(amendment.path);
  const coreContractBytes = await readRepositoryFile(coreContract.path);
  const predecessorBytes = readCorpusMember(predecessorManifest.path);
  const baselineBytes = readCorpusMember(positiveBaseline.path);
  const pinProblems = [
    pinProblem(amendment, amendmentBytes),
    pinProblem(coreContract, coreContractBytes),
    pinProblem(predecessorManifest, predecessorBytes),
    pinProblem(positiveBaseline, baselineBytes),
  ].filter((problem) => problem !== null);
  check(
    pinProblems.length === 0,
    `refusing to run: ${pinProblems.join("; ")}. Review every expectation that depends on a changed file against its new bytes before re-pinning.`,
  );

  // -------------------------------------------------------------------------
  // The amendment: its sections, the sentences relied on and its two tables.
  const amendmentText = amendmentBytes.toString("utf8");
  let firstReadText = amendmentText;
  for (const { corrected, firstRead } of firstReadAmendment.edits) {
    check(
      amendmentText.split(corrected).length === 2,
      `${amendment.path}: the corrected text is expected exactly once: ${corrected.trim()}`,
    );
    firstReadText = firstReadText.replace(corrected, firstRead);
  }
  const firstReadBytes = Buffer.from(firstReadText, "utf8");
  check(
    sha256Hex(firstReadBytes) === firstReadAmendment.sha256 &&
      firstReadBytes.length === firstReadAmendment.byteLength,
    `${amendment.path}: reversing the correction's three edits no longer gives the first-read bytes`,
  );
  const amendmentPart = (heading) =>
    section(amendmentText, heading, amendment.path);
  const defaultsPart = amendmentPart("## Defaults");
  const overridesPart = amendmentPart("## Overrides");
  const owlAdapterPart = amendmentPart("## OWL adapter");
  const formerValuesPart = amendmentPart("## Former values");
  const evidencePart = amendmentPart("## Evidence and qualification");
  const rules = {
    defaults: ruleLabel(defaultsPart),
    overrides: ruleLabel(overridesPart),
    owlAdapter: ruleLabel(owlAdapterPart),
    formerValues: ruleLabel(formerValuesPart),
    evidence: ruleLabel(evidencePart),
    validation: "A7",
  };

  quote(
    overridesPart,
    "Each limit accepts a positive safe integer or `Infinity`, and `rdfDeepIterations` also accepts zero.",
  );
  quote(overridesPart, "There is no upper override bound.");
  quote(
    overridesPart,
    "Any other value, including `null`, a fraction, a negative number, `NaN` and an integer above `Number.MAX_SAFE_INTEGER`, fails with `OPTION_INVALID` at `/limits/<name>`, and an unknown limit name still fails.",
  );
  quote(
    overridesPart,
    "`Infinity` removes the package's bound for that limit only; it does not lift another limit.",
  );
  quote(
    overridesPart,
    "A finite `rdfDeepIterations` keeps the resource-policy amendment's allowance, `min(B * B, rdfDeepIterations)`.",
  );
  quote(
    overridesPart,
    "A finite deadline longer than the host's largest timer delay expires at its actual time, never earlier.",
  );
  const noDefaultSentence = quote(
    defaultsPart,
    "`inputBytes`, `primaryRecords`, `embeddedValues`, `stringBytes`, `totalStringBytes` and `rdfQuads` have no default: without a caller limit, the package imposes none.",
  );
  quote(
    owlAdapterPart,
    "Operations that read no XML validate the limit like any other and otherwise ignore it.",
  );
  const embeddedDefaultNote = quote(
    formerValuesPart,
    "The `embeddedValues` default was 500000 before the embedded-work amendment.",
  );
  quote(
    evidencePart,
    "The nine `option-<limit>-above-ceiling` vectors of the [negative supplement](../../packages/vowl/conformance/supplemental/negative/manifest.json) remain frozen historical evidence of the superseded bounds.",
  );
  quote(
    evidencePart,
    "A versioned overlay, derived from this amendment without production code, supplies their current expectations.",
  );
  quote(
    evidencePart,
    "Qualification covers each limit at `Infinity`, at `Number.MAX_SAFE_INTEGER` and one above its former bound; rejection of the values listed under overrides; the four retained defaults; deadline timing; the deep-iteration bound; `expandedXmlBytes`; the adapter's derived bounds; stack exhaustion; and the application's retained policy.",
  );
  quote(evidencePart, "This amendment changes admission only.");
  quote(
    evidencePart,
    "No profile, field, canonical byte, cancellation rule or no-fallback rule changes.",
  );

  const formerWhere = `${amendment.path}, Former values`;
  const formerValues = new Map();
  for (const [nameCell, defaultCell, boundCell] of tableRows(
    formerValuesPart,
    ["Limit", "Former default", "Former upper override bound"],
  )) {
    const name = limitName(nameCell, formerWhere);
    check(!formerValues.has(name), `${formerWhere}: ${name} appears twice`);
    formerValues.set(name, {
      formerDefault: integerCell(defaultCell, formerWhere),
      formerUpperBound: integerCell(boundCell, formerWhere),
    });
  }
  const defaultsWhere = `${amendment.path}, Defaults`;
  const amendmentDefaults = new Map();
  for (const [nameCell, defaultCell] of tableRows(defaultsPart, [
    "Limit",
    "Default",
    "Outside basis",
  ])) {
    const name = limitName(nameCell, defaultsWhere);
    check(
      !amendmentDefaults.has(name),
      `${defaultsWhere}: ${name} appears twice`,
    );
    amendmentDefaults.set(name, integerCell(defaultCell, defaultsWhere));
  }
  const noDefaultNames = [
    ...noDefaultSentence
      .slice(0, noDefaultSentence.indexOf(" have no default"))
      .matchAll(/`([A-Za-z]+)`/g),
  ].map((match) => match[1]);
  check(
    noDefaultNames.every((name) => !amendmentDefaults.has(name)),
    `${defaultsWhere}: a limit both has and lacks a default`,
  );
  const limitNames = [
    ...formerValues.keys(),
    ...[...amendmentDefaults.keys()].filter((name) => !formerValues.has(name)),
  ];
  check(
    sameJson(
      [...new Set([...amendmentDefaults.keys(), ...noDefaultNames])].sort(),
      [...limitNames].sort(),
    ),
    `${amendment.path}: the Defaults section does not name exactly the limits of Former values and the new ones`,
  );
  check(
    sameJson(
      limitNames.filter((name) => !formerValues.has(name)),
      ["expandedXmlBytes"],
    ),
    `${amendment.path}: expandedXmlBytes is expected to be the only new limit`,
  );
  // No default of the amendment is stricter than the former one: the limits
  // of noDefaultNames impose none, and the retained defaults are no lower.
  for (const [name, { formerDefault }] of formerValues)
    check(
      noDefaultNames.includes(name) ||
        amendmentDefaults.get(name) >= formerDefault,
      `${amendment.path}: the ${name} default is stricter than its former default`,
    );

  // -------------------------------------------------------------------------
  // The core contract: the A7 error codes and option stage, and A8's table.
  const coreText = coreContractBytes.toString("utf8");
  const a7Part = section(
    coreText,
    "## A7. Validation contract and deterministic errors",
    coreContract.path,
  );
  const a8Part = section(
    coreText,
    "## A8. Resource and worker policy",
    coreContract.path,
  );
  quote(a7Part, "1. operation/options and already-aborted signal;");
  const errorRows = tableRows(a7Part, ["Stable code", "Meaning"]);
  const codesOf = (meaning) => {
    const rows = errorRows.filter((row) => row[1] === meaning);
    check(
      rows.length === 1,
      `${coreContract.path}, A7: no single error row means "${meaning}"`,
    );
    return [...rows[0][0].matchAll(/`([A-Z_]+)`/g)].map((match) => match[1]);
  };
  check(
    sameJson(
      codesOf(
        "Unknown option, invalid profile option, or limit outside its allowed domain.",
      ),
      ["OPTION_INVALID"],
    ),
    `${coreContract.path}, A7: OPTION_INVALID no longer has its meaning`,
  );
  const budgetCodes = new Set([
    ...codesOf("A counted resource budget is exceeded."),
    ...codesOf("Caller cancellation or elapsed-time budget."),
  ]);
  quote(
    a8Part,
    "Each integer override must be between one and its upper bound, except `rdfDeepIterations`, which may be zero.",
  );
  quote(a8Part, "These controls apply to `canonicalize` and `decode`;");
  const a8Where = `${coreContract.path}, A8`;
  const a8Limits = new Map();
  for (const [nameCell, , defaultCell, boundCell] of tableRows(a8Part, [
    "Option",
    "Unit and enforcement",
    "Default",
    "Upper override bound",
  ]))
    a8Limits.set(limitName(nameCell, a8Where), {
      a8Default: integerCell(defaultCell, a8Where),
      a8UpperBound: integerCell(boundCell, a8Where),
    });
  check(
    sameJson([...a8Limits.keys()], [...formerValues.keys()]),
    `${a8Where}: its limits differ from the amendment's Former values`,
  );
  const embeddedDefaultBefore = Number(
    /was (\d+) before/.exec(embeddedDefaultNote)[1],
  );
  for (const [name, { a8Default, a8UpperBound }] of a8Limits) {
    const { formerDefault, formerUpperBound } = formerValues.get(name);
    check(
      a8UpperBound === formerUpperBound,
      `${name}: the A8 upper bound differs from the amendment's former upper override bound`,
    );
    check(
      a8Default === formerDefault ||
        (name === "embeddedValues" && a8Default === embeddedDefaultBefore),
      `${name}: the A8 default differs from the amendment's former default`,
    );
    check(
      a8Default <= formerDefault,
      `${name}: the A8 default is above the former default`,
    );
  }

  // Admission. Under A8, an override is an integer from one, or zero for
  // rdfDeepIterations, up to its upper bound. Under the amendment's Overrides
  // section, it is a positive safe integer or Infinity, or zero for
  // rdfDeepIterations, and any other value fails with OPTION_INVALID at
  // /limits/<name>. An unknown name fails under both.
  const knownLimits = new Set(limitNames);
  const amendmentAdmits = (name, value) =>
    knownLimits.has(name) &&
    (value === Infinity ||
      (Number.isSafeInteger(value) && value > 0) ||
      (name === "rdfDeepIterations" && value === 0));
  const a8Admits = (name, value) =>
    a8Limits.has(name) &&
    Number.isInteger(value) &&
    value >= (name === "rdfDeepIterations" ? 0 : 1) &&
    value <= a8Limits.get(name).a8UpperBound;

  // -------------------------------------------------------------------------
  // The predecessor manifest. Only the admission of the nine
  // option-<limit>-above-ceiling records changes; every other record keeps
  // its expectation.
  const predecessor = JSON.parse(predecessorBytes.toString("utf8"));
  check(
    predecessor.format === "canonical-vowl-negative-and-boundary-manifest/1" &&
      Array.isArray(predecessor.vectors),
    `${predecessorManifest.path}: not a negative/boundary manifest`,
  );
  const predecessorById = new Map();
  for (const record of predecessor.vectors) {
    check(
      !predecessorById.has(record.id),
      `${predecessorManifest.path}: ${record.id} appears twice`,
    );
    predecessorById.set(record.id, record);
  }
  const replacedIds = [...formerValues.keys()].map(
    (name) => `option-${name}-above-ceiling`,
  );
  check(
    sameJson(
      predecessor.vectors
        .map((record) => record.id)
        .filter((id) => /^option-[A-Za-z]+-above-ceiling$/.test(id)),
      replacedIds,
    ),
    `${predecessorManifest.path}: the option-<limit>-above-ceiling records are not one per former limit in table order`,
  );
  const admissionChanged = [];
  for (const record of predecessor.vectors) {
    const limits = record.options?.limits;
    if (limits === undefined) {
      check(
        !budgetCodes.has(record.expectedError),
        `${record.id}: expects ${record.expectedError} under default limits, which the amendment's Defaults section may change`,
      );
      continue;
    }
    const entries = Object.entries(limits);
    const admittedBefore = entries.every(([name, value]) =>
      a8Admits(name, value),
    );
    const admittedNow = entries.every(([name, value]) =>
      amendmentAdmits(name, value),
    );
    if (!admittedBefore)
      check(
        record.expectedError === "OPTION_INVALID",
        `${record.id}: rejected under A8 but does not expect OPTION_INVALID`,
      );
    if (!admittedNow)
      check(
        record.expectedError === "OPTION_INVALID",
        `${record.id}: rejected under the amendment but does not expect OPTION_INVALID`,
      );
    if (admittedBefore !== admittedNow) admissionChanged.push(record.id);
  }
  check(
    sameJson(admissionChanged, replacedIds),
    `the amendment changes the admission of ${admissionChanged.join(", ") || "no record"}, not exactly the nine option-<limit>-above-ceiling records`,
  );

  // -------------------------------------------------------------------------
  // The fixture: the nine records name it, the positive baseline records its
  // success with default options, and its files are pinned there.
  const fixtureIds = [
    ...new Set(replacedIds.map((id) => predecessorById.get(id).sourceFixture)),
  ];
  check(
    fixtureIds.length === 1 && typeof fixtureIds[0] === "string",
    "the nine records do not name one source fixture",
  );
  const [fixtureId] = fixtureIds;
  const baseline = JSON.parse(baselineBytes.toString("utf8"));
  check(
    baseline.format === "canonical-vowl-conformance-manifest/1" &&
      Array.isArray(baseline.vectors),
    `${positiveBaseline.path}: not a positive conformance manifest`,
  );
  check(
    baseline.specificationRevision.some(
      (pin) =>
        pin.path === coreContract.path && pin.sha256 === coreContract.sha256,
    ),
    `${positiveBaseline.path}: not derived under the pinned core contract`,
  );
  check(
    baseline.policy?.formula ===
      "min(totalAllocatedBlankNodes ** 2, rdfDeepIterations)" &&
      baseline.policy.defaultRdfDeepIterations ===
        a8Limits.get("rdfDeepIterations").a8Default &&
      baseline.policy.defaultDeadlineMs === a8Limits.get("deadlineMs").a8Default,
    `${positiveBaseline.path}: its recorded policy differs from the A8 defaults and the B * B allowance`,
  );
  const fixtureRecords = baseline.vectors.filter(
    (record) => record.id === fixtureId,
  );
  check(
    fixtureRecords.length === 1,
    `${positiveBaseline.path}: ${fixtureId} is not listed exactly once`,
  );
  const [fixture] = fixtureRecords;
  check(
    fixture.profile === structuralContentProfile &&
      !Object.hasOwn(fixture, "options") &&
      !Object.hasOwn(fixture, "expectedError"),
    `${positiveBaseline.path}: ${fixtureId} is not a structural-content positive with default options`,
  );
  const sourcePin = fixture.files?.["source.json"];
  const canonicalPin = fixture.files?.["canonical.json"];
  check(
    sourcePin?.path === `vectors/${fixtureId}/source.json` &&
      canonicalPin?.path === `vectors/${fixtureId}/canonical.json`,
    `${positiveBaseline.path}: ${fixtureId} does not pin vectors/${fixtureId}/source.json and canonical.json`,
  );
  const fixtureSourceBytes = requirePinned(
    sourcePin,
    readCorpusMember(sourcePin.path),
  );
  const fixtureCanonicalBytes = requirePinned(
    canonicalPin,
    readCorpusMember(canonicalPin.path),
  );
  check(
    fixtureCanonicalBytes.at(-1) !== 0x0a,
    `${canonicalPin.path}: ends with a newline, but canonical.json files have none`,
  );
  const counts = fixture.counts;
  check(
    ["primary", "blankNodes", "quads"].every((field) =>
      Number.isSafeInteger(counts?.[field]),
    ),
    `${positiveBaseline.path}: ${fixtureId} has no primary, blank-node and quad counts`,
  );
  const expectedCanonical = {
    path: canonicalPin.path,
    sha256: canonicalPin.sha256,
  };
  const quadBoundary = predecessorById.get("rdf-quad-limit-exact");
  check(
    quadBoundary?.sourceFixture === fixtureId &&
      quadBoundary.expectedError === null &&
      sameJson(quadBoundary.expectedCanonical, expectedCanonical),
    `${predecessorManifest.path}: rdf-quad-limit-exact no longer expects ${canonicalPin.path} for ${fixtureId}`,
  );

  // -------------------------------------------------------------------------
  // Expectations. A rejected value fails with OPTION_INVALID at
  // /limits/<name>. An admitted value succeeds with the fixture's canonical
  // bytes when the fixture cannot cross it: expandedXmlBytes because
  // canonicalize reads no XML, and any other limit when the value is at least
  // the former default under which the baseline records the success. No
  // other default is stricter than before, and the amendment changes
  // admission only, not canonical bytes. Anything else is left undecided.
  function deriveOutcome(name, value) {
    if (!amendmentAdmits(name, value))
      return {
        kind: "rejection",
        expectedError: "OPTION_INVALID",
        expectedPointer: `/limits/${name}`,
      };
    if (name === "expandedXmlBytes") return { kind: "success" };
    if (value >= formerValues.get(name).formerDefault)
      return { kind: "success" };
    return { kind: "undecided" };
  }

  const baselineSentence = (subject) =>
    `${subject} ${sourcePin.path}, which the pinned amended-policy positive manifest canonicalizes with default options to ${canonicalPin.path}.`;
  // Under Defaults every limit other than the one overridden imposes no
  // bound, keeps its former default, or, for expandedXmlBytes, counts XML
  // only, which canonicalize never reads.
  const otherLimitsClause = (name) =>
    name === "expandedXmlBytes"
      ? "and under Defaults every other limit imposes no bound or keeps its former default, so no limit is crossed"
      : "and under Defaults every other limit imposes no bound, keeps its former default or, like expandedXmlBytes, counts only XML, so no limit is crossed";
  const bytesSentence =
    "Evidence and qualification states that the amendment changes admission only and no canonical byte, so canonicalize must succeed with exactly those bytes.";
  function successDetail(name, value) {
    if (name === "expandedXmlBytes")
      return `The canonicalize operation reads no XML, so under the OWL adapter section it validates the limit like any other and otherwise ignores it, ${otherLimitsClause(name)}.`;
    const { formerDefault } = formerValues.get(name);
    if (name === "rdfDeepIterations") {
      const blankNodes = counts.blankNodes;
      const allowance = Math.min(blankNodes * blankNodes, value);
      check(
        allowance ===
          Math.min(blankNodes * blankNodes, a8Limits.get(name).a8Default),
        `${name} ${value}: the deep-iteration allowance differs from the baseline's`,
      );
      return `With the ${blankNodes} blank nodes that the baseline records for the fixture, the allowance min(B * B, rdfDeepIterations) that the Overrides section keeps for a finite value is ${allowance}, as under the former default of ${formerDefault}, ${otherLimitsClause(name)}.`;
    }
    const fixtureFact = {
      primaryRecords: `The baseline records ${counts.primary} primary records for the fixture.`,
      rdfQuads: `The baseline records ${counts.quads} quads for the fixture.`,
    }[name];
    const sentences = [
      `The value ${value} is above the former ${name} default of ${formerDefault}, under which that success is recorded, ${otherLimitsClause(name)}.`,
    ];
    if (fixtureFact !== undefined) sentences.unshift(fixtureFact);
    if (name === "deadlineMs" && value === Number.MAX_SAFE_INTEGER)
      sentences.push(
        "The Overrides section also requires a finite deadline longer than the host's largest timer delay to expire at its actual time, never earlier.",
      );
    return sentences.join(" ");
  }
  const rejectionLead = {
    "above-max-safe-integer": (value) =>
      `${value} is an integer above Number.MAX_SAFE_INTEGER, one of the values that the Overrides section says fail.`,
    fraction: (value) =>
      `${value} is a fraction, one of the values that the Overrides section says fail.`,
    null: () =>
      "null is one of the values that the Overrides section says fail.",
    negative: (value) =>
      `${value} is a negative number, one of the values that the Overrides section says fail.`,
    zero: () =>
      "0 is not positive, and the Overrides section accepts zero only for rdfDeepIterations.",
  };
  function rejectionReason(name, suffix, value) {
    const sentences = [
      rejectionLead[suffix](value),
      `It is neither a positive safe integer nor Infinity, so the option fails with OPTION_INVALID at /limits/${name}.`,
    ];
    if (name === "expandedXmlBytes")
      sentences.push(
        "The OWL adapter section says that an operation that reads no XML, such as canonicalize, validates this limit like any other and otherwise ignores it, so the value is still rejected.",
      );
    sentences.push(
      `A7 places option validation at stage 1, before the valid ${fixtureId} input is examined.`,
    );
    return sentences.join(" ");
  }
  const successRules = (name) =>
    name === "expandedXmlBytes"
      ? [rules.defaults, rules.overrides, rules.owlAdapter, rules.evidence]
      : [rules.defaults, rules.overrides, rules.formerValues, rules.evidence];
  const rejectionRules = (name) =>
    name === "expandedXmlBytes"
      ? [rules.overrides, rules.owlAdapter, rules.validation]
      : [rules.overrides, rules.validation];

  // The nine replaced records keep the predecessor's identity fields; only
  // the active expectation fields are new.
  const identityFields = [
    "id",
    "operation",
    "profile",
    "options",
    "sourceFixture",
    "input",
  ];
  const overlayRecords = [];
  const replacedInputs = [];
  for (const name of formerValues.keys()) {
    const original = predecessorById.get(`option-${name}-above-ceiling`);
    const value = formerValues.get(name).formerUpperBound + 1;
    check(
      identityFields.every((field) => Object.hasOwn(original, field)) &&
        original.operation === "canonicalize" &&
        original.profile === structuralContentProfile &&
        sameJson(original.options, { limits: { [name]: value } }) &&
        original.expectedError === "OPTION_INVALID" &&
        original.sourceFixture === fixtureId,
      `${original.id}: not the predecessor record that the amendment describes`,
    );
    const inputBytes = requirePinned(
      original.input,
      readCorpusMember(original.input.path),
    );
    check(
      inputBytes.equals(fixtureSourceBytes),
      `${original.input.path}: its bytes differ from ${sourcePin.path}`,
    );
    const outcome = deriveOutcome(name, value);
    check(
      outcome.kind === "success",
      `${original.id}: the amendment does not decide success`,
    );
    replacedInputs.push({ ...original.input, usedBy: [original.id] });
    overlayRecords.push({
      ...Object.fromEntries(
        identityFields.map((field) => [field, original[field]]),
      ),
      expectedError: null,
      expectedCanonical,
      rules: successRules(name),
      reason: [
        `${value} is one above the former ${name} upper override bound of ${formerValues.get(name).formerUpperBound} listed under Former values.`,
        "The Overrides section admits any positive safe integer and sets no upper override bound, so the value is a valid override and OPTION_INVALID no longer applies.",
        baselineSentence("The input bytes equal"),
        successDetail(name, value),
        bytesSentence,
      ].join(" "),
      status: vectorStatus,
      authority: { path: amendment.path, sha256: amendment.sha256 },
      replaces: {
        manifest: {
          path: predecessorManifest.path,
          sha256: predecessorManifest.sha256,
        },
        vectorId: original.id,
        recordSha256: recordSha256(original),
        inputUnchanged: true,
        optionsUnchanged: true,
      },
      historical: {
        authority:
          "Historical record for provenance only; its expectedError and rules record the superseded A8 upper override bound and do not control this active overlay.",
        predecessorRecord: original,
      },
    });
  }

  // New vectors: every limit against the override values that the amendment
  // decides and JSON can spell. A case that a predecessor record already
  // covers with an unchanged expectation is not repeated.
  const maximumSafeInteger = Number.MAX_SAFE_INTEGER;
  const aboveMaximumSafeInteger = 2 ** 53;
  check(
    aboveMaximumSafeInteger === maximumSafeInteger + 1 &&
      !Number.isSafeInteger(aboveMaximumSafeInteger) &&
      JSON.parse(JSON.stringify(aboveMaximumSafeInteger)) ===
        aboveMaximumSafeInteger,
    "2 ** 53 must be the smallest integer above Number.MAX_SAFE_INTEGER and survive JSON",
  );
  const valueCases = [
    { suffix: "max-safe-integer", value: maximumSafeInteger },
    { suffix: "above-max-safe-integer", value: aboveMaximumSafeInteger },
    { suffix: "fraction", value: 1.5 },
    { suffix: "null", value: null },
    { suffix: "negative", value: -1 },
    { suffix: "zero", value: 0 },
    { suffix: "one-ignored", value: 1, only: "expandedXmlBytes" },
  ];
  const undecidedQuestions = {
    "option-rdfDeepIterations-zero":
      "Does canonicalizing empty-structural invoke RDFC-1.0 deep comparison at all, so that a zero allowance is crossed? Neither the authority nor the frozen corpus records the count; the frozen rdf-deep-zero vector already shows that zero is admitted.",
  };
  const fixtureInput = {
    path: sourcePin.path,
    sha256: sourcePin.sha256,
    byteLength: sourcePin.byteLength,
  };
  const newVectors = [];
  const coveredByPredecessor = [];
  const undecidedCases = [];
  for (const name of limitNames)
    for (const { suffix, value, only } of valueCases) {
      if (only !== undefined && only !== name) continue;
      const id = `option-${name}-${suffix}`;
      const options = { limits: { [name]: value } };
      const outcome = deriveOutcome(name, value);
      const existing = predecessorById.get(id);
      if (existing !== undefined) {
        check(
          existing.operation === "canonicalize" &&
            existing.profile === structuralContentProfile &&
            sameJson(existing.options, options) &&
            existing.sourceFixture === fixtureId &&
            requirePinned(
              existing.input,
              readCorpusMember(existing.input.path),
            ).equals(fixtureSourceBytes) &&
            outcome.kind === "rejection" &&
            existing.expectedError === outcome.expectedError,
          `${id}: the predecessor record of this id does not carry the derived case`,
        );
        coveredByPredecessor.push({
          id,
          covers: `${name} ${value} fails with OPTION_INVALID, unchanged by the amendment`,
        });
        continue;
      }
      if (outcome.kind === "undecided") {
        check(
          Object.hasOwn(undecidedQuestions, id),
          `${id}: undecided, and no question is recorded for it`,
        );
        undecidedCases.push({ id, question: undecidedQuestions[id] });
        continue;
      }
      const vector = {
        id,
        operation: "canonicalize",
        profile: structuralContentProfile,
        options,
      };
      if (outcome.kind === "rejection") {
        Object.assign(vector, {
          expectedError: outcome.expectedError,
          expectedPointer: outcome.expectedPointer,
          rules: rejectionRules(name),
          sourceFixture: fixtureId,
          reason: rejectionReason(name, suffix, value),
        });
      } else {
        const lead =
          value === maximumSafeInteger
            ? `${value} is Number.MAX_SAFE_INTEGER, the largest positive safe integer, and the Overrides section admits it for ${name} because there is no upper override bound.`
            : `${value} is a positive safe integer, which the Overrides section admits for ${name}.`;
        Object.assign(vector, {
          expectedError: null,
          rules: successRules(name),
          sourceFixture: fixtureId,
          expectedCanonical,
          reason: [
            lead,
            baselineSentence("The input is"),
            successDetail(name, value),
            bytesSentence,
          ].join(" "),
        });
      }
      vector.status = vectorStatus;
      vector.input = fixtureInput;
      newVectors.push(vector);
    }
  check(
    sameJson(
      undecidedCases.map((entry) => entry.id),
      Object.keys(undecidedQuestions),
    ),
    "every recorded question must belong to an undecided case",
  );
  // Two further Overrides rules that predecessor records already test with
  // unchanged expectations: an unknown limit name still fails, and zero is
  // admitted for rdfDeepIterations.
  const unknownNameRecords = predecessor.vectors.filter((record) => {
    const names = Object.keys(record.options?.limits ?? {});
    return names.length > 0 && names.every((name) => !knownLimits.has(name));
  });
  check(
    unknownNameRecords.length > 0 &&
      unknownNameRecords.every(
        (record) => record.expectedError === "OPTION_INVALID",
      ),
    `${predecessorManifest.path}: no record tests that an unknown limit name fails with OPTION_INVALID`,
  );
  for (const record of unknownNameRecords)
    coveredByPredecessor.push({
      id: record.id,
      covers:
        "an unknown limit name fails with OPTION_INVALID, unchanged by the amendment",
    });
  const zeroDeepRecords = predecessor.vectors.filter((record) =>
    sameJson(record.options, { limits: { rdfDeepIterations: 0 } }),
  );
  check(
    zeroDeepRecords.length > 0 &&
      zeroDeepRecords.every(
        (record) =>
          amendmentAdmits("rdfDeepIterations", 0) &&
          typeof record.expectedError === "string" &&
          record.expectedError !== "OPTION_INVALID",
      ),
    `${predecessorManifest.path}: no record shows that rdfDeepIterations 0 is admitted`,
  );
  for (const record of zeroDeepRecords)
    coveredByPredecessor.push({
      id: record.id,
      covers: `rdfDeepIterations 0 is admitted, so ${record.sourceFixture} fails with ${record.expectedError} rather than OPTION_INVALID, unchanged by the amendment`,
    });
  const vectors = [...overlayRecords, ...newVectors];
  check(
    new Set(vectors.map((vector) => vector.id)).size === vectors.length,
    "vector ids are unique",
  );
  check(
    newVectors.every((vector) => !predecessorById.has(vector.id)),
    "a new vector never reuses a predecessor id",
  );

  // -------------------------------------------------------------------------
  // Files. Nothing is written unless --write-new is given, and an existing
  // file is never replaced.
  async function pinFile(name, bytes) {
    const target = resolve(supplementDirectory, name);
    if (writeMissingFiles) {
      try {
        await writeFile(target, bytes, { flag: "wx" });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    let existing;
    try {
      existing = await readFile(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      fail(`${name}: missing; run with --write-new to create missing files`);
    }
    check(
      existing.equals(bytes),
      `${name}: differs from this script's derivation; existing files are never overwritten`,
    );
    return {
      path: `${supplementMember}/${name}`,
      sha256: sha256Hex(bytes),
      byteLength: bytes.length,
    };
  }

  const producer = {
    path: `${supplementMember}/derive.mjs`,
    sha256: sha256Hex(producerBytes),
  };
  const amendmentRole =
    "Controlling authority, owner approved on 27 October 2026 and corrected the same day; it wins wherever it differs from the core contract.";
  const coreContractRole =
    "Read with the amendment for the A7 error table and validation order and the A8 limit names, units and former values. The amendment supersedes A8's finite defaults, finite upper override bounds, override domain and rule that no operation exposes an unbounded option.";
  const manifestText = jsonDocument({
    format: "canonical-vowl-negative-and-boundary-manifest/1",
    status: "active-unbounded-limits-overlay-predecessor-preserved",
    independence:
      "Expectations derived from the written rules of the pinned amendment and core contract and from frozen corpus files; no production code was read, imported or executed, and no runtime output was used.",
    authorities: [
      { ...amendment, role: amendmentRole },
      { ...coreContract, role: coreContractRole },
    ],
    predecessor: {
      path: predecessorManifest.path,
      sha256: predecessorManifest.sha256,
    },
    positiveBaseline: {
      path: positiveBaseline.path,
      sha256: positiveBaseline.sha256,
      fixture: fixtureId,
    },
    sourceArtifacts: [producer],
    consumption:
      "Run the nine records that carry replaces instead of the predecessor records with the same id, matched by exact id, the predecessor manifest hash and replaces.recordSha256; their operation, profile, options and input are those of the predecessor records. Top-level expectedError, expectedCanonical, rules and reason are the active fields. All content nested under historical is preserved provenance only and must never be merged into active expectation metadata. Records without replaces are new vectors with new ids. Every other predecessor record keeps its expectation, and the predecessor manifest stays byte-for-byte unchanged.",
    notes: [
      "Authority paths are relative to the repository root; input, fixture, manifest and source-artifact paths are relative to packages/vowl/conformance.",
      "Pass options to the named operation and supply the recorded profile separately to canonicalize, as for the predecessor manifest. Parse the input with an ordinary JSON parser, such as JSON.parse, to obtain the in-memory source.",
      "Null expectedError means that the operation must succeed and that its complete result must equal the bytes named by expectedCanonical, which have no trailing newline.",
      "expectedPointer is the error location that the amendment's Overrides section gives, /limits/<name>, as a JSON Pointer into the options object. The predecessor manifest records no pointers.",
      "A rule unbounded-limits#<anchor> names the section of the amendment with that heading; A7 is the error table and validation order of the core contract.",
      "Option values are written exactly: 9007199254740991 is Number.MAX_SAFE_INTEGER and 9007199254740992 is the smallest integer above it, and both are exactly representable binary64 numbers. Infinity and NaN have no JSON spelling, so no vector passes either; README.md lists them with the other omissions.",
    ],
    vectors,
  });
  check(/^[\x00-\x7f]*$/.test(manifestText), "manifest text is ASCII");
  const manifestPin = await pinFile("manifest.json", Buffer.from(manifestText));

  const omissions = [
    {
      case: "option-<limit>-infinity, for each of the ten limits",
      reason:
        "Infinity has no JSON spelling, so the manifest cannot pass it as an option value. This leaves untested the Overrides rules that Infinity lifts only its own limit, that rdfDeepIterations Infinity also lifts the B * B term and that deadlineMs Infinity sets no deadline while the caller's signal still cancels, and the OWL adapter rule that expandedXmlBytes Infinity also lifts the parser's internal-entity controls.",
      question:
        "How should a corpus manifest spell an option value that JSON cannot carry, such as Infinity, for example as a reserved marker that a runner converts before the call?",
    },
    {
      case: "option-<limit>-nan, for each of the ten limits",
      reason:
        "NaN has no JSON spelling either, although the Overrides section decides that it fails with OPTION_INVALID.",
      question: "The same spelling question as for Infinity.",
    },
    ...undecidedCases.map(({ id, question }) => ({
      case: id,
      reason:
        "The Overrides section admits zero for rdfDeepIterations, so OPTION_INVALID does not apply, but the result on the empty-structural input depends on whether its canonicalization needs any deep comparison.",
      question,
    })),
    {
      case: "the four retained defaults",
      reason:
        "Each needs an input that crosses the default, while every vector here reuses the empty-structural source. A depth witness also needs a counting convention, a deep-iteration witness needs a graph whose deep-comparison count only running RDFC-1.0 would show, a deadline witness is a timing outcome, which A7 says is not canonical content, and the expandedXmlBytes default applies only in fromOwl.",
      question:
        "For depth: does the outermost container count as depth 1 or as depth 0? A8 counts embedded JSON containers without saying.",
    },
    {
      case: "deadline timing",
      reason:
        "option-deadlineMs-max-safe-integer shows only that a deadline longer than the host's largest timer delay does not expire early on a small input. Whether a finite deadline expires at its actual time needs an executable timing harness, as the predecessor manifest's notes say of timing controls.",
      question: null,
    },
    {
      case: "expandedXmlBytes in fromOwl",
      reason:
        "Crossing the limit in fromOwl fails with MODEL_RESOURCE_LIMIT, which the corrected OWL adapter section names as the code of expandedXmlBytes, but a witness needs RDF/XML or OWL/XML input and the fromOwl operation, outside the canonicalize shape of the predecessor records.",
      question:
        "Is expandedXmlBytes counted per document or summed over the root document and its imports, as A8 aggregates the adapter's other counters? And is a stop by the parser's own internal-entity controls, which apply while the limit is finite, a bound that the adapter derives from expandedXmlBytes, so that it too fails with MODEL_RESOURCE_LIMIT?",
    },
    {
      case: "the adapter's derived bounds",
      reason:
        "The numeric-literal digit, profile-check work, import count and import depth bounds apply only in fromOwl and need OWL input. The corrected OWL adapter section says that each fails with the code of the limit that it derives from.",
      question:
        "In what unit is profile-check work counted, so that a witness can cross 2 * embeddedValues exactly? And which codes are those of stringBytes, embeddedValues, primaryRecords and depth? The A7 table lists four resource-limit codes under one meaning, and neither A8 nor the amendment assigns one to each limit.",
    },
    {
      case: "host limits",
      reason:
        "Whether an input reaches the call stack or the largest allocation depends on the host and on how an implementation processes it, so no fixed input has a decided outcome, and the manifest format has no field for details.resource.",
      question:
        "Must a conforming implementation process some minimum nesting depth or size before it may fail with HOST_RESOURCE_LIMIT?",
    },
    {
      case: "the application's retained policy",
      reason:
        "The WebVOWL client's checks against A8's former upper bounds belong to the application, not to the package corpus.",
      question: null,
    },
  ];
  const provenanceText = jsonDocument({
    format: "canonical-vowl-supplement-provenance/1",
    supplement: supplementMember,
    authorities: [
      {
        pinnedBy: "whole file",
        ...amendment,
        role: amendmentRole,
        consultedSections: ["complete document"],
        firstRead: {
          sha256: firstReadAmendment.sha256,
          byteLength: firstReadAmendment.byteLength,
          role: "The amendment as first approved, which the first derivation of this overlay read. derive.mjs reverses the three edits of the correction and requires exactly these bytes, so no other sentence changed.",
          edits: firstReadAmendment.edits,
        },
      },
      {
        pinnedBy: "whole file",
        ...coreContract,
        role: coreContractRole,
        consultedSections: [
          "A7 validation precedence and error table",
          "A8 resource table and its surrounding text",
        ],
      },
    ],
    reliedText,
    predecessor: {
      ...predecessorManifest,
      replacedVectorIds: replacedIds,
      recordHashConvention,
    },
    positiveBaseline: {
      ...positiveBaseline,
      fixture: fixtureId,
      role: "Records the fixture's success with default options, its counts and the pins of its files; it pins the same core contract.",
    },
    fixtures: [
      { ...sourcePin, role: "Input bytes of every vector." },
      {
        ...canonicalPin,
        role: "Expected bytes of every successful vector.",
      },
    ],
    inputs: [
      ...replacedInputs,
      {
        ...fixtureInput,
        usedBy: newVectors.map((vector) => vector.id),
      },
    ],
    producer,
    manifest: manifestPin,
    coveredByPredecessorRecords: coveredByPredecessor,
    consultedConventions: [
      "packages/vowl/conformance/README.md",
      "packages/vowl/conformance/STORAGE.md",
      "packages/vowl/conformance/storage.mjs",
      "packages/vowl/conformance/manifest.json",
      "packages/vowl/conformance/supplemental/README.md",
      "packages/vowl/conformance/supplemental/negative/derive.mjs",
      "packages/vowl/conformance/supplemental/accepted-protocol-v1/README.md",
      "packages/vowl/conformance/supplemental/accepted-protocol-v1/camera-corrections-manifest.json",
      "packages/vowl/conformance/supplemental/accepted-protocol-v1/derive.mjs",
      "packages/vowl/conformance/supplemental/accepted-protocol-v2/README.md",
      "packages/vowl/conformance/supplemental/accepted-protocol-v2/camera-corrections-manifest.json",
      "packages/vowl/conformance/supplemental/accepted-protocol-v2/derive.mjs",
      "packages/vowl/conformance/supplemental/field-contract/support.mjs",
      "packages/vowl/conformance/supplemental/lexical-position-v1/README.md",
      "packages/vowl/conformance/supplemental/lexical-position-v1/derive.mjs",
      "packages/vowl/conformance/supplemental/lexical-position-v1/provenance.json",
    ],
    alsoRead: [
      {
        path: "docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md",
        sha256:
          "9f1b7d96229a06f57e29a52f92325a4256e6f826d7532e239848ef99dc0f47c1",
        role: "Context only: the allowance that the amendment restates. Not relied on and not checked.",
      },
      {
        path: "docs/specs/2026-10-03-canonical-vowl-embedded-work-amendment.md",
        sha256:
          "99a0d42e47b88dbe9e2ee0d68951d7622928172d05180803805d30e8bb28e851",
        role: "Context only: the embeddedValues default that the amendment's Former values table records. Not relied on and not checked.",
      },
    ],
    notRead: [
      "packages/vowl/src/",
      "packages/vowl/test/",
      "packages/vowl/scripts/",
      "src/",
      "util/",
      "node_modules/",
      ".json-quality.json",
      "docs/plans/",
      "docs/canonical-vowl/",
      "Every other document in docs/specs/, including the design and the decision record. A text search of docs/specs/ for OPTION_INVALID, HOST_RESOURCE_LIMIT and /limits matched only the amendment and the core contract.",
      "Git history and diffs",
    ],
    notExecuted:
      "No module of the vowl package was imported or executed, and no runtime output was used to choose or check an expectation. derive.mjs uses Node.js built-ins and packages/vowl/conformance/storage.mjs, the corpus reader that returns member bytes.",
    omittedCases: omissions,
  });
  check(/^[\x00-\x7f]*$/.test(provenanceText), "provenance text is ASCII");
  await pinFile("provenance.json", Buffer.from(provenanceText));

  // The directory holds exactly this supplement's files, and the README lists
  // every vector.
  const entries = await readdir(supplementDirectory, { withFileTypes: true });
  for (const entry of entries)
    check(
      entry.isFile() && supplementFiles.includes(entry.name),
      `${entry.name}: not a file of this supplement`,
    );
  for (const name of supplementFiles)
    check(
      entries.some((entry) => entry.name === name),
      `${name}: missing`,
    );
  const readme = await readFile(resolve(supplementDirectory, "README.md"));
  check(!readme.includes(0x0d), "README.md must use LF line endings");
  const readmeText = readme.toString("utf8");
  const unlisted = vectors
    .map((vector) => vector.id)
    .filter((id) => !readmeText.includes("`" + id + "`"));
  check(
    unlisted.length === 0,
    `README.md does not list ${unlisted.join(", ")}`,
  );
  // The README records each current pin, digest and length on one line.
  const unrecordedPins = [
    amendment,
    coreContract,
    predecessorManifest,
    positiveBaseline,
  ].filter(
    (pin) =>
      !readmeText
        .split("\n")
        .some(
          (line) =>
            line.includes(pin.sha256) &&
            new RegExp(`\\b${pin.byteLength}\\b`).test(line),
        ),
  );
  check(
    unrecordedPins.length === 0,
    `README.md does not record the current pin of ${unrecordedPins.map((pin) => pin.path).join(", ")}`,
  );

  return {
    replacedRecords: overlayRecords.length,
    newVectors: newVectors.length,
    successes: vectors.filter((vector) => vector.expectedError === null)
      .length,
    rejections: vectors.filter((vector) => vector.expectedError !== null)
      .length,
    coveredByPredecessorRecords: coveredByPredecessor.length,
    omittedCases: omissions.length,
    wrote: writeMissingFiles ? "missing files only" : "nothing",
    result: "every derived file equals this script's derivation",
  };
}

main().then(
  (summary) => console.log(JSON.stringify(summary, null, 2)),
  (error) => {
    if (!(error instanceof DerivationFailure)) throw error;
    console.error(`unbounded-limits-v1: ${error.message}`);
    process.exitCode = 1;
  },
);
