// buildPdf.js
// Goal of this step: take a list of JPEG buffers and stitch them into ONE PDF,
// one image per page. Every page is the SAME uniform A4 size; each image is
// scaled to fit inside the page margins and centered on white. This makes a
// clean, standardized document even when the input images are different shapes
// (a square HEIC, a landscape JPG, a portrait PNG all sit on identical pages).

import { PDFDocument } from 'pdf-lib';
import { PAGE_WIDTH, PAGE_HEIGHT, PAGE_MARGIN } from './config.js';

/**
 * Build a single PDF from an ordered list of JPEG buffers.
 *
 * @param {Buffer[]} jpegBuffers - compressed JPEG buffers, in page order
 * @returns {Promise<Uint8Array>} the finished PDF as bytes
 */
export async function buildPdf(jpegBuffers) {
  // Start a brand-new, empty PDF document.
  const pdf = await PDFDocument.create();

  // The usable area = full page minus a margin on every side.
  const maxW = PAGE_WIDTH - PAGE_MARGIN * 2;
  const maxH = PAGE_HEIGHT - PAGE_MARGIN * 2;

  // Add one uniform A4 page per image, in the order they were given.
  for (const jpeg of jpegBuffers) {
    // embedJpg returns an image object plus its natural width/height.
    const image = await pdf.embedJpg(jpeg);

    // Every page is the same A4 size (pdf-lib pages are white by default).
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Scale the image to FIT inside the margins while keeping its aspect ratio
    // ("contain"): pick the smaller of the width/height ratios so nothing is
    // cropped or stretched.
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;

    // Center the scaled image on the page.
    page.drawImage(image, {
      x: (PAGE_WIDTH - drawW) / 2,
      y: (PAGE_HEIGHT - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  // Serialize the document to bytes (a Uint8Array) ready to send/download.
  return pdf.save();
}
