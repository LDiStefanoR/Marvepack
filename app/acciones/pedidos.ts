"use server";

import { revalidatePath } from "next/cache";
import { resumenPorEmail } from "@/lib/cuentas";
import { leerAjustes } from "@/lib/ajustes";
import { plazoCredito, simularCredito, tasasCredito } from "@/lib/credito-cuotas";
import { formatoFecha } from "@/lib/format";
import { crearPedido, crearPedidoCredito, crearRecargaCuenta, listarPedidos } from "@/lib/pedidos";
import { buscarUsuarioPorEmail, recordarDireccion } from "@/lib/usuarios";
import { getSesion } from "@/lib/sesion";
import type { LineaCarrito } from "@/lib/carrito";
import type {
  ContactoPedido,
  FormaPagoPedido,
  FranjaReparto,
  ModoEntrega,
  SiFaltaProducto,
} from "@/types/pedido";
import type { PerfilCliente } from "@/types/auth";

export type EstadoPedidoWeb = { error?: string; ok?: string } | null;

export async function leerMiPerfil(): Promise<{
  nombre: string;
  email: string;
  perfil?: PerfilCliente;
  direcciones: string[];
  cuenta: { habilitada: boolean; disponible: number; saldo: number };
} | null> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol === "admin") return null;
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario || usuario.estado !== "activa") return null;
  const vinculo = await resumenPorEmail(usuario.email);
  const limite = vinculo?.resumen.cliente.limiteAlmacen ?? 0;
  const cargadas = [
    usuario.perfil?.direccion ?? "",
    ...(usuario.perfil?.direcciones ?? []),
  ]
    .map((d) => d.trim())
    .filter((d, i, lista) => d.length >= 5 && lista.findIndex((o) => o.trim().toLowerCase() === d.toLowerCase()) === i);
  return {
    nombre: usuario.nombre,
    email: usuario.email,
    perfil: usuario.perfil,
    direcciones: cargadas,
    cuenta: {
      habilitada: vinculo?.resumen.cliente.mostrarCuenta === true && limite > 0,
      disponible: vinculo?.resumen.disponibleAlmacen ?? 0,
      saldo: Math.max(0, Math.round(vinculo?.resumen.cliente.saldo ?? 0)),
    },
  };
}

export async function solicitarRecargaSaldo(monto: number): Promise<EstadoPedidoWeb> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== "cliente") return { error: "Tenés que entrar con tu cuenta." };
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario || usuario.estado !== "activa") return { error: "No encontramos tu cuenta." };
  const resultado = await crearRecargaCuenta({
    usuarioId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    telefono: usuario.perfil?.telefono ?? "",
    monto,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidatePath("/admin/pedidos");
  revalidatePath("/caja");
  revalidatePath("/cuenta");
  return { ok: "Avisamos al local. Cuando confirme la transferencia, el saldo se suma." };
}

function fechaMinimaCredito() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(Date.now() + 48 * 60 * 60 * 1000));
}

