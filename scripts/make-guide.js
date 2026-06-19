// scripts/make-guide.js
// Generates "Project-Guide.pdf" — a plain-language + technical guide to the tool.
// Run: node scripts/make-guide.js <vercelUrl> <githubUrl>
// Uses pdf-lib (already a project dependency). No other deps.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Links (passed in from the deploy step) ---
const VERCEL_URL = process.argv[2] || 'https://pdf-compressor.vercel.app';
const GITHUB_URL = process.argv[3] || 'https://github.com/Abdullah-Basim/pdf-compressor';
const DATE = process.argv[4] || '2026-06-19';

// --- Layout constants ---
const PAGE_W = 595.28; // A4 width in points
const PAGE_H = 841.89; // A4 height
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const ACCENT = rgb(0.16, 0.34, 0.78);
const TEXT = rgb(0.13, 0.14, 0.17);
const MUTED = rgb(0.42, 0.43, 0.48);
const WHITE = rgb(1, 1, 1);

// Standard PDF fonts only support WinAnsi characters, so swap glyphs that aren't
// in that set (e.g. the arrow) for safe ASCII equivalents.
const sanitize = (s) => s.replace(/→/g, '->').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

let page = pdf.addPage([PAGE_W, PAGE_H]);
let y = PAGE_H - MARGIN;

// Add a new page and reset the cursor to the top margin.
function newPage() {
  page = pdf.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
}

// Make sure there's room for `need` points; otherwise start a new page.
function ensure(need) {
  if (y - need < MARGIN) newPage();
}

// Wrap `text` to the content width and draw it, advancing the cursor.
function wrapped(text, { f = font, size = 11, color = TEXT, gap = 5, indent = 0 } = {}) {
  const maxW = CONTENT_W - indent;
  const words = sanitize(text).split(/\s+/);
  let line = '';
  const flush = () => {
    ensure(size + gap);
    page.drawText(line, { x: MARGIN + indent, y, size, font: f, color });
    y -= size + gap;
    line = '';
  };
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(test, size) > maxW && line) flush();
    line = line ? `${line} ${w}` : w;
  }
  if (line) flush();
}

function spacer(h = 10) {
  y -= h;
}

function heading(text) {
  spacer(14);
  ensure(22);
  page.drawText(sanitize(text), { x: MARGIN, y, size: 15, font: bold, color: ACCENT });
  y -= 6;
  // underline rule
  ensure(8);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.92),
  });
  y -= 12;
}

function bullet(text) {
  ensure(16);
  page.drawText('•', { x: MARGIN + 2, y, size: 11, font: bold, color: ACCENT });
  wrapped(text, { indent: 16 });
  y -= 2;
}

function kv(key, val) {
  // "key — value" with the key bolded, wrapped value.
  ensure(16);
  const keyText = `${key}  `;
  page.drawText(sanitize(keyText), { x: MARGIN + 2, y, size: 11, font: bold, color: TEXT });
  const keyW = bold.widthOfTextAtSize(keyText, 11) + 2;
  // draw value wrapped, first line offset by keyW
  const maxW = CONTENT_W - keyW;
  const words = sanitize(val).split(/\s+/);
  let line = '';
  let first = true;
  const flush = () => {
    const x = first ? MARGIN + 2 + keyW : MARGIN + 18;
    if (!first) ensure(16);
    page.drawText(line, { x, y, size: 11, font, color: MUTED });
    y -= 16;
    line = '';
    first = false;
  };
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const lim = first ? maxW : CONTENT_W - 18;
    if (font.widthOfTextAtSize(test, 11) > lim && line) flush();
    line = line ? `${line} ${w}` : w;
  }
  if (line) flush();
  y -= 2;
}

// ---------- Title banner (page 1) ----------
page.drawRectangle({ x: 0, y: PAGE_H - 120, width: PAGE_W, height: 120, color: ACCENT });
page.drawText('Images -> PDF', { x: MARGIN, y: PAGE_H - 60, size: 28, font: bold, color: WHITE });
page.drawText('Image to compressed-PDF tool — user & technical guide', {
  x: MARGIN, y: PAGE_H - 84, size: 12, font, color: rgb(0.9, 0.93, 1),
});
page.drawText(`Prepared ${DATE}`, { x: MARGIN, y: PAGE_H - 102, size: 10, font, color: rgb(0.85, 0.9, 1) });
y = PAGE_H - 150;

// ---------- 1. What is this tool ----------
heading('1. What is this tool?');
wrapped(
  'This is a simple web tool that turns your images into a single PDF. You upload one or ' +
    'more photos from a phone or a computer; the tool automatically standardizes them (puts ' +
    'every image into the same format and fixes sideways phone photos), compresses them so the ' +
    'file is smaller, and then combines them into one neat PDF that you can download. The goal ' +
    'is to make "a pile of photos" into "one shareable, lightweight PDF" in a couple of taps, ' +
    'with no technical knowledge required.',
);

