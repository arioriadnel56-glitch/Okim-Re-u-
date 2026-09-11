// Builds a wa.me deep link with a pre-filled message. No WhatsApp Business API
// account is required — it simply opens WhatsApp (app or web) with the text ready to send.
export function normalizePhoneForWhatsapp(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('229')) return digits;
  if (digits.startsWith('0')) return `229${digits.slice(1)}`;
  return `229${digits}`;
}

export function buildWhatsappShareUrl(phone, message) {
  const number = normalizePhoneForWhatsapp(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
