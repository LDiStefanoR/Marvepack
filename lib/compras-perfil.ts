import { formatoFecha } from "@/lib/format";
import { etiquetaFormaPago } from "@/lib/venta-texto";
import type { VentaCaja } from "@/lib/caja";
import type { CompraPerfil, EstadoPedidoPerfil } from "@/components/PerfilCuenta";
import type { Pedido } from "@/types/pedido";
import type { ResumenCliente, TicketDeuda } from "@/types/cuenta";

export type VentaParaPerfil = {
  id: string;
  numero: number;
  creadoEn: string;
  formaPago: string;
  total: number;
  lineas: { nombre: string; cantidad: number; precio: number }[];
};

export function armarComprasPerfil(datos: {
  ventas: VentaParaPerfil[];
  pedidos: Pedido[];
  tickets: TicketDeuda[];
  descargaLocal: (ventaId: string) => string;
  descargaTicket?: (ticket: TicketDeuda) => string | undefined;
}): CompraPerfil[] {
  const numeros = new Set(datos.ventas.map((v) => String(v.numero)));
  const deLocal: CompraPerfil[] = datos.ventas.map((venta) => ({
    id: venta.id,
    fecha: venta.creadoEn,
    origen: "local",
    titulo: `Comprobante ${venta.numero}`,
    total: venta.total,
    detalle: `Compra en el local · ${etiquetaFormaPago(venta.formaPago)}`,
    clase: "compra" as const,
    descarga: datos.descargaLocal(venta.id),
    lineas: venta.lineas.map((linea) => ({
      nombre: linea.nombre,
      cantidad: linea.cantidad,
      monto: linea.precio * linea.cantidad,
    })),
  }));
  const deWeb: CompraPerfil[] = datos.pedidos.map((pedido) => {
    if (pedido.esRecarga) {
      const nota = pedido.recargaAcreditada
        ? "El local confirmó la transferencia y sumó el saldo."
        : pedido.recargaRechazada
          ? "El local rechazó esta recarga. El saldo no cambió."
          : "Esperando que el local confirme la transferencia.";
      return {
        id: pedido.id,
        fecha: pedido.creadoEn,
        origen: "web" as const,
        titulo: "Recarga de cuenta",
        total: pedido.total,
        detalle: nota,
        clase: "recarga" as const,
        proceso: { paso: pedido.recargaAcreditada || pedido.recargaRechazada ? 2 : 0, nota },
        lineas: pedido.lineas.map((linea) => ({
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          monto: linea.precio * linea.cantidad,
        })),
      };
    }
    if (pedido.esCredito) {
      const cancelado = pedido.estado === "cancelado";
      const entregado = pedido.estado === "terminado";
      const cuando =
        pedido.cuandoRecibe === "fecha" && pedido.fechaEntrega
          ? `Pediste recibirlo el ${formatoFecha(pedido.fechaEntrega)}.`
          : "Pediste recibirlo apenas pasen 48 horas de la aprobación.";
      const nota = cancelado
        ? pedido.motivoCancelacion
          ? `Cancelado: ${pedido.motivoCancelacion}.`
          : "El local canceló este pedido de crédito."
        : entregado
          ? "El local aprobó el crédito y lo cargó en tu cuenta."
          : `Pendiente de aprobación. ${cuando}`;
      return {
        id: pedido.id,
        fecha: pedido.creadoEn,
        origen: "web" as const,
        titulo: "Pedido de crédito",
        total: pedido.total,
        detalle: nota,
        clase: "credito" as const,
        proceso: { paso: entregado ? 3 : 0, nota, estado: entregado ? "entregado" : cancelado ? "cancelado" : "pendiente" },
        lineas: pedido.lineas.map((linea) => ({
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          monto: linea.precio * linea.cantidad,
        })),
      };
    }
    if (pedido.estado === "cancelado") {
      const nota = pedido.motivoCancelacion
        ? `Cancelado: ${pedido.motivoCancelacion}.`
        : "El local canceló este pedido.";
      return {
        id: pedido.id,
        fecha: pedido.creadoEn,
        origen: "web" as const,
        titulo: pedido.numeroTicket ? `Pedido ${pedido.numeroTicket}` : "Pedido web",
        total: pedido.total,
        detalle: nota,
        clase: "pedido" as const,
        proceso: { paso: 0, nota, estado: "cancelado" },
        lineas: pedido.lineas.map((linea) => ({
          nombre: linea.nombre,
          cantidad: linea.cantidad,
          monto: linea.precio * linea.cantidad,
        })),
      };
    }
    const estado: EstadoPedidoPerfil =
      pedido.estado === "terminado"
        ? "entregado"
        : pedido.estado === "enviando"
          ? "envio"
          : pedido.estado === "en_proceso"
            ? "preparacion"
            : "pendiente";
    const paso = estado === "entregado" ? 3 : estado === "envio" ? 2 : estado === "preparacion" ? 1 : 0;
    const etiqueta =
      estado === "envio" ? "En envío" : estado === "entregado" ? "Entregado" : estado === "preparacion" ? "En preparación" : "Pendiente";
    const llega = pedido.contacto.horarios || "el horario que elegiste";
    const transfiere = pedido.pago?.forma === "transferencia" || pedido.pago?.forma === "mixto";
    const nota =
      estado === "entregado"
        ? "Pedido entregado."
        : estado === "envio"
          ? `Ya salió. Te llega ${llega}.`
          : estado === "preparacion"
            ? `Lo estamos preparando para que te llegue ${llega}.`
            : transfiere
              ? `Pendiente. El local recibió el pedido para que te llegue ${llega}. Cuando pagues, se despacha. No hace falta que mandes el comprobante.`
              : `Pendiente. El local recibió el pedido para que te llegue ${llega}.`;
    return {
      id: pedido.id,
      fecha: pedido.creadoEn,
      origen: "web" as const,
      titulo: pedido.numeroTicket ? `Pedido ${pedido.numeroTicket}` : "Pedido web",
      total: pedido.total,
      detalle: `${etiqueta} · Pedido por internet`,
      clase: "pedido" as const,
      entrega: pedido.contacto.horarios || undefined,
      proceso: { paso, nota, estado },
      lineas: pedido.lineas.map((linea) => ({
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        monto: linea.precio * linea.cantidad,
      })),
    };
  });
  const sueltos: CompraPerfil[] = datos.tickets
    .filter(
      (t) =>
        t.origen !== "web" &&
        !numeros.has((t.numero ?? "").trim()) &&
        !(t.pedidoId && datos.pedidos.some((p) => p.id === t.pedidoId)),
    )
    .map((ticket) => ({
      id: ticket.id,
      fecha: ticket.fecha,
      origen: "local" as const,
      titulo: `Ticket ${ticket.numero?.trim() || ticket.id}`,
      total: ticket.total || ticket.debe,
      detalle: "Compra en el local",
      clase: "compra" as const,
      descarga: datos.descargaTicket?.(ticket) ?? ticket.adjunto,
      lineas: (ticket.lineas ?? []).map((linea) => ({
        nombre: linea.nombre,
        cantidad: 1,
        monto: linea.monto ?? 0,
      })),
    }));
  return [...deLocal, ...deWeb, ...sueltos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function comprasDeFicha(datos: {
  resumen: ResumenCliente;
  ventas: VentaCaja[];
  pedidos: Pedido[];
  usuarioId?: string;
}): CompraPerfil[] {
  const email = datos.resumen.cliente.email.trim().toLowerCase();
  const nombre = datos.resumen.cliente.nombre.trim().toLowerCase();
  const ventas = datos.ventas.filter((venta) => {
    if (venta.anulada) return false;
    if (datos.usuarioId && venta.clienteId === datos.usuarioId) return true;
    return nombre.length > 2 && venta.cliente.trim().toLowerCase() === nombre;
  });
  const pedidos = datos.pedidos.filter((pedido) => {
    if (datos.usuarioId && pedido.usuarioId === datos.usuarioId) return true;
    return Boolean(email) && pedido.contacto.email.trim().toLowerCase() === email;
  });
  const tickets = [...datos.resumen.ticketsVigentes, ...datos.resumen.ticketsPagados];
  return armarComprasPerfil({
    ventas,
    pedidos,
    tickets,
    descargaLocal: (id) => `/caja/comprobante/${id}?formato=ticket`,
    descargaTicket: (ticket) => ticket.adjunto || `/caja/deuda/${ticket.id}`,
  });
}
