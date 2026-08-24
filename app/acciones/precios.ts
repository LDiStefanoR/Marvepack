"use server";

import { leerAjustes } from "@/lib/ajustes";
import { armarVitrina } from "@/lib/precios";
import { leerProductos } from "@/lib/productos";
import { getSesion } from "@/lib/sesion";

export async function preciosParaCarrito(ids: string[]) {
  const sesion = await getSesion();
  const ajustes = await leerAjustes();
  const productos = await leerProductos();
  const set = new Set(ids);
  return productos
    .filter((p) => set.has(p.id))
    .map((p) => {
      const vitrina = armarVitrina(p, sesion, ajustes);
      return {
        id: p.id,
        precio: vitrina.precioMostrar,
        precioLista: vitrina.precioLista,
        descuentoCliente: vitrina.descuentoCliente,
      };
    });
}
