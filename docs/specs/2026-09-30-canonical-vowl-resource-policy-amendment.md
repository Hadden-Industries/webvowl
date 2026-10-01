# Canonical VOWL RDFC resource-policy amendment

The owner approved this bounded amendment on 30 September 2026 after the [independent resource-policy measurements](../reviews/canonical-vowl-resource-policy.md).
It supersedes only the graph-size term in A8's RDFC deep-iteration allowance.

For the complete allocated internal RDF dataset, let `B` be the number of distinct allocated blank nodes, including primary records and auxiliary nodes.
Pass `maxDeepIterations = min(B * B, rdfDeepIterations)` to RDFC-1.0 instead of the original `min(B, rdfDeepIterations)`.
The multiplication uses the bounded dataset's actual count; no estimate, category-local count or caller-supplied count is substituted.

The `rdfDeepIterations` default remains 100,000, its maximum remains 1,000,000, and zero remains a valid override.
All other A8 counters, override domains, deadlines, cancellation semantics and failure codes remain unchanged.
The entire operation retains one aggregate budget and deadline.
Exhaustion fails closed without another canonicalization algorithm, relaxed profile or partial output.

This amendment changes operational acceptance only.
It does not change either profile's fields, meaning, typed RDF mapping, canonical labeling, ID issuance, set ordering or final canonical bytes.
It is a measured allowance capped by an absolute work limit, not a promise to accept every ordinary graph or a general security qualification.

The original independent producer, manifests and three linear-policy resource-rejection records remain frozen as historical, library-specific evidence.
A separate amended producer and manifest must pin this amendment, record the single policy-expression change, supply exact positive outputs for those inputs, and prove all prior successful expected bytes unchanged.
Production source and decoder checks, finite work/deadline/cancellation tests and browser-worker checks must pass under this policy before profile-freeze acceptance.
The amendment does not itself approve profile freeze, application cutover or stable publication.
