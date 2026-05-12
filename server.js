require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Cache DB connection across warm invocations (serverless)
let isConnected = false;

const ensureDB = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

// ── Vercel Serverless export ───────────────────────────────────────────────────
// @vercel/node requires module.exports to be a handler function.
// app.listen() does NOT work in serverless — Vercel handles the HTTP layer.
module.exports = async (req, res) => {
  try {
    await ensureDB();
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    return res.status(500).json({ success: false, message: 'Database connection failed' });
  }
  return app(req, res);
};

// ── Local development ─────────────────────────────────────────────────────────
// Only start a real HTTP server when NOT running on Vercel
if (!process.env.VERCEL) {
  ensureDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`✅ Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}
