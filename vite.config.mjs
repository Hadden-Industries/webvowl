import { defineConfig, normalizePath } from "vite";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
} from "node:fs";
import replace from "@rollup/plugin-replace";
import { viteStaticCopy } from "vite-plugin-static-copy";
import eslintPlugin from "vite-plugin-eslint2";
import stylelint from "vite-plugin-stylelint";
import { createGeneratedAssetCleanupPlugin } from "./util/generatedAssetCleanup.mjs";
import {
  HtmlValidate,
  FileSystemConfigLoader,
  formatterFactory,
} from "html-validate";

const configDir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(configDir, "package.json"), "utf-8"),
);

/** Process the HTML template and production-only markup. */
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
  };
}

/**
 * Preserves last modified timestamps (mtime) on deploy/ files post-build if content is unchanged.
 */
function mtimePreservePlugin() {
  const fileCache = new Map();
  let outDir;

  return {
    name: "mtime-preserve",

    configResolved(configuration) {
      outDir = configuration.build.outDir;
    },

    buildStart() {
      fileCache.clear();
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
  const isCanonicalCandidate = mode === "canonical";
  const generatedAssets = createGeneratedAssetCleanupPlugin();

  return {
    // Relative base path allows deployment under subdirectories (e.g. https://domain.com/webvowl/)
    base: "./",
    // index.html remains at src/index.html (project convention preserved)
    root: "src",
    publicDir: false,

    // The linked core and lazy OWL entry share module-owned model identities.
    // Prebundle both before the first worker load, including a fresh dev cache.
    optimizeDeps: {
      include: ["vowl", "vowl/owl"],
    },

    // Native dynamic imports keep OWL parsers out of canonical-only worker jobs.
    worker: {
      format: "es",
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                // Keep shared model ownership outside the worker entry: WebKit
                // can evaluate that entry again when a lazy parser imports it.
                name: "vowl-core",
                test: /packages[\\/]vowl[\\/]src[\\/]index\.js$/u,
              },
            ],
          },
        },
      },
    },

    build: {
      outDir: resolve(
        configDir,
        isCanonicalCandidate
          ? "node_modules/.cache/webvowl-canonical"
          : "deploy",
      ),
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
                // Keep the optional catalog parser out of disabled startup.
                name: "vendor-ontology-cache",
                test: /node_modules[\\/]@xmldom[\\/]xmldom(?:[\\/]|$)/u,
                priority: 50,
              },
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
      ...(isCanonicalCandidate
        ? [
            {
              name: "webvowl-canonical-candidate-entry",
              transformIndexHtml: {
                order: "pre",
                handler: (html) =>
                  html.replace(
                    '<script type="module" src="main.js"></script>',
                    '<script type="module" src="canonical-main.js"></script>',
                  ),
              },
            },
          ]
        : []),
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
            transform: {
              encoding: "buffer",
              handler(content, source) {
                const name = basename(source);
                if (
                  isProd &&
                  ["benchmark.json", "personasonto.owl.java.json"].includes(
                    name,
                  )
                )
                  return null;
                return generatedAssets.api.recordCopiedAsset(
                  `data/${name}`,
                  content,
                );
              },
            },
          },
          {
            src: "app/fonts/open-sans/OFL.txt",
            dest: "licenses/open-sans",
            rename: { stripBase: true },
            transform: {
              encoding: "buffer",
              handler: (content) =>
                generatedAssets.api.recordCopiedAsset(
                  "licenses/open-sans/OFL.txt",
                  content,
                ),
            },
          },
          {
            src: "favicon.ico",
            dest: ".",
            transform: {
              encoding: "buffer",
              handler: (content) =>
                generatedAssets.api.recordCopiedAsset("favicon.ico", content),
            },
          },
          {
            src: "favicon.svg",
            dest: ".",
            transform: {
              encoding: "buffer",
              handler: (content) =>
                generatedAssets.api.recordCopiedAsset("favicon.svg", content),
            },
          },
          {
            src: normalizePath(resolve(configDir, "LICENSE")),
            // Bypasses the '.' collapse bug
            // as per http://gemini.google.com/app/793f7f5228862e6b
            dest: "deploy",
            rename: { name: "license.txt" },
            transform: {
              encoding: "buffer",
              handler: (content) =>
                generatedAssets.api.recordCopiedAsset("license.txt", content),
            },
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
      generatedAssets,
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
