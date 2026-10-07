"use strict";

$("#app").innerHTML = `
  <div class="auth-page"><form class="auth-card" id="formForgot" novalidate>
    <div class="logo" style="color:var(--navy)">${icon("lock")}</div>
    <h1>Réinitialiser votre mot de passe</h1>
    <p class="sub">Saisissez votre e-mail de l'école. Vous recevrez un lien pour créer un nouveau mot de passe.</p>
    <label for="email">E-mail de l'école</label>
    <input class="input" id="email" type="email" placeholder="prenom.nom@${SCHOOL_DOMAIN}" required>
    <p class="field-ok" id="ok" hidden></p>
    <p class="field-error" id="err" hidden></p>
    <button class="btn btn-primary btn-block" type="submit">Envoyer le lien</button>
    <p class="foot"><a href="connexion.html">Retour à la connexion</a></p>
  </form></div>`;

submits.formForgot = () => {
  // Même message que l'adresse existe ou non
  const ok = $("#ok");
  ok.textContent = "Si cette adresse existe, un lien valable 1 heure vient d'être envoyé.";
  ok.hidden = false;
};
