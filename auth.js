// auth.js — Autenticazione utenti (registrazione, login, sessione)
// Password salvate con hash bcrypt. Sessione via JWT in cookie httpOnly.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const storage = require('./storage');

// Segreto per firmare i token. In produzione IMPOSTALO come variabile d'ambiente.
const JWT_SECRET = process.env.JWT_SECRET || 'flowforge-dev-secret-CAMBIAMI';
const COOKIE_NAME = 'ff_session';
const TOKEN_TTL = '30d';

if (!process.env.JWT_SECRET) {
  console.warn('[auth] ATTENZIONE: JWT_SECRET non impostato, uso un valore di default insicuro. Impostalo in produzione!');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setSessionCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 giorni
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Middleware: richiede un utente autenticato. Popola req.user = { id, email }.
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Non autenticato' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.uid, email: payload.email };
    next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'Sessione non valida o scaduta' });
  }
}

// ---- Handler ----

async function register(req, res) {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email non valida' });
    if (password.length < 8) return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });

    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Esiste già un account con questa email' });

    const user = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      email,
      password_hash: await bcrypt.hash(password, 10),
    };
    await storage.createUser(user);
    setSessionCookie(res, user);
    res.json({ id: user.id, email: user.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function login(req, res) {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const user = await storage.getUserByEmail(email);
    // confronto sempre (anche se utente assente) per non rivelare l'esistenza dell'account
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !ok) return res.status(401).json({ error: 'Email o password errati' });
    setSessionCookie(res, user);
    res.json({ id: user.id, email: user.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

function logout(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}

function me(req, res) {
  res.json({ id: req.user.id, email: req.user.email });
}

async function changePassword(req, res) {
  try {
    const current = String(req.body?.currentPassword || '');
    const next = String(req.body?.newPassword || '');
    if (next.length < 8) return res.status(400).json({ error: 'La nuova password deve avere almeno 8 caratteri' });
    const user = await storage.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    const ok = await bcrypt.compare(current, user.password_hash);
    if (!ok) return res.status(403).json({ error: 'Password attuale errata' });
    await storage.updateUser(user.id, { password_hash: await bcrypt.hash(next, 10) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function changeEmail(req, res) {
  try {
    const newEmail = normEmail(req.body?.newEmail);
    const password = String(req.body?.password || '');
    if (!EMAIL_RE.test(newEmail)) return res.status(400).json({ error: 'Email non valida' });
    const user = await storage.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(403).json({ error: 'Password errata' });
    if (newEmail !== user.email) {
      const taken = await storage.getUserByEmail(newEmail);
      if (taken) return res.status(409).json({ error: 'Email già in uso da un altro account' });
    }
    const updated = await storage.updateUser(user.id, { email: newEmail });
    setSessionCookie(res, updated); // rinnova il token con la nuova email
    res.json({ id: updated.id, email: updated.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = {
  requireAuth, COOKIE_NAME,
  register, login, logout, me, changePassword, changeEmail,
};
