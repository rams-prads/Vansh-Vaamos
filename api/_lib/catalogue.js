/*
 * The catalogue file. Required statically so Vercel's file tracing bundles
 * products.json with the deployed functions.
 */

'use strict';

const list = require('../../products.json');

function fromFile() {
  // hand back a copy so callers can't mutate the cached module
  return list.map(p => ({ ...p, sizes: [...p.sizes] }));
}

module.exports = { fromFile };
