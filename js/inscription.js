"use strict";

$("#app").innerHTML = `
  <div class="auth-page"><form class="auth-card" id="formSignup" novalidate>
    <div class="logo">${icon("cap")}</div>
    <h1>Créer un compte</h1>
    <p class="sub">Réservé aux étudiants de l'école</p>
    <label for="email">Adresse e-mail de l'école</label>
    <input class="input" id="email" type="email" placeholder="prenom.nom@${SCHOOL_DOMAIN}" required>
    <label for="pw">Mot de passe (min. ${MIN_PASSWORD} caractères)</label>
    ${passwordField("pw")}
    <p class="field-error" id="err" hidden></p>
    <button class="btn btn-primary btn-block" type="submit">Créer mon compte</button>
    <p class="foot">Déjà un compte ? <a href="connexion.html">Se connecter</a></p>
  </form></div>`;

submits.formSignup = () => {
  const email = $("#email").value, pw = $("#pw").value;
  if (!isSchoolEmail(email)) return showErr("err", `Seules les adresses @${SCHOOL_DOMAIN} sont acceptées.`);
  if (pw.length < MIN_PASSWORD) return showErr("err", `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
  location.href = "confirmation.html";
};
