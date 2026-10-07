"use strict";

/* Serveur de messagerie (sans dépendance) : fichiers statiques + API + temps réel (SSE).
   Lancer avec :  node server.js   puis ouvrir http://localhost:8000 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");
const SCHOOL_DOMAIN = "ecole.fr";
const MAX_TEXT = 2000;

/* ---------- Base de données : un simple fichier JSON ---------- */
let db = { users: {}, messages: [], nextId: 1 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) }; } catch { /* premier lancement */ }

let saveTimer;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), () => {}), 200);
};

const isSchoolEmail = (e) => typeof e === "string" && e.length < 120 &&
  new RegExp(`^[^@\\s]+@${SCHOOL_DOMAIN.replace(".", "\\.")}$`, "i").test(e);
const norm = (e) => e.trim().toLowerCase();

/* ---------- Temps réel : une connexion SSE par onglet ouvert ---------- */
const clients = new Map(); // email -> Set<res>
function push(email, message) {
  for (const res of clients.get(email) || []) res.write(`data: ${JSON.stringify(message)}\n\n`);
}

/* ---------- Utilitaires HTTP ---------- */
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) { reject(new Error("too large")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
  });
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const me = norm(url.searchParams.get("me") || "");

  if (req.method === "POST" && url.pathname === "/api/register") {
    const body = await readJson(req);
    const list = Array.isArray(body.users) ? body.users.slice(0, 500) : [body];   // un compte ou un lot
    let added = 0;
    for (const { email, name, initials } of list) {
      if (!isSchoolEmail(email)) continue;
      db.users[norm(email)] = {
        email: norm(email), name: String(name || email).slice(0, 80), initials: String(initials || "?").slice(0, 3)
      };
      added++;
    }
    if (!added) return send(res, 400, { error: "E-mail invalide." });
    persist();
    return send(res, 200, { ok: true, added });
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    return send(res, 200, Object.values(db.users));
  }

  if (req.method === "GET" && url.pathname === "/api/messages") {
    if (!isSchoolEmail(me)) return send(res, 400, { error: "E-mail invalide." });
    return send(res, 200, db.messages.filter((m) => m.from === me || m.to === me));
  }

  if (req.method === "POST" && url.pathname === "/api/messages") {
    const body = await readJson(req);
    const from = norm(String(body.from || "")), to = norm(String(body.to || ""));
    const text = String(body.text || "").trim().slice(0, MAX_TEXT);
    if (!db.users[from] || !db.users[to]) return send(res, 400, { error: "Utilisateur inconnu." });
    if (from === to) return send(res, 400, { error: "Impossible de s'écrire à soi-même." });
    if (!text) return send(res, 400, { error: "Message vide." });
    const message = { id: db.nextId++, from, to, text, at: new Date().toISOString() };
    db.messages.push(message);
    persist();
    push(from, message);
    push(to, message);
    return send(res, 201, message);
  }

  if (req.method === "GET" && url.pathname === "/api/stats") {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ day: d.toLocaleDateString("sv-SE"), count: 0 });   // AAAA-MM-JJ, heure locale
    }
    for (const m of db.messages) {
      const bucket = days.find((d) => d.day === new Date(m.at).toLocaleDateString("sv-SE"));
      if (bucket) bucket.count++;
    }
    const pairs = new Set(db.messages.map((m) => [m.from, m.to].sort().join("|")));
    return send(res, 200, { messagesPerDay: days, messages: db.messages.length, conversations: pairs.size, accounts: Object.keys(db.users).length });
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    if (!isSchoolEmail(me)) return send(res, 400, { error: "E-mail invalide." });
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connecté\n\n");
    if (!clients.has(me)) clients.set(me, new Set());
    clients.get(me).add(res);
    const keepAlive = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(keepAlive);
      clients.get(me)?.delete(res);
    });
    return;
  }

  send(res, 404, { error: "Introuvable." });
}

/* ---------- Fichiers statiques (liste blanche : jamais server.js ni data.json) ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const STATIC_PATH = /^\/((js|pages)\/)?[\w-]+\.(html|css|js)$/;

function serveStatic(res, pathname) {
  if (pathname === "/") pathname = "/index.html";
  if (!STATIC_PATH.test(pathname) || pathname === "/server.js") return send(res, 404, { error: "Introuvable." });
  fs.readFile(path.join(ROOT, pathname), (err, content) => {
    if (err) return send(res, 404, { error: "Introuvable." });
    res.writeHead(200, { "Content-Type": TYPES[path.extname(pathname)], "Cache-Control": "no-cache" });
    res.end(content);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else serveStatic(res, url.pathname);
  } catch {
    if (!res.headersSent) send(res, 400, { error: "Requête invalide." });
  }
}).listen(PORT, () => console.log(`Entraide Étudiants : http://localhost:${PORT}`));
