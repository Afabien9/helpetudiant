"use strict";

requireUser();

const TABS = [["demandes", "Mes demandes"], ["propositions", "Mes propositions"], ["seances", "Mes séances"]];
const tab = TABS.some(([k]) => k === queryParam("tab")) ? queryParam("tab") : "demandes";

let rows;
if (tab === "demandes") {
  rows = state.requests.filter((r) => r.status !== "done").map((r) => `
    <a class="item" href="demande.html?id=${r.id}">
      <div class="ico">${icon("cap")}</div>
      <div class="body"><div class="title">${esc(r.subject)}</div><div class="meta">${esc(r.topic)}</div></div>
      ${badge(r.status)}<span class="chev">${icon("right")}</span>
    </a>`).join("") || '<p class="empty">Aucune demande en cours.</p>';
} else if (tab === "propositions") {
  rows = state.propositions.map((p) => `
    <div class="item">
      <div class="ico">${icon("hand")}</div>
      <div class="body"><div class="title">${esc(p.subject)}</div><div class="meta">${esc(p.topic)}</div></div>
      ${badge(p.status)}
    </div>`).join("") || '<p class="empty">Aucune proposition.</p>';
} else {
  rows = upcomingSessions().map(sessionItem).join("") || '<p class="empty">Aucune séance à venir.</p>';
}

mountShell(queryParam("tab") ? tab : "accueil", `
  <h1>Mes espaces</h1>
  <div class="tabs">${TABS.map(([k, l]) => `<a class="tab ${tab === k ? "active" : ""}" href="accueil.html?tab=${k}">${l}</a>`).join("")}</div>
  <div class="list">${rows}</div>`);
