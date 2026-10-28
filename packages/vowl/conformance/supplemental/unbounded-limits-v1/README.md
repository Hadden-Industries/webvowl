# Unbounded-limits overlay, version 1

This overlay supplies the current expectations of the nine `option-<limit>-above-ceiling` records of the frozen [negative/boundary manifest](../negative/manifest.json).
It also adds 51 vectors for further option values that the [unbounded-limits amendment](../../../../../docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md) decides.
The owner approved the amendment on 27 October 2026 and corrected it the same day, and this overlay is derived from the corrected text.
It supersedes the finite-limit policy of A8 in the [core contract](../../../../../docs/specs/2026-09-24-canonical-vowl-core-contract.md), including its finite upper override bounds, and wins wherever the two differ.
The [manifest](manifest.json) uses the format of the predecessor manifest, and every vector calls `canonicalize` on the `empty-structural` fixture.

## Layout

| Path              | Content                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`       | This description.                                                                                                                                                                                                   |
| `derive.mjs`      | The script that derives the manifest and the provenance record and verifies them.                                                                                                                                   |
| `manifest.json`   | The nine replacement records, followed by the 51 new vectors.                                                                                                                                                       |
| `provenance.json` | The provenance record: authority pins, the sentences relied on, the pins of the predecessor manifest, the positive baseline, the fixture and the inputs, the script digest, the manifest pin and the omitted cases. |

No vector needs new input bytes, so the supplement has no `vectors/` directory.
The replacement records keep the predecessor's input files, and the new vectors reuse the fixture's own [`source.json`](../../vectors/empty-structural/source.json).

## What it replaces and why

Each predecessor record passes one limit at one above the upper override bound that A8 set, and expects `OPTION_INVALID`.
The amendment's Overrides section lets each limit accept any positive safe integer, and says that there is no upper override bound, so these values are now valid overrides.
Its Evidence and qualification section keeps the nine vectors as frozen historical evidence of the superseded bounds.
It also asks for a versioned overlay, derived from the amendment without production code, to supply their current expectations.
This is that overlay.
The predecessor manifest stays byte-for-byte unchanged.

Every other predecessor record keeps its expectation.
`derive.mjs` checks that, of the predecessor records that pass limits, the amendment changes the admission of exactly these nine.
It also checks that no predecessor record that relies on default limits expects a resource-limit, deadline or cancellation error, and that no default of the amendment is stricter than the former one.
The amendment changes admission only, so no other record's outcome can change.

### Replacement records

| Vector                                   | Option                         | Active expectation | Predecessor expectation |
| ---------------------------------------- | ------------------------------ | ------------------ | ----------------------- |
| `option-inputBytes-above-ceiling`        | `inputBytes` `268435457`       | success            | `OPTION_INVALID`        |
| `option-primaryRecords-above-ceiling`    | `primaryRecords` `1000001`     | success            | `OPTION_INVALID`        |
| `option-embeddedValues-above-ceiling`    | `embeddedValues` `4000001`     | success            | `OPTION_INVALID`        |
| `option-depth-above-ceiling`             | `depth` `513`                  | success            | `OPTION_INVALID`        |
| `option-stringBytes-above-ceiling`       | `stringBytes` `16777217`       | success            | `OPTION_INVALID`        |
| `option-totalStringBytes-above-ceiling`  | `totalStringBytes` `134217729` | success            | `OPTION_INVALID`        |
| `option-rdfQuads-above-ceiling`          | `rdfQuads` `8000001`           | success            | `OPTION_INVALID`        |
| `option-rdfDeepIterations-above-ceiling` | `rdfDeepIterations` `1000001`  | success            | `OPTION_INVALID`        |
| `option-deadlineMs-above-ceiling`        | `deadlineMs` `300001`          | success            | `OPTION_INVALID`        |

The replacement records follow the [camera overlay](../accepted-protocol-v2/README.md).
Each keeps the predecessor's `id`, `operation`, `profile`, `options`, `sourceFixture` and `input`.
Its active fields are `expectedError`, `expectedCanonical`, `rules`, `reason` and `status`.
`authority` pins the amendment.
`replaces` names the predecessor manifest by path and SHA-256, the predecessor `vectorId` and its `recordSha256`, and records that the input and options are unchanged.
`historical.predecessorRecord` holds the complete predecessor record.
The active `rules` cite only the amendment, so the predecessor's `A7` and `A8` rules and its `OPTION_INVALID` expectation appear only under `historical`.

### Record hash convention

`recordSha256` is the SHA-256 of the UTF-8 bytes of `JSON.stringify(record, null, 2)` followed by one line feed.
Here `record` is the predecessor record as `JSON.parse` returns it from the predecessor manifest.
This is `hash(json(record))` of the [field-contract support module](../field-contract/support.mjs), which both camera overlays use.
The digest covers the record serialized on its own, not the bytes of the record inside the manifest.
The same rule reproduces every `recordSha256` of `accepted-protocol-v2` and every `historicalRecordSha256` of `accepted-protocol-v1`.

## New vectors

The new vectors test each limit at the values that the Overrides section decides and that JSON can spell:

- `Number.MAX_SAFE_INTEGER`, 9007199254740991, which is accepted;
- 9007199254740992, the smallest integer above it, which is rejected;
- the fraction 1.5, which is rejected;
- `null`, which is rejected;
- the negative number -1, which is rejected; and
- for `expandedXmlBytes` only, zero, which is rejected, and 1, which is accepted and ignored.

Cases that predecessor records already test, with expectations that the amendment leaves unchanged, are not repeated.
They are zero for the eight limits other than `rdfDeepIterations`, in the `option-<limit>-zero` records, and a negative `rdfDeepIterations`, in `option-rdfDeepIterations-negative`.
They also include an unknown limit name, in `option-unknown-limit`, and zero for `rdfDeepIterations`, which `rdf-deep-zero` shows is admitted.
The provenance record lists these under `coveredByPredecessorRecords`.

| Vector                                            | Option                                 | Expectation                                     |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `option-inputBytes-max-safe-integer`              | `inputBytes` `9007199254740991`        | success                                         |
| `option-inputBytes-above-max-safe-integer`        | `inputBytes` `9007199254740992`        | `OPTION_INVALID` at `/limits/inputBytes`        |
| `option-inputBytes-fraction`                      | `inputBytes` `1.5`                     | `OPTION_INVALID` at `/limits/inputBytes`        |
| `option-inputBytes-null`                          | `inputBytes` `null`                    | `OPTION_INVALID` at `/limits/inputBytes`        |
| `option-inputBytes-negative`                      | `inputBytes` `-1`                      | `OPTION_INVALID` at `/limits/inputBytes`        |
| `option-primaryRecords-max-safe-integer`          | `primaryRecords` `9007199254740991`    | success                                         |
| `option-primaryRecords-above-max-safe-integer`    | `primaryRecords` `9007199254740992`    | `OPTION_INVALID` at `/limits/primaryRecords`    |
| `option-primaryRecords-fraction`                  | `primaryRecords` `1.5`                 | `OPTION_INVALID` at `/limits/primaryRecords`    |
| `option-primaryRecords-null`                      | `primaryRecords` `null`                | `OPTION_INVALID` at `/limits/primaryRecords`    |
| `option-primaryRecords-negative`                  | `primaryRecords` `-1`                  | `OPTION_INVALID` at `/limits/primaryRecords`    |
| `option-embeddedValues-max-safe-integer`          | `embeddedValues` `9007199254740991`    | success                                         |
| `option-embeddedValues-above-max-safe-integer`    | `embeddedValues` `9007199254740992`    | `OPTION_INVALID` at `/limits/embeddedValues`    |
| `option-embeddedValues-fraction`                  | `embeddedValues` `1.5`                 | `OPTION_INVALID` at `/limits/embeddedValues`    |
| `option-embeddedValues-null`                      | `embeddedValues` `null`                | `OPTION_INVALID` at `/limits/embeddedValues`    |
| `option-embeddedValues-negative`                  | `embeddedValues` `-1`                  | `OPTION_INVALID` at `/limits/embeddedValues`    |
| `option-depth-max-safe-integer`                   | `depth` `9007199254740991`             | success                                         |
| `option-depth-above-max-safe-integer`             | `depth` `9007199254740992`             | `OPTION_INVALID` at `/limits/depth`             |
| `option-depth-fraction`                           | `depth` `1.5`                          | `OPTION_INVALID` at `/limits/depth`             |
| `option-depth-null`                               | `depth` `null`                         | `OPTION_INVALID` at `/limits/depth`             |
| `option-depth-negative`                           | `depth` `-1`                           | `OPTION_INVALID` at `/limits/depth`             |
| `option-stringBytes-max-safe-integer`             | `stringBytes` `9007199254740991`       | success                                         |
| `option-stringBytes-above-max-safe-integer`       | `stringBytes` `9007199254740992`       | `OPTION_INVALID` at `/limits/stringBytes`       |
| `option-stringBytes-fraction`                     | `stringBytes` `1.5`                    | `OPTION_INVALID` at `/limits/stringBytes`       |
| `option-stringBytes-null`                         | `stringBytes` `null`                   | `OPTION_INVALID` at `/limits/stringBytes`       |
| `option-stringBytes-negative`                     | `stringBytes` `-1`                     | `OPTION_INVALID` at `/limits/stringBytes`       |
| `option-totalStringBytes-max-safe-integer`        | `totalStringBytes` `9007199254740991`  | success                                         |
| `option-totalStringBytes-above-max-safe-integer`  | `totalStringBytes` `9007199254740992`  | `OPTION_INVALID` at `/limits/totalStringBytes`  |
| `option-totalStringBytes-fraction`                | `totalStringBytes` `1.5`               | `OPTION_INVALID` at `/limits/totalStringBytes`  |
| `option-totalStringBytes-null`                    | `totalStringBytes` `null`              | `OPTION_INVALID` at `/limits/totalStringBytes`  |
| `option-totalStringBytes-negative`                | `totalStringBytes` `-1`                | `OPTION_INVALID` at `/limits/totalStringBytes`  |
| `option-rdfQuads-max-safe-integer`                | `rdfQuads` `9007199254740991`          | success                                         |
| `option-rdfQuads-above-max-safe-integer`          | `rdfQuads` `9007199254740992`          | `OPTION_INVALID` at `/limits/rdfQuads`          |
| `option-rdfQuads-fraction`                        | `rdfQuads` `1.5`                       | `OPTION_INVALID` at `/limits/rdfQuads`          |
| `option-rdfQuads-null`                            | `rdfQuads` `null`                      | `OPTION_INVALID` at `/limits/rdfQuads`          |
| `option-rdfQuads-negative`                        | `rdfQuads` `-1`                        | `OPTION_INVALID` at `/limits/rdfQuads`          |
| `option-rdfDeepIterations-max-safe-integer`       | `rdfDeepIterations` `9007199254740991` | success                                         |
| `option-rdfDeepIterations-above-max-safe-integer` | `rdfDeepIterations` `9007199254740992` | `OPTION_INVALID` at `/limits/rdfDeepIterations` |
| `option-rdfDeepIterations-fraction`               | `rdfDeepIterations` `1.5`              | `OPTION_INVALID` at `/limits/rdfDeepIterations` |
| `option-rdfDeepIterations-null`                   | `rdfDeepIterations` `null`             | `OPTION_INVALID` at `/limits/rdfDeepIterations` |
| `option-deadlineMs-max-safe-integer`              | `deadlineMs` `9007199254740991`        | success                                         |
| `option-deadlineMs-above-max-safe-integer`        | `deadlineMs` `9007199254740992`        | `OPTION_INVALID` at `/limits/deadlineMs`        |
| `option-deadlineMs-fraction`                      | `deadlineMs` `1.5`                     | `OPTION_INVALID` at `/limits/deadlineMs`        |
| `option-deadlineMs-null`                          | `deadlineMs` `null`                    | `OPTION_INVALID` at `/limits/deadlineMs`        |
| `option-deadlineMs-negative`                      | `deadlineMs` `-1`                      | `OPTION_INVALID` at `/limits/deadlineMs`        |
| `option-expandedXmlBytes-max-safe-integer`        | `expandedXmlBytes` `9007199254740991`  | success                                         |
| `option-expandedXmlBytes-above-max-safe-integer`  | `expandedXmlBytes` `9007199254740992`  | `OPTION_INVALID` at `/limits/expandedXmlBytes`  |
| `option-expandedXmlBytes-fraction`                | `expandedXmlBytes` `1.5`               | `OPTION_INVALID` at `/limits/expandedXmlBytes`  |
| `option-expandedXmlBytes-null`                    | `expandedXmlBytes` `null`              | `OPTION_INVALID` at `/limits/expandedXmlBytes`  |
| `option-expandedXmlBytes-negative`                | `expandedXmlBytes` `-1`                | `OPTION_INVALID` at `/limits/expandedXmlBytes`  |
| `option-expandedXmlBytes-zero`                    | `expandedXmlBytes` `0`                 | `OPTION_INVALID` at `/limits/expandedXmlBytes`  |
| `option-expandedXmlBytes-one-ignored`             | `expandedXmlBytes` `1`                 | success                                         |

Every success, in both tables, expects exactly the fixture's [`canonical.json`](../../vectors/empty-structural/canonical.json).
Every rejection expects `OPTION_INVALID`, and records in `expectedPointer` the location `/limits/<name>` that the Overrides section gives, as a JSON Pointer into the options object.
The predecessor manifest records no pointers, so `expectedPointer` is new to this format.

### Scope

The vectors keep the shape of the predecessor records: `canonicalize`, the structural-content profile and one limit in `options`.
`decode` also reads no XML, but it has no vector here.
The Overrides section's "any other value" also covers strings, booleans and other types, but they are not among the values that it lists, and they have no vector.
`expandedXmlBytes` had no former upper bound, so it has no above-ceiling vector.

## How the expectations were derived

`derive.mjs` derives every expectation from the pinned authorities and the frozen corpus files.
It pins these files by SHA-256 and length:

| Pinned file                                                                                                                | SHA-256                                                            |  Bytes |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -----: |
| [Unbounded-limits amendment, corrected](../../../../../docs/specs/2026-10-27-canonical-vowl-unbounded-limits-amendment.md) | `8f5b7dd02ebeefd0f3deced6fe7096b194120090611c58f505123c0c843bc9cc` |   8819 |
| [Core contract](../../../../../docs/specs/2026-09-24-canonical-vowl-core-contract.md)                                      | `711ba30c291cfb0960334328203188600f60a331996e83379267a4a77b87988d` |  53207 |
| [Predecessor manifest](../negative/manifest.json)                                                                          | `b7f6d60f8ba05c2c4a9e3fe6f2fe97f73b5c89a1ad656bf1ed8b06f49e4893a3` |  45264 |
| [Amended-policy manifest](../amended-policy/manifest.json)                                                                 | `90f3754316f683a76ad9eecb8341d29a738b3f77b61c13362034de07cee92156` | 200161 |

1. It refuses to run if any pinned file changed or is missing.
2. From the amendment it reads the Former values table, which gives each former default and upper override bound, and the Defaults table with the sentence after it, which together name the ten current limits.
   It checks these against the A8 table of the core contract: the same nine limits, the same upper bounds and the same defaults, except the `embeddedValues` default of 500000 that the Former values section explains.
3. A value is admitted when it is a positive safe integer or `Infinity`, or zero for `rdfDeepIterations`, as the Overrides section says.
   Any other value fails with `OPTION_INVALID` at `/limits/<name>`, and A7 places option validation at stage 1, before the input is examined.
4. An admitted value succeeds with the fixture's canonical bytes when the fixture cannot cross the limit.
   The amended-policy manifest, which pins the same core contract, records `empty-structural` as a success with default options under A8's defaults.
   A value no lower than the former default of its limit therefore cannot be crossed.
   `expandedXmlBytes` cannot be crossed by `canonicalize`, which reads no XML, so under the OWL adapter section it validates the limit like any other and otherwise ignores it.
   Under Defaults every other limit imposes no bound, keeps its former default or counts only XML, so none becomes stricter.
   The Evidence and qualification section says that the amendment changes admission only and no canonical byte, so the expected bytes are the fixture's `canonical.json`.
5. Any other admitted value is left undecided and omitted; the only such case is zero for `rdfDeepIterations`.

For the replacement records, the script also checks that each predecessor input has the bytes of the fixture's `source.json`, and that the amended-policy manifest pins both fixture files.
It checks that the predecessor's own `rdf-quad-limit-exact` record expects the same canonical bytes for the same fixture.
The reasons quote the fixture counts that the amended-policy manifest records: no primary records, 9 blank nodes and 20 quads.
With 9 blank nodes, the deep-iteration allowance `min(B * B, rdfDeepIterations)` that the Overrides section keeps for a finite value is 81 for every value from 81 upwards, as under the default.
Each record's `reason` states its own derivation and names the sections of the amendment that it uses, and its `rules` cite them as `unbounded-limits#<anchor>`.

