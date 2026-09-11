import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0,O,1,I)

function randomCode(length) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateNumeroRecu(siteVille) {
  const year = new Date().getFullYear();
  const prefix = (siteVille || 'OKM').slice(0, 3).toUpperCase();
  return `OKM-${prefix}-${year}-${randomCode(5)}`;
}

export function generateCodeVerification() {
  return `${randomCode(4)}-${randomCode(4)}`;
}

export function generateTempPassword() {
  return randomCode(6);
}
