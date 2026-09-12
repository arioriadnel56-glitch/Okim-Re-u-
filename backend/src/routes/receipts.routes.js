import { Router } from 'express';
import { dbGet, dbAll, dbRun, pool } from '../db.js';
import { requireAuth, requireRole, scopeSiteId } from '../auth.js';
import { generateNumeroRecu, generateCodeVerification } from '../utils/codes.js';
import { buildReceiptPdf, buildReceiptsBatchPdf } from '../utils/pdf.js';
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

// Archive un reçu (justificatif, qui l'a demandé/validé, snapshot complet) puis le supprime
// définitivement. Utilisé aussi bien pour une validation manuelle par le super admin que pour
// la purge automatique des reçus dont le délai de 30 jours dans la corbeille est dépassé.
async function archiveAndDeleteReceipt(receiptId, validator) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [receipt] } = await client.query('SELECT * FROM receipts WHERE id = $1 FOR UPDATE', [receiptId]);
    if (!receipt) {
      await client.query('ROLLBACK');
      return null;
    }

    let demandeParNom = null;
    if (receipt.delete_requested_by) {
      const { rows: [requester] } = await client.query('SELECT nom FROM users WHERE id = $1', [receipt.delete_requested_by]);
      demandeParNom = requester?.nom || null;
    }

    await client.query(
      `INSERT INTO receipts_deleted_archive
        (receipt_id, numero, code_verification, site_id, client_id, montant_total, montant_paye,
         motif, demande_par, demande_par_nom, demande_at, valide_par, valide_par_nom, receipt_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        receipt.id, receipt.numero, receipt.code_verification, receipt.site_id, receipt.client_id,
        receipt.montant_total, receipt.montant_paye, receipt.delete_reason, receipt.delete_requested_by,
        demandeParNom, receipt.delete_requested_at, validator?.id || null, validator?.nom || null,
        JSON.stringify(receipt),
      ]
    );

    await client.query('DELETE FROM receipts WHERE id = $1', [receiptId]);
    await client.query('COMMIT');
    return receipt;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Tout reçu en attente de validation depuis plus de 30 jours est purgé automatiquement
// (archivé puis supprimé) — appelé à chaque consultation de la corbeille par le super admin,
// faute de tâche planifiée dédiée sur cet hébergement.
async function purgeExpiredCorbeille() {
  const expired = await dbAll(
    `SELECT id FROM receipts WHERE delete_status = 'en_attente' AND delete_requested_at < NOW() - INTERVAL '30 days'`
  );
  for (const row of expired) {
    await archiveAndDeleteReceipt(row.id, { id: null, nom: 'Purge automatique (30 jours dépassés)' });
  }
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
         WHERE r.client_id = $1 AND r.deleted_at IS NULL ORDER BY r.created_at DESC`,
        [req.user.id]
      );
      return res.json({ receipts: rows });
    }

    const siteId = scopeSiteId(req);
    const statut = req.query.statut_livraison;
    const clauses = ['r.deleted_at IS NULL'];
    const params = [];
    if (siteId) { params.push(siteId); clauses.push(`r.site_id = $${params.length}`); }
    if (statut) { params.push(statut); clauses.push(`r.statut_livraison = $${params.length}`); }
    const where = `WHERE ${clauses.join(' AND ')}`;

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

// Bulk export — must be registered before '/:id' so Express doesn't treat "export" as an :id.
// Staff/admin export their site's receipts (optionally filtered by delivery status);
// clients export only their own. All matching receipts are combined into one PDF, one page each.
router.get('/export/pdf', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'client') {
      rows = await dbAll(
        'SELECT id FROM receipts WHERE client_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
        [req.user.id]
      );
    } else if (req.user.role === 'staff' || req.user.role === 'super_admin') {
      const siteId = scopeSiteId(req);
      const statut = req.query.statut_livraison;
      const clauses = ['deleted_at IS NULL'];
      const params = [];
      if (siteId) { params.push(siteId); clauses.push(`site_id = $${params.length}`); }
      if (statut) { params.push(statut); clauses.push(`statut_livraison = $${params.length}`); }
      const where = `WHERE ${clauses.join(' AND ')}`;
      rows = await dbAll(`SELECT id FROM receipts ${where} ORDER BY created_at ASC`, params);
    } else {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucun reçu à exporter pour ce filtre.' });
    }
    if (rows.length > 500) {
      return res.status(413).json({ error: 'Trop de reçus pour un export groupé (500 maximum). Affinez le filtre.' });
    }

    const items = [];
    for (const row of rows) {
      const receipt = await getReceiptFull(row.id);
      const ctx = await loadPdfContext(receipt);
      items.push({ receipt, ...ctx });
    }

    const pdfBuffer = await buildReceiptsBatchPdf(items);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recus-okimart-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la génération de l'export PDF." });
  }
});

// --- Corbeille : demande de suppression (staff/super admin), validation ou restauration
// (super admin uniquement). Doivent rester déclarées avant '/:id' pour qu'Express ne
// confonde pas "corbeille" avec un identifiant de reçu.