### The correction of 27 October 2026

The owner corrected the amendment on the day of its approval, after this overlay was first derived.
The correction adds a note under the status line and rewrites two sentences of the OWL adapter section.
`derive.mjs` reverses those three edits and requires the result to be the amendment as first read, with SHA-256 `eeddcb4121c6b4b00e0eda990eb9b06c5bdabd0001e52ca28940912a9b7c3e45` and 8518 bytes, so no other sentence changed.

The first rewritten sentence decides the five `expandedXmlBytes` rejections.
They are `option-expandedXmlBytes-above-max-safe-integer`, `option-expandedXmlBytes-fraction`, `option-expandedXmlBytes-null`, `option-expandedXmlBytes-negative` and `option-expandedXmlBytes-zero`.
The first-read text said that operations that read no XML accept the limit and ignore it, which left open whether they validate its value.
The first derivation read it as validating the value without counting against it, and recorded that reading for review.
The corrected text says that operations that read no XML validate the limit like any other and otherwise ignore it, so the authority now decides that `canonicalize` rejects these values.
The second rewritten sentence gives each bound that the adapter derives from a limit the code of that limit; it concerns only `fromOwl`, so no vector depends on it.

Deriving the overlay again from the corrected text changed no vector id, input, option or expectation, and no `replaces.recordSha256`.
It changed the amendment pin and the authority's role, the wording of the seven `expandedXmlBytes` reasons and of two omissions, and the digests that follow from them.

