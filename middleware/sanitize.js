const xss = require('xss');

/**
 * Recursively walks req.body / req.query / req.params and strips XSS
 * payloads from every string value.
 *
 * Non-string primitives and null are left untouched so that downstream
 * validation still receives the correct types.
 */
const sanitizeValue = (val) => {
  if (typeof val === 'string') return xss(val);
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return val;
};

const sanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

module.exports = sanitize;
