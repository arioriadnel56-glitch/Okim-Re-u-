import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';

function fcfa(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export default function Corbeille() {
  const [receipts, setReceipts] = useState([]);
  const [archives, setArchives] = useState([]);
  const [tab, setTab] = useState('en_attente');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.get('/receipts/corbeille'), api.get('/receipts/corbeille/archives')])
      .then(([pending, hist]) => {
        setReceipts(pending.receipts);
        setArchives(hist.archives);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleValider(r) {
    if (!window.confirm(`Supprimer définitivement le reçu ${r.numero} ? Cette action est irréversible.`)) return;
    setBusyId(r.id);
    setError('');
    try {
      await api.post(`/receipts/${r.id}/valider-suppression`, {});
      setNotice(`Le reçu ${r.numero} a été définitivement supprimé.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestaurer(r) {
    setBusyId(r.id);
    setError('');
    try {
      await api.post(`/receipts/${r.id}/restaurer`, {});
      setNotice(`Le reçu ${r.numero} a été restauré.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteArchive(a) {
    if (!window.confirm(`Supprimer définitivement cette entrée de l'historique (reçu ${a.numero}) ?`)) return;
    setBusyId(`archive-${a.id}`);
    setError('');
    try {
      await api.delete(`/receipts/corbeille/archives/${a.id}`);
      setNotice(`L'entrée d'historique du reçu ${a.numero} a été supprimée.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy-dark">Corbeille des reçus</h1>
          <p className="text-stone-500 text-sm mt-1">
            Un reçu supprimé par un membre du personnel doit être justifié, puis validé ici sous 30 jours.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('en_attente')}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            tab === 'en_attente' ? 'bg-navy-dark text-white border-navy-dark' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
          }`}
        >
          En attente ({receipts.length})
        </button>
        <button
          onClick={() => setTab('historique')}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            tab === 'historique' ? 'bg-navy-dark text-white border-navy-dark' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
          }`}
        >
          Historique
        </button>
      </div>

      {notice && <p className="text-emerald-700 text-sm mb-4">{notice}</p>}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : tab === 'en_attente' ? (
        receipts.length === 0 ? (
          <div className="card p-10 text-center text-stone-500">Aucun reçu en attente de validation de suppression.</div>
        ) : (
          <div className="space-y-4">
            {receipts.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium text-navy-dark">
                      {r.numero} — {r.client_nom} <span className="text-stone-400 font-normal">({r.site_nom})</span>
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {r.type_seance} — {fcfa(r.montant_total)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      r.jours_restants <= 5
                        ? 'bg-red-50 text-red-700 border-red-300'
                        : r.jours_restants <= 10
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-stone-100 text-stone-600 border-stone-300'
                    }`}
                  >
                    {r.jours_restants} jour(s) avant suppression automatique
                  </span>
                </div>

                <div className="bg-stone-50 border border-stone-200 rounded-md p-3 mb-3 text-sm">
                  <p className="text-stone-500 text-xs uppercase mb-1">Motif de la suppression</p>
                  <p className="text-stone-700">{r.delete_reason}</p>
                  <p className="text-xs text-stone-400 mt-2">
                    Demandée par {r.demande_par_nom || 'inconnu'} le {new Date(r.delete_requested_at).toLocaleString('fr-FR')}
                    {' '}— limite le {new Date(r.date_limite).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to={`/sessions/${r.session_id}`} className="btn btn-outline text-sm">Voir la séance</Link>
                  <button
                    onClick={() => handleRestaurer(r)}
                    disabled={busyId === r.id}
                    className="btn btn-outline text-sm"
                  >
                    Restaurer
                  </button>
                  <button
                    onClick={() => handleValider(r)}
                    disabled={busyId === r.id}
                    className="btn btn-danger text-sm"
                  >
                    Valider la suppression définitive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : archives.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Aucune suppression définitive pour l'instant.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium">N° Reçu</th>
                <th className="px-4 py-3 font-medium">Motif</th>
                <th className="px-4 py-3 font-medium">Demandé par</th>
                <th className="px-4 py-3 font-medium">Validé par</th>
                <th className="px-4 py-3 font-medium">Supprimé le</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {archives.map((a) => (
                <tr key={a.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-dark">{a.numero}</td>
                  <td className="px-4 py-3 text-stone-600 max-w-xs truncate" title={a.motif}>{a.motif}</td>
                  <td className="px-4 py-3 text-stone-500">{a.demande_par_nom || '—'}</td>
                  <td className="px-4 py-3 text-stone-500">{a.valide_par_nom || '—'}</td>
                  <td className="px-4 py-3 text-stone-500">{new Date(a.valide_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteArchive(a)}
                      disabled={busyId === `archive-${a.id}`}
                      className="text-xs text-red-600 hover:underline"
                      title="Supprimer cette entrée de l'historique"
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
    </Layout>
  );
}
