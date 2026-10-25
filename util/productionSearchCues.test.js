import { runInNewContext } from "node:vm";
import { installProductionCueProbe } from "./productionSearchCues.mjs";

function exercise(body) {
  return runInNewContext(
    `(${installProductionCueProbe.toString()})(); ${body}`,
    { performance: { now: () => 1 } },
  );
}

test("cue probe preserves freezing, receiver, arguments and returned identity", () => {
  const result = exercise(`
    const untouched = Object.freeze({ ordinary: true });
    const answer = { canReveal: true, counts: { nodes: 2 } };
    let received;
    const controller = Object.freeze({
      getOntologyNeighborhoodRevealPlan(references) {
        received = { receiver: this, references };
        return answer;
      }
    });
    const references = [{ kind: 'class', iri: 'urn:a' }];
    __webvowlCueProbe.begin();
    const returned = controller.getOntologyNeighborhoodRevealPlan(references);
    ({ qualification: __webvowlCueProbe.qualification(),
       controllerFrozen: Object.isFrozen(controller), untouchedFrozen: Object.isFrozen(untouched),
       sameResult: returned === answer, sameReceiver: received.receiver === controller,
       sameArguments: received.references === references, observation: __webvowlCueProbe.end() });
  `);
  expect(result.qualification).toEqual({
    wrappers: 1,
    nativeFreezeRestored: true,
  });
  expect(result).toMatchObject({
    controllerFrozen: true,
    untouchedFrozen: true,
    sameResult: true,
    sameReceiver: true,
    sameArguments: true,
    observation: { calls: [{ requestedReferences: 1, canReveal: true }] },
  });
});

test("cue probe does not invoke unrelated accessors while searching for the controller", () => {
  expect(
    exercise(`
      let getterCalls = 0;
      Object.freeze({ get getOntologyNeighborhoodRevealPlan() { getterCalls++; return () => {}; } });
      ({ getterCalls, wrappers: __webvowlCueProbe.qualification().wrappers });
    `),
  ).toEqual({ getterCalls: 0, wrappers: 0 });
});

test("cue probe preserves thrown identity and excludes calls outside the measurement", () => {
  expect(
    exercise(`
      const failure = new Error('original');
      failure.code = 'TEST';
      const controller = Object.freeze({ getOntologyNeighborhoodRevealPlan() { throw failure; } });
      try { controller.getOntologyNeighborhoodRevealPlan([]); } catch {}
      __webvowlCueProbe.begin();
      let sameFailure = false;
      try { controller.getOntologyNeighborhoodRevealPlan([]); } catch (error) { sameFailure = error === failure; }
      const observation = __webvowlCueProbe.end();
      try { controller.getOntologyNeighborhoodRevealPlan([]); } catch {}
      ({ sameFailure, calls: observation.calls });
    `),
  ).toEqual({
    sameFailure: true,
    calls: [{ durationMs: 0, errorCode: "TEST" }],
  });
});
