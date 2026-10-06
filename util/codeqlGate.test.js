import {
  codeqlVerdict,
  verifyCompleteCodeqlProof,
  waitForCodeqlVerdict,
} from "./requireCodeqlVerdict.mjs";

const head = "a".repeat(40);
const check = (overrides = {}) => ({
  id: 12,
  name: "CodeQL",
  app: { id: 57789 },
  head_sha: head,
  status: "completed",
  conclusion: "success",
  ...overrides,
});

test("only the current head's external CodeQL verdict can satisfy the gate", () => {
  expect(codeqlVerdict([check()], head)).toBe("success");
  expect(codeqlVerdict([check({ app: { id: 15368 } })], head)).toBe("pending");
  expect(codeqlVerdict([check({ head_sha: "b".repeat(40) })], head)).toBe(
    "pending",
  );
  expect(codeqlVerdict([check({ name: "Analyze (actions)" })], head)).toBe(
    "pending",
  );
});
test("newer failures or pending analyses cannot be hidden by older successes", () => {
  expect(
    codeqlVerdict([check(), check({ id: 13, conclusion: "failure" })], head),
  ).toBe("failure");
  expect(
    codeqlVerdict(
      [check(), check({ id: 13, status: "in_progress", conclusion: null })],
      head,
    ),
  ).toBe("pending");
});
test.each([
  "failure",
  "cancelled",
  "timed_out",
  "neutral",
  "skipped",
  "action_required",
])("%s is not a passing security verdict", (conclusion) => {
  expect(codeqlVerdict([check({ conclusion })], head)).toBe("failure");
});
test("the API reader follows pagination and accepts the authenticated CodeQL check", async () => {
  const requests = [];
  await expect(
    waitForCodeqlVerdict({
      repository: "owner/repo",
      head,
      token: "test-token",
      attempts: 1,
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          json: async () => ({
            total_count: 101,
            check_runs: url.endsWith("page=1")
              ? Array.from({ length: 100 }, () => check({ app: { id: 15368 } }))
              : [check()],
          }),
        };
      },
    }),
  ).resolves.toBeUndefined();
  expect(requests).toHaveLength(2);
  expect(requests[1].url).toBe(
    `https://api.github.com/repos/owner/repo/commits/${head}/check-runs?filter=latest&per_page=100&page=2`,
  );
  expect(requests[0].options.headers.Authorization).toBe("Bearer test-token");
});
test("missing verdicts, API errors and blocking findings fail closed", async () => {
  const options = {
    repository: "owner/repo",
    head,
    token: "test-token",
    attempts: 1,
  };
  await expect(
    waitForCodeqlVerdict({
      ...options,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ check_runs: [] }),
      }),
    }),
  ).rejects.toThrow(/not available/);
  await expect(
    waitForCodeqlVerdict({
      ...options,
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
  ).rejects.toThrow(/403/);
  await expect(
    waitForCodeqlVerdict({
      ...options,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ check_runs: [check({ conclusion: "failure" })] }),
      }),
    }),
  ).rejects.toThrow(/did not pass/);
});

