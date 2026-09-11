import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const GOLD = '#c9974e';
const NAVY = '#1c2554';
const DARK = '#141a30';
const GREY = '#6b7280';

const STATUT_LIVRAISON_LABELS = {
  en_attente: 'En attente',
  en_traitement: 'En traitement',
  pret: 'Prêt à livrer',
  livre: 'Livré',
};

const METHODE_LABELS = {
  retrait_studio: 'Retrait en studio',
  lien_telechargement: 'Lien de téléchargement',
  livraison_physique: 'Livraison physique',
};

/**
 * Draws one receipt onto the current page of an already-open PDFDocument.
 * Shared by the single-receipt PDF and the multi-receipt batch export so both
 * render identically.
 * @param {import('pdfkit')} doc
 * @param {object} data - { receipt, session, site, client, staff, publicVerifyUrl }
 */
async function drawReceiptPage(doc, data) {
  const { receipt, session, site, client, staff, publicVerifyUrl } = data;

  const qrDataUrl = await QRCode.toDataURL(publicVerifyUrl, {
    margin: 1,
    color: { dark: DARK, light: '#FFFFFF' },
  });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  // Header band
  doc.rect(0, 0, doc.page.width, 128).fill(NAVY);
  doc.fillColor(GOLD).fontSize(24).font('Helvetica-Bold').text("OKIM'ART", 40, 28);
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica').text('Une image, une histoire.', 40, 58);
  doc.fillColor('#FFFFFF').fontSize(9).text(`${site.nom} — ${site.ville}`, 40, 76);
  if (site.telephone) doc.text(`Tél : ${site.telephone}`, 40, 90);

  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text('REÇU N°', 320, 28, { width: 235, align: 'right' });
  doc.fillColor(GOLD).fontSize(13).font('Helvetica-Bold').text(receipt.numero, 320, 42, { width: 235, align: 'right' });
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text(
    new Date(receipt.created_at).toLocaleDateString('fr-FR'),
    320, 66, { width: 235, align: 'right' }
  );

  let y = 156;
  doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('Informations client', 40, y);
  y += 18;
  doc.fontSize(10).font('Helvetica').fillColor('#333333');
  doc.text(`Nom : ${client.nom}`, 40, y); y += 14;
  doc.text(`Téléphone : ${client.telephone}`, 40, y); y += 14;
  if (client.email) { doc.text(`Email : ${client.email}`, 40, y); y += 14; }

  y += 10;
  doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('Séance', 40, y);
  y += 18;
  doc.fontSize(10).font('Helvetica').fillColor('#333333');
  doc.text(`Type : ${session.type_seance}`, 40, y); y += 14;
  doc.text(`Date : ${new Date(session.date_seance).toLocaleDateString('fr-FR')}`, 40, y); y += 14;
  if (session.description) { doc.text(`Détails : ${session.description}`, 40, y, { width: 340 }); y += 14; }

  y += 10;
  doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('Paiement', 40, y);
  y += 18;
  const reste = Math.max(0, receipt.montant_total - receipt.montant_paye);
  doc.fontSize(10).font('Helvetica').fillColor('#333333');
  doc.text(`Montant total : ${formatFcfa(receipt.montant_total)}`, 40, y); y += 14;
  doc.text(`Montant payé : ${formatFcfa(receipt.montant_paye)}`, 40, y); y += 14;
  doc.font('Helvetica-Bold').text(`Reste à payer : ${formatFcfa(reste)}`, 40, y); y += 14;
  doc.font('Helvetica').text(`Statut : ${receipt.statut_paiement === 'complet' ? 'Paiement complet' : 'Paiement partiel'}`, 40, y); y += 14;

  y += 10;
  doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text('Livraison', 40, y);
  y += 18;
  doc.fontSize(10).font('Helvetica').fillColor('#333333');
  doc.text(`Méthode : ${METHODE_LABELS[receipt.methode_livraison]}`, 40, y); y += 14;
  doc.text(`Statut actuel : ${STATUT_LIVRAISON_LABELS[receipt.statut_livraison]}`, 40, y); y += 14;
  doc.text(`Éléments : ${receipt.nb_photos} photo(s), ${receipt.nb_videos} vidéo(s)`, 40, y); y += 14;

  // QR code box
  doc.roundedRect(400, 156, 155, 200, 6).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.image(qrBuffer, 415, 168, { width: 125, height: 125 });
  doc.fillColor(GREY).fontSize(8).font('Helvetica').text('Scannez pour suivre', 400, 298, { width: 155, align: 'center' });
  doc.text('votre livraison', 400, 308, { width: 155, align: 'center' });
  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold').text(receipt.code_verification, 400, 324, { width: 155, align: 'center' });

  const footerY = Math.max(y, 366) + 30;
  doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#e5e7eb').stroke();
  doc.fontSize(8).fillColor(GREY).font('Helvetica').text(
    `Émis par ${staff.nom} — ${site.nom}. Ce reçu fait foi de paiement et de suivi de livraison. Merci de le conserver jusqu'à la remise finale.`,
    40, footerY + 10, { width: 515 }
  );
  doc.text('OKIM ART — Studio de photographie et de vidéo, Bénin.', 40, footerY + 26);
}

