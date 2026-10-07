"use strict";

const RULES = [
  ["mail", "Compte avec e-mail école", "Seules les adresses du domaine de l'école sont acceptées."],
  ["mail", "Confirmation par e-mail", "Le compte est actif après le clic."],
  ["lock", "Mot de passe sécurisé", `Au moins ${MIN_PASSWORD} caractères, stocké haché.`],
  ["shield", "Erreurs de connexion", `Message unique, blocage après ${MAX_ATTEMPTS} échecs (${LOCK_MINUTES} min).`],
  ["out", "Déconnexion", "Possible depuis n'importe quelle page."],
  ["mail", "Notifications par e-mail", "Propositions, acceptations, demandes pourvues."],
  ["user", "Profil étudiant", "Année + matières (liste)."],
  ["list", "Suivi sur une page", "Demandes, propositions, séances."],
  ["cal", "Séances", "Date/heure/lieu, confirmées par e-mail."],
  ["check", "Clôture demande", "Seul le demandeur, statut « Résolue », e-mail de remerciement."],
  ["key", "Récupération mot de passe", "Lien 1 h, 1 seule utilisation."],
  ["book", "Administration matières", "Ajout/renommage/archivage (admin)."],
  ["chat", "Messagerie", "(à venir) Échanger dans l'application."]
];

$("#app").innerHTML = `
  <div class="auth-page" style="align-items:flex-start"><div style="max-width:1000px;width:100%">
    <h1 style="margin-bottom:20px">Accès étudiant (récapitulatif des règles)</h1>
    <div class="rules">${RULES.map(([i, t, d]) =>
      `<div class="rule"><div class="ri">${icon(i)}</div><div><b>${t}</b><span>${d}</span></div></div>`).join("")}</div>
    <p style="margin-top:20px"><a href="connexion.html">← Retour à l'application</a></p>
  </div></div>`;
