export const COOKIE_SESION = "marvepack_sesion";
export const EMAIL_ADMIN = "digitalpreseciavip@gmail.com";
export const EMAIL_CLIENTE_DEMO = "leo.rds.21@gmail.com";

export function secretSesion() {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta AUTH_SECRET en el entorno");
  }
  return "marvepack-dev-auth-secret-local";
}
