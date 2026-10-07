"use strict";

/* Écran 8 : proposer une séance, ou répondre à une proposition par un autre horaire. */

(async () => {
  await requireUser({ student: true });

  const counterId = Number(queryParam("id"));            // ?id=  : autre horaire pour une séance existante
  const requestId = Number(queryParam("demande"));       // ?demande=&tuteur= : nouvelle proposition
  let subject, other, backHref;

  try {
    if (counterId) {
      const s = (await get("/api/seances")).find((x) => x.id === counterId);
      if (!s) throw new Error("Séance introuvable.");
      subject = s.subject; other = s.other; backHref = "seances.html";
    } else {
      const d = await get(`/api/demandes/${requestId}`);
      const email = queryParam("tuteur");
      const tutor = d.role === "author" ? (d.proposals.find((p) => p.tutor.email === email) || {}).tutor : null;
      if (d.role === "author" && !tutor) throw new Error("Ce tuteur n'a pas proposé son aide.");
      subject = d.request.subject; other = tutor || d.request.author; backHref = `demande.html?id=${requestId}`;
    }
  } catch (e) {
    mountShell("demandes", `<a class="back" href="espaces.html">← Retour</a><p class="empty card">${esc(e.message)}</p>`);
    return;
  }

  const today = new Date().toLocaleDateString("sv-SE");
  mountShell(counterId ? "seances" : "demandes", `
    <a class="back" href="${backHref}">← Retour</a>
    <h1>${counterId ? "Proposer un autre horaire" : "Proposer une séance"}</h1>
    <form class="card form-narrow" id="formSession" novalidate>
      <div class="detail-head"><div class="item" style="padding:0;border:0"><div class="ico">${icon("cal")}</div></div>
        <div><h2>${esc(subject)}</h2><div class="hint">avec ${esc(other.name)}</div></div></div>
      <label for="date">Date</label>
      <input class="input" id="date" type="date" min="${today}" required>
      <label for="time">Heure</label>
      <input class="input" id="time" type="time" required>
      <label for="place">Lieu</label>
      <select class="input" id="place" required>
        <option value="">Salle ou lien visio</option>
        ${PLACES.map((p) => `<option>${esc(p)}</option>`).join("")}
      </select>
      <p class="field-error" id="err" hidden></p>
      <button class="btn btn-primary btn-block" style="margin-top:18px" type="submit">Proposer la séance</button>
    </form>
    <p class="hint">L'un propose, l'autre confirme ou propose un autre horaire. Impossible de fixer une séance dans le passé.</p>`);

  submits.formSession = async (form) => {
    const date = $("#date").value, time = $("#time").value, place = $("#place").value;
    if (!date || !time || !place) return showErr("err", "Merci de renseigner la date, l'heure et le lieu.");
    const when = new Date(`${date}T${time}`);
    if (when <= new Date()) return showErr("err", "Impossible de fixer une séance dans le passé.");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const payload = { when: when.toISOString(), place };
      if (counterId) await post(`/api/seances/${counterId}/modifier`, payload);
      else await post(`/api/demandes/${requestId}/seances`, { ...payload, tutor: other.email });
      mountShell("seances", `
        <h1>Proposition envoyée</h1>
        <div class="card confirm-box form-narrow">
          <div class="check">${icon("check")}</div>
          <div><b>${esc(other.name)} a reçu votre proposition.</b>
            <div class="hint">${fmtDate(when)} à ${fmtTime(when)}, ${esc(place)}.<br>La séance sera confirmée dès que ${esc(other.name)} aura répondu : vous serez prévenu par e-mail.</div></div>
        </div>
        <p><a class="btn btn-outline" href="seances.html">Voir mes séances</a></p>`);
    } catch (e) {
      showErr("err", e.message);
      button.disabled = false;
    }
  };
})();
