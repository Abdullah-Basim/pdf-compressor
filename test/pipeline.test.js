// test/pipeline.test.js
// UNIT tests for the core image -> PDF pipeline (no web server involved).
// We use Node's built-in test runner (node:test) and built-in assert.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

import { standardizeToJpeg } from '../src/standardize.js';
import { compress } from '../src/compress.js';
import { buildPdf } from '../src/buildPdf.js';
import { imagesToPdf } from '../src/pipeline.js';
import { MAX_EDGE } from '../src/config.js';
import {
  makePng,
  makeJpeg,
  makeImage,
  makeTransparentPng,
  makeCorruptBuffer,
  makeLargeNoisyJpeg,
  findHeicFixture,
} from './helpers.js';

// A JPEG always starts with the two "magic bytes" 0xFF 0xD8.
function isJpeg(buf) {
  return buf[0] === 0xff && buf[1] === 0xd8;
}
// A PDF file always starts with the ASCII text "%PDF".
function isPdf(bytes) {
  return Buffer.from(bytes.slice(0, 4)).toString() === '%PDF';
}
// Build a file object in the shape the pipeline/multer use.
function file(buffer, originalname, mimetype = 'application/octet-stream') {
  return { buffer, originalname, mimetype };
}

test('standardizeToJpeg turns a PNG into a valid JPEG', async () => {
  const png = await makePng();
  const out = await standardizeToJpeg(png, 'photo.png', 'image/png');
  assert.ok(isJpeg(out), 'output should be a JPEG');
});

test('standardizeToJpeg flattens a transparent PNG (no crash, valid JPEG)', async () => {
  const png = await makeTransparentPng();
  const out = await standardizeToJpeg(png, 'logo.png', 'image/png');
  assert.ok(isJpeg(out), 'transparent PNG should become a valid JPEG');
});

test('compress caps dimensions at MAX_EDGE and shrinks file size', async () => {
  const big = await makeLargeNoisyJpeg(3000, 2000); // bigger than MAX_EDGE
  const out = await compress(big);

  const meta = await sharp(out).metadata();
  assert.ok(meta.width <= MAX_EDGE, `width ${meta.width} should be <= ${MAX_EDGE}`);
  assert.ok(meta.height <= MAX_EDGE, `height ${meta.height} should be <= ${MAX_EDGE}`);
  assert.ok(out.length < big.length, 'compressed output should be smaller than input');
});

test('buildPdf creates one page per image', async () => {
  const a = await makeJpeg(120, 80);
  const b = await makeJpeg(80, 120);
  const bytes = await buildPdf([a, b]);

  assert.ok(isPdf(bytes), 'output should be a PDF');
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2, 'should have 2 pages');
});

test('imagesToPdf accepts every supported format (png/jpeg/webp/tiff/gif/avif)', async () => {
  const formats = ['png', 'jpeg', 'webp', 'tiff', 'gif', 'avif'];
  const files = await Promise.all(
    formats.map(async (fmt) => file(await makeImage(fmt), `img.${fmt}`, `image/${fmt}`)),
  );
  const { pdf, skipped } = await imagesToPdf(files);

  assert.equal(skipped.length, 0, `no format should be skipped (got: ${JSON.stringify(skipped)})`);
  assert.ok(isPdf(pdf));
  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), formats.length, 'one page per format');
});

test('imagesToPdf skips a corrupt file but still builds from the good ones', async () => {
  const files = [
    file(await makePng(200, 150), 'good.png', 'image/png'),
    file(makeCorruptBuffer(), 'broken.png', 'image/png'),
  ];
  const { pdf, skipped } = await imagesToPdf(files);

  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 1, 'PDF should contain only the good image');
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].name, 'broken.png');
});

test('imagesToPdf throws a 422 when ALL files are unreadable', async () => {
  const files = [file(makeCorruptBuffer(), 'broken.png', 'image/png')];
  await assert.rejects(
    () => imagesToPdf(files),
    (err) => err.statusCode === 422 && /broken\.png/.test(err.message),
  );
});

test('imagesToPdf rejects an empty file list', async () => {
  await assert.rejects(
    () => imagesToPdf([]),
    (err) => err.statusCode === 400 && /No images/.test(err.message),
  );
});

// Runs against a real HEIC: test/fixtures/*.heic if present, else a macOS sample.
test('standardizeToJpeg decodes a real HEIC photo', async (t) => {
  const heic = findHeicFixture();
  if (!heic) {
    t.skip('no real .heic available (add one to test/fixtures/ to enable)');
    return;
  }
  const out = await standardizeToJpeg(heic, 'photo.heic', 'image/heic');
  assert.ok(isJpeg(out), 'HEIC should be converted to a valid JPEG');
});
