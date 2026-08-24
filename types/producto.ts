export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  precio: number;
  precioMayorista?: number;
  imagen: string;
  descripcion: string;
}

export type ProductoVitrina = Producto & {
  precioLista: number;
  precioMostrar: number;
  descuentoCliente: number;
  notaAdmin?: string;
};

export type ModoPrecio = "publico" | "cliente" | "admin";
