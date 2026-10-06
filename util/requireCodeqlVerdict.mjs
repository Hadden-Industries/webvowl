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

// A neutral external check is not a passing verdict. This opt-in route instead
// requires independent, complete provider evidence for the frozen PR source.
export async function verifyCompleteCodeqlProof({
  repository,
  head,
  base,
  merge,
  pullRequestNumber,
  token,
  fetchImpl = fetch,
}) {
  const oid = /^[a-f0-9]{40}$/u;
  if (
    !/^[\w.-]+\/[\w.-]+$/u.test(repository ?? "") ||
    !oid.test(head ?? "") ||
    !oid.test(base ?? "") ||
    !oid.test(merge ?? "") ||
    !token ||
    !Number.isSafeInteger(pullRequestNumber) ||
    pullRequestNumber < 1
  )
    throw new Error(
      "Frozen PR source identities and a read token are required",
    );
  const started = performance.now();
  function remainingTime() {
    const remaining = 180_000 - (performance.now() - started);
    if (remaining <= 0)
      throw new Error("Complete CodeQL proof deadline exceeded");
    return remaining;
  }
  async function get(path) {
    const remaining = remainingTime();
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(30_000, Math.floor(remaining))),
        ),
      },
    );
    if (!response.ok)
      throw new Error(
        `Cannot read complete CodeQL proof: HTTP ${response.status}`,
      );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing bounded CodeQL proof response body");
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1_048_576)
          throw new Error("CodeQL proof response exceeds bounds");
        chunks.push(Buffer.from(chunk.value));
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    remainingTime();
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  async function list(path) {
    const items = [];
    for (let page = 1; page <= 4; page++) {
      const batch = await get(`${path}&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length > 100)
        throw new Error("Invalid CodeQL proof list");
      items.push(...batch);
      if (batch.length < 100) return items;
    }
    throw new Error("CodeQL proof pagination exceeds bounds");
  }
  function assertPr(pr) {
    if (
      !pr ||
      pr.number !== pullRequestNumber ||
      pr.state !== "open" ||
      pr.head?.sha !== head ||
      pr.base?.sha !== base ||
      pr.base?.ref !== "main" ||
      pr.base?.repo?.full_name !== repository ||
      !oid.test(pr.merge_commit_sha ?? "")
    )
      throw new Error("PR source or base drifted during CodeQL proof");
  }
  const pr = await get(`pulls/${pullRequestNumber}`);
  assertPr(pr);
  const analyzed = await get(`git/commits/${merge}`);
  const current =
    merge === pr.merge_commit_sha
      ? analyzed
      : await get(`git/commits/${pr.merge_commit_sha}`);
  function assertMerge(commit, expected) {
    if (
      !commit ||
      commit.sha !== expected ||
      !oid.test(commit.tree?.sha ?? "") ||
      !Array.isArray(commit.parents) ||
      commit.parents.length !== 2 ||
      commit.parents[0]?.sha !== base ||
      commit.parents[1]?.sha !== head
    )
      throw new Error(
        "CodeQL merge source does not bind the exact base and head",
      );
  }
  assertMerge(analyzed, merge);
  assertMerge(current, pr.merge_commit_sha);
  if (analyzed.tree.sha !== current.tree.sha)
    throw new Error("CodeQL source tree changed");
  const ref = encodeURIComponent(`refs/pull/${pullRequestNumber}/merge`);
  const analyses = await list(
    `code-scanning/analyses?ref=${ref}&tool_name=CodeQL`,
  );
  const accepted = [];
  for (const language of ["actions", "javascript-typescript", "python"]) {
    const candidates = analyses.filter(
      (item) => item?.category === `/language:${language}`,
    );
    if (
      candidates.some((item) => !Number.isSafeInteger(item.id) || item.id < 1)
    )
      throw new Error(`Malformed CodeQL analysis identity for ${language}`);
    const analysis = candidates.sort((left, right) => right.id - left.id)[0];
    if (
      !analysis ||
      !Number.isSafeInteger(analysis.id) ||
      analysis.id < 1 ||
      analysis.tool?.name !== "CodeQL" ||
      analysis.commit_sha !== merge ||
      analysis.ref !== `refs/pull/${pullRequestNumber}/merge` ||
      analysis.analysis_key !== ".github/workflows/codeql.yml:analyze" ||
      analysis.environment !== JSON.stringify({ language }) ||
      analysis.error !== "" ||
      analysis.warning !== "" ||
      !Number.isSafeInteger(analysis.rules_count) ||
      analysis.rules_count < 1 ||
      analysis.results_count !== 0
    )
      throw new Error(`Incomplete or nonzero CodeQL analysis for ${language}`);
    accepted.push({ language, id: analysis.id, rules: analysis.rules_count });
  }
  const alerts = await list(
    `code-scanning/alerts?ref=${ref}&state=open&tool_name=CodeQL`,
  );
  if (alerts.length !== 0)
    throw new Error("Open CodeQL alerts prevent complete proof");
  const finalPr = await get(`pulls/${pullRequestNumber}`);
  assertPr(finalPr);
  if (finalPr.merge_commit_sha !== pr.merge_commit_sha)
    throw new Error("PR merge identity changed during CodeQL proof");
  remainingTime();
  return {
    repository,
    head,
    base,
    analyzedMerge: merge,
    currentMerge: pr.merge_commit_sha,
    tree: analyzed.tree.sha,
    analyses: accepted,
    openAlerts: 0,
    authority:
      "Complete API proof; the external neutral verdict is not relabelled success",
  };
}

export async function waitForCodeqlVerdict({
  repository,
  head,
  token,
  attempts = 18,
  completeAnalysisProof = null,
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
    if (verdict === "failure") {
      const latest = checks
        .filter(
          (check) =>
            check.name === "CodeQL" &&
            check.app?.id === 57789 &&
            check.head_sha === head,
        )
        .sort((left, right) => right.id - left.id)[0];
      if (latest?.conclusion === "neutral" && completeAnalysisProof) {
        const proof = await verifyCompleteCodeqlProof({
          repository,
          head,
          token,
          fetchImpl,
          pullRequestNumber: completeAnalysisProof.pullRequestNumber,
          base: completeAnalysisProof.base,
          merge: completeAnalysisProof.merge,
        });
        process.stdout.write(
          `Complete CodeQL API proof: ${JSON.stringify(proof)}\n`,
        );
        return;
      }
      throw new Error("The external CodeQL security check did not pass");
    }
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
      completeAnalysisProof:
        process.env.CODEQL_COMPLETE_ANALYSIS_PROOF === "true"
          ? {
              pullRequestNumber: event.pull_request?.number,
              base: event.pull_request?.base?.sha,
              merge: process.env.GITHUB_SHA,
            }
          : null,
    });
    process.stdout.write(
      "CodeQL gate passed with an admitted security proof.\n",
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
