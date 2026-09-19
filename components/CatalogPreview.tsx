import Link from "next/link";
import { MENSAJE_CATALOGO_PDF } from "@/lib/categorias";
import { whatsappUrl } from "@/lib/whatsapp";
import type { Producto } from "@/types/producto";
import type { Rubro } from "@/types/rubro";

type Props = { productos: Producto[]; rubros: Rubro[] };

export function CatalogPreview({ productos, rubros }: Props) {
  const tarjetas = rubros.map((rubro) => {
    const items = productos.filter((p) => p.seccion === rubro.clave);
    return {
      seccion: rubro.clave,
      label: rubro.etiqueta,
      count: items.length,
      imagen: rubro.imagen || items[0]?.imagen || "",
    };
  });

  return (
    <section className="bg-[#eef4ff] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wide text-cape">
              Catálogo
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
              Catálogo por WhatsApp y online
            </h2>
            <p className="mt-3 text-base text-neutral-600 sm:text-lg">
              Recorré los productos acá o pedilos por WhatsApp. También te
              pasamos precios al por mayor en PDF. Si te registrás, ves
              descuentos exclusivos.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Link
              href="/catalogo"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cape px-5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition hover:brightness-110"
            >
              Ir al catálogo
            </Link>
            <a
              href={whatsappUrl(MENSAJE_CATALOGO_PDF)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#25D366] px-5 text-sm font-bold text-white shadow-md shadow-emerald-700/25 transition hover:brightness-110"
            >
              Pedir precios al por mayor (PDF)
            </a>
            <Link
              href="/registro"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-movipack/30 px-5 text-sm font-bold text-movipack-deep transition hover:bg-white"
            >
              Solicitar ser cliente
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tarjetas.map((rubro) => (
            <Link
              key={rubro.seccion}
              href={`/catalogo?seccion=${encodeURIComponent(rubro.seccion)}`}
              className="group overflow-hidden rounded-2xl border border-movipack/15 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-movipack/10"
            >
              <div className="aspect-[16/9] overflow-hidden bg-[#e8f0ff]">
                {rubro.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rubro.imagen}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-neutral-400">
                    Sin foto
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display text-lg font-semibold not-italic text-movipack-deep">
                    {rubro.label}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {rubro.count} producto{rubro.count === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-sm font-bold text-cape">Ver →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
