# Coherent ontology detail pages

## Accepted scope and risk

The owner's sequential issue-fix request authorizes issue #15 implementation, verification, signed commit, push and closure.
Risk is R2 because continuation is a public contract and mixed revisions misrepresent facts.
Scope is the detail tool only; no editing API, new dependency, configuration change or deployment is required.
Revert the isolated commit to recover the prior behavior.

## Design and reuse

Reuse the existing detail JSON fragment projector, exact reference normalization and bounded continuation Map pattern.
Native JSON and crypto.randomUUID suffice; existing application licensing and dependencies remain unchanged.
The WebMCP transport does not provide ontology snapshot semantics, so binding remains application-owned.

Preserve the first-page request and existing offset, generation and language fields.
Every nonterminal page also returns an opaque continuation token, required for subsequent nonzero offsets.
Bind tokens to the normalized element reference, load generation, document revision, language and exact next offset.
Keep at most eight small metadata records; no retained description snapshots.
Reject expired or mismatched tokens before reading, and reject state changes during the controller read.
Return documentRevision with details so callers can identify the observed revision.
Include token overhead when sizing the exact response envelope.
Changing an element, revision, language or load requires restarting at offset zero without a token.

## Verification and delivery

Reproduce the equal-length A/B revision mixing through the production dispatcher before implementing the guard.
Test unchanged full reconstruction, equal-length replacements, insertions, deletions, identity changes, language, generation, invalid offsets, missing/expired tokens and read races.
Use a disposable browser ontology, read a first page through native WebMCP, edit through the human UI and verify stale rejection plus a coherent fresh read.
Freeze the final candidate for ordinary review and independent verification.
Run the HISEW full profile, full tests and documentation checks, retain the evidence, then commit, push and close #15.
No merge or deployment is implied by local acceptance.
