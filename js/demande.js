"use strict";

requireUser();

const request = state.requests.find((x) => x.id === +queryParam("id"));

function render() {
  if (!request) {
    mountShell("demandes", '<a class="back" href="accueil.html">← Retour</a><p class="empty">Demande introuvable.</p>');
    return;
  }
  const closed = request.status === "done";
  const props = request.proposals.map((p) => `
    <div class="prop-row">
      <div class="avatar">${esc(p.initials)}</div>
      <div class="body"><b>${esc(p.name)}</b><div class="meta">${esc(p.info)}</div></div>
      ${closed ? "" : `<a class="btn btn-outline btn-sm" href="seance.html?id=${request.id}">Proposer une date</a>`}
    </div>`).join("") || '<p class="hint">Aucune proposition pour le moment.</p>';

  mountShell("demandes", `
    <a class="back" href="accueil.html">← Retour</a>
    <div class="card">
      <div class="detail-head">
        <div class="item" style="padding:0;border:0"><div class="ico">${icon("cap")}</div></div>
        <div><h2>${esc(request.subject)}</h2><div class="hint">${esc(request.topic)}</div></div>
        ${closed ? badge("done") : '<span class="badge open">Ouverte</span>'}
      </div>
      <div class="kv"><span>${icon("cal")}</span><span class="k">Publiée le</span><span>${fmtDay(request.date)}</span></div>
      <div class="kv"><span>${icon("pin")}</span><span class="k">Lieu souhaité</span><span>${esc(request.place)}</span></div>
      <div class="kv"><span>${icon("doc")}</span><span class="k">Description</span><span>${esc(request.desc)}</span></div>
      <h3 class="section-title">Propositions d'aide (${request.proposals.length})</h3>
      ${props}
      ${closed ? "" : '<button class="btn btn-danger btn-block" style="margin-top:14px" data-action="close-request">Clôturer ma demande</button>'}
    </div>
    <p class="hint">Seul le demandeur peut clôturer sa demande. Une demande clôturée passe au statut « Résolue » et n'apparaît plus dans la liste. Le tuteur reçoit un e-mail de remerciement.</p>`);
}

actions["close-request"] = () => {
  if (!confirm("Clôturer cette demande ? Elle passera au statut « Résolue ».")) return;
  request.status = "done";
  save();
  location.href = "accueil.html?tab=demandes";
};

render();
