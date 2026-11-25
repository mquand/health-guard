// Render preview PNGs of every effect so the art can be checked without opening VS Code.
//   node scripts/preview.mjs            -> preview/<effect>.png (3x, 240x160 each)
//   node scripts/preview.mjs eyeball    -> only that effect
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { encodePNG, scaleRGBA } from "./lib/png.mjs";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "preview");
const tmp = resolve(root, ".tmp", "renderer-preview.mjs");
mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(root, ".tmp"), { recursive: true });

await build({
  entryPoints: [resolve(root, "src/webview/renderer.js")],
  outfile: tmp,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});

const { Scene, EFFECT_IDS } = await import(pathToFileURL(tmp).href);
const KINDS = {
  eyeball: "eye",
  halo: "eye",
  heal: "eye",
  fountain: "water",
  potion: "water",
  "water-orb": "water",
  frog: "walk",
  bird: "walk",
  butterfly: "walk",
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const effects = wanted.length ? wanted : EFFECT_IDS;
const scale = Number(process.argv.find((a) => a.startsWith("--scale="))?.split("=")[1] ?? 3);
const at = Number(process.argv.find((a) => a.startsWith("--at="))?.split("=")[1] ?? 1.2);

for (const effect of effects) {
  const scene = new Scene({ kind: KINDS[effect], effect, seed: 3 });
  const steps = Math.round(at * 30);
  for (let i = 0; i < steps; i++) scene.update(1 / 30);
  const bytes = scene.draw();
  const file = resolve(outDir, `${effect}.png`);
  writeFileSync(file, encodePNG(scene.w * scale, scene.h * scale, scaleRGBA(scene.w, scene.h, bytes, scale)));
  console.log(`${effect} -> ${file}`);
}
