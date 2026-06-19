// scripts/make-large-samples.js
// Generates REAL, valid, LARGE images for stress-testing the no-size-limit
// handling. Unlike "sample file" downloads (which are often corrupt padding),
// these genuinely decode. Size is created with real random-noise detail so the
// files are big but still valid images with a readable label.
// Run: node scripts/make-large-samples.js

import sharp from 'sharp';
import fs from 'node:fs';
import { randomFillSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'large-test-images');
fs.mkdirSync(OUT, { recursive: true });

// Build a big, recognizable image: a colored label on top of translucent random
// noise (the noise is what makes the file genuinely large / incompressible).
async function labeledNoise(w, h, label, color, noiseAlpha) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="6%" y="46%" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(h / 7)}" font-weight="bold" fill="white">${label}</text>
    <text x="6.2%" y="56%" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(h / 18)}" fill="white" opacity="0.9">valid large test image</text>
  </svg>`;
  const base = await sharp(Buffer.from(svg)).removeAlpha().toColourspace('srgb').png().toBuffer();

  // RGBA random noise with a fixed alpha so the label shows through.
  const raw = Buffer.allocUnsafe(w * h * 4);
  randomFillSync(raw);
  for (let i = 3; i < raw.length; i += 4) raw[i] = noiseAlpha;
  const noise = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  return sharp(base).composite([{ input: noise, blend: 'over' }]);
}

const MB = (p) => (fs.statSync(p).size / (1024 * 1024)).toFixed(1);

// ~50 MB PNG
{
  const img = await labeledNoise(6000, 4500, '50 MB PNG', '#1e3a8a', 150);
  const file = path.join(OUT, 'large_png.png');
  await img.png({ compressionLevel: 6 }).toFile(file);
  console.log(`large_png.png        -> ${MB(file)} MB`);
}

// ~20 MB JPEG (high quality keeps the noise detail = big file)
{
  const img = await labeledNoise(6000, 4500, 'Large JPG', '#9d174d', 150);
  const file = path.join(OUT, 'large_jpg.jpg');
  await img.jpeg({ quality: 100 }).toFile(file);
  console.log(`large_jpg.jpg        -> ${MB(file)} MB`);
}

// Real large HEIC (can't be generated — HEVC has no open encoder; copy a macOS one)
{
  const macHeic = [
    '/System/Library/Desktop Pictures/iMac Blue.heic',
    '/System/Library/CoreServices/DefaultDesktop.heic',
  ].find((p) => fs.existsSync(p));
  if (macHeic) {
    const file = path.join(OUT, 'large_heic.heic');
    fs.copyFileSync(macHeic, file);
    console.log(`large_heic.heic      -> ${MB(file)} MB (real iPhone-format HEIC)`);
  } else {
    console.log('large_heic.heic      -> skipped (no macOS HEIC found)');
  }
}

console.log(`\nDone -> ${OUT}`);
