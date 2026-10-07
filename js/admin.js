"use strict";

/* Écran 11 : administration des matières (admin uniquement). */

(async () => {
  await requireUser({ admin: true });
  let subjects = [];

  function render() {
    const rows = subjects.map((s) => `
      <tr class="${s.archived ? "archived" : ""}">
        <td>${esc(s.name)}</td>
        <td><span class="badge ${s.archived ? "grey" : "green"}">${s.archived ? "Archivée" : "Active"}</span></td>
        <td class="hint">${s.requests}</td>
        <td class="actions">
          <button class="btn btn-outline btn-sm" data-action="rename-subject" data-id="${s.id}">Renommer</button>
          <button class="btn btn-outline btn-sm" data-action="toggle-archive" data-id="${s.id}">${s.archived ? "Restaurer" : "Archiver"}</button>
        </td>
      </tr>`).join("");
    mountShell("admin", `
      <div class="page-head"><h1>Gestion des matières</h1>
        <button class="btn btn-primary btn-sm" data-action="add-subject-admin">+ Ajouter une matière</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Nom</th><th>Statut</th><th>Demandes</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint" style="margin-top:14px">Accès réservé aux administrateurs. Une matière archivée n'est plus proposée mais reste sur les anciennes demandes. Deux matières ne peuvent pas avoir le même nom.</p>`);
  }

  const reload = async () => { subjects = await get("/api/admin/matieres"); render(); };
  const find = (t) => subjects.find((s) => s.id === Number(t.dataset.id));

  actions["add-subject-admin"] = () => openDialog("Ajouter une matière", "", async (name) => {
    await post("/api/admin/matieres", { name });
    await reload();
    toast("Matière ajoutée.");
  });

  actions["rename-subject"] = (t) => {
    const s = find(t);
    openDialog("Renommer la matière", s.name, async (name) => {
      await patch(`/api/admin/matieres/${s.id}`, { name });
      await reload();
      toast("Matière renommée.");
    });
  };

  actions["toggle-archive"] = async (t) => {
    const s = find(t);
    if (!(await attempt(() => patch(`/api/admin/matieres/${s.id}`, { archived: !s.archived })))) return;
    await reload();
    toast(s.archived ? "Matière restaurée." : "Matière archivée.");
  };

  try { await reload(); } catch (e) { toast(e.message); }
})();
