export const PERMISOS_CAJA = [
  "venta",
  "listados",
  "stock",
  "clientes",
  "productos",
  "mantenimiento",
  "configuracion",
  "deudas",
] as const;

export type PermisoCaja = (typeof PERMISOS_CAJA)[number];

export const ETIQUETA_PERMISO_CAJA: Record<PermisoCaja, string> = {
  venta: "Caja / Ventas",
  listados: "Listados",
  stock: "Stock",
  clientes: "Clientes",
  productos: "Productos",
  mantenimiento: "Mantenimiento",
  configuracion: "Configuración",
  deudas: "Deudas",
};

const BASE_CAJA: PermisoCaja[] = [
  "venta",
  "listados",
  "stock",
  "clientes",
  "productos",
  "mantenimiento",
  "configuracion",
];

export function esPermisoCaja(valor: unknown): valor is PermisoCaja {
  return PERMISOS_CAJA.includes(valor as PermisoCaja);
}

export function permisosCajaDe(rol: string, guardados?: readonly string[] | null): PermisoCaja[] {
  if (rol === "admin") return [...PERMISOS_CAJA];
  const lista = !guardados
    ? [...BASE_CAJA]
    : PERMISOS_CAJA.filter((permiso) => guardados.includes(permiso));
  if (lista.includes("mantenimiento") && !lista.includes("configuracion")) {
    lista.push("configuracion");
  }
  return lista;
}

export function leerPermisosForm(form: FormData): PermisoCaja[] {
  return PERMISOS_CAJA.filter((permiso) => form.get(`permiso_${permiso}`) === "1");
}
