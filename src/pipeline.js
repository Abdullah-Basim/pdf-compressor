// pipeline.js
// This is the "conductor": it runs the three steps in order and returns the PDF.
// Both the web server AND the tests call this one function, so the actual logic
// lives in exactly one place (and the route stays tiny).
//
//   standardize  ->  compress  ->  buildPdf

import { standardizeToJpeg } from './standardize.js';
import { compress } from './compress.js';
import { buildPdf } from './buildPdf.js';

/**
 * Turn a batch of uploaded image files into a single compressed PDF.
 *
 * @param {Array<{buffer: Buffer, originalname: string, mimetype: string}>} files
 *        - the uploaded files (this is exactly the shape multer gives us)
 * @returns {Promise<Uint8Array>} the finished PDF bytes
 */
export async function imagesToPdf(files) {
  if (!files || files.length === 0) {
    // Fail fast with a clear message rather than producing an empty PDF.
    throw new Error('No images provided.');
  }

  // Process every image through standardize -> compress.
  // Promise.all runs them in parallel (faster for multiple photos), while
  // .map preserves the original order, so the PDF pages stay in upload order.
  const compressedJpegs = await Promise.all(
    files.map(async (file) => {
      const upright = await standardizeToJpeg(
        file.buffer,
        file.originalname,
        file.mimetype,
      );
      return compress(upright);
    }),
  );

  // Stitch the compressed images into one PDF.
  return buildPdf(compressedJpegs);
}
