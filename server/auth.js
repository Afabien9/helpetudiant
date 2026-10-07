"use strict";

/* Mots de passe, jetons à usage unique, sessions et limitation des tentatives. */

const crypto = require("crypto");
const { promisify } = require("util");
const { data } = require("./db");

const scrypt = promisify(crypto.scrypt);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

/* ---------- Mots de passe (scrypt + sel aléatoire) ---------- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored || "").split("$");
  if (alg !== "scrypt" || !hashHex) {            // compte sans mot de passe : même durée de calcul
    await scrypt(password, Buffer.alloc(16), 64);
    return false;
  }
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/* ---------- Jetons (confirmation, réinitialisation) : hachés, expirants, à usage unique ---------- */
function createToken(type, email, ttlMs) {
  const raw = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  data.tokens = data.tokens.filter((t) => t.expires > now && !(t.type === type && t.email === email));
  data.tokens.push({ hash: sha(raw), type, email, expires: now + ttlMs });
  return raw;
}

function consumeToken(type, raw) {
  const hash = sha(String(raw || ""));
  const i = data.tokens.findIndex((t) => t.type === type && t.hash === hash);
  if (i < 0) return null;
  const [token] = data.tokens.splice(i, 1);      // supprimé : impossible de le réutiliser
  return token.expires > Date.now() ? token : null;
}

/* ---------- Sessions (cookie HttpOnly) ---------- */
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(email, ttlMs) {
  const sid = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  for (const [k, s] of Object.entries(data.authSessions)) if (s.expires < now) delete data.authSessions[k];
  data.authSessions[sha(sid)] = { email, expires: now + ttlMs };
  return sid;
}

function sessionUser(req) {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const session = data.authSessions[sha(sid)];
  if (!session || session.expires < Date.now()) return null;
  const user = data.users[session.email];
  return user && user.status === "active" ? user : null;
}

function destroySession(req) {
  const sid = parseCookies(req).sid;
  if (sid) delete data.authSessions[sha(sid)];
}

function dropUserSessions(email) {
  for (const [k, s] of Object.entries(data.authSessions)) if (s.email === email) delete data.authSessions[k];
}

function cookie(value, maxAgeSec, secure) {
  const parts = [`sid=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAgeSec !== null) parts.push(`Max-Age=${maxAgeSec}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/* ---------- Limitation des tentatives de connexion (par adresse e-mail) ---------- */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map();   // email -> { count, lockedUntil }

function lockRemainingMs(email) {
  const a = attempts.get(email);
  return a && a.lockedUntil > Date.now() ? a.lockedUntil - Date.now() : 0;
}
function recordFailure(email) {
  const a = attempts.get(email) || { count: 0, lockedUntil: 0 };
  a.count++;
  if (a.count >= MAX_ATTEMPTS) { a.count = 0; a.lockedUntil = Date.now() + LOCK_MS; }
  attempts.set(email, a);
  return a.lockedUntil > Date.now();
}
const clearFailures = (email) => attempts.delete(email);

module.exports = {
  hashPassword, verifyPassword, createToken, consumeToken,
  createSession, sessionUser, destroySession, dropUserSessions, cookie,
  lockRemainingMs, recordFailure, clearFailures, LOCK_MS
};
