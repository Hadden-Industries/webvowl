# Repository Instructions

## Configuration Safety

- NEVER create, modify, rename, or delete configuration files without the user's explicit approval for the exact change.
- Other approvals do not imply approval to change configuration.
- Configuration files include build, bundler, package, lockfile, lint, formatting, test, CI/CD, container, deployment, hosting, environment, and repository-policy files.
- Before requesting approval, identify the exact file and setting, explain the behavioral and pipeline impact, and propose the smallest change.
- If a task appears to require a configuration change, stop and request approval instead of inferring permission.

## Git Guidance

### Local Workspace Commits & Pushing

- For commit-message drafts and commits outside the exception below, follow the `committing-to-git` skill; default to its per-file detailed template.

- **Explicit User Authorization**:
  - Development commits and incorporating disposable commits into development history require explicit user authorization.
  - **Disposable test and review repositories:** Repositories created and owned by this task solely for authorized testing or review, including actual candidate snapshots, qualify when working files and Git metadata/object storage are independent of development repositories, all writes stay within the disposable repository, and commits remain test artifacts or retained review evidence.
  - Verify eligibility.
    Linked worktrees and shared Git storage are excluded; temporary paths or detached HEAD alone prove nothing.
    An `origin` remote is allowed.
  - For qualifying repositories, staging task inputs, choosing concise messages and creating local commits have standing authorization.
    Use the test/review procedure or ordinary Git without further staging, message or commit confirmation.
  - Independently required signing, hooks, verification, evidence retention, configuration approval and higher-priority controls still apply.
  - Pushing requires separate explicit authorization; a push request does not authorize staging or committing uncommitted changes.

### Working Tree Safety

Treat all existing working-tree changes as user-owned and potentially valuable.

- Use the current working-tree contents as the authoritative starting point for ordinary file editing.
- Preserve all pre-existing modifications unless the user explicitly requests that they be changed or discarded.
- Treat any change you did not make as deliberate, including content that was present earlier in the session and is now absent.
  Never restore it, and do not assume a regression, a sync artefact, or a tooling bug; raise it and ask if it materially affects work in progress.
- Edit files directly using minimal, targeted changes.
- Never use `git checkout`, `git restore`, `git reset --hard`, or another Git restoration operation to undo edits made during the current task.
- To undo your own changes, reverse only the specific edits you introduced.
- Use Git primarily to inspect repository state and historical content (`git status`, `git diff`, `git show`) during ordinary editing.
- Execute operations that discard working-tree changes only when the user explicitly requests that destructive operation.

## GitHub Platform Guidance

- Avoid executing destructive Git operations (such as force-pushing to protected branches or deleting remote branches) without explicit, case-by-case approval.
