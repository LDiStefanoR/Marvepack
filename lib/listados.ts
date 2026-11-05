import { interesDeTicket } from "@/lib/deuda";
import { formatoFecha, formatoPesos, nombreVitrina } from "@/lib/format";
import { politicaDeCliente } from "@/lib/politica-cliente";
import type { ResumenCliente } from "@/types/cuenta";
import type { Pedido } from "@/types/pedido";
import { diaArgentina, etiquetaFormaPago, fechaHoraVenta } from "@/lib/venta-texto";

export type TipoListado =
  | "stock-actual"
  | "stock-minimo"
  | "sin-stock"
  | "mas-vendidos"
  | "menos-vendidos"
  | "mejores-clientes"
  | "mas-deudas"
  | "morosidad"
  | "ventas"
  | "ventas-comprobante"
  | "ventas-empleado"
  | "ventas-producto"
  | "ventas-franja"
  | "costo-ventas"
  | "ganancia"
  | "valor-stock"
  | "compras-proveedor"
  | "salidas-caja"
  | "prestamos-cobrar"
  | "prestamos-mora"
  | "prestamos-lineas"
  | "prestamos-pedidos"
  | "deudas-mercaderia";

export type ProductoListado = {
  id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: number;
  stock: number | null;
  stockMinimo: number | null;
  costo: number | null;
};

export type VentaListado = {
  id: string;
  numero: number;
  creadoEn: string;
  empleado: string;
  cliente: string;
  formaPago: string;
  total: number;
  anulada?: boolean;
  lineas: { productoId: string; cantidad: number; precio: number; codigo?: string; nombre?: string }[];
};

export type DeudaListado = {
  nombre: string;
  telefono: string;
  debe: number;
  interes: number;
  semanas: number;
};

export type ComprobanteListado = {
  numero: string;
  fecha: string;
  proveedorNombre: string;
  origen: string;
  articulos: number;
  total: number;
};

export type RetiroListado = {
  creadoEn: string;
  empleado: string;
  concepto: string;
  monto: number;
};

export type FiltroListado = {
  desde?: string;
  hasta?: string;
  q?: string;
};

export type TablaListado = {
  titulo: string;
  columnas: string[];
  filas: string[][];
  nota?: string;
};

export type EscalasListado = {
  moraCredito?: readonly number[];
  moraCuenta?: readonly number[];
};

const TITULOS: Record<TipoListado, string> = {
  "stock-actual": "Stock actual",
  "stock-minimo": "Stock mínimo",
  "sin-stock": "Sin stock",
  "mas-vendidos": "Productos más vendidos",
  "menos-vendidos": "Productos menos vendidos",
  "mejores-clientes": "Mejores clientes",
  "mas-deudas": "Clientes con más deudas",
  morosidad: "Clientes con alta morosidad",
  ventas: "Ventas",
  "ventas-comprobante": "Ventas de productos por comprobante",
  "ventas-empleado": "Ventas de productos por empleado",
  "ventas-producto": "Ventas por producto",
  "ventas-franja": "Ventas por franja horaria",
  "costo-ventas": "Costo de productos vendidos",
  ganancia: "Ganancia de ventas",
  "valor-stock": "Valor de la mercadería en stock",
  "compras-proveedor": "Comprobantes de recepción",
  "salidas-caja": "Salidas de efectivo",
  "prestamos-cobrar": "Préstamos a cobrar",
  "prestamos-mora": "Préstamos en mora",
  "prestamos-lineas": "Líneas de crédito",
  "prestamos-pedidos": "Pedidos de crédito",
  "deudas-mercaderia": "Deudas de mercadería",
};

export function tituloListado(tipo: TipoListado) {
  return TITULOS[tipo];
}

export function esTipoListado(valor: string): valor is TipoListado {
  return valor in TITULOS;
}

function esFilaTotal(fila: string[]) {
  return fila.some((celda) => celda.trim() === "Total");
}