// Bouton dédié côté super admin : liste des reçus en attente de validation de suppression.
router.get('/corbeille', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    await purgeExpiredCorbeille();

    const rows = await dbAll(
      `SELECT r.*, s.nom as site_nom, u.nom as client_nom, u.telephone as client_telephone,
              sp.type_seance, demandeur.nom as demande_par_nom
       FROM receipts r
       JOIN sites s ON s.id = r.site_id
       JOIN users u ON u.id = r.client_id
       JOIN sessions_photo sp ON sp.id = r.session_id
       LEFT JOIN users demandeur ON demandeur.id = r.delete_requested_by
       WHERE r.delete_status = 'en_attente'
       ORDER BY r.delete_requested_at ASC`
    );

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const receipts = rows.map((r) => {
      const requestedAt = new Date(r.delete_requested_at);
      const dateLimite = new Date(requestedAt.getTime() + THIRTY_DAYS_MS);
      const joursRestants = Math.max(0, Math.ceil((dateLimite.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      return { ...r, date_limite: dateLimite.toISOString(), jours_restants: joursRestants };
    });

    res.json({ receipts });
  } catch (e) {
    next(e);
  }
});

// Historique des suppressions déjà validées (définitives) — pour la traçabilité côté super admin.
router.get('/corbeille/archives', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const archives = await dbAll('SELECT * FROM receipts_deleted_archive ORDER BY valide_at DESC LIMIT 200');
    res.json({ archives });
  } catch (e) {
    next(e);
  }
});

// Bouton « Supprimer » sur chaque ligne de l'historique : efface définitivement cette trace
// d'archive (le reçu lui-même a déjà été supprimé plus tôt lors de la validation).
router.delete('/corbeille/archives/:archiveId', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const existing = await dbGet('SELECT * FROM receipts_deleted_archive WHERE id = $1', [req.params.archiveId]);
    if (!existing) return res.status(404).json({ error: "Cette entrée de l'historique est introuvable." });

    await dbRun('DELETE FROM receipts_deleted_archive WHERE id = $1', [req.params.archiveId]);
    res.json({ ok: true, message: "L'entrée a été supprimée de l'historique." });
  } catch (e) {
    next(e);
  }
});

// La secrétaire (staff) — ou le super admin — demande la suppression d'un reçu, avec
// justification obligatoire. Le reçu part alors dans la corbeille, en attente de validation.
router.post('/:id/demander-suppression', requireAuth, requireRole('staff', 'super_admin'), async (req, res, next) => {
  try {
    const receipt = await dbGet('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (receipt.deleted_at) return res.status(409).json({ error: 'Ce reçu est déjà dans la corbeille.' });
    if (!assertReceiptAccess(req, receipt, res)) return;

    const motif = (req.body.motif || '').trim();
    if (motif.length < 5) {
      return res.status(400).json({ error: 'Merci de justifier la suppression (5 caractères minimum).' });
    }

    await dbRun(
      `UPDATE receipts SET deleted_at = NOW(), delete_status = 'en_attente', delete_reason = $1,
       delete_requested_by = $2, delete_requested_at = NOW(), delete_reviewed_by = NULL, delete_reviewed_at = NULL,
       updated_at = NOW() WHERE id = $3`,
      [motif, req.user.id, receipt.id]
    );

    res.json({ ok: true, message: 'Le reçu a été envoyé dans la corbeille, en attente de validation du super admin.' });
  } catch (e) {
    next(e);
  }
});

// Le super admin valide définitivement la suppression : le reçu est archivé (motif, demandeur,
// snapshot) puis supprimé de la base.
router.post('/:id/valider-suppression', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const receipt = await dbGet('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (receipt.delete_status !== 'en_attente') {
      return res.status(409).json({ error: "Ce reçu n'est pas en attente de validation de suppression." });
    }

    await archiveAndDeleteReceipt(receipt.id, { id: req.user.id, nom: req.user.nom });
    res.json({ ok: true, message: 'Le reçu a été définitivement supprimé.' });
  } catch (e) {
    next(e);
  }
});

// Le super admin refuse la suppression et restaure le reçu dans les listes normales.
router.post('/:id/restaurer', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const receipt = await dbGet('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!receipt) return res.status(404).json({ error: 'Reçu introuvable.' });
    if (receipt.delete_status !== 'en_attente') {
      return res.status(409).json({ error: "Ce reçu n'est pas dans la corbeille." });
    }

    await dbRun(
      `UPDATE receipts SET deleted_at = NULL, delete_status = 'aucune', delete_reason = NULL,
       delete_requested_by = NULL, delete_requested_at = NULL,
       delete_reviewed_by = $1, delete_reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [req.user.id, receipt.id]
    );

    const updated = await getReceiptFull(receipt.id);
    res.json({ ok: true, receipt: updated, message: 'Le reçu a été restauré.' });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const receipt = await getReceiptFull(req.params.id);
    if (!receipt || receipt.deleted_at) return res.status(404).json({ error: 'Reçu introuvable.' });
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
