import { defineConfig, normalizePath } from "vite";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import replace from "@rollup/plugin-replace";
import { viteStaticCopy } from "vite-plugin-static-copy";
import eslintPlugin from "vite-plugin-eslint2";
import stylelint from "vite-plugin-stylelint";
import {
  HtmlValidate,
  FileSystemConfigLoader,
  formatterFactory,
} from "html-validate";

const configDir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(configDir, "package.json"), "utf-8"),
);

const generatedJavaScriptManifestPath = ".vite/webvowl-generated-js.json";
const preManifestGeneratedJavaScriptFiles = [
  "js/d3.min.js",
  "js/directInputModule.js",
  "js/index.js",
  "js/jsonld.esm.js",
  "js/jsonld.js",
  "js/languageTools.js",
  "js/leftSidebar.js",
  "js/loadingModule.js",
  "js/n3.min.js",
  "js/ontologyEditorSidebar.js",
  "js/popover.js",
  "js/rdfxml-streaming-parser.js",
  "js/rolldown-runtime.js",
  "js/sidebar.js",
  "js/src.js",
  "js/vendor~index.js",
  "js/vendor~index2.js",
  "js/vendor~index3.js",
  "js/vendor~index~index.js",
  "js/vendor~jsonld.esm.js",
  "js/vendor~jsonld.js",
  "js/vendor~n3.min.js",
  "js/vendor~popover.js",
  "js/visualizationControlAction.js",
  "js/visualizationShareLink.js",
  "js/vowlDocument.js",
  "js/warningModule.js",
];

function webvowlGeneratedJavaScriptCleanupPlugin() {
  let outputDirectory;
  let emittedJavaScriptFiles = new Set();
  let wroteBundle = false;

  return {
    name: "webvowl-generated-javascript-cleanup",
    apply: "build",

    configResolved(configuration) {
      outputDirectory = configuration.build.outDir;
    },

    buildStart() {
      emittedJavaScriptFiles = new Set();
      wroteBundle = false;
    },

    generateBundle(_outputOptions, bundle, isWrite) {
      wroteBundle ||= isWrite;
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && output.fileName.endsWith(".js")) {
          emittedJavaScriptFiles.add(output.fileName.replaceAll("\\", "/"));
        }
      }
    },

    closeBundle() {
      if (!outputDirectory || !wroteBundle) return;

      const manifestPath = resolve(
        outputDirectory,
        generatedJavaScriptManifestPath,
      );
      let previouslyGeneratedFiles = [];
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (
          manifest.schemaVersion !== 1 ||
          !Array.isArray(manifest.files) ||
          !manifest.files.every((fileName) => typeof fileName === "string")
        ) {
          throw new Error(
            `Invalid generated JavaScript manifest: ${manifestPath}`,
          );
        }
        previouslyGeneratedFiles = manifest.files;
      }

      for (const fileName of new Set([
        ...preManifestGeneratedJavaScriptFiles,
        ...previouslyGeneratedFiles,
      ])) {
        const normalizedFileName = fileName.replaceAll("\\", "/");
        if (
          !/^js\/[A-Za-z0-9._~-]+\.js$/u.test(normalizedFileName) ||
          emittedJavaScriptFiles.has(normalizedFileName)
        ) {
          continue;
        }
        rmSync(resolve(outputDirectory, normalizedFileName), { force: true });
      }

      mkdirSync(dirname(manifestPath), { recursive: true });
      writeFileSync(
        manifestPath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            files: [...emittedJavaScriptFiles].sort(),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    },
  };
}

/**
 * Custom Vite plugin that handles HTML template processing and post-build cleanup.
 * Replaces grunt-html-build & grunt clean:testOntology functionality:
 *   - Injects package version into __WEBVOWL_VERSION__ template expressions
 *   - Strips <!-- build:process --> / <!-- /build --> comment markers
 *   - In production: removes <!-- build:remove release--> blocks (benchmark ontology link)
 *   - In production: deletes deploy/data/benchmark.json and cleans up leftover .map files
 */