/**
 * Builds a single receipt PDF as a Buffer.
 * @param {object} data - { receipt, session, site, client, staff, publicVerifyUrl }
 * @returns {Promise<Buffer>}
 */
export async function buildReceiptPdf(data) {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawReceiptPage(doc, data)
      .then(() => doc.end())
      .catch(reject);
  });
}

/**
 * Builds a single PDF containing every receipt in `items`, one per page,
 * in the order given — used for "download all receipts" exports.
 * @param {object[]} items - each shaped like buildReceiptPdf's `data` param
 * @returns {Promise<Buffer>}
 */
export async function buildReceiptsBatchPdf(items) {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    (async () => {
      for (let i = 0; i < items.length; i++) {
        if (i > 0) doc.addPage();
        await drawReceiptPage(doc, items[i]);
      }
      doc.end();
    })().catch(reject);
  });
}

function formatFcfa(amount) {
  const rounded = Math.round(Number(amount) || 0);
  const withSpaces = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} FCFA`;
}

const SESSIONS_TABLE_COLUMNS = [
  { key: 'date_seance', label: 'Date', width: 62 },
  { key: 'client_nom', label: 'Client', width: 130 },
  { key: 'client_telephone', label: 'Téléphone', width: 95 },
  { key: 'type_seance', label: 'Type de séance', width: 130 },
  { key: 'site_nom', label: 'Studio', width: 105 },
  { key: 'staff_nom', label: 'Personnel', width: 110 },
  { key: 'montant_total', label: 'Montant', width: 90 },
];

/**
 * Builds a tabular PDF report listing every photo session recorded, one row each —
 * used for the super admin's "download all realized sessions" export.
 * @param {object[]} sessions - rows shaped like sessions_photo joined with client/staff/site names
 * @param {{ titre?: string }} [options]
 * @returns {Promise<Buffer>}
 */
export async function buildSessionsListPdf(sessions, options = {}) {
  const titre = options.titre || 'Liste des séances réalisées';

  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = 40;
    const tableWidth = SESSIONS_TABLE_COLUMNS.reduce((sum, c) => sum + c.width, 0);

    function drawPageHeader() {
      doc.rect(0, 0, doc.page.width, 64).fill(NAVY);
      doc.fillColor(GOLD).fontSize(16).font('Helvetica-Bold').text("OKIM'ART", startX, 14);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(titre, startX, 34);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica').text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} — ${sessions.length} séance(s) au total`,
        startX, 48
      );
    }

    function drawTableHeader(y) {
      doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold');
      let x = startX;
      SESSIONS_TABLE_COLUMNS.forEach((c) => {
        doc.text(c.label, x, y, { width: c.width - 6 });
        x += c.width;
      });
      doc.moveTo(startX, y + 15).lineTo(startX + tableWidth, y + 15).strokeColor('#c9974e').lineWidth(1).stroke();
      return y + 22;
    }

    drawPageHeader();
    let y = drawTableHeader(84);
    doc.font('Helvetica').fontSize(8.5);

    if (sessions.length === 0) {
      doc.fillColor(GREY).text('Aucune séance enregistrée.', startX, y);
    }

    sessions.forEach((s, i) => {
      if (y > doc.page.height - 48) {
        doc.addPage();
        drawPageHeader();
        y = drawTableHeader(84);
        doc.font('Helvetica').fontSize(8.5);
      }

      if (i % 2 === 0) {
        doc.rect(startX, y - 4, tableWidth, 17).fill('#f7f5f0');
      }
      doc.fillColor('#333333');

      const row = [
        new Date(s.date_seance).toLocaleDateString('fr-FR'),
        s.client_nom || '—',
        s.client_telephone || '—',
        s.type_seance || '—',
        s.site_nom || '—',
        s.staff_nom || '—',
        formatFcfa(s.montant_total),
      ];
      let x = startX;
      row.forEach((val, idx) => {
        doc.text(String(val), x, y, { width: SESSIONS_TABLE_COLUMNS[idx].width - 6, ellipsis: true, lineBreak: false });
        x += SESSIONS_TABLE_COLUMNS[idx].width;
      });
      y += 17;
    });

    doc.end();
  });
}