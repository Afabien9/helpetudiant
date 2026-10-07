"use strict";

/* Messagerie entre vrais comptes : l'annuaire, l'historique et le temps réel
   viennent du serveur (server.js). */

const me = requireUser();
const myEmail = me.email.toLowerCase();

let directory = [];                 // tous les comptes connus du serveur
let messages = [];                  // messages où je suis expéditeur ou destinataire
let peer = (queryParam("to") || "").toLowerCase() || null;
let online = true;
let leftTab = peer ? "chats" : "all";   // "chats" = discussions, "all" = tous les utilisateurs
let filter = "";

/* ---------- Dérivés ---------- */
const readKey = (p) => `ee-read:${myEmail}:${p}`;
const readUpTo = (p) => { try { return +localStorage.getItem(readKey(p)) || 0; } catch { return 0; } };
const person = (email) => directory.find((u) => u.email === email) ||
  { email, name: email, initials: email.slice(0, 2).toUpperCase() };

function conversations() {
  const byPeer = new Map();
  for (const m of messages) {
    const p = m.from === myEmail ? m.to : m.from;
    if (!byPeer.has(p)) byPeer.set(p, []);
    byPeer.get(p).push(m);
  }
  if (peer && !byPeer.has(peer)) byPeer.set(peer, []);   // discussion tout juste ouverte
  return [...byPeer.entries()]
    .map(([email, msgs]) => ({
      email, msgs, last: msgs.at(-1),
      unread: msgs.filter((m) => m.from === email && m.id > readUpTo(email)).length
    }))
    .sort((a, b) => (b.last?.id ?? Infinity) - (a.last?.id ?? Infinity));
}

function markRead() {
  if (!peer) return;
  const newest = messages.filter((m) => m.from === peer).at(-1);
  if (!newest) return;
  try { localStorage.setItem(readKey(peer), String(newest.id)); } catch { /* ignoré */ }
}

/* ---------- Affichage ---------- */
function renderShell() {
  mountShell("messages", `
    <h1>Messages</h1>
    <div class="card" id="offline" hidden>
      <b>Le serveur de messagerie n'est pas joignable.</b>
      <p class="hint">Dans le dossier du projet, lancez <code>node server.js</code> puis ouvrez
        <a href="http://localhost:8000/pages/messages.html">http://localhost:8000</a>.</p>
    </div>
    <div class="chat" id="chat">
      <div class="convs">
        <div class="conv-new">
          <input class="input" id="userSearch" type="search" placeholder="Rechercher un utilisateur…" autocomplete="off">
          <div class="mini-tabs">
            <button type="button" id="tabChats" data-action="left-tab" data-tab="chats"></button>
            <button type="button" id="tabAll" data-action="left-tab" data-tab="all"></button>
          </div>
        </div>
        <div id="convList"></div>
      </div>
      <div class="thread">
        <div class="thread-head" id="threadHead"></div>
        <div class="msgs" id="msgs"></div>
        <form class="composer" id="formMsg" style="display:none">
          <input class="input" id="msgInput" placeholder="Écrire un message..." autocomplete="off" maxlength="2000">
          <button class="btn btn-primary" aria-label="Envoyer">${icon("send")}</button>
        </form>
      </div>
    </div>
    <p class="hint" style="margin-top:14px">Échanger des messages dans l'application pour s'organiser sans donner son numéro de téléphone.</p>`);
}

const matches = (p) => !filter || p.name.toLowerCase().includes(filter) || p.email.includes(filter);

function renderLeft() {
  const list = conversations();
  const others = directory.filter((u) => u.email !== myEmail);
  $("#tabChats").textContent = `Discussions (${list.length})`;
  $("#tabAll").textContent = `Tous (${others.length})`;
  $("#tabChats").classList.toggle("active", leftTab === "chats");
  $("#tabAll").classList.toggle("active", leftTab === "all");

  if (leftTab === "all") {
    const unreadBy = new Map(list.map((c) => [c.email, c.unread]));
    $("#convList").innerHTML = others.filter(matches).sort((a, b) => a.name.localeCompare(b.name, "fr")).map((u) => `
      <button class="conv ${u.email === peer ? "active" : ""}" data-action="conv" data-email="${esc(u.email)}">
        <div class="avatar">${esc(u.initials)}</div>
        <div class="body"><div class="name">${esc(u.name)}</div><div class="last">${esc(u.email)}</div></div>
        ${unreadBy.get(u.email) ? `<span class="unread">${unreadBy.get(u.email)}</span>` : ""}
      </button>`).join("") || '<p class="empty hint">Aucun utilisateur trouvé.</p>';
    return;
  }

  $("#convList").innerHTML = list.filter((c) => matches(person(c.email))).map((c) => {
    const p = person(c.email);
    return `
    <button class="conv ${c.email === peer ? "active" : ""}" data-action="conv" data-email="${esc(c.email)}">
      <div class="avatar">${esc(p.initials)}</div>
      <div class="body"><div class="name">${esc(p.name)} <small>${c.last ? fmtTime(c.last.at) : ""}</small></div>
        <div class="last">${c.last ? (c.last.from === myEmail ? "Vous : " : "") + esc(c.last.text) : "Nouvelle discussion"}</div></div>
      ${c.unread ? `<span class="unread">${c.unread}</span>` : ""}
    </button>`;
  }).join("") || '<p class="empty hint">Aucune discussion.<br>Ouvrez l\'onglet « Tous » pour choisir quelqu\'un.</p>';
}

