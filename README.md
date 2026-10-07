# Entraide Étudiants

Plateforme d'entraide entre étudiants d'une même école : un étudiant dépose une demande d'aide,
d'autres lui proposent leur aide, ils fixent une séance et peuvent discuter en messagerie.
Un espace d'administration gère les matières, les utilisateurs et les statistiques.

Le projet est écrit en HTML, CSS et JavaScript, avec un serveur Node.js **sans aucune dépendance**.
Il implémente la maquette `maquette-aledetudiant.png` (13 écrans).

## Démarrage

```bash
node server.js        # ou : npm start
```

Puis ouvrir <http://localhost:8000>.

Au **premier lancement**, un compte administrateur est créé et son mot de passe s'affiche dans la console
(une seule fois). Pour le choisir vous-même :

```bash
ADMIN_EMAIL=admin@ecole.fr ADMIN_PASSWORD='un-mot-de-passe-solide' node server.js
```

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port du serveur | `8000` |
| `BASE_URL` | Adresse utilisée dans les liens des e-mails (mettre `https://…` en production) | `http://localhost:PORT` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte administrateur créé s'il n'en existe aucun | `admin@ecole.fr` / mot de passe aléatoire |
| `DATA_FILE` | Fichier de données | `data.json` |
| `DEV_MAILBOX` | `0` désactive la boîte mail de démo | activée (depuis la machine locale uniquement) |

## E-mails

L'application n'envoie pas de vrais e-mails : chaque message (confirmation de compte, mot de passe oublié,
nouvelle proposition, séance confirmée…) est écrit dans la console et rangé dans la
**boîte mail de démo** : <http://localhost:8000/pages/boite-mail.html> (accessible uniquement depuis
l'ordinateur qui héberge le serveur). Pour brancher un vrai service d'envoi, il suffit de remplacer
la fonction `send` de `server/mail.js`.

## Fonctionnement

1. **Inscription** avec une adresse `@ecole.fr` et un mot de passe de 12 caractères minimum.
   Le compte n'est actif qu'après un clic sur le lien reçu (valable 24 h).
2. **Profil** : année d'études et matières où l'on peut aider (liste de l'école).
3. **Demande** : l'étudiant choisit une matière, décrit son blocage. Elle est visible par les autres,
   ceux de la même matière en premier.
4. **Proposition d'aide** : un tuteur propose son aide, le demandeur est prévenu par e-mail.
5. **Séance** : l'un propose une date et un lieu (jamais dans le passé), l'autre confirme ou propose un
   autre horaire. À la confirmation, les deux étudiants reçoivent un e-mail (le tuteur reçoit l'adresse du
   demandeur) et les autres tuteurs sont prévenus que la demande est pourvue.
6. **Clôture** : seul le demandeur clôture sa demande (statut « Résolue ») ; le tuteur reçoit un remerciement.
7. **Messagerie** entre tous les comptes, en temps réel, sans avoir à partager son numéro de téléphone.
8. **Administration** : matières (ajout, renommage, archivage, jamais deux fois le même nom),
   utilisateurs (invitation, suspension, rôle admin, suppression) et statistiques.

## Sécurité

- Mots de passe hachés avec **scrypt** (sel aléatoire), jamais renvoyés par l'API.
- Sessions par cookie `HttpOnly` + `SameSite=Lax` ; contrôle de l'origine sur toute requête qui modifie des données.
- Connexion : message d'erreur unique (e-mail inconnu ou mot de passe faux), blocage de 15 minutes après 5 échecs.
- Liens de confirmation (24 h) et de réinitialisation (1 h) : jetons aléatoires, stockés hachés, **à usage unique**.
  Le formulaire « mot de passe oublié » répond de la même façon que l'adresse existe ou non.
- Les droits sont vérifiés côté serveur sur chaque route (étudiant, administrateur, propriétaire de la demande…).
- Seuls les fichiers du site sont servis ; `server/`, `data.json` et `package.json` ne sont jamais accessibles.
  En-têtes `Content-Security-Policy`, `X-Frame-Options`, `nosniff`.

> Pour une mise en ligne, placer le serveur derrière HTTPS (`BASE_URL=https://…` active le cookie `Secure`),
> brancher un vrai service d'e-mail et remplacer `data.json` par une vraie base de données.

## Structure

```
index.html            redirige vers la page de connexion
style.css             feuille de style unique
pages/                une page HTML par écran
js/common.js          appels à l'API, session, barre latérale, utilitaires
js/<page>.js          le script de chaque page
server.js             serveur HTTP : fichiers statiques, API, démarrage
server/db.js          données (fichier JSON, écriture atomique)
server/auth.js        mots de passe, jetons, sessions, limitation des tentatives
server/mail.js        modèles d'e-mails et boîte mail de démo
server/routes.js      toute l'API et les règles métier
scripts/seed-demo.js  données de démonstration
test/smoke.js         test de bout en bout
```

## Données de démonstration

```bash
npm run seed        # le serveur doit être lancé
```

Crée 6 étudiants fictifs (mot de passe : `demo-Entraide-2026`) qui déposent des demandes, proposent leur aide, fixent
des séances (confirmées, en attente, une résolue) et s'écrivent. Ils interagissent aussi avec les demandes des vrais
comptes. Le script ne recrée rien s'il est relancé. Les comptes fictifs se suppriment depuis « Utilisateurs ».

## Tests

```bash
npm test
```

Lance un serveur temporaire avec des données jetables et vérifie de bout en bout les règles ci-dessus :
inscription, confirmation, connexion et blocage, réinitialisation, demandes, propositions, séances,
messagerie en temps réel, clôture, administration, droits d'accès et fichiers privés.
