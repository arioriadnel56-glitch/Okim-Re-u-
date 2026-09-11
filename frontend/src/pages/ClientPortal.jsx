import React, { useEffect, useState } from 'react';
import { api, fetchPdfBlob, fetchExportPdfBlob } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';
import StatusBadge, { PaymentBadge } from '../components/StatusBadge.jsx';
import { buildWhatsappShareUrl } from '../utils/whatsapp.js';
import { buildReceiptImageBlob } from '../utils/receiptImage.js';

function fcfa(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

const STEPS = ['en_attente', 'en_traitement', 'pret', 'livre'];
const STEP_LABELS = { en_attente: 'En attente', en_traitement: 'En traitement', pret: 'Prêt', livre: 'Livré' };

export default function ClientPortal() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/receipts')
      .then((d) => setReceipts(d.receipts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleViewPdf(id) {
    try {
      const blob = await fetchPdfBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDownloadPdf(receipt) {
    try {
      const blob = await fetchPdfBlob(receipt.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-okimart-${receipt.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleExportAll() {
    setExporting(true);
    setError('');
    try {
      const blob = await fetchExportPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mes-recus-okimart-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="font-display text-2xl text-navy-dark">Bonjour {user.nom.split(' ')[0]}</h1>
        {receipts.length > 0 && (
          <button onClick={handleExportAll} disabled={exporting} className="btn btn-outline">
            {exporting ? 'Génération…' : 'Télécharger tout en PDF'}
          </button>
        )}
      </div>
      <p className="text-stone-500 text-sm mb-8">Suivez ici le statut de vos séances chez OKIM'ART.</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : receipts.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Aucune séance enregistrée pour l'instant.</div>
      ) : (
        <div className="space-y-4">
          {receipts.map((r) => {
            const stepIndex = STEPS.indexOf(r.statut_livraison);
            return (
              <div key={r.id} className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="font-display text-lg text-navy-dark">{r.type_seance}</p>
                    <p className="text-xs text-stone-400">{r.numero} — {r.site_nom}</p>
                  </div>
                  <button onClick={() => handleViewPdf(r.id)} className="btn btn-outline">Voir le reçu</button>
                </div>

                <button
                  onClick={() => handleDownloadPdf(r)}
                  className="btn btn-gold w-full mb-4"
                >
                  Télécharger la facture (PDF)
                </button>

                <ReceiptQuickShare receipt={r} clientEmail={user.email} clientNom={user.nom} />

                <div className="flex items-center gap-1 mb-4">
                  {STEPS.map((step, i) => (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            i <= stepIndex ? 'bg-gold' : 'bg-stone-200'
                          }`}
                        />
                        <p className={`text-[11px] mt-1.5 text-center ${i <= stepIndex ? 'text-navy-dark font-medium' : 'text-stone-400'}`}>
                          {STEP_LABELS[step]}
                        </p>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 -mt-4 ${i < stepIndex ? 'bg-gold' : 'bg-stone-200'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-stone-100 pt-4">
                  <div className="flex gap-2">
                    <PaymentBadge status={r.statut_paiement} />
                    <StatusBadge status={r.statut_livraison} />
                  </div>
                  <p className="text-stone-500">
                    Payé {fcfa(r.montant_paye)} / {fcfa(r.montant_total)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

function ReceiptQuickShare({ receipt, clientEmail, clientNom }) {
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');

  // Message court joint à l'image de la facture — pas de lien.
  const whatsappMessage = `Voici la facture de ma séance ${receipt.type_seance} chez OKIM'ART (${receipt.site_nom}).`;

  async function handleShareWhatsapp() {
    setSharing(true);
    setMessage('');
    try {
      const blob = await buildReceiptImageBlob({ ...receipt, client_nom: receipt.client_nom || clientNom });
      const file = new File([blob], `facture-okimart-${receipt.numero}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: whatsappMessage, title: `Facture ${receipt.numero}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-okimart-${receipt.numero}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        window.open(buildWhatsappShareUrl(null, whatsappMessage), '_blank');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessage(err.message || 'Impossible de partager la facture.');
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleEmailToSelf() {
    if (!clientEmail) {
      setMessage("Aucun email enregistré sur votre compte. Demandez au studio de l'ajouter.");
      return;
    }
    setSending(true);
    setMessage('');
    try {
      const data = await api.post(`/receipts/${receipt.id}/envoyer-email`, { email: clientEmail });
      setMessage(`Envoyé à ${data.envoye_a}.`);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 mb-4 text-xs">
      <button onClick={handleShareWhatsapp} disabled={sharing} className="text-gold-dark hover:underline disabled:opacity-50">
        {sharing ? 'Préparation…' : 'Partager par WhatsApp'}
      </button>
      <span className="text-stone-300">·</span>
      <button onClick={handleEmailToSelf} disabled={sending} className="text-gold-dark hover:underline disabled:opacity-50">
        {sending ? 'Envoi…' : 'Recevoir par email'}
      </button>
      {message && <span className="text-stone-400">{message}</span>}
    </div>
  );
}