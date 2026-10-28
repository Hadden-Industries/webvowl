// SPDX-License-Identifier: AGPL-3.0-only
// Lexical failure-position supplement, version 1: independent rejection
// vectors for stage 3 of Canonical VOWL validation (decode) and for the
// Unicode and number checks of the in-memory snapshot (canonicalize).
//
// Every expected error is taken from the written rules of the pinned sections
// of the specification draft below, and each vector cites the rules it tests.
// Nothing from the vowl package is imported or executed; only Node.js
// built-ins are used.
//
//   node derive.mjs              verify every file against this script; no writes
//   node derive.mjs --write-new  create missing files only, then verify
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

for (const argument of process.argv.slice(2))
  assert.equal(argument, "--write-new", `Unknown argument: ${argument}`);
const writeMissingFiles = process.argv.includes("--write-new");

const supplementDirectory = dirname(fileURLToPath(import.meta.url));
const corpusDirectory = resolve(supplementDirectory, "../..");
const repositoryDirectory = resolve(corpusDirectory, "../../..");
const supplementMember = "supplemental/lexical-position-v1";
const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonDocument = (document) => JSON.stringify(document, null, 2) + "\n";
const vectorStatus =
  "independently-derived-pending-review-and-production-execution";
const structuralContentProfile =
  "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1";

// This source stays ASCII and spells no backslash-u escape: escape text and
// code units are built at run time (jsonEscape, codeUnitText), so that no
// editor or transport can decode an escape into a character and silently
// change an input.
const producerBytes = await readFile(fileURLToPath(import.meta.url));
assert(
  /^[\x00-\x7f]*$/.test(producerBytes.toString("latin1")),
  "derive.mjs must stay ASCII",
);
assert(
  !/\\u[0-9a-fA-F]{4}/.test(producerBytes.toString("latin1")),
  "derive.mjs must not spell backslash-u escapes; use jsonEscape or codeUnitText",
);

// ---------------------------------------------------------------------------
// Authority. Paths are relative to the repository root. A changed or missing
// pin stops this script: review every expectation that depends on it against
// the new text before re-pinning.
//
// The specification draft is the only authority. It is still being edited, so
// it is pinned by section, not by its whole bytes. A section is its Markdown
// heading line, the one ending in {#id}, through to the line before the next
// heading of the same or a higher level, or to the end of the document; a line
// inside a fenced code block is not a heading. The pinned sections are exactly
// those that the vectors cite, as read from the draft whose whole bytes are
// recorded in readRevision for provenance only; firstReadRevision is the draft
// that the first derivation read. A renewed section records, in firstRead, the
// first pin that this supplement recorded for it and the edits since, which
// this script reverses.
const specification = {
  path: "docs/canonical-vowl/index.html",
  readRevision: {
    sha256: "030bd44364db10e91e7c4d29db46c4d62bdbac58ad0c9a932ff5d948bc63a433",
    byteLength: 249142,
  },
  firstReadRevision: {
    sha256: "3202c49af4853af659ca74ca096e2afabad359aeceb8d6589ef5dcb1e7077897",
    byteLength: 167679,
  },
  sections: [
    {
      id: "notation",
      sha256:
        "1e83b3978ce5fca5a469bc0f71193e348ac7174288f2523c09cfd8bff4156f31",
      byteLength: 2380,
    },
    {
      id: "canonical-profiles",
      sha256:
        "6643e8f70bc0e5e3e566540300b504880023d07f1e69991c587981e4c5b1f472",
      byteLength: 722,
    },
    {
      id: "envelope",
      sha256:
        "34400bdef9166d641e6f68bc61e00ba12b2660c377c1b4b5d09001601e287150",
      byteLength: 2249,
    },
    {
      id: "ontology",
      sha256:
        "f8cbb83716fb921c273188a1209c90b7c435a02d27cbd62dd31929ff527b0a89",
      byteLength: 578,
    },
    {
      id: "subjects-and-roles",
      sha256:
        "e3c4bfc4d02d7e4b5304e97866fe601152526441ea146e5e25f50cbd525ae3e8",
      byteLength: 2459,
    },
    {
      id: "exact-decoding",
      sha256:
        "a7691b558317355141ff4f2a036c9d139d682204aac0048110231b08813dfb35",
      byteLength: 2495,
    },
    {
      id: "duplicate-members",
      sha256:
        "7039971c09d97a4a3e95fef369bc2dea611b38b00c0c0809ec4e769d243eb15b",
      byteLength: 1347,
    },
    {
      id: "unicode-admission",
      sha256:
        "426c0bd1102c1e13f50ee57e297a6908fa4ab870917ddd09093a34259627cb42",
      byteLength: 895,
    },
    {
      id: "number-admission",
      sha256:
        "f14cc074b8c42517b80840d33bafe8558e9f600b7429b83d59dfb794e2070fd8",
      byteLength: 673,
    },
    {
      id: "in-memory-input",
      sha256:
        "d731038e63136a3c4a86c36c443adcf8a62e27265578dc52589fc4087545e15d",
      byteLength: 1940,
      firstRead: {
        sha256:
          "6c6590304ffc7093658ab4170924ed235578c221ffed70b7f7fc6e043095b0ed",
        byteLength: 1717,
        edits: [
          {
            current:
              "The producer MUST fail with `SOURCE_UNSAFE_VALUE` on input that is not plain data, such as a cyclic value, an accessor property, or a value of a type that JSON lacks, like `undefined`, a function, a symbol or a big integer.\n" +
              "A number that JSON cannot represent, such as NaN or an infinity, is plain data that fails number admission instead ([[[#number-admission]]]).\n",
            firstRead:
              "The producer MUST fail with `SOURCE_UNSAFE_VALUE` on input that is not plain data, such as a cyclic value or a value with no JSON counterpart.\n",
          },
        ],
      },
    },
    {
      id: "validation-order",
      sha256:
        "c1fc33dfe002df78d8dfdd93f7fdba0bc57d1f76b52f3e81781b461c2979982c",
      byteLength: 5233,
    },
    {
      id: "failure-positions",
      sha256:
        "274c1a7220f42d3d4569e3fc4c158c951e20d39731a130d66575bd808964f478",
      byteLength: 1759,
    },
    {
      id: "limits",
      sha256:
        "e41dbd01b0fd6e73252a4bdfcffa5f44b4dcc09993c69889f4a9b6551625ddd6",
      byteLength: 7010,
      firstRead: {
        sha256:
          "43857b1908efa512872e277991f24af671769445de47497cd6f1f7814036aa11",
        byteLength: 6711,
        edits: [
          {
            current:
              "  An [=OWL mapping adapter=] or [=migration adapter=] MUST share one deadline and one set of counters with the core operation it calls, rather than resetting them at each stage.\n" +
              "  Each value counts once in an operation, however often the operation copies it, and a value that occurs at several positions counts at each: the core operation that an adapter hands its normalized source to does not count again what the adapter counted while building it.\n",
            firstRead:
              "  An [=OWL mapping adapter=] or [=migration adapter=] MUST share one deadline and one set of counters with the core operation it calls, rather than resetting them at each stage.\n",
            pinBefore: {
              sha256:
                "c02b60618d5d3287604d14db9aef8269d4977af2e9b2decd23a5789186d551e7",
              byteLength: 6737,
            },
          },
          {
            current:
              "  A code point that is not [=Unicode-valid=] fails before it is counted, so neither a lone surrogate nor a noncharacter ever counts toward a string limit.\n",
            firstRead:
              "  A code point that is not [=Unicode-valid=] fails before it is counted, so a lone surrogate never counts toward a string limit.\n",
          },
        ],
      },
    },
  ],
};

// Byte spans of the Markdown headings of the draft under the section rule.
function specificationSectionSpans(documentBytes) {
  const lines = [];
  let lineStart = 0;
  for (let index = 0; index < documentBytes.length; index += 1)
    if (documentBytes[index] === 0x0a) {
      lines.push({ start: lineStart, end: index + 1 });
      lineStart = index + 1;
    }
  if (lineStart < documentBytes.length)
    lines.push({ start: lineStart, end: documentBytes.length });
  const headings = [];
  let openFence = null;
  for (const line of lines) {
    const lineText = documentBytes
      .subarray(line.start, line.end)
      .toString("utf8")
      .replace(/\r?\n$/, "");
    if (openFence !== null) {
      const closingFence = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lineText);
      if (
        closingFence &&
        closingFence[1][0] === openFence[0] &&
        closingFence[1].length >= openFence.length
      )
        openFence = null;
      continue;
    }
    const openingFence = /^ {0,3}(`{3,}|~{3,})/.exec(lineText);
    if (openingFence) {
      openFence = openingFence[1];
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(lineText);
    if (heading === null) continue;
    const headingId = /\{#([A-Za-z0-9_-]+)\}$/.exec(heading[2] ?? "");
    headings.push({
      start: line.start,
      level: heading[1].length,
      id: headingId ? headingId[1] : null,
    });
  }
  return headings.map((heading, index) => {
    const nextHeading = headings
      .slice(index + 1)
      .find((later) => later.level <= heading.level);
    return {
      ...heading,
      end: nextHeading ? nextHeading.start : documentBytes.length,
    };
  });
}

{
  const documentBytes = await readFile(
    resolve(repositoryDirectory, specification.path),
  );
  const spans = specificationSectionSpans(documentBytes);
  const sectionProblems = [];
  for (const pin of specification.sections) {
    const matches = spans.filter((span) => span.id === pin.id);
    if (matches.length === 0) {
      sectionProblems.push(
        `section #${pin.id} can no longer be found: no heading line ends in {#${pin.id}}`,
      );
      continue;
    }
    if (matches.length > 1) {
      sectionProblems.push(
        `section #${pin.id} is ambiguous: ${matches.length} heading lines end in {#${pin.id}}`,
      );
      continue;
    }
    const sectionBytes = documentBytes.subarray(matches[0].start, matches[0].end);
    const sectionSha256 = sha256Hex(sectionBytes);
    if (
      sectionSha256 !== pin.sha256 ||
      sectionBytes.length !== pin.byteLength
    ) {
      sectionProblems.push(
        `section #${pin.id} changed: it now has ${sectionBytes.length} bytes with SHA-256 ${sectionSha256}; the pin is ${pin.byteLength} bytes with SHA-256 ${pin.sha256}`,
      );
      continue;
    }
    if (pin.firstRead === undefined) continue;
    // Reversing the recorded edits must give exactly the bytes of the first
    // reading, so that no other sentence of the section changed.
    // Edits are listed newest first; an edit's pinBefore is the pin that this
    // supplement recorded before it, which reversing it must give.
    let firstReadText = sectionBytes.toString("utf8");
    const misplacedEdit = pin.firstRead.edits.find((edit) => {
      const parts = firstReadText.split(edit.current);
      if (parts.length !== 2) return true;
      firstReadText = parts.join(edit.firstRead);
      if (edit.pinBefore === undefined) return false;
      const pinBeforeBytes = Buffer.from(firstReadText, "utf8");
      return (
        sha256Hex(pinBeforeBytes) !== edit.pinBefore.sha256 ||
        pinBeforeBytes.length !== edit.pinBefore.byteLength
      );
    });
    const firstReadBytes = Buffer.from(firstReadText, "utf8");
    if (misplacedEdit !== undefined)
      sectionProblems.push(
        `section #${pin.id}: a recorded edit does not occur exactly once, or reversing it does not give its pinBefore`,
      );
    else if (
      sha256Hex(firstReadBytes) !== pin.firstRead.sha256 ||
      firstReadBytes.length !== pin.firstRead.byteLength
    )
      sectionProblems.push(
        `section #${pin.id}: reversing its recorded edits does not give the ${pin.firstRead.byteLength} bytes with SHA-256 ${pin.firstRead.sha256} that the first derivation read`,
      );
  }
  assert(
    sectionProblems.length === 0,
    `${specification.path}: ${sectionProblems.join("; ")}. Review every vector that cites these sections against the new text before re-pinning.`,
  );
}

