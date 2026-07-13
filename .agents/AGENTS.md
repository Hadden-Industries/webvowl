# GitHub Guidance

- Prefer the GitHub MCP Server for all GitHub and repository interactions (such as managing issues, pull requests, branches, commits, and repository searches); it provides sandboxed execution, structured payloads, and robust observability.
- Only use the Git CLI or GitHub CLI (`gh`) directly if the GitHub MCP server is unavailable (attempt to resolve the cause of the unavailability first, and notify me if you cannot resolve it without my input).
- Before creating or modifying branches, pull requests, or issues, use the MCP tools to verify the current state of the repository to prevent merge conflicts or duplicate work.
- When drafting pull request descriptions or issue comments, ensure clear, structured formatting and cross-reference relevant issue numbers directly.
- Avoid executing destructive Git operations (such as force-pushing to protected branches or deleting remote branches) without explicit, case-by-case approval.
