# Canonical VOWL OWL capability review

**Date:** 30 September 2026.
**Result:** SLICE-003 is blocked on owning OWLAPI capabilities.
**Scope:** Specialist capability evidence for the accepted Canonical VOWL implementation programme; this report does not constitute the independent protocol, security, or accessibility approval.
**Basis:** [SLICE-003](../plans/2026-09-24-canonical-vowl-implementation-plan.md#slice-003--owl-bytes-and-resolved-closure-to-canonical-vowl), [core contract A3 and A9](../specs/2026-09-24-canonical-vowl-core-contract.md), public package APIs, exact source revisions, and the executable probes below.

The installed dependency and the current upstream default branch both lack the required full-closure OWL 2 DL validator.
Eight discriminating two-document examples were accepted by their strict parsers with no diagnostics.
A pin upgrade alone cannot satisfy A9.
A partial validator or a parser-mode alias must not be reported as successful strict mapping.
Independent core work may continue under the plan.

## Dependency identity and scope of verification

| Item                                           | Verified identity                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| WebVOWL dependency declaration                 | `owlapi: git+https://github.com/Hadden-Industries/owlapi.git#caabb1197ffdab91c1e10d596d177b5142aea5c1`                            |
| WebVOWL lock and installed lock resolution     | `git+ssh://git@github.com/Hadden-Industries/owlapi.git#caabb1197ffdab91c1e10d596d177b5142aea5c1`                                  |
| Installed package version                      | `0.1.0-alpha.0`                                                                                                                   |
| Installed lock integrity                       | `sha512-m6H5akkbspCsOzPNAjneRG+hWjphqfXHQXOqzFbHeEkdABOufEZKIS4rjvQDpartQRilsr+ux5UmKJZMfL8Mkg==`                                 |
| Owning checkout and live remote default branch | `f5a160c094b4fa8dfee249875b3b37fc973bc590`, `refs/heads/main`                                                                     |
| Upstream manifest version                      | `0.1.0-rc.1`                                                                                                                      |
| Probe environment                              | Node `v24.21.0`, Windows `win32`, `x64`                                                                                           |
| Installed package entry used by probes         | Public `owlapi` root export                                                                                                       |
| Upstream entry used by probes                  | Public root module `C:/Users/maksy/GitHub/owlapi/index.js`; source checkout qualification, not an installed release qualification |

The owning checkout had unrelated documentation changes.
Its relevant `index.js`, `model/`, `io/`, `internal/`, and compatibility inventory had no changes relative to the verified upstream commit.
They were only read.
No dependency installation, checkout change, upstream edit, configuration edit, or commit was performed for this review.

The following installed file blobs matched the pinned commit exactly, using `git hash-object --no-filters` and `git ls-tree`.
This verifies the source actually probed without treating the manifest alone as proof.

| Installed path within `owlapi`             | Git blob SHA-1                             |
| ------------------------------------------ | ------------------------------------------ |
| `index.js`                                 | `633f43615ab3b1c86c8b16ecc2ac315587a590f0` |
| `io/stringDocumentSource.js`               | `b5c2bae3bb5b74b63bfeb2b029f07bacab5c5c99` |
| `model/owlOntologyManager.js`              | `6e9c60518ff4a9777795c4ddd464be2ab7180615` |
| `internal/parsing/parserRegistry.js`       | `315b8c17923b1227b4c0b434b950fce2921caf12` |
| `model/owlDataFactory.js`                  | `d431f3f9dca4eecebf22cfb49cc7c8519447d6f3` |
| `docs/compatibility/java-api-surface.json` | `1c8ee6c5e0da2c6381d45fcb70812545aa8c621e` |

The source, registry, and factory blobs above are also unchanged on the verified upstream commit.
The upstream manager blob is `b8311c5c10bb2a488df7e821e904257b0613e3fd`.

Read-only remote identity command, executed in the owning checkout:

```powershell
git ls-remote --symref origin HEAD refs/heads/main
```

Observed output:

```text
ref: refs/heads/main HEAD
f5a160c094b4fa8dfee249875b3b37fc973bc590 HEAD
f5a160c094b4fa8dfee249875b3b37fc973bc590 refs/heads/main
```

## Public boundary that exists

| Requirement                        | Current public API and finding                                                                                                                                                                         | Consequence                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Byte ingress                       | `StringDocumentSource(text, {contentType, documentIRI, fileName})` requires a JavaScript string. Manager accepts that source contract or a string, not a `Uint8Array`.                                 | Adapter owns byte snapshot, backing-store admission, byte accounting, and qualified byte-to-text decoding. This bridge alone does not require a new parser.                                                                                     |
| Explicit format                    | `OWLOntologyLoaderConfiguration({format})` or `.withFormat(format)` selects an exact public format key/object.                                                                                         | Root media types can be allowlisted and mapped to public `OWLDocumentFormats`.                                                                                                                                                                  |
| Per-source media type              | `contentType` is a parser-selection hint. Without `configuration.format`, candidates are detected from content, ranked, and tried.                                                                     | Merely setting `contentType` does not enforce A9's no-sniffing rule. Unsupported-media admission must happen before parsing.                                                                                                                    |
| Heterogeneous imports              | The same immutable configuration, including its explicit `format`, is passed to every imported document. The source has no per-document authoritative format setting.                                  | Root Functional Syntax plus a Turtle import cannot be both explicitly selected through the present built-in closure lifecycle. Public owning work is needed; private registry imports or a duplicate parser are not an approved solution.       |
| Import resolution                  | `OWLManager.createOWLOntologyManager({documentLoader, iriMappers})`; `documentLoader.load(mappedDocumentIRI, {config, signal})` returns a string/source or missing result.                             | Loader has no `importingDocumentIri`. It also receives a mapped document IRI, not a separately preserved authored import IRI. A9's resolver context is not supplied. Avoid IRI mappers when the authored IRI must remain the resolver argument. |
| Acquisition policy                 | No loader is installed by default. HTTP(S) imports are denied unless `remoteImports` is true, even for an injected loader.                                                                             | An application resolver must own all acquisition. Enabling that loader route is distinct from introducing an implicit fetcher.                                                                                                                  |
| Closure result                     | `loadOntologyGraphFromOntologyDocument` returns `{ontology, importsClosure, documents}`; document context includes document IRI, format, and diagnostics.                                              | The eight probes observed a root-inclusive two-document closure. Use an operation-local manager with the installed pin: already registered imports return before they enter the new session's document list.                                    |
| Missing imports                    | `missingImportHandling: "throw" \| "diagnostic"`; `MissingImportError` or an absent loader result can become a warning. Other loader failures may remain fatal.                                        | Translate failure policy deliberately. Do not catch arbitrary parser or operational errors as missing imports.                                                                                                                                  |
| Cancellation                       | `configuration.signal` is checked before source access, before/after document parsing, around import loading, and before registration. The same signal is forwarded to the loader.                     | A cooperative resolver can propagate cancellation. The manager directly awaits the loader; source does not establish interruption of an uncooperative loader. A8's worker supervisor and shared deadline remain required.                       |
| Limits                             | Public configuration supplies parser/model limits, import count/depth, signal, and `timeoutMs`. Byte checks occur per document. Parsers instantiate document-local elapsed-time budgets.               | These controls are useful but are not A8's aggregate byte/model counters and one operation-wide deadline. The adapter must coordinate its own aggregate budget and supervisor.                                                                  |
| Structural access                  | Root/closure ontologies expose direct axiom, annotation, import declaration, and signature queries; objects expose typed structural fields and public dispatch helpers.                                | Retention can use public structure, preserving excluded axioms until validation finishes. Anonymous individual keys need source-ontology scope before closure-wide deduplication.                                                               |
| Multi-property data quantification | Public `getOWLDataSomeValuesFrom(properties, filler)` and `getOWLDataAllValuesFrom(properties, filler)` retain an ordered `properties` array. Existing Functional Syntax tests include two properties. | The builder can detect the complete construct and apply A9's strict rejection or compatibility whole-construct omission. This is not permission to approximate it as unary restrictions.                                                        |

The public format inventory at both revisions is:

```text
functional  text/owl-functional
manchester  text/owl-manchester
owlxml      application/owl+xml
dl          text/owl-dl
krss1       text/owl-krss
krss2       text/owl-krss2
rdfxml      application/rdf+xml
turtle      text/turtle
trig        application/trig
ntriples    application/n-triples
nquads      application/n-quads
jsonld      application/ld+json
```

This is an inventory of format identities and bundled parser descriptors, not Canonical VOWL per-syntax qualification.
RDF datasets additionally have a public graph-selection policy.
Do not silently merge multiple graphs or enable remote JSON-LD contexts in the adapter.

Boundary source references:

- [Pinned source contract](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/io/stringDocumentSource.js#L16), [pinned format inventory](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/formats/owlDocumentFormats.js#L9), and [pinned loader configuration](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlOntologyLoaderConfiguration.js#L10).
- [Pinned manager source normalization and closure](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlOntologyManager.js#L237), [import callback](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlOntologyManager.js#L522), and [format selection](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/internal/parsing/parserRegistry.js#L141).
- [Current upstream import callback](https://github.com/Hadden-Industries/owlapi/blob/f5a160c094b4fa8dfee249875b3b37fc973bc590/model/owlOntologyManager.js#L674) and [current upstream parser configuration reuse](https://github.com/Hadden-Industries/owlapi/blob/f5a160c094b4fa8dfee249875b3b37fc973bc590/model/owlOntologyManager.js#L890).
- Inspected, not executed: pinned `model/owlOntologyManager.test.js` cancellation/import transaction tests and `model/owlOntologyManager.integration.test.js` public closure/context test.

## Strict capability: blocked at both revisions

The shipped Java API inventory explicitly marks both `org.semanticweb.owlapi.profiles.OWL2DLProfile` and `org.semanticweb.owlapi.profiles.OWLProfileReport` as `NOT_STARTED`, `NOT_EXPOSED`, and `DEFERRED_NOT_EXPOSED`, with no JavaScript export, source module, or verification.
The current upstream inventory retains those statuses.
The public root/module exports contain no equivalent full-closure validator or datatype lexical-validation API.

See the [pinned inventory](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/docs/compatibility/java-api-surface.json#L15754) and [current upstream inventory](https://github.com/Hadden-Industries/owlapi/blob/f5a160c094b4fa8dfee249875b3b37fc973bc590/docs/compatibility/java-api-surface.json#L16124).
Some strict RDF translation checks reject local category conflicts; that is a useful parser constraint, not full-closure OWL 2 DL validation.

All eight rows below used a new manager, explicit Functional Syntax, strict parsing, and a successful two-document load.
At both tested revisions, every row returned `closure: 2`, `diagnostics: []`, and the offending axioms remained present.

| Probe                                        | Root / imported difference                                                  | Missing assurance                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `category-closure`                           | Root declares `:p` as object property; import declares it as data property. | Closure category separation.                                              |
| `class-datatype-category-closure`            | Root declares `:a` as class; import declares it as datatype.                | Closure class/datatype separation.                                        |
| `reserved-property-closure`                  | Import declares `owl:Thing` as an object property.                          | Reserved vocabulary restrictions.                                         |
| `nonsimple-cardinality-closure`              | Root uses `:p` in minimum cardinality; import makes `:p` transitive.        | Simplicity computed over the closure.                                     |
| `irregular-role-closure`                     | Root has `(:p :q) -> :r`; import has `(:r :q) -> :p`.                       | Regularity: the two chains require mutually incompatible strict ordering. |
| `illtyped-excluded-data-assertion-closure`   | Import asserts `"bad"^^xsd:integer` in a data property assertion.           | Lexical validity before excluded assertions are filtered.                 |
| `unverified-excluded-data-assertion-closure` | Import asserts `"opaque"^^:custom` with no supported datatype semantics.    | A9's explicit `MAPPING_DATATYPE_UNVERIFIED` decision.                     |
| `reserved-individual-excluded-same-closure`  | Import uses `owl:Thing` as an individual in `SameIndividual`.               | Invalid excluded axioms must remain visible to strict checking.           |

The negative cases follow W3C's [entity typing and reserved vocabulary restrictions](https://www.w3.org/TR/owl2-syntax/#Entity_Declarations_and_Typing), [literal requirements](https://www.w3.org/TR/owl2-syntax/#Literals), and [closure-wide global restrictions](https://www.w3.org/TR/owl2-syntax/#Global_Restrictions_on_Axioms_in_OWL_2_DL).
The unsupported custom datatype additionally exercises the stronger explicit failure policy in A9.
These probes distinguish syntax/structural parsing from the required validation; they do not assert a reasoner-consistency defect.

### Executed probe and reproduction

The following command was executed in `C:\Users\maksy\GitHub\webvowl`.
The source is passed as one PowerShell single-quoted argument; it contains no PowerShell interpolation and writes no file.

```powershell
node --input-type=module -e '
import { OWLManager, OWLOntologyLoaderConfiguration, StringDocumentSource } from "owlapi";
const prefix = "Prefix(:=<urn:case:>) ";
const fixtures = [
 ["category-closure", "Declaration(ObjectProperty(:p))", "Declaration(DataProperty(:p))"],
 ["class-datatype-category-closure", "Declaration(Class(:a))", "Declaration(Datatype(:a))"],
 ["reserved-property-closure", "", "Declaration(ObjectProperty(owl:Thing))"],
 ["nonsimple-cardinality-closure", "Declaration(Class(:a)) Declaration(ObjectProperty(:p)) SubClassOf(:a ObjectMinCardinality(1 :p))", "TransitiveObjectProperty(:p)"],
 ["irregular-role-closure", "Declaration(ObjectProperty(:p)) Declaration(ObjectProperty(:q)) Declaration(ObjectProperty(:r)) SubObjectPropertyOf(ObjectPropertyChain(:p :q) :r)", "SubObjectPropertyOf(ObjectPropertyChain(:r :q) :p)"],
 ["illtyped-excluded-data-assertion-closure", "Declaration(DataProperty(:p)) Declaration(NamedIndividual(:i))", "DataPropertyAssertion(:p :i \"bad\"^^xsd:integer)"],
 ["unverified-excluded-data-assertion-closure", "Declaration(DataProperty(:p)) Declaration(NamedIndividual(:i)) Declaration(Datatype(:custom))", "DataPropertyAssertion(:p :i \"opaque\"^^:custom)"],
 ["reserved-individual-excluded-same-closure", "Declaration(NamedIndividual(:i))", "SameIndividual(:i owl:Thing)"],
];
for (const [name, body, importedBody] of fixtures) {
 const root = prefix + "Ontology(<urn:case:root> Import(<urn:case:import>) " + body + ")";
 const imported = prefix + "Ontology(<urn:case:import> " + importedBody + ")";
 const calls=[];
 const manager = OWLManager.createOWLOntologyManager({documentLoader:{load:async(iri,context)=>{calls.push({iri:iri.value,keys:Object.keys(context)});return new StringDocumentSource(imported,{documentIRI:"urn:case:import-document",contentType:"text/owl-functional"});}}});
 try { const result=await manager.loadOntologyGraphFromOntologyDocument(new StringDocumentSource(root,{documentIRI:"urn:case:root-document",contentType:"text/owl-functional"}), new OWLOntologyLoaderConfiguration({format:"functional",parsingMode:"strict"}));console.log(JSON.stringify({name,outcome:"accepted",closure:result.importsClosure.length,kinds:result.importsClosure.flatMap(o=>[...o.getAxioms()].map(a=>a.kind)),diagnostics:result.documents.flatMap(d=>d.context.diagnostics),calls}));}
 catch(e) {console.log(JSON.stringify({name,outcome:"rejected",code:e.code,nameOfError:e.name,message:e.message,calls}));}
}
'
```

The second execution used the same command and fixtures with its import statement replaced by:

```javascript
import {
  OWLManager,
  OWLOntologyLoaderConfiguration,
  StringDocumentSource,
} from "file:///C:/Users/maksy/GitHub/owlapi/index.js";
```

Both executions exited 0 and produced the following identical JSON records:

```jsonl
{"name":"category-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLDeclarationAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"class-datatype-category-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLDeclarationAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"reserved-property-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"nonsimple-cardinality-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLDeclarationAxiom","OWLSubClassOfAxiom","OWLTransitiveObjectPropertyAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"irregular-role-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLDeclarationAxiom","OWLDeclarationAxiom","OWLSubPropertyChainOfAxiom","OWLSubPropertyChainOfAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"illtyped-excluded-data-assertion-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLDeclarationAxiom","OWLDataPropertyAssertionAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"unverified-excluded-data-assertion-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLDeclarationAxiom","OWLDeclarationAxiom","OWLDataPropertyAssertionAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
{"name":"reserved-individual-excluded-same-closure","outcome":"accepted","closure":2,"kinds":["OWLDeclarationAxiom","OWLSameIndividualAxiom"],"diagnostics":[],"calls":[{"iri":"urn:case:import","keys":["config","signal"]}]}
```

An initial fixture attempt redundantly declared built-in `owl:` and `xsd:` prefixes and was rejected before the import load.
It was corrected before the reported executions.
A larger supplementary seam/cancellation sampler was denied by the local command guard for unresolved Windows shell syntax; no runtime outcome from that sampler is used in this report.
The additional findings below are source traces, not claims that the denied sampler ran.

## Additional source-traced adapter gaps

1. **Arbitrary decimal cardinality is unavailable.**
   `OWLDataFactory` requires a non-negative JavaScript safe integer.
   The Functional Syntax parser converts the token with `Number` and rejects values outside that range.
   Therefore a cardinality such as `9007199254740993` cannot reach the builder through this parser.
   The relevant factory/parser files are unchanged upstream.
   References: [factory line 40](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlDataFactory.js#L40), [parser line 993](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/internal/parsing/functional/parser.js#L993).

2. **Original arity followed by singleton retention is unavailable for several constructors.**
   Functional Syntax first checks the original operand count, but the factory deduplicates the operands and then checks a minimum of two.
   `ObjectIntersectionOf(:a :a)` consequently cannot retain the singleton constructor required by A3.
   The RDF mapper also replaces one-operand object booleans with their operand and replaces empty ones with `owl:Thing`/`owl:Nothing`.
   It discards a self-equivalence axiom before the builder can preserve its constructor or annotations.
   These behaviors must be reconciled at the owning parser/model seam; a post-parser adapter cannot recover discarded structure.
   References: [factory normalization](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlDataFactory.js#L47), [object intersection](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlDataFactory.js#L425), [pinned RDF normalization](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/internal/mapping/rdfToOwlTranslator.js#L1190), and [current RDF normalization](https://github.com/Hadden-Industries/owlapi/blob/f5a160c094b4fa8dfee249875b3b37fc973bc590/internal/mapping/rdfToOwlTranslator.js#L1425).

3. **The existing compatible parser policy is broader and different from A9.2.**
   The RDF mapper selects one property dispatch category using evidence or `data > object > annotation` precedence.
   The original declaration axioms are still emitted, but subsequent uses are interpreted through the chosen category.
   A9 permits independently identified multiple roles and requires ambiguous uses to fail; its mapping profile cannot blindly inherit this winner selection.
   Existing parser tests deliberately verify the winner and diagnostics.
   It also recovers an object-property literal as an annotation and ignores a cross-category subproperty statement, which are not A9's six recoveries.
   References: [pinned category selection](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/internal/mapping/rdfToOwlTranslator.js#L1772), [current category selection](https://github.com/Hadden-Industries/owlapi/blob/f5a160c094b4fa8dfee249875b3b37fc973bc590/internal/mapping/rdfToOwlTranslator.js#L2007), and pinned tests `internal/mapping/propertyCategoryPunning.test.js`, `owlFullLiteralAssertion.test.js`, and `crossCategorySubProperty.test.js`.

4. **RDFS-only categories are converted to OWL categories in compatible RDF parsing.**
   `#declareRdfsClasses` emits an OWL class declaration from `rdfs:Class`.
   `#declareUntypedProperties` uses range evidence to emit object/data property declarations for generic `rdf:Property`.
   A9 instead requires the explicit `rdf-class`/`rdf-property` representation when no more specific identified role supersedes it.
   Parser diagnostics identify some recoveries, but they are not a lossless public source graph and do not establish recovery of every retained RDFS relation or source anchor.
   References: [pinned RDFS handlers](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/internal/mapping/rdfToOwlTranslator.js#L645) and [current RDFS handlers](https://github.com/Hadden-Industries/owlapi/blob/f5a160c094b4fa8dfee249875b3b37fc973bc590/internal/mapping/rdfToOwlTranslator.js#L872).

5. **Datatype construction is not datatype validation.**
   `getOWLLiteral` preserves the lexical form and builds the datatype object; it does not establish lexical membership or applicable facet validity.
   Complete datatype-map coverage, unsupported datatype reporting, datatype-definition restrictions, and stable global-restriction identifiers need owning validation evidence.
   Reference: [literal factory](https://github.com/Hadden-Industries/owlapi/blob/caabb1197ffdab91c1e10d596d177b5142aea5c1/model/owlDataFactory.js#L340).

## Required disposition

SLICE-003 completion and FREEZE-002 remain blocked.
Separately authorized OWLAPI work must supply and qualify the missing full-closure validator and the public admission/loading/model capabilities needed to preserve the A3/A9 contract.
The acceptance set must include valid controls, every discriminating invalid closure above, other global restrictions, exact literal/facet outcomes, syntax permutations, original arity and singleton retention, huge cardinalities, exact per-import media selection, resolver parent context, cancellation, and aggregate budget integration.

The owning work must retain validation of excluded axioms before filtering.
It must distinguish malformed syntax, ambiguous source interpretation, an OWL structural restriction violation, an unsupported datatype, and an unsupported mapping construct.
Stable failure/diagnostic identifiers and bounded source references are needed so the adapter does not invent policy from error text.

Do not expose the current parser's `parsingMode: "strict"` as the canonical strict mapping profile.
Do not silently enable all parser-compatible recoveries, consume private parser/RDF modules, reparse source ad hoc to reconstruct discarded information, or downgrade the accepted profile.
If the implementation route is changed, record the owner decision against exact revised contracts and rerun capability qualification before declaring the adapter complete.

This report establishes a concrete blocker and a reusable probe seed.
It is not exhaustive OWL conformance, independent Canonical VOWL byte agreement, browser cancellation measurement, release readiness, or approval for cross-repository implementation.

## Authorized upstream work and pinned design review

The owner subsequently authorized the required upstream implementation and its validation, commit and push delivery.
An isolated worktree at `owlapi-worktrees/canonical-vowl` starts from upstream `e769bfc3c84fd7e18fc2ea6f980a38308c724593`; the owning checkout's existing local commits remain untouched.
A separate reviewer compared that JavaScript revision with Java OWLAPI 5.5.1 blobs at pinned commit `d7e997a53b470e32700de89cc610d9daf01ea769`.
This was a source review, not executable Java parity evidence.
The local Java checkout's current HEAD is a different revision and must not be presented as the pinned oracle.

The review found two distinctions that the implementation must state explicitly.
Java's default DL profile checks declarations and normalized operand counts, whereas Canonical A9 admits well-typed use without redundant declarations and A3 validates original arity before retaining deduplicated singleton constructors.
Java's datatype lexical checks also do not establish every value constraint; for example, its integer-pattern check alone does not enforce the bounds of `xsd:byte`.
Java singleton disjoint-class construction can introduce `owl:Thing` and a dated annotation, so it cannot serve as the expected Canonical preservation result.

The proposed owning contract keeps the Java-shaped profile verdict and violations separate from an explicit source-qualified assessment.
Only package-produced evidence of original arity and unambiguous typed use may qualify those two differences; source evidence must be invalidated when ontology mutation makes it stale.
The source assessment reports literal validity as valid, invalid or unverified and visits the complete closure, including subsequently excluded assertions and nested annotations.
An unimplemented datatype rule never returns verified validity.

An opt-in preservation parser mode is needed in addition to the validator.
It must preserve singleton constructors, explicit multiple roles and RDFS-only structure while rejecting malformed lists, ambiguous dispatch and unsupported recovery.
A closed immutable source-structure result in the existing document context can carry parsed RDFS-only roles/relations and original-arity evidence without inventing OWL entities or requiring a private/raw-RDF parser in WebVOWL.
The owning representation uses ordinary RDF/RDFS/OWL vocabulary, not Canonical VOWL topology or IDs.
Default existing strict/compatible parser behavior remains separately qualified.

Lossless cardinalities require one decimal normalizer shared by factory, every supported reader and storage path; unsafe numeric inputs must fail rather than repair rounded values.
Normalized singleton constructors can be stored with repeated operands up to the concrete syntax minimum, preserving annotations once and adding no synthetic meaning.
Storage that cannot represent retained RDFS-only structure must fail atomically rather than silently omit it.
Per-document explicit format must survive source cloning and prohibit fallback sniffing, and import loader context must preserve authored import identity and the importing document separately from mapped retrieval identity.

These are bounded design proposals within the authorized owning work, not delivered capabilities.
Their API and JavaScript adaptations require explicit registry entries and tests; the existing Phase-21/22 parity decision sets must remain intact.
Full-closure valid/invalid controls, pinned common-domain Java comparisons, expected-deviation checks, mixed-format import rollback/cancellation, huge cardinalities, source-evidence invalidation and annotated singleton storage round trips remain required before SLICE-003 qualification.

## Delivered owning prerequisites

The required owning implementation was delivered through [owlapi PR 25](https://github.com/Hadden-Industries/owlapi/pull/25), merged as `3d1933c44f939525dd9a73afd6e7731627333ca6` with signed source commit `fc74a553b1ce6095b4a5fb12469b6bec42468869` retained in its ancestry.
The exact integration tree is `82e308404b2e19966609c5fb5c1654f29e550d9d`.
Remote main, parent identities, integration message and tree were read back; GitHub reports the separate integration signature valid.

The final owning full-profile run passed 4,065 Jest tests, four package-boundary tests, lint, formatting, release and governance checks.
A separately retained packed package passed Node and three-engine browser consumer checks on Windows.
Current-head hosted CI additionally passed its Linux/macOS/Windows and browser matrix, isolated WebVOWL consumer, dependency review and CodeQL checks.
Independent Java receipt 04 reproduces 20 expectations and 20 Java observations, with seven documented normative differences.
Bounded Claude and protocol findings were repaired and independently rechecked.
The owner contract and retained operator evidence state their review/coverage limitations; none establishes exhaustive OWL conformance or completes the WebVOWL adapter.

One adapter-readiness suspicion was separately resolved without changing owlapi: Canonical A4 can represent an empty key, but the original OWL 2 constructor requires at least one property under [section 9.5](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Keys).
The six compatibility recoveries do not override original constructor arity.
Factory/parser guards and profile reconstruction retain this restriction; a public manufactured empty-key probe returned `STRUCTURAL_OBJECT_INVALID`, with invalid source assessment and no qualification. Larger optional parser/storage probes were unavailable through the command guard and are not claimed as run.

SLICE-003 still requires updating and qualifying this exact dependency in WebVOWL, implementing both mapping profiles, and completing adapter fixtures.
