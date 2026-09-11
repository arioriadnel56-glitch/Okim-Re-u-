import { Router } from 'express';
import { dbGet, dbAll, dbRun, pool } from '../db.js';
import { requireAuth, requireRole, scopeSiteId } from '../auth.js';
import { generateNumeroRecu, generateCodeVerification } from '../utils/codes.js';
import { buildReceiptPdf } from '../utils/pdf.js';
import { sendReceiptEmail } from '../utils/mailer.js';

const router = Router();

const STATUTS_LIVRAISON = ['en_attente', 'en_traitement', 'pret', 'livre'];

async function getReceiptFull(id) {
  return dbGet(
    `SELECT r.*, s.nom as site_nom, s.ville as site_ville, s.telephone as site_telephone,
            u.nom as client_nom, u.telephone as client_telephone, u.email as client_email,
            sp.type_seance, sp.date_seance, sp.description as session_description
     FROM receipts r
     JOIN sites s ON s.id = r.site_id
     JOIN users u ON u.id = r.client_id
     JOIN sessions_photo sp ON sp.id = r.session_id
     WHERE r.id = $1`,
    [id]
  );
}

function assertReceiptAccess(req, receipt, res) {
  if (req.user.role === 'super_admin') return true;
  if (req.user.role === 'staff' && receipt.site_id === req.user.site_id) return true;
  if (req.user.role === 'client' && receipt.client_id === req.user.id) return true;
  res.status(403).json({ error: 'Accès refusé.' });
  return false;
}

async function loadPdfContext(receipt) {
  const site = await dbGet('SELECT * FROM sites WHERE id = $1', [receipt.site_id]);
  const session = await dbGet('SELECT * FROM sessions_photo WHERE id = $1', [receipt.session_id]);
  const client = await dbGet('SELECT * FROM users WHERE id = $1', [receipt.client_id]);
  const staff = await dbGet('SELECT * FROM users WHERE id = $1', [receipt.created_by]);
  const publicVerifyUrl = `${process.env.APP_PUBLIC_URL || 'http://localhost:5173'}/verifier/${receipt.code_verification}`;
  return { site, session, client, staff, publicVerifyUrl };
}

