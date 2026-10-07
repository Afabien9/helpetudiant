"use strict";

/* Entraide Étudiants : serveur sans dépendance (fichiers statiques + API + temps réel).
   Lancer avec :  node server.js   puis ouvrir http://localhost:8000 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { data: db, persist, flushSync, nextId } = require("./server/db");
const auth = require("./server/auth");
const { routes, RAW, HttpError, SCHOOL_DOMAIN } = require("./server/routes");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const MAX_BODY = 20_000;

/* ---------- Premier lancement : matières de base + compte administrateur ---------- */
async function bootstrap() {
  if (!db.subjects.length) {
    for (const name of ["Mathématiques", "Physique", "Informatique", "Chimie"]) {
      db.subjects.push({ id: nextId(), name, archived: false });
    }
  }
  if (!Object.values(db.users).some((u) => u.role === "admin")) {
    const email = (process.env.ADMIN_EMAIL || `admin@${SCHOOL_DOMAIN}`).toLowerCase();
    const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
    db.users[email] = {
      email, name: "Administrateur", initials: "AD", year: "M2", subjects: [], role: "admin", status: "active",
      passHash: await auth.hashPassword(password), joined: new Date().toISOString()
    };
    console.log("\n  Compte administrateur créé");
    console.log(`    e-mail       : ${email}`);
    console.log(`    mot de passe : ${password}${process.env.ADMIN_PASSWORD ? "" : "   (affiché une seule fois, à changer dans « Mon profil »)"}\n`);
  }
  persist();
}

/* ---------- Réponses ---------- */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS, ...headers });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) { reject(new HttpError(413, "Requête trop volumineuse.")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new HttpError(400, "JSON invalide.")); }
    });
  });
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
  if (!route) {
    const known = routes.some((r) => r.re.test(url.pathname));
    return send(res, known ? 405 : 404, { error: known ? "Méthode non autorisée." : "Introuvable." });
  }

  // Protection CSRF : une requête qui modifie des données doit venir de notre propre site
  if (req.method !== "GET") {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { error: "Origine refusée." });
  }

  const params = {};
  const match = url.pathname.match(route.re);
  route.keys.forEach((k, i) => { params[k] = match[i + 1]; });

  let user = null;
  if (route.opts.auth) {
    user = auth.sessionUser(req);
    if (!user) return send(res, 401, { error: "Connexion requise." });
    if (route.opts.auth === "admin" && user.role !== "admin") return send(res, 403, { error: "Accès réservé aux administrateurs." });
  }

  const body = req.method === "GET" || req.method === "DELETE" ? {} : await readJson(req);
  const result = await route.handler({ req, res, url, params, body, user });
  if (result !== RAW) send(res, 200, result ?? { ok: true });
}

/* ---------- Fichiers statiques (liste blanche : jamais server/, data.json ni package.json) ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const STATIC_PATH = /^\/((js|pages)\/)?[\w-]+\.(html|css|js)$/;

function serveStatic(res, pathname) {
  if (pathname === "/") pathname = "/index.html";
  if (!STATIC_PATH.test(pathname) || pathname === "/server.js") return send(res, 404, { error: "Introuvable." });
  fs.readFile(path.join(ROOT, pathname), (err, content) => {
    if (err) return send(res, 404, { error: "Introuvable." });
    res.writeHead(200, { "Content-Type": TYPES[path.extname(pathname)], "Cache-Control": "no-cache", ...SECURITY_HEADERS });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
    else serveStatic(res, url.pathname);
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: "Erreur interne du serveur." });
  }
});

bootstrap().then(() => {
  server.listen(PORT, () => console.log(`Entraide Étudiants : http://localhost:${PORT}`));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { flushSync(); process.exit(0); });
}