## Reproduction

From the repository root:

```text
node packages/vowl/conformance/supplemental/unbounded-limits-v1/derive.mjs
node packages/vowl/conformance/supplemental/unbounded-limits-v1/derive.mjs --write-new
```

The first command writes nothing.
It checks the pins, derives the manifest and the provenance record, and requires each file on disk to equal its derivation byte for byte.
It also requires the directory to hold only this supplement's four files, and this README to list every vector and to record the current pins.
On success it prints a summary and exits with status 0; on any mismatch it prints one line that names the problem and exits with status 1.
`--write-new` creates missing derived files only and then makes the same comparison; it never replaces an existing file.
Both derived files pin `derive.mjs`, so any edit to the script needs both files to be derived again and reviewed.
The script uses only Node.js built-ins and the corpus reader [`storage.mjs`](../../storage.mjs), which returns the bytes of corpus members as the [storage guide](../../STORAGE.md) describes.

## Consuming the manifest

Run the nine records that carry `replaces` instead of the predecessor records with the same `id`, matched by exact `id`, the predecessor manifest hash and `replaces.recordSha256`.
Run the other records as additional vectors.
Never merge anything under `historical` into the active fields.
For each vector, parse the input with an ordinary JSON parser, such as `JSON.parse`, and pass the resulting value to `canonicalize` with the recorded `profile` and `options`.
`expectedError: null` means that the operation must succeed and that its complete result must equal the bytes named by `expectedCanonical`, which have no trailing newline.
Input, fixture and manifest paths are relative to `packages/vowl/conformance`, and authority paths are relative to the repository root.

