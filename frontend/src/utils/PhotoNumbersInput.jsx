import React, { useMemo } from 'react';
import { parsePhotoNumbers } from '../utils/photoNumbers.js';

/**
 * Champ de saisie des numéros de photos choisies par le client.
 * `value` = texte brut saisi ; `onChange(texte, liste)` reçoit aussi la liste normalisée
 * (ou null si la saisie est invalide) pour que le parent puisse en déduire le nombre de photos.
 */
export default function PhotoNumbersInput({ value, onChange, label = 'N° des photos choisies par le client' }) {
  const { list, error } = useMemo(() => {
    try {
      return { list: parsePhotoNumbers(value), error: '' };
    } catch (e) {
      return { list: null, error: e.message };
    }
  }, [value]);

  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input min-h-[72px]"
        value={value}
        onChange={(e) => onChange(e.target.value, (() => { try { return parsePhotoNumbers(e.target.value); } catch { return null; } })())}
        placeholder="Ex. : 12, 15, 20-25, 38"
        inputMode="text"
      />
      <p className="text-xs text-stone-400 mt-1">
        Séparez les numéros par une virgule ou un espace. Une plage s'écrit « 20-25 ».
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {list && list.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-stone-500 mb-1">{list.length} photo(s) sélectionnée(s)</p>
          <div className="flex flex-wrap gap-1.5">
            {list.map((n) => (
              <span key={n} className="px-2 py-0.5 rounded-full bg-stone-100 text-navy-dark text-xs font-medium">{n}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
