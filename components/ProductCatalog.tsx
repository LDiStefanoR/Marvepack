"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { ProductoVitrina } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

type Props = {
  productos: ProductoVitrina[];
  rubros: Rubro[];
  seccionInicial?: string;
  aviso?: string;
};

const PAGE = 24;

export function ProductCatalog({
  productos,
  rubros,
  seccionInicial,
  aviso,
}: Props) {
  const etiquetas = useMemo(
    () => Object.fromEntries(rubros.map((r) => [r.clave, r.etiqueta])),
    [rubros],
  );
  const [filtro, setFiltro] = useState<string>(
    seccionInicial && rubros.some((r) => r.clave === seccionInicial)
      ? seccionInicial
      : "todas",
  );
  const [busqueda, setBusqueda] = useState("");
  const [visible, setVisible] = useState(PAGE);

  const listado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (filtro !== "todas" && p.seccion !== filtro) return false;
      if (!q) return true;
      const etiqueta = (etiquetas[p.seccion] ?? p.seccion).toLowerCase();
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.seccion.toLowerCase().includes(q) ||
        etiqueta.includes(q)
      );
    });
  }, [productos, filtro, busqueda, etiquetas]);

  const mostrados = listado.slice(0, visible);

  return (
    <section id="catalogo" className="scroll-mt-24 bg-[#eef4ff] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-cape">
            Lo que hay en el local
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
            Catálogo MarvePack
          </h2>
          <p className="mt-3 text-base text-neutral-600 sm:text-lg">
            Más de {productos.length} productos del sistema, con foto de
            referencia y precio de lista. Filtrá por rubro o buscá por nombre.
            Armá el pedido y, cuando termines, mandamos la lista por WhatsApp.
            {aviso ? ` ${aviso}` : ""}
          </p>
        </div>

        <label className="mt-8 block">
          <span className="sr-only">Buscar producto</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisible(PAGE);
            }}
            placeholder="Buscar: vaso, riñón, pizza, globo…"
            className="w-full rounded-2xl border border-movipack/20 bg-white px-4 py-3 text-base shadow-sm outline-none ring-movipack/30 placeholder:text-neutral-400 focus:border-movipack focus:ring-2"
          />
        </label>

        <div
          className="mt-6 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filtrar por sección"
        >
          <FilterChip
            active={filtro === "todas"}
            onClick={() => {
              setFiltro("todas");
              setVisible(PAGE);
            }}
            label="Todas"
          />
          {rubros.map((rubro) => (
            <FilterChip
              key={rubro.clave}
              active={filtro === rubro.clave}
              onClick={() => {
                setFiltro(rubro.clave);
                setVisible(PAGE);
              }}
              label={rubro.etiqueta}
            />
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-neutral-500">
          Mostrando{" "}
          <span className="font-bold text-movipack">{mostrados.length}</span> de{" "}
          {listado.length} producto{listado.length === 1 ? "" : "s"}
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mostrados.map((p) => (
            <ProductCard
              key={p.id}
              producto={p}
              etiqueta={etiquetas[p.seccion] ?? p.seccion}
            />
          ))}
        </div>

        {visible < listado.length && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((n) => n + PAGE)}
              className="rounded-2xl bg-movipack px-6 py-3 text-sm font-bold text-white shadow-md shadow-movipack/25 transition hover:bg-movipack-dark"
            >
              Ver más productos
            </button>
          </div>
        )}

        {listado.length === 0 && (
          <p className="mt-10 text-center text-neutral-600">
            No encontramos ese producto. Escribinos por WhatsApp y te
            asesoramos.
          </p>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-movipack-dark bg-movipack text-white shadow-md shadow-movipack/25"
          : "border-neutral-300 bg-white text-[#111111] hover:border-movipack/40"
      }`}
    >
      {label}
    </button>
  );
}
