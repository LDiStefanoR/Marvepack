import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { EMAIL_ADMIN, EMAIL_CLIENTE_DEMO } from "@/lib/auth-config";
import type {
  EstadoCuenta,
  PerfilCliente,
  RolUsuario,
  Usuario,
  UsuarioPublico,
} from "@/types/auth";

const archivo = path.join(process.cwd(), "data", "usuarios.json");
const rondas = 10;

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export function sinPassword(usuario: Usuario): UsuarioPublico {
  const { passwordHash: _omitido, ...resto } = usuario;
  return resto;
}

function normalizarUsuario(
  raw: Partial<Usuario> & Pick<Usuario, "email" | "id">,
): Usuario {
  return {
    id: raw.id,
    email: normalizarEmail(raw.email),
    nombre: raw.nombre?.trim() || raw.email,
    rol: raw.rol === "admin" ? "admin" : "cliente",
    passwordHash: raw.passwordHash ?? "",
    estado: raw.estado ?? "activa",
    perfil: raw.perfil,
    creadoEn: raw.creadoEn ?? new Date().toISOString(),
  };
}

async function leerArchivo(): Promise<Usuario[]> {
  try {
    const raw = await fs.readFile(archivo, "utf8");
    const parsed = JSON.parse(raw) as Partial<Usuario>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u) => u?.id && u?.email)
      .map((u) => normalizarUsuario(u as Usuario));
  } catch {
    return [];
  }
}

async function escribirArchivo(usuarios: Usuario[]) {
  await fs.mkdir(path.dirname(archivo), { recursive: true });
  await fs.writeFile(archivo, JSON.stringify(usuarios, null, 2), "utf8");
}

async function asegurarSemilla() {
  const usuarios = await leerArchivo();
  const porEmail = new Map(usuarios.map((u) => [normalizarEmail(u.email), u]));
  let cambio = false;

  const semillas = [
    {
      email: EMAIL_ADMIN,
      nombre: "Administración",
      rol: "admin" as const,
      password: "Oficina123",
      perfil: undefined as PerfilCliente | undefined,
    },
    {
      email: EMAIL_CLIENTE_DEMO,
      nombre: "Cliente genérico",
      rol: "cliente" as const,
      password: "Oficina123",
      perfil: {
        tipoPersona: "persona" as const,
        tipoLocal: "Comercio",
        productosInteres: "Descartables en general",
        direccion: "Hilarión de la Quintana 2667, Rosario",
        telefono: "3410000000",
        horarioAtencion: "Lunes a viernes 9 a 18",
        deseaAsesor: false,
      },
    },
  ];

  for (const s of semillas) {
    const email = normalizarEmail(s.email);
    const existente = porEmail.get(email);
    if (existente) {
      if (existente.estado !== "activa") {
        existente.estado = "activa";
        cambio = true;
      }
      if (s.perfil && !existente.perfil) {
        existente.perfil = s.perfil;
        cambio = true;
      }
      continue;
    }
    const passwordHash = await bcrypt.hash(s.password, rondas);
    const creado: Usuario = {
      id: randomUUID(),
      email,
      nombre: s.nombre,
      rol: s.rol,
      passwordHash,
      estado: "activa",
      perfil: s.perfil,
      creadoEn: new Date().toISOString(),
    };
    usuarios.push(creado);
    porEmail.set(email, creado);
    cambio = true;
  }

  if (cambio) await escribirArchivo(usuarios);
  return usuarios;
}

export async function listarUsuarios() {
  return asegurarSemilla();
}

export async function buscarUsuarioPorEmail(email: string) {
  const usuarios = await asegurarSemilla();
  const clave = normalizarEmail(email);
  return usuarios.find((u) => u.email === clave) ?? null;
}

export async function buscarUsuarioPorId(id: string) {
  const usuarios = await asegurarSemilla();
  return usuarios.find((u) => u.id === id) ?? null;
}

export function validarPerfil(perfil: PerfilCliente) {
  if (perfil.tipoPersona !== "persona" && perfil.tipoPersona !== "empresa") {
    return "Elegí si sos persona o empresa.";
  }
  if (perfil.tipoLocal.trim().length < 2) return "Ingresá el tipo de local.";
  if (perfil.productosInteres.trim().length < 3) {
    return "Contanos qué productos te interesan.";
  }
  if (perfil.direccion.trim().length < 5) return "Ingresá una dirección.";
  if (perfil.telefono.replace(/\D/g, "").length < 8) {
    return "Ingresá un teléfono válido.";
  }
  if (perfil.horarioAtencion.trim().length < 3) {
    return "Ingresá el horario de atención.";
  }
  return null;
}

