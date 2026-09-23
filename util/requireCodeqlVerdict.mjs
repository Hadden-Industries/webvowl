import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

// This is the existing required CodeQL app identity, not a similarly named
// GitHub Actions job. Successful extraction alone does not clear alerts.
export function codeqlVerdict(checks, head) {
  const latest = checks
    .filter(
      (check) =>
        check.name === "CodeQL" &&
        check.app?.id === 57789 &&
        check.head_sha === head,
    )
    .sort((left, right) => right.id - left.id)[0];
  if (!latest || latest.status !== "completed") return "pending";
  return latest.conclusion === "success" ? "success" : "failure";
}

export async function waitForCodeqlVerdict({
  repository,
  head,
  token,
  attempts = 18,
  fetchImpl = fetch,
  delay = setTimeout,
}) {
  if (
    !/^[\w.-]+\/[\w.-]+$/u.test(repository ?? "") ||
    !/^[a-f0-9]{40}$/u.test(head ?? "") ||
    !token
  ) {
    throw new Error("Repository, full PR head SHA and read token are required");
  }
  for (let attempt = 0; attempt < attempts; attempt++) {
    const checks = [];
    for (let page = 1; ; page++) {
      const response = await fetchImpl(
        `https://api.github.com/repos/${repository}/commits/${head}/check-runs?filter=latest&per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok)
        throw new Error(`Cannot read CodeQL verdict: HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.check_runs))
        throw new Error("Invalid check-run response");
      checks.push(...body.check_runs);
      if (body.check_runs.length < 100) break;
    }
    const verdict = codeqlVerdict(checks, head);
    if (verdict === "success") return;
    if (verdict === "failure")
      throw new Error("The external CodeQL security check did not pass");
    if (attempt + 1 < attempts) await delay(10000);
  }
  throw new Error("The external CodeQL security verdict is not available");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    await waitForCodeqlVerdict({
      repository: process.env.GITHUB_REPOSITORY,
      head: event.pull_request?.head?.sha,
      token: process.env.GH_TOKEN,
    });
    process.stdout.write("The external CodeQL security verdict passed.\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
