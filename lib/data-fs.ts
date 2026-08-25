import { promises as fs } from "fs";
import path from "path";
import {
  guardarArchivoGithub,
  leerArchivoGithub,
} from "@/lib/github-datos";

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
  return process.env.VERCEL ? [tmp, repo] : [repo, tmp];
}

function parsear<T>(raw: string, vacio: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return vacio;
  }
}

export async function leerJsonData<T>(nombre: string, vacio: T): Promise<T> {
  const enMemoria = memoria.get(nombre);
  if (enMemoria) return parsear(enMemoria, vacio);

  const remoto = await leerArchivoGithub(nombre);
  if (remoto?.contenido) {
    memoria.set(nombre, remoto.contenido);
    await escribirDisco(nombre, remoto.contenido);
    return parsear(remoto.contenido, vacio);
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
  const ok = await guardarArchivoGithub(nombre, raw);
  if (!ok && process.env.VERCEL === "1") {
    console.error(
      `[data] ${nombre} no se pudo guardar en GitHub. Cargá GITHUB_DATA_TOKEN en Vercel.`,
    );
  }
}
