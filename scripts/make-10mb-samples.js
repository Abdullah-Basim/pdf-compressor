// scripts/make-10mb-samples.js
// Generates 10 valid ~10 MB test images covering every format the tool processes
// (JPG, PNG, WebP, TIFF, GIF, AVIF) plus a real HEIC. Each is a labeled image
// with random-noise detail (the noise is what makes the file genuinely large).
// Run: node scripts/make-10mb-samples.js

import sharp from 'sharp';
import fs from 'node:fs';
import { randomFillSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'test-images-10mb');
fs.mkdirSync(OUT, { recursive: true });

// A labeled image on top of heavy translucent noise (noise => big, valid file).
async function noisy(w, h, label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="6%" y="46%" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(h / 7)}" font-weight="bold" fill="white">${label}</text>
    <text x="6.2%" y="56%" font-family="Helvetica, Arial, sans-serif"
          font-size="${Math.round(h / 20)}" fill="white" opacity="0.9">~10 MB test image</text>
  </svg>`;
  const base = await sharp(Buffer.from(svg)).removeAlpha().toColourspace('srgb').png().toBuffer();
  const raw = Buffer.allocUnsafe(w * h * 4);
  randomFillSync(raw);
  for (let i = 3; i < raw.length; i += 4) raw[i] = 175; // ~70% noise opacity
  const noise = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return sharp(base).composite([{ input: noise, blend: 'over' }]);
}

const MB = (p) => (fs.statSync(p).size / (1024 * 1024)).toFixed(1);

// [filename, format/options, width, height, label, color] — dims tuned for ~10 MB.
const jobs = [
  ['01-jpg.jpg', 'jpeg', 4200, 3150, 'JPG', '#db2777'],
  ['02-png.png', 'png', 2300, 1750, 'PNG', '#2563eb'],
  ['03-webp.webp', 'webp-lossless', 2350, 1750, 'WebP', '#16a34a'],
  ['04-tiff.tiff', 'tiff', 2100, 1620, 'TIFF', '#d97706'],
  ['05-gif.gif', 'gif', 3800, 2850, 'GIF', '#7c3aed'],
  ['06-avif.avif', 'avif', 3600, 2700, 'AVIF', '#0891b2'],
  ['08-jpg.jpg', 'jpeg', 4200, 3150, 'JPG (2)', '#be123c'],
  ['09-png.png', 'png', 2300, 1750, 'PNG (2)', '#1d4ed8'],
  ['10-tiff.tiff', 'tiff', 2100, 1620, 'TIFF (2)', '#b45309'],
];

for (const [file, fmt, w, h, label, color] of jobs) {
  const img = await noisy(w, h, label, color);
  const dst = path.join(OUT, file);
  if (fmt === 'jpeg') await img.jpeg({ quality: 96 }).toFile(dst);
  else if (fmt === 'png') await img.png({ compressionLevel: 3 }).toFile(dst);
  else if (fmt === 'webp-lossless') await img.webp({ lossless: true }).toFile(dst);
  else if (fmt === 'tiff') await img.tiff({ compression: 'none' }).toFile(dst);
  else if (fmt === 'gif') await img.gif().toFile(dst);
  else if (fmt === 'avif') await img.avif({ quality: 90 }).toFile(dst);
  console.log(`${file.padEnd(14)} -> ${MB(dst)} MB`);
}

// Real HEIC (no open encoder exists, so copy a macOS sample).
const macHeic = [
  '/System/Library/Desktop Pictures/iMac Blue.heic',
  '/System/Library/CoreServices/DefaultDesktop.heic',
].find((p) => fs.existsSync(p));
if (macHeic) {
  const dst = path.join(OUT, '07-heic.heic');
  fs.copyFileSync(macHeic, dst);
  console.log(`07-heic.heic   -> ${MB(dst)} MB (real HEIC; iPhone format)`);
} else {
  console.log('07-heic.heic   -> skipped (no macOS HEIC found)');
}

console.log(`\nDone -> ${OUT}`);
