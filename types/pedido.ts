export type EstadoPedido = "sin_atender" | "en_proceso" | "terminado";

export type LineaPedido = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  precioLista?: number;
  cantidad: number;
};

export type ContactoPedido = {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  horarios: string;
};

export type Pedido = {
  id: string;
  creadoEn: string;
  estado: EstadoPedido;
  canal: "web";
  clienteRegistrado: boolean;
  usuarioId?: string;
  contacto: ContactoPedido;
  lineas: LineaPedido[];
  total: number;
};
