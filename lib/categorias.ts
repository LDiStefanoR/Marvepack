export const SECCIONES = [
  "BOLSAS",
  "DESCARTABLES",
  "REPOSTERIA",
  "COTILLON",
  "CAJAS MICRO",
  "CAJAS Y ESTUCHES",
  "POTES",
  "EXPANDIDO",
  "TERMICOS",
  "EMBALAJE",
  "ROLLOS",
  "HIGIENE",
  "LIBRERIA",
  "PERSONALIZADOS",
  "VARIOS",
] as const;

export type SeccionProducto = (typeof SECCIONES)[number];

export const SECCION_LABEL: Record<string, string> = {
  BOLSAS: "Bolsas",
  DESCARTABLES: "Descartables",
  REPOSTERIA: "Repostería",
  COTILLON: "Cotillón",
  "CAJAS MICRO": "Cajas micro",
  "CAJAS Y ESTUCHES": "Cajas y estuches",
  POTES: "Potes",
  EXPANDIDO: "Expandido",
  TERMICOS: "Térmicos",
  EMBALAJE: "Embalaje",
  ROLLOS: "Rollos",
  HIGIENE: "Higiene",
  LIBRERIA: "Librería",
  PERSONALIZADOS: "Personalizados",
  VARIOS: "Varios",
};

export const RUBRO_RESERVADO = "VARIOS";

export function etiquetaRubro(clave: string) {
  if (SECCION_LABEL[clave]) return SECCION_LABEL[clave];
  const lower = clave.toLowerCase();
  return lower.replace(/\b\w/g, (letra) => letra.toUpperCase());
}

export function claveRubro(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const MENSAJE_PEDIDO_GENERAL =
  "Hola MarvePack, quiero consultar por las necesidades de mi local";

export const MENSAJE_CATALOGO_PDF =
  "Hola MarvePack, ¿me pueden enviar el catálogo en PDF?";

export function mensajeConsultaProducto(nombreProducto: string) {
  return `Hola MarvePack, quiero consultar por ${nombreProducto}`;
}
