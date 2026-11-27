import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
const dataFile = path.join(dataDir, 'submissions.json');
const isDev = process.argv.includes('dev');
const port = Number(process.env.PORT || 3001);
const rate = new Map();
const catalog = new Map([[1,['Everyday Classic Tee',399]],[2,['Street Runner Sneakers',1299]],[3,['Weekend Carryall',899]],[4,['Wireless Earbuds',749]],[5,['Minimalist Wristwatch',599]],[6,['Cozy Hoodie',899]],[7,['Everyday Backpack',1099]],[8,['Portable Bluetooth Speaker',999]],[9,['Classic Cap',299]],[10,['Daily Comfort Slides',449]]]);

function readData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return { contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [], subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [], orders: Array.isArray(parsed.orders) ? parsed.orders : [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { contacts: [], subscribers: [], orders: [] };
    throw new Error('Stored data could not be read safely.');
  }
}
function saveData(data) {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, dataFile);
}
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error('Request is too large.');
  }
  return JSON.parse(raw || '{}');
}
function limited(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rate.get(ip) || { start: now, count: 0 };
  if (now - entry.start > 60_000) { entry.start = now; entry.count = 0; }
  entry.count++;
  rate.set(ip, entry);
  return entry.count > 12;
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { return send(res, 400, { error: 'Invalid request URL.' }); }
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true });
  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
    if (limited(req)) return send(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
    let input;
    try { input = await body(req); }
    catch (error) { return send(res, 400, { error: error.message === 'Request is too large.' ? error.message : 'Please submit a valid form.' }); }
    if (clean(input.website, 200)) return send(res, 400, { error: 'Unable to submit this form.' }); // honeypot
    let data;
    try { data = readData(); }
    catch { return send(res, 500, { error: 'Store data is temporarily unavailable. Please try again later.' }); }
    const now = new Date().toISOString();

    if (url.pathname === '/api/contact') {
      const name = clean(input.name, 100), email = clean(input.email, 254).toLowerCase(), message = clean(input.message, 3000);
      const errors = {};
      if (name.length < 2) errors.name = 'Please enter your name (at least 2 characters).';
      if (!validEmail(email)) errors.email = 'Enter a valid email address.';
      if (message.length < 10) errors.message = 'Please write at least 10 characters.';
      if (Object.keys(errors).length) return send(res, 422, { error: 'Please check the highlighted fields.', fields: errors });
      data.contacts.push({ id: `MSG-${Date.now()}`, name, email, message, createdAt: now });
      try { saveData(data); } catch { return send(res, 500, { error: 'Your message could not be saved. Please try again.' }); }
      return send(res, 201, { ok: true, message: 'Your message was saved. We will be in touch soon.' });
    }

    if (url.pathname === '/api/newsletter') {
      const email = clean(input.email, 254).toLowerCase();
      if (!validEmail(email)) return send(res, 422, { error: 'Enter a valid email address.', fields: { email: 'Enter a valid email address.' } });
      if (data.subscribers.some(item => item.email === email)) return send(res, 409, { error: 'That email is already subscribed.' });
      data.subscribers.push({ email, createdAt: now });
      try { saveData(data); } catch { return send(res, 500, { error: 'Your subscription could not be saved. Please try again.' }); }
      return send(res, 201, { ok: true, message: 'You are subscribed! Thanks for joining us.' });
    }

    if (url.pathname === '/api/orders') {
      const customer = input.customer || {};
      const items = Array.isArray(input.items) ? input.items : [];
      const name = clean(customer.name, 100), phone = clean(customer.phone, 30), address = clean(customer.address, 500);
      const payment = clean(customer.payment, 40);
      const errors = {};
      if (name.length < 2) errors.name = 'Enter your full name.';
      if (!/^[0-9+()\-\s]{7,20}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
      if (address.length < 8) errors.address = 'Enter a complete delivery address.';
      if (!['Cash on Delivery', 'GCash', 'Bank Transfer'].includes(payment)) errors.payment = 'Choose a valid payment method.';
      if (!items.length || items.length > 50) errors.items = 'Your cart is empty or invalid.';
      let total = 0;
      const safeItems = items.map(item => {
        const id = Number(item.id), qty = Number(item.qty), product = catalog.get(id);
        if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) return null;
        const [productName, price] = product;
        total += price * qty;
        return { id, name: productName, qty, price };
      });
      if (safeItems.some(item => !item) || !Number.isFinite(total)) errors.items = 'One or more cart items are invalid.';
      if (Object.keys(errors).length) return send(res, 422, { error: 'Please check your order details.', fields: errors });
      const order = { number: `JS-${Date.now().toString().slice(-8)}`, customer: { name, phone, address, payment, notes: clean(customer.notes, 1000) }, items: safeItems, total, status: payment === 'Cash on Delivery' ? 'Pending confirmation' : 'Awaiting manual payment instructions', createdAt: now };
      data.orders.push(order);
      try { saveData(data); } catch { return send(res, 500, { error: 'Your order could not be saved. Please try again.' }); }
      return send(res, 201, { ok: true, order });
    }
    return send(res, 404, { error: 'API endpoint not found.' });
  }

  if (isDev) return send(res, 404, { error: 'Not found.' });
  const dist = path.join(root, 'dist');
  let requested;
  try { requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
  catch { return send(res, 400, { error: 'Invalid path encoding.' }); }
  let file = path.resolve(dist, `.${requested}`);
  if (!file.startsWith(dist + path.sep) && file !== path.join(dist, 'index.html')) return send(res, 403, { error: 'Forbidden.' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '0.0.0.0', () => console.log(`John's Shop API ${isDev ? 'and dev launcher' : 'server'} listening on port ${port}`));
if (isDev) {
  const vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0'], { cwd: root, stdio: 'inherit' });
  const stop = () => { vite.kill(); server.close(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
