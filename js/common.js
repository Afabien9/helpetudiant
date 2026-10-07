"use strict";

/* =====================================================================
   Socle commun à toutes les pages : données, utilitaires, gabarits
   partagés (barre latérale, champs mot de passe) et menu de démo.
   ===================================================================== */

const SCHOOL_DOMAIN = "ecole.fr";
const MIN_PASSWORD = 12;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const ALL_LEVELS = ["L1", "L2", "L3", "M1", "M2"];

/* ---------- Icônes (style "feather") ---------- */
const ICONS = {
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.5 9 2.5 12 0v-5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  hand: '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5m0-1V4a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L7 14"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3.5-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.2.6 4 2.2 4 5.2"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M19 19v2H6"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

/* ---------- Données fictives, conservées dans localStorage ---------- */
const STORAGE_KEY = "entraide-etudiants-v2";

const daysFromNow = (d, h, m = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(h, m, 0, 0);
  return date.toISOString();
};

function seed() {
  return {
    user: null,            // { name, initials, year, field, subjects, admin, email }
    attempts: 0,
    lockedUntil: 0,
    subjects: [
      { name: "Mathématiques", archived: false },
      { name: "Physique", archived: false },
      { name: "Informatique", archived: false },
      { name: "Chimie", archived: true }
    ],
    requests: [
      { id: 1, subject: "Mathématiques – L2", topic: "Analyse, exercices", status: "open", date: "2025-04-10", place: "En ligne ou salle",
        desc: "Je bloque sur l'exercice 3 du chapitre 4 (suites et séries numériques).",
        proposals: [
          { name: "Marc Petit", initials: "MP", info: "L3 Mathématiques" },
          { name: "Alice Lefèvre", initials: "AL", info: "L3 Physique" }
        ] },
      { id: 2, subject: "Physique – L2", topic: "Mécanique", status: "wait", date: "2025-04-12", place: "Salle B12",
        desc: "Besoin d'aide sur les référentiels non galiléens.", proposals: [] },
      { id: 3, subject: "Informatique – L1", topic: "Programmation", status: "prop", date: "2025-04-14", place: "En ligne",
        desc: "Compréhension des boucles et des fonctions en Python.",
        proposals: [{ name: "Thomas Martin", initials: "TM", info: "M1 Informatique" }] }
    ],
    propositions: [
      { id: 11, subject: "Chimie – L1", topic: "Chimie organique", status: "wait" },
      { id: 12, subject: "Mathématiques – L1", topic: "Algèbre linéaire", status: "prop" }
    ],
    sessions: [
      { id: 1, subject: "Mathématiques – L2", when: daysFromNow(3, 14), place: "Salle B12", status: "confirmed" },
      { id: 2, subject: "Physique – L1", when: daysFromNow(5, 10), place: "Lien visio", status: "wait" },
      { id: 3, subject: "Informatique – L1", when: daysFromNow(9, 16), place: "Salle C3", status: "confirmed" },
      { id: 4, subject: "Chimie – L1", when: daysFromNow(-4, 11), place: "Salle A1", status: "confirmed" }
    ]
  };
}

const SESSION_KEY = "entraide-etudiants-session";

let state = (() => {
  let data = seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch { /* stockage indisponible : on repart des données de démo */ }
  // La session est propre à chaque onglet : on peut ouvrir deux comptes en parallèle.
  try { data.user = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { data.user = null; }
  return data;
})();

/** Comptes de l'école visibles dans l'administration (données de démo). */
function seedUsers() {
  const u = (name, year, subjects, status = "active", admin = false) => ({
    id: name.toLowerCase().replace(/\s+/g, "."), name, email: `${name.toLowerCase().replace(/\s+/g, ".")}@${SCHOOL_DOMAIN}`,
    year, subjects, status, admin, joined: daysFromNow(-Math.floor(Math.random() * 200) - 10, 12)
  });
  return [
    u("Julie Dupont", "L3", ["Mathématiques", "Physique", "Informatique"]),
    u("Marc Petit", "L3", ["Mathématiques"]),
    u("Alice Lefèvre", "L3", ["Physique"]),
    u("Thomas Martin", "M1", ["Informatique", "Mathématiques"]),
    u("Sophie Bernard", "L2", [], "pending"),
    u("Lucas Moreau", "L1", ["Chimie"], "suspended"),
    u("Admin Principal", "M2", [], "active", true)
  ];
}
if (!state.users) state.users = seedUsers();

/** Ajoute le compte à la liste (à la connexion) s'il n'y figure pas encore. */
function registerUser(u) {
  if (state.users.some((x) => x.email.toLowerCase() === u.email.toLowerCase())) return;
  state.users.push({ id: u.email, name: u.name, email: u.email, year: u.year, subjects: u.subjects,
    status: "active", admin: u.admin, joined: new Date().toISOString() });
}

function save() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.user));
    const { user, ...shared } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shared));
  } catch { /* ignoré */ }
}

