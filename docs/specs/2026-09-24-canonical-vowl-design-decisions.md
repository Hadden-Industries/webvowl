# Canonical VOWL research and design decisions

**Decision date:** 24 September 2026.
**Status:** Research-backed design closure for implementation planning; proposed Canonical VOWL rules, not an adopted standard or a qualification report.

This record explains the decisions completing the [design](2026-09-24-canonical-vowl-design.md), [core contract](2026-09-24-canonical-vowl-core-contract.md), and [projection contract](2026-09-24-canonical-vowl-projection-contract.md).
It follows the user's requested research order and the supplied [deep research assessment](../reviews/Deep%20Research%20Assessment%20of%20the%20Proposed%20Canonical%20VOWL%20Representation.md).
The earlier architecture and scope remain the starting point: a closed model in `packages/vowl`, two canonical profiles, compatibility mapping by default, exact annotation retention, external diagnostics, and static portable artifacts.

## C1. Decision method and evidence boundaries

For each open branch, use this ordered procedure:

1. **First principles:** identify the retained distinction, identity guarantee, failure boundary, and smallest sufficient mechanism.
2. **Modern engineering practice:** check maintainable module boundaries, bounded parsing/work, explicit state, immutable values, and current standards-library capabilities against those needs.
3. **Authoritative specifications and guidelines:** check the candidate against the applicable standard's exact semantics and scope.
4. **Adopted community practice:** use existing VOWL notation, RDF library interfaces, and repository behavior as interoperability evidence where the preceding levels leave a choice.
5. **User judgment:** ask only if a material product or value choice remains that those levels cannot resolve within the already agreed scope.

This is an order for evaluating alternatives, not permission to override a standard while claiming conformance to it.
An older authoritative specification can still be the applicable standard; a newer library convention does not replace it.
Existing code is evidence of integration constraints and historical behavior, not the authority for new canonical bytes.

All branches below have a concrete proposed rule and acceptance obligation.
No remaining branch requires a user preference to write the implementation plan, so no grilling round is needed for this revision.
The user-requested grilling fallback remains appropriate if implementation evidence later exposes a choice that changes scope or meaning rather than a routine defect in the implementation.

## C2. Resolved decision tree

| Prerequisite branch                   | Resolved decision                                                                                                                        | Normative location    | Implementation evidence still required                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| Representation identity               | Bind normalized retained VOWL structure, not arbitrary source syntax or OWL entailments.                                                 | Design 1–5; A2–A5.    | Syntax/ordering permutations and retained-distinction fixtures.                  |
| Identity → closed model               | Enumerate all fields and kinds, typed references, annotation values, and set/sequence rules.                                             | A1–A4; B1/B3.         | Closed schemas and semantic validator.                                           |
| Model → normalization                 | Deduplicate exact structures, aggregate endpoint assertions, retain singleton constructors, and use uniform annotated-assertion anchors. | A3–A5.                | Positive/negative normalization and attachment cases.                            |
| Normalized model → graph              | Use one typed structural encoding into the default RDF graph, with explicit containers and fresh auxiliary objects.                      | A6.                   | Template coverage, recovery counterexamples, canonical N-Quads.                  |
| Graph → document identity             | RDFC-1.0/SHA-256, numeric category ranks, then complete-member JCS UTF-8 set ordering.                                                   | Design 17–19; A6.4.   | Independent byte corpus, including symmetry and ordinals above nine.             |
| Bytes → admission                     | Duplicate-safe bounded parsing, closed/semantic validation, graph reconstruction, exact-byte comparison, module-local encode admission.  | A7; design 19.        | Adversarial decoding and cross-module admission cases.                           |
| Model → visual topology               | Specify named equivalence grouping, split contexts, property partitions, eligible inverse/cardinality edges, and details-only cases.     | B1–B2.                | Exhaustive topology fixtures and matrix artifact.                                |
| Topology → portable scene             | Require complete placements, effective visibility, camera, explicit label/prefix/display state, paused restoration.                      | B3.                   | Artifact round trips and browser restoration.                                    |
| Scene → display meaning               | Fix lookup/default/ties, namespace heuristic, builtin exceptions, compact notation, and membership scaling.                              | B4–B5.                | Deterministic display-rule fixtures; separate accessibility checks.              |
| Public operations → bounded execution | Finite counters and override ceilings, explicit RDFC budget, worker cancellation/deadline policy.                                        | A8.                   | Counter boundaries, poison graphs, cancellation and measured performance.        |
| OWL source → normalized model         | Strict full-closure structural checking; finite compatibility recovery catalogue; explicit exclusions.                                   | A9.1–A9.2.            | Parser/closure/profile fixtures and required `owlapi` capabilities.              |
| Historical ingress → normalized model | One fixed initial dialect, explicit profile/resolutions, deterministic loss diagnostics, no automatic layout or dialect detection.       | A9.3; design 26.      | Inventory and mapping of the pinned dialect, ambiguity fixtures.                 |
| Design → delivery                     | Plan now; implement and qualify before freeze; publish only with immutable profile bundles.                                              | Design 23–27; A10/B6. | Executable artifacts, independent results, integration and publication evidence. |

