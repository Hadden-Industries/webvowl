# Complete ontology search implementation plan

## Intent and authority

Issue #13 requires complete bounded traversal of semantic search results.
The owner's 2026-09-22 instruction authorizes fixing every open issue in order, committing between issues, pushing, and closing successful fixes.
This plan resolves the implementation choices within that requested scope.

Risk class: R2, because continuation changes a public tool contract.
Decision owner: repository owner, through the current task instruction.
Reasoning: skipped or mixed results can misrepresent ontology facts.
Potential blast radius: WebMCP search and inspector search consumers.
Reversibility: revert the isolated issue commit; no persistent migration.
Principal unknowns: native browser tool availability and duplicate record facts.
Required artifacts: this contract, regression tests, HISEW receipts and review.
Required specialist lenses: semantic identity and continuation correctness.
Required verification: full relevant profile, independent verification, native WebMCP traversal with the time query and controlled fixtures.
Required human approvals: task authorization already supplied; no new dependency or configuration change is planned.
Maximum sensible autonomy: implement, verify, review, commit, push and close within the supplied authority; preserve protected-branch checks.
Next lifecycle step: capture this baseline and implement test first.

## Design and reuse

The current [WebMCP draft](https://webmachinelearning.github.io/webmcp/), dated 17 September 2026, defines browser tool registration and execution, not semantic search pagination.
Keep the existing native adapter.
Reuse native Map, Set and JSON plus the inspector's existing semantic reference keys and ranking.
These require no package or licence change; existing application code is AGPL-3.0-only.
The existing arrangement pager demonstrates response-sized offsets; share-link paging demonstrates bounded continuation storage.
Neither currently provides search-input and document-revision binding.
The residual application work is semantic deduplication and a bounded continuation contract.

1. Inspector search merges array-valued facts for equal semantic reference keys before ranking.
   Kind remains part of identity; anonymous references retain load generation and local ID.
   Preserve ranking and human unbounded search.
2. Add an internal offset and exact totalMatchCount to inspector search.
   Only requested page records are projected.
   Separate omitted optional facts from the existence of more matches.
3. WebMCP accepts an optional opaque continuation string with the same search inputs.
   Keep at most eight continuation records, containing only normalized inputs, generation, revision, language and next offset.
   No ontology cache.
   Oldest records expire explicitly; tokens do not survive page reloads.
4. Validate the binding before each page and again after the controller call.
   Reject changed query, kinds, limit, neighborhood choice, generation, revision, language, malformed tokens and expired tokens.
   Callers restart the search.
5. Size the actual success envelope to 1,500 characters.
   Drop optional facts before shortening display text or removing complete trailing matches.
   Never shorten a reference IRI.
   Advance only by returned matches.
   A single identity that cannot fit fails explicitly, preserving the ability to restart with another interface.
   Successful nonterminal pages always progress.
6. Return continuation null on completion, exact totalMatchCount, hasMore and optionalFactsTruncated.
   Preserve upstream incompleteness in isTruncated; callers use continuation/hasMore to assess traversal completion.

An immutable full-result cache was rejected because ontology-sized retained copies complicate bounded memory.
Unbound offsets were rejected because edits can silently mix result sets.
The bounded binding records retain small metadata and explicitly refuse stale results.

## Implementation and verification sequence

- [ ] In ontologyInspector.test.js, exercise repeated same-kind identities with different labels and neighborhoods, cross-kind IRIs and anonymous identities.
      Assert literal expected identity unions and unchanged ranking, then run the test and observe the missing deduplication behavior.
- [ ] Implement inspector merge, offset and count in ontologyInspector.js and rerun the inspector suite.
- [ ] In webMcpSearchPagination.test.js, connect the production inspector and dispatcher.
      Traverse response-sized pages and compare their union with an independently declared expected list.
      Exercise Unicode and long IRIs, optional facts, empty/final pages, limits, malformed and stale continuations, and edits.
      Run with `npm test -- --runInBand --runTestsByPath` and observe failures first.
- [ ] Implement the schema, validation and response sizing in the WebMCP search route, keeping unrelated tools out of this issue.
      Document the contract in docs/webmcp.md and run the affected controller and WebMCP suites.
- [ ] Exercise native WebMCP in a supported browser, including the time query.
      Freeze the candidate after targeted formatting and lint checks.
      Use the selected ordinary reviewer and independent verifier; resolve actual findings.
- [ ] Stage only this issue's files, run the HISEW full profile once on the final candidate, retain handoff, create a signed detailed commit, publish the branch and PR, and close #13 with concrete evidence after successful commit.

Later issues #14 and #15 remain separate changes.
No deployment, dependency upgrade or unrelated native API migration is part of #13.
