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

async function asegurarTabla() {
  const db = getTurso();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS media (
      path TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      body BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
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

export async function leerFotoTurso(pathname: string) {
  if (!tursoConfigurado()) return null;
  try {
    await asegurarTabla();
    const db = getTurso();
    const result = await db.execute({
      sql: "SELECT mime, body FROM media WHERE path = ?",
      args: [pathname],
    });
    const row = result.rows[0];
    if (!row?.body) return null;
    const body =
      row.body instanceof ArrayBuffer
        ? Buffer.from(row.body)
        : Buffer.from(row.body as ArrayBuffer | Uint8Array | string);
    const mime =
      typeof row.mime === "string" && row.mime
        ? row.mime
        : "application/octet-stream";
    return { body, type: mime };
  } catch (error) {
    console.error("[turso-media] lectura", pathname, error);
    return null;
  }
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
