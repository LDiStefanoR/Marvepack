import { whatsappUrl } from "@/lib/whatsapp";

const ZONAS = [
  "Zona sur",
  "Rosario centro",
  "Todo Rosario",
  "Pérez",
  "Villa Gobernador Gálvez",
  "Alvear",
  "Pueblo Esther",
  "Zavalla",
] as const;

export function DeliverySection() {
  const wa = whatsappUrl(
    "Hola MarvePack, soy cliente / quiero armar envíos programados para mi local.",
  );

  return (
    <section
      id="reparto"
      className="scroll-mt-24 border-y border-movipack/10 bg-white py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wide text-movipack">
            Envíos programados
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-movipack-deep sm:text-4xl">
            Llevamos el pedido a los que nos visitan siempre
          </h2>
          <p className="mt-4 text-lg text-neutral-700">
            Estamos en zona sur y cubrimos todo Rosario. A los clientes
            recurrentes les armamos envíos programados: te acercamos los
            productos para que el negocio no se quede sin los consumibles que
            necesita.
          </p>
          <p className="mt-3 text-lg text-neutral-700">
            Coordinamos día y frecuencia según tu ritmo. Si todavía no tenés
            ruta, escribinos y vemos cómo incluirte.
          </p>
        </div>

        <ul
          className="mt-8 flex flex-wrap gap-2"
          aria-label="Cobertura"
        >
          {ZONAS.map((z) => (
            <li
              key={z}
              className="rounded-full border border-movipack/25 bg-movipack/5 px-3 py-1.5 text-sm font-semibold text-movipack-dark"
            >
              {z}
            </li>
          ))}
        </ul>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-cape px-5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition hover:brightness-110"
        >
          Armar envíos programados
        </a>
      </div>
    </section>
  );
}
