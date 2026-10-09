/** Prior PR evidence is an optimization: unproved equivalence requires execution. */
import { isDeepStrictEqual } from "node:util";

export const CI_WORKFLOW = ".github/workflows/webvowl-ci.yml";
export const CI_REPOSITORY = "Hadden-Industries/webvowl";
export const RECEIPT_LIMIT = 64 * 1024;
const checkNames = (full) => ({
  scope: ["Select relevant checks"],
  application: ["application"],
  // GitHub skips a false job-level condition before expanding the matrix.
  tooling: full
    ? ["Python tooling (ubuntu-24.04)", "Python tooling (windows-latest)"]
    : ["Python tooling (${{ matrix.os }})"],
  documentation: ["Markdown checks"],
  required: ["WebVOWL application"],
});
const sha = (value) =>
  typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const id = (value) => Number.isSafeInteger(value) && value > 0;
const digest = (value) =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
function requireFact(condition, reason) {
  if (!condition) throw new Error(reason);
}
const sameRepository = (observed, expected) =>
  observed?.id === expected.id && observed?.full_name === CI_REPOSITORY;
const receiptName = (run) => `webvowl-ci-${run.id}-${run.run_attempt}`;
function validateContext(context) {
  requireFact(
    context.repository?.full_name === CI_REPOSITORY &&
      id(context.repository.id) &&
      id(context.runId) &&
      id(context.runAttempt) &&
      sha(context.sha) &&
      context.snapshot.commit === context.sha &&
      sha(context.snapshot.tree) &&
      sha(context.snapshot.workflow) &&
      context.snapshot.parents.length === 2 &&
      context.snapshot.parents.every(sha) &&
      context.host?.os === "Linux" &&
      context.host.architecture === "X64" &&
      context.host.image === "ubuntu24" &&
      /^\d{8}\.\d+(?:\.\d+)?$/u.test(context.host.imageVersion ?? "") &&
      /^v\d+\.\d+\.\d+$/u.test(context.host.node ?? ""),
    "Invalid source checkout or hosted identity",
  );
}
function expectedResults(full) {
  return {
    scope: "success",
    application: full ? "success" : "skipped",
    tooling: full ? "success" : "skipped",
    documentation: "success",
    required: "success",
  };
}

/** Required gate admits executed scope or verified provenance with all producer jobs skipped. */
export function requireChecks(needs) {
  const scope = needs.scope;
  requireFact(scope?.result === "success", "Scope selection failed");
  const outputs = scope.outputs;
  requireFact(["true", "false"].includes(outputs?.full), "Invalid check scope");
  requireFact(
    ["true", "false"].includes(outputs.reuse),
    "Missing evidence decision",
  );
  const reused = outputs.reuse === "true";
  if (reused) {
    requireFact(
      /^[1-9][0-9]*$/u.test(outputs.source_run_id ?? "") &&
        /^[1-9][0-9]*$/u.test(outputs.source_run_attempt ?? "") &&
        /^[1-9][0-9]*$/u.test(outputs.source_receipt_id ?? "") &&
        digest(outputs.source_receipt_digest) &&
        sha(outputs.source_commit),
      "Reuse provenance is missing",
    );
  }
  const results = expectedResults(outputs.full === "true");
  for (const job of ["application", "tooling", "documentation"]) {
    requireFact(
      needs[job]?.result === (reused ? "skipped" : results[job]),
      `Unexpected ${job} result`,
    );
  }
  return { full: outputs.full === "true", reused };
}

