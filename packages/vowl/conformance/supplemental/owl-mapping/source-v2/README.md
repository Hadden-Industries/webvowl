# OWL source revision 2

This is the current source layer for the independent OWL mapping seed corpus.
It supersedes the input-byte selections in the historical seed/closure catalogs while preserving their expected normalized sources, mapped RDF, canonical N-Quads, IDs, canonical JSON and profile/error/diagnostic expectations exactly.

Independent review of the normative [OWL Structural Specification section 3.7](https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Functional-Style_Syntax) confirms that Functional Syntax documents cannot declare the standard prefix names listed in Table 2.
The mappings for `rdf:`, `rdfs:`, `xsd:` and `owl:` are predefined.
The original helper's redundant `xsd:` declaration was therefore invalid, including in the purported positive empty-ontology input.
The first comparison's 47 syntax failures do not establish an implementation defect.

`manifest.json` removes only the exact prohibited `Prefix(xsd:=<http://www.w3.org/2001/XMLSchema#>)` line and its trailing newline from 29 authored root/import byte inputs. Each change pins its before/after bytes, removed text, byte offset and length.
Reinstating that one byte range reconstructs the historical input exactly.
The remaining default prefix is permitted; abbreviated `xsd:` uses retain their standard meaning.
Intended grammar, ambiguity and unsupported-constructor negatives are not converted into positives.

The revised catalog still has 28 active inputs and 66 profile runs.
Two additional rejection controls retain the original empty-ontology bytes and expect `MAPPING_SYNTAX_INVALID` for their prohibited prefix declaration.
This tests the parser rule rather than weakening it.
The 21 expected model/output groups are unchanged.
The custom-datatype diagnostic review overlay remains active.

`catalog.mjs` verifies the original 174-artifact scope before applying this layer.
`derive.mjs` and `verify.mjs` default to no writes.
The explicit creation mode is exclusive-write-only and cannot overwrite historical inputs or goldens.

```text
node packages/vowl/conformance/supplemental/owl-mapping/source-v2/derive.mjs
node packages/vowl/conformance/supplemental/owl-mapping/source-v2/verify.mjs
npm test -- --runInBand --runTestsByPath packages/vowl/test/owlCorpus.test.js
```

This correction independently establishes the prefix rule and preserves the previously authored structural interpretations; it is not a new complete OWL parser or an exhaustive source-validity proof.
The two open stable-dispatch cases and other bounded-corpus limitations recorded by the historical scope remain open.
