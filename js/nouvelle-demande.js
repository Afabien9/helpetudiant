"use strict";

(async () => {
  await requireUser({ student: true });
  const subjects = await attempt(() => get("/api/matieres")) || [];

  mountShell("demandes", `
    <a class="back" href="accueil.html">← Retour</a>
    <h1>Déposer une demande</h1>
    <form class="card form-narrow" id="formRequest" novalidate>
      <label for="subject">Matière</label>
      <select class="input" id="subject" required>
        <option value="">Choisir une matière</option>
        ${subjects.map((s) => `<option>${esc(s)}</option>`).join("")}
      </select>
      <label for="level">Niveau</label>
      <select class="input" id="level">${ALL_LEVELS.map((l) => `<option ${l === me.year ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label for="topic">Sujet</label>
      <input class="input" id="topic" maxlength="60" placeholder="Ex. : Analyse, exercices">
      <label for="place">Lieu souhaité</label>
      <select class="input" id="place">${PLACES.map((p) => `<option>${esc(p)}</option>`).join("")}</select>
      <label for="desc">Description</label>
      <textarea class="input" id="desc" rows="4" maxlength="500" placeholder="Où bloquez-vous précisément ?"></textarea>
      <p class="field-error" id="err" hidden></p>
      <button class="btn btn-primary btn-block" style="margin-top:18px" type="submit">Publier ma demande</button>
    </form>`);

  submits.formRequest = async (form) => {
    const subject = $("#subject").value, topic = $("#topic").value.trim(), desc = $("#desc").value.trim();
    if (!subject) return showErr("err", "Choisissez une matière.");
    if (topic.length < 2) return showErr("err", "Indiquez le sujet.");
    if (desc.length < 10) return showErr("err", "Décrivez votre blocage en quelques mots (10 caractères minimum).");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const created = await post("/api/demandes", { subject, level: $("#level").value, topic, place: $("#place").value, desc });
      location.href = `demande.html?id=${created.id}`;
    } catch (e) {
      showErr("err", e.message);
      button.disabled = false;
    }
  };
})();
