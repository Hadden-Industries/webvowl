import {
  codeqlVerdict,
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
