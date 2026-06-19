// compress.js
// Goal of this step: shrink the image so the final PDF is small, without
// making it look bad. Two levers: (1) cap the pixel dimensions, (2) lower the
// JPEG quality a bit. We never enlarge — small images are left at their size.

import sharp from 'sharp';
import { MAX_EDGE, JPEG_QUALITY } from './config.js';

/**
 * Compress a JPEG buffer: resize to fit within MAX_EDGE and re-encode at JPEG_QUALITY.
 *
 * @param {Buffer} buffer - an (already standardized) JPEG buffer
 * @returns {Promise<Buffer>} a smaller JPEG buffer
 */
export async function compress(buffer) {
  return sharp(buffer)
    .resize({
      width: MAX_EDGE,          // target box width
      height: MAX_EDGE,         // target box height
      fit: 'inside',            // scale DOWN to fit inside the box, keep aspect ratio
      withoutEnlargement: true, // never scale a small image UP (avoids blur + waste)
    })
    .jpeg({
      quality: JPEG_QUALITY, // the main size/quality trade-off
      mozjpeg: true,         // mozjpeg encoder: smaller files at the same quality
    })
    .toBuffer();
}
