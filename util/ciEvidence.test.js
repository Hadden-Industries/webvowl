import {
  createReceipt,
  requireChecks,
  selectProof,
  verifyProof,
} from "./ciEvidence.mjs";
import {
  captureSnapshot,
  readDownloadedReceipt,
  runCommand,
} from "./ciEvidenceCommand.mjs";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";

const hash = (character) => character.repeat(40);
const repository = { id: 19, full_name: "Hadden-Industries/webvowl" };
function context() {
  return {
    eventName: "pull_request",
    repository,
    sha: hash("c"),
    ref: "refs/pull/7/merge",
    runId: 41,
    runAttempt: 1,
    host: {
      os: "Linux",
      architecture: "X64",
      image: "ubuntu24",
      imageVersion: "20261009.1",
      node: "v24.21.0",
    },
    snapshot: {
      commit: hash("c"),
      tree: hash("d"),
      parents: [hash("a"), hash("b")],
      workflow: hash("e"),
    },
    event: {
      number: 7,
      pull_request: {
        base: { ref: "main", sha: hash("a"), repo: repository },
        head: { sha: hash("b"), repo: repository },
      },
    },
  };
}
function needs(full = "true") {
  return {
    scope: { result: "success", outputs: { full, reuse: "false" } },
    application: { result: full === "true" ? "success" : "skipped" },
    tooling: { result: full === "true" ? "success" : "skipped" },
    documentation: { result: "success" },
  };
}

test("a successful same-repository PR records its actual tested merge and check scope", () => {
  const receipt = createReceipt({
    context: context(),
    needs: needs(),
    now: Date.parse("2026-10-09T12:01:00Z"),
  });
  expect(receipt).toMatchObject({
    mode: "EXECUTED",
    full: true,
    runId: 41,
    pullRequest: 7,
    snapshot: {
      commit: hash("c"),
      tree: hash("d"),
      parents: [hash("a"), hash("b")],
    },
  });
});

test("documentation receipts retain explicit application/tooling skips", () => {
  expect(
    createReceipt({ context: context(), needs: needs("false") }),
  ).toMatchObject({
    full: false,
    results: {
      application: "skipped",
      tooling: "skipped",
      documentation: "success",
    },
  });
});

test.each(["failure", "cancelled", "skipped", "pending"])(
  "failed documentation cannot produce proof: %s",
  (result) => {
    const checks = needs();
    checks.documentation.result = result;
    expect(() =>
      createReceipt({ context: context(), needs: checks }),
    ).toThrow();
  },
);

test.each([
  (value) => {
    value.event.pull_request.head.repo = { id: 99, full_name: "fork/webvowl" };
  },
  (value) => {
    value.snapshot.parents.reverse();
  },
  (value) => {
    value.ref = "refs/heads/main";
  },
  (value) => {
    value.host.imageVersion = "";
  },
])("PR receipts reject invalid source identities %#", (change) => {
  const source = context();
  change(source);
  expect(() => createReceipt({ context: source, needs: needs() })).toThrow();
});

