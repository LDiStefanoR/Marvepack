export const COOKIE_SESION = "marvepack_sesion";
export const EMAIL_ADMIN = "digitalpreseciavip@gmail.com";
export const EMAIL_CLIENTE_DEMO = "leo.rds.21@gmail.com";

export function secretSesion() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Falta AUTH_SECRET en Vercel. Usamos una clave temporal; cargala en Environment Variables.",
    );
  }
  return "marvepack-dev-auth-secret-local";
}
