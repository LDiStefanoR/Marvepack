import { existsSync, promises as fs } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { BRAND_NAME } from "@/lib/brand";
import { leerVentasCaja, type VentaCaja } from "@/lib/caja";
import { leerCuentas } from "@/lib/cuentas";
import { leerProductos } from "@/lib/productos";
import { leerFotosTurso } from "@/lib/turso-media";
import { etiquetaFormaPago, fechaHoraVenta } from "@/lib/venta-texto";
import type { ClienteFiado } from "@/types/cuenta";
import type { Producto } from "@/types/producto";

const HOJA_PRODUCTOS = "Productos";
const HOJA_CLIENTES = "Clientes";
const HOJA_VENTAS = "Ventas";
const HOJA_LINEAS = "Lineas de venta";
const HOJAS_LINEAS = [HOJA_LINEAS, "LineasVenta", "Líneas de venta"];

function celdaTexto(valor: ExcelJS.CellValue): string {
  if (valor == null) return "";
  if (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean") {
    return String(valor).trim();
  }
  if (typeof valor === "object" && "text" in valor && typeof valor.text === "string") {
    return valor.text.trim();
  }
  if (valor instanceof Date) return valor.toISOString();
  return String(valor).trim();
}

function celdaNumero(valor: ExcelJS.CellValue, fallback = 0): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const n = Number(String(celdaTexto(valor)).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function celdaBool(valor: ExcelJS.CellValue, fallback = true): boolean {
  const t = celdaTexto(valor).toLowerCase();
  if (!t) return fallback;
  if (["1", "true", "si", "sí", "yes", "x"].includes(t)) return true;
  if (["0", "false", "no"].includes(t)) return false;
  return fallback;
}

function jsonCelda(valor: unknown): string {
  if (valor == null) return "";
  try {
    return JSON.stringify(valor);
  } catch {
    return "";
  }
}

function parsearJsonCelda<T>(valor: ExcelJS.CellValue): T | null {
  const texto = celdaTexto(valor);
  if (!texto || texto[0] !== "{" && texto[0] !== "[") return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

const CAMPOS_PRODUCTO = new Set([
  "id",
  "codigo",
  "nombre",
  "seccion",
  "precio",
  "precioMayorista",
  "costo",
  "margen",
  "stock",
  "stockMinimo",
  "imagen",
  "descripcion",
  "proveedorId",
  "codigosBarra",
  "mostrarEnCaja",
  "mostrarEnCatalogo",
]);

const CAMPOS_CLIENTE = new Set([
  "id",
  "nombre",
  "telefono",
  "email",
  "pinInicial",
  "limiteAlmacen",
  "limiteEfectivo",
  "aliasCbu",
  "activo",
  "saldo",
]);

function restoComoJson(dato: object, conocidos: Set<string>) {
  const extra: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(dato)) {
    if (conocidos.has(clave) || valor == null) continue;
    extra[clave] = valor;
  }
  return Object.keys(extra).length ? JSON.stringify(extra) : "";
}

function normalizarClave(texto: string) {
  const base = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  const alias: Record<string, string> = {
    rubro: "seccion",
    preciounitario: "precio",
    preciomayorista: "preciomayorista",
    stockminimo: "stockminimo",
    codigosdebarra: "codigosbarra",
    encaja: "mostrarencaja",
    encatalogo: "mostrarencatalogo",
    otrosdatos: "extra",
    pin: "pininicial",
    topedecredito: "limitealmacen",
    nfactura: "numero",
    numerofactura: "numero",
    nrofactura: "numero",
    pago: "formapago",
    formadepago: "formapago",
    fechaiso: "creadoen",
    mailempleado: "empleadoemail",
    idcliente: "clienteid",
    idventa: "ventaid",
    idproducto: "productoid",
    producto: "nombre",
    descontostock: "descontostock",
  };
  return alias[base] || base;
}

function mapaCabeceras(hoja: ExcelJS.Worksheet) {
  const mapa = new Map<string, number>();
  const fila = hoja.getRow(1);
  fila.eachCell((celda, col) => {
    const clave = normalizarClave(celdaTexto(celda.value));
    if (clave && !mapa.has(clave)) mapa.set(clave, col);
  });
  return mapa;
}

function hojaNombrada(workbook: ExcelJS.Workbook, nombres: string[]) {
  for (const nombre of nombres) {
    const hoja = workbook.getWorksheet(nombre);
    if (hoja) return hoja;
  }
  return undefined;
}

function partesFecha(iso: string) {
  const fecha = new Date(iso);
  if (!iso || Number.isNaN(fecha.getTime())) return { dia: "", hora: "" };
  return fechaHoraVenta(iso);
}

function siNo(valor: boolean) {
  return valor ? "Sí" : "No";
}

function valorCol(
  fila: ExcelJS.Row,
  mapa: Map<string, number>,
  ...nombres: string[]
): ExcelJS.CellValue {
  for (const nombre of nombres) {
    const col = mapa.get(nombre.toLowerCase());
    if (col != null) return fila.getCell(col).value;
  }
  return null;
}

function estiloEncabezado(hoja: ExcelJS.Worksheet) {
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B5FE0" },
  };
  fila.alignment = { vertical: "middle" };
  fila.height = 20;
}

