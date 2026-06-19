// standardize.js
// Goal of this step: take ANY image we accept (jpg / jpeg / png / heic) and
// turn it into one predictable thing — an upright JPEG buffer.
// After this runs, every later step only ever has to deal with JPEG. Simple.

import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { isHeic } from './config.js';

/**
 * Convert an uploaded image buffer into a standardized, upright JPEG buffer.
 *
 * @param {Buffer} buffer   - the raw bytes of the uploaded file
 * @param {string} filename - original filename (used to detect HEIC)
 * @param {string} mimetype - the file's MIME type (also used to detect HEIC)
 * @returns {Promise<Buffer>} a JPEG buffer, correctly rotated
 */
export async function standardizeToJpeg(buffer, filename = '', mimetype = '') {
  let workingBuffer = buffer;

  // STEP 1 — Handle HEIC/HEIF (iPhone photos).
  // sharp's prebuilt binary can't decode HEIC (it's a licensing/HEVC issue),
  // so we first convert HEIC -> JPEG using heic-convert (a portable wasm decoder).
  // We use quality: 1 (max) here because the real compression happens later;
  // we don't want to lose detail twice.
  if (isHeic(mimetype, filename)) {
    const decoded = await heicConvert({
      buffer,          // the HEIC bytes in
      format: 'JPEG',  // we want JPEG out
      quality: 1,      // 0..1 — keep full quality for now
    });
    // heic-convert returns an ArrayBuffer; wrap it so sharp can read it.
    workingBuffer = Buffer.from(decoded);
  }

  // STEP 2 — Auto-rotate + normalize to JPEG.
  // .rotate() with NO arguments reads the photo's EXIF "Orientation" tag and
  // physically rotates the pixels so the image is upright. This is why phone
  // photos that look sideways come out correct. Then we re-encode as JPEG.
  const upright = await sharp(workingBuffer)
    .rotate()  // apply EXIF orientation, then strip it
    .jpeg()    // ensure the output is JPEG regardless of the input format
    .toBuffer();

  return upright;
}
