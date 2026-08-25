"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { etiquetaRubro, mensajeConsultaProducto } from "@/lib/categorias";
import { formatoPesos, nombreVitrina } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import type { ProductoVitrina } from "@/types/producto";

type Props = { producto: ProductoVitrina; etiqueta?: string };

export function ProductCard({ producto, etiqueta }: Props) {
  const sesion = useAuth();
  const [broken, setBroken] = useState(false);
  const [agregado, setAgregado] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [producto.imagen]);
  const { agregar } = useCart();
  const wa = whatsappUrl(mensajeConsultaProducto(producto.nombre));

  function onAgregar() {
    agregar(producto);
    setAgregado(true);
    window.setTimeout(() => setAgregado(false), 1200);
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-movipack/15 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-movipack/10">
      <div className="relative aspect-[4/3] bg-white">
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={producto.imagen}
            src={producto.imagen}
            alt={producto.nombre}
            className="h-full w-full object-contain p-2"
            width={640}
            height={480}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
            <span className="text-4xl" aria-hidden>
              🥤
            </span>
            <p className="text-xs font-medium text-neutral-500">MarvePack</p>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-movipack px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
          {etiqueta ?? etiquetaRubro(producto.seccion)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold text-neutral-400">
          Cód. {producto.codigo}
        </p>
        <h3 className="text-base font-bold leading-snug text-movipack-deep">
          {nombreVitrina(producto.nombre)}
        </h3>
        <p className="line-clamp-2 text-sm text-neutral-600">
          {producto.descripcion}
        </p>
        <div className="mt-auto pt-2">
          {producto.precioLista !== producto.precioMostrar ? (
            <div>
              <p className="text-sm font-semibold text-neutral-400 line-through">
                {formatoPesos(producto.precioLista)}
              </p>
              <p className="font-display text-2xl font-semibold not-italic text-movipack-deep">
                {formatoPesos(producto.precioMostrar)}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                Precio de cliente registrado
              </p>
            </div>
          ) : (
            <p className="font-display text-2xl font-semibold not-italic text-movipack-deep">
              {formatoPesos(producto.precioMostrar)}
            </p>
          )}
          {producto.notaAdmin && (
            <p className="mt-1 text-xs font-semibold text-cape">
              {producto.notaAdmin}
            </p>
          )}
        </div>
        {sesion?.rol !== "admin" && (
          <button
            type="button"
            onClick={onAgregar}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cape px-4 text-center text-sm font-bold text-white shadow-md shadow-red-500/20 transition hover:brightness-110"
          >
            {agregado ? "Agregado" : "Agregar al pedido"}
          </button>
        )}
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-xs font-semibold text-movipack underline-offset-4 hover:underline"
        >
          Consultar este producto
        </a>
      </div>
    </article>
  );
}
