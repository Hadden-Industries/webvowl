import assert from "node:assert/strict";
import { summarizeSamples } from "./productionPerformance.mjs";

/** Keep the deliberate quiet period separate from application and paint work. */
export function countAdjustmentTimings(row) {
  const lastInput = row.inputs?.at(-1)?.at;
  assert(
    [
      row.start,
      lastInput,
      row.applicationStartedAt,
      row.applicationDurationMs,
      row.completed,
      row.frame2,
    ].every(Number.isFinite) &&
      row.start <= lastInput &&
      lastInput <= row.applicationStartedAt &&
      row.applicationDurationMs >= 0 &&
      row.applicationStartedAt <= row.completed &&
      row.completed <= row.frame2,
    "Count adjustment needs ordered input, application and paint boundaries",
  );
  return {
    inputToPaintMs: row.frame2 - row.start,
    lastInputToApplicationMs: row.applicationStartedAt - lastInput,
    applicationMs: row.applicationDurationMs,
    applicationToPaintMs: row.frame2 - row.applicationStartedAt,
  };
}

export function activeLayoutSummary(row) {
  assert(
    !row.foregroundLost &&
      row.elapsedMs >= 5000 &&
      row.changedFrames >= 2 &&
      row.nodeCount > 0 &&
      row.layoutBefore.status === "relaxing" &&
      row.layoutAfter.status === "relaxing",
    "Active layout needs five visible seconds and observed graph movement",
  );
  return summarizeSamples(row.intervals);
}

// Only read transform attributes from eight retained nodes: no forced layout,
// monkey patches or internal force controls. Pause/Resume is the public API.
async function observeActiveLayout() {
  const { document, performance, requestAnimationFrame, cancelAnimationFrame } =
    globalThis;
  const controller =
    globalThis.__webvowlMeasuredApplication.getWebVowlController();
  controller.setGraphLayoutPaused({ isPaused: true });
  const nodes = [...document.querySelectorAll("#graph .node")].slice(0, 8);
  const transforms = () => nodes.map((node) => node.getAttribute("transform"));
  let previous = transforms();
  let foregroundLost = false;
  const check = () => {
    foregroundLost ||=
      document.visibilityState !== "visible" || !document.hasFocus();
  };
  document.addEventListener("visibilitychange", check);
  globalThis.addEventListener("blur", check);
  const intervals = [];
  let changedFrames = 0;
  const start = performance.now();
  let last;
  controller.setGraphLayoutPaused({ isPaused: false });
  const layoutBefore = controller.getState().layout;
  try {
    while (performance.now() - start < 5000) {
      const at = await new Promise((done, fail) => {
        const timeout = setTimeout(() => {
          cancelAnimationFrame(frame);
          fail(
            new Error(
              "Active-layout frame deadline; inspect visibility and focus",
            ),
          );
        }, 10000);
        const frame = requestAnimationFrame((timestamp) => {
          clearTimeout(timeout);
          done(timestamp);
        });
      });
      if (last !== undefined) intervals.push(at - last);
      last = at;
      const current = transforms();
      if (current.some((value, index) => value !== previous[index]))
        changedFrames++;
      previous = current;
      check();
    }
    return {
      elapsedMs: performance.now() - start,
      intervals,
      changedFrames,
      nodeCount: nodes.length,
      layoutBefore,
      layoutAfter: controller.getState().layout,
      foregroundLost,
    };
  } finally {
    document.removeEventListener("visibilitychange", check);
    globalThis.removeEventListener("blur", check);
    controller.setGraphLayoutPaused({ isPaused: true });
  }
}

