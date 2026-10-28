# Lexical failure-position supplement, version 1

This supplement adds 101 independently derived rejection vectors for two ordering rules and the resource-limit code of the Canonical VOWL specification draft.
For `decode`, they test that an exact decoder reports the stage-3 failure with the smallest failure position, resolves a shared position in the order JSON grammar, duplicate member names, Unicode validity, numbers, lexical limits, and reports a crossed `depth`, `stringBytes` or `totalStringBytes` limit that comes first with `MODEL_RESOURCE_LIMIT`.
For `canonicalize`, they test that a canonicalizing producer reports the Unicode and number failures it finds while taking its in-memory snapshot before the closed field sets and the other scalar domains of stage 4.
The [manifest](manifest.json) uses the format of the [negative/boundary manifest](../negative/manifest.json), and every vector is a rejection.

## Layout

| Path                | Content                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `README.md`         | This description.                                                              |
| `derive.mjs`        | The tables that define every vector, and the script that derives the files.    |
| `manifest.json`     | The negative manifest.                                                         |
| `provenance.json`   | The provenance record: authority pins, the script digest and the manifest pin. |
| `vectors/<id>.bin`  | The input bytes of a `decode` vector.                                          |
| `vectors/<id>.json` | The source of a `canonicalize` vector.                                         |

Every input is a file directly in `vectors/`, named by its vector id, as the W3C rdf-tests suites lay out their tests.

## Coverage

| Coverage group          | Operation      | Vectors | Tests                                                                                                                                                                                                                                                              |
| ----------------------- | -------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `misplaced-token`       | `decode`       |      15 | A token that the grammar does not allow at its position, holding a Unicode, number, string-length, total-string or depth failure; and such a failure in a valid token before a misplaced one, including a `stringBytes` crossing.                                  |
| `inadmissible-number`   | `decode`       |      18 | Negative zero, overflow and underflow to negative zero, against a grammar failure at the next byte, whitespace and then a grammar failure, truncation, whitespace and then truncation, and on their own.                                                           |
| `prohibited-code-point` | `decode`       |      30 | Lone high and low surrogate escapes, escaped pairs that denote noncharacters, escaped noncharacters and raw three- and four-byte noncharacters, each before an invalid escape, a raw control character and truncation in the same string, and after the first two. |
| `string-limit`          | `decode`       |      15 | A `stringBytes` or `totalStringBytes` crossing before a noncharacter, in values and member names; a noncharacter before a crossing in a later string; and ten noncharacters that would cross a limit only if they were counted.                                    |
| `nesting-limit-tie`     | `decode`       |       7 | A misplaced opening bracket that also takes the nesting depth past its limit, including a three-way tie with a number; a grammar failure before a crossing; and a crossing before a grammar failure.                                                               |
| `duplicate-member-name` | `decode`       |       8 | A repeated member name against a later grammar failure, at the next byte, at truncation and with an escaped spelling; the reverse order; the same name in sibling and nested objects; and a `totalStringBytes` crossing inside the repeated name.                  |
| `in-memory-snapshot`    | `canonicalize` |       8 | A lone surrogate or negative zero after an earlier unknown or mistyped member, and before a later one; and member names that are a lone surrogate or a noncharacter.                                                                                               |