## Omissions and open questions

The manifest omits these cases, and the provenance record lists them under `omittedCases`.

1. **`Infinity` for each limit.**
   `Infinity` has no JSON spelling, so a JSON manifest cannot pass it as an option value.
   This leaves untested the Overrides rules that `Infinity` lifts only its own limit, that `rdfDeepIterations: Infinity` also lifts the `B * B` term, and that `deadlineMs: Infinity` sets no deadline while the caller's signal still cancels.
   It also leaves untested the OWL adapter rule that `expandedXmlBytes: Infinity` lifts the parser's internal-entity controls.
   Question: how should a corpus manifest spell an option value that JSON cannot carry, for example as a reserved marker that a runner converts before the call?
2. **`NaN` for each limit.**
   `NaN` has no JSON spelling either, although the Overrides section decides that it fails with `OPTION_INVALID`.
   Question: the same as for `Infinity`.
3. **Zero for `rdfDeepIterations` on this fixture.**
   The Overrides section admits zero for `rdfDeepIterations`, so `OPTION_INVALID` does not apply, but the result depends on whether canonicalizing `empty-structural` needs any deep comparison.
   Neither the authority nor the frozen corpus records that count, and `rdf-deep-zero` already shows that zero is admitted.
   Question: does canonicalizing `empty-structural` invoke RDFC-1.0 deep comparison at all?
