"use strict";

const user = requireUser();

function render() {
  const available = state.subjects.filter((s) => !s.archived && !user.subjects.includes(s.name));
  const tags = user.subjects.map((s) =>
    `<span class="tag">${esc(s)} <button data-action="remove-subject" data-name="${esc(s)}" aria-label="Retirer ${esc(s)}">×</button></span>`).join("");
  mountShell("profil", `
    <h1>Mon profil</h1>
    <div class="card">
      <div class="profile-head">
        <div class="avatar lg">${esc(user.initials)}</div>
        <div><b>${esc(user.name)}</b><div class="hint">${esc(user.year)} ${esc(user.field || "Informatique")}</div></div>
      </div>
      <label for="year">Année d'études</label>
      <select class="input" id="year">${ALL_LEVELS.map((l) => `<option ${l === user.year ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label>Matières où je peux aider</label>
      <div class="tags">
        ${tags || '<span class="hint">Aucune matière choisie</span>'}
        ${available.length ? `<select data-action="add-subject"><option value="">+ Ajouter</option>${available.map((s) => `<option>${esc(s.name)}</option>`).join("")}</select>` : ""}
      </div>
      <p class="hint">Les matières sont choisies dans la liste de l'école.</p>
      <p><button class="btn btn-primary" data-action="save-profile">Modifier</button></p>
    </div>
    <p class="hint">Mon profil affiche mon prénom, mon année et mes matières. Les demandes de mes matières s'affichent en premier.</p>`);
}

actions["remove-subject"] = (t) => {
  user.subjects = user.subjects.filter((s) => s !== t.dataset.name);
  save();
  render();
};
changes["add-subject"] = (sel) => {
  if (!sel.value) return;
  user.subjects.push(sel.value);
  save();
  render();
};
actions["save-profile"] = () => {
  user.year = $("#year").value;
  save();
  render();
  toast("Profil mis à jour.");
};

render();
