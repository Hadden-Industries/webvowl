# ADR 0005: Resolve cross-category property punning deterministically in compatible mode

| Metadata       | Value                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| **Status**     | Accepted, amended 2026-08-19                                             |
| **Date**       | 2026-08-18                                                               |
| **Decider**    | Repository owner                                                         |
| **Amends**     | `docs/owlapi-js/implementation-plan.md` §8 (shared RDF-to-OWL contract)   |

> **Amendment, 2026-08-19.** The fixed precedence below is demoted to a
> fallback. Resolution now consults evidence stated about the property before
> consulting the table. See "Amendment: resolve by evidence" at the end of this
> record for the reasoning and the revised algorithm.

## Context

`RdfToOwlTranslator` contains two checks for an IRI used in more than one OWL
property category, and they behave inconsistently.

`#assertCompatiblePropertyCategories` runs once after all declarations are
collected and throws `OWLSyntaxError` **unconditionally**, ignoring
`parsingMode`. The axiom-level reuse recovery beside it honours the mode: it
throws in strict and records an `RDF_PROPERTY_CATEGORY_REUSE` warning otherwise,
as finding `M6-008` requires. Nothing indicates the difference was intended.

The consequence is that four real ontologies in the pinned corpus cannot be
loaded at all:

| Ontology          | Conflict           | IRI                       |
| ----------------- | ------------------ | ------------------------- |
| `foaf.rdf`        | data ↔ object      | `foaf:mbox_sha1sum`       |
| `sioc.rdf`        | data ↔ object      | `sioc:delivered_at`       |
| `bibo.rdf.xml`    | annotation ↔ data  | `dcterms:description`     |
| `imarinetlo.owl`  | annotation ↔ data  | `assignedName`            |

The migration's acceptance bar is that replacing the Java engine is transparent
to users of upstream WebVOWL v1.1.7, which performs no parsing of its own and
delegates to the Java OWL2VOWL service. Pinned reference outputs exist for all
four ontologies, so the target implementation loads all four. Rejecting them is
therefore a regression against the stated goal, not a stricter reading of it.

Two constraints bound any recovery.

OWL 2 DL genuinely forbids this. The OWL 2 Structural Specification's typing
constraints state that "no IRI *I* is declared in *Ax* to be both object and
data, object and annotation, or data and annotation property". Strict mode must
continue to reject these documents; only compatible mode, which explicitly does
not claim OWL 2 DL conformance, may recover.

Recovery cannot simply suppress the error. Category membership is consumed by
three independent predicates, `#isDataPropertyTerm`, `#isObjectPropertyTerm` and
`#isAnnotationPropertyTerm`. An IRI present in two sets makes two predicates
report true, so the effective category would depend on which predicate a given
code path happens to evaluate first. That is the corruption `M6-008` warned
about, and it would produce silently wrong axioms rather than an error.

## Decision

1. `#assertCompatiblePropertyCategories` **MUST** honour `parsingMode`. Strict
   continues to throw exactly as it does today.
2. In compatible mode the translator **MUST** resolve each conflict to a single
   category by the fixed precedence **`data` > `object` > `annotation`**, and
   **MUST** remove the IRI from the losing category sets so the three predicates
   remain mutually exclusive.
3. Each resolution **MUST** record a diagnostic naming the IRI, the competing
   categories and the resolved category. Compatible mode never silently claims
   OWL 2 DL conformance.
4. A conflict between `annotation` and `object` **MUST** use the distinct
   diagnostic code `RDF_PROPERTY_CATEGORY_PUNNING_UNEVIDENCED`, because that
   pair is unevidenced (see Rationale). The ordinary code is
   `RDF_PROPERTY_CATEGORY_PUNNING`.
5. Declaration axioms are **NOT** removed. The graph stays faithful to the
   source; only dispatch is made deterministic.
