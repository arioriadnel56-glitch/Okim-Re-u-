import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function PublicVerify() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/verify/${code}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="min-h-screen bg-navy-dark flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/icons/icon-512.png" alt="OKIM'ART" className="w-16 h-16 rounded-full object-cover mb-3" />
          <h1 className="font-display text-lg text-gold">Suivi de livraison</h1>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-xl">
          {loading && <p className="text-stone-400 text-sm text-center">Vérification…</p>}
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          {data && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-xs text-stone-400 uppercase tracking-wide">Reçu</p>
                <p className="font-display text-xl text-navy-dark">{data.numero}</p>
              </div>

              <div className="flex justify-center">
                <StatusBadge status={data.statut_livraison} />
              </div>

              <div className="border-t border-stone-100 pt-4 text-sm space-y-2">
                <Row label="Client" value={data.client_nom} />
                <Row label="Séance" value={data.type_seance} />
                <Row label="Studio" value={`${data.site_nom} — ${data.site_ville}`} />
                <Row label="Éléments" value={`${data.nb_photos} photo(s), ${data.nb_videos} vidéo(s)`} />
                {data.date_pret && <Row label="Prêt depuis" value={new Date(data.date_pret).toLocaleDateString('fr-FR')} />}
                {data.date_livraison && <Row label="Livré le" value={new Date(data.date_livraison).toLocaleDateString('fr-FR')} />}
              </div>

              {data.site_telephone && (
                <p className="text-xs text-stone-400 text-center pt-2 border-t border-stone-100">
                  Une question ? Contactez le studio au {data.site_telephone}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-400">{label}</span>
      <span className="text-navy-dark font-medium text-right">{value}</span>
    </div>
  );
}
