'use strict';

const store = require('./_lib/store');
const { cleanCustomer, checkCustomer, priceBasket } = require('./_lib/orders-core');

const ON_VERCEL = Boolean(process.env.VERCEL);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

/* Reading orders exposes customer names, phones and addresses, so it needs a
   password anywhere the site is public. Locally (no ADMIN_TOKEN, not Vercel)
   it stays open for convenience. */
function adminAllowed(req) {
  if (!ADMIN_TOKEN) return ON_VERCEL ? 'unset' : true;

  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const supplied = bearer || (req.headers['x-admin-token'] || '').trim();
  return supplied === ADMIN_TOKEN;
}

async function listOrders(req, res) {
  const allowed = adminAllowed(req);

  if (allowed === 'unset') {
    return res.status(503).json({
      error: 'Orders are locked. Set an ADMIN_TOKEN environment variable in ' +
             'your Vercel project settings, then redeploy.'
    });
  }
  if (allowed !== true) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  try {
    const orders = await store.listOrders();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(orders);
  } catch (err) {
    console.error('list orders:', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.userMessage || 'Could not load orders' });
  }
}

async function createOrder(req, res) {
  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Could not read that order' });
  }

  const customer = cleanCustomer(payload.customer);
  const bad = checkCustomer(customer);
  if (bad.length) {
    return res.status(400).json({ error: 'Please check: ' + bad.join(', ') });
  }

  try {
    // price the basket against the real catalogue, never the posted prices
    const products = await store.getProducts();
    const priced = priceBasket(products, payload.items);
    if (priced.error) return res.status(400).json({ error: priced.error });

    const orderId = await store.createOrder(customer, priced.lines, priced.total);
    console.log(`order #${orderId} — ${customer.name} — ${priced.total}`);
    return res.status(201).json({ orderId, total: priced.total });
  } catch (err) {
    console.error('create order:', err);
    return res
      .status(err.statusCode || 500)
      .json({ error: err.userMessage || 'Could not save the order' });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET')  return listOrders(req, res);
  if (req.method === 'POST') return createOrder(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};
