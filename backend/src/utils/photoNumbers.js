// Numéros des photos sélectionnées par le client (ex. « 12, 15, 20-25, IMG_0042 »).
// Saisie libre : séparateurs virgule / point-virgule / espace / retour à la ligne.
// Les plages purement numériques (« 20-25 ») sont développées en 20, 21, …, 25.
// Résultat : liste dédoublonnée, triée (numéros d'abord dans l'ordre croissant, puis les
// références alphanumériques).

const MAX_PHOTOS = 1000;
const MAX_TOKEN_LENGTH = 30;

/**
 * @param {string|string[]|null|undefined} input
 * @returns {string[]} liste normalisée
 * @throws {Error} message lisible si la saisie est invalide
 */
export function parsePhotoNumbers(input) {
  if (input === undefined || input === null || input === '') return [];

  const rawTokens = Array.isArray(input)
    ? input.map(String)
    : String(input).split(/[\s,;]+/);

  const seen = new Set();
  const out = [];
  const add = (t) => {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  for (const raw of rawTokens) {
    const token = raw.trim().replace(/^#/, '');
    if (!token) continue;

    const range = token.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (b < a) throw new Error(`Plage invalide « ${token} » : le premier numéro doit être le plus petit.`);
      if (b - a + 1 > MAX_PHOTOS) throw new Error(`Plage « ${token} » trop grande (${MAX_PHOTOS} photos maximum).`);
      // Garde les zéros de tête (« 001-003 » → 001, 002, 003) si les deux bornes en ont.
      const width = range[1].startsWith('0') ? range[1].length : 0;
      for (let n = a; n <= b; n++) add(width ? String(n).padStart(width, '0') : String(n));
      continue;
    }

    if (token.length > MAX_TOKEN_LENGTH || !/^[\p{L}\p{N}_.\-/]+$/u.test(token)) {
      throw new Error(`Numéro de photo invalide : « ${token.slice(0, MAX_TOKEN_LENGTH)} ».`);
    }
    add(token);
  }

  if (out.length > MAX_PHOTOS) throw new Error(`Trop de photos (${MAX_PHOTOS} maximum).`);

  const isNum = (s) => /^\d+$/.test(s);
  out.sort((x, y) => {
    if (isNum(x) && isNum(y)) return Number(x) - Number(y) || x.length - y.length;
    if (isNum(x)) return -1;
    if (isNum(y)) return 1;
    return x.localeCompare(y, 'fr', { numeric: true });
  });
  return out;
}

/** Texte lisible pour le PDF / l'image : « 3, 7, 12, 13, 14 ». */
export function formatPhotoNumbers(list) {
  return Array.isArray(list) && list.length ? list.join(', ') : '';
}