/** Record only executed same-repository PR merges, preserving documentation-only skips. */
export function createReceipt({ context, needs, now = Date.now() }) {
  validateContext(context);
  const accepted = requireChecks(needs);
  const pull = context.event.pull_request;
  requireFact(
    !accepted.reused &&
      context.eventName === "pull_request" &&
      id(context.event.number) &&
      context.ref === `refs/pull/${context.event.number}/merge` &&
      pull?.base?.ref === "main" &&
      sameRepository(pull.base.repo, context.repository) &&
      sameRepository(pull.head?.repo, context.repository) &&
      isDeepStrictEqual(context.snapshot.parents, [
        pull.base.sha,
        pull.head.sha,
      ]),
    "Receipt requires an executed same-repository PR merge",
  );
  return {
    schemaVersion: 1,
    mode: "EXECUTED",
    repository: context.repository,
    runId: context.runId,
    runAttempt: context.runAttempt,
    pullRequest: context.event.number,
    recordedAt: new Date(now).toISOString(),
    snapshot: context.snapshot,
    host: context.host,
    full: accepted.full,
    results: expectedResults(accepted.full),
    jobs: checkNames(accepted.full),
  };
}
function assertPush(context) {
  validateContext(context);
  const event = context.event;
  requireFact(
    context.eventName === "push" &&
      context.ref === "refs/heads/main" &&
      event.ref === context.ref &&
      event.deleted === false &&
      event.forced === false &&
      event.created === false &&
      event.after === context.sha &&
      event.before === context.snapshot.parents[0] &&
      sameRepository(event.repository, context.repository) &&
      event.repository.default_branch === "main",
    "Not an eligible normal main merge",
  );
}
function assertRun(run, context, pull, now) {
  requireFact(
    id(run.id) &&
      id(run.run_attempt) &&
      run.event === "pull_request" &&
      run.path === CI_WORKFLOW &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.head_sha === pull.head.sha &&
      sameRepository(run.repository, context.repository) &&
      sameRepository(run.head_repository, context.repository) &&
      Date.parse(run.created_at) <= now &&
      Date.parse(run.updated_at) <= now,
    "Latest PR run is not eligible",
  );
}
function assertArtifact(artifact, run, context, now) {
  requireFact(
    id(artifact?.id) &&
      artifact.expired === false &&
      Date.parse(artifact.expires_at) > now &&
      digest(artifact.digest) &&
      artifact.name === receiptName(run) &&
      artifact.size_in_bytes > 0 &&
      artifact.size_in_bytes <= RECEIPT_LIMIT &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run.repository_id === context.repository.id &&
      artifact.workflow_run.head_repository_id === context.repository.id &&
      artifact.workflow_run.head_sha === run.head_sha,
    "Receipt artifact is absent, expired or mismatched",
  );
}
function closedListing(listing, field) {
  requireFact(
    Array.isArray(listing?.[field]) &&
      listing.total_count === listing[field].length &&
      listing.total_count <= 100,
    "Incomplete API listing",
  );
  return listing[field];
}
async function latestRun(read, pull) {
  const listing = await read(
    `/actions/workflows/webvowl-ci.yml/runs?event=pull_request&head_sha=${pull.head.sha}&per_page=100`,
  );
  return closedListing(listing, "workflow_runs").sort((a, b) => b.id - a.id)[0];
}

/** Select one immutable receipt from the latest PR run; never search past a failed newer run. */
export async function selectProof({ context, read, now = Date.now() }) {
  assertPush(context);
  const associated = await read(`/commits/${context.sha}/pulls?per_page=100`);
  requireFact(
    Array.isArray(associated) && associated.length < 100,
    "Incomplete PR lookup",
  );
  const pulls = associated.filter(
    (pull) =>
      pull.state === "closed" &&
      pull.merged_at &&
      pull.base?.ref === "main" &&
      pull.base.sha === context.snapshot.parents[0] &&
      pull.head?.sha === context.snapshot.parents[1] &&
      sameRepository(pull.base.repo, context.repository) &&
      sameRepository(pull.head.repo, context.repository),
  );
  requireFact(
    pulls.length === 1 && id(pulls[0].number),
    "No unique same-repository merged PR",
  );
  const pull = pulls[0];
  const run = await latestRun(read, pull);
  assertRun(run, context, pull, now);
  const artifacts = closedListing(
    await read(`/actions/runs/${run.id}/artifacts?per_page=100`),
    "artifacts",
  ).filter((item) => item.name === receiptName(run));
  requireFact(artifacts.length === 1, "No unique PR receipt");
  assertArtifact(artifacts[0], run, context, now);
  return { pull, run, artifact: artifacts[0] };
}

