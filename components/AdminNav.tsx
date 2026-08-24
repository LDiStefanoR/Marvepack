import Link from "next/link";

type Props = {
  activa: "precios" | "clientes";
  solicitudes?: number;
  pedidosNuevos?: number;
};

export function AdminNav({ activa, solicitudes = 0, pedidosNuevos = 0 }: Props) {
  const pendientes = solicitudes + pedidosNuevos;

  return (
    <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
      <Link
        href="/admin"
        className={
          activa === "precios"
            ? "text-movipack underline underline-offset-4"
            : "text-neutral-600 underline-offset-4 hover:text-movipack hover:underline"
        }
      >
        Precios y productos
      </Link>
      <Link
        href="/admin/clientes"
        className={`relative inline-flex items-center ${
          activa === "clientes"
            ? "text-movipack underline underline-offset-4"
            : "text-neutral-600 underline-offset-4 hover:text-movipack hover:underline"
        }`}
      >
        Clientes y pedidos
        {pendientes > 0 && (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cape px-1.5 text-[11px] font-bold text-white no-underline">
            {pendientes > 99 ? "99+" : pendientes}
          </span>
        )}
      </Link>
    </div>
  );
}