function parseNumero(celda: string) {
  const textoCelda = celda.trim();
  if (!textoCelda || textoCelda === "—" || /^sin /i.test(textoCelda) || textoCelda === "Al día") return null;
  if (/^-?\d+$/.test(textoCelda)) return Number(textoCelda);
  if (!textoCelda.includes("$")) return null;
  const negativo = textoCelda.includes("-");
  const digitos = textoCelda.replace(/\D/g, "");
  if (!digitos) return null;
  return negativo ? -Number(digitos) : Number(digitos);
}

function indicesASumar(columnas: string[]) {
  const nombres = columnas.map((columna) => columna.trim().toLowerCase());
  const hayCostoExtendido = nombres.some((nombre) => nombre === "costo total" || nombre === "costo en stock");
  const sumables = new Set([
    "unidades",
    "unidades vendidas",
    "importe",
    "ganancia",
    "deuda",
    "interés",
    "interes",
    "capital",
    "mora",
    "a cobrar",
    "usado",
    "disponible",
    "límite",
    "limite",
    "artículos",
    "articulos",
    "compras",
    "stock",
    "comprobantes",
    "valor de venta",
    "venta en stock",
    "costo total",
    "costo en stock",
    "venta",
    "total",
    "a devolver",
  ]);
  return nombres.map((nombre) => {
    if (sumables.has(nombre)) return true;
    if (nombre !== "costo" || hayCostoExtendido) return false;
    return !nombres.includes("precio") && !nombres.includes("costo unitario");
  });
}

export function filasSinTotal(filas: string[][]) {
  return filas.filter((fila) => !esFilaTotal(fila));
}

export function filaTotales(columnas: string[], filas: string[][], muestra: string[][] = filas) {
  const sumar = indicesASumar(columnas);
  const hueco = Math.max(0, sumar.findIndex((valor) => !valor));
  const total = columnas.map((_, indice) => {
    if (!sumar[indice]) return indice === hueco ? "Total" : "";
    const numeros = filas
      .map((fila) => parseNumero(fila[indice] ?? ""))
      .filter((numero): numero is number => numero != null);
    const suma = numeros.reduce((acumulado, numero) => acumulado + numero, 0);
    const ejemplo =
      muestra.find((fila) => parseNumero(fila[indice] ?? "") != null)?.[indice] ??
      filas.find((fila) => parseNumero(fila[indice] ?? "") != null)?.[indice] ??
      "";
    if (!ejemplo) return numeros.length === 0 ? "" : String(suma);
    return ejemplo.includes("$") ? formatoPesos(suma) : String(suma);
  });
  if (!total.includes("Total")) total[0] = "Total";
  return total;
}

export function tablaConTotal(tabla: TablaListado, fuera: number[] = []) {
  const datos = filasSinTotal(tabla.filas);
  const ocultos = new Set(fuera);
  const elegidas = datos.filter((_, indice) => !ocultos.has(indice));
  return { ...tabla, filas: [...elegidas, filaTotales(tabla.columnas, elegidas, datos)] };
}

function horaArgentina(iso: string) {
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return Number(hora);
}

function texto(valor: string) {
  return valor.trim().toLowerCase();
}

function enRango(iso: string, filtro: FiltroListado) {
  const dia = diaArgentina(new Date(iso));
  if (filtro.desde && dia < filtro.desde) return false;
  if (filtro.hasta && dia > filtro.hasta) return false;
  return true;
}

function coincide(q: string, partes: string[]) {
  const busqueda = texto(q);
  if (!busqueda) return true;
  return partes.some((parte) => texto(parte).includes(busqueda));
}

function unidadesVendidas(ventas: VentaListado[], filtro: FiltroListado) {
  const mapa = new Map<string, { unidades: number; importe: number }>();
  for (const venta of ventas) {
    if (venta.anulada || !enRango(venta.creadoEn, filtro)) continue;
    for (const linea of venta.lineas) {
      const actual = mapa.get(linea.productoId) ?? { unidades: 0, importe: 0 };
      actual.unidades += linea.cantidad;
      actual.importe += linea.precio * linea.cantidad;
      mapa.set(linea.productoId, actual);
    }
  }
  return mapa;
}

