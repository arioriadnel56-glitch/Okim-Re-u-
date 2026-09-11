import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(telephone.trim(), password);
      const dest = location.state?.from?.pathname;
      if (user.doit_changer_mdp) navigate('/changer-mot-de-passe', { replace: true });
      else navigate(dest && dest !== '/connexion' ? dest : '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-dark px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/icons/icon-512.png" alt="OKIM'ART" className="w-20 h-20 rounded-full object-cover mb-4" />
          <h1 className="font-display text-2xl text-gold">OKIM'ART</h1>
          <p className="text-white/50 text-sm">Gestion des reçus &amp; livraisons</p>
        </div>
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
          <div>
            <label className="label">Mot de passe</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-gold w-full">
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
          <p className="text-center">
            <Link to="/mot-de-passe-oublie" className="text-sm text-gold-dark hover:underline">
              Mot de passe oublié ?
            </Link>
          </p>
        </form>
        <p className="text-center text-white/40 text-xs mt-6">
          Un problème de connexion ? Contactez l'administrateur de votre studio.
        </p>
      </div>
    </div>
  );
}