// Read, but neither relied on nor checked. The first derivation cited the A8
// resource table of the core contract, read with the first two amendments, as
// "A8". The draft's #errors section is now consolidated from A7 and A8, and
// the draft states that its consolidated sections, not their sources, are
// authoritative; #limits, which also consolidates the unbounded-limits
// amendment, now takes the place of A8.
const alsoRead = [
  {
    path: "docs/specs/2026-09-24-canonical-vowl-core-contract.md",
    sha256: "711ba30c291cfb0960334328203188600f60a331996e83379267a4a77b87988d",
    role: "Cited as A8 by the first derivation, which pinned it by its whole bytes, for the A7 error table and the A8 limit names, units, override domains and resource-limit codes. Consolidated into #errors; not relied on and not checked.",
  },
  {
    path: "docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md",
    sha256: "9f1b7d96229a06f57e29a52f92325a4256e6f826d7532e239848ef99dc0f47c1",
    role: "Read with A8 by the first derivation, which pinned it by its whole bytes; it concerns rdfDeepIterations, which no vector sets. Consolidated into #rdfc-work; not relied on and not checked.",
  },
  {
    path: "docs/specs/2026-10-03-canonical-vowl-embedded-work-amendment.md",
    sha256: "99a0d42e47b88dbe9e2ee0d68951d7622928172d05180803805d30e8bb28e851",
    role: "Read with A8 by the first derivation, which pinned it by its whole bytes; it set the embeddedValues default, which the unbounded-limits amendment supersedes. Not relied on and not checked.",
  },
  {
    path: "docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md",
    sha256: "8f5b7dd02ebeefd0f3deced6fe7096b194120090611c58f505123c0c843bc9cc",
    role: "Read to decide whether it is an authority. It changes defaults, override bounds and the override domain, and #limits consolidates it; no expectation depends on a default or a bound, and every limit a vector sets is a positive safe integer. Not relied on and not checked.",
  },
];

// Rule labels: "#id" is a pinned section of the specification draft.
const rules = {
  canonicalProfiles: "#canonical-profiles",
  failurePositions: "#failure-positions",
  validationOrder: "#validation-order",
  exactDecoding: "#exact-decoding",
  unicodeAdmission: "#unicode-admission",
  numberAdmission: "#number-admission",
  duplicateMembers: "#duplicate-members",
  inMemoryInput: "#in-memory-input",
  notation: "#notation",
  envelope: "#envelope",
  ontology: "#ontology",
  subjectsAndRoles: "#subjects-and-roles",
  limits: "#limits",
};

const coverageGroups = new Map([
  [
    "misplaced-token",
    "A token in a position the grammar does not allow, against a Unicode, number or limit failure inside it; and a failure inside a valid token before a misplaced one.",
  ],
  [
    "inadmissible-number",
    "Negative zero and overflowing numbers against a grammar failure at the next byte, whitespace before a grammar failure, truncation, and on their own.",
  ],
  [
    "prohibited-code-point",
    "Lone surrogate escapes, escaped pairs and escapes that denote noncharacters, and raw noncharacters, against a later grammar failure in the same string, and the reverse.",
  ],
  [
    "string-limit",
    "A crossing of stringBytes or totalStringBytes before a noncharacter, in values and member names; a noncharacter before a crossing in a later string; and noncharacters that would cross a limit only if they were counted.",
  ],
  [
    "nesting-limit-tie",
    "A misplaced opening bracket that also takes the nesting depth past its limit, a grammar failure before such a crossing, and a crossing before a grammar failure.",
  ],
  [
    "duplicate-member-name",
    "A repeated member name against a later grammar failure, the reverse, the same name in different objects, and a totalStringBytes crossing inside the repeated name.",
  ],
  [
    "in-memory-snapshot",
    "canonicalize: the snapshot's Unicode and number checks against earlier and later unknown or mistyped members, and member names that are not Unicode-valid.",
  ],
]);

// Stage-3 failure kinds in the tie order of #failure-positions.
const failureTieOrder = [
  "json-grammar",
  "duplicate-member-name",
  "unicode-validity",
  "number-admission",
  "lexical-limit",
];
// Codes named by #exact-decoding, #duplicate-members, #unicode-admission and
// #number-admission.
const errorCodeByFailure = new Map([
  ["json-grammar", "JSON_SYNTAX"],
  ["duplicate-member-name", "JSON_DUPLICATE_MEMBER"],
  ["unicode-validity", "UNICODE_INVALID"],
  ["number-admission", "NUMBER_INVALID"],
]);
// #limits assigns each counted limit one code in every operation and stage
// that counts it; these are the lexical limits that the vectors set.
const errorCodeByLimit = new Map([
  ["depth", "MODEL_RESOURCE_LIMIT"],
  ["stringBytes", "MODEL_RESOURCE_LIMIT"],
  ["totalStringBytes", "MODEL_RESOURCE_LIMIT"],
]);
const errorCodeOf = (entry) =>
  entry.failure === "lexical-limit"
    ? errorCodeByLimit.get(entry.limit)
    : errorCodeByFailure.get(entry.failure);

// ---------------------------------------------------------------------------
// Input construction. A decode input is written as a jsonText template: its
// raw template text is the input's printable ASCII, and substitutions are
// escape text, raw bytes or failure markers. A marker adds no bytes. It
// records the failure position that #failure-positions defines for the
// failure it names: the next byte (or the input length) for "next", the
// previous byte for "previous".
const failureMarker = (failure, anchor, limit) =>
  Object.freeze(
    limit === undefined ? { failure, anchor } : { failure, anchor, limit },
  );
// Before the first byte that cannot continue the JSON text, or at the end.
const grammarFailsAt = failureMarker("json-grammar", "next");
// Before the closing quotation mark of a repeated member name.
const repeatedNameClosesAt = failureMarker("duplicate-member-name", "next");
// After the last byte of a raw prohibited code point, or after the last
// hexadecimal digit of its escape (of the second escape for a pair).
const unicodeFailureEnds = failureMarker("unicode-validity", "previous");
// After the last byte of an inadmissible number.
const numberEnds = failureMarker("number-admission", "next");
// After the character or escape that takes a string length past its limit.
const stringLimitCrossedBy = (limit) =>
  failureMarker("lexical-limit", "previous", limit);
// Before the opening bracket or brace that takes the depth past its limit.
const depthLimitCrossedAt = failureMarker("lexical-limit", "next", "depth");
// After the character that would take a string length past its limit if a
// noncharacter at or before it were counted. #limits makes a code point that
// is not Unicode-valid fail before it is counted, so this marks no failure:
// the vector's note gives the byte, and the tracer confirms it by counting
// noncharacters.
const crossingIfCounted = (limit) =>
  Object.freeze({ crossingIfCounted: limit, anchor: "previous" });

const rawCodePoint = (codePoint) => {
  assert(
    codePoint < 0xd800 || codePoint > 0xdfff,
    "Raw UTF-8 cannot carry a surrogate",
  );
  return Buffer.from(String.fromCodePoint(codePoint), "utf8");
};
const rawByte = (byte) => Buffer.from([byte]);
const backslash = String.fromCharCode(0x5c);
const hexDigits = (codeUnit) => codeUnit.toString(16).padStart(4, "0");
// The six-character JSON escape text for each UTF-16 code unit given.
const jsonEscape = (...codeUnits) =>
  codeUnits.map((codeUnit) => `${backslash}u${hexDigits(codeUnit)}`).join("");
const jsonEscapeUppercase = (codeUnit) =>
  `${backslash}u${hexDigits(codeUnit).toUpperCase()}`;
// In-memory text made of the UTF-16 code units given.
const codeUnitText = (...codeUnits) => String.fromCharCode(...codeUnits);
const invalidEscapeX = [backslash, grammarFailsAt, "x"];
const invalidEscapeA = [backslash, grammarFailsAt, "a"];

function jsonText(templateChunks, ...substitutions) {
  const segments = [];
  templateChunks.raw.forEach((chunk, index) => {
    segments.push(chunk);
    if (index < substitutions.length) segments.push(substitutions[index]);
  });
  return segments.flat(Infinity);
}

const tieRank = (entry) => failureTieOrder.indexOf(entry.failure);
const sortFailures = (failures) =>
  [...failures].sort(
    (left, right) =>
      left.byteOffset - right.byteOffset || tieRank(left) - tieRank(right),
  );
const firstFailure = (failures) => sortFailures(failures)[0];
const failureLabel = (entry) =>
  entry.limit === undefined ? entry.failure : `${entry.failure} (${entry.limit})`;
const sameFailure = (left, right) =>
  left.failure === right.failure &&
  left.byteOffset === right.byteOffset &&
  left.limit === right.limit;

function assembleInput(segments) {
  const pieces = [];
  const markedFailures = [];
  const crossingsIfCounted = [];
  let byteLength = 0;
  for (const segment of segments) {
    if (typeof segment === "string") {
      assert(
        /^[\x20-\x7e]*$/.test(segment),
        `Template text must be printable ASCII: ${JSON.stringify(segment)}`,
      );
      pieces.push(Buffer.from(segment, "latin1"));
      byteLength += segment.length;
    } else if (Buffer.isBuffer(segment)) {
      pieces.push(segment);
      byteLength += segment.length;
    } else if (segment.crossingIfCounted !== undefined) {
      crossingsIfCounted.push({
        limit: segment.crossingIfCounted,
        byteOffset: byteLength - 1,
      });
    } else {
      const byteOffset =
        segment.anchor === "previous" ? byteLength - 1 : byteLength;
      markedFailures.push(
        segment.limit === undefined
          ? { failure: segment.failure, byteOffset }
          : { failure: segment.failure, limit: segment.limit, byteOffset },
      );
    }
  }
  return {
    inputBytes: Buffer.concat(pieces),
    failurePositions: sortFailures(markedFailures),
    crossingsIfCounted,
  };
}

