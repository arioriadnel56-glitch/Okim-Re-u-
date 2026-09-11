import { Router } from 'express';
import { dbGet, dbAll } from '../db.js';
import { requireAuth, requireRole, scopeSiteId } from '../auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const siteId = scopeSiteId(req);
    const where = siteId ? 'WHERE site_id = $1' : '';
    const params = siteId ? [siteId] : [];

    const totals = await dbGet(
      `SELECT
         COUNT(*)::int as total_recus,
         COALESCE(SUM(montant_total), 0) as chiffre_affaires_total,
         COALESCE(SUM(montant_paye), 0) as total_encaisse,
         COALESCE(SUM(montant_total - montant_paye), 0) as total_reste_a_payer,
         SUM(CASE WHEN statut_livraison = 'en_attente' THEN 1 ELSE 0 END)::int as en_attente,
         SUM(CASE WHEN statut_livraison = 'en_traitement' THEN 1 ELSE 0 END)::int as en_traitement,
         SUM(CASE WHEN statut_livraison = 'pret' THEN 1 ELSE 0 END)::int as pret,
         SUM(CASE WHEN statut_livraison = 'livre' THEN 1 ELSE 0 END)::int as livre
       FROM receipts ${where}`,
      params
    );

    let parSite = null;
    if (!siteId) {
      parSite = await dbAll(
        `SELECT s.id, s.nom, s.ville,
                COUNT(r.id)::int as total_recus,
                COALESCE(SUM(r.montant_total), 0) as chiffre_affaires_total,
                SUM(CASE WHEN r.statut_livraison != 'livre' THEN 1 ELSE 0 END)::int as livraisons_en_cours
         FROM sites s LEFT JOIN receipts r ON r.site_id = s.id
         GROUP BY s.id ORDER BY s.nom`
      );
    }

    res.json({ totals, par_site: parSite });
  } catch (e) {
    next(e);
  }
});

export default router;
