"use strict";

/* Page d'accueil : bienvenue, résumé de l'activité et demandes à aider. */

(async () => {
  await requireUser({ student: true });

  let mine = [], board = [], seances = [];
  const subjectsOf = (list) => list.filter((s) => s.status !== "expired" && new Date(s.when) >= new Date()).sort(byDate("when"));

  async function load() {
    [mine, board, seances] = await Promise.all([get("/api/demandes"), get("/api/demandes/ouvertes"), get("/api/seances")]);
  }

  function render() {
    const firstName = me.name.split(" ")[0];
    const greeting = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";
    const myOpen = mine.filter((r) => r.status !== "done");
    const waitingProposals = myOpen.reduce((n, r) => n + r.proposalCount, 0);
    const upcoming = subjectsOf(seances);
    const next = upcoming.find((s) => s.status === "confirmed");
    const toConfirm = upcoming.filter((s) => s.mustConfirm).length;
    const suggestions = [...board].sort((a, b) => Number(b.match) - Number(a.match)).slice(0, 4);

    const suggestionRows = suggestions.map((b) => `
      <div class="item">
        <div class="avatar">${esc(b.author.initials)}</div>
        <div class="body">
          <div class="title">${esc(b.subject)} ${b.match ? '<span class="badge blue">Dans vos matières</span>' : ""}</div>
          <div class="meta">${esc(b.author.name)} · ${esc(b.topic)} · ${fmtDate(b.createdAt)}</div>
          <div class="meta clamp">${esc(b.desc)}</div>
        </div>
        <a class="btn btn-ghost-dark btn-sm" href="demande.html?id=${b.id}">Détails</a>
        <button class="btn btn-outline btn-sm" data-action="help" data-id="${b.id}">Proposer mon aide</button>
      </div>`).join("") || '<p class="empty">Aucune demande à aider pour le moment. Revenez bientôt !</p>';

    const recent = myOpen.slice(0, 3).map((r) => `
      <a class="item" href="demande.html?id=${r.id}">
        <div class="ico">${icon("cap")}</div>
        <div class="body"><div class="title">${esc(r.subject)}</div><div class="meta">${esc(r.topic)}</div></div>
        ${badge(r.status)}
      </a>`).join("") || '<p class="empty">Vous n\'avez aucune demande en cours.</p>';

    mountShell("accueil", `
      <section class="hero">
        <div>
          <h1>${greeting} ${esc(firstName)} 👋</h1>
          <p>Besoin d'un coup de main ou envie d'aider ? Entre étudiants de l'école, on se débloque plus vite.</p>
          <div class="hero-actions">
            <a class="btn btn-light" href="nouvelle-demande.html">+ Déposer une demande</a>
            <a class="btn btn-ghost" href="#aider">Aider un étudiant</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">${icon("cap")}</div>
      </section>

      ${toConfirm ? `<a class="notice" href="seances.html">${icon("cal")} ${toConfirm} proposition${toConfirm > 1 ? "s" : ""} de séance à confirmer →</a>` : ""}

      <div class="stat-row">
        <a class="stat" href="espaces.html?tab=demandes"><span class="n">${myOpen.length}</span><span>demande${myOpen.length > 1 ? "s" : ""} en cours</span></a>
        <a class="stat" href="espaces.html?tab=demandes"><span class="n">${waitingProposals}</span><span>proposition${waitingProposals > 1 ? "s" : ""} d'aide reçue${waitingProposals > 1 ? "s" : ""}</span></a>
        <a class="stat" href="seances.html"><span class="n">${upcoming.length}</span><span>séance${upcoming.length > 1 ? "s" : ""} à venir</span></a>
        <a class="stat" href="messages.html"><span class="n">${icon("chat")}</span><span>Ouvrir la messagerie</span></a>
      </div>

      <div class="home-grid">
        <section>
          <h2 class="home-title">Prochaine séance</h2>
          ${next ? `<div class="next-session">
              <div class="date-chip"><b>${new Date(next.when).getDate()}</b>
                <span>${new Date(next.when).toLocaleDateString("fr-FR", { month: "short" })}</span></div>
              <div class="body"><div class="title">${esc(next.subject)}</div>
                <div class="meta">${icon("clock")} ${fmtTime(next.when)} · ${icon("pin")} ${esc(next.place)}</div></div>
              ${badge("confirmed")}
            </div>
            <p><a href="seances.html">Voir toutes mes séances →</a></p>`
          : '<p class="empty card">Aucune séance confirmée.<br><a href="espaces.html?tab=demandes">Proposez une date sur une de vos demandes</a></p>'}
        </section>
        <section>
          <h2 class="home-title">Mes demandes en cours</h2>
          <div class="list">${recent}</div>
          <p><a href="espaces.html?tab=demandes">Tout voir →</a></p>
        </section>
      </div>

      <section id="aider">
        <h2 class="home-title">Étudiants à aider</h2>
        <p class="hint" style="margin-top:-6px">Les demandes de vos matières (${me.subjects.map(esc).join(", ") || "aucune : choisissez-les dans votre profil"}) passent en premier.</p>
        <div class="list">${suggestionRows}</div>
      </section>

      <section>
        <h2 class="home-title">Comment ça marche ?</h2>
        <div class="steps">
          <div class="step"><span>1</span><b>Déposez une demande</b><p>Choisissez la matière, expliquez où vous bloquez.</p></div>
          <div class="step"><span>2</span><b>Recevez des propositions</b><p>Des étudiants de votre école proposent leur aide.</p></div>
          <div class="step"><span>3</span><b>Fixez une séance</b><p>Choisissez une date, un lieu, puis discutez en messagerie.</p></div>
        </div>
      </section>`);
  }

  actions.help = async (t) => {
    const b = board.find((x) => x.id === Number(t.dataset.id));
    t.disabled = true;
    const ok = await attempt(() => post(`/api/demandes/${t.dataset.id}/aide`));
    if (ok) toast(`Proposition envoyée à ${b.author.name}.`);
    await load();
    render();
  };

  try { await load(); } catch (e) { toast(e.message); }
  render();
})();
