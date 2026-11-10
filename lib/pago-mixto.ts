export const ID_PAGO_MIXTO = "mixto";

export function esPagoMixto(valor: string) {
  const t = valor.trim().toLowerCase();
  return t === "mixto" || t === "moto" || t === "pago mixto" || t === "pago moto";
}
