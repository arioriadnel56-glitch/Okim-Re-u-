import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get('/sites').then((d) => setSites(d.sites)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function toggleActif(site) {
    try {
      await api.put(`/sites/${site.id}`, { actif: !site.actif });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl text-navy-dark">Succursales</h1>
        <button className="btn btn-gold" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Annuler' : 'Nouvelle succursale'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {showForm && <SiteForm onCreated={() => { setShowForm(false); load(); }} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sites.map((s) => (
          <div key={s.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg text-navy-dark">{s.nom}</p>
                <p className="text-sm text-stone-500">{s.ville}</p>
              </div>
              <span className={`badge ${s.actif ? 'badge-livre' : 'badge-attente'}`}>
                {s.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
            {s.adresse && <p className="text-sm text-stone-500 mt-3">{s.adresse}</p>}
            {s.telephone && <p className="text-sm text-stone-500">{s.telephone}</p>}
            <button onClick={() => toggleActif(s)} className="text-xs text-gold-dark hover:underline mt-4">
              {s.actif ? 'Désactiver' : 'Réactiver'}
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}

function SiteForm({ onCreated }) {
  const [form, setForm] = useState({ nom: '', ville: '', adresse: '', telephone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/sites', form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-4 max-w-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Nom du studio</label>
          <input className="input" value={form.nom} onChange={(e) => update('nom', e.target.value)} required placeholder="OKIM'ART — Cotonou" />
        </div>
        <div>
          <label className="label">Ville</label>
          <input className="input" value={form.ville} onChange={(e) => update('ville', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">Adresse (optionnel)</label>
        <input className="input" value={form.adresse} onChange={(e) => update('adresse', e.target.value)} />
      </div>
      <div>
        <label className="label">Téléphone (optionnel)</label>
        <input className="input" value={form.telephone} onChange={(e) => update('telephone', e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-gold">
        {loading ? 'Création…' : 'Créer la succursale'}
      </button>
    </form>
  );
}
