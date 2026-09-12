import { Router } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAuth, requireRole, hashPassword } from '../auth.js';
import { generateTempPassword } from '../utils/codes.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    let rows;
    if (req.user.role === 'super_admin') {
      rows = await dbAll(
        `SELECT u.id, u.nom, u.telephone, u.email, u.site_id, u.actif, u.created_at, s.nom as site_nom,
                (SELECT COUNT(*) FROM receipts r WHERE r.created_by = u.id)::int AS receipts_count
         FROM users u LEFT JOIN sites s ON s.id = u.site_id
         WHERE u.role = 'staff' ORDER BY u.created_at DESC`
      );
    } else if (req.user.role === 'staff') {
      rows = await dbAll(
        `SELECT u.id, u.nom, u.telephone, u.email, u.site_id, u.actif, u.created_at, s.nom as site_nom
         FROM users u LEFT JOIN sites s ON s.id = u.site_id
         WHERE u.role = 'staff' AND u.site_id = $1 ORDER BY u.created_at DESC`,
        [req.user.site_id]
      );
    } else {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    res.json({ staff: rows });
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { nom, telephone, email, site_id } = req.body;
    if (!nom || !telephone || !site_id) {
      return res.status(400).json({ error: 'Nom, téléphone et site sont requis.' });
    }
    const existing = await dbGet('SELECT id FROM users WHERE telephone = $1', [telephone.trim()]);
    if (existing) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé.' });

    const tempPassword = generateTempPassword();
    const inserted = await dbGet(
      `INSERT INTO users (role, site_id, nom, telephone, email, password_hash, doit_changer_mdp)
       VALUES ('staff', $1, $2, $3, $4, $5, TRUE) RETURNING id, nom, telephone, email, site_id`,
      [site_id, nom.trim(), telephone.trim(), email || null, hashPassword(tempPassword)]
    );

    res.status(201).json({ staff: inserted, mot_de_passe_temporaire: tempPassword });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const existing = await dbGet("SELECT * FROM users WHERE id = $1 AND role = 'staff'", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Membre du personnel introuvable.' });
    const { nom, email, site_id, actif } = req.body;
    await dbRun('UPDATE users SET nom = $1, email = $2, site_id = $3, actif = $4 WHERE id = $5', [
      nom ?? existing.nom,
      email ?? existing.email,
      site_id ?? existing.site_id,
      actif === undefined ? existing.actif : !!actif,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reset-password', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const existing = await dbGet("SELECT * FROM users WHERE id = $1 AND role = 'staff'", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Membre du personnel introuvable.' });
    const tempPassword = generateTempPassword();
    await dbRun('UPDATE users SET password_hash = $1, doit_changer_mdp = TRUE WHERE id = $2', [
      hashPassword(tempPassword),
      req.params.id,
    ]);
    res.json({ mot_de_passe_temporaire: tempPassword });
  } catch (e) {
    next(e);
  }
});

// Bouton « Supprimer » côté super admin, sur la section Personnel (comptes secrétaires).
// Comme pour les studios, le compte ne peut être supprimé que s'il n'a laissé aucune trace
// (reçus créés, paiements encaissés, séances) — la base protège cet historique via ses clés
// étrangères ; on transforme l'erreur en message clair suggérant de désactiver le compte.
router.delete('/:id', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const existing = await dbGet("SELECT * FROM users WHERE id = $1 AND role = 'staff'", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Membre du personnel introuvable.' });

    await dbRun('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true, message: 'Le compte a été supprimé.' });
  } catch (e) {
    if (e.code === '23503') {
      return res.status(409).json({
        error:
          'Impossible de supprimer ce compte : il possède un historique de reçus/séances. ' +
          'Désactivez-le plutôt pour conserver cet historique.',
      });
    }
    next(e);
  }
});

export default router;

    
