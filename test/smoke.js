"use strict";

/* Test de bout en bout : lance un serveur temporaire (données jetables) et déroule
   inscription, connexion, demandes, séances, messagerie et administration.
   Utilisation :  npm test */

const { spawn } = require("child_process");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = 8100 + Math.floor(Math.random() * 800);
const BASE = `http://localhost:${PORT}`;
const DATA_FILE = path.join(os.tmpdir(), `entraide-test-${process.pid}.json`);
const ADMIN = { email: "admin@ecole.fr", password: "mot-de-passe-admin-1" };
const PASSWORD = "motdepasse-solide-1";

let passed = 0;
const step = (name) => { passed++; console.log(`  ✔ ${name}`); };

/* ---------- Petit client HTTP avec cookies ---------- */
function client() {
  let cookie = "";
  const call = async function (method, url, body, headers = {}) {
    const res = await fetch(BASE + url, {
      method, redirect: "manual",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* pas du JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  };
  call.cookie = () => cookie;
  return call;
}

const anon = client();
async function mailTo(to, subject) {
  const { json } = await anon("GET", "/api/dev/mails");
  return json.find((m) => m.to === to && m.subject.includes(subject));
}
const tokenIn = (mail) => mail.html.match(/token=([a-f0-9]+)/)[1];
const inDays = (d, h = 14) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };

async function signupAndConfirm(email) {
  assert.equal((await anon("POST", "/api/auth/signup", { email, password: PASSWORD })).status, 200);
  const res = await anon("POST", "/api/auth/confirm", { token: tokenIn(await mailTo(email, "Confirmez")) });
  assert.equal(res.status, 200);
  const c = client();
  const login = await c("POST", "/api/auth/login", { email, password: PASSWORD });
  assert.equal(login.status, 200, `connexion de ${email}`);
  return c;
}

async function run() {
  console.log("Pages");
  const pagesDir = path.join(__dirname, "..", "pages");
  for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith(".html"))) {
    const html = (await anon("GET", `/pages/${file}`)).text;
    assert.ok(html.includes("<title>"), `${file} : titre manquant`);
    for (const ref of [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1])) {
      const target = new URL(ref, `${BASE}/pages/${file}`);
      assert.equal((await anon("GET", target.pathname)).status, 200, `${file} référence ${ref} introuvable`);
    }
  }
  step("chaque page charge, avec ses scripts et sa feuille de style");

  console.log("Statique & sécurité");
  assert.equal((await anon("GET", "/pages/connexion.html")).status, 200);
  for (const p of ["/server.js", "/data.json", "/server/db.js", "/package.json", "/../server.js"]) {
    assert.equal((await anon("GET", p)).status, 404, `${p} ne doit pas être servi`);
  }
  assert.ok((await anon("GET", "/pages/connexion.html")).headers.get("content-security-policy"));
  assert.equal((await anon("GET", "/api/me")).status, 401);
  assert.equal((await anon("POST", "/api/auth/forgot", { email: "x@ecole.fr" }, { Origin: "http://evil.example" })).status, 403);
  step("fichiers privés introuvables, CSP présente, API protégée, origine étrangère refusée");

  console.log("Inscription, confirmation, connexion");
  assert.equal((await anon("POST", "/api/auth/signup", { email: "a@gmail.com", password: PASSWORD })).status, 400);
  assert.equal((await anon("POST", "/api/auth/signup", { email: "a.b@ecole.fr", password: "court" })).status, 400);
  step("domaine de l'école et 12 caractères exigés");

  assert.equal((await anon("POST", "/api/auth/signup", { email: "julie.dupont@ecole.fr", password: PASSWORD })).status, 200);
  assert.equal((await anon("POST", "/api/auth/login", { email: "julie.dupont@ecole.fr", password: PASSWORD })).status, 403);
  const confirmMail = await mailTo("julie.dupont@ecole.fr", "Confirmez");
  assert.ok(confirmMail, "mail de confirmation envoyé");
  assert.equal((await anon("POST", "/api/auth/confirm", { token: "0".repeat(64) })).status, 400);
  assert.equal((await anon("POST", "/api/auth/confirm", { token: tokenIn(confirmMail) })).status, 200);
  assert.equal((await anon("POST", "/api/auth/confirm", { token: tokenIn(confirmMail) })).status, 400, "jeton à usage unique");
  step("compte inactif jusqu'au clic, lien de confirmation à usage unique");

  const wrong = await anon("POST", "/api/auth/login", { email: "julie.dupont@ecole.fr", password: "mauvais-mot-de-passe" });
  const unknown = await anon("POST", "/api/auth/login", { email: "inconnu@ecole.fr", password: "mauvais-mot-de-passe" });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.error, unknown.json.error, "même message pour e-mail inconnu et mauvais mot de passe");
  step("message d'erreur unique");

  for (let i = 0; i < 4; i++) assert.equal((await anon("POST", "/api/auth/login", { email: "lock@ecole.fr", password: "xxxxxxxxxxxxxx" })).status, 401);
  assert.equal((await anon("POST", "/api/auth/login", { email: "lock@ecole.fr", password: "xxxxxxxxxxxxxx" })).status, 429);
  assert.equal((await anon("POST", "/api/auth/login", { email: "lock@ecole.fr", password: PASSWORD })).status, 429);
  step("blocage après 5 échecs");

  const julie = client();
  assert.equal((await julie("POST", "/api/auth/login", { email: "julie.dupont@ecole.fr", password: PASSWORD })).status, 200);
  const me = (await julie("GET", "/api/me")).json;
  assert.equal(me.name, "Julie Dupont");
  assert.equal(me.passHash, undefined, "le hachage ne sort jamais du serveur");
  assert.equal((await julie("GET", "/api/admin/stats")).status, 403);
  step("connexion par cookie, accès admin refusé aux étudiants");

  console.log("Mot de passe oublié");
  const marc = await signupAndConfirm("marc.petit@ecole.fr");
  assert.equal((await anon("POST", "/api/auth/forgot", { email: "inconnu@ecole.fr" })).status, 200);
  assert.equal((await anon("POST", "/api/auth/forgot", { email: "marc.petit@ecole.fr" })).status, 200);
  const resetToken = tokenIn(await mailTo("marc.petit@ecole.fr", "Réinitialiser"));
  assert.equal((await anon("POST", "/api/auth/reset", { token: resetToken, password: "court" })).status, 400);
  assert.equal((await anon("POST", "/api/auth/reset", { token: resetToken, password: "nouveau-mot-de-passe-9" })).status, 200);
  assert.equal((await anon("POST", "/api/auth/reset", { token: resetToken, password: "encore-un-autre-mdp-9" })).status, 400, "lien à usage unique");
  assert.equal((await marc("GET", "/api/me")).status, 401, "anciennes sessions révoquées");
  assert.equal((await marc("POST", "/api/auth/login", { email: "marc.petit@ecole.fr", password: "nouveau-mot-de-passe-9" })).status, 200);
  step("réinitialisation à usage unique, sessions révoquées, réponse identique pour un compte inconnu");

  console.log("Profil");
  assert.equal((await julie("PATCH", "/api/me", { year: "L3", subjects: ["Mathématiques", "Inexistante"] })).json.subjects.join(), "Mathématiques");
  assert.equal((await julie("PATCH", "/api/me", { year: "Z9" })).status, 400);
  assert.equal((await julie("POST", "/api/me/password", { current: "faux", next: "x".repeat(14) })).status, 400);
  step("année et matières (liste de l'école uniquement)");

  console.log("Demandes et propositions");
  const tiers = await signupAndConfirm("tiers.test@ecole.fr");
  assert.equal((await julie("POST", "/api/demandes", { subject: "Zzz", level: "L2", topic: "Analyse", desc: "Je bloque sur un exercice", place: "En ligne" })).status, 400);
  const created = (await julie("POST", "/api/demandes", { subject: "Mathématiques", level: "L2", topic: "Analyse", desc: "Je bloque sur l'exercice 3 du chapitre 4", place: "En ligne" })).json;
  assert.equal(created.status, "open");
  assert.ok((await marc("GET", "/api/demandes/ouvertes")).json.some((r) => r.id === created.id));
  assert.equal((await julie("POST", `/api/demandes/${created.id}/aide`)).status, 400, "pas d'aide à soi-même");
  assert.equal((await marc("POST", `/api/demandes/${created.id}/aide`)).status, 200);
  assert.equal((await marc("POST", `/api/demandes/${created.id}/aide`)).status, 409);
  assert.equal((await tiers("POST", `/api/demandes/${created.id}/aide`)).status, 200);
  assert.ok(await mailTo("julie.dupont@ecole.fr", "Nouvelle proposition d'aide"), "e-mail au demandeur");
  assert.equal((await julie("GET", `/api/demandes/${created.id}`)).json.proposals.length, 2);
  assert.equal((await marc("GET", `/api/demandes/${created.id}`)).json.proposals.length, 1, "un tuteur ne voit que sa proposition");
  assert.equal((await julie("GET", "/api/demandes")).json[0].status, "prop");
  step("proposition d'aide, e-mail au demandeur, visibilité des propositions");

  console.log("Séances");
  const bad = await julie("POST", `/api/demandes/${created.id}/seances`, { tutor: "marc.petit@ecole.fr", when: inDays(-1), place: "Salle B12" });
  assert.equal(bad.status, 400, "séance dans le passé refusée");
  const proposed = await julie("POST", `/api/demandes/${created.id}/seances`, { tutor: "marc.petit@ecole.fr", when: inDays(3), place: "Salle B12" });
  assert.equal(proposed.status, 200);
  const seanceId = proposed.json.id;
  assert.equal((await julie("POST", `/api/seances/${seanceId}/confirmer`)).status, 403, "le proposeur ne confirme pas lui-même");
  assert.equal((await tiers("POST", `/api/seances/${seanceId}/confirmer`)).status, 404, "un tiers ne voit pas la séance");
  assert.equal((await marc("GET", "/api/seances")).json[0].mustConfirm, true);
  assert.equal((await marc("POST", `/api/seances/${seanceId}/modifier`, { when: inDays(4), place: "Bibliothèque" })).status, 200);
  assert.equal((await marc("POST", `/api/seances/${seanceId}/confirmer`)).status, 403, "après contre-proposition, c'est à l'autre de répondre");
  assert.equal((await julie("POST", `/api/seances/${seanceId}/confirmer`)).status, 200);
  assert.equal((await julie("GET", "/api/demandes")).json[0].status, "confirmed");
  assert.match((await mailTo("marc.petit@ecole.fr", "Séance confirmée")).html, /julie\.dupont@ecole\.fr/, "le tuteur reçoit l'adresse du demandeur");
  assert.ok(await mailTo("tiers.test@ecole.fr", "Demande pourvue"), "les autres tuteurs sont prévenus");
  assert.equal((await tiers("GET", "/api/propositions")).json[0].status, "declined");
  assert.equal((await marc("GET", "/api/propositions")).json[0].status, "confirmed");
  step("proposer / contre-proposer / confirmer, e-mails prévus, passé refusé");

  console.log("Messagerie en temps réel");
  const sse = await fetch(`${BASE}/api/events`, { headers: { Cookie: julie.cookie() } });
  assert.equal(sse.status, 200);
  const reader = sse.body.getReader();
  assert.equal((await anon("GET", "/api/events")).status, 401);
  assert.equal((await marc("POST", "/api/messages", { to: "marc.petit@ecole.fr", text: "moi" })).status, 400);
  assert.equal((await marc("POST", "/api/messages", { to: "inconnu@ecole.fr", text: "salut" })).status, 400);
  assert.equal((await marc("POST", "/api/messages", { to: "julie.dupont@ecole.fr", text: "   " })).status, 400);
  assert.equal((await marc("POST", "/api/messages", { to: "julie.dupont@ecole.fr", text: "Bonjour Julie" })).status, 200);
  let received = "";
  const deadline = Date.now() + 3000;
  while (!received.includes("Bonjour Julie") && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    received += Buffer.from(value).toString();
  }
  await reader.cancel();
  assert.ok(received.includes("Bonjour Julie"), "le message arrive en direct (SSE)");
  assert.equal((await julie("GET", "/api/messages")).json.at(-1).text, "Bonjour Julie");
  assert.equal((await tiers("GET", "/api/messages")).json.length, 0, "les messages restent privés");
  assert.ok((await julie("GET", "/api/utilisateurs")).json.some((u) => u.email === "marc.petit@ecole.fr"));
  step("annuaire, messages privés, validation");

  console.log("Clôture");
  assert.equal((await marc("POST", `/api/demandes/${created.id}/cloture`)).status, 403, "seul le demandeur clôture");
  assert.equal((await julie("POST", `/api/demandes/${created.id}/cloture`)).status, 200);
  assert.equal((await julie("GET", "/api/demandes")).json[0].status, "done");
  assert.ok(await mailTo("marc.petit@ecole.fr", "Merci pour votre aide"), "e-mail de remerciement au tuteur");
  step("clôture réservée au demandeur, remerciement envoyé");

  console.log("Administration");
  const admin = client();
  assert.equal((await admin("POST", "/api/auth/login", ADMIN)).status, 200);
  const stats = (await admin("GET", "/api/admin/stats")).json;
  assert.equal(stats.requests.total, 1);
  assert.equal(stats.requests.rate, 100);
  assert.equal((await admin("POST", "/api/admin/matieres", { name: "mathématiques" })).status, 409, "pas deux matières au même nom");
  const subjects = (await admin("GET", "/api/admin/matieres")).json;
  const maths = subjects.find((s) => s.name === "Mathématiques");
  assert.equal((await admin("PATCH", `/api/admin/matieres/${maths.id}`, { name: "Maths" })).status, 200);
  assert.equal((await julie("GET", "/api/me")).json.subjects[0], "Maths", "le renommage suit les profils");
  assert.equal((await admin("PATCH", `/api/admin/matieres/${maths.id}`, { archived: true })).json.archived, true);
  assert.ok(!(await julie("GET", "/api/matieres")).json.includes("Maths"), "matière archivée non proposée");
  assert.equal((await julie("GET", "/api/demandes")).json[0].matiere, "Maths", "mais conservée sur l'ancienne demande");

  assert.equal((await admin("PATCH", "/api/admin/utilisateurs/admin%40ecole.fr", { status: "suspended" })).status, 400, "pas d'action sur soi-même");
  assert.equal((await admin("PATCH", "/api/admin/utilisateurs/tiers.test%40ecole.fr", { status: "suspended" })).status, 200);
  assert.equal((await tiers("GET", "/api/me")).status, 401, "suspension : session coupée");
  assert.equal((await anon("POST", "/api/auth/login", { email: "tiers.test@ecole.fr", password: PASSWORD })).status, 403);
  assert.equal((await admin("POST", "/api/admin/utilisateurs", { email: "invite.test@ecole.fr" })).status, 200);
  const invite = tokenIn(await mailTo("invite.test@ecole.fr", "Votre compte"));
  assert.equal((await anon("POST", "/api/auth/reset", { token: invite, password: PASSWORD })).status, 200);
  assert.equal((await anon("POST", "/api/auth/login", { email: "invite.test@ecole.fr", password: PASSWORD })).status, 200, "invité activé par son mot de passe");
  assert.equal((await admin("DELETE", "/api/admin/utilisateurs/tiers.test%40ecole.fr")).status, 200);
  assert.equal((await admin("GET", "/api/admin/utilisateurs")).json.some((u) => u.email === "tiers.test@ecole.fr"), false);
  step("matières (doublons, renommage, archivage), utilisateurs (suspension, invitation, suppression), statistiques");
}

/* ---------- Démarrage du serveur de test ---------- */
const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
  env: { ...process.env, PORT: String(PORT), DATA_FILE, ADMIN_PASSWORD: ADMIN.password, ADMIN_EMAIL: ADMIN.email, DEV_MAILBOX: "1" },
  stdio: ["ignore", "pipe", "inherit"]
});
let ready;
const started = new Promise((resolve) => { ready = resolve; });
server.stdout.on("data", (d) => { if (String(d).includes("http://localhost")) ready(); });

function cleanup() {
  server.kill();
  for (const f of [DATA_FILE, DATA_FILE + ".tmp"]) fs.rmSync(f, { force: true });
}

started
  .then(run)
  .then(() => { console.log(`\n${passed} groupes de vérifications réussis.`); cleanup(); })
  .catch((e) => { console.error("\n✘ ÉCHEC :", e.message || e); if (e.stack) console.error(e.stack.split("\n").slice(1, 4).join("\n")); cleanup(); process.exit(1); });