4. **The four retained defaults.**
   Each needs an input that crosses the default, while every vector here reuses the `empty-structural` source.
   A depth witness also needs a counting convention, a deep-iteration witness needs a graph whose deep-comparison count only running RDFC-1.0 would show, and a deadline witness is a timing outcome, which A7 says is not canonical content.
   The `expandedXmlBytes` default applies only in `fromOwl`.
   Question: for `depth`, does the outermost container count as depth 1 or as depth 0?
   A8 counts embedded JSON containers without saying.
5. **Deadline timing.**
   `option-deadlineMs-max-safe-integer` shows only that a deadline longer than the host's largest timer delay does not expire early on a small input.
   Whether a finite deadline expires at its actual time needs an executable timing harness, as the predecessor manifest's notes say of timing controls.
   This raises no question about the authority.
6. **`expandedXmlBytes` in `fromOwl`.**
   Crossing the limit in `fromOwl` fails with `MODEL_RESOURCE_LIMIT`, which the corrected OWL adapter section names as the code of `expandedXmlBytes`.
   A witness needs RDF/XML or OWL/XML input and the `fromOwl` operation, outside the `canonicalize` shape of the predecessor records.
   Question: is the limit counted per document, or summed over the root document and its imports as A8 aggregates the adapter's other counters?
   Question: is a stop by the parser's own internal-entity controls, which apply while the limit is finite, a bound that the adapter derives from `expandedXmlBytes`, so that it too fails with `MODEL_RESOURCE_LIMIT`?
