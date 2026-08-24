import { formatoPesos } from "@/lib/format";

export const CARRITO_STORAGE_KEY = "marvepack-carrito";

export type LineaCarrito = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  precioLista?: number;
  descuentoCliente?: number;
  cantidad: number;
};

export function totalCarrito(lineas: LineaCarrito[]) {
  return lineas.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0);
}

export function cantidadTotal(lineas: LineaCarrito[]) {
  return lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
}

export function mensajePedidoWhatsApp(
  lineas: LineaCarrito[],
  opciones?: {
    clienteRegistrado?: boolean;
    contacto?: {
      nombre?: string;
      email?: string;
      telefono?: string;
      direccion?: string;
      horarios?: string;
    };
  },
) {
  const items = lineas
    .map(
      (linea) =>
        `• ${linea.cantidad} x ${linea.nombre} (cód. ${linea.codigo}) — ${formatoPesos(linea.precio * linea.cantidad)}`,
    )
    .join("\n");
  const total = formatoPesos(totalCarrito(lineas));
  const c = opciones?.contacto;
  const datos = [
    c?.nombre ? `Nombre: ${c.nombre}` : "",
    c?.email ? `Mail: ${c.email}` : "",
    c?.telefono ? `Teléfono: ${c.telefono}` : "",
    c?.direccion ? `Dirección: ${c.direccion}` : "",
    c?.horarios ? `Horarios: ${c.horarios}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const cliente = opciones?.clienteRegistrado
    ? "\nSoy cliente registrado; estos son mis precios con descuento."
    : "";
  const bloqueDatos = datos ? `\n\nDatos de contacto:\n${datos}` : "";
  return `Hola MarvePack, quiero hacer este pedido:\n\n${items}\n\nTotal estimado: ${total}${cliente}${bloqueDatos}\n\n¿Me confirman stock y forma de entrega?`;
}
