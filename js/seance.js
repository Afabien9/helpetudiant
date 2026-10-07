"use strict";

requireUser();

const request = state.requests.find((x) => x.id === +queryParam("id")) || state.requests[0];
let confirmed = null;

function render() {
  mountShell("demandes", `
    <a class="back" href="demande.html?id=${request.id}">← Retour</a>
    <h1>Proposer une séance</h1>
    <form class="card form-narrow" id="formSession" novalidate>
      <div class="detail-head"><div class="item" style="padding:0;border:0"><div class="ico">${icon("cal")}</div></div>
        <div><h2>${esc(request.subject)}</h2><div class="hint">${esc(request.topic)}</div></div></div>
      <label for="date">Date</label>
      <input class="input" id="date" type="date" required>
      <label for="time">Heure</label>
      <input class="input" id="time" type="time" required>
      <label for="place">Lieu</label>
      <select class="input" id="place" required>
        <option value="">Salle ou lien visio</option>
        <option>Salle B12</option><option>Salle C3</option><option>Bibliothèque</option><option>Lien visio</option>
      </select>
      <p class="field-error" id="err" hidden></p>
      <button class="btn btn-primary btn-block" style="margin-top:18px" type="submit">Proposer la séance</button>
    </form>
    ${confirmed ? `<div class="card confirm-box form-narrow">
      <div class="check">${icon("check")}</div>
      <div><b>Séance confirmée !</b>
        <div class="hint">La séance est programmée le ${fmtDate(confirmed.when)} à ${fmtTime(confirmed.when)}, ${esc(confirmed.place)}.<br>Un e-mail a été envoyé aux deux étudiants.</div></div>
    </div>` : ""}
    <p class="hint">L'un propose, l'autre confirme ou propose un autre horaire. Impossible de fixer une séance dans le passé.</p>`);
}

submits.formSession = () => {
  const date = $("#date").value, time = $("#time").value, place = $("#place").value;
  if (!date || !time || !place) return showErr("err", "Merci de renseigner la date, l'heure et le lieu.");
  const when = new Date(`${date}T${time}`);
  if (when < new Date()) return showErr("err", "Impossible de fixer une séance dans le passé.");
  state.sessions.push({ id: Date.now(), subject: request.subject, when: when.toISOString(), place, status: "confirmed" });
  save();
  confirmed = { when, place };
  render();
};

render();
