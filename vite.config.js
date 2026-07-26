import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, existsSync, unlinkSync, statSync, utimesSync, readdirSync } from "fs";
import commonjs from "vite-plugin-commonjs";
import inject from "@rollup/plugin-inject";
import replace from "@rollup/plugin-replace";
import { viteStaticCopy } from "vite-plugin-static-copy";
import eslintPlugin from "vite-plugin-eslint2";
import stylelint from "vite-plugin-stylelint";
import { HtmlValidate, FileSystemConfigLoader, formatterFactory } from "html-validate";

var pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

/**
 * Custom Vite plugin that handles HTML template processing and post-build cleanup.
 * Replaces grunt-html-build functionality:
 *   - Injects package version into <%= version %> template expressions
 *   - Strips <!-- build:process --> / <!-- /build --> comment markers
 *   - In production: removes <!-- build:remove release--> blocks (benchmark ontology link)
 *   - In production: deletes deploy/data/benchmark.json (replaces grunt clean:testOntology)
 */
function webvowlBuildPlugin(mode) {
  return {
    name: "webvowl-build",

    transformIndexHtml(html) {
      // 1. In production, remove <!-- build:remove release-->...<!-- /build --> blocks
      if (mode === "production") {
        html = html.replace(
          /[ \t]*<!-- build:remove release\s*-->[\s\S]*?<!-- \/build -->\s*/g,
          ""
        );
      }

      // 2. Strip <!-- build:process --> and remaining <!-- /build --> comment markers
      html = html.replace(/\s*<!-- build:process -->\s*/g, "\n");
      html = html.replace(/\s*<!-- \/build -->\s*/g, "\n");

      // 3. Replace __WEBVOWL_VERSION__ template expressions with package version
      html = html.replace(/__WEBVOWL_VERSION__/g, pkg.version);

      return html;
    },

    closeBundle() {
      // In production, remove benchmark data file (replicates grunt clean:testOntology) and any CSS/JS .map files
      if (mode === "production") {
        var benchmarkPath = resolve(__dirname, "deploy/data/benchmark.json");
        if (existsSync(benchmarkPath)) {
          unlinkSync(benchmarkPath);
          console.log("Removed deploy/data/benchmark.json (production release)");
        }

        var deployDir = resolve(__dirname, "deploy");
        if (existsSync(deployDir)) {
          var cleanMaps = function(dir) {
            var entries = readdirSync(dir, { withFileTypes: true });
            for (var i = 0; i < entries.length; i++) {
              var fullPath = resolve(dir, entries[i].name);
              if (entries[i].isDirectory()) {
                cleanMaps(fullPath);
              } else if (entries[i].isFile() && entries[i].name.endsWith(".map")) {
                unlinkSync(fullPath);
                var relPath = fullPath.replace(__dirname + "\\", "").replace(__dirname + "/", "");
                console.log("Removed " + relPath.replace(/\\/g, "/") + " (production release)");
              }
            }
          };
          cleanMaps(deployDir);
        }
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(function (env) {
  var mode = env.mode;
  var isProd = mode === "production";

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
      minify: isProd ? "esbuild" : false,
      cssMinify: true,
      sourcemap: !isProd,             // Source maps in dev only (replicates webpack devtool: "source-map")
      rollupOptions: {
        external: ["d3"],
        output: {
          globals: {
            d3: "d3"
          },
          // Fixed filenames without content hashes (replicates legacy Webpack/deploy output)
          entryFileNames: "js/[name].js",
          chunkFileNames: "js/[name].js",
          assetFileNames: function (assetInfo) {
            if (assetInfo.names && assetInfo.names[0] && assetInfo.names[0].endsWith(".css")) {
              return "css/[name].[ext]";
            }
            return "[name].[ext]";
          }
        }
      }
    },

    esbuild: {
      legalComments: "none"
    },

    plugins: [
      // Preserve last modified timestamps (mtime) on deploy/ files post-build if content is unchanged
      (function () {
        const fileCache = new Map();
        return {
          name: "mtime-preserve",
          buildStart() {
            fileCache.clear();
            const outDir = resolve(__dirname, "deploy");
            if (existsSync(outDir)) {
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
                      content: content
                    });
                  }
                }
              };
              scan(outDir);
            }
          },
          closeBundle() {
            for (const [fullPath, meta] of fileCache.entries()) {
              if (existsSync(fullPath)) {
                const currentContent = readFileSync(fullPath);
                const isIdentical = meta.content.equals(currentContent) ||
                  meta.content.toString().replace(/\r\n/g, "\n") === currentContent.toString().replace(/\r\n/g, "\n");

                if (isIdentical) {
                  utimesSync(fullPath, meta.atime, meta.mtime);
                }
              }
            }
          }
        };
      })(),

      // Inject local `var d3 = window.d3` at top of modules to eliminate window property lookups in D3 tick loops
      // Replicates webpack.ProvidePlugin({ d3: "d3" }) + externals: { "d3": "d3" }
      {
        name: "d3-provide",
        transform(code, id) {
          if (id.includes("src") && id.endsWith(".js") && /\bd3\b/.test(code)) {
            return {
              code: 'var d3 = typeof window !== "undefined" ? window.d3 : globalThis.d3;\n' + code,
              map: null
            };
          }
        }
      },

      // Transform CJS require()/module.exports to ESM (the entire src/ codebase uses CommonJS)
      commonjs(),

      // Replace @@WEBVOWL_VERSION placeholder in JS source files with the package version
      // Replicates grunt-replace task
      replace({
        "@@WEBVOWL_VERSION": pkg.version,
        preventAssignment: true,
        include: [resolve(__dirname, "src/**/*.js")]
      }),

      // Copy static assets to deploy/
      // Replicates grunt-contrib-copy + CopyWebpackPlugin
      viteStaticCopy({
        targets: [
          { src: "../node_modules/d3/dist/d3.min.js", dest: "js" },
          { src: "app/data/*", dest: "data" },
          { src: "favicon.ico", dest: "." },
          { src: "favicon.svg", dest: "." },
          { src: "../LICENSE", dest: ".", rename: "license.txt" }
        ]
      }),

      // ESLint integration during dev and build
      // Replicates eslint-webpack-plugin (uses the existing eslint.config.js flat config)
      eslintPlugin({
        lintOnStart: true,
        include: [resolve(__dirname, "src/**/*.js")]
      }),

      // Stylelint integration during dev and build for CSS files
      stylelint({
        lintOnStart: true,
        include: [resolve(__dirname, "src/**/*.css")]
      }),

      // HTML-Validate linter integration for src/index.html
      {
        name: "vite-plugin-html-validate",
        async transformIndexHtml(html, ctx) {
          const loader = new FileSystemConfigLoader();
          const htmlvalidate = new HtmlValidate(loader);
          const report = await htmlvalidate.validateString(html, ctx.filename || resolve(__dirname, "src/index.html"));
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
      },

      // HTML template processing and post-build cleanup
      webvowlBuildPlugin(mode)
    ],

    // Dev server configuration
    // Replicates grunt-contrib-connect devserver on port 8000 with livereload
    server: {
      port: 8000,
      open: true
    },

    // Preview server (serves the production build locally)
    preview: {
      port: 8000
    }
  };
});
