import { secretSesion } from "@/lib/auth-config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const SENSIBLES = new Set(["usuarios.json", "pedidos.json"]);

type ArchivoGithub = { contenido: string; sha: string };

function repo() {
  const owner =
    process.env.GITHUB_REPO_OWNER?.trim() ||
    process.env.VERCEL_GIT_REPO_OWNER?.trim() ||
    "LDiStefanoR";
  const name =
    process.env.GITHUB_REPO_NAME?.trim() ||
    process.env.VERCEL_GIT_REPO_SLUG?.trim() ||
    "Marvepack";
  const branch =
    process.env.GITHUB_DATA_BRANCH?.trim() ||
    process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
    "main";
  return { owner, name, branch };
}

function tokenGithub() {
  return (
    process.env.GITHUB_DATA_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    ""
  );
}

export function githubDatosActivo() {
  return Boolean(tokenGithub());
}

function claveAes() {
  return createHash("sha256").update(secretSesion()).digest();
}

function encriptar(texto: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", claveAes(), iv);
  const enc = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return JSON.stringify({
    _mp: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    d: enc.toString("base64"),
  });
}

function desencriptar(texto: string) {
  const parsed = JSON.parse(texto) as {
    _mp?: number;
    iv?: string;
    tag?: string;
    d?: string;
  };
  if (parsed?._mp !== 1 || !parsed.iv || !parsed.tag || !parsed.d) {
    return texto;
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    claveAes(),
    Buffer.from(parsed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parsed.d, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function cuerpoParaGithub(nombre: string, json: string) {
  return SENSIBLES.has(nombre) ? encriptar(json) : json;
}

function cuerpoDesdeGithub(nombre: string, raw: string) {
  if (!SENSIBLES.has(nombre)) return raw;
  try {
    return desencriptar(raw);
  } catch {
    return raw;
  }
}

async function api(
  path: string,
  init?: RequestInit & { query?: string },
) {
  const token = tokenGithub();
  if (!token) return null;
  const { owner, name } = repo();
  const url = `https://api.github.com/repos/${owner}/${name}/contents/${path}${init?.query ?? ""}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
    cache: "no-store",
  });
  return res;
}

export async function leerArchivoGithub(
  nombre: string,
): Promise<ArchivoGithub | null> {
  if (!githubDatosActivo()) return null;
  const { branch } = repo();
  try {
    const res = await api(`data/${nombre}`, {
      query: `?ref=${encodeURIComponent(branch)}`,
    });
    if (!res || res.status === 404) return null;
    if (!res.ok) {
      console.error("[github-datos] lectura", nombre, res.status);
      return null;
    }
    const data = (await res.json()) as { content?: string; sha?: string };
    if (!data.content || !data.sha) return null;
    const decodificado = Buffer.from(
      data.content.replace(/\n/g, ""),
      "base64",
    ).toString("utf8");
    return {
      contenido: cuerpoDesdeGithub(nombre, decodificado),
      sha: data.sha,
    };
  } catch (error) {
    console.error("[github-datos] lectura", nombre, error);
    return null;
  }
}

export async function guardarArchivoGithub(nombre: string, json: string) {
  if (!githubDatosActivo()) return false;
  const { branch } = repo();
  const payload = cuerpoParaGithub(nombre, json);
  const content = Buffer.from(payload, "utf8").toString("base64");

  for (let intento = 0; intento < 3; intento += 1) {
    try {
      const actual = await leerArchivoGithub(nombre);
      const res = await api(`data/${nombre}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Actualizamos ${nombre}`,
          content,
          branch,
          ...(actual?.sha ? { sha: actual.sha } : {}),
        }),
      });
      if (!res) return false;
      if (res.ok) return true;
      if (res.status !== 409 && res.status !== 422) {
        console.error(
          "[github-datos] escritura",
          nombre,
          res.status,
          await res.text(),
        );
        return false;
      }
    } catch (error) {
      console.error("[github-datos] escritura", nombre, error);
      return false;
    }
  }
  return false;
}
