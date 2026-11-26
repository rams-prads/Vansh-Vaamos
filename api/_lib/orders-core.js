/*
 * Validation and pricing, shared by every storage backend.
 *
 * The important rule lives here: prices and totals are always taken from the
 * catalogue, never from whatever the browser posted.
 */

'use strict';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanCustomer(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    name:    str(c.name, 120),
    phone:   str(c.phone, 30),
    email:   str(c.email, 160),
    address: str(c.address, 500),
    pincode: str(c.pincode, 12),
    note:    str(c.note, 500)
  };
}

function checkCustomer(c) {
  const bad = [];
  if (c.name.length < 2)                   bad.push('name');
  if (!/^[0-9+\-\s()]{7,}$/.test(c.phone)) bad.push('phone');
  if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) bad.push('email');
  if (c.address.length < 6)                bad.push('address');
  if (!/^[0-9]{4,10}$/.test(c.pincode))    bad.push('pincode');
  return bad;
}

/**
 * Turn a posted basket into priced lines using the real catalogue.
 * @returns {{error:string}|{total:number, lines:Array}}
 */
function priceBasket(products, rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (items.length === 0) return { error: 'Your bag is empty' };
  if (items.length > 50)  return { error: 'Too many items' };

  const byId = new Map(products.map(p => [Number(p.id), p]));
  const lines = [];
  let total = 0;

  for (const it of items) {
    const product = byId.get(Number(it && it.id));
    if (!product) return { error: 'Unknown product in basket' };

    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return { error: 'Bad quantity for ' + product.name };
    }

    const size = str(it.size, 20);
    const sizes = Array.isArray(product.sizes) ? product.sizes : JSON.parse(product.sizes);
    if (!sizes.includes(size)) {
      return { error: 'Bad size for ' + product.name };
    }

    total += product.price * qty;            // price from the catalogue
    lines.push({
      productId: product.id,
      name: product.name,
      size,
      qty,
      unitPrice: product.price
    });
  }

  return { total, lines };
}

module.exports = { cleanCustomer, checkCustomer, priceBasket, str };
