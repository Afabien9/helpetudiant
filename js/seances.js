"use strict";

/* Écran 9 : Mes séances (à venir / passées) avec confirmation des propositions reçues. */

(async () => {
  await requireUser({ student: true });

  const tab = queryParam("tab") === "passees" ? "passees" : "avenir";
  let seances = [], confirmed = null;

  const isPast = (s) => s.status === "expired" || new Date(s.when) < new Date();

  function actionsFor(s) {
    if (s.mustConfirm) {
      return `<span class="item-actions">
        <button class="btn btn-primary btn-sm" data-action="confirm" data-id="${s.id}">Confirmer</button>
        <a class="btn btn-outline btn-sm" href="seance.html?id=${s.id}">Autre horaire</a></span>`;
    }
    if (s.status === "wait" && !isPast(s)) return '<span class="hint">En attente de réponse</span>';
    return "";
  }

  function render() {
    const list = (tab === "avenir" ? seances.filter((s) => !isPast(s)).sort(byDate("when"))
                                   : seances.filter(isPast).sort((a, b) => new Date(b.when) - new Date(a.when)));
    mountShell("seances", `
      <h1>Mes séances</h1>
      ${confirmed ? `<div class="card confirm-box">
        <div class="check">${icon("check")}</div>
        <div><b>Séance confirmée !</b>
          <div class="hint">La séance est programmée le ${fmtDate(confirmed.when)} à ${fmtTime(confirmed.when)}, ${esc(confirmed.place)}.<br>Un e-mail a été envoyé aux deux étudiants.</div></div>
      </div>` : ""}
      <div class="tabs">
        <a class="tab ${tab === "avenir" ? "active" : ""}" href="seances.html?tab=avenir">À venir</a>
        <a class="tab ${tab === "passees" ? "active" : ""}" href="seances.html?tab=passees">Passées</a>
      </div>
      <div class="list">${list.map((s) => seanceItem(s, actionsFor(s))).join("") || '<p class="empty">Aucune séance.</p>'}</div>
      <p class="hint" style="margin-top:14px">Les séances sont triées par date, la plus proche en premier. Chaque élément affiche son statut.</p>`);
  }

  actions.confirm = async (t) => {
    t.disabled = true;
    const s = await attempt(() => post(`/api/seances/${t.dataset.id}/confirmer`));
    if (s) confirmed = s;
    seances = await get("/api/seances");
    render();
  };

  try { seances = await get("/api/seances"); } catch (e) { toast(e.message); }
  render();
})();
