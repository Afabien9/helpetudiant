"use strict";

/* Boîte mail de démonstration : l'application n'envoie pas de vrais e-mails,
   elle les range ici (visible uniquement depuis cet ordinateur). */

// Les liens d'un e-mail doivent s'ouvrir dans la page entière, pas dans le cadre isolé qui l'affiche
const withTopLinks = (html) => (html.includes("<base ") ? html : html.replace(/<html[^>]*>/, '$&<head><meta charset="utf-8"><base target="_top"></head>'));

let mails = [];
let selected = null;
let filter = "";

function render() {
  const list = mails.filter((m) => !filter || m.to.includes(filter));
  const current = list.find((m) => m.id === selected) || list[0];
  selected = current ? current.id : null;
  $("#mailList").innerHTML = list.map((m) => `
    <button class="conv ${m.id === selected ? "active" : ""}" data-action="open-mail" data-id="${m.id}">
      <div class="body"><div class="name">${esc(m.subject)}</div>
        <div class="last">À : ${esc(m.to)} · ${fmtTime(m.at)}</div></div>
    </button>`).join("") || '<p class="empty hint">Aucun e-mail.</p>';
  const frame = $("#mailFrame");
  if (current) { if (frame.dataset.id !== String(current.id)) { frame.srcdoc = withTopLinks(current.html); frame.dataset.id = current.id; } frame.hidden = false; }
  else frame.hidden = true;
}

actions["open-mail"] = (t) => { selected = Number(t.dataset.id); render(); };

async function load() {
  try {
    mails = await get("/api/dev/mails");
    render();
  } catch (e) {
    $("#mailBox").innerHTML = `<p class="empty">${esc(e.status === 404 ? "La boîte mail de démo n'est disponible que depuis l'ordinateur qui héberge le serveur." : e.message)}</p>`;
    clearInterval(timer);
  }
}

$("#app").innerHTML = `
  <div class="auth-page" style="align-items:flex-start"><div style="max-width:1000px;width:100%">
    <h1 style="margin-bottom:6px">Boîte mail de démo</h1>
    <p class="hint" style="margin:0 0 16px">Les e-mails de l'application (confirmation, mot de passe oublié, séances…) arrivent ici. <a href="connexion.html">← Retour à l'application</a></p>
    <div class="chat mailbox" id="mailBox">
      <div class="convs">
        <div class="conv-new"><input class="input" id="mailFilter" type="search" placeholder="Filtrer par destinataire…" autocomplete="off"></div>
        <div id="mailList"></div>
      </div>
      <div class="thread"><iframe id="mailFrame" title="Contenu de l'e-mail" sandbox="allow-top-navigation-by-user-activation" hidden></iframe></div>
    </div>
  </div></div>`;
$("#mailFilter").addEventListener("input", (e) => { filter = e.target.value.trim().toLowerCase(); render(); });

const timer = setInterval(load, 4000);
load();
