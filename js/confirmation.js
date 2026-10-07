"use strict";

$("#app").innerHTML = `
  <div class="auth-page"><div class="auth-card">
    <div class="logo" style="color:var(--blue)">${icon("mail")}</div>
    <h1>Confirmez votre compte</h1>
    <p>Bonjour,</p>
    <p>Pour activer votre compte, cliquez sur le lien ci-dessous :</p>
    <a class="btn btn-primary btn-block" href="connexion.html?confirme=1">Confirmer mon compte</a>
    <p class="hint">Ce lien est valable 24 heures.</p>
    <p class="hint">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
  </div></div>`;
