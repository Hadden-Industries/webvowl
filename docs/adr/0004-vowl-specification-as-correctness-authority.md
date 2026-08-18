# ADR 0004: Adopt the VOWL 2 specification as the correctness authority for visualization output

| Metadata       | Value                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Status**     | Proposed                                                                                  |
| **Date**       | 2026-08-18                                                                                |
| **Decider**    | Repository owner                                                                          |
| **Amends**     | `docs/owlapi-js/implementation-plan.md` §15 and §18; `docs/owlapi-js/conformance/suites.json` |

## Context

The migration governs OWL *input* rigorously. Section 22.2 requires language
semantics to be implemented from normative specifications, permits the Java
OWLAPI only as a black-box behavioural oracle, and forbids treating an
implementation as a template. Every ingestion phase carries a conformance suite
pinned by immutable revision.

No equivalent discipline was ever applied to the VOWL *output*. The
implementation plan names the VOWL specification exactly once, in a background
sentence, and never cites it normatively. `conformance/suites.json` pins the
W3C RDF, JSON-LD, OWL 2 and OWL/XML suites but contained no VOWL entry, and
`capabilities.json` has no capability expressing conformance to VOWL at all.

Consequently every correctness claim about visualization output reduced to
"matches OWL2VOWL 0.3.7" or "matches the retained legacy converter". Both are
compatibility measurements. Neither can detect an error the reference
implementation itself makes, and the project had no artifact against which such
an error could even be defined.

This was not theoretical. During Phase 8 the rule that value restrictions
produce no visual element was derived from the observation that the oracle
emits no `owl:hasValue` anywhere in its 44 reference outputs. That inference is
circular with respect to intent: zero occurrences is equally consistent with the
notation excluding the construct and with the tool never having implemented it,
and only a specification distinguishes the two.

The specification was then recovered and read. It settles that case and
immediately exposes another:

> "OWL elements such as `owl:allValuesFrom`, `owl:someValuesFrom`,
> `owl:hasValue`, `rdfs:comment`, `rdfs:seeAlso`, `rdfs:isDefinedBy`, and
> `owl:DataRange` are not part of the VOWL visualization but could be displayed
> in another way"

`owl:hasValue` is excluded, so the Phase 8 decision was correct by accident.
`owl:someValuesFrom` and `owl:allValuesFrom` are excluded by the same sentence,
yet OWL2VOWL emits them as edge types 222 and 76 times respectively, the
retained legacy converter does the same, and `VOWLBuilder` inherited the
behaviour in Phase 7. Three independent implementations agree with each other
and diverge from the specification, and no existing test can see it.

The specification's canonical locations no longer resolve. `purl.org/vowl/spec/`
redirects into a broken chain, and `vowl.visualdataweb.org` now serves an
unrelated site. The surviving complete copy is a third-party recovery.

## Decision

1. **Pin the recovered VOWL 2.0 specification** as a conformance suite, by Git
   commit and per-file SHA-256, exactly as the W3C OWL 2 suite is pinned.
2. **Record its provenance honestly.** It is a recovered copy whose content
   identity is well corroborated and whose byte identity with the 2014 origin
   server is not established. That distinction is recorded in the suite entry
   and must not be flattened into "the specification".
3. **Separate three authorities**, because they are genuinely different:
   - OWL semantics: the W3C specifications (already governed).
   - VOWL visual notation: the VOWL 2.0 specification (this decision).
   - VOWL-JSON serialization: the OWL2VOWL implementation, legitimately, because
     the VOWL article names VOWL-JSON as "the format used in WebVOWL" rather
     than specifying it. Nothing else defines the field shapes, so the
     implementation is the only available authority and this must be stated
     rather than left ambiguous.
4. **Build an exhaustive construct classification** from the specification's
   Tables 4 through 9 and its exclusion list, classifying every construct
   `IMPLEMENTED`, `DEFERRED` or `UNSUPPORTED_BY_DESIGN` with evidence, in the
   manner already used for parser conformance.