function webvowlBuildPlugin(mode) {
  return {
    name: "webvowl-build",

    transformIndexHtml(html) {
      let processedHtml = html;

      // 1. In production, remove <!-- build:remove release-->...<!-- /build --> blocks
      if (mode === "production") {
        processedHtml = processedHtml.replace(
          /[ \t]*<!-- build:remove release\s*-->[\s\S]*?<!-- \/build -->\s*/g,
          "",
        );
      }

      // 2. Strip <!-- build:process --> and remaining <!-- /build --> comment markers
      processedHtml = processedHtml
        .replace(/\s*<!-- build:process -->\s*/g, "\n")
        .replace(/\s*<!-- \/build -->\s*/g, "\n");

      // 3. Replace __WEBVOWL_VERSION__ template expressions with package version
      return processedHtml.replaceAll("__WEBVOWL_VERSION__", pkg.version);
    },

    closeBundle() {
      // Post-build cleanup actions only run in production
      if (mode !== "production") return;

      const deployDir = resolve(configDir, "deploy");
      if (!existsSync(deployDir)) return;

      // 1. Remove non-prod data files
      const filesToRemove = [
        // Remove benchmark data file (replicates grunt clean:testOntology)
        "data/benchmark.json",
        "data/personasonto.owl.java.json",
      ];

      for (const file of filesToRemove) {
        const filePath = resolve(deployDir, file);

        if (existsSync(filePath)) {
          rmSync(filePath, { force: true });
          console.log(
            `[webvowl-build] Removed deploy/${file} (production release)`,
          );
        }
      }

      // 2. Clean up any sourcemaps (.map files) in the deploy directory
      const removeMapFiles = (dir) => {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = resolve(dir, entry.name);
          if (entry.isDirectory()) {
            removeMapFiles(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".map")) {
            rmSync(fullPath, { force: true });
            const relPath = relative(configDir, fullPath).replace(/\\/g, "/");
            console.log(
              `[webvowl-build] Removed ${relPath} (production release)`,
            );
          }
        }
      };

      removeMapFiles(deployDir);
    },
  };
}

/**
 * Preserves last modified timestamps (mtime) on deploy/ files post-build if content is unchanged.
 */
function mtimePreservePlugin() {
  const fileCache = new Map();

  return {
    name: "mtime-preserve",

    buildStart() {
      fileCache.clear();
      const outDir = resolve(configDir, "deploy");
      if (!existsSync(outDir)) return;

      const scan = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = resolve(dir, entry.name);
          if (entry.isDirectory()) {
            scan(fullPath);
          } else if (entry.isFile()) {
            const stat = statSync(fullPath);
            const content = readFileSync(fullPath);
            fileCache.set(fullPath, {
              atime: stat.atime,
              mtime: stat.mtime,
              content,
            });
          }
        }
      };
      scan(outDir);
    },

    closeBundle() {
      for (const [fullPath, meta] of fileCache.entries()) {
        if (existsSync(fullPath)) {
          const currentContent = readFileSync(fullPath);
          const isIdentical =
            meta.content.equals(currentContent) ||
            meta.content.toString().replace(/\r\n/g, "\n") ===
              currentContent.toString().replace(/\r\n/g, "\n");

          if (isIdentical) {
            utimesSync(fullPath, meta.atime, meta.mtime);
          }
        }
      }
    },
  };
}

/**
 * HTML-Validate linter integration plugin for src/index.html.
 */
