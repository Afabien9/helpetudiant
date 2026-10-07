"use strict";

/* Données de démonstration : crée quelques étudiants fictifs qui déposent des demandes,
   proposent leur aide, fixent des séances et s'écrivent, en passant par l'API du serveur
   (qui doit donc être lancé). Les comptes fictifs ont tous le même mot de passe (affiché
   à la fin) : à supprimer depuis « Utilisateurs » une fois la démonstration terminée.

   Utilisation :  npm run seed        (ou :  BASE=http://localhost:8000 node scripts/seed-demo.js) */

const BASE = process.env.BASE || "http://localhost:8000";
const PASSWORD = "demo-Entraide-2026";

const STUDENTS = [
  { email: "marc.petit@ecole.fr", name: "Marc Petit", year: "L3", subjects: ["Mathématiques", "Informatique"] },
  { email: "alice.lefevre@ecole.fr", name: "Alice Lefèvre", year: "L3", subjects: ["Physique", "Chimie"] },
  { email: "thomas.martin@ecole.fr", name: "Thomas Martin", year: "M1", subjects: ["Informatique", "Mathématiques"] },
  { email: "sophie.bernard@ecole.fr", name: "Sophie Bernard", year: "L1", subjects: [] },
  { email: "lucas.moreau@ecole.fr", name: "Lucas Moreau", year: "L2", subjects: ["Chimie"] },
  { email: "emma.rousseau@ecole.fr", name: "Emma Rousseau", year: "L1", subjects: [] }
];

const inDays = (d, h = 14) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };

function client() {
  let cookie = "";
  return async (method, url, body) => {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${data && data.error ? data.error : ""}`);
    return data;
  };
}

async function connect(student) {
  const anon = client();
  const c = client();
  try {
    await c("POST", "/api/auth/login", { email: student.email, password: PASSWORD });
  } catch (e) {
    if (!/403/.test(e.message)) {                       // 403 = compte pas encore activé : on l'active
      if (/401/.test(e.message)) {
        await anon("POST", "/api/auth/signup", { email: student.email, password: PASSWORD });
      } else throw e;
    }
    const mails = await anon("GET", "/api/dev/mails");
    const mail = mails.find((m) => m.to === student.email && m.subject.includes("Confirmez"));
    if (!mail) throw new Error(`Impossible de créer ${student.email} (compte existant avec un autre mot de passe ?)`);
    await anon("POST", "/api/auth/confirm", { token: mail.html.match(/token=([a-f0-9]+)/)[1] });
    await c("POST", "/api/auth/login", { email: student.email, password: PASSWORD });
  }
  await c("PATCH", "/api/me", { name: student.name, year: student.year, subjects: student.subjects });
  return c;
}

async function main() {
  try { await fetch(BASE + "/pages/connexion.html"); } catch { throw new Error(`Serveur injoignable sur ${BASE} : lancez d'abord « node server.js ».`); }

  const s = {};
  for (const student of STUDENTS) s[student.email.split(".")[0]] = await connect(student);
  const { marc, alice, thomas, sophie, lucas, emma } = s;

  if ((await sophie("GET", "/api/demandes")).length) {
    console.log("Les données de démonstration sont déjà présentes : rien à faire.");
    return;
  }

  const ask = (who, subject, level, topic, desc, place) => who("POST", "/api/demandes", { subject, level, topic, desc, place });
  const help = (who, request) => who("POST", `/api/demandes/${request.id}/aide`);
  const propose = (who, request, tutor, days, hour, place) =>
    who("POST", `/api/demandes/${request.id}/seances`, { tutor, when: inDays(days, hour), place });

  /* --- Demandes des étudiants fictifs --- */
  const algebre = await ask(sophie, "Mathématiques", "L1", "Algèbre linéaire", "Je ne comprends pas le changement de base. Un exemple concret m'aiderait beaucoup.", "En ligne ou salle");
  const algo = await ask(lucas, "Informatique", "L2", "Algorithmique", "Complexité des algorithmes de tri : comment démontrer le O(n log n) ?", "Salle C3");
  const optique = await ask(emma, "Physique", "L1", "Optique", "Lentilles minces : construction des images, je me perds dans les signes.", "Bibliothèque");
  const orga = await ask(sophie, "Chimie", "L1", "Chimie organique", "Nomenclature et mécanismes de substitution, avant le partiel.", "En ligne");
  await ask(lucas, "Mathématiques", "L2", "Probabilités", "Loi binomiale et approximation par une loi normale.", "En ligne");
  await ask(emma, "Informatique", "L1", "Python", "Les boucles for et while : je mélange tout.", "En ligne");

  /* --- Propositions d'aide --- */
  await help(marc, algebre);
  await help(thomas, algebre);
  await help(thomas, algo);
  await help(marc, algo);
  await help(alice, optique);
  await help(lucas, orga);

  /* --- Séances --- */
  // Sophie choisit Marc, qui confirme : Thomas apprend que la demande est pourvue
  const seance1 = await propose(sophie, algebre, "marc.petit@ecole.fr", 2, 14, "Salle B12");
  await marc("POST", `/api/seances/${seance1.id}/confirmer`);
  // Lucas propose une date à Thomas : en attente de sa réponse
  await propose(lucas, algo, "thomas.martin@ecole.fr", 4, 10, "Salle C3");
  // Alice propose une date à Emma : Emma doit confirmer
  await propose(alice, optique, "alice.lefevre@ecole.fr", 3, 16, "Bibliothèque");
  // Une demande résolue : séance confirmée puis clôture avec remerciement
  const seance2 = await propose(sophie, orga, "lucas.moreau@ecole.fr", 1, 11, "En ligne");
  await lucas("POST", `/api/seances/${seance2.id}/confirmer`);
  await sophie("POST", `/api/demandes/${orga.id}/cloture`);

  /* --- Interactions avec les demandes des comptes réels (hors comptes fictifs) --- */
  const real = (await marc("GET", "/api/demandes/ouvertes")).filter((r) => !STUDENTS.some((x) => x.email === r.author.email));
  let engaged = 0;
  for (const r of real) {
    const tutors = r.matiere === "Physique" || r.matiere === "Chimie" ? [alice, lucas] : [marc, thomas];
    for (const tutor of tutors) await help(tutor, r).catch(() => {});
    await tutors[0]("POST", `/api/demandes/${r.id}/seances`, { when: inDays(5, 15), place: "Salle B12" }).catch(() => {});
    engaged++;
  }

  /* --- Messages --- */
  await marc("POST", "/api/messages", { to: "sophie.bernard@ecole.fr", text: "Salut Sophie ! Je suis dispo mardi pour l'algèbre linéaire." });
  await sophie("POST", "/api/messages", { to: "marc.petit@ecole.fr", text: "Super, merci Marc ! On se retrouve en salle B12 alors." });
  await thomas("POST", "/api/messages", { to: "lucas.moreau@ecole.fr", text: "Hello Lucas, pour la complexité des tris, on peut commencer par le tri fusion." });
  for (const r of real) {
    const tutor = r.matiere === "Physique" || r.matiere === "Chimie" ? alice : marc;
    const other = r.author.email;
    await tutor("POST", "/api/messages", { to: other, text: `Bonjour ${r.author.name.split(" ")[0]}, j'ai vu ta demande « ${r.topic} » : je peux t'aider !` }).catch(() => {});
  }

  console.log("Données de démonstration créées :");
  console.log(`  - ${STUDENTS.length} étudiants fictifs (mot de passe : ${PASSWORD})`);
  console.log("  - 6 demandes (dont 1 résolue), 6 propositions d'aide, 4 séances, des messages");
  console.log(`  - ${engaged} demande(s) de comptes réels ont reçu des propositions, une proposition de séance à confirmer et un message`);
}

main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
