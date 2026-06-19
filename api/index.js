// api/index.js — the entry point Vercel uses in production.
//
// Vercel doesn't run a long-lived `app.listen()` server. Instead it imports
// this file and calls our exported Express `app` as a request handler, once per
// incoming request. So all we do here is import the same app from server.js and
// export it as the default export. Locally we still use `npm start` (server.js).
import { app } from '../server.js';

export default app;
