import { runInNewContext } from "node:vm";
import {
  installProductionLifetimeProbe,
  measureProductionLifetime,
} from "./productionLifetime.mjs";

test("lifetime probe restores freeze and holds unread results only for its positive control", () => {
  const result = runInNewContext(`
    (${installProductionLifetimeProbe.toString()})();
    let getterCalls = 0;
    Object.freeze({ get readOntologyInspection() { getterCalls++; } });
    const inspection = { occurrences: [1, 2] };
    const projection = { retainedFacts: inspection, classRecords: [] };
    const readModel = Object.freeze({});
    let fieldReads = 0;
    const session = Object.freeze({
      readOntologyInspection: () => projection,
      readModel: () => readModel,
      snapshot: () => ({ get inspection() { fieldReads++; return {}; } }),
      identity: () => ({ loadGeneration: 2, documentRevision: 1 })
    });
    __webvowlLifetimeProbe.observe();
    const ordinary = __webvowlLifetimeProbe.status();
    __webvowlLifetimeProbe.observe(true);
    const held = __webvowlLifetimeProbe.status();
    __webvowlLifetimeProbe.releaseControls();
    ({ qualification: __webvowlLifetimeProbe.qualification(), getterCalls, fieldReads,
      ordinary, held, released: __webvowlLifetimeProbe.status(), frozen: Object.isFrozen(session) });
  `);
  expect(result).toMatchObject({
    qualification: { captures: 1, nativeFreezeRestored: true },
    getterCalls: 0,
    fieldReads: 0,
    frozen: true,
    ordinary: { tracked: 3, retainedResults: 0, retiredAlive: 0 },
    held: { tracked: 3, retainedResults: 3 },
    released: { tracked: 3, retainedResults: 0 },
  });
});

test("lifetime orchestration supplies cohort metadata and checks the positive control before ten retirement cycles", async () => {
  const report = {};
  const cohorts = [];
  let statusReads = 0;
  const evaluate = async (expression) => {
    if (expression.includes("qualification()")) {
      return { captures: 1, nativeFreezeRestored: true };
    }
    if (expression.includes("status(")) {
      statusReads++;
      return {
        alive:
          statusReads === 1 ? [{ kind: "read-model", current: false }] : [],
        retiredAlive: statusReads === 1 ? 3 : 0,
      };
    }
    if (expression.includes("observe()")) {
      return { occurrences: 2, documentRevision: 1 };
    }
    if (expression.includes("capture()")) {
      return { byteLength: 123, documentRevision: 1 };
    }
  };
  await measureProductionLifetime({
    report,
    evaluate,
    call: async (method) =>
      method === "Target.getTargets" ? { targetInfos: [] } : { usedSize: 123 },
    measure: async (_name, _expression, cohort, warmup = false) => {
      expect(report.activeCohort).toEqual({
        index: expect.any(Number),
        label: cohort,
        warmup,
      });
      cohorts.push(cohort);
    },
  });
  expect(cohorts).toHaveLength(22);
  expect(report.lifetime.cycles.map(({ cycle }) => cycle)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  expect(statusReads).toBe(13);
});
