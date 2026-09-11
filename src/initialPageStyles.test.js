import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@jest/globals";
import { HtmlValidate, Parser } from "html-validate";

test("the initial page discovers graph and application styles without executing JavaScript", () => {
  const pageUrl = new URL("./index.html", import.meta.url);
  const validator = new HtmlValidate();
  const parser = new Parser(validator.getConfigForSync(fileURLToPath(pageUrl)));
  const document = parser.parseHtml(readFileSync(pageUrl, "utf8"));
  const stylesheets = document.querySelectorAll(
    'head > link[rel="stylesheet"]',
  );

  // Preserve the established cascade: renderer defaults, then application UI.
  expect(stylesheets.map((link) => link.getAttributeValue("href"))).toEqual([
    "webvowl/css/vowl.css",
    "app/css/toolstyle.css",
  ]);
  for (const stylesheet of stylesheets) {
    // A print-only, disabled or onload-switched link would not block first paint.
    expect(stylesheet.getAttributeValue("media")).toBeNull();
    expect(stylesheet.hasAttribute("disabled")).toBe(false);
    expect(stylesheet.hasAttribute("onload")).toBe(false);
    const cssUrl = new URL(stylesheet.getAttributeValue("href"), pageUrl);
    expect(readFileSync(cssUrl, "utf8").length).toBeGreaterThan(0);
  }
});