// ---------------------------------------------------------------------------
// Consistency tracer. It re-derives the stage-3 failures of an input from the
// same written rules (RFC 8259 grammar; #duplicate-members; #unicode-admission;
// #number-admission; the counted units of #limits; positions of
// #failure-positions), so that a misplaced marker or a misread byte stops this
// script. It is a check on the tables, not their source, and it stops at the
// first grammar failure.
//
// Counted units of #limits: the outermost container is at depth 1; member
// names count toward stringBytes and totalStringBytes; an escaped surrogate
// pair is one four-byte character that crosses a limit at its second escape;
// and a code point that is not Unicode-valid fails before it is counted, so
// neither a lone surrogate nor a noncharacter counts. With
// countNoncharacters, the tracer instead counts a noncharacter, which has a
// UTF-8 length, to confirm the crossings that vectors mark as crossingIfCounted;
// a lone surrogate has no UTF-8 length and never counts.

const jsonWhitespace = new Set([0x20, 0x09, 0x0a, 0x0d]);
const simpleEscapes = new Map([
  [0x22, 0x22],
  [0x5c, 0x5c],
  [0x2f, 0x2f],
  [0x62, 0x08],
  [0x66, 0x0c],
  [0x6e, 0x0a],
  [0x72, 0x0d],
  [0x74, 0x09],
]);
const literalByFirstByte = new Map([
  [0x74, "true"],
  [0x66, "false"],
  [0x6e, "null"],
]);
const isNoncharacter = (codePoint) =>
  (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
  (codePoint & 0xfffe) === 0xfffe;
const isSurrogate = (codeUnit) => codeUnit >= 0xd800 && codeUnit <= 0xdfff;
const utf8ByteCount = (codePoint) =>
  codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
const isDigit = (byte) => byte >= 0x30 && byte <= 0x39;
const hexDigitValue = (byte) =>
  isDigit(byte)
    ? byte - 0x30
    : byte >= 0x41 && byte <= 0x46
      ? byte - 0x37
      : byte >= 0x61 && byte <= 0x66
        ? byte - 0x57
        : -1;
class StopAtGrammarFailure extends Error {}

function traceStageThree(
  inputBytes,
  limits,
  { countNoncharacters = false } = {},
) {
  // The fatal UTF-8 and byte-order-mark checks precede everything traced here.
  new TextDecoder("utf-8", { fatal: true }).decode(inputBytes);
  assert(
    !inputBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    "Inputs here never begin with a byte-order mark",
  );
  const failures = [];
  const crossedLimits = new Set();
  let offset = 0;
  // The outermost container is at depth 1, and each nested one adds one.
  let depth = 0;
  let totalStringBytes = 0;
  const record = (failure, byteOffset, limit) =>
    failures.push(
      limit === undefined
        ? { failure, byteOffset }
        : { failure, limit, byteOffset },
    );
  const crossLimit = (limit, byteOffset) => {
    if (crossedLimits.has(limit)) return;
    crossedLimits.add(limit);
    record("lexical-limit", byteOffset, limit);
  };
  const stopAtGrammarFailure = (byteOffset) => {
    record("json-grammar", byteOffset);
    throw new StopAtGrammarFailure();
  };
  const peek = () => (offset < inputBytes.length ? inputBytes[offset] : -1);
  const skipWhitespace = () => {
    while (jsonWhitespace.has(peek())) offset += 1;
  };
  const consume = (expectedByte) => {
    if (peek() !== expectedByte) stopAtGrammarFailure(offset);
    offset += 1;
  };

  function readValue() {
    const byte = peek();
    if (byte === 0x7b || byte === 0x5b) return readContainer(byte === 0x7b);
    if (byte === 0x22) return readString();
    if (byte === 0x2d || isDigit(byte)) return readNumber();
    const literal = literalByFirstByte.get(byte);
    if (literal === undefined) stopAtGrammarFailure(offset);
    for (const character of literal) consume(character.charCodeAt(0));
  }

  function readContainer(isObject) {
    const openingOffset = offset;
    offset += 1;
    depth += 1;
    if (limits.depth !== undefined && depth > limits.depth)
      crossLimit("depth", openingOffset);
    const memberNames = new Set();
    const closingByte = isObject ? 0x7d : 0x5d;
    skipWhitespace();
    if (peek() === closingByte) {
      offset += 1;
      depth -= 1;
      return;
    }
    for (;;) {
      if (isObject) {
        if (peek() !== 0x22) stopAtGrammarFailure(offset);
        const memberName = readString();
        if (memberNames.has(memberName.decoded))
          record("duplicate-member-name", memberName.closingQuoteOffset);
        memberNames.add(memberName.decoded);
        skipWhitespace();
        consume(0x3a);
        skipWhitespace();
      }
      readValue();
      skipWhitespace();
      if (peek() === 0x2c) {
        offset += 1;
        skipWhitespace();
        continue;
      }
      if (peek() === closingByte) {
        offset += 1;
        depth -= 1;
        return;
      }
      stopAtGrammarFailure(offset);
    }
  }

  // Member names and values alike count toward both string limits.
  function readString() {
    offset += 1;
    const codeUnits = [];
    let stringBytes = 0;
    let pendingHighSurrogate = null;
    // A counted character crosses a limit at its last byte, or at the last
    // digit of its escape (of the second escape for a pair).
    const countCharacter = (codePoint, lastByteOffset) => {
      const byteCount = utf8ByteCount(codePoint);
      stringBytes += byteCount;
      if (limits.stringBytes !== undefined && stringBytes > limits.stringBytes)
        crossLimit("stringBytes", lastByteOffset);
      totalStringBytes += byteCount;
      if (
        limits.totalStringBytes !== undefined &&
        totalStringBytes > limits.totalStringBytes
      )
        crossLimit("totalStringBytes", lastByteOffset);
    };
    // A noncharacter fails before it is counted.
    const admitCharacter = (codePoint, lastByteOffset) => {
      if (isNoncharacter(codePoint)) {
        record("unicode-validity", lastByteOffset);
        if (!countNoncharacters) return;
      }
      countCharacter(codePoint, lastByteOffset);
    };
    // A lone surrogate fails at the last digit of its escape and never counts.
    const failLoneSurrogate = (codeUnit, lastDigitOffset) => {
      codeUnits.push(codeUnit);
      record("unicode-validity", lastDigitOffset);
    };
    const settleLoneHighSurrogate = () => {
      if (pendingHighSurrogate === null) return;
      failLoneSurrogate(
        pendingHighSurrogate.codeUnit,
        pendingHighSurrogate.lastDigitOffset,
      );
      pendingHighSurrogate = null;
    };
    for (;;) {
      const byte = peek();
      if (byte < 0x20) {
        // A raw control character, or the end of the input.
        settleLoneHighSurrogate();
        stopAtGrammarFailure(offset);
      }
      if (byte === 0x22) {
        settleLoneHighSurrogate();
        const closingQuoteOffset = offset;
        offset += 1;
        return {
          decoded: String.fromCharCode(...codeUnits),
          closingQuoteOffset,
        };
      }
      if (byte === 0x5c) {
        offset += 1;
        const escapeByte = peek();
        if (escapeByte === 0x75) {
          offset += 1;
          let codeUnit = 0;
          for (let digit = 0; digit < 4; digit += 1) {
            const digitValue = hexDigitValue(peek());
            if (digitValue < 0) {
              settleLoneHighSurrogate();
              stopAtGrammarFailure(offset);
            }
            codeUnit = codeUnit * 16 + digitValue;
            offset += 1;
          }
          const lastDigitOffset = offset - 1;
          if (
            pendingHighSurrogate !== null &&
            codeUnit >= 0xdc00 &&
            codeUnit <= 0xdfff
          ) {
            // An escaped pair is one four-byte character.
            const codePoint =
              0x10000 +
              ((pendingHighSurrogate.codeUnit - 0xd800) << 10) +
              (codeUnit - 0xdc00);
            codeUnits.push(pendingHighSurrogate.codeUnit, codeUnit);
            pendingHighSurrogate = null;
            admitCharacter(codePoint, lastDigitOffset);
            continue;
          }
          settleLoneHighSurrogate();
          if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
            pendingHighSurrogate = { codeUnit, lastDigitOffset };
            continue;
          }
          if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
            failLoneSurrogate(codeUnit, lastDigitOffset);
            continue;
          }
          codeUnits.push(codeUnit);
          admitCharacter(codeUnit, lastDigitOffset);
          continue;
        }
        if (!simpleEscapes.has(escapeByte)) {
          settleLoneHighSurrogate();
          stopAtGrammarFailure(offset);
        }
        settleLoneHighSurrogate();
        codeUnits.push(simpleEscapes.get(escapeByte));
        countCharacter(simpleEscapes.get(escapeByte), offset);
        offset += 1;
        continue;
      }
      settleLoneHighSurrogate();
      const byteCount =
        byte < 0x80 ? 1 : byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : 2;
      const character = inputBytes
        .subarray(offset, offset + byteCount)
        .toString("utf8");
      const codePoint = character.codePointAt(0);
      const lastByteOffset = offset + byteCount - 1;
      offset += byteCount;
      for (let unitIndex = 0; unitIndex < character.length; unitIndex += 1)
        codeUnits.push(character.charCodeAt(unitIndex));
      admitCharacter(codePoint, lastByteOffset);
    }
  }

  function readNumber() {
    const startOffset = offset;
    if (peek() === 0x2d) offset += 1;
    if (peek() === 0x30) offset += 1;
    else if (peek() >= 0x31 && peek() <= 0x39) {
      while (isDigit(peek())) offset += 1;
    } else stopAtGrammarFailure(offset);
    if (peek() === 0x2e) {
      offset += 1;
      if (!isDigit(peek())) stopAtGrammarFailure(offset);
      while (isDigit(peek())) offset += 1;
    }
    if (peek() === 0x65 || peek() === 0x45) {
      offset += 1;
      if (peek() === 0x2b || peek() === 0x2d) offset += 1;
      if (!isDigit(peek())) stopAtGrammarFailure(offset);
      while (isDigit(peek())) offset += 1;
    }
    const binary64 = Number(
      inputBytes.subarray(startOffset, offset).toString("latin1"),
    );
    if (!Number.isFinite(binary64) || Object.is(binary64, -0))
      record("number-admission", offset);
  }

  try {
    skipWhitespace();
    readValue();
    skipWhitespace();
    if (offset !== inputBytes.length) stopAtGrammarFailure(offset);
  } catch (error) {
    if (!(error instanceof StopAtGrammarFailure)) throw error;
  }
  return sortFailures(failures);
}

