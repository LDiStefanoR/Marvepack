import { promises as fs } from "fs";
import path from "path";
import type { Producto } from "@/types/producto";

const archivo = path.join(process.cwd(), "data", "productos.json");

export async function leerProductos(): Promise<Producto[]> {
  const raw = await fs.readFile(archivo, "utf8");
  const parsed = JSON.parse(raw) as Producto[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function guardarProductos(productos: Producto[]) {
  await fs.mkdir(path.dirname(archivo), { recursive: true });
  await fs.writeFile(archivo, JSON.stringify(productos, null, 2), "utf8");
}