5. **Make specification-versus-oracle divergence explicit.** Where the pinned
   specification and OWL2VOWL disagree, the disagreement is recorded as a
   governed expected difference naming the specification as authority. It is
   not resolved silently by copying the oracle.
6. **Do not change rendering behaviour under this ADR.** Whether WebVOWL should
   remain bug-compatible with OWL2VOWL or move toward the specification is a
   separate product decision. This ADR makes the divergence visible and
   measurable; it does not pre-empt that decision.

## Rationale

Agreement between implementations is not evidence of correctness, and three
implementations agreeing is not stronger evidence than one. The
`someValuesFrom` case demonstrates the failure mode concretely: a defect, or a
deliberate post-specification extension, propagated from OWL2VOWL into the
legacy converter and then into the new builder, and the entire test suite
remained green throughout because every test compared implementations to each
other.

Point 3 matters because over-claiming would be its own error. There is no VOWL
-JSON specification to conform to. Declaring the implementation authoritative
for the serialization is accurate, and pretending otherwise would manufacture a
conformance obligation that no document supports.

Point 6 keeps this ADR to what the evidence supports. The specification is dated
April 2014 and describes itself as incomplete for OWL 2. The later VOWL article
describes WebVOWL 0.4.0 as "a complete implementation of VOWL 2", which leaves
open whether restriction rendering is a defect or an unspecified extension.
Deciding that requires reading the full notation tables, and changing user
-visible output requires a product judgement rather than a governance one.

## Consequences

- `conformance/suites.json` gains a `vowl-2` suite entry with an
  `authorityScope` field stating what the document does and does not govern.
- `governance.test.js` verifies the pinned revision, document version and date,
  and recomputes every recorded file hash. The gate was verified by corrupting a
  recorded hash and observing the failure.
- The specification package is committed under
  `docs/owlapi-js/conformance/upstream/vowl-2/`, retaining both `index.orig`
  and `index.html`. `index.orig` is primary: it preserves the original absolute
  hyperlinks, while `index.html` has dead links rewritten to `#`. Their
  tag-stripped text is identical, so the difference is link rewriting only.
- A capability `webvowl.vowl-spec-conformance` is required; the matrix currently
  cannot express whether the project conforms.
- Existing differentials are reclassified in description, not in behaviour:
  `owl2vowl-reference` measures compatibility and remains valuable for
  protecting user-visible output against regression. It stops standing in for
  correctness.
- Phase 8 findings must record that the restriction and enumeration decisions
  were reached from oracle silence and only retroactively confirmed against the
  specification. The outcome held for `owl:hasValue`; the reasoning did not.
- `owl:DataRange` also appears in the exclusion list, so the `dataRangeRecord`
  collapse added in Phase 8 needs review against the specification rather than
  against the oracle.

## Verification obligations

- The pinned artifact's per-file hashes **MUST** be verified by an executable
  test, and that test **MUST** be observed failing against a corrupted manifest.
- The construct classification **MUST** account for every construct in Tables 4
  through 9 and every construct in the exclusion list, with no unclassified
  remainder.
- A specification-versus-oracle divergence **MUST NOT** be recorded as a defect
  in either direction without citing the specification passage that decides it.

## Implementation map

| Change                        | Location                                                     |
| ----------------------------- | -------------------------------------------------------------- |
| Pinned specification package  | `docs/owlapi-js/conformance/upstream/vowl-2/`                |
| Hash manifest                 | `docs/owlapi-js/conformance/upstream/vowl-2/SHA256SUMS`      |
| Suite entry and authority scope | `docs/owlapi-js/conformance/suites.json`                   |
| Pin verification gate         | `src/owlapi-js/governance.test.js`                           |
| Capability                    | `docs/owlapi-js/compatibility/capabilities.json` (to add)    |
| Construct classification      | `docs/owlapi-js/conformance/classification-manifests.json` (to add) |
| Normative amendment           | `docs/owlapi-js/implementation-plan.md` §15, §18 (to add)    |
