import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';
import StatusBadge, { PaymentBadge } from '../components/StatusBadge.jsx';

const FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_traitement', label: 'En traitement' },
  { value: 'pret', label: 'Prêt' },
  { value: 'livre', label: 'Livré' },
];

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);
  const [statut, setStatut] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/receipts', { statut_livraison: statut || undefined })
      .then((d) => setReceipts(d.receipts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statut]);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-navy-dark">Reçus</h1>
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

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : receipts.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Aucun reçu pour ce filtre.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium">N° Reçu</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Studio</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 font-medium">Livraison</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
