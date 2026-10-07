"use strict";

(async () => {
  await redirectIfLoggedIn();

  $("#app").innerHTML = `
    <div class="auth-page"><form class="auth-card" id="formLogin" novalidate>
      <div class="logo">${icon("cap")}</div>
      <h1>Se connecter</h1>
      <label for="email">E-mail de l'école</label>
      <input class="input" id="email" type="email" placeholder="prenom.nom@${SCHOOL_DOMAIN}" autocomplete="username" required>
      <label for="pw">Mot de passe</label>
      ${passwordField("pw")}
      <label class="checkbox"><input type="checkbox" id="remember"> Se souvenir de moi</label>
      <p class="field-ok" id="ok" hidden></p>
      <p class="field-error" id="err" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
      <p class="foot"><a href="oubli.html">Mot de passe oublié ?</a> · <a href="inscription.html">Créer un compte</a></p>
      ${authFooter}
    </form></div>`;

  if (queryParam("reset")) showOk("ok", "Mot de passe modifié. Vous pouvez vous connecter.");

  submits.formLogin = async (form) => {
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const { user } = await post("/api/auth/login", {
        email: $("#email").value.trim(), password: $("#pw").value, remember: $("#remember").checked
      });
      location.href = safeNext(queryParam("next")) || (user.role === "admin" ? "admin.html" : "accueil.html");
    } catch (e) {
      showErr("err", e.message);
      button.disabled = false;
    }
  };
})();
