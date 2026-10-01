# Canonical VOWL format admission

## Scope and ownership

The owner requested this bounded SLICE-003 follow-up between SLICE-004 and SLICE-005 on 1 October 2026.
The accepted change removes VOWL's copied format catalogue after the upstream DL and KRSS1 repairs.
Application integration under SLICE-005 remains paused.

The baseline WebVOWL commit is `3c06af70f3649105364815e03bf851ffb8e09932`.
The owning dependency is owlapi merge `3097c6af1e7f47f97f5d90dd23915d83a5bb1489`, delivered by [owlapi PR 26](https://github.com/Hadden-Industries/owlapi/pull/26).
Upstream owns the parser grammar, literal preservation, supported constructs and public format identities.
Its [qualification record](https://github.com/Hadden-Industries/owlapi/blob/3097c6af1e7f47f97f5d90dd23915d83a5bb1489/docs/compatibility/dl-krss1-source-preservation.md) describes the repairs and their limits.
No upstream code change or new parser-capability API is needed in this increment.

The adapter resolves an exact caller-supplied media type against the public `OWLDocumentFormats` metadata.
Exactly one matching format is required, and its public identity is passed to `StringDocumentSource` for exact parser selection.
Zero or multiple matches produce `MAPPING_MEDIA_TYPE_UNSUPPORTED` with the root or resolver media-type pointer.
No filename inference, content sniffing or parser fallback is introduced.

Format identity alone is not a preservation guarantee.
The existing owning manager still loads in `preserve` mode, and `OWL2DLProfile.checkOntology` supplies the full-closure source assessment before the VOWL projection can omit content.
Both mapping profiles retain their existing structural, resource, cancellation, acquisition and diagnostic policies.
The caller's resolver remains the only import acquisition capability.
The production adapter imports only public owlapi package subpaths.

## Regression evidence

The maintained format examples in `packages/vowl/test/owl.test.js` are test fixtures, not a production admission list.
A coverage assertion compares their media types with the owning public catalogue so a future dependency addition requires a representative consumer test.
The added cases cover:

- DL and KRSS1 subclass equivalence with Functional Syntax in both mapping profiles.
- Explicit imported format selection, authored import identity and resolved document context.
- Exact DL lexical forms `0001`, `9007199254740993`, `1.00` and `0.10000000000000001`, including their existing integer or double datatype, through root and import canonical encoding.
- Fatal KRSS1 `:right-identity` rejection and distinct malformed-clause errors at root and import boundaries, with no partial success or dialect fallback.
- Closure-wide role collisions, including a DL ABox assertion that the compatibility projection subsequently excludes.
- Rejection of unknown media types at both boundaries.

`packages/vowl/test/owl-format-selection.test.js` supplies controlled metadata at the external `owlapi/formats` boundary while retaining genuine format objects and real parsers, source assessment and mapping.
A unique synthetic alias must succeed, proving there is no copied production allowlist.
A media type shared by two formats must fail at root and import boundaries in both mapping profiles.
The ordinary adapter tests also preserve exact matching for case and parameter variants.

The original implementation rejected the two positive root cases with `MAPPING_MEDIA_TYPE_UNSUPPORTED`.
After removing the copied catalogue while retaining the old installed dependency, the numeric regressions exposed lexical rewriting and large-integer rejection; the valid KRSS1 unsupported-clause case incorrectly succeeded.
These are negative controls for the required dependency update.
An initial draft assertion looked for a nonexistent standalone literal collection; it was corrected to the protocol's embedded `data-enumeration.members` before interpreting the literal failures.
No frozen conformance input, expected output, checksum or historical review is changed.

## Current verification status

The owner explicitly approved the two manifest pins and corresponding lockfile entries on 1 October 2026.
The installation changed one package; every one of its 108 installed files matches the previously verified upstream artifact.
Both consumers resolve the same installed package, and the lockfile comparison confirms that only the approved pins and package integrity changed.
The focused adapter and package-boundary run passed all 78 tests with the repaired dependency.
The complete Jest run passed all 8,769 tests in 141 suites, with no failures or skipped cases.
An isolated Chromium 153.0.8010.12 session passed all 1,004 existing worker cases and 28 supplemental admission checks, with no console errors.
The supplemental checks exercise both formats, exact DL literals and fatal KRSS1 rejection at root and import boundaries in both mapping profiles.

The first supplemental browser probe compared literal objects using insertion-order-sensitive JSON strings.
The corrected assertion compares the required literal fields directly and retains the canonical-byte equivalence check.
One corrected browser run passed; the original script and failed probe results remain in the operational evidence.
No product code changed for that test-harness correction.

Claude Code 2.1.285 completed one static review of the frozen nine-file patch with ten context files and found no actionable implementation defect.
Its low-severity ambiguity-coverage gap is closed by the controlled metadata tests; its evidence gap is closed by the retained production-build and documentation-check logs.
The exact-matching examples address its informational suggestion.
A subsequent consistency check updated the dependency notice's old commit reference; no licence text changed.
The affected follow-up run passed all 82 tests in three suites, including the four added review checks.
Production source and dependency bytes are unchanged from the full-suite and browser runs, so their behavioural evidence remains applicable.
The governed build is refreshed for the final test and documentation snapshot; the broad independent review is not repeated.

Final check outputs, the frozen review scope, the single consolidated Claude review and the operational checkpoint are retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/owl-format-admission-20261001-01/`.
The final check scope includes the complete Jest suite, production build, documentation checks and browser-worker qualification.
This consumer qualification does not claim an npm release, new dialect support or completion of SLICE-005.
