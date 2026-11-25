// Minimal RGBA PNG writer (node:zlib only), used by the smoke test, preview and icon scripts.
import { deflateSync } from "node:zlib";

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode w x h RGBA bytes (Uint8Array/Uint8ClampedArray/Buffer) as a PNG buffer. */
export function encodePNG(w, h, rgba) {
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const offset = y * (stride + 1);
    raw[offset] = 0; // no filter: simple and small enough for these images
    src.copy(raw, offset + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Nearest-neighbour upscale of RGBA bytes, for readable previews. */
export function scaleRGBA(w, h, rgba, factor) {
  const out = new Uint8ClampedArray(w * factor * h * factor * 4);
  for (let y = 0; y < h * factor; y++) {
    const sy = (y / factor) | 0;
    for (let x = 0; x < w * factor; x++) {
      const sx = (x / factor) | 0;
      const from = (sy * w + sx) * 4;
      const to = (y * w * factor + x) * 4;
      out[to] = rgba[from];
      out[to + 1] = rgba[from + 1];
      out[to + 2] = rgba[from + 2];
      out[to + 3] = rgba[from + 3];
    }
  }
  return out;
}
