"use strict";

requireUser();

const tab = queryParam("tab") === "passees" ? "passees" : "avenir";
const list = tab === "avenir" ? upcomingSessions() : pastSessions();

mountShell("seances", `
  <h1>Mes séances</h1>
  <div class="tabs">
    <a class="tab ${tab === "avenir" ? "active" : ""}" href="seances.html?tab=avenir">À venir</a>
    <a class="tab ${tab === "passees" ? "active" : ""}" href="seances.html?tab=passees">Passées</a>
  </div>
  <div class="list">${list.map(sessionItem).join("") || '<p class="empty">Aucune séance.</p>'}</div>
  <p class="hint" style="margin-top:14px">Les séances sont triées par date, la plus proche en premier. Chaque élément affiche son statut.</p>`);
