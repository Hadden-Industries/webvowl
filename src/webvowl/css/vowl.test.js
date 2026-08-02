import fs from "node:fs";

const stylesheet = fs.readFileSync(new URL("./vowl.css", import.meta.url), "utf8");

describe("graph SVG path styles", () => {
  test("scope general path presentation without overriding marker fills", () => {
    expect(stylesheet).toMatch(/:where\(#graph\) path,\s*\.nofill\s*\{\s*fill:\s*none;/);
    expect(stylesheet).toMatch(/marker path\s*\{\s*fill:\s*#000;/);
    expect(stylesheet).not.toMatch(/#graph path/);
  });
});
