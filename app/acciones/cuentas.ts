"use server";

import { revalidatePath } from "next/cache";
import { cambiarEstadoPedido, listarPedidos } from "@/lib/pedidos";
import { getSesion } from "@/lib/sesion";
import {
  actualizarPerfilUsuario,
  cambiarEstadoCuenta,
  cambiarPasswordUsuario,
  cambiarRolUsuario,
  crearUsuarioAdmin,
  eliminarUsuario,
  listarUsuarios,
} from "@/lib/usuarios";
import type { EstadoCuenta, PerfilCliente, RolUsuario, TipoPersona } from "@/types/auth";
import type { EstadoPedido } from "@/types/pedido";

export type EstadoAdminCuentas = { error?: string; ok?: string } | null;

async function exigirAdmin() {
  const sesion = await getSesion();
  return sesion?.rol === "admin" ? sesion : null;
}

export async function contarAlertasAdmin() {
  if (!(await exigirAdmin())) {
    return { solicitudes: 0, pedidosNuevos: 0 };
  }
  const [usuarios, pedidos] = await Promise.all([
    listarUsuarios(),
    listarPedidos(),
  ]);
  return {
    solicitudes: usuarios.filter((u) => u.estado === "pendiente").length,
    pedidosNuevos: pedidos.filter((p) => p.estado === "sin_atender").length,
  };
}

function revalidar() {
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
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
  if (!["sin_atender", "en_proceso", "terminado"].includes(estado)) {
    return { error: "Estado no válido." };
  }
  const resultado = await cambiarEstadoPedido(id, estado);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Actualizamos el estado del pedido." };
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
  if (rol !== "admin" && rol !== "cliente") return { error: "Permiso no válido." };
  const resultado = await cambiarRolUsuario(id, rol);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return {
    ok:
      rol === "admin"
        ? "Ahora tiene permiso de administrador."
        : "Ahora tiene permiso general (cliente).",
  };
}

export async function adminCambiarPassword(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const resultado = await cambiarPasswordUsuario(
    texto(form, "id"),
    texto(form, "password"),
  );
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Actualizamos la contraseña." };
}

export async function adminCrearUsuario(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const rol = texto(form, "rol") as RolUsuario;
  const resultado = await crearUsuarioAdmin({
    email: texto(form, "email"),
    nombre: texto(form, "nombre"),
    password: texto(form, "password"),
    rol: rol === "admin" ? "admin" : "cliente",
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: `Creamos la cuenta de ${resultado.usuario.email}.` };
}

export async function adminEliminarUsuario(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  const sesion = await exigirAdmin();
  if (!sesion) return { error: "No tenés permiso." };
  const resultado = await eliminarUsuario(texto(form, "id"), sesion.email);
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Eliminamos la cuenta." };
}

export async function adminGuardarPerfil(
  form: FormData,
): Promise<EstadoAdminCuentas> {
  if (!(await exigirAdmin())) return { error: "No tenés permiso." };
  const tipo = texto(form, "tipoPersona") as TipoPersona;
  const perfil: PerfilCliente = {
    tipoPersona: tipo === "empresa" ? "empresa" : "persona",
    tipoLocal: texto(form, "tipoLocal"),
    productosInteres: texto(form, "productosInteres"),
    direccion: texto(form, "direccion"),
    telefono: texto(form, "telefono"),
    horarioAtencion: texto(form, "horarioAtencion"),
    deseaAsesor: texto(form, "deseaAsesor") === "si",
  };
  const resultado = await actualizarPerfilUsuario(texto(form, "id"), {
    nombre: texto(form, "nombre"),
    perfil,
  });
  if ("error" in resultado) return { error: resultado.error };
  revalidar();
  return { ok: "Guardamos los datos de contacto." };
}
