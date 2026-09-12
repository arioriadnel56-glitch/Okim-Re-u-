import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fetchSessionsExportPdfBlob } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

export default function Sessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get('/sessions')
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleExportSessions() {
    setExporting(true);
    setExportError('');
    try {
      const blob = await fetchSessionsExportPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seances-okimart-${new Date().toISOString().slice(0, 10)}.pdf`;
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

  async function handleDelete(session) {
    if (!window.confirm(`Supprimer définitivement la séance « ${session.type_seance} » de ${session.client_nom} ? Cette action est irréversible.`)) return;
    setBusyId(session.id);
    setError('');
    setNotice('');
    try {
      await api.delete(`/sessions/${session.id}`);
      setNotice('La séance a été supprimée.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="font-display text-2xl text-navy-dark">Séances</h1>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'super_admin' && (
            <button onClick={handleExportSessions} disabled={exporting} className="btn btn-outline">
              {exporting ? 'Génération…' : 'Télécharger la liste des séances (PDF)'}
            </button>
          )}
          <Link to="/sessions/nouvelle" className="btn btn-gold">Nouvelle séance</Link>
        </div>
      </div>

      {notice && <p className="text-emerald-700 text-sm mb-4">{notice}</p>}
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {exportError && <p className="text-red-600 text-sm mb-4">{exportError}</p>}
      {loading ? (
        <p className="text-stone-400 text-sm">Chargement…</p>
      ) : sessions.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          Aucune séance enregistrée pour l'instant.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Studio</th>
                <th className="px-4 py-3 font-medium text-right">Montant</th>
                <th className="px-4 py-3 font-medium"></th>
                {user?.role === 'super_admin' && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-dark">{s.client_nom}</p>
                    <p className="text-xs text-stone-400">{s.client_telephone}</p>
                  </td>
                  <td className="px-4 py-3">{s.type_seance}</td>
                  <td className="px-4 py-3">{new Date(s.date_seance).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-stone-500">{s.site_nom}</td>
                  <td className="px-4 py-3 text-right">{Number(s.montant_total).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/sessions/${s.id}`} className="text-gold-dark hover:underline text-sm">
                      Ouvrir
                    </Link>
                  </td>
                  {user?.role === 'super_admin' && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={busyId === s.id}
                        className="text-red-600 hover:underline text-sm"
                        title="Supprimer définitivement (impossible si un reçu y est rattaché)"
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
