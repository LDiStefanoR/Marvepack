import { promises as fs } from "fs";
import path from "path";

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

export async function leerJsonData<T>(nombre: string, vacio: T): Promise<T> {
  for (const dir of directoriosLectura()) {
    try {
      const raw = await fs.readFile(path.join(dir, nombre), "utf8");
      const parsed = JSON.parse(raw) as T;
      return parsed;
    } catch {
      /* probar siguiente */
    }
  }
  return vacio;
}

export async function escribirJsonData(nombre: string, valor: unknown) {
  const dir = directorioEscritura();
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, nombre),
      JSON.stringify(valor, null, 2),
      "utf8",
    );
  } catch (error) {
    console.error(`[data] No se pudo guardar ${nombre}`, error);
  }
}
