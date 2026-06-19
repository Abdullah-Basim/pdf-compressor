// test/upload.test.js
// INTEGRATION tests for the real upload endpoint, using supertest to fire
// fake HTTP requests at the Express app — no real network or browser needed.
//
// "Mobile vs web" is, from the server's point of view, just a different shape
// of multipart upload (number of files, filenames, MIME types). So we simulate
// both shapes here, which is exactly what the requirement is really testing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { app } from '../server.js';
import { makePng, makeJpeg } from './helpers.js';

test('WEB shape: multiple files -> returns a PDF', async () => {
  const png = await makePng(300, 200);
  const jpg = await makeJpeg(200, 300);

  const res = await request(app)
    .post('/api/convert')
    .attach('images', png, { filename: 'scan1.png', contentType: 'image/png' })
    .attach('images', jpg, { filename: 'scan2.jpg', contentType: 'image/jpeg' });

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/pdf/);
  assert.equal(Buffer.from(res.body.slice(0, 4)).toString(), '%PDF');
});

test('MOBILE shape: single camera-style photo -> returns a PDF', async () => {
  const photo = await makeJpeg(1080, 1440); // portrait, like a phone snap

  const res = await request(app)
    .post('/api/convert')
    .attach('images', photo, { filename: 'IMG_4821.JPG', contentType: 'image/jpeg' });

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/pdf/);
});

test('error: no files uploaded -> 400', async () => {
  const res = await request(app).post('/api/convert');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /No images/);
});

test('error: unsupported file type -> 400 naming the bad file', async () => {
  const res = await request(app)
    .post('/api/convert')
    .attach('images', Buffer.from('hello world'), {
      filename: 'notes.txt',
      contentType: 'text/plain',
    });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /notes\.txt/);
});
