"use strict";

/* Écran 7 : détail d'une demande (vue du demandeur ou d'un tuteur potentiel). */

(async () => {
  await requireUser({ student: true });
  const id = Number(queryParam("id"));
  let detail;

  async function load() { detail = await get(`/api/demandes/${id}`); }

  function render() {
    const { request: r, role, proposals, seances, canPropose } = detail;
    const author = role === "author", closed = r.status === "done";

    const proposalRows = proposals.map((p) => `
      <div class="prop-row">
        <div class="avatar">${esc(p.tutor.initials)}</div>
        <div class="body"><b>${esc(p.tutor.name)}</b><div class="meta">${esc(p.tutor.info)}</div></div>
        <a class="btn btn-ghost-dark btn-sm" href="messages.html?to=${encodeURIComponent(p.tutor.email)}">Écrire</a>
        ${author && !closed && p.status !== "declined"
          ? `<a class="btn btn-outline btn-sm" href="seance.html?demande=${r.id}&tuteur=${encodeURIComponent(p.tutor.email)}">Proposer une date</a>` : ""}
        ${p.status === "accepted" ? badge("confirmed") : p.status === "declined" ? badge("declined") : ""}
      </div>`).join("") || '<p class="hint">Aucune proposition pour le moment.</p>';

    const seanceRows = seances.length
      ? `<h3 class="section-title">Séances</h3><div class="list">${seances.map((s) => seanceItem(s)).join("")}</div>
         <p><a href="seances.html">Gérer mes séances →</a></p>` : "";

    let tutorBox = "";
    if (!author && !closed) {
      tutorBox = canPropose
        ? `<button class="btn btn-primary btn-block" data-action="help">Proposer mon aide</button>`
        : proposals.length
          ? `<p class="hint">Vous avez proposé votre aide à ${esc(r.author.name)}.</p>
             <a class="btn btn-outline" href="seance.html?demande=${r.id}">Proposer une date</a>`
          : '<p class="hint">Cette demande a déjà trouvé son tuteur.</p>';
    }

    mountShell(author ? "demandes" : "accueil", `
      <a class="back" href="${author ? "espaces.html" : "accueil.html"}">← Retour</a>
      <div class="card">
        <div class="detail-head">
          <div class="item" style="padding:0;border:0"><div class="ico">${icon("cap")}</div></div>
          <div><h2>${esc(r.subject)}</h2><div class="hint">${esc(r.topic)}</div></div>
          ${badge(r.status)}
        </div>
        <div class="kv"><span>${icon("user")}</span><span class="k">Demandeur</span><span>${esc(r.author.name)}</span></div>
        <div class="kv"><span>${icon("cal")}</span><span class="k">Publiée le</span><span>${fmtDate(r.createdAt)}</span></div>
        <div class="kv"><span>${icon("pin")}</span><span class="k">Lieu souhaité</span><span>${esc(r.place)}</span></div>
        <div class="kv"><span>${icon("doc")}</span><span class="k">Description</span><span>${esc(r.desc)}</span></div>
        ${author || proposals.length ? `<h3 class="section-title">Propositions d'aide (${proposals.length})</h3>${proposalRows}` : ""}
        ${tutorBox}
        ${seanceRows}
        ${author && !closed ? '<button class="btn btn-danger btn-block" style="margin-top:14px" data-action="close-request">Clôturer ma demande</button>' : ""}
      </div>
      <p class="hint">Seul le demandeur peut clôturer sa demande. Une demande clôturée passe au statut « Résolue » et n'apparaît plus dans la liste. Le tuteur reçoit un e-mail de remerciement.</p>`);
  }

  actions["close-request"] = async () => {
    if (!confirm("Clôturer cette demande ? Elle passera au statut « Résolue ».")) return;
    if (await attempt(() => post(`/api/demandes/${id}/cloture`))) location.href = "espaces.html?tab=demandes";
  };

  actions.help = async () => {
    if (!(await attempt(() => post(`/api/demandes/${id}/aide`)))) return;
    toast("Proposition envoyée.");
    await load();
    render();
  };

  try {
    await load();
    render();
  } catch (e) {
    mountShell("demandes", `<a class="back" href="espaces.html">← Retour</a><p class="empty card">${esc(e.message)}</p>`);
  }
})();