/** Déclare le compte au serveur de messagerie pour qu'il apparaisse dans l'annuaire. */
function registerOnServer(u) {
  return fetch("/api/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: u.email, name: u.name, initials: u.initials })
  }).catch(() => { /* serveur de messagerie absent */ });
}

function resetDemo() {
  state = seed();
  save();
}

/* ---------- Utilitaires ---------- */
const STATUS = {
  open: ["Ouverte", "open"], wait: ["En attente", "wait"], prop: ["Proposée", "prop"],
  done: ["Résolue", "done"], confirmed: ["Confirmée", "green"]
};
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const badge = (key) => `<span class="badge ${STATUS[key][1]}">${STATUS[key][0]}</span>`;
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
const fmtDay = (iso) => new Date(iso + "T12:00").toLocaleDateString("fr-FR");
const isSchoolEmail = (e) => new RegExp(`^[^@\\s]+@${SCHOOL_DOMAIN.replace(".", "\\.")}$`, "i").test(e.trim());
const queryParam = (name) => new URLSearchParams(location.search).get(name);
const showErr = (id, msg) => { const el = $("#" + id); el.textContent = msg; el.hidden = !msg; };

function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function nameFromEmail(email) {
  const [first = "Prénom", last = "Nom"] = email.split("@")[0].split(".");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return { name: `${cap(first)} ${cap(last)}`, initials: (first[0] + (last[0] || "")).toUpperCase() };
}

const upcomingSessions = () => state.sessions.filter((s) => new Date(s.when) >= new Date()).sort((a, b) => new Date(a.when) - new Date(b.when));
const pastSessions = () => state.sessions.filter((s) => new Date(s.when) < new Date()).sort((a, b) => new Date(b.when) - new Date(a.when));

const sessionItem = (s) => `
  <div class="item">
    <div class="ico">${icon("cap")}</div>
    <div class="body"><div class="title">${esc(s.subject)}</div>
      <div class="meta">${fmtDate(s.when)} · ${fmtTime(s.when)}<br>${esc(s.place)}</div></div>
    ${badge(s.status)}
  </div>`;

/* ---------- Gabarits partagés ---------- */
const passwordField = (id, placeholder = "") => `
  <div class="pw-wrap">
    <input class="input" id="${id}" type="password" placeholder="${placeholder}" autocomplete="off" required>
    <button type="button" class="pw-toggle" data-action="toggle-pw" data-target="${id}" aria-label="Afficher le mot de passe">${icon("eye")}</button>
  </div>`;

/** Page privée : sans session on connecte l'utilisateur fictif (mode démo). */
function requireUser({ admin = false } = {}) {
  if (!state.user) {
    state.user = { name: "Julie Dupont", initials: "JD", year: "L3", field: "Informatique",
      email: `julie.dupont@${SCHOOL_DOMAIN}`, subjects: ["Mathématiques", "Physique", "Informatique"], admin };
    save();
  }
  return state.user;
}

