import { Router } from 'express';
import { dbGet, dbAll } from '../db.js';
import { requireAuth, requireRole, hashPassword, scopeSiteId } from '../auth.js';
import { generateTempPassword } from '../utils/codes.js';

const router = Router();

async function findOrCreateClient({ nom, telephone, email }) {
  const existing = await dbGet('SELECT * FROM users WHERE telephone = $1', [telephone.trim()]);
  if (existing) {
    if (existing.role !== 'client') {
      throw Object.assign(new Error('Ce numéro appartient déjà à un compte personnel/admin.'), { status: 409 });
    }
    return { client: existing, motDePasseTemporaire: null };
  }
  const tempPassword = generateTempPassword();
  const client = await dbGet(
    `INSERT INTO users (role, site_id, nom, telephone, email, password_hash, doit_changer_mdp)
     VALUES ('client', NULL, $1, $2, $3, $4, TRUE) RETURNING *`,
    [nom.trim(), telephone.trim(), email || null, hashPassword(tempPassword)]
  );
  return { client, motDePasseTemporaire: tempPassword };
}

router.post('/', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const siteId = scopeSiteId(req);
    if (!siteId) return res.status(400).json({ error: 'site_id est requis.' });

    const { type_seance, date_seance, description, montant_total, client } = req.body;
    if (!type_seance || !date_seance || !client?.nom || !client?.telephone) {
      return res.status(400).json({ error: 'Type de séance, date, et nom/téléphone du client sont requis.' });
    }

    let clientRow, motDePasseTemporaire;
    try {
      ({ client: clientRow, motDePasseTemporaire } = await findOrCreateClient(client));
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const session = await dbGet(
      `INSERT INTO sessions_photo (site_id, client_id, staff_id, type_seance, date_seance, description, montant_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [siteId, clientRow.id, req.user.id, type_seance.trim(), date_seance, description || null, Number(montant_total) || 0]
    );

    res.status(201).json({
      session,
      client: { id: clientRow.id, nom: clientRow.nom, telephone: clientRow.telephone },
      mot_de_passe_temporaire_client: motDePasseTemporaire,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const siteId = scopeSiteId(req);
    let rows;
    if (siteId) {
      rows = await dbAll(
        `SELECT sp.*, u.nom as client_nom, u.telephone as client_telephone, st.nom as staff_nom, s.nom as site_nom
         FROM sessions_photo sp
         JOIN users u ON u.id = sp.client_id
         JOIN users st ON st.id = sp.staff_id
         JOIN sites s ON s.id = sp.site_id
         WHERE sp.site_id = $1 ORDER BY sp.created_at DESC`,
        [siteId]
      );
    } else {
      rows = await dbAll(
        `SELECT sp.*, u.nom as client_nom, u.telephone as client_telephone, st.nom as staff_nom, s.nom as site_nom
         FROM sessions_photo sp
         JOIN users u ON u.id = sp.client_id
         JOIN users st ON st.id = sp.staff_id
         JOIN sites s ON s.id = sp.site_id
         ORDER BY sp.created_at DESC`
      );
    }
    res.json({ sessions: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const session = await dbGet(
      `SELECT sp.*, u.nom as client_nom, u.telephone as client_telephone, u.email as client_email, s.nom as site_nom
       FROM sessions_photo sp
       JOIN users u ON u.id = sp.client_id
       JOIN sites s ON s.id = sp.site_id
       WHERE sp.id = $1`,
      [req.params.id]
    );
    if (!session) return res.status(404).json({ error: 'Séance introuvable.' });
    if (req.user.role === 'staff' && session.site_id !== req.user.site_id) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    res.json({ session });
  } catch (e) {
    next(e);
  }
});

export default router;
