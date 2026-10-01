# Canonical VOWL lexical precedence and edge direction clarifications

**Status:** Accepted on 30 September 2026 when the owner instructed the implementation task to proceed with the pending recommended decisions.
This is not a profile freeze.

The independent [protocol and corpus review](../reviews/canonical-vowl-protocol-clarification-review.md) found one conflict and two underspecified ordered fields in the September 24 contracts.
This clarification resolves them using the behavior already shared by the experimental core and independent corpus.
It leaves all frozen expected artifacts intact and introduces no new model field, projection, renderer glyph or fallback.

## Decoder precedence

Replace A7 validation-precedence item 3 with:

> Fatal UTF-8 and byte-order-mark checks, then JSON grammar, decoded member names, Unicode-valid decoded strings, finite JSON numbers other than negative zero, and lexical limits in token encounter order.

For byte decoding, Unicode and JSON-number admission belong to that lexical/construction stage, before the envelope's required/type/known-profile checks in item 4.
Unicode admission uses A7's existing lone-surrogate and I-JSON noncharacter rules.
Number admission uses the existing finite-number and negative-zero restrictions; other field-specific scalar domains remain in item 4.
This makes A7 agree with D19 steps 3–5.
Programmatic snapshot precedence, the remainder of A7's order, error codes, resource limits and observed abort/deadline precedence are unchanged.

Consequently, decoding the existing overlapping fixture `{"profile":"\ud800"}` yields `UNICODE_INVALID`, although it also lacks `structural` and has no known valid profile.
Its historical expected error is preserved.
Valid-envelope Unicode fixtures remain necessary to isolate Unicode rejection independently of this precedence decision.

## Inverse-edge endpoints

After B2.4's rule selecting the `forward` inverse-property partition, add:

> An `inverse-edge`'s `from` is the effective domain occurrence of its selected `forward` partition, and its `to` is that partition's effective range occurrence.
> The `reverse` partition therefore runs from `to` to `from`.
> Equal sides produce the already specified self-loop.

The existing partition comparison, exact reversed-endpoint condition, construct references and labels are unchanged.
This explicitly binds the ordered wire fields; the bidirectional VOWL glyph alone does not determine them.

## Operator-edge endpoints

After B2.4's instruction to connect a drawable class operator to each drawable operand, add:

> An `operator-edge`'s `from` is the operator's class-node occurrence, and its `to` is the drawable operand's node occurrence.
> Deduplication still applies to connections landing on the same class group for that expression.

This binds the ordered wire fields without adding an arrowhead or changing the treatment of undrawable operands.

## Acceptance evidence and limits

Acceptance requires a recorded owner decision, exact-byte agreement for the inverse-orientation and class-operator vectors against both producers, and decoder checks against the independently pinned Unicode/error expectations.
The independent negative runner reproduces input/error records; it is not an independent decoder and does not establish independent runtime agreement on error precedence.
The decision must be added as supplemental provenance; it must not rewrite the specification hashes in historical manifests.
This decision does not resolve unrelated corpus coverage gaps or establish mapping freeze, canonical-profile freeze, application cutover or publication.
