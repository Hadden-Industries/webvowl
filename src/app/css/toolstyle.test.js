import fs from "node:fs";

const stylesheet = fs.readFileSync(new URL("./toolstyle.css", import.meta.url), "utf8");
const markup = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");

describe("mobile toolbar styles", () => {
  test("hides only explicit navigation labels in compact mode", () => {
    const compactLabelRule = stylesheet.match(
      /@media screen and \(width < 768px\) \{[\s\S]*?#menuElementContainer \.menuElementLabel\s*\{([^{}]+)\}/
    );

    expect(compactLabelRule).not.toBeNull();
    expect(compactLabelRule[1]).toContain("display: none");
    expect(compactLabelRule[1]).not.toContain("font-size: 0");
  });

  test("keeps the expanded search clear target at least 44px square", () => {
    const compactClearButtonRule = stylesheet.match(
      /@media screen and \(width < 600px\) \{[\s\S]*?li#c_search\.search-expanded #search-clear-btn\s*\{([^{}]+)\}/
    );

    expect(compactClearButtonRule).not.toBeNull();
    expect(compactClearButtonRule[1]).toContain("width: var(--toolbar-control-size) !important");
    expect(compactClearButtonRule[1]).toContain("height: var(--toolbar-control-size) !important");
  });

  test("uses an explicit 8px gap between toolbar items", () => {
    const menuRule = stylesheet.match(/#menuElementContainer\s*\{([^{}]+)\}/);

    expect(menuRule).not.toBeNull();
    expect(menuRule[1]).toContain("--menu-item-gap: 8px");
    expect(menuRule[1]).toContain("gap: var(--menu-item-gap)");
  });

  test("renders standard toolbar icons at 24px", () => {
    const menuRule = stylesheet.match(/#menuElementContainer\s*\{([^{}]+)\}/);
    const iconRule = stylesheet.match(
      /#menuElementContainer \.menuElementSvgElement\s*\{([^{}]+)\}/
    );

    expect(menuRule).not.toBeNull();
    expect(iconRule).not.toBeNull();
    expect(menuRule[1]).toContain("--menu-icon-size: 24px");
    expect(iconRule[1]).toContain("width: var(--menu-icon-size)");
    expect(iconRule[1]).toContain("height: var(--menu-icon-size)");
  });

  test("keeps the default search clear target 44px square", () => {
    const clearButtonRule = stylesheet.match(/#search-clear-btn\s*\{([^{}]+)\}/);

    expect(clearButtonRule).not.toBeNull();
    expect(clearButtonRule[1]).toContain("width: var(--toolbar-control-size) !important");
    expect(clearButtonRule[1]).toContain("height: var(--toolbar-control-size) !important");
  });

  test("keeps toolbar SVGs as direct button children without i wrappers", () => {
    const toolbarMarkup = markup.match(
      /<ul id="menuElementContainer">([\s\S]*?)<\/ul>/
    );

    expect(toolbarMarkup).not.toBeNull();
    expect(toolbarMarkup[1]).not.toMatch(/<\/?i(?:\s|>)/);
    expect(toolbarMarkup[1]).not.toMatch(/<button[^>]*>\s*<i[\s>]/);
  });

  test("wraps visible toolbar labels in stable styling hooks", () => {
    const toolbarMarkup = markup.match(
      /<ul id="menuElementContainer">([\s\S]*?)<\/ul>/
    );
    const expectedLabels = [
      "Ontology", "Export", "Filter", "Options", "Modes",
      "Debug", "About", "Reset", "Pause"
    ];

    expect(toolbarMarkup).not.toBeNull();
    expectedLabels.forEach(label => {
      expect(toolbarMarkup[1]).toContain(
        `<span class="menuElementLabel">${label}</span>`
      );
    });
  });

  test("renders both pause states statically in the toggle button", () => {
    expect(markup).toMatch(
      /id="pause-button"[^>]*aria-pressed="false"[\s\S]*?class="pause-icon-path"[\s\S]*?class="resume-icon-path"[\s\S]*?<span class="menuElementLabel">Pause<\/span>/
    );
  });

  test("keeps pause styling independent from generic highlights and obsolete links", () => {
    expect(stylesheet).not.toMatch(/#pause-button\.highlighted/);
    expect(stylesheet).not.toMatch(/a#pause-button/);
    expect(stylesheet).not.toMatch(/a#reset-button/);
  });

  test("uses a clear paused background without redundant foreground or glow styles", () => {
    const pausedRule = stylesheet.match(/#pause-button\.paused\s*\{([^{}]+)\}/);
    const pausedHoverRule = stylesheet.match(
      /@media \(hover: hover\) and \(pointer: fine\) \{\s*#pause-button\.paused:hover\s*\{([^{}]+)\}/
    );

    expect(pausedRule).not.toBeNull();
    expect(pausedRule[1]).toContain("background: var(--theme-color-accent)");
    expect(pausedRule[1]).not.toContain("border-color");
    expect(pausedRule[1]).not.toMatch(/(?:^|\s)color:/);
    expect(pausedRule[1]).not.toContain("box-shadow");
    expect(pausedHoverRule).not.toBeNull();
    expect(pausedHoverRule[1]).toContain("background: color-mix(in srgb, var(--theme-color-accent) 85%, #fff)");
  });

  test("reserves stable desktop space for the pause and resume label", () => {
    const rootRule = stylesheet.match(/:root\s*\{([^{}]+)\}/);
    const desktopActionRule = stylesheet.match(
      /@media screen and \(width >= 768px\) \{[\s\S]*?#c_pause,\s*#c_reset,\s*#pause-button,\s*#reset-button\s*\{([^{}]+)\}/
    );
    const desktopLabelRule = stylesheet.match(
      /@media screen and \(width >= 768px\) \{[\s\S]*?#pause-button \.menuElementLabel\s*\{([^{}]+)\}/
    );

    expect(rootRule).not.toBeNull();
    expect(rootRule[1]).toContain("--action-pill-desktop-min-width: 112px");
    expect(desktopActionRule).not.toBeNull();
    expect(desktopActionRule[1]).toContain("width: var(--action-pill-desktop-min-width)");
    expect(desktopActionRule[1]).toContain("min-width: var(--action-pill-desktop-min-width)");
    expect(desktopLabelRule).not.toBeNull();
    expect(desktopLabelRule[1]).toContain("inline-size: 3.5rem");
    expect(desktopLabelRule[1]).toContain("text-align: left");
  });
});