/** Affiche la barre latérale + le contenu dans #app. */
function mountShell(active, content) {
  const link = (href, ico, label, key) =>
    `<a href="${href}" class="${active === key ? "active" : ""}">${icon(ico)} ${label}</a>`;
  const nav = state.user.admin
    ? link("admin.html", "home", "Administration", "admin") +
      link("admin-utilisateurs.html", "users", "Utilisateurs", "admin-utilisateurs") +
      link("admin-stats.html", "chart", "Statistiques", "admin-stats")
    : link("accueil.html", "home", "Accueil", "accueil") +
      link("profil.html", "user", "Mon profil", "profil") +
      link("accueil.html?tab=demandes", "list", "Mes demandes", "demandes") +
      link("accueil.html?tab=propositions", "hand", "Mes propositions", "propositions") +
      link("seances.html", "cal", "Mes séances", "seances") +
      link("messages.html", "chat", "Messagerie", "messages");
  $("#app").innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">${icon("cap")} Entraide Étudiants</div>
        <nav>${nav}</nav>
        <button class="nav-link logout" data-action="logout">${icon("out")} Déconnexion</button>
      </aside>
      <main class="main">${content}</main>
    </div>`;
}

/* ---------- Gestion des événements (délégation) ---------- */
const actions = {};   // data-action="x"  -> actions.x(element, event)
const submits = {};   // <form id="x">    -> submits.x(form, event)
const changes = {};   // data-action="x" sur un <select> -> changes.x(element)

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (t && actions[t.dataset.action]) actions[t.dataset.action](t, e);
});
document.addEventListener("change", (e) => {
  const a = e.target.dataset.action;
  if (a && changes[a]) changes[a](e.target);
});
document.addEventListener("submit", (e) => {
  const fn = submits[e.target.id];
  if (fn) { e.preventDefault(); fn(e.target, e); }
});

actions["toggle-pw"] = (t) => {
  const input = $("#" + t.dataset.target);
  input.type = input.type === "password" ? "text" : "password";
};
actions.logout = () => {
  state.user = null;
  save();
  location.href = "connexion.html";
};

/* ---------- Boîte de dialogue (écran d'administration) ---------- */
function openDialog(title, value, onValidate, onDone) {
  let dlg = $("#dialog");
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="dialog"><form method="dialog" id="dialogForm">
        <h3 id="dialogTitle"></h3>
        <input type="text" id="dialogInput" class="input" maxlength="60" required>
        <p class="field-error" id="dialogError" hidden></p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-outline" id="dialogCancel">Annuler</button>
          <button type="submit" class="btn btn-primary">Valider</button>
        </div>
      </form></dialog>`);
    dlg = $("#dialog");
    $("#dialogCancel").addEventListener("click", () => dlg.close());
  }
  const input = $("#dialogInput"), err = $("#dialogError");
  $("#dialogTitle").textContent = title;
  input.value = value;
  err.hidden = true;
  dlg.onsubmit = (ev) => {
    ev.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const problem = onValidate(name);
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    save();
    dlg.close();
    toast("Enregistré.");
    onDone();
  };
  dlg.showModal();
  input.focus();
}

/* ---------- Menu de navigation de la maquette ---------- */
const DEMO_SCREENS = [
  ["inscription", "1. Inscription"], ["confirmation", "2. Confirmation e-mail"], ["connexion", "3. Connexion"],
  ["oubli", "4. Mot de passe oublié"], ["profil", "5. Profil étudiant"], ["accueil", "6. Tableau de bord"],
  ["demande?id=1", "7. Détail d'une demande"], ["seance?id=1", "8. Proposer une séance"], ["seances", "9. Mes séances"],
  ["notification", "10. Notification e-mail"], ["admin", "11. Administration"], ["messages", "12. Messagerie"],
  ["regles", "13. Règles d'accès"]
];

document.body.insertAdjacentHTML("beforeend", `
  <nav class="demo-nav" aria-label="Écrans de la maquette">
    <button class="demo-toggle" id="demoToggle" type="button">Écrans ▾</button>
    <ul id="demoList" hidden>
      ${DEMO_SCREENS.map(([h, l]) => `<li><a href="${h.replace("?", ".html?").replace(/^([a-z-]+)$/, "$1.html")}">${l}</a></li>`).join("")}
      <li><a href="#" id="demoReset">↺ Réinitialiser les données</a></li>
    </ul>
  </nav>`);
$("#demoToggle").addEventListener("click", () => { const l = $("#demoList"); l.hidden = !l.hidden; });
$("#demoReset").addEventListener("click", (e) => {
  e.preventDefault();
  resetDemo();
  location.href = "connexion.html";
});