6. Axiom construction **MUST** use the recovery-capable property-expression
   entry points, not the strict ones. The translator already pairs each strict
   accessor with a mode-aware `…ForAxiom` variant that routes through
   `#requireCompatiblePropertyCategoryReuse`, which is the axiom-local recovery
   `M6-008` mandates. A construction site that calls the strict accessor rejects
   the whole document where the design intends a local, diagnosed recovery.

## Rationale

The precedence order is derived from observed target behaviour, one pair at a
time, rather than chosen for symmetry.

| Pair                  | Evidence                                                                                                                                                   | Winner |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| data ↔ object         | The live WebVOWL v1.1.7 service, the pinned OWL2VOWL 0.3.7 oracle, and the retained legacy JavaScript pipeline all render `foaf:mbox_sha1sum` as `owl:datatypeProperty`; the legacy pipeline also renders `sioc:delivered_at` that way | data   |
| annotation ↔ data     | The pinned oracle renders `dcterms:description` and `assignedName` as data properties, on the exact fixture bytes used by the differential suite            | data   |
| object ↔ annotation   | **None.** No corpus ontology exercises this pair                                                                                                            | object |

The third row is a determinism choice, not a finding, which is why it carries
its own diagnostic code. The first real occurrence announces itself instead of
allowing an unevidenced guess to harden into an assumption.

Two limits on the evidence are recorded deliberately. The retained legacy
JavaScript pipeline does **not** render `dcterms:description` at all, so it
disagrees with the oracle on the annotation ↔ data pair; the oracle governs,
because the legacy pipeline is a client-side reimplementation of OWL2VOWL whose
gaps are already recorded as gaps rather than as intended behaviour. And the
conflict check reports only the first conflicting pair it finds, so an
`object ↔ annotation` conflict could be masked behind an `annotation ↔ data`
conflict in `bibo.rdf.xml` or `imarinetlo.owl`. The claim is that no ontology's
**first** conflict is `object ↔ annotation`, not that none exists.

## Consequences

- Four pinned corpus ontologies load again through the production entry, which
  defaults to compatible mode.
- Strict mode behaviour is unchanged, so no conformance claim is weakened.
- Compatible mode gains two diagnostic codes. Consumers that surface
  diagnostics will show them; nothing is discarded silently.
- The oracle remains pinned at OWL2VOWL 0.3.7 by decision. That release is dated
  December 2024 while WebVOWL v1.1.7 is dated June 2019, so the oracle is a
  **proxy** for the transparency target rather than the target itself. This is
  recorded rather than resolved: obtaining a 2019-era build was judged
  disproportionate and would invalidate every existing reference output.
- The `RDF_PROPERTY_CATEGORY_REUSE` axiom-level recovery is unchanged in
  behaviour but is now reached from property-characteristic axiom construction,
  which previously called the strict accessor. FOAF is the motivating case: it
  declares `mbox_sha1sum` as a datatype property, an object property and an
  inverse-functional property, so resolving the punning to data still left the
  characteristic axiom demanding an object property expression.
- The two paths now agree in policy while continuing to address different
  scopes: declaration-level resolution and axiom-level reuse.
- Resolving punning surfaced these downstream sites rather than causing them.
  Further strict accessors may be reachable from other axiom-construction paths;
  each is a defect of the same shape and is fixed by routing to the `…ForAxiom`
  variant, not by weakening the strict accessor.

## Verification obligations

- Strict mode **MUST** be shown to reject all three category pairs.
- Compatible mode **MUST** be shown to resolve `data ↔ object` and
  `annotation ↔ data` to the data property, with the diagnostic recorded.
- The unevidenced `object ↔ annotation` resolution **MUST** be covered by a test
  asserting its distinct diagnostic code, so the pair cannot quietly acquire the
  ordinary code later.
- The four corpus ontologies **MUST** load through the real-corpus acceptance
  gate.

## Implementation map

