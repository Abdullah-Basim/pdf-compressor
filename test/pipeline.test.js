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
import { makePng, makeJpeg, makeLargeNoisyJpeg, findHeicFixture } from './helpers.js';

// A JPEG always starts with the two "magic bytes" 0xFF 0xD8.
function isJpeg(buf) {
  return buf[0] === 0xff && buf[1] === 0xd8;
}
// A PDF file always starts with the ASCII text "%PDF".
function isPdf(bytes) {
  return Buffer.from(bytes.slice(0, 4)).toString() === '%PDF';
}

test('standardizeToJpeg turns a PNG into a valid JPEG', async () => {
  const png = await makePng();
  const out = await standardizeToJpeg(png, 'photo.png', 'image/png');
  assert.ok(isJpeg(out), 'output should be a JPEG');
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

test('imagesToPdf runs the full pipeline on mixed inputs', async () => {
  const files = [
    { buffer: await makePng(200, 150), originalname: 'a.png', mimetype: 'image/png' },
    { buffer: await makeJpeg(150, 200), originalname: 'b.jpg', mimetype: 'image/jpeg' },
  ];
  const bytes = await imagesToPdf(files);

  assert.ok(isPdf(bytes), 'output should be a PDF');
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
});

test('imagesToPdf rejects an empty file list', async () => {
  await assert.rejects(() => imagesToPdf([]), /No images/);
});

// This test only runs if you drop a real .heic file into test/fixtures/.
// Otherwise it is skipped, so the suite never fails on machines without one.
test('standardizeToJpeg decodes a real HEIC photo', async (t) => {
  const heic = findHeicFixture();
  if (!heic) {
    t.skip('no .heic fixture found in test/fixtures/ — add one to enable this test');
    return;
  }
  const out = await standardizeToJpeg(heic, 'photo.heic', 'image/heic');
  assert.ok(isJpeg(out), 'HEIC should be converted to a valid JPEG');
});
