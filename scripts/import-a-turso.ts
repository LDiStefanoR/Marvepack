/**
 * Migra data/*.json → Turso y deja de depender de Vercel Blob para esos archivos.
 *
 * Uso:
 *   npx tsx scripts/import-a-turso.ts
 *
 * Requiere TURSO_* en .env.local
 */
import { createClient } from "@libsql/client";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

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
const dataDir = resolve("data");
const schemaPath = resolve("scripts/turso-schema.sql");

async function runSqlFile(path: string) {
  const sql = readFileSync(path, "utf8");
  const statements = sql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
  for (const statement of statements) {
    await db.execute(statement);
  }
}

async function upsertDoc(name: string, body: string) {
  await db.execute({
    sql: `INSERT INTO data_docs (name, body, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(name) DO UPDATE SET
            body = excluded.body,
            updated_at = datetime('now')`,
    args: [name, body],
  });
}

async function syncProductosNormalizados(body: string) {
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
  if (!Array.isArray(productos)) return 0;

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
  return productos.length;
}

async function syncRubrosNormalizados(body: string) {
  const rubros = JSON.parse(body) as Array<{
    clave: string;
    etiqueta: string;
    imagen?: string;
  }>;
  if (!Array.isArray(rubros)) return 0;
  await db.execute("DELETE FROM rubros");
  await db.batch(
    rubros
      .filter((r) => r?.clave)
      .map((r) => ({
        sql: `INSERT INTO rubros (clave, etiqueta, imagen) VALUES (?, ?, ?)`,
        args: [r.clave, r.etiqueta || r.clave, r.imagen ?? null],
      })),
  );
  return rubros.length;
}

async function main() {
  console.log("Aplicando schema Turso…");
  await runSqlFile(schemaPath);

  // Limpiar demo viejo si existía en el scaffold anterior
  for (const table of ["products", "categories", "offers", "inquiries"]) {
    try {
      await db.execute(`DROP TABLE IF EXISTS ${table}`);
    } catch {
      /* ignore */
    }
  }

  const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  console.log(`Importando ${files.length} archivos desde data/…`);

  for (const file of files) {
    const body = readFileSync(join(dataDir, file), "utf8");
    await upsertDoc(file, body);
    console.log(`  ✓ data_docs ← ${file} (${body.length} bytes)`);

    if (file === "productos.json") {
      const n = await syncProductosNormalizados(body);
      console.log(`  ✓ productos (tabla) ← ${n} filas`);
    }
    if (file === "rubros.json") {
      const n = await syncRubrosNormalizados(body);
      console.log(`  ✓ rubros (tabla) ← ${n} filas`);
    }
    if (file === "ajustes.json") {
      await db.execute("DELETE FROM ajustes");
      await db.execute({
        sql: "INSERT INTO ajustes (id, body) VALUES (1, ?)",
        args: [body],
      });
      console.log("  ✓ ajustes (tabla) ← ok");
    }
  }

  const docs = await db.execute(
    "SELECT name, length(body) AS bytes, updated_at FROM data_docs ORDER BY name",
  );
  console.log("\nDocumentos en Turso:");
  for (const row of docs.rows) {
    console.log(`  - ${row.name}: ${row.bytes} bytes (${row.updated_at})`);
  }

  const count = await db.execute("SELECT COUNT(*) AS n FROM productos");
  console.log(`\nProductos normalizados: ${count.rows[0]?.n}`);
  console.log("Importación OK. La app puede usar Turso sin Vercel Blob para datos.");
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
