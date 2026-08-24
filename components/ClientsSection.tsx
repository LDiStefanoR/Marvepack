const CLIENTES = [
  {
    titulo: "Kioscos",
    texto: "Reposición chica y frecuente, sin que te falte lo de la semana.",
  },
  {
    titulo: "Oficinas",
    texto: "Descartables e higiene para que el día a día no se corte.",
  },
  {
    titulo: "Restaurantes",
    texto: "Delivery, mostrador y cocina: el consumible que el servicio pide.",
  },
  {
    titulo: "Polirubros",
    texto: "Variedad para góndola y mostrador, en un solo proveedor.",
  },
];

export function ClientsSection() {
  return (
    <section className="border-y border-movipack/10 bg-[#f7faff] py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wide text-cape">
          A quién acompañamos
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold italic text-movipack-deep sm:text-4xl">
          Para todo tipo de negocios
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CLIENTES.map((c) => (
            <article
              key={c.titulo}
              className="rounded-2xl border border-movipack/15 bg-white p-5 shadow-sm"
            >
              <h3 className="font-display text-xl font-semibold not-italic text-movipack-deep">
                {c.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {c.texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
