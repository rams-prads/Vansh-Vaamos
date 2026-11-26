/*
 * Picks the storage backend.
 *
 *   Postgres  — DATABASE_URL / POSTGRES_URL is set (Vercel + Neon)
 *   read-only — on Vercel with no database yet: catalogue works, checkout
 *               is politely disabled. Never SQLite here, because Vercel's
 *               filesystem is read-only and orders would vanish.
 *   SQLite    — local development, no setup needed
 *
 * All three expose the same three functions, so nothing above this file has
 * to care which one is running.
 */

'use strict';

const hasPostgres = Boolean(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL
);

const onVercel = Boolean(process.env.VERCEL);

module.exports = hasPostgres
  ? require('./store-postgres')
  : onVercel
    ? require('./store-readonly')
    : require('./store-sqlite');
