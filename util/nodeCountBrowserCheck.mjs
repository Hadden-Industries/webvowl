import assert from "node:assert/strict";

/** Exercise native pointer dragging; synthetic input events cannot catch its loss. */
export async function checkNodeCountMouseDrag(page) {
  await page.locator("#filter-button").click();
  const range = page.locator("#nodesShown-range");
  await range.waitFor({ state: "visible" });
  // Coordinate-driven dragging needs the mobile sheet's entry motion to finish.
  await range.scrollIntoViewIfNeeded();
  const initial = await range.evaluate((element) => ({
    value: Number(element.value),
    maximum: Number(element.max),
    thumbSize: parseFloat(
      globalThis
        .getComputedStyle(element)
        .getPropertyValue("--graph-thumb-size"),
    ),
  }));
  assert(
    initial.maximum >= 5,
    "Drag qualification needs several available nodes",
  );
  const bounds = await range.boundingBox();
  const fieldset = page.locator(".nodes-shown");
  const controlBounds = await fieldset.boundingBox();
  const position = (value) =>
    bounds.x +
    initial.thumbSize / 2 +
    ((bounds.width - initial.thumbSize) * value) / initial.maximum;
  const steps = [];
  await page.mouse.move(position(initial.value), bounds.y + bounds.height / 2);
  await page.mouse.down();
  try {
    for (const fraction of [0.7, 0.5, 0.2, 0, 0.4, 1, 0.6]) {
      const target = Math.round(fraction * initial.maximum);
      await page.mouse.move(position(target), bounds.y + bounds.height / 2, {
        steps: 4,
      });
      // Let ordinary input publication and rendering run between mouse moves.
      await page.waitForTimeout(20);
      const value = Number(await range.inputValue());
      steps.push({ target, value });
      assert(
        Math.abs(value - target) <= 1,
        `Mouse dragging must follow the pointer: ${JSON.stringify({ target, value, initial, bounds, currentBounds: await range.boundingBox(), disabled: await range.isDisabled(), steps })}`,
      );
      assert.equal(
        Number(await page.locator("#nodesShown-exact").inputValue()),
        value,
      );
      assert.deepEqual(
        await range.boundingBox(),
        bounds,
        "The slider must stay still",
      );
      assert.deepEqual(
        await fieldset.boundingBox(),
        controlBounds,
        "The control must not change shape",
      );
      assert(!(await page.locator("#nodesShown-status").isVisible()));
    }
  } finally {
    await page.mouse.up();
  }
  return { initial, steps };
}
