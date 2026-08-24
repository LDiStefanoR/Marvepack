import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

const RUBROS = [
  "Repostería",
  "Cotillón",
  "Descartables",
  "Bolsas y embalaje",
];

export function AboutSection() {
  return (
    <section id="sobre" className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-lg overflow-hidden rounded-3xl border border-movipack/15 bg-neutral-100 shadow-lg shadow-movipack/10">
          <Image
            src="/recursos/web/quienes-somos.webp"
            alt={`Local de ${BRAND_NAME} en zona sur, Rosario`}
            fill
            className="object-cover object-[38%_62%]"
            sizes="(max-width: 1024px) 100vw, 520px"
            quality={90}
            priority
          />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-cape">
            Quiénes somos
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
            Distribuidora de zona sur, para todo Rosario
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-700">
            Trabajamos gran variedad de artículos descartables: desde
            repostería y cotillón hasta el consumible del día a día. Atendemos
            kioscos, oficinas, restaurantes y polirubros. Decinos qué necesita
            tu local y te armamos el pedido.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Rubros">
            {RUBROS.map((r) => (
              <li
                key={r}
                className="rounded-full border border-movipack/25 bg-movipack/5 px-3 py-1.5 text-sm font-semibold text-movipack-dark"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
