// server.js
// The web layer. It does three jobs and nothing more:
//   1. serve the simple upload page (public/)
//   2. accept uploaded images at POST /api/convert
//   3. hand them to the pipeline and send back the PDF
//
// We export `app` (so the tests can drive it with supertest) and only actually
// start listening when this file is run directly with `node server.js`.

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { imagesToPdf } from './src/pipeline.js';
import { ALLOWED } from './src/config.js';

// __dirname doesn't exist in ES modules, so we rebuild it from import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// multer in MEMORY mode: uploaded files arrive as Buffers in req.files,
// never written to disk. No artificial size limit (per the requirement).
const upload = multer({ storage: multer.memoryStorage() });

// Serve the static front-end (index.html, app.js, styles.css) from /public.
app.use(express.static(path.join(__dirname, 'public')));

// The one real endpoint.
// upload.array('images') reads every file sent under the form field "images".
app.post('/api/convert', upload.array('images'), async (req, res) => {
  try {
    const files = req.files ?? [];

    // Guard 1: nothing uploaded.
    if (files.length === 0) {
      return res.status(400).json({ error: 'No images were uploaded.' });
    }

    // Guard 2: every file must be an allowed image type.
    // We name the offending file so the user knows exactly what to remove.
    const bad = files.find((f) => !ALLOWED.includes(f.mimetype));
    if (bad) {
      return res.status(400).json({
        error: `Unsupported file type: "${bad.originalname}". Allowed: JPG, PNG, HEIC.`,
      });
    }

    // The actual work — produce the PDF bytes.
    const pdfBytes = await imagesToPdf(files);

    // Tell the browser this is a PDF download named images.pdf.
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="images.pdf"');
    // pdfBytes is a Uint8Array; wrap as a Buffer so Express sends it raw.
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    // Log the full error on the server for debugging...
    console.error('Conversion failed:', err);
    // ...but send the client a safe, generic message (no internal details leaked).
    return res.status(500).json({ error: 'Failed to convert images to PDF.' });
  }
});

// Start the server only when run directly (not when imported by a test, and not
// on Vercel). `import.meta.url` is this file's URL; process.argv[1] is the file
// Node was told to run. If they match, we were launched directly. On Vercel,
// process.env.VERCEL is set and the app is invoked per-request instead, so we
// must NOT call listen() there (it would hang waiting for a port Vercel never opens).
const isRunDirectly =
  process.argv[1] === fileURLToPath(import.meta.url) && !process.env.VERCEL;
if (isRunDirectly) {
  const PORT = process.env.PORT || 3000;
  // host 0.0.0.0 so a phone on the same Wi-Fi can reach it via your LAN IP.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDF compressor running at http://localhost:${PORT}`);
  });
}