export async function solicitarCreditoCuenta(input: {
  monto: number;
  plazo: number;
  cuando: "48h" | "fecha";
  fecha?: string;
}): Promise<EstadoPedidoWeb> {
  const sesion = await getSesion();
  if (!sesion || sesion.rol !== "cliente") return { error: "Tenés que entrar con tu cuenta." };
  const usuario = await buscarUsuarioPorEmail(sesion.email);
  if (!usuario || usuario.estado !== "activa") return { error: "No encontramos tu cuenta." };
  const vinculo = await resumenPorEmail(usuario.email);
  const cliente = vinculo?.resumen.cliente;
  if (!cliente || cliente.mostrarPrestamos !== true || cliente.limiteEfectivo < 1) {
    return { error: "El local todavía no habilitó los préstamos en tu cuenta." };
  }
  const disponible = vinculo.resumen.disponibleEfectivo;
  const monto = Math.round(Number(input.monto) || 0);
  if (monto < 1) return { error: "Ingresá el monto del crédito." };
  if (monto > disponible) {
    return { error: "Ese monto supera lo que tenés disponible." };
  }
  const ajustes = await leerAjustes();
  const plan = tasasCredito({ ...cliente, bases: ajustes.tasasCuota });
  const plazo = plazoCredito(input.plazo);
  if (!plan.plazos.includes(plazo)) return { error: "Ese plazo no está habilitado en tu línea." };
  const minima = fechaMinimaCredito();
  const cuando = input.cuando === "fecha" ? "fecha" : "48h";
  const fecha = cuando === "fecha" ? String(input.fecha ?? "").slice(0, 10) : minima;
  if (cuando === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { error: "Elegí el día en que querés recibir el dinero." };
  }
  if (fecha < minima) {
    return { error: "El crédito se pide con al menos 48 horas de anticipación." };
  }
  const pedidos = await listarPedidos();
  const yaPendiente = pedidos.some(
    (pedido) =>
      pedido.esCredito &&
      pedido.contacto.email.trim().toLowerCase() === usuario.email.trim().toLowerCase() &&
      pedido.estado !== "cancelado" &&
      pedido.estado !== "terminado",
  );
  if (yaPendiente) {
    return { error: "Ya tenés un pedido de crédito pendiente. Esperá a que el local lo resuelva." };
  }
  const simulado = simularCredito(monto, plazo, plan.tasas[plazo]);
  const detalle =
    cuando === "fecha"
      ? `Quiere recibir el dinero el ${formatoFecha(fecha)}.`
      : "Quiere recibir el dinero apenas pasen 48 horas de la aprobación.";
  const resultado = await crearPedidoCredito({
    usuarioId: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    telefono: usuario.perfil?.telefono ?? "",
    capital: simulado.capital,
    interes: simulado.interes,
    total: simulado.total,
    cuotas: simulado.cuotas,
    tasa: simulado.tasa,
    cuandoRecibe: cuando,
    fechaEntrega: fecha,
    detalleEntrega: detalle,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidatePath("/admin/pedidos");
  revalidatePath("/caja");
  revalidatePath("/cuenta");
  revalidatePath("/", "layout");
  return {
    ok: "El pedido quedó pendiente. El local lo va a revisar y, si lo aprueba, te entrega el dinero en el momento que elegiste.",
  };
}

export async function enviarPedidoWeb(
  lineas: LineaCarrito[],
  contacto: ContactoPedido,
  opciones: {
    franjaReparto: FranjaReparto;
    siFaltaProducto?: SiFaltaProducto;
    modoEntrega: ModoEntrega;
    fechaEntrega: string;
    pago?: { forma: FormaPagoPedido; cuentaCorriente: number };
  },
): Promise<EstadoPedidoWeb> {
  const sesion = await getSesion();
  const clienteRegistrado = sesion?.rol === "cliente";
  const usuario = clienteRegistrado
    ? await buscarUsuarioPorEmail(sesion.email)
    : null;
  const vinculo =
    usuario && clienteRegistrado ? await resumenPorEmail(usuario.email) : null;
  const limite = vinculo?.resumen.cliente.limiteAlmacen ?? 0;

  const resultado = await crearPedido({
    lineas,
    contacto,
    franjaReparto: opciones.franjaReparto,
    siFaltaProducto: opciones.siFaltaProducto,
    modoEntrega: opciones.modoEntrega,
    fechaEntrega: opciones.fechaEntrega,
    pago: opciones.pago,
    cuenta: {
      habilitada: vinculo?.resumen.cliente.mostrarCuenta === true && limite > 0,
      disponible: vinculo?.resumen.disponibleAlmacen ?? 0,
      saldo: Math.max(0, Math.round(vinculo?.resumen.cliente.saldo ?? 0)),
    },
    clienteRegistrado,
    usuarioId: usuario?.id,
  });
  if ("error" in resultado) return { error: resultado.error };
  if (usuario) await recordarDireccion(usuario.id, contacto.direccion);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/pedidos");
  revalidatePath("/caja");
  revalidatePath("/cuenta");
  revalidatePath("/", "layout");
  return {
    ok: "Recibimos tu pedido. Lo vamos a atender y te vamos a contactar.",
  };
}
