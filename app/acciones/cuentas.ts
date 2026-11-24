"use server";

import { revalidatePath } from "next/cache";
import { cambiarEstadoPedido, cancelarPedido, listarPedidos, ajustarMontoRecarga, resolverRecarga } from "@/lib/pedidos";
import { puedeCobrar } from "@/lib/roles";
import { quitarFiadoPorEmail } from "@/lib/cuentas";
import { getSesion } from "@/lib/sesion";
import {
  actualizarPerfilUsuario,
  actualizarTipoCuenta,
  buscarUsuarioPorId,
  cambiarEmailUsuario,
  cambiarEstadoCuenta,
  cambiarPasswordUsuario,
  cambiarRolUsuario,
  crearUsuarioAdmin,
  eliminarUsuario,
  listarUsuarios,
} from "@/lib/usuarios";
import { parseTipoCuenta } from "@/lib/tipo-cuenta";
import type { EstadoCuenta, PerfilCliente, RolUsuario, TipoPersona } from "@/types/auth";
import type { EstadoPedido } from "@/types/pedido";

export type EstadoAdminCuentas = { error?: string; ok?: string } | null;

async function exigirAdmin() {
  const sesion = await getSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

export async function contarAlertasAdmin() {
  const sesion = await getSesion();
  if (!sesion || !puedeCobrar(sesion.rol)) {
    return { solicitudes: 0, pedidosNuevos: 0, novedades: 0, total: 0 };
  }
  const { contarNovedadesPendientes } = await import("@/lib/cuentas");
  const [usuarios, pedidos, novedades] = await Promise.all([
    listarUsuarios(),
    listarPedidos(),
    contarNovedadesPendientes(),
  ]);
  const pedidosNuevos = pedidos.filter((p) => !p.esRecarga && p.estado === "sin_atender").length;
  if (sesion.rol !== "admin") {
    return { solicitudes: 0, pedidosNuevos, novedades: 0, total: pedidosNuevos };
  }
  const solicitudes = usuarios.filter((u) => u.estado === "pendiente").length;
  return {
    solicitudes,
    pedidosNuevos,
    novedades,
    total: solicitudes + pedidosNuevos + novedades,
  };
}

function revalidar() {
  revalidatePath("/admin/clientes", "layout");
  revalidatePath("/admin/cuentas", "layout");
  revalidatePath("/admin/pedidos");
  revalidatePath("/caja");
  revalidatePath("/admin");
  revalidatePath("/catalogo");
  revalidatePath("/cuenta");
  revalidatePath("/", "layout");
}

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

export async function adminCambiarEstadoPedido(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const estado = texto(form, "estado") as EstadoPedido;
  if (!["sin_atender", "en_proceso", "enviando", "terminado"].includes(estado)) {
    return { error: "Estado no válido." };
  }
  const resultado = await cambiarEstadoPedido(id, estado);
  if ("error" in resultado) return { error: resultado.error };
  if (estado === "terminado" && resultado.pedido.esCredito) {
    const { acreditarCreditoSiCorresponde } = await import("@/lib/pedidos");
    const credito = await acreditarCreditoSiCorresponde(id);
    if ("error" in credito) return { error: credito.error };
  }
  revalidar();
  return {
    ok: resultado.pedido.esCredito && estado === "terminado"
      ? "Marcamos el crédito como entregado y lo cargamos en la deuda del cliente."
      : "Actualizamos el estado del pedido.",
  };
}

export async function adminCancelarPedido(form: FormData): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await cancelarPedido(texto(form, "id"), texto(form, "motivo"));
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Cancelamos el pedido. Motivo: ${resultado.motivo}.` };
}

export async function adminResolverRecarga(form: FormData): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const acreditar = texto(form, "acreditar") === "1";
  const id = texto(form, "id");
  if (acreditar) {
    const monto = Math.round(Number(String(form.get("monto") ?? "").replace(/[^\d]/g, "")));
    if (monto > 0) {
      const ajuste = await ajustarMontoRecarga(id, monto);
      if ("error" in ajuste) return { error: ajuste.error };
    }
  }
  const resultado = await resolverRecarga(id, acreditar);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok: acreditar
      ? `Acreditamos ${resultado.pedido.total} al saldo de ${resultado.pedido.contacto.nombre}.`
      : "Rechazamos la recarga. El saldo no cambió.",
  };
}

export async function adminResolverCredito(
  _form: FormData,
): Promise<EstadoAdminCuentas> {
  return { error: "Los préstamos en efectivo ya no se aceptan. La línea de crédito es fiado del catálogo." };
}

export async function resolverSolicitudRegistro(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const decision = texto(form, "decision");
  const rol = texto(form, "rol") as RolUsuario;
  const tipo = parseTipoCuenta(texto(form, "tipoCuenta"));
  const conCredito = texto(form, "credito") === "1";
  const montoCredito = Math.max(0, Math.round(Number(texto(form, "montoCredito").replace(/\./g, "").replace(",", ".")) || 0));
  const descuentoEspecial = Math.min(90, Math.max(0, Math.round(Number(texto(form, "descuentoEspecial")) || 0)));
  if (decision !== "aceptar" && decision !== "rechazar") {
    return { error: "Elegí aceptar o rechazar." };
  }
  if (rol !== "admin" && rol !== "cliente" && rol !== "caja") {
    return { error: "Elegí un perfil." };
  }
  const usuario = await buscarUsuarioPorId(id);
  if (!usuario || usuario.estado !== "pendiente") {
    return { error: "Esa solicitud ya no está pendiente." };
  }
  if (decision === "rechazar") {
    const rechazo = await cambiarEstadoCuenta(id, "rechazada");
    if ("error" in rechazo) return { error: rechazo.error };
    revalidar();
    return { ok: `Rechazamos la solicitud de ${usuario.nombre}.` };
  }
  const cambioRol = await cambiarRolUsuario(id, rol);
  if ("error" in cambioRol) return { error: cambioRol.error };
  if (rol === "cliente") {
    if (conCredito && montoCredito < 1) return { error: "Ingresá cuánto de crédito dejás." };
    const { leerAjustes } = await import("@/lib/ajustes");
    const tope = (await leerAjustes()).topeFiado;
    if (conCredito && montoCredito > tope) {
      return { error: `El crédito no puede pasar el tope general de ${tope} pesos.` };
    }
    const cambioTipo = await actualizarTipoCuenta(id, tipo, {
      creditoMercaderia: conCredito,
      descuento: tipo === "descuento_especial" ? descuentoEspecial : 0,
    });
    if ("error" in cambioTipo) return { error: cambioTipo.error };
  }
  const alta = await cambiarEstadoCuenta(id, "activa");
  if ("error" in alta) return { error: alta.error };
  if (rol === "cliente") {
    const { asegurarFichaRegistro, asegurarClienteCredito } = await import("@/lib/cuentas");
    await asegurarFichaRegistro({
      nombre: usuario.nombre,
      telefono: usuario.perfil?.telefono ?? "",
      email: usuario.email,
    });
    if (conCredito) {
      await asegurarClienteCredito({
        email: usuario.email,
        nombre: usuario.nombre,
        telefono: usuario.perfil?.telefono ?? "",
        limiteAlmacen: montoCredito,
        limiteEfectivo: 0,
        credito: true,
      });
    }
  }
  revalidar();
  return {
    ok: rol === "cliente"
      ? `Aceptamos a ${usuario.nombre} y creamos la ficha de cliente.`
      : `Aceptamos a ${usuario.nombre}.`,
  };
}

export async function adminCambiarEstadoCuenta(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const estado = texto(form, "estado") as EstadoCuenta;
  if (!["pendiente", "activa", "rechazada"].includes(estado)) {
    return { error: "Estado no válido." };
  }
  const resultado = await cambiarEstadoCuenta(id, estado);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  const mensaje =
    estado === "activa"
      ? "Aceptamos la cuenta. Ya puede ingresar."
      : estado === "rechazada"
        ? "Rechazamos la solicitud."
        : "Actualizamos el estado de la cuenta.";
  return { ok: mensaje };
}

export async function adminCambiarRol(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const rol = texto(form, "rol") as RolUsuario;
  if (rol !== "admin" && rol !== "cliente" && rol !== "caja") {
    return { error: "Permiso no válido." };
  }
  const resultado = await cambiarRolUsuario(id, rol);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok:
      rol === "admin"
        ? "Ahora tiene permiso de administrador."
        : rol === "caja"
          ? "Ahora puede cobrar en la caja."
          : "Ahora tiene permiso general (cliente).",
  };
}

export async function adminCambiarPassword(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const password = texto(form, "password");
  const id = texto(form, "id");
  const usuario = await buscarUsuarioPorId(id);
  if (!usuario) return { error: "No encontramos esa cuenta." };
  const resultado = await cambiarPasswordUsuario(id, password);
  if ("error" in resultado) return { error: resultado.error };
  if (usuario.rol === "cliente") {
    const { guardarClaveCliente } = await import("@/lib/cuentas");
    await guardarClaveCliente({
      email: usuario.email,
      nombre: usuario.nombre,
      telefono: usuario.perfil?.telefono ?? "",
      clave: password,
    });
  }
  revalidar();
  return { ok: "Actualizamos la contraseña." };
}

export async function adminCambiarEmail(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await cambiarEmailUsuario(
    texto(form, "id"),
    texto(form, "email"),
  );
  if ("error" in resultado) return { error: resultado.error };
  const { actualizarEmailClienteFiado } = await import("@/lib/cuentas");
  await actualizarEmailClienteFiado(resultado.anterior, resultado.email);
  revalidar();
  revalidatePath("/cuenta");
  return { ok: `El mail quedó en ${resultado.email}.` };
}

export async function adminCrearUsuario(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const rol = texto(form, "rol") as RolUsuario;
  const { parseTipoCuenta } = await import("@/lib/tipo-cuenta");
  const tipo = parseTipoCuenta(texto(form, "tipoCuenta"));
  const resultado = await crearUsuarioAdmin({
    email: texto(form, "email"),
    nombre: texto(form, "nombre"),
    password: texto(form, "password"),
    rol: rol === "admin" ? "admin" : "cliente",
    tipoCuenta: tipo,
  });
  if ("error" in resultado) return { error: resultado.error };
  if (resultado.usuario.rol === "cliente") {
    const { asegurarClienteCredito } = await import("@/lib/cuentas");
    await asegurarClienteCredito({
      email: resultado.usuario.email,
      nombre: resultado.usuario.nombre,
      telefono: resultado.usuario.perfil?.telefono ?? "",
      limiteAlmacen: 0,
      limiteEfectivo: 0,
      credito: false,
    });
  }
  revalidar();
  return { ok: `Creamos la cuenta de ${resultado.usuario.email}.` };
}

export async function adminEliminarUsuario(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  const sesion = await exigirAdmin();
  if (!sesion) return { error: "No tenés permiso." };
  const id = texto(form, "id");
  const usuario = await buscarUsuarioPorId(id);
  const resultado = await eliminarUsuario(id, sesion.email);
  if ("error" in resultado) return { error: resultado.error };
  if (usuario?.rol === "cliente") await quitarFiadoPorEmail(usuario.email);
  revalidar();
  return { ok: "Eliminamos la cuenta." };
}

export async function adminGuardarPerfil(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const tipo = texto(form, "tipoPersona") as TipoPersona;
  const franja = texto(form, "franjaReparto");
  const perfil: PerfilCliente = {
    tipoPersona: tipo === "empresa" ? "empresa" : "persona",
    tipoLocal: texto(form, "tipoLocal"),
    productosInteres: texto(form, "productosInteres"),
    direccion: texto(form, "direccion"),
    telefono: texto(form, "telefono"),
    horarioAtencion: texto(form, "horarioAtencion"),
    deseaAsesor: false,
    franjaReparto: franja === "tarde" || franja === "manana" ? franja : undefined,
  };
  const resultado = await actualizarPerfilUsuario(texto(form, "id"), {
    nombre: texto(form, "nombre"),
    perfil,
    notaInterna: texto(form, "notaInterna"),
  });
  if ("error" in resultado) return { error: resultado.error };
  const { asegurarFichaCliente, actualizarContactoFiado } = await import(
    "@/lib/cuentas"
  );
  if (resultado.usuario.rol === "cliente") {
    await asegurarFichaCliente({
      email: resultado.usuario.email,
      nombre: resultado.usuario.nombre,
      telefono: perfil.telefono,
    });
  }
  await actualizarContactoFiado(resultado.usuario.email, {
    telefono: perfil.telefono,
    nombre: resultado.usuario.nombre,
  });
  revalidar();
  return { ok: "Guardamos la ficha." };
}

export async function adminGuardarCreditoCliente(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const { parseTipoCuenta, mensajeGuardarTipo } = await import("@/lib/tipo-cuenta");
  const id = texto(form, "id");
  const tipo = parseTipoCuenta(texto(form, "tipoCuenta"));
  const conCredito = texto(form, "credito") === "1";
  const usuarios = await listarUsuarios();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos ese cliente." };
  const monto = Number(texto(form, "montoCredito").replace(/\./g, "").replace(",", ".")) || 0;
  const descuento = Math.min(90, Math.max(0, Math.round(Number(texto(form, "descuentoEspecial")) || 0)));
  if (conCredito && monto < 1) return { error: "Ingresá cuánto de crédito dejás." };
  const { leerAjustes } = await import("@/lib/ajustes");
  const tope = (await leerAjustes()).topeFiado;
  if (conCredito && monto > tope) {
    return { error: `El crédito no puede pasar el tope general de ${tope} pesos.` };
  }
  const resultado = await actualizarTipoCuenta(id, tipo, {
    creditoMercaderia: conCredito,
    descuento: tipo === "descuento_especial" ? descuento : 0,
  });
  if ("error" in resultado) return { error: resultado.error };
  const { asegurarClienteCredito } = await import("@/lib/cuentas");
  await asegurarClienteCredito({
    email: usuario.email,
    nombre: usuario.nombre,
    telefono: usuario.perfil?.telefono ?? "",
    limiteAlmacen: conCredito ? monto : 0,
    limiteEfectivo: 0,
    credito: conCredito,
  });
  revalidar();
  revalidatePath("/cuenta");
  revalidatePath("/catalogo");
  revalidatePath("/admin/cuentas");
  return { ok: mensajeGuardarTipo(tipo) };
}
