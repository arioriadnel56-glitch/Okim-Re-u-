import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-display text-lg text-navy-dark">{title}</span>
        <span className="text-stone-400 text-sm">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-5 pb-5 text-sm text-stone-600 space-y-3">{children}</div>}
    </div>
  );
}

function Steps({ items }) {
  return (
    <ol className="list-decimal list-inside space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

export default function Aide() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy-dark">Centre d'aide</h1>
        <p className="text-stone-500 text-sm mt-1">
          Le guide d'utilisation de la plateforme OKIM'ART, adapté à votre rôle
          {role === 'super_admin' && ' (propriétaire / super admin)'}
          {role === 'staff' && ' (personnel de studio)'}
          {role === 'client' && ' (client)'}
          .
        </p>
      </div>

      <div className="space-y-4">
        {/* ---------------------------------------------------------------- CLIENT ---- */}
        {role === 'client' && (
          <>
            <Section title="Mon espace client" defaultOpen>
              <p>Votre espace vous permet de suivre vos séances photo/vidéo et vos factures, sans avoir besoin de contacter le studio.</p>
              <Steps
                items={[
                  'Sur la page d\u2019accueil, chaque carte correspond à un reçu : elle montre le studio, le type de séance, le statut de paiement et le statut de livraison.',
                  'La barre de progression (En attente → En traitement → Prêt → Livré) indique où en est la préparation de vos photos/vidéos.',
                  '« Voir le reçu » ouvre le PDF de votre facture dans un nouvel onglet.',
                  '« Télécharger la facture (PDF) » l\u2019enregistre directement sur votre appareil.',
                  '« Partager par WhatsApp » envoie une image de votre facture (avec le détail du solde) — pas de PDF, pas de lien.',
                  '« Recevoir par email » vous renvoie le reçu à votre adresse email enregistrée.',
                ]}
              />
            </Section>

            <Section title="Mon compte">
              <p>Votre compte a été créé automatiquement par le studio lors de votre première séance, avec votre numéro de téléphone comme identifiant.</p>
              <Steps
                items={[
                  'Un mot de passe temporaire vous a été communiqué par le personnel — changez-le dès votre première connexion.',
                  'Si vous l\u2019avez oublié, utilisez « Mot de passe oublié » sur l\u2019écran de connexion.',
                  'Toutes vos séances (dans tous les studios OKIM\u2019ART) apparaissent sur le même compte, si le même numéro de téléphone a été utilisé.',
                ]}
              />
            </Section>
          </>
        )}

        {/* ---------------------------------------------------------------- STAFF ---- */}
        {role === 'staff' && (
          <>
            <Section title="Créer une séance et émettre une facture" defaultOpen>
              <Steps
                items={[
                  'Menu « Séances » → « Nouvelle séance ».',
                  'Renseignez le type de séance, la date, le montant total, puis les informations du client (nom, téléphone obligatoire, email facultatif).',
                  'Si le numéro de téléphone est nouveau, un compte client est créé automatiquement avec un mot de passe temporaire affiché à l\u2019écran — communiquez-le au client.',
                  'Ouvrez la séance créée, puis cliquez sur « Créer un reçu ».',
                  'Indiquez le montant payé, le mode de paiement, la méthode de livraison (retrait, lien de téléchargement ou livraison physique), et validez.',
                  'Depuis le reçu : « Voir »/« Télécharger » le PDF, « Envoyer par WhatsApp » (image + solde) ou « Envoyer par email ».',
                ]}
              />
            </Section>

            <Section title="Suivre et mettre à jour les livraisons">
              <p>Sur la page d\u2019un reçu, mettez à jour le statut de livraison (En attente → En traitement → Prêt → Livré) au fur et à mesure de l\u2019avancement, et enregistrez les paiements complémentaires si le client règle le solde plus tard.</p>
            </Section>

            <Section title="Supprimer un reçu">
              <p>Vous ne pouvez pas supprimer un reçu directement : la suppression doit être <strong>justifiée</strong>.</p>
              <Steps
                items={[
                  'Depuis la liste des reçus ou la page d\u2019un reçu, cliquez sur « Supprimer ».',
                  'Indiquez un motif clair (obligatoire, 5 caractères minimum).',
                  'Le reçu part dans la corbeille : il n\u2019apparaît plus dans vos listes, en attente de validation par le super admin.',
                  'Le super admin peut restaurer le reçu ou valider sa suppression définitive, sous 30 jours.',
                ]}
              />
            </Section>
          </>
        )}

        {/* ------------------------------------------------------------ SUPER ADMIN --- */}
        {role === 'super_admin' && (
          <>
            <Section title="Vue d'ensemble du propriétaire" defaultOpen>
              <p>En tant que super admin, vous avez une vue sur tous les studios : création de séances/reçus comme le personnel, plus la gestion des studios, du personnel, et le contrôle des suppressions.</p>
            </Section>

            <Section title="Créer une séance et émettre une facture" defaultOpen>
              <Steps
                items={[
                  'Menu « Séances » → « Nouvelle séance » — choisissez d\u2019abord le studio concerné.',
                  'Renseignez type de séance, date, montant total, et les informations du client (nom, téléphone, email).',
                  'Ouvrez la séance, cliquez sur « Créer un reçu », renseignez montant payé, mode de paiement et méthode de livraison.',
                  'Partagez la facture au client via WhatsApp (image + solde) ou email, depuis la page du reçu.',
                ]}
              />
            </Section>

            <Section title="Gérer les studios (succursales)">
              <Steps
                items={[
                  'Menu « Succursales » : créez un nouveau studio avec « Nouvelle succursale ».',
                  '« Désactiver »/« Réactiver » suspend temporairement un studio sans perdre son historique.',
                  '« Supprimer » retire définitivement un studio — impossible s\u2019il a un historique de reçus/séances : désactivez-le dans ce cas plutôt que de le supprimer, pour conserver l\u2019historique.',
                ]}
              />
            </Section>

            <Section title="Gérer le personnel (comptes secrétaires)">
              <Steps
                items={[
                  'Menu « Personnel » → « Ajouter un membre » : renseignez nom, téléphone, studio de rattachement — un mot de passe temporaire est généré.',
                  '« Réinitialiser mdp » génère un nouveau mot de passe temporaire si un membre l\u2019a oublié.',
                  '« Désactiver »/« Réactiver » suspend l\u2019accès sans supprimer le compte.',
                  '« Supprimer » retire définitivement un compte — impossible s\u2019il a créé des reçus (la colonne « Historique » indique combien) : désactivez-le plutôt pour conserver la traçabilité.',
                ]}
              />
            </Section>

            <Section title="Gérer les séances">
              <p>Un bouton « Supprimer », visible uniquement pour vous, permet de retirer définitivement une séance depuis la liste ou sa page de détail — impossible si un reçu y est déjà rattaché (protège l\u2019historique).</p>
              <p>Le bouton « Télécharger la liste des séances (PDF) », en haut de la page Séances, exporte un tableau récapitulatif de toutes les séances réalisées, tous studios confondus.</p>
            </Section>

            <Section title="La corbeille des reçus">
              <p>Quand un membre du personnel (ou vous-même) demande la suppression d\u2019un reçu, il part dans la corbeille avec un motif obligatoire.</p>
              <Steps
                items={[
                  'Menu « Corbeille », onglet « En attente » : chaque reçu affiche le motif, qui l\u2019a demandé, et un compte à rebours (30 jours).',
                  '« Restaurer » annule la suppression, le reçu redevient normal.',
                  '« Valider la suppression définitive » archive le reçu (motif, demandeur, validateur) puis le supprime réellement.',
                  'Sans validation sous 30 jours, le reçu est purgé automatiquement.',
                  'Onglet « Historique » : trace de toutes les suppressions définitives déjà validées ; un bouton « Supprimer » permet d\u2019effacer une entrée devenue inutile.',
                ]}
              />
            </Section>

            <Section title="Tableau de bord et statistiques">
              <p>La page d\u2019accueil résume l\u2019activité globale : chiffre d\u2019affaires, nombre de reçus, répartition par statut de livraison, tous studios confondus.</p>
            </Section>
          </>
        )}
      </div>
    </Layout>
  );
}
