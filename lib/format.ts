const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatoPesos(valor: number) {
  return ars.format(valor);
}

export function nombreVitrina(nombre: string) {
  const lower = nombre.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

