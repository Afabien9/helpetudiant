"use strict";

/* Écran 6 : Mes espaces (mes demandes, mes propositions, mes séances). */

(async () => {
  await requireUser({ student: true });

  const TABS = [["demandes", "Mes demandes"], ["propositions", "Mes propositions"], ["seances", "Mes séances"]];
  const tab = TABS.some(([k]) => k === queryParam("tab")) ? queryParam("tab") : "demandes";

  let rows;
  try {
    if (tab === "demandes") {
      const list = (await get("/api/demandes")).filter((r) => r.status !== "done");
      rows = list.map((r) => `
        <a class="item" href="demande.html?id=${r.id}">
          <div class="ico">${icon("cap")}</div>
          <div class="body"><div class="title">${esc(r.subject)}</div><div class="meta">${esc(r.topic)}</div></div>
          ${badge(r.status)}<span class="chev">${icon("right")}</span>
        </a>`).join("") || '<p class="empty">Aucune demande en cours.<br><a href="nouvelle-demande.html">Déposer une demande</a></p>';
    } else if (tab === "propositions") {
      const list = await get("/api/propositions");
      rows = list.map((p) => `
        <a class="item" href="demande.html?id=${p.requestId}">
          <div class="ico">${icon("hand")}</div>
          <div class="body"><div class="title">${esc(p.subject)}</div><div class="meta">${esc(p.topic)} · ${esc(p.author.name)}</div></div>
          ${badge(p.status)}<span class="chev">${icon("right")}</span>
        </a>`).join("") || '<p class="empty">Aucune proposition.<br><a href="accueil.html#aider">Voir les étudiants à aider</a></p>';
    } else {
      const list = (await get("/api/seances")).filter((s) => s.status !== "expired" && new Date(s.when) >= new Date()).sort(byDate("when"));
      rows = list.map((s) => seanceItem(s)).join("") || '<p class="empty">Aucune séance à venir.</p>';
    }
  } catch (e) {
    rows = `<p class="empty">${esc(e.message)}</p>`;
  }

  mountShell(tab, `
    <h1>Mes espaces</h1>
    <div class="tabs">${TABS.map(([k, l]) => `<a class="tab ${tab === k ? "active" : ""}" href="espaces.html?tab=${k}">${l}</a>`).join("")}</div>
    <div class="list">${rows}</div>`);
})();
