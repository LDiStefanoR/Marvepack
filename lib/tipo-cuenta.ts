import type { TipoCuentaCliente } from "@/types/auth";

export const TIPOS_CUENTA_CLIENTE = ["generico", "descuento_especial"] as const;

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuentaCliente, string> = {
  generico: "Genérico",
  descuento_especial: "Cliente con descuento especial",
};

export const DETALLE_TIPO_CUENTA: Record<TipoCuentaCliente, string> = {
  generico: "Ve el precio de lista. No tiene descuento.",
  descuento_especial: "Se le puede cargar un descuento propio, solo para este cliente.",
};

export function esTipoCuentaCliente(valor: unknown): valor is TipoCuentaCliente {
  return valor === "generico" || valor === "descuento_especial";
}

/** Los tipos viejos de crédito y de descuento general quedan en uno de los dos actuales. */
export function parseTipoCuenta(raw: unknown): TipoCuentaCliente {
  if (raw === "descuento_especial" || raw === "descuentos") return "descuento_especial";
  return "generico";
}

export function eraTipoCredito(raw: unknown) {
  return raw === "credito" || raw === "credito_super" || raw === "linea_credito";
}

export function veDescuentos(tipo?: TipoCuentaCliente | null) {
  return tipo === "descuento_especial";
}

export function mensajeGuardarTipo(tipo: TipoCuentaCliente) {
  if (tipo === "descuento_especial") return "Quedó como cliente con descuento especial.";
  return "Quedó como cliente genérico, sin descuento.";
}
