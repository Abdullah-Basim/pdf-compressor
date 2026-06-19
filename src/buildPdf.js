// buildPdf.js
// Goal of this step: take a list of JPEG buffers and stitch them into ONE PDF,
// one image per page. Each page is sized exactly to its image, so there are no
// white borders and nothing is stretched.

import { PDFDocument } from 'pdf-lib';

/**
 * Build a single PDF from an ordered list of JPEG buffers.
 *
 * @param {Buffer[]} jpegBuffers - compressed JPEG buffers, in page order
 * @returns {Promise<Uint8Array>} the finished PDF as bytes
 */
export async function buildPdf(jpegBuffers) {
  // Start a brand-new, empty PDF document.
  const pdf = await PDFDocument.create();

  // Add one page per image, in the order they were given.
  for (const jpeg of jpegBuffers) {
    // embedJpg returns an image object plus its natural width/height.
    const image = await pdf.embedJpg(jpeg);

    // Make the page exactly the image's size (full-bleed, no margins).
    const page = pdf.addPage([image.width, image.height]);

    // Draw the image starting at the bottom-left (0,0), filling the page.
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  // Serialize the document to bytes (a Uint8Array) ready to send/download.
  return pdf.save();
}
