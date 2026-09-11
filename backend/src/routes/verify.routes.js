import { Router } from 'express';
import { dbGet } from '../db.js';
import jwt from 'jsonwebtoken';
import { buildReceiptPdf } from '../utils/pdf.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

function maskName(nom) {
  const parts = nom.trim().split(/\s+/);
  return parts.map((p) => (p.length <= 2 ? p : `${p[0]}${'*'.repeat(p.length - 2)}${p[p.length - 1]}`)).join(' ');
}

// Public: no financial amounts exposed here, only delivery status — safe for a scanned QR code.
router.get('/:code', async (req, res, next) => {
  try {
    const receipt = await dbGet(
      `SELECT r.id, r.numero, r.code_verification, r.statut_livraison, r.methode_livraison,
              r.nb_photos, r.nb_videos, r.date_pret, r.date_livraison,
              s.nom as site_nom, s.ville as site_ville, s.telephone as site_telephone,
              u.nom as client_nom, sp.type_seance, sp.date_seance
       FROM receipts r
       JOIN sites s ON s.id = r.site_id
       JOIN users u ON u.id = r.client_id
       JOIN sessions_photo sp ON sp.id = r.session_id
       WHERE r.code_verification = $1`,
      [req.params.code.toUpperCase()]
    );

    if (!receipt) return res.status(404).json({ error: 'Aucun reçu ne correspond à ce code.' });

    let staffView = false;
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role === 'super_admin' || payload.role === 'staff') staffView = true;
      } catch (e) {
        // invalid/expired token: fall back to public view
      }
    }

    res.json({
      numero: receipt.numero,
      client_nom: staffView ? receipt.client_nom : maskName(receipt.client_nom),
      site_nom: receipt.site_nom,
      site_ville: receipt.site_ville,
      site_telephone: receipt.site_telephone,
      type_seance: receipt.type_seance,
      date_seance: receipt.date_seance,
      statut_livraison: receipt.statut_livraison,
      methode_livraison: receipt.methode_livraison,
      nb_photos: receipt.nb_photos,
      nb_videos: receipt.nb_videos,
      date_pret: receipt.date_pret,
      date_livraison: receipt.date_livraison,
      receipt_id: staffView ? receipt.id : undefined,
    });
  } catch (e) {
    next(e);
  }
});

// Public: lets a client (or anyone they forward the code to, e.g. via WhatsApp) download
// their own receipt PDF without logging in — the code itself acts as the access credential,
// exactly like a printed paper receipt would.
router.get('/:code/pdf', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const receipt = await dbGet('SELECT * FROM receipts WHERE code_verification = $1', [code]);
    if (!receipt) return res.status(404).json({ error: 'Aucun reçu ne correspond à ce code.' });

    const site = await dbGet('SELECT * FROM sites WHERE id = $1', [receipt.site_id]);
    const session = await dbGet('SELECT * FROM sessions_photo WHERE id = $1', [receipt.session_id]);
    const client = await dbGet('SELECT * FROM users WHERE id = $1', [receipt.client_id]);
    const staff = await dbGet('SELECT * FROM users WHERE id = $1', [receipt.created_by]);
    const publicVerifyUrl = `${process.env.APP_PUBLIC_URL || 'http://localhost:5173'}/verifier/${receipt.code_verification}`;

    const pdfBuffer = await buildReceiptPdf({ receipt, session, site, client, staff, publicVerifyUrl });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="recu-${receipt.numero}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la génération du PDF.' });
  }
});

export default router;
