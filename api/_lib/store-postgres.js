/*
 * Postgres backend — used on Vercel, where the filesystem is read-only and
 * SQLite would lose every order. Picked automatically when DATABASE_URL (or
 * POSTGRES_URL) is present, which the Vercel/Neon integration sets for you.
 */

'use strict';

const { Pool } = require('pg');
const catalogue = require('./catalogue');

const CONNECTION =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

// One pool per warm instance. Neon's pooled endpoint handles the rest.
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: CONNECTION,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

let ready = null;

/* Create the tables and sync the catalogue. Runs once per warm instance. */
function init() {
  if (ready) return ready;

  ready = (async () => {
    const db = getPool();

    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id       integer PRIMARY KEY,
        name     text    NOT NULL,
        sub      text    NOT NULL DEFAULT '',
        price    integer NOT NULL,
        category text    NOT NULL,
        tag      text,
        img      text    NOT NULL,
        alt      text    NOT NULL,
        sizes    jsonb   NOT NULL,
        stock    integer NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS orders (
        id         serial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        name       text    NOT NULL,
        phone      text    NOT NULL,
        email      text    NOT NULL DEFAULT '',
        address    text    NOT NULL,
        pincode    text    NOT NULL,
        note       text    NOT NULL DEFAULT '',
        total      integer NOT NULL,
        status     text    NOT NULL DEFAULT 'new'
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id         serial PRIMARY KEY,
        order_id   integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id integer NOT NULL,
        name       text    NOT NULL,
        size       text    NOT NULL,
        qty        integer NOT NULL,
        unit_price integer NOT NULL
      );
    `);

    // products.json is the source of truth for the catalogue; stock is left
    // alone on update because orders may already have decremented it.
    for (const p of catalogue.fromFile()) {
      await db.query(
        `INSERT INTO products (id, name, sub, price, category, tag, img, alt, sizes, stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, sub = EXCLUDED.sub, price = EXCLUDED.price,
           category = EXCLUDED.category, tag = EXCLUDED.tag, img = EXCLUDED.img,
           alt = EXCLUDED.alt, sizes = EXCLUDED.sizes`,
        [p.id, p.name, p.sub || '', p.price, p.category, p.tag ?? null,
         p.img, p.alt, JSON.stringify(p.sizes),
         Number.isInteger(p.stock) ? p.stock : 0]
      );
    }
  })().catch(err => {
    ready = null;            // let the next request retry
    throw err;
  });

  return ready;
}

async function getProducts() {
  await init();
  const { rows } = await getPool().query('SELECT * FROM products ORDER BY id');
  return rows.map(r => ({ ...r, sizes: r.sizes }));
}

async function createOrder(customer, lines, total) {
  await init();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO orders (name, phone, email, address, pincode, note, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [customer.name, customer.phone, customer.email,
       customer.address, customer.pincode, customer.note, total]
    );
    const orderId = rows[0].id;

    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, size, qty, unit_price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [orderId, l.productId, l.name, l.size, l.qty, l.unitPrice]
      );
      await client.query(
        'UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2',
        [l.qty, l.productId]
      );
    }

    await client.query('COMMIT');
    return orderId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function listOrders() {
  await init();
  const db = getPool();
  const { rows: orders } = await db.query(
    'SELECT * FROM orders ORDER BY id DESC LIMIT 200'
  );
  if (!orders.length) return [];

  const { rows: items } = await db.query(
    'SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id',
    [orders.map(o => o.id)]
  );

  const grouped = new Map();
  for (const i of items) {
    if (!grouped.has(i.order_id)) grouped.set(i.order_id, []);
    grouped.get(i.order_id).push(i);
  }
  return orders.map(o => ({ ...o, items: grouped.get(o.id) || [] }));
}

module.exports = { kind: 'postgres', getProducts, createOrder, listOrders };