async function verifyCountShortcuts({ call, evaluate, report }) {
  const controller = "__webvowlMeasuredApplication.getWebVowlController()";
  const samples = (report.countShortcuts = []);
  for (const input of ["pointer", "Enter", "Space"]) {
    await evaluate(
      `__webvowlMeasurement.view({nodesShown:{mode:'exact',requestedCount:Math.min(49,${controller}.getState().nodeCountStatus.eligibleNodeCount-1)}})`,
    );
    await evaluate("__webvowlMeasurement.prepareSlider()");
    const before = await evaluate(`(() => {
      const button = document.querySelector('#nodesShown-total-value');
      const fifty = document.querySelector('#nodesShown-fifty');
      const rect = button.getBoundingClientRect();
      (fifty.hidden || fifty.disabled ? document.querySelector('#nodesShown-exact') : fifty).focus();
      return {
        tag:button.tagName, disabled:button.disabled,
        label:button.getAttribute('aria-label'), text:button.textContent,
        width:rect.width, height:rect.height,
        x:rect.x+rect.width/2, y:rect.y+rect.height/2,
        total:${controller}.getState().nodeCountStatus.eligibleNodeCount
      };
    })()`);
    assert.equal(before.tag, "BUTTON");
    assert.equal(before.disabled, false);
    assert.equal(before.label, `Show all ${before.total} available nodes`);
    assert.equal(Number(before.text), before.total);
    assert(before.width >= 24 && before.height >= 24);
    for (const type of ["keyDown", "keyUp"])
      await call("Input.dispatchKeyEvent", {
        type,
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
      });
    assert.equal(
      await evaluate("document.activeElement.id"),
      "nodesShown-total-value",
    );
    const { nodes } = await call("Accessibility.getFullAXTree");
    assert(
      nodes.some(
        (node) =>
          node.role?.value === "button" && node.name?.value === before.label,
      ),
    );
    const sample = {
      input,
      before,
      rangeDescription: nodes.find(
        (node) =>
          node.role?.value === "slider" && node.name?.value === "Nodes shown",
      )?.description?.value,
    };
    samples.push(sample);
    assert.equal(sample.rangeDescription, `Available nodes: ${before.total}.`);
    if (input === "pointer") {
      const point = await evaluate(`(() => {
        const button = document.querySelector('#nodesShown-total-value');
        const rect = button.getBoundingClientRect();
        const x = rect.x+rect.width/2, y = rect.y+rect.height/2;
        return {x,y,target:document.elementFromPoint(x,y)?.id};
      })()`);
      assert.equal(point.target, "nodesShown-total-value");
      for (const type of ["mousePressed", "mouseReleased"])
        await call("Input.dispatchMouseEvent", {
          type,
          x: point.x,
          y: point.y,
          button: "left",
          clickCount: 1,
        });
    } else {
      for (const type of ["keyDown", "keyUp"])
        await call("Input.dispatchKeyEvent", {
          type,
          key: input === "Space" ? " " : input,
          code: input,
          windowsVirtualKeyCode: input === "Space" ? 32 : 13,
          ...(type === "keyDown"
            ? {
                text: input === "Space" ? " " : "\r",
                unmodifiedText: input === "Space" ? " " : "\r",
              }
            : {}),
        });
    }
    const after = await evaluate(`(async () => {
      const start = performance.now();
      while (${controller}.getState().view.nodesShown.mode !== 'all') {
        if (performance.now()-start > 10000) throw new Error('Total shortcut did not select All: '+JSON.stringify({input:${JSON.stringify(input)}, state:${controller}.getState()}));
        await new Promise(resolve => setTimeout(resolve,20));
      }
      const state = ${controller}.getState();
      return {intent:state.view.nodesShown, count:state.nodeCountStatus,
        pending:state.nodeCountAdjustment,
        disabled:document.querySelector('#nodesShown-total-value').disabled};
    })()`);
    assert.deepEqual(after.intent, { mode: "all" });
    assert.equal(after.count.shownNodeCount, before.total);
    assert.equal(after.pending, null);
    assert.equal(after.disabled, true);
    sample.after = after;
    await evaluate("__webvowlMeasurement.closeSlider()");
  }
  return samples;
}