// ---------------------------------------------------------------------------
// decode vectors.
const decodeVectors = [];
const decodeRules = (...citedRules) => [
  rules.failurePositions,
  ...citedRules,
];

// The note of a vector with a crossingIfCounted marker is derived from it.
const crossingIfCountedNote = ({ limit, byteOffset }, limits) =>
  `A code point that is not Unicode-valid fails before it is counted (#limits), so the ${limit} limit of ${limits[limit]} is not crossed; counting the noncharacter would cross it at byte ${byteOffset}.`;

function decodeVector(
  coverageGroup,
  id,
  segments,
  expectedError,
  citedRules,
  { limits, note } = {},
) {
  assert(coverageGroups.has(coverageGroup), coverageGroup);
  const assembled = assembleInput(segments);
  assert(
    assembled.crossingsIfCounted.length <= 1,
    `${id}: at most one crossing if counted`,
  );
  let vectorNote = note;
  if (assembled.crossingsIfCounted.length === 1) {
    assert.equal(note, undefined, `${id}: this note is derived`);
    vectorNote = crossingIfCountedNote(assembled.crossingsIfCounted[0], limits);
  }
  decodeVectors.push({
    coverageGroup,
    id,
    ...assembled,
    expectedError,
    citedRules,
    limits,
    note: vectorNote,
  });
}

const outermostDepthNote = "The outermost container is at depth 1 (#limits).";
const memberNamesNote = (limit) =>
  `Member names count toward ${limit} (#limits).`;

// Group misplaced-token: grammar fails at the first byte of a token that the
// grammar does not allow there, before any failure inside that token.
decodeVector(
  "misplaced-token",
  "misplaced-string-holds-lone-high-surrogate-escape",
  jsonText`[1 ${grammarFailsAt}"${jsonEscape(0xd800)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.unicodeAdmission),
  { note: "Example in #failure-positions." },
);
decodeVector(
  "misplaced-token",
  "misplaced-string-holds-escaped-noncharacter",
  jsonText`{"a" ${grammarFailsAt}"${jsonEscape(0xffff)}${unicodeFailureEnds}"}`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.unicodeAdmission),
);
decodeVector(
  "misplaced-token",
  "misplaced-string-holds-raw-noncharacter",
  jsonText`["a" ${grammarFailsAt}"${rawCodePoint(0xfdd0)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.unicodeAdmission),
);
decodeVector(
  "misplaced-token",
  "misplaced-member-name-holds-lone-low-surrogate-escape",
  jsonText`{"a":1 ${grammarFailsAt}"${jsonEscape(0xdc00)}${unicodeFailureEnds}":2}`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.unicodeAdmission),
);
decodeVector(
  "misplaced-token",
  "misplaced-number-negative-zero",
  jsonText`[1 ${grammarFailsAt}-0${numberEnds}]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.numberAdmission),
);
decodeVector(
  "misplaced-token",
  "misplaced-number-overflow",
  jsonText`{"a":1 ${grammarFailsAt}1e400${numberEnds}}`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.numberAdmission),
);
decodeVector(
  "misplaced-token",
  "misplaced-number-in-member-name-position",
  jsonText`{${grammarFailsAt}-0${numberEnds}:1}`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.numberAdmission),
);
decodeVector(
  "misplaced-token",
  "misplaced-string-crosses-string-bytes",
  jsonText`[1 ${grammarFailsAt}"ab${stringLimitCrossedBy("stringBytes")}"]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.limits),
  { limits: { stringBytes: 1 } },
);
decodeVector(
  "misplaced-token",
  "misplaced-string-crosses-total-string-bytes",
  jsonText`["a" ${grammarFailsAt}"b${stringLimitCrossedBy("totalStringBytes")}"]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.limits),
  { limits: { totalStringBytes: 1 } },
);
decodeVector(
  "misplaced-token",
  "misplaced-array-crosses-depth-inside",
  jsonText`[1 ${grammarFailsAt}[${depthLimitCrossedAt}[]]]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.limits),
  { limits: { depth: 2 }, note: outermostDepthNote },
);
decodeVector(
  "misplaced-token",
  "lone-high-surrogate-escape-before-misplaced-number",
  jsonText`["${jsonEscape(0xd800)}${unicodeFailureEnds}" ${grammarFailsAt}1]`,
  "UNICODE_INVALID",
  decodeRules(rules.unicodeAdmission, rules.exactDecoding),
);
decodeVector(
  "misplaced-token",
  "raw-noncharacter-before-misplaced-string",
  jsonText`["${rawCodePoint(0xffff)}${unicodeFailureEnds}" ${grammarFailsAt}"a"]`,
  "UNICODE_INVALID",
  decodeRules(rules.unicodeAdmission, rules.exactDecoding),
);
decodeVector(
  "misplaced-token",
  "negative-zero-before-misplaced-number",
  jsonText`[-0${numberEnds} ${grammarFailsAt}1]`,
  "NUMBER_INVALID",
  decodeRules(rules.numberAdmission, rules.exactDecoding),
);
decodeVector(
  "misplaced-token",
  "overflow-before-misplaced-member-name",
  jsonText`{"a":1e400${numberEnds} ${grammarFailsAt}"b":1}`,
  "NUMBER_INVALID",
  decodeRules(rules.numberAdmission, rules.exactDecoding),
);
decodeVector(
  "misplaced-token",
  "string-bytes-crossed-before-misplaced-number",
  jsonText`["ab${stringLimitCrossedBy("stringBytes")}" ${grammarFailsAt}1]`,
  "MODEL_RESOURCE_LIMIT",
  decodeRules(rules.limits, rules.exactDecoding),
  { limits: { stringBytes: 1 } },
);

// Group inadmissible-number: the number fails at the first byte after it, or
// at the input length when it ends the input.
const numberRules = decodeRules(rules.numberAdmission, rules.exactDecoding);
decodeVector(
  "inadmissible-number",
  "negative-zero-then-grammar-at-next-byte",
  jsonText`[-0${numberEnds}${grammarFailsAt}x]`,
  "JSON_SYNTAX",
  numberRules,
  { note: "Example in #failure-positions." },
);
decodeVector(
  "inadmissible-number",
  "overflow-then-grammar-at-next-byte",
  jsonText`[1e400${numberEnds}${grammarFailsAt}x]`,
  "JSON_SYNTAX",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-fraction-exponent-then-mismatched-bracket",
  jsonText`{"a":-0.0e0${numberEnds}${grammarFailsAt}]`,
  "JSON_SYNTAX",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-overflow-text-then-grammar-at-next-byte",
  jsonText`-1e400${numberEnds}${grammarFailsAt},`,
  "JSON_SYNTAX",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-then-space-then-grammar",
  jsonText`[-0${numberEnds} ${grammarFailsAt}x]`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "overflow-then-tab-then-grammar",
  jsonText`[1e400${numberEnds}${rawByte(0x09)}${grammarFailsAt}:]`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-exponent-then-line-feed-then-grammar",
  jsonText`{"a":-0E+5${numberEnds}${rawByte(0x0a)}${grammarFailsAt}]`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-overflow-text-then-space-then-grammar",
  jsonText`-1e400${numberEnds} ${grammarFailsAt}x`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-then-truncation",
  jsonText`[-0${numberEnds}${grammarFailsAt}`,
  "JSON_SYNTAX",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "overflow-then-truncation",
  jsonText`{"a":1e400${numberEnds}${grammarFailsAt}`,
  "JSON_SYNTAX",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-then-space-then-truncation",
  jsonText`[-0${numberEnds} ${grammarFailsAt}`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "overflow-then-line-feed-then-truncation",
  jsonText`{"a":1e400${numberEnds}${rawByte(0x0a)}${grammarFailsAt}`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-text",
  jsonText`-0${numberEnds}`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "overflow-text",
  jsonText`1e400${numberEnds}`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-fraction-exponent-text",
  jsonText`-0.0e0${numberEnds}`,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "underflow-to-negative-zero-text",
  jsonText`-1e-400${numberEnds}`,
  "NUMBER_INVALID",
  numberRules,
  {
    note: "The binary64 value of -1e-400 is negative zero under round-to-nearest.",
  },
);
decodeVector(
  "inadmissible-number",
  "negative-zero-text-with-trailing-space",
  jsonText`-0${numberEnds} `,
  "NUMBER_INVALID",
  numberRules,
);
decodeVector(
  "inadmissible-number",
  "negative-zero-in-complete-array",
  jsonText`[-0${numberEnds}]`,
  "NUMBER_INVALID",
  numberRules,
  { note: "Example in #failure-positions." },
);

