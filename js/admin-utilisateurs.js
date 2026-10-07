"use strict";

requireUser({ admin: true });

const USER_STATUS = {
  active: ["Actif", "green"], pending: ["En attente", "wait"], suspended: ["Suspendu", "grey"]
};
const isMe = (u) => u.email.toLowerCase() === state.user.email.toLowerCase();
const byId = (id) => state.users.find((u) => u.id === id);

function rowsHtml() {
  const q = $("#search").value.trim().toLowerCase();
  const role = $("#filterRole").value;
  const list = state.users.filter((u) =>
    (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
    (!role || (role === "admin" ? u.admin : role === "student" ? !u.admin : u.status === role)));
  if (!list.length) return '<tr><td colspan="5" class="empty">Aucun utilisateur trouvé.</td></tr>';
  return list.map((u) => {
    const [label, cls] = USER_STATUS[u.status];
    const me = isMe(u);
    return `
    <tr class="${u.status === "suspended" ? "archived" : ""}">
      <td><b>${esc(u.name)}</b>${me ? ' <span class="hint">(vous)</span>' : ""}<div class="hint">${esc(u.email)}</div></td>
      <td>${u.admin ? '<span class="badge blue">Admin</span>' : "Étudiant"}<div class="hint">${esc(u.year)}</div></td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td class="hint">${fmtDate(u.joined)}</td>
      <td class="actions">
        ${u.status === "pending" ? `<button class="btn btn-outline btn-sm" data-action="activate" data-id="${esc(u.id)}">Activer</button>` : ""}
        ${u.status === "suspended" ? `<button class="btn btn-outline btn-sm" data-action="reactivate" data-id="${esc(u.id)}">Réactiver</button>` : ""}
        ${u.status === "active" && !me ? `<button class="btn btn-outline btn-sm" data-action="suspend" data-id="${esc(u.id)}">Suspendre</button>` : ""}
        ${!me ? `<button class="btn btn-outline btn-sm" data-action="toggle-admin" data-id="${esc(u.id)}">${u.admin ? "Retirer admin" : "Passer admin"}</button>
        <button class="btn btn-danger btn-sm" data-action="delete-user" data-id="${esc(u.id)}">Supprimer</button>` : ""}
      </td>
    </tr>`;
  }).join("");
}

function refresh() {
  $("#rows").innerHTML = rowsHtml();
  $("#count").textContent = `${state.users.length} comptes · ${state.users.filter((u) => u.status === "active").length} actifs`;
}

function render() {
  if (!state.user.admin) {
    mountShell("accueil", '<h1>Utilisateurs</h1><p class="empty card">Accès réservé aux administrateurs.</p>');
    return;
  }
  mountShell("admin-utilisateurs", `
    <div class="page-head"><div><h1>Gestion des utilisateurs</h1><div class="hint" id="count"></div></div>
      <button class="btn btn-primary btn-sm" data-action="add-user">+ Ajouter un utilisateur</button></div>
    <div class="toolbar">
      <input class="input" id="search" type="search" placeholder="Rechercher un nom ou un e-mail…">
      <select class="input" id="filterRole">
        <option value="">Tous</option><option value="student">Étudiants</option><option value="admin">Admins</option>
        <option value="active">Actifs</option><option value="pending">En attente</option><option value="suspended">Suspendus</option>
      </select>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Inscrit le</th><th>Actions</th></tr></thead>
      <tbody id="rows"></tbody></table></div>
    <p class="hint" style="margin-top:14px">Vous ne pouvez pas suspendre, supprimer ni modifier votre propre compte. Un compte suspendu ne peut plus se connecter.</p>`);
  $("#search").addEventListener("input", refresh);
  $("#filterRole").addEventListener("change", refresh);
  refresh();
}

function update(id, fn, message) {
  const u = byId(id);
  if (!u || isMe(u)) return;
  fn(u);
  save();
  refresh();
  toast(message);
}

actions.activate = (t) => update(t.dataset.id, (u) => { u.status = "active"; }, "Compte activé.");
actions.reactivate = (t) => update(t.dataset.id, (u) => { u.status = "active"; }, "Compte réactivé.");
actions.suspend = (t) => update(t.dataset.id, (u) => { u.status = "suspended"; }, "Compte suspendu.");
actions["toggle-admin"] = (t) => {
  const u = byId(t.dataset.id);
  if (u && confirm(u.admin ? `Retirer les droits admin à ${u.name} ?` : `Donner les droits admin à ${u.name} ?`)) {
    update(u.id, (x) => { x.admin = !x.admin; }, "Rôle mis à jour.");
  }
};
actions["delete-user"] = (t) => {
  const u = byId(t.dataset.id);
  if (u && !isMe(u) && confirm(`Supprimer définitivement le compte de ${u.name} ?`)) {
    state.users = state.users.filter((x) => x !== u);
    save();
    refresh();
    toast("Compte supprimé.");
  }
};

actions["add-user"] = () => {
  openDialog("Ajouter un utilisateur (e-mail de l'école)", "", (email) => {
    if (!isSchoolEmail(email)) return `Seules les adresses @${SCHOOL_DOMAIN} sont acceptées.`;
    if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return "Ce compte existe déjà.";
    const { name } = nameFromEmail(email);
    state.users.push({ id: email.toLowerCase(), name, email: email.toLowerCase(), year: "L1", subjects: [],
      status: "pending", admin: false, joined: new Date().toISOString() });
  }, refresh);
};

render();
