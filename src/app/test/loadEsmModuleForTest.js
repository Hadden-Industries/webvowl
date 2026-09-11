const { existsSync, readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { fileURLToPath } = require("node:url");
const { SourceTextModule, SyntheticModule } = require("node:vm");

// Jest runs this repository without "type": "module", so a native-ESM source
// module cannot be imported directly from a test file. Loading it through
// node:vm keeps package.json and the Jest configuration untouched, which the
// migration plan requires. A CommonJS dependency is wrapped in a synthetic
// module so an ESM module under test can still import an allowlisted leaf.
// One cache per test file keeps every load sharing the same module instances,
// so a class loaded directly by the test is identical to the one its subject
// sees. Separate caches would make instanceof checks fail across loads.
const instantiatedModulesByIdentifier = new Map();

function loadEsmModuleForTest(moduleUrl, importMetaUrl, dependencyStubs = {}) {
  const requireCommonJsDependency = createRequire(importMetaUrl);

  function isNativeEsmSource(moduleSource) {
    return /^\s*(?:import|export)\s/mu.test(moduleSource);
  }

  function instantiateModule(resolvedModuleUrl) {
    const moduleIdentifier = resolvedModuleUrl.href;
    if (instantiatedModulesByIdentifier.has(moduleIdentifier)) {
      return instantiatedModulesByIdentifier.get(moduleIdentifier);
    }
    const sourceModule = new SourceTextModule(
      readFileSync(fileURLToPath(resolvedModuleUrl), "utf8"),
      { identifier: moduleIdentifier },
    );
    instantiatedModulesByIdentifier.set(moduleIdentifier, sourceModule);
    return sourceModule;
  }

  function linkModuleSpecifier(specifier, referencingModule) {
    const resolvedModuleUrl = new URL(specifier, referencingModule.identifier);

    // A test may substitute a dependency by specifier. This replaces jest.mock,
    // which cannot intercept a module this loader reads from disk itself.
    const stubbedExports = dependencyStubs[specifier];
    if (stubbedExports !== undefined) {
      const exportNames = Object.keys(stubbedExports);
      return new SyntheticModule(
        exportNames,
        function provideStubbedExports() {
          for (const exportName of exportNames) {
            this.setExport(exportName, stubbedExports[exportName]);
          }
        },
        { identifier: resolvedModuleUrl.href },
      );
    }

    const resolvedModulePath = fileURLToPath(resolvedModuleUrl);
    if (
      resolvedModulePath.endsWith(".js") &&
      existsSync(resolvedModulePath) &&
      isNativeEsmSource(readFileSync(resolvedModulePath, "utf8"))
    ) {
      return instantiateModule(resolvedModuleUrl);
    }

    const commonJsExport = requireCommonJsDependency(
      existsSync(resolvedModulePath) ? resolvedModulePath : specifier,
    );
    return new SyntheticModule(
      ["default"],
      function provideCommonJsExport() {
        this.setExport("default", commonJsExport);
      },
      { identifier: resolvedModuleUrl.href },
    );
  }

  return (async () => {
    const rootModule = instantiateModule(new URL(moduleUrl));
    await rootModule.link(linkModuleSpecifier);
    await rootModule.evaluate();
    return rootModule.namespace;
  })();
}

module.exports = loadEsmModuleForTest;