| Change                     | Location                                                    |
| -------------------------- | ------------------------------------------------------------- |
| Mode-aware resolution      | `src/owlapi-js/rdf/rdfToOwlTranslator.js`                   |
| Behavioural tests          | `src/owlapi-js/rdf/propertyCategoryPunning.test.js`         |
| Evidence-based resolution  | `src/owlapi-js/rdf/propertyCategoryEvidence.test.js`        |
| Corpus acceptance          | `src/owl2vowl/test/productionCorpus.test.js`                |
| Phase 8 finding            | `docs/owlapi-js/migration/lessons/007-production-cutover.md` |

## Amendment: resolve by evidence

### Why the fixed precedence was insufficient

The precedence above reproduced the oracle on `foaf.rdf` but not on `sioc.rdf`,
and the corpus shows why neither rule is principled.

The oracle resolves by **first-declared category in document order**. That is
disqualified regardless of what it produces: RDF is an unordered graph, and
`<owl:ObjectProperty rdf:about="X">` is only syntactic sugar for the triple
`X rdf:type owl:ObjectProperty`, with no privileged status over an `rdf:type`
appearing later. Two serialisations of the same ontology may emit those triples
in either order, so a first-declared rule answers differently for the same
ontology depending on its encoding. A resolution rule must be a function of the
ontology, not of how it was written down. The likely origin is that a streaming
parser sees triples in arrival order and taking the first is cheap; that
explains the behaviour without justifying it.

The evidence also shows the oracle's rule producing worse output. Every punned
property in the pinned corpus declares `rdfs:range rdfs:Literal`. The oracle
honours that on FOAF, rendering a datatype property, but discards it on SIOC,
rendering an object property whose range edge points at `owl:Thing` — output
that contradicts the document it was given.

The fixed precedence `data > object > annotation` reaches the right answer on
this corpus, but only because every case happens to have a literal range. Invert
the case — a property declared in both categories whose range is a *class* — and
the precedence forces "data" and the class range is replaced by `rdfs:Literal`.
That is the same failure as the oracle's, mirrored. Both rules discard the
author's most direct statement about what the property relates.

### Revised algorithm

1. **Direct evidence about the property.** `rdfs:range` decides: a datatype,
   `rdfs:Literal`, or an XML Schema datatype implies a data property; a class
   implies an object property. Where a range and a characteristic disagree, the
   **range wins**, being the author's most direct statement of what the property
   relates rather than a statement about its algebra.
2. **Inferred evidence by bounded propagation.** Follow `rdfs:subPropertyOf` and
   `owl:equivalentProperty` to a property declared in exactly one category,
   breadth-first with a visited set. `prov.owl` needs this: `wasRevisionOf` and
   `specializationOf` declare no range at all but do carry such edges.
3. **The fixed precedence, as a diagnosed fallback**, when the ontology offers
   nothing.

**Bounded means bounded.** Step 2 is syntactic traversal of two named relations,
not DL reasoning. The distinction is load-bearing: the corpus register already
treats reasoner-derived axioms as an expected difference class, so letting
"inferred" grow into entailment closure would change what the engine is.

### Scope

Compatible-mode recovery resolves **per document**. The import closure is
best-effort — an unreachable import is a diagnostic, not a failure — so
consulting it would make the rendering depend on what the network returned,
reintroducing by another route the environment-dependence that document order
was rejected for. It would also mean a remote edit could silently flip a local
rendering, leaving an author unable to reason about their own file.

Strict-mode conformance keeps the specification's scope, where OWL 2's typing
constraints are stated over the axiom closure. Conformance and recovery are
different questions and take different scopes.

### Consequences of the amendment

- Every punned property in the pinned corpus still resolves to a data property,
  now because each declares a literal range rather than because a table said so.
- `sioc.rdf` remains a difference from the oracle and is recorded as governed:
  the oracle discards a declared `rdfs:Literal` range and draws the edge to
  `owl:Thing`; we keep the range the author stated.
- The diagnostic gains an `evidence` field — `range`, `characteristic`,
  `inferred` or `precedence` — so a reader can tell a reasoned resolution from a
  defaulted one. `RDF_PROPERTY_CATEGORY_PUNNING_UNEVIDENCED` now marks only the
  case where the fallback fired without a data category, rather than every
  object/annotation pair.
