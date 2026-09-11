import { Router } from 'express';
import { dbGet, dbRun } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';
import { generateTempPassword } from '../utils/codes.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { telephone, password } = req.body;
    if (!telephone || !password) {
      return res.status(400).json({ error: 'Téléphone et mot de passe requis.' });
    }
    const user = await dbGet('SELECT * FROM users WHERE telephone = $1', [telephone.trim()]);
    if (!user || !user.actif) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        site_id: user.site_id,
        nom: user.nom,
        telephone: user.telephone,
        email: user.email,
        doit_changer_mdp: !!user.doit_changer_mdp,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await dbGet(
      'SELECT id, role, site_id, nom, telephone, email, doit_changer_mdp FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user: { ...user, doit_changer_mdp: !!user.doit_changer_mdp } });
  } catch (e) {
    next(e);
  }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;
    if (!nouveau_mot_de_passe || nouveau_mot_de_passe.length < 4) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' });
    }
    const user = await dbGet('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (!user.doit_changer_mdp) {
      if (!ancien_mot_de_passe || !verifyPassword(ancien_mot_de_passe, user.password_hash)) {
        return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
      }
    }
    const newHash = hashPassword(nouveau_mot_de_passe);
    await dbRun('UPDATE users SET password_hash = $1, doit_changer_mdp = FALSE WHERE id = $2', [newHash, user.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Ouvert à tout type de compte (admin général, staff, client) : identifié par téléphone,
// le nouveau mot de passe temporaire est envoyé à l'email enregistré sur le compte.
router.post('/mot-de-passe-oublie', async (req, res, next) => {
  try {
    const { telephone } = req.body;
    if (!telephone) {
      return res.status(400).json({ error: 'Numéro de téléphone requis.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE telephone = $1', [telephone.trim()]);
    if (!user || !user.actif) {
      return res.status(404).json({ error: 'Aucun compte actif ne correspond à ce numéro de téléphone.' });
    }
    if (!user.email) {
      return res.status(409).json({
        error: "Aucune adresse email n'est enregistrée pour ce compte. Contactez votre studio ou l'administrateur pour réinitialiser votre mot de passe.",
      });
    }

    const tempPassword = generateTempPassword();
    // Send first: if this fails (e.g. SMTP not configured), the user's password must stay
    // untouched — otherwise a failed send would lock them out with no way to know the new one.
    await sendPasswordResetEmail({ to: user.email, nom: user.nom, tempPassword });
    await dbRun('UPDATE users SET password_hash = $1, doit_changer_mdp = TRUE WHERE id = $2', [
      hashPassword(tempPassword), user.id,
    ]);

    res.json({ ok: true, envoye_a: user.email });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
