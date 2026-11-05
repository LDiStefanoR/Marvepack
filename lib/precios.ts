import type { AjustesPrecios } from "@/types/ajustes";
import type { RolUsuario, SesionPublica } from "@/types/auth";
import type { ModoPrecio, Producto, ProductoVitrina } from "@/types/producto";
import type { Oferta } from "@/types/promo";
import { formatoPesos } from "@/lib/format";

export function precioLista(producto: Producto, ajustes: AjustesPrecios) {
  const extra = ajustes.ajustePorSeccion[producto.seccion] ?? 0;
  return Math.round(producto.precio * (1 + extra / 100));
}

/** Precio del catálogo web: base, más el ajuste del rubro y el recargo del catálogo. */
export function precioWeb(producto: Producto, ajustes: AjustesPrecios) {
  const recargo = ajustes.recargoWeb ?? 0;
  return Math.round(precioLista(producto, ajustes) * (1 + recargo / 100));
}

export function sinStock(stock: number | null | undefined) {
  return typeof stock === "number" && stock <= 0;
}

function dtoDeMapa(
  seccion: string,
  mapa: Record<string, number> | undefined,
  general: number,
) {
  if (Object.prototype.hasOwnProperty.call(mapa ?? {}, seccion)) {
    return mapa![seccion];
  }
  return general;
}

/** Descuento de clientes de comercio: general, o el propio del rubro/producto. */
export function descuentoClienteDe(seccion: string, ajustes: AjustesPrecios) {
  return dtoDeMapa(
    seccion,
    ajustes.descuentoClientePorSeccion,
    ajustes.descuentoClienteGenerico,
  );
}

/** Descuento de empleados: ficha personal, o el del rubro, o el general de empleados. */
export function descuentoEmpleadoDe(
  seccion: string,
  ajustes: AjustesPrecios,
  ficha?: number | null,
) {
  const propio = Math.min(100, Math.max(0, Math.round(ficha ?? 0)));
  if (propio > 0) return propio;
  return dtoDeMapa(
    seccion,
    ajustes.descuentoEmpleadoPorSeccion,
    ajustes.descuentoEmpleadoGenerico ?? 0,
  );
}

export function esEmpleadoRol(rol?: RolUsuario | string | null) {
  return rol === "caja";
}

export function precioConDescuentoCliente(lista: number, descuento: number) {
  return Math.round(lista * (1 - descuento / 100));
}

export function modoPrecio(sesion: SesionPublica | null): ModoPrecio {
  if (sesion?.rol === "admin") return "admin";
  if (sesion?.rol === "caja") return "empleado";
  if (sesion?.rol === "cliente") return "cliente";
  return "publico";
}

export function precioPromoDe(
  producto: Producto,
  lista: number,
  oferta?: Oferta | null,
) {
  if (oferta?.tipo === "precio" && oferta.precioPromo && oferta.precioPromo > 0) {
    return Math.round(oferta.precioPromo);
  }
  if (oferta && oferta.tipo !== "precio") return null;
  if (!producto.promoActiva) return null;
  const promo = Math.round(Number(producto.precioPromo) || 0);
  if (promo < 1) return lista;
  return promo;
}

export function armarVitrina(
  producto: Producto,
  sesion: SesionPublica | null,
  ajustes: AjustesPrecios,
  oferta?: Oferta | null,
): ProductoVitrina {
  const lista = precioWeb(producto, ajustes);
  const especialCliente =
    sesion?.rol === "cliente"
      ? Math.min(100, Math.max(0, Math.round(sesion.descuento ?? 0)))
      : 0;
  const generalCliente = Math.max(0, descuentoClienteDe(producto.seccion, ajustes));
  const descuentoCliente = especialCliente > 0 ? especialCliente : generalCliente;
  const descuentoEmpleado = descuentoEmpleadoDe(
    producto.seccion,
    ajustes,
    sesion?.rol === "caja" ? sesion.descuento : 0,
  );
  const cliente = precioConDescuentoCliente(lista, descuentoCliente);
  const empleado = precioConDescuentoCliente(lista, descuentoEmpleado);
  const promo = precioPromoDe(producto, lista, oferta);
  const esPromo = Boolean(oferta?.activa) || Boolean(producto.promoActiva);
  const tipoPromo = oferta?.tipo;
  const modo = modoPrecio(sesion);

  const aplicaPrecio = tipoPromo === "precio" || (!oferta && promo != null);
  const mejorPublico = aplicaPrecio && promo != null ? Math.min(promo, lista) : lista;
  const mejorCliente =
    aplicaPrecio && promo != null ? Math.min(promo, cliente) : cliente;
  const mejorEmpleado =
    aplicaPrecio && promo != null ? Math.min(promo, empleado) : empleado;

  if (modo === "cliente") {
    return {
      ...producto,
      precio: mejorCliente,
      precioLista: lista,
      precioMostrar: mejorCliente,
      precioCliente: cliente,
      descuentoCliente,
      esPromo,
      tipoPromo,
    };
  }

  if (modo === "empleado") {
    return {
      ...producto,
      precio: mejorEmpleado,
      precioLista: lista,
      precioMostrar: mejorEmpleado,
      precioCliente: empleado,
      descuentoCliente: descuentoEmpleado,
      esPromo,
      tipoPromo,
    };
  }

  if (modo === "admin") {
    return {
      ...producto,
      precio: lista,
      precioLista: lista,
      precioMostrar: lista,
      precioCliente: cliente,
      descuentoCliente,
      esPromo,
      tipoPromo,
      notaAdmin: esPromo
        ? tipoPromo === "2x1" || tipoPromo === "3x2"
          ? `Promo ${tipoPromo}`
          : `Promo ${formatoPesos(mejorPublico)}`
        : `Clientes ${descuentoCliente}% · Empleados ${descuentoEmpleado}%`,
    };
  }

  return {
    ...producto,
    precio: mejorPublico,
    precioLista: lista,
    precioMostrar: mejorPublico,
    precioCliente: cliente,
    descuentoCliente,
    esPromo,
    tipoPromo,
  };
}
