# Canonical VOWL candidate iteration amendment

**Decision date:** 4 October 2026.
**Decision owner:** Maksym Shostak.
**Status:** Owner-directed amendment; effective for continuing implementation and qualification.

## Direction and precedence

The owner requested that immutable-release requirements be relaxed so errors can be corrected while the programme continues.
Canonical VOWL remains an experimental candidate until a later explicit stable-release decision.
This amendment controls the release and freeze sequencing in the implementation plan, design and release reports where those documents would otherwise prevent candidate iteration.
It does not change the current technical contracts or their successful bytes.

The earlier acceptance of FREEZE-001, FREEZE-002 and the compatible-view registry is retained as acceptance of a reviewed candidate checkpoint.
It no longer imposes a permanent stable-contract commitment on subsequent candidates.
The accepted manifest SHA-256 is `43cd3c7c6f7d412552ed9cddc8f04866a89eb74eeb95e4544e3665238931224e`.
Keep that snapshot, its original approval receipt and its qualification evidence unchanged; this later decision supersedes their release-policy effect rather than rewriting their history.

## Corrections during candidate development

Implementation, qualification and necessary repairs may continue without immutable profile hosting, a permanent profile freeze or a stable release.
Corrections may change schemas, retained structure, mapping rules, identifiers or canonical bytes when justified by an error or an accepted requirement.
Do not preserve a known defect merely to maintain agreement with this candidate.

For each correction, record the defect, affected contract and candidate revision, then run the checks that demonstrate the correction and protect affected behavior.
Update independent expectations only from a documented specification-based justification; production output alone is not an oracle.
Reuse unaffected evidence with its original scope and revision clearly identified.
Consolidate changes before broad review and use focused follow-up review where needed.
Existing review authorizations and bounded-retry decisions remain applicable; this amendment creates no requirement for a new full review on every edit.

Identify each qualified candidate by its exact source/specification revision and artifact digest, outside canonical bytes under the existing experimental convention.
Proposed `/v1` profile strings are candidate identifiers, not an unqualified stable interoperability promise.
Any candidate distributed to others must be visibly experimental and accompanied by its revision identity and compatibility limitations.
Before distributing a byte-affecting revision, state whether earlier candidate files remain readable and provide the applicable migration, recovery or explicit incompatibility disposition.
Do not silently overwrite an already identified candidate or claim that two differing byte contracts are the same qualified revision.

## Deferred release commitments

SLICE-008's immutable publication work is deferred as a stable-release activity; it is not a prerequisite for further candidate implementation or qualification.
The proposed universal-ontology hosting integration is likewise deferred, not a pending permission needed to continue this work.
Publication and permanent profile commitments require a later explicit owner decision against the then-current candidate and evidence.
At that point, reassess identifiers, versioning, distribution rights, compatibility and recovery before making stable promises.

This amendment does not authorize production cutover, legacy retirement, deployment, cross-repository writes or configuration changes.
Their existing scope and approval requirements remain in effect.
Candidate readiness and stable-release readiness are distinct: deferred publication does not make unfinished implementation complete, and a qualified candidate does not by itself authorize a production switch.

The owner's subsequent 4 October authorization covers Personas distribution, production cutover and final retirement; its implementation is recorded in the [cutover report](../reviews/canonical-vowl-production-cutover-and-retirement.md).
That later authorization permits an experimental application deployment without reinstating immutable publication as a prerequisite.
The original implementation-plan bytes remain pinned historical evidence for the migration corpus; this separate amendment controls current release policy.
