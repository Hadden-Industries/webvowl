# Canonical VOWL lexical failure position: decoder plan

**Date:** 26 October 2026.
**Decision owner:** Maksym Shostak.
**Status:** Implemented on 26 October 2026, except step 5; see [Outcome](#outcome).

## Decision

On 26 October 2026 the owner accepted two clarifications while the encoding and exact decoding section of the [Canonical VOWL specification](../canonical-vowl/index.html) was being consolidated.
Both are recorded in that document's appendix of clarifications accepted during consolidation.

1. For in-memory input, Unicode and number admission happen while the snapshot is taken, at the start of A7 stage 4 (the specification's "In-memory input").
   The reference implementation already behaves this way; this plan only pins it with tests.
2. Stage-3 failures are reported in order of failure position, the byte offset defined in the specification's "Failure positions".
   Failures at the same position follow the stage's listed order: JSON grammar, decoded member names, Unicode-valid strings, numbers, lexical limits.
   The reference decoder did not follow this rule when this plan was written.

Neither clarification changes a successful byte sequence; each fixes which error an invalid input reports.

## Current behaviour

Probes of the public `decode` at commit `61ae1330` gave these first errors:

| Input                                                 | Limits              | Now                    | Required               |
| ----------------------------------------------------- | ------------------- | ---------------------- | ---------------------- |
| `[1 "\ud800"]`                                        | defaults            | `UNICODE_INVALID`      | `JSON_SYNTAX`          |
| `[1 -0]`                                              | defaults            | `NUMBER_INVALID`       | `JSON_SYNTAX`          |
| `[-0x]`                                               | defaults            | `NUMBER_INVALID`       | `JSON_SYNTAX`          |
| `[-0[`                                                | defaults            | `NUMBER_INVALID`       | `JSON_SYNTAX`          |
| `[-0`                                                 | defaults            | `NUMBER_INVALID`       | `JSON_SYNTAX`          |
| `{"a":"\ud800\x"}`                                    | defaults            | `JSON_SYNTAX`          | `UNICODE_INVALID`      |
| `{"a":"\uffff`, a raw tab, then `"}`                  | defaults            | `JSON_SYNTAX`          | `UNICODE_INVALID`      |
| `[1 [`                                                | `depth: 1`          | `MODEL_RESOURCE_LIMIT` | `JSON_SYNTAX`          |
| `{"a":"`, 40 × `a`, then `\ud800"}`                   | `stringBytes: 16`   | `UNICODE_INVALID`      | `MODEL_RESOURCE_LIMIT` |
| `{"a":"`, 1,500 × `a`, `\ud800`, 600 × `a`, then `"}` | `stringBytes: 1400` | `UNICODE_INVALID`      | `MODEL_RESOURCE_LIMIT` |

These cases already agree and serve as controls:

- `-0` and `[-0]` fail with `NUMBER_INVALID`.
- A raw tab before `\uffff` in one string fails with `JSON_SYNTAX`.
- A lone surrogate before the point where its string exceeds `stringBytes` fails with `UNICODE_INVALID`.
- A repeated member name that crosses `totalStringBytes` inside the name fails with `MODEL_RESOURCE_LIMIT`.
- `{"profile":"\ud800"}` fails with `UNICODE_INVALID`.
- For in-memory input to `canonicalize`, a lone surrogate or negative zero fails with `UNICODE_INVALID` or `NUMBER_INVALID` even when an unknown or mistyped member precedes it, and so does a member name containing a lone surrogate.

The differences come from [`parseBytes`](../../packages/vowl/src/lexicalJson.js):

- Unicode, number, depth and count checks run in `tokenizer.onToken` before `parser.write(entry)`, which is where a token in a position the grammar does not allow is rejected.
- The tokenizer emits a number only when the byte after it arrives, so `NUMBER_INVALID` is raised before that byte's grammar is checked.
- An invalid escape or raw control character inside a string fails in the tokenizer before the string's content is checked, which hides an earlier Unicode or limit failure in the same string.
- [`checkString`](../../packages/vowl/src/snapshot.js) bounds `stringBytes` every 1,024 code units and at the end of each chunk, and `totalStringBytes` is bounded per chunk or token, so a limit crossed before a lone surrogate in the same block is reported after it.

## Test-first sequence

1. **Pin clarification 1.**
   Add the three in-memory cases to [`admission.test.js`](../../packages/vowl/test/admission.test.js) as characterization tests.
   They pass at once and guard the accepted order against regression.
2. **Write the failing tests for clarification 2.**
   Add a `test.each` table, "reports the stage-3 failure with the smallest failure position", containing the ten differing cases and the byte-input controls, with per-case limits.
   Run `npm test -- --runInBand packages/vowl/test/admission.test.js` and confirm that exactly the ten fail, each with the code in the "Now" column.
   A failure for any other reason is a defect in the test.
3. **Make them pass, one cause at a time**, rerunning the file after each change:
   1. Decide whether each token may appear at its position before running its content checks or charging limits, and reject it at its first byte.
      The decoder already tracks key expectation for each open frame and can extend that state.
   2. Hold a number's `NUMBER_INVALID` until the byte after the number has passed the grammar or the input has ended; a grammar failure at that byte wins.
   3. When the tokenizer fails inside a string, scan the string's bytes from its opening quotation mark to the failing byte for an earlier Unicode or limit failure, stopping at the string limit, and report the earliest.
   4. Check `stringBytes` and `totalStringBytes` at each code point against the remaining allowance, and call the budget only when a limit is crossed.
4. **Run the whole package suite** with `npm run test:vowl`.
   Every existing case, including the frozen corpus, must pass unchanged.
   If a frozen expectation conflicts with the accepted rule, stop and record it; correct it only through a versioned overlay derived from the accepted wording, as `supplemental/accepted-protocol-v1` and `accepted-protocol-v2` do.
5. **Add independent conformance vectors** in a new supplement under [`packages/vowl/conformance/supplemental/`](../../packages/vowl/conformance/supplemental/README.md), following its README.
   The supplement needs a derive script that takes expected errors from the accepted wording without reading production code, a manifest and README, provenance entries, and registration in [`independentCorpus.js`](../../packages/vowl/test/independentCorpus.js).
6. **Measure decoding of the largest corpus inputs** before and after step 3.4, on an idle machine.
   The per-code-point comparison must not measurably slow decoding.
7. **Update the specification.**
   Remove the decoder exception from the encoding section's editor's note and from the clarification's row in the appendix.

## Constraints

- Keep `@streamparser/json`.
  Replacing or removing a dependency changes `package.json` and the lockfile, which needs the owner's explicit approval first.
- Rewrite no frozen manifest, fixture or historical record.
- Commit only with the owner's authorization, following the `committing-to-git` skill.
  The decoder change, the corpus supplement and the specification update are separate commits.

## Done when

- The new tests, `npm run test:vowl` and `npm run check` pass.
- The supplement reproduces its expectations without writes.
- The specification no longer records the reference decoder as an exception.

## Outcome

The rule is implemented in [`lexicalJson.js`](../../packages/vowl/src/lexicalJson.js), with tests in [`admission.test.js`](../../packages/vowl/test/admission.test.js); the change is not yet committed.

- The four causes were changed in one rewrite, not one at a time.
  The eleven failing tests, the ten above and a lone surrogate before truncation, first failed with the "Now" codes and now pass.
- Four more cases cover the rejected-string scan's raw UTF-8, surrogate-pair and two-byte limit branches.
  Run against the committed decoder, all fifteen targeted cases fail and all nine controls agree.
- The decoder checks strings with its own `admitText`, at each code point.
  `checkString` keeps its block-wise limit checks for its other callers, which are in-memory snapshots, display-order keys, OWL loading and RDF export, so their behaviour is unchanged.
- A `JSON_SYNTAX` error now reports the exact failure position as its `byteOffset`, instead of the offset of the last token.
- Migration input shares this lexer, so legacy VOWL-JSON reports its lexical failures in the same order.
- For step 5 the owner assigned the vectors to a subagent given only the specification sections, the resource authorities and the corpus conventions, because the implementer had read the production code.
  It authored [`lexical-position-v1`](../../packages/vowl/conformance/supplemental/lexical-position-v1/README.md) with 94 vectors, now registered in `independentCorpus.js`.
  At the owner's request it then put each vector's input directly in `vectors/`, one file per vector as the W3C rdf-tests suites do, without changing any input bytes or expected errors.
  All 94 agree with the changed decoder, and 33 of its 86 `decode` vectors fail on the committed one.
  Its README lists seven cases left out because the written rules do not decide them, chiefly which resource-limit code a crossed lexical limit raises when decoding.
- The supplement's derive script pins the specification sections its vectors cite, not the whole draft.
  An edit inside a cited section stops the script until its expectations are reviewed and the pins renewed; edits elsewhere leave it reproducible.
- `npm run check` passed every stage before Jest.
  Jest failed only `src/owlapiConsumerBoundary.architecture.test.js`, whose GNU `tar` call misreads `C:` under Git Bash; commit `ac9461d3` on `feat/architecture-performance-ui` fixes that, but this checkout is `main`.
  The bundle build passed when run on its own.
  With the owner's approval, `.json-quality.json` pins the exact bytes and findings of the supplement's five intentionally invalid sources, and `check:json` passes.

Median `parseBytes` times in milliseconds, with the two versions interleaved on an idle machine:

| Input                                      | Committed   | Changed     |
| ------------------------------------------ | ----------- | ----------- |
| The five largest corpus documents, ~2 KB   | 0.109–0.113 | 0.111–0.118 |
| 4,000 ASCII strings, 1 MB                  | 5.07        | 3.45        |
| 2,000 strings of two-byte characters, 1 MB | 4.69        | 4.46        |
| One 900 KB string                          | 95.4        | 91.5        |
| An object with 50,000 members, 773 KB      | 52.6        | 55.2        |

Printable-ASCII strings skip the per-code-point loop, which makes string-heavy input faster.
The grammar-position check costs about 13 ns per token, 1–5% of `parseBytes` on token-heavy input.
A whole `decode` of the largest corpus documents takes 1.2–2.0 ms, so that cost is under 0.4% of the operation.
