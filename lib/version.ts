/** Cada subida a internet suma 0,1. El historial se abre al tocar la versión en el menú. */
export const VERSION_PROGRAMA = "1.2";
export const ETIQUETA_VERSION = `Beta ${VERSION_PROGRAMA}`;

export type EntradaVersion = {
  version: string;
  fecha: string;
  cambios: string[];
};

export const HISTORIAL_VERSIONES: EntradaVersion[] = [
  {
    version: "1.2",
    fecha: "23/11/2026",
    cambios: [
      "La alarma de registro se apaga cuando no quedan solicitudes pendientes.",
      "Al aceptar un cliente hay dos tipos de cuenta: genérico o descuento especial. El crédito es aparte y la ficha se crea sola.",
      "El catálogo web muestra los recargos por separado, el tope de crédito y el descuento por rubro. El Excel y el PDF salen con el nombre MarvePack.",
    ],
  },
  {
    version: "1.1",
    fecha: "23/11/2026",
    cambios: [
      "Respaldo en Configuración: descarga artículos, fotos, clientes y ventas, y los vuelve a cargar.",
    ],
  },
  {
    version: "1.0",
    fecha: "10/11/2026",
    cambios: [
      "Menú Configuración: datos del local, catálogo web, envío, intereses y stock negativo.",
      "Mantenimiento queda en productos, proveedores, secciones, empleados y medios de pago.",
      "Pago mixto en caja: parte en efectivo y el resto con tarjeta. No se puede eliminar.",
      "Se corrige el nombre mal escrito (Moto) y pasa a llamarse Pago mixto.",
      "La versión del programa se ve en el menú; al tocarla se abre este historial.",
    ],
  },
];
