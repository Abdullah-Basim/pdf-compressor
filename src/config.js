// config.js
// One single place for every "magic number" and rule in the app.
// Keeping these here (instead of sprinkled through the code) means you can
// tune behavior in one spot, and there are no surprise hardcoded values.

// The longest side an image is allowed to be after compression.
// Anything bigger gets scaled down to this; anything smaller is left alone.
// 2000px is plenty sharp for screen viewing and normal printing.
export const MAX_EDGE = 2000;

// JPEG quality, 1 (tiny + ugly) .. 100 (huge + perfect). 75 is the sweet spot:
// big file-size savings with no obvious loss of quality to the eye.
export const JPEG_QUALITY = 75;

// The image types we advertise/support. sharp reads jpeg/png/webp/tiff/gif/avif
// natively; heic is handled via heic-convert. We don't hard-reject on this list
// anymore (browsers send inconsistent MIME types) — instead we TRY to decode
// every file and report any that can't be read. This list is used for the file
// picker hint and for documentation.
export const ALLOWED = [
  'image/jpeg', // covers .jpg AND .jpeg (same type)
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/tiff',
  'image/gif',
  'image/avif',
];

// Helper: is this file an HEIC/HEIF photo (the format iPhones use)?
// We check BOTH the MIME type and the filename extension, because some
// browsers/phones send HEIC with a generic or empty MIME type. Belt and braces.
export function isHeic(mimetype = '', filename = '') {
  const mime = mimetype.toLowerCase();
  const name = filename.toLowerCase();
  return (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}
