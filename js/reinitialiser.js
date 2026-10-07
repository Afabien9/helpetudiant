"use strict";

$("#app").innerHTML = `
  <div class="auth-page"><form class="auth-card" id="formReset" novalidate>
    <div class="logo" style="color:var(--navy)">${icon("key")}</div>
    <h1>Nouveau mot de passe</h1>
    <p class="sub">Choisissez un mot de passe d'au moins ${MIN_PASSWORD} caractères. Le lien ne sert qu'une fois.</p>
    <label for="pw">Nouveau mot de passe</label>
    ${passwordField("pw", "", "new-password")}
    <label for="pw2">Confirmer le mot de passe</label>
    ${passwordField("pw2", "", "new-password")}
    <p class="field-error" id="err" hidden></p>
    <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
    <p class="foot"><a href="connexion.html">Retour à la connexion</a></p>
  </form></div>`;

submits.formReset = async (form) => {
  const password = $("#pw").value;
  if (password.length < MIN_PASSWORD) return showErr("err", `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
  if (password !== $("#pw2").value) return showErr("err", "Les deux mots de passe ne correspondent pas.");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    await post("/api/auth/reset", { token: queryParam("token") || "", password });
    location.href = "connexion.html?reset=1";
  } catch (e) {
    showErr("err", e.message);
    button.disabled = false;
  }
};
