"use strict";

/* E-mails de l'application. Il n'y a pas de serveur d'envoi : chaque message est
   écrit dans la console et conservé dans la « boîte mail de démo » (pages/boite-mail.html). */

const { data, persist, nextId } = require("./db");

const PORT = process.env.PORT || 8000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const MAX_MAILS = 200;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const link = (page) => `${BASE_URL}/pages/${page}`;

function render({ title, lines, cta, note }) {
  const paragraphs = lines.map((l) => `<p style="margin:0 0 12px">${l}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0;text-align:center"><a href="${cta.url}" style="background:#1f5fd6;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  const small = note ? `<p style="margin:0 0 8px;color:#6b7690;font-size:13px">${note}</p>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><base target="_top"></head><body style="margin:0;background:#f4f6fb;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1c2740">
<div style="max-width:520px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #dde3ee;border-radius:12px;padding:28px">
<h2 style="margin:0 0 16px;font-size:20px;text-align:center">${esc(title)}</h2>${paragraphs}${button}${small}
</div><p style="text-align:center;color:#6b7690;font-size:12px">Entraide Étudiants</p></div></body></html>`;
}

function send(to, subject, content) {
  const mail = { id: nextId(), to, subject, html: render({ title: subject, ...content }), at: new Date().toISOString() };
  data.mails.push(mail);
  if (data.mails.length > MAX_MAILS) data.mails.splice(0, data.mails.length - MAX_MAILS);
  persist();
  console.log(`✉  ${to} — ${subject}`);
}

/* ---------- Modèles ---------- */
const mails = {
  confirmation: (to, token) => send(to, "Confirmez votre compte", {
    lines: ["Bonjour,", "Pour activer votre compte, cliquez sur le lien ci-dessous :"],
    cta: { label: "Confirmer mon compte", url: link(`confirmation.html?token=${token}`) },
    note: "Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."
  }),
  invitation: (to, token) => send(to, "Votre compte Entraide Étudiants", {
    lines: ["Bonjour,", "Un administrateur vous a créé un compte. Choisissez votre mot de passe pour l'activer :"],
    cta: { label: "Choisir mon mot de passe", url: link(`reinitialiser.html?token=${token}`) },
    note: "Ce lien est valable 24 heures."
  }),
  reset: (to, token) => send(to, "Réinitialiser votre mot de passe", {
    lines: ["Bonjour,", "Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous pour en créer un nouveau :"],
    cta: { label: "Créer un nouveau mot de passe", url: link(`reinitialiser.html?token=${token}`) },
    note: "Ce lien est valable 1 heure et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."
  }),
  newProposal: (to, requesterName, tutorName, request) => send(to, "Nouvelle proposition d'aide", {
    lines: [`Bonjour ${esc(requesterName)},`, `<b>${esc(tutorName)}</b> a proposé son aide pour votre demande « ${esc(request.subject)} – ${esc(request.level)} ».`],
    cta: { label: "Voir la demande", url: link(`demande.html?id=${request.id}`) }
  }),
  seanceProposed: (to, name, otherName, request, when, place) => send(to, "Nouvelle proposition de séance", {
    lines: [`Bonjour ${esc(name)},`, `<b>${esc(otherName)}</b> vous propose une séance pour « ${esc(request.subject)} – ${esc(request.level)} » :`, `<b>${esc(when)}</b> · ${esc(place)}`],
    cta: { label: "Répondre", url: link("seances.html") }
  }),
  seanceConfirmed: (to, name, otherName, request, when, place, contact) => send(to, "Séance confirmée", {
    lines: [`Bonjour ${esc(name)},`, `Votre séance « ${esc(request.subject)} – ${esc(request.level)} » avec <b>${esc(otherName)}</b> est confirmée :`, `<b>${esc(when)}</b> · ${esc(place)}`,
      ...(contact ? [`Pour vous joindre : <a href="mailto:${esc(contact)}">${esc(contact)}</a>`] : [])],
    cta: { label: "Mes séances", url: link("seances.html") }
  }),
  fulfilled: (to, name, request) => send(to, "Demande pourvue", {
    lines: [`Bonjour ${esc(name)},`, `La demande « ${esc(request.subject)} – ${esc(request.level)} » a trouvé son tuteur. Merci d'avoir proposé votre aide !`],
    cta: { label: "Voir d'autres demandes", url: link("accueil.html") }
  }),
  thanks: (to, name, requesterName, request) => send(to, "Merci pour votre aide !", {
    lines: [`Bonjour ${esc(name)},`, `<b>${esc(requesterName)}</b> a clôturé sa demande « ${esc(request.subject)} – ${esc(request.level)} » et vous remercie pour votre aide.`]
  })
};

module.exports = { mails, BASE_URL };
