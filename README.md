# OKIM'ART — Gestion des reçus & contrôle de livraison

Plateforme de gestion des reçus après séance et de contrôle de livraison pour le studio de photographie **OKIM'ART**, avec prise en charge de plusieurs succursales (multi-sites).

## Fonctionnalités

- **Multi-sites** : chaque succursale OKIM'ART est gérée indépendamment. Le staff ne voit que son site ; l'administrateur général voit tout et peut filtrer par site.
- **3 types de comptes** :
  - **Administrateur général (super_admin)** : gère les succursales, le personnel, et a une vue globale.
  - **Personnel (staff)** : crée les séances, les reçus, encaisse les paiements, gère la livraison de son site.
  - **Client** : compte créé automatiquement à la première séance, suit ses propres livraisons.
- **Séances** : chaque rendez-vous photo/vidéo est enregistré avec le client, le type de prestation, la date et le montant convenu.
- **Reçus** combinant à la fois :
  - le **paiement** (montant total, payé, reste à payer, historique des versements, paiement partiel/complet)
  - la **livraison** (statut : en attente → en traitement → prêt → livré, méthode : retrait en studio / lien de téléchargement / livraison physique, nombre de photos/vidéos)
- **Contrôle de livraison strict** : seul le personnel peut confirmer la remise finale au client (bouton dédié, pas d'auto-confirmation publique), et la confirmation est bloquée tant que le paiement n'est pas complet. Chaque changement de statut est journalisé (qui, quand, quel changement).
- **Reçu PDF** généré automatiquement avec le logo et les couleurs OKIM'ART, incluant un **QR code** de suivi.
- **Vérification publique par QR code** (`/verifier/:code`) : le client (ou le staff) peut scanner le code du reçu papier pour voir le statut de sa livraison en temps réel, sans exposer les montants au public.
- **Envoi du reçu au client par email ou WhatsApp** :
  - **Email** : depuis la fiche du reçu, le personnel (ou le client depuis son propre espace) peut envoyer le PDF du reçu en pièce jointe à une adresse email. Nécessite de configurer un compte SMTP (voir ci-dessous) — sans cette configuration, le bouton renvoie une erreur claire plutôt que d'échouer silencieusement.
  - **WhatsApp** : un bouton ouvre WhatsApp (application ou web) avec un message pré-rempli contenant un lien de téléchargement direct du reçu. Aucun compte WhatsApp Business API n'est nécessaire — ce lien fonctionne immédiatement. Le lien de téléchargement utilise le code de vérification du reçu comme identifiant d'accès (comme un reçu papier : quiconque a le lien peut le consulter, mais le code n'est ni public ni devinable).
- **Tableau de bord** avec statistiques (chiffre d'affaires, encaissé, reste à payer, répartition des livraisons par statut, comparatif par succursale pour l'administrateur général).
- **Utilisable aussi bien sur mobile que sur PC** : navigation en barre de tabs fixée en bas de l'écran sur mobile (comme TikTok ou Instagram), barre latérale classique sur desktop ; tableaux et formulaires adaptés ; et l'application est une **PWA installable** (icône OKIM'ART sur l'écran d'accueil, mode plein écran sans barre de navigateur, fonctionne même avec une connexion instable grâce à la mise en cache des données déjà consultées). Sur Android/Chrome, une bannière « Installer l'application » apparaît automatiquement ; sur iPhone/Safari, utilisez Partager → Sur l'écran d'accueil.
- **Mot de passe oublié** : accessible à tout type de compte (administrateur général, personnel, client) depuis l'écran de connexion. Un nouveau mot de passe temporaire est envoyé par email à l'adresse enregistrée sur le compte (nécessite la configuration SMTP décrite plus bas) ; si aucun email n'est enregistré, la personne est invitée à contacter le studio ou l'administrateur.

## Stack technique

- **Backend** : Node.js 18+ / Express, base de données **PostgreSQL** (via `pg`, requêtes paramétrées, connexion en pool, création de reçu enveloppée dans une transaction), authentification JWT, génération de PDF avec `pdfkit` et QR codes avec `qrcode`.
- **Frontend** : React 18 + Vite + Tailwind CSS, identité visuelle aux couleurs de la marque OKIM'ART (bleu marine `#1c2554` / or `#c9974e`), PWA via `vite-plugin-pwa` (manifest + service worker générés automatiquement au build).

## Installation locale

### 0. Base de données PostgreSQL

Il vous faut un serveur PostgreSQL accessible (local ou hébergé). En local sur Ubuntu/Debian :

```bash
sudo apt install postgresql
sudo -u postgres psql -c "CREATE USER okimart WITH PASSWORD 'motdepasse';"
sudo -u postgres psql -c "CREATE DATABASE okimart OWNER okimart;"
```

Vous obtenez alors une URL de connexion du type `postgresql://okimart:motdepasse@localhost:5432/okimart`.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Renseignez DATABASE_URL avec l'URL PostgreSQL ci-dessus, et changez JWT_SECRET
npm run seed     # crée le schéma + le compte super admin + un premier site + un compte staff
npm run dev       # démarre l'API sur http://localhost:4000
```

Identifiants créés par le seed (à changer immédiatement après la première connexion, un changement de mot de passe est d'ailleurs imposé) :

| Rôle | Téléphone | Mot de passe |
|---|---|---|
| Administrateur général | `0198874300` | `okimart2026` |
| Personnel (site Porto-Novo) | `0153431251` | `secretariat2026` |

### 2. Frontend (mode développement)

```bash
cd frontend
npm install
npm run dev        # démarre sur http://localhost:5173, proxy /api vers le backend
```

## Déploiement en production (service unique sur Render)

Le backend sert directement le frontend compilé — un seul service web à déployer, plus une base PostgreSQL managée.

1. Créez une instance **Render PostgreSQL** (ou toute base Postgres managée) et récupérez son URL de connexion interne.
2. Créez un **Web Service** Render pointant sur ce dépôt :
   - **Build Command** : `cd frontend && npm install && npm run build && cd ../backend && npm install`
   - **Start Command** : `cd backend && npm start`
   - **Variables d'environnement** : `DATABASE_URL` (l'URL Postgres interne de Render), `JWT_SECRET` (valeur aléatoire longue), `APP_PUBLIC_URL` (l'URL publique du service, utilisée pour générer les QR codes des reçus), `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD` si vous voulez personnaliser le compte initial.
3. Après le premier déploiement, exécutez `npm run seed` une fois (Render Shell) pour créer le schéma et le compte administrateur.

Aucun disque persistant n'est nécessaire pour l'application elle-même : toutes les données vivent dans PostgreSQL, qui gère sa propre persistance.

### Configurer l'envoi d'email (optionnel)

Renseignez dans `.env` (ou dans les variables d'environnement Render) : `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Exemple avec une adresse Gmail : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER=votre-adresse@gmail.com`, `SMTP_PASS=<mot de passe d'application Gmail, pas votre mot de passe normal>`. Tout autre service SMTP (Brevo, SendGrid, Zoho Mail, etc.) fonctionne de la même façon. Tant que ces variables ne sont pas renseignées, le bouton « Envoyer par email » reste utilisable mais affiche un message expliquant que le service n'est pas encore configuré.

## Structure du projet

```
okim-art/
├── backend/
│   ├── src/
│   │   ├── routes/         # routes API (auth, sites, staff, sessions, receipts, verify, stats)
│   │   ├── utils/          # génération PDF, QR code, codes de reçu, envoi email
│   │   ├── db.js           # connexion PostgreSQL (pool) + schéma
│   │   ├── auth.js         # JWT, hachage des mots de passe, middlewares
│   │   ├── server.js       # point d'entrée Express
│   │   └── seed.js         # création du schéma + comptes/site de départ
└── frontend/
    └── src/
        ├── pages/           # écrans de l'application
        ├── components/      # Layout, badges de statut, routes protégées
        ├── context/         # authentification
        ├── utils/           # lien de partage WhatsApp
        └── api/             # client HTTP
```

## Auteur

ARIORI Adnel Adedeji Fulbert — arioriadnel56@gmail.com
