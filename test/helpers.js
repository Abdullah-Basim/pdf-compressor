// test/helpers.js
// Small utilities to MAKE test images on the fly, so we don't have to commit
// binary image files to the repo. Each helper returns a Buffer.

import sharp from 'sharp';
import fs from 'node:fs';
import { randomFillSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Make a solid-color PNG of the given size. Good for "is it a valid image" checks.
export async function makePng(width = 100, height = 100, color = { r: 10, g: 120, b: 200 }) {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

// Make a solid-color JPEG of the given size.
export async function makeJpeg(width = 100, height = 100, color = { r: 200, g: 60, b: 40 }) {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

// Make a LARGE, noisy JPEG (truly random pixels). Two reasons we need noise:
//  - random pixels are incompressible, so the file is genuinely large — that
//    lets us prove compress() actually shrinks the byte size (JPEG vs JPEG)
//  - it's bigger than MAX_EDGE, so we can prove the resize cap works
// We encode at high quality (90) so the BEFORE file is large; compress() then
// downsizes the pixels and drops to quality 75, which must come out smaller.
export async function makeLargeNoisyJpeg(width = 3000, height = 2000) {
  const channels = 3;
  const raw = Buffer.allocUnsafe(width * height * channels);
  randomFillSync(raw); // fill with real random bytes -> incompressible noise
  return sharp(raw, { raw: { width, height, channels } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Look for a real HEIC sample the user may have dropped into test/fixtures/.
// Returns the buffer if found, or null so HEIC tests can skip gracefully.
export function findHeicFixture() {
  if (!fs.existsSync(FIXTURES_DIR)) return null;
  const match = fs
    .readdirSync(FIXTURES_DIR)
    .find((f) => /\.(heic|heif)$/i.test(f));
  return match ? fs.readFileSync(path.join(FIXTURES_DIR, match)) : null;
}
