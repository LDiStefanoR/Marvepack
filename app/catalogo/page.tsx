import type { Metadata } from "next";
import { CatalogHero } from "@/components/CatalogHero";
import { ProductCatalog } from "@/components/ProductCatalog";
import { leerAjustes } from "@/lib/ajustes";
import { BRAND_NAME } from "@/lib/brand";
import { armarVitrina, modoPrecio } from "@/lib/precios";
import { getSesion } from "@/lib/sesion";
import { leerProductos } from "@/lib/productos";
import { leerRubros } from "@/lib/rubros";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Catálogo | ${BRAND_NAME}`,
  description:
    "Catálogo de descartables MarvePack: bolsas, cotillón, repostería, embalaje y más. Precios de lista y consulta por WhatsApp.",
};

type Props = {
  searchParams: Promise<{ seccion?: string | string[] }>;
};

export default async function CatalogoPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = params.seccion;
  const seccion = Array.isArray(raw) ? raw[0] : raw;
  const sesion = await getSesion();
  let ajustes: Awaited<ReturnType<typeof leerAjustes>> | null = null;
  let productos: Awaited<ReturnType<typeof leerProductos>> = [];
  let rubros: Awaited<ReturnType<typeof leerRubros>> = [];
  try {
    [ajustes, productos] = await Promise.all([leerAjustes(), leerProductos()]);
    rubros = await leerRubros(productos.map((p) => p.seccion));
  } catch (error) {
    console.error("[catalogo]", error);
  }
  const ajustesOk = ajustes ?? {
    descuentoClienteGenerico: 10,
    ajustePorSeccion: {},
    descuentoClientePorSeccion: {},
  };
  const vitrina = productos.map((p) => armarVitrina(p, sesion, ajustesOk));
  const modo = modoPrecio(sesion);
  const aviso =
    modo === "cliente"
      ? "Estás viendo tu precio de cliente. Al lado aparece tachado el precio de lista. El descuento puede ser el general o el propio de ese rubro."
      : modo === "admin"
        ? "Como admin ves el precio de lista y, en cada producto, el descuento que se aplica a los clientes registrados."
        : "Si te registrás, vas a ver tu precio de cliente.";

  return (
    <main>
      <CatalogHero total={productos.length} />
      <ProductCatalog
        productos={vitrina}
        rubros={rubros}
        seccionInicial={seccion}
        aviso={aviso}
      />
    </main>
  );
}
