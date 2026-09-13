import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, fetchPdfBlob } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';
import StatusBadge, { PaymentBadge } from '../components/StatusBadge.jsx';
import DeleteReceiptModal from '../components/DeleteReceiptModal.jsx';
import { buildWhatsappShareUrl } from '../utils/whatsapp.js';
import { buildReceiptImageBlob } from '../utils/receiptImage.js';

function fcfa(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

const NEXT_STATUS = {
  en_attente: { value: 'en_traitement', label: 'Passer en traitement' },
  en_traitement: { value: 'pret', label: 'Marquer prêt à livrer' },
};

export default function ReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function load() {
    api.get(`/receipts/${id}`).then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function handleStatusChange(newStatus) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/receipts/${id}/livraison`, { statut_livraison: newStatus });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!window.confirm('Confirmer que les éléments ont bien été remis au client en personne ?')) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/receipts/${id}/confirmer-livraison`, {});
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleViewPdf() {
    try {
      const blob = await fetchPdfBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDownloadPdf() {
    try {
      const blob = await fetchPdfBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-okimart-${data.receipt.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleConfirmDelete(motif) {
    await api.post(`/receipts/${id}/demander-suppression`, { motif });
    setShowDeleteModal(false);
    navigate('/receipts');
  }

  if (!data) {
    return (
      <Layout>
        {error ? <p className="text-red-600 text-sm">{error}</p> : <p className="text-stone-400 text-sm">Chargement…</p>}
      </Layout>
    );
  }

  const { receipt, payments, history } = data;
  const reste = Math.max(0, receipt.montant_total - receipt.montant_paye);
  const isStaff = user.role === 'staff' || user.role === 'super_admin';
  const next = NEXT_STATUS[receipt.statut_livraison];

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy-dark">{receipt.numero}</h1>
          <p className="text-stone-500 text-sm mt-1">{receipt.client_nom} — {receipt.site_nom}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleViewPdf} className="btn btn-outline">Voir le reçu (PDF)</button>
          {isStaff && (
            <Link to={`/sessions/${receipt.session_id}`} className="btn btn-outline">Voir la séance</Link>
          )}
          {isStaff && (
            <button onClick={() => setShowDeleteModal(true)} className="btn btn-outline text-red-600 hover:bg-red-50">
              Supprimer
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {showDeleteModal && (
        <DeleteReceiptModal
          receipt={receipt}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="card p-5">
          <p className="text-stone-400 text-xs uppercase mb-2">Paiement</p>
          <PaymentBadge status={receipt.statut_paiement} />
          <div className="mt-3 text-sm space-y-1 text-stone-600">
            <p>Total : {fcfa(receipt.montant_total)}</p>
            <p>Payé : {fcfa(receipt.montant_paye)}</p>
            <p className="font-medium text-navy-dark">Reste : {fcfa(reste)}</p>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-stone-400 text-xs uppercase mb-2">Livraison</p>
          <StatusBadge status={receipt.statut_livraison} />
          <div className="mt-3 text-sm space-y-1 text-stone-600">
            <p>{receipt.nb_photos} photo(s), {receipt.nb_videos} vidéo(s)</p>
            <p className="capitalize">{receipt.methode_livraison.replaceAll('_', ' ')}</p>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-stone-400 text-xs uppercase mb-2">Code de vérification</p>
          <p className="font-display text-lg text-navy-dark">{receipt.code_verification}</p>
          <p className="text-xs text-stone-400 mt-2">Imprimé avec le QR code sur le reçu PDF.</p>
        </div>
      </div>

      <ShareReceipt receipt={receipt} onSent={load} />

      {isStaff && (
        <div className="card p-6 mb-8">
          <p className="text-sm font-medium text-navy-dark mb-4">Contrôle de livraison</p>
          <div className="flex flex-wrap gap-3">
            {next && (
              <button disabled={busy} onClick={() => handleStatusChange(next.value)} className="btn btn-primary">
                {next.label}
              </button>
            )}
            {receipt.statut_livraison === 'pret' && (
              <button
                disabled={busy || receipt.statut_paiement !== 'complet'}
                onClick={handleConfirmDelivery}
                className="btn btn-gold"
                title={receipt.statut_paiement !== 'complet' ? 'Le paiement doit être complet avant la livraison.' : ''}
              >
                Confirmer la remise au client
              </button>
            )}
            {receipt.statut_livraison === 'livre' && (
              <p className="text-sm text-emerald-700">
                Livré le {new Date(receipt.date_livraison).toLocaleString('fr-FR')}
              </p>
            )}
          </div>
          {receipt.statut_livraison === 'pret' && receipt.statut_paiement !== 'complet' && (
            <p className="text-xs text-amber-600 mt-2">Le solde doit être réglé avant de confirmer la remise.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-navy-dark">Paiements</h2>
            {isStaff && receipt.statut_paiement !== 'complet' && (
              <button onClick={() => setShowPayment((v) => !v)} className="text-sm text-gold-dark hover:underline">
                {showPayment ? 'Annuler' : '+ Ajouter un paiement'}
              </button>
            )}
          </div>
          {showPayment && <PaymentForm receiptId={id} onDone={() => { setShowPayment(false); load(); }} />}
          <div className="card divide-y divide-stone-100">
            {payments.length === 0 ? (
              <p className="p-4 text-sm text-stone-400">Aucun paiement enregistré.</p>
            ) : payments.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-navy-dark">{fcfa(p.montant)}</p>
                  <p className="text-xs text-stone-400 capitalize">{p.mode_paiement.replaceAll('_', ' ')} — {p.staff_nom}</p>
                </div>
                <p className="text-xs text-stone-400">{new Date(p.created_at).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-navy-dark mb-3">Historique de livraison</h2>
          <div className="card divide-y divide-stone-100">
            {history.map((h) => (
              <div key={h.id} className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <StatusBadge status={h.nouveau_statut} />
                  <p className="text-xs text-stone-400">{new Date(h.created_at).toLocaleString('fr-FR')}</p>
                </div>
                {h.note && <p className="text-stone-500 text-xs mt-1.5">{h.note}</p>}
                {h.changed_by_nom && <p className="text-stone-400 text-xs mt-1">par {h.changed_by_nom}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ShareReceipt({ receipt, onSent }) {
  const [email, setEmail] = useState(receipt.client_email || '');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Message court joint à la facture — plus de lien : l'image de la facture est envoyée,
  // avec le détail du solde actuel (montant payé / total / reste à payer).
  const resteAPayer = Math.max(0, (receipt.montant_total || 0) - (receipt.montant_paye || 0));
  const whatsappMessage =
    `Bonjour ${receipt.client_nom}, voici la facture de votre séance ${receipt.type_seance} ` +
    `chez OKIM'ART (${receipt.site_nom}).\n\n` +
    `Montant total : ${fcfa(receipt.montant_total)}\n` +
    `Montant payé : ${fcfa(receipt.montant_paye)}\n` +
    `Reste à payer : ${fcfa(resteAPayer)}`;

  async function handleSendEmail(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    try {
      const data = await api.post(`/receipts/${receipt.id}/envoyer-email`, { email });
      setSuccess(`Reçu envoyé à ${data.envoye_a}.`);
      setShowEmailForm(false);
      onSent?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleSendWhatsapp() {
    setError('');
    setSendingWhatsapp(true);
    try {
      // La facture est rendue en image (PNG) — aucun PDF, aucun lien n'est envoyé.
      const blob = await buildReceiptImageBlob(receipt);
      const file = new File([blob], `facture-okimart-${receipt.numero}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Ouvre le partage natif du téléphone : en choisissant WhatsApp, l'image de la
        // facture est jointe directement au message, avec le court texte explicatif.
        await navigator.share({ files: [file], text: whatsappMessage, title: `Facture ${receipt.numero}` });
      } else {
        // Le navigateur (généralement un ordinateur) ne sait pas partager de fichier
        // directement : on télécharge l'image de la facture, puis on ouvre WhatsApp avec
        // le message prêt à envoyer — il suffit alors de joindre l'image téléchargée.
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-okimart-${receipt.numero}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        window.open(buildWhatsappShareUrl(receipt.client_telephone, whatsappMessage), '_blank');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || "Impossible d'envoyer la facture par WhatsApp.");
      }
    } finally {
      setSendingWhatsapp(false);
    }
  }

  return (
    <div className="card p-6 mb-8">
      <p className="text-sm font-medium text-navy-dark mb-1">Partager le reçu avec le client</p>
      <p className="text-xs text-stone-400 mb-4">
        Envoyez directement une image de la facture par WhatsApp (avec le solde actuel), ou le PDF par email.
      </p>

      {receipt.email_envoye_at && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-4">
          Déjà envoyé par email à {receipt.email_envoye_a} le {new Date(receipt.email_envoye_at).toLocaleString('fr-FR')}.
        </p>
      )}
      {success && <p className="text-xs text-emerald-700 mb-3">{success}</p>}
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSendWhatsapp} disabled={sendingWhatsapp} className="btn btn-outline">
          {sendingWhatsapp ? 'Préparation…' : 'Envoyer par WhatsApp'}
        </button>
        <button className="btn btn-outline" onClick={() => setShowEmailForm((v) => !v)}>
          {showEmailForm ? 'Annuler' : 'Envoyer par email'}
        </button>
      </div>

      {showEmailForm && (
        <form onSubmit={handleSendEmail} className="mt-4 flex flex-wrap items-end gap-3 max-w-md">
          <div className="flex-1">
            <label className="label">Adresse email du client</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@exemple.com"
              required
            />
          </div>
          <button type="submit" disabled={sending} className="btn btn-gold">
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </form>
      )}
    </div>
  );
}

function PaymentForm({ receiptId, onDone }) {
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(`/receipts/${receiptId}/payments`, { montant: Number(montant), mode_paiement: mode });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-3 space-y-3">
      <div>
        <label className="label">Montant (FCFA)</label>
        <input className="input" type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} required />
      </div>
      <div>
        <label className="label">Mode de paiement</label>
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="especes">Espèces</option>
          <option value="mtn_momo">MTN MoMo</option>
          <option value="moov_money">Moov Money</option>
          <option value="virement">Virement</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-gold w-full">
        {loading ? 'Enregistrement…' : 'Enregistrer le paiement'}
      </button>
    </form>
  );
}
