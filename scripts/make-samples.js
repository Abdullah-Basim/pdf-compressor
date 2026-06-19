// scripts/make-samples.js
// Generates a folder of REAL, valid sample images (one per supported format) so
// you can actually test the tool. Each image is labeled with its format.
// Run: node scripts/make-samples.js

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'sample-images');
fs.mkdirSync(OUT, { recursive: true });

const W = 1000;
const H = 700;
const swatches = {
  png: '#2563eb', jpg: '#db2777', webp: '#16a34a',
  tiff: '#d97706', gif: '#7c3aed', avif: '#0891b2',
};

function label(text, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="60" y="360" font-family="Helvetica, Arial, sans-serif" font-size="120"
          font-weight="bold" fill="white">${text}</text>
    <text x="62" y="440" font-family="Helvetica, Arial, sans-serif" font-size="40"
          fill="white" opacity="0.85">valid test image</text>
  </svg>`;
  return Buffer.from(svg);
}

for (const [ext, color] of Object.entries(swatches)) {
  const fmt = ext === 'jpg' ? 'jpeg' : ext; // sharp format name
  const buf = await sharp(label(`${ext.toUpperCase()} sample`, color)).toFormat(fmt).toBuffer();
  const file = path.join(OUT, `sample.${ext}`);
  fs.writeFileSync(file, buf);
  console.log(`wrote ${path.basename(file)} (${buf.length} bytes)`);
}

// A real HEIC can't be generated (no HEVC encoder), so copy one from macOS if present.
const macHeic = [
  '/System/Library/Desktop Pictures/iMac Blue.heic',
  '/System/Library/CoreServices/DefaultDesktop.heic',
].find((p) => fs.existsSync(p));
if (macHeic) {
  const dest = path.join(OUT, 'sample.heic');
  fs.copyFileSync(macHeic, dest);
  console.log(`copied real sample.heic (${fs.statSync(dest).size} bytes)`);
} else {
  console.log('no macOS HEIC sample found to copy — skip HEIC sample');
}

console.log(`\nDone -> ${OUT}`);
