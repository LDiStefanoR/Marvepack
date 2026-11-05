/** Fotos de familia / rubro. No cuentan como foto propia del producto. */
const FOTOS_GENERICAS = new Set([
  "abrochadora.jpg",
  "adhesivo.jpg",
  "alfajor.jpg",
  "aluminio.jpg",
  "bandeja-aluminio.jpg",
  "bandeja-carton-dorada.jpeg",
  "bandeja-carton.jpg",
  "bandeja-expandido.jpg",
  "bandeja-pet.jpg",
  "bandeja.jpg",
  "bandera.jpg",
  "banditas-elasticas.jpeg",
  "birome.jpg",
  "blonda.jpg",
  "bobina-limpieza.jpg",
  "bolsa-camiseta.jpg",
  "bolsa-cierre.jpg",
  "bolsa-cristal.jpg",
  "bolsa-delivery.jpg",
  "bolsa-ecommerce.jpg",
  "bolsa-friselina.jpg",
  "bolsa-kraft-asa.jpg",
  "bolsa-kraft.jpeg",
  "bolsa-kraft.jpg",
  "bolsa-panaderia.jpg",
  "bolsa-plastica.jpeg",
  "bolsa-plastica.jpg",
  "bolsa-residuos.jpg",
  "bolsa-rinon.jpg",
  "bolsa-zipper.jpg",
  "bolsas-de-arranque.jpeg",
  "bolsas-delivery-color.jpeg",
  "burbuja.jpg",
  "caja-comida.jpg",
  "caja-corazon.jpg",
  "caja-cupcake.jpg",
  "caja-delivery.jpg",
  "caja-desayuno.jpg",
  "caja-hamburguesa.jpg",
  "caja-pizza.jpg",
  "caja-regalo.jpg",
  "caja-torta.jpg",
  "cinta-embalaje.jpg",
  "cinta-papel.jpg",
  "cinta.jpg",
  "colorante.jpg",
  "copa-champagne.jpg",
  "corrugado.jpg",
  "cotillon-antifaz.jpg",
  "cotillon-confeti.jpg",
  "cotillon-lentes.jpg",
  "cotillon-luz.jpg",
  "cotillon-ninos.jpg",
  "cotillon.jpg",
  "cubiertos.jpg",
  "default.jpg",
  "dulce-leche.jpg",
  "elastico.jpg",
  "estuches-para-masa-fina.jpeg",
  "etiqueta.jpg",
  "film-pvc.jpg",
  "film-stretch.jpg",
  "film.jpg",
  "filtro-freidora.jpg",
  "globos-neon.jpg",
  "globos.jpg",
  "guantes-latex.jpg",
  "guantes-nitrilo.jpg",
  "guantes.jpg",
  "higiene.jpg",
  "hilo.jpg",
  "libreria.jpg",
  "marmita.jpg",
  "molde-torta.jpg",
  "monos.jpg",
  "moños.jpg",
  "palitos-helado.jpg",
  "palitos.jpg",
  "papel-higienico.jpg",
  "papel-manteca.jpg",
  "papel-sulfito.jpg",
  "pirotin.jpg",
  "platos.jpg",
  "pote.jpg",
  "reposteria.jpg",
  "rollo-cocina.jpg",
  "rollos.jpg",
  "silicona.jpg",
  "sobre-hamburguesa.jpg",
  "sobre-manila.jpg",
  "sprinkles.jpg",
  "vacio.jpg",
  "vaso-con-tapa.jpeg",
  "vaso-plastico.jpg",
  "vaso-termico.jpg",
  "vaso-trago.jpg",
  "vaso.jpg",
  "velas.jpg",
]);

function archivoDeImagen(imagen?: string) {
  const img = (imagen || "").trim().split("?")[0];
  const slash = img.lastIndexOf("/");
  return (slash >= 0 ? img.slice(slash + 1) : img).toLowerCase();
}

export function esFotoGenericaDeFamilia(imagen?: string) {
  const img = (imagen || "").trim();
  if (!img) return false;
  if (img.includes("/imagenes-rubros/")) return true;
  const archivo = archivoDeImagen(img);
  if (/^logo\.(jpe?g|png|webp)$/i.test(archivo)) return true;
  return FOTOS_GENERICAS.has(archivo);
}

export function tieneFotoPropia(imagen?: string) {
  const img = (imagen || "").trim();
  if (!img) return false;
  if (esFotoGenericaDeFamilia(img)) return false;
  const archivo = archivoDeImagen(img);
  if (archivo.startsWith("carga-") || archivo.startsWith("auto-")) return true;
  if (/^https?:\/\//i.test(img)) return true;
  return img.includes("/recursos/imagenes-productos/");
}

/** Sin foto propia: vacío, rubro o foto genérica de familia. */
export function sinFotoDeProducto(imagen?: string) {
  return !tieneFotoPropia(imagen);
}
