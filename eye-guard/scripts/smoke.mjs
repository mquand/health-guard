// Headless smoke test: bundle the webview renderer for Node, then render every effect for a few seconds.
// Fails if a frame throws, has the wrong size, produces transparent/NaN pixels, or never animates.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const tmp = resolve(root, ".tmp", "renderer.mjs");
mkdirSync(resolve(root, ".tmp"), { recursive: true });

await build({
  entryPoints: [resolve(root, "src/webview/renderer.js")],
  outfile: tmp,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});

const { Scene, EFFECT_IDS, WIDTH, HEIGHT } = await import(pathToFileURL(tmp).href);

const KINDS = {
  eyeball: "eye",
  halo: "eye",
  heal: "eye",
  "fish-school": "eye",
  jellyfish: "eye",
  sleep: "eye",
  fountain: "water",
  potion: "water",
  "water-orb": "water",
  bubbles: "water",
  waterfall: "water",
  drip: "water",
  "rain-splash": "water",
  frog: "walk",
  bird: "walk",
  butterfly: "walk",
  snake: "walk",
  slime: "walk",
  wisp: "walk",
  "falling-leaves": "walk",
  "healing-bloom": "walk",
};

const failures = [];
const hash = (bytes) => {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i += 7) h = Math.imul(h ^ bytes[i], 16777619);
  return h >>> 0;
};

for (const effect of EFFECT_IDS) {
  try {
    const scene = new Scene({ kind: KINDS[effect], effect, seed: 3 });
    if (scene.w !== WIDTH || scene.h !== HEIGHT) failures.push(`${effect}: wrong size ${scene.w}x${scene.h}`);

    let first = null;
    let last = null;
    for (let i = 0; i < 90; i++) {
      scene.update(1 / 30);
      const bytes = scene.draw();
      if (bytes.length !== WIDTH * HEIGHT * 4) failures.push(`${effect}: wrong byte length`);
      if (!first) first = hash(bytes);
      last = hash(bytes);
      if (i === 0 || i === 89) {
        for (let p = 0; p < bytes.length; p += 4) {
          if (bytes[p + 3] !== 255) {
            failures.push(`${effect}: transparent pixel at frame ${i}`);
            break;
          }
        }
      }
    }

    if (first === last) failures.push(`${effect}: scene never animates`);

    // The art has to differ from its background: compare a middle slice against the scene background.
    const bg = scene.background;
    const bytes = scene.draw();
    let changed = 0;
    for (let i = 0; i < bg.length; i++) {
      const r = bg[i] & 255;
      const g = (bg[i] >>> 8) & 255;
      const b = (bg[i] >>> 16) & 255;
      if (bytes[i * 4] !== r || bytes[i * 4 + 1] !== g || bytes[i * 4 + 2] !== b) changed++;
    }
    if (changed < 250) failures.push(`${effect}: only ${changed} pixels drawn over the background`);

    console.log(`ok  ${effect.padEnd(10)} ${changed} pixels over background`);
  } catch (error) {
    failures.push(`${effect}: threw ${error?.stack || error}`);
  }
}

if (failures.length) {
  console.error("\nFAILED");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("\nAll effects rendered cleanly.");