function filaProducto(
  producto: ProductoListado,
  etiqueta: Record<string, string>,
  extra: string[] = [],
) {
  return [
    producto.codigo,
    nombreVitrina(producto.nombre),
    etiqueta[producto.seccion] ?? producto.seccion,
    producto.stock == null ? "Sin control" : String(producto.stock),
    producto.stockMinimo == null ? "—" : String(producto.stockMinimo),
    producto.costo == null ? "—" : formatoPesos(producto.costo),
    formatoPesos(producto.precio),
    ...extra,
  ];
}

const COLUMNAS_PRODUCTO = ["Código", "Producto", "Sección", "Stock", "Mínimo", "Costo", "Precio"];

const ESTADO_PEDIDO: Record<string, string> = {
  sin_atender: "Pendiente",
  en_proceso: "En proceso",
  enviando: "Por entregar",
  terminado: "Entregado",
  cancelado: "Cancelado",
};

function pesos(valor: number) {
  return formatoPesos(Math.round(valor) || 0);
}

function listadoPrestamos(
  tipo: TipoListado,
  fichas: ResumenCliente[],
  pedidos: Pedido[],
  escalas: EscalasListado | undefined,
  q: string,
): TablaListado {
  const tickets = fichas.flatMap((ficha) => {
    const politica = politicaDeCliente(ficha.cliente, escalas);
    return ficha.ticketsVigentes.map((ticket) => {
      const mora = interesDeTicket(ticket, undefined, politica);
      return {
        nombre: ficha.cliente.nombre,
        telefono: ficha.cliente.telefono,
        tipo: ticket.tipo,
        numero: ticket.numero || ticket.id,
        fecha: formatoFecha(ticket.fecha),
        vence: ticket.vencimiento ? formatoFecha(ticket.vencimiento) : "—",
        descripcion: ticket.descripcion || "—",
        debe: ticket.debe,
        interes: mora.interes,
        semanas: mora.semanas,
      };
    });
  });

  if (tipo === "prestamos-lineas") {
    const lista = fichas
      .filter((ficha) => ficha.cliente.limiteEfectivo > 0 || ficha.saldoEfectivo > 0)
      .map((ficha) => {
        const politica = politicaDeCliente(ficha.cliente, escalas);
        const creditos = ficha.ticketsVigentes.filter((t) => t.tipo === "efectivo");
        const mora = creditos.reduce((suma, t) => suma + interesDeTicket(t, undefined, politica).interes, 0);
        const semanas = creditos.reduce(
          (max, t) => Math.max(max, interesDeTicket(t, undefined, politica).semanas),
          0,
        );
        return { ficha, mora, semanas };
      })
      .filter(({ ficha }) => coincide(q, [ficha.cliente.nombre, ficha.cliente.telefono]))
      .sort((a, b) => b.ficha.saldoEfectivo - a.ficha.saldoEfectivo);
    const filas = lista.map(({ ficha, mora, semanas }) => [
      ficha.cliente.nombre,
      ficha.cliente.telefono || "—",
      pesos(ficha.cliente.limiteEfectivo),
      pesos(ficha.saldoEfectivo),
      pesos(ficha.disponibleEfectivo),
      pesos(mora),
      semanas > 0 ? `${semanas}` : "Al día",
    ]);
    if (filas.length > 0) {
      filas.push([
        "Total",
        "",
        pesos(lista.reduce((s, f) => s + f.ficha.cliente.limiteEfectivo, 0)),
        pesos(lista.reduce((s, f) => s + f.ficha.saldoEfectivo, 0)),
        pesos(lista.reduce((s, f) => s + f.ficha.disponibleEfectivo, 0)),
        pesos(lista.reduce((s, f) => s + f.mora, 0)),
        "",
      ]);
    }
    return {
      titulo: TITULOS[tipo],
      nota: "Límite, usado y disponible de cada línea de crédito. La mora es solo de los préstamos vencidos.",
      columnas: ["Cliente", "Teléfono", "Límite", "Usado", "Disponible", "Mora", "Semanas de atraso"],
      filas,
    };
  }

  if (tipo === "prestamos-pedidos") {
    const lista = pedidos
      .filter((p) => p.esCredito && p.estado !== "cancelado")
      .filter((p) => coincide(q, [p.contacto.nombre, p.contacto.telefono, p.numeroTicket ?? "", p.contacto.email]))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    const filas = lista.map((p) => [
      p.numeroTicket || "—",
      formatoFecha(p.creadoEn.slice(0, 10)),
      p.contacto.nombre,
      p.contacto.telefono || "—",
      pesos(p.total),
      p.cuotasCredito ? String(p.cuotasCredito) : "—",
      typeof p.tasaCredito === "number" ? `${p.tasaCredito}%` : "—",
      p.contacto.horarios || "—",
      ESTADO_PEDIDO[p.estado] ?? p.estado,
    ]);
    const pendientes = lista.filter((p) => p.estado !== "terminado");
    return {
      titulo: TITULOS[tipo],
      nota: `${pendientes.length} pedido${pendientes.length === 1 ? "" : "s"} todavía sin entregar. El importe es el total a devolver, con el interés incluido.`,
      columnas: ["Pedido", "Fecha", "Cliente", "Teléfono", "A devolver", "Cuotas", "Tasa", "Cuándo lo quiere", "Estado"],
      filas,
    };
  }

  const esMercaderia = tipo === "deudas-mercaderia";
  const lista = tickets
    .filter((t) => (esMercaderia ? t.tipo !== "efectivo" : t.tipo === "efectivo"))
    .filter((t) => (tipo === "prestamos-mora" ? t.semanas >= 1 || t.interes > 0 : true))
    .filter((t) => coincide(q, [t.nombre, t.telefono, t.numero, t.descripcion]))
    .sort((a, b) =>
      tipo === "prestamos-mora" ? b.semanas - a.semanas || b.interes - a.interes : b.debe - a.debe,
    );
  const filas = lista.map((t) => [
    t.nombre,
    t.telefono || "—",
    t.numero,
    t.fecha,
    t.vence,
    pesos(t.debe),
    pesos(t.interes),
    pesos(t.debe + t.interes),
    t.semanas > 0 ? String(t.semanas) : "Al día",
  ]);
  if (filas.length > 0) {
    filas.push([
      "Total",
      "",
      "",
      "",
      "",
      pesos(lista.reduce((s, t) => s + t.debe, 0)),
      pesos(lista.reduce((s, t) => s + t.interes, 0)),
      pesos(lista.reduce((s, t) => s + t.debe + t.interes, 0)),
      "",
    ]);
  }
  const capital = lista.reduce((s, t) => s + t.debe, 0);
  const mora = lista.reduce((s, t) => s + t.interes, 0);
  return {
    titulo: TITULOS[tipo],
    nota: esMercaderia
      ? `Mercadería fiada, sin los préstamos. Capital ${pesos(capital)} y mora ${pesos(mora)}.`
      : `Capital a cobrar ${pesos(capital)}. Mora ${pesos(mora)}. Total con mora ${pesos(capital + mora)}.`,
    columnas: ["Cliente", "Teléfono", "Comprobante", "Fecha", "Vence", "Capital", "Mora", "A cobrar", "Atraso"],
    filas,
  };
}

