const NAVY = '#1c2554';
const NAVY_DARK = '#141a30';
const GOLD = '#c9974e';
const GREY = '#6b7280';
const BORDER = '#e5e7eb';

const PAYMENT_LABELS = { complet: 'Paiement complet', partiel: 'Paiement partiel' };
const DELIVERY_LABELS = {
  en_attente: 'En attente',
  en_traitement: 'En traitement',
  pret: 'Prêt à livrer',
  livre: 'Livré',
};

function fcfa(n) {
  return `${Math.round(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

/**
 * Renders a receipt's key details onto an in-memory canvas and returns it as a PNG blob.
 * Used so the invoice can be shared as an image itself (e.g. to WhatsApp) instead of a
 * PDF file or a link to it.
 * @param {object} receipt - numero, client_nom, client_telephone?, site_nom, type_seance,
 *   date_seance?, montant_total, montant_paye, statut_paiement, statut_livraison, code_verification
 * @returns {Promise<Blob>}
 */
export async function buildReceiptImageBlob(receipt) {
  const width = 900;
  const height = 1180;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fond
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Bandeau d'en-tête
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, width, 150);
  ctx.fillStyle = GOLD;
  ctx.font = '700 40px Georgia, serif';
  ctx.fillText("OKIM'ART", 40, 68);
  ctx.fillStyle = '#ffffff';
  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillText('Facture de séance photo', 40, 100);
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillText(receipt.numero || '', 40, 132);

  const left = 40;
  let y = 205;

  function row(label, value) {
    ctx.fillStyle = GREY;
    ctx.font = '400 16px Arial, sans-serif';
    ctx.fillText(label, left, y);
    ctx.fillStyle = NAVY_DARK;
    ctx.font = '700 21px Arial, sans-serif';
    ctx.fillText(String(value ?? '—'), left, y + 27);
    y += 68;
  }

  function separator() {
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - 40, y);
    ctx.stroke();
    y += 36;
  }

  row('Client', receipt.client_nom);
  if (receipt.client_telephone) row('Téléphone', receipt.client_telephone);
  row('Studio', receipt.site_nom);
  row('Type de séance', receipt.type_seance);
  if (receipt.date_seance) row('Date de la séance', new Date(receipt.date_seance).toLocaleDateString('fr-FR'));

  separator();

  row('Montant total', fcfa(receipt.montant_total));
  row('Montant payé', fcfa(receipt.montant_paye));
  row('Reste à payer', fcfa(Math.max(0, (receipt.montant_total || 0) - (receipt.montant_paye || 0))));
  row('Statut du paiement', PAYMENT_LABELS[receipt.statut_paiement] || receipt.statut_paiement);
  row('Statut de la livraison', DELIVERY_LABELS[receipt.statut_livraison] || receipt.statut_livraison);

  separator();

  ctx.fillStyle = GREY;
  ctx.font = '400 15px Arial, sans-serif';
  ctx.fillText('Code de vérification', left, y);
  ctx.fillStyle = NAVY_DARK;
  ctx.font = '700 19px "Courier New", monospace';
  ctx.fillText(receipt.code_verification || '—', left, y + 27);

  ctx.fillStyle = GREY;
  ctx.font = '400 13px Arial, sans-serif';
  ctx.fillText(`Émis le ${new Date().toLocaleDateString('fr-FR')} — Merci de votre confiance.`, left, height - 30);

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}