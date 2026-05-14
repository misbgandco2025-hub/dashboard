const rateLimit = require('express-rate-limit');

// ── Global IP-based limiter ───────────────────────────────────────────────────
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// ── Stricter limiter for auth endpoints ──────────────────────────────────────
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

// ── Per authenticated-user limiter ───────────────────────────────────────────
// Keyed on the user's DB ID once logged in; falls back to IP for anonymous requests.
const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user ? String(req.user._id) : (req.ip || 'unknown'),
  message: {
    success: false,
    message: 'You have made too many requests. Please slow down and try again in 15 minutes.',
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

module.exports = rateLimiter;
module.exports.authRateLimiter = authRateLimiter;
module.exports.userRateLimiter = userRateLimiter;
