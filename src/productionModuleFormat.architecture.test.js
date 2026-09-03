import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { Linter } from "eslint";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";

const REPOSITORY_ROOT_URL_STRING = new URL("..", import.meta.url).href;
const REPOSITORY_ROOT_PATH = fileURLToPath(REPOSITORY_ROOT_URL_STRING);
const ARCHITECTURE_TEST_MODULE_PATH =
  "src/productionModuleFormat.architecture.test.js";

const REQUIRED_NATIVE_ESM_MODULE_PATHS = Object.freeze([
  "src/app/js/directInputModule.js",
  "src/app/js/directInputModule.test.js",
  "src/app/js/editSidebar.js",
  "src/app/js/editSidebar.test.js",
  "src/app/js/leftSidebar.js",
  "src/app/js/leftSidebar.test.js",
  "src/app/js/loadingModule.js",
  "src/app/js/loadingModule.test.js",
  "src/main.js",
  "src/app/js/app.js",
  "src/app/js/entry.js",
  "src/app/js/menu/exportMenu.js",
  "src/app/js/menu/exportMenu.test.js",
  "src/app/js/menu/ontologyMenu.js",
  "src/app/js/menu/ontologyMenu.test.js",
  "src/app/js/ui/svgArtifactDownloadAdapter.js",
  "src/app/js/ui/svgArtifactDownloadAdapter.test.js",
  "src/webvowl/js/entry.js",
  "src/webvowl/js/runtime/d3RenderedGraphAdapter.js",
  "src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js",
  "src/webvowl/js/runtime/renderedGraphConfiguration.js",
  "src/webvowl/js/runtime/renderedGraphConfiguration.test.js",
  "src/app/js/controller/graphLayoutSettler.js",
  "src/app/js/controller/graphLayoutSettler.test.js",
  "src/app/js/controller/linkedAbortSignal.js",
  "src/app/js/controller/linkedAbortSignal.test.js",
  "src/app/js/controller/ontologyInspector.js",
  "src/app/js/controller/ontologyInspector.test.js",
  "src/app/js/controller/ontologySourceLoader.js",
  "src/app/js/controller/ontologySourceLoader.test.js",
  "src/app/js/controller/renderedGraphRuntimeContracts.js",
  "src/app/js/controller/renderedGraphRuntimeContracts.test.js",
  "src/app/js/controller/svgArtifactService.js",
  "src/app/js/controller/svgArtifactService.test.js",
  "src/app/js/controller/svgSerializer.js",
  "src/app/js/controller/svgSerializer.test.js",
  "src/app/js/controller/vowlModelInspectionProjector.js",
  "src/app/js/controller/vowlModelInspectionProjector.test.js",
  "src/app/js/controller/webVowlController.js",
  "src/app/js/controller/webVowlController.test.js",
  "src/app/js/controller/webVowlControllerContracts.js",
  "src/app/js/controller/webVowlControllerContracts.test.js",
  "src/app/js/ui/visualizationViewControlsAdapter.js",
  "src/app/js/ui/visualizationViewControlsAdapter.test.js",
  "src/app/js/ontologyLifecycle.js",
  "src/app/js/ontologyLifecycle.test.js",
  "src/app/js/sidebar.js",
  "src/app/js/sidebar.test.js",
  "src/app/test/inMemoryRenderedGraphAdapter.js",
  "src/app/test/inMemoryRenderedGraphAdapter.test.js",
  "src/app/test/renderedGraphRuntimeContract.js",
  "src/app/js/warningModule.js",
  "src/app/js/warningModule.test.js",
  "src/shared/js/util/resolveFetchUrl.js",
  "src/shared/js/util/resolveFetchUrl.test.js",
]);

const REQUIRED_NATIVE_ESM_DIRECTORY_PATHS = Object.freeze([
  "src/app/js/controller",
  "src/app/js/ui",
  "src/app/js/webmcp",
  "src/webvowl/js/runtime",
]);

const APPROVED_DEFAULT_EXPORT_MODULE_PATHS = Object.freeze([]);

// Task 5's source inventory found that ordinary application D3 selection and
// event work was confined to sidebar.js and editSidebar.js. Once those uses
// move to native DOM APIs, only application composition and live-SVG export
// remain as deletion-bound Task 9 migration sources. Loading and converter
// transport already use native Fetch and therefore do not belong in this set.
const APPLICATION_D3_MIGRATION_SOURCE_PATHS = Object.freeze([
  "src/app/js/app.js",
  "src/app/js/menu/exportMenu.js",
]);

const TASK_5_NATIVE_UI_PRODUCTION_MODULE_PATHS = Object.freeze([
  "src/app/js/directInputModule.js",
  "src/app/js/editSidebar.js",
  "src/app/js/leftSidebar.js",
  "src/app/js/loadingModule.js",
  "src/app/js/sidebar.js",
  "src/app/js/warningModule.js",
]);

// Task 1 found 110 authored JavaScript modules reachable from src/main.js:
// 103 CommonJS, four native ESM, and three hybrid modules. Only these 30
// CommonJS modules were already private renderer implementation details with
// no application/UI responsibility or public namespace export. This maximum
// is evidence for Task 9, not approval of the current graph/entry boundary.
const TASK_1_COMMONJS_RENDERER_LEAF_PATHS = Object.freeze([
  "src/shared/js/util/AbsoluteTextElement.js",
  "src/shared/js/util/AbstractTextElement.js",
  "src/shared/js/util/CenteringTextElement.js",
  "src/shared/js/util/filterTools.js",
  "src/shared/js/util/math.js",
  "src/shared/js/util/set.js",
  "src/shared/js/util/textTools.js",
  "src/webvowl/js/classDragger.js",
  "src/webvowl/js/domainDragger.js",
  "src/webvowl/js/elements/BaseElement.js",
  "src/webvowl/js/elements/drawTools.js",
  "src/webvowl/js/elements/forceLayoutNodeFunctions.js",
  "src/webvowl/js/elements/links/ArrowLink.js",
  "src/webvowl/js/elements/links/BoxArrowLink.js",
  "src/webvowl/js/elements/links/Label.js",
  "src/webvowl/js/elements/links/PlainLink.js",
  "src/webvowl/js/elements/links/linkPart.js",
  "src/webvowl/js/elements/nodes/BaseNode.js",
  "src/webvowl/js/elements/nodes/DatatypeNode.js",
  "src/webvowl/js/elements/nodes/RectangularNode.js",
  "src/webvowl/js/elements/nodes/RoundNode.js",
  "src/webvowl/js/elements/nodes/SetOperatorNode.js",
  "src/webvowl/js/elements/properties/BaseProperty.js",
  "src/webvowl/js/elements/rectangularElementTools.js",
  "src/webvowl/js/parser.js",
  "src/webvowl/js/parsing/attributeParser.js",
  "src/webvowl/js/parsing/equivalentPropertyMerger.js",
  "src/webvowl/js/parsing/linkCreator.js",
  "src/webvowl/js/rangeDragger.js",
  "src/webvowl/js/shadowClone.js",
]);

const TASK_1_COMMONJS_RENDERER_LEAF_CONTENT_SHA256_BY_PATH = Object.freeze({
  "src/shared/js/util/AbsoluteTextElement.js":
    "3a655d0bcb4deb0810eb9414e2410847d467c8e4804803d503febec445d2a756",
  "src/shared/js/util/AbstractTextElement.js":
    "9f599efef823736eacf48b9aff9e7cc74e648e23b6019958e514e45c6b4ae540",
  "src/shared/js/util/CenteringTextElement.js":
    "9e28a43f8dead67021275af590d1c9b1ef864173115539c7b79c6e12e3a4063c",
  "src/shared/js/util/filterTools.js":
    "cee8ab315c25c2e005727fe1dc6f0859d8280630819040a5907f63c6a6949af0",
  "src/shared/js/util/math.js":
    "8eeab794e45f8777d9c59537cb4c935d1f99adedd6688213f5cd36adc7d67834",
  "src/shared/js/util/set.js":
    "c3f0fe56fc04ceab2e21f62bbeec91773da64f8b8833ac4a13d95e70bfff6acb",
  "src/shared/js/util/textTools.js":
    "6195b4b5688b40c1dc32626fefd166a367dcb3a4cce681b0125f90f885026c35",
  "src/webvowl/js/classDragger.js":
    "103e07fed1b7072fe11e0f86b51de448c2d09c25f1a91ed8902e8d2d4a3705c1",
  "src/webvowl/js/domainDragger.js":
    "9ab7a1aba87c2a9263768999fc54314413422b7de288036bd55b4909cfee900d",
  "src/webvowl/js/elements/BaseElement.js":
    "f012ea6e4f7b2a7d4a24fbd814d5306b008ce1e6ca0d2cfe184d09c163ed876a",
  "src/webvowl/js/elements/drawTools.js":
    "35a572cc0949359bc92cf3a1600f5bbb428b791272ac2d71091da4828bd0d743",
  "src/webvowl/js/elements/forceLayoutNodeFunctions.js":
    "80285bb92895a5a85e49d3a3e2d39e0e8232d483a33d5643b4ca0ee5e0db1b1c",
  "src/webvowl/js/elements/links/ArrowLink.js":
    "3a6142c05568915f5cc40d8b95543263b727c65da58de2861996aa8021f0d352",
  "src/webvowl/js/elements/links/BoxArrowLink.js":
    "01406f8a20f0f03bfee0d1c7eff4f3edde0d8197a5a634f545c9996fe0793c27",
  "src/webvowl/js/elements/links/Label.js":
    "e5f2e71f6767bf283703a19d6bf420950c21b1a330be921d20a822d05051fe7b",
  "src/webvowl/js/elements/links/linkPart.js":
    "09953d7f24feb0514dbb6fc7ec33bce0cc475c35babe480f633cf7871c15851e",
  "src/webvowl/js/elements/links/PlainLink.js":
    "e78cd89e948652b64463dc8b0be044739c1b82bd8cb4ee0912309fb37b5818e2",
  "src/webvowl/js/elements/nodes/BaseNode.js":
    "c5f0d47d1eae91ed3cc7c123a40d7e7371edc63ffc2008b04231618b5afa3e35",
  "src/webvowl/js/elements/nodes/DatatypeNode.js":
    "75475d6b4c847e44b13ce666e1fee12c5d392df632dd1caedba5f4debe1a51b6",
  "src/webvowl/js/elements/nodes/RectangularNode.js":
    "5e38668d1c2c6e7c95ad3d9636c415395ee2174db8b50698a314eabdcd6b852b",
  "src/webvowl/js/elements/nodes/RoundNode.js":
    "2bd04e59ee3404a159dd03beaa301b20b29eed87c41eabde584bef27da7e7407",
  "src/webvowl/js/elements/nodes/SetOperatorNode.js":
    "92fc8694cc0d1e5cc199d1c765fb258f288a3a41b3f230a6c983c022b0c30c9d",
  "src/webvowl/js/elements/properties/BaseProperty.js":
    "a35ad1b821d7c193e9189220ac2a6890b2568a35b465e0aa5672769ed6d40053",
  "src/webvowl/js/elements/rectangularElementTools.js":
    "d46e3074fd94aabbfc0cf0cfd2c2b1a3cea7e6362e011548a2410e7b3a4ba7eb",
  "src/webvowl/js/parser.js":
    "c0c9cbe708628e99d2822f3b276d119ef7d6de5f33757c49dd083b084a884775",
  "src/webvowl/js/parsing/attributeParser.js":
    "04d7d27d883a4f768215f463fb23ef8ad47da423113147bcc56b87ac5112219c",
  "src/webvowl/js/parsing/equivalentPropertyMerger.js":
    "a47a4f8c2e69aa8a04eaad1819955d2173e9c446fbcc8c01a24ff0e4d14a14c4",
  "src/webvowl/js/parsing/linkCreator.js":
    "1fd4391c2f2c774e7bbb2687987173b7e4bbb2dd5b6607abcf9a4f8e4b59b929",
  "src/webvowl/js/rangeDragger.js":
    "1d1e4bf99c96d441609d8ce3db89560d03276c5663f1ef627c879197ea329dcb",
  "src/webvowl/js/shadowClone.js":
    "192b3e49ab52426338a1e1bb3ea7badc5ac16ccd1cb54a21ee291f36bb52621b",
});

// This list may only shrink. A path leaves it in the same change that moves,
// materially changes, or publicly exposes that module through a new interface.
// Task 9 removes every Task 1 leaf this cutover rewrites. Seven leaves lost
// their private-renderer status here: the shared text and colour utilities and
// four element modules, each of which had its ambient D3 or presentation
// coupling severed. They must reach native ESM rather than stay allowlisted.
// Task 9 converted the renderer to native ESM, so no private CommonJS
// renderer leaf survives the cutover. The set may only ever shrink.
const LEGACY_COMMONJS_RENDERER_LEAF_PATHS = Object.freeze([]);

// The production allowlist is empty after the cutover, so the policy self-tests
// below supply a synthetic leaf set to keep exercising the machinery that would
// govern any future private CommonJS leaf.
let activeCommonJsRendererLeafPaths = LEGACY_COMMONJS_RENDERER_LEAF_PATHS;

// Test infrastructure, not a production boundary. Jest runs this repository
// without "type": "module", which the migration plan deliberately leaves
// unchanged, so a test cannot statically import a native-ESM repository module.
// This loader therefore has to stay CommonJS and reach node:module's
// createRequire to link CommonJS dependencies into a vm ESM module. It is
// reachable only from test files and never from a composition root.
const APPROVED_TEST_INFRASTRUCTURE_COMMONJS_PATHS = Object.freeze([
  "src/app/test/loadEsmModuleForTest.js",
]);

const RETIRED_AT_RENDERED_GRAPH_CUTOVER_PATHS = Object.freeze([
  "src/shared/js/options.js",
  "src/webvowl/js/graph.js",
]);

const CURRENT_PUBLIC_OR_APPLICATION_COMMONJS_PATHS = Object.freeze([
  "src/app/js/app.js",
  "src/app/js/entry.js",
  "src/main.js",
  "src/shared/js/options.js",
  "src/webvowl/js/entry.js",
  "src/webvowl/js/graph.js",
]);

const COMMONJS_PROHIBITED_SOURCE_PATTERN_LABELS = Object.freeze([
  "CommonJS createRequire interoperability",
  "CommonJS require",
  "CommonJS module access",
  "CommonJS module export",
  "CommonJS exports reference",
  "CommonJS exports mutation",
]);

const OBJECT_EXPORTS_MUTATION_METHOD_NAMES = Object.freeze([
  "assign",
  "defineProperties",
  "defineProperty",
  "freeze",
  "preventExtensions",
  "seal",
  "setPrototypeOf",
]);

const REFLECT_EXPORTS_MUTATION_METHOD_NAMES = Object.freeze([
  "defineProperty",
  "deleteProperty",
  "preventExtensions",
  "set",
  "setPrototypeOf",
]);

const AUTHORED_JAVASCRIPT_MODULE_EXTENSIONS = Object.freeze([
  ".cjs",
  ".js",
  ".mjs",
]);
const NODE_MODULE_API_SPECIFIERS = Object.freeze(["module", "node:module"]);

const D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH =
  "src/webvowl/js/runtime/d3RenderedGraphAdapter.js";
const DEPENDENCY_CRUISER_CLI_MODULE_PATH = fileURLToPath(
  new URL(
    "../node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
    import.meta.url,
  ),
);
const DEPENDENCY_CRUISER_JSON_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

function discoverAuthoredJavaScriptModuleDependencyGraph(
  entryModulePaths,
  baseDirectoryPath = REPOSITORY_ROOT_PATH,
) {
  const dependencyCruiserJson = execFileSync(
    process.execPath,
    [
      DEPENDENCY_CRUISER_CLI_MODULE_PATH,
      "--no-config",
      "--output-type",
      "json",
      "--do-not-follow",
      "node_modules",
      ...entryModulePaths,
    ],
    {
      cwd: baseDirectoryPath,
      encoding: "utf8",
      maxBuffer: DEPENDENCY_CRUISER_JSON_MAX_BUFFER_BYTES,
      windowsHide: true,
    },
  );
  const { modules } = JSON.parse(dependencyCruiserJson);
  return Object.freeze(
    [...modules].sort(({ source: leftPath }, { source: rightPath }) =>
      leftPath.localeCompare(rightPath),
    ),
  );
}

function absoluteRepositoryPath(repositoryRelativePath) {
  return path.join(REPOSITORY_ROOT_PATH, ...repositoryRelativePath.split("/"));
}

function toRepositoryRelativePath(absolutePath) {
  return path
    .relative(REPOSITORY_ROOT_PATH, absolutePath)
    .replaceAll("\\", "/");
}

function hasAuthoredJavaScriptModuleExtension(filePath) {
  return AUTHORED_JAVASCRIPT_MODULE_EXTENSIONS.includes(
    path.extname(filePath).toLowerCase(),
  );
}

function collectAuthoredJavaScriptModulePaths(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath, { withFileTypes: true }).flatMap(
    (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return collectAuthoredJavaScriptModulePaths(entryPath);
      }
      return entry.isFile() && hasAuthoredJavaScriptModuleExtension(entry.name)
        ? [entryPath]
        : [];
    },
  );
}

function requiredNativeEsmModulePaths() {
  const requiredPaths = new Set(REQUIRED_NATIVE_ESM_MODULE_PATHS);
  for (const directoryPath of REQUIRED_NATIVE_ESM_DIRECTORY_PATHS) {
    for (const modulePath of collectAuthoredJavaScriptModulePaths(
      absoluteRepositoryPath(directoryPath),
    )) {
      requiredPaths.add(toRepositoryRelativePath(modulePath));
    }
  }
  return [...requiredPaths].sort();
}

function moduleSpecifierPathname(moduleSpecifier) {
  const delimiterIndexes = ["?", "#"]
    .map((delimiter) => moduleSpecifier.indexOf(delimiter))
    .filter((delimiterIndex) => delimiterIndex !== -1);
  const pathnameEndIndex =
    delimiterIndexes.length === 0
      ? moduleSpecifier.length
      : Math.min(...delimiterIndexes);
  return moduleSpecifier.slice(0, pathnameEndIndex);
}

function moduleSpecifierPathnameEndsWithDirectorySeparator(moduleSpecifier) {
  const pathname = moduleSpecifierPathname(moduleSpecifier);
  return pathname.endsWith("/") || pathname.endsWith("\\");
}

function moduleSpecifierHasExplicitFileExtension(moduleSpecifier) {
  return (
    !moduleSpecifierPathnameEndsWithDirectorySeparator(moduleSpecifier) &&
    path.posix.extname(moduleSpecifierPathname(moduleSpecifier)).length > 1
  );
}

function isRepositoryLocalModuleSpecifier(moduleSpecifier) {
  return (
    moduleSpecifier.startsWith(".") ||
    (moduleSpecifier.startsWith("/") && !moduleSpecifier.startsWith("//"))
  );
}

function unwrapTransparentAstExpression(expression) {
  if (
    expression?.type === "ChainExpression" ||
    expression?.type === "ParenthesizedExpression"
  ) {
    return unwrapTransparentAstExpression(expression.expression);
  }
  return expression;
}

function staticStringExpressionValue(
  expression,
  sourceCode,
  resolvingConstantBindings = new Set(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (
    unwrappedExpression?.type === "Literal" &&
    typeof unwrappedExpression.value === "string"
  ) {
    return unwrappedExpression.value;
  }
  if (
    unwrappedExpression?.type === "TemplateLiteral" &&
    unwrappedExpression.expressions.length === 0
  ) {
    return (
      unwrappedExpression.quasis[0].value.cooked ??
      unwrappedExpression.quasis[0].value.raw
    );
  }
  if (
    unwrappedExpression?.type === "BinaryExpression" &&
    unwrappedExpression.operator === "+"
  ) {
    const leftValue = staticStringExpressionValue(
      unwrappedExpression.left,
      sourceCode,
      resolvingConstantBindings,
    );
    const rightValue = staticStringExpressionValue(
      unwrappedExpression.right,
      sourceCode,
      resolvingConstantBindings,
    );
    return typeof leftValue === "string" && typeof rightValue === "string"
      ? leftValue + rightValue
      : undefined;
  }
  if (unwrappedExpression?.type === "Identifier" && sourceCode !== undefined) {
    const constantBinding = resolvedBindingVariableForIdentifier(
      sourceCode,
      unwrappedExpression,
    );
    const constantBindingDefinition =
      constantBinding?.defs.length === 1 ? constantBinding.defs[0] : undefined;
    if (
      constantBindingDefinition?.type !== "Variable" ||
      constantBindingDefinition.parent.kind !== "const" ||
      constantBindingDefinition.node.id !== constantBindingDefinition.name ||
      constantBindingDefinition.node.init === null ||
      resolvingConstantBindings.has(constantBinding)
    ) {
      return undefined;
    }
    resolvingConstantBindings.add(constantBinding);
    try {
      return staticStringExpressionValue(
        constantBindingDefinition.node.init,
        sourceCode,
        resolvingConstantBindings,
      );
    } finally {
      resolvingConstantBindings.delete(constantBinding);
    }
  }
  return undefined;
}

function literalModuleSpecifierValue(expression) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (
    unwrappedExpression?.type === "Literal" &&
    typeof unwrappedExpression.value === "string"
  ) {
    return unwrappedExpression.value;
  }
  if (
    unwrappedExpression?.type === "TemplateLiteral" &&
    unwrappedExpression.expressions.length === 0
  ) {
    return unwrappedExpression.quasis[0].value.cooked ?? undefined;
  }
  return undefined;
}

function staticMemberPropertyName(memberExpression, sourceCode) {
  if (memberExpression.type !== "MemberExpression") {
    return undefined;
  }
  if (
    !memberExpression.computed &&
    memberExpression.property.type === "Identifier"
  ) {
    return memberExpression.property.name;
  }
  const staticStringPropertyName = staticStringExpressionValue(
    memberExpression.property,
    sourceCode,
  );
  if (staticStringPropertyName !== undefined) {
    return staticStringPropertyName;
  }
  const unwrappedProperty = unwrapTransparentAstExpression(
    memberExpression.property,
  );
  return unwrappedProperty?.type === "Literal" &&
    Number.isSafeInteger(unwrappedProperty.value) &&
    unwrappedProperty.value >= 0
    ? String(unwrappedProperty.value)
    : undefined;
}

function staticModuleExportName(moduleExportNameNode) {
  if (moduleExportNameNode?.type === "Identifier") {
    return moduleExportNameNode.name;
  }
  return typeof moduleExportNameNode?.value === "string"
    ? moduleExportNameNode.value
    : undefined;
}

function referenceForIdentifier(sourceCode, identifierNode) {
  let identifierScope = sourceCode.getScope(identifierNode);
  while (identifierScope !== null) {
    const matchingReference = identifierScope.references.find(
      (reference) => reference.identifier === identifierNode,
    );
    if (matchingReference !== undefined) {
      return matchingReference;
    }
    identifierScope = identifierScope.upper;
  }
  return undefined;
}

function identifierReferencesUnshadowedBinding(
  sourceCode,
  identifierNode,
  expectedBindingName,
) {
  if (
    identifierNode?.type !== "Identifier" ||
    identifierNode.name !== expectedBindingName
  ) {
    return false;
  }
  const identifierReference = referenceForIdentifier(
    sourceCode,
    identifierNode,
  );
  return (
    identifierReference !== undefined &&
    (identifierReference.resolved === null ||
      identifierReference.resolved.defs.length === 0)
  );
}

function moduleScopedBindingNameForIdentifier(sourceCode, identifierNode) {
  const bindingVariable = resolvedBindingVariableForIdentifier(
    sourceCode,
    identifierNode,
  );
  return bindingVariable?.scope.type === "module"
    ? bindingVariable.name
    : undefined;
}

function resolvedBindingVariableForIdentifier(sourceCode, identifierNode) {
  return (
    referenceForIdentifier(sourceCode, identifierNode)?.resolved ?? undefined
  );
}

const SEMANTIC_UNDEFINED_VALUE_EXPRESSION = Object.freeze({
  type: "SemanticUndefinedValueExpression",
});

function createSemanticStaticPropertyValueExpression(
  objectExpression,
  propertyName,
) {
  return {
    objectExpression,
    propertyName,
    type: "SemanticStaticPropertyValueExpression",
  };
}

function createSemanticObjectRestValueExpression(
  objectExpression,
  excludedPropertyNames,
) {
  return {
    excludedPropertyNames: new Set(excludedPropertyNames),
    objectExpression,
    type: "SemanticObjectRestValueExpression",
  };
}

function createSemanticArrayValueExpression(elements) {
  return {
    elements,
    type: "SemanticArrayValueExpression",
  };
}

function createSemanticArrayRestValueExpression(arrayExpression, startIndex) {
  return {
    arrayExpression,
    startIndex,
    type: "SemanticArrayRestValueExpression",
  };
}

function expressionIsDefinitelyUndefined(expression, sourceCode) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  return (
    unwrappedExpression?.type === "SemanticUndefinedValueExpression" ||
    (unwrappedExpression?.type === "Identifier" &&
      identifierReferencesUnshadowedBinding(
        sourceCode,
        unwrappedExpression,
        "undefined",
      )) ||
    (unwrappedExpression?.type === "UnaryExpression" &&
      unwrappedExpression.operator === "void")
  );
}

function expressionIsDefinitelyDefined(expression, sourceCode) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (expressionIsDefinitelyUndefined(unwrappedExpression, sourceCode)) {
    return false;
  }
  return [
    "ArrayExpression",
    "ArrowFunctionExpression",
    "ClassExpression",
    "FunctionExpression",
    "Literal",
    "NewExpression",
    "ObjectExpression",
    "SemanticArrayValueExpression",
    "SemanticObjectRestValueExpression",
    "TemplateLiteral",
  ].includes(unwrappedExpression?.type);
}

function bindingPatternContainsIdentifier(bindingPattern, targetIdentifier) {
  return boundIdentifierNodes(bindingPattern).includes(targetIdentifier);
}

function staticPropertyValueExpressions(expression, propertyName, sourceCode) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (unwrappedExpression?.type === "ObjectExpression") {
    const propertyValueExpressions = [];
    let hasMatchingProperty = false;
    for (const property of unwrappedExpression.properties) {
      if (property.type === "SpreadElement") {
        propertyValueExpressions.push(
          createSemanticStaticPropertyValueExpression(
            property.argument,
            propertyName,
          ),
        );
      } else if (staticModuleExportName(property.key) === propertyName) {
        hasMatchingProperty = true;
        propertyValueExpressions.push(property.value);
      }
    }
    return propertyValueExpressions.length > 0
      ? propertyValueExpressions
      : hasMatchingProperty
        ? []
        : [SEMANTIC_UNDEFINED_VALUE_EXPRESSION];
  }
  if (
    unwrappedExpression?.type === "ArrayExpression" ||
    unwrappedExpression?.type === "SemanticArrayValueExpression"
  ) {
    const elementIndex = Number(propertyName);
    const elements = unwrappedExpression.elements;
    if (!Number.isSafeInteger(elementIndex) || elementIndex < 0) {
      return [
        createSemanticStaticPropertyValueExpression(
          unwrappedExpression,
          propertyName,
        ),
      ];
    }
    const element = elements[elementIndex];
    return element === null || element === undefined
      ? [SEMANTIC_UNDEFINED_VALUE_EXPRESSION]
      : [element.type === "SpreadElement" ? element.argument : element];
  }
  if (unwrappedExpression?.type === "SemanticObjectRestValueExpression") {
    return unwrappedExpression.excludedPropertyNames.has(propertyName)
      ? [SEMANTIC_UNDEFINED_VALUE_EXPRESSION]
      : [
          createSemanticStaticPropertyValueExpression(
            unwrappedExpression.objectExpression,
            propertyName,
          ),
        ];
  }
  if (unwrappedExpression?.type === "SemanticArrayRestValueExpression") {
    const relativeIndex = Number(propertyName);
    return Number.isSafeInteger(relativeIndex) && relativeIndex >= 0
      ? staticPropertyValueExpressions(
          unwrappedExpression.arrayExpression,
          String(unwrappedExpression.startIndex + relativeIndex),
          sourceCode,
        )
      : [
          createSemanticStaticPropertyValueExpression(
            unwrappedExpression,
            propertyName,
          ),
        ];
  }
  return [
    createSemanticStaticPropertyValueExpression(
      unwrappedExpression,
      propertyName,
    ),
  ];
}