const FOTO_LADO_MAX = 1200;
const FOTO_CALIDAD = 78;
const FOTO_BYTES_CHICA = 40 * 1024;
const EXT_FOTO = /\.(jpe?g|png|gif|webp)$/i;

type CarpetaFoto = "imagenes-productos" | "imagenes-rubros";

function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

function carpetaDeRuta(ruta: string): CarpetaFoto {
  return ruta.includes("imagenes-rubros") ? "imagenes-rubros" : "imagenes-productos";
}

function nombreArchivoImagen(imagen: string) {
  const limpio = imagen.split("?")[0].split("#")[0].replace(/\\/g, "/");
  const nombre = path.basename(limpio);
  return EXT_FOTO.test(nombre) ? nombre : "";
}

function pathnameMedia(imagen: string) {
  const limpio = imagen.split("?")[0].split("#")[0].replace(/\\/g, "/");
  const marca = "/api/media/";
  const i = limpio.indexOf(marca);
  if (i < 0) return "";
  const pathname = decodificar(limpio.slice(i + marca.length)).replace(/^\/+/, "");
  return pathname.startsWith("fotos/") ? pathname : "";
}

function rutaConNombre(imagen: string, nombre: string) {
  const hash = imagen.indexOf("#");
  const sinHash = hash >= 0 ? imagen.slice(0, hash) : imagen;
  const hashPart = hash >= 0 ? imagen.slice(hash) : "";
  const q = sinHash.indexOf("?");
  const pathPart = q >= 0 ? sinHash.slice(0, q) : sinHash;
  const query = q >= 0 ? sinHash.slice(q) : "";
  const slash = Math.max(pathPart.lastIndexOf("/"), pathPart.lastIndexOf("\\"));
  const prefix = slash >= 0 ? pathPart.slice(0, slash + 1) : "";
  return `${prefix}${nombre}${query}${hashPart}`;
}

function candidatosFotoLocal(imagen: string) {
  if (!imagen || /^https?:\/\//i.test(imagen)) return [];
  const nombre = nombreArchivoImagen(imagen);
  if (!nombre) return [];
  const limpio = imagen.split("?")[0].split("#")[0].replace(/\\/g, "/");
  const carpeta = carpetaDeRuta(limpio);
  const raiz = /* turbopackIgnore: true */ process.cwd();
  return [
    path.join(raiz, "recursos", carpeta, nombre),
    path.join(raiz, "public", "recursos", carpeta, nombre),
  ];
}

async function leerFotoLocal(imagen: string): Promise<Buffer | null> {
  for (const candidato of candidatosFotoLocal(imagen)) {
    try {
      const buffer = await fs.readFile(candidato);
      if (buffer.length > 0) return buffer;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

async function enParalelo<T, R>(
  items: readonly T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const trabajadores = Math.max(1, Math.min(limite, items.length || 1));
  await Promise.all(
    Array.from({ length: Math.min(trabajadores, Math.max(items.length, 1)) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await fn(items[index]);
      }
    }),
  );
  return out;
}

export async function comprimirFotoRespaldo(buffer: Buffer, nombre: string) {
  if (!EXT_FOTO.test(nombre)) return { nombre, buffer };
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    if ((meta.pages ?? 1) > 1) return { nombre, buffer };
    const ancho = meta.width ?? 0;
    const alto = meta.height ?? 0;
    const cabe = ancho > 0 && alto > 0 && ancho <= FOTO_LADO_MAX && alto <= FOTO_LADO_MAX;
    if (cabe && buffer.length <= FOTO_BYTES_CHICA) return { nombre, buffer };

    const webp = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: FOTO_LADO_MAX,
        height: FOTO_LADO_MAX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: FOTO_CALIDAD, effort: 4, smartSubsample: true })
      .toBuffer();

    if (webp.length >= buffer.length) return { nombre, buffer };
    return { nombre: nombre.replace(EXT_FOTO, ".webp"), buffer: webp };
  } catch (error) {
    console.error("[respaldo-foto] compresion", nombre, error);
    return { nombre, buffer };
  }
}