export function armarListado(
  tipo: TipoListado,
  datos: {
    productos: ProductoListado[];
    ventas: VentaListado[];
    deudas: DeudaListado[];
    etiqueta: Record<string, string>;
    comprobantes?: ComprobanteListado[];
    retiros?: RetiroListado[];
    fichas?: ResumenCliente[];
    pedidos?: Pedido[];
    escalas?: EscalasListado;
  },
  filtro: FiltroListado = {},
): TablaListado {
  const q = filtro.q ?? "";
  if (tipo === "valor-stock") {
    const lista = datos.productos.filter(
      (p) => typeof p.stock === "number" && p.stock > 0 && coincide(q, [p.codigo, p.nombre]),
    );
    const filas = lista.map((p) => {
      const stock = p.stock ?? 0;
      const costo = p.costo == null ? null : p.costo * stock;
      return [
        p.codigo,
        nombreVitrina(p.nombre),
        String(stock),
        p.costo == null ? "Sin costo" : formatoPesos(p.costo),
        costo == null ? "—" : formatoPesos(costo),
        formatoPesos(p.precio),
        formatoPesos(p.precio * stock),
      ];
    });
    const costoTotal = lista.reduce((suma, p) => suma + (p.costo == null ? 0 : p.costo * (p.stock ?? 0)), 0);
    const ventaTotal = lista.reduce((suma, p) => suma + p.precio * (p.stock ?? 0), 0);
    const sinCosto = lista.filter((p) => p.costo == null).length;
    if (filas.length > 0) {
      filas.push(["", "Total", "", "", formatoPesos(costoTotal), "", formatoPesos(ventaTotal)]);
    }
    return {
      titulo: TITULOS[tipo],
      nota: `Costo de lo que hay en stock: ${formatoPesos(costoTotal)}. Si se vende al precio de venta: ${formatoPesos(ventaTotal)}. Diferencia: ${formatoPesos(ventaTotal - costoTotal)}.${sinCosto > 0 ? ` ${sinCosto} producto${sinCosto === 1 ? "" : "s"} no tienen costo cargado.` : ""}`,
      columnas: ["Código", "Producto", "Unidades", "Costo unitario", "Costo en stock", "Precio de venta", "Valor de venta"],
      filas,
    };
  }
  if (tipo === "compras-proveedor") {
    const lista = (datos.comprobantes ?? [])
      .filter((c) => {
        if (filtro.desde && c.fecha < filtro.desde) return false;
        if (filtro.hasta && c.fecha > filtro.hasta) return false;
        return coincide(q, [c.numero, c.proveedorNombre, c.origen]);
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero));
    const filas = lista.map((c) => [
      c.fecha.split("-").reverse().join("/"),
      c.numero,
      c.proveedorNombre,
      c.origen === "pedido" ? "Pedido" : "Sin pedido",
      String(c.articulos),
      formatoPesos(c.total),
    ]);
    if (filas.length > 0) {
      filas.push(["", "", "Total", "", "", formatoPesos(lista.reduce((suma, c) => suma + c.total, 0))]);
    }
    return {
      titulo: TITULOS[tipo],
      columnas: ["Fecha", "Factura", "Proveedor", "Origen", "Artículos", "Costo"],
      filas,
    };
  }
  if (tipo === "salidas-caja") {
    const lista = (datos.retiros ?? [])
      .filter((r) => enRango(r.creadoEn, filtro) && coincide(q, [r.concepto, r.empleado]))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    const filas = lista.map((r) => {
      const cuando = fechaHoraVenta(r.creadoEn);
      return [cuando.dia, cuando.hora, r.empleado, r.concepto, formatoPesos(r.monto)];
    });
    if (filas.length > 0) {
      filas.push(["", "", "Total", "", formatoPesos(lista.reduce((suma, r) => suma + r.monto, 0))]);
    }
    return {
      titulo: TITULOS[tipo],
      columnas: ["Día", "Hora", "Empleado", "Concepto", "Importe"],
      filas,
    };
  }
  const productos = datos.productos.filter((p) =>
    coincide(q, [p.codigo, p.nombre, datos.etiqueta[p.seccion] ?? p.seccion]),
  );

  if (tipo === "stock-actual" || tipo === "stock-minimo" || tipo === "sin-stock") {
    const lista = productos.filter((p) => {
      if (tipo === "stock-minimo") {
        return p.stock != null && p.stockMinimo != null && p.stock <= p.stockMinimo;
      }
      if (tipo === "sin-stock") return p.stock === 0;
      return true;
    });
    return {
      titulo: TITULOS[tipo],
      columnas: COLUMNAS_PRODUCTO,
      filas: lista.map((p) => filaProducto(p, datos.etiqueta)),
    };
  }

  if (tipo === "mas-vendidos" || tipo === "menos-vendidos") {
    const vendido = unidadesVendidas(datos.ventas, filtro);
    const lista = productos
      .map((p) => ({ producto: p, ...(vendido.get(p.id) ?? { unidades: 0, importe: 0 }) }))
      .filter((fila) => fila.unidades > 0)
      .sort((a, b) =>
        tipo === "mas-vendidos"
          ? b.unidades - a.unidades || b.importe - a.importe
          : a.unidades - b.unidades || a.importe - b.importe,
      );
    const filas = lista.map((fila, indice) => [
      String(indice + 1),
      fila.producto.codigo,
      nombreVitrina(fila.producto.nombre),
      String(fila.unidades),
      formatoPesos(fila.importe),
    ]);
    const unidades = lista.reduce((suma, fila) => suma + fila.unidades, 0);
    const importe = lista.reduce((suma, fila) => suma + fila.importe, 0);
    if (filas.length > 0) filas.push(["", "", "Total", String(unidades), formatoPesos(importe)]);
    return {
      titulo: TITULOS[tipo],
      nota:
        tipo === "mas-vendidos"
          ? "Ranking por unidades vendidas, de mayor a menor. El puesto 1 es el que más se vendió."
          : "Ranking por unidades vendidas, de menor a mayor. El puesto 1 es el que menos se vendió entre los que tuvieron ventas.",
      columnas: ["Puesto", "Código", "Producto", "Unidades vendidas", "Importe"],
      filas,
    };
  }

  if (
    tipo === "prestamos-cobrar" ||
    tipo === "prestamos-mora" ||
    tipo === "prestamos-lineas" ||
    tipo === "prestamos-pedidos" ||
    tipo === "deudas-mercaderia"
  ) {
    return listadoPrestamos(tipo, datos.fichas ?? [], datos.pedidos ?? [], datos.escalas, q);
  }

  if (tipo === "costo-ventas" || tipo === "ganancia") {
    const vendido = unidadesVendidas(datos.ventas, filtro);
    const lista = productos
      .map((p) => {
        const venta = vendido.get(p.id) ?? { unidades: 0, importe: 0 };
        const costoTotal = p.costo == null ? null : p.costo * venta.unidades;
        const ganancia = costoTotal == null ? null : venta.importe - costoTotal;
        return { producto: p, ...venta, costoTotal, ganancia };
      })
      .filter((fila) => fila.unidades > 0)
      .sort((a, b) => b.importe - a.importe);
    if (tipo === "costo-ventas") {
      const filas = lista.map((fila) => [
        fila.producto.codigo,
        nombreVitrina(fila.producto.nombre),
        String(fila.unidades),
        fila.producto.costo == null ? "Sin costo" : formatoPesos(fila.producto.costo),
        fila.costoTotal == null ? "—" : formatoPesos(fila.costoTotal),
      ]);
      const total = lista.reduce((suma, fila) => suma + (fila.costoTotal ?? 0), 0);
      if (filas.length > 0) filas.push(["", "Total", "", "", formatoPesos(total)]);
      return {
        titulo: TITULOS[tipo],
        columnas: ["Código", "Producto", "Unidades", "Costo", "Costo total"],
        filas,
      };
    }
    const filas = lista.map((fila) => [
      fila.producto.codigo,
      nombreVitrina(fila.producto.nombre),
      String(fila.unidades),
      formatoPesos(fila.importe),
      fila.costoTotal == null ? "Sin costo" : formatoPesos(fila.costoTotal),
      fila.ganancia == null ? "—" : formatoPesos(fila.ganancia),
    ]);
    if (filas.length > 0) {
      filas.push([
        "",
        "Total",
        "",
        formatoPesos(lista.reduce((suma, fila) => suma + fila.importe, 0)),
        formatoPesos(lista.reduce((suma, fila) => suma + (fila.costoTotal ?? 0), 0)),
        formatoPesos(lista.reduce((suma, fila) => suma + (fila.ganancia ?? 0), 0)),
      ]);
    }
    return {
      titulo: TITULOS[tipo],
      columnas: ["Código", "Producto", "Unidades", "Venta", "Costo", "Ganancia"],
      filas,
    };
  }

  if (tipo === "mejores-clientes") {
    const mapa = new Map<string, { nombre: string; compras: number; total: number }>();
    for (const venta of datos.ventas) {
      if (venta.anulada || !enRango(venta.creadoEn, filtro)) continue;
      const nombre = venta.cliente.trim() || "Cliente genérico";
      if (!coincide(q, [nombre])) continue;
      const clave = nombre.toLowerCase();
      const actual = mapa.get(clave) ?? { nombre, compras: 0, total: 0 };
      actual.compras += 1;
      actual.total += venta.total;
      mapa.set(clave, actual);
    }
    const filas = [...mapa.values()].sort((a, b) => b.total - a.total);
    return {
      titulo: TITULOS[tipo],
      columnas: ["Cliente", "Compras", "Total"],
      filas: filas.map((fila) => [fila.nombre, String(fila.compras), formatoPesos(fila.total)]),
    };
  }

  if (tipo === "mas-deudas" || tipo === "morosidad") {
    const lista = datos.deudas
      .filter((d) => (tipo === "morosidad" ? d.semanas >= 1 || d.interes > 0 : d.debe > 0))
      .filter((d) => coincide(q, [d.nombre, d.telefono]))
      .sort((a, b) =>
        tipo === "morosidad" ? b.semanas - a.semanas || b.interes - a.interes : b.debe - a.debe,
      );
    return {
      titulo: TITULOS[tipo],
      columnas: ["Cliente", "Teléfono", "Deuda", "Interés", "Semanas de atraso"],
      filas: lista.map((d) => [
        d.nombre,
        d.telefono || "—",
        formatoPesos(d.debe),
        formatoPesos(d.interes),
        String(d.semanas),
      ]),
    };
  }

  if (
    tipo === "ventas-comprobante" ||
    tipo === "ventas-empleado" ||
    tipo === "ventas-producto" ||
    tipo === "ventas-franja"
  ) {
    const movimientos = datos.ventas
      .filter((venta) => !venta.anulada && enRango(venta.creadoEn, filtro))
      .flatMap((venta) =>
        venta.lineas.map((linea) => {
          const producto = datos.productos.find((item) => item.id === linea.productoId);
          return {
            venta,
            codigo: linea.codigo || producto?.codigo || "—",
            nombre: nombreVitrina(linea.nombre || producto?.nombre || "Producto"),
            unidades: linea.cantidad,
            importe: linea.precio * linea.cantidad,
            empleado: venta.empleado.trim() || "Sin empleado",
          };
        }),
      )
      .filter((linea) =>
        coincide(q, [
          linea.codigo,
          linea.nombre,
          linea.empleado,
          String(linea.venta.numero),
          linea.venta.cliente,
        ]),
      );
    if (tipo === "ventas-comprobante") {
      const filas = movimientos
        .sort((a, b) => b.venta.numero - a.venta.numero || a.nombre.localeCompare(b.nombre, "es"))
        .map((linea) => {
          const cuando = fechaHoraVenta(linea.venta.creadoEn);
          return [
            String(linea.venta.numero),
            cuando.dia,
            cuando.hora,
            linea.empleado,
            linea.codigo,
            linea.nombre,
            String(linea.unidades),
            formatoPesos(linea.importe),
          ];
        });
      return {
        titulo: TITULOS[tipo],
        nota: "Cada fila es un producto dentro de un comprobante. No incluye ventas anuladas.",
        columnas: ["Factura", "Día", "Hora", "Empleado", "Código", "Producto", "Unidades", "Importe"],
        filas,
      };
    }
    if (tipo === "ventas-empleado") {
      const mapa = new Map<string, { empleado: string; codigo: string; nombre: string; unidades: number; importe: number }>();
      for (const linea of movimientos) {
        const clave = `${linea.empleado.toLowerCase()}|${linea.codigo.toLowerCase()}`;
        const actual = mapa.get(clave) ?? {
          empleado: linea.empleado,
          codigo: linea.codigo,
          nombre: linea.nombre,
          unidades: 0,
          importe: 0,
        };
        actual.unidades += linea.unidades;
        actual.importe += linea.importe;
        mapa.set(clave, actual);
      }
      const filas = [...mapa.values()]
        .sort((a, b) => a.empleado.localeCompare(b.empleado, "es") || b.unidades - a.unidades)
        .map((linea) => [
          linea.empleado,
          linea.codigo,
          linea.nombre,
          String(linea.unidades),
          formatoPesos(linea.importe),
        ]);
      return {
        titulo: TITULOS[tipo],
        nota: "Unidades e importe vendidos por cada empleado y producto.",
        columnas: ["Empleado", "Código", "Producto", "Unidades", "Importe"],
        filas,
      };
    }
    if (tipo === "ventas-producto") {
      const mapa = new Map<string, { codigo: string; nombre: string; unidades: number; importe: number; comprobantes: Set<number> }>();
      for (const linea of movimientos) {
        const clave = linea.codigo.toLowerCase();
        const actual = mapa.get(clave) ?? {
          codigo: linea.codigo,
          nombre: linea.nombre,
          unidades: 0,
          importe: 0,
          comprobantes: new Set<number>(),
        };
        actual.unidades += linea.unidades;
        actual.importe += linea.importe;
        actual.comprobantes.add(linea.venta.numero);
        mapa.set(clave, actual);
      }
      const filas = [...mapa.values()]
        .sort((a, b) => b.importe - a.importe)
        .map((linea) => [
          linea.codigo,
          linea.nombre,
          String(linea.unidades),
          String(linea.comprobantes.size),
          formatoPesos(linea.importe),
        ]);
      return {
        titulo: TITULOS[tipo],
        nota: "Todo lo vendido, agrupado por producto.",
        columnas: ["Código", "Producto", "Unidades", "Comprobantes", "Importe"],
        filas,
      };
    }
    const porHora = new Map<number, { comprobantes: Set<number>; unidades: number; importe: number }>();
    for (const linea of movimientos) {
      const hora = horaArgentina(linea.venta.creadoEn);
      const actual = porHora.get(hora) ?? { comprobantes: new Set<number>(), unidades: 0, importe: 0 };
      actual.comprobantes.add(linea.venta.numero);
      actual.unidades += linea.unidades;
      actual.importe += linea.importe;
      porHora.set(hora, actual);
    }
    const filas = [...porHora.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hora, dato]) => {
        const desdeHora = String(hora).padStart(2, "0");
        const hastaHora = String((hora + 1) % 24).padStart(2, "0");
        return [
          `${desdeHora}:00 a ${hastaHora}:00`,
          String(dato.comprobantes.size),
          String(dato.unidades),
          formatoPesos(dato.importe),
        ];
      });
    return {
      titulo: TITULOS[tipo],
      nota: "Horario de Argentina. Cada franja es una hora.",
      columnas: ["Franja", "Comprobantes", "Unidades", "Importe"],
      filas,
    };
  }

  const ventas = datos.ventas
    .filter((v) => enRango(v.creadoEn, filtro))
    .filter((v) => coincide(q, [v.cliente, v.empleado, String(v.numero), v.formaPago]))
    .sort((a, b) => b.numero - a.numero);
  return {
    titulo: TITULOS.ventas,
    columnas: ["Factura", "Día", "Hora", "Empleado", "Cliente", "Pago", "Importe"],
    filas: ventas.map((v) => {
      const cuando = fechaHoraVenta(v.creadoEn);
      return [
        `${v.numero}${v.anulada ? " anulada" : ""}`,
        cuando.dia,
        cuando.hora,
        v.empleado,
        v.cliente,
        etiquetaFormaPago(v.formaPago),
        formatoPesos(v.total),
      ];
    }),
  };
}
