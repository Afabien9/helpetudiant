"use strict";

(async () => {
  await redirectIfLoggedIn();

  $("#app").innerHTML = `
    <div class="auth-page"><div class="auth-card" id="card">
      <form id="formSignup" novalidate>
        <div class="logo">${icon("cap")}</div>
        <h1>Créer un compte</h1>
        <p class="sub">Réservé aux étudiants de l'école</p>
        <label for="email">Adresse e-mail de l'école</label>
        <input class="input" id="email" type="email" placeholder="prenom.nom@${SCHOOL_DOMAIN}" autocomplete="email" required>
        <label for="pw">Mot de passe (min. ${MIN_PASSWORD} caractères)</label>
        ${passwordField("pw", "", "new-password")}
        <p class="field-error" id="err" hidden></p>
        <button class="btn btn-primary btn-block" type="submit">Créer mon compte</button>
        <p class="foot">Déjà un compte ? <a href="connexion.html">Se connecter</a></p>
      </form>
      ${authFooter}
    </div></div>`;

  submits.formSignup = async (form) => {
    const email = $("#email").value.trim(), password = $("#pw").value;
    if (!new RegExp(`^[^@\\s]+@${SCHOOL_DOMAIN.replace(".", "\\.")}$`, "i").test(email)) {
      return showErr("err", `Seules les adresses @${SCHOOL_DOMAIN} sont acceptées.`);
    }
    if (password.length < MIN_PASSWORD) return showErr("err", `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await post("/api/auth/signup", { email, password });
      $("#card").innerHTML = `
        <div class="logo" style="color:var(--blue)">${icon("mail")}</div>
        <h1>Vérifiez votre boîte mail</h1>
        <p class="sub">Un e-mail de confirmation a été envoyé à <b>${esc(email)}</b>. Le compte ne sera actif qu'après un clic sur le lien (valable 24 heures).</p>
        <a class="btn btn-outline btn-block" href="boite-mail.html">Ouvrir la boîte mail de démo</a>
        <p class="foot"><a href="connexion.html">Retour à la connexion</a></p>`;
    } catch (e) {
      showErr("err", e.message);
      button.disabled = false;
    }
  };
})();
