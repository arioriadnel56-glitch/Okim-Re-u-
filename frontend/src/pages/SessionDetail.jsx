import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Layout from '../components/Layout.jsx';
import StatusBadge, { PaymentBadge } from '../components/StatusBadge.jsx';

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    api.get(`/sessions/${id}`).then((d) => setSession(d.session)).catch((e) => setError(e.message));
    api.get('/receipts').then((d) => setReceipts(d.receipts.filter((r) => r.session_id === Number(id))));
  }

  useEffect(load, [id]);

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement la séance « ${session.type_seance} » de ${session.client_nom} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/sessions/${id}`);
      navigate('/sessions');
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  return (
    <Layout>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {session && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="font-display text-2xl text-navy-dark">{session.type_seance}</h1>
              <p className="text-stone-500 text-sm mt-1">
                {session.client_nom} — {new Date(session.date_seance).toLocaleDateString('fr-FR')} — {session.site_nom}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {user?.role === 'super_admin' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn btn-outline text-red-600 hover:bg-red-50"
                  title="Supprimer définitivement (impossible si un reçu y est rattaché)"
                >
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </button>
              )}
              <Link to="/sessions" className="text-sm text-stone-500 hover:text-navy-dark">← Toutes les séances</Link>
            </div>
          </div>

          <div className="card p-6 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-stone-400 text-xs uppercase mb-1">Client</p>
              <p className="text-navy-dark font-medium">{session.client_nom}</p>
              <p className="text-stone-500">{session.client_telephone}</p>
              {session.client_email && <p className="text-stone-500">{session.client_email}</p>}
            </div>
            <div>
              <p className="text-stone-400 text-xs uppercase mb-1">Montant convenu</p>
              <p className="text-navy-dark font-medium">{Number(session.montant_total).toLocaleString('fr-FR')} FCFA</p>
              {session.description && <p className="text-stone-500 mt-2">{session.description}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-lg text-navy-dark">Reçus liés</h2>
            <button className="btn btn-gold" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Annuler' : 'Créer un reçu'}
            </button>
          </div>

          {showForm && (
            <ReceiptForm
              session={session}
              onCreated={() => { setShowForm(false); load(); }}
            />
          )}

          {receipts.length === 0 ? (
            <div className="card p-8 text-center text-stone-500 text-sm">Aucun reçu créé pour cette séance.</div>
          ) : (
            <div className="space-y-3">
              {receipts.map((r) => (
                <Link key={r.id} to={`/receipts/${r.id}`} className="card p-4 flex flex-wrap items-center justify-between gap-2 hover:border-gold transition-colors">
                  <div>
                    <p className="font-medium text-navy-dark">{r.numero}</p>
                    <p className="text-xs text-stone-400">
                      {Number(r.montant_paye).toLocaleString('fr-FR')} / {Number(r.montant_total).toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <PaymentBadge status={r.statut_paiement} />
                    <StatusBadge status={r.statut_livraison} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

function ReceiptForm({ session, onCreated }) {
  const [form, setForm] = useState({
    montant_total: session.montant_total || 0,
    montant_paye: 0,
    mode_paiement: 'especes',
    methode_livraison: 'retrait_studio',
    nb_photos: 0,
    nb_videos: 0,
    lien_telechargement: '',
    note: '',
  });
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
      await api.post('/receipts', {
        session_id: session.id,
        montant_total: Number(form.montant_total),
        montant_paye: Number(form.montant_paye),
        mode_paiement: form.mode_paiement,
        methode_livraison: form.methode_livraison,
        nb_photos: Number(form.nb_photos),
        nb_videos: Number(form.nb_videos),
        lien_telechargement: form.lien_telechargement || undefined,
        note: form.note || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Montant total (FCFA)</label>
          <input className="input" type="number" min="0" value={form.montant_total} onChange={(e) => update('montant_total', e.target.value)} required />
        </div>
        <div>
          <label className="label">Montant payé maintenant (FCFA)</label>
          <input className="input" type="number" min="0" value={form.montant_paye} onChange={(e) => update('montant_paye', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Mode de paiement</label>
          <select className="input" value={form.mode_paiement} onChange={(e) => update('mode_paiement', e.target.value)}>
            <option value="especes">Espèces</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="moov_money">Moov Money</option>
            <option value="virement">Virement</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="label">Méthode de livraison</label>
          <select className="input" value={form.methode_livraison} onChange={(e) => update('methode_livraison', e.target.value)}>
            <option value="retrait_studio">Retrait en studio</option>
            <option value="lien_telechargement">Lien de téléchargement</option>
            <option value="livraison_physique">Livraison physique</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Nombre de photos</label>
          <input className="input" type="number" min="0" value={form.nb_photos} onChange={(e) => update('nb_photos', e.target.value)} />
        </div>
        <div>
          <label className="label">Nombre de vidéos</label>
          <input className="input" type="number" min="0" value={form.nb_videos} onChange={(e) => update('nb_videos', e.target.value)} />
        </div>
      </div>
      {form.methode_livraison === 'lien_telechargement' && (
        <div>
          <label className="label">Lien de téléchargement</label>
          <input className="input" value={form.lien_telechargement} onChange={(e) => update('lien_telechargement', e.target.value)} placeholder="https://…" />
        </div>
      )}
      <div>
        <label className="label">Note (optionnel)</label>
        <input className="input" value={form.note} onChange={(e) => update('note', e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-gold">
        {loading ? 'Création…' : 'Créer le reçu'}
      </button>
    </form>
  );
}
