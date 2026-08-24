import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

const RUTAS = [
  "recursos/imagenes-productos",
  "recursos/imagenes-rubros",
  "recursos/web",
  "data/productos.json",
  "data/rubros.json",
];

export function fotosEnGithub() {
  return process.env.FOTOS_EN_GITHUB !== "0";
}

async function git(args: string[]) {
  try {
    const { stdout, stderr } = await exec("git", args, {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (error) {
    const err = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "",
    };
  }
}

export async function persistirFotosGithub(): Promise<string> {
  if (!fotosEnGithub()) return "";
  if (process.env.VERCEL === "1") {
    return " En Vercel las fotos del admin no se guardan todavía; eso queda para Drive o un servidor con disco.";
  }

  const agregado = await git(["add", "-A", "--", ...RUTAS]);
  if (agregado.code !== 0) {
    console.error("[github-fotos]", agregado.stderr);
    return " La foto quedó en el servidor, pero no se pudo preparar el commit a GitHub.";
  }

  const pendiente = await git(["diff", "--cached", "--quiet", "--", ...RUTAS]);
  if (pendiente.code === 0) return "";

  const commit = await git([
    "commit",
    "--only",
    "-m",
    "Actualizamos fotos del sitio.",
    "--",
    ...RUTAS,
  ]);
  if (commit.code !== 0) {
    console.error("[github-fotos]", commit.stderr);
    return " La foto quedó en el servidor, pero GitHub no aceptó el commit.";
  }

  const push = await git(["push", "origin", "HEAD"]);
  if (push.code !== 0) {
    console.error("[github-fotos]", push.stderr);
    return " La foto quedó en el servidor y en el commit local, pero no se pudo subir a GitHub.";
  }

  return " Ya está en GitHub.";
}
