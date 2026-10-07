"use strict";

/* API REST de l'application. Chaque route déclare qui peut l'appeler (auth: "user" | "admin"). */

const { data: db, persist, nextId } = require("./db");
const auth = require("./auth");
const { mails, BASE_URL } = require("./mail");

const SCHOOL_DOMAIN = "ecole.fr";
const MIN_PASSWORD = 12;
const LEVELS = ["L1", "L2", "L3", "M1", "M2"];
const PLACES = ["En ligne ou salle", "En ligne", "Salle B12", "Salle C3", "Bibliothèque", "Lien visio"];
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

/* ---------- Validation & utilitaires ---------- */
const norm = (e) => String(e || "").trim().toLowerCase();
const isSchoolEmail = (e) => typeof e === "string" && e.length <= 120 &&
  new RegExp(`^[^@\\s]+@${SCHOOL_DOMAIN.replace(".", "\\.")}$`, "i").test(e.trim());
const text = (v, min, max, label) => {
  const s = String(v ?? "").trim();
  if (s.length < min || s.length > max) fail(400, `${label} : entre ${min} et ${max} caractères.`);
  return s;
};

function nameFromEmail(email) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const [first = "", last = ""] = email.split("@")[0].split(/[._-]/);
  return [first, last].filter(Boolean).map(cap).join(" ") || email;
}
const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const person = (email) => {
  const u = db.users[email];
  return u ? { email, name: u.name, initials: u.initials } : { email, name: email, initials: "?" };
};
const publicUser = (u) => ({
  email: u.email, name: u.name, initials: u.initials, year: u.year, subjects: u.subjects, role: u.role, status: u.status
});
const fmtWhen = (iso) => new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function parseWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) fail(400, "Date ou heure invalide.");
  if (d <= new Date()) fail(400, "Impossible de fixer une séance dans le passé.");
  return d.toISOString();
}

/* ---------- Dérivés : statut d'une demande, vues ---------- */
const confirmedSeance = (r) => db.seances.find((s) => s.requestId === r.id && s.status === "confirmed");
function statusOf(r) {
  if (r.closedAt) return "done";
  if (confirmedSeance(r)) return "confirmed";
  const pending = db.seances.some((s) => s.requestId === r.id && s.status === "wait" && new Date(s.when) > new Date());
  if (pending) return "wait";
  return r.proposals.length ? "prop" : "open";
}

const requestView = (r) => ({
  id: r.id, subject: `${r.subject} – ${r.level}`, matiere: r.subject, level: r.level, topic: r.topic,
  place: r.place, desc: r.desc, createdAt: r.createdAt, status: statusOf(r),
  author: person(r.author), proposalCount: r.proposals.length
});

const tutorInfo = (email) => {
  const u = db.users[email];
  return { ...person(email), info: u ? `${u.year}${u.subjects.length ? " · " + u.subjects.slice(0, 2).join(", ") : ""}` : "" };
};

function seanceView(s, me) {
  const r = db.requests.find((x) => x.id === s.requestId);
  const other = s.requester === me ? s.tutor : s.requester;
  const expired = s.status === "wait" && new Date(s.when) <= new Date();
  return {
    id: s.id, requestId: s.requestId, subject: r ? `${r.subject} – ${r.level}` : "Demande supprimée",
    when: s.when, place: s.place, status: expired ? "expired" : s.status,
    proposedBy: s.proposedBy, mustConfirm: s.status === "wait" && !expired && s.proposedBy !== me,
    role: s.requester === me ? "requester" : "tutor", other: person(other)
  };
}

function findRequest(id) {
  const r = db.requests.find((x) => x.id === Number(id));
  if (!r) fail(404, "Demande introuvable.");
  return r;
}

/* ---------- Routeur minimal ---------- */
const routes = [];
function route(method, pattern, opts, handler) {
  if (typeof opts === "function") { handler = opts; opts = {}; }
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ method, re, keys, opts, handler });
}
const RAW = Symbol("raw");   // le handler a pris la main sur la réponse (flux temps réel)

/* =====================================================================
   Authentification
   ===================================================================== */
const secureCookie = BASE_URL.startsWith("https://");

