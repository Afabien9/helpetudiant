"use strict";

$("#app").innerHTML = `
  <div class="auth-page"><form class="auth-card" id="formLogin" novalidate>
    <div class="logo">${icon("cap")}</div>
    <h1>Se connecter</h1>
    <label for="email">E-mail de l'école</label>
    <input class="input" id="email" type="email" placeholder="prenom.nom@${SCHOOL_DOMAIN}" required>
    <label for="pw">Mot de passe</label>
    ${passwordField("pw")}
    <label class="checkbox"><input type="checkbox"> Se souvenir de moi</label>
    <p class="field-ok" id="ok" hidden></p>
    <p class="field-error" id="err" hidden></p>
    <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
    <p class="foot"><a href="oubli.html">Mot de passe oublié ?</a> · <a href="inscription.html">Créer un compte</a></p>
    <p class="hint" style="text-align:center;margin-top:14px">Démo : tout mot de passe de ${MIN_PASSWORD}+ caractères fonctionne.<br>Un e-mail <b>admin.xxx@${SCHOOL_DOMAIN}</b> donne accès à l'administration.</p>
  </form></div>`;

if (queryParam("confirme")) {
  const ok = $("#ok");
  ok.textContent = "Compte activé ✔ Vous pouvez vous connecter.";
  ok.hidden = false;
}

submits.formLogin = async () => {
  if (Date.now() < state.lockedUntil) {
    return showErr("err", `Trop de tentatives. Réessayez dans ${Math.ceil((state.lockedUntil - Date.now()) / 60000)} min.`);
  }
  const email = $("#email").value.trim(), pw = $("#pw").value;

  if (isSchoolEmail(email) && pw.length >= MIN_PASSWORD) {
    const known = state.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (known && known.status !== "active") {
      return showErr("err", known.status === "suspended"
        ? "Ce compte est suspendu. Contactez l'administration."
        : "Ce compte n'est pas encore activé. Confirmez-le via l'e-mail reçu.");
    }
    const { name, initials } = nameFromEmail(email);
    state.attempts = 0;
    state.user = { name: known ? known.name : name, initials, year: known ? known.year : "L3", field: "Informatique", email,
      subjects: known ? known.subjects : ["Mathématiques", "Physique", "Informatique"],
      admin: known ? known.admin : /^admin\./i.test(email) };
    registerUser(state.user);
    save();
    await registerOnServer(state.user);
    location.href = state.user.admin ? "admin.html" : "accueil.html";
    return;
  }

  state.attempts++;
  if (state.attempts >= MAX_ATTEMPTS) {
    state.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
    state.attempts = 0;
    save();
    return showErr("err", `Trop de tentatives. Connexion bloquée ${LOCK_MINUTES} minutes.`);
  }
  save();
  showErr("err", "E-mail ou mot de passe incorrect."); // message unique volontairement
};
