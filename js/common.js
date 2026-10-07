"use strict";

/* =====================================================================
   Socle commun à toutes les pages : appels à l'API, session, gabarits
   partagés (barre latérale, champs mot de passe) et petits utilitaires.
   ===================================================================== */

const SCHOOL_DOMAIN = "ecole.fr";
const MIN_PASSWORD = 12;
const ALL_LEVELS = ["L1", "L2", "L3", "M1", "M2"];
const PLACES = ["En ligne ou salle", "En ligne", "Salle B12", "Salle C3", "Bibliothèque", "Lien visio"];

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
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
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

/* ---------- Utilitaires ---------- */
const STATUS = {
  open: ["Ouverte", "open"], wait: ["En attente", "wait"], prop: ["Proposée", "prop"], done: ["Résolue", "done"],
  confirmed: ["Confirmée", "green"], declined: ["Pourvue", "grey"], expired: ["Expirée", "grey"], tobe: ["À confirmer", "orange"]
};
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const badge = (key) => `<span class="badge ${STATUS[key][1]}">${STATUS[key][0]}</span>`;
const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
const queryParam = (name) => new URLSearchParams(location.search).get(name);
const showErr = (id, msg) => { const el = $("#" + id); el.textContent = msg; el.hidden = !msg; };
const showOk = (id, msg) => showErr(id, msg);
const byDate = (key) => (a, b) => new Date(a[key]) - new Date(b[key]);

let toastTimer;
function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  clearTimeout(toastTimer);
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 3000);
}

/* ---------- Appels à l'API ---------- */
async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method, credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    const err = new Error("Le serveur est injoignable. Lancez « node server.js » dans le dossier du projet.");
    err.status = 0;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch { /* corps vide */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Une erreur est survenue.");
    err.status = res.status;
    throw err;
  }
  return data;
}
const get = (url) => api("GET", url);
const post = (url, body = {}) => api("POST", url, body);
const patch = (url, body) => api("PATCH", url, body);
const del = (url) => api("DELETE", url);

/** Exécute une action et affiche l'erreur éventuelle dans un toast. */
async function attempt(fn) {
  try { return await fn(); } catch (e) { toast(e.message); return undefined; }
}

/* ---------- Session ---------- */
let me = null;

const forever = () => new Promise(() => {});   // suspend le script de la page (redirection en cours)

/** Charge l'utilisateur connecté. Sans session, renvoie vers la page de connexion. */
async function requireUser({ admin = false, student = false } = {}) {
  try {
    me = await get("/api/me");
  } catch (e) {
    if (e.status === 401) {
      const here = location.pathname.split("/").pop() + location.search;
      location.replace(`connexion.html?next=${encodeURIComponent(here)}`);
      return forever();
    }
    $("#app").innerHTML = `<div class="auth-page"><div class="auth-card"><h1>Serveur injoignable</h1><p class="sub">${esc(e.message)}</p></div></div>`;
    return forever();
  }
  if (student && me.role === "admin") { location.replace("admin.html"); return forever(); }
  if (admin && me.role !== "admin") {
    mountShell("accueil", '<h1>Accès refusé</h1><p class="empty card">Cette page est réservée aux administrateurs.</p>');
    return forever();
  }
  return me;
}

/** Redirige l'utilisateur déjà connecté (pages de connexion / inscription). */
async function redirectIfLoggedIn() {
  try {
    const user = await get("/api/me");
    location.replace(user.role === "admin" ? "admin.html" : "accueil.html");
    return forever();
  } catch { /* pas connecté : on reste */ }
}

const safeNext = (value) => (/^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(value || "") ? value : null);

/* ---------- Gabarits partagés ---------- */
const passwordField = (id, placeholder = "", autocomplete = "current-password") => `
  <div class="pw-wrap">
    <input class="input" id="${id}" type="password" placeholder="${placeholder}" autocomplete="${autocomplete}" required>
    <button type="button" class="pw-toggle" data-action="toggle-pw" data-target="${id}" aria-label="Afficher le mot de passe">${icon("eye")}</button>
  </div>`;

const authFooter = `
  <p class="auth-links"><a href="regles.html">Règles d'accès</a> · <a href="boite-mail.html">Boîte mail de démo</a></p>`;

/** Barre latérale + contenu dans #app. */
function mountShell(active, content) {
  const link = (href, ico, label, key) =>
    `<a href="${href}" class="${active === key ? "active" : ""}" ${active === key ? 'aria-current="page"' : ""}>${icon(ico)} ${label}</a>`;
  const nav = me.role === "admin"
    ? link("admin.html", "home", "Administration", "admin") +
      link("admin-utilisateurs.html", "users", "Utilisateurs", "admin-utilisateurs") +
      link("admin-stats.html", "chart", "Statistiques", "admin-stats") +
      link("messages.html", "chat", "Messagerie", "messages") +
      link("profil.html", "user", "Mon profil", "profil")
    : link("accueil.html", "home", "Accueil", "accueil") +
      link("profil.html", "user", "Mon profil", "profil") +
      link("espaces.html?tab=demandes", "list", "Mes demandes", "demandes") +
      link("espaces.html?tab=propositions", "hand", "Mes propositions", "propositions") +
      link("seances.html", "cal", "Mes séances", "seances") +
      link("messages.html", "chat", "Messagerie", "messages");
  $("#app").innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">${icon("cap")} Entraide Étudiants</div>
        <nav aria-label="Navigation principale">${nav}</nav>
        <div class="side-foot">
          <a class="who" href="profil.html"><span class="avatar sm">${esc(me.initials)}</span><span>${esc(me.name)}</span></a>
          <a href="regles.html" class="side-link">${icon("shield")} Règles d'accès</a>
          <button class="nav-link logout" data-action="logout">${icon("out")} Déconnexion</button>
        </div>
      </aside>
      <main class="main">${content}</main>
    </div>`;
}

/** Une ligne de séance (écran 9) ; `actions` ajoute des boutons à droite. */
function seanceItem(s, extra = "") {
  const key = s.mustConfirm ? "tobe" : s.status;
  return `
  <div class="item">
    <div class="ico">${icon("cap")}</div>
    <div class="body"><div class="title">${esc(s.subject)}</div>
      <div class="meta">${fmtDate(s.when)} · ${fmtTime(s.when)} · ${esc(s.place)}<br>
        avec <a href="messages.html?to=${encodeURIComponent(s.other.email)}">${esc(s.other.name)}</a></div></div>
    ${badge(key)}${extra}
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
actions.logout = async () => {
  await attempt(() => post("/api/auth/logout"));
  location.href = "connexion.html";
};

/* ---------- Boîte de dialogue (administration) ----------
   onSubmit(valeur) renvoie une promesse : lève une erreur pour l'afficher dans la boîte. */
function openDialog(title, value, onSubmit, { placeholder = "", type = "text" } = {}) {
  let dlg = $("#dialog");
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="dialog"><form method="dialog" id="dialogForm">
        <h3 id="dialogTitle"></h3>
        <input id="dialogInput" class="input" maxlength="120" required>
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
  input.type = type;
  input.placeholder = placeholder;
  input.value = value;
  err.hidden = true;
  dlg.onsubmit = async (ev) => {
    ev.preventDefault();
    const entered = input.value.trim();
    if (!entered) return;
    try {
      await onSubmit(entered);
      dlg.close();
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    }
  };
  dlg.showModal();
  input.focus();
}
