# Images → PDF (compressor)

Upload images (JPG / JPEG / PNG / HEIC / WebP / TIFF / GIF / AVIF), have them
**standardized** (converted to upright JPEG) and **compressed**, then combined into
a **single PDF** to download. Works the same from a phone or a computer. No limit on
input image size. Any file it can't read (corrupt or not a real image) is skipped
with a clear message, and the rest still convert.

> Need sample files? Run `node scripts/make-samples.js` to generate one valid image
> per format in `sample-images/`.

## Run it

```bash
npm install      # one time — installs dependencies
npm start        # starts the server on http://localhost:3000
```

Open <http://localhost:3000> in a browser. To use it **from your phone**, make sure
the phone is on the same Wi-Fi, find your computer's local IP (e.g. `192.168.1.20`),
and visit `http://192.168.1.20:3000`.

Change the port with `PORT=4000 npm start`.

## How it works (the whole flow)

```
Browser → POST images to /api/convert
            │
   server.js (Express + multer: files arrive in memory as Buffers)
            │
   src/pipeline.js  →  for each image:
        standardize.js  (HEIC → JPEG, auto-rotate via EXIF)
        compress.js     (resize to max 2000px edge, JPEG quality 75)
            │
   buildPdf.js (pdf-lib: one image per page) → PDF bytes
            │
Browser ← PDF download (images.pdf)
```

Nothing is stored on disk — images are processed in memory and discarded after the
response.

## File guide

| File | What it does |
|------|--------------|
| `src/config.js` | All the tunable settings (max size, JPEG quality, allowed types) |
| `src/standardize.js` | Any image → upright JPEG (handles HEIC) |
| `src/compress.js` | Resize cap + JPEG re-encode |
| `src/buildPdf.js` | Stitch JPEGs into one PDF |
| `src/pipeline.js` | Runs the three steps in order |
| `server.js` | Express server + the `/api/convert` upload route |
| `public/` | The simple web page (HTML, CSS, vanilla JS) |
| `test/` | Unit + upload tests (Node's built-in test runner) |

## Tests

```bash
npm test                 # run all tests
npm run test:coverage    # run with a coverage report
```

The tests cover the image→PDF pipeline and simulate both **web** (multiple files)
and **mobile** (single camera-style photo) uploads against the real server.

**HEIC test:** the HEIC decode path is exercised only if you drop a real `.heic`
photo into `test/fixtures/`. Without one, that single test self-skips so the suite
still passes. The HEIC code path itself runs live in the app.

## Tuning

Edit `src/config.js`:
- `MAX_EDGE` — biggest allowed image dimension (default `2000`).
- `JPEG_QUALITY` — 1–100, lower = smaller files (default `75`).
