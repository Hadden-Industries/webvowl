import fs from "node:fs";

const stylesheet = fs.readFileSync(new URL("./toolstyle.css", import.meta.url), "utf8");

describe("mobile toolbar styles", () => {
  test("does not collapse the search clear button label with navigation text", () => {
    const compactNavigationRule = stylesheet.match(
      /@media screen and \(width < 768px\) \{\s*([^{}]+)\{\s*font-size:\s*0\s*!important;/
    );

    expect(compactNavigationRule).not.toBeNull();
    expect(compactNavigationRule[1]).toContain("button:not(#search-clear-btn)");
  });

  test("keeps the expanded search clear target at least 44px square", () => {
    const compactClearButtonRule = stylesheet.match(
      /@media screen and \(width < 600px\) \{[\s\S]*?li#c_search\.search-expanded #search-clear-btn\s*\{([^{}]+)\}/
    );

    expect(compactClearButtonRule).not.toBeNull();
    expect(compactClearButtonRule[1]).toContain("width: var(--toolbar-control-size) !important");
    expect(compactClearButtonRule[1]).toContain("height: var(--toolbar-control-size) !important");
  });
});
