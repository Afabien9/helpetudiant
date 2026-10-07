"use strict";

/* Base de données : un objet en mémoire, sauvegardé dans un fichier JSON. */

const fs = require("fs");
const path = require("path");

const FILE = process.env.DATA_FILE || path.join(__dirname, "..", "data.json");
const VERSION = 2;

const empty = () => ({
  version: VERSION,
  nextId: 1,
  users: {},        // email -> compte
  subjects: [],     // matières proposées par l'école
  requests: [],     // demandes d'aide (avec leurs propositions de tuteurs)
  seances: [],      // séances proposées / confirmées
  messages: [],     // messagerie
  tokens: [],       // jetons de confirmation / réinitialisation (hachés)
  authSessions: {}, // sessions de connexion (hachées)
  mails: []         // boîte mail de démonstration
});

function load() {
  let raw;
  try {
    raw = fs.readFileSync(FILE, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return empty();
    throw e;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version === VERSION) return Object.assign(empty(), parsed);
  } catch { /* fichier illisible : sauvegardé ci-dessous */ }
  const backup = FILE.replace(/\.json$/, ".old.json");
  fs.renameSync(FILE, backup);
  console.log(`Ancien format de données détecté : sauvegardé dans ${path.basename(backup)}.`);
  return empty();
}

const data = load();

let timer = null;
function writeNow() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);   // écriture atomique
}
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { writeNow(); } catch (e) { console.error("Sauvegarde impossible :", e.message); } }, 150);
}
function flushSync() {
  clearTimeout(timer);
  try { writeNow(); } catch { /* ignoré à l'arrêt */ }
}

const nextId = () => data.nextId++;

module.exports = { data, persist, flushSync, nextId };
