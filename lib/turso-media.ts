import { getTurso, tursoConfigurado } from "@/lib/turso";

export function rutaMedia(carpeta: string, nombre: string) {
  return `fotos/${carpeta}/${nombre}`;
}

export function urlMediaPublica(carpeta: string, nombre: string) {
  return `/api/media/${rutaMedia(carpeta, nombre)}`;
}

export function esUrlMediaTurso(url: string) {
  return url.startsWith("/api/media/fotos/");
}

let tablaLista: Promise<void> | null = null;

function asegurarTabla() {
  if (!tablaLista) {
    const db = getTurso();
    tablaLista = db
      .execute(`
        CREATE TABLE IF NOT EXISTS media (
          path TEXT PRIMARY KEY,
          mime TEXT NOT NULL,
          body BLOB NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      .then(() => undefined)
      .catch((error) => {
        tablaLista = null;
        throw error;
      });
  }
  return tablaLista;
}

export async function subirFotoTurso(opts: {
  carpeta: string;
  nombre: string;
  buffer: Buffer;
  mime: string;
}) {
  if (!tursoConfigurado()) return null;
  await asegurarTabla();
  const path = rutaMedia(opts.carpeta, opts.nombre);
  const db = getTurso();
  await db.execute({
    sql: `INSERT INTO media (path, mime, body, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(path) DO UPDATE SET
            mime = excluded.mime,
            body = excluded.body,
            updated_at = datetime('now')`,
    args: [path, opts.mime || "application/octet-stream", opts.buffer],
  });
  return urlMediaPublica(opts.carpeta, opts.nombre);
}

function blobABuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (typeof value === "string") return Buffer.from(value, "base64");
  throw new Error("Formato de imagen no reconocido");
}

function filaAFoto(row: { mime?: unknown; body?: unknown } | null | undefined) {
  if (!row?.body) return null;
  const body = blobABuffer(row.body);
  if (!body.length) return null;
  const type =
    typeof row.mime === "string" && row.mime
      ? row.mime
      : "application/octet-stream";
  return { body, type };
}

export async function leerFotoTurso(pathname: string) {
  if (!tursoConfigurado()) return null;
  try {
    await asegurarTabla();
    const db = getTurso();
    const result = await db.execute({
      sql: "SELECT mime, body FROM media WHERE path = ?",
      args: [pathname],
    });
    const row = result.rows[0] as { mime?: unknown; body?: unknown } | undefined;
    return filaAFoto(row);
  } catch (error) {
    console.error("[turso-media] lectura", pathname, error);
    return null;
  }
}

/** Lectura por lotes para el respaldo: un viaje por grupo, no uno por foto. */
export async function leerFotosTurso(pathnames: string[]) {
  const unicos = [...new Set(pathnames.filter(Boolean))];
  const out = new Map<string, { body: Buffer; type: string }>();
  if (!unicos.length || !tursoConfigurado()) return out;
  try {
    await asegurarTabla();
    const db = getTurso();
    const LOTE = 6;
    for (let i = 0; i < unicos.length; i += LOTE) {
      const slice = unicos.slice(i, i + LOTE);
      const result = await db.execute({
        sql: `SELECT path, mime, body FROM media WHERE path IN (${slice.map(() => "?").join(",")})`,
        args: slice,
      });
      for (const row of result.rows) {
        const raw = row as { path?: unknown; mime?: unknown; body?: unknown };
        const path = typeof raw.path === "string" ? raw.path : "";
        const foto = filaAFoto(raw);
        if (path && foto) out.set(path, foto);
      }
    }
  } catch (error) {
    console.error("[turso-media] lectura lote", error);
  }
  return out;
}

export async function borrarFotoTurso(url: string) {
  if (!tursoConfigurado() || !esUrlMediaTurso(url)) return;
  const pathname = decodeURIComponent(url.slice("/api/media/".length));
  const db = getTurso();
  await db
    .execute({
      sql: "DELETE FROM media WHERE path = ?",
      args: [pathname],
    })
    .catch((error) => {
      console.error("[turso-media] borrar", error);
    });
}
