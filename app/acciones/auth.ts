"use server";

import { redirect } from "next/navigation";
import { borrarSesion, guardarSesion } from "@/lib/sesion";
import {
  buscarUsuarioPorEmail,
  asegurarAdminConClave,
  solicitarCuenta,
  verificarPassword,
} from "@/lib/usuarios";
import { PASSWORD_ADMIN_SEMILLA } from "@/lib/auth-config";
import type { PerfilCliente, TipoPersona } from "@/types/auth";

export type EstadoAuth = { error?: string; ok?: string } | null;

function texto(form: FormData, campo: string) {
  return String(form.get(campo) ?? "").trim();
}

function perfilDesdeForm(form: FormData): PerfilCliente {
  const tipo = texto(form, "tipoPersona") as TipoPersona;
  return {
    tipoPersona: tipo === "empresa" ? "empresa" : "persona",
    tipoLocal: texto(form, "tipoLocal"),
    productosInteres: texto(form, "productosInteres"),
    direccion: texto(form, "direccion"),
    telefono: texto(form, "telefono"),
    horarioAtencion: texto(form, "horarioAtencion"),
    deseaAsesor: texto(form, "deseaAsesor") === "si",
  };
}

export async function ingresar(
  _prev: EstadoAuth,
  form: FormData,
): Promise<EstadoAuth> {
  const email = texto(form, "email");
  const password = texto(form, "password");
  const recordar = texto(form, "recordar") === "1";
  if (!email || !password) {
    return { error: "Completá mail y contraseña." };
  }
  let usuario = await buscarUsuarioPorEmail(email);
  const claveOk =
    usuario && (await verificarPassword(usuario, password));
  if (!claveOk) {
    const esAdmin =
      email.replace(/\s+/g, "").toLowerCase().includes("digitalpre");
    if (esAdmin && password === PASSWORD_ADMIN_SEMILLA) {
      usuario = await asegurarAdminConClave(password);
    } else {
      usuario = null;
    }
  }
  if (!usuario) {
    return { error: "Mail o contraseña incorrectos." };
  }
  if (usuario.estado === "pendiente") {
    return {
      error:
        "Tu solicitud todavía no fue aceptada. Cuando el administrador la apruebe vas a poder ingresar.",
    };
  }
  if (usuario.estado === "rechazada") {
    return {
      error:
        "Tu solicitud no fue aceptada. Escribinos por WhatsApp si querés más información.",
    };
  }
  try {
    await guardarSesion(
      {
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
      { recordar },
    );
  } catch (error) {
    console.error("[auth] No se pudo crear la sesión", error);
    return {
      error:
        "No se pudo iniciar sesión. En Vercel tiene que estar cargada la variable AUTH_SECRET.",
    };
  }
  redirect(usuario.rol === "admin" ? "/admin" : "/catalogo");
}

export async function registrar(
  _prev: EstadoAuth,
  form: FormData,
): Promise<EstadoAuth> {
  const password = texto(form, "password");
  const repetir = texto(form, "repetir");
  if (password !== repetir) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (texto(form, "deseaAsesor") !== "si" && texto(form, "deseaAsesor") !== "no") {
    return { error: "Indicá si querés que un asesor se comunique." };
  }
  const resultado = await solicitarCuenta({
    nombre: texto(form, "nombre"),
    email: texto(form, "email"),
    password,
    perfil: perfilDesdeForm(form),
  });
  if ("error" in resultado) return { error: resultado.error };
  return {
    ok: "Recibimos tu solicitud. Cuando el administrador la acepte vas a poder ingresar con tu mail y contraseña.",
  };
}

export async function salir() {
  await borrarSesion();
  redirect("/");
}