/** A bounded B3/B8 observation, never a complete S0 or baseline comparison. */
export async function measureProductionCountAdjustment({
  call,
  evaluate,
  measure,
  idle,
  report,
  schedule,
  functional,
  observeLayout,
  backdropControl,
  initialLayout,
}) {
  report.operationScope =
    "Batched native count input and active layout only; not complete S0 cohorts or a before/after comparison";
  const controller = "__webvowlMeasuredApplication.getWebVowlController()";
  if (!functional) await idle("count-workload-load");
  await evaluate("__webvowlMeasurement.load()");
  await evaluate("__webvowlMeasurement.waitForNodeOrdering()");
  const initial = await evaluate("__webvowlMeasurement.state()");
  const total = initial.nodeCountStatus.shownNodeCount;
  assert(total > 4);
  report.countAdjustment = { total, samples: [] };
  if (backdropControl) {
    const selector =
      backdropControl === "all"
        ? ".modern-popover, .modern-popover::backdrop"
        : ".modern-popover::backdrop";
    const css = `${selector} { backdrop-filter: none !important; }`;
    report.countAdjustment.backdropControl = await evaluate(`(() => {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(css)};
      document.head.append(style);
      return {modifiedProductionPresentation:true, css:style.textContent};
    })()`);
  }
  if (observeLayout && initialLayout === "settled") {
    await idle("B8-initial-active-layout");
    report.activeLayout = await evaluate(
      `(${observeActiveLayout.toString()})()`,
    );
    report.activeLayout.frameIntervals = activeLayoutSummary(
      report.activeLayout,
    );
  }
  // An established drawing is distinct from a paused load before its first ticks.
  report.countAdjustment.precondition =
    initialLayout !== "settled"
      ? {
          kind:
            initialLayout === "fresh-running"
              ? "fresh ordinary running drawing, reloaded before each count operation"
              : "fresh paused drawing before first force ticks",
        }
      : await evaluate(`(async () => {
    const controller = ${controller};
    const start = performance.now();
    controller.setGraphLayoutPaused({isPaused:false});
    while (controller.getState().layout.status !== 'settled') {
      if (performance.now() - start > 180000) throw new Error('Initial graph did not settle within three minutes');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const layout = controller.getState().layout;
    controller.setGraphLayoutPaused({isPaused:true});
    return {kind:'settled initial drawing', elapsedMs:performance.now()-start, layout};
  })()`);
  for (const { label: cohort, index, warmup } of schedule) {
    report.activeCohort = { index, label: cohort, warmup };
    for (const paused of initialLayout === "fresh-running"
      ? [false]
      : [false, true]) {
      for (const finish of ["quiet", "dismiss"]) {
        let operationInitial = initial;
        if (initialLayout === "fresh-running") {
          await measure(
            "B3-fresh-running-load",
            "__webvowlMeasurement.load({running:true})",
            cohort,
            warmup,
          );
          await evaluate("__webvowlMeasurement.waitForNodeOrdering()");
          const state = await evaluate("__webvowlMeasurement.state()");
          operationInitial = state;
          assert.equal(
            state.layout.status,
            "relaxing",
            "Fresh count proof must begin before natural settlement",
          );
        }
        if (initialLayout !== "fresh-running") {
          await evaluate(
            `${controller}.setGraphLayoutPaused({isPaused:${paused}})`,
          );
        }
        const current = await evaluate("__webvowlMeasurement.prepareSlider()");
        const target = current === total ? total - 1 : total;
        const direction = target < current ? -1 : 1;
        const row = await measure(
          `B3-burst-${paused ? "paused" : "running"}-${finish}`,
          async () => {
            await evaluate(`__webvowlMeasurement.armSlider(${target})`);
            // Three native inputs with a net change of one. Each accepted
            // intermediate count would make this proof fail.
            for (const step of [direction, -1, 1]) {
              const key = step < 0 ? "ArrowLeft" : "ArrowRight";
              for (const type of ["keyDown", "keyUp"])
                await call("Input.dispatchKeyEvent", {
                  type,
                  key,
                  code: key,
                  windowsVirtualKeyCode: step < 0 ? 37 : 39,
                });
            }
            const pending = await evaluate("__webvowlMeasurement.state()");
            if (finish === "dismiss")
              for (const type of ["keyDown", "keyUp"])
                await call("Input.dispatchKeyEvent", {
                  type,
                  key: "Escape",
                  code: "Escape",
                  windowsVirtualKeyCode: 27,
                });
            return {
              ...(await evaluate("__webvowlMeasurement.interaction()")),
              pending,
            };
          },
          cohort,
          warmup,
        );
        assert.equal(
          row.inputs.length,
          3,
          "All three native inputs must reach the slider",
        );
        assert.deepEqual(
          row.acceptedCounts,
          [target],
          "Only the final draft may rebuild the graph",
        );
        assert.equal(row.pending.nodeCountStatus.shownNodeCount, current);
        assert(
          row.pending.nodeCountAdjustment,
          "The draft must remain pending before completion",
        );
        assert.equal(row.pending.layout.status, "paused");
        assert.equal(row.state.nodeCountStatus.shownNodeCount, target);
        assert.equal(row.state.nodeCountAdjustment, null);
        assert.equal(row.state.layout.status, paused ? "paused" : "relaxing");
        assert.equal(row.state.loadGeneration, operationInitial.loadGeneration);
        assert.equal(
          row.state.documentRevision,
          operationInitial.documentRevision,
        );
        report.countAdjustment.samples.push({
          cohort,
          index,
          warmup,
          paused,
          finish,
          ...(functional ? {} : countAdjustmentTimings(row)),
        });
        await evaluate("__webvowlMeasurement.closeSlider()");
      }
    }
  }
  delete report.activeCohort;
  delete report.activeOperation;
  if (functional) {
    await verifyCountShortcuts({ call, evaluate, report });
  }
}