router.post('/', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { session_id, montant_total, montant_paye, mode_paiement, methode_livraison, nb_photos, nb_videos, lien_telechargement, note } = req.body;
    if (!session_id || montant_total === undefined || montant_paye === undefined || !mode_paiement) {
      client.release();
      return res.status(400).json({ error: 'session_id, montant_total, montant_paye et mode_paiement sont requis.' });
    }
    const session = await dbGet('SELECT * FROM sessions_photo WHERE id = $1', [session_id]);
    if (!session) {
      client.release();
      return res.status(404).json({ error: 'Séance introuvable.' });
    }
    if (req.user.role === 'staff' && session.site_id !== req.user.site_id) {
      client.release();
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const site = await dbGet('SELECT * FROM sites WHERE id = $1', [session.site_id]);
    const numero = generateNumeroRecu(site.ville);
    const code = generateCodeVerification();
    const statutPaiement = Number(montant_paye) >= Number(montant_total) ? 'complet' : 'partiel';

    await client.query('BEGIN');

    const { rows: [inserted] } = await client.query(
      `INSERT INTO receipts
        (numero, code_verification, session_id, site_id, client_id, montant_total, montant_paye, statut_paiement,
         methode_livraison, nb_photos, nb_videos, lien_telechargement, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [
        numero, code, session_id, session.site_id, session.client_id,
        Number(montant_total), Number(montant_paye), statutPaiement,
        methode_livraison || 'retrait_studio', Number(nb_photos) || 0, Number(nb_videos) || 0,
        lien_telechargement || null, note || null, req.user.id,
      ]
    );

    if (Number(montant_paye) > 0) {
      await client.query(
        'INSERT INTO payments (receipt_id, montant, mode_paiement, staff_id) VALUES ($1, $2, $3, $4)',
        [inserted.id, Number(montant_paye), mode_paiement, req.user.id]
      );
    }

    await client.query(
      'INSERT INTO delivery_history (receipt_id, ancien_statut, nouveau_statut, changed_by, note) VALUES ($1, NULL, $2, $3, $4)',
      [inserted.id, 'en_attente', req.user.id, 'Reçu créé.']
    );

    await client.query('COMMIT');

    const receipt = await getReceiptFull(inserted.id);
    res.status(201).json({ receipt });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'client') {
      const rows = await dbAll(
        `SELECT r.*, s.nom as site_nom, sp.type_seance
         FROM receipts r JOIN sites s ON s.id = r.site_id JOIN sessions_photo sp ON sp.id = r.session_id
         WHERE r.client_id = $1 ORDER BY r.created_at DESC`,
        [req.user.id]
      );
      return res.json({ receipts: rows });
    }

    const siteId = scopeSiteId(req);
    const statut = req.query.statut_livraison;
    const clauses = [];
    const params = [];
    if (siteId) { params.push(siteId); clauses.push(`r.site_id = $${params.length}`); }
    if (statut) { params.push(statut); clauses.push(`r.statut_livraison = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await dbAll(
      `SELECT r.*, s.nom as site_nom, u.nom as client_nom, u.telephone as client_telephone, sp.type_seance
       FROM receipts r
       JOIN sites s ON s.id = r.site_id
       JOIN users u ON u.id = r.client_id
       JOIN sessions_photo sp ON sp.id = r.session_id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );
    res.json({ receipts: rows });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const receipt = await getReceiptFull(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    const payments = await dbAll(
      `SELECT p.*, u.nom as staff_nom FROM payments p JOIN users u ON u.id = p.staff_id
       WHERE p.receipt_id = $1 ORDER BY p.created_at ASC`,
      [receipt.id]
    );
    const history = await dbAll(
      `SELECT h.*, u.nom as changed_by_nom FROM delivery_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.receipt_id = $1 ORDER BY h.created_at ASC`,
      [receipt.id]
    );

    res.json({ receipt, payments, history });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/payments', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const receipt = await dbGet('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    const { montant, mode_paiement } = req.body;
    if (!montant || Number(montant) <= 0 || !mode_paiement) {
      return res.status(400).json({ error: 'Montant valide et mode de paiement requis.' });
    }

    await dbRun('INSERT INTO payments (receipt_id, montant, mode_paiement, staff_id) VALUES ($1, $2, $3, $4)', [
      receipt.id, Number(montant), mode_paiement, req.user.id,
    ]);

    const nouveauMontantPaye = Number(receipt.montant_paye) + Number(montant);
    const statutPaiement = nouveauMontantPaye >= Number(receipt.montant_total) ? 'complet' : 'partiel';
    await dbRun(
      "UPDATE receipts SET montant_paye = $1, statut_paiement = $2, updated_at = NOW() WHERE id = $3",
      [nouveauMontantPaye, statutPaiement, receipt.id]
    );

    const updated = await getReceiptFull(receipt.id);
    res.status(201).json({ receipt: updated });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/livraison', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const receipt = await dbGet('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    const { statut_livraison, note } = req.body;
    if (!STATUTS_LIVRAISON.includes(statut_livraison)) {
      return res.status(400).json({ error: 'Statut de livraison invalide.' });
    }
    if (statut_livraison === 'livre') {
      return res.status(400).json({ error: "Utilisez la confirmation de livraison pour passer au statut 'livré'." });
    }

    if (statut_livraison === 'pret' && !receipt.date_pret) {
      await dbRun(
        "UPDATE receipts SET statut_livraison = $1, date_pret = NOW(), updated_at = NOW() WHERE id = $2",
        [statut_livraison, receipt.id]
      );
    } else {
      await dbRun(
        "UPDATE receipts SET statut_livraison = $1, updated_at = NOW() WHERE id = $2",
        [statut_livraison, receipt.id]
      );
    }

    await dbRun(
      'INSERT INTO delivery_history (receipt_id, ancien_statut, nouveau_statut, changed_by, note) VALUES ($1, $2, $3, $4, $5)',
      [receipt.id, receipt.statut_livraison, statut_livraison, req.user.id, note || null]
    );

    const updated = await getReceiptFull(receipt.id);
    res.json({ receipt: updated });
  } catch (e) {
    next(e);
  }
});

// Delivery control: only staff/admin can mark a receipt as actually delivered,
// after verifying the client in person (in-app confirmation, not the public QR page).
router.post('/:id/confirmer-livraison', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const receipt = await dbGet('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    if (receipt.statut_livraison === 'livre') {
      return res.status(409).json({ error: 'Ce reçu est déjà marqué comme livré.' });
    }
    if (receipt.statut_paiement !== 'complet') {
      return res.status(409).json({ error: 'Le paiement doit être complet avant de confirmer la livraison.' });
    }

    const { note } = req.body;
    await dbRun(
      `UPDATE receipts SET statut_livraison = 'livre', date_livraison = NOW(),
       confirme_par_client = TRUE, confirme_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [receipt.id]
    );

    await dbRun(
      'INSERT INTO delivery_history (receipt_id, ancien_statut, nouveau_statut, changed_by, note) VALUES ($1, $2, $3, $4, $5)',
      [receipt.id, receipt.statut_livraison, 'livre', req.user.id, note || 'Livraison confirmée en personne.']
    );

    const updated = await getReceiptFull(receipt.id);
    res.json({ receipt: updated });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/pdf', requireAuth, async (req, res) => {
  try {
    const receipt = await getReceiptFull(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    const { site, session, client, staff, publicVerifyUrl } = await loadPdfContext(receipt);
    const pdfBuffer = await buildReceiptPdf({ receipt, session, site, client, staff, publicVerifyUrl });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recu-${receipt.numero}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF.' });
  }
});

router.post('/:id/envoyer-email', requireAuth, async (req, res) => {
  try {
    const receipt = await getReceiptFull(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    const destinataire = (req.body.email || receipt.client_email || '').trim();
    if (!destinataire) {
      return res.status(400).json({ error: "Aucune adresse email disponible pour ce client. Indiquez-en une pour cet envoi." });
    }

    const { site, session, client, staff, publicVerifyUrl } = await loadPdfContext(receipt);
    const pdfBuffer = await buildReceiptPdf({ receipt, session, site, client, staff, publicVerifyUrl });
    await sendReceiptEmail({ to: destinataire, receipt, site, client, pdfBuffer });
    await dbRun("UPDATE receipts SET email_envoye_at = NOW(), email_envoye_a = $1 WHERE id = $2", [destinataire, receipt.id]);

    const updated = await getReceiptFull(receipt.id);
    res.json({ ok: true, envoye_a: destinataire, receipt: updated });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message || "Erreur lors de l'envoi de l'email." });
  }
});

export default router;
