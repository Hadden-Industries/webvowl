# ADR 0009: Use native Node.js development without an official Docker runtime

| Metadata       | Value                                          |
| -------------- | ---------------------------------------------- |
| **Status**     | Accepted                                       |
| **Date**       | 2026-08-31                                     |
| **Decider**    | Repository owner                               |
| **Supersedes** | [ADR 0001](0001-docker-local-development.md)   |

## Context

ADR 0001 introduced a multi-stage Docker image that combined WebVOWL with a Java OWL2VOWL service. That design worked around a broken external WAR download and preserved the historical same-origin `/convert` contract, but it also retained Java, Maven, Tomcat, Compose, and container-release machinery solely to operate the converter.

The reconstructed WebVOWL main line now performs ontology ingestion and VOWL conversion in JavaScript. Its development and production builds no longer call a remote or co-located Java converter. The Docker stack therefore duplicates no required runtime capability and its pinned end-of-life toolchains, build-time network fetches, container hardening, smoke tests, and GHCR publication workflows impose maintenance and security obligations without serving the application architecture.

The Phase 19A history reconstruction separately preserves the original mixed source, reconstructed WebVOWL, reconstructed UI, and standalone `owlapi` lineages through signed, protected provenance tags. Removing Docker from the current WebVOWL tree does not alter those immutable historical objects.

## Decision

1. Native Node.js, npm, and Vite commands are the canonical WebVOWL development, test, build, and preview workflow.
2. WebVOWL does not maintain an official Dockerfile, Compose topology, Java converter container, GHCR image, or container-specific CI/CD workflow.
3. The obsolete Docker implementation and its operational guides are removed from the current tree. ADR 0001 remains in the repository with `Superseded` status so the retired architecture and its rationale remain reviewable.
4. Historical Docker references in immutable provenance evidence are retained unchanged. They describe earlier repository states and are not active instructions.
5. Any future proposal for an official container distribution must start with a new ADR based on the then-current JavaScript architecture, threat model, release process, and demonstrated user need. ADR 0001 is not a reusable container specification.

## Rationale

The native workflow is the smallest operational surface that matches the application WebVOWL now ships. It tests and builds the same JavaScript pipeline used in production, avoids maintaining a second deployment architecture, and removes the obsolete Java service boundary rather than concealing it behind a container.

Retaining ADR 0001 and the signed provenance refs separates two concerns cleanly: current contributors receive accurate instructions and no dead runtime machinery, while auditors can still reconstruct why the Docker system existed and inspect the exact historical objects that contained it.

## Consequences

### Positive

- Contributors need only a current Node.js LTS release and its bundled npm.
- Development, tests, production builds, and previews exercise one JavaScript application architecture.
- The repository no longer carries obsolete Java, Maven, Tomcat, Compose, image-hardening, or GHCR maintenance obligations.
- Historical Docker decisions remain attributable without being presented as supported operations.

### Negative and mitigations

- The repository no longer publishes or tests an official container image. Users may create private deployment wrappers, but those wrappers are outside the supported WebVOWL release surface.
- Removing the two Docker workflows temporarily leaves this repository without GitHub Actions. Replacement CI policy is a separate, explicitly designed change rather than an improvised part of runtime removal.
- Consumers who depended on the historical `/convert` service topology must migrate to the integrated JavaScript ingestion pipeline. The WebVOWL application itself has already completed that cutover.

## Verification obligations

- No active Dockerfile, Compose file, container startup script, Docker operator guide, or Docker-specific GitHub workflow remains in the current tree.
- The README documents only commands that exist in `package.json` and uses `npm ci` against the committed lockfile.
- The complete Jest suite and production Vite build pass after removal.
- `package.json`, `package-lock.json`, application source, `owlapi` source, fixtures, provenance evidence, release tags, and remote branch tips remain unchanged by this decision.

## Implementation map

| Path                                 | Role                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| `README.md`                          | Canonical native development, test, build, and preview   |
| `docs/adr/0001-docker-local-development.md` | Superseded historical Docker decision             |
| `docs/adr/README.md`                 | ADR status and identity index                            |
| Former Docker and Compose paths      | Removed obsolete runtime and release machinery           |
