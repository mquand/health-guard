// Scene renderer for the reminder panel.
//
// The pixel art comes from pixelfx (https://github.com/patch-gg/pixelfx, MIT): each effect is a pure
// draw(t) / create() module. We render into a small 160x120 frame, composite it over a hand-made
// gradient background and hand the RGBA bytes to the canvas, scaled up with nearest-neighbour.
//
// This file is deliberately free of DOM access so scripts/smoke.mjs can render frames in Node.

import {
  clamp,
  clearFrame,
  composite,
  createFrame,
  createFx,
  hex,
  mix,
  drawActor,
  painterFor,
  rgb,
  red,
  green,
  blue,
  stockActor,
} from "../../vendor/pixelfx/core/index.js";

import * as eyeball from "../../vendor/pixelfx/fx/critters/eyeball.js";
import * as frog from "../../vendor/pixelfx/fx/critters/frog.js";
import * as bird from "../../vendor/pixelfx/fx/critters/bird.js";
import * as butterfly from "../../vendor/pixelfx/fx/critters/butterfly.js";
import * as fishSchool from "../../vendor/pixelfx/fx/critters/fish-school.js";
import * as jellyfish from "../../vendor/pixelfx/fx/critters/jellyfish.js";
import * as snake from "../../vendor/pixelfx/fx/critters/snake.js";
import * as slime from "../../vendor/pixelfx/fx/critters/slime.js";
import * as wisp from "../../vendor/pixelfx/fx/critters/wisp.js";
import * as halo from "../../vendor/pixelfx/fx/holy/halo.js";
import * as heal from "../../vendor/pixelfx/fx/holy/heal.js";
import * as fountain from "../../vendor/pixelfx/fx/water/fountain.js";
import * as waterOrb from "../../vendor/pixelfx/fx/water/water-orb.js";
import * as potion from "../../vendor/pixelfx/fx/pickups/potion.js";
import * as bubbles from "../../vendor/pixelfx/fx/water/bubbles.js";
import * as waterfall from "../../vendor/pixelfx/fx/water/waterfall.js";
import * as drip from "../../vendor/pixelfx/fx/water/drip.js";
import * as rainSplash from "../../vendor/pixelfx/fx/water/rain-splash.js";
import * as fallingLeaves from "../../vendor/pixelfx/fx/weather/falling-leaves.js";
import * as healingBloom from "../../vendor/pixelfx/fx/nature/healing-bloom.js";
import * as sleep from "../../vendor/pixelfx/fx/status/sleep.js";

export const WIDTH = 160;
export const HEIGHT = 120;

const MODULES = {
  eyeball,
  halo,
  heal,
  "fish-school": fishSchool,
  jellyfish,
  sleep,
  fountain,
  potion,
  "water-orb": waterOrb,
  bubbles,
  waterfall,
  drip,
  "rain-splash": rainSplash,
  frog,
  bird,
  butterfly,
  snake,
  slime,
  wisp,
  "falling-leaves": fallingLeaves,
  "healing-bloom": healingBloom,
};

// Where each effect's origin sits in the frame, and which scene palette it belongs to.
const PLACEMENT = {
  eyeball: { x: 80, y: 98, kind: "eye", options: { hover: 34 } },
  halo: { x: 80, y: 104, kind: "eye" },
  heal: { x: 80, y: 106, kind: "eye" },
  "fish-school": { x: 80, y: 64, kind: "eye" },
  jellyfish: { x: 80, y: 58, kind: "eye" },
  sleep: { x: 80, y: 104, kind: "eye" },
  fountain: { x: 80, y: 108, kind: "water" },
  potion: { x: 80, y: 94, kind: "water" },
  "water-orb": { x: 80, y: 104, kind: "water" },
  bubbles: { x: 80, y: 104, kind: "water" },
  waterfall: { x: 80, y: 110, kind: "water" },
  drip: { x: 80, y: 92, kind: "water" },
  "rain-splash": { x: 80, y: 84, kind: "water" },
  frog: { x: 80, y: 104, kind: "walk" },
  bird: { x: 80, y: 62, kind: "walk" },
  butterfly: { x: 80, y: 58, kind: "walk" },
  snake: { x: 80, y: 104, kind: "walk" },
  slime: { x: 80, y: 100, kind: "walk" },
  wisp: { x: 80, y: 96, kind: "walk" },
  "falling-leaves": { x: 80, y: 108, kind: "walk" },
  "healing-bloom": { x: 80, y: 104, kind: "walk" },
};

export const EFFECT_IDS = Object.keys(PLACEMENT);

const DEFAULT_EFFECT = { eye: "eyeball", water: "fountain", walk: "frog" };

const THEMES = {
  eye: { sky: ["#050b09", "#091710", "#0d2016"], glow: "#2f8a4a", spark: "#b6ffb2" },
  water: { sky: ["#04070f", "#071123", "#0a1a33"], glow: "#2a6fc4", spark: "#a8e8ff" },
  walk: { sky: ["#080512", "#110a1c", "#1b1026"], glow: "#7a4a9a", spark: "#ffd08a" },
};