## C3. Identity, normalization, and annotation attachment

First principles require an explicit equivalence relation: two producers may discard syntax and redundant declarations but may not discard a retained lexical value, anonymous subject, ordered chain position, or annotation attachment.
A graph-labeling algorithm cannot choose that relation on the profile's behalf.
Modern module design therefore puts normalization and verification behind one producer-neutral core, with parsers and historical ingress at separate seams.

The OWL structural specification distinguishes ordered constructs from sets and distinguishes structural form from logical equivalence; these are the relevant constraints, not a mandate to reproduce every OWL axiom in VOWL.
The profile's endpoint aggregation and retention boundary are deliberate VOWL choices.
See the [OWL 2 Structural Specification, Second Edition](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/).

The main alternative for annotations was to embed them directly in most constructs but introduce special anchors only for aggregated endpoints.
That makes one source concept depend on two storage conventions and makes aggregation prone to changing attachment.
The chosen rule uses an anchor for every annotated retained assertion, while the base construct stores normalized meaning once.
An anchor's typed assertion must be supported by its base fact, declaration, or endpoint aggregate.
It cannot become an unvalidated second ontology.

The contract explicitly adds annotation-property relationships and RDFS-only class/property categories so compatibility mapping has a typed destination rather than a catch-all attributes object.
N-ary data-range extensions are excluded from v1: the standard's defined data ranges are unary, and combining an extension into separate unary restrictions would invent meaning.
[OWL 2 data ranges](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Data_Ranges).

## C4. Complete mapping rather than an unspecified RDF transformation

First principles require a recoverable encoding of the selected model: present-empty containers, literal lexemes, reference identity, and sequence repetition must survive.
Three candidates were considered:

- Map each VOWL kind through a separately handwritten set of RDF templates.
- Treat the public model as JSON-LD or use OWL's public RDF serialization.
- Encode the closed typed structure with one small set of recursive templates.

