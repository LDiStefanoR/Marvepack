import { promises as fs } from "fs";
import path from "path";
import {
  blobActivo,
  borrarFotoBlob,
  esUrlBlob,
  subirFotoBlob,
} from "@/lib/blob-datos";
import {
  borrarFotoCloudinary,
  cloudinaryActivo,
  esUrlCloudinary,
  subirFotoCloudinary,
} from "@/lib/cloudinary";
import {
  borrarFotoDrive,
  type CarpetaFotos,
  driveFotosActivo,
  subirFotoDrive,
} from "@/lib/drive-fotos";
import {
  borrarFotoTurso,
  esUrlMediaTurso,
  subirFotoTurso,
} from "@/lib/turso-media";
import { tursoConfigurado } from "@/lib/turso";

export function parsearRutaFoto(ruta: string) {
  const limpia = ruta.replace(/\\/g, "/");
  const m = limpia.match(
    /^\/recursos\/(imagenes-productos|imagenes-rubros|web)\/([^/]+)$/,
  );
  if (!m) return null;
  return { carpeta: m[1] as CarpetaFotos, nombre: m[2] };
}

function blobSuspendido(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return /suspended/i.test(msg);
}

export async function guardarFotoSitio(opts: {
  carpeta: CarpetaFotos;
  nombre: string;
  buffer: Buffer;
  mime: string;
}) {
  if (cloudinaryActivo()) {
    try {
      const url = await subirFotoCloudinary({
        carpeta: opts.carpeta,
        nombre: opts.nombre,
        buffer: opts.buffer,
        mime: opts.mime,
      });
      if (url) return url;
    } catch (error) {
      console.error("[foto] cloudinary", error);
    }
  }

  // Preferimos Turso: Blob del proyecto está suspendido / no confiable
  if (tursoConfigurado()) {
    try {
      const url = await subirFotoTurso(opts);
      if (url) return url;
    } catch (error) {
      console.error("[foto] turso", error);
      if (process.env.VERCEL) {
        throw error instanceof Error
          ? error
          : new Error("No se pudo guardar la foto en Turso.");
      }
    }
  }

  // Blob solo si sigue activo; si está suspended, seguimos sin romper
  if (blobActivo()) {
    try {
      const url = await subirFotoBlob(
        opts.carpeta,
        opts.nombre,
        opts.buffer,
        opts.mime,
      );
      if (url) return url;
    } catch (error) {
      console.error("[foto] blob", error);
      if (!blobSuspendido(error) && process.env.VERCEL && !tursoConfigurado()) {
        throw error instanceof Error
          ? error
          : new Error("No se pudo guardar la foto en Vercel Blob.");
      }
    }
  }

  if (process.env.VERCEL) {
    throw new Error(
      "No hay dónde guardar fotos en internet. Configurá TURSO_DATABASE_URL y TURSO_AUTH_TOKEN (o Cloudinary) en Vercel.",
    );
  }

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
    }
  }

  return `/recursos/${opts.carpeta}/${opts.nombre}`;
}

export async function borrarFotoSitioSiLibre(
  ruta: string | undefined,
  usadas: Iterable<string>,
) {
  if (!ruta) return;
  const set = new Set(usadas);
  if (set.has(ruta)) return;

  if (esUrlCloudinary(ruta)) {
    await borrarFotoCloudinary(ruta);
    return;
  }

  if (esUrlMediaTurso(ruta)) {
    await borrarFotoTurso(ruta);
    return;
  }

  if (esUrlBlob(ruta)) {
    await borrarFotoBlob(ruta).catch(() => undefined);
    return;
  }

  const parsed = parsearRutaFoto(ruta);
  if (!parsed) return;

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
