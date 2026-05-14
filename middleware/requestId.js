const crypto = require('crypto');

/**
 * Attaches a unique request ID to every request and response.
 * Reuses the client-supplied X-Request-ID if present and valid,
 * otherwise generates a fresh one. Downstream code can read
 * req.requestId for logging / tracing.
 */
const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  // Accept client-provided IDs only if they look safe (alphanumeric + hyphens, ≤ 64 chars)
  const id =
    incoming && /^[a-zA-Z0-9-]{1,64}$/.test(incoming)
      ? incoming
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};

module.exports = requestId;
