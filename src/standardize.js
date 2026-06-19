// standardize.js
// Goal of this step: take ANY image we accept (jpg / jpeg / png / heic / webp /
// tiff / gif / avif) and turn it into one predictable thing — an upright JPEG
// buffer. After this runs, every later step only ever has to deal with JPEG.

import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { isHeic } from './config.js';

// Decode an HEIC/HEIF buffer to a JPEG buffer. iPhone photos are HEIC and sharp's
// prebuilt binary cannot read them (HEVC licensing), so we use heic-convert.
async function decodeHeic(buffer) {
  try {
    // Fast path: single-image HEIC.
    const out = await heicConvert({ buffer, format: 'JPEG', quality: 1 });
    return Buffer.from(out);
  } catch (err) {
    // Some HEICs are multi-image containers; .all() exposes each frame. Use the
    // first (primary) image. If there's nothing usable, re-throw the original.
    const images = await heicConvert.all({ buffer });
    if (!images || images.length === 0) throw err;
    const out = await images[0].convert();
    return Buffer.from(out);
  }
}

/**
 * Convert an uploaded image buffer into a standardized, upright JPEG buffer.
 *
 * @param {Buffer} buffer   - the raw bytes of the uploaded file
 * @param {string} filename - original filename (used to detect HEIC)
 * @param {string} mimetype - the file's MIME type (also used to detect HEIC)
 * @returns {Promise<Buffer>} a JPEG buffer, correctly rotated
 */
export async function standardizeToJpeg(buffer, filename = '', mimetype = '') {
  // STEP 1 — HEIC/HEIF first (sharp can't read it); everything else sharp reads.
  const workingBuffer = isHeic(mimetype, filename) ? await decodeHeic(buffer) : buffer;

  // STEP 2 — Decode tolerantly, fix orientation, flatten, output JPEG.
  //  - failOn: 'none'  -> recover from minor corruption / warnings instead of
  //    throwing (real-world phone photos are sometimes slightly non-standard).
  //  - .rotate()       -> apply EXIF orientation so phone photos aren't sideways.
  //  - .flatten(white) -> JPEG has no transparency; put transparent areas (e.g.
  //    logos, PNGs) on a white background instead of the default black.
  return sharp(workingBuffer, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg()
    .toBuffer();
}
