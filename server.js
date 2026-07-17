const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '2427';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'carts.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- simple file-backed store with a write queue to avoid race conditions ----
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
}
ensureDataFile();

let writeQueue = Promise.resolve();
function readCarts() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('Failed to read carts.json, starting fresh:', e.message);
    return {};
  }
}
function writeCarts(data) {
  writeQueue = writeQueue.then(() => {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  });
  return writeQueue;
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'guest';
}

// ---- API ----

// Get one customer's cart
app.get('/api/cart/:slug', (req, res) => {
  const carts = readCarts();
  const cart = carts[req.params.slug];
  if (!cart) return res.json({ name: null, items: [] });
  res.json(cart);
});

// Save one customer's cart
app.put('/api/cart/:slug', async (req, res) => {
  const { name, items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  const slug = req.params.slug || slugify(name);
  const carts = readCarts();
  carts[slug] = { name: name || slug, items, updatedAt: new Date().toISOString() };
  try {
    await writeCarts(carts);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'write failed' });
  }
});

// Owner: list every cart that has items (requires PIN)
app.get('/api/carts', (req, res) => {
  if (req.query.pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'invalid pin' });
  }
  const carts = readCarts();
  const list = Object.entries(carts)
    .map(([slug, cart]) => ({ slug, name: cart.name, items: cart.items, updatedAt: cart.updatedAt }))
    .filter(c => Array.isArray(c.items) && c.items.length > 0)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  res.json(list);
});

// Owner: clear one customer's cart, e.g. once fulfilled (requires PIN)
app.delete('/api/cart/:slug', async (req, res) => {
  if (req.query.pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'invalid pin' });
  }
  const carts = readCarts();
  const backup = carts[req.params.slug] || null;
  delete carts[req.params.slug];
  try {
    await writeCarts(carts);
    res.json({ ok: true, backup });
  } catch (e) {
    res.status(500).json({ error: 'write failed' });
  }
});

// Owner: restore a cart (used by the dashboard's Undo button)
app.put('/api/cart-restore/:slug', async (req, res) => {
  if (req.query.pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'invalid pin' });
  }
  const { name, items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  const carts = readCarts();
  carts[req.params.slug] = { name, items, updatedAt: new Date().toISOString() };
  try {
    await writeCarts(carts);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'write failed' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Tote is running at http://localhost:${PORT}`);
  console.log(`Owner dashboard PIN: ${ADMIN_PIN} (change with the ADMIN_PIN environment variable)`);
});
