'use strict';

const store = require('./_lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const products = await store.getProducts();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(products);
  } catch (err) {
    console.error('products:', err);
    return res.status(500).json({ error: 'Could not load the catalogue' });
  }
};
