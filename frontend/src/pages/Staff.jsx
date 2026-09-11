import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Layout from '../components/Layout.jsx';

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [sites, setSites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [newAccount, setNewAccount] = useState(null);

  function load() {
    api.get('/staff').then((d) => setStaff(d.staff)).catch((e) => setError(e.message));
    api.get('/sites').then((d) => setSites(d.sites));
  }
  useEffect(load, []);

  async function handleResetPassword(member) {
    if (!window.confirm(`Réinitialiser le mot de passe de ${member.nom} ?`)) return;
    try {
      const { mot_de_passe_temporaire } = await api.post(`/staff/${member.id}/reset-password`, {});
      alert(`Nouveau mot de passe temporaire pour ${member.nom} : ${mot_de_passe_temporaire}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActif(member) {
    try {
      await api.put(`/staff/${member.id}`, { actif: !member.actif });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-2xl text-navy-dark">Personnel</h1>
        <button className="btn btn-gold" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Annuler' : 'Ajouter un membre'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {newAccount && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
          <p className="text-sm text-amber-800 font-medium mb-1">Compte créé pour {newAccount.nom}</p>
          <p className="text-sm text-amber-700">
            Téléphone : <strong>{newAccount.telephone}</strong><br />
            Mot de passe temporaire : <strong>{newAccount.mot_de_passe_temporaire}</strong>
          </p>
        </div>
      )}

      {showForm && (
        <StaffForm sites={sites} onCreated={(data) => { setShowForm(false); setNewAccount({ ...data.staff, mot_de_passe_temporaire: data.mot_de_passe_temporaire }); load(); }} />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200 bg-stone-50">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Téléphone</th>
              <th className="px-4 py-3 font-medium">Studio</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3 font-medium text-navy-dark">{s.nom}</td>
                <td className="px-4 py-3">{s.telephone}</td>
                <td className="px-4 py-3 text-stone-500">{s.site_nom}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.actif ? 'badge-livre' : 'badge-attente'}`}>{s.actif ? 'Actif' : 'Inactif'}</span>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button onClick={() => handleResetPassword(s)} className="text-xs text-gold-dark hover:underline">
                    Réinitialiser mdp
                  </button>
                  <button onClick={() => toggleActif(s)} className="text-xs text-stone-500 hover:underline">
                    {s.actif ? 'Désactiver' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

function StaffForm({ sites, onCreated }) {
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', site_id: '' });
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
      const data = await api.post('/staff', { ...form, site_id: Number(form.site_id) });
      onCreated(data);
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
          <label className="label">Nom complet</label>
          <input className="input" value={form.nom} onChange={(e) => update('nom', e.target.value)} required />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" type="tel" value={form.telephone} onChange={(e) => update('telephone', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Email (optionnel)</label>
          <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Succursale</label>
          <select className="input" value={form.site_id} onChange={(e) => update('site_id', e.target.value)} required>
            <option value="">Sélectionner</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-gold">
        {loading ? 'Création…' : 'Créer le compte'}
      </button>
    </form>
  );
}
