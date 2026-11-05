import type { Metadata } from "next";
import { CatalogHero } from "@/components/CatalogHero";
import { ProductCatalog } from "@/components/ProductCatalog";
import { AJUSTES_PRECIOS_BASE, leerAjustes } from "@/lib/ajustes";
import { BRAND_NAME } from "@/lib/brand";
import { armarComboVitrina, idsEnCombos } from "@/lib/combo";
import { armarVitrina, modoPrecio } from "@/lib/precios";
import { getSesion } from "@/lib/sesion";
import { leerProductos } from "@/lib/productos";
import { combosActivos, ofertasActivas, mapaOfertas } from "@/lib/promos";
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
  const ofertas = await ofertasActivas().catch(() => []);
  const combos = await combosActivos().catch(() => []);
  const porOferta = mapaOfertas(ofertas);
  const enCombo = idsEnCombos(combos);
  const ajustesOk = ajustes ?? AJUSTES_PRECIOS_BASE;
  const publicados = productos.filter((p) => p.mostrarEnCatalogo !== false);
  const vitrina = publicados.map((p) => ({
    ...armarVitrina(p, sesion, ajustesOk, porOferta.get(p.id)),
    enCombo: enCombo.has(p.id),
  }));
  const porVitrina = new Map(vitrina.map((p) => [p.id, p]));
  const combosVista = combos
    .map((c) => armarComboVitrina(c, porVitrina))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const modo = modoPrecio(sesion);
  const aviso =
    modo === "cliente"
      ? "Estás viendo tu precio de cliente. Si el rubro tiene descuento propio, se usa ese y no el general."
      : modo === "empleado"
        ? "Estás viendo tu precio de empleado. Puede ser el de tu ficha, el del rubro o el general de empleados."
        : modo === "admin"
          ? "Como admin ves el precio de lista. En cada producto aparece el descuento de clientes y el de empleados."
          : "Si te registrás como cliente ves el descuento de comercio. Los empleados ven el suyo al ingresar.";

  return (
    <main>
      <CatalogHero total={publicados.length} />
      <ProductCatalog
        productos={vitrina}
        rubros={rubros}
        seccionInicial={seccion}
        aviso={aviso}
        combos={combosVista}
      />
    </main>
  );
}