function htmlValidatePlugin(mode) {
  return {
    name: "vite-plugin-html-validate",
    async transformIndexHtml(html, ctx) {
      const loader = new FileSystemConfigLoader();
      const htmlvalidate = new HtmlValidate(loader);
      const report = await htmlvalidate.validateString(
        html,
        ctx.filename || resolve(configDir, "src/index.html"),
      );

      if (!report.valid) {
        const formatter = formatterFactory("stylish");
        const formatted = formatter(report.results);
        console.error(
          "\n[html-validate] HTML validation errors found:\n" + formatted,
        );
        if (mode === "production") {
          throw new Error("HTML validation failed during production build.");
        }
      }
      return html;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === "production";

  return {
    // Relative base path allows deployment under subdirectories (e.g. https://domain.com/webvowl/)
    base: "./",
    // index.html remains at src/index.html (project convention preserved)
    root: "src",
    publicDir: false,

    build: {
      outDir: resolve(configDir, "deploy"),
      emptyOutDir: false,
      target: "es2022",
      minify: isProd,
      cssMinify: true,
      sourcemap: !isProd, // Source maps in dev only
      rolldownOptions: {
        output: {
          // Rolldown / Oxc native option to strip legal comments
          comments: {
            legal: false,
          },
          // Fixed filenames without content hashes
          entryFileNames: "js/[name].js",
          chunkFileNames: "js/[name].js",
          assetFileNames: (assetInfo) => {
            const assetName = assetInfo.names?.[0] ?? "";

            if (assetName.endsWith(".css")) {
              return "css/[name].[ext]";
            }

            if (assetName.endsWith(".woff2")) {
              return "fonts/[name].[ext]";
            }

            return "[name].[ext]";
          },
          codeSplitting: {
            groups: [
              {
                name: "vendor-parser-shared",
                test: /node_modules[\\/](?:abort-controller|base64-js|buffer|core-util-is|event-target-shim|events|ieee754|inherits|isarray|process|process-nextick-args|readable-stream|safe-buffer|string_decoder|util-deprecate)(?:[\\/]|$)/u,
                priority: 60,
              },
              {
                name: "vendor-parser-jsonld",
                test: /node_modules[\\/](?:@digitalbazaar[\\/]http-client|canonicalize|jsonld|ky|lru-cache|rdf-canonize|setimmediate|undici|yallist)(?:[\\/]|$)/u,
                priority: 50,
              },
              {
                name: "vendor-parser-n3",
                test: /node_modules[\\/]n3(?:[\\/]|$)/u,
                priority: 50,
              },
              {
                name: "vendor-parser-rdfxml",
                test: /node_modules[\\/](?:@rdfjs[\\/]types|@rubensworks[\\/]saxes|rdf-data-factory|rdfxml-streaming-parser|relative-to-absolute-iri|validate-iri|xmlchars)(?:[\\/]|$)/u,
                priority: 50,
              },
              {
                name: "vendor-popover",
                test: /node_modules[\\/]@oddbird[\\/]popover-polyfill(?:[\\/]|$)/u,
                priority: 50,
              },
              {
                name: "vendor-application",
                test: /node_modules[\\/]/u,
                priority: 1,
              },
            ],
          },
        },
      },
    },

    plugins: [
      webvowlGeneratedJavaScriptCleanupPlugin(),
      mtimePreservePlugin(),
      // Replace @@WEBVOWL_VERSION placeholder in JS source files with the package version
      replace({
        "@@WEBVOWL_VERSION": pkg.version,
        preventAssignment: true,
        include: [resolve(configDir, "src/**/*.js")],
      }),
      // Copy static assets to deploy/
      viteStaticCopy({
        targets: [
          {
            src: "app/data/*",
            dest: "data",
            rename: { stripBase: true },
          },
          {
            src: "app/fonts/open-sans/OFL.txt",
            dest: "licenses/open-sans",
            rename: { stripBase: true },
          },
          { src: "favicon.ico", dest: "." },
          { src: "favicon.svg", dest: "." },
          {
            src: normalizePath(resolve(configDir, "LICENSE")),
            // Bypasses the '.' collapse bug
            // as per http://gemini.google.com/app/793f7f5228862e6b
            dest: "deploy",
            rename: { name: "license.txt" },
          },
        ],
      }),
      // ESLint integration during dev and build
      eslintPlugin({
        lintOnStart: true,
        include: [resolve(configDir, "src/**/*.js")],
      }),
      // Stylelint integration during dev and build for CSS files
      stylelint({
        lintOnStart: true,
        include: [resolve(configDir, "src/**/*.css")],
      }),
      htmlValidatePlugin(mode),
      webvowlBuildPlugin(mode),
    ],

    // Dev server configuration
    server: {
      port: 8000,
    },

    // Preview server (serves the production build locally)
    preview: {
      port: 8000,
    },
  };
});
