import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function tursoConfigurado() {
  return Boolean(
    process.env.TURSO_DATABASE_URL?.trim() &&
      process.env.TURSO_AUTH_TOKEN?.trim(),
  );
}

export function getTurso(): Client {
  if (!tursoConfigurado()) {
    throw new Error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
  }
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!.trim(),
      authToken: process.env.TURSO_AUTH_TOKEN!.trim(),
    });
  }
  return client;
}

export async function leerDocTurso(nombre: string): Promise<string | null> {
  if (!tursoConfigurado()) return null;
  const db = getTurso();
  const result = await db.execute({
    sql: "SELECT body FROM data_docs WHERE name = ?",
    args: [nombre],
  });
  const body = result.rows[0]?.body;
  return typeof body === "string" ? body : null;
}

export async function guardarDocTurso(nombre: string, body: string) {
  if (!tursoConfigurado()) return false;
  const db = getTurso();
  await db.execute({
    sql: `INSERT INTO data_docs (name, body, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(name) DO UPDATE SET
            body = excluded.body,
            updated_at = datetime('now')`,
    args: [nombre, body],
  });
  return true;
}