The four examples of `#failure-positions` and the example of `#in-memory-input` are among the vectors, and their `note` says so.
The seven cases that the first derivation omitted, because no written rule then decided their expected error, are now vectors; [settled questions](#settled-questions) lists them.

## Authority

Every expected error is taken from the written rules of the specification draft alone.
The draft is still being edited, so it is pinned by the sections that the vectors cite rather than by its whole bytes.

### Section pins

A pinned section is its Markdown heading line, the one ending in `{#id}`, through to the line before the next heading of the same or a higher level, or to the end of the document.
A line inside a fenced code block is not a heading, and a heading without an id still ends the sections above it.
The digest covers exactly those bytes, line terminators included.
A section therefore contains its subsections: `validation-order` contains `failure-positions`.

`derive.mjs` recomputes every pinned section of [the draft](../../../../../docs/canonical-vowl/index.html) on each run.
It stops, naming every affected section, if a section's bytes changed, if no heading line ends in its `{#id}` any more, or if more than one does.
An edit elsewhere in the draft does not affect reproduction.
The script also requires the pinned sections to be exactly the sections that the vectors cite in their `rules`.

| Section              | Lines when read | SHA-256                                                            | Bytes |
| -------------------- | --------------- | ------------------------------------------------------------------ | ----: |
| `notation`           | 253 to 294      | `1e83b3978ce5fca5a469bc0f71193e348ac7174288f2523c09cfd8bff4156f31` |  2380 |
| `canonical-profiles` | 322 to 331      | `6643e8f70bc0e5e3e566540300b504880023d07f1e69991c587981e4c5b1f472` |   722 |
| `envelope`           | 445 to 506      | `34400bdef9166d641e6f68bc61e00ba12b2660c377c1b4b5d09001601e287150` |  2249 |
| `ontology`           | 513 to 522      | `f8cbb83716fb921c273188a1209c90b7c435a02d27cbd62dd31929ff527b0a89` |   578 |
| `subjects-and-roles` | 523 to 551      | `e3c4bfc4d02d7e4b5304e97866fe601152526441ea146e5e25f50cbd525ae3e8` |  2459 |
| `exact-decoding`     | 1823 to 1852    | `a7691b558317355141ff4f2a036c9d139d682204aac0048110231b08813dfb35` |  2495 |
| `duplicate-members`  | 1855 to 1869    | `7039971c09d97a4a3e95fef369bc2dea611b38b00c0c0809ec4e769d243eb15b` |  1347 |
| `unicode-admission`  | 1870 to 1878    | `426c0bd1102c1e13f50ee57e297a6908fa4ab870917ddd09093a34259627cb42` |   895 |
| `number-admission`   | 1879 to 1885    | `f14cc074b8c42517b80840d33bafe8558e9f600b7429b83d59dfb794e2070fd8` |   673 |
| `in-memory-input`    | 1897 to 1917    | `d731038e63136a3c4a86c36c443adcf8a62e27265578dc52589fc4087545e15d` |  1940 |
| `validation-order`   | 1918 to 1982    | `c1fc33dfe002df78d8dfdd93f7fdba0bc57d1f76b52f3e81781b461c2979982c` |  5233 |
| `failure-positions`  | 1961 to 1982    | `274c1a7220f42d3d4569e3fc4c158c951e20d39731a130d66575bd808964f478` |  1759 |
| `limits`             | 2064 to 2146    | `e41dbd01b0fd6e73252a4bdfcffa5f44b4dcc09993c69889f4a9b6551625ddd6` |  7010 |

The sections were read from the draft whose whole bytes had the SHA-256 `030bd44364db10e91e7c4d29db46c4d62bdbac58ad0c9a932ff5d948bc63a433` and length 249142.
The first derivation read the draft with the SHA-256 `3202c49af4853af659ca74ca096e2afabad359aeceb8d6589ef5dcb1e7077897` and length 167679.
Both digests are recorded for provenance and are not checked.
The draft identifies a copy by the Git commit that contains it; no commit is recorded here, because the bytes were read from a working tree.

`canonical-profiles` is cited by the `canonicalize` vectors because it is the source of their `profile` value.
The source models were built from `notation`, `envelope`, `ontology` and `subjects-and-roles`; the rest of `data-model` was read but is not cited, and is not pinned.

### Renewed and new pins

`in-memory-input` was renewed.
The first derivation pinned it at 1717 bytes with the SHA-256 `6c6590304ffc7093658ab4170924ed235578c221ffed70b7f7fc6e043095b0ed`.
One sentence changed: the producer still fails with `SOURCE_UNSAFE_VALUE` on input that is not plain data, but the examples are now a cyclic value, an accessor property, or a value of a type that JSON lacks, in place of a cyclic value or a value with no JSON counterpart, and a new sentence makes a number that JSON cannot represent, such as NaN or an infinity, plain data that fails number admission instead.
`derive.mjs` records that edit, reverses it on each run and requires the bytes of the first pin, so no other sentence of the section changed.
The eight `canonicalize` vectors cite the section.
Their sources hold only objects, arrays, strings, booleans and negative zero, all of them plain data, so each keeps its expected error.

`limits` is newly pinned, and was renewed twice.
Every vector that sets a limit cites it in place of A8, and the vectors that expect `MODEL_RESOURCE_LIMIT` take that code from it.
Its first pin, at 6711 bytes with the SHA-256 `43857b1908efa512872e277991f24af671769445de47497cd6f1f7814036aa11`, already followed two edits on how `expandedXmlBytes` counts each XML document, which no vector sets.
The editor then changed one sentence of its counted units, at the owner's ruling: a code point that is not Unicode-valid still fails before it is counted, and the sentence now says that neither a lone surrogate nor a noncharacter ever counts toward a string limit, where it named only the lone surrogate.
A second edit, at 6737 bytes with the SHA-256 `c02b60618d5d3287604d14db9aef8269d4977af2e9b2decd23a5789186d551e7`, added one line: each value counts once in an operation, however often the operation copies it, and at each position where it occurs.
`derive.mjs` records both edits, reverses them on each run and requires the bytes of each earlier pin, so no other sentence of the section changed.
No expected error changes: this supplement already read the first rule that way, every vector is one operation, and its one repeated value, the member name of `total-string-bytes-crossed-inside-repeated-name`, already counted at each position.

### Former authorities

The first derivation also cited A8: the resource table of the [core contract](../../../../../docs/specs/2026-09-24-canonical-vowl-core-contract.md), read with the [resource-policy amendment](../../../../../docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md) and the [embedded-work amendment](../../../../../docs/specs/2026-10-03-canonical-vowl-embedded-work-amendment.md), each pinned by its whole bytes.
The draft's `errors` section is now consolidated from A7 and A8, and the draft keeps the source documents authoritative only for a section that is not yet consolidated.
`#limits` therefore takes the place of A8, and it also settles the counted units that A8 left open.

The [unbounded-limits amendment](../../../../../docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md) supersedes A8's finite defaults, its upper override bounds and the embedded-work default, and `#limits` consolidates it, so it is not an authority either.
No expectation depends on a default or an override bound.
The inputs are at most 293 bytes long and nest at most four containers deep, and every limit that a vector sets is a positive safe integer of at most 4, inside both the former and the current override domains.

The four documents are listed with their digests under `alsoRead` in the provenance record, and are not checked.

### Error codes

The error codes come from the sections that name them: `JSON_SYNTAX` from `#exact-decoding`, `JSON_DUPLICATE_MEMBER` from `#duplicate-members`, `UNICODE_INVALID` from `#unicode-admission`, `NUMBER_INVALID` from `#number-admission`, and `MODEL_RESOURCE_LIMIT` from `#limits`, which assigns it to `depth`, `stringBytes` and `totalStringBytes` in every operation and stage that counts them.
Each vector's `rules` lists the pinned sections that it relies on.
The [provenance record](provenance.json) repeats these pins and pins the derivation script and the manifest.

## Reproduction

From the repository root:

```text
node packages/vowl/conformance/supplemental/lexical-position-v1/derive.mjs
node packages/vowl/conformance/supplemental/lexical-position-v1/derive.mjs --write-new
```

The first command writes nothing.
It checks the section pins, derives every input, the manifest and the provenance record from the tables in the script, and requires each file on disk to equal its derivation byte for byte.
It also rejects any entry in `vectors/` that is not the input file of a vector, including a directory.
`--write-new` creates missing files only and then makes the same comparison; it never replaces an existing file.
The script uses only Node.js built-ins.

## Consuming the manifest

For `decode`, pass the bytes of `vectors/<id>.bin` with the recorded `options`, whose `limits` use the limit names of `#limits`.
For `canonicalize`, parse `vectors/<id>.json` with an ordinary JSON parser, such as `JSON.parse`, and pass the resulting value with the recorded `profile` and `options`.
That parse turns the escapes in a source into lone surrogates or noncharacters, and `-0` into negative zero, which is the in-memory input under test.
Each expected error holds for exactly the limits that the vector's `options` set, with the defaults of `#limits` for every other limit.
Paths of inputs and source artifacts are relative to `packages/vowl/conformance`, and authority paths are relative to the repository root.

Each `decode` vector lists in `failurePositions` the competing stage-3 failures that its input was built around, at the byte offsets that `#failure-positions` defines, and its `rationale` states which comes first and why.
A position after the first JSON grammar failure is where that failure would lie if the text continued; it records what the order decides.
In a vector that expects `MODEL_RESOURCE_LIMIT`, the first entry of `failurePositions` names the crossed limit, which `#limits` requires the error's `details.limit` to name.
Each `canonicalize` vector names its `snapshotFailure` and its `competingFailures`, with their member order relative to the snapshot failure.
Locations are JSON Pointers, except that a code point that this manifest does not carry is written as `<U+XXXX>`.

## How the expectations were derived

Each `decode` input is written in `derive.mjs` as a template with markers at the failures it contains.
The markers give the byte offsets, and the first failure by offset and tie order gives the expected error.
A tracer in the same script re-derives the stage-3 failures of every input from the same written rules, counting as `#limits` defines.
The script stops unless the tracer finds the marked first failure, every failure that it meets is marked, and every marked failure before the first grammar failure is met; the tracer stops at that grammar failure.
The tracer checks the tables; it is not their source.

`#limits` makes a code point that is not Unicode-valid fail before it is counted, so that neither a lone surrogate nor a noncharacter ever counts toward a string limit.
Ten `string-limit` vectors were built when the first derivation counted a noncharacter by its UTF-8 bytes; their ids name the crossing or tie that this count produced.
Their templates now mark that crossing as `crossingIfCounted`, which is not a failure, and their `note` gives its byte.
A second tracer pass counts noncharacters and must add exactly those crossings.
Their ids, inputs, options and expected errors are unchanged.
The four tie vectors still reject a decoder that counts the noncharacter and reports the crossing at its byte, and the six others a decoder that counts it and checks its validity only after the crossing.

The first derivation kept each expected error independent of the questions then open with three design rules: vectors that set a string limit use only noncharacters, and no lone surrogate or escaped pair; a limit crossing is placed at or after the failure expected to come first; and the only inadmissible number in the snapshot vectors is negative zero.
Every vector still follows them, but no expected error depends on them now.

No input contains a carriage return, so the repository's line-ending normalization cannot change one.
Several inputs deliberately end without a newline or with trailing whitespace.

## Settled questions

The first derivation recorded five points that the written rules did not decide, and this revision raised a sixth.
All six are now settled, and no case is omitted.

1. **Error code of a crossed lexical limit.**
   `#limits` assigns `MODEL_RESOURCE_LIMIT` to `depth`, `stringBytes` and `totalStringBytes` in every operation and stage that counts them.
2. **Depth of the outermost container.**
   `#limits` puts the outermost JSON container at depth 1, and each nested container adds one.
3. **Member names in the string limits.**
   `#limits` states that the names that `stringBytes` and `totalStringBytes` count include member names.
4. **Non-finite in-memory numbers.**
   `#in-memory-input` makes a number that JSON cannot represent, such as NaN or an infinity, plain data that fails number admission, so `canonicalize` reports `NUMBER_INVALID` for it rather than `SOURCE_UNSAFE_VALUE`.
   No vector uses one.
5. **String-limit units.**
   `#limits` counts an escaped surrogate pair as one four-byte character that crosses a string limit at its second escape, and makes a code point that is not Unicode-valid fail before it is counted; it also defines which values `embeddedValues` counts while tokenizing.
   No vector sets `embeddedValues` or combines a surrogate escape with a string limit.
6. **Noncharacters in the string limits.**
   Settled by the editor's edit of `#limits`.
   The sentence that made a code point that is not Unicode-valid fail before it is counted named only the lone surrogate as never counting; this revision read it to cover noncharacters too, and re-recorded the ten `string-limit` vectors described above.
   At the owner's ruling, the sentence now says that neither a lone surrogate nor a noncharacter ever counts toward a string limit, so those ten vectors stand.

Each formerly omitted case now expects `MODEL_RESOURCE_LIMIT`:

| Formerly omitted case                                              | Options              | Input              | First failure                | Questions |
| ------------------------------------------------------------------ | -------------------- | ------------------ | ---------------------------- | --------- |
| `string-bytes-crossed-before-misplaced-number`                     | `stringBytes` 1      | `["ab" 1]`         | `stringBytes` at byte 3      | 1         |
| `string-bytes-crossed-before-escaped-noncharacter`                 | `stringBytes` 1      | `["ab\ufffe"]`     | `stringBytes` at byte 3      | 1         |
| `string-bytes-crossed-in-member-name-before-raw-noncharacter`      | `stringBytes` 1      | `{"ab<U+FFFF>":1}` | `stringBytes` at byte 3      | 1, 3      |
| `total-string-bytes-crossed-before-escaped-noncharacter`           | `totalStringBytes` 1 | `["a","b\ufffe"]`  | `totalStringBytes` at byte 6 | 1         |
| `total-string-bytes-crossed-after-member-name-before-noncharacter` | `totalStringBytes` 1 | `{"a":"b\ufffe"}`  | `totalStringBytes` at byte 6 | 1, 3      |
| `depth-crossed-before-grammar`                                     | `depth` 1            | `[[[]]x]`          | `depth` at byte 1            | 1         |
| `total-string-bytes-crossed-inside-repeated-name`                  | `totalStringBytes` 2 | `{"ab":1,"ab":2}`  | `totalStringBytes` at byte 9 | 1, 3      |

In this table, `<U+FFFF>` stands for the raw three-byte code point.
The provenance record lists the settled questions with the cases that each had kept out of the manifest.

## Repository JSON quality gate

Five sources deliberately hold a code point that I-JSON prohibits: `vectors/snapshot-unicode-after-unknown-member.json`, `vectors/snapshot-unicode-after-mistyped-member.json`, `vectors/snapshot-unicode-before-later-mistyped-member.json`, `vectors/snapshot-member-name-lone-surrogate.json` and `vectors/snapshot-member-name-noncharacter-after-unknown-member.json`.
The repository's JSON quality engine reports each lone surrogate escape as a syntax finding and the noncharacter as an interoperability finding.
These files therefore need pinned expected findings in the gate policy, as the earlier intentional U+FDD0 vectors have.
The `.bin` inputs, including the seven new ones, are outside that gate.

## Provenance

The expected errors were derived from the authority parts listed above.

The first derivation also read, for context only: the rest of the draft's `data-model` section; its front matter, conformance classes, terminology, authority, identifiers and canonicalization algorithm; the editor's notes of its unconsolidated sections, including the `errors` note that named the two amendments; its consolidation record and accepted clarifications; and section A1 of the core contract.
The other corpus files were read only for their formats: those listed under `consultedConventions` in the provenance record, and the head of `storage-inventory.json`.
To place the new files, the repository's quality configuration was read: `.json-quality.json`, `.markdown-quality.json`, `.gitattributes`, `.editorconfig`, `.prettierignore`, the scripts of `package.json`, the head of `util/runRepositoryJsonQuality.mjs`, `tooling/json/public-api.mjs`, `tooling/markdown/package.json` and the documentation of the JSON quality engine.

This revision read every pinned section of the current draft; the rest of its `errors` section, including its editor's note; its status section, consolidation record and accepted clarifications; and the unbounded-limits amendment.
For conventions it read the authority entries of the `unbounded-limits-v1` provenance record and the resource-limit vectors of the negative manifest.
The draft's statements about the reference implementation, in its editor's notes, notes and accepted clarifications, were read as context only, and no expected error was taken from them.
None of these is cited by a vector, so none is pinned.

Not read: `packages/vowl/src/`, `packages/vowl/test/`, `packages/vowl/scripts/`, the top-level `src/`, `docs/plans/` (including the decoder plan that the draft cites), Git history and diffs, design section 20, and the protocol-clarification, camera-precedence and compatible-artifact documents.
No module of the `vowl` package was imported or executed, and no expected error was taken from an implementation, a test or another corpus file.

What the first derivation ran: `derive.mjs`; the single-source check of the JSON quality engine on this supplement's JSON files; the Markdown quality check on this README; and Prettier on an existing manifest, to compare formats.
What this revision ran: `derive.mjs`, in the repository and in a scratch copy of its layout holding only the script and the draft, which derived the manifest and the provenance record that the script never replaces; the Markdown quality check on this README; scripts that read only the draft and this directory, which measured sections, recovered the first-read sentence of `in-memory-input` by its digest, checked the edits of `limits` by reversing them, compared the old and new manifests and aligned this README's tables; and a parse and format check of the two JSON files.
The repository JSON gate and the corpus storage check were not run, because both load code from `packages/vowl/scripts/`.

The manifest is not registered with any test runner, and no existing file outside this directory was modified.