function objectRestValueExpression(expression, excludedPropertyNames) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (unwrappedExpression?.type !== "ObjectExpression") {
    return createSemanticObjectRestValueExpression(
      unwrappedExpression,
      excludedPropertyNames,
    );
  }
  return {
    properties: unwrappedExpression.properties.filter(
      (property) =>
        property.type === "SpreadElement" ||
        !excludedPropertyNames.has(staticModuleExportName(property.key)),
    ),
    type: "ObjectExpression",
  };
}

function arrayRestValueExpression(expression, startIndex) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (
    unwrappedExpression?.type === "ArrayExpression" ||
    unwrappedExpression?.type === "SemanticArrayValueExpression"
  ) {
    return createSemanticArrayValueExpression(
      unwrappedExpression.elements.slice(startIndex),
    );
  }
  return createSemanticArrayRestValueExpression(
    unwrappedExpression,
    startIndex,
  );
}

function projectedValueExpressionsForBindingIdentifier(
  bindingPattern,
  valueExpressions,
  targetIdentifier,
  sourceCode,
) {
  if (!bindingPatternContainsIdentifier(bindingPattern, targetIdentifier)) {
    return [];
  }
  if (bindingPattern.type === "Identifier") {
    return valueExpressions;
  }
  if (bindingPattern.type === "AssignmentPattern") {
    const selectedValueExpressions = [];
    const candidateValueExpressions =
      valueExpressions.length === 0
        ? [SEMANTIC_UNDEFINED_VALUE_EXPRESSION]
        : valueExpressions;
    for (const candidateValueExpression of candidateValueExpressions) {
      if (
        expressionIsDefinitelyUndefined(candidateValueExpression, sourceCode)
      ) {
        selectedValueExpressions.push(bindingPattern.right);
      } else {
        selectedValueExpressions.push(
          ...projectedValueExpressionsForBindingIdentifier(
            bindingPattern.left,
            [candidateValueExpression],
            targetIdentifier,
            sourceCode,
          ),
        );
        if (
          !expressionIsDefinitelyDefined(candidateValueExpression, sourceCode)
        ) {
          selectedValueExpressions.push(bindingPattern.right);
        }
      }
    }
    return selectedValueExpressions;
  }
  if (bindingPattern.type === "RestElement") {
    return projectedValueExpressionsForBindingIdentifier(
      bindingPattern.argument,
      valueExpressions,
      targetIdentifier,
      sourceCode,
    );
  }
  if (bindingPattern.type === "ArrayPattern") {
    for (const [
      elementIndex,
      elementPattern,
    ] of bindingPattern.elements.entries()) {
      if (
        elementPattern === null ||
        !bindingPatternContainsIdentifier(elementPattern, targetIdentifier)
      ) {
        continue;
      }
      const selectedValueExpressions = valueExpressions.flatMap(
        (valueExpression) =>
          elementPattern.type === "RestElement"
            ? [arrayRestValueExpression(valueExpression, elementIndex)]
            : staticPropertyValueExpressions(
                valueExpression,
                String(elementIndex),
                sourceCode,
              ),
      );
      return projectedValueExpressionsForBindingIdentifier(
        elementPattern.type === "RestElement"
          ? elementPattern.argument
          : elementPattern,
        selectedValueExpressions,
        targetIdentifier,
        sourceCode,
      );
    }
    return [];
  }
  if (bindingPattern.type === "ObjectPattern") {
    const excludedPropertyNames = new Set(
      bindingPattern.properties
        .filter((property) => property.type === "Property")
        .map((property) => staticModuleExportName(property.key))
        .filter((propertyName) => propertyName !== undefined),
    );
    for (const propertyPattern of bindingPattern.properties) {
      const nestedPattern =
        propertyPattern.type === "RestElement"
          ? propertyPattern.argument
          : propertyPattern.value;
      if (!bindingPatternContainsIdentifier(nestedPattern, targetIdentifier)) {
        continue;
      }
      const selectedValueExpressions = valueExpressions.flatMap(
        (valueExpression) =>
          propertyPattern.type === "RestElement"
            ? [
                objectRestValueExpression(
                  valueExpression,
                  excludedPropertyNames,
                ),
              ]
            : staticPropertyValueExpressions(
                valueExpression,
                staticModuleExportName(propertyPattern.key),
                sourceCode,
              ),
      );
      return projectedValueExpressionsForBindingIdentifier(
        nestedPattern,
        selectedValueExpressions,
        targetIdentifier,
        sourceCode,
      );
    }
  }
  return [];
}

function bindingPatternForWriteReference(bindingReference) {
  let patternNode = bindingReference.identifier;
  while (patternNode.parent !== null && patternNode.parent !== undefined) {
    const parentNode = patternNode.parent;
    if (
      parentNode.type === "VariableDeclarator" &&
      parentNode.id === patternNode
    ) {
      return patternNode;
    }
    if (
      parentNode.type === "AssignmentExpression" &&
      parentNode.left === patternNode
    ) {
      return patternNode;
    }
    if (
      ![
        "ArrayPattern",
        "AssignmentPattern",
        "ObjectPattern",
        "Property",
        "RestElement",
      ].includes(parentNode.type)
    ) {
      break;
    }
    patternNode = parentNode;
  }
  return bindingReference.identifier;
}

function statementSequenceRecord(node) {
  let sequenceElement = node;
  while (
    sequenceElement?.parent !== null &&
    sequenceElement?.parent !== undefined
  ) {
    const parentNode = sequenceElement.parent;
    if (
      (parentNode.type === "BlockStatement" || parentNode.type === "Program") &&
      parentNode.body.includes(sequenceElement)
    ) {
      return {
        index: parentNode.body.indexOf(sequenceElement),
        sequenceContainer: parentNode,
        statement: sequenceElement,
      };
    }
    sequenceElement = parentNode;
  }
  return undefined;
}

function writeDefinitelyPrecedesReference(bindingReference, referenceNode) {
  const writeSequence = statementSequenceRecord(bindingReference.identifier);
  const readSequence = statementSequenceRecord(referenceNode);
  if (
    writeSequence === undefined ||
    readSequence === undefined ||
    writeSequence.sequenceContainer !== readSequence.sequenceContainer ||
    writeSequence.index >= readSequence.index
  ) {
    return false;
  }
  const assignmentExpression = bindingReference.identifier.parent;
  let ancestorNode = assignmentExpression;
  while (
    ancestorNode !== writeSequence.statement &&
    ancestorNode !== null &&
    ancestorNode !== undefined
  ) {
    if (
      [
        "ArrowFunctionExpression",
        "AssignmentPattern",
        "ChainExpression",
        "ClassBody",
        "ConditionalExpression",
        "DoWhileStatement",
        "ForInStatement",
        "ForOfStatement",
        "ForStatement",
        "FunctionDeclaration",
        "FunctionExpression",
        "IfStatement",
        "LogicalExpression",
        "SwitchCase",
        "WhileStatement",
      ].includes(ancestorNode.type)
    ) {
      return false;
    }
    if (
      ancestorNode.type === "AssignmentExpression" &&
      ancestorNode.operator !== "="
    ) {
      return false;
    }
    ancestorNode = ancestorNode.parent;
  }
  return true;
}

function assignedValueExpressionsForBindingVariable(
  bindingVariable,
  sourceCode,
  referenceNode,
) {
  const precedingWriteReferences = bindingVariable.references
    .filter(
      (bindingReference) =>
        bindingReference.isWrite() &&
        bindingReference.writeExpr !== null &&
        (referenceNode === undefined ||
          bindingReference.identifier.start <= referenceNode.start),
    )
    .sort(
      (leftReference, rightReference) =>
        leftReference.identifier.start - rightReference.identifier.start,
    );
  const reachingWriteReferences = [];
  for (const bindingReference of precedingWriteReferences.toReversed()) {
    reachingWriteReferences.push(bindingReference);
    if (
      referenceNode !== undefined &&
      writeDefinitelyPrecedesReference(bindingReference, referenceNode)
    ) {
      break;
    }
  }
  return reachingWriteReferences
    .toReversed()
    .flatMap((bindingReference) =>
      projectedValueExpressionsForBindingIdentifier(
        bindingPatternForWriteReference(bindingReference),
        [bindingReference.writeExpr],
        bindingReference.identifier,
        sourceCode,
      ),
    );
}

function memberExpressionRecord(expression, sourceCode) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  return unwrappedExpression?.type === "MemberExpression"
    ? {
        expression: unwrappedExpression,
        object: unwrappedExpression.object,
        propertyName: staticMemberPropertyName(unwrappedExpression, sourceCode),
      }
    : undefined;
}