7. **The adapter's derived bounds.**
   The numeric-literal digit, profile-check work, import count and import depth bounds apply only in `fromOwl` and need OWL input.
   The corrected OWL adapter section says that each fails with the code of the limit that it derives from.
   Question: in what unit is profile-check work counted, so that a witness can cross `2 * embeddedValues` exactly?
   Question: which codes are those of `stringBytes`, `embeddedValues`, `primaryRecords` and `depth`?
   The A7 table lists four resource-limit codes under one meaning, and neither A8 nor the amendment assigns one to each limit.
8. **Host limits.**
   Whether an input reaches the call stack or the largest allocation depends on the host and on how an implementation processes it, so no fixed input has a decided outcome.
   The manifest format also has no field for `details.resource`.
   Question: must a conforming implementation process some minimum nesting depth or size before it may fail with `HOST_RESOURCE_LIMIT`?
9. **The application's retained policy.**
   The WebVOWL client's checks against A8's former upper bounds belong to the application, not to the package corpus.
   This raises no question about the authority.

## Repository JSON quality gate

The repository JSON gate was not run, because the independence rules for this supplement excluded its configuration and its engine, which lives under `node_modules/`.
The two JSON files of this supplement are ASCII and contain no prohibited code point.
The manifest does contain 9007199254740992, which lies outside the range that I-JSON, RFC 7493 section 2.2, says a receiver can treat as exact, so an interoperability check may report it.
The value is exactly representable, and it is the point of the ten `above-max-safe-integer` vectors.

## Provenance

The expectations were derived from the corrected amendment, which was read completely, from sections A7 and A8 of the core contract, and from the frozen corpus files pinned in the provenance record.
The provenance record also keeps the first-read revision of the amendment and the three edits of the correction under `firstRead`.
The amendment was read from the working tree, where Git does not yet track it, so it is identified by its digest alone.
The [provenance record](provenance.json) quotes under `reliedText` every sentence of the two authorities that the derivation relies on, and `derive.mjs` stops if any of them is no longer present.
The resource-policy and embedded-work amendments were also read, for context only, and nothing relies on them.
Other corpus files were read only for their formats and conventions: those listed under `consultedConventions` in the provenance record, and a search of the corpus JSON for the names of expectation and pointer fields.
To place the new files, `.gitattributes` was read, and `git status` and `git ls-files` were run, read-only, to confirm that the frozen files are tracked and unmodified.

Not read: `packages/vowl/src/`, `packages/vowl/test/`, `packages/vowl/scripts/`, the top-level `src/` and `util/`, `node_modules/`, `.json-quality.json`, `docs/plans/`, `docs/canonical-vowl/`, and Git history and diffs.
The other documents in `docs/specs/` were not read, apart from a text search for the option and host-limit error codes, which matched only the amendment and the core contract.
No production code or runtime output was used to choose or check any expectation, and no module of the `vowl` package was imported or executed.
What was run: `derive.mjs`, and the Markdown quality check and its in-memory formatter on this README.
Helpers outside the repository confirmed that the record-hash rule reproduces the hashes of the two camera overlays, and printed the vector tables of this README from the manifest.
They also cross-checked the written records against the frozen files, and exercised the script's refusal and mismatch paths on a disposable copy of the files that it reads.
After the correction, a helper compared the two derivations record by record.

The manifest is not registered with any test runner, and no file outside this directory was modified.
