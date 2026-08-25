import { randomUUID } from "crypto";
import { totalCarrito, type LineaCarrito } from "@/lib/carrito";
import { escribirJsonData, leerJsonData } from "@/lib/data-fs";
import type { ContactoPedido, EstadoPedido, Pedido } from "@/types/pedido";

async function leerArchivo(): Promise<Pedido[]> {
  const parsed = await leerJsonData<Pedido[]>("pedidos.json", []);
  return Array.isArray(parsed) ? parsed : [];
}

async function escribirArchivo(pedidos: Pedido[]) {
  await escribirJsonData("pedidos.json", pedidos);
}

export async function listarPedidos() {
  const pedidos = await leerArchivo();
  return pedidos.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export function validarContacto(contacto: ContactoPedido) {
  if (contacto.nombre.trim().length < 2) return "Ingresá un nombre.";
  if (!contacto.email.includes("@")) return "Ingresá un mail válido.";
  if (contacto.telefono.replace(/\D/g, "").length < 8) {
    return "Ingresá un teléfono válido.";
  }
  if (contacto.direccion.trim().length < 5) return "Ingresá una dirección.";
  if (contacto.horarios.trim().length < 3) {
    return "Ingresá los horarios para recibir.";
  }
  return null;
}

export async function crearPedido(datos: {
  lineas: LineaCarrito[];
  contacto: ContactoPedido;
  clienteRegistrado: boolean;
  usuarioId?: string;
}) {
  if (datos.lineas.length === 0) {
    return { error: "El pedido está vacío." as const };
  }
  const error = validarContacto(datos.contacto);
  if (error) return { error };
  const pedidos = await leerArchivo();
  const pedido: Pedido = {
    id: randomUUID(),
    creadoEn: new Date().toISOString(),
    estado: "sin_atender",
    canal: "web",
    clienteRegistrado: datos.clienteRegistrado,
    usuarioId: datos.usuarioId,
    contacto: {
      nombre: datos.contacto.nombre.trim(),
      email: datos.contacto.email.trim().toLowerCase(),
      telefono: datos.contacto.telefono.trim(),
      direccion: datos.contacto.direccion.trim(),
      horarios: datos.contacto.horarios.trim(),
    },
    lineas: datos.lineas.map((l) => ({
      id: l.id,
      codigo: l.codigo,
      nombre: l.nombre,
      precio: l.precio,
      precioLista: l.precioLista,
      cantidad: l.cantidad,
    })),
    total: totalCarrito(datos.lineas),
  };
  pedidos.push(pedido);
  await escribirArchivo(pedidos);
  return { pedido };
}

export async function cambiarEstadoPedido(id: string, estado: EstadoPedido) {
  const pedidos = await leerArchivo();
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return { error: "No encontramos ese pedido." as const };
  pedido.estado = estado;
  await escribirArchivo(pedidos);
  return { pedido };
}