route("POST", "/api/auth/signup", async ({ body }) => {
  const email = norm(body.email), password = String(body.password || "");
  if (!isSchoolEmail(email)) fail(400, `Seules les adresses @${SCHOOL_DOMAIN} sont acceptées.`);
  if (password.length < MIN_PASSWORD) fail(400, `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
  if (password.length > 200) fail(400, "Mot de passe trop long.");
  const existing = db.users[email];
  if (!existing || existing.status === "pending") {
    const name = nameFromEmail(email);
    db.users[email] = {
      ...(existing || {}), email, name, initials: initialsOf(name), year: "L1", subjects: [], role: "student",
      status: "pending", passHash: await auth.hashPassword(password), joined: new Date().toISOString()
    };
    mails.confirmation(email, auth.createToken("confirm", email, DAY));
    persist();
  }
  return { ok: true };   // même réponse que le compte existe déjà ou non
});

route("POST", "/api/auth/confirm", ({ body }) => {
  const token = auth.consumeToken("confirm", body.token);
  if (!token || !db.users[token.email]) fail(400, "Lien invalide ou expiré.");
  const u = db.users[token.email];
  if (u.status === "pending") u.status = "active";
  persist();
  return { ok: true };
});

route("POST", "/api/auth/login", async ({ body, res }) => {
  const email = norm(body.email), password = String(body.password || "");
  const locked = auth.lockRemainingMs(email);
  if (locked) fail(429, `Trop de tentatives. Réessayez dans ${Math.ceil(locked / 60000)} min.`);

  const user = db.users[email];
  const ok = await auth.verifyPassword(password, user && user.passHash);
  if (!ok) {
    if (auth.recordFailure(email)) fail(429, "Trop de tentatives. Connexion bloquée 15 minutes.");
    fail(401, "E-mail ou mot de passe incorrect.");   // message unique
  }
  auth.clearFailures(email);
  if (user.status === "pending") fail(403, "Ce compte n'est pas encore activé. Cliquez sur le lien reçu par e-mail.");
  if (user.status === "suspended") fail(403, "Ce compte est suspendu. Contactez l'administration.");

  const remember = !!body.remember;
  const sid = auth.createSession(email, remember ? 30 * DAY : 12 * HOUR);
  res.setHeader("Set-Cookie", auth.cookie(sid, remember ? 30 * 86400 : null, secureCookie));
  persist();
  return { user: publicUser(user) };
});

route("POST", "/api/auth/logout", ({ req, res }) => {
  auth.destroySession(req);
  res.setHeader("Set-Cookie", auth.cookie("", 0, secureCookie));
  persist();
  return { ok: true };
});

route("POST", "/api/auth/forgot", ({ body }) => {
  const email = norm(body.email), user = db.users[email];
  if (user && user.status === "active") mails.reset(email, auth.createToken("reset", email, HOUR));
  return { ok: true };   // même réponse que l'adresse existe ou non
});

route("POST", "/api/auth/reset", async ({ body }) => {
  const password = String(body.password || "");
  if (password.length < MIN_PASSWORD) fail(400, `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
  if (password.length > 200) fail(400, "Mot de passe trop long.");
  const token = auth.consumeToken("reset", body.token);
  const user = token && db.users[token.email];
  if (!user) fail(400, "Lien invalide ou expiré.");
  user.passHash = await auth.hashPassword(password);
  if (user.status === "pending") user.status = "active";   // l'adresse e-mail est prouvée
  auth.dropUserSessions(user.email);
  persist();
  return { ok: true };
});

/* =====================================================================
   Profil
   ===================================================================== */
route("GET", "/api/me", { auth: "user" }, ({ user }) => publicUser(user));

route("PATCH", "/api/me", { auth: "user" }, ({ user, body }) => {
  if (body.name !== undefined) {
    user.name = text(body.name, 2, 60, "Nom");
    user.initials = initialsOf(user.name);
  }
  if (body.year !== undefined) {
    if (!LEVELS.includes(body.year)) fail(400, "Année d'études invalide.");
    user.year = body.year;
  }
  if (body.subjects !== undefined) {
    if (!Array.isArray(body.subjects)) fail(400, "Matières invalides.");
    const allowed = new Set(db.subjects.filter((s) => !s.archived).map((s) => s.name));
    user.subjects = [...new Set(body.subjects)].filter((s) => allowed.has(s) || user.subjects.includes(s));
  }
  persist();
  return publicUser(user);
});

route("POST", "/api/me/password", { auth: "user" }, async ({ user, body }) => {
  const next = String(body.next || "");
  if (!(await auth.verifyPassword(String(body.current || ""), user.passHash))) fail(400, "Mot de passe actuel incorrect.");
  if (next.length < MIN_PASSWORD || next.length > 200) fail(400, `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
  user.passHash = await auth.hashPassword(next);
  persist();
  return { ok: true };
});

route("GET", "/api/matieres", { auth: "user" }, () =>
  db.subjects.filter((s) => !s.archived).map((s) => s.name));

/* =====================================================================
   Demandes d'aide
   ===================================================================== */
route("GET", "/api/demandes", { auth: "user" }, ({ user }) =>
  db.requests.filter((r) => r.author === user.email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(requestView));

// Demandes des autres étudiants que l'on peut proposer d'aider
route("GET", "/api/demandes/ouvertes", { auth: "user" }, ({ user }) =>
  db.requests
    .filter((r) => r.author !== user.email && !r.closedAt && !confirmedSeance(r) && !r.proposals.some((p) => p.tutor === user.email))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...requestView(r), match: user.subjects.includes(r.subject) })));

route("POST", "/api/demandes", { auth: "user" }, ({ user, body }) => {
  const subject = String(body.subject || "");
  if (!db.subjects.some((s) => s.name === subject && !s.archived)) fail(400, "Choisissez une matière de la liste.");
  if (!LEVELS.includes(body.level)) fail(400, "Niveau invalide.");
  const request = {
    id: nextId(), author: user.email, subject, level: body.level,
    topic: text(body.topic, 2, 60, "Sujet"), desc: text(body.desc, 10, 500, "Description"),
    place: PLACES.includes(body.place) ? body.place : PLACES[0],
    createdAt: new Date().toISOString(), closedAt: null, proposals: []
  };
  db.requests.push(request);
  persist();
  return requestView(request);
});

route("GET", "/api/demandes/:id", { auth: "user" }, ({ user, params }) => {
  const r = findRequest(params.id);
  const isAuthor = r.author === user.email;
  const mine = r.proposals.find((p) => p.tutor === user.email);
  if (!isAuthor && !mine && r.closedAt) fail(404, "Demande introuvable.");
  const visible = isAuthor ? r.proposals : r.proposals.filter((p) => p.tutor === user.email);
  const status = statusOf(r);
  return {
    request: requestView(r),
    role: isAuthor ? "author" : "other",
    proposals: visible.map((p) => ({ id: p.id, at: p.at, status: p.status, tutor: tutorInfo(p.tutor) })),
    seances: db.seances
      .filter((s) => s.requestId === r.id && s.status !== "cancelled" && (s.requester === user.email || s.tutor === user.email))
      .map((s) => seanceView(s, user.email)),
    canPropose: !isAuthor && !mine && status !== "done" && status !== "confirmed"
  };
});

route("POST", "/api/demandes/:id/aide", { auth: "user" }, ({ user, params }) => {
  const r = findRequest(params.id);
  if (r.author === user.email) fail(400, "Vous ne pouvez pas aider votre propre demande.");
  if (r.closedAt) fail(409, "Cette demande est clôturée.");
  if (confirmedSeance(r)) fail(409, "Cette demande a déjà trouvé son tuteur.");
  if (r.proposals.some((p) => p.tutor === user.email)) fail(409, "Vous avez déjà proposé votre aide.");
  r.proposals.push({ id: nextId(), tutor: user.email, at: new Date().toISOString(), status: "pending" });
  mails.newProposal(r.author, person(r.author).name, user.name, r);
  persist();
  return { ok: true };
});

route("POST", "/api/demandes/:id/cloture", { auth: "user" }, ({ user, params }) => {
  const r = findRequest(params.id);
  if (r.author !== user.email) fail(403, "Seul le demandeur peut clôturer sa demande.");
  if (r.closedAt) fail(409, "Demande déjà clôturée.");
  r.closedAt = new Date().toISOString();
  const accepted = confirmedSeance(r);
  if (accepted) mails.thanks(accepted.tutor, person(accepted.tutor).name, user.name, r);
  for (const s of db.seances) if (s.requestId === r.id && s.status === "wait") s.status = "cancelled";
  persist();
  return { ok: true };
});

route("GET", "/api/propositions", { auth: "user" }, ({ user }) =>
  db.requests.filter((r) => r.proposals.some((p) => p.tutor === user.email))
    .map((r) => {
      const p = r.proposals.find((x) => x.tutor === user.email);
      const status = r.closedAt ? "done" : p.status === "accepted" ? "confirmed" : p.status === "declined" ? "declined" : "wait";
      return { requestId: r.id, subject: `${r.subject} – ${r.level}`, topic: r.topic, author: person(r.author), status, at: p.at };
    }).sort((a, b) => b.at.localeCompare(a.at)));

/* =====================================================================
   Séances : l'un propose, l'autre confirme ou propose un autre horaire
   ===================================================================== */
route("GET", "/api/seances", { auth: "user" }, ({ user }) =>
  db.seances.filter((s) => (s.requester === user.email || s.tutor === user.email) && s.status !== "cancelled")
    .map((s) => seanceView(s, user.email)));

route("POST", "/api/demandes/:id/seances", { auth: "user" }, ({ user, params, body }) => {
  const r = findRequest(params.id);
  if (r.closedAt) fail(409, "Cette demande est clôturée.");
  const isAuthor = r.author === user.email;
  const tutor = isAuthor ? norm(body.tutor) : user.email;
  if (!r.proposals.some((p) => p.tutor === tutor)) fail(400, "Ce tuteur n'a pas proposé son aide pour cette demande.");
  const accepted = confirmedSeance(r);
  if (accepted && accepted.tutor !== tutor) fail(409, "Un autre tuteur a déjà été retenu pour cette demande.");
  const when = parseWhen(body.when);
  const place = text(body.place, 2, 60, "Lieu");

  let seance = db.seances.find((s) => s.requestId === r.id && s.tutor === tutor && s.status === "wait");
  if (seance) Object.assign(seance, { when, place, proposedBy: user.email });
  else {
    seance = { id: nextId(), requestId: r.id, requester: r.author, tutor, when, place, status: "wait", proposedBy: user.email, createdAt: new Date().toISOString() };
    db.seances.push(seance);
  }
  const other = isAuthor ? tutor : r.author;
  mails.seanceProposed(other, person(other).name, user.name, r, fmtWhen(when), place);
  persist();
  return seanceView(seance, user.email);
});

function findSeance(id, user) {
  const s = db.seances.find((x) => x.id === Number(id));
  if (!s || (s.requester !== user.email && s.tutor !== user.email)) fail(404, "Séance introuvable.");
  return s;
}

route("POST", "/api/seances/:id/confirmer", { auth: "user" }, ({ user, params }) => {
  const s = findSeance(params.id, user);
  if (s.status !== "wait") fail(409, "Cette séance n'est plus en attente.");
  if (s.proposedBy === user.email) fail(403, "C'est à l'autre étudiant de confirmer.");
  if (new Date(s.when) <= new Date()) fail(409, "Cette proposition est dépassée : proposez un autre horaire.");

  const r = db.requests.find((x) => x.id === s.requestId);
  const firstConfirmation = !confirmedSeance(r);
  s.status = "confirmed";
  for (const p of r.proposals) p.status = p.tutor === s.tutor ? "accepted" : (firstConfirmation ? "declined" : p.status);
  if (firstConfirmation) {
    for (const o of db.seances) if (o.requestId === r.id && o.status === "wait" && o.id !== s.id) o.status = "cancelled";
    for (const p of r.proposals) if (p.tutor !== s.tutor) mails.fulfilled(p.tutor, person(p.tutor).name, r);
  }
  const when = fmtWhen(s.when);
  mails.seanceConfirmed(s.requester, person(s.requester).name, person(s.tutor).name, r, when, s.place, null);
  mails.seanceConfirmed(s.tutor, person(s.tutor).name, person(s.requester).name, r, when, s.place, s.requester);   // le tuteur reçoit l'adresse du demandeur
  persist();
  return seanceView(s, user.email);
});

route("POST", "/api/seances/:id/modifier", { auth: "user" }, ({ user, params, body }) => {
  const s = findSeance(params.id, user);
  if (s.status !== "wait") fail(409, "Cette séance n'est plus en attente.");
  if (s.proposedBy === user.email) fail(403, "Vous avez déjà fait une proposition : attendez la réponse.");
  s.when = parseWhen(body.when);
  s.place = text(body.place, 2, 60, "Lieu");
  s.proposedBy = user.email;
  const r = db.requests.find((x) => x.id === s.requestId);
  const other = s.requester === user.email ? s.tutor : s.requester;
  mails.seanceProposed(other, person(other).name, user.name, r, fmtWhen(s.when), s.place);
  persist();
  return seanceView(s, user.email);
});

/* =====================================================================
   Messagerie (avec flux temps réel)
   ===================================================================== */
const streams = new Map();   // email -> Set<res>
const pushTo = (email, message) => {
  for (const res of streams.get(email) || []) res.write(`data: ${JSON.stringify(message)}\n\n`);
};

route("GET", "/api/utilisateurs", { auth: "user" }, ({ user }) =>
  Object.values(db.users).filter((u) => u.status === "active" && u.email !== user.email)
    .map((u) => ({ email: u.email, name: u.name, initials: u.initials, year: u.year }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr")));

route("GET", "/api/messages", { auth: "user" }, ({ user }) =>
  db.messages.filter((m) => m.from === user.email || m.to === user.email));

route("POST", "/api/messages", { auth: "user" }, ({ user, body }) => {
  const to = norm(body.to);
  const target = db.users[to];
  if (!target || target.status !== "active") fail(400, "Destinataire inconnu.");
  if (to === user.email) fail(400, "Impossible de vous écrire à vous-même.");
  const message = { id: nextId(), from: user.email, to, text: text(body.text, 1, 2000, "Message"), at: new Date().toISOString() };
  db.messages.push(message);
  persist();
  pushTo(user.email, message);
  pushTo(to, message);
  return message;
});

route("GET", "/api/events", { auth: "user" }, ({ req, res, user }) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(": connecté\n\n");
  if (!streams.has(user.email)) streams.set(user.email, new Set());
  streams.get(user.email).add(res);
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => { clearInterval(keepAlive); streams.get(user.email)?.delete(res); });
  return RAW;
});

/* =====================================================================
   Administration
   ===================================================================== */
const subjectView = (s) => ({ id: s.id, name: s.name, archived: s.archived, requests: db.requests.filter((r) => r.subject === s.name).length });
const subjectNameTaken = (name, exceptId) => db.subjects.some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase());

route("GET", "/api/admin/matieres", { auth: "admin" }, () => db.subjects.map(subjectView));

route("POST", "/api/admin/matieres", { auth: "admin" }, ({ body }) => {
  const name = text(body.name, 2, 60, "Nom");
  if (subjectNameTaken(name)) fail(409, "Une matière porte déjà ce nom.");
  const subject = { id: nextId(), name, archived: false };
  db.subjects.push(subject);
  persist();
  return subjectView(subject);
});

route("PATCH", "/api/admin/matieres/:id", { auth: "admin" }, ({ params, body }) => {
  const s = db.subjects.find((x) => x.id === Number(params.id));
  if (!s) fail(404, "Matière introuvable.");
  if (body.name !== undefined) {
    const name = text(body.name, 2, 60, "Nom");
    if (subjectNameTaken(name, s.id)) fail(409, "Une matière porte déjà ce nom.");
    for (const r of db.requests) if (r.subject === s.name) r.subject = name;                  // les anciennes demandes suivent
    for (const u of Object.values(db.users)) u.subjects = u.subjects.map((x) => (x === s.name ? name : x));
    s.name = name;
  }
  if (body.archived !== undefined) s.archived = !!body.archived;   // archivée : plus proposée, mais conservée sur les anciennes demandes
  persist();
  return subjectView(s);
});

const adminUserView = (u) => ({ ...publicUser(u), joined: u.joined, requests: db.requests.filter((r) => r.author === u.email).length });

route("GET", "/api/admin/utilisateurs", { auth: "admin" }, () =>
  Object.values(db.users).map(adminUserView).sort((a, b) => a.name.localeCompare(b.name, "fr")));

route("POST", "/api/admin/utilisateurs", { auth: "admin" }, ({ body }) => {
  const email = norm(body.email);
  if (!isSchoolEmail(email)) fail(400, `Seules les adresses @${SCHOOL_DOMAIN} sont acceptées.`);
  if (db.users[email]) fail(409, "Ce compte existe déjà.");
  const name = nameFromEmail(email);
  db.users[email] = { email, name, initials: initialsOf(name), year: "L1", subjects: [], role: "student", status: "pending", passHash: null, joined: new Date().toISOString() };
  mails.invitation(email, auth.createToken("reset", email, DAY));
  persist();
  return adminUserView(db.users[email]);
});

route("PATCH", "/api/admin/utilisateurs/:email", { auth: "admin" }, ({ user, params, body }) => {
  const target = db.users[norm(decodeURIComponent(params.email))];
  if (!target) fail(404, "Utilisateur introuvable.");
  if (target.email === user.email) fail(400, "Vous ne pouvez pas modifier votre propre compte.");
  if (body.status !== undefined) {
    if (!["active", "suspended"].includes(body.status)) fail(400, "Statut invalide.");
    if (body.status === "active" && !target.passHash) fail(400, "Ce compte n'a pas encore de mot de passe : il doit utiliser le lien d'invitation.");
    target.status = body.status;
    if (body.status === "suspended") auth.dropUserSessions(target.email);
  }
  if (body.role !== undefined) {
    if (!["student", "admin"].includes(body.role)) fail(400, "Rôle invalide.");
    target.role = body.role;
  }
  persist();
  return adminUserView(target);
});

route("DELETE", "/api/admin/utilisateurs/:email", { auth: "admin" }, ({ user, params }) => {
  const email = norm(decodeURIComponent(params.email));
  if (!db.users[email]) fail(404, "Utilisateur introuvable.");
  if (email === user.email) fail(400, "Vous ne pouvez pas supprimer votre propre compte.");
  const mine = new Set(db.requests.filter((r) => r.author === email).map((r) => r.id));
  db.requests = db.requests.filter((r) => !mine.has(r.id));
  for (const r of db.requests) r.proposals = r.proposals.filter((p) => p.tutor !== email);
  db.seances = db.seances.filter((s) => s.requester !== email && s.tutor !== email);
  db.messages = db.messages.filter((m) => m.from !== email && m.to !== email);
  auth.dropUserSessions(email);
  delete db.users[email];
  persist();
  return { ok: true };
});

route("GET", "/api/admin/stats", { auth: "admin" }, () => {
  const users = Object.values(db.users);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ day: d.toLocaleDateString("sv-SE"), count: 0 });
  }
  for (const m of db.messages) {
    const bucket = days.find((d) => d.day === new Date(m.at).toLocaleDateString("sv-SE"));
    if (bucket) bucket.count++;
  }
  const byStatus = { open: 0, wait: 0, prop: 0, confirmed: 0, done: 0 };
  for (const r of db.requests) byStatus[statusOf(r)]++;
  const total = db.requests.length;
  const upcoming = db.seances.filter((s) => s.status === "confirmed" && new Date(s.when) >= new Date()).length;
  return {
    users: {
      total: users.length, active: users.filter((u) => u.status === "active").length,
      pending: users.filter((u) => u.status === "pending").length, suspended: users.filter((u) => u.status === "suspended").length,
      byYear: LEVELS.map((l) => ({ label: l, value: users.filter((u) => u.year === l).length }))
    },
    requests: {
      total, done: byStatus.done, inProgress: total - byStatus.done, byStatus,
      rate: total ? Math.round((byStatus.done / total) * 100) : 0,
      bySubject: db.subjects.map((s) => ({ label: s.name, value: db.requests.filter((r) => r.subject === s.name).length, archived: s.archived }))
        .filter((d) => !d.archived || d.value > 0)
    },
    seances: { upcoming, past: db.seances.filter((s) => s.status === "confirmed").length - upcoming },
    messages: {
      total: db.messages.length, perDay: days,
      conversations: new Set(db.messages.map((m) => [m.from, m.to].sort().join("|"))).size
    }
  };
});

/* =====================================================================
   Boîte mail de démonstration (uniquement depuis la machine locale)
   ===================================================================== */
route("GET", "/api/dev/mails", ({ req }) => {
  const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
  if (!local || process.env.DEV_MAILBOX === "0") fail(404, "Boîte mail de démonstration désactivée.");
  return [...db.mails].reverse();
});

module.exports = { routes, RAW, HttpError, LEVELS, SCHOOL_DOMAIN };
