import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (nouveau !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (nouveau.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        ancien_mot_de_passe: ancien || undefined,
        nouveau_mot_de_passe: nouveau,
      });
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-dark px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/icons/icon-512.png" alt="OKIM'ART" className="w-16 h-16 rounded-full object-cover mb-4" />
          <h1 className="font-display text-xl text-gold">Nouveau mot de passe</h1>
          <p className="text-white/50 text-sm text-center mt-1">
            {user?.doit_changer_mdp
              ? 'Choisissez un mot de passe personnel pour continuer.'
              : 'Modifiez votre mot de passe.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 space-y-4 shadow-xl">
          {!user?.doit_changer_mdp && (
            <div>
              <label className="label">Mot de passe actuel</label>
              <input className="input" type="password" value={ancien} onChange={(e) => setAncien(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input className="input" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirmer le mot de passe</label>
            <input className="input" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-gold w-full">
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
