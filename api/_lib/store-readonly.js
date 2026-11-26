/*
 * Read-only fallback.
 *
 * Used when the site is deployed but no database is attached yet. The
 * catalogue still works (products.json ships with the deployment), so the
 * shop is fully browsable; only checkout is turned off, with an honest
 * message rather than a 500.
 *
 * SQLite is deliberately NOT used here: on Vercel the filesystem is
 * read-only, so orders written to it would be silently lost.
 */

'use strict';

const catalogue = require('./catalogue');

const NO_DB =
  'Ordering is not switched on yet. Attach a Postgres database to this ' +
  'Vercel project (Storage → Create Database → Neon) and redeploy.';

async function getProducts() {
  return catalogue.fromFile();
}

async function createOrder() {
  const err = new Error(NO_DB);
  err.userMessage = NO_DB;
  err.statusCode = 503;
  throw err;
}

async function listOrders() {
  const err = new Error(NO_DB);
  err.userMessage = NO_DB;
  err.statusCode = 503;
  throw err;
}

module.exports = { kind: 'readonly', getProducts, createOrder, listOrders };
