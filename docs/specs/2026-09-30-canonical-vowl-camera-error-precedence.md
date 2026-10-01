# Canonical VOWL camera error precedence clarification

Status: accepted on 30 September 2026 when the owner instructed the implementation task to proceed with the pending recommended decisions.
This is a bounded clarification of A7/B3 validation order, not a change to accepted camera values or successful canonical bytes.

## Observed disagreement

B3 defines `Camera.zoom` as `Number` greater than zero.
A7 places scalar-domain checks at stage 4 and assigns `NUMBER_INVALID` to invalid numeric domains, while stage 7 explicitly names camera/placement invariants.
A1's general `Number` domain is finite binary64 excluding negative zero.

The independent oracle interprets zoom positivity as the camera-specific stage 7 invariant and expects `ARTIFACT_INCOMPLETE` for `zoom:0` or `zoom:-1`.
The independent protocol reviewer interprets B3's positivity constraint as a field-specific scalar domain at stage 4 and expects `NUMBER_INVALID`.
The current runtime implements the latter interpretation.
Both interpretations reject the invalid camera and preserve every successful byte sequence, but they disagree on the stable error code and which defect wins when a reference, primary ID or projection is also invalid.

The frozen independent cases are in `packages/vowl/conformance/supplemental/field-contract/semantic-negative-manifest.json` and `semantic-overlap-manifest.json`.
The two isolated camera cases and three reference/ID/projection overlap cases require the accepted supplemental correction; their original expected records are preserved.
Runtime agreement is not authority to rewrite those expectations.

## Accepted clarification

Add this sentence to A7's scalar-domain description:

> B3's strictly positive camera zoom is a numeric scalar-domain check at stage 4; a finite zero or negative zoom fails with `NUMBER_INVALID` before graph or artifact-completeness validation.

Negative zero and nonfinite numbers retain their existing rejection at input construction or scalar admission.
Placement coverage, hidden-set incidence closure and other structured artifact invariants remain at stage 7.
This keeps numeric field-domain checks together and preserves the current runtime behavior.
The implementation must add a versioned independent expectation correction without overwriting the frozen producer inputs or manifests.

The alternative is to explicitly place finite zero/negative zoom at stage 7 with `ARTIFACT_INCOMPLETE`, then move the runtime check and qualify the earlier-reference/ID/projection precedence.
The five disputed cases would then keep their original expectations.

The implementation plan's maximum autonomy says to "stop the affected work at a material contract, rights, recovery, or approval gap."
The owner decision closes this contract gap; independent review and executable validation of the corrected expectations remain required.
