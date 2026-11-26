/*
 * SQLite backend — used for local development, so `node server.js` still
 * works offline with no database to set up. Never used on Vercel, where the
 * filesystem is read-only.
 */

'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const catalogue = require('./catalogue');

const DB_FILE = path.join(process.cwd(), 'vamoss.db');

let db;
function getDb() {
  if (db) return db;

  db = new DatabaseSync(DB_FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, sub TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL, category TEXT NOT NULL, tag TEXT,
      img TEXT NOT NULL, alt TEXT NOT NULL, sizes TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
      name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL, pincode TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new'
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL, name TEXT NOT NULL, size TEXT NOT NULL,
      qty INTEGER NOT NULL, unit_price INTEGER NOT NULL
    );
  `);

  const upsert = db.prepare(`
    INSERT INTO products (id, name, sub, price, category, tag, img, alt, sizes, stock)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, sub = excluded.sub, price = excluded.price,
      category = excluded.category, tag = excluded.tag, img = excluded.img,
      alt = excluded.alt, sizes = excluded.sizes
  `);
  for (const p of catalogue.fromFile()) {
    upsert.run(p.id, p.name, p.sub || '', p.price, p.category, p.tag ?? null,
      p.img, p.alt, JSON.stringify(p.sizes),
      Number.isInteger(p.stock) ? p.stock : 0);
  }

  return db;
}

async function getProducts() {
  return getDb().prepare('SELECT * FROM products ORDER BY id').all()
    .map(r => ({ ...r, sizes: JSON.parse(r.sizes) }));
}

async function createOrder(customer, lines, total) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const res = d.prepare(`
      INSERT INTO orders (created_at, name, phone, email, address, pincode, note, total)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(new Date().toISOString(), customer.name, customer.phone, customer.email,
           customer.address, customer.pincode, customer.note, total);

    const orderId = Number(res.lastInsertRowid);
    const addItem = d.prepare(`
      INSERT INTO order_items (order_id, product_id, name, size, qty, unit_price)
      VALUES (?,?,?,?,?,?)
    `);
    const drop = d.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?');

    for (const l of lines) {
      addItem.run(orderId, l.productId, l.name, l.size, l.qty, l.unitPrice);
      drop.run(l.qty, l.productId);
    }
    d.exec('COMMIT');
    return orderId;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

async function listOrders() {
  const d = getDb();
  const orders = d.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  const itemsFor = d.prepare('SELECT * FROM order_items WHERE order_id = ?');
  return orders.map(o => ({ ...o, items: itemsFor.all(o.id) }));
}

module.exports = { kind: 'sqlite', getProducts, createOrder, listOrders };
