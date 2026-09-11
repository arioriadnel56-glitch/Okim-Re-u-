const LABELS = {
  en_attente: 'En attente',
  en_traitement: 'En traitement',
  pret: 'Prêt à livrer',
  livre: 'Livré',
};

const CLASSES = {
  en_attente: 'badge-attente',
  en_traitement: 'badge-traitement',
  pret: 'badge-pret',
  livre: 'badge-livre',
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${CLASSES[status] || 'badge-attente'}`}>{LABELS[status] || status}</span>;
}

export function PaymentBadge({ status }) {
  const isComplete = status === 'complet';
  return (
    <span className={`badge ${isComplete ? 'badge-livre' : 'badge-traitement'}`}>
      {isComplete ? 'Paiement complet' : 'Paiement partiel'}
    </span>
  );
}
