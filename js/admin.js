"use strict";

requireUser({ admin: true });

const nameTaken = (name, except) =>
  state.subjects.some((s) => s !== except && s.name.toLowerCase() === name.toLowerCase());

function render() {
  if (!state.user.admin) {
    mountShell("accueil", '<h1>Administration</h1><p class="empty card">Accès réservé aux administrateurs.</p>');
    return;
  }
  const rows = state.subjects.map((s, i) => `
    <tr class="${s.archived ? "archived" : ""}">
      <td>${esc(s.name)}</td>
      <td><span class="badge ${s.archived ? "grey" : "green"}">${s.archived ? "Archivée" : "Active"}</span></td>
      <td class="actions">
        <button class="btn btn-outline btn-sm" data-action="rename-subject" data-i="${i}">Renommer</button>
        <button class="btn btn-outline btn-sm" data-action="toggle-archive" data-i="${i}">${s.archived ? "Restaurer" : "Archiver"}</button>
      </td>
    </tr>`).join("");
  mountShell("admin", `
    <div class="page-head"><h1>Gestion des matières</h1>
      <button class="btn btn-primary btn-sm" data-action="add-subject-admin">+ Ajouter une matière</button></div>
    <table class="table"><thead><tr><th>Nom</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint" style="margin-top:14px">Accès réservé aux administrateurs. Une matière archivée n'est plus proposée mais reste sur les anciennes demandes. Deux matières ne peuvent pas avoir le même nom.</p>`);
}

actions["add-subject-admin"] = () => {
  openDialog("Ajouter une matière", "", (name) => {
    if (nameTaken(name)) return "Une matière porte déjà ce nom.";
    state.subjects.push({ name, archived: false });
  }, render);
};

actions["rename-subject"] = (t) => {
  const subject = state.subjects[+t.dataset.i];
  openDialog("Renommer la matière", subject.name, (name) => {
    if (nameTaken(name, subject)) return "Une matière porte déjà ce nom.";
    const old = subject.name;
    subject.name = name;
    state.user.subjects = state.user.subjects.map((x) => (x === old ? name : x));
  }, render);
};

actions["toggle-archive"] = (t) => {
  const subject = state.subjects[+t.dataset.i];
  subject.archived = !subject.archived;
  save();
  render();
  toast(subject.archived ? "Matière archivée." : "Matière restaurée.");
};

render();