const proofRepository = "owner/repo";
const proofBase = "b".repeat(40);
const proofMerge = "c".repeat(40);
const proofRegeneratedMerge = "d".repeat(40);
const proofTree = "e".repeat(40);
const proofLanguages = ["actions", "javascript-typescript", "python"];
function proofFixture() {
  return {
    pr: {
      number: 54,
      state: "open",
      head: { sha: head },
      base: {
        sha: proofBase,
        ref: "main",
        repo: { full_name: proofRepository },
      },
      merge_commit_sha: proofRegeneratedMerge,
    },
    analyzed: {
      sha: proofMerge,
      tree: { sha: proofTree },
      parents: [{ sha: proofBase }, { sha: head }],
    },
    current: {
      sha: proofRegeneratedMerge,
      tree: { sha: proofTree },
      parents: [{ sha: proofBase }, { sha: head }],
    },
    analyses: proofLanguages.map((language, index) => ({
      id: index + 1,
      category: `/language:${language}`,
      tool: { name: "CodeQL" },
      commit_sha: proofMerge,
      ref: "refs/pull/54/merge",
      analysis_key: ".github/workflows/codeql.yml:analyze",
      environment: JSON.stringify({ language }),
      error: "",
      warning: "",
      rules_count: 87,
      results_count: 0,
    })),
    alerts: [],
  };
}
function proofReader(fixture, alter = (value) => value) {
  let prReads = 0;
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const path = new URL(url).pathname;
    let value;
    if (path.endsWith("/pulls/54")) {
      value = fixture.pr;
      prReads++;
    } else if (path.endsWith(`/git/commits/${proofMerge}`)) {
      value = fixture.analyzed;
    } else if (path.endsWith(`/git/commits/${proofRegeneratedMerge}`)) {
      value = fixture.current;
    } else if (path.endsWith("/code-scanning/analyses")) {
      value = fixture.analyses;
    } else if (path.endsWith("/code-scanning/alerts")) {
      value = fixture.alerts;
    } else {
      throw new Error(`Unexpected proof request: ${url}`);
    }
    return new Response(
      JSON.stringify(alter(structuredClone(value), { path, prReads })),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  return { fetchImpl, requests };
}
function proofOptions(fetchImpl) {
  return {
    repository: proofRepository,
    head,
    base: proofBase,
    merge: proofMerge,
    pullRequestNumber: 54,
    token: "test-token",
    fetchImpl,
  };
}

test("complete proof binds exact analyses and both regenerated merge parents/tree", async () => {
  const reader = proofReader(proofFixture());
  const proof = await verifyCompleteCodeqlProof(proofOptions(reader.fetchImpl));
  expect(proof).toMatchObject({
    head,
    base: proofBase,
    analyzedMerge: proofMerge,
    currentMerge: proofRegeneratedMerge,
    tree: proofTree,
    openAlerts: 0,
    analyses: [
      { language: "actions", id: 1 },
      { language: "javascript-typescript", id: 2 },
      { language: "python", id: 3 },
    ],
  });
  expect(reader.requests).toHaveLength(6);
  for (const { url, options } of reader.requests) {
    expect(new URL(url).origin).toBe("https://api.github.com");
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(options.redirect).toBe("error");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  }
});

test.each(proofLanguages)(
  "missing %s analysis blocks complete proof",
  async (language) => {
    const fixture = proofFixture();
    fixture.analyses = fixture.analyses.filter(
      (item) => item.category !== `/language:${language}`,
    );
    await expect(
      verifyCompleteCodeqlProof(proofOptions(proofReader(fixture).fetchImpl)),
    ).rejects.toThrow(/Incomplete/);
  },
);
test.each([
  ["commit_sha", "f".repeat(40)],
  ["ref", "refs/heads/main"],
  ["analysis_key", ".github/workflows/other.yml:analyze"],
  ["environment", '{"language":"other"}'],
  ["tool", { name: "other" }],
  ["error", "extraction failed"],
  ["warning", "partial extraction"],
  ["rules_count", 0],
  ["rules_count", 1.5],
  ["results_count", 1],
  ["results_count", null],
  ["id", null],
])("invalid analysis %s=%j blocks proof", async (field, value) => {
  const fixture = proofFixture();
  fixture.analyses[0][field] = value;
  await expect(
    verifyCompleteCodeqlProof(proofOptions(proofReader(fixture).fetchImpl)),
  ).rejects.toThrow(/Incomplete|Malformed/);
});
test.each(["stale", "malformed", "wrong-tool"])(
  "a newer %s record cannot be hidden by older correct analysis",
  async (kind) => {
    const fixture = proofFixture();
    const newer = { ...fixture.analyses[0], id: 99 };
    if (kind === "stale") {
      newer.commit_sha = "f".repeat(40);
    } else if (kind === "malformed") {
      newer.id = "bad";
    } else {
      newer.tool = { name: "other" };
    }
    fixture.analyses.push(newer);
    await expect(
      verifyCompleteCodeqlProof(proofOptions(proofReader(fixture).fetchImpl)),
    ).rejects.toThrow(/Incomplete|Malformed/);
  },
);
test("all open alerts block even when every selected report has zero results", async () => {
  const fixture = proofFixture();
  fixture.alerts.push({ number: 1, state: "open" });
  await expect(
    verifyCompleteCodeqlProof(proofOptions(proofReader(fixture).fetchImpl)),
  ).rejects.toThrow(/Open CodeQL alerts/);
});
test.each(["head", "base", "target", "repository", "closed", "merge"])(
  "live PR %s drift blocks proof",
  async (kind) => {
    const fixture = proofFixture();
    if (kind === "head") {
      fixture.pr.head.sha = "f".repeat(40);
    }
    if (kind === "base") {
      fixture.pr.base.sha = "f".repeat(40);
    }
    if (kind === "target") {
      fixture.pr.base.ref = "other";
    }
    if (kind === "repository") {
      fixture.pr.base.repo.full_name = "other/repo";
    }
    if (kind === "closed") {
      fixture.pr.state = "closed";
    }
    if (kind === "merge") {
      fixture.pr.merge_commit_sha = null;
    }
    await expect(
      verifyCompleteCodeqlProof(proofOptions(proofReader(fixture).fetchImpl)),
    ).rejects.toThrow(/PR source or base drifted/);
  },
);
test.each(["analyzed-parent", "current-parent", "tree", "missing-parent"])(
  "merge %s drift blocks proof",
  async (kind) => {
    const fixture = proofFixture();
    if (kind === "analyzed-parent") {
      fixture.analyzed.parents[1].sha = "f".repeat(40);
    }
    if (kind === "current-parent") {
      fixture.current.parents[0].sha = "f".repeat(40);
    }
    if (kind === "tree") {
      fixture.current.tree.sha = "f".repeat(40);
    }
    if (kind === "missing-parent") {
      fixture.current.parents[1] = null;
    }
    await expect(
      verifyCompleteCodeqlProof(proofOptions(proofReader(fixture).fetchImpl)),
    ).rejects.toThrow(/merge source|source tree/);
  },
);
test.each(["head", "base", "merge"])(
  "final readback catches %s drift during proof",
  async (kind) => {
    const reader = proofReader(proofFixture(), (value, { path, prReads }) => {
      if (path.endsWith("/pulls/54") && prReads === 2) {
        if (kind === "head") {
          value.head.sha = "f".repeat(40);
        }
        if (kind === "base") {
          value.base.sha = "f".repeat(40);
        }
        if (kind === "merge") {
          value.merge_commit_sha = "f".repeat(40);
        }
      }
      return value;
    });
    await expect(
      verifyCompleteCodeqlProof(proofOptions(reader.fetchImpl)),
    ).rejects.toThrow(/drifted|merge identity changed/);
  },
);
test.each([403, 404, 500])(
  "HTTP %i never grants alternative proof",
  async (status) => {
    await expect(
      verifyCompleteCodeqlProof(
        proofOptions(async () => new Response("", { status })),
      ),
    ).rejects.toThrow(new RegExp(String(status)));
  },
);
test("invalid JSON and response byte bounds fail closed", async () => {
  await expect(
    verifyCompleteCodeqlProof(proofOptions(async () => new Response("{"))),
  ).rejects.toThrow();
  await expect(
    verifyCompleteCodeqlProof(
      proofOptions(async () => new Response("x".repeat(1_048_577))),
    ),
  ).rejects.toThrow(/exceeds bounds/);
});
test("analysis pagination is bounded to four pages and never silently truncated", async () => {
  const reader = proofReader(proofFixture());
  let pages = 0;
  const fetchImpl = async (url, options) => {
    if (new URL(url).pathname.endsWith("/code-scanning/analyses")) {
      pages++;
      return new Response(
        JSON.stringify(Array.from({ length: 100 }, () => ({}))),
      );
    }
    return reader.fetchImpl(url, options);
  };
  await expect(
    verifyCompleteCodeqlProof(proofOptions(fetchImpl)),
  ).rejects.toThrow(/pagination/);
  expect(pages).toBe(4);
});
test("the shared deadline includes time spent reading response bodies", async () => {
  const reader = proofReader(proofFixture());
  const original = performance.now;
  let elapsed = 0;
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => elapsed,
  });
  try {
    await expect(
      verifyCompleteCodeqlProof(
        proofOptions(async (url, options) => {
          const response = await reader.fetchImpl(url, options);
          elapsed = 180_001;
          return response;
        }),
      ),
    ).rejects.toThrow(/deadline/);
  } finally {
    Object.defineProperty(performance, "now", {
      configurable: true,
      value: original,
    });
  }
});
test("neutral requires explicit opt-in; a real external failure never uses alternative proof", async () => {
  for (const conclusion of [
    "neutral",
    "failure",
    "cancelled",
    "timed_out",
    "skipped",
    "action_required",
  ]) {
    const reader = proofReader(proofFixture());
    let proofReads = 0;
    const fetchImpl = async (url, options) => {
      if (url.includes("/check-runs?")) {
        return new Response(
          JSON.stringify({ check_runs: [check({ conclusion })] }),
        );
      }
      proofReads++;
      return reader.fetchImpl(url, options);
    };
    await expect(
      waitForCodeqlVerdict({ ...proofOptions(fetchImpl), attempts: 1 }),
    ).rejects.toThrow(/did not pass/);
    expect(proofReads).toBe(0);
    if (conclusion !== "neutral") {
      await expect(
        waitForCodeqlVerdict({
          ...proofOptions(fetchImpl),
          attempts: 1,
          completeAnalysisProof: {
            pullRequestNumber: 54,
            base: proofBase,
            merge: proofMerge,
          },
        }),
      ).rejects.toThrow(/did not pass/);
      expect(proofReads).toBe(0);
    }
  }
});
test("the opt-in admits complete neutral proof without changing neutral's verdict", async () => {
  const reader = proofReader(proofFixture());
  const fetchImpl = async (url, options) =>
    url.includes("/check-runs?")
      ? new Response(
          JSON.stringify({ check_runs: [check({ conclusion: "neutral" })] }),
        )
      : reader.fetchImpl(url, options);
  expect(codeqlVerdict([check({ conclusion: "neutral" })], head)).toBe(
    "failure",
  );
  await expect(
    waitForCodeqlVerdict({
      ...proofOptions(fetchImpl),
      attempts: 1,
      completeAnalysisProof: {
        pullRequestNumber: 54,
        base: proofBase,
        merge: proofMerge,
      },
    }),
  ).resolves.toBeUndefined();
});
