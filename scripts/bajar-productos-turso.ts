/**
 * Baja data_docs productos.json desde Turso a data/productos.json.
 * No toca otros documentos.
 */
import { createClient } from "@libsql/client";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
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

async function main() {
  const db = createClient({ url, authToken });
  const result = await db.execute({
    sql: "SELECT body, updated_at FROM data_docs WHERE name = ?",
    args: ["productos.json"],
  });
  const body = result.rows[0]?.body;
  if (typeof body !== "string") {
    console.error("Turso no tiene productos.json");
    process.exit(1);
  }
  const productos = JSON.parse(body);
  if (!Array.isArray(productos)) {
    console.error("productos.json de Turso no es una lista");
    process.exit(1);
  }
  writeFileSync(
    resolve("data/productos.json"),
    `${JSON.stringify(productos, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Turso → data/productos.json (${productos.length} productos, updated_at ${result.rows[0]?.updated_at ?? "?"})`,
  );
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