The third option is selected.
It keeps field coverage mechanically tied to the grammar and gives a direct inverse-interpretation argument.
The first can work but duplicates template design across many closely related fields; the second brings public RDF/OWL interpretation into a private structural-labeling problem and does not by itself settle the profile's retained distinctions.
This decision does not alter or replace [OWL's standard mapping to RDF](https://www.w3.org/TR/2012/REC-owl2-mapping-to-rdf-20121211/).

The proposed mapping namespace, field-predicate family, default graph, root, type markers, literal boxes, set containers, and sequence slots are all specified in A6.
These are newly formulated Canonical VOWL rules; they are not attributed to W3C.
Fresh auxiliary objects prevent a producer's in-memory object sharing from becoming a graph fact.
The chosen structure also permits an independent implementation without exposing the private RDF representation in the public API.

RDFC-1.0 supplies canonical dataset labeling after that encoding; it does not standardize Canonical VOWL's category IDs or JSON projection.
The profile consequently fixes numeric `c14nN` ranking per primary category and excludes auxiliary nodes from public ranks.
[RDFC-1.0 Recommendation, 21 May 2024](https://www.w3.org/TR/2024/REC-rdf-canon-20240521/).
RDF/JS term and quad interfaces are a useful integration convention, but do not become an extra wire-format authority. [RDF/JS Data Model specification](https://rdf.js.org/data-model-spec/).

## C5. JSON, strings, validation, and errors

First principles require rejecting ambiguity before information is overwritten and distinguishing valid model shape from canonical graph identity.
Ordinary JSON parsing followed by JCS comparison detects a final byte mismatch but cannot recover duplicate-member locations or prove the required graph IDs.
The selected decoder therefore checks lexical duplicates first, validates the closed model, reconstructs the graph, and compares the resulting document and exact bytes.

RFC 8785 is the final serializer: it preserves array order and imposes its own object-name and numeric serialization rules.
The profile separately supplies set ordering and rejects negative zero before serialization.
[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html).
I-JSON also prohibits Unicode noncharacters, not only lone surrogates; A7 now enumerates that additional rejection boundary.
[RFC 7493 section 2.1](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.1).

Semantic IRIs use the RFC 3987 `IRI` grammar with a scheme and optional fragment; they are not browser URLs that may be silently normalized.
Identity remains lexical, consistent with the RDF term model.
[RFC 3987](https://www.rfc-editor.org/rfc/rfc3987.html), [RDF 1.1 Concepts](https://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/).
Language-tag well-formedness is separated from registry-driven preferred forms; ASCII lowercasing avoids a mutable registry becoming an input to canonical identity.
[RFC 5646](https://www.rfc-editor.org/rfc/rfc5646.html).

Schema-only validation was rejected because reference categories, expression cycles, semantic duplicate keys, projection completeness, and canonical IDs require graph-aware checks.
The chosen 2020-12 schemas describe closed shapes; ordered semantic validation supplies the remaining invariants and stable package errors.
In particular, format annotations are not assumed to enforce IRI or language rules, and composed objects must remain closed.
[JSON Schema Core](https://json-schema.org/draft/2020-12/json-schema-core), [JSON Schema Validation](https://json-schema.org/draft/2020-12/json-schema-validation).

## C6. Visual topology and honest partial projection

First principles distinguish semantic identity from a drawing occurrence: one named equivalence group may share a glyph, while one generic class or datatype may need several glyphs.
A property can also be drawn using defaults when no domain/range assertion exists.
An occurrence model that always references exactly one role or exactly one construct cannot express those cases accurately.

The chosen occurrence grammar therefore includes semantic reference sets and explicit class/property contexts.
Named equivalent properties are partitioned by their own exact endpoint terms, and inverse glyphs require reversed endpoints without inferring new endpoint facts.
Generic classes, anonymous classes, and operators are excluded from shared class grouping where it would obscure splitting or combine incompatible symbols.
These restrictions are Canonical VOWL's resolution of underspecified cases, not a claim that every equivalent OWL expression has one universal VOWL glyph.

The adopted notation is grounded in the repository's [VOWL 2 specification snapshot](../owlapi-js/conformance/upstream/vowl-2/index.html), dated 7 April 2014.
Its datatype/property and generic-class splitting, equivalent-element display, inverse labels, and interaction treatment of subproperties inform the rules.
The live VOWL endpoint was unavailable during this research; the local specification, rather than an unverified live page, is the evidence used here.
The current builder is used to identify compatibility consequences, not to turn historical endpoint propagation into normative inference.

The full matrix classifies every retained kind, including conditional visual treatment.
Unrepresented OWL 2 restrictions, keys, chains, and other retained structures stay in details.
Partial operator projections expose omitted operands through details and an accessible cue.
Unqualified cardinality edges are confined to explicit named-subclass restrictions and never become global property facts.
Inventing generic glyphs for unsupported structures was rejected because it suggests visual semantics the adopted notation does not define.

## C7. Portable artifact state and deterministic display

First principles require explicit effective state for anything the artifact binds; application defaults cannot be part of a portable interpretation.
The chosen artifact therefore includes complete positions/pins, center/zoom, effective hidden occurrences, label selection, active display prefixes, and three explicit display modes.
It excludes force-engine internals and restores paused.
This agrees with the repository's separation of stored meaning and rendering in [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md).

The alternatives for language fallback were the current application's implicit English fallback, locale collation, or an explicit single-range lookup with a fixed default and bytewise ties.
The third is selected: exact tag lookup at each truncation step, then an untagged label, then an IRI-derived name.
It introduces no language preference absent from artifact state and does not arbitrarily expand `en` to one of several regional variants.
RFC 4647 supplies lookup/truncation and requires the application to define default behavior; the selected default is this profile's decision. [RFC 4647 sections 3.4–3.4.1](https://www.rfc-editor.org/rfc/rfc4647.html#section-3.4).

Externality is a presentation heuristic, not provenance.
Using imports membership would bind retrieval details excluded from structural identity; browser URL normalization would erase lexical distinctions.
The selected exact namespace algorithm, builtin list, and local-first principal-name rule are fixed in B5.
The IRI component grammar informs parsing but does not establish the heuristic as Web-resource equivalence.
[RFC 3986 section 3](https://www.rfc-editor.org/rfc/rfc3986.html#section-3).

VOWL's existing notation supports count-sensitive class sizing but leaves choices to implementations.
B5 fixes a bounded logarithmic factor based only on direct unique memberships and fixes compact notation's effect without changing topology.
The formula, cap, and generic-node ratio are proposed profile policy, not a measured optimum or a value dictated by VOWL.
Renderer radius, fonts, colors, and pixels remain style; deterministic portable state is not pixel-identical rendering.

## C8. Bounded execution and operational defaults

First principles rule out unbounded graph-isomorphism work on supplied input and prohibit a partial or alternate canonical form after exhaustion.
Modern browser practice also separates CPU-intensive work from the rendering event loop; merely returning a promise does not accomplish that.
The selected design uses a worker for the full pipeline, explicit cancellation/deadlines, stale-result suppression, and termination when cooperation fails. [Off-main-thread architecture guidance](https://web.dev/articles/off-main-thread).

RDFC-1.0 explicitly addresses pathological dataset handling, while the selected maintained library exposes abort and deep-comparison controls.
The local `rdf-canonize@5.0.0` code and upstream documentation were inspected; A8 passes explicit options instead of relying on mutable defaults or sentinel values.
[RDFC-1.0 security considerations](https://www.w3.org/TR/2024/REC-rdf-canon-20240521/#security-considerations), [rdf-canonize documentation](https://github.com/digitalbazaar/rdf-canonize/blob/main/README.md).

No primary specification supplies an appropriate millisecond or byte budget for this application.
The finite defaults and override bounds in A8 are initial engineering choices that make implementation falsifiable, not claims established by benchmark data.
Qualification measures ordinary, large, symmetric, and pathological cases and may tune operational limits without changing successful canonical bytes.
Any application latency/size service objective must be supported by those measurements; it is not fabricated to make the design appear qualified.

## C9. Strictness, compatibility, and migration

First principles require a mode named strict to say what it validates, including content deliberately excluded from the final visualization.
The selected strict mode checks OWL 2 DL structural conformance on the complete closure before retention filtering.
A retained-subset-only check was rejected because an invalid source axiom could disappear before validation and create a misleading strict-success claim.
This does not introduce a reasoner or require logical consistency.

Compatibility remains useful for real RDF/OWL inputs, but its recoveries are a closed catalogue with deterministic diagnostics.
Role conflicts, missing imports, RDFS categories, ill-typed/unverified literals, and global restrictions have explicit handling; ambiguity is not permission to guess.
The public byte-input and import-resolver shapes are specified so parser/closure capability gaps can become concrete implementation tasks.

Historical migration has a fixed initial target: the repository's export dialect at the review's pinned commit.
Automatic shape detection and silent filling of missing semantics were rejected.
Typed caller resolutions are confined to exact source locations, losses are diagnosed, and an incomplete artifact fails rather than acquiring an arbitrary new layout.
The dialect's field inventory and executable ingress mapping belong to its implementation slice against that fixed target.
Adding another historical dialect requires a separately named contract.

## C10. What planning readiness does and does not establish

The original review identified underspecified mechanisms and missing qualification evidence together.
The first category is addressed by this design bundle.
The second requires working implementations and remains a freeze or integration gate:

- executable closed schemas and semantic validators;
- checked RDF templates, category issuance, and duplicate-safe exact decoding;
- independently derived vectors and agreement from a separately implemented Canonical VOWL pipeline;
- exhaustive projection/state fixtures;
- parser, strict/compatibility, and migration qualification;
- measured limits, cancellation, browser restoration, and accessibility evidence; and
- published immutable profile bundles.

Those deliverables can now be translated into implementation tasks without asking a planner to invent the format.
They have not been run or produced merely because their requirements are written down.
Unexpected evidence that requires changing retained meaning, a normative byte rule, or the supported scope reopens the affected decision and its dependents before freeze.
Routine implementation choices that preserve the contract do not reopen the design.

This revision changes repository design documents only.
It does not authorize package/configuration edits, implementation, commits, pushes, publication, or application cutover.