function localCallableNodesForExpression(
  expression,
  sourceCode,
  exposureTraversalContext,
  visitedBindingVariables = new Set(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (
    unwrappedExpression?.type === "ArrowFunctionExpression" ||
    unwrappedExpression?.type === "FunctionExpression"
  ) {
    return [unwrappedExpression];
  }
  if (unwrappedExpression?.type === "Identifier") {
    const bindingVariable = resolvedBindingVariableForIdentifier(
      sourceCode,
      unwrappedExpression,
    );
    if (
      bindingVariable === undefined ||
      visitedBindingVariables.has(bindingVariable)
    ) {
      return [];
    }
    visitedBindingVariables.add(bindingVariable);
    const callableNodes = bindingVariable.defs
      .filter((bindingDefinition) => bindingDefinition.type === "FunctionName")
      .map((bindingDefinition) => bindingDefinition.node);
    for (const assignedValueExpression of assignedValueExpressionsForBindingVariable(
      bindingVariable,
      sourceCode,
      unwrappedExpression,
    )) {
      callableNodes.push(
        ...localCallableNodesForExpression(
          assignedValueExpression,
          sourceCode,
          exposureTraversalContext,
          visitedBindingVariables,
        ),
      );
    }
    return callableNodes;
  }
  if (unwrappedExpression?.type === "MemberExpression") {
    return resolvedLocalValueExpressions(
      unwrappedExpression,
      sourceCode,
      exposureTraversalContext,
    )
      .filter(
        (memberValueExpression) =>
          memberValueExpression !== unwrappedExpression,
      )
      .flatMap((memberValueExpression) =>
        localCallableNodesForExpression(
          memberValueExpression,
          sourceCode,
          exposureTraversalContext,
          visitedBindingVariables,
        ),
      );
  }
  if (unwrappedExpression?.type === "ConditionalExpression") {
    return [
      ...localCallableNodesForExpression(
        unwrappedExpression.consequent,
        sourceCode,
        exposureTraversalContext,
        visitedBindingVariables,
      ),
      ...localCallableNodesForExpression(
        unwrappedExpression.alternate,
        sourceCode,
        exposureTraversalContext,
        visitedBindingVariables,
      ),
    ];
  }
  if (unwrappedExpression?.type === "LogicalExpression") {
    return [
      ...localCallableNodesForExpression(
        unwrappedExpression.left,
        sourceCode,
        exposureTraversalContext,
        visitedBindingVariables,
      ),
      ...localCallableNodesForExpression(
        unwrappedExpression.right,
        sourceCode,
        exposureTraversalContext,
        visitedBindingVariables,
      ),
    ];
  }
  if (unwrappedExpression?.type === "SequenceExpression") {
    return localCallableNodesForExpression(
      unwrappedExpression.expressions.at(-1),
      sourceCode,
      exposureTraversalContext,
      visitedBindingVariables,
    );
  }
  return [];
}

function returnedValueExpressionsForCallable(callableNode) {
  if (
    callableNode.type === "ArrowFunctionExpression" &&
    callableNode.body.type !== "BlockStatement"
  ) {
    return [callableNode.body];
  }
  const returnedValueExpressions = [];
  visitAstSubtree(
    callableNode.body,
    (node) => {
      if (node.type === "ReturnStatement" && node.argument !== null) {
        returnedValueExpressions.push(node.argument);
      }
    },
    (node) =>
      node === callableNode.body ||
      ![
        "ArrowFunctionExpression",
        "ClassDeclaration",
        "ClassExpression",
        "FunctionDeclaration",
        "FunctionExpression",
      ].includes(node.type),
  );
  return returnedValueExpressions;
}

function globalPublicationRootName(
  expression,
  sourceCode,
  visitedBindingVariables = new Set(),
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (unwrappedExpression?.type === "SemanticStaticPropertyValueExpression") {
    return ["frames", "parent", "self", "top", "window"].includes(
      unwrappedExpression.propertyName,
    )
      ? globalPublicationRootName(
          unwrappedExpression.objectExpression,
          sourceCode,
          visitedBindingVariables,
          exposureTraversalContext,
        )
      : undefined;
  }
  if (unwrappedExpression?.type === "Identifier") {
    const unshadowedBrowserGlobalName = [
      "frames",
      "globalThis",
      "parent",
      "self",
      "top",
      "window",
    ].find((globalBindingName) =>
      identifierReferencesUnshadowedBinding(
        sourceCode,
        unwrappedExpression,
        globalBindingName,
      ),
    );
    if (unshadowedBrowserGlobalName !== undefined) {
      return unshadowedBrowserGlobalName;
    }
    const bindingVariable = resolvedBindingVariableForIdentifier(
      sourceCode,
      unwrappedExpression,
    );
    const parameterValueExpressions =
      exposureTraversalContext.parameterValueExpressionsByBindingVariable.get(
        bindingVariable,
      );
    if (parameterValueExpressions !== undefined) {
      if (
        exposureTraversalContext.activeParameterValueBindingVariables.has(
          bindingVariable,
        )
      ) {
        return undefined;
      }
      exposureTraversalContext.activeParameterValueBindingVariables.add(
        bindingVariable,
      );
      for (const parameterValueExpression of parameterValueExpressions) {
        const parameterRootName = globalPublicationRootName(
          parameterValueExpression,
          sourceCode,
          visitedBindingVariables,
          exposureTraversalContext,
        );
        if (parameterRootName !== undefined) {
          exposureTraversalContext.activeParameterValueBindingVariables.delete(
            bindingVariable,
          );
          return parameterRootName;
        }
      }
      exposureTraversalContext.activeParameterValueBindingVariables.delete(
        bindingVariable,
      );
      return undefined;
    }
    if (
      bindingVariable === undefined ||
      visitedBindingVariables.has(bindingVariable)
    ) {
      return undefined;
    }
    visitedBindingVariables.add(bindingVariable);
    for (const assignedValueExpression of assignedValueExpressionsForBindingVariable(
      bindingVariable,
      sourceCode,
      unwrappedExpression,
    )) {
      const assignedRootName = globalPublicationRootName(
        assignedValueExpression,
        sourceCode,
        visitedBindingVariables,
        exposureTraversalContext,
      );
      if (assignedRootName !== undefined) {
        return assignedRootName;
      }
    }
    return undefined;
  }
  if (unwrappedExpression?.type === "ConditionalExpression") {
    return (
      globalPublicationRootName(
        unwrappedExpression.consequent,
        sourceCode,
        visitedBindingVariables,
        exposureTraversalContext,
      ) ??
      globalPublicationRootName(
        unwrappedExpression.alternate,
        sourceCode,
        visitedBindingVariables,
        exposureTraversalContext,
      )
    );
  }
  if (unwrappedExpression?.type === "LogicalExpression") {
    return (
      globalPublicationRootName(
        unwrappedExpression.left,
        sourceCode,
        visitedBindingVariables,
        exposureTraversalContext,
      ) ??
      globalPublicationRootName(
        unwrappedExpression.right,
        sourceCode,
        visitedBindingVariables,
        exposureTraversalContext,
      )
    );
  }
  if (unwrappedExpression?.type === "SequenceExpression") {
    return globalPublicationRootName(
      unwrappedExpression.expressions.at(-1),
      sourceCode,
      visitedBindingVariables,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression?.type === "AssignmentExpression") {
    return globalPublicationRootName(
      unwrappedExpression.right,
      sourceCode,
      visitedBindingVariables,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression?.type === "CallExpression") {
    const identityPreservingTargetExpression =
      identityPreservingCallTargetExpression(unwrappedExpression, sourceCode);
    const identityPreservingRootName = globalPublicationRootName(
      identityPreservingTargetExpression,
      sourceCode,
      visitedBindingVariables,
      exposureTraversalContext,
    );
    if (identityPreservingRootName !== undefined) {
      return identityPreservingRootName;
    }
    for (const callableNode of localCallableNodesForExpression(
      unwrappedExpression.callee,
      sourceCode,
      exposureTraversalContext,
    )) {
      if (exposureTraversalContext.activeCallableNodes.has(callableNode)) {
        continue;
      }
      exposureTraversalContext.activeCallableNodes.add(callableNode);
      const invocationParameterValues =
        parameterValueExpressionsForCallableInvocation(
          unwrappedExpression,
          callableNode,
          sourceCode,
          exposureTraversalContext.parameterValueExpressionsByBindingVariable,
        );
      const invocationContext = {
        ...exposureTraversalContext,
        parameterValueExpressionsByBindingVariable: invocationParameterValues,
      };
      for (const returnedValueExpression of returnedValueExpressionsForCallable(
        callableNode,
      )) {
        const returnedRootName = globalPublicationRootName(
          returnedValueExpression,
          sourceCode,
          visitedBindingVariables,
          invocationContext,
        );
        if (returnedRootName !== undefined) {
          exposureTraversalContext.activeCallableNodes.delete(callableNode);
          return returnedRootName;
        }
      }
      exposureTraversalContext.activeCallableNodes.delete(callableNode);
    }
    return undefined;
  }
  const memberRecord = memberExpressionRecord(unwrappedExpression);
  return ["frames", "parent", "self", "top", "window"].includes(
    memberRecord?.propertyName,
  )
    ? globalPublicationRootName(
        memberRecord.object,
        sourceCode,
        visitedBindingVariables,
        exposureTraversalContext,
      )
    : undefined;
}

function boundIdentifierNames(bindingPattern, names = new Set()) {
  if (bindingPattern === null || bindingPattern === undefined) {
    return names;
  }
  if (bindingPattern.type === "Identifier") {
    names.add(bindingPattern.name);
    return names;
  }
  if (
    bindingPattern.type === "AssignmentPattern" ||
    bindingPattern.type === "RestElement"
  ) {
    return boundIdentifierNames(
      bindingPattern.type === "AssignmentPattern"
        ? bindingPattern.left
        : bindingPattern.argument,
      names,
    );
  }
  if (bindingPattern.type === "ArrayPattern") {
    for (const elementPattern of bindingPattern.elements) {
      boundIdentifierNames(elementPattern, names);
    }
    return names;
  }
  if (bindingPattern.type === "ObjectPattern") {
    for (const propertyPattern of bindingPattern.properties) {
      boundIdentifierNames(
        propertyPattern.type === "RestElement"
          ? propertyPattern.argument
          : propertyPattern.value,
        names,
      );
    }
  }
  return names;
}

function boundIdentifierNodes(bindingPattern, identifierNodes = []) {
  if (bindingPattern === null || bindingPattern === undefined) {
    return identifierNodes;
  }
  if (bindingPattern.type === "Identifier") {
    identifierNodes.push(bindingPattern);
    return identifierNodes;
  }
  if (
    bindingPattern.type === "AssignmentPattern" ||
    bindingPattern.type === "RestElement"
  ) {
    return boundIdentifierNodes(
      bindingPattern.type === "AssignmentPattern"
        ? bindingPattern.left
        : bindingPattern.argument,
      identifierNodes,
    );
  }
  if (bindingPattern.type === "ArrayPattern") {
    for (const elementPattern of bindingPattern.elements) {
      boundIdentifierNodes(elementPattern, identifierNodes);
    }
    return identifierNodes;
  }
  if (bindingPattern.type === "ObjectPattern") {
    for (const propertyPattern of bindingPattern.properties) {
      boundIdentifierNodes(
        propertyPattern.type === "RestElement"
          ? propertyPattern.argument
          : propertyPattern.value,
        identifierNodes,
      );
    }
  }
  return identifierNodes;
}

function directlyReturnedBindingNamesFromStatement(
  statement,
  sourceCode,
  names,
  privateClassMemberDependenciesByName,
  exposureTraversalContext,
) {
  if (statement === null || statement === undefined) {
    return names;
  }
  if (statement.type === "ReturnStatement") {
    return directlyExposedBindingNames(
      statement.argument,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (statement.type === "BlockStatement") {
    for (const nestedStatement of statement.body) {
      directlyReturnedBindingNamesFromStatement(
        nestedStatement,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    return names;
  }
  if (statement.type === "IfStatement") {
    directlyReturnedBindingNamesFromStatement(
      statement.consequent,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    directlyReturnedBindingNamesFromStatement(
      statement.alternate,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    return names;
  }
  if (statement.type === "SwitchStatement") {
    for (const switchCase of statement.cases) {
      for (const consequentStatement of switchCase.consequent) {
        directlyReturnedBindingNamesFromStatement(
          consequentStatement,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
      }
    }
    return names;
  }
  if (statement.type === "TryStatement") {
    directlyReturnedBindingNamesFromStatement(
      statement.block,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    directlyReturnedBindingNamesFromStatement(
      statement.handler?.body,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    directlyReturnedBindingNamesFromStatement(
      statement.finalizer,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    return names;
  }
  if (
    [
      "DoWhileStatement",
      "ForInStatement",
      "ForOfStatement",
      "ForStatement",
      "LabeledStatement",
      "WhileStatement",
    ].includes(statement.type)
  ) {
    return directlyReturnedBindingNamesFromStatement(
      statement.body,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  return names;
}

function directlyReturnedBindingNames(
  callableNode,
  sourceCode,
  names,
  privateClassMemberDependenciesByName,
  exposureTraversalContext,
) {
  const returnedBindingNames =
    callableNode.type === "ArrowFunctionExpression" &&
    callableNode.body.type !== "BlockStatement"
      ? directlyExposedBindingNames(
          callableNode.body,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        )
      : directlyReturnedBindingNamesFromStatement(
          callableNode.body,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
  visitAstSubtree(
    callableNode.body,
    (node) => {
      if (node.type === "YieldExpression") {
        directlyExposedBindingNames(
          node.argument,
          sourceCode,
          returnedBindingNames,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
      }
    },
    (node) =>
      node === callableNode.body ||
      ![
        "ArrowFunctionExpression",
        "ClassDeclaration",
        "ClassExpression",
        "FunctionDeclaration",
        "FunctionExpression",
      ].includes(node.type),
  );
  return returnedBindingNames;
}

function unshadowedGlobalStaticMethodRecord(expression, sourceCode) {
  const calleeMember = memberExpressionRecord(expression);
  const globalObjectExpression = unwrapTransparentAstExpression(
    calleeMember?.object,
  );
  return globalObjectExpression?.type === "Identifier" &&
    identifierReferencesUnshadowedBinding(
      sourceCode,
      globalObjectExpression,
      globalObjectExpression.name,
    )
    ? {
        globalObjectName: globalObjectExpression.name,
        methodName: calleeMember.propertyName,
      }
    : undefined;
}

function identityPreservingCallTargetExpression(callExpression, sourceCode) {
  const methodRecord = unshadowedGlobalStaticMethodRecord(
    callExpression.callee,
    sourceCode,
  );
  const firstArgument = callExpression.arguments[0];
  if (firstArgument === undefined || firstArgument.type === "SpreadElement") {
    return undefined;
  }
  if (
    methodRecord?.globalObjectName === "Object" &&
    (methodRecord.methodName === "assign" ||
      (callExpression.arguments.length === 1 &&
        ["freeze", "preventExtensions", "seal"].includes(
          methodRecord.methodName,
        )))
  ) {
    return firstArgument;
  }
  return undefined;
}

function directlyIdentityAliasedBindingNames(
  expression,
  sourceCode,
  names = new Set(),
  visitedBindingVariables = new Set(),
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (unwrappedExpression === null || unwrappedExpression === undefined) {
    return names;
  }
  if (unwrappedExpression.type === "SemanticUndefinedValueExpression") {
    return names;
  }
  if (
    unwrappedExpression.type === "SemanticStaticPropertyValueExpression" ||
    unwrappedExpression.type === "SemanticObjectRestValueExpression" ||
    unwrappedExpression.type === "SemanticArrayRestValueExpression"
  ) {
    return names;
  }
  if (unwrappedExpression.type === "Identifier") {
    const bindingVariable = resolvedBindingVariableForIdentifier(
      sourceCode,
      unwrappedExpression,
    );
    const parameterValueExpressions =
      exposureTraversalContext.parameterValueExpressionsByBindingVariable.get(
        bindingVariable,
      );
    if (parameterValueExpressions !== undefined) {
      if (
        exposureTraversalContext.activeParameterValueBindingVariables.has(
          bindingVariable,
        )
      ) {
        return names;
      }
      exposureTraversalContext.activeParameterValueBindingVariables.add(
        bindingVariable,
      );
      for (const parameterValueExpression of parameterValueExpressions) {
        directlyIdentityAliasedBindingNames(
          parameterValueExpression,
          sourceCode,
          names,
          visitedBindingVariables,
          exposureTraversalContext,
        );
      }
      exposureTraversalContext.activeParameterValueBindingVariables.delete(
        bindingVariable,
      );
      return names;
    }
    if (bindingVariable?.scope.type === "module") {
      names.add(bindingVariable.name);
    } else if (
      bindingVariable !== undefined &&
      !visitedBindingVariables.has(bindingVariable)
    ) {
      visitedBindingVariables.add(bindingVariable);
      for (const assignedValueExpression of assignedValueExpressionsForBindingVariable(
        bindingVariable,
        sourceCode,
        unwrappedExpression,
      )) {
        directlyIdentityAliasedBindingNames(
          assignedValueExpression,
          sourceCode,
          names,
          visitedBindingVariables,
          exposureTraversalContext,
        );
      }
    }
    return names;
  }
  if (unwrappedExpression.type === "CallExpression") {
    return directlyIdentityAliasedBindingNames(
      identityPreservingCallTargetExpression(unwrappedExpression, sourceCode),
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "ConditionalExpression") {
    directlyIdentityAliasedBindingNames(
      unwrappedExpression.consequent,
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
    directlyIdentityAliasedBindingNames(
      unwrappedExpression.alternate,
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
    return names;
  }
  if (unwrappedExpression.type === "LogicalExpression") {
    directlyIdentityAliasedBindingNames(
      unwrappedExpression.left,
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
    directlyIdentityAliasedBindingNames(
      unwrappedExpression.right,
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
    return names;
  }
  if (unwrappedExpression.type === "SequenceExpression") {
    return directlyIdentityAliasedBindingNames(
      unwrappedExpression.expressions.at(-1),
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "AssignmentExpression") {
    return directlyIdentityAliasedBindingNames(
      unwrappedExpression.right,
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
  }
  if (
    unwrappedExpression.type === "AwaitExpression" ||
    unwrappedExpression.type === "YieldExpression"
  ) {
    return directlyIdentityAliasedBindingNames(
      unwrappedExpression.argument,
      sourceCode,
      names,
      visitedBindingVariables,
      exposureTraversalContext,
    );
  }
  return names;
}

function visitAstSubtree(node, visitor, shouldVisitChildren = () => true) {
  if (node === null || node === undefined || typeof node !== "object") {
    return;
  }
  visitor(node);
  if (!shouldVisitChildren(node)) {
    return;
  }
  for (const [propertyName, propertyValue] of Object.entries(node)) {
    if (propertyName === "parent") {
      continue;
    }
    if (Array.isArray(propertyValue)) {
      for (const childNode of propertyValue) {
        if (childNode?.type !== undefined) {
          visitAstSubtree(childNode, visitor, shouldVisitChildren);
        }
      }
    } else if (propertyValue?.type !== undefined) {
      visitAstSubtree(propertyValue, visitor, shouldVisitChildren);
    }
  }
}

function thisFieldRecord(expression) {
  const memberExpression = unwrapTransparentAstExpression(expression);
  if (
    memberExpression?.type !== "MemberExpression" ||
    unwrapTransparentAstExpression(memberExpression.object)?.type !==
      "ThisExpression"
  ) {
    return undefined;
  }
  if (memberExpression.property.type === "PrivateIdentifier") {
    return { isPrivate: true, name: memberExpression.property.name };
  }
  const fieldName = staticMemberPropertyName(memberExpression);
  return fieldName === undefined
    ? undefined
    : { isPrivate: false, name: fieldName };
}

function classExecutableBodyNodes(classNode) {
  return classNode.body.body.flatMap((classElement) => {
    if (classElement.type === "MethodDefinition") {
      return [classElement.value.body];
    }
    if (classElement.type === "StaticBlock") {
      return [classElement];
    }
    return [];
  });
}

function visitClassThisFieldAssignments(classNode, visitor) {
  for (const executableBodyNode of classExecutableBodyNodes(classNode)) {
    visitAstSubtree(
      executableBodyNode,
      (node) => {
        if (
          node.type === "AssignmentExpression" &&
          ["=", "&&=", "??=", "||="].includes(node.operator)
        ) {
          const fieldRecord = thisFieldRecord(node.left);
          if (fieldRecord !== undefined) {
            visitor(fieldRecord, node.right);
          }
        }
      },
      (node) =>
        ![
          "ClassDeclaration",
          "ClassExpression",
          "FunctionDeclaration",
          "FunctionExpression",
        ].includes(node.type),
    );
  }
}

function addNames(targetNames, sourceNames) {
  let wasChanged = false;
  for (const sourceName of sourceNames) {
    if (!targetNames.has(sourceName)) {
      targetNames.add(sourceName);
      wasChanged = true;
    }
  }
  return wasChanged;
}

function createExposureTraversalContext(
  parameterValueExpressionsByBindingVariable = new Map(),
) {
  return {
    activeCallableNodes: new Set(),
    activeCallResultBindingVariables: new Set(),
    activeParameterValueBindingVariables: new Set(),
    activePrivateCallableNodes: new Set(),
    activeValueBindingVariables: new Set(),
    parameterValueExpressionsByBindingVariable,
  };
}

function resolvedLocalValueExpressions(
  expression,
  sourceCode,
  exposureTraversalContext,
  activeBindingVariables = new Set(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (unwrappedExpression === null || unwrappedExpression === undefined) {
    return [];
  }
  if (unwrappedExpression.type === "Identifier") {
    const bindingVariable = resolvedBindingVariableForIdentifier(
      sourceCode,
      unwrappedExpression,
    );
    if (
      bindingVariable === undefined ||
      activeBindingVariables.has(bindingVariable)
    ) {
      return [unwrappedExpression];
    }
    if (
      bindingVariable.defs.some(
        (bindingDefinition) => bindingDefinition.type === "ImportBinding",
      )
    ) {
      return [unwrappedExpression];
    }
    const parameterValueExpressions =
      exposureTraversalContext.parameterValueExpressionsByBindingVariable.get(
        bindingVariable,
      );
    const assignedValueExpressions =
      parameterValueExpressions ??
      assignedValueExpressionsForBindingVariable(
        bindingVariable,
        sourceCode,
        unwrappedExpression,
      );
    if (assignedValueExpressions.length === 0) {
      return [unwrappedExpression];
    }
    activeBindingVariables.add(bindingVariable);
    const resolvedValueExpressions = assignedValueExpressions.flatMap(
      (assignedValueExpression) =>
        resolvedLocalValueExpressions(
          assignedValueExpression,
          sourceCode,
          exposureTraversalContext,
          activeBindingVariables,
        ),
    );
    activeBindingVariables.delete(bindingVariable);
    return resolvedValueExpressions;
  }
  if (unwrappedExpression.type === "MemberExpression") {
    const propertyName = staticMemberPropertyName(unwrappedExpression);
    if (propertyName === undefined) {
      return [unwrappedExpression];
    }
    return resolvedLocalValueExpressions(
      unwrappedExpression.object,
      sourceCode,
      exposureTraversalContext,
      activeBindingVariables,
    ).flatMap((objectValueExpression) =>
      staticPropertyValueExpressions(
        objectValueExpression,
        propertyName,
        sourceCode,
      ),
    );
  }
  return [unwrappedExpression];
}

function bindingVariableDeclaredByIdentifier(
  sourceCode,
  declarationNode,
  bindingIdentifier,
) {
  return sourceCode
    .getDeclaredVariables(declarationNode)
    .find((bindingVariable) =>
      bindingVariable.identifiers.includes(bindingIdentifier),
    );
}

function parameterValueExpressionsForCallableInvocation(
  callExpression,
  callableNode,
  sourceCode,
  inheritedParameterValues,
) {
  const parameterValues = new Map(inheritedParameterValues);
  for (const [
    parameterIndex,
    parameterPattern,
  ] of callableNode.params.entries()) {
    const parameterValueExpressions =
      parameterPattern.type === "RestElement"
        ? [
            createSemanticArrayValueExpression(
              callExpression.arguments
                .slice(parameterIndex)
                .map((callArgument) =>
                  callArgument.type === "SpreadElement"
                    ? callArgument.argument
                    : callArgument,
                ),
            ),
          ]
        : [
            callExpression.arguments[parameterIndex]?.type === "SpreadElement"
              ? callExpression.arguments[parameterIndex].argument
              : (callExpression.arguments[parameterIndex] ??
                SEMANTIC_UNDEFINED_VALUE_EXPRESSION),
          ];
    for (const parameterIdentifier of boundIdentifierNodes(parameterPattern)) {
      const parameterBindingVariable = bindingVariableDeclaredByIdentifier(
        sourceCode,
        callableNode,
        parameterIdentifier,
      );
      if (parameterBindingVariable !== undefined) {
        parameterValues.set(
          parameterBindingVariable,
          projectedValueExpressionsForBindingIdentifier(
            parameterPattern,
            parameterValueExpressions,
            parameterIdentifier,
            sourceCode,
          ),
        );
      }
    }
  }
  return parameterValues;
}

function emptyPrivateClassMemberDependencies() {
  return {
    callableNodesByName: new Map(),
    callResultDependenciesByName: new Map(),
    readDependenciesByName: new Map(),
    setterCallableNodesByName: new Map(),
  };
}

function classPrivateMemberDependencies(classNode, sourceCode) {
  const privateMemberDependencies = emptyPrivateClassMemberDependencies();
  for (const classElement of classNode.body.body) {
    if (classElement.key?.type !== "PrivateIdentifier") {
      continue;
    }
    if (classElement.type === "PropertyDefinition") {
      privateMemberDependencies.readDependenciesByName.set(
        classElement.key.name,
        new Set(),
      );
    } else if (
      classElement.type === "MethodDefinition" &&
      classElement.kind === "method"
    ) {
      privateMemberDependencies.callableNodesByName.set(classElement.key.name, [
        classElement.value,
      ]);
      privateMemberDependencies.callResultDependenciesByName.set(
        classElement.key.name,
        new Set(),
      );
    } else if (
      classElement.type === "MethodDefinition" &&
      classElement.kind === "get"
    ) {
      privateMemberDependencies.readDependenciesByName.set(
        classElement.key.name,
        new Set(),
      );
    } else if (
      classElement.type === "MethodDefinition" &&
      classElement.kind === "set"
    ) {
      privateMemberDependencies.setterCallableNodesByName.set(
        classElement.key.name,
        [classElement.value],
      );
    }
  }

  let dependenciesChanged;
  do {
    dependenciesChanged = false;
    for (const classElement of classNode.body.body) {
      if (
        classElement.key?.type !== "PrivateIdentifier" ||
        (classElement.type !== "PropertyDefinition" &&
          classElement.type !== "MethodDefinition")
      ) {
        continue;
      }
      const memberDependencies =
        classElement.type === "PropertyDefinition"
          ? privateMemberDependencies.readDependenciesByName.get(
              classElement.key.name,
            )
          : classElement.kind === "method"
            ? privateMemberDependencies.callResultDependenciesByName.get(
                classElement.key.name,
              )
            : classElement.kind === "get"
              ? privateMemberDependencies.readDependenciesByName.get(
                  classElement.key.name,
                )
              : undefined;
      if (memberDependencies === undefined) {
        continue;
      }
      const directlyExposedDependencies =
        classElement.type === "PropertyDefinition"
          ? directlyExposedBindingNames(
              classElement.value,
              sourceCode,
              new Set(),
              privateMemberDependencies,
            )
          : directlyReturnedBindingNames(
              classElement.value,
              sourceCode,
              new Set(),
              privateMemberDependencies,
            );
      dependenciesChanged ||= addNames(
        memberDependencies,
        directlyExposedDependencies,
      );
    }
    visitClassThisFieldAssignments(classNode, (fieldRecord, assignedValue) => {
      if (!fieldRecord.isPrivate) {
        return;
      }
      const privateFieldDependencies =
        privateMemberDependencies.readDependenciesByName.get(
          fieldRecord.name,
        ) ?? new Set();
      privateMemberDependencies.readDependenciesByName.set(
        fieldRecord.name,
        privateFieldDependencies,
      );
      dependenciesChanged ||= addNames(
        privateFieldDependencies,
        directlyExposedBindingNames(
          assignedValue,
          sourceCode,
          new Set(),
          privateMemberDependencies,
        ),
      );
    });
  } while (dependenciesChanged);

  return privateMemberDependencies;
}

function directlyObservableCallablePublicEffectBindingNames(
  callableNode,
  sourceCode,
  names,
  privateClassMemberDependenciesByName,
  exposureTraversalContext,
) {
  if (exposureTraversalContext.activePrivateCallableNodes.has(callableNode)) {
    return names;
  }
  exposureTraversalContext.activePrivateCallableNodes.add(callableNode);
  visitAstSubtree(
    callableNode.body,
    (node) => {
      if (node.type === "AssignmentExpression") {
        const assignedFieldRecord = thisFieldRecord(node.left);
        if (
          assignedFieldRecord !== undefined &&
          !assignedFieldRecord.isPrivate
        ) {
          directlyExposedBindingNames(
            node.right,
            sourceCode,
            names,
            privateClassMemberDependenciesByName,
            exposureTraversalContext,
          );
        } else if (assignedFieldRecord?.isPrivate) {
          for (const setterCallableNode of privateClassMemberDependenciesByName.setterCallableNodesByName.get(
            assignedFieldRecord.name,
          ) ?? []) {
            const setterParameterValues =
              parameterValueExpressionsForCallableInvocation(
                {
                  arguments: [node.right],
                  callee: node.left,
                  type: "CallExpression",
                },
                setterCallableNode,
                sourceCode,
                exposureTraversalContext.parameterValueExpressionsByBindingVariable,
              );
            directlyObservableCallablePublicEffectBindingNames(
              setterCallableNode,
              sourceCode,
              names,
              privateClassMemberDependenciesByName,
              {
                ...exposureTraversalContext,
                parameterValueExpressionsByBindingVariable:
                  setterParameterValues,
              },
            );
          }
        }
      }
      if (node.type !== "CallExpression") {
        return;
      }
      const privateCalleeFieldRecord = thisFieldRecord(node.callee);
      if (!privateCalleeFieldRecord?.isPrivate) {
        return;
      }
      for (const privateCallableNode of privateClassMemberDependenciesByName.callableNodesByName.get(
        privateCalleeFieldRecord.name,
      ) ?? []) {
        const privateCallParameterValues =
          parameterValueExpressionsForCallableInvocation(
            node,
            privateCallableNode,
            sourceCode,
            exposureTraversalContext.parameterValueExpressionsByBindingVariable,
          );
        directlyObservableCallablePublicEffectBindingNames(
          privateCallableNode,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          {
            ...exposureTraversalContext,
            parameterValueExpressionsByBindingVariable:
              privateCallParameterValues,
          },
        );
      }
    },
    (node) =>
      node === callableNode.body ||
      ![
        "ArrowFunctionExpression",
        "ClassDeclaration",
        "ClassExpression",
        "FunctionDeclaration",
        "FunctionExpression",
      ].includes(node.type),
  );
  exposureTraversalContext.activePrivateCallableNodes.delete(callableNode);
  return names;
}

function directlyExposedPrivateCallableInvocationBindingNames(
  privateMemberName,
  callExpression,
  sourceCode,
  names,
  privateClassMemberDependenciesByName,
  exposureTraversalContext,
) {
  for (const privateCallableNode of privateClassMemberDependenciesByName.callableNodesByName.get(
    privateMemberName,
  ) ?? []) {
    const privateCallParameterValues =
      parameterValueExpressionsForCallableInvocation(
        callExpression,
        privateCallableNode,
        sourceCode,
        exposureTraversalContext.parameterValueExpressionsByBindingVariable,
      );
    const privateCallContext = {
      ...exposureTraversalContext,
      parameterValueExpressionsByBindingVariable: privateCallParameterValues,
    };
    directlyReturnedBindingNames(
      privateCallableNode,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      privateCallContext,
    );
    directlyObservableCallablePublicEffectBindingNames(
      privateCallableNode,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      privateCallContext,
    );
  }
  return names;
}

function directlyExposedClassBindingNames(
  classNode,
  sourceCode,
  names,
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const privateMemberDependenciesByName = classPrivateMemberDependencies(
    classNode,
    sourceCode,
  );
  directlyExposedBindingNames(
    classNode.superClass,
    sourceCode,
    names,
    privateMemberDependenciesByName,
    exposureTraversalContext,
  );
  for (const classElement of classNode.body.body) {
    const hasPublicKey = classElement.key?.type !== "PrivateIdentifier";
    if (
      classElement.type === "MethodDefinition" &&
      hasPublicKey &&
      classElement.kind !== "set"
    ) {
      directlyReturnedBindingNames(
        classElement.value,
        sourceCode,
        names,
        privateMemberDependenciesByName,
        exposureTraversalContext,
      );
      directlyObservableCallablePublicEffectBindingNames(
        classElement.value,
        sourceCode,
        names,
        privateMemberDependenciesByName,
        exposureTraversalContext,
      );
    } else if (
      classElement.type === "PropertyDefinition" &&
      hasPublicKey &&
      classElement.value !== null
    ) {
      directlyExposedBindingNames(
        classElement.value,
        sourceCode,
        names,
        privateMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
  }
  visitClassThisFieldAssignments(classNode, (fieldRecord, assignedValue) => {
    if (!fieldRecord.isPrivate) {
      directlyExposedBindingNames(
        assignedValue,
        sourceCode,
        names,
        privateMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
  });
  return names;
}

function directlyExposedLocalCallResultBindingNames(
  callee,
  callExpression,
  sourceCode,
  names,
  privateClassMemberDependenciesByName,
  exposureTraversalContext,
) {
  const unwrappedCallee = unwrapTransparentAstExpression(callee);
  const calleeBindingVariable =
    unwrappedCallee?.type === "Identifier"
      ? resolvedBindingVariableForIdentifier(sourceCode, unwrappedCallee)
      : undefined;
  if (
    calleeBindingVariable?.defs.some(
      (bindingDefinition) =>
        bindingDefinition.type === "ImportBinding" &&
        bindingDefinition.node.type !== "ImportDefaultSpecifier",
    )
  ) {
    for (const callArgument of callExpression.arguments) {
      directlyExposedBindingNames(
        callArgument.type === "SpreadElement"
          ? callArgument.argument
          : callArgument,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    return names;
  }
  for (const callableNode of localCallableNodesForExpression(
    unwrappedCallee,
    sourceCode,
    exposureTraversalContext,
  )) {
    if (exposureTraversalContext.activeCallableNodes.has(callableNode)) {
      continue;
    }
    exposureTraversalContext.activeCallableNodes.add(callableNode);
    const parameterValueExpressionsByBindingVariable =
      parameterValueExpressionsForCallableInvocation(
        callExpression,
        callableNode,
        sourceCode,
        exposureTraversalContext.parameterValueExpressionsByBindingVariable,
      );
    directlyReturnedBindingNames(
      callableNode,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      {
        ...exposureTraversalContext,
        parameterValueExpressionsByBindingVariable,
      },
    );
    exposureTraversalContext.activeCallableNodes.delete(callableNode);
  }
  return names;
}

function effectiveLocalCallableInvocation(callExpression, calleeMember) {
  if (calleeMember?.propertyName === "call") {
    return {
      callExpression: {
        arguments: callExpression.arguments.slice(1),
        callee: calleeMember.object,
        type: "CallExpression",
      },
      callee: calleeMember.object,
    };
  }
  if (calleeMember?.propertyName === "apply") {
    const appliedArgumentsExpression = unwrapTransparentAstExpression(
      callExpression.arguments[1],
    );
    const appliedArguments =
      appliedArgumentsExpression?.type === "ArrayExpression"
        ? appliedArgumentsExpression.elements
            .filter((element) => element !== null)
            .map((element) =>
              element.type === "SpreadElement" ? element.argument : element,
            )
        : appliedArgumentsExpression === undefined
          ? []
          : [appliedArgumentsExpression];
    return {
      callExpression: {
        arguments: appliedArguments,
        callee: calleeMember.object,
        type: "CallExpression",
      },
      callee: calleeMember.object,
    };
  }
  return { callExpression, callee: callExpression.callee };
}

function visitLocalCallableInvocationEffects(
  callExpression,
  sourceCode,
  inheritedExposureTraversalContext,
  effectVisitor,
  activeCallableNodes = new Set(),
) {
  const effectiveInvocation = effectiveLocalCallableInvocation(
    callExpression,
    memberExpressionRecord(callExpression.callee),
  );
  for (const callableNode of localCallableNodesForExpression(
    effectiveInvocation.callee,
    sourceCode,
    inheritedExposureTraversalContext,
  )) {
    if (activeCallableNodes.has(callableNode)) {
      continue;
    }
    activeCallableNodes.add(callableNode);
    const invocationContext = {
      ...inheritedExposureTraversalContext,
      parameterValueExpressionsByBindingVariable:
        parameterValueExpressionsForCallableInvocation(
          effectiveInvocation.callExpression,
          callableNode,
          sourceCode,
          inheritedExposureTraversalContext.parameterValueExpressionsByBindingVariable,
        ),
    };
    visitAstSubtree(
      callableNode.body,
      (node) => {
        effectVisitor(node, invocationContext);
        if (node.type === "CallExpression") {
          visitLocalCallableInvocationEffects(
            node,
            sourceCode,
            invocationContext,
            effectVisitor,
            activeCallableNodes,
          );
        }
      },
      (node) =>
        node === callableNode.body ||
        ![
          "ArrowFunctionExpression",
          "ClassDeclaration",
          "ClassExpression",
          "FunctionDeclaration",
          "FunctionExpression",
        ].includes(node.type),
    );
    activeCallableNodes.delete(callableNode);
  }
}

function directlyExposedBindingNames(
  expression,
  sourceCode,
  names = new Set(),
  privateClassMemberDependenciesByName = emptyPrivateClassMemberDependencies(),
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  if (unwrappedExpression === null || unwrappedExpression === undefined) {
    return names;
  }
  if (unwrappedExpression.type === "SemanticUndefinedValueExpression") {
    return names;
  }
  if (
    unwrappedExpression.type === "SemanticStaticPropertyValueExpression" ||
    unwrappedExpression.type === "SemanticObjectRestValueExpression"
  ) {
    return directlyExposedBindingNames(
      unwrappedExpression.objectExpression,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "SemanticArrayRestValueExpression") {
    return directlyExposedBindingNames(
      unwrappedExpression.arrayExpression,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "Identifier") {
    const bindingVariable = resolvedBindingVariableForIdentifier(
      sourceCode,
      unwrappedExpression,
    );
    if (bindingVariable?.scope.type === "module") {
      names.add(bindingVariable.name);
      if (
        !bindingVariable.defs.some(
          (bindingDefinition) => bindingDefinition.type === "ImportBinding",
        ) &&
        !exposureTraversalContext.activeValueBindingVariables.has(
          bindingVariable,
        )
      ) {
        exposureTraversalContext.activeValueBindingVariables.add(
          bindingVariable,
        );
        for (const assignedValueExpression of assignedValueExpressionsForBindingVariable(
          bindingVariable,
          sourceCode,
          unwrappedExpression,
        )) {
          directlyExposedBindingNames(
            assignedValueExpression,
            sourceCode,
            names,
            privateClassMemberDependenciesByName,
            exposureTraversalContext,
          );
        }
        exposureTraversalContext.activeValueBindingVariables.delete(
          bindingVariable,
        );
      }
      return names;
    }
    const parameterValueExpressions =
      exposureTraversalContext.parameterValueExpressionsByBindingVariable.get(
        bindingVariable,
      );
    if (parameterValueExpressions !== undefined) {
      if (
        exposureTraversalContext.activeParameterValueBindingVariables.has(
          bindingVariable,
        )
      ) {
        return names;
      }
      exposureTraversalContext.activeParameterValueBindingVariables.add(
        bindingVariable,
      );
      for (const parameterValueExpression of parameterValueExpressions) {
        directlyExposedBindingNames(
          parameterValueExpression,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
      }
      exposureTraversalContext.activeParameterValueBindingVariables.delete(
        bindingVariable,
      );
      return names;
    }
    if (
      bindingVariable === undefined ||
      exposureTraversalContext.activeValueBindingVariables.has(bindingVariable)
    ) {
      return names;
    }
    exposureTraversalContext.activeValueBindingVariables.add(bindingVariable);
    for (const assignedValueExpression of assignedValueExpressionsForBindingVariable(
      bindingVariable,
      sourceCode,
      unwrappedExpression,
    )) {
      directlyExposedBindingNames(
        assignedValueExpression,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    exposureTraversalContext.activeValueBindingVariables.delete(
      bindingVariable,
    );
    return names;
  }
  if (unwrappedExpression.type === "MemberExpression") {
    const fieldRecord = thisFieldRecord(unwrappedExpression);
    if (fieldRecord?.isPrivate) {
      addNames(
        names,
        privateClassMemberDependenciesByName.readDependenciesByName.get(
          fieldRecord.name,
        ) ?? [],
      );
      addNames(
        names,
        privateClassMemberDependenciesByName.callResultDependenciesByName.get(
          fieldRecord.name,
        ) ?? [],
      );
      return names;
    }
    const propertyName = staticMemberPropertyName(unwrappedExpression);
    if (propertyName !== undefined) {
      for (const memberValueExpression of resolvedLocalValueExpressions(
        unwrappedExpression,
        sourceCode,
        exposureTraversalContext,
      )) {
        directlyExposedBindingNames(
          memberValueExpression,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
      }
      return names;
    }
    return directlyExposedBindingNames(
      unwrappedExpression.object,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (
    unwrappedExpression.type === "ArrowFunctionExpression" ||
    unwrappedExpression.type === "FunctionExpression"
  ) {
    return directlyReturnedBindingNames(
      unwrappedExpression,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "ClassExpression") {
    return directlyExposedClassBindingNames(
      unwrappedExpression,
      sourceCode,
      names,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "NewExpression") {
    for (const constructorArgument of unwrappedExpression.arguments) {
      directlyExposedBindingNames(
        constructorArgument.type === "SpreadElement"
          ? constructorArgument.argument
          : constructorArgument,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    return names;
  }
  if (unwrappedExpression.type === "CallExpression") {
    const calleeMember = memberExpressionRecord(unwrappedExpression.callee);
    const privateCalleeFieldRecord = thisFieldRecord(
      unwrapTransparentAstExpression(unwrappedExpression.callee),
    );
    if (privateCalleeFieldRecord?.isPrivate) {
      addNames(
        names,
        privateClassMemberDependenciesByName.callResultDependenciesByName.get(
          privateCalleeFieldRecord.name,
        ) ?? [],
      );
      directlyExposedPrivateCallableInvocationBindingNames(
        privateCalleeFieldRecord.name,
        unwrappedExpression,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
      return names;
    }
    const staticMethodKeys = globalStaticMethodKeysForCallee(
      unwrappedExpression.callee,
      new Map(),
      new Map(),
      sourceCode,
    );
    let exposedArguments = [];
    if (calleeMember?.propertyName === "bind") {
      directlyExposedBindingNames(
        calleeMember.object,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
      exposedArguments = unwrappedExpression.arguments;
    } else if (
      [
        "Object.assign",
        "Object.create",
        "Object.defineProperties",
        "Object.defineProperty",
        "Object.freeze",
        "Object.preventExtensions",
        "Object.seal",
        "Object.setPrototypeOf",
        "Promise.all",
        "Promise.allSettled",
        "Promise.any",
        "Promise.race",
        "Promise.reject",
        "Promise.resolve",
      ].some((recognizedStaticMethodKey) =>
        staticMethodKeys.has(recognizedStaticMethodKey),
      )
    ) {
      exposedArguments = unwrappedExpression.arguments;
    } else {
      const effectiveInvocation = effectiveLocalCallableInvocation(
        unwrappedExpression,
        calleeMember,
      );
      directlyExposedLocalCallResultBindingNames(
        effectiveInvocation.callee,
        effectiveInvocation.callExpression,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    for (const callArgument of exposedArguments) {
      directlyExposedBindingNames(
        callArgument.type === "SpreadElement"
          ? callArgument.argument
          : callArgument,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    return names;
  }
  if (unwrappedExpression.type === "ObjectExpression") {
    for (const property of unwrappedExpression.properties) {
      if (property.type === "SpreadElement") {
        directlyExposedBindingNames(
          property.argument,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
      } else if (property.kind !== "set") {
        directlyExposedBindingNames(
          property.value,
          sourceCode,
          names,
          privateClassMemberDependenciesByName,
          exposureTraversalContext,
        );
      }
    }
    return names;
  }
  if (
    unwrappedExpression.type === "ArrayExpression" ||
    unwrappedExpression.type === "SemanticArrayValueExpression"
  ) {
    for (const element of unwrappedExpression.elements) {
      directlyExposedBindingNames(
        element?.type === "SpreadElement" ? element.argument : element,
        sourceCode,
        names,
        privateClassMemberDependenciesByName,
        exposureTraversalContext,
      );
    }
    return names;
  }
  if (unwrappedExpression.type === "ConditionalExpression") {
    directlyExposedBindingNames(
      unwrappedExpression.consequent,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    directlyExposedBindingNames(
      unwrappedExpression.alternate,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    return names;
  }
  if (unwrappedExpression.type === "LogicalExpression") {
    directlyExposedBindingNames(
      unwrappedExpression.left,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    directlyExposedBindingNames(
      unwrappedExpression.right,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
    return names;
  }
  if (unwrappedExpression.type === "SequenceExpression") {
    return directlyExposedBindingNames(
      unwrappedExpression.expressions.at(-1),
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (unwrappedExpression.type === "AssignmentExpression") {
    return directlyExposedBindingNames(
      unwrappedExpression.right,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  if (
    unwrappedExpression.type === "AwaitExpression" ||
    unwrappedExpression.type === "YieldExpression"
  ) {
    return directlyExposedBindingNames(
      unwrappedExpression.argument,
      sourceCode,
      names,
      privateClassMemberDependenciesByName,
      exposureTraversalContext,
    );
  }
  return names;
}

function addBindingDependencies(
  bindingDependenciesByName,
  bindingName,
  dependencyBindingNames,
) {
  const dependencies = bindingDependenciesByName.get(bindingName) ?? new Set();
  for (const dependencyBindingName of dependencyBindingNames) {
    if (dependencyBindingName !== bindingName) {
      dependencies.add(dependencyBindingName);
    }
  }
  bindingDependenciesByName.set(bindingName, dependencies);
}

function topLevelBindingDependencies(programNode, sourceCode) {
  const bindingDependenciesByName = new Map();
  for (const statement of programNode.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type === "VariableDeclaration") {
      for (const variableDeclarator of declaration.declarations) {
        for (const bindingIdentifier of boundIdentifierNodes(
          variableDeclarator.id,
        )) {
          const dependencyBindingNames = new Set();
          for (const projectedValueExpression of projectedValueExpressionsForBindingIdentifier(
            variableDeclarator.id,
            variableDeclarator.init === null ? [] : [variableDeclarator.init],
            bindingIdentifier,
            sourceCode,
          )) {
            directlyExposedBindingNames(
              projectedValueExpression,
              sourceCode,
              dependencyBindingNames,
            );
          }
          addBindingDependencies(
            bindingDependenciesByName,
            bindingIdentifier.name,
            dependencyBindingNames,
          );
        }
      }
    } else if (
      declaration?.type === "FunctionDeclaration" &&
      declaration.id !== null
    ) {
      addBindingDependencies(
        bindingDependenciesByName,
        declaration.id.name,
        directlyReturnedBindingNames(declaration, sourceCode, new Set()),
      );
    } else if (
      declaration?.type === "ClassDeclaration" &&
      declaration.id !== null
    ) {
      addBindingDependencies(
        bindingDependenciesByName,
        declaration.id.name,
        directlyExposedClassBindingNames(declaration, sourceCode, new Set()),
      );
    }
  }
  return bindingDependenciesByName;
}

function addModuleScopedAssignmentDependencies(
  bindingDependenciesByName,
  assignmentExpression,
  sourceCode,
  exportedBindingNames,
) {
  if (!["=", "&&=", "??=", "||="].includes(assignmentExpression.operator)) {
    return;
  }
  for (const assignedIdentifier of boundIdentifierNodes(
    assignmentExpression.left,
  )) {
    const assignedModuleBindingName = moduleScopedBindingNameForIdentifier(
      sourceCode,
      assignedIdentifier,
    );
    if (
      assignedModuleBindingName !== undefined &&
      exportedBindingNames.has(assignedModuleBindingName)
    ) {
      const dependencyBindingNames = new Set();
      for (const projectedValueExpression of projectedValueExpressionsForBindingIdentifier(
        assignmentExpression.left,
        [assignmentExpression.right],
        assignedIdentifier,
        sourceCode,
      )) {
        directlyExposedBindingNames(
          projectedValueExpression,
          sourceCode,
          dependencyBindingNames,
        );
      }
      addBindingDependencies(
        bindingDependenciesByName,
        assignedModuleBindingName,
        dependencyBindingNames,
      );
    }
  }
  const assignmentTarget = unwrapTransparentAstExpression(
    assignmentExpression.left,
  );
  if (assignmentTarget?.type === "MemberExpression") {
    const dependencyBindingNames = directlyExposedBindingNames(
      assignmentExpression.right,
      sourceCode,
    );
    for (const mutatedModuleBindingName of directlyExposedBindingNames(
      assignmentTarget.object,
      sourceCode,
    )) {
      addBindingDependencies(
        bindingDependenciesByName,
        mutatedModuleBindingName,
        dependencyBindingNames,
      );
    }
  }
}

function topLevelIdentityAliasDependencies(programNode, sourceCode) {
  const identityDependenciesByBindingName = new Map();
  for (const statement of programNode.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type !== "VariableDeclaration") {
      continue;
    }
    for (const variableDeclarator of declaration.declarations) {
      for (const bindingIdentifier of boundIdentifierNodes(
        variableDeclarator.id,
      )) {
        const identityDependencyBindingNames = new Set();
        for (const projectedValueExpression of projectedValueExpressionsForBindingIdentifier(
          variableDeclarator.id,
          variableDeclarator.init === null ? [] : [variableDeclarator.init],
          bindingIdentifier,
          sourceCode,
        )) {
          directlyIdentityAliasedBindingNames(
            projectedValueExpression,
            sourceCode,
            identityDependencyBindingNames,
          );
        }
        addBindingDependencies(
          identityDependenciesByBindingName,
          bindingIdentifier.name,
          identityDependencyBindingNames,
        );
      }
    }
  }
  return identityDependenciesByBindingName;
}

function topLevelPublicObjectAliasDependencies(programNode, sourceCode) {
  const publicObjectAliasDependenciesByBindingName =
    topLevelIdentityAliasDependencies(programNode, sourceCode);
  for (const statement of programNode.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type !== "VariableDeclaration") {
      continue;
    }
    for (const variableDeclarator of declaration.declarations) {
      if (variableDeclarator.id.type !== "Identifier") {
        continue;
      }
      const initializer = unwrapTransparentAstExpression(
        variableDeclarator.init,
      );
      if (initializer?.type !== "MemberExpression") {
        continue;
      }
      addBindingDependencies(
        publicObjectAliasDependenciesByBindingName,
        variableDeclarator.id.name,
        directlyIdentityAliasedBindingNames(initializer.object, sourceCode),
      );
    }
  }
  return publicObjectAliasDependenciesByBindingName;
}

function addModuleScopedIdentityAssignmentDependencies(
  identityDependenciesByBindingName,
  assignmentExpression,
  sourceCode,
) {
  const assignmentTarget = unwrapTransparentAstExpression(
    assignmentExpression.left,
  );
  if (
    !["=", "&&=", "??=", "||="].includes(assignmentExpression.operator) ||
    assignmentTarget?.type !== "Identifier"
  ) {
    return;
  }
  const assignedModuleBindingName = moduleScopedBindingNameForIdentifier(
    sourceCode,
    assignmentTarget,
  );
  if (assignedModuleBindingName !== undefined) {
    addBindingDependencies(
      identityDependenciesByBindingName,
      assignedModuleBindingName,
      directlyIdentityAliasedBindingNames(
        assignmentExpression.right,
        sourceCode,
      ),
    );
  }
}

function globalStaticMethodKey(methodRecord) {
  return methodRecord?.methodName === undefined
    ? undefined
    : `${methodRecord.globalObjectName}.${methodRecord.methodName}`;
}

function addGlobalStaticMethodBinding(
  globalStaticMethodKeysByBindingName,
  bindingName,
  globalStaticMethodKeyValue,
) {
  if (globalStaticMethodKeyValue === undefined) {
    return;
  }
  const methodKeys =
    globalStaticMethodKeysByBindingName.get(bindingName) ?? new Set();
  methodKeys.add(globalStaticMethodKeyValue);
  globalStaticMethodKeysByBindingName.set(bindingName, methodKeys);
}

function addGlobalStaticMethodBindingsFromVariableDeclarator(
  globalStaticMethodKeysByBindingName,
  variableDeclarator,
  sourceCode,
) {
  if (variableDeclarator.id.type === "Identifier") {
    addGlobalStaticMethodBinding(
      globalStaticMethodKeysByBindingName,
      variableDeclarator.id.name,
      globalStaticMethodKey(
        unshadowedGlobalStaticMethodRecord(variableDeclarator.init, sourceCode),
      ),
    );
    return;
  }
  const initializer = unwrapTransparentAstExpression(variableDeclarator.init);
  if (
    variableDeclarator.id.type !== "ObjectPattern" ||
    initializer?.type !== "Identifier" ||
    !identifierReferencesUnshadowedBinding(
      sourceCode,
      initializer,
      initializer.name,
    )
  ) {
    return;
  }
  for (const property of variableDeclarator.id.properties) {
    if (property.type !== "Property") {
      continue;
    }
    const methodName = staticModuleExportName(property.key);
    if (methodName === undefined) {
      continue;
    }
    for (const bindingName of boundIdentifierNames(property.value)) {
      addGlobalStaticMethodBinding(
        globalStaticMethodKeysByBindingName,
        bindingName,
        `${initializer.name}.${methodName}`,
      );
    }
  }
}

function globalStaticMethodBindings(
  programNode,
  assignmentExpressionNodes,
  sourceCode,
) {
  const globalStaticMethodKeysByBindingName = new Map();
  for (const statement of programNode.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type === "VariableDeclaration") {
      for (const variableDeclarator of declaration.declarations) {
        addGlobalStaticMethodBindingsFromVariableDeclarator(
          globalStaticMethodKeysByBindingName,
          variableDeclarator,
          sourceCode,
        );
      }
    }
  }
  for (const assignmentExpression of assignmentExpressionNodes) {
    const assignmentTarget = unwrapTransparentAstExpression(
      assignmentExpression.left,
    );
    if (
      assignmentExpression.operator !== "=" ||
      assignmentTarget?.type !== "Identifier"
    ) {
      continue;
    }
    const assignedModuleBindingName = moduleScopedBindingNameForIdentifier(
      sourceCode,
      assignmentTarget,
    );
    if (assignedModuleBindingName !== undefined) {
      addGlobalStaticMethodBinding(
        globalStaticMethodKeysByBindingName,
        assignedModuleBindingName,
        globalStaticMethodKey(
          unshadowedGlobalStaticMethodRecord(
            assignmentExpression.right,
            sourceCode,
          ),
        ),
      );
    }
  }
  return globalStaticMethodKeysByBindingName;
}

function destructuredGlobalStaticMethodKeysForBindingVariable(
  bindingVariable,
  sourceCode,
) {
  const methodKeys = new Set();
  for (const bindingDefinition of bindingVariable.defs) {
    const variableDeclarator = bindingDefinition.node;
    const initializer = unwrapTransparentAstExpression(
      variableDeclarator?.init,
    );
    if (
      bindingDefinition.type !== "Variable" ||
      variableDeclarator.id.type !== "ObjectPattern" ||
      initializer?.type !== "Identifier" ||
      !identifierReferencesUnshadowedBinding(
        sourceCode,
        initializer,
        initializer.name,
      )
    ) {
      continue;
    }
    for (const property of variableDeclarator.id.properties) {
      if (
        property.type !== "Property" ||
        !boundIdentifierNodes(property.value).some((bindingIdentifier) =>
          bindingVariable.identifiers.includes(bindingIdentifier),
        )
      ) {
        continue;
      }
      const methodName = staticModuleExportName(property.key);
      if (methodName !== undefined) {
        methodKeys.add(`${initializer.name}.${methodName}`);
      }
    }
  }
  return methodKeys;
}

function globalStaticMethodKeysForCallee(
  callee,
  identityDependenciesByBindingName,
  globalStaticMethodKeysByBindingName,
  sourceCode,
  visitedBindingVariables = new Set(),
) {
  const directMethodKey = globalStaticMethodKey(
    unshadowedGlobalStaticMethodRecord(callee, sourceCode),
  );
  if (directMethodKey !== undefined) {
    return new Set([directMethodKey]);
  }
  const calleeExpression = unwrapTransparentAstExpression(callee);
  if (calleeExpression?.type !== "Identifier") {
    return new Set();
  }
  const calleeBindingVariable = resolvedBindingVariableForIdentifier(
    sourceCode,
    calleeExpression,
  );
  if (
    calleeBindingVariable === undefined ||
    visitedBindingVariables.has(calleeBindingVariable)
  ) {
    return new Set();
  }
  visitedBindingVariables.add(calleeBindingVariable);
  const methodKeys = destructuredGlobalStaticMethodKeysForBindingVariable(
    calleeBindingVariable,
    sourceCode,
  );
  if (calleeBindingVariable.scope.type === "module") {
    for (const reachableBindingName of transitivelyReachableBindingNames(
      [calleeBindingVariable.name],
      identityDependenciesByBindingName,
    )) {
      addNames(
        methodKeys,
        globalStaticMethodKeysByBindingName.get(reachableBindingName) ?? [],
      );
    }
  }
  for (const assignedValueExpression of assignedValueExpressionsForBindingVariable(
    calleeBindingVariable,
    sourceCode,
    calleeExpression,
  )) {
    const assignedMethodKey = globalStaticMethodKey(
      unshadowedGlobalStaticMethodRecord(assignedValueExpression, sourceCode),
    );
    if (assignedMethodKey !== undefined) {
      methodKeys.add(assignedMethodKey);
    }
    addNames(
      methodKeys,
      globalStaticMethodKeysForCallee(
        assignedValueExpression,
        identityDependenciesByBindingName,
        globalStaticMethodKeysByBindingName,
        sourceCode,
        visitedBindingVariables,
      ),
    );
  }
  return methodKeys;
}

function publicMutationValueExpressions(methodKey, callExpression) {
  const argumentAt = (argumentIndex) => {
    const argument = callExpression.arguments[argumentIndex];
    return argument?.type === "SpreadElement" ? argument.argument : argument;
  };
  if (methodKey === "Object.assign") {
    return callExpression.arguments
      .slice(1)
      .map((argument) =>
        argument.type === "SpreadElement" ? argument.argument : argument,
      );
  }
  if (["Object.defineProperty", "Reflect.defineProperty"].includes(methodKey)) {
    return [argumentAt(2)];
  }
  if (methodKey === "Object.defineProperties") {
    return [argumentAt(1)];
  }
  if (methodKey === "Reflect.set") {
    return [argumentAt(2)];
  }
  if (["Object.setPrototypeOf", "Reflect.setPrototypeOf"].includes(methodKey)) {
    return [argumentAt(1)];
  }
  return [];
}

function objectExpressionHasCaseInsensitiveStaticPropertyName(
  expression,
  expectedPropertyName,
  sourceCode,
) {
  const objectExpression = unwrapTransparentAstExpression(expression);
  return (
    objectExpression?.type === "ObjectExpression" &&
    objectExpression.properties.some((property) => {
      if (property.type !== "Property") {
        return false;
      }
      const staticPropertyName = property.computed
        ? staticStringExpressionValue(property.key, sourceCode)
        : staticModuleExportName(property.key);
      return (
        staticPropertyName?.toLowerCase() === expectedPropertyName.toLowerCase()
      );
    })
  );
}

function callPublishesWebVowlOnBrowserGlobal(
  callExpression,
  staticMethodKeys,
  sourceCode,
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const publicationTarget = callExpression.arguments[0];
  if (
    publicationTarget === undefined ||
    publicationTarget.type === "SpreadElement" ||
    globalPublicationRootName(
      publicationTarget,
      sourceCode,
      new Set(),
      exposureTraversalContext,
    ) === undefined
  ) {
    return false;
  }
  const publishesNamedProperty = [
    "Object.defineProperty",
    "Reflect.defineProperty",
    "Reflect.set",
  ].some((methodKey) => staticMethodKeys.has(methodKey));
  if (
    publishesNamedProperty &&
    staticStringExpressionValue(
      callExpression.arguments[1],
      sourceCode,
    )?.toLowerCase() === "webvowl"
  ) {
    return true;
  }
  if (
    staticMethodKeys.has("Object.defineProperties") &&
    objectExpressionHasCaseInsensitiveStaticPropertyName(
      callExpression.arguments[1],
      "webvowl",
      sourceCode,
    )
  ) {
    return true;
  }
  if (!staticMethodKeys.has("Object.assign")) {
    return false;
  }
  return callExpression.arguments.slice(1).some((sourceArgument) => {
    const sourceExpression =
      sourceArgument.type === "SpreadElement"
        ? sourceArgument.argument
        : sourceArgument;
    return objectExpressionHasCaseInsensitiveStaticPropertyName(
      sourceExpression,
      "webvowl",
      sourceCode,
    );
  });
}

function identityEquivalentBindingNames(
  initialBindingNames,
  identityDependenciesByBindingName,
) {
  const equivalentBindingNames = new Set(initialBindingNames);
  let equivalenceChanged;
  do {
    equivalenceChanged = false;
    for (const [
      bindingName,
      dependencyBindingNames,
    ] of identityDependenciesByBindingName) {
      const relationTouchesKnownIdentity =
        equivalentBindingNames.has(bindingName) ||
        [...dependencyBindingNames].some((dependencyBindingName) =>
          equivalentBindingNames.has(dependencyBindingName),
        );
      if (!relationTouchesKnownIdentity) {
        continue;
      }
      if (!equivalentBindingNames.has(bindingName)) {
        equivalentBindingNames.add(bindingName);
        equivalenceChanged = true;
      }
      equivalenceChanged ||= addNames(
        equivalentBindingNames,
        dependencyBindingNames,
      );
    }
  } while (equivalenceChanged);
  return equivalentBindingNames;
}

function directlyRelatedPublicObjectBindingNames(
  expression,
  sourceCode,
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  return unwrappedExpression?.type === "MemberExpression"
    ? directlyIdentityAliasedBindingNames(
        unwrappedExpression.object,
        sourceCode,
        new Set(),
        new Set(),
        exposureTraversalContext,
      )
    : directlyIdentityAliasedBindingNames(
        unwrappedExpression,
        sourceCode,
        new Set(),
        new Set(),
        exposureTraversalContext,
      );
}

function addPublicObjectMutationDependencies(
  publicBindingDependenciesByName,
  identityDependenciesByBindingName,
  callExpression,
  staticMethodKeys,
  sourceCode,
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const mutationMethodKeys = [...staticMethodKeys].filter((methodKey) => {
    const [globalObjectName, methodName] = methodKey.split(".");
    return mutationMethodNamesForGlobalObject(globalObjectName).includes(
      methodName,
    );
  });
  if (mutationMethodKeys.length === 0) {
    return;
  }
  const mutationTarget = callExpression.arguments[0];
  if (mutationTarget === undefined || mutationTarget.type === "SpreadElement") {
    return;
  }
  const identityEquivalentTargetBindingNames = identityEquivalentBindingNames(
    directlyRelatedPublicObjectBindingNames(
      mutationTarget,
      sourceCode,
      exposureTraversalContext,
    ),
    identityDependenciesByBindingName,
  );
  const assignedBindingNames = new Set();
  for (const mutationMethodKey of mutationMethodKeys) {
    for (const assignedExpression of publicMutationValueExpressions(
      mutationMethodKey,
      callExpression,
    )) {
      directlyExposedBindingNames(
        assignedExpression,
        sourceCode,
        assignedBindingNames,
        emptyPrivateClassMemberDependencies(),
        exposureTraversalContext,
      );
    }
  }
  for (const targetBindingName of identityEquivalentTargetBindingNames) {
    addBindingDependencies(
      publicBindingDependenciesByName,
      targetBindingName,
      assignedBindingNames,
    );
  }
}

function exportedLocalBindingNames(programNode) {
  const exportedBindingNames = new Set();
  for (const statement of programNode.body) {
    if (
      statement.type !== "ExportNamedDeclaration" ||
      statement.source !== null
    ) {
      continue;
    }
    const declaration = statement.declaration;
    if (declaration?.type === "VariableDeclaration") {
      for (const variableDeclarator of declaration.declarations) {
        for (const bindingName of boundIdentifierNames(variableDeclarator.id)) {
          exportedBindingNames.add(bindingName);
        }
      }
    } else if (
      ["ClassDeclaration", "FunctionDeclaration"].includes(declaration?.type) &&
      declaration.id !== null
    ) {
      exportedBindingNames.add(declaration.id.name);
    }
    for (const exportSpecifier of statement.specifiers) {
      const localBindingName = staticModuleExportName(exportSpecifier.local);
      if (localBindingName !== undefined) {
        exportedBindingNames.add(localBindingName);
      }
    }
  }
  return exportedBindingNames;
}

function importedBindingAnalysis(programNode) {
  const importedBindingNamesByModuleSpecifier = new Map();
  const importedDefaultBindingNames = new Set();
  const importedNamespaceBindingNames = new Set();
  const importedNodeCreateRequireBindingNames = new Set();
  const importedNodeModuleNamespaceBindingNames = new Set();
  for (const statement of programNode.body) {
    if (statement.type !== "ImportDeclaration") {
      continue;
    }
    const moduleSpecifier = statement.source.value;
    const importsNodeModuleApi =
      NODE_MODULE_API_SPECIFIERS.includes(moduleSpecifier);
    const importedBindingNames =
      importedBindingNamesByModuleSpecifier.get(moduleSpecifier) ?? new Set();
    for (const importSpecifier of statement.specifiers) {
      importedBindingNames.add(importSpecifier.local.name);
      if (importSpecifier.type === "ImportDefaultSpecifier") {
        importedDefaultBindingNames.add(importSpecifier.local.name);
        if (importsNodeModuleApi) {
          importedNodeModuleNamespaceBindingNames.add(
            importSpecifier.local.name,
          );
        }
      } else if (importSpecifier.type === "ImportNamespaceSpecifier") {
        importedNamespaceBindingNames.add(importSpecifier.local.name);
        if (importsNodeModuleApi) {
          importedNodeModuleNamespaceBindingNames.add(
            importSpecifier.local.name,
          );
        }
      } else if (
        importsNodeModuleApi &&
        staticModuleExportName(importSpecifier.imported) === "createRequire"
      ) {
        importedNodeCreateRequireBindingNames.add(importSpecifier.local.name);
      }
    }
    importedBindingNamesByModuleSpecifier.set(
      moduleSpecifier,
      importedBindingNames,
    );
  }
  return {
    importedBindingNamesByModuleSpecifier,
    importedDefaultBindingNames,
    importedNamespaceBindingNames,
    importedNodeCreateRequireBindingNames,
    importedNodeModuleNamespaceBindingNames,
  };
}

function importDeclarationBindingShape(importDeclaration) {
  if (importDeclaration.specifiers.length === 0) {
    return "side-effect-only";
  }
  if (importDeclaration.specifiers.length !== 1) {
    return "mixed-or-multiple";
  }
  const [importSpecifier] = importDeclaration.specifiers;
  if (importSpecifier.type === "ImportDefaultSpecifier") {
    return "single-default";
  }
  if (importSpecifier.type === "ImportNamespaceSpecifier") {
    return "single-namespace";
  }
  return "single-named";
}

function transitivelyReachableBindingNames(
  initialBindingNames,
  bindingDependenciesByName,
) {
  const reachableBindingNames = new Set(initialBindingNames);
  const pendingBindingNames = [...initialBindingNames];
  while (pendingBindingNames.length > 0) {
    const bindingName = pendingBindingNames.pop();
    for (const dependencyBindingName of bindingDependenciesByName.get(
      bindingName,
    ) ?? []) {
      if (!reachableBindingNames.has(dependencyBindingName)) {
        reachableBindingNames.add(dependencyBindingName);
        pendingBindingNames.push(dependencyBindingName);
      }
    }
  }
  return reachableBindingNames;
}

function publiclyReexportedModuleSpecifiers(
  programNode,
  bindingDependenciesByName,
  importedBindingNamesByModuleSpecifier,
) {
  const publiclyReexportedSpecifiers = new Set();
  for (const statement of programNode.body) {
    if (
      ["ExportAllDeclaration", "ExportNamedDeclaration"].includes(
        statement.type,
      ) &&
      statement.source !== null
    ) {
      publiclyReexportedSpecifiers.add(statement.source.value);
    }
  }
  const reachableExportedBindingNames = transitivelyReachableBindingNames(
    exportedLocalBindingNames(programNode),
    bindingDependenciesByName,
  );
  for (const [
    moduleSpecifier,
    importedBindingNames,
  ] of importedBindingNamesByModuleSpecifier) {
    if (
      [...importedBindingNames].some((bindingName) =>
        reachableExportedBindingNames.has(bindingName),
      )
    ) {
      publiclyReexportedSpecifiers.add(moduleSpecifier);
    }
  }
  return publiclyReexportedSpecifiers;
}

function directlyReexportedModuleSpecifiers(
  programNode,
  importedBindingNamesByModuleSpecifier,
) {
  const directlyReexportedSpecifiers = new Set();
  for (const statement of programNode.body) {
    if (
      ["ExportAllDeclaration", "ExportNamedDeclaration"].includes(
        statement.type,
      ) &&
      statement.source !== null
    ) {
      directlyReexportedSpecifiers.add(statement.source.value);
    }
  }

  const directlyExportedBindingNames = exportedLocalBindingNames(programNode);
  for (const [
    moduleSpecifier,
    importedBindingNames,
  ] of importedBindingNamesByModuleSpecifier) {
    if (
      [...importedBindingNames].some((bindingName) =>
        directlyExportedBindingNames.has(bindingName),
      )
    ) {
      directlyReexportedSpecifiers.add(moduleSpecifier);
    }
  }
  return directlyReexportedSpecifiers;
}

function moduleExportAnalysis(programNode) {
  let hasDefaultExport = false;
  let hasNativeEsmDeclaration = false;
  let hasSemanticallyNamedExport = false;
  for (const statement of programNode.body) {
    if (
      statement.type === "ImportDeclaration" ||
      statement.type.startsWith("Export")
    ) {
      hasNativeEsmDeclaration = true;
    }
    if (statement.type === "ExportDefaultDeclaration") {
      hasDefaultExport = true;
      continue;
    }
    if (statement.type === "ExportAllDeclaration") {
      const exportedName = staticModuleExportName(statement.exported);
      hasDefaultExport ||= exportedName === "default";
      hasSemanticallyNamedExport ||=
        exportedName !== undefined && exportedName !== "default";
      continue;
    }
    if (statement.type !== "ExportNamedDeclaration") {
      continue;
    }
    if (statement.declaration !== null) {
      const declaredBindingNames =
        statement.declaration.type === "VariableDeclaration"
          ? statement.declaration.declarations.flatMap((declarator) => [
              ...boundIdentifierNames(declarator.id),
            ])
          : statement.declaration.id === null
            ? []
            : [statement.declaration.id.name];
      hasSemanticallyNamedExport ||= declaredBindingNames.length > 0;
    }
    for (const exportSpecifier of statement.specifiers) {
      const exportedName = staticModuleExportName(exportSpecifier.exported);
      hasDefaultExport ||= exportedName === "default";
      hasSemanticallyNamedExport ||=
        exportedName !== undefined && exportedName !== "default";
    }
  }
  return {
    hasDefaultExport,
    hasNativeEsmDeclaration,
    hasSemanticallyNamedExport,
  };
}

function expressionIdentityReferencesAnyBinding(
  expression,
  targetBindingNames,
  identityDependenciesByBindingName,
  sourceCode,
  exposureTraversalContext = createExposureTraversalContext(),
) {
  const referencedBindingNames = transitivelyReachableBindingNames(
    directlyIdentityAliasedBindingNames(
      expression,
      sourceCode,
      new Set(),
      new Set(),
      exposureTraversalContext,
    ),
    identityDependenciesByBindingName,
  );
  return [...referencedBindingNames].some((bindingName) =>
    targetBindingNames.has(bindingName),
  );
}

function expressionResolvesToImportedNodeCreateRequire(
  expression,
  importedNodeCreateRequireBindingNames,
  importedNodeModuleNamespaceBindingNames,
  identityDependenciesByBindingName,
  sourceCode,
  visitedBindingVariables = new Set(),
) {
  const unwrappedExpression = unwrapTransparentAstExpression(expression);
  const createRequireMember = memberExpressionRecord(
    unwrappedExpression,
    sourceCode,
  );
  if (
    createRequireMember?.propertyName === "createRequire" &&
    expressionIdentityReferencesAnyBinding(
      createRequireMember.object,
      importedNodeModuleNamespaceBindingNames,
      identityDependenciesByBindingName,
      sourceCode,
    )
  ) {
    return true;
  }
  if (unwrappedExpression?.type === "SemanticStaticPropertyValueExpression") {
    return (
      unwrappedExpression.propertyName === "createRequire" &&
      expressionIdentityReferencesAnyBinding(
        unwrappedExpression.objectExpression,
        importedNodeModuleNamespaceBindingNames,
        identityDependenciesByBindingName,
        sourceCode,
      )
    );
  }
  if (
    expressionIdentityReferencesAnyBinding(
      unwrappedExpression,
      importedNodeCreateRequireBindingNames,
      identityDependenciesByBindingName,
      sourceCode,
    )
  ) {
    return true;
  }
  if (unwrappedExpression?.type !== "Identifier") {
    return false;
  }
  const bindingVariable = resolvedBindingVariableForIdentifier(
    sourceCode,
    unwrappedExpression,
  );
  if (
    bindingVariable === undefined ||
    visitedBindingVariables.has(bindingVariable)
  ) {
    return false;
  }
  visitedBindingVariables.add(bindingVariable);
  return assignedValueExpressionsForBindingVariable(
    bindingVariable,
    sourceCode,
    unwrappedExpression,
  ).some((assignedValueExpression) =>
    expressionResolvesToImportedNodeCreateRequire(
      assignedValueExpression,
      importedNodeCreateRequireBindingNames,
      importedNodeModuleNamespaceBindingNames,
      identityDependenciesByBindingName,
      sourceCode,
      visitedBindingVariables,
    ),
  );
}

function destructuredDefaultPropertyUsesNamespaceFallback(
  propertyNode,
  importedNamespaceBindingNames,
  identityDependenciesByBindingName,
  sourceCode,
) {
  if (
    propertyNode.parent.type !== "ObjectPattern" ||
    staticModuleExportName(propertyNode.key) !== "default"
  ) {
    return false;
  }
  const objectPattern = propertyNode.parent;
  const patternOwner = objectPattern.parent;
  const namespaceExpression =
    patternOwner.type === "VariableDeclarator" &&
    patternOwner.id === objectPattern
      ? patternOwner.init
      : patternOwner.type === "AssignmentExpression" &&
          patternOwner.left === objectPattern
        ? patternOwner.right
        : patternOwner.type === "AssignmentPattern" &&
            patternOwner.left === objectPattern
          ? patternOwner.right
          : undefined;
  return (
    namespaceExpression !== undefined &&
    expressionIdentityReferencesAnyBinding(
      namespaceExpression,
      importedNamespaceBindingNames,
      identityDependenciesByBindingName,
      sourceCode,
    )
  );
}

function logicalExpressionUsesImportedDefaultBindingFallback(
  logicalExpression,
  importedDefaultBindingNames,
  identityDependenciesByBindingName,
  sourceCode,
) {
  if (!["??", "||"].includes(logicalExpression.operator)) {
    return false;
  }
  const defaultPropertyMember = memberExpressionRecord(
    logicalExpression.left,
    sourceCode,
  );
  if (defaultPropertyMember?.propertyName !== "default") {
    return false;
  }
  return [...importedDefaultBindingNames].some((importedDefaultBindingName) => {
    const candidateBindingNames = new Set([importedDefaultBindingName]);
    return (
      expressionIdentityReferencesAnyBinding(
        defaultPropertyMember.object,
        candidateBindingNames,
        identityDependenciesByBindingName,
        sourceCode,
      ) &&
      expressionIdentityReferencesAnyBinding(
        logicalExpression.right,
        candidateBindingNames,
        identityDependenciesByBindingName,
        sourceCode,
      )
    );
  });
}

function expressionIsDirectMutationTarget(expression) {
  let targetExpression = expression;
  let parentNode = targetExpression.parent;
  while (
    parentNode?.type === "ChainExpression" ||
    parentNode?.type === "ParenthesizedExpression"
  ) {
    targetExpression = parentNode;
    parentNode = targetExpression.parent;
  }
  return (
    (parentNode?.type === "AssignmentExpression" &&
      parentNode.left === targetExpression) ||
    (parentNode?.type === "UpdateExpression" &&
      parentNode.argument === targetExpression) ||
    (parentNode?.type === "UnaryExpression" &&
      parentNode.operator === "delete" &&
      parentNode.argument === targetExpression)
  );
}

function mutationMethodNamesForGlobalObject(globalObjectName) {
  if (globalObjectName === "Object") {
    return OBJECT_EXPORTS_MUTATION_METHOD_NAMES;
  }
  if (globalObjectName === "Reflect") {
    return REFLECT_EXPORTS_MUTATION_METHOD_NAMES;
  }
  return [];
}

function architectureSourceStructureRule(completeSourceStructure) {
  return {
    meta: {
      schema: [],
      type: "problem",
    },
    create(context) {
      const assignmentExpressionNodes = [];
      const binaryExpressionNodes = [];
      const callExpressionNodes = [];
      const identifierNodes = [];
      const importExpressionNodes = [];
      const logicalExpressionNodes = [];
      const memberExpressionNodes = [];
      const propertyNodes = [];
      return {
        AssignmentExpression(node) {
          assignmentExpressionNodes.push(node);
        },
        BinaryExpression(node) {
          binaryExpressionNodes.push(node);
        },
        CallExpression(node) {
          callExpressionNodes.push(node);
        },
        Identifier(node) {
          identifierNodes.push(node);
        },
        ImportExpression(node) {
          importExpressionNodes.push(node);
        },
        LogicalExpression(node) {
          logicalExpressionNodes.push(node);
        },
        MemberExpression(node) {
          memberExpressionNodes.push(node);
        },
        Property(node) {
          propertyNodes.push(node);
        },
        "Program:exit"(programNode) {
          const sourceCode = context.sourceCode;
          const prohibitedSourcePatternLabels = new Set();
          const commonJsRequireModuleSpecifierRecords = [];
          const exportedBindingNames = exportedLocalBindingNames(programNode);
          const bindingDependenciesByName = topLevelBindingDependencies(
            programNode,
            sourceCode,
          );
          const identityDependenciesByBindingName =
            topLevelIdentityAliasDependencies(programNode, sourceCode);
          const publicObjectAliasDependenciesByBindingName =
            topLevelPublicObjectAliasDependencies(programNode, sourceCode);
          for (const assignmentExpressionNode of assignmentExpressionNodes) {
            addModuleScopedAssignmentDependencies(
              bindingDependenciesByName,
              assignmentExpressionNode,
              sourceCode,
              exportedBindingNames,
            );
            addModuleScopedIdentityAssignmentDependencies(
              identityDependenciesByBindingName,
              assignmentExpressionNode,
              sourceCode,
            );
            addModuleScopedIdentityAssignmentDependencies(
              publicObjectAliasDependenciesByBindingName,
              assignmentExpressionNode,
              sourceCode,
            );
          }
          const globalStaticMethodKeysByBindingName =
            globalStaticMethodBindings(
              programNode,
              assignmentExpressionNodes,
              sourceCode,
            );
          const {
            importedBindingNamesByModuleSpecifier,
            importedDefaultBindingNames,
            importedNamespaceBindingNames,
            importedNodeCreateRequireBindingNames,
            importedNodeModuleNamespaceBindingNames,
          } = importedBindingAnalysis(programNode);

          for (const logicalExpressionNode of logicalExpressionNodes) {
            if (
              logicalExpressionUsesImportedDefaultBindingFallback(
                logicalExpressionNode,
                importedDefaultBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add(
                "default-export fallback probing",
              );
            }
          }

          for (const identifierNode of identifierNodes) {
            if (
              identifierReferencesUnshadowedBinding(
                sourceCode,
                identifierNode,
                "require",
              )
            ) {
              prohibitedSourcePatternLabels.add("CommonJS require");
            } else if (
              identifierReferencesUnshadowedBinding(
                sourceCode,
                identifierNode,
                "module",
              )
            ) {
              const enclosingMember =
                identifierNode.parent.type === "MemberExpression" &&
                identifierNode.parent.object === identifierNode
                  ? identifierNode.parent
                  : undefined;
              const memberName =
                enclosingMember === undefined
                  ? undefined
                  : staticMemberPropertyName(enclosingMember, sourceCode);
              prohibitedSourcePatternLabels.add(
                memberName === "exports"
                  ? "CommonJS module export"
                  : memberName === "require"
                    ? "CommonJS require"
                    : "CommonJS module access",
              );
            } else if (
              identifierReferencesUnshadowedBinding(
                sourceCode,
                identifierNode,
                "exports",
              )
            ) {
              prohibitedSourcePatternLabels.add("CommonJS exports reference");
              if (expressionIsDirectMutationTarget(identifierNode)) {
                prohibitedSourcePatternLabels.add("CommonJS exports mutation");
              }
            }
            const referencedModuleBindingName =
              moduleScopedBindingNameForIdentifier(sourceCode, identifierNode);
            if (
              referencedModuleBindingName !== undefined &&
              importedNamespaceBindingNames.has(referencedModuleBindingName) &&
              expressionIsDirectMutationTarget(identifierNode)
            ) {
              prohibitedSourcePatternLabels.add(
                "imported module namespace mutation",
              );
            }
          }

          for (const memberExpressionNode of memberExpressionNodes) {
            const memberName = staticMemberPropertyName(
              memberExpressionNode,
              sourceCode,
            );
            if (
              expressionIsDirectMutationTarget(memberExpressionNode) &&
              expressionIdentityReferencesAnyBinding(
                memberExpressionNode.object,
                importedNamespaceBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add(
                "imported module namespace mutation",
              );
            }
            if (
              memberName?.toLowerCase() === "webvowl" &&
              globalPublicationRootName(
                memberExpressionNode.object,
                sourceCode,
              ) !== undefined
            ) {
              prohibitedSourcePatternLabels.add("window WebVOWL publication");
            }
            if (
              memberName === "default" &&
              expressionIdentityReferencesAnyBinding(
                memberExpressionNode.object,
                importedNamespaceBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add(
                "default-export fallback probing",
              );
            }
          }

          for (const propertyNode of propertyNodes) {
            if (
              destructuredDefaultPropertyUsesNamespaceFallback(
                propertyNode,
                importedNamespaceBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add(
                "default-export fallback probing",
              );
            }
          }

          for (const binaryExpressionNode of binaryExpressionNodes) {
            if (
              binaryExpressionNode.operator === "in" &&
              staticStringExpressionValue(
                binaryExpressionNode.left,
                sourceCode,
              ) === "default" &&
              expressionIdentityReferencesAnyBinding(
                binaryExpressionNode.right,
                importedNamespaceBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add(
                "default-export fallback probing",
              );
            }
          }

          for (const callExpressionNode of callExpressionNodes) {
            const unwrappedCallee = unwrapTransparentAstExpression(
              callExpressionNode.callee,
            );
            const calleeMember = memberExpressionRecord(
              unwrappedCallee,
              sourceCode,
            );
            const isBareRequireCall = identifierReferencesUnshadowedBinding(
              sourceCode,
              unwrappedCallee,
              "require",
            );
            const isModuleRequireCall =
              calleeMember?.propertyName === "require" &&
              identifierReferencesUnshadowedBinding(
                sourceCode,
                unwrapTransparentAstExpression(calleeMember.object),
                "module",
              );
            const isImportedNodeCreateRequireCall =
              expressionResolvesToImportedNodeCreateRequire(
                unwrappedCallee,
                importedNodeCreateRequireBindingNames,
                importedNodeModuleNamespaceBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              );
            if (isBareRequireCall || isModuleRequireCall) {
              prohibitedSourcePatternLabels.add("CommonJS require");
              const firstArgument = callExpressionNode.arguments[0];
              commonJsRequireModuleSpecifierRecords.push({
                kind: "commonjs-require",
                specifier:
                  callExpressionNode.arguments.length === 1 &&
                  firstArgument?.type !== "SpreadElement"
                    ? literalModuleSpecifierValue(firstArgument)
                    : undefined,
              });
            }
            if (isImportedNodeCreateRequireCall) {
              prohibitedSourcePatternLabels.add(
                "CommonJS createRequire interoperability",
              );
            }

            const staticMethodKeys = globalStaticMethodKeysForCallee(
              callExpressionNode.callee,
              identityDependenciesByBindingName,
              globalStaticMethodKeysByBindingName,
              sourceCode,
            );
            if (
              callPublishesWebVowlOnBrowserGlobal(
                callExpressionNode,
                staticMethodKeys,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add("window WebVOWL publication");
            }
            addPublicObjectMutationDependencies(
              bindingDependenciesByName,
              publicObjectAliasDependenciesByBindingName,
              callExpressionNode,
              staticMethodKeys,
              sourceCode,
            );
            const usesMutationMethod = [...staticMethodKeys].some(
              (methodKey) => {
                const [globalObjectName, methodName] = methodKey.split(".");
                return mutationMethodNamesForGlobalObject(
                  globalObjectName,
                ).includes(methodName);
              },
            );
            if (usesMutationMethod) {
              const mutationTarget = unwrapTransparentAstExpression(
                callExpressionNode.arguments[0],
              );
              if (
                identifierReferencesUnshadowedBinding(
                  sourceCode,
                  mutationTarget,
                  "exports",
                )
              ) {
                prohibitedSourcePatternLabels.add("CommonJS exports mutation");
              }
              if (
                expressionIdentityReferencesAnyBinding(
                  mutationTarget,
                  importedNamespaceBindingNames,
                  identityDependenciesByBindingName,
                  sourceCode,
                )
              ) {
                prohibitedSourcePatternLabels.add(
                  "imported module namespace mutation",
                );
              }
            }

            const probedPropertyName = staticStringExpressionValue(
              callExpressionNode.arguments[1],
              sourceCode,
            );
            if (
              probedPropertyName === "default" &&
              [
                "Object.getOwnPropertyDescriptor",
                "Object.hasOwn",
                "Reflect.get",
                "Reflect.getOwnPropertyDescriptor",
                "Reflect.has",
              ].some((methodKey) => staticMethodKeys.has(methodKey)) &&
              expressionIdentityReferencesAnyBinding(
                callExpressionNode.arguments[0],
                importedNamespaceBindingNames,
                identityDependenciesByBindingName,
                sourceCode,
              )
            ) {
              prohibitedSourcePatternLabels.add(
                "default-export fallback probing",
              );
            }

            visitLocalCallableInvocationEffects(
              callExpressionNode,
              sourceCode,
              createExposureTraversalContext(),
              (effectNode, invocationContext) => {
                if (effectNode.type === "MemberExpression") {
                  const effectMemberName = staticMemberPropertyName(
                    effectNode,
                    sourceCode,
                  );
                  if (
                    expressionIsDirectMutationTarget(effectNode) &&
                    expressionIdentityReferencesAnyBinding(
                      effectNode.object,
                      importedNamespaceBindingNames,
                      identityDependenciesByBindingName,
                      sourceCode,
                      invocationContext,
                    )
                  ) {
                    prohibitedSourcePatternLabels.add(
                      "imported module namespace mutation",
                    );
                  }
                  if (
                    effectMemberName === "default" &&
                    expressionIdentityReferencesAnyBinding(
                      effectNode.object,
                      importedNamespaceBindingNames,
                      identityDependenciesByBindingName,
                      sourceCode,
                      invocationContext,
                    )
                  ) {
                    prohibitedSourcePatternLabels.add(
                      "default-export fallback probing",
                    );
                  }
                  if (
                    effectMemberName?.toLowerCase() === "webvowl" &&
                    globalPublicationRootName(
                      effectNode.object,
                      sourceCode,
                      new Set(),
                      invocationContext,
                    ) !== undefined
                  ) {
                    prohibitedSourcePatternLabels.add(
                      "window WebVOWL publication",
                    );
                  }
                }
                if (effectNode.type !== "CallExpression") {
                  return;
                }
                const effectStaticMethodKeys = globalStaticMethodKeysForCallee(
                  effectNode.callee,
                  identityDependenciesByBindingName,
                  globalStaticMethodKeysByBindingName,
                  sourceCode,
                );
                addPublicObjectMutationDependencies(
                  bindingDependenciesByName,
                  publicObjectAliasDependenciesByBindingName,
                  effectNode,
                  effectStaticMethodKeys,
                  sourceCode,
                  invocationContext,
                );
                if (
                  callPublishesWebVowlOnBrowserGlobal(
                    effectNode,
                    effectStaticMethodKeys,
                    sourceCode,
                    invocationContext,
                  )
                ) {
                  prohibitedSourcePatternLabels.add(
                    "window WebVOWL publication",
                  );
                }
                const effectUsesMutationMethod = [
                  ...effectStaticMethodKeys,
                ].some((methodKey) => {
                  const [globalObjectName, methodName] = methodKey.split(".");
                  return mutationMethodNamesForGlobalObject(
                    globalObjectName,
                  ).includes(methodName);
                });
                if (
                  effectUsesMutationMethod &&
                  expressionIdentityReferencesAnyBinding(
                    effectNode.arguments[0],
                    importedNamespaceBindingNames,
                    identityDependenciesByBindingName,
                    sourceCode,
                    invocationContext,
                  )
                ) {
                  prohibitedSourcePatternLabels.add(
                    "imported module namespace mutation",
                  );
                }
              },
            );
          }

          const publiclyReexportedSpecifiers =
            publiclyReexportedModuleSpecifiers(
              programNode,
              bindingDependenciesByName,
              importedBindingNamesByModuleSpecifier,
            );
          const directlyReexportedSpecifiers =
            directlyReexportedModuleSpecifiers(
              programNode,
              importedBindingNamesByModuleSpecifier,
            );
          const moduleSpecifierRecords = [];
          for (const statement of programNode.body) {
            if (statement.type === "ImportDeclaration") {
              moduleSpecifierRecords.push({
                importBindingShape: importDeclarationBindingShape(statement),
                kind: directlyReexportedSpecifiers.has(statement.source.value)
                  ? "re-export"
                  : publiclyReexportedSpecifiers.has(statement.source.value)
                    ? "possible-public-value-escape"
                    : "static",
                specifier: statement.source.value,
              });
            } else if (
              ["ExportAllDeclaration", "ExportNamedDeclaration"].includes(
                statement.type,
              ) &&
              statement.source !== null
            ) {
              moduleSpecifierRecords.push({
                kind: "re-export",
                specifier: statement.source.value,
              });
            }
          }
          for (const importExpressionNode of importExpressionNodes) {
            moduleSpecifierRecords.push({
              kind: "dynamic",
              specifier: literalModuleSpecifierValue(
                importExpressionNode.source,
              ),
            });
          }

          completeSourceStructure({
            commonJsRequireModuleSpecifierRecords,
            prohibitedSourcePatternLabels: [...prohibitedSourcePatternLabels],
            moduleSpecifierRecords,
            ...moduleExportAnalysis(programNode),
          });
        },
      };
    },
  };
}

function analyzeAuthoredJavaScriptModule(source, repositoryRelativePath) {
  let sourceStructure;
  const architectureRuleName = "architecture/analyze-module-structure";
  const linter = new Linter();
  const verificationMessages = linter.verify(
    source,
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: {
        architecture: {
          rules: {
            "analyze-module-structure": architectureSourceStructureRule(
              (completedSourceStructure) => {
                sourceStructure = completedSourceStructure;
              },
            ),
          },
        },
      },
      rules: {
        [architectureRuleName]: "error",
      },
    },
    { filename: repositoryRelativePath },
  );
  const parsingFailure = verificationMessages.find(
    (verificationMessage) => verificationMessage.fatal === true,
  );
  return parsingFailure === undefined && sourceStructure !== undefined
    ? sourceStructure
    : {
        syntaxErrorMessage:
          parsingFailure?.message ??
          "ESLint did not produce a JavaScript module structure.",
      };
}

function analyzeNativeEsmSource(
  source,
  repositoryRelativePath,
  {
    inspectNamedExportContract = true,
    inspectProhibitedSourcePatterns = true,
  } = {},
) {
  const violations = [];
  if (path.posix.extname(repositoryRelativePath).toLowerCase() === ".cjs") {
    violations.push("CommonJS .cjs module extension");
  }
  const sourceStructure = analyzeAuthoredJavaScriptModule(
    source,
    repositoryRelativePath,
  );
  if (sourceStructure.syntaxErrorMessage !== undefined) {
    return {
      commonJsRequireModuleSpecifierRecords: [],
      commonJsViolationLabels: [],
      moduleSpecifierRecords: [],
      violations: [
        ...violations,
        "invalid native ESM syntax: " + sourceStructure.syntaxErrorMessage,
      ],
    };
  }

  for (const { kind, specifier } of sourceStructure.moduleSpecifierRecords) {
    if (specifier === undefined) {
      violations.push("non-literal dynamic module specifier");
    } else if (isRepositoryLocalModuleSpecifier(specifier)) {
      const kindLabel = kind === "dynamic" ? " dynamic" : "";
      const locationLabel = specifier.startsWith("/")
        ? "repository-root absolute"
        : "relative";
      if (moduleSpecifierPathnameEndsWithDirectorySeparator(specifier)) {
        violations.push(
          locationLabel +
            kindLabel +
            " directory module specifier: " +
            specifier,
        );
      } else if (!moduleSpecifierHasExplicitFileExtension(specifier)) {
        violations.push(
          "extensionless " +
            locationLabel +
            kindLabel +
            " module specifier: " +
            specifier,
        );
      }
    }
  }

  const commonJsViolationLabels =
    sourceStructure.prohibitedSourcePatternLabels.filter((label) =>
      COMMONJS_PROHIBITED_SOURCE_PATTERN_LABELS.includes(label),
    );
  violations.push(
    ...sourceStructure.prohibitedSourcePatternLabels.filter(
      (label) =>
        inspectProhibitedSourcePatterns ||
        label === "imported module namespace mutation",
    ),
  );
  if (inspectNamedExportContract && sourceStructure.hasDefaultExport) {
    violations.push("default export");
  }
  if (
    inspectNamedExportContract &&
    repositoryRelativePath.endsWith(".test.js") &&
    !sourceStructure.hasNativeEsmDeclaration
  ) {
    violations.push("no native ESM import or export declaration");
  } else if (
    inspectNamedExportContract &&
    !repositoryRelativePath.endsWith(".test.js") &&
    !sourceStructure.hasSemanticallyNamedExport
  ) {
    violations.push("no semantically named export");
  }

  return {
    commonJsRequireModuleSpecifierRecords:
      sourceStructure.commonJsRequireModuleSpecifierRecords,
    commonJsViolationLabels,
    moduleSpecifierRecords: sourceStructure.moduleSpecifierRecords,
    violations,
  };
}

function inspectNativeEsmSource(
  source,
  repositoryRelativePath,
  inspectionOptions,
) {
  return analyzeNativeEsmSource(
    source,
    repositoryRelativePath,
    inspectionOptions,
  ).violations;
}

function inspectNativeEsmModule(repositoryRelativePath, inspectionOptions) {
  const source = readFileSync(
    absoluteRepositoryPath(repositoryRelativePath),
    "utf8",
  );
  return inspectNativeEsmSource(
    source,
    repositoryRelativePath,
    inspectionOptions,
  );
}

function readRepositoryModuleSource(repositoryRelativePath) {
  const absolutePath = absoluteRepositoryPath(repositoryRelativePath);
  return existsSync(absolutePath) && statSync(absolutePath).isFile()
    ? readFileSync(absolutePath, "utf8")
    : undefined;
}

function isApprovedLegacyCommonJsDependencyPosition(
  importerPath,
  dependencyPath,
  importKind,
) {
  if (APPROVED_TEST_INFRASTRUCTURE_COMMONJS_PATHS.includes(dependencyPath)) {
    return importerPath.endsWith(".test.js");
  }
  return (
    ["possible-public-value-escape", "static"].includes(importKind) &&
    activeCommonJsRendererLeafPaths.includes(dependencyPath) &&
    (importerPath === D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH ||
      activeCommonJsRendererLeafPaths.includes(importerPath))
  );
}

function normalizedDependencyCruiserModulePath(modulePath) {
  return modulePath.replaceAll("\\", "/");
}

function dependencyResolutionDescendsBelowExactModuleSpecifierTarget(
  importerPath,
  moduleSpecifier,
  dependencyPath,
) {
  if (!moduleSpecifier.startsWith(".")) {
    return false;
  }
  const importerModuleUrl = new URL(importerPath, REPOSITORY_ROOT_URL_STRING);
  const exactModuleSpecifierTargetPath = toRepositoryRelativePath(
    fileURLToPath(
      new URL(moduleSpecifierPathname(moduleSpecifier), importerModuleUrl),
    ),
  );
  const pathBelowExactTarget = path.posix.relative(
    exactModuleSpecifierTargetPath,
    dependencyPath,
  );
  return (
    pathBelowExactTarget !== "" &&
    pathBelowExactTarget !== ".." &&
    !pathBelowExactTarget.startsWith("../") &&
    !path.posix.isAbsolute(pathBelowExactTarget)
  );
}

function isDependencyCruiserModulePathWithinRepository(modulePath) {
  const normalizedModulePath = path.posix.normalize(
    normalizedDependencyCruiserModulePath(modulePath),
  );
  return (
    !path.posix.isAbsolute(normalizedModulePath) &&
    !path.win32.isAbsolute(normalizedModulePath) &&
    normalizedModulePath !== ".." &&
    !normalizedModulePath.startsWith("../")
  );
}

function dependencyCruiserRecordForModuleSpecifier(
  moduleRecord,
  moduleSpecifier,
) {
  return moduleRecord.dependencies.find(
    ({ module: dependencyModuleSpecifier }) =>
      dependencyModuleSpecifier === moduleSpecifier,
  );
}

function isRepositoryLocalDependencyCruiserRecord(dependencyRecord) {
  return (
    dependencyRecord.dependencyTypes.includes("local") ||
    isRepositoryLocalModuleSpecifier(dependencyRecord.module)
  );
}

function isAuthoredRepositoryDependencyCruiserModule(moduleRecord) {
  return (
    moduleRecord.coreModule !== true && moduleRecord.matchesDoNotFollow !== true
  );
}

function isNodeCommonJsInteroperabilityDependencyCruiserRecord(
  dependencyRecord,
) {
  return (
    dependencyRecord.coreModule === true &&
    dependencyRecord.dependencyTypes.includes("core") &&
    NODE_MODULE_API_SPECIFIERS.includes(dependencyRecord.module)
  );
}

function isApplicationTestSupportModulePath(modulePath) {
  return modulePath.startsWith("src/app/test/");
}

function isProductionAuthoredModulePath(modulePath) {
  return (
    modulePath.startsWith("src/") &&
    !modulePath.endsWith(".test.js") &&
    !isApplicationTestSupportModulePath(modulePath)
  );
}

function collectNativeEsmDependencyGraphDiagnostics(
  moduleDependencyGraph,
  readModuleSource = readRepositoryModuleSource,
) {
  const advisoryFindings = [];
  const blockingViolations = [];
  const moduleRecordBySourcePath = new Map();
  const moduleAnalysisBySourcePath = new Map();
  const unapprovedCommonJsDependencyPaths = new Set();

  for (const moduleRecord of moduleDependencyGraph) {
    if (!isAuthoredRepositoryDependencyCruiserModule(moduleRecord)) {
      continue;
    }
    const sourcePath = normalizedDependencyCruiserModulePath(
      moduleRecord.source,
    );
    if (moduleRecordBySourcePath.has(sourcePath)) {
      blockingViolations.push(
        `${sourcePath}: duplicate dependency-cruiser module record`,
      );
      continue;
    }
    moduleRecordBySourcePath.set(sourcePath, moduleRecord);
  }

  for (const sourcePath of moduleRecordBySourcePath.keys()) {
    if (!hasAuthoredJavaScriptModuleExtension(sourcePath)) {
      continue;
    }
    const source = readModuleSource(sourcePath);
    if (source === undefined) {
      blockingViolations.push(`${sourcePath}: missing authored module`);
      continue;
    }
    const sourceStructure = analyzeAuthoredJavaScriptModule(source, sourcePath);
    moduleAnalysisBySourcePath.set(sourcePath, {
      isCommonJs:
        path.posix.extname(sourcePath).toLowerCase() === ".cjs" ||
        sourceStructure.prohibitedSourcePatternLabels?.some((label) =>
          COMMONJS_PROHIBITED_SOURCE_PATTERN_LABELS.includes(label),
        ) === true,
      source,
      sourceStructure,
    });
  }

  for (const [importerPath, moduleRecord] of moduleRecordBySourcePath) {
    const importerAnalysis = moduleAnalysisBySourcePath.get(importerPath);
    if (importerAnalysis === undefined) {
      continue;
    }
    const { isCommonJs, source, sourceStructure } = importerAnalysis;
    if (sourceStructure.syntaxErrorMessage !== undefined) {
      blockingViolations.push(
        `${importerPath}: invalid JavaScript syntax: ${sourceStructure.syntaxErrorMessage}`,
      );
      continue;
    }

    if (APPROVED_TEST_INFRASTRUCTURE_COMMONJS_PATHS.includes(importerPath)) {
      continue;
    }

    for (const dependencyRecord of moduleRecord.dependencies) {
      if (
        isNodeCommonJsInteroperabilityDependencyCruiserRecord(dependencyRecord)
      ) {
        blockingViolations.push(
          `${importerPath}: Node.js CommonJS interoperability dependency is prohibited: ${dependencyRecord.module}`,
        );
      }
      if (
        isProductionAuthoredModulePath(importerPath) &&
        isRepositoryLocalDependencyCruiserRecord(dependencyRecord) &&
        typeof dependencyRecord.resolved === "string"
      ) {
        const dependencyPath = normalizedDependencyCruiserModulePath(
          dependencyRecord.resolved,
        );
        if (isApplicationTestSupportModulePath(dependencyPath)) {
          blockingViolations.push(
            `${importerPath} -> ${dependencyPath}: production dependency on application test support`,
          );
        }
      }
    }

    if (isCommonJs) {
      if (!activeCommonJsRendererLeafPaths.includes(importerPath)) {
        continue;
      }
      for (const {
        specifier,
      } of sourceStructure.commonJsRequireModuleSpecifierRecords) {
        if (specifier === undefined) {
          blockingViolations.push(
            `${importerPath}: non-literal CommonJS require`,
          );
          continue;
        }
        if (!isRepositoryLocalModuleSpecifier(specifier)) {
          continue;
        }
        const dependencyRecord = dependencyCruiserRecordForModuleSpecifier(
          moduleRecord,
          specifier,
        );
        if (dependencyRecord === undefined) {
          blockingViolations.push(
            `${importerPath}: dependency-cruiser did not report repository-local CommonJS module specifier: ${specifier}`,
          );
        }
      }
      for (const dependencyRecord of moduleRecord.dependencies) {
        if (!isRepositoryLocalDependencyCruiserRecord(dependencyRecord)) {
          continue;
        }
        const specifier = dependencyRecord.module;
        if (
          dependencyRecord.couldNotResolve === true ||
          typeof dependencyRecord.resolved !== "string"
        ) {
          blockingViolations.push(
            `${importerPath}: unresolved repository-local CommonJS module specifier: ${specifier}`,
          );
          continue;
        }
        const dependencyPath = normalizedDependencyCruiserModulePath(
          dependencyRecord.resolved,
        );
        if (!isDependencyCruiserModulePathWithinRepository(dependencyPath)) {
          blockingViolations.push(
            `${importerPath}: resolved module escapes the repository: ${specifier} -> ${dependencyPath}`,
          );
          continue;
        }
        if (!hasAuthoredJavaScriptModuleExtension(dependencyPath)) {
          continue;
        }
        if (!moduleRecordBySourcePath.has(dependencyPath)) {
          blockingViolations.push(
            `${importerPath} -> ${dependencyPath}: missing dependency-cruiser module record`,
          );
          continue;
        }
        if (
          !activeCommonJsRendererLeafPaths.includes(dependencyPath) &&
          !APPROVED_TEST_INFRASTRUCTURE_COMMONJS_PATHS.includes(dependencyPath)
        ) {
          blockingViolations.push(
            `${importerPath} -> ${dependencyPath}: unapproved CommonJS dependency`,
          );
          unapprovedCommonJsDependencyPaths.add(dependencyPath);
        }
      }
      continue;
    }

    const nativeEsmAnalysis = analyzeNativeEsmSource(source, importerPath, {
      inspectNamedExportContract: false,
      inspectProhibitedSourcePatterns: false,
    });
    for (const violation of nativeEsmAnalysis.violations) {
      blockingViolations.push(`${importerPath}: ${violation}`);
    }

    const authoredRepositoryLocalModuleSpecifiers = new Set(
      nativeEsmAnalysis.moduleSpecifierRecords
        .map(({ specifier }) => specifier)
        .filter(
          (specifier) =>
            specifier !== undefined &&
            isRepositoryLocalModuleSpecifier(specifier),
        ),
    );
    for (const dependencyRecord of moduleRecord.dependencies) {
      if (!isRepositoryLocalDependencyCruiserRecord(dependencyRecord)) {
        continue;
      }
      if (dependencyRecord.dependencyTypes.includes("require")) {
        blockingViolations.push(
          `${importerPath}: dependency-cruiser reported a CommonJS require edge from native ESM: ${dependencyRecord.module}`,
        );
        continue;
      }
      if (
        !authoredRepositoryLocalModuleSpecifiers.has(dependencyRecord.module)
      ) {
        blockingViolations.push(
          `${importerPath}: dependency-cruiser reported a repository-local dependency edge without a matching authored native-ESM module specifier: ${dependencyRecord.module}`,
        );
      }
    }

    const commonJsEntryCountByDependencyPath = new Map();
    for (const {
      importBindingShape,
      kind,
      specifier,
    } of nativeEsmAnalysis.moduleSpecifierRecords) {
      if (
        specifier === undefined ||
        !isRepositoryLocalModuleSpecifier(specifier) ||
        !moduleSpecifierHasExplicitFileExtension(specifier)
      ) {
        continue;
      }
      const dependencyRecord = dependencyCruiserRecordForModuleSpecifier(
        moduleRecord,
        specifier,
      );
      if (dependencyRecord === undefined) {
        blockingViolations.push(
          `${importerPath}: dependency-cruiser did not report repository-local module specifier: ${specifier}`,
        );
        continue;
      }
      if (
        dependencyRecord.couldNotResolve === true ||
        typeof dependencyRecord.resolved !== "string"
      ) {
        blockingViolations.push(
          `${importerPath}: unresolved repository-local module specifier: ${specifier}`,
        );
        continue;
      }
      const dependencyPath = normalizedDependencyCruiserModulePath(
        dependencyRecord.resolved,
      );
      if (!isDependencyCruiserModulePathWithinRepository(dependencyPath)) {
        blockingViolations.push(
          `${importerPath}: resolved module escapes the repository: ${specifier} -> ${dependencyPath}`,
        );
        continue;
      }
      if (
        dependencyResolutionDescendsBelowExactModuleSpecifierTarget(
          importerPath,
          specifier,
          dependencyPath,
        )
      ) {
        blockingViolations.push(
          `${importerPath}: directory module specifier resolved below its exact target: ${specifier} -> ${dependencyPath}`,
        );
        continue;
      }
      if (!hasAuthoredJavaScriptModuleExtension(dependencyPath)) {
        continue;
      }
      if (!moduleRecordBySourcePath.has(dependencyPath)) {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: missing dependency-cruiser module record`,
        );
        continue;
      }
      const dependencyAnalysis = moduleAnalysisBySourcePath.get(dependencyPath);
      if (dependencyAnalysis === undefined) {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: missing authored module`,
        );
        continue;
      }
      if (!dependencyAnalysis.isCommonJs) {
        continue;
      }

      if (
        kind === "re-export" &&
        activeCommonJsRendererLeafPaths.includes(dependencyPath) &&
        (importerPath === D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH ||
          activeCommonJsRendererLeafPaths.includes(importerPath))
      ) {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: public CommonJS re-export`,
        );
        continue;
      }
      if (
        !isApprovedLegacyCommonJsDependencyPosition(
          importerPath,
          dependencyPath,
          kind,
        )
      ) {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: unapproved CommonJS dependency`,
        );
        unapprovedCommonJsDependencyPaths.add(dependencyPath);
        continue;
      }

      if (kind === "possible-public-value-escape") {
        advisoryFindings.push({
          dependencyPath,
          diagnosticCode: "possible-public-commonjs-value-escape",
          importerPath,
          inferenceConfidence: "medium",
        });
      }
      if (importBindingShape !== "single-default") {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: CommonJS dependency must use exactly one default import`,
        );
      }
      if (specifier !== moduleSpecifierPathname(specifier)) {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: CommonJS module specifier must not contain a query or fragment`,
        );
      }
      const commonJsEntryCount =
        (commonJsEntryCountByDependencyPath.get(dependencyPath) ?? 0) + 1;
      commonJsEntryCountByDependencyPath.set(
        dependencyPath,
        commonJsEntryCount,
      );
      if (commonJsEntryCount > 1) {
        blockingViolations.push(
          `${importerPath} -> ${dependencyPath}: duplicate CommonJS module entry point`,
        );
      }
    }
  }

  for (const [sourcePath, { isCommonJs }] of moduleAnalysisBySourcePath) {
    if (
      isCommonJs &&
      !activeCommonJsRendererLeafPaths.includes(sourcePath) &&
      !APPROVED_TEST_INFRASTRUCTURE_COMMONJS_PATHS.includes(sourcePath) &&
      !unapprovedCommonJsDependencyPaths.has(sourcePath)
    ) {
      blockingViolations.push(
        `${sourcePath}: unapproved reachable CommonJS module`,
      );
    }
  }

  return Object.freeze({
    advisoryFindings: Object.freeze(
      sortedUniqueNativeEsmDependencyAdvisories(advisoryFindings),
    ),
    blockingViolations: Object.freeze(sortedUniqueEntries(blockingViolations)),
  });
}

function reportNativeEsmDependencyGraphAdvisories(
  advisoryFindings,
  writeAdvisoryText = (advisoryText) => process.stderr.write(advisoryText),
) {
  if (advisoryFindings.length === 0) {
    return;
  }
  writeAdvisoryText(
    [
      "Native-ESM dependency graph SHOULD findings (manual review required):",
      ...advisoryFindings.map(
        ({
          dependencyPath,
          diagnosticCode,
          importerPath,
          inferenceConfidence,
        }) =>
          `- [${inferenceConfidence} confidence; ${diagnosticCode}] ${importerPath} -> ${dependencyPath}`,
      ),
      "",
    ].join("\n"),
  );
}

function sortedUniqueNativeEsmDependencyAdvisories(advisoryFindings) {
  const advisoryFindingByIdentity = new Map();
  for (const advisoryFinding of advisoryFindings) {
    const {
      dependencyPath,
      diagnosticCode,
      importerPath,
      inferenceConfidence,
    } = advisoryFinding;
    const advisoryFindingIdentity = [
      importerPath,
      dependencyPath,
      diagnosticCode,
      inferenceConfidence,
    ].join("\u0000");
    advisoryFindingByIdentity.set(
      advisoryFindingIdentity,
      Object.freeze({ ...advisoryFinding }),
    );
  }
  return [...advisoryFindingByIdentity.entries()]
    .sort(([leftIdentity], [rightIdentity]) =>
      leftIdentity.localeCompare(rightIdentity),
    )
    .map(([, advisoryFinding]) => advisoryFinding);
}

function createDependencyCruiserGraphFixture(
  authoredModuleSourceByPath,
  dependencyEdges,
) {
  return [...authoredModuleSourceByPath.keys()].sort().map((sourcePath) => ({
    dependencies: dependencyEdges
      .filter(({ importerPath }) => importerPath === sourcePath)
      .map(
        ({
          declarationKind = "import",
          moduleSpecifier,
          resolvedModulePath,
        }) => ({
          couldNotResolve: resolvedModulePath === undefined,
          dependencyTypes: ["local", declarationKind],
          module: moduleSpecifier,
          ...(resolvedModulePath === undefined
            ? {}
            : { resolved: resolvedModulePath }),
        }),
      ),
    source: sourcePath,
  }));
}

function withAllowlistedCommonJsLeafPaths(leafPaths, evaluatePolicy) {
  const productionLeafPaths = activeCommonJsRendererLeafPaths;
  activeCommonJsRendererLeafPaths = leafPaths;
  try {
    return evaluatePolicy();
  } finally {
    activeCommonJsRendererLeafPaths = productionLeafPaths;
  }
}

function collectDependencyCruiserGraphFixtureDiagnostics(
  authoredModuleSourceByPath,
  dependencyEdges,
  allowlistedCommonJsLeafPaths = TASK_1_COMMONJS_RENDERER_LEAF_PATHS,
) {
  const productionLeafPaths = activeCommonJsRendererLeafPaths;
  activeCommonJsRendererLeafPaths = allowlistedCommonJsLeafPaths;
  try {
    return collectNativeEsmDependencyGraphDiagnostics(
      createDependencyCruiserGraphFixture(
        authoredModuleSourceByPath,
        dependencyEdges,
      ),
      (modulePath) => authoredModuleSourceByPath.get(modulePath),
    );
  } finally {
    activeCommonJsRendererLeafPaths = productionLeafPaths;
  }
}

function moduleSpecifierExposureClassification(
  source,
  sourcePath,
  moduleSpecifier,
) {
  return analyzeNativeEsmSource(source, sourcePath, {
    inspectProhibitedSourcePatterns: false,
  }).moduleSpecifierRecords.find(
    ({ specifier }) => specifier === moduleSpecifier,
  )?.kind;
}

function sha256Hex(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sortedUniqueEntries(entries) {
  return [...new Set(entries)].sort();
}

describe("native-ESM source inspection policy", () => {
  test.each([
    [
      "CommonJS inside a template substitution",
      'export const exposedText = `${require("./legacy.js")}`;',
      "CommonJS require",
    ],
    [
      "an alias of the CommonJS require binding",
      "const loadLegacyModule = require; export { loadLegacyModule };",
      "CommonJS require",
    ],
    [
      "an escaped alias of the CommonJS require binding",
      "const loadLegacyModule = requ\\u0069re; export { loadLegacyModule };",
      "CommonJS require",
    ],
    [
      "a CommonJS module.require call",
      'export const legacyModule = module.require("./legacy.js");',
      "CommonJS require",
    ],
    [
      "a CommonJS loader created through an aliased node:module createRequire import",
      'import { createRequire as createCommonJsLoader } from "node:module"; const loadLegacyModule = createCommonJsLoader(import.meta.url); export const legacyModule = loadLegacyModule("./legacy.cjs");',
      "CommonJS createRequire interoperability",
    ],
    [
      "a CommonJS loader created through the default node:module export",
      'import NodeModuleApi from "node:module"; const loadLegacyModule = NodeModuleApi.createRequire(import.meta.url); export const legacyModule = loadLegacyModule("./legacy.cjs");',
      "CommonJS createRequire interoperability",
    ],
    [
      "a CommonJS loader created through an aliased node:module namespace member",
      'import * as NodeModuleApi from "node:module"; const createCommonJsLoader = NodeModuleApi.createRequire; const loadLegacyModule = createCommonJsLoader(import.meta.url); export const legacyModule = loadLegacyModule("./legacy.cjs");',
      "CommonJS createRequire interoperability",
    ],
    [
      "a CommonJS loader created through a destructured node:module namespace member",
      'import * as NodeModuleApi from "node:module"; const { createRequire: createCommonJsLoader } = NodeModuleApi; const loadLegacyModule = createCommonJsLoader(import.meta.url); export const legacyModule = loadLegacyModule("./legacy.cjs");',
      "CommonJS createRequire interoperability",
    ],
    [
      "CommonJS module metadata access",
      "export const moduleFilename = module.filename;",
      "CommonJS module access",
    ],
    [
      "module export mutation inside a template substitution",
      "export const exposedText = `${(module.exports = {})}`;",
      "CommonJS module export",
    ],
    [
      "parenthesized CommonJS module export mutation",
      "(module).exports = {}; export const contract = {};",
      "CommonJS module export",
    ],
    [
      "nested-parenthesized CommonJS module export mutation",
      "((module)).exports = {}; export const contract = {};",
      "CommonJS module export",
    ],
    [
      "global publication inside a template substitution",
      "export const exposedText = `${(window.webvowl = {})}`;",
      "window WebVOWL publication",
    ],
    [
      "computed window WebVOWL publication",
      'window["webvowl"] = {}; export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "module-constant computed window WebVOWL publication",
      'const webVowlPublicationPropertyName = "webvowl"; window[webVowlPublicationPropertyName] = {}; export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "escaped computed window WebVOWL publication",
      'window["web\\u0076owl"] = {}; export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "static-template window WebVOWL publication",
      "window[`webvowl`] = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "parenthesized window WebVOWL publication",
      "(window).webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "nested-parenthesized window WebVOWL publication",
      "((window)).webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "globalThis window WebVOWL publication",
      "globalThis.window.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "direct globalThis WebVOWL publication",
      "globalThis.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "parenthesized globalThis window WebVOWL publication",
      "(globalThis.window).webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "computed globalThis window WebVOWL publication",
      'globalThis["window"]["webvowl"] = {}; export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "self-referenced window WebVOWL publication",
      "window.window.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through a module-scoped Window alias",
      "const browserWindow = window; browserWindow.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through a block-scoped parent Window alias",
      "export function publishWebVowl() { const parentWindow = parent; parentWindow.webvowl = {}; }",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through the top WindowProxy",
      "top.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through a conditional browser-global alias",
      "const browserWindow = useParent ? parent : window; browserWindow.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "computed default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = namespace["default"] || namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "module-constant computed default-export fallback probing",
      'import * as namespace from "./legacy.js"; const defaultExportPropertyName = "default"; const contract = namespace[defaultExportPropertyName] || namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "default-import fallback probing",
      'import parser from "./legacy.js"; const resolvedParser = parser.default || parser; export { resolvedParser };',
      "default-export fallback probing",
    ],
    [
      "escaped computed default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = namespace["def\\u0061ult"] ?? namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "static-template default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = namespace[`default`] || namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "optional computed default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = namespace?.["default"] ?? namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "parenthesized default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = (namespace.default) || namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "nested-parenthesized computed default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = ((namespace["default"])) ?? namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "conditional default-export fallback probing",
      'import * as namespace from "./legacy.js"; const contract = namespace.default ? namespace.default : namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "destructured default-export fallback probing",
      'import * as namespace from "./legacy.js"; const { default: contract = namespace } = namespace; export { contract };',
      "default-export fallback probing",
    ],
    [
      "assignment-form default-export destructuring",
      'import * as namespace from "./legacy.js"; export let contract; ({ default: contract } = namespace);',
      "default-export fallback probing",
    ],
    [
      "computed assignment-form default-export destructuring",
      'import * as namespace from "./legacy.js"; export let contract; ({ ["default"]: contract } = namespace);',
      "default-export fallback probing",
    ],
    [
      "parameter-default module-namespace destructuring",
      'import * as namespace from "./legacy.js"; export function selectRenderer({ default: renderer } = namespace) { return renderer; }',
      "default-export fallback probing",
    ],
    [
      "function-local module-namespace alias probing",
      'import * as namespace from "./legacy.js"; export function selectRenderer() { const localNamespace = namespace; return localNamespace.default; }',
      "default-export fallback probing",
    ],
    [
      "Reflect.get default-export probing",
      'import * as namespace from "./legacy.js"; export const contract = Reflect.get(namespace, "default") ?? namespace;',
      "default-export fallback probing",
    ],
    [
      "Object.getOwnPropertyDescriptor default-export probing",
      'import * as namespace from "./legacy.js"; export const contract = Object.getOwnPropertyDescriptor(namespace, "default")?.value ?? namespace;',
      "default-export fallback probing",
    ],
    [
      "module-namespace default presence probing",
      'import * as namespace from "./legacy.js"; export const hasDefault = "default" in namespace;',
      "default-export fallback probing",
    ],
    [
      "executable CommonJS following a regular-expression literal",
      'export const quotePattern = /\'/u; require("./legacy.js");',
      "CommonJS require",
    ],
    [
      "CommonJS between division operators after a Unicode identifier",
      'export const π = 1; export const ratio = π / require("./legacy.js") / 2;',
      "CommonJS require",
    ],
    [
      "CommonJS between division operators after a contextual-keyword property",
      'export const ratio = source.of / require("./legacy.js") / 2;',
      "CommonJS require",
    ],
    [
      "CommonJS between division operators after a contextual-keyword binding",
      'export const of = 2; export const ratio = of / require("./legacy.js") / 2;',
      "CommonJS require",
    ],
    [
      "CommonJS between division operators after an outer for-header binding named of",
      'export function compute(of) { for (; of / require("./legacy.js") / 2; ) {} }',
      "CommonJS require",
    ],
    [
      "CommonJS between division operators after a local for-header binding named of",
      'export function compute() { const of = 2; for (of / require("./legacy.js") / 2; false; ) {} }',
      "CommonJS require",
    ],
    [
      "CommonJS following an object literal division operand",
      'export const ratio = {} / require("./legacy.js") / 2;',
      "CommonJS require",
    ],
    [
      "default export through a local export clause",
      "const contract = {}; export { contract as default };",
      "default export",
    ],
    [
      "default export through a re-export clause",
      'export { default } from "./dependency.js";',
      "default export",
    ],
    [
      "quoted default export through a local export clause",
      'const contract = {}; export { contract as "default" };',
      "default export",
    ],
    [
      "quoted default export through a re-export clause",
      'export { "default" } from "./dependency.js";',
      "default export",
    ],
    [
      "quoted default export through a namespace re-export",
      'export * as "default" from "./dependency.js";',
      "default export",
    ],
    [
      "escaped quoted default export name",
      'const contract = {}; export { contract as "def\\u0061ult" };',
      "default export",
    ],
    [
      "escaped identifier default export name",
      "const contract = {}; export { contract as def\\u0061ult };",
      "default export",
    ],
    [
      "escaped identifier default re-export name",
      'export { def\\u0061ult } from "./dependency.js";',
      "default export",
    ],
    [
      "computed CommonJS module export mutation",
      'module["exports"] = {}; export const contract = {};',
      "CommonJS module export",
    ],
    [
      "escaped computed CommonJS module export mutation",
      'module["ex\\u0070orts"] = {}; export const contract = {};',
      "CommonJS module export",
    ],
    [
      "static-template CommonJS module export mutation",
      "module[`exports`] = {}; export const contract = {};",
      "CommonJS module export",
    ],
    [
      "CommonJS exports mutation through Object.defineProperty",
      'Object.defineProperty(exports, "feature", { value: true }); export const contract = {};',
      "CommonJS exports mutation",
    ],
    [
      "CommonJS exports mutation through Reflect.set",
      'Reflect.set(exports, "feature", true); export const contract = {};',
      "CommonJS exports mutation",
    ],
    [
      "CommonJS exports mutation through Reflect.set with a parenthesized target",
      'Reflect.set((exports), "feature", true); export const contract = {};',
      "CommonJS exports mutation",
    ],
    [
      "CommonJS exports mutation through a parenthesized Reflect.set member expression",
      '(Reflect.set)(exports, "feature", true); export const contract = {};',
      "CommonJS exports mutation",
    ],
    [
      "CommonJS exports mutation through a nested-parenthesized Object.defineProperty member expression",
      '((Object.defineProperty))(exports, "feature", { value: true }); export const contract = {};',
      "CommonJS exports mutation",
    ],
    [
      "a bare CommonJS exports reference",
      "export const commonJsExports = exports;",
      "CommonJS exports reference",
    ],
    [
      "a computed global WebVOWL publication expression",
      'window["web" + "vowl"] = {}; export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "a worker-global WebVOWL publication",
      "self.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through window.self",
      "window.self.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through window.parent",
      "window.parent.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through window.frames",
      "window.frames.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through globalThis.self",
      "globalThis.self.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through a local helper result",
      "function browserGlobal() { return window; } const root = browserGlobal(); root.webvowl = {}; export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through Reflect.set",
      'Reflect.set(window, "webvowl", {}); export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through Object.defineProperty",
      'Object.defineProperty(window, "webvowl", { value: {} }); export const contract = {};',
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through Object.defineProperties",
      "Object.defineProperties(window, { webvowl: { value: {} } }); export const contract = {};",
      "window WebVOWL publication",
    ],
    [
      "WebVOWL publication through Object.assign",
      "Object.assign(window, { webvowl: {} }); export const contract = {};",
      "window WebVOWL publication",
    ],
  ])("rejects %s", (_scenario, source, expectedViolation) => {
    expect(
      inspectNativeEsmSource(source, "src/architecture-fixture.js"),
    ).toContain(expectedViolation);
  });

  test.each([
    [
      "an uncalled arrow function",
      "let browserGlobal = window; const replaceBrowserGlobal = () => (browserGlobal = {}); browserGlobal.webvowl = {}; export { replaceBrowserGlobal };",
    ],
    [
      "an unconstructed class instance field",
      "let browserGlobal = window; export class BrowserGlobalReplacement { replacement = (browserGlobal = {}); } browserGlobal.webvowl = {};",
    ],
    [
      "an uncalled default parameter initializer",
      "let browserGlobal = window; export function replaceBrowserGlobal(replacement = (browserGlobal = {})) { return replacement; } browserGlobal.webvowl = {};",
    ],
    [
      "a short-circuited optional call argument",
      "let browserGlobal = window; optionalPublisher?.publish(browserGlobal = {}); browserGlobal.webvowl = {}; export const contract = {};",
    ],
  ])(
    "rejects WebVOWL publication when an intervening overwrite is deferred by %s",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toContain("window WebVOWL publication");
    },
  );

  test("accepts an async semantically named export", () => {
    expect(
      inspectNativeEsmSource(
        "export async function loadOntologySource() {}",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test.each([
    [
      "an ordinary domain object's default field",
      "const rendererConfiguration = { default: {}, explicit: {} }; export const configuration = rendererConfiguration.default || rendererConfiguration.explicit;",
    ],
    [
      "a parameter shadowing an imported namespace binding",
      'import * as rendererNamespace from "./renderer.js"; export function chooseConfiguration(rendererNamespace) { return rendererNamespace.default || rendererNamespace.explicit; }',
    ],
    [
      "a nested field named default on an imported module value",
      'import * as rendererNamespace from "./renderer.js"; export const defaultMode = rendererNamespace.settings.default;',
    ],
    [
      "a nested field named default through a local value alias",
      'import * as rendererNamespace from "./renderer.js"; const settings = rendererNamespace.settings; export const defaultMode = settings.default;',
    ],
    [
      "destructuring a nested field named default from an imported module value",
      'import * as rendererNamespace from "./renderer.js"; export const { default: defaultMode } = rendererNamespace.settings;',
    ],
    [
      "a WebVOWL field on a destructured nested browser-global value",
      "const { navigator: root } = globalThis; root.webvowl = {}; export const contract = {};",
    ],
  ])(
    "does not classify %s as module default interoperability",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toEqual([]);
    },
  );

  test("accepts an invalid cooked escape in a tagged template", () => {
    expect(
      inspectNativeEsmSource(
        "export const rawSource = String.raw`\\u{}`;",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test("accepts a hashbang without interpreting its text as JavaScript", () => {
    expect(
      inspectNativeEsmSource(
        "#!/usr/bin/env require\nexport const contract = {};",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test("accepts a parenthesized literal dynamic module specifier with an explicit extension", () => {
    expect(
      inspectNativeEsmSource(
        'export async function loadFeature() { return import(("./feature.js")); }',
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test.each([
    [
      "a local require binding",
      "const require = () => 1; export const answer = require();",
    ],
    [
      "a local module binding",
      'const module = { filename: "fixture.js" }; export const answer = module.filename;',
    ],
    [
      "a local exports binding",
      "const exports = {}; exports.answer = 1; export { exports };",
    ],
  ])("does not classify %s as CommonJS", (_scenario, source) => {
    expect(
      inspectNativeEsmSource(source, "src/architecture-fixture.js"),
    ).toEqual([]);
  });

  test.each([
    [
      "a member call",
      'export function loadThroughPort(modulePort) { return modulePort.require("./feature.js"); }',
    ],
    [
      "an object method definition",
      "export const modulePort = { require(specifier) { return specifier; } };",
    ],
    [
      "a class method definition",
      "export class ModulePort { require(specifier) { return specifier; } }",
    ],
  ])(
    "does not treat %s named require as the CommonJS binding",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toEqual([]);
    },
  );

  test("does not treat a comma expression as transparent parentheses", () => {
    expect(
      inspectNativeEsmSource(
        "export function readPort(module, port) { return (module, port).exports; }",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test.each([
    [
      "a direct property call",
      'export function loadThroughPort(modulePort) { return modulePort.import("./feature"); }',
    ],
    [
      "a spaced property call",
      'export function loadThroughPort(modulePort) { return modulePort . import("./feature"); }',
    ],
    [
      "a commented property call",
      'export function loadThroughPort(modulePort) { return modulePort./* boundary */import("./feature"); }',
    ],
    [
      "an object method definition",
      "export const modulePort = { import(specifier) { return specifier; } };",
    ],
    [
      "a class method definition",
      "export class ModulePort { import(specifier) { return specifier; } }",
    ],
  ])(
    "does not treat %s named import as a dynamic import expression",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toEqual([]);
    },
  );

  test("masks a regular-expression literal after a statement block", () => {
    expect(
      inspectNativeEsmSource(
        "if (condition) { observe(); } /require()/u.test(text); export const isReady = true;",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test("masks a regular-expression literal after a standalone block", () => {
    expect(
      inspectNativeEsmSource(
        "{ observe(); } /require()/u.test(text); export const isReady = true;",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test("masks a regular-expression literal after the for-of delimiter", () => {
    expect(
      inspectNativeEsmSource(
        "for (const match of /require()/gu.exec(text)) { observe(match); } export const isReady = true;",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test("masks a regular-expression literal after the for-await-of delimiter", () => {
    expect(
      inspectNativeEsmSource(
        "export async function inspect(stream) { for await (const match of /require()/gu.exec(stream)) {} }",
        "src/architecture-fixture.js",
      ),
    ).toEqual([]);
  });

  test.each([
    [
      "function declaration",
      "function observe() {} /require()/u.test(text); export { observe };",
    ],
    [
      "class declaration",
      "class Observer {} /require()/u.test(text); export { Observer };",
    ],
  ])("masks a regular-expression literal after a %s", (_scenario, source) => {
    expect(
      inspectNativeEsmSource(source, "src/architecture-fixture.js"),
    ).toEqual([]);
  });

  test.each([
    [
      "function expression",
      'export const ratio = function observe() {} / require("./legacy.js") / 2;',
    ],
    [
      "async function expression",
      'export const ratio = async function observe() {} / require("./legacy.js") / 2;',
    ],
    [
      "class expression",
      'export const ratio = class Observer {} / require("./legacy.js") / 2;',
    ],
    [
      "block-bodied arrow function",
      'export const ratio = (() => {}) / require("./legacy.js") / 2;',
    ],
  ])("retains division after a %s", (_scenario, source) => {
    expect(
      inspectNativeEsmSource(source, "src/architecture-fixture.js"),
    ).toContain("CommonJS require");
  });

  test("rejects an extensionless literal dynamic import", () => {
    expect(
      inspectNativeEsmSource(
        'export async function loadFeature() { return import("./feature"); }',
        "src/architecture-fixture.js",
      ),
    ).toContain("extensionless relative dynamic module specifier: ./feature");
  });

  test("rejects a dynamic import whose specifier cannot be statically audited", () => {
    expect(
      inspectNativeEsmSource(
        "export async function loadFeature(moduleSpecifier) { return import(moduleSpecifier); }",
        "src/architecture-fixture.js",
      ),
    ).toContain("non-literal dynamic module specifier");
  });

  test.each([
    [
      "concatenation",
      'export async function loadFeature(suffix) { return import("./feature.js" + suffix); }',
    ],
    [
      "logical fallback",
      'export async function loadFeature(moduleSpecifier) { return import("./feature.js" || moduleSpecifier); }',
    ],
    [
      "template substitution containing a string literal",
      'export async function loadFeature() { return import(`../legacy/${"module.js"}`); }',
    ],
  ])(
    "rejects a dynamic import using literal-prefix %s",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toContain("non-literal dynamic module specifier");
    },
  );

  test("recognizes a literal dynamic import followed by a standalone block", () => {
    expect(
      inspectNativeEsmSource(
        'export async function loadFeature() { await import("./feature")\n{ observe(); } }',
        "src/architecture-fixture.js",
      ),
    ).toContain("extensionless relative dynamic module specifier: ./feature");
  });

  test("requires test modules to contain a native ESM declaration", () => {
    expect(
      inspectNativeEsmSource(
        'describe("contract", () => {});',
        "src/architecture-fixture.test.js",
      ),
    ).toContain("no native ESM import or export declaration");
  });

  test.each([
    ["an object property", "const options = { export: true };"],
    ["an object method", "const port = { export() {} };"],
    ["a class method", "class Port { export() {} }"],
    ["a class field", "class Port { export = true; }"],
    ["a direct member access", "modulePort.export();"],
    ["an optional member access", "modulePort?.export();"],
  ])(
    "does not treat %s named export as a native ESM declaration",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.test.js"),
      ).toContain("no native ESM import or export declaration");
    },
  );

  test("rejects a CommonJS module extension in the native-ESM scope", () => {
    expect(
      inspectNativeEsmSource(
        "export const contract = {};",
        "src/app/js/controller/contract.cjs",
      ),
    ).toContain("CommonJS .cjs module extension");
  });

  test.each([
    ["static", 'import "./feature."; export const contract = {};'],
    [
      "static with a query",
      'import "./feature.?variant=test"; export const contract = {};',
    ],
    [
      "dynamic with a fragment",
      'export async function loadFeature() { return import("./feature.#fragment"); }',
    ],
  ])(
    "rejects a trailing dot as the empty extension of a %s module specifier",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toContainEqual(expect.stringContaining("extensionless relative"));
    },
  );

  test.each([
    ["static", 'import "./feature.js/"; export const contract = {};'],
    [
      "dynamic",
      'export async function loadFeature() { return import("./feature.js/"); }',
    ],
  ])(
    "rejects a trailing separator on a dotted-directory %s module specifier",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toContainEqual(expect.stringContaining("directory module specifier"));
    },
  );
});

describe("native-ESM module dependency graph policy", () => {
  test("rejects a production dependency on application test support", () => {
    const productionModulePath = "src/app/js/controller/controller.js";
    const testSupportModulePath =
      "src/app/test/inMemoryRenderedGraphAdapter.js";
    const authoredModuleSourceByPath = new Map([
      [
        productionModulePath,
        'import { createInMemoryRenderedGraphAdapter } from "../../test/inMemoryRenderedGraphAdapter.js"; export function createController() { return createInMemoryRenderedGraphAdapter(); }',
      ],
      [
        testSupportModulePath,
        "export function createInMemoryRenderedGraphAdapter() { return {}; }",
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: productionModulePath,
            moduleSpecifier: "../../test/inMemoryRenderedGraphAdapter.js",
            resolvedModulePath: testSupportModulePath,
          },
        ],
      ).blockingViolations,
    ).toEqual([
      `${productionModulePath} -> ${testSupportModulePath}: production dependency on application test support`,
    ]);
  });

  test("leaves the named-export contract to required-module inspection while traversing existing ESM dependencies", () => {
    const requiredModulePath = "src/app/js/controller/root.js";
    const existingEsmDependencyPath = "src/owl2vowl/js/existingApi.js";
    const authoredModuleSourceByPath = new Map([
      [
        requiredModulePath,
        'import existingApi from "../../../owl2vowl/js/existingApi.js"; export function useExistingApi() { return existingApi(); }',
      ],
      [existingEsmDependencyPath, "export default function existingApi() {}"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: requiredModulePath,
            moduleSpecifier: "../../../owl2vowl/js/existingApi.js",
            resolvedModulePath: existingEsmDependencyPath,
          },
        ],
      ),
    ).toEqual({ advisoryFindings: [], blockingViolations: [] });
  });

  test("discovers native-ESM and CommonJS edges with dependency-cruiser", () => {
    const fixtureDirectoryPath = mkdtempSync(
      path.join(tmpdir(), "webvowl-module-format-graph-"),
    );
    try {
      writeFileSync(
        path.join(fixtureDirectoryPath, "entry.mjs"),
        'import legacyRenderer from "./legacy-renderer.cjs"; export function createRenderer() { return legacyRenderer(); }',
      );
      writeFileSync(
        path.join(fixtureDirectoryPath, "legacy-renderer.cjs"),
        'module.exports = require("./renderer-leaf.cjs");',
      );
      writeFileSync(
        path.join(fixtureDirectoryPath, "renderer-leaf.cjs"),
        "module.exports = function createRendererLeaf() {};",
      );

      const dependencyGraph = discoverAuthoredJavaScriptModuleDependencyGraph(
        ["entry.mjs"],
        fixtureDirectoryPath,
      );

      expect(
        dependencyGraph.map(({ dependencies, source }) => ({
          dependencies: dependencies.map(
            ({ dependencyTypes, module, resolved }) => ({
              declarationKind: dependencyTypes.includes("require")
                ? "require"
                : "import",
              moduleSpecifier: module,
              resolvedModulePath: resolved,
            }),
          ),
          modulePath: source,
        })),
      ).toEqual([
        {
          dependencies: [
            {
              declarationKind: "import",
              moduleSpecifier: "./legacy-renderer.cjs",
              resolvedModulePath: "legacy-renderer.cjs",
            },
          ],
          modulePath: "entry.mjs",
        },
        {
          dependencies: [
            {
              declarationKind: "require",
              moduleSpecifier: "./renderer-leaf.cjs",
              resolvedModulePath: "renderer-leaf.cjs",
            },
          ],
          modulePath: "legacy-renderer.cjs",
        },
        {
          dependencies: [],
          modulePath: "renderer-leaf.cjs",
        },
      ]);
    } finally {
      rmSync(fixtureDirectoryPath, { recursive: true });
    }
  });

  test("classifies deterministic re-exports as blocking and inferred value escapes as advisory", () => {
    const directReexportSourceByPath = new Map([
      [
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        'import parseOntology from "../parser.js"; export { parseOntology };',
      ],
      ["src/webvowl/js/parser.js", "module.exports = {};"],
    ]);
    const inferredValueEscapeSourceByPath = new Map([
      [
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        'import parseOntology from "../parser.js"; export function getOntologyParser() { return parseOntology; }',
      ],
      ["src/webvowl/js/parser.js", "module.exports = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        directReexportSourceByPath,
        [
          {
            importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
            moduleSpecifier: "../parser.js",
            resolvedModulePath: "src/webvowl/js/parser.js",
          },
        ],
      ),
    ).toEqual({
      advisoryFindings: [],
      blockingViolations: [
        `${D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH} -> src/webvowl/js/parser.js: public CommonJS re-export`,
      ],
    });
    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        inferredValueEscapeSourceByPath,
        [
          {
            importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
            moduleSpecifier: "../parser.js",
            resolvedModulePath: "src/webvowl/js/parser.js",
          },
        ],
      ),
    ).toEqual({
      advisoryFindings: [
        {
          dependencyPath: "src/webvowl/js/parser.js",
          diagnosticCode: "possible-public-commonjs-value-escape",
          importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          inferenceConfidence: "medium",
        },
      ],
      blockingViolations: [],
    });
  });

  test("evaluates dependency-cruiser graph records without resolving source paths itself", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export function getOntologyParser() { return parseOntology; }';
    const authoredModuleSourceByPath = new Map([
      [D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH, adapterSource],
      ["src/webvowl/js/parser.js", "module.exports = {};"],
    ]);
    const dependencyGraph = [
      {
        dependencies: [
          {
            couldNotResolve: false,
            dependencyTypes: ["local", "import"],
            module: "../parser.js",
            resolved: "src/webvowl/js/parser.js",
          },
        ],
        source: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
      },
      {
        dependencies: [],
        source: "src/webvowl/js/parser.js",
      },
    ];

    const dependencyGraphDiagnostics = withAllowlistedCommonJsLeafPaths(
      TASK_1_COMMONJS_RENDERER_LEAF_PATHS,
      () =>
        collectNativeEsmDependencyGraphDiagnostics(
          dependencyGraph,
          (modulePath) => authoredModuleSourceByPath.get(modulePath),
        ),
    );

    expect(dependencyGraphDiagnostics).toEqual({
      advisoryFindings: [
        {
          dependencyPath: "src/webvowl/js/parser.js",
          diagnosticCode: "possible-public-commonjs-value-escape",
          importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          inferenceConfidence: "medium",
        },
      ],
      blockingViolations: [],
    });
    expect(Object.isFrozen(dependencyGraphDiagnostics)).toBe(true);
    expect(Object.isFrozen(dependencyGraphDiagnostics.advisoryFindings)).toBe(
      true,
    );
    expect(
      Object.isFrozen(dependencyGraphDiagnostics.advisoryFindings[0]),
    ).toBe(true);
    expect(Object.isFrozen(dependencyGraphDiagnostics.blockingViolations)).toBe(
      true,
    );
  });

  test("enforces dependency-cruiser edges without reconstructing CommonJS resolution", () => {
    const commonJsLeafPath = "src/webvowl/js/classDragger.js";
    const unapprovedDependencyPath =
      "src/webvowl/js/unapprovedRendererDependency.js";
    const authoredModuleSourceByPath = new Map([
      [
        commonJsLeafPath,
        'module.exports = require.resolve("./unapprovedRendererDependency.js");',
      ],
      [unapprovedDependencyPath, "module.exports = {};"],
    ]);
    const dependencyGraph = [
      {
        dependencies: [
          {
            couldNotResolve: false,
            dependencyTypes: ["local", "require"],
            module: "./unapprovedRendererDependency.js",
            resolved: unapprovedDependencyPath,
          },
        ],
        source: commonJsLeafPath,
      },
      {
        dependencies: [],
        source: unapprovedDependencyPath,
      },
    ];

    expect(
      withAllowlistedCommonJsLeafPaths(
        TASK_1_COMMONJS_RENDERER_LEAF_PATHS,
        () =>
          collectNativeEsmDependencyGraphDiagnostics(
            dependencyGraph,
            (modulePath) => authoredModuleSourceByPath.get(modulePath),
          ),
      ).blockingViolations,
    ).toEqual([
      `${commonJsLeafPath} -> ${unapprovedDependencyPath}: unapproved CommonJS dependency`,
    ]);
  });

  test("rejects a dependency-cruiser resolution outside the repository", () => {
    const importerPath = "src/app/js/controller/root.js";
    const moduleSpecifier = "../../../../outside.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        `import "${moduleSpecifier}"; export const contract = {};`,
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath,
            moduleSpecifier,
            resolvedModulePath: "../outside.js",
          },
        ],
      ).blockingViolations,
    ).toEqual([
      `${importerPath}: resolved module escapes the repository: ${moduleSpecifier} -> ../outside.js`,
    ]);
  });

  test("rejects a dependency-cruiser resolution below the exact module-specifier target", () => {
    const importerPath = "src/app/js/controller/root.js";
    const moduleSpecifier = "./feature.js";
    const resolvedModulePath = "src/app/js/controller/feature.js/index.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        `import "${moduleSpecifier}"; export const contract = {};`,
      ],
      [resolvedModulePath, "export const feature = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [{ importerPath, moduleSpecifier, resolvedModulePath }],
      ).blockingViolations,
    ).toEqual([
      `${importerPath}: directory module specifier resolved below its exact target: ${moduleSpecifier} -> ${resolvedModulePath}`,
    ]);
  });

  test("rejects an unresolved repository-local dependency-cruiser edge", () => {
    const importerPath = "src/app/js/controller/root.js";
    const moduleSpecifier = "./missing.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        `import "${moduleSpecifier}"; export const contract = {};`,
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [{ importerPath, moduleSpecifier }],
      ).blockingViolations,
    ).toEqual([
      `${importerPath}: unresolved repository-local module specifier: ${moduleSpecifier}`,
    ]);
  });

  test("rejects a resolved dependency without a dependency-cruiser module record", () => {
    const importerPath = "src/app/js/controller/root.js";
    const moduleSpecifier = "./missing-record.js";
    const resolvedModulePath = "src/app/js/controller/missing-record.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        `import "${moduleSpecifier}"; export const contract = {};`,
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [{ importerPath, moduleSpecifier, resolvedModulePath }],
      ).blockingViolations,
    ).toEqual([
      `${importerPath} -> ${resolvedModulePath}: missing dependency-cruiser module record`,
    ]);
  });

  test("ignores dependency-cruiser module records excluded from traversal", () => {
    const importerPath = "src/app/js/controller/root.js";
    const externalModulePath = "node_modules/example-package/index.js";
    const authoredModuleSourceByPath = new Map([
      [importerPath, 'import "example-package"; export const contract = {};'],
    ]);
    const dependencyGraph = [
      {
        dependencies: [
          {
            couldNotResolve: false,
            dependencyTypes: ["npm", "import"],
            matchesDoNotFollow: true,
            module: "example-package",
            resolved: externalModulePath,
          },
        ],
        source: importerPath,
      },
      {
        dependencies: [],
        matchesDoNotFollow: true,
        source: externalModulePath,
      },
    ];

    expect(
      collectNativeEsmDependencyGraphDiagnostics(
        dependencyGraph,
        (modulePath) => authoredModuleSourceByPath.get(modulePath),
      ),
    ).toEqual({ advisoryFindings: [], blockingViolations: [] });
  });

  test("reports advisory diagnostics with explicit inference confidence", () => {
    const advisoryFinding = Object.freeze({
      dependencyPath: "src/webvowl/js/parser.js",
      diagnosticCode: "possible-public-commonjs-value-escape",
      importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
      inferenceConfidence: "medium",
    });
    let reportedAdvisoryText;

    reportNativeEsmDependencyGraphAdvisories(
      [advisoryFinding],
      (advisoryText) => {
        reportedAdvisoryText = advisoryText;
      },
    );

    expect(reportedAdvisoryText).toBe(
      `Native-ESM dependency graph SHOULD findings (manual review required):\n- [medium confidence; possible-public-commonjs-value-escape] ${D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH} -> src/webvowl/js/parser.js\n`,
    );
  });

  test.each([
    ["static", 'import "../legacy/module.js"; export const contract = {};'],
    [
      "dynamic",
      'export async function loadLegacyModule() { return import("../legacy/module.js"); }',
    ],
  ])(
    "rejects an unapproved CommonJS dependency reached by a %s import",
    (_kind, rootSource) => {
      const authoredModuleSourceByPath = new Map([
        ["src/app/js/controller/root.js", rootSource],
        ["src/app/js/legacy/module.js", "module.exports = {};"],
      ]);

      expect(
        collectDependencyCruiserGraphFixtureDiagnostics(
          authoredModuleSourceByPath,
          [
            {
              importerPath: "src/app/js/controller/root.js",
              moduleSpecifier: "../legacy/module.js",
              resolvedModulePath: "src/app/js/legacy/module.js",
            },
          ],
        ).blockingViolations,
      ).toEqual([
        "src/app/js/controller/root.js -> src/app/js/legacy/module.js: unapproved CommonJS dependency",
      ]);
    },
  );

  test("classifies a transitive createRequire consumer as an unapproved CommonJS dependency", () => {
    const importerPath = "src/app/js/controller/root.js";
    const commonJsLoaderPath = "src/app/js/legacyLoader.js";
    const moduleSpecifier = "../legacyLoader.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        `import { load } from "${moduleSpecifier}"; export { load };`,
      ],
      [
        commonJsLoaderPath,
        'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); export { load };',
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath,
            moduleSpecifier,
            resolvedModulePath: commonJsLoaderPath,
          },
        ],
      ),
    ).toEqual({
      advisoryFindings: [],
      blockingViolations: [
        `${importerPath} -> ${commonJsLoaderPath}: unapproved CommonJS dependency`,
      ],
    });
  });

  test("rejects dependency-cruiser's authoritative core edge to the Node module API", () => {
    const importerPath = "src/app/js/controller/root.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        'import * as NodeModuleApi from "node:module"; const { ...moduleApiCopy } = NodeModuleApi; export const load = moduleApiCopy.createRequire(import.meta.url);',
      ],
    ]);
    const dependencyGraph = [
      {
        dependencies: [
          {
            coreModule: true,
            dependencyTypes: ["core", "import"],
            module: "module",
            resolved: "module",
          },
        ],
        source: importerPath,
      },
    ];

    expect(
      collectNativeEsmDependencyGraphDiagnostics(
        dependencyGraph,
        (modulePath) => authoredModuleSourceByPath.get(modulePath),
      ).blockingViolations,
    ).toContain(
      `${importerPath}: Node.js CommonJS interoperability dependency is prohibited: module`,
    );
  });

  test("rejects an unapproved CommonJS dependency reached by a repository-root absolute import", () => {
    const authoredModuleSourceByPath = new Map([
      [
        "src/app/js/controller/root.js",
        'import "/webvowl/js/parser.js"; export const contract = {};',
      ],
      ["src/webvowl/js/parser.js", "module.exports = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: "src/app/js/controller/root.js",
            moduleSpecifier: "/webvowl/js/parser.js",
            resolvedModulePath: "src/webvowl/js/parser.js",
          },
        ],
      ).blockingViolations,
    ).toEqual([
      "src/app/js/controller/root.js -> src/webvowl/js/parser.js: unapproved CommonJS dependency",
    ]);
  });

  test("rejects a dependency-cruiser CommonJS edge that has no matching native-ESM declaration", () => {
    const importerPath = "src/app/js/controller/root.js";
    const moduleSpecifier = "../../../webvowl/js/parser.js";
    const dependencyPath = "src/webvowl/js/parser.js";
    const authoredModuleSourceByPath = new Map([
      [
        importerPath,
        `const require = globalThis.require; require("${moduleSpecifier}"); export const contract = {};`,
      ],
      [dependencyPath, "module.exports = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            declarationKind: "require",
            importerPath,
            moduleSpecifier,
            resolvedModulePath: dependencyPath,
          },
        ],
      ).blockingViolations,
    ).toContain(
      `${importerPath}: dependency-cruiser reported a CommonJS require edge from native ESM: ${moduleSpecifier}`,
    );
  });

  test("rejects a substituted-template dynamic import before traversing the dependency graph", () => {
    const authoredModuleSourceByPath = new Map([
      [
        "src/app/js/controller/root.js",
        'export async function loadLegacyModule() { return import(`../legacy/${"module.js"}`); }',
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [],
      ).blockingViolations,
    ).toEqual([
      "src/app/js/controller/root.js: non-literal dynamic module specifier",
    ]);
  });

  test("rejects a public re-export of an approved private CommonJS leaf", () => {
    const authoredModuleSourceByPath = new Map([
      [
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        'export { default as parseOntology } from "../parser.js";',
      ],
      ["src/webvowl/js/parser.js", "module.exports = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
            moduleSpecifier: "../parser.js",
            resolvedModulePath: "src/webvowl/js/parser.js",
          },
        ],
      ).blockingViolations,
    ).toEqual([
      `${D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH} -> src/webvowl/js/parser.js: public CommonJS re-export`,
    ]);
  });

  test.each([
    [
      "named import",
      'import { parseOntology } from "../parser.js"; export function parse(model) { return parseOntology(model); }',
    ],
    [
      "namespace import",
      'import * as parserNamespace from "../parser.js"; export function parse(model) { return parserNamespace(model); }',
    ],
    [
      "mixed default and named import",
      'import parseOntology, { parserVersion } from "../parser.js"; export function parse(model) { return parseOntology(model, parserVersion); }',
    ],
    [
      "side-effect import",
      'import "../parser.js"; export function createRenderedGraph() { return {}; }',
    ],
  ])(
    "rejects an allowlisted CommonJS leaf reached through a %s",
    (_scenario, adapterSource) => {
      const authoredModuleSourceByPath = new Map([
        [D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH, adapterSource],
        ["src/webvowl/js/parser.js", "module.exports = () => {};"],
      ]);

      expect(
        collectDependencyCruiserGraphFixtureDiagnostics(
          authoredModuleSourceByPath,
          [
            {
              importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
              moduleSpecifier: "../parser.js",
              resolvedModulePath: "src/webvowl/js/parser.js",
            },
          ],
        ).blockingViolations,
      ).toContain(
        `${D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH} -> src/webvowl/js/parser.js: CommonJS dependency must use exactly one default import`,
      );
    },
  );

  test("rejects duplicate imports of one allowlisted CommonJS entry point", () => {
    const authoredModuleSourceByPath = new Map([
      [
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        'import parseOntology from "../parser.js"; import parseOntologyAgain from "../parser.js"; export function parse(model) { return parseOntology(model) ?? parseOntologyAgain(model); }',
      ],
      ["src/webvowl/js/parser.js", "module.exports = () => {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
            moduleSpecifier: "../parser.js",
            resolvedModulePath: "src/webvowl/js/parser.js",
          },
        ],
      ).blockingViolations,
    ).toContain(
      `${D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH} -> src/webvowl/js/parser.js: duplicate CommonJS module entry point`,
    );
  });

  test.each(["?alternate", "#alternate"])(
    "rejects an allowlisted CommonJS entry point decorated with %s",
    (specifierSuffix) => {
      const authoredModuleSourceByPath = new Map([
        [
          D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          `import parseOntology from "../parser.js${specifierSuffix}"; export function parse(model) { return parseOntology(model); }`,
        ],
        ["src/webvowl/js/parser.js", "module.exports = () => {};"],
      ]);

      expect(
        collectDependencyCruiserGraphFixtureDiagnostics(
          authoredModuleSourceByPath,
          [
            {
              importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
              moduleSpecifier: `../parser.js${specifierSuffix}`,
              resolvedModulePath: "src/webvowl/js/parser.js",
            },
          ],
        ).blockingViolations,
      ).toContain(
        `${D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH} -> src/webvowl/js/parser.js: CommonJS module specifier must not contain a query or fragment`,
      );
    },
  );

  test.each([
    [
      "direct assignment",
      'import * as rendererNamespace from "./renderer.js"; rendererNamespace.feature = replacement; export const contract = {};',
    ],
    [
      "assignment through an alias",
      'import * as rendererNamespace from "./renderer.js"; const rendererAlias = rendererNamespace; rendererAlias.feature = replacement; export const contract = {};',
    ],
    [
      "Reflect.set",
      'import * as rendererNamespace from "./renderer.js"; Reflect.set(rendererNamespace, "feature", replacement); export const contract = {};',
    ],
    [
      "Object.defineProperty through an alias",
      'import * as rendererNamespace from "./renderer.js"; const rendererAlias = rendererNamespace; Object.defineProperty(rendererAlias, "feature", { value: replacement }); export const contract = {};',
    ],
    [
      "direct namespace-binding reassignment",
      'import * as rendererNamespace from "./renderer.js"; rendererNamespace = replacement; export const contract = {};',
    ],
    [
      "direct namespace-binding update",
      'import * as rendererNamespace from "./renderer.js"; ++rendererNamespace; export const contract = {};',
    ],
    [
      "an extracted Reflect.set binding",
      'import * as rendererNamespace from "./renderer.js"; const setProperty = Reflect.set; setProperty(rendererNamespace, "feature", replacement); export const contract = {};',
    ],
    [
      "a function-local namespace alias",
      'import * as rendererNamespace from "./renderer.js"; export function mutate(replacement) { const localNamespace = rendererNamespace; localNamespace.feature = replacement; }',
    ],
    [
      "a function-local extracted Reflect.set binding",
      'import * as rendererNamespace from "./renderer.js"; export function mutate(replacement) { const setProperty = Reflect.set; setProperty(rendererNamespace, "feature", replacement); }',
    ],
    [
      "a function-local destructured Reflect.set binding",
      'import * as rendererNamespace from "./renderer.js"; export function mutate(replacement) { const { set: setProperty } = Reflect; setProperty(rendererNamespace, "feature", replacement); }',
    ],
    [
      "a module-local helper parameter",
      'import * as rendererNamespace from "./renderer.js"; function mutate(target) { target.feature = replacement; } mutate(rendererNamespace); export const contract = {};',
    ],
    [
      "an immediately invoked function parameter",
      'import * as rendererNamespace from "./renderer.js"; ((target) => { target.feature = replacement; })(rendererNamespace); export const contract = {};',
    ],
    [
      "an array-destructured alias",
      'import * as rendererNamespace from "./renderer.js"; const [rendererAlias] = [rendererNamespace]; rendererAlias.feature = replacement; export const contract = {};',
    ],
  ])(
    "rejects imported module namespace mutation by %s",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toContain("imported module namespace mutation");
    },
  );

  test("rejects module-namespace default probing through a local helper parameter", () => {
    expect(
      inspectNativeEsmSource(
        'import * as rendererNamespace from "./renderer.js"; function choose(target) { return target.default; } export const contract = choose(rendererNamespace);',
        "src/architecture-fixture.js",
      ),
    ).toContain("default-export fallback probing");
  });

  test.each([
    [
      "a nested mutable object exported by a module",
      'import * as rendererNamespace from "./renderer.js"; rendererNamespace.settings.enabled = true; export const contract = {};',
    ],
    [
      "an alias of a nested mutable object exported by a module",
      'import * as rendererNamespace from "./renderer.js"; const settings = rendererNamespace.settings; settings.enabled = true; export const contract = {};',
    ],
  ])(
    "does not classify mutation of %s as module-namespace mutation",
    (_scenario, source) => {
      expect(
        inspectNativeEsmSource(source, "src/architecture-fixture.js"),
      ).toEqual([]);
    },
  );

  test.each([
    [
      "default binding",
      'import parseOntology from "../parser.js"; export { parseOntology };',
    ],
    [
      "aliased named binding",
      'import { default as parseOntology } from "../parser.js"; export { parseOntology as ontologyParser };',
    ],
    [
      "namespace binding",
      'import * as ontologyParser from "../parser.js"; export { ontologyParser };',
    ],
    [
      "default binding after import.meta",
      'console.log(import.meta.url); import parseOntology from "../parser.js"; export { parseOntology };',
    ],
    [
      "default binding after a member named import",
      'const modulePort = { import: true }; modulePort.import; import parseOntology from "../parser.js"; export { parseOntology };',
    ],
  ])(
    "classifies a local %s of an approved private CommonJS leaf as a deterministic re-export",
    (_bindingKind, adapterSource) => {
      expect(
        moduleSpecifierExposureClassification(
          adapterSource,
          D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          "../parser.js",
        ),
      ).toBe("re-export");
    },
  );

  test("classifies an exported variable alias as a possible public value escape", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export const ontologyParser = parseOntology;';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("possible-public-value-escape");
  });

  test.each([
    [
      "a parenthesized exported initializer",
      'import parseOntology from "../parser.js"; export const ontologyParser = (parseOntology);',
    ],
    [
      "an intermediate local alias",
      'import parseOntology from "../parser.js"; const ontologyParser = parseOntology; export { ontologyParser };',
    ],
    [
      "an intermediate alias used by an exported declaration",
      'import parseOntology from "../parser.js"; const privateParser = parseOntology; export const ontologyParser = privateParser;',
    ],
    [
      "an exported object field",
      'import parseOntology from "../parser.js"; export const ontologyParser = { parseOntology };',
    ],
    [
      "an exported arrow-function return",
      'import parseOntology from "../parser.js"; export const getOntologyParser = () => parseOntology;',
    ],
    [
      "an exported function return",
      'import parseOntology from "../parser.js"; export function getOntologyParser() { return parseOntology; }',
    ],
    [
      "an exported object getter",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = { get ontologyParser() { return parseOntology; } };',
    ],
    [
      "an exported class getter",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { static get ontologyParser() { return parseOntology; } }',
    ],
    [
      "an assignment under top-level control flow",
      'import parseOntology from "../parser.js"; export let ontologyParser; if (condition) { ontologyParser = parseOntology; }',
    ],
    [
      "a property assignment on an exported object",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; if (condition) { ontologyParserAccess.ontologyParser = parseOntology; }',
    ],
    [
      "an identity-preserving frozen object",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = Object.freeze({ parseOntology });',
    ],
    [
      "a promise resolution value",
      'import parseOntology from "../parser.js"; export function getOntologyParser() { return Promise.resolve(parseOntology); }',
    ],
    [
      "an exported class superclass",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess extends parseOntology {}',
    ],
    [
      "an exported class constructor assignment",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { constructor() { this.ontologyParser = parseOntology; } }',
    ],
    [
      "an exported class static-block assignment",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { static { this.ontologyParser = parseOntology; } }',
    ],
    [
      "an exported class-expression constructor assignment",
      'import parseOntology from "../parser.js"; export const OntologyParserAccess = class { constructor() { this.ontologyParser = parseOntology; } };',
    ],
    [
      "an Object.assign return value",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = Object.assign({}, { parseOntology });',
    ],
    [
      "a function-local binding alias",
      'import parseOntology from "../parser.js"; export function getOntologyParser() { const localParser = parseOntology; return localParser; }',
    ],
    [
      "an assigned function-local binding alias",
      'import parseOntology from "../parser.js"; export function getOntologyParser() { let localParser; localParser = parseOntology; return localParser; }',
    ],
    [
      "a constructor-local binding assigned to a public field",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { constructor() { const localParser = parseOntology; this.ontologyParser = localParser; } }',
    ],
    [
      "a module-local helper return",
      'import parseOntology from "../parser.js"; function privateParserAccess() { return parseOntology; } export function getOntologyParser() { return privateParserAccess(); }',
    ],
    [
      "a module-local helper parameter return",
      'import parseOntology from "../parser.js"; function identity(value) { return value; } export function getOntologyParser() { return identity(parseOntology); }',
    ],
    [
      "an immediately invoked rest-parameter return",
      'import parseOntology from "../parser.js"; export const ontologyParser = ((...values) => values[1])(false, parseOntology);',
    ],
    [
      "an object-destructured property",
      'import parseOntology from "../parser.js"; const { ontologyParser } = { ontologyParser: parseOntology, safeValue: true }; export { ontologyParser };',
    ],
    [
      "an array-destructured element",
      'import parseOntology from "../parser.js"; const [, ontologyParser] = [false, parseOntology]; export { ontologyParser };',
    ],
    [
      "an object-rest binding",
      'import parseOntology from "../parser.js"; const { safeValue, ...ontologyParserAccess } = { safeValue: true, parseOntology }; export { ontologyParserAccess };',
    ],
    [
      "an explicit undefined argument activating a parameter default",
      'import parseOntology from "../parser.js"; function choose(value = parseOntology) { return value; } export const ontologyParser = choose(undefined);',
    ],
    [
      "a local object method return",
      'import parseOntology from "../parser.js"; const helpers = { identity(value) { return value; } }; export const ontologyParser = helpers.identity(parseOntology);',
    ],
    [
      "an aliased Object.assign result",
      'import parseOntology from "../parser.js"; const assignProperties = Object.assign; export const ontologyParserAccess = assignProperties({}, { parseOntology });',
    ],
    [
      "an aliased Promise.resolve result",
      'import parseOntology from "../parser.js"; const resolveValue = Promise.resolve; export const ontologyParserPromise = resolveValue(parseOntology);',
    ],
    [
      "Function.prototype.call on a local identity helper",
      'import parseOntology from "../parser.js"; function identity(value) { return value; } export const ontologyParser = identity.call(null, parseOntology);',
    ],
    [
      "Function.prototype.apply on a local identity helper",
      'import parseOntology from "../parser.js"; function identity(value) { return value; } export const ontologyParser = identity.apply(null, [parseOntology]);',
    ],
    [
      "an exported generator yield",
      'import parseOntology from "../parser.js"; export function* ontologyParsers() { yield parseOntology; }',
    ],
    [
      "a private identity method invocation",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { #identity(value) { return value; } getParser() { return this.#identity(parseOntology); } }',
    ],
    [
      "a returned private method that exposes the parser",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { #getParser() { return parseOntology; } getGetter() { return this.#getParser; } }',
    ],
    [
      "a private method with a public-field effect",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { #install(value) { this.ontologyParser = value; } install() { this.#install(parseOntology); } }',
    ],
    [
      "a private setter with a public-field effect",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { set #parser(value) { this.ontologyParser = value; } install() { this.#parser = parseOntology; } }',
    ],
    [
      "a constructed public container argument",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = new Map([["parser", parseOntology]]);',
    ],
  ])(
    "classifies an approved private CommonJS import exposed through %s as a possible public value escape",
    (_scenario, adapterSource) => {
      expect(
        moduleSpecifierExposureClassification(
          adapterSource,
          D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          "../parser.js",
        ),
      ).toBe("possible-public-value-escape");
    },
  );

  test.each([
    [
      "Object.assign",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; Object.assign(ontologyParserAccess, { parseOntology });',
    ],
    [
      "Object.assign through a target alias",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; const publicAccessAlias = ontologyParserAccess; Object.assign(publicAccessAlias, { parseOntology });',
    ],
    [
      "Object.assign on a nested exported object",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = { nested: {} }; Object.assign(ontologyParserAccess.nested, { parseOntology });',
    ],
    [
      "Object.defineProperty with a value descriptor",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; Object.defineProperty(ontologyParserAccess, "ontologyParser", { value: parseOntology });',
    ],
    [
      "Object.defineProperty with a getter descriptor",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; Object.defineProperty(ontologyParserAccess, "ontologyParser", { get() { return parseOntology; } });',
    ],
    [
      "Object.defineProperties",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; Object.defineProperties(ontologyParserAccess, { ontologyParser: { value: parseOntology } });',
    ],
    [
      "Reflect.set",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; Reflect.set(ontologyParserAccess, "ontologyParser", parseOntology);',
    ],
    [
      "Object.assign through an alias of a publicly reachable child",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = { nested: {} }; const nestedAccess = ontologyParserAccess.nested; Object.assign(nestedAccess, { parseOntology });',
    ],
    [
      "Object.assign through a local helper target",
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; function install(target) { Object.assign(target, { parseOntology }); } install(ontologyParserAccess);',
    ],
  ])(
    "classifies an approved private CommonJS import exposed by %s as a possible public value escape",
    (_scenario, adapterSource) => {
      expect(
        moduleSpecifierExposureClassification(
          adapterSource,
          D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          "../parser.js",
        ),
      ).toBe("possible-public-value-escape");
    },
  );

  test.each([
    [
      "an object-pattern parameter that selects a safe sibling",
      'import parseOntology from "../parser.js"; export const safeValue = (({ safeValue }) => safeValue)({ safeValue: true, parseOntology });',
    ],
    [
      "an ordinary object destructuring declaration that selects a safe sibling",
      'import parseOntology from "../parser.js"; const { safeValue } = { safeValue: true, parseOntology }; export { safeValue };',
    ],
    [
      "a write that occurs only after the exported read",
      'import parseOntology from "../parser.js"; let candidate = false; export const safeValue = candidate; candidate = parseOntology;',
    ],
    [
      "a definitely overwritten local write before an exported IIFE result",
      'import parseOntology from "../parser.js"; export const safeValue = (() => { let candidate = parseOntology; candidate = false; return candidate; })();',
    ],
  ])(
    "keeps a private CommonJS import private through %s",
    (_scenario, adapterSource) => {
      expect(
        moduleSpecifierExposureClassification(
          adapterSource,
          D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          "../parser.js",
        ),
      ).toBe("static");
    },
  );

  test("classifies a private CommonJS import passed to an imported native-ESM callable as a possible public value escape", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; import { identity } from "./identity.js"; export const ontologyParser = identity(parseOntology);';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("possible-public-value-escape");
  });

  test("keeps a private class field as an implementation detail", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { #ontologyParser = parseOntology; parse(model) { return this.#ontologyParser(model); } }';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("static");
  });

  test("classifies a private class field exposed by a public getter as a possible public value escape", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { #ontologyParser = parseOntology; get ontologyParser() { return this.#ontologyParser; } }';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("possible-public-value-escape");
  });

  test.each([
    [
      "method",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { #getParser() { return parseOntology; } getParser() { return this.#getParser(); } }',
    ],
    [
      "getter",
      'import parseOntology from "../parser.js"; export class OntologyParserAccess { get #parser() { return parseOntology; } getParser() { return this.#parser; } }',
    ],
  ])(
    "classifies an approved private CommonJS import exposed by a private class %s as a possible public value escape",
    (_privateMemberKind, adapterSource) => {
      expect(
        moduleSpecifierExposureClassification(
          adapterSource,
          D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
          "../parser.js",
        ),
      ).toBe("possible-public-value-escape");
    },
  );

  test("does not expose an IIFE argument that is only inspected privately", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export const isParserCallable = ((parser) => typeof parser === "function")(parseOntology);';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("static");
  });

  test("classifies an IIFE argument that becomes its public result as a possible public value escape", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export const ontologyParser = ((value) => value)(parseOntology);';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("possible-public-value-escape");
  });

  test("does not expose an argument that a module-local helper only inspects", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; function isCallable(value) { return typeof value === "function"; } export const isParserCallable = isCallable(parseOntology);';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("static");
  });

  test("does not reverse containment when a private parent is mutated", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export const ontologyParserAccess = {}; const privateContainer = { ontologyParserAccess }; Object.assign(privateContainer, { parseOntology });';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("static");
  });

  test("does not treat a nested private assignment as a public CommonJS re-export", () => {
    const adapterSource =
      'import parseOntology from "../parser.js"; export const isParserCallable = (() => { const privateParser = parseOntology; return typeof privateParser === "function"; })();';

    expect(
      moduleSpecifierExposureClassification(
        adapterSource,
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        "../parser.js",
      ),
    ).toBe("static");
  });

  test("rejects an unapproved CommonJS dependency below an approved private leaf", () => {
    const authoredModuleSourceByPath = new Map([
      [
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        'import classDragger from "../classDragger.js"; export function createRenderedGraph() { return classDragger({}); }',
      ],
      [
        "src/webvowl/js/classDragger.js",
        'module.exports = require("./unapprovedRendererDependency.js");',
      ],
      [
        "src/webvowl/js/unapprovedRendererDependency.js",
        "module.exports = {};",
      ],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
            moduleSpecifier: "../classDragger.js",
            resolvedModulePath: "src/webvowl/js/classDragger.js",
          },
          {
            declarationKind: "require",
            importerPath: "src/webvowl/js/classDragger.js",
            moduleSpecifier: "./unapprovedRendererDependency.js",
            resolvedModulePath:
              "src/webvowl/js/unapprovedRendererDependency.js",
          },
        ],
      ).blockingViolations,
    ).toEqual([
      "src/webvowl/js/classDragger.js -> src/webvowl/js/unapprovedRendererDependency.js: unapproved CommonJS dependency",
    ]);
  });

  test("traverses CommonJS dependencies that remain inside the approved private leaf set", () => {
    const authoredModuleSourceByPath = new Map([
      [
        D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
        'import classDragger from "../classDragger.js"; export function createRenderedGraph() { return classDragger({}); }',
      ],
      [
        "src/webvowl/js/classDragger.js",
        'module.exports = require("./domainDragger.js");',
      ],
      ["src/webvowl/js/domainDragger.js", "module.exports = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: D3_RENDERED_GRAPH_ADAPTER_MODULE_PATH,
            moduleSpecifier: "../classDragger.js",
            resolvedModulePath: "src/webvowl/js/classDragger.js",
          },
          {
            declarationKind: "require",
            importerPath: "src/webvowl/js/classDragger.js",
            moduleSpecifier: "./domainDragger.js",
            resolvedModulePath: "src/webvowl/js/domainDragger.js",
          },
        ],
      ),
    ).toEqual({ advisoryFindings: [], blockingViolations: [] });
  });

  test("rejects a dependency identified by a CommonJS module extension", () => {
    const authoredModuleSourceByPath = new Map([
      [
        "src/app/js/controller/root.js",
        'import "../legacy/module.cjs"; export const contract = {};',
      ],
      ["src/app/js/legacy/module.cjs", "export const misleadingSyntax = {};"],
    ]);

    expect(
      collectDependencyCruiserGraphFixtureDiagnostics(
        authoredModuleSourceByPath,
        [
          {
            importerPath: "src/app/js/controller/root.js",
            moduleSpecifier: "../legacy/module.cjs",
            resolvedModulePath: "src/app/js/legacy/module.cjs",
          },
        ],
      ).blockingViolations,
    ).toEqual([
      "src/app/js/controller/root.js -> src/app/js/legacy/module.cjs: unapproved CommonJS dependency",
    ]);
  });

  test.each([
    ["computed module export", 'module["exports"] = {};'],
    [
      "exports mutation API",
      'Object.defineProperty(exports, "feature", { value: true });',
    ],
  ])(
    "rejects an imported dependency with a %s",
    (_scenario, dependencySource) => {
      const authoredModuleSourceByPath = new Map([
        [
          "src/app/js/controller/root.js",
          'import "../legacy/module.js"; export const contract = {};',
        ],
        ["src/app/js/legacy/module.js", dependencySource],
      ]);

      expect(
        collectDependencyCruiserGraphFixtureDiagnostics(
          authoredModuleSourceByPath,
          [
            {
              importerPath: "src/app/js/controller/root.js",
              moduleSpecifier: "../legacy/module.js",
              resolvedModulePath: "src/app/js/legacy/module.js",
            },
          ],
        ).blockingViolations,
      ).toEqual([
        "src/app/js/controller/root.js -> src/app/js/legacy/module.js: unapproved CommonJS dependency",
      ]);
    },
  );
});

describe("scoped production native-ESM ratchet", () => {
  test.each([
    ["controller.js", true],
    ["controller.mjs", true],
    ["controller.cjs", true],
    ["controller.json", false],
    ["controller.css", false],
  ])(
    "classifies the authored JavaScript module filename %s",
    (filename, expectedClassification) => {
      expect(hasAuthoredJavaScriptModuleExtension(filename)).toBe(
        expectedClassification,
      );
    },
  );

  test("declares the exact required native-ESM directories", () => {
    expect(REQUIRED_NATIVE_ESM_DIRECTORY_PATHS).toEqual([
      "src/app/js/controller",
      "src/app/js/ui",
      "src/app/js/webmcp",
      "src/webvowl/js/runtime",
    ]);
  });

  test("records the exact deletion-bound Task 9 application D3 migration sources", () => {
    expect(APPLICATION_D3_MIGRATION_SOURCE_PATHS).toEqual([
      "src/app/js/app.js",
      "src/app/js/menu/exportMenu.js",
    ]);
    expect(Object.isFrozen(APPLICATION_D3_MIGRATION_SOURCE_PATHS)).toBe(true);
  });

  test("keeps the Task 9 composition source from requiring migrated native-ESM UI modules", () => {
    const dependencyGraph = discoverAuthoredJavaScriptModuleDependencyGraph([
      "src/app/js/app.js",
    ]);
    const applicationModuleRecord = dependencyGraph.find(
      ({ source }) => source === "src/app/js/app.js",
    );
    const taskFiveUiModulePaths = new Set(
      TASK_5_NATIVE_UI_PRODUCTION_MODULE_PATHS,
    );

    expect(
      applicationModuleRecord.dependencies
        .filter(
          ({ dependencyTypes, resolved }) =>
            dependencyTypes.includes("require") &&
            taskFiveUiModulePaths.has(resolved),
        )
        .map(({ resolved }) => resolved)
        .sort(),
    ).toEqual([]);
  });

  // Task 5 deferred the migrated UI modules behind one dynamic-import boundary
  // while the composition root was still CommonJS. Task 9 converts that root to
  // native ESM, so the boundary is now a native-ESM module that still reaches
  // every Task 5 UI module through the same deferred specifiers.
  test("keeps the native-ESM composition root loading every Task 5 UI module", () => {
    const applicationModulePath = "src/app/js/app.js";
    const applicationSourceStructure = analyzeAuthoredJavaScriptModule(
      readFileSync(absoluteRepositoryPath(applicationModulePath), "utf8"),
      applicationModulePath,
    );
    const expectedDynamicModuleSpecifiers =
      TASK_5_NATIVE_UI_PRODUCTION_MODULE_PATHS.map(
        (modulePath) => `./${path.posix.basename(modulePath)}`,
      );

    expect(applicationSourceStructure.syntaxErrorMessage).toBeUndefined();
    expect(applicationSourceStructure.hasNativeEsmDeclaration).toBe(true);
    expect(
      applicationSourceStructure.moduleSpecifierRecords
        .filter(({ kind }) => kind === "dynamic")
        .map(({ specifier }) => specifier)
        .sort(),
    ).toEqual([...expectedDynamicModuleSpecifiers].sort());
    expect(
      applicationSourceStructure.prohibitedSourcePatternLabels,
    ).not.toContain("CommonJS module export");
  });

  test("requires every declared native-ESM module to exist", () => {
    expect(
      requiredNativeEsmModulePaths().filter(
        (modulePath) => !existsSync(absoluteRepositoryPath(modulePath)),
      ),
    ).toEqual([]);
  });

  test("keeps every required module native ESM with explicit relative extensions and named exports", () => {
    const violations = requiredNativeEsmModulePaths().flatMap((modulePath) => {
      if (!existsSync(absoluteRepositoryPath(modulePath))) {
        return [];
      }
      return inspectNativeEsmModule(modulePath).map(
        (violation) => `${modulePath}: ${violation}`,
      );
    });

    expect(violations).toEqual([]);
  });

  test("keeps the required native-ESM dependency graph free of blocking module-boundary violations", () => {
    const dependencyGraph = discoverAuthoredJavaScriptModuleDependencyGraph(
      requiredNativeEsmModulePaths(),
    );
    const { advisoryFindings, blockingViolations } =
      collectNativeEsmDependencyGraphDiagnostics(dependencyGraph);

    reportNativeEsmDependencyGraphAdvisories(advisoryFindings);
    expect(blockingViolations).toEqual([]);
  });

  test("reviews this architecture test's executable syntax while treating fixture source as data", () => {
    expect(inspectNativeEsmModule(ARCHITECTURE_TEST_MODULE_PATH)).toEqual([]);
  });

  test("self-review rejects executable CommonJS added outside fixture data", () => {
    const architectureTestSource = readFileSync(
      absoluteRepositoryPath(ARCHITECTURE_TEST_MODULE_PATH),
      "utf8",
    );

    expect(
      inspectNativeEsmSource(
        `${architectureTestSource}\nrequire("./executable-commonjs.js");`,
        ARCHITECTURE_TEST_MODULE_PATH,
      ),
    ).toContain("CommonJS require");
  });

  test("has no approved default-export exception", () => {
    expect(APPROVED_DEFAULT_EXPORT_MODULE_PATHS).toEqual([]);
  });
});

describe("Task 1 private CommonJS renderer evidence", () => {
  test("is exact, sorted, unique, and frozen at the conservative 30-leaf maximum", () => {
    expect(TASK_1_COMMONJS_RENDERER_LEAF_PATHS).toHaveLength(30);
    expect(TASK_1_COMMONJS_RENDERER_LEAF_PATHS).toEqual(
      sortedUniqueEntries(TASK_1_COMMONJS_RENDERER_LEAF_PATHS),
    );
    expect(Object.isFrozen(TASK_1_COMMONJS_RENDERER_LEAF_PATHS)).toBe(true);
    expect(
      Object.keys(TASK_1_COMMONJS_RENDERER_LEAF_CONTENT_SHA256_BY_PATH).sort(),
    ).toEqual(TASK_1_COMMONJS_RENDERER_LEAF_PATHS);
  });

  test("never treats the uncut public graph, entries, options, or application modules as private leaves", () => {
    expect(
      CURRENT_PUBLIC_OR_APPLICATION_COMMONJS_PATHS.filter((modulePath) =>
        TASK_1_COMMONJS_RENDERER_LEAF_PATHS.includes(modulePath),
      ),
    ).toEqual([]);
  });

  test("allows the current legacy renderer set only to shrink", () => {
    expect(LEGACY_COMMONJS_RENDERER_LEAF_PATHS).toEqual(
      sortedUniqueEntries(LEGACY_COMMONJS_RENDERER_LEAF_PATHS),
    );
    expect(
      LEGACY_COMMONJS_RENDERER_LEAF_PATHS.filter(
        (modulePath) =>
          !TASK_1_COMMONJS_RENDERER_LEAF_PATHS.includes(modulePath),
      ),
    ).toEqual([]);
  });

  test("keeps every retained CommonJS leaf byte-identical to its Task 1 evidence", () => {
    const violations = LEGACY_COMMONJS_RENDERER_LEAF_PATHS.flatMap(
      (modulePath) => {
        const absolutePath = absoluteRepositoryPath(modulePath);
        if (!existsSync(absolutePath)) {
          return [`${modulePath}: missing`];
        }
        if (!statSync(absolutePath).isFile()) {
          return [`${modulePath}: not a file`];
        }
        const expectedSha256Hex =
          TASK_1_COMMONJS_RENDERER_LEAF_CONTENT_SHA256_BY_PATH[modulePath];
        const actualSha256Hex = sha256Hex(absolutePath);
        return actualSha256Hex === expectedSha256Hex
          ? []
          : [`${modulePath}: content changed`];
      },
    );

    expect(violations).toEqual([]);
  });

  test("ratchets the rendered-graph cutover composition and runtime paths", () => {
    expect(
      RETIRED_AT_RENDERED_GRAPH_CUTOVER_PATHS.filter((modulePath) =>
        activeCommonJsRendererLeafPaths.includes(modulePath),
      ),
    ).toEqual([]);
    expect(REQUIRED_NATIVE_ESM_MODULE_PATHS).toContain("src/main.js");
    expect(REQUIRED_NATIVE_ESM_MODULE_PATHS).toContain(
      "src/webvowl/js/runtime/d3RenderedGraphAdapter.js",
    );
  });
});
