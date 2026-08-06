import { defineConfig, normalizePath } from "vite";
import { resolve, relative } from "node:path";
import { readFileSync, existsSync, rmSync, statSync, utimesSync, readdirSync } from "node:fs";
import commonjs from "vite-plugin-commonjs";
import replace from "@rollup/plugin-replace";
import { viteStaticCopy } from "vite-plugin-static-copy";
import eslintPlugin from "vite-plugin-eslint2";
import stylelint from "vite-plugin-stylelint";
import { HtmlValidate, FileSystemConfigLoader, formatterFactory } from "html-validate";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

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
          ""
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

      const deployDir = resolve(__dirname, "deploy");
      if (!existsSync(deployDir)) return;

      // 1. Remove non-prod data files
      const filesToRemove = [
        // Remove benchmark data file (replicates grunt clean:testOntology)
        "data/benchmark.json",
        "data/personasonto.owl.java.json"
      ];

      for (const file of filesToRemove) {
        const filePath = resolve(deployDir, file);

        if (existsSync(filePath)) {
          rmSync(filePath, { force: true });
          console.log(`[webvowl-build] Removed deploy/${file} (production release)`);
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
            const relPath = relative(__dirname, fullPath).replace(/\\/g, "/");
            console.log(`[webvowl-build] Removed ${relPath} (production release)`);
          }
        }
      };

      removeMapFiles(deployDir);
    }
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
      const outDir = resolve(__dirname, "deploy");
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
              content
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
            meta.content.toString().replace(/\r\n/g, "\n") === currentContent.toString().replace(/\r\n/g, "\n");

          if (isIdentical) {
            utimesSync(fullPath, meta.atime, meta.mtime);
          }
        }
      }
    }
  };
}

/**
 * Injects local `var d3 = window.d3` at top of modules to eliminate window property lookups in D3 tick loops.
 */
function d3ProvidePlugin() {
  return {
    name: "d3-provide",
    transform(code, id) {
      if (id.includes("src") && id.endsWith(".js") && /\bd3\b/.test(code)) {
        return {
          code: 'var d3 = typeof window !== "undefined" ? window.d3 : globalThis.d3;\n' + code,
          map: null
        };
      }
    }
  };
}

/**
 * Injects static d3.min.js script tag into HTML during build without Vite warning.
 */
function d3InjectScriptPlugin() {
  return {
    name: "d3-inject-script",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { src: "js/d3.min.js" },
          injectTo: "head-prepend"
        }
      ];
    }
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
        ctx.filename || resolve(__dirname, "src/index.html")
      );

      if (!report.valid) {
        const formatter = formatterFactory("stylish");
        const formatted = formatter(report.results);
        console.error("\n[html-validate] HTML validation errors found:\n" + formatted);
        if (mode === "production") {
          throw new Error("HTML validation failed during production build.");
        }
      }
      return html;
    }
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
      outDir: resolve(__dirname, "deploy"),
      emptyOutDir: false,
      target: "es2022",
      minify: isProd,
      cssMinify: true,
      sourcemap: !isProd, // Source maps in dev only
      rollupOptions: {
        external: ["d3"],
        output: {
          globals: {
            d3: "d3"
          },
          // Rolldown / Oxc native option to strip legal comments
          comments: {
            legal: false
          },
          // Fixed filenames without content hashes
          entryFileNames: "js/[name].js",
          chunkFileNames: "js/[name].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.names?.[0]?.endsWith(".css")) {
              return "css/[name].[ext]";
            }
            return "[name].[ext]";
          },
          manualChunks(id) {
            if (id.includes("node_modules")) {
              return "vendor";
            }
          }
        }
      }
    },

    plugins: [
      mtimePreservePlugin(),
      d3ProvidePlugin(),
      d3InjectScriptPlugin(),
      commonjs(),
      // Replace @@WEBVOWL_VERSION placeholder in JS source files with the package version
      replace({
        "@@WEBVOWL_VERSION": pkg.version,
        preventAssignment: true,
        include: [resolve(__dirname, "src/**/*.js")]
      }),
      // Copy static assets to deploy/
      viteStaticCopy({
        targets: [
          {
            src: normalizePath(resolve(__dirname, "node_modules/d3/dist/d3.min.js")),
            dest: "js",
            rename: { stripBase: true }
          },
          {
            src: "app/data/*",
            dest: "data",
            rename: { stripBase: true }
          },
          { src: "favicon.ico", dest: "." },
          { src: "favicon.svg", dest: "." },
          {
            src: normalizePath(resolve(__dirname, "LICENSE")),
            // Bypasses the '.' collapse bug
            // as per http://gemini.google.com/app/793f7f5228862e6b
            dest: "deploy",
            rename: { name: "license.txt" }
          }
        ]
      }),
      // ESLint integration during dev and build
      eslintPlugin({
        lintOnStart: true,
        include: [resolve(__dirname, "src/**/*.js")]
      }),
      // Stylelint integration during dev and build for CSS files
      stylelint({
        lintOnStart: true,
        include: [resolve(__dirname, "src/**/*.css")]
      }),
      htmlValidatePlugin(mode),
      webvowlBuildPlugin(mode)
    ],

    // Dev server configuration
    server: {
      port: 8000
    },

    // Preview server (serves the production build locally)
    preview: {
      port: 8000
    }
  };
});
