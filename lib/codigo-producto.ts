/** Códigos numéricos del catálogo (1, 007, 2628). Los alfanuméricos no entran en la serie. */
export function numeroDeCodigo(codigo: string): number | null {
  const t = codigo.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function siguienteCodigoCorrelativo(codigos: Iterable<string>): string {
  const usados = new Set<string>();
  let max = 0;
  for (const crudo of codigos) {
    const t = String(crudo ?? "").trim();
    if (!t) continue;
    usados.add(t.toLowerCase());
    const n = numeroDeCodigo(t);
    if (n != null && n > max) max = n;
  }
  let siguiente = max + 1;
  while (usados.has(String(siguiente))) siguiente += 1;
  return String(siguiente);
}
