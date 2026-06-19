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

    // Guard: nothing uploaded.
    if (files.length === 0) {
      return res.status(400).json({ error: 'No images were uploaded.' });
    }

    // We don't pre-filter by MIME type (browsers send inconsistent types). The
    // pipeline TRIES to decode every file and tells us which (if any) it couldn't
    // read, so we accept all formats and only complain about genuinely bad files.
    const { pdf, skipped } = await imagesToPdf(files);

    // Tell the browser this is a PDF download named images.pdf.
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="images.pdf"');
    // If some files were unreadable but others worked, report the skipped ones in
    // a header the front-end can show (and expose it to browser fetch via CORS).
    if (skipped.length > 0) {
      res.set('Access-Control-Expose-Headers', 'X-Skipped-Files');
      res.set('X-Skipped-Files', skipped.map((s) => s.name).join(' | '));
    }
    // pdf is a Uint8Array; wrap as a Buffer so Express sends it raw.
    return res.send(Buffer.from(pdf));
  } catch (err) {
    // Errors tagged with a statusCode are caused by the user's input (e.g. all
    // files corrupt) — return that status with the helpful, safe message.
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    // Anything else is an unexpected server fault: log details, return generic.
    console.error('Conversion failed:', err);
    return res.status(500).json({ error: 'Failed to convert images to PDF.' });
  }
});

// Start the server only when run directly (not when imported by a test, and not
// on Vercel). On Vercel, process.env.VERCEL is set and the app is invoked
// per-request instead, so we must NOT call listen() there (it would hang).
const isRunDirectly =
  process.argv[1] === fileURLToPath(import.meta.url) && !process.env.VERCEL;
if (isRunDirectly) {
  const PORT = process.env.PORT || 3000;
  // host 0.0.0.0 so a phone on the same Wi-Fi can reach it via your LAN IP.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDF compressor running at http://localhost:${PORT}`);
  });
}
