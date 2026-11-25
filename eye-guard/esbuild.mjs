// Build the extension host bundle (CommonJS, Node) and the webview bundle (browser IIFE).
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  logLevel: "info",
};

/** @type {import('esbuild').BuildOptions[]} */
const configs = [
  {
    ...shared,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    format: "cjs",
    target: "node18",
    external: ["vscode"],
  },
  {
    ...shared,
    entryPoints: ["src/webview/main.js"],
    outfile: "media/webview.js",
    platform: "browser",
    format: "iife",
    target: "es2020",
  },
];

if (watch) {
  const contexts = await Promise.all(configs.map((c) => esbuild.context(c)));
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("watching…");
} else {
  await Promise.all(configs.map((c) => esbuild.build(c)));
}
