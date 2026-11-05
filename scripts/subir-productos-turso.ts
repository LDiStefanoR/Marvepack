/**
 * Sube solo data/productos.json a Turso (documento + tabla).
 * No toca usuarios, pedidos ni cuentas.
 */
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnv();

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) {
  console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local");
  process.exit(1);
}

const db = createClient({ url, authToken });
const body = readFileSync(resolve("data/productos.json"), "utf8");
const productos = JSON.parse(body) as Array<{
  id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: number;
  precioMayorista?: number;
  imagen?: string;
  descripcion?: string;
}>;

async function main() {
  await db.execute({
    sql: `INSERT INTO data_docs (name, body, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(name) DO UPDATE SET
            body = excluded.body,
            updated_at = datetime('now')`,
    args: ["productos.json", body],
  });
  console.log(`data_docs ← productos.json (${body.length} bytes)`);

  await db.execute("DELETE FROM productos");
  const batchSize = 40;
  for (let i = 0; i < productos.length; i += batchSize) {
    const slice = productos.slice(i, i + batchSize);
    await db.batch(
      slice.map((p) => ({
        sql: `INSERT INTO productos (
                id, codigo, nombre, seccion, precio, precio_mayorista, imagen, descripcion, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          p.id,
          p.codigo ?? "",
          p.nombre ?? "",
          p.seccion ?? "VARIOS",
          Number(p.precio) || 0,
          p.precioMayorista ?? null,
          p.imagen ?? "",
          p.descripcion ?? "",
        ],
      })),
    );
  }
  const count = await db.execute("SELECT COUNT(*) AS n FROM productos");
  console.log(`tabla productos ← ${count.rows[0]?.n} filas`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
