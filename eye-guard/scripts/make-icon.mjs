// Generate media/icon.png (128x128 pixel-art eye) and media/eye.svg (tab icon).
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodePNG } from "./lib/png.mjs";

const root = resolve(import.meta.dirname, "..");
mkdirSync(resolve(root, "media"), { recursive: true });

const N = 32;
const SCALE = 4;
const W = N * SCALE;

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const BG_TOP = hex("#0d1a14");
const BG_BOTTOM = hex("#05080d");
const GLOW = hex("#2f8a4a");
const OUTLINE = hex("#1e0c16");
const SCLERA = hex("#f4e9de");
const SCLERA_LIT = hex("#ffffff");
const SCLERA_SHADE = hex("#dcbcb4");
const IRIS = [hex("#0c2a14"), hex("#1f6a2a"), hex("#3fae3a"), hex("#9be05a"), hex("#e8ffb0")];
const VEIN = hex("#c42a3a");

const buf = new Uint8ClampedArray(N * N * 4);
const put = (x, y, rgb, alpha = 255) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = (y * N + x) * 4;
  buf[i] = rgb[0];
  buf[i + 1] = rgb[1];
  buf[i + 2] = rgb[2];
  buf[i + 3] = alpha;
};

// Background: vertical gradient with a green glow behind the eye.
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    let c = mix(BG_TOP, BG_BOTTOM, y / (N - 1));
    const d = Math.hypot((x - 16) / 13, (y - 16) / 10);
    c = mix(c, GLOW, Math.pow(clamp(1 - d), 2.6) * 0.55);
    // faint pixel stars
    if ((x * 7 + y * 13) % 97 === 0) c = mix(c, [200, 255, 220], 0.25);
    put(x, y, c.map((v) => Math.round(clamp(v, 0, 255))));
  }
}

// Eye outline: an ellipse with a slight upper-lid flatness.
const inEye = (x, y) => {
  const dx = (x - 16) / 13.4;
  const dy = (y - 16) / 8.4;
  return dx * dx + dy * dy <= 1;
};
const inIris = (x, y) => Math.hypot(x - 16, y - 16) <= 6.3;
const inPupil = (x, y) => Math.hypot(x - 16, y - 16) <= 2.6;

for (let y = 4; y < 29; y++) {
  for (let x = 3; x < 30; x++) {
    if (!inEye(x, y)) continue;

    // sclera, lit from the top-left
    const lit = Math.hypot(x + 3.4, y + 4) <= 13.4 * 0.58;
    let c = lit ? SCLERA_LIT : y > 19 ? SCLERA_SHADE : SCLERA;

    if (inIris(x, y)) {
      const r = Math.hypot(x - 16, y - 16);
      if (inPupil(x, y)) c = IRIS[0];
      else if (r > 5.2) c = IRIS[1];
      else if (r > 3.6) c = IRIS[2];
      else c = IRIS[3];
      // fixed glint
      if ((x === 13 && y === 12) || (x === 14 && y === 12) || (x === 13 && y === 13)) c = [255, 255, 255];
    } else if ((x === 6 && y === 14) || (x === 7 && y === 13) || (x === 5 && y === 16) || (x === 24 && y === 19)) {
      c = VEIN; // a couple of bloodshot threads
    }

    put(x, y, c);
  }
}

// 1px dark outline around the eye.
for (let y = 3; y < 30; y++) {
  for (let x = 2; x < 31; x++) {
    if (inEye(x, y)) continue;
    const near = inEye(x - 1, y) || inEye(x + 1, y) || inEye(x, y - 1) || inEye(x, y + 1);
    if (near) put(x, y, OUTLINE);
  }
}

// Upscale and save.
const big = new Uint8ClampedArray(W * W * 4);
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const from = (((y / SCALE) | 0) * N + ((x / SCALE) | 0)) * 4;
    const to = (y * W + x) * 4;
    big[to] = buf[from];
    big[to + 1] = buf[from + 1];
    big[to + 2] = buf[from + 2];
    big[to + 3] = buf[from + 3];
  }
}

writeFileSync(resolve(root, "media", "icon.png"), encodePNG(W, W, big));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <path fill="none" stroke="#8cf07a" stroke-width="1.2" d="M1.4 8C3.1 4.7 5.4 3.1 8 3.1S12.9 4.7 14.6 8C12.9 11.3 10.6 12.9 8 12.9S3.1 11.3 1.4 8Z"/>
  <circle cx="8" cy="8" r="2.5" fill="#8cf07a"/>
  <circle cx="8" cy="8" r="1.1" fill="#07130a"/>
  <circle cx="7.2" cy="7.2" r="0.55" fill="#eafff0"/>
</svg>
`;
writeFileSync(resolve(root, "media", "eye.svg"), svg);

console.log("wrote media/icon.png and media/eye.svg");