// ---------- 2. What it accepts ----------
heading('2. What it accepts and produces');
kv('Image formats:', 'JPG, JPEG, PNG, HEIC/HEIF (iPhone photos), WebP, TIFF, GIF, and AVIF.');
kv('Image sizes:', 'No size limit. Upload tiny logos or 50 MB photos — there is no cap when you run it on your own computer.');
kv('Number of images:', 'As many as you like in one go — each becomes one page of the PDF, in the order you add them.');
kv('Output:', 'A single combined PDF named images.pdf. Every page is a uniform A4 size, so the document looks consistent no matter what shapes the images are.');
kv('What it does:', 'Auto-rotate using photo orientation, place each image centered on a uniform A4 page (scaled to fit, never stretched or cropped), and re-encode as JPEG at ~75% quality for a much smaller file.');
kv('Bad files:', 'Any file it cannot read (corrupt, or not a real image) is skipped with a clear message, and the rest still convert — one bad file never breaks the whole batch.');

// ---------- 3. How to use ----------
heading('3. How to use it');
bullet('Open the tool in a web browser (link in section 6), or run it locally.');
bullet('Tap the upload box to choose images, or drag and drop them in. You can keep adding more.');
bullet('Remove a single image with its X button, or use "Clear all" to start over.');
bullet('Press "Create PDF". The combined, compressed PDF downloads automatically.');
bullet('On a phone: open the site on the same Wi-Fi, pick photos from your camera roll, and the PDF downloads to your device.');

// ---------- 4. How it works ----------
heading('4. How it works (the flow)');
wrapped(
  'Browser sends the images -> the server receives them in memory -> each image is ' +
    'standardized (HEIC is converted to JPEG, orientation fixed) -> each image is compressed ' +
    '(resized + re-encoded) -> each is placed centered on a uniform A4 page and the pages are ' +
    'stitched into one PDF -> the PDF is sent back to the browser as a download. Nothing is ' +
    'stored on disk; images are processed in memory and discarded after the response.',
);

// ---------- 5. Technical details ----------
heading('5. Technical details — what is used');
wrapped('Built with Node.js (plain JavaScript, ES modules). No framework on the front end — just HTML, CSS, and vanilla JavaScript, kept intentionally simple and readable.', { color: MUTED });
spacer(4);
kv('express', 'The web server. Serves the page and exposes the upload endpoint POST /api/convert.');
kv('multer', 'Receives the uploaded files as in-memory buffers (multipart form handling), no temp files.');
kv('sharp', 'Fast image engine: reads PNG/JPEG/WebP/TIFF/GIF/AVIF, auto-rotates via EXIF, resizes, and re-encodes to compressed JPEG.');
kv('heic-convert', 'Decodes iPhone HEIC/HEIF photos to JPEG (sharp cannot read HEIC on its own).');
kv('pdf-lib', 'Builds the final PDF in pure JavaScript: each image centered on its own uniform A4 page.');
kv('node:test + supertest', 'Built-in test runner plus HTTP testing; simulates both web and mobile uploads.');
spacer(6);
wrapped('Project structure:', { f: bold });
bullet('src/ — the core pipeline: config.js, standardize.js, compress.js, buildPdf.js, pipeline.js');
bullet('server.js — the Express server and the /api/convert route');
bullet('public/ — the web page (index.html, app.js, styles.css)');
bullet('test/ — unit + upload tests (15 passing; covers every format + corrupt-file handling)');

// ---------- 6. Run it yourself ----------
heading('6. Run it yourself (self-hosted)');
wrapped(
  'The tool runs on your own computer (or any Node.js server) — there is no size limit and ' +
    'nothing is uploaded to a third party. You need Node.js installed (version 18 or newer). ' +
    'Then clone the repository and start it:',
);
spacer(4);
// code-ish block
const codeLines = [
  `git clone ${GITHUB_URL}.git`,
  'cd pdf-compressor',
  'npm install',
  'npm start',
  '# then open http://localhost:3000',
];
for (const c of codeLines) {
  ensure(15);
  page.drawText(sanitize(c), { x: MARGIN + 6, y, size: 10, font: await pdf.embedFont(StandardFonts.Courier), color: TEXT });
  y -= 15;
}
spacer(4);
wrapped('Open http://localhost:3000 in your browser. To use it from a phone, put the phone on the same Wi-Fi and visit your computer\'s local IP at port 3000.');
spacer(8);
wrapped('Links:', { f: bold });
kv('Source code (GitHub):', GITHUB_URL);
kv('To run tests:', 'npm test  (15 automated tests; covers every format and the A4 output).');

// ---------- Save ----------
const outPath = path.join(__dirname, '..', 'Project-Guide.pdf');
const bytes = await pdf.save();
fs.writeFileSync(outPath, bytes);
console.log(`Wrote ${outPath} (${bytes.length} bytes, ${pdf.getPageCount()} pages)`);
