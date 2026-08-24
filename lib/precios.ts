import type { AjustesPrecios } from "@/types/ajustes";
import type { SesionPublica } from "@/types/auth";
import type { ModoPrecio, Producto, ProductoVitrina } from "@/types/producto";
import { formatoPesos } from "@/lib/format";

export function precioLista(producto: Producto, ajustes: AjustesPrecios) {
  const extra = ajustes.ajustePorSeccion[producto.seccion] ?? 0;
  return Math.round(producto.precio * (1 + extra / 100));
}

export function descuentoClienteDe(
  seccion: string,
  ajustes: AjustesPrecios,
) {
  if (Object.prototype.hasOwnProperty.call(ajustes.descuentoClientePorSeccion ?? {}, seccion)) {
    return ajustes.descuentoClientePorSeccion[seccion];
  }
  return ajustes.descuentoClienteGenerico;
}

export function precioConDescuentoCliente(lista: number, descuento: number) {
  return Math.round(lista * (1 - descuento / 100));
}

export function modoPrecio(sesion: SesionPublica | null): ModoPrecio {
  if (sesion?.rol === "admin") return "admin";
  if (sesion?.rol === "cliente") return "cliente";
  return "publico";
}

export function armarVitrina(
  producto: Producto,
  sesion: SesionPublica | null,
  ajustes: AjustesPrecios,
): ProductoVitrina {
  const lista = precioLista(producto, ajustes);
  const descuento = descuentoClienteDe(producto.seccion, ajustes);
  const cliente = precioConDescuentoCliente(lista, descuento);
  const modo = modoPrecio(sesion);
  const propio = Object.prototype.hasOwnProperty.call(
    ajustes.descuentoClientePorSeccion,
    producto.seccion,
  );

  if (modo === "cliente") {
    return {
      ...producto,
      precio: cliente,
      precioLista: lista,
      precioMostrar: cliente,
      descuentoCliente: descuento,
    };
  }

  if (modo === "admin") {
    return {
      ...producto,
      precio: lista,
      precioLista: lista,
      precioMostrar: lista,
      descuentoCliente: descuento,
      notaAdmin: propio
        ? `Dto. clientes de este rubro: ${descuento}% → ${formatoPesos(cliente)}`
        : `Dto. clientes registrados: ${descuento}% → ${formatoPesos(cliente)}`,
    };
  }

  return {
    ...producto,
    precio: lista,
    precioLista: lista,
    precioMostrar: lista,
    descuentoCliente: descuento,
  };
}