// The external API is replaced by literal GitHub contract records; admission remains real.
function proofFixture(full = true, now = Date.parse("2026-10-09T12:10:00Z")) {
  const prContext = context();
  const receipt = createReceipt({
    context: prContext,
    needs: needs(String(full)),
    now: now - 60000,
  });
  const target = context();
  target.eventName = "push";
  target.sha = hash("f");
  target.snapshot.commit = target.sha;
  target.ref = "refs/heads/main";
  target.event = {
    ref: target.ref,
    before: hash("a"),
    after: target.sha,
    created: false,
    forced: false,
    deleted: false,
    repository: { ...repository, default_branch: "main" },
  };
  const pull = {
    ...prContext.event.pull_request,
    number: 7,
    state: "closed",
    merged_at: new Date(now - 30000).toISOString(),
  };
  const run = {
    id: 41,
    run_attempt: 1,
    event: "pull_request",
    path: ".github/workflows/webvowl-ci.yml",
    status: "completed",
    conclusion: "success",
    head_sha: hash("b"),
    repository,
    head_repository: repository,
    created_at: new Date(now - 600000).toISOString(),
    run_started_at: new Date(now - 599000).toISOString(),
    updated_at: new Date(now - 50000).toISOString(),
  };
  const artifact = {
    id: 51,
    name: "webvowl-ci-41-1",
    expired: false,
    expires_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    digest: `sha256:${"1".repeat(64)}`,
    size_in_bytes: 2000,
    workflow_run: {
      id: 41,
      repository_id: 19,
      head_repository_id: 19,
      head_sha: hash("b"),
    },
  };
  const jobs = [
    ["Select relevant checks", "success"],
    ["application", full ? "success" : "skipped"],
    ...(full
      ? [
          ["Python tooling (ubuntu-24.04)", "success"],
          ["Python tooling (windows-latest)", "success"],
        ]
      : [["Python tooling (${{ matrix.os }})", "skipped"]]),
    ["Markdown checks", "success"],
    ["WebVOWL application", "success"],
  ].map(([name, conclusion]) => ({
    name,
    conclusion,
    run_id: 41,
    run_attempt: 1,
    head_sha: hash("b"),
    status: "completed",
  }));
  const responses = {
    [`/commits/${target.sha}/pulls?per_page=100`]: [pull],
    [`/actions/workflows/webvowl-ci.yml/runs?event=pull_request&head_sha=${hash("b")}&per_page=100`]:
      { total_count: 1, workflow_runs: [run] },
    "/actions/runs/41/artifacts?per_page=100": {
      total_count: 1,
      artifacts: [artifact],
    },
    "/actions/runs/41": run,
    "/actions/artifacts/51": artifact,
    [`/git/commits/${hash("c")}`]: {
      sha: hash("c"),
      tree: { sha: hash("d") },
      parents: [{ sha: hash("a") }, { sha: hash("b") }],
    },
    "/actions/runs/41/jobs?filter=latest&per_page=100": {
      total_count: full ? 6 : 5,
      jobs,
    },
  };
  const read = async (path) => {
    if (!Object.hasOwn(responses, path)) {
      throw new Error(`Unexpected API request ${path}`);
    }
    return JSON.parse(JSON.stringify(responses[path]));
  };
  return {
    context: target,
    receipt,
    now,
    full,
    read,
    responses,
    run,
    artifact,
    jobs,
  };
}

test.each([true, false])(
  "equivalent normal merge reuses authenticated check scope: full=%s",
  async (full) => {
    const fixture = proofFixture(full);
    // PR synthetic commit c differs from landed f; equal tree and both parents are the oracle.
    expect(fixture.receipt.snapshot.commit).not.toBe(fixture.context.sha);
    const selection = await selectProof(fixture);
    const outputs = await verifyProof({ ...fixture, selection });
    expect(outputs).toEqual({
      reuse: "true",
      source_run_id: "41",
      source_run_attempt: "1",
      source_commit: hash("c"),
      source_receipt_id: "51",
      source_receipt_digest: `sha256:${"1".repeat(64)}`,
    });
    expect(
      requireChecks({
        ...needs(String(full)),
        scope: {
          result: "success",
          outputs: { full: String(full), ...outputs },
        },
        application: { result: "skipped" },
        tooling: { result: "skipped" },
        documentation: { result: "skipped" },
      }),
    ).toEqual({ full, reused: true });
  },
);

