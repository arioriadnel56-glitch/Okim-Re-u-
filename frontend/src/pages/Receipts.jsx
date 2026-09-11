import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fetchExportPdfBlob } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';
import StatusBadge, { PaymentBadge } from '../components/StatusBadge.jsx';
import DeleteReceiptModal from '../components/DeleteReceiptModal.jsx';
import { TrashIcon } from '../components/icons.jsx';

const FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_traitement', label: 'En traitement' },
  { value: 'pret', label: 'Prêt' },
  { value: 'livre', label: 'Livré' },
];

export default function Receipts() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState('');

  function load() {
    setLoading(true);
    api.get('/receipts', { statut_livraison: statut || undefined })
      .then((d) => setReceipts(d.receipts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [statut]);

  async function handleExportAll() {
    setExporting(true);
    setExportError('');
    try {
      const blob = await fetchExportPdfBlob({ statut_livraison: statut || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recus-okimart-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleConfirmDelete(motif) {
    await api.post(`/receipts/${deleteTarget.id}/demander-suppression`, { motif });
    setNotice(`Le reçu ${deleteTarget.numero} a été envoyé dans la corbeille, en attente de validation.`);
    setDeleteTarget(null);
    load();
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl text-navy-dark">Reçus</h1>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'super_admin' && (
            <Link to="/corbeille" className="btn btn-outline">
              <TrashIcon width={16} height={16} /> Corbeille
            </Link>
          )}
          <button onClick={handleExportAll} disabled={exporting || receipts.length === 0} className="btn btn-outline">
            {exporting ? 'Génération…' : 'Télécharger tout en PDF'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatut(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              statut === f.value ? 'bg-navy-dark text-white border-navy-dark' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {notice && <p className="text-emerald-700 text-sm mb-4">{notice}</p>}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {exportError && <p className="text-red-600 text-sm mb-4">{exportError}</p>}
      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : receipts.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Aucun reçu pour ce filtre.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium">N° Reçu</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Studio</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 font-medium">Livraison</th>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-navy-dark">{r.numero}</td>
                  <td className="px-4 py-3">{r.client_nom}</td>
                  <td className="px-4 py-3 text-stone-500">{r.site_nom}</td>
                  <td className="px-4 py-3"><PaymentBadge status={r.statut_paiement} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.statut_livraison} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/receipts/${r.id}`} className="text-gold-dark hover:underline text-sm">Ouvrir</Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="text-red-600 hover:underline text-sm"
                      title="Demander la suppression de ce reçu"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteReceiptModal
          receipt={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </Layout>
  );
}