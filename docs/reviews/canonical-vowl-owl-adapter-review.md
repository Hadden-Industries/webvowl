# Experimental Canonical VOWL OWL adapter evidence

The private package now exposes `vowl/owl` in addition to the root core surface.
This is SLICE-003 implementation and development evidence, not mapping-profile freeze, publication, browser application adoption or exhaustive syntax coverage.
The governing contract remains A9 in the [core specification](../specs/2026-09-24-canonical-vowl-core-contract.md).

## Owning dependency and package boundary

The required owning implementation was delivered through [owlapi PR 25](https://github.com/Hadden-Industries/owlapi/pull/25).
WebVOWL and the standalone `vowl` workspace now select its exact integrated revision `3d1933c44f939525dd9a73afd6e7731627333ca6` rather than a local source path.
The source commit was signed and the remote merge/tree/checks were read back; the owning delivery journal retains those receipts.
This is Git dependency delivery, not an npm release.

The adapter imports only public `owlapi` apibinding, model, IO, format and profile surfaces.
The updated downstream architecture boundary passes all 22 tests and also scans `packages/vowl/src`.
The public owning source-assessment contract provides exact per-document formats, import-parent context, preserved constructor arity/literal forms, and full-closure OWL 2 DL/datatype checking.

A fresh manager has only the explicit caller resolver as an acquisition capability.
It receives authored import IRIs and the actual importing document IRI, with one combined cancellation signal.
Root and returned import bytes are snapshotted and charged to the same operation.
Malformed resolver responses, resource failures and native cancellation cannot become compatibility missing- import recoveries.
Source media types are selected exactly, without sniffing.
No remote JSON-LD context fetcher is enabled.

## Candidate syntax inventory

| Media type              | Owning parser     |
| ----------------------- | ----------------- |
| `text/owl-functional`   | Functional Syntax |
| `text/owl-manchester`   | Manchester Syntax |
| `application/owl+xml`   | OWL/XML           |
| `text/owl-krss2`        | KRSS2             |
| `application/rdf+xml`   | RDF/XML           |
| `text/turtle`           | Turtle            |
| `application/trig`      | TriG              |
| `application/n-triples` | N-Triples         |
| `application/n-quads`   | N-Quads           |
| `application/ld+json`   | JSON-LD           |

A minimal retained subclass agrees byte-for-byte across all ten formats in strict and compatibility modes.
This demonstrates that case, not every constructor/format combination.
DL Syntax and KRSS1 are deliberately absent.
Bounded public owning probes found DL numeric literal token rewriting and a KRSS1 `:right-identity` clause discarded in preserve mode.
Root and import boundaries reject both withheld media types in both policies.
Required owning repairs and broader syntax qualification remain open; no lossy normalization is implemented in this adapter to hide those deficiencies.

## Mapping and error policy

Validation checks every loaded source before filtering, including excluded axioms, imported metadata and unattached source expressions.
Only trusted owning qualifications for undeclared-but-typed use and original set-constructor arity are accepted.
Unknown rule codes or missing/stale source evidence fail with `DEPENDENCY_FAILURE`.

The six A9 recoveries remain closed.
The global-restriction set contains only the identified OWL section 11 restrictions; it is not a catch-all for invalid reserved vocabulary, facets or literal discriminants.
Known nonrecoverable source-rule failures use `MAPPING_SOURCE_INVALID` with the stable owning rule identifier.
Custom datatype literals receive `MAPPING_DATATYPE_UNVERIFIED`, including strict precedence over a separate missing-definition violation.
Actual semantic ambiguity fails in both policies.
Resources and observed cancellation/deadlines remain fatal.

Declared roles, retained terms and root metadata seed content.
Excluded ABox bodies and their annotations do not leak property/signature content, while their referenced individuals remain represented.
An explicit generic declaration is still a retention root when excluded uses establish its specific categories.
Unannotated generic declarations retain the independently identified categories; an annotated declaration with multiple possible role targets remains ambiguous.
Retained annotations keep exact predicates, values, nesting and assertion anchors.
Endpoint aggregation happens after anchors capture the asserted target.
Anonymous subjects are standardized apart per source ontology.

Unsupported multi-property data quantification is detected before creating partial retained content, in both owning axioms and retained RDFS statements.
Compatibility omits the entire assertion with the specified diagnostic; strict rejects it.
Exclusion diagnostics use the exact six OWL source constructor names.
Diagnostics are bounded immutable records, deduplicated and sorted by complete JCS UTF-8 bytes; they do not enter canonical identity.

The adapter passes its private draft and budget through an operation-local one-shot carrier to the public root `canonicalize` binding.
This preserves one aggregate deadline/counter set and that root evaluation's private admission.
There is no fourth public surface or transferable encoder authority.

## Independent comparison and review

The independent producer supplied 28 source vectors, 21 complete expected models and 66 profile runs, covering syntaxes, closure order, cross-document anonymous identity, lexical distinctions, original arity, large cardinalities, anchors, all exclusions/recoveries and full-closure invalidity before exclusion.
Its first Functional Syntax sources redeclared `xsd:`, which the normative [OWL Structural Specification section 3.7](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Functional-Style_Syntax) prohibits.
The oracle independently corrected only those source declarations in an additive revision and preserved every historical input and expected byte.
The product parser was not weakened to accept those invalid sources.

The source-v2 manifest SHA-256 is `84578b5c9abb5e37f3c39f8932dcb0711681ec18262cca2eebecdc0c8c99a68c`; active portable provenance SHA-256 is `3c97f23cc4e00ac2608f7e8d432747c21b357e899bb4e7b56631a6f7b043b1ee`.
The public runner passes all 69 checks, including provenance and two preserved invalid-prefix controls.
Two malformed-RDF stable-error cases remain explicitly open in the independent corpus instead of invented expectations.

The independent protocol review read all five adapter/carrier modules and ran 47 public probes. It found the generic declaration loss, missing RDFS whole- statement omission and adapter option precedence. Public regressions and repairs now cover those cases plus native resolver cancellation. The reviewer closed the semantic reproductions and independently verified all original and adjacent option-order cases. Its final affected adapter/oracle/resource run passed 131 tests. This was live development review; an immutable candidate assessment, standalone/browser tests, wider format qualification and mapping freeze evidence are still required.

## Distribution evidence still in progress

The notice generator now traverses the actual resolved runtime dependency closure, including distinct installed versions and OWLAPI's Apache compatibility notice.
It retains license/notice texts for 46 installed packages.
The saxes 6.0.1 tarball lacks its license file; the retained immutable upstream text has SHA-256 `0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e`, matching the owning package's provenance evidence.
This records supplied grants; it does not replace the project's pending human rights disposition.

The current root dependency audit reports existing transitive `fast-uri` and `undici` advisories.
Exact affected paths and reachability need disposition for the frozen adapter/build; no blind dependency override or audit fix has been applied.
Standalone installation may resolve a different transitive artifact than this workspace lock, so its receipt must identify the actual tested tree.
