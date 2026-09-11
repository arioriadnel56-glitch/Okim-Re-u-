import React, { useState } from 'react';

/**
 * Modal used from Receipts.jsx and ReceiptDetail.jsx: a secretary (staff) or a super admin
 * requesting a receipt's deletion must justify it. The receipt then moves to the corbeille,
 * pending the super admin's validation within 30 days (see /receipts/:id/demander-suppression).
 */
export default function DeleteReceiptModal({ receipt, onClose, onConfirm }) {
  const [motif, setMotif] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (motif.trim().length < 5) {
      setError('Merci de justifier la suppression (5 caractères minimum).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(motif.trim());
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="font-display text-lg text-navy-dark mb-1">Supprimer le reçu {receipt.numero}</h2>
        <p className="text-sm text-stone-500 mb-4">
          Ce reçu sera déplacé dans la corbeille et devra être validé par le super admin (sous 30 jours) avant
          d'être définitivement supprimé.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Motif de la suppression</label>
            <textarea
              className="input"
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Expliquez pourquoi ce reçu doit être supprimé…"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn btn-danger">
              {loading ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}