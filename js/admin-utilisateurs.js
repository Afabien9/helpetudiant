"use strict";

/* Gestion des utilisateurs (admin uniquement). */

(async () => {
  await requireUser({ admin: true });

  const USER_STATUS = { active: ["Actif", "green"], pending: ["En attente", "wait"], suspended: ["Suspendu", "grey"] };
  let users = [];
  const byEmail = (t) => users.find((u) => u.email === t.dataset.email);
  const url = (u) => `/api/admin/utilisateurs/${encodeURIComponent(u.email)}`;

  function rowsHtml() {
    const q = $("#search").value.trim().toLowerCase();
    const role = $("#filterRole").value;
    const list = users.filter((u) =>
      (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)) &&
      (!role || (role === "admin" ? u.role === "admin" : role === "student" ? u.role !== "admin" : u.status === role)));
    if (!list.length) return '<tr><td colspan="5" class="empty">Aucun utilisateur trouvé.</td></tr>';
    return list.map((u) => {
      const [label, cls] = USER_STATUS[u.status];
      const self = u.email === me.email;
      const e = `data-email="${esc(u.email)}"`;
      return `
      <tr class="${u.status === "suspended" ? "archived" : ""}">
        <td><b>${esc(u.name)}</b>${self ? ' <span class="hint">(vous)</span>' : ""}<div class="hint">${esc(u.email)}</div></td>
        <td>${u.role === "admin" ? '<span class="badge blue">Admin</span>' : "Étudiant"}<div class="hint">${esc(u.year)}</div></td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td class="hint">${fmtDate(u.joined)}</td>
        <td class="actions">
          ${!self && u.status === "suspended" ? `<button class="btn btn-outline btn-sm" data-action="reactivate" ${e}>Réactiver</button>` : ""}
          ${!self && u.status === "active" ? `<button class="btn btn-outline btn-sm" data-action="suspend" ${e}>Suspendre</button>` : ""}
          ${!self ? `<button class="btn btn-outline btn-sm" data-action="toggle-admin" ${e}>${u.role === "admin" ? "Retirer admin" : "Passer admin"}</button>
          <button class="btn btn-danger btn-sm" data-action="delete-user" ${e}>Supprimer</button>` : ""}
        </td>
      </tr>`;
    }).join("");
  }

  function refresh() {
    $("#rows").innerHTML = rowsHtml();
    $("#count").textContent = `${users.length} comptes · ${users.filter((u) => u.status === "active").length} actifs`;
  }

  function render() {
    mountShell("admin-utilisateurs", `
      <div class="page-head"><div><h1>Gestion des utilisateurs</h1><div class="hint" id="count"></div></div>
        <button class="btn btn-primary btn-sm" data-action="add-user">+ Inviter un utilisateur</button></div>
      <div class="toolbar">
        <input class="input" id="search" type="search" placeholder="Rechercher un nom ou un e-mail…" aria-label="Rechercher">
        <select class="input" id="filterRole" aria-label="Filtrer">
          <option value="">Tous</option><option value="student">Étudiants</option><option value="admin">Admins</option>
          <option value="active">Actifs</option><option value="pending">En attente</option><option value="suspended">Suspendus</option>
        </select>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>Inscrit le</th><th>Actions</th></tr></thead>
        <tbody id="rows"></tbody></table></div>
      <p class="hint" style="margin-top:14px">Vous ne pouvez pas modifier ni supprimer votre propre compte. Un compte suspendu ne peut plus se connecter. Un compte invité devient actif quand la personne choisit son mot de passe.</p>`);
    $("#search").addEventListener("input", refresh);
    $("#filterRole").addEventListener("change", refresh);
    refresh();
  }

  async function reload() { users = await get("/api/admin/utilisateurs"); refresh(); }

  async function change(t, body, message) {
    if (!(await attempt(() => patch(url(byEmail(t)), body)))) return;
    await reload();
    toast(message);
  }

  actions.reactivate = (t) => change(t, { status: "active" }, "Compte réactivé.");
  actions.suspend = (t) => change(t, { status: "suspended" }, "Compte suspendu.");
  actions["toggle-admin"] = (t) => {
    const u = byEmail(t);
    if (confirm(u.role === "admin" ? `Retirer les droits admin à ${u.name} ?` : `Donner les droits admin à ${u.name} ?`)) {
      change(t, { role: u.role === "admin" ? "student" : "admin" }, "Rôle mis à jour.");
    }
  };
  actions["delete-user"] = async (t) => {
    const u = byEmail(t);
    if (!confirm(`Supprimer définitivement le compte de ${u.name} ? Ses demandes, séances et messages seront supprimés.`)) return;
    if (!(await attempt(() => del(url(u))))) return;
    await reload();
    toast("Compte supprimé.");
  };
  actions["add-user"] = () => openDialog("Inviter un utilisateur (e-mail de l'école)", "", async (email) => {
    await post("/api/admin/utilisateurs", { email });
    await reload();
    toast("Invitation envoyée par e-mail.");
  }, { placeholder: `prenom.nom@${SCHOOL_DOMAIN}`, type: "email" });

  render();
  try { await reload(); } catch (e) { toast(e.message); }
})();
