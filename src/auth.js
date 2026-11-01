// Acceso al panel: un único usuario y contraseña definidos en .env.
// La sesión es una cookie firmada; no hay registro ni base de usuarios.
const crypto = require('node:crypto');
const { admin } = require('./config');

const COOKIE = 'jh_admin';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 días
const secret = admin.sessionSecret || crypto.randomBytes(32).toString('hex');

const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('base64url');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function isLoggedIn(req) {
  const v = readCookie(req, COOKIE);
  if (!v) return false;
  const [exp, sig] = v.split('.');
  return Boolean(exp && sig) && safeEqual(sig, sign(exp)) && Number(exp) > Date.now() / 1000;
}

function cookieAttrs(req) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function login(req, res) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE_S);
  res.append('Set-Cookie', `${COOKIE}=${exp}.${sign(exp)}; Max-Age=${MAX_AGE_S}; ${cookieAttrs(req)}`);
}

function logout(req, res) {
  res.append('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`);
}

// Intentos fallidos por IP, para frenar a quien pruebe contraseñas a lo bruto.
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  return a && a.count >= 8 && Date.now() - a.first < 15 * 60 * 1000;
}
function recordFailure(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > 15 * 60 * 1000) attempts.set(ip, { count: 1, first: Date.now() });
  else a.count++;
}

function checkCredentials(user, pass) {
  if (!admin.password) return false;
  return safeEqual(user, admin.user) & safeEqual(pass, admin.password);
}

// Los formularios del panel solo se aceptan si vienen de esta misma web.
function sameOrigin(req) {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function requireAdmin(req, res, next) {
  if (!isLoggedIn(req)) return res.redirect('/admin/login');
  if (req.method === 'POST' && !sameOrigin(req)) return res.status(403).send('Origen no permitido');
  res.set('Cache-Control', 'no-store');
  next();
}

module.exports = {
  isLoggedIn, login, logout, requireAdmin, checkCredentials, tooManyAttempts, recordFailure,
  enabled: () => Boolean(admin.password)
};
