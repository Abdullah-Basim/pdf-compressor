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

// Make a solid-color image in ANY sharp-writable format (png, jpeg, webp, tiff,
// gif, avif). Used to prove the pipeline accepts every supported format.
export async function makeImage(format, width = 120, height = 90, color = { r: 60, g: 140, b: 90 }) {
  const img = sharp({ create: { width, height, channels: 3, background: color } });
  return img.toFormat(format).toBuffer();
}

// Make a PNG WITH transparency (alpha), to test that transparent areas are
// flattened onto a white background when converted to JPEG.
export async function makeTransparentPng(width = 100, height = 100) {
  return sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
}

// A buffer that is NOT a valid image (mimics the user's corrupt sample files).
export function makeCorruptBuffer() {
  return Buffer.from('this is definitely not a real image file');
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

// Find a real HEIC sample to test the HEIC path. First checks test/fixtures/ for
// one the user dropped in; then falls back to known macOS sample HEICs (so the
// test actually runs on a Mac). Returns the buffer, or null so the test can skip.
export function findHeicFixture() {
  if (fs.existsSync(FIXTURES_DIR)) {
    const match = fs.readdirSync(FIXTURES_DIR).find((f) => /\.(heic|heif)$/i.test(f));
    if (match) return fs.readFileSync(path.join(FIXTURES_DIR, match));
  }
  const macSamples = [
    '/System/Library/Desktop Pictures/iMac Blue.heic',
    '/System/Library/Desktop Pictures/iMac Pink.heic',
    '/System/Library/CoreServices/DefaultDesktop.heic',
  ];
  const found = macSamples.find((p) => fs.existsSync(p));
  return found ? fs.readFileSync(found) : null;
}