// Group prohibited-code-point: a prohibited code point and a grammar failure
// in the same string, in both orders.
const codePointRules = decodeRules(rules.unicodeAdmission, rules.exactDecoding);
const grammarFirstRules = decodeRules(
  rules.exactDecoding,
  rules.unicodeAdmission,
);
decodeVector(
  "prohibited-code-point",
  "lone-high-surrogate-escape-then-invalid-escape",
  jsonText`{"a":"${jsonEscape(0xd800)}${unicodeFailureEnds}${invalidEscapeX}"}`,
  "UNICODE_INVALID",
  codePointRules,
  { note: "Example in #failure-positions." },
);
decodeVector(
  "prohibited-code-point",
  "lone-high-surrogate-escape-then-raw-control",
  jsonText`["${jsonEscape(0xdbff)}${unicodeFailureEnds}${grammarFailsAt}${rawByte(0x01)}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "lone-high-surrogate-escape-then-truncation",
  jsonText`{"${jsonEscape(0xd83d)}${unicodeFailureEnds}${grammarFailsAt}`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "lone-low-surrogate-escape-then-invalid-escape",
  jsonText`["${jsonEscape(0xdc00)}${unicodeFailureEnds}${invalidEscapeA}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "lone-low-surrogate-escape-then-raw-control",
  jsonText`["${jsonEscape(0xdfff)}${unicodeFailureEnds}${grammarFailsAt}${rawByte(0x0a)}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "lone-low-surrogate-escape-then-truncation",
  jsonText`["${jsonEscape(0xde00)}${unicodeFailureEnds}${grammarFailsAt}`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "escaped-pair-noncharacter-then-invalid-escape",
  jsonText`["${jsonEscape(0xd83f, 0xdffe)}${unicodeFailureEnds}${invalidEscapeX}"]`,
  "UNICODE_INVALID",
  codePointRules,
  { note: "The escaped pair denotes U+1FFFE." },
);
decodeVector(
  "prohibited-code-point",
  "escaped-pair-noncharacter-then-raw-control",
  jsonText`["${jsonEscape(0xdbff, 0xdfff)}${unicodeFailureEnds}${grammarFailsAt}${rawByte(0x1f)}"]`,
  "UNICODE_INVALID",
  codePointRules,
  { note: "The escaped pair denotes U+10FFFF." },
);
decodeVector(
  "prohibited-code-point",
  "escaped-pair-noncharacter-then-truncation",
  jsonText`{"${jsonEscape(0xd87f, 0xdfff)}${unicodeFailureEnds}${grammarFailsAt}`,
  "UNICODE_INVALID",
  codePointRules,
  { note: "The escaped pair denotes U+2FFFF." },
);
decodeVector(
  "prohibited-code-point",
  "escaped-noncharacter-then-invalid-escape",
  jsonText`["${jsonEscape(0xfdd0)}${unicodeFailureEnds}${invalidEscapeX}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "escaped-noncharacter-then-raw-control",
  jsonText`["${jsonEscape(0xfffe)}${unicodeFailureEnds}${grammarFailsAt}${rawByte(0x01)}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "escaped-noncharacter-then-truncation",
  jsonText`["${jsonEscapeUppercase(0xfdef)}${unicodeFailureEnds}${grammarFailsAt}`,
  "UNICODE_INVALID",
  codePointRules,
  { note: "The escape uses uppercase hexadecimal digits." },
);
decodeVector(
  "prohibited-code-point",
  "raw-three-byte-noncharacter-then-invalid-escape",
  jsonText`["${rawCodePoint(0xfdef)}${unicodeFailureEnds}${invalidEscapeX}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-three-byte-noncharacter-then-raw-control",
  jsonText`["${rawCodePoint(0xfffe)}${unicodeFailureEnds}${grammarFailsAt}${rawByte(0x0a)}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-three-byte-noncharacter-then-truncation",
  jsonText`{"${rawCodePoint(0xffff)}${unicodeFailureEnds}${grammarFailsAt}`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-four-byte-noncharacter-then-invalid-escape",
  jsonText`["${rawCodePoint(0x1ffff)}${unicodeFailureEnds}${invalidEscapeX}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-four-byte-noncharacter-then-raw-control",
  jsonText`["${rawCodePoint(0x10fffe)}${unicodeFailureEnds}${grammarFailsAt}${rawByte(0x1f)}"]`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-four-byte-noncharacter-then-truncation",
  jsonText`["${rawCodePoint(0x3fffe)}${unicodeFailureEnds}${grammarFailsAt}`,
  "UNICODE_INVALID",
  codePointRules,
);
decodeVector(
  "prohibited-code-point",
  "invalid-escape-then-lone-high-surrogate-escape",
  jsonText`["${invalidEscapeX}${jsonEscape(0xd800)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-control-then-lone-high-surrogate-escape",
  jsonText`["${grammarFailsAt}${rawByte(0x01)}${jsonEscape(0xdbff)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "invalid-escape-then-lone-low-surrogate-escape",
  jsonText`["${invalidEscapeA}${jsonEscape(0xdc00)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-control-then-lone-low-surrogate-escape",
  jsonText`["${grammarFailsAt}${rawByte(0x0a)}${jsonEscape(0xdfff)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "invalid-escape-then-escaped-pair-noncharacter",
  jsonText`["${invalidEscapeX}${jsonEscape(0xd83f, 0xdffe)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
  { note: "The escaped pair denotes U+1FFFE." },
);
decodeVector(
  "prohibited-code-point",
  "raw-control-then-escaped-pair-noncharacter",
  jsonText`["${grammarFailsAt}${rawByte(0x1f)}${jsonEscape(0xdbff, 0xdfff)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
  { note: "The escaped pair denotes U+10FFFF." },
);
decodeVector(
  "prohibited-code-point",
  "invalid-escape-then-escaped-noncharacter",
  jsonText`{"${invalidEscapeX}${jsonEscape(0xfdd0)}${unicodeFailureEnds}":1}`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-control-then-escaped-noncharacter",
  jsonText`["${grammarFailsAt}${rawByte(0x01)}${jsonEscape(0xffff)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "invalid-escape-then-raw-three-byte-noncharacter",
  jsonText`["${invalidEscapeX}${rawCodePoint(0xfdd0)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-control-then-raw-three-byte-noncharacter",
  jsonText`["${grammarFailsAt}${rawByte(0x0a)}${rawCodePoint(0xfffe)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "invalid-escape-then-raw-four-byte-noncharacter",
  jsonText`["${invalidEscapeX}${rawCodePoint(0x1fffe)}${unicodeFailureEnds}"]`,
  "JSON_SYNTAX",
  grammarFirstRules,
);
decodeVector(
  "prohibited-code-point",
  "raw-control-then-raw-four-byte-noncharacter",
  jsonText`{"${grammarFailsAt}${rawByte(0x1f)}${rawCodePoint(0x10ffff)}${unicodeFailureEnds}":1}`,
  "JSON_SYNTAX",
  grammarFirstRules,
);

// Group string-limit: a noncharacter before a crossing in a later string; a
// crossing before a noncharacter, in values and member names; and
// noncharacters that would cross a limit only if they were counted. #limits
// makes a code point that is not Unicode-valid fail before it is counted. The
// first derivation built ten of these vectors when a noncharacter counted its
// UTF-8 bytes, so their crossings are marked as crossingIfCounted; their ids,
// inputs, options and expected errors are unchanged.
const stringLimitRules = decodeRules(
  rules.unicodeAdmission,
  rules.exactDecoding,
  rules.limits,
);
const limitFirstRules = decodeRules(
  rules.limits,
  rules.unicodeAdmission,
  rules.exactDecoding,
);
decodeVector(
  "string-limit",
  "string-bytes-crossed-after-escaped-noncharacter",
  jsonText`["${jsonEscape(0xfffe)}${unicodeFailureEnds}ab${crossingIfCounted("stringBytes")}cd"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 4 } },
);
decodeVector(
  "string-limit",
  "string-bytes-crossed-after-raw-noncharacter",
  jsonText`["${rawCodePoint(0xfdd0)}${unicodeFailureEnds}a${crossingIfCounted("stringBytes")}b"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "string-bytes-crossed-in-member-name-after-escaped-noncharacter",
  jsonText`{"${jsonEscape(0xfdd0)}${unicodeFailureEnds}a${crossingIfCounted("stringBytes")}":1}`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "string-bytes-crossed-in-value-after-member-name-noncharacter",
  jsonText`{"${jsonEscape(0xffff)}${unicodeFailureEnds}":"abcd${stringLimitCrossedBy("stringBytes")}"}`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "total-string-bytes-crossed-after-escaped-noncharacter",
  jsonText`["${jsonEscape(0xffff)}${unicodeFailureEnds}","a${crossingIfCounted("totalStringBytes")}"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { totalStringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "total-string-bytes-crossed-after-raw-noncharacter",
  jsonText`["${rawCodePoint(0x10ffff)}${unicodeFailureEnds}","a${crossingIfCounted("totalStringBytes")}"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { totalStringBytes: 4 } },
);
decodeVector(
  "string-limit",
  "total-string-bytes-crossed-after-member-name-noncharacter",
  jsonText`{"${jsonEscape(0xfdef)}${unicodeFailureEnds}":"a${crossingIfCounted("totalStringBytes")}"}`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { totalStringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "string-bytes-tie-escaped-noncharacter",
  jsonText`["${jsonEscape(0xffff)}${unicodeFailureEnds}${crossingIfCounted("stringBytes")}"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 2 } },
);
decodeVector(
  "string-limit",
  "string-bytes-tie-raw-four-byte-noncharacter",
  jsonText`["${rawCodePoint(0x1fffe)}${unicodeFailureEnds}${crossingIfCounted("stringBytes")}"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "string-bytes-tie-member-name-raw-noncharacter",
  jsonText`{"${rawCodePoint(0xfffe)}${unicodeFailureEnds}${crossingIfCounted("stringBytes")}":1}`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { stringBytes: 2 } },
);
decodeVector(
  "string-limit",
  "total-string-bytes-tie-escaped-noncharacter",
  jsonText`["a","${jsonEscape(0xfdd0)}${unicodeFailureEnds}${crossingIfCounted("totalStringBytes")}"]`,
  "UNICODE_INVALID",
  stringLimitRules,
  { limits: { totalStringBytes: 3 } },
);
decodeVector(
  "string-limit",
  "string-bytes-crossed-before-escaped-noncharacter",
  jsonText`["ab${stringLimitCrossedBy("stringBytes")}${jsonEscape(0xfffe)}${unicodeFailureEnds}"]`,
  "MODEL_RESOURCE_LIMIT",
  limitFirstRules,
  { limits: { stringBytes: 1 } },
);
decodeVector(
  "string-limit",
  "string-bytes-crossed-in-member-name-before-raw-noncharacter",
  jsonText`{"ab${stringLimitCrossedBy("stringBytes")}${rawCodePoint(0xffff)}${unicodeFailureEnds}":1}`,
  "MODEL_RESOURCE_LIMIT",
  limitFirstRules,
  { limits: { stringBytes: 1 }, note: memberNamesNote("stringBytes") },
);
decodeVector(
  "string-limit",
  "total-string-bytes-crossed-before-escaped-noncharacter",
  jsonText`["a","b${stringLimitCrossedBy("totalStringBytes")}${jsonEscape(0xfffe)}${unicodeFailureEnds}"]`,
  "MODEL_RESOURCE_LIMIT",
  limitFirstRules,
  { limits: { totalStringBytes: 1 } },
);
decodeVector(
  "string-limit",
  "total-string-bytes-crossed-after-member-name-before-noncharacter",
  jsonText`{"a":"b${stringLimitCrossedBy("totalStringBytes")}${jsonEscape(0xfffe)}${unicodeFailureEnds}"}`,
  "MODEL_RESOURCE_LIMIT",
  limitFirstRules,
  {
    limits: { totalStringBytes: 1 },
    note: memberNamesNote("totalStringBytes"),
  },
);

// Group nesting-limit-tie: a misplaced opening bracket is the first byte that
// cannot continue the text; if it also takes the depth past the limit, the
// grammar failure comes first in the tie order. A crossing before a grammar
// failure comes first.
const depthRules = decodeRules(rules.exactDecoding, rules.limits);
decodeVector(
  "nesting-limit-tie",
  "depth-tie-misplaced-array-after-value",
  jsonText`[1 ${grammarFailsAt}${depthLimitCrossedAt}[]]`,
  "JSON_SYNTAX",
  depthRules,
  { limits: { depth: 1 }, note: outermostDepthNote },
);
decodeVector(
  "nesting-limit-tie",
  "depth-tie-misplaced-array-in-member-name-position",
  jsonText`{${grammarFailsAt}${depthLimitCrossedAt}[]}`,
  "JSON_SYNTAX",
  depthRules,
  { limits: { depth: 1 }, note: outermostDepthNote },
);
decodeVector(
  "nesting-limit-tie",
  "depth-tie-misplaced-object-after-member-name",
  jsonText`{"a"${grammarFailsAt}${depthLimitCrossedAt}{}}`,
  "JSON_SYNTAX",
  depthRules,
  { limits: { depth: 1 }, note: outermostDepthNote },
);
decodeVector(
  "nesting-limit-tie",
  "depth-tie-misplaced-object-at-second-level",
  jsonText`[[1 ${grammarFailsAt}${depthLimitCrossedAt}{}]]`,
  "JSON_SYNTAX",
  depthRules,
  { limits: { depth: 2 }, note: outermostDepthNote },
);
decodeVector(
  "nesting-limit-tie",
  "depth-tie-misplaced-array-after-negative-zero",
  jsonText`[-0${numberEnds}${grammarFailsAt}${depthLimitCrossedAt}[]]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.numberAdmission, rules.limits),
  { limits: { depth: 1 }, note: outermostDepthNote },
);
decodeVector(
  "nesting-limit-tie",
  "depth-grammar-before-crossing",
  jsonText`[${grammarFailsAt}x${depthLimitCrossedAt}[]]`,
  "JSON_SYNTAX",
  depthRules,
  { limits: { depth: 1 }, note: outermostDepthNote },
);
decodeVector(
  "nesting-limit-tie",
  "depth-crossed-before-grammar",
  jsonText`[${depthLimitCrossedAt}[[]]${grammarFailsAt}x]`,
  "MODEL_RESOURCE_LIMIT",
  decodeRules(rules.limits, rules.exactDecoding),
  { limits: { depth: 1 }, note: outermostDepthNote },
);

// Group duplicate-member-name: a repeated name fails at its closing quotation
// mark, after escape processing and within one object only.
const duplicateRules = decodeRules(rules.duplicateMembers, rules.exactDecoding);
decodeVector(
  "duplicate-member-name",
  "repeated-name-then-later-grammar",
  jsonText`{"a":1,"a${repeatedNameClosesAt}":2${grammarFailsAt}]`,
  "JSON_DUPLICATE_MEMBER",
  duplicateRules,
);
decodeVector(
  "duplicate-member-name",
  "repeated-name-then-grammar-at-next-byte",
  jsonText`{"a":1,"a${repeatedNameClosesAt}"${grammarFailsAt}]`,
  "JSON_DUPLICATE_MEMBER",
  duplicateRules,
);
decodeVector(
  "duplicate-member-name",
  "repeated-name-then-truncation",
  jsonText`{"a":1,"a${repeatedNameClosesAt}"${grammarFailsAt}`,
  "JSON_DUPLICATE_MEMBER",
  duplicateRules,
);
decodeVector(
  "duplicate-member-name",
  "repeated-name-escaped-spelling-equal-value-then-grammar",
  jsonText`{"a":1,"${jsonEscape(0x0061)}${repeatedNameClosesAt}":1 ${grammarFailsAt}x}`,
  "JSON_DUPLICATE_MEMBER",
  duplicateRules,
  { note: "The repeated name is spelled as the escape of U+0061." },
);
decodeVector(
  "duplicate-member-name",
  "grammar-before-repeated-name",
  jsonText`{"a":1,"b":${grammarFailsAt}x,"a${repeatedNameClosesAt}":2}`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.duplicateMembers),
);
decodeVector(
  "duplicate-member-name",
  "same-name-in-sibling-objects-then-grammar",
  jsonText`[{"a":1},{"a":2}${grammarFailsAt}x]`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.duplicateMembers),
);
decodeVector(
  "duplicate-member-name",
  "same-name-in-nested-object-then-grammar",
  jsonText`{"a":{"a":1}${grammarFailsAt}x}`,
  "JSON_SYNTAX",
  decodeRules(rules.exactDecoding, rules.duplicateMembers),
);
decodeVector(
  "duplicate-member-name",
  "total-string-bytes-crossed-inside-repeated-name",
  jsonText`{"ab":1,"a${stringLimitCrossedBy("totalStringBytes")}b${repeatedNameClosesAt}":2}`,
  "MODEL_RESOURCE_LIMIT",
  decodeRules(rules.limits, rules.duplicateMembers, rules.exactDecoding),
  {
    limits: { totalStringBytes: 2 },
    note: memberNamesNote("totalStringBytes"),
  },
);

// ---------------------------------------------------------------------------
// decode consistency checks.
const vectorIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// #limits: a caller may override a limit with a positive safe integer or
// Infinity. JSON options cannot carry Infinity, so the options here are
// positive safe integers.
function assertLimitOptions(id, limits) {
  if (limits === undefined) return;
  for (const [limit, maximum] of Object.entries(limits)) {
    assert(errorCodeByLimit.has(limit), `${id}: unsupported limit ${limit}`);
    assert(
      Number.isSafeInteger(maximum) && maximum >= 1,
      `${id}: ${limit} outside the override domain of #limits`,
    );
  }
}

const failureText = (entry) => `${failureLabel(entry)} at ${entry.byteOffset}`;
for (const vector of decodeVectors) {
  assert.match(vector.id, vectorIdPattern);
  assertLimitOptions(vector.id, vector.limits);
  const limits = vector.limits ?? {};
  const markedFirst = firstFailure(vector.failurePositions);
  assert(markedFirst, `${vector.id}: no failure marked`);
  assert.equal(
    errorCodeOf(markedFirst),
    vector.expectedError,
    `${vector.id}: expected error does not follow from the marked positions`,
  );
  const traced = traceStageThree(vector.inputBytes, limits);
  const tracedFirst = firstFailure(traced);
  assert(
    tracedFirst && sameFailure(tracedFirst, markedFirst),
    `${vector.id}: traced first failure ${JSON.stringify(tracedFirst)} differs from marked ${JSON.stringify(markedFirst)}`,
  );
  // Every traced failure is marked, and every marked failure before the first
  // grammar failure is traced. The tracer stops at that failure, so a marked
  // position at or after it is where a failure would lie if the text went on.
  for (const tracedFailure of traced)
    assert(
      vector.failurePositions.some((marked) =>
        sameFailure(marked, tracedFailure),
      ),
      `${vector.id}: traced ${failureText(tracedFailure)} is not marked`,
    );
  const grammarStop =
    traced.find((entry) => entry.failure === "json-grammar")?.byteOffset ??
    Infinity;
  for (const marked of vector.failurePositions)
    if (marked.byteOffset < grammarStop)
      assert(
        traced.some((tracedFailure) => sameFailure(tracedFailure, marked)),
        `${vector.id}: marked ${failureText(marked)} is not traced`,
      );
  // Counting noncharacters adds exactly the crossings marked crossingIfCounted.
  const tracedCounting = traceStageThree(vector.inputBytes, limits, {
    countNoncharacters: true,
  });
  assert(
    traced.every((entry) =>
      tracedCounting.some((counted) => sameFailure(counted, entry)),
    ),
    `${vector.id}: counting noncharacters loses a traced failure`,
  );
  assert.deepEqual(
    tracedCounting
      .filter((counted) => !traced.some((entry) => sameFailure(entry, counted)))
      .map(({ failure, limit, byteOffset }) => ({ failure, limit, byteOffset })),
    vector.crossingsIfCounted.map(({ limit, byteOffset }) => ({
      failure: "lexical-limit",
      limit,
      byteOffset,
    })),
    `${vector.id}: the crossings marked crossingIfCounted differ from those that counting noncharacters adds`,
  );
}

// ---------------------------------------------------------------------------
// canonicalize vectors: in-memory sources for the structural-content profile.
// Each source is ordinary JSON text; parsing it with an ordinary JSON parser
// yields the in-memory source, in which its escapes become lone surrogates or
// noncharacters and -0 becomes negative zero.
const emptyStructural = () => ({
  constructs: [],
  expressions: [],
  occurrences: [],
  ontology: { annotations: [], imports: [] },
  roles: [],
  subjects: [],
});
// Closed member sets of #envelope (source envelope and structural record).
const closedMemberSets = new Map([
  ["", new Set(["structural", "visualization"])],
  [
    "/structural",
    new Set([
      "constructs",
      "expressions",
      "occurrences",
      "ontology",
      "roles",
      "subjects",
    ]),
  ],
]);
// JSON types of the members that the vectors mistype (#envelope, #ontology,
// #subjects-and-roles, #notation).
const declaredJsonTypes = new Map([
  ["/structural/constructs", "array"],
  ["/structural/subjects", "array"],
  ["/structural/ontology/iri", "string"],
  ["/structural/subjects/0/iri", "string"],
]);

const jsonTypeOf = (node) =>
  node === null ? "null" : Array.isArray(node) ? "array" : typeof node;
const codePointNotation = (codePoint) =>
  `<U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}>`;
function locationText(tokens) {
  return tokens
    .map((token) => {
      let text = "";
      for (const character of String(token)) {
        const codePoint = character.codePointAt(0);
        text +=
          isSurrogate(codePoint) ||
          isNoncharacter(codePoint) ||
          codePoint < 0x20 ||
          codePoint > 0x7e
            ? codePointNotation(codePoint)
            : character.replaceAll("~", "~0").replaceAll("/", "~1");
      }
      return `/${text}`;
    })
    .join("");
}
const plainPointer = (tokens) => tokens.map((token) => `/${token}`).join("");
function compareMemberOrder(leftTokens, rightTokens) {
  for (let index = 0; index < leftTokens.length; index += 1) {
    if (index >= rightTokens.length) return 1;
    const left = leftTokens[index];
    const right = rightTokens[index];
    if (left === right) continue;
    if (typeof left === "number" && typeof right === "number")
      return left - right;
    assert(typeof left === "string" && typeof right === "string");
    return left < right ? -1 : 1;
  }
  return leftTokens.length === rightTokens.length ? 0 : -1;
}
function unicodeFailureIn(text) {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (isSurrogate(codePoint) || isNoncharacter(codePoint)) return true;
  }
  return false;
}
function snapshotFailuresOf(node, tokens = []) {
  const found = [];
  if (typeof node === "string") {
    if (unicodeFailureIn(node))
      found.push({ tokens, failure: "unicode-validity" });
  } else if (typeof node === "number") {
    if (!Number.isFinite(node) || Object.is(node, -0))
      found.push({ tokens, failure: "number-admission" });
  } else if (Array.isArray(node)) {
    node.forEach((element, index) =>
      found.push(...snapshotFailuresOf(element, [...tokens, index])),
    );
  } else if (node !== null && typeof node === "object") {
    for (const [memberName, memberNode] of Object.entries(node)) {
      if (unicodeFailureIn(memberName))
        found.push({
          tokens: [...tokens, memberName],
          failure: "unicode-validity",
        });
      found.push(...snapshotFailuresOf(memberNode, [...tokens, memberName]));
    }
  }
  return found;
}
function nodeAt(root, tokens) {
  let node = root;
  for (const token of tokens) {
    assert(node !== null && typeof node === "object");
    assert(Object.hasOwn(node, token), `No member at ${locationText(tokens)}`);
    node = node[token];
  }
  return node;
}
// JSON text in the layout of JSON.stringify(value, null, 2), with every code
// unit outside printable ASCII written as an escape and negative zero as -0.
function sourceText(node, indentation = "") {
  if (typeof node === "number") {
    assert(Number.isFinite(node));
    return Object.is(node, -0) ? "-0" : JSON.stringify(node);
  }
  if (typeof node === "boolean" || node === null) return JSON.stringify(node);
  if (typeof node === "string") {
    let text = '"';
    for (let index = 0; index < node.length; index += 1) {
      const codeUnit = node.charCodeAt(index);
      if (codeUnit === 0x22 || codeUnit === 0x5c)
        text += backslash + node[index];
      else if (codeUnit >= 0x20 && codeUnit <= 0x7e) text += node[index];
      else text += jsonEscape(codeUnit);
    }
    return `${text}"`;
  }
  const inner = `${indentation}  `;
  if (Array.isArray(node))
    return node.length === 0
      ? "[]"
      : `[\n${node.map((element) => inner + sourceText(element, inner)).join(",\n")}\n${indentation}]`;
  const memberNames = Object.keys(node);
  return memberNames.length === 0
    ? "{}"
    : `{\n${memberNames.map((memberName) => `${inner}${sourceText(memberName)}: ${sourceText(node[memberName], inner)}`).join(",\n")}\n${indentation}}`;
}

const canonicalizeVectors = [];
function canonicalizeVector(
  id,
  source,
  snapshotFailure,
  competingFailures,
  expectedError,
  citedRules,
  note,
) {
  assert.match(id, vectorIdPattern);
  const sourceBytes = Buffer.from(`${sourceText(source)}\n`, "utf8");
  assert(/^[\x00-\x7f]*$/.test(sourceBytes.toString("latin1")));
  const parsedSource = JSON.parse(sourceBytes.toString("utf8"));
  assert.deepStrictEqual(parsedSource, source, `${id}: source text round trip`);
  const found = snapshotFailuresOf(parsedSource);
  assert.equal(found.length, 1, `${id}: exactly one snapshot failure`);
  assert.deepStrictEqual(found[0], snapshotFailure, `${id}: snapshot failure`);
  assert.equal(
    errorCodeByFailure.get(snapshotFailure.failure),
    expectedError,
    `${id}: expected error`,
  );
  const competing = competingFailures.map(({ tokens, failure }) => {
    const order = compareMemberOrder(tokens, snapshotFailure.tokens);
    if (failure === "unknown-member") {
      const parent = plainPointer(tokens.slice(0, -1));
      assert(closedMemberSets.has(parent), `${id}: closed set for ${parent}`);
      assert(!closedMemberSets.get(parent).has(tokens.at(-1)));
      nodeAt(parsedSource, tokens);
    } else if (failure === "mistyped-member") {
      const declared = declaredJsonTypes.get(plainPointer(tokens));
      assert(declared, `${id}: declared type for ${locationText(tokens)}`);
      assert.notEqual(jsonTypeOf(nodeAt(parsedSource, tokens)), declared);
    } else {
      assert.equal(failure, "iri-scalar-domain");
      assert(unicodeFailureIn(nodeAt(parsedSource, tokens)));
    }
    return {
      location: locationText(tokens),
      failure,
      memberOrder: order < 0 ? "before" : order === 0 ? "same" : "after",
    };
  });
  canonicalizeVectors.push({
    id,
    sourceBytes,
    expectedError,
    citedRules,
    snapshotFailure: {
      location: locationText(snapshotFailure.tokens),
      failure: snapshotFailure.failure,
    },
    competingFailures: competing,
    note,
  });
}

// #canonical-profiles is cited because it is the source of the profile value.
const snapshotRules = (scalarRule, recordRule) => [
  ...new Set([
    rules.inMemoryInput,
    rules.validationOrder,
    scalarRule,
    rules.notation,
    rules.envelope,
    recordRule,
    rules.canonicalProfiles,
  ]),
];
const numberSlotNote =
  "The structural-content profile has no Number field, so the negative zero occupies a string-typed field; that type failure is a later stage-4 check.";
const loneHighSurrogate = codeUnitText(0xd800);
const otherLoneHighSurrogate = codeUnitText(0xdbff);
const loneLowSurrogate = codeUnitText(0xdc00);
const otherLoneLowSurrogate = codeUnitText(0xdfff);
const noncharacterFffe = codeUnitText(0xfffe);

canonicalizeVector(
  "snapshot-unicode-after-unknown-member",
  {
    structural: {
      aaa: true,
      ...emptyStructural(),
      subjects: [{ id: "s", iri: `urn:example:${loneHighSurrogate}` }],
    },
  },
  { tokens: ["structural", "subjects", 0, "iri"], failure: "unicode-validity" },
  [
    { tokens: ["structural", "aaa"], failure: "unknown-member" },
    {
      tokens: ["structural", "subjects", 0, "iri"],
      failure: "iri-scalar-domain",
    },
  ],
  "UNICODE_INVALID",
  snapshotRules(rules.unicodeAdmission, rules.subjectsAndRoles),
  "Example in #in-memory-input.",
);
canonicalizeVector(
  "snapshot-unicode-after-mistyped-member",
  {
    structural: {
      ...emptyStructural(),
      constructs: {},
      subjects: [{ id: "s", iri: `urn:example:${otherLoneHighSurrogate}` }],
    },
  },
  { tokens: ["structural", "subjects", 0, "iri"], failure: "unicode-validity" },
  [
    { tokens: ["structural", "constructs"], failure: "mistyped-member" },
    {
      tokens: ["structural", "subjects", 0, "iri"],
      failure: "iri-scalar-domain",
    },
  ],
  "UNICODE_INVALID",
  snapshotRules(rules.unicodeAdmission, rules.subjectsAndRoles),
);
canonicalizeVector(
  "snapshot-number-after-unknown-member",
  {
    structural: {
      aaa: true,
      ...emptyStructural(),
      subjects: [{ id: "s", iri: -0 }],
    },
  },
  { tokens: ["structural", "subjects", 0, "iri"], failure: "number-admission" },
  [
    { tokens: ["structural", "aaa"], failure: "unknown-member" },
    { tokens: ["structural", "subjects", 0, "iri"], failure: "mistyped-member" },
  ],
  "NUMBER_INVALID",
  snapshotRules(rules.numberAdmission, rules.subjectsAndRoles),
  numberSlotNote,
);
canonicalizeVector(
  "snapshot-number-after-mistyped-member",
  {
    structural: {
      ...emptyStructural(),
      constructs: {},
      subjects: [{ id: "s", iri: -0 }],
    },
  },
  { tokens: ["structural", "subjects", 0, "iri"], failure: "number-admission" },
  [
    { tokens: ["structural", "constructs"], failure: "mistyped-member" },
    { tokens: ["structural", "subjects", 0, "iri"], failure: "mistyped-member" },
  ],
  "NUMBER_INVALID",
  snapshotRules(rules.numberAdmission, rules.subjectsAndRoles),
  numberSlotNote,
);
canonicalizeVector(
  "snapshot-member-name-lone-surrogate",
  { structural: { ...emptyStructural(), [loneLowSurrogate]: true } },
  { tokens: ["structural", loneLowSurrogate], failure: "unicode-validity" },
  [{ tokens: ["structural", loneLowSurrogate], failure: "unknown-member" }],
  "UNICODE_INVALID",
  snapshotRules(rules.unicodeAdmission, rules.envelope),
);
canonicalizeVector(
  "snapshot-member-name-noncharacter-after-unknown-member",
  { aaa: true, structural: emptyStructural(), [noncharacterFffe]: true },
  { tokens: [noncharacterFffe], failure: "unicode-validity" },
  [
    { tokens: ["aaa"], failure: "unknown-member" },
    { tokens: [noncharacterFffe], failure: "unknown-member" },
  ],
  "UNICODE_INVALID",
  snapshotRules(rules.unicodeAdmission, rules.envelope),
);
canonicalizeVector(
  "snapshot-unicode-before-later-mistyped-member",
  {
    structural: {
      ...emptyStructural(),
      ontology: {
        annotations: [],
        imports: [],
        iri: `urn:example:${otherLoneLowSurrogate}`,
      },
      subjects: {},
    },
  },
  { tokens: ["structural", "ontology", "iri"], failure: "unicode-validity" },
  [
    { tokens: ["structural", "ontology", "iri"], failure: "iri-scalar-domain" },
    { tokens: ["structural", "subjects"], failure: "mistyped-member" },
  ],
  "UNICODE_INVALID",
  snapshotRules(rules.unicodeAdmission, rules.ontology),
);
canonicalizeVector(
  "snapshot-number-before-later-unknown-member",
  {
    structural: {
      ...emptyStructural(),
      ontology: { annotations: [], imports: [], iri: -0 },
      zzz: true,
    },
  },
  { tokens: ["structural", "ontology", "iri"], failure: "number-admission" },
  [
    { tokens: ["structural", "ontology", "iri"], failure: "mistyped-member" },
    { tokens: ["structural", "zzz"], failure: "unknown-member" },
  ],
  "NUMBER_INVALID",
  snapshotRules(rules.numberAdmission, rules.ontology),
  numberSlotNote,
);

// ---------------------------------------------------------------------------
// Rationale text, derived from the recorded positions.
function decodeRationale(failurePositions, inputLength) {
  const [first, ...others] = failurePositions;
  const at = (entry) =>
    `byte ${entry.byteOffset}${entry.byteOffset === inputLength ? " (end of input)" : ""}`;
  const tied = others.filter((entry) => entry.byteOffset === first.byteOffset);
  const later = others.filter((entry) => entry.byteOffset > first.byteOffset);
  let rationale = `First failure: ${failureLabel(first)} at ${at(first)}`;
  if (tied.length > 0)
    rationale += `, which shares that byte with ${tied.map(failureLabel).join(" and ")} and comes first in the tie order`;
  rationale += ".";
  if (later.length > 0)
    rationale += ` Later: ${later.map((entry) => `${failureLabel(entry)} at ${at(entry)}`).join(", ")}.`;
  return rationale;
}
function canonicalizeRationale(vector) {
  const before = vector.competingFailures.filter(
    (entry) => entry.memberOrder !== "after",
  );
  const listed = before
    .map((entry) => `${entry.failure} at ${entry.location}`)
    .join(" and ");
  const verb = before.length > 1 ? "do" : "does";
  return `The snapshot's ${vector.snapshotFailure.failure} check at ${vector.snapshotFailure.location} is reported at the start of stage 4, before closed field sets and scalar domains${listed ? `, so ${listed} ${verb} not decide the error` : ""}.`;
}

// The pinned sections are exactly the sections that the vectors cite.
const citedSectionIds = new Set(
  [...decodeVectors, ...canonicalizeVectors].flatMap((vector) =>
    vector.citedRules
      .filter((rule) => rule.startsWith("#"))
      .map((rule) => rule.slice(1)),
  ),
);
assert.deepEqual(
  [...citedSectionIds].sort(),
  specification.sections.map((pin) => pin.id).sort(),
  "every cited section is pinned, and every pinned section is cited",
);

// ---------------------------------------------------------------------------
// Files. Nothing is written unless --write-new is given, and an existing file
// is never replaced.
const vectorFileNames = new Map();
async function pinFile(relativePath, fileBytes) {
  const target = resolve(supplementDirectory, relativePath);
  if (writeMissingFiles) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, fileBytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  let existingBytes;
  try {
    existingBytes = await readFile(target);
  } catch (error) {
    if (error.code === "ENOENT")
      assert.fail(
        `${relativePath}: missing; run with --write-new to create missing files`,
      );
    throw error;
  }
  assert(
    existingBytes.equals(fileBytes),
    `${relativePath}: differs from this script's derivation; existing files are never overwritten`,
  );
  return {
    path: `${supplementMember}/${relativePath}`,
    sha256: sha256Hex(fileBytes),
    byteLength: fileBytes.length,
  };
}

// Every vector input is a file directly in vectors/, named by the vector id:
// <id>.bin for decode bytes and <id>.json for canonicalize sources.
const manifestVectors = [];
for (const vector of decodeVectors) {
  vectorFileNames.set(vector.id, `${vector.id}.bin`);
  manifestVectors.push({
    id: vector.id,
    operation: "decode",
    options: vector.limits === undefined ? {} : { limits: vector.limits },
    expectedError: vector.expectedError,
    coverageGroup: vector.coverageGroup,
    rules: vector.citedRules,
    failurePositions: vector.failurePositions,
    rationale: decodeRationale(
      vector.failurePositions,
      vector.inputBytes.length,
    ),
    ...(vector.note === undefined ? {} : { note: vector.note }),
    status: vectorStatus,
    input: await pinFile(`vectors/${vector.id}.bin`, vector.inputBytes),
  });
}
for (const vector of canonicalizeVectors) {
  vectorFileNames.set(vector.id, `${vector.id}.json`);
  manifestVectors.push({
    id: vector.id,
    operation: "canonicalize",
    profile: structuralContentProfile,
    options: {},
    expectedError: vector.expectedError,
    coverageGroup: "in-memory-snapshot",
    rules: vector.citedRules,
    snapshotFailure: vector.snapshotFailure,
    competingFailures: vector.competingFailures,
    rationale: canonicalizeRationale(vector),
    ...(vector.note === undefined ? {} : { note: vector.note }),
    status: vectorStatus,
    input: await pinFile(`vectors/${vector.id}.json`, vector.sourceBytes),
  });
}
assert.equal(
  new Set(manifestVectors.map((vector) => vector.id)).size,
  manifestVectors.length,
  "vector ids are unique",
);
// The questions recorded as open, five by the first derivation and the last by
// this revision, and the sections that now settle them. formerlyOmitted names
// the cases that the first derivation omitted because of each question; every
// one is now a vector. The last question, whether a noncharacter counts toward
// a string limit, is settled by the editor's edit of #limits that the limits
// pin records in firstRead.
const settledQuestions = [
  {
    question: "lexical-limit-error-code",
    settledBy: [rules.limits],
    formerlyOmitted: [
      "string-bytes-crossed-before-misplaced-number",
      "string-bytes-crossed-before-escaped-noncharacter",
      "string-bytes-crossed-in-member-name-before-raw-noncharacter",
      "total-string-bytes-crossed-before-escaped-noncharacter",
      "total-string-bytes-crossed-after-member-name-before-noncharacter",
      "depth-crossed-before-grammar",
      "total-string-bytes-crossed-inside-repeated-name",
    ],
  },
  {
    question: "outermost-container-depth",
    settledBy: [rules.limits],
    formerlyOmitted: [],
  },
  {
    question: "member-names-in-string-limits",
    settledBy: [rules.limits],
    formerlyOmitted: [
      "string-bytes-crossed-in-member-name-before-raw-noncharacter",
      "total-string-bytes-crossed-after-member-name-before-noncharacter",
      "total-string-bytes-crossed-inside-repeated-name",
    ],
  },
  {
    question: "non-finite-in-memory-numbers",
    settledBy: [rules.inMemoryInput],
    formerlyOmitted: [],
  },
  {
    question: "undefined-string-limit-units",
    settledBy: [rules.limits],
    formerlyOmitted: [],
  },
  {
    question: "noncharacters-in-string-limits",
    settledBy: [rules.limits],
    formerlyOmitted: [],
  },
];
for (const { formerlyOmitted } of settledQuestions)
  for (const id of formerlyOmitted)
    assert(
      decodeVectors.some((vector) => vector.id === id),
      `${id}: a formerly omitted case is a vector`,
    );

// vectors/ holds exactly one input file per manifest vector, and nothing else.
const expectedVectorFiles = new Set(vectorFileNames.values());
const vectorEntries = await readdir(resolve(supplementDirectory, "vectors"), {
  withFileTypes: true,
});
for (const entry of vectorEntries)
  assert(
    entry.isFile() && expectedVectorFiles.has(entry.name),
    `vectors/${entry.name}: not an input file of this supplement`,
  );
assert.equal(
  vectorEntries.length,
  expectedVectorFiles.size,
  "vectors/ holds one input file per vector",
);

const producer = {
  path: `${supplementMember}/derive.mjs`,
  sha256: sha256Hex(producerBytes),
};
const authorityPins = [
  {
    path: specification.path,
    sections: specification.sections.map(({ id, sha256, byteLength }) => ({
      id,
      sha256,
      byteLength,
    })),
  },
];
const sectionRule =
  "A pinned section of the specification draft is its Markdown heading line, the one ending in {#id}, through to the line before the next heading of the same or a higher level, or to the end of the document; a line inside a fenced code block is not a heading. The digest covers exactly those bytes.";
const manifestText = jsonDocument({
  format: "canonical-vowl-negative-and-boundary-manifest/1",
  status: "supplemental-independent-errors-pending-review",
  independence:
    "Inputs and expected errors derived from the written rules of the pinned authorities; no product code was read, imported or executed to choose outcomes.",
  authorities: authorityPins,
  sourceArtifacts: [producer],
  notes: [
    "Authority paths are relative to the repository root; input and source-artifact paths are relative to packages/vowl/conformance. Rules beginning with # are pinned sections of the specification draft, the only authority.",
    `The specification draft is pinned by the sections that the vectors cite. ${sectionRule}`,
    "Every input is a file directly in vectors/, named by its vector id: <id>.bin holds the bytes for decode, and <id>.json the source for canonicalize.",
    "Pass options to the named operation. For canonicalize, parse the <id>.json source with an ordinary JSON parser to obtain the in-memory source: its \\uXXXX escapes yield lone surrogates and noncharacters, and -0 yields negative zero. Supply the recorded profile separately.",
    "Each expected error holds for exactly the limits that the vector's options set, with the defaults of #limits for every other limit.",
    "failurePositions lists the competing stage-3 failures that each decode input was built around, at the byte offsets that #failure-positions defines; failures after the first JSON grammar failure are the positions that bytes of a continued text would have, recorded to show what the order decides.",
    "A crossed depth, stringBytes or totalStringBytes limit fails with MODEL_RESOURCE_LIMIT in every operation and stage (#limits), and the error's details.limit names the limit; in a vector that expects it, the first entry of failurePositions names that limit.",
    "A code point that is not Unicode-valid fails before it is counted (#limits). Where a vector sets a string limit that a noncharacter would cross only if it were counted, its note gives the byte of that crossing, which is not a failure position.",
    "Every vector is a rejection; expectedError is never null.",
  ],
  vectors: manifestVectors,
});
assert(
  /^[\x00-\x7f]*$/.test(manifestText),
  "manifest text is ASCII; prohibited code points appear only as notation",
);
const manifest = await pinFile("manifest.json", Buffer.from(manifestText));

const provenanceText = jsonDocument({
  format: "canonical-vowl-supplement-provenance/1",
  supplement: supplementMember,
  authorities: [
    {
      path: specification.path,
      pinnedBy: "section",
      sectionRule,
      readRevision: {
        ...specification.readRevision,
        role: "Whole bytes of the draft that this revision read, recorded for provenance; not checked, because the draft is still being edited.",
      },
      firstReadRevision: {
        ...specification.firstReadRevision,
        role: "Whole bytes of the draft that the first derivation read, recorded for provenance; not checked. A renewed section records, in firstRead, the first pin that this supplement recorded for it and the edits since, which derive.mjs reverses.",
      },
      sections: specification.sections,
    },
  ],
  alsoRead,
  producer,
  manifest,
  consultedConventions: [
    "packages/vowl/conformance/README.md",
    "packages/vowl/conformance/STORAGE.md",
    "packages/vowl/conformance/storage.mjs",
    "packages/vowl/conformance/supplemental/README.md",
    "packages/vowl/conformance/supplemental/negative/derive.mjs",
    "packages/vowl/conformance/supplemental/negative/manifest.json",
    "packages/vowl/conformance/supplemental/accepted-protocol-v1/README.md",
    "packages/vowl/conformance/supplemental/accepted-protocol-v1/derive.mjs",
    "packages/vowl/conformance/supplemental/accepted-protocol-v1/derive-prefix.mjs",
    "packages/vowl/conformance/supplemental/accepted-protocol-v1/prefix-negative-manifest.json",
    "packages/vowl/conformance/supplemental/field-contract/support.mjs",
    "packages/vowl/conformance/supplemental/unbounded-limits-v1/provenance.json",
  ],
  notRead: [
    "packages/vowl/src/",
    "packages/vowl/test/",
    "packages/vowl/scripts/",
    "src/",
    "docs/plans/",
    "Git history and diffs",
  ],
  notExecuted:
    "No module of the vowl package was imported or executed. derive.mjs uses only Node.js built-ins; its tracer re-derives stage-3 positions from the same written rules as a check on the tables.",
  settledQuestions,
  omittedUndecidedCases: [],
});
assert(/^[\x00-\x7f]*$/.test(provenanceText), "provenance text is ASCII");
await pinFile("provenance.json", Buffer.from(provenanceText));

const vectorsByGroup = {};
for (const vector of manifestVectors)
  vectorsByGroup[vector.coverageGroup] =
    (vectorsByGroup[vector.coverageGroup] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      vectors: manifestVectors.length,
      vectorsByGroup,
      wrote: writeMissingFiles ? "missing files only" : "nothing",
      result: "every file equals this script's derivation",
    },
    null,
    2,
  ),
);
