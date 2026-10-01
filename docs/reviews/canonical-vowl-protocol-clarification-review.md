# Canonical VOWL protocol clarification review

## Independent target and scope

On 30 September 2026, the independent protocol/corpus reviewer assessed the four September 24 specifications and the approved editing/resource amendments without reading production source or tests.
The plain review clone retained base commit `4f1970e5b6c95655af823c495bd58f9e9993f8b8` and index tree `998264bd10db23cd9149bd74fc8430feeb77998c`.
All 1,336 pinned file hashes matched before and after review; the worktree diff remained empty.
The file-manifest SHA-256 is `bd20ee99e10d83717c9a084c7136d85532b1b11765159750d3a320dede90dcea`.

The reviewer read 98 clause descriptions, 127 branches across 76 expanded B2.5 rows, all 82 new positive source/occurrence expectations, all 30 conditional negative recipes, the prior seed/extended and 69 supplemental grammar recipes, and all 46 display expectations.
Exact outputs and permutations were checked by reproduction runners; this was not a manual audit of every N-Quads line.
The parent-attributed 545 core tests and 181 Chrome checks were not executed by this reviewer.

## Decisions needed before freeze

1. A7 puts envelope required/type/known-profile checks before scalar domains, whereas D19 rejects malformed Unicode and invalid JSON numbers during construction before profile/schema checks.
   The existing `negative/lone-surrogate/input.bin` is exactly `{"profile":"\ud800"}` and expects `UNICODE_INVALID`; its missing envelope fields make the conflict observable.
   The separate valid-envelope surrogate fixture establishes rejection, but cannot choose the precedence of the overlapping case.
2. B2.4 selects an ordered `forward` inverse partition without explicitly binding its domain/range to the inverse edge's `from`/`to` fields.
   The independent `matched-inverse`, `inverse-full-property-partitions` and `inverse-orientation-opposes-role-rank` vectors consistently use forward domain → forward range.
3. B2.4 connects class operators to operands without explicitly assigning `from` and `to`.
   The independent class-intersection, class-complement and conditional operator vectors consistently use operator → operand.

The [bounded wording proposal](../specs/2026-09-30-canonical-vowl-protocol-clarifications.md) makes these choices explicit while preserving every existing successful expected byte sequence.
VOWL 2's bidirectional inverse and arrowless operator glyphs do not choose a unique ordered wire representation.
Owner approval remains pending.

## Findings resolved by existing text

B2.2 includes builtin roles only when a projection needs them.
That resolves the unused-default question for an undrawable opposite endpoint without changing `undrawable-range-no-default-role` or `undrawable-range-declared-thing`.
D14.3 explicitly states that an anonymous root ontology classifies no subject as external, resolving `display-vectors.json#anonymous-root-local`.
Historical interpretation metadata is retained; `packages/vowl/conformance/supplemental/review-resolution-v1/review-resolution.json` records these dispositions separately.

## Reproduction and provenance

On Windows x64, Node 24.21.0, locale `en-GB`, timezone `Europe/Bucharest`, 16 of 17 advertised no-write reproduction commands exited zero.
They reproduced the seeds, extended/mutation cases, grammar cases, negative inputs, producer guards, all 177 amended/conditional positives and the expanded inventory.
The original `oracle/derive-catalogs.mjs` covers 70 original matrix rows; the later conditional inventory expands these to 76 rows and 127 branches.

The old `supplemental/derive-index.mjs` exited 1 with `provenance-index.json: reviewed metadata is never silently overwritten`.
Its recursive inventory included twelve newly added conditional scripts/manifests absent from the frozen 83-artifact index.
The independent conditional provenance reproduced successfully.
This is an advertised-command reproducibility defect, not evidence of corrupted expected bytes.
The repair adds `supplemental/review-resolution-v1/verify-frozen-scopes.mjs`, a no-write verifier over explicit entries in both unchanged indices.
Its producer-observed run verifies 83 baseline and 17 conditional artifact entries, 11 recorded manifests, 1,291 unique files and 1,957 explicit pin checks.
Its optional self-check rejects two in-memory digest mutations and two length mismatches; no expected file or old index is regenerated.
Independent review reproduced those checks, rejected thirteen invalid path probes, verified twelve repair-metadata pins and confirmed all 1,291 resolved paths remain inside the conformance root.
It found no defects in this bounded repair; the owner protocol decisions above remain pending.

The amended producer changes exactly `min(B, 100000)` to `min(B * B, 100000)`, preserves all 92 prior successful outputs and supplies three separately pinned successes.
That observation qualifies the producer's default allowance, not public override, cancellation, deadline or security behavior.
Negative runners reproduce inputs and expected-error records rather than implementing a complete independent validator; the display runner reproduces its catalog rather than exercising application behavior.

The reviewer found no additional incorrect expected topology in the inspected source expectations.
Eleven renderer/interaction obligations, full resource boundaries, wider environment qualification and recorded owner acceptance remain open.
This review supports continued experimental work and does not establish SLICE-002 completion or authorize freeze.
