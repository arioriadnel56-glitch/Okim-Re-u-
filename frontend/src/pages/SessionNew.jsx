import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';

export default function SessionNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({
    site_id: '',
    type_seance: '',
    date_seance: '',
    description: '',
    montant_total: '',
    client_nom: '',
    client_telephone: '',
    client_email: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (user.role === 'super_admin') {
      api.get('/sites').then((d) => setSites(d.sites));
    }
  }, [user.role]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        site_id: user.role === 'super_admin' ? Number(form.site_id) : undefined,
        type_seance: form.type_seance,
        date_seance: form.date_seance,
        description: form.description || undefined,
        montant_total: Number(form.montant_total) || 0,
        client: {
          nom: form.client_nom,
          telephone: form.client_telephone,
          email: form.client_email || undefined,
        },
      };
      const data = await api.post('/sessions', payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto card p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-xl">
            ✓
          </div>
          <h1 className="font-display text-xl text-navy-dark mb-2">Séance créée</h1>
          <p className="text-stone-500 text-sm mb-6">
            La séance pour <strong>{result.client.nom}</strong> a été enregistrée.
          </p>
          {result.mot_de_passe_temporaire_client && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-left mb-6">
              <p className="text-sm text-amber-800 font-medium mb-1">Nouveau compte client créé</p>
              <p className="text-sm text-amber-700">
                Téléphone : <strong>{result.client.telephone}</strong><br />
                Mot de passe temporaire : <strong>{result.mot_de_passe_temporaire_client}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Communiquez ces identifiants au client pour qu'il puisse suivre sa livraison.
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button className="btn btn-outline" onClick={() => { setResult(null); setForm({ ...form, client_nom: '', client_telephone: '', client_email: '', description: '' }); }}>
              Créer une autre séance
            </button>
            <button className="btn btn-gold" onClick={() => navigate(`/sessions/${result.session.id}`)}>
              Ouvrir la séance
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="font-display text-2xl text-navy-dark mb-6">Nouvelle séance</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl card p-6 space-y-6">
        {user.role === 'super_admin' && (
          <div>
            <label className="label">Succursale</label>
            <select className="input" value={form.site_id} onChange={(e) => update('site_id', e.target.value)} required>
              <option value="">Sélectionner un studio</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.nom} — {s.ville}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Type de séance</label>
            <input className="input" value={form.type_seance} onChange={(e) => update('type_seance', e.target.value)}
              placeholder="Portrait, mariage, formation…" required />
          </div>
          <div>
            <label className="label">Date de la séance</label>
            <input className="input" type="date" value={form.date_seance} onChange={(e) => update('date_seance', e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="label">Description (optionnel)</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>

        <div>
          <label className="label">Montant total (FCFA)</label>
          <input className="input" type="number" min="0" value={form.montant_total} onChange={(e) => update('montant_total', e.target.value)} required />
        </div>

        <div className="border-t border-stone-200 pt-6">
          <p className="text-sm font-medium text-navy-dark mb-4">Informations client</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom complet</label>
              <input className="input" value={form.client_nom} onChange={(e) => update('client_nom', e.target.value)} required />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" type="tel" value={form.client_telephone} onChange={(e) => update('client_telephone', e.target.value)} required />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Email (optionnel)</label>
            <input className="input" type="email" value={form.client_email} onChange={(e) => update('client_email', e.target.value)} />
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Si ce numéro n'a pas encore de compte, il sera créé automatiquement avec un mot de passe temporaire.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-gold">
          {loading ? 'Enregistrement…' : 'Créer la séance'}
        </button>
      </form>
    </Layout>
  );
}
