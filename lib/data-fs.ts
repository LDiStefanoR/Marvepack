import { promises as fs } from "fs";
import path from "path";
import {
  blobActivo,
  guardarDatoBlob,
  leerDatoBlob,
} from "@/lib/blob-datos";
import {
  guardarDocTurso,
  leerDocTurso,
  tursoConfigurado,
} from "@/lib/turso";

const memoria = new Map<string, string>();

function directorioEscritura() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "marvepack-data");
  }
  return path.join(process.cwd(), "data");
}

function directoriosLectura() {
  const tmp = path.join("/tmp", "marvepack-data");
  const repo = path.join(process.cwd(), "data");
  return process.env.VERCEL ? [tmp, repo] : [repo];
}

function parsear<T>(raw: string, vacio: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return vacio;
  }
}

function usarSoloTurso() {
  return tursoConfigurado();
}

export async function leerJsonData<T>(nombre: string, vacio: T): Promise<T> {
  if (!process.env.VERCEL) {
    const enMemoria = memoria.get(nombre);
    if (enMemoria) return parsear(enMemoria, vacio);
  }

  // Prioridad: Turso (reemplaza Vercel Blob para JSON de datos)
  if (tursoConfigurado()) {
    try {
      const remoto = await leerDocTurso(nombre);
      if (remoto) {
        memoria.set(nombre, remoto);
        return parsear(remoto, vacio);
      }
    } catch (error) {
      console.error(`[data] Turso lectura ${nombre}`, error);
    }
  }

  // Fallback legado: Blob (solo si Turso no está configurado)
  if (!usarSoloTurso()) {
    const remoto = await leerDatoBlob(nombre);
    if (remoto) {
      memoria.set(nombre, remoto);
      return parsear(remoto, vacio);
    }
  }

  for (const dir of directoriosLectura()) {
    try {
      const raw = await fs.readFile(path.join(dir, nombre), "utf8");
      memoria.set(nombre, raw);
      return parsear(raw, vacio);
    } catch {
      /* siguiente */
    }
  }

  return vacio;
}

async function escribirDisco(nombre: string, raw: string) {
  // En Vercel con Turso no hace falta disco; sin Turso y con Blob tampoco.
  if (process.env.VERCEL && (tursoConfigurado() || blobActivo())) return;
  const dir = directorioEscritura();
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, nombre), raw, "utf8");
  } catch (error) {
    console.error(`[data] No se pudo guardar ${nombre} en disco`, error);
  }
}

export async function escribirJsonData(nombre: string, valor: unknown) {
  const raw = JSON.stringify(valor, null, 2);
  memoria.set(nombre, raw);
  await escribirDisco(nombre, raw);

  if (tursoConfigurado()) {
    const ok = await guardarDocTurso(nombre, raw);
    if (!ok) {
      throw new Error(
        `No se pudo guardar ${nombre} en Turso. Revisá TURSO_DATABASE_URL y TURSO_AUTH_TOKEN.`,
      );
    }
    return true;
  }

  // Legado: Vercel Blob (dejar de usar cuando Turso esté en producción)
  if (!blobActivo()) return true;
  const ok = await guardarDatoBlob(nombre, raw);
  if (!ok) {
    console.error(`[data] No se pudo guardar ${nombre} en Vercel Blob.`);
    return false;
  }
  return true;
}
