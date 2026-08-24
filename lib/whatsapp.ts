const WHATSAPP_E164 = "5493413050203";

function encodeMessage(text: string) {
  return encodeURIComponent(text.trim());
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeMessage(message)}`;
}

export function whatsappPhoneDisplay() {
  return "+54 9 3413 05-0203";
}
