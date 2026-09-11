import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

function formatFcfa(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/stats').then((d) => setStats(d)).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display text-2xl text-navy-dark">
            {user.role === 'super_admin' ? 'Vue d\u2019ensemble — tous les studios' : `Tableau de bord`}
          </h1>
          <p className="text-stone-500 text-sm mt-1">Bienvenue, {user.nom}.</p>
        </div>
        <Link to="/sessions/nouvelle" className="btn btn-gold">Nouvelle séance</Link>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Reçus" value={stats.totals.total_recus} />
            <StatCard label="Chiffre d'affaires" value={formatFcfa(stats.totals.chiffre_affaires_total)} small />
            <StatCard label="Encaissé" value={formatFcfa(stats.totals.total_encaisse)} small />
            <StatCard label="Reste à payer" value={formatFcfa(stats.totals.total_reste_a_payer)} small accent />
          </div>

          <div className="card p-6 mb-8">
            <h2 className="font-display text-lg text-navy-dark mb-4">État des livraisons</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DeliveryStat label="En attente" value={stats.totals.en_attente} />
              <DeliveryStat label="En traitement" value={stats.totals.en_traitement} />
              <DeliveryStat label="Prêt" value={stats.totals.pret} />
              <DeliveryStat label="Livré" value={stats.totals.livre} />
            </div>
          </div>

          {stats.par_site && (
            <div className="card p-6 overflow-x-auto">
              <h2 className="font-display text-lg text-navy-dark mb-4">Par succursale</h2>
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-stone-200">
                    <th className="pb-2 font-medium">Studio</th>
                    <th className="pb-2 font-medium">Ville</th>
                    <th className="pb-2 font-medium text-right">Reçus</th>
                    <th className="pb-2 font-medium text-right">Chiffre d'affaires</th>
                    <th className="pb-2 font-medium text-right">Livraisons en cours</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.par_site.map((s) => (
                    <tr key={s.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2.5">{s.nom}</td>
                      <td className="py-2.5 text-stone-500">{s.ville}</td>
                      <td className="py-2.5 text-right">{s.total_recus}</td>
                      <td className="py-2.5 text-right">{formatFcfa(s.chiffre_affaires_total)}</td>
                      <td className="py-2.5 text-right">{s.livraisons_en_cours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

function StatCard({ label, value, small, accent }) {
  return (
    <div className="card p-5">
      <p className="text-stone-500 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-display ${small ? 'text-lg' : 'text-2xl'} ${accent ? 'text-gold-dark' : 'text-navy-dark'}`}>
        {value}
      </p>
    </div>
  );
}

function DeliveryStat({ label, value }) {
  return (
    <div className="text-center py-3 rounded-md bg-stone-50">
      <p className="text-2xl font-display text-navy-dark">{value || 0}</p>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  );
}
