import { promises as fs } from "fs";
import path from "path";
import {
  borrarFotoDrive,
  type CarpetaFotos,
  driveFotosActivo,
  subirFotoDrive,
} from "@/lib/drive-fotos";

export function parsearRutaFoto(ruta: string) {
  const limpia = ruta.replace(/\\/g, "/");
  const m = limpia.match(
    /^\/recursos\/(imagenes-productos|imagenes-rubros|web)\/([^/]+)$/,
  );
  if (!m) return null;
  return { carpeta: m[1] as CarpetaFotos, nombre: m[2] };
}

export async function guardarFotoSitio(opts: {
  carpeta: CarpetaFotos;
  nombre: string;
  buffer: Buffer;
  mime: string;
}) {
  const destRecursos = path.join(
    process.cwd(),
    "recursos",
    opts.carpeta,
    opts.nombre,
  );
  const destPublic = path.join(
    process.cwd(),
    "public",
    "recursos",
    opts.carpeta,
    opts.nombre,
  );
  await fs.mkdir(path.dirname(destRecursos), { recursive: true });
  await fs.mkdir(path.dirname(destPublic), { recursive: true });
  await fs.writeFile(destRecursos, opts.buffer);
  await fs.writeFile(destPublic, opts.buffer);

  if (driveFotosActivo()) {
    try {
      await subirFotoDrive({
        carpeta: opts.carpeta,
        nombre: opts.nombre,
        buffer: opts.buffer,
        mime: opts.mime,
      });
    } catch (error) {
      console.error("[drive] No se pudo subir la foto", error);
      throw new Error(
        "La foto no se pudo guardar en Drive. Compartí la carpeta con la cuenta de servicio de Google.",
      );
    }
  }

  return `/recursos/${opts.carpeta}/${opts.nombre}`;
}

export async function borrarFotoSitioSiLibre(
  ruta: string | undefined,
  usadas: Iterable<string>,
) {
  if (!ruta) return;
  const parsed = parsearRutaFoto(ruta);
  if (!parsed) return;
  const set = new Set(usadas);
  if (set.has(ruta)) return;

  const destRecursos = path.join(
    process.cwd(),
    "recursos",
    parsed.carpeta,
    parsed.nombre,
  );
  const destPublic = path.join(
    process.cwd(),
    "public",
    "recursos",
    parsed.carpeta,
    parsed.nombre,
  );
  await fs.unlink(destRecursos).catch(() => undefined);
  await fs.unlink(destPublic).catch(() => undefined);
  if (driveFotosActivo()) {
    await borrarFotoDrive(parsed.carpeta, parsed.nombre).catch((error) => {
      console.error("[drive] No se pudo borrar la foto", error);
    });
  }
}