async function listarFotosCarpeta(carpeta: "imagenes-productos" | "imagenes-rubros") {
  const raiz = /* turbopackIgnore: true */ process.cwd();
  const dirs = [
    path.join(raiz, "recursos", carpeta),
    path.join(raiz, "public", "recursos", carpeta),
  ];
  const vistos = new Set<string>();
  const out: { nombre: string; buffer: Buffer; carpeta: string }[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const nombres = await fs.readdir(dir);
    for (const nombre of nombres) {
      if (vistos.has(nombre)) continue;
      if (!/\.(jpe?g|png|gif|webp)$/i.test(nombre)) continue;
      try {
        const buffer = await fs.readFile(path.join(dir, nombre));
        if (!buffer.length) continue;
        vistos.add(nombre);
        out.push({ nombre, buffer, carpeta });
      } catch {
        /* siguiente */
      }
    }
  }
  return out;
}

export async function armarExcelRespaldo(opts?: {
  productos?: Producto[];
  reescribirImagen?: (imagen: string) => string;
}) {
  const [productos, cuentas, ventas] = await Promise.all([
    opts?.productos ? Promise.resolve(opts.productos) : leerProductos(),
    leerCuentas(),
    leerVentasCaja(),
  ]);
  const clientes = cuentas.clientes;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND_NAME;
  workbook.created = new Date();
  workbook.description = "Respaldo MarvePack: productos, clientes y ventas";

  const pesos = '"$"#,##0';
  const productosOrden = [...productos].sort(
    (a, b) => a.nombre.localeCompare(b.nombre, "es") || a.codigo.localeCompare(b.codigo, "es"),
  );
  const clientesOrden = [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const ventasOrden = [...ventas].sort((a, b) => {
    const fecha = b.creadoEn.localeCompare(a.creadoEn);
    if (fecha !== 0) return fecha;
    return (b.numero || 0) - (a.numero || 0);
  });

  const hojaProd = workbook.addWorksheet(HOJA_PRODUCTOS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hojaProd.columns = [
    { header: "Código", key: "codigo", width: 12 },
    { header: "Nombre", key: "nombre", width: 48 },
    { header: "Rubro", key: "seccion", width: 18 },
    { header: "Precio", key: "precio", width: 14 },
    { header: "Precio mayorista", key: "precioMayorista", width: 16 },
    { header: "Costo", key: "costo", width: 12 },
    { header: "Margen", key: "margen", width: 10 },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Stock mínimo", key: "stockMinimo", width: 14 },
    { header: "Imagen", key: "imagen", width: 48 },
    { header: "Descripción", key: "descripcion", width: 40 },
    { header: "Id", key: "id", width: 16 },
    { header: "Proveedor", key: "proveedorId", width: 16 },
    { header: "Códigos de barra", key: "codigosBarra", width: 24 },
    { header: "En caja", key: "mostrarEnCaja", width: 12 },
    { header: "En catálogo", key: "mostrarEnCatalogo", width: 14 },
    { header: "Otros datos", key: "extra", width: 28 },
  ];
  estiloEncabezado(hojaProd);
  for (const p of productosOrden) {
    const fila = hojaProd.addRow({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      seccion: p.seccion,
      precio: p.precio,
      precioMayorista: p.precioMayorista ?? "",
      costo: p.costo ?? "",
      margen: p.margen ?? "",
      stock: p.stock ?? "",
      stockMinimo: p.stockMinimo ?? "",
      imagen: opts?.reescribirImagen ? opts.reescribirImagen(p.imagen) : p.imagen,
      descripcion: p.descripcion,
      proveedorId: p.proveedorId ?? "",
      codigosBarra: (p.codigosBarra ?? []).join("|"),
      mostrarEnCaja: siNo(p.mostrarEnCaja !== false),
      mostrarEnCatalogo: siNo(p.mostrarEnCatalogo !== false),
      extra: restoComoJson(p, CAMPOS_PRODUCTO),
    });
    fila.getCell("precio").numFmt = pesos;
    if (p.precioMayorista != null) fila.getCell("precioMayorista").numFmt = pesos;
    if (p.costo != null) fila.getCell("costo").numFmt = pesos;
  }
  hojaProd.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hojaProd.columnCount } };

  const hojaCli = workbook.addWorksheet(HOJA_CLIENTES, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hojaCli.columns = [
    { header: "Nombre", key: "nombre", width: 28 },
    { header: "Teléfono", key: "telefono", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Tope de crédito", key: "limiteAlmacen", width: 16 },
    { header: "Límite efectivo", key: "limiteEfectivo", width: 16 },
    { header: "Saldo", key: "saldo", width: 12 },
    { header: "Activo", key: "activo", width: 10 },
    { header: "Id", key: "id", width: 18 },
    { header: "PIN", key: "pinInicial", width: 12 },
    { header: "Alias", key: "aliasCbu", width: 18 },
    { header: "Otros datos", key: "extra", width: 28 },
  ];
  estiloEncabezado(hojaCli);
  for (const c of clientesOrden) {
    const fila = hojaCli.addRow({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
      pinInicial: c.pinInicial,
      limiteAlmacen: c.limiteAlmacen,
      limiteEfectivo: c.limiteEfectivo,
      aliasCbu: c.aliasCbu,
      activo: siNo(c.activo),
      saldo: c.saldo ?? 0,
      extra: restoComoJson(c, CAMPOS_CLIENTE),
    });
    fila.getCell("limiteAlmacen").numFmt = pesos;
    fila.getCell("limiteEfectivo").numFmt = pesos;
    fila.getCell("saldo").numFmt = pesos;
  }
  hojaCli.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hojaCli.columnCount } };

  const hojaVen = workbook.addWorksheet(HOJA_VENTAS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hojaVen.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Nº factura", key: "numero", width: 12 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Pago", key: "formaPago", width: 16 },
    { header: "Total", key: "total", width: 14 },
    { header: "Empleado", key: "empleado", width: 20 },
    { header: "Anulada", key: "anulada", width: 12 },
    { header: "Unidades", key: "unidades", width: 12 },
    { header: "Movimiento de stock", key: "movimiento", width: 36 },
    { header: "Id", key: "id", width: 36 },
    { header: "Fecha ISO", key: "creadoEn", width: 24 },
    { header: "Mail empleado", key: "empleadoEmail", width: 28 },
    { header: "Id cliente", key: "clienteId", width: 18 },
    { header: "Devoluciones", key: "devoluciones", width: 24 },
  ];
  estiloEncabezado(hojaVen);

  const hojaLin = workbook.addWorksheet(HOJA_LINEAS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  hojaLin.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Hora", key: "hora", width: 10 },
    { header: "Nº factura", key: "numero", width: 12 },
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Código", key: "codigo", width: 12 },
    { header: "Producto", key: "nombre", width: 42 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Precio unitario", key: "precio", width: 16 },
    { header: "Total", key: "importe", width: 14 },
    { header: "Movimiento de stock", key: "movimiento", width: 32 },
    { header: "Unidades de stock", key: "unidadesStock", width: 18 },
    { header: "Pago", key: "pago", width: 16 },
    { header: "Empleado", key: "empleado", width: 20 },
    { header: "Anulada", key: "anulada", width: 12 },
    { header: "Id venta", key: "ventaId", width: 36 },
    { header: "Id producto", key: "productoId", width: 16 },
    { header: "Descontó stock", key: "descontoStock", width: 16 },
    { header: "Fecha ISO", key: "creadoEn", width: 24 },
  ];
  estiloEncabezado(hojaLin);

  type FilaMovimiento = {
    iso: string;
    numero: number;
    orden: number;
    fecha: string;
    hora: string;
    cliente: string;
    tipo: string;
    codigo: string;
    nombre: string;
    cantidad: number;
    precio: number;
    importe: number;
    movimiento: string;
    unidadesStock: number;
    pago: string;
    empleado: string;
    anulada: string;
    ventaId: string;
    productoId: string;
    descontoStock: string;
    creadoEn: string;
  };
  const movimientos: FilaMovimiento[] = [];

  for (const v of ventasOrden) {
    const cuando = partesFecha(v.creadoEn);
    const pago = etiquetaFormaPago(v.formaPago);
    let salida = 0;
    let entrada = 0;
    let unidades = 0;
    for (const l of v.lineas) {
      unidades += l.cantidad;
      const mueve = l.descontoStock ? -l.cantidad : 0;
      if (mueve < 0) salida += l.cantidad;
      movimientos.push({
        iso: v.creadoEn,
        numero: v.numero || 0,
        orden: 2,
        fecha: cuando.dia,
        hora: cuando.hora,
        cliente: v.cliente,
        tipo: "Venta",
        codigo: l.codigo,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio: l.precio,
        importe: l.precio * l.cantidad,
        movimiento: l.descontoStock ? "Salida" : "Sin movimiento de stock",
        unidadesStock: mueve,
        pago,
        empleado: v.empleado,
        anulada: siNo(Boolean(v.anulada)),
        ventaId: v.id,
        productoId: l.productoId,
        descontoStock: siNo(l.descontoStock),
        creadoEn: v.creadoEn,
      });
      if (v.anulada && l.descontoStock) {
        entrada += l.cantidad;
        movimientos.push({
          iso: v.creadoEn,
          numero: v.numero || 0,
          orden: 0,
          fecha: cuando.dia,
          hora: cuando.hora,
          cliente: v.cliente,
          tipo: "Anulación",
          codigo: l.codigo,
          nombre: l.nombre,
          cantidad: l.cantidad,
          precio: l.precio,
          importe: l.precio * l.cantidad,
          movimiento: "Entrada por anulación",
          unidadesStock: l.cantidad,
          pago,
          empleado: v.empleado,
          anulada: "Sí",
          ventaId: v.id,
          productoId: l.productoId,
          descontoStock: "No",
          creadoEn: v.creadoEn,
        });
      }
    }
    for (const d of v.devoluciones ?? []) {
      const devCuando = partesFecha(d.creadoEn);
      for (const linea of d.lineas) {
        const original = v.lineas.find((l) => l.productoId === linea.productoId);
        const repone = Boolean(d.reponerStock && original?.descontoStock);
        if (repone) entrada += linea.cantidad;
        movimientos.push({
          iso: d.creadoEn || v.creadoEn,
          numero: v.numero || 0,
          orden: 1,
          fecha: devCuando.dia || cuando.dia,
          hora: devCuando.hora || cuando.hora,
          cliente: v.cliente,
          tipo: "Devolución",
          codigo: linea.codigo,
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          precio: linea.precio,
          importe: linea.precio * linea.cantidad,
          movimiento: repone ? "Entrada por devolución" : "Devolución sin reponer stock",
          unidadesStock: repone ? linea.cantidad : 0,
          pago,
          empleado: d.empleado || v.empleado,
          anulada: siNo(Boolean(v.anulada)),
          ventaId: v.id,
          productoId: linea.productoId,
          descontoStock: "No",
          creadoEn: d.creadoEn || v.creadoEn,
        });
      }
    }
    const partesMov: string[] = [];
    if (salida) partesMov.push(`Salida ${salida}`);
    if (entrada) partesMov.push(`Entrada ${entrada}`);
    const fila = hojaVen.addRow({
      fecha: cuando.dia,
      hora: cuando.hora,
      numero: v.numero,
      cliente: v.cliente,
      formaPago: pago,
      total: v.total,
      empleado: v.empleado,
      anulada: siNo(Boolean(v.anulada)),
      unidades,
      movimiento: partesMov.join(" · ") || "Sin movimiento de stock",
      id: v.id,
      creadoEn: v.creadoEn,
      empleadoEmail: v.empleadoEmail,
      clienteId: v.clienteId ?? "",
      devoluciones: v.devoluciones?.length ? jsonCelda(v.devoluciones) : "",
    });
    fila.getCell("total").numFmt = pesos;
  }
  hojaVen.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hojaVen.columnCount } };

  movimientos.sort((a, b) => {
    const fecha = b.iso.localeCompare(a.iso);
    if (fecha !== 0) return fecha;
    if (b.numero !== a.numero) return b.numero - a.numero;
    return a.orden - b.orden;
  });
  for (const mov of movimientos) {
    const fila = hojaLin.addRow(mov);
    fila.getCell("precio").numFmt = pesos;
    fila.getCell("importe").numFmt = pesos;
  }
  hojaLin.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hojaLin.columnCount } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function reservarNombre(ocupados: Set<string>, carpeta: string, nombre: string) {
  const ext = path.extname(nombre);
  const base = nombre.slice(0, -ext.length);
  let candidato = nombre;
  let n = 2;
  while (ocupados.has(`${carpeta}/${candidato}`)) {
    candidato = `${base}-${n}${ext}`;
    n += 1;
  }
  ocupados.add(`${carpeta}/${candidato}`);
  return candidato;
}

