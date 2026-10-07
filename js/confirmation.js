"use strict";

(async () => {
  const card = (ico, color, title, body) => {
    $("#app").innerHTML = `
      <div class="auth-page"><div class="auth-card">
        <div class="logo" style="color:${color}">${icon(ico)}</div>
        <h1>${title}</h1>
        <p class="sub">${body}</p>
        <a class="btn btn-primary btn-block" href="connexion.html">Se connecter</a>
        ${authFooter}
      </div></div>`;
  };

  card("mail", "var(--blue)", "Confirmation en cours…", "Un instant.");
  try {
    await post("/api/auth/confirm", { token: queryParam("token") || "" });
    card("check", "var(--green)", "Compte activé", "Votre adresse est confirmée : vous pouvez maintenant vous connecter.");
  } catch (e) {
    card("lock", "var(--red)", "Lien invalide", `${esc(e.message)} Le lien a déjà servi ou a plus de 24 heures : recréez un compte pour recevoir un nouvel e-mail.`);
  }
})();
