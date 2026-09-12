import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {
      const sites = await dbAll(
        `SELECT s.*, (SELECT COUNT(*) FROM receipts r WHERE r.site_id = s.id)::int AS receipts_count
         FROM sites s ORDER BY s.nom`
      );
      return res.json({ sites });
    }
    if (req.user.role === 'staff') {
      const site = await dbGet('SELECT * FROM sites WHERE id = $1', [req.user.site_id]);
      return res.json({ sites: site ? [site] : [] });
    }
    return res.status(403).json({ error: 'Accès refusé.' });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { nom, ville, adresse, telephone } = req.body;
    if (!nom || !ville) return res.status(400).json({ error: 'Le nom et la ville du site sont requis.' });
    const site = await dbGet(
      'INSERT INTO sites (nom, ville, adresse, telephone) VALUES ($1, $2, $3, $4) RETURNING *',
      [nom.trim(), ville.trim(), adresse || null, telephone || null]
    );
    res.status(201).json({ site });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { nom, ville, adresse, telephone, actif } = req.body;
    const existing = await dbGet('SELECT * FROM sites WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Site introuvable.' });
    const site = await dbGet(
      'UPDATE sites SET nom = $1, ville = $2, adresse = $3, telephone = $4, actif = $5 WHERE id = $6 RETURNING *',
      [
        nom ?? existing.nom,
        ville ?? existing.ville,
        adresse ?? existing.adresse,
        telephone ?? existing.telephone,
        actif === undefined ? existing.actif : !!actif,
        req.params.id,
      ]
    );
    res.json({ site });
  } catch (e) {
    next(e);
  }
});

// Bouton « Supprimer » côté super admin. Le studio ne peut être supprimé que s'il n'a
// aucun historique (séances/reçus) — la base refuse sinon la suppression (clé étrangère),
// ce qui protège l'historique des reçus : on transforme alors l'erreur en message clair et
// on suggère de désactiver le studio plutôt que de le supprimer.
router.delete('/:id', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM sites WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Studio introuvable.' });

    await dbRun('DELETE FROM sites WHERE id = $1', [req.params.id]);
    res.json({ ok: true, message: 'Le studio a été supprimé.' });
  } catch (e) {
    if (e.code === '23503') {
      return res.status(409).json({
        error:
          "Impossible de supprimer ce studio : il possède un historique de séances/reçus. " +
          'Désactivez-le plutôt pour conserver cet historique.',
      });
    }
    next(e);
  }
});

export default router;