const SPARK = {
  eye: hex(THEMES.eye.spark),
  water: hex(THEMES.water.spark),
  walk: hex(THEMES.walk.spark),
};

// 4x4 ordered dither: gradients in pixel art band on purpose instead of blending smoothly.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export class Scene {
  constructor({ kind = "eye", effect, seed = 1 } = {}) {
    const placement = PLACEMENT[effect] ?? PLACEMENT[DEFAULT_EFFECT[kind] ?? "eyeball"];
    const module = MODULES[effect] ?? MODULES[DEFAULT_EFFECT[kind] ?? "eyeball"];

    this.kind = placement.kind;
    this.effect = effect in PLACEMENT ? effect : DEFAULT_EFFECT[kind];
    this.w = WIDTH;
    this.h = HEIGHT;
    this.t = 0;

    this.frame = createFrame(WIDTH, HEIGHT);
    this.background = buildBackground(placement.kind, WIDTH, HEIGHT);
    this.out = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    this.motes = buildMotes(seed);
    this.options = { x: placement.x, y: placement.y, ...(placement.options ?? {}), seed };
    this.module = module;
    this.fx = createFx(module, this.options);
    // Effects tagged with `meta.actor` are drawn *on* a character: the panel stands one in.
    this.actor = module.meta?.actor ? stockActor(module.meta.actor === 2 ? 2 : 1) : null;
  }

  update(dt) {
    dt = clamp(dt, 0, 0.1);
    this.t += dt;
    this.fx.update(dt);
    // Loops never end; a one-shot (heal) starts over so the panel keeps moving for the whole break.
    if (this.fx.done()) this.fx = createFx(this.module, this.options);
  }

  /** Draw one frame and return its RGBA bytes (w * h * 4). */
  draw() {
    const frame = this.frame;
    clearFrame(frame);
    if (this.actor) {
      drawActor(painterFor(frame).place(this.options.x, this.options.y), this.actor);
    }
    this.fx.draw(frame, "back");
    this.fx.draw(frame, "front");
    this.drawMotes(frame);
    composite(frame, this.out, this.background);
    return this.out;
  }

  // Slow dust motes drifting up through the light. A few of them glow additively.
  drawMotes(frame) {
    const painter = painterFor(frame);
    const color = SPARK[this.kind] ?? SPARK.eye;
    for (const mote of this.motes) {
      const y = wrap(mote.y - this.t * mote.speed, HEIGHT + 16) - 8;
      const x = mote.x + Math.sin(this.t * mote.wobble + mote.phase) * mote.drift;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 1.4 + mote.phase * 3);
      painter.dot(x, y, color, mote.alpha * (0.25 + 0.75 * pulse));
      if (mote.glow && pulse > 0.7) painter.add(Math.round(x), Math.round(y), color, 0.22 * pulse);
    }
  }
}

function buildMotes(seed) {
  const rand = mulberry32(seed * 7919 + 104729);
  return Array.from({ length: 16 }, () => ({
    x: 10 + rand() * (WIDTH - 20),
    y: rand() * (HEIGHT + 16),
    speed: 2.5 + rand() * 8,
    drift: 1.5 + rand() * 7,
    wobble: 0.4 + rand() * 1.1,
    phase: rand() * Math.PI * 2,
    alpha: 0.22 + rand() * 0.55,
    glow: rand() > 0.72,
  }));
}

function buildBackground(kind, w, h) {
  const theme = THEMES[kind] ?? THEMES.eye;
  const top = hex(theme.sky[0]);
  const middle = hex(theme.sky[1]);
  const bottom = hex(theme.sky[2]);
  const glow = hex(theme.glow);
  const spark = hex(theme.spark);
  const black = hex("#000000");

  const out = new Uint32Array(w * h);
  const cx = w / 2;
  const cy = h * 0.52;

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const base = v < 0.5 ? mix(top, middle, v * 2) : mix(middle, bottom, (v - 0.5) * 2);

    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (w * 0.46), (y - cy) / (h * 0.52));
      const k = clamp(1 - d);
      let color = mix(base, glow, Math.pow(k, 2.4) * 0.5);

      const vignette = Math.hypot((x - cx) / (w * 0.64), (y - cy) / (h * 0.7));
      color = mix(color, black, clamp((vignette - 0.52) * 0.42, 0, 0.55));

      const dither = (BAYER[((y & 3) << 2) | (x & 3)] - 0.5) * 4.5;
      out[y * w + x] = rgb(
        clamp(red(color) + dither, 0, 255),
        clamp(green(color) + dither, 0, 255),
        clamp(blue(color) + dither, 0, 255)
      );
    }
  }

  // Stars: a deterministic sprinkle, brighter in the upper half.
  const rand = mulberry32(kind === "water" ? 77 : kind === "walk" ? 13 : 5);
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h * 0.68);
    const brightness = 0.16 + rand() * 0.5;
    const color = mix(black, spark, brightness);
    const index = y * w + x;
    out[index] = mix(out[index], color, 0.75);
    if (rand() > 0.86 && y + 1 < h) out[index + w] = mix(out[index + w], color, 0.3);
  }

  return out;
}

function wrap(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
