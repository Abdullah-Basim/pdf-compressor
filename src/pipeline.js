// pipeline.js
// This is the "conductor": it runs the steps and returns the PDF (plus a list of
// any files it couldn't read). Both the web server AND the tests call this one
// function, so the actual logic lives in exactly one place.
//
//   standardize  ->  compress   (per image)  ->  buildPdf  (all images)

import { standardizeToJpeg } from './standardize.js';
import { compress } from './compress.js';
import { buildPdf } from './buildPdf.js';

// A small helper to throw an error the web layer can turn into a specific HTTP
// status (instead of a generic 500). Used for "your input was the problem" cases.
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// Turn a messy library error into a short, human-friendly reason.
function shortReason(err) {
  const first = String(err?.message ?? 'unknown error').split('\n')[0];
  return first.replace('Input buffer has corrupt header:', 'unreadable image —').trim();
}

// Standardize + compress a single file. Never throws: returns a result object so
// one bad file can't abort the whole batch.
async function processOne(file) {
  try {
    const upright = await standardizeToJpeg(file.buffer, file.originalname, file.mimetype);
    const jpeg = await compress(upright);
    return { ok: true, jpeg, name: file.originalname };
  } catch (err) {
    return { ok: false, name: file.originalname, reason: shortReason(err) };
  }
}

/**
 * Turn a batch of uploaded image files into a single compressed PDF.
 *
 * @param {Array<{buffer: Buffer, originalname: string, mimetype: string}>} files
 * @returns {Promise<{ pdf: Uint8Array, skipped: Array<{name: string, reason: string}> }>}
 *   `pdf` is the finished PDF; `skipped` lists any files that couldn't be read.
 */
export async function imagesToPdf(files) {
  if (!files || files.length === 0) {
    throw httpError(400, 'No images provided.');
  }

  // Process in small concurrent batches (not all at once). Decoding many large
  // images simultaneously can spike memory/CPU on a small server; batching keeps
  // it stable while still being fast. Order is preserved for the PDF pages.
  const CONCURRENCY = 4;
  const results = [];
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(processOne))));
  }

  const good = results.filter((r) => r.ok);
  const skipped = results
    .filter((r) => !r.ok)
    .map((r) => ({ name: r.name, reason: r.reason }));

  // If nothing could be read, fail with a clear, file-named message (422 =
  // "we understood the request but the content was unprocessable").
  if (good.length === 0) {
    const names = skipped.map((s) => s.name).join(', ');
    const noun = skipped.length === 1 ? 'this file' : 'these files';
    throw httpError(
      422,
      `Couldn't read ${noun} — they may be corrupt or not a real image: ${names}.`,
    );
  }

  const pdf = await buildPdf(good.map((g) => g.jpeg));
  return { pdf, skipped };
}
