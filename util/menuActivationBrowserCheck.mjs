import assert from "node:assert/strict";

export async function checkMenuPlacement(page) {
  const checks = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 600 },
    { width: 769, height: 360 },
    { width: 768, height: 700 },
    { width: 440, height: 956 },
  ]) {
    await page.setViewportSize(viewport);
    for (const id of ["m_config", "m_select"]) {
      const opener = page.locator(`.navButton[popovertarget="${id}"]`);
      await opener.scrollIntoViewIfNeeded();
      // A toolbar scroll closes open popovers; let it finish before opening.
      await page.waitForTimeout(100);
      await opener.click();
      const menu = page.locator(`#${id}`);
      await menu.waitFor({ state: "visible" });
      await menu.evaluate(async (element) => {
        await Promise.allSettled(
          element.getAnimations().map((a) => a.finished),
        );
      });
      const bounds = await menu.boundingBox();
      const toolbar = await page.locator("#swipeBarContainer").boundingBox();
      const bottom = bounds.y + bounds.height;
      const expectedBottom =
        viewport.width > 768 ? toolbar.y - 16 : viewport.height;
      checks.push({ viewport, id, bounds, expectedBottom });
      assert(
        Math.abs(bottom - expectedBottom) < 1,
        `${id} bottom ${bottom} should be ${expectedBottom} at width ${viewport.width}`,
      );
      assert(bounds.y >= 0, `${id} must fit above its bottom anchor`);
      await menu.locator(".popover-close-btn").click();
    }
  }
  return checks;
}

/** Native input/accessible-name checks; these do not emulate VoiceOver. */
export async function checkToolbarActivation(page, { touch = false } = {}) {
  const container = page.locator("#menuElementContainer");
  const maximum = await container.evaluate(
    (el) => el.scrollWidth - el.clientWidth,
  );
  assert(maximum > 100, "Use a compact viewport with overflowing navigation");
  const checks = [];
  for (const direction of ["Right", "Left"]) {
    for (const method of [touch ? "tap" : "click", "keyboard", "activation"]) {
      await container.evaluate((el) => {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      });
      await page.waitForTimeout(50);
      const before = await container.evaluate((el) => el.scrollLeft);
      const button = page.locator(`#scroll${direction}Button`);
      if (method === "tap") await button.tap();
      else if (method === "click") await button.click();
      else if (method === "keyboard") {
        await button.focus();
        await button.press("Enter");
      } else await button.evaluate((el) => el.click());
      const after = await container.evaluate((el) => el.scrollLeft);
      assert(
        direction === "Right" ? after > before : after < before,
        `${direction} ${method} must scroll`,
      );
      checks.push({ direction, method, before, after });
    }
  }
  return checks;
}

export async function checkOptionsPresentation(page) {
  await page.locator('.navButton[popovertarget="m_config"]').click();
  const menu = page.locator("#m_config");
  await menu.waitFor({ state: "visible" });
  // Let the entry animation finish before observing resting geometry.
  await page.waitForTimeout(350);
  const bounds = await menu.boundingBox();
  assert(
    Math.abs(bounds.y + bounds.height - page.viewportSize().height) < 1,
    "The compact sheet must rest at the viewport bottom",
  );
  const button = page.locator("#externalColorModeButton");
  const names = [];
  for (let i = 0; i < 2; i += 1) {
    const value = await button.innerText();
    const name = `Color externals ${value}`;
    assert.equal(
      await page.getByRole("button", { name, exact: true }).count(),
      1,
    );
    names.push(name);
    await button.click();
  }
  assert.notEqual(names[0], names[1], "Both color modes must be named");
  const ranges = [];
  for (const id of [
    "classDistanceSlider",
    "datatypeDistanceSlider",
    "maxLabelWidthSlider",
  ]) {
    const height = (await page.locator(`#${id}`).boundingBox()).height;
    assert(height >= 44, `${id} must have a real 44px input target`);
    ranges.push({ id, height });
  }
  await page.keyboard.press("Escape");
  return { bounds, names, ranges };
}