export async function armarZipRespaldo() {
  const productos = await leerProductos();
  const pedidos: { imagen: string; carpeta: CarpetaFoto; nombre: string }[] = [];
  const vistas = new Set<string>();
  for (const p of productos) {
    const imagen = (p.imagen || "").trim();
    if (!imagen || vistas.has(imagen)) continue;
    const nombre = nombreArchivoImagen(imagen);
    if (!nombre) continue;
    vistas.add(imagen);
    pedidos.push({ imagen, carpeta: carpetaDeRuta(imagen), nombre });
  }

  const locales = await enParalelo(pedidos, 4, async (item) => ({
    item,
    buffer: await leerFotoLocal(item.imagen),
  }));

  const faltan = locales.filter((row) => !row.buffer);
  const pathPorImagen = new Map<string, string>();
  for (const row of faltan) {
    const pathname = pathnameMedia(row.item.imagen);
    if (pathname) pathPorImagen.set(row.item.imagen, pathname);
  }
  const desdeTurso = await leerFotosTurso([...pathPorImagen.values()]);

  const fuentes: { imagen: string; carpeta: CarpetaFoto; nombre: string; buffer: Buffer }[] = [];
  for (const row of locales) {
    const buffer =
      row.buffer ??
      desdeTurso.get(pathPorImagen.get(row.item.imagen) || "")?.body ??
      null;
    if (!buffer?.length) continue;
    fuentes.push({ ...row.item, buffer });
  }

  const rubros = await listarFotosCarpeta("imagenes-rubros");
  const rubrosYa = new Set(
    fuentes.filter((f) => f.carpeta === "imagenes-rubros").map((f) => f.nombre.toLowerCase()),
  );
  for (const foto of rubros) {
    if (rubrosYa.has(foto.nombre.toLowerCase())) continue;
    fuentes.push({
      imagen: "",
      carpeta: "imagenes-rubros",
      nombre: foto.nombre,
      buffer: foto.buffer,
    });
  }

  const comprimidas = await enParalelo(fuentes, 3, async (foto) => {
    const out = await comprimirFotoRespaldo(foto.buffer, foto.nombre);
    return { ...foto, nombre: out.nombre, buffer: out.buffer };
  });

  const ocupados = new Set<string>();
  const reescritura = new Map<string, string>();
  const archivos: { carpeta: CarpetaFoto; nombre: string; buffer: Buffer }[] = [];
  for (const foto of comprimidas) {
    const nombre = reservarNombre(ocupados, foto.carpeta, foto.nombre);
    if (foto.imagen) {
      const original = nombreArchivoImagen(foto.imagen);
      if (original && nombre !== original) {
        reescritura.set(foto.imagen, rutaConNombre(foto.imagen, nombre));
      }
    }
    archivos.push({ carpeta: foto.carpeta, nombre, buffer: foto.buffer });
  }

  const excel = await armarExcelRespaldo({
    productos,
    reescribirImagen: (imagen) => reescritura.get(imagen) ?? imagen,
  });

  const zip = new JSZip();
  const fecha = new Date().toISOString().slice(0, 10);
  zip.file(`MarvePack-respaldo-${fecha}.xlsx`, excel, {
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  for (const foto of archivos) {
    zip.file(`fotos/${foto.carpeta}/${foto.nombre}`, foto.buffer, {
      compression: "STORE",
    });
  }

  const packed = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(packed);
}

export function nombreArchivoRespaldo(ext: "xlsx" | "zip") {
  const fecha = new Date().toISOString().slice(0, 10);
  return `MarvePack-respaldo-${fecha}.${ext}`;
}

export type DatosRespaldo = {
  productos: Producto[];
  clientes: ClienteFiado[];
  ventas: VentaCaja[];
  fotos: { carpeta: "imagenes-productos" | "imagenes-rubros"; nombre: string; buffer: Buffer }[];
};

function productoDesdeFila(
  fila: ExcelJS.Row,
  mapa: Map<string, number>,
): Producto | null {
  const codigo = celdaTexto(valorCol(fila, mapa, "codigo"));
  const nombre = celdaTexto(valorCol(fila, mapa, "nombre"));
  if (!codigo && !nombre) return null;
  const id =
    celdaTexto(valorCol(fila, mapa, "id")) ||
    `mp-${codigo || nombre}`.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const barras = celdaTexto(valorCol(fila, mapa, "codigosbarra", "codigosBarra"));
  const stockRaw = celdaTexto(valorCol(fila, mapa, "stock"));
  const stockMinRaw = celdaTexto(valorCol(fila, mapa, "stockminimo", "stockMinimo"));
  const costoRaw = celdaTexto(valorCol(fila, mapa, "costo"));
  const margenRaw = celdaTexto(valorCol(fila, mapa, "margen"));
  const mayoristaRaw = celdaTexto(
    valorCol(fila, mapa, "preciomayorista", "precioMayorista"),
  );
  const producto: Producto = {
    id,
    codigo: codigo || id,
    nombre: nombre || codigo,
    seccion: celdaTexto(valorCol(fila, mapa, "seccion")) || "GENERAL",
    precio: celdaNumero(valorCol(fila, mapa, "precio")),
    imagen:
      celdaTexto(valorCol(fila, mapa, "imagen")) ||
      "/recursos/imagenes-productos/default.jpg",
    descripcion:
      celdaTexto(valorCol(fila, mapa, "descripcion")) ||
      "Consultanos medidas, cantidades y disponibilidad por WhatsApp.",
    mostrarEnCaja: celdaBool(valorCol(fila, mapa, "mostrarentcaja", "mostrarEnCaja"), true),
    mostrarEnCatalogo: celdaBool(
      valorCol(fila, mapa, "mostrarencatalogo", "mostrarEnCatalogo"),
      true,
    ),
  };
  if (mayoristaRaw) producto.precioMayorista = celdaNumero(valorCol(fila, mapa, "preciomayorista", "precioMayorista"));
  if (costoRaw) producto.costo = celdaNumero(valorCol(fila, mapa, "costo"));
  if (margenRaw) producto.margen = celdaNumero(valorCol(fila, mapa, "margen"));
  if (stockRaw !== "") producto.stock = celdaNumero(valorCol(fila, mapa, "stock"));
  if (stockMinRaw !== "") {
    producto.stockMinimo = celdaNumero(valorCol(fila, mapa, "stockminimo", "stockMinimo"));
  }
  const proveedorId = celdaTexto(valorCol(fila, mapa, "proveedorid", "proveedorId"));
  if (proveedorId) producto.proveedorId = proveedorId;
  if (barras) {
    producto.codigosBarra = barras
      .split(/[|;,]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const extra = parsearJsonCelda<Record<string, unknown>>(valorCol(fila, mapa, "extra"));
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [clave, valor] of Object.entries(extra)) {
      if (CAMPOS_PRODUCTO.has(clave)) continue;
      (producto as unknown as Record<string, unknown>)[clave] = valor;
    }
  }
  return producto;
}

function clienteDesdeFila(
  fila: ExcelJS.Row,
  mapa: Map<string, number>,
): ClienteFiado | null {
  const nombre = celdaTexto(valorCol(fila, mapa, "nombre"));
  const email = celdaTexto(valorCol(fila, mapa, "email"));
  const telefono = celdaTexto(valorCol(fila, mapa, "telefono"));
  if (!nombre && !email && !telefono) return null;
  const cliente: ClienteFiado = {
    id: celdaTexto(valorCol(fila, mapa, "id")) || `cli-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    nombre: nombre || email || telefono,
    telefono: telefono || "0",
    email: email || `${telefono || "cliente"}@local.marvepack`,
    pinInicial: celdaTexto(valorCol(fila, mapa, "pininicial", "pinInicial")) || "1234",
    limiteAlmacen: celdaNumero(valorCol(fila, mapa, "limitealmacen", "limiteAlmacen")),
    limiteEfectivo: celdaNumero(valorCol(fila, mapa, "limiteefectivo", "limiteEfectivo")),
    aliasCbu: celdaTexto(valorCol(fila, mapa, "aliascbu", "aliasCbu")),
    activo: celdaBool(valorCol(fila, mapa, "activo"), true),
    saldo: celdaNumero(valorCol(fila, mapa, "saldo")),
  };
  const extra = parsearJsonCelda<Record<string, unknown>>(valorCol(fila, mapa, "extra"));
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    for (const [clave, valor] of Object.entries(extra)) {
      if (CAMPOS_CLIENTE.has(clave)) continue;
      (cliente as unknown as Record<string, unknown>)[clave] = valor;
    }
  }
  return cliente;
}

export async function parsearExcelRespaldo(buffer: Buffer): Promise<DatosRespaldo> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const productos: Producto[] = [];
  const hojaProd = workbook.getWorksheet(HOJA_PRODUCTOS) ?? workbook.worksheets[0];
  if (hojaProd) {
    const mapa = mapaCabeceras(hojaProd);
    hojaProd.eachRow((fila, n) => {
      if (n === 1) return;
      const p = productoDesdeFila(fila, mapa);
      if (p) productos.push(p);
    });
  }

  const clientes: ClienteFiado[] = [];
  const hojaCli = workbook.getWorksheet(HOJA_CLIENTES);
  if (hojaCli) {
    const mapa = mapaCabeceras(hojaCli);
    hojaCli.eachRow((fila, n) => {
      if (n === 1) return;
      const c = clienteDesdeFila(fila, mapa);
      if (c) clientes.push(c);
    });
  }

  const lineasPorVenta = new Map<string, VentaCaja["lineas"]>();
  const hojaLin = workbook.getWorksheet(HOJA_LINEAS);
  if (hojaLin) {
    const mapa = mapaCabeceras(hojaLin);
    hojaLin.eachRow((fila, n) => {
      if (n === 1) return;
      const ventaId = celdaTexto(valorCol(fila, mapa, "ventaId", "ventaid"));
      if (!ventaId) return;
      const linea = {
        productoId: celdaTexto(valorCol(fila, mapa, "productoId", "productoid")) || "",
        codigo: celdaTexto(valorCol(fila, mapa, "codigo")),
        nombre: celdaTexto(valorCol(fila, mapa, "nombre")),
        precio: celdaNumero(valorCol(fila, mapa, "precio")),
        cantidad: celdaNumero(valorCol(fila, mapa, "cantidad"), 1),
        descontoStock: celdaBool(valorCol(fila, mapa, "descontoStock", "descontostock"), true),
      };
      const lista = lineasPorVenta.get(ventaId) ?? [];
      lista.push(linea);
      lineasPorVenta.set(ventaId, lista);
    });
  }

  const ventas: VentaCaja[] = [];
  const hojaVen = workbook.getWorksheet(HOJA_VENTAS);
  if (hojaVen) {
    const mapa = mapaCabeceras(hojaVen);
    hojaVen.eachRow((fila, n) => {
      if (n === 1) return;
      const id = celdaTexto(valorCol(fila, mapa, "id"));
      if (!id) return;
      const clienteId = celdaTexto(valorCol(fila, mapa, "clienteId", "clienteid"));
      ventas.push({
        id,
        numero: celdaNumero(valorCol(fila, mapa, "numero")),
        creadoEn:
          celdaTexto(valorCol(fila, mapa, "creadoEn", "creadoen")) ||
          new Date().toISOString(),
        empleado: celdaTexto(valorCol(fila, mapa, "empleado")) || "import",
        empleadoEmail:
          celdaTexto(valorCol(fila, mapa, "empleadoEmail", "empleadoemail")) || "",
        cliente: celdaTexto(valorCol(fila, mapa, "cliente")) || "Cliente",
        clienteId: clienteId || undefined,
        formaPago: celdaTexto(valorCol(fila, mapa, "formaPago", "formapago")) || "efectivo",
        total: celdaNumero(valorCol(fila, mapa, "total")),
        anulada: celdaBool(valorCol(fila, mapa, "anulada"), false) || undefined,
        devoluciones:
          parsearJsonCelda<VentaCaja["devoluciones"]>(
            valorCol(fila, mapa, "devoluciones"),
          ) ?? undefined,
        lineas: lineasPorVenta.get(id) ?? [],
      });
    });
  }

  return { productos, clientes, ventas, fotos: [] };
}

export async function parsearZipRespaldo(buffer: Buffer): Promise<DatosRespaldo> {
  const zip = await JSZip.loadAsync(buffer);
  let excelBuf: Buffer | null = null;
  const fotos: DatosRespaldo["fotos"] = [];

  for (const [ruta, entrada] of Object.entries(zip.files)) {
    if (entrada.dir) continue;
    const limpia = ruta.replace(/\\/g, "/");
    if (/\.xlsx$/i.test(limpia) && !excelBuf) {
      excelBuf = Buffer.from(await entrada.async("nodebuffer"));
      continue;
    }
    const m = limpia.match(
      /(?:^|\/)fotos\/(imagenes-productos|imagenes-rubros)\/([^/]+)$/i,
    );
    if (m && /\.(jpe?g|png|gif|webp)$/i.test(m[2])) {
      fotos.push({
        carpeta: m[1].toLowerCase() as "imagenes-productos" | "imagenes-rubros",
        nombre: m[2],
        buffer: Buffer.from(await entrada.async("nodebuffer")),
      });
    }
  }

  if (!excelBuf) {
    throw new Error("El ZIP no tiene un Excel de respaldo (.xlsx).");
  }

  const datos = await parsearExcelRespaldo(excelBuf);
  datos.fotos = fotos;
  return datos;
}
