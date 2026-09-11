import { Router } from 'express';
import { dbGet, dbAll } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {
      const sites = await dbAll('SELECT * FROM sites ORDER BY nom');
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

export default router;