function renderThread() {
  const form = $("#formMsg");
  form.style.display = peer ? "" : "none";
  if (!peer) {
    $("#threadHead").innerHTML = "";
    $("#msgs").innerHTML = '<p class="empty">Sélectionnez une discussion.</p>';
    return;
  }
  const p = person(peer);
  $("#threadHead").innerHTML = `<div class="avatar">${esc(p.initials)}</div> ${esc(p.name)}`;
  const msgs = messages.filter((m) => m.from === peer || m.to === peer);
  const box = $("#msgs");
  box.innerHTML = msgs.map((m) => `
    <div class="msg ${m.from === myEmail ? "me" : ""}">${esc(m.text)}<small>${fmtDay(m.at.slice(0, 10))} · ${fmtTime(m.at)}</small></div>`).join("")
    || `<p class="empty">Dites bonjour à ${esc(p.name)} 👋</p>`;
  box.scrollTop = box.scrollHeight;
}

function renderAll() {
  markRead();
  renderLeft();
  renderThread();
}

function setOnline(value) {
  online = value;
  $("#offline").hidden = online;
  $("#chat").style.display = online ? "" : "none";
}

/* ---------- Données & temps réel ---------- */
async function loadDirectory() {
  directory = await (await fetch("/api/users")).json();
}

/** Publie tous les comptes actifs de l'école pour qu'on puisse les choisir dans la messagerie. */
function publishSchoolAccounts() {
  const users = state.users.filter((u) => u.status === "active").map((u) => ({ ...u, initials: nameFromEmail(u.email).initials }));
  return fetch("/api/register", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ users })
  });
}

async function init() {
  renderShell();
  try {
    await registerOnServer(me);
    await publishSchoolAccounts();
    await loadDirectory();
    messages = await (await fetch(`/api/messages?me=${encodeURIComponent(myEmail)}`)).json();
    setOnline(true);
  } catch {
    return setOnline(false);
  }
  renderAll();
  $("#userSearch").addEventListener("input", (e) => { filter = e.target.value.trim().toLowerCase(); renderLeft(); });

  const events = new EventSource(`/api/events?me=${encodeURIComponent(myEmail)}`);
  events.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (!messages.some((x) => x.id === m.id)) messages.push(m);
    if (!directory.some((u) => u.email === m.from)) loadDirectory().then(renderAll);
    else renderAll();
  };
  events.onerror = () => setOnline(false);
  events.onopen = () => setOnline(true);

  setInterval(() => loadDirectory().then(renderLeft).catch(() => {}), 15000);
}

/* ---------- Interactions ---------- */
function openPeer(email) {
  peer = email;
  leftTab = "chats";
  history.replaceState(null, "", `messages.html?to=${encodeURIComponent(email)}`);
  renderAll();
  $("#msgInput").focus();
}

actions.conv = (t) => openPeer(t.dataset.email);
actions["left-tab"] = (t) => {
  leftTab = t.dataset.tab;
  renderLeft();
};

submits.formMsg = async () => {
  const input = $("#msgInput"), text = input.value.trim();
  if (!text || !peer) return;
  input.value = "";
  try {
    const res = await fetch("/api/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: myEmail, to: peer, text })
    });
    if (!res.ok) throw new Error();
    // le message revient aussi par le flux temps réel : on évite le doublon via son id
    const m = await res.json();
    if (!messages.some((x) => x.id === m.id)) messages.push(m);
    renderAll();
  } catch {
    input.value = text;
    toast("Envoi impossible. Réessayez.");
  }
};

init();
