# Security Policy

## Supported versions and scope

Security fixes are developed on the current `main` branch of this repository.
The Hadden Industries hosted WebVOWL application is updated through its deployment
process; merging a fix does not establish that it has been deployed. Reports should
identify the affected URL, release or source commit and browser version.

Older snapshots and separately hosted forks have no promised backport support.
Self-hosting operators are responsible for updating their deployment and its
hosting configuration. This policy does not establish a support window for the
separately maintained `owlapi` package.

The scope includes the browser application, ontology import and rendering, export,
WebMCP integration, dependencies, and build/deployment tooling. Ontology documents,
remote resources and tool inputs can be untrusted. Reports should describe how
those inputs cross a security boundary and what an attacker can achieve. Archived
reference material and development dependencies are not blanket exclusions: assess
their actual use and impact.

## Privately report a vulnerability

Please do not disclose a suspected vulnerability in a public issue, pull request
or discussion. Use
[GitHub private vulnerability reporting](https://github.com/Hadden-Industries/webvowl/security/advisories/new).
If that mechanism is unavailable or unsuitable, email `security@haddenindustries.com`.

Include the affected revision/deployment, environment, impact, reproduction steps
or a minimal proof of concept, and any mitigation. Avoid sending credentials,
production datasets or unnecessary personal information.

Maintainers aim to acknowledge reports within five working days. This is a target,
not an SLA or guaranteed resolution time. Repository maintainers own triage and
coordinate with dependency maintainers when a report crosses repository boundaries.

## Triage, remediation and disclosure

Assess reachability, affected versions, impact and exploit prerequisites. Prioritize
active exploitation, exposed credentials and high-impact vulnerabilities. Record
the responsible maintainer, disposition and next action in the private advisory or
alert. A dismissal requires a specific reason and evidence; development-only or
upstream origin alone is not a justification.

Confirmed vulnerabilities are normally coordinated through a private GitHub
security advisory. Request or associate a CVE where appropriate and coordinate
disclosure after a fix or effective mitigation is available. Keep embargoed details
and reporter information restricted until disclosure is agreed.

Security fixes retain the repository's review, testing and provenance controls.
Verify the corrected revision on `main`, the scanner's actual alert state where
applicable, and the affected deployment separately. Automated fix suggestions and
passing workflows do not substitute for that verification. Dependency update PRs
remain subject to review and required checks.
