# Bounded ontology summaries

## Accepted scope and risk

The owner's sequential issue-fix instruction authorizes implementing issue #14, verification, signed commit, push and closure.
Risk is R2: an agent-facing section continuation contract changes, and silent loss of ontology identity can mislead consumers.
The scope is get_ontology_summary; search and detail pagination remain separate issues.
No dependencies, configuration changes, migration or deployment are required.
Reversion is the isolated issue commit.

## Design and reuse

Reuse the existing WebMCP registration, JSON encoding, response ceiling and bounded Map continuation pattern from search.
The current WebMCP draft delegates application result semantics to the tool; no new transport or dependency is needed.
Native JSON and Web Crypto provide escaping and content digests.
Existing application code remains under its current licence.

Keep a small summary unchanged when it fits.
Under pressure, preserve the exact ontology IRI and core element counts, advertise available optional sections and mark omitted content explicitly.
If the required core cannot fit, return an actionable failure instead of an empty success or a shortened identity.
The caller can request a named section and concatenate bounded JSON fragments to reconstruct that complete section.
Summary inspection must retain original text and warning collections so pagination can retrieve the full optional content.
Tokens bind section, content digest, load generation, document revision and language; changes or eviction require a restart.
Retain at most eight small continuation records, never ontology-sized snapshots.
Validate state around asynchronous reads and digest calculation.
Every nonterminal success advances by the exact returned fragment length.

## Verification and delivery

Reproduce rich-header core loss with a failing production-projector test.
Exercise section reconstruction, escaped Unicode, long identities, stale inputs, read races, eviction and upstream incompleteness through the dispatcher.
Update inspector expectations to lossless summary text and warnings.
Verify the reported ontology through native WebMCP, including useful identity/counts and a paged section.
Freeze the final candidate for ordinary review and independent verification; disposition all findings.
Run the HISEW full profile, relevant tests and documentation checks, retain evidence, commit and publish before closing #14.
User authorization is already supplied; hosted CI, PR merge and deployment are distinct outcomes.
