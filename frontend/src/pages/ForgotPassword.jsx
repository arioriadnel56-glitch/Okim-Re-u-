import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

export default function ForgotPassword() {
  const [telephone, setTelephone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await api.post('/auth/mot-de-passe-oublie', { telephone: telephone.trim() });
      setSuccess(`Un nouveau mot de passe temporaire a été envoyé à ${data.envoye_a}. Utilisez-le pour vous reconnecter — il vous sera demandé d'en choisir un nouveau.`);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-dark px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/icons/icon-512.png" alt="OKIM'ART" className="w-16 h-16 rounded-full object-cover mb-4" />
          <h1 className="font-display text-2xl text-gold">Mot de passe oublié</h1>
          <p className="text-white/50 text-sm text-center mt-1">
            Entrez votre numéro de téléphone : un nouveau mot de passe temporaire sera envoyé à l'email enregistré sur votre compte.
          </p>
        </div>

        {success ? (
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <p className="text-sm text-emerald-700">{success}</p>
            <Link to="/connexion" className="btn btn-gold w-full mt-4 inline-flex">Retour à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 space-y-4 shadow-xl">
            <div>
              <label className="label">Numéro de téléphone</label>
              <input
                className="input"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="01 XX XX XX XX"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-gold w-full">
              {loading ? 'Envoi…' : 'Recevoir un nouveau mot de passe'}
            </button>
            <p className="text-center">
              <Link to="/connexion" className="text-sm text-stone-500 hover:underline">← Retour à la connexion</Link>
            </p>
          </form>
        )}

        <p className="text-center text-white/40 text-xs mt-6">
          Aucune adresse email enregistrée ? Contactez l'administrateur de votre studio.
        </p>
      </div>
    </div>
  );
}