test.each([
  [
    "direct/squash push",
    (f) => {
      f.context.snapshot.parents.pop();
    },
  ],
  [
    "forced push",
    (f) => {
      f.context.event.forced = true;
    },
  ],
  [
    "rebase or changed base",
    (f) => {
      f.context.event.before = hash("9");
    },
  ],
  [
    "fork PR",
    (f) => {
      f.responses[`/commits/${hash("f")}/pulls?per_page=100`][0].head.repo = {
        id: 99,
        full_name: "fork/webvowl",
      };
    },
  ],
  [
    "incomplete run listing",
    (f) => {
      Object.values(f.responses).find(
        (item) => item.workflow_runs,
      ).total_count = 101;
    },
  ],
  [
    "latest failed run",
    (f) => {
      Object.values(f.responses)
        .find((item) => item.workflow_runs)
        .workflow_runs.push({ ...f.run, id: 42, conclusion: "failure" });
      Object.values(f.responses).find(
        (item) => item.workflow_runs,
      ).total_count = 2;
    },
  ],
  [
    "expired artifact",
    (f) => {
      f.artifact.expired = true;
    },
  ],
  [
    "oversized artifact",
    (f) => {
      f.artifact.size_in_bytes = 65537;
    },
  ],
  [
    "foreign artifact",
    (f) => {
      f.artifact.workflow_run.repository_id = 99;
    },
  ],
])("selection rejects %s", async (_description, change) => {
  const fixture = proofFixture();
  change(fixture);
  await expect(selectProof(fixture)).rejects.toThrow();
});

test.each([
  [
    "different tree",
    (f) => {
      f.receipt.snapshot.tree = hash("9");
    },
  ],
  [
    "different parents",
    (f) => {
      f.receipt.snapshot.parents.reverse();
    },
  ],
  [
    "different workflow",
    (f) => {
      f.receipt.snapshot.workflow = hash("9");
    },
  ],
  [
    "different image",
    (f) => {
      f.receipt.host.imageVersion = "20261010.1";
    },
  ],
  [
    "different Node",
    (f) => {
      f.receipt.host.node = "v26.0.0";
    },
  ],
  [
    "different check scope",
    (f) => {
      f.full = false;
    },
  ],
  [
    "wrong receipt attempt",
    (f) => {
      f.receipt.runAttempt = 2;
    },
  ],
  [
    "wrong tested Git object",
    (f) => {
      f.responses[`/git/commits/${hash("c")}`].tree.sha = hash("9");
    },
  ],
  [
    "incomplete job inventory",
    (f) => {
      f.jobs.pop();
    },
  ],
  [
    "unexpected skipped application",
    (f) => {
      f.jobs[1].conclusion = "skipped";
    },
  ],
  [
    "cancelled job",
    (f) => {
      f.jobs[1].conclusion = "cancelled";
    },
  ],
  [
    "mixed job attempts",
    (f) => {
      f.jobs[1].run_attempt = 2;
    },
  ],
  [
    "duplicate job names",
    (f) => {
      f.jobs[1].name = f.jobs[0].name;
    },
  ],
  [
    "foreign job run",
    (f) => {
      f.jobs[1].run_id = 42;
    },
  ],
])("verification rejects %s", async (_description, change) => {
  const fixture = proofFixture();
  const selection = await selectProof(fixture);
  change(fixture);
  await expect(verifyProof({ ...fixture, selection })).rejects.toThrow();
});

test.each(["attempt", "digest", "new-run"])(
  "mutation after selection invalidates proof: %s",
  async (kind) => {
    const fixture = proofFixture();
    const selection = await selectProof(fixture);
    if (kind === "attempt") {
      fixture.run.run_attempt = 2;
    }
    if (kind === "digest") {
      fixture.artifact.digest = `sha256:${"2".repeat(64)}`;
    }
    if (kind === "new-run") {
      const listing = Object.values(fixture.responses).find(
        (item) => item.workflow_runs,
      );
      listing.workflow_runs.push({
        ...fixture.run,
        id: 42,
        status: "in_progress",
        conclusion: null,
      });
      listing.total_count = 2;
    }
    await expect(verifyProof({ ...fixture, selection })).rejects.toThrow();
  },
);

test("required gate rejects a reuse flag without authenticated provenance", () => {
  const checks = needs();
  checks.scope.outputs.reuse = "true";
  expect(() => requireChecks(checks)).toThrow(/provenance/u);
});