export async function solicitarCuenta(datos: {
  email: string;
  nombre: string;
  password: string;
  perfil: PerfilCliente;
}) {
  const email = normalizarEmail(datos.email);
  if (!email.includes("@")) {
    return { error: "Ingresá un mail válido." as const };
  }
  if (datos.nombre.trim().length < 2) {
    return { error: "Ingresá tu nombre o razón social." as const };
  }
  if (datos.password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." as const };
  }
  const errorPerfil = validarPerfil(datos.perfil);
  if (errorPerfil) return { error: errorPerfil };
  if (email === EMAIL_ADMIN) {
    return { error: "Ese mail no se puede usar para registrarse." as const };
  }

  const usuarios = await asegurarSemilla();
  if (usuarios.some((u) => u.email === email)) {
    return { error: "Ese mail ya está registrado o tiene una solicitud." as const };
  }

  const passwordHash = await bcrypt.hash(datos.password, rondas);
  const usuario: Usuario = {
    id: randomUUID(),
    email,
    nombre: datos.nombre.trim(),
    rol: "cliente",
    passwordHash,
    estado: "pendiente",
    perfil: {
      ...datos.perfil,
      tipoLocal: datos.perfil.tipoLocal.trim(),
      productosInteres: datos.perfil.productosInteres.trim(),
      direccion: datos.perfil.direccion.trim(),
      telefono: datos.perfil.telefono.trim(),
      horarioAtencion: datos.perfil.horarioAtencion.trim(),
    },
    creadoEn: new Date().toISOString(),
  };
  usuarios.push(usuario);
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function crearUsuarioAdmin(datos: {
  email: string;
  nombre: string;
  password: string;
  rol: RolUsuario;
}) {
  const email = normalizarEmail(datos.email);
  if (!email.includes("@")) return { error: "Ingresá un mail válido." as const };
  if (datos.nombre.trim().length < 2) return { error: "Ingresá un nombre." as const };
  if (datos.password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." as const };
  }
  const usuarios = await asegurarSemilla();
  if (usuarios.some((u) => u.email === email)) {
    return { error: "Ese mail ya existe." as const };
  }
  const passwordHash = await bcrypt.hash(datos.password, rondas);
  const usuario: Usuario = {
    id: randomUUID(),
    email,
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    passwordHash,
    estado: "activa",
    creadoEn: new Date().toISOString(),
  };
  usuarios.push(usuario);
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function cambiarEstadoCuenta(id: string, estado: EstadoCuenta) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN && estado !== "activa") {
    return { error: "La cuenta principal de administración no se puede desactivar." as const };
  }
  usuario.estado = estado;
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function cambiarRolUsuario(id: string, rol: RolUsuario) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN && rol !== "admin") {
    return { error: "La cuenta principal tiene que seguir siendo administradora." as const };
  }
  const admins = usuarios.filter((u) => u.rol === "admin" && u.estado === "activa");
  if (usuario.rol === "admin" && rol !== "admin" && admins.length <= 1) {
    return { error: "Tiene que quedar al menos un administrador activo." as const };
  }
  usuario.rol = rol;
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function cambiarPasswordUsuario(id: string, password: string) {
  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." as const };
  }
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  usuario.passwordHash = await bcrypt.hash(password, rondas);
  await escribirArchivo(usuarios);
  return { ok: true as const };
}

export async function actualizarPerfilUsuario(
  id: string,
  datos: { nombre: string; perfil: PerfilCliente },
) {
  if (datos.nombre.trim().length < 2) return { error: "Ingresá un nombre." as const };
  const errorPerfil = validarPerfil(datos.perfil);
  if (errorPerfil) return { error: errorPerfil };
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  usuario.nombre = datos.nombre.trim();
  usuario.perfil = {
    ...datos.perfil,
    tipoLocal: datos.perfil.tipoLocal.trim(),
    productosInteres: datos.perfil.productosInteres.trim(),
    direccion: datos.perfil.direccion.trim(),
    telefono: datos.perfil.telefono.trim(),
    horarioAtencion: datos.perfil.horarioAtencion.trim(),
  };
  await escribirArchivo(usuarios);
  return { usuario: sinPassword(usuario) };
}

export async function eliminarUsuario(id: string, quienEliminaEmail: string) {
  const usuarios = await asegurarSemilla();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return { error: "No encontramos esa cuenta." as const };
  if (usuario.email === EMAIL_ADMIN) {
    return { error: "La cuenta principal de administración no se puede eliminar." as const };
  }
  if (usuario.email === normalizarEmail(quienEliminaEmail)) {
    return { error: "No podés eliminar tu propia cuenta." as const };
  }
  const admins = usuarios.filter((u) => u.rol === "admin" && u.estado === "activa");
  if (usuario.rol === "admin" && admins.length <= 1) {
    return { error: "Tiene que quedar al menos un administrador." as const };
  }
  await escribirArchivo(usuarios.filter((u) => u.id !== id));
  return { ok: true as const };
}

export async function verificarPassword(usuario: Usuario, password: string) {
  return bcrypt.compare(password, usuario.passwordHash);
}
