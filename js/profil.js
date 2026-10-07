"use strict";

/* Écran 5 : profil étudiant (année, matières) + changement de mot de passe. */

(async () => {
  await requireUser();
  const allSubjects = await attempt(() => get("/api/matieres")) || [];

  function render() {
    const available = allSubjects.filter((s) => !me.subjects.includes(s));
    const tags = me.subjects.map((s) =>
      `<span class="tag">${esc(s)} <button data-action="remove-subject" data-name="${esc(s)}" aria-label="Retirer ${esc(s)}">×</button></span>`).join("");
    mountShell("profil", `
      <h1>Mon profil</h1>
      <div class="card">
        <div class="profile-head">
          <div class="avatar lg">${esc(me.initials)}</div>
          <div><b>${esc(me.name)}</b><div class="hint">${esc(me.year)} · ${esc(me.email)}</div></div>
        </div>
        <label for="name">Nom affiché</label>
        <input class="input" id="name" value="${esc(me.name)}" maxlength="60">
        <label for="year">Année d'études</label>
        <select class="input" id="year">${ALL_LEVELS.map((l) => `<option ${l === me.year ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label>Matières où je peux aider</label>
        <div class="tags">
          ${tags || '<span class="hint">Aucune matière choisie</span>'}
          ${available.length ? `<select data-action="add-subject" aria-label="Ajouter une matière"><option value="">+ Ajouter</option>${available.map((s) => `<option>${esc(s)}</option>`).join("")}</select>` : ""}
        </div>
        <p class="hint">Les matières sont choisies dans la liste de l'école. Les demandes de mes matières s'affichent en premier.</p>
        <p><button class="btn btn-primary" data-action="save-profile">Modifier</button></p>
      </div>

      <form class="card" id="formPassword" style="margin-top:16px" novalidate>
        <h3 style="margin-bottom:4px">Mot de passe</h3>
        <label for="current">Mot de passe actuel</label>
        ${passwordField("current", "", "current-password")}
        <label for="next">Nouveau mot de passe (min. ${MIN_PASSWORD} caractères)</label>
        ${passwordField("next", "", "new-password")}
        <p class="field-error" id="err" hidden></p>
        <p style="margin-bottom:0"><button class="btn btn-outline" type="submit">Changer mon mot de passe</button></p>
      </form>`);
  }

  const save = async (changes, message) => {
    const user = await attempt(() => patch("/api/me", changes));
    if (!user) return;
    me = user;
    render();
    if (message) toast(message);
  };

  actions["remove-subject"] = (t) => save({ subjects: me.subjects.filter((s) => s !== t.dataset.name) });
  changes["add-subject"] = (sel) => { if (sel.value) save({ subjects: [...me.subjects, sel.value] }); };
  actions["save-profile"] = () => save({ name: $("#name").value, year: $("#year").value }, "Profil mis à jour.");

  submits.formPassword = async () => {
    const next = $("#next").value;
    if (next.length < MIN_PASSWORD) return showErr("err", `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
    try {
      await post("/api/me/password", { current: $("#current").value, next });
      showErr("err", "");
      $("#current").value = $("#next").value = "";
      toast("Mot de passe modifié.");
    } catch (e) {
      showErr("err", e.message);
    }
  };

  render();
})();
