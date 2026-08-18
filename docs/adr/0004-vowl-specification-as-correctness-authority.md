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
and only a specification distinguishes the two. The rule happened to be correct,
but the reasoning could not establish that.

No confirmed divergence between OWL2VOWL and the specification has been found.
One was reported during this investigation and then withdrawn: a passage listing
`owl:allValuesFrom`, `owl:someValuesFrom` and `owl:hasValue` as "not part of the
VOWL visualization" was read as excluding restriction edges, when in full
context it groups those terms with `owl:Restriction` and `owl:onProperty` as
containers that receive no graphical element of their own, and includes
`rdfs:comment`, which WebVOWL does display. The passage means "not a graph
element in its own right", not "discarded". That retraction is itself the
argument for this ADR: without a pinned specification the claim could be neither
made nor refuted, and the project had no artifact against which either could be
checked.

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
3. **Separate three authorities, each belonging to exactly one layer**, because
   conflating them erodes the architecture the migration exists to build:
   - **`owlapi-js`** follows the **W3C OWL 2 specifications**. It is a
     general-purpose OWL library intended for extraction as a standalone
     package and **MUST NOT** contain any VOWL concept. `owlapi-js` is not
     governed by the VOWL specification in any respect.
   - **`VOWLBuilder`**, on the WebVOWL side of the seam, follows the **VOWL 2.0
     specification**. Section 15.1 already assigns it OWL and VOWL knowledge and
     nothing else; this decision names the document that governs the VOWL half.
   - **The VOWL-JSON serialization** follows the **OWL2VOWL implementation**,
     legitimately, because the VOWL article names VOWL-JSON as "the format used
     in WebVOWL" rather than specifying it. Nothing else defines the field
     shapes, so the implementation is the only available authority and this must
     be stated rather than left ambiguous.
4. **Build an exhaustive construct classification** from the specification's
   Tables 4 through 9 and its exclusion list, classifying every construct
   `IMPLEMENTED`, `DEFERRED` or `UNSUPPORTED_BY_DESIGN` with evidence, in the
   manner already used for parser conformance.
5. **Make specification-versus-oracle divergence explicit.** Where the pinned
   specification and OWL2VOWL disagree, the disagreement is recorded as a
   governed expected difference naming the specification as authority. It is
   not resolved silently by copying the oracle.
6. **Do not change rendering behaviour under this ADR.** The migration's goal is
   that replacing the Java engine with the JavaScript one is transparent to
   WebVOWL's end users. Bug fixes and improvements are deferred until the parser
   programme is complete, so a recorded divergence is not licence to change
   output mid-migration. Where a divergence is also user-visible, the conflict
   between specification conformance and user transparency is escalated to the
   repository owner rather than resolved by the implementing team.

## Rationale

Agreement between implementations is not evidence of correctness, and three
implementations agreeing is not stronger evidence than one. A defect in
OWL2VOWL would propagate into the legacy converter and then into the new
builder, and the entire test suite would remain green throughout, because every
existing test compares implementations to each other.

The withdrawn `someValuesFrom` claim shows the same gap from the opposite side.
Without a pinned specification, a mistaken divergence report could not be
checked and refuted either. Pinning the document makes both directions
falsifiable.

Point 3 matters because over-claiming would be its own error. There is no VOWL
-JSON specification to conform to. Declaring the implementation authoritative
for the serialization is accurate, and pretending otherwise would manufacture a
conformance obligation that no document supports.

Point 6 keeps this ADR to what the evidence supports. The specification is dated
April 2014 and describes itself as incomplete for OWL 2, while the later VOWL
article describes WebVOWL 0.4.0 as "a complete implementation of VOWL 2". A
future divergence may therefore be a defect or an unspecified post-2014
extension, and distinguishing them requires the notation tables rather than a
single sentence. Changing user-visible output is in any case a product
judgement, not a governance one.

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
- A capability `webvowl.vowl-spec-conformance` is added as `DEFERRED` with no
  phase, because conformance is explicitly post-migration work. The matrix
  currently cannot express whether the project conforms at all.
  `webvowl.legacy-output-parity` remains the `REQUIRED_V1` bar.
- `src/owlapi-js/coreIsolation.architecture.test.js` asserts that no shipped
  module under `src/owlapi-js/` mentions VOWL and that none imports from outside
  the library tree. That boundary was previously unguarded in this direction,
  and it was the boundary an earlier draft of this ADR described incorrectly.
  The gate was verified by adding a VOWL reference to a core module and
  observing the failure.
- Existing differentials are reclassified in description, not in behaviour:
  `owl2vowl-reference` measures compatibility and remains valuable for
  protecting user-visible output against regression. It stops standing in for
  correctness.
- Phase 8 findings must record that the restriction and enumeration decisions
  were reached from oracle silence and only retroactively confirmed against the
  specification. The outcome held for `owl:hasValue`; the reasoning did not.
- `owl:DataRange` also appears in that passage, so the `dataRangeRecord`
  collapse added in Phase 8 needs review against the specification rather than
  against the oracle.
- The divergence register starts empty. That is the accurate state, not a gap:
  no OWL2VOWL departure from the specification has been established.

## Verification obligations

- The pinned artifact's per-file hashes **MUST** be verified by an executable
  test, and that test **MUST** be observed failing against a corrupted manifest.
- No shipped module under `src/owlapi-js/` **MAY** reference VOWL, and that
  boundary **MUST** be enforced by an executable test rather than by review.
- The construct classification **MUST** account for every construct in Tables 4
  through 9 and every construct named in the no-graphical-representation
  passage, with no unclassified remainder.
- A specification-versus-oracle divergence **MUST NOT** be recorded, in either
  direction, without quoting the deciding specification passage **in the
  context that surrounds it**. A single grepped sentence is not sufficient
  evidence; the withdrawn `someValuesFrom` claim was produced exactly that way.

## Implementation map

| Change                        | Location                                                     |
| ----------------------------- | -------------------------------------------------------------- |
| Pinned specification package  | `docs/owlapi-js/conformance/upstream/vowl-2/`                |
| Hash manifest                 | `docs/owlapi-js/conformance/upstream/vowl-2/SHA256SUMS`      |
| Suite entry and authority scope | `docs/owlapi-js/conformance/suites.json`                   |
| Pin verification gate         | `src/owlapi-js/governance.test.js`                           |
| Core isolation gate           | `src/owlapi-js/coreIsolation.architecture.test.js`           |
| Capability                    | `docs/owlapi-js/compatibility/capabilities.json` (to add)    |
| Construct classification      | `docs/owlapi-js/conformance/classification-manifests.json` (to add) |
| Normative amendment           | `docs/owlapi-js/implementation-plan.md` §15, §18 (to add)    |