test.each(["application", "tooling", "documentation"])(
  "reuse gate rejects a non-skipped producer: %s",
  async (job) => {
    const fixture = proofFixture();
    const selection = await selectProof(fixture);
    const outputs = await verifyProof({ ...fixture, selection });
    const checks = {
      scope: { result: "success", outputs: { full: "true", ...outputs } },
      application: { result: "skipped" },
      tooling: { result: "skipped" },
      documentation: { result: "skipped" },
    };
    checks[job].result = "success";
    expect(() => requireChecks(checks)).toThrow(`Unexpected ${job} result`);
  },
);

test("manual workflow invocation selects fresh execution without consulting GitHub", async () => {
  const directory = mkdtempSync(join(tmpdir(), "webvowl-ci-manual-"));
  try {
    let externalCalls = 0;
    const output = join(directory, "output");
    await runCommand(
      "select",
      { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_OUTPUT: output },
      {
        capture: () => {
          externalCalls++;
          throw new Error("Manual events must not capture reuse inputs");
        },
        read: () => {
          externalCalls++;
          throw new Error("Manual events must not query PR evidence");
        },
      },
    );
    expect(readFileSync(output, "utf8")).toBe("available=false\n");
    expect(externalCalls).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("command selection and extracted proof verification emit usable authenticated reuse outputs", async () => {
  // The command uses the real clock; keep this transported evidence fresh at execution.
  const fixture = proofFixture(true, Date.now());
  const directory = mkdtempSync(join(tmpdir(), "webvowl-ci-roundtrip-"));
  try {
    const env = {
      GITHUB_EVENT_NAME: "push",
      GITHUB_OUTPUT: join(directory, "output"),
      RUNNER_TEMP: directory,
      PROOF_DOWNLOAD_OUTCOME: "success",
      CI_FULL_CHECKS: "true",
    };
    const services = { capture: () => fixture.context, read: fixture.read };
    await runCommand("select", env, services);
    const download = join(directory, "webvowl-ci", "download");
    mkdirSync(download);
    writeFileSync(
      join(download, "verification.json"),
      JSON.stringify(fixture.receipt),
    );
    await runCommand("verify", env, services);
    const outputs = Object.fromEntries(
      readFileSync(env.GITHUB_OUTPUT, "utf8")
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
    expect(outputs).toMatchObject({
      available: "true",
      run_id: "41",
      artifact_id: "51",
      reuse: "true",
      source_run_id: "41",
      source_receipt_id: "51",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI proof transport failure falls back; actual check failure stays fatal", async () => {
  const directory = mkdtempSync(join(tmpdir(), "webvowl-ci-cli-"));
  try {
    const output = join(directory, "output");
    const env = {
      GITHUB_OUTPUT: output,
      RUNNER_TEMP: directory,
      PROOF_DOWNLOAD_OUTCOME: "failure",
    };
    await runCommand("verify", env);
    expect(readFileSync(output, "utf8")).toBe("reuse=false\n");
    const checks = needs();
    checks.application.result = "failure";
    const result = spawnSync(
      process.execPath,
      ["util/ciEvidenceCommand.mjs", "gate"],
      {
        env: { ...process.env, CI_JOB_RESULTS: JSON.stringify(checks) },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unexpected application result");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("native Git capture reports the real checkout tree and raw parents", () => {
  const snapshot = captureSnapshot();
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  expect(snapshot.tree).toBe(tree);
  expect(snapshot.commit).toMatch(/^[a-f0-9]{40}$/u);
  expect(snapshot.workflow).toMatch(/^[a-f0-9]{40}$/u);
});

test("native single-artifact extraction accepts only a bounded root JSON receipt", () => {
  const directory = mkdtempSync(join(tmpdir(), "webvowl-ci-payload-"));
  try {
    // download-artifact v8 puts one selected artifact directly in its destination.
    writeFileSync(join(directory, "verification.json"), '{"schemaVersion":1}');
    expect(readDownloadedReceipt(directory)).toEqual({
      schemaVersion: 1,
    });
    writeFileSync(join(directory, "extra.json"), "{}");
    expect(() => readDownloadedReceipt(directory)).toThrow(/payload/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