/** Authenticate downloaded proof, merge equivalence and closed job inventory, then recheck mutable state. */
export async function verifyProof({
  context,
  selection,
  receipt,
  read,
  full,
  now = Date.now(),
}) {
  assertPush(context);
  const { pull, artifact } = selection;
  const run = await read(`/actions/runs/${selection.run.id}`);
  assertRun(run, context, pull, now);
  requireFact(
    run.run_attempt === selection.run.run_attempt,
    "PR run was rerun during transfer",
  );
  const currentArtifact = await read(`/actions/artifacts/${artifact.id}`);
  assertArtifact(currentArtifact, run, context, now);
  requireFact(
    currentArtifact.digest === artifact.digest,
    "Receipt digest changed",
  );
  requireFact(
    receipt?.schemaVersion === 1 &&
      receipt.mode === "EXECUTED" &&
      isDeepStrictEqual(receipt.repository, context.repository) &&
      receipt.runId === run.id &&
      receipt.runAttempt === run.run_attempt &&
      receipt.pullRequest === pull.number &&
      Date.parse(receipt.recordedAt) >= Date.parse(run.run_started_at) &&
      Date.parse(receipt.recordedAt) <= Date.parse(run.updated_at) &&
      typeof receipt.full === "boolean" &&
      receipt.full === full &&
      isDeepStrictEqual(receipt.results, expectedResults(full)) &&
      isDeepStrictEqual(receipt.jobs, checkNames(full)) &&
      isDeepStrictEqual(receipt.host, context.host) &&
      sha(receipt.snapshot?.commit) &&
      receipt.snapshot.tree === context.snapshot.tree &&
      receipt.snapshot.workflow === context.snapshot.workflow &&
      isDeepStrictEqual(receipt.snapshot.parents, context.snapshot.parents),
    "Receipt does not prove equivalent inputs and check scope",
  );
  const tested = await read(`/git/commits/${receipt.snapshot.commit}`);
  requireFact(
    tested.sha === receipt.snapshot.commit &&
      tested.tree?.sha === context.snapshot.tree &&
      isDeepStrictEqual(
        tested.parents?.map((parent) => parent.sha),
        context.snapshot.parents,
      ),
    "Tested commit differs from landed tree or parents",
  );
  const jobs = closedListing(
    await read(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`),
    "jobs",
  );
  const expected = Object.entries(expectedResults(full)).flatMap(
    ([key, result]) => checkNames(full)[key].map((name) => ({ name, result })),
  );
  requireFact(
    jobs.length === expected.length &&
      new Set(jobs.map((job) => job.name)).size === expected.length &&
      jobs.every(
        (job) =>
          job.run_id === run.id &&
          job.run_attempt === run.run_attempt &&
          job.head_sha === run.head_sha &&
          job.status === "completed" &&
          expected.some(
            (item) => item.name === job.name && item.result === job.conclusion,
          ),
      ),
    "PR job inventory is incomplete, failed, unexpectedly skipped or from mixed attempts",
  );
  // A rerun or a new PR run during admission invalidates the earlier selection.
  const finalRun = await latestRun(read, pull);
  assertRun(finalRun, context, pull, now);
  requireFact(
    finalRun.id === run.id && finalRun.run_attempt === run.run_attempt,
    "Latest PR run changed during verification",
  );
  const finalArtifact = await read(`/actions/artifacts/${artifact.id}`);
  assertArtifact(finalArtifact, run, context, now);
  requireFact(
    finalArtifact.digest === artifact.digest,
    "Receipt changed during verification",
  );
  return {
    reuse: "true",
    source_run_id: String(run.id),
    source_run_attempt: String(run.run_attempt),
    source_commit: receipt.snapshot.commit,
    source_receipt_id: String(artifact.id),
    source_receipt_digest: artifact.digest,
  };
}
