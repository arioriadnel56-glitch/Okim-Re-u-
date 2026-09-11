import nodemailer from 'nodemailer';

let cachedTransporter;

function getTransporter() {
  if (cachedTransporter !== undefined) return cachedTransporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    cachedTransporter = null;
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransporter;
}

export function isMailerConfigured() {
  return !!getTransporter();
}

export async function sendPasswordResetEmail({ to, nom, tempPassword }) {
  const transporter = getTransporter();
  if (!transporter) {
    throw Object.assign(
      new Error("L'envoi par email n'est pas configuré sur ce serveur (paramètres SMTP manquants)."),
      { status: 503 }
    );
  }

  const from = process.env.MAIL_FROM || `"OKIM'ART" <no-reply@okimart.studio>`;
  const premierNom = (nom || '').trim().split(/\s+/)[0] || '';

  await transporter.sendMail({
    from,
    to,
    subject: "Réinitialisation de votre mot de passe OKIM'ART",
    text: [
      `Bonjour ${premierNom},`,
      '',
      `Voici votre nouveau mot de passe temporaire : ${tempPassword}`,
      '',
      `Il vous sera demandé de le changer dès votre prochaine connexion.`,
      `Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement votre studio.`,
      '',
      `OKIM'ART`,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1c2029; line-height: 1.6;">
        <p>Bonjour ${premierNom || ''},</p>
        <p>Voici votre nouveau mot de passe temporaire :</p>
        <p style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">${tempPassword}</p>
        <p>Il vous sera demandé de le changer dès votre prochaine connexion.</p>
        <p style="color: #6b7280; font-size: 13px;">Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement votre studio.</p>
        <p>OKIM'ART</p>
      </div>
    `,
  });
}

export async function sendReceiptEmail({ to, receipt, site, client, pdfBuffer }) {
  const transporter = getTransporter();
  if (!transporter) {
    throw Object.assign(
      new Error("L'envoi par email n'est pas configuré sur ce serveur (paramètres SMTP manquants)."),
      { status: 503 }
    );
  }

  const from = process.env.MAIL_FROM || `"${site.nom}" <no-reply@okimart.studio>`;
  const premierNom = (client.nom || '').trim().split(/\s+/)[0] || '';

  await transporter.sendMail({
    from,
    to,
    subject: `Votre reçu ${receipt.numero} — ${site.nom}`,
    text: [
      `Bonjour ${premierNom},`,
      '',
      `Veuillez trouver ci-joint votre reçu ${receipt.numero} pour votre séance chez ${site.nom}.`,
      `Statut de livraison actuel : ${receipt.statut_livraison}.`,
      '',
      `Merci de votre confiance.`,
      site.nom,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1c2029; line-height: 1.6;">
        <p>Bonjour ${premierNom || ''},</p>
        <p>Veuillez trouver ci-joint votre reçu <strong>${receipt.numero}</strong> pour votre séance chez ${site.nom}.</p>
        <p>Merci de votre confiance.<br/>${site.nom}</p>
      </div>
    `,
    attachments: [
      {
        filename: `recu-${receipt.numero}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}
